# switchbot-home-dashboard

A personal, mobile-first **Home Story** for understanding what changed in the home today from SwitchBot environmental readings stored in Azure.

The architecture PoC is complete. The current product turns persisted observations into a short factual daily narrative instead of presenting a dense sensor dashboard or raw history table.

## Data path

```text
SwitchBot Open API
  -> Azure Functions collector (every 5 minutes)
  -> Azure Table Storage
  -> Azure Functions story API
  -> Next.js / Vercel Home Story
```

The browser read path never calls SwitchBot directly. A slow or unavailable upstream API therefore does not block reading already-stored observations.

## Home Story

Home Story asks one question:

> 今日、家で何が起こったか？

The story engine is deterministic and server-side. It detects a small number of meaningful sensor changes, consolidates nearby duplicate events, and shows at most four selected events chronologically.

It does **not** use an LLM and does not invent causes such as ventilation, presence, sleep, or returning home. A stable day is intentionally rendered as a calm-day summary with observed ranges. No-data, stale, and backend-error states remain separate.

For the selected `MeterPro(CO2)`, new observations persist:

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

`AZURE_FUNCTIONS_BASE_URL` is a server-side Next.js setting. Do not use a `NEXT_PUBLIC_` variable for backend or SwitchBot credentials.

Quality gate:

```bash
npm run check
npm run typecheck
npm run test
npm run build
```

Azure IaC is validated separately by `.github/workflows/infra-ci.yml`.

## Azure deployment

Azure resources are defined in `infra/main.bicep` and currently include:

- one Standard_LRS Storage Account;
- `CurrentState` and `SensorReadings` tables;
- one private deployment blob container;
- one Azure Functions Flex Consumption plan and Function App.

The privileged deployment workflow is intentionally not runnable from PR code. The trusted `main` workflow signs in to Azure with GitHub OIDC, deploys the Bicep template, deploys the Functions package, and smoke-tests the workload.

The fixed Azure client ID, tenant ID, and subscription ID are intentionally committed as public deployment identifiers in the trusted workflow. They identify the personal Azure target and are not authentication secrets. No Azure client secret is used or committed.

SwitchBot credentials are deliberately not managed by Bicep or GitHub Actions. Configure these Function App settings directly in Azure:

- `SWITCHBOT_TOKEN`
- `SWITCHBOT_SECRET`
- `SWITCHBOT_DEVICE_ID`

Do not commit or paste those values into repository files. The deployment workflow preserves the existing server-side settings across later Bicep redeployments.

For the fixed single-environment application, `vercel.json` pins the server-side `AZURE_FUNCTIONS_BASE_URL` to the deployed Function App. The Function App base URL is a public read-endpoint identifier, not a credential; SwitchBot credentials and Azure Storage credentials remain Azure-side only. Local development can continue to set `AZURE_FUNCTIONS_BASE_URL` through `.env.local`.

## Read APIs

- `GET /api/story` returns the current JST day's generated Home Story plus freshness metadata.
- `GET /api/latest` returns the latest stored reading and freshness metadata.
- `GET /api/history?window=1h|6h|24h` returns a bounded recent history window. Storage reads are capped at 288 rows.

`/api/story` returns `404 no_data` when there are no valid observations for the current JST day. A valid but uneventful day still returns `200` with `kind: calm`; it is never confused with missing data. Storage/read/generation failures are returned separately and are never represented as a fabricated calm day or zero/default sensor values.

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
