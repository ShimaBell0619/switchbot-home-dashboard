# switchbot-home-dashboard

A personal, mobile-first **Home Story** for understanding what changed in the home today from SwitchBot environmental readings stored in Azure.

The architecture PoC is complete. The current product turns persisted observations into a short factual daily narrative instead of presenting a dense sensor dashboard or raw history table.

## Data path

```text
SwitchBot Open API
  -> Azure Container Apps scheduled collector (every 5 minutes)
  -> Azure Table Storage
  -> Azure Container App read API (scale to zero)
  -> Next.js / Vercel Home Story
```

The browser read path never calls SwitchBot directly. A slow or unavailable upstream API therefore does not block reading already-stored observations.

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

`AZURE_BACKEND_BASE_URL` is a server-side Next.js setting. Do not use a `NEXT_PUBLIC_` variable for backend or SwitchBot credentials.

Quality gate:

```bash
npm run check
npm run typecheck
npm run test
npm run build
```

Azure backend tests and IaC are validated separately by `.github/workflows/backend-ci.yml` and `.github/workflows/infra-ci.yml`.

## Azure deployment

Azure resources are defined in `infra/main.bicep` and currently include:

- one Standard_LRS Storage Account;
- `CurrentState` and `SensorReadings` tables;
- one Azure Container Apps Environment without Log Analytics;
- one scale-to-zero Container App for the read API;
- one scheduled Container Apps Job that collects every five minutes.

The API and collector use the same immutable Node.js 24 image from GHCR. The trusted `main` deployment workflow signs in to Azure with GitHub OIDC, publishes the image, deploys Bicep, manually exercises the collector, and smoke-tests `/api/latest` and `/api/story`. PR code cannot request the privileged Azure deployment path.

The fixed Azure client ID, tenant ID, and subscription ID are committed target identifiers, not authentication secrets. No Azure client secret is used or committed.

SwitchBot credentials remain Azure-side in Container Apps Job secrets:

- `SWITCHBOT_TOKEN`
- `SWITCHBOT_SECRET`
- `SWITCHBOT_DEVICE_ID`

The deployment workflow preserves those values from the existing Job and never prints them or stores them in repository files. The HTTP API and Vercel never receive SwitchBot Token/Secret or Azure Table credentials.

For the fixed single-environment application, `vercel.json` pins the server-side `AZURE_BACKEND_BASE_URL` to the deployed Container App. The public backend URL is an identifier, not a credential. Local development can set the same variable through `.env.local`.

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
