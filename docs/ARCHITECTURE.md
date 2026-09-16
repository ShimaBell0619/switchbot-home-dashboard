# Architecture

## Current objective

The architecture PoC is proven: SwitchBot environmental readings can be collected independently of page loads, persisted in Azure, and read without waiting on the SwitchBot Open API during the user read path.

The current product layer adds **Home Story** on top of that path. Home Story deterministically reduces the current JST calendar day's stored observations into a small factual narrative for the mobile UI.

Issue #21 simplifies the read path by removing the scale-to-zero Azure Container App HTTP API. The Next.js server runtime reads the persisted Table Storage history directly with a read-only table-scoped SAS. Browser code still receives neither Azure credentials nor direct Table access.

## Approved target topology

```text
SwitchBot Open API
        ^
        | scheduled status read every five minutes
        |
Azure Container Apps Job
scheduled collector, scale-to-zero between executions
        |
        v
Azure Table Storage
- CurrentState
- SensorReadings
        ^
        | server-side HTTPS + read-only table SAS
        |
Next.js on Vercel
- read stored history
- generate Home Story
- render mobile-first UI
        |
        v
Browser
```

Collection and read responsibilities remain intentionally separated. A slow or unavailable SwitchBot API must not block reads of already-collected data.

During the Issue #21 cutover, the existing Container App read API remains available only as a rollback path. Next.js prefers direct Table Storage whenever all direct-read settings are present; the API fallback is removed after Production direct-read verification.

## Runtime and deployment

- The collector image uses Node.js 24.
- The collector runs as an Azure Container Apps scheduled Job every five minutes with one replica and one completion.
- The collector uses 0.25 vCPU and 0.5 GiB memory for the PoC.
- The Container Apps Environment has no VNet integration and no Log Analytics workspace/destination.
- The collector image is published from the trusted deployment workflow to GHCR with an immutable commit-SHA tag. ACR is deliberately excluded to avoid a registry fixed cost.
- The workload keeps one Standard_LRS Storage Account in Japan East for application-owned Table Storage.
- `infra/main.bicep` owns the Azure collector workload resources.
- Application Insights, Key Vault, VNet integration, private endpoints, queues/event buses, and additional data stores remain deliberately excluded.
- Azure deployment is privileged and runs only from trusted `main` through the owner-triggered deployment path.
- GitHub -> Azure authentication uses OIDC. No Azure client secret is introduced.
- Vercel Git Integration owns the web deployment. Direct Table credentials exist only as server-side Production environment variables and are never committed.

## Responsibilities

### Next.js / Vercel

- Render Home Story as a dynamic Server Component.
- Read `SensorReadings` directly from Azure Table Storage only from the server runtime.
- Use a read-only SAS scoped to the history table; never use a Storage account key or write-capable SAS.
- Generate Home Story server-side from the bounded stored history.
- Hold no SwitchBot Token/Secret.
- Never expose the Table SAS through `NEXT_PUBLIC_*`, browser bundles, API responses, logs, fixtures, screenshots, or repository content.
- Do not perform background collection in the browser or Vercel request path.
- Do not make browser-side requests to SwitchBot or Azure Table Storage.
- Keep no-data, stale, and backend-error states distinct from a valid calm day.

### Scheduled collector

The collector signs the SwitchBot Open API v1.1 request server-side, validates HTTP success independently from SwitchBot `statusCode == 100`, validates environmental fields, and persists only a valid response.

For the selected `MeterPro(CO2)`, the official status field `CO2` is normalized to application field `co2` and validated as an integer from `0` to `9999`. Temperature, humidity, optional battery, and CO₂ are persisted together. Older rows without `co2` remain valid and require no migration.

The SwitchBot status endpoint does not provide an upstream observation timestamp for this polling path. The collector records its own successful observation time and marks `sourceTimestampKind = collector` explicitly.

The scheduled job exits non-zero on missing configuration or collection/persistence failure so a failed execution is visible as failed instead of silently succeeding.

### Server read path

The Next.js server queries at most 288 rows from `SensorReadings`, filtered to the selected device partition, and generates the existing Home Story response state in-process.

The direct read path preserves the existing semantics:

- valid current-day observations return a generated Home Story and freshness metadata;
- no observations for the current JST day produce `no_data`;
- storage/query/story failures produce a separate backend error state;
- no failure path fabricates a calm day or zero/default sensor values.

No public Azure read API is required in the target topology.

### Home Story engine

The shared deterministic story logic owns story selection. It does not use an LLM.

For each request, the engine:

