# Foundation provenance

- Adopted Foundation version: 0.10.0
- Copied-rule/template commit: `33346ce014456837cbb3d69dde83a3ecc022f41d` (Chat-first/明示Work指示の未リリース指針を選択適用。CI pinは別)
- Reusable workflow commit: `007352e15fcc6f9620686d3b77e11e85341eac02`
- Adopted on: 2026-09-14
- App-specific deviations:
  - Next.js App Router is used instead of the Foundation's Vite implementation baseline because the approved PoC architecture uses Next.js on Vercel; the Foundation explicitly permits Next.js when product architecture justifies it.
  - the bootstrap UI uses semantic native elements rather than importing a primitive library because no dialog/menu/form interaction currently requires one;
  - optional Fixed Staging is not adopted because the PoC has no stable non-Production origin requirement.

## 適用した開発ガイダンス

- `AGENTS.md`のChat-first・Work明示指示のみ・安全な代替実行経路、Issue/PRによる引き継ぎ、承認境界、最終自己レビュー、独立レビュー方針を選択適用する。
- 共通実装ガイドはFoundationの`docs/ai-implementation.md`、UIは`docs/ui-implementation.md`と`docs/ui-review.md`、導入元管理は`docs/adoption.md`を参照する。
- `docs/azure-oidc.md`でGitHub Actions → Azure OIDCの信頼境界を管理し、Vercelは既存のGit IntegrationとOn-demand Preview方針を維持する。
- 開発ルールの選択的更新だけを行い、**Foundationのリリース版はv0.10.0のまま**とする。新しい`main`の未リリース変更を正式リリース済みと誤認しない。
- Workflowはレビュー済みv0.10.0リリースSHA（上記Reusable workflow commit）に固定したままとする。別途明示的なアップグレードがない限り書き換えない。
- アプリ固有の製品・デザイン・Azureデータと認証境界は`PRODUCT.md`、`DESIGN.md`、`docs/ARCHITECTURE.md`を優先する。

## Hosting and deployment

- Vercel Git Integration owns web deployment.
- `vercel.json` disables ordinary branches, enables `main` for Production, and enables only trusted synthetic `preview/**` refs for non-Production hosted review.
- Optional Issue #21 would read Azure Table Storage directly from the Next.js server runtime, but remains on hold. The browser never receives Azure Table credentials.
- `AZURE_HISTORY_TABLE_SAS` is a server-only read credential and must be configured as a Sensitive Production environment variable in Vercel. It is never committed to `vercel.json` or repository files.
- `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_HISTORY_TABLE_NAME`, and `SWITCHBOT_DEVICE_ID` are server-side direct-read settings. The device ID must not be logged or browser-exposed even though it is not an authentication secret.
- Production currently uses `AZURE_BACKEND_BASE_URL` to reach the Azure Container App read API. Direct Table reading is optional, and Issue #21 is on hold rather than a prerequisite for new features.
- Fixed Staging is not adopted.
- Production credentials and privileged Azure state must not be made available to Preview PR code.

### Azure PoC deployment

- Azure infrastructure and collector deployment are owned by `.github/workflows/deploy-azure.yml` after that workflow has landed on `main`.
- The workflow is triggered only by the repository owner's exact `/deploy-azure` comment on the approved deployment Issue; PR code cannot request Azure OIDC credentials merely by running CI.
- The deployment job receives `id-token: write` and `packages: write`; ordinary web/IaC/backend CI jobs do not.
- Azure authentication uses the already-proven shared GitHub OIDC deployment identity. The client ID, tenant ID, and subscription ID remain committed target identifiers rather than authentication secrets.
- `Azure/login` remains pinned to the reviewed immutable commit.
- The trusted workflow builds the collector image, tags it with the trusted `main` SHA, publishes it to GHCR, deploys the scheduled Job through Bicep, and manually exercises one collector run.
- The Container App HTTP read API is the active production path; retiring it would require a separate approved and verified Issue #21 cutover.
- The Docker image carries `org.opencontainers.image.source` to link the package to this repository. Container Apps requires the deployed image to be anonymously pullable; the deployment explicitly verifies that property before touching Azure.
- SwitchBot Token/Secret are never GitHub deployment inputs. Redeployments preserve them from the existing Container Apps Job secret store, mask the values, and pass them only as secure Bicep parameters.

## Runtime baseline

- Node.js 24 LTS is pinned in `.node-version`.
- Next.js App Router + React + TypeScript + npm is the web runtime/tooling baseline.
- Tailwind CSS is the styling infrastructure.
- The Azure runtime runs a Node.js 24 five-minute scheduled Container Apps Job and a scale-to-zero HTTP Container App for current Home Story/trend reads. Issue #21 is optional and on hold.
- The Container Apps Environment intentionally has no Log Analytics destination, VNet integration, ACR, or always-on minimum replicas for the PoC.
- Generic shadcn/ui-style primitives are added only when an actual common interaction requires them; do not add a component library merely to satisfy the profile mechanically.

Copied rules/templates do not update automatically. Foundation upgrades must be deliberate and preserve app-specific product/design decisions unless the product owner approves a change.

## Chatから利用できる検証・操作

- `/ui-review`（OwnerのIssueコメント）: 信頼済みmainのGitHub Actions + Playwrightで本番UIを320/390/1440pxで実ブラウザ確認し、3日間のArtifactを返す。通常PRでもコード変更に応じて同テストを実行する。
- `/cleanup-branch`（Ownerのマージ済みPRコメント）: GitHub Actionsが対象PRとrefのSHAを検証し、lease付きで許可された短命ブランチだけを削除する。
- `/deploy-azure`（OwnerのIssue #15コメント）: 信頼済みmainからOIDC + Azure CLI/Bicepで既存Azure構成を更新し、Collector/Read APIのスモークを検証する。
- Chat内にツールがなくても上記の**実行経路を優先**し、実行権限・本人の承認・課金・保護規則を迂回しない。Workは明示指示された場合のみ利用する。
