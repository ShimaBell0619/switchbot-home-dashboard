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
- graph-heavy analytics dashboards (compact factual daily summaries are permitted);
- multi-room or multi-device information architecture;
- speculative trend insights, unobserved metric values, or multi-device comparisons;
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

## 7. 直近7日間の傾向（Issue #25）

- 「今日」のHome Storyを主画面のまま維持し、専用の「7日間」画面を加える。
- 日本時間の今日を含む直近7暦日について、日ごとの観測数・CO₂最高値・温度/湿度の観測範囲を表示する。
- 日付をまたぐ値の混在を避け、今日を未完了日として明示する。
- 欠測日・CO₂未対応の古いレコードはゼロとして補わず、「データなし」「記録なし」と区別する。
- 値は保存済みの有効な観測から決定論的に集計し、原因や換気・在宅などを推測しない。
- 1日最大288件の現在用クエリを7日分として流用しない。継続トークンに対応した上限付き取得を用い、不完全な取得を成功扱いしない。
- 既存の公開HTTP APIに7日分の日別集計のみを返す新しい読み取り経路を追加する。Table SASと生の時系列レコードはブラウザへ渡さない。
- 新しいAPIを利用できる状態を本番で確認するまでは、7日間の画面を「準備中」と表示できるようにする。既存の「今日」は変更しない。
- APIの本番展開は権限を持つオーナーの承認済みデプロイ操作と検証を要する。

## 8. Evolution rules

- New story claims require a data source that can support the claim.
- Trend views should be added only after enough persisted data exists to make comparisons useful.
- Device control, security/occupancy monitoring, authentication, new sensitive data classes, or a multi-vendor platform remain explicit product decisions rather than implicit scope expansion.
- Keep historical decisions in Issues/PRs and keep current approved behavior here.
