# Product Contract

## 1. Purpose

`switchbot-home-dashboard` is a personal web dashboard for reading SwitchBot home-sensor data from application-owned storage instead of waiting for the SwitchBot UI to load historical data.

The initial objective is an architecture proof of concept: prove that sensor readings can be collected in the background, persisted, queried, and rendered through a minimal web UI with the read path independent of SwitchBot API latency.

## 2. Users and primary jobs

The initial user is the repository owner.

Primary jobs:

- confirm the latest collected sensor state quickly;
- inspect recently collected historical readings;
- verify that the end-to-end collection and read architecture works in deployed environments.

## 3. Core behaviors

For the PoC:

- SwitchBot sensor readings are collected by backend infrastructure rather than by browser page load.
- Collected readings are persisted with an observation timestamp.
- The web read path obtains latest/history data from application-owned persistence, not directly from SwitchBot.
- SwitchBot credentials remain server-side and are never included in browser-delivered code or responses.
- Collection and read failures are distinguishable from valid sensor data; stale data must not be presented as newly observed data.

## 4. Product constraints

- This is a single-owner, cloud-connected PoC.
- The approved PoC architecture is documented in `docs/ARCHITECTURE.md`.
- The initial UI is intentionally minimal; architecture validation takes priority over visual richness.
- The unauthenticated PoC may expose only low-sensitivity environmental sensor data selected for the test. Lock state, occupancy/security events, device-control capability, or similarly sensitive home data must not be exposed without an explicit authentication/authorization decision.
- The product cannot reconstruct historical readings from before collection begins unless a supported upstream history source is introduced later.
- SwitchBot API usage must respect the upstream service limits and failure behavior.
- No retention/deletion policy is approved yet; do not introduce automated deletion or archival without a product decision.

## 5. Non-goals

The initial PoC does not include:

- device control;
- Webhook ingestion;
- authentication or multi-user accounts;
- rich visualization, analytics, recommendations, or notifications;
- importing existing SwitchBot app history;
- broad smart-home vendor support.

## 6. Acceptance boundaries

The architecture may be called proven only after:

- at least one real SwitchBot sensor can be collected on a schedule;
- timestamped readings persist in the approved Azure storage;
- latest and bounded-history reads succeed through the backend API;
- the deployed web UI renders those stored values without making a browser-side SwitchBot API call;
- SwitchBot credentials are absent from browser bundles and responses;
- failure/staleness behavior is observable enough to distinguish an upstream collection problem from a valid unchanged reading.

## 7. Evolution rules

- Do not silently expand the PoC into device control, security/occupancy monitoring, authentication, or a multi-vendor platform.
- If implementation pressure conflicts with this contract, raise the conflict before changing the product behavior.
- Keep historical decisions in Issues/PRs and keep current approved behavior here.