1. receives the bounded recent history already loaded from Table Storage;
2. filters observations to the current calendar day in `Asia/Tokyo` semantics;
3. detects meaningful sensor changes with coarse five-minute-polling-aware thresholds;
4. consolidates nearby candidates of the same type so one physical change is not repeated as multiple story rows;
5. ranks candidates and retains at most four meaningful events;
6. presents retained events chronologically;
7. falls back to a calm-day summary and available daily ranges when no meaningful event exists.

Initial detector values remain explainable rather than adaptive:

- sustained CO₂ high: `>= 1000 ppm` across at least three observations spanning about ten minutes;
- rapid CO₂ rise/drop: at least `200 ppm` within thirty minutes;
- temperature rise: at least `1.0 ℃` within sixty minutes;
- humidity rise/drop: at least `8` percentage points within sixty minutes;
- same-type candidates within sixty minutes are consolidated, keeping the strongest candidate.

These thresholds are product heuristics, not medical/safety standards. Story text describes only observed facts and does not infer ventilation, presence, sleep, or return-home activity.

A valid stable day and a missing-data day are different states:

- stable observations -> `calm` story with observed min/max ranges;
- no observations for the current JST day -> `no_data`;
- storage/generation failure -> `backend_error` UI state.

## Azure Table Storage

Use two tables because the write/read patterns are different.

`CurrentState` provides a point representation of the latest known device state and remains maintained by the collector.

- `PartitionKey`: device ID
- `RowKey`: `current`
- fields: device type, temperature, humidity, optional battery, optional CO₂, `observedAt`, `collectedAt`, and timestamp-source meaning

`SensorReadings` stores timestamped history and is the only table required by the current Home Story read path.

- `PartitionKey`: device ID
- `RowKey`: a 13-digit inverted UTC timestamp derived from the start of the five-minute observation bucket
- fields: the same selected environmental reading fields and timestamps

The inverted RowKey makes newer readings sort before older readings inside a device partition. Five-minute bucketing gives a retry within the same logical collection interval the same entity identity. History uses Insert-or-Replace semantics, so retries update the same entity rather than create a misleading duplicate.

Persistence writes history first and updates `CurrentState` only after the history upsert succeeds. A failed SwitchBot request performs no storage write.

The Next.js read path queries at most 288 history entities. The story engine then filters those observations to the current JST day.

No automatic retention, archival, or deletion policy is approved yet.

## Storage authorization

The workload continues to avoid Azure RBAC role-assignment creation because `roleAssignments/write` is outside the proven deployer boundary.

- The scheduled collector receives table-scoped service SAS tokens with add/update permissions only.
- The Next.js server receives a separate `SensorReadings` table-scoped service SAS with read permission only.
- The Vercel SAS must be stored as a Sensitive Production environment variable and must never be committed or exposed to browser code.
- SAS values remain independent of SwitchBot credentials; Vercel never receives SwitchBot Token/Secret.
- The current SAS model is appropriate for the PoC; credential rotation remains a hardening item.

A later production design should prefer workload identity federation plus data-plane RBAC if the required Azure role-assignment boundary is explicitly approved and provisionable.

## Trust boundaries and secrets

SwitchBot is an external API trust boundary. The collector owns authentication/signing and validation.

- Store SwitchBot Token/Secret only in the Container Apps Job secrets or a future approved secret store.
- Vercel receives only the minimum server-side Table read settings required for Home Story.
- Never place SwitchBot credentials or Table SAS values in browser code, API responses, logs, fixtures, screenshots, or committed files.
- Treat HTTP success and SwitchBot response status as separate validation signals.
- Persist only validated readings; upstream errors must not become fabricated sensor records.

The current public UI remains intentionally unauthenticated while security/public-surface hardening is deferred. Only the approved low-sensitivity environmental values may be rendered.

## Failure and freshness behavior

- A failed collection attempt leaves the previous valid `CurrentState` and existing history intact.
- Missing collector configuration fails the scheduled job; it is not represented as sensor data.
- A configured read path with no successful current-day observation returns the `no_data` UI state.
- A Table Storage read/story failure returns a separate backend-error UI state and never a fabricated calm day or zero/default reading.
- Successful story state contains freshness metadata derived from the latest observation. The default stale threshold is 900 seconds.
- The UI states stale/error meaning in text instead of relying on color.
- History writes remain idempotent for the five-minute observation identity.

## Deliberate exclusions

- Webhook ingestion;
- device commands and Scenes UI;
- authentication/authorization work;
- multi-user tenancy;
- LLM-generated summaries;
- event streaming or messaging middleware;
- cross-vendor IoT abstraction;
- analytics/aggregation stores and graph-heavy trend UI;
- automatic retention/archival;
- Application Insights and additional operational telemetry services;
- ACR and Log Analytics for this PoC;
- managed-identity/workload-identity table authorization until the deployment RBAC boundary is explicitly proven.
