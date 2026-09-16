# switchbot-home-dashboard

A personal, mobile-first **Home Story** for understanding what changed in the home today from SwitchBot environmental readings stored in Azure.

The architecture PoC is complete. The current product turns persisted observations into a short factual daily narrative instead of presenting a dense sensor dashboard or raw history table.

## Data path

Approved target:

```text
SwitchBot Open API
  -> Azure Container Apps scheduled collector (every 5 minutes)
  -> Azure Table Storage
  -> Next.js / Vercel server-side read
  -> Home Story UI
```

Issue #21 is a rollback-safe cutover from the previous Container App read API. When the direct Table settings are configured, Next.js reads `SensorReadings` directly; until Production verification is complete, `AZURE_BACKEND_BASE_URL` remains as a temporary fallback.

The browser never calls SwitchBot or Azure Table Storage directly. A slow or unavailable upstream SwitchBot API therefore does not block reading already-stored observations.

## Home Story

Home Story asks one question:

> 今日、家で何が起こったか？

The story engine is deterministic and server-side. It detects a small number of meaningful sensor changes, consolidates nearby duplicate events, and shows at most four selected events chronologically.

It does **not** use an LLM and does not invent causes such as ventilation, presence, sleep, or returning home. A stable day is intentionally rendered as a calm-day summary with observed ranges. No-data, stale, and backend-error states remain separate.

For the selected `MeterPro(CO2)`, observations persist:

- CO₂;
- temperature;
- humidity;
- battery when available;
- observation/collection timestamps.

Older rows without CO₂ remain valid while new CO₂-enabled observations accumulate.

## Development

Requirements:

- Node.js version from `.node-version`
- npm

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The direct read path uses these server-side settings:

- `AZURE_STORAGE_ACCOUNT_NAME`
- `AZURE_HISTORY_TABLE_NAME`
- `AZURE_HISTORY_TABLE_SAS` — read-only, table-scoped credential
- `SWITCHBOT_DEVICE_ID`

Never use a `NEXT_PUBLIC_` prefix for these values. During Issue #21 cutover, `AZURE_BACKEND_BASE_URL` remains available only as the legacy rollback fallback.

Quality gate:

```bash
npm run check
npm run typecheck
npm run test
npm run build
```

Azure collector tests and IaC are validated separately by `.github/workflows/backend-ci.yml` and `.github/workflows/infra-ci.yml`.

## Azure deployment

The final Issue #21 Azure target contains:

- one Standard_LRS Storage Account;
- `CurrentState` and `SensorReadings` tables;
- one Azure Container Apps Environment without Log Analytics;
- one scheduled Container Apps Job that collects every five minutes.

The scale-to-zero Container App read API is retained only during the cutover and is removed after Vercel direct-read verification.

The trusted `main` deployment workflow signs in to Azure with GitHub OIDC, publishes the immutable Node.js 24 collector image to GHCR, deploys Bicep, and manually exercises the collector. PR code cannot request the privileged Azure deployment path.

The fixed Azure client ID, tenant ID, and subscription ID are committed target identifiers, not authentication secrets. No Azure client secret is used or committed.

SwitchBot credentials remain Azure-side in Container Apps Job secrets:

- `SWITCHBOT_TOKEN`
- `SWITCHBOT_SECRET`
- `SWITCHBOT_DEVICE_ID`

The deployment workflow preserves those values from the existing Job and never prints them or stores them in repository files. Vercel never receives SwitchBot Token/Secret.

Vercel receives only the server-side settings required to read persisted history. `AZURE_HISTORY_TABLE_SAS` must be a **Sensitive Production environment variable** and must have read permission only for `SensorReadings`.

## Read behavior

The Next.js server reads at most 288 stored history rows for the selected device and generates Home Story in-process.

A valid but uneventful day renders `kind: calm`. No observations for the current JST day produce the no-data state. Storage/read/generation failures remain separate and are never represented as a fabricated calm day or zero/default sensor values.

## Current scope

Home Story v0.1 deliberately stays small:

- one mobile-first daily story surface;
- no graph-heavy analytics;
- no `今日 / 傾向` tabs yet;
- no device control or Scenes UI;
- no Webhook ingestion;
- no LLM-generated summaries;
- security/public-surface hardening is deferred to separate work.

## Foundation

This repository adopts Web App Foundation v0.10.0. See `docs/FOUNDATION.md`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, and `docs/ARCHITECTURE.md` before material changes.
