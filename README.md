# switchbot-home-dashboard

A personal architecture PoC for collecting SwitchBot environmental sensor readings into Azure-owned storage and reading them through a fast, minimal web UI.

## Target PoC data path

```text
SwitchBot Open API
  -> Azure Functions collector
  -> Azure Table Storage
  -> Azure Functions read API
  -> Next.js / Vercel
```

The browser read path does not call SwitchBot directly. The first milestone is architecture validation, not a feature-rich dashboard.

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

## Azure PoC deployment

Azure resources are defined in `infra/main.bicep`. The initial PoC creates only:

- one Standard_LRS Storage Account;
- `CurrentState` and `SensorReadings` tables;
- one private deployment blob container;
- one Azure Functions Flex Consumption plan and Function App.

The privileged deployment workflow is intentionally not runnable from PR code. After the workflow exists on `main`, the repository owner can comment exactly `/deploy-azure` on Issue #3. The trusted `main` workflow signs in to Azure with GitHub OIDC, deploys the Bicep template, deploys the Functions package, and smoke-tests `/api/latest`.

The PoC's Azure client ID, tenant ID, and subscription ID are intentionally committed as public deployment identifiers in the trusted workflow. They identify the fixed personal Azure target and are not authentication secrets. No Azure client secret is used or committed.

SwitchBot credentials are deliberately not managed by Bicep or GitHub Actions. After Azure deployment, configure these Function App settings directly in Azure:

- `SWITCHBOT_TOKEN`
- `SWITCHBOT_SECRET`
- `SWITCHBOT_DEVICE_ID`

Do not commit or paste those values into repository files. The deployment workflow preserves these existing server-side settings across later Bicep redeployments.

For the fixed single-environment PoC, `vercel.json` pins the server-side `AZURE_FUNCTIONS_BASE_URL` to the deployed Function App. The Function App base URL is a public read-endpoint identifier, not a credential; SwitchBot credentials and Azure Storage credentials remain Azure-side only. Local development can continue to set `AZURE_FUNCTIONS_BASE_URL` through `.env.local`.

## PoC API

- `GET /api/latest` returns the latest stored reading and freshness metadata.
- `GET /api/history?window=1h|6h|24h` returns a bounded recent history window. The default is `24h` and storage reads are capped at 288 rows.

Before SwitchBot settings are configured, `/api/latest` intentionally returns `503 not_configured`. After configuration but before the first successful collection it returns `404 no_data`. Storage/read failures are returned separately and are never represented as zero/default sensor values.

## Foundation

This repository adopts Web App Foundation v0.10.0. See `docs/FOUNDATION.md`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, and `docs/ARCHITECTURE.md` before material changes.
