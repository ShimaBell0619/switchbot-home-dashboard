# Product Contract

## 1. Purpose

`switchbot-home-dashboard` is a personal web experience for understanding what changed in the home today from SwitchBot environmental sensor data stored by the application.

The architecture PoC is proven. The current product focus is **Home Story**: turn background observations into a small, deterministic daily narrative rather than reproducing a device dashboard or exposing a raw history table.

## 2. User and primary jobs

The initial user is the repository owner.

Primary jobs:

- understand at a glance whether the home environment has been calm or changed meaningfully today;
- see a small number of important sensor changes in chronological order;
- distinguish a genuinely stable day from missing, stale, or failed collection;
- review facts derived from stored observations without waiting on the SwitchBot API during page load.

## 3. Core behaviors

- SwitchBot sensor readings are collected by backend infrastructure rather than by browser page load.
- Collected readings are persisted with an observation timestamp in application-owned storage.
- The selected Meter Pro (CO2) reading includes temperature, humidity, battery, and CO₂ when provided by the validated upstream status response.
- A deterministic story engine derives at most a few meaningful events from the current JST calendar day.
- Nearby duplicate changes are consolidated instead of producing noisy log entries.
- The UI does not force a fixed event count.
- A stable day produces an intentional calm-day summary and observed ranges rather than fabricated events.
- Story copy describes only facts supported by observations. It must not claim causes such as ventilation, presence, sleep, or return-home activity without a source that proves them.
- Collection/read failures and stale data remain distinguishable from valid unchanged readings.
- SwitchBot credentials remain server-side and are never included in browser-delivered code or responses.

## 4. Product constraints

- This is a single-owner, cloud-connected personal application.
- The approved backend architecture is documented in `docs/ARCHITECTURE.md`.
- The primary UI is mobile-first and vertically read; desktop keeps the same focused reading column rather than becoming a dense control dashboard.
- The current unauthenticated surface may expose only the approved low-sensitivity environmental data. Security/public-surface hardening is intentionally deferred from Home Story Issue #11 and must be handled separately.
- The product cannot reconstruct historical readings from before application collection began unless a supported upstream history source is introduced later.
- SwitchBot API usage must respect upstream limits and failure behavior.
- No retention/deletion policy is approved yet; do not introduce automated deletion or archival without a product decision.

## 5. Non-goals for Home Story v0.1

- device control or manual scenes;
- Webhook ingestion;
- authentication or multi-user accounts;
- LLM-generated summaries;
- graph-heavy analytics dashboards;
- multi-room or multi-device information architecture;
- `今日 / 傾向` tabs before the trend experience has real content and an approved design;
- importing existing SwitchBot app history;
- broad smart-home vendor support.

## 6. Home Story acceptance boundaries

Home Story is successful when:

- current-day observations can be reduced to deterministic, explainable events;
- meaningful changes are shown without duplicate noise;
- stable observations result in a calm-day experience rather than an empty or invented story;
- no-data, stale, and backend-error states are semantically distinct;
- the production mobile UI is centered on the daily narrative, not raw metric cards or history tables;
- the browser still reads application-owned backend data and never calls SwitchBot directly.

## 7. Evolution rules

- New story claims require a data source that can support the claim.
- Trend views should be added only after enough persisted data exists to make comparisons useful.
- Device control, security/occupancy monitoring, authentication, new sensitive data classes, or a multi-vendor platform remain explicit product decisions rather than implicit scope expansion.
- Keep historical decisions in Issues/PRs and keep current approved behavior here.
