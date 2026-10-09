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

現行の本番環境ではContainer AppsのHTTP APIを利用しています。Next.jsからTable Storageを直接読むコードも用意されていますが、Issue #21の移行は必須ではなく保留中です。必要性と本番検証が明確になるまで `AZURE_BACKEND_BASE_URL` の経路を維持します。

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

## 直近7日間の傾向（Issue #25）

`/trends` から日本時間の直近7日について、観測数・CO₂最高値・温度と湿度の観測範囲を確認できます。「今日」のHome Storyは変えません。欠測日やCO₂未記録日をゼロで補いません。

新しい集計は既存Azure Container Appの `GET /api/trends` が担当し、Vercelサーバーは日別の集計結果だけを取得します。**Azure側のバックエンドイメージを信頼されたデプロイフローで更新し、動作を確認するまでは「準備中」と表示されます。** アプリのデプロイ成功だけではバックエンド更新済みとはなりません。

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

## Chatからの実画面検証

このアプリは `.github/workflows/ui-review.yml` でPlaywright + Chromiumによる実レンダリングを検査します。通常のPRでUIやE2Eが変更された場合は自動実行します。**Chatから本番画面を再確認する場合は、リポジトリ所有者のIssueコメント `/ui-review`** で起動できます（Work不要）。このコメント方式は**PRでなくIssueを対象**とし、信頼済みmainのテストコードから公開画面を読み取ります。

- PR側：`npm ci`→`npm run build`→ローカルのNext.jsを起動→本物のChromiumで現在のPR実装を検証
- Issueコメント側：公開本番 `https://switchbot-home-dashboard.vercel.app` を実際のChromiumから確認
- 320px、390px、1440pxで表示、横スクロール、主要な要素、観測7日分のDOM、Tab/Enter移動を検証
- スクリーンショット、HTMLレポート、失敗時traceは3日保存のGitHub Actions Artifactへ。Chatから実行結果とArtifactを確認
- 既存の公開Azure APIへ**読み取り専用**アクセスのみ。資格情報、Azure更新、スクリーンショット以外のセンサーデータ保持はしない
- CI successはE2Eテストが検査する要件を証明する。実際のスマートフォン端末/ブラウザ環境を全て保証しない

## Chatからの安全なブランチ削除

マージ済みの同一リポジトリPRにリポジトリ所有者が正確なコメント`/cleanup-branch`を投稿すると、信頼済み`main`のGitHub Actionsが対象を検証し、PRに関連する短命ブランチだけを削除します。

- `main`・`preview/**`・fork・未マージPR・別PRで使用中・SHAがマージ後に変更されたブランチは拒否
- PRに付属する`head.sha`と現在のGit refを比較し、Git`--force-with-lease`で条件付き削除。保護規則を回避しない
- コメント本文をShellとして解釈せず、PRコードを特権付きJobで実行しない
- JobのTokenは`contents:write`と`pull-requests:read`に限定し、PR作業ブランチは削除依頼があるまで維持
- 操作は取り消せないため、対象PRとブランチを指定した明示的なユーザー承認を前提とする

## ChatによるAzureの参照とWhat-if（2026-10-10）

- `/azure-inventory`：**Issue #32**に所有者が正確なコメントを投稿すると、信頼済み`main`からGitHub OIDC経由で既存の`rg-switchbot-poc-jpe-01`だけを参照します。GitHub ActionsのSummaryにはリソースの**種類と件数**のみ出力します。
- `/azure-what-if`：同じIssue・所有者チェックで、既存のJobのデプロイパラメータをAzure側から取得し、`infra/main.bicep`の`az deployment group what-if`を実行します。**実リソースの作成・変更・削除は行いません**。生の差分、秘密情報、デバイスIDは公開せず、変更種類別件数のみを記録します。
- What-ifは読み取り中心ですが`Microsoft.Resources/deployments/whatIf/action`等のAzure RBAC要件があり、`Reader`だけで成功するとは限りません。実操作権限を狭めるのは別途Azure管理側で実施します。
- `/deploy-azure`は別の承認対象（Issue #15）であり、操作を相互に置き換えません。任意の`az`コマンドやユーザー指定のSubscription/RGをコメントで受け取る仕組みは採用しません。
