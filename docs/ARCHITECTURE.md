# Architecture

## PoC objective

Prove that SwitchBot environmental sensor data can be collected independently of page loads, stored in Azure, and read quickly by a minimal web UI without waiting on the SwitchBot Open API during the user read path.

## Approved target topology

```text
SwitchBot Open API
        ^
        | scheduled status read
        |
Azure Functions
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
minimal web UI
```

Collection and read responsibilities are intentionally separated. A slow or temporarily unavailable SwitchBot API must not block reads of already-collected data.

## Responsibilities

### Next.js / Vercel

- Render the minimal PoC UI.
- Read latest/history data only from the application backend.
- Hold no SwitchBot credentials.
- Do not perform background collection.

### Azure Functions

The PoC uses one Function App with separate functions:

- timer-triggered collector: authenticate to SwitchBot, read the selected device status, validate the response, and persist the reading;
- HTTP latest endpoint: return the current stored reading;
- HTTP history endpoint: return bounded readings for an explicitly requested time range.

Collection cadence is configuration, with five minutes as the initial PoC default unless real-device behavior or API limits justify adjustment.

### Azure Table Storage

Use two tables because the read patterns are different.

`CurrentState` provides an O(1)-style point read for the latest known device state.

- `PartitionKey`: device ID
- `RowKey`: `current`
- fields: only the selected environmental reading fields plus source/observation timestamps needed to represent freshness

`SensorReadings` stores timestamped history.

- `PartitionKey`: device ID
- `RowKey`: sortable UTC reading identity derived from observation time
- fields: selected environmental reading fields plus explicit observation/source timestamps

The exact RowKey encoding must preserve uniqueness and range-query behavior; do not add a generic schema abstraction in the PoC.

No automatic retention, archival, or deletion policy is approved yet.

## Trust boundaries and secrets

SwitchBot is an external API trust boundary. The collector owns authentication/signing and validation.

- Store SwitchBot Token/Secret only in server-side Azure configuration or an approved secret store.
- Never place SwitchBot credentials in Vercel public environment variables, browser bundles, logs, fixtures, screenshots, or committed files.
- Treat HTTP success and SwitchBot response status as separate validation signals.
- Persist only validated readings; upstream errors must not become fabricated sensor records.

The initial PoC is intentionally unauthenticated. Therefore only explicitly selected low-sensitivity environmental data may be exposed through the PoC read surface. Lock state, occupancy/security events, device control, or other sensitive home data require a separate security decision first.

## Failure and freshness behavior

- A failed collection attempt leaves the previous valid `CurrentState` intact.
- The UI/API must expose enough timestamp information to distinguish a stale reading from a newly observed reading.
- History writes must be idempotent for the chosen reading identity so retries do not create misleading duplicates.
- A backend read failure is an error state; it must not be represented as a valid zero/default sensor value.

## Deliberate PoC exclusions

- Webhook ingestion;
- device commands;
- authentication/authorization;
- multi-user tenancy;
- event streaming or messaging middleware;
- cross-vendor IoT abstraction;
- analytics/aggregation stores;
- automatic retention/archival.

## Evolution

If the PoC succeeds, Webhook ingestion may be evaluated as a complementary near-real-time collection path while retaining scheduled reconciliation. That is a future architecture decision, not part of the initial implementation contract.
