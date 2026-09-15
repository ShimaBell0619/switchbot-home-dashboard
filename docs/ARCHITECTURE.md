# Architecture

## Current objective

The original architecture PoC is proven: SwitchBot environmental readings can be collected independently of page loads, persisted in Azure, and read without waiting on the SwitchBot Open API during the user read path.

The current product layer adds **Home Story** on top of that proven path. Home Story deterministically reduces the current JST calendar day's stored observations into a small factual narrative for the mobile UI.

## Approved target topology

```text
SwitchBot Open API
        ^
        | scheduled status read
        |
Azure Functions Flex Consumption
Timer-triggered collector
        |
        v
Azure Table Storage
- CurrentState
- SensorReadings
        ^
        |
Azure Functions
HTTP read APIs
- GET /api/latest
- GET /api/history
- GET /api/story
        ^
        |
Next.js on Vercel
mobile-first Home Story UI
```

Collection and read responsibilities remain intentionally separated. A slow or temporarily unavailable SwitchBot API must not block reads of already-collected data.

## Runtime and deployment

- Azure Functions uses Linux Flex Consumption (`FC1`), Node.js 24, and the Functions Node.js v4 programming model.
- The v4 registration layer is intentionally thin: `src/index.js` registers timer/HTTP triggers while testable collection, validation, persistence, story generation, and response logic remain in application-owned modules.
- The workload uses one Function App and one Standard_LRS Storage Account in Japan East.
- `infra/main.bicep` owns the Azure workload resources.
- Application Insights, Key Vault, VNet integration, private endpoints, queues/event buses, and additional data stores remain deliberately excluded.
- Azure deployment is privileged and runs only from the trusted workflow on `main` through the already-approved owner-triggered deployment path.
- GitHub -> Azure authentication uses OIDC. No Azure client secret is introduced.
- The Functions package is deployed through the Flex-supported zip/OneDeploy path after Bicep deployment succeeds.

The Azure workflow preserves existing `SWITCHBOT_TOKEN`, `SWITCHBOT_SECRET`, and `SWITCHBOT_DEVICE_ID` Function App settings across infrastructure redeployment. It never prints or writes those values to repository files.

## Responsibilities

### Next.js / Vercel

- Render Home Story as a dynamic Server Component.
- Read story data only from the application backend through the server-side `AZURE_FUNCTIONS_BASE_URL` setting.
- Hold no SwitchBot credentials or Azure Storage credentials.
- Do not perform background collection or story inference in the browser.
- Do not make browser-side requests to SwitchBot or Azure Table Storage.
- Keep no-data, stale, and backend-error states distinct from a valid calm day.

### Azure Functions

One Function App registers:

- `collectSensor`: timer-triggered collector scheduled every five minutes;
- `latest`: anonymous low-sensitivity read endpoint for the latest stored environmental reading;
- `history`: anonymous bounded read endpoint for `1h`, `6h`, or `24h` history;
- `story`: anonymous low-sensitivity endpoint that derives the current day's Home Story from stored history.

The collector signs the SwitchBot Open API v1.1 request server-side, validates HTTP success independently from SwitchBot `statusCode == 100`, validates environmental fields, and persists only a valid response.

For the selected `MeterPro(CO2)`, the official status field `CO2` is normalized to application field `co2` and validated as an integer from `0` to `9999`. Temperature, humidity, optional battery, and CO₂ are then persisted together. Older rows without `co2` remain valid and require no migration.

The SwitchBot status endpoint does not provide an upstream observation timestamp for this polling path. The collector therefore records its own successful observation time and marks `sourceTimestampKind = collector` explicitly.

### Home Story engine

`shared/story.js` owns deterministic story selection. It does not use an LLM.

For each request, the engine:

1. receives the bounded recent history already loaded from Table Storage;
2. filters observations to the current calendar day in `Asia/Tokyo` semantics;
3. detects meaningful sensor changes with coarse five-minute-polling-aware thresholds;
4. consolidates nearby candidates of the same type so one physical change is not repeated as multiple story rows;
5. ranks candidates and retains at most four meaningful events;
6. presents retained events chronologically;
7. falls back to a calm-day summary and available daily ranges when no meaningful event exists.

Initial detector values are deliberately explainable rather than adaptive:

- sustained CO₂ high: `>= 1000 ppm` across at least three observations spanning about ten minutes;
- rapid CO₂ rise/drop: at least `200 ppm` within thirty minutes;
- temperature rise: at least `1.0 ℃` within sixty minutes;
- humidity rise/drop: at least `8` percentage points within sixty minutes;
- same-type candidates within sixty minutes are consolidated, keeping the strongest candidate.

These thresholds are product heuristics, not medical/safety standards. They are covered by focused regression tests and may be tuned later from real usage evidence.

