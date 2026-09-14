# Architecture

## PoC objective

Prove that SwitchBot environmental sensor data can be collected independently of page loads, stored in Azure, and read quickly by a minimal web UI without waiting on the SwitchBot Open API during the user read path.

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
HTTP read API
- GET /api/latest
- GET /api/history
        ^
        |
Next.js on Vercel
minimal server-rendered web UI
```

Collection and read responsibilities are intentionally separated. A slow or temporarily unavailable SwitchBot API must not block reads of already-collected data.

## Runtime and deployment

- Azure Functions uses Linux Flex Consumption (`FC1`), Node.js 24, and the current Functions Node.js v4 programming model.
- The v4 registration layer is intentionally thin: `src/index.js` registers the timer/HTTP triggers while testable collection, validation, persistence, and response logic stays in small application-owned modules.
- The PoC uses one Function App and one Standard_LRS Storage Account in Japan East.
- `infra/main.bicep` owns the Azure workload resources.
- Application Insights, Key Vault, VNet integration, private endpoints, queues/event buses, and additional data stores are deliberately excluded from the PoC.
- Azure deployment is privileged and runs only from the trusted workflow already present on `main`, triggered by the repository owner's exact `/deploy-azure` comment on Issue #3.
- GitHub -> Azure authentication uses OIDC. No Azure client secret is introduced.
- The Functions package is deployed through the Flex-supported zip/OneDeploy path after the Bicep deployment succeeds.

The Azure workflow preserves existing `SWITCHBOT_TOKEN`, `SWITCHBOT_SECRET`, and `SWITCHBOT_DEVICE_ID` Function App settings before an infrastructure redeploy and restores them afterward. The workflow never prints or writes those values to repository files.

## Responsibilities

### Next.js / Vercel

- Render the minimal PoC UI as a dynamic Server Component.
- Read latest/history data only from the application backend through the server-side `AZURE_FUNCTIONS_BASE_URL` setting.
- Hold no SwitchBot credentials or Azure Storage credentials.
- Do not perform background collection.
- Do not make browser-side requests to SwitchBot or Azure Table Storage.

### Azure Functions

The PoC uses one Function App with v4 code-based trigger registration:

- `collectSensor`: timer-triggered collector scheduled every five minutes;
- `latest`: anonymous low-sensitivity read endpoint for the latest stored environmental reading;
- `history`: anonymous bounded read endpoint for `1h`, `6h`, or `24h` history.

The collector signs the SwitchBot Open API v1.1 request server-side, validates HTTP success independently from SwitchBot `statusCode == 100`, validates the environmental fields, and persists only a valid response.

The SwitchBot status endpoint used by the PoC does not provide an upstream observation timestamp for the selected Meter-style reading. The collector therefore records its own successful observation time and marks `sourceTimestampKind = collector` explicitly.

### Azure Table Storage

Use two tables because the read patterns are different.

`CurrentState` provides a point read for the latest known device state.

- `PartitionKey`: device ID
- `RowKey`: `current`
- fields: device type, temperature, humidity, optional battery, `observedAt`, `collectedAt`, and timestamp-source meaning

`SensorReadings` stores timestamped history.

- `PartitionKey`: device ID
- `RowKey`: a 13-digit inverted UTC timestamp derived from the start of the five-minute observation bucket
- fields: the same selected environmental reading fields and timestamps

The inverted RowKey makes newer readings sort before older readings inside a device partition. Five-minute bucketing deliberately gives a retry within the same logical collection interval the same entity identity. History uses Insert-or-Replace semantics, so retries update the same entity rather than create a misleading duplicate.

Persistence writes history first and updates `CurrentState` only after the history upsert succeeds. A failed SwitchBot request performs no storage write.

The history API never exposes arbitrary OData/filter input. It accepts only the fixed `1h`, `6h`, and `24h` windows, queries at most 288 entities, and filters to the requested recent window before responding.

No automatic retention, archival, or deletion policy is approved yet.

## Storage authorization

The PoC deliberately avoids Azure RBAC role-assignment creation because the reusable GitHub Azure deployer has proven workload-management access, but `roleAssignments/write` is not part of the proven boundary.

- The Functions host/deployment storage connection remains a server-side Function App setting generated by Bicep.
- Runtime table access uses separate table-scoped service SAS tokens for `CurrentState` and `SensorReadings`, with only read/add/update permissions.
- The SAS tokens live only in Function App settings; they are never returned by the HTTP API or exposed to Vercel/browser code.
- Bicep redeployment rotates these table SAS values. The current PoC uses a one-year SAS expiry; long-lived credential rotation is a post-PoC hardening item.

A later production design should prefer managed identity plus data-plane RBAC if the deployment identity receives the explicit role-assignment capability needed to provision that model safely.

## Trust boundaries and secrets

SwitchBot is an external API trust boundary. The collector owns authentication/signing and validation.

- Store SwitchBot Token/Secret only in Function App server-side configuration or a future approved secret store.
- Never place SwitchBot credentials in Vercel environment variables, browser bundles, API responses, logs, fixtures, screenshots, or committed files.
- Treat HTTP success and SwitchBot response status as separate validation signals.
- Persist only validated readings; upstream errors must not become fabricated sensor records.

Azure Table SAS values and the Functions host storage credential are also server-only secrets. They are generated by the Bicep deployment and are not Bicep outputs.

The initial PoC is intentionally unauthenticated. Therefore only the explicitly selected low-sensitivity environmental values may be exposed through the read API. Lock state, occupancy/security events, device control, or other sensitive home data require a separate security decision first.

## Failure and freshness behavior

- A failed collection attempt leaves the previous valid `CurrentState` intact.
- A missing SwitchBot configuration returns `503 not_configured`; it is not represented as sensor data.
- A configured collector with no successful stored reading returns `404 no_data`.
- A storage/read failure returns a separate backend-error response and never a zero/default reading.
- Successful latest responses contain explicit freshness metadata. The default stale threshold is 900 seconds.
- The UI states stale/error meaning in text instead of relying on color.
- History writes are idempotent for the five-minute observation identity.

## Deliberate PoC exclusions

- Webhook ingestion;
- device commands;
- authentication/authorization;
- multi-user tenancy;
- event streaming or messaging middleware;
- cross-vendor IoT abstraction;
- analytics/aggregation stores;
- automatic retention/archival;
- Application Insights and additional operational telemetry services;
- managed-identity table authorization until the deployment RBAC boundary is explicitly proven.

## Evolution

If the PoC succeeds, Webhook ingestion may be evaluated as a complementary near-real-time collection path while retaining scheduled reconciliation. Managed identity, secret-store integration, telemetry, authentication, and retention are separate hardening/product decisions rather than hidden PoC scope.
