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
npm run dev
```

Quality gate:

```bash
npm run check
npm run typecheck
npm run test
npm run build
```

## Foundation

This repository adopts Web App Foundation v0.10.0. See `docs/FOUNDATION.md`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, and `docs/ARCHITECTURE.md` before material changes.