Story text is constrained to observed facts. The engine may say `CO₂が急低下`, but it must not claim causes such as ventilation, presence, sleep, or return-home activity without another data source proving that cause.

A valid stable day and a missing-data day are different states:

- stable observations -> `calm` story with observed min/max ranges;
- no observations for the current JST day -> `404 no_data`;
- storage/generation failure -> `502 backend_error`.

### Azure Table Storage

Use two tables because the read patterns are different.

`CurrentState` provides a point read for the latest known device state.

- `PartitionKey`: device ID
- `RowKey`: `current`
- fields: device type, temperature, humidity, optional battery, optional CO₂, `observedAt`, `collectedAt`, and timestamp-source meaning

`SensorReadings` stores timestamped history.

- `PartitionKey`: device ID
- `RowKey`: a 13-digit inverted UTC timestamp derived from the start of the five-minute observation bucket
- fields: the same selected environmental reading fields and timestamps

The inverted RowKey makes newer readings sort before older readings inside a device partition. Five-minute bucketing deliberately gives a retry within the same logical collection interval the same entity identity. History uses Insert-or-Replace semantics, so retries update the same entity rather than create a misleading duplicate.

Persistence writes history first and updates `CurrentState` only after the history upsert succeeds. A failed SwitchBot request performs no storage write.

The history API never exposes arbitrary OData/filter input. It accepts only the fixed `1h`, `6h`, and `24h` windows, queries at most 288 entities, and filters to the requested recent window before responding. The story endpoint reuses the same bounded 288-row read; because the collector identity is one row per five-minute bucket, one calendar day is bounded by the same 288-row maximum.

No automatic retention, archival, or deletion policy is approved yet.

## Storage authorization

The workload deliberately avoids Azure RBAC role-assignment creation because the reusable GitHub Azure deployer has proven workload-management access, but `roleAssignments/write` is not part of the proven boundary.

- The Functions host/deployment storage connection remains a server-side Function App setting generated by Bicep.
- Runtime table access uses separate table-scoped service SAS tokens for `CurrentState` and `SensorReadings`, with only read/add/update permissions.
- The SAS tokens live only in Function App settings; they are never returned by the HTTP API or exposed to Vercel/browser code.
- Bicep redeployment rotates these table SAS values. The current workload uses a one-year SAS expiry; long-lived credential rotation remains a hardening item.

A later production design should prefer managed identity plus data-plane RBAC if the deployment identity receives the explicit role-assignment capability needed to provision that model safely.

## Trust boundaries and secrets

SwitchBot is an external API trust boundary. The collector owns authentication/signing and validation.

- Store SwitchBot Token/Secret only in Function App server-side configuration or a future approved secret store.
- Never place SwitchBot credentials in Vercel environment variables, browser bundles, API responses, logs, fixtures, screenshots, or committed files.
- Treat HTTP success and SwitchBot response status as separate validation signals.
- Persist only validated readings; upstream errors must not become fabricated sensor records.

Azure Table SAS values and the Functions host storage credential are also server-only secrets. They are generated by the Bicep deployment and are not Bicep outputs.

The current read surface remains intentionally unauthenticated while security/public-surface hardening is deferred from Home Story Issue #11. Therefore only the approved low-sensitivity environmental values may be exposed. Lock state, occupancy/security events, device control, or other sensitive home data require a separate security decision first.

## Failure and freshness behavior

- A failed collection attempt leaves the previous valid `CurrentState` and existing history intact.
- A missing SwitchBot configuration returns `503 not_configured`; it is not represented as sensor data.
- A configured collector with no successful current-day observation returns `404 no_data` from the story endpoint.
- A storage/read/story failure returns a separate backend-error response and never a fabricated calm day or zero/default reading.
- Successful story responses contain explicit freshness metadata derived from the latest observation. The default stale threshold is 900 seconds.
- The UI states stale/error meaning in text instead of relying on color.
- History writes remain idempotent for the five-minute observation identity.

## Deliberate exclusions

- Webhook ingestion;
- device commands and Scenes UI;
- authentication/authorization work in Issue #11;
- multi-user tenancy;
- LLM-generated summaries;
- event streaming or messaging middleware;
- cross-vendor IoT abstraction;
- analytics/aggregation stores and graph-heavy trend UI;
- automatic retention/archival;
- Application Insights and additional operational telemetry services;
- managed-identity table authorization until the deployment RBAC boundary is explicitly proven.

## Evolution

After Home Story proves useful with accumulated real data, a separate trend experience may compare multiple days and support a future `今日 / 傾向` switch. Webhook ingestion may later complement scheduled reconciliation for more precise event timing. Authentication, public-surface hardening, managed identity, secret-store integration, telemetry, and retention remain separate decisions rather than hidden scope.
