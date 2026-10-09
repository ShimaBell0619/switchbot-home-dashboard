# SwitchBot Home Story — AI開発ルール

Foundation-Version: 0.10.0

## 役割と基本方針

- **Chat + GitHub**を設計・Issue・小〜中規模の実装・PRの標準とし、**Work**は実行・画面検証・大きな変更が必要な場合に使う。
- 作業範囲はIssueまたは合意済み依頼の受け入れ条件で決める。`PRODUCT.md`を製品仕様、`DESIGN.md`をUI・UX、`docs/ARCHITECTURE.md`を構成・データ境界の正本とする。
- 適用元は`docs/FOUNDATION.md`に記録する。実装上の共通方針は採用済みFoundationの`AGENTS.md`と`docs/ai-implementation.md`に従う。最新の`main`が自動的に適用されるわけではない。
- 必要な仕様だけを読み、履歴や会話全文を毎回取り込まない。意味のないContext Packet、Implementation Map、専用Skillなどを生成しない。
- 作業開始前にベースSHAを確認し、短命ブランチで変更する。競合する書き込みやforce pushを避ける。Issue・PR・コミットSHA・CIをChatとWorkの引き継ぎに用いる。

## 仕様と承認境界

- 既定の経路は **SwitchBot Open API → Azure Container Appsの5分間隔Job → Azure Table Storage → Next.js/Vercelサーバー → ブラウザ**。
- 現在、Issue #21の安全な切替が完了するまでは旧Azure HTTP APIをフォールバックとして維持する。**本番直接読み取りの検証前に旧APIを削除しない。**
- Storage以外への永続化先変更、デバイス制御、認証認可方式、新しい機密データ、破壊的移行、データ保持・削除、追加課金のある構成変更は事前承認を要する。
- 権限境界・公開API・本番配備方式の実質的変更も事前承認を要する。既存の動作を保つ局所的な修正やテスト追加は承認済み範囲で進めてよい。
- SwitchBot Token/Secret、Table SAS、Azureの特権資格情報をリポジトリ・ログ・ブラウザ・応答・Preview環境へ露出しない。`NEXT_PUBLIC_*`に秘密を入れない。

## データの取り扱い

- ブラウザからSwitchBot APIやTable Storageを直接呼び出さない。ページ表示中の外部SwitchBot APIの状態に依存させない。
- SwitchBot APIのHTTP成功とレスポンスの`statusCode`成功を別々に検証する。不正な値を既定値で補ったり、観測されたかのように保存したりしない。
- upstreamの観測時刻がある場合はそれを使用し、ない場合はCollectorが観測した時刻であることを明記する。リトライ時も観測IDの冪等性を守る。
- Home Storyは保存済み観測だけから決定論的に生成する。`換気`、`在宅`、`睡眠`など、根拠のない原因や行動を断定しない。
- 正常な穏やかな日（calm）、今日のデータなし（no_data）、古いデータ（stale）、読み取り失敗（error）を混同しない。
- 現状は選択したMeter Pro (CO2)の温度・湿度・CO₂・任意の電池残量を扱い、データの自動削除・保持期限は新たに導入しない。

## UI・UX

- `DESIGN.md`を正本とする。モバイル優先の「今日のストーリー」を中心にし、汎用管理ダッシュボードやSwitchBotアプリを模倣しない。
- Tailwind CSSと意味のあるネイティブHTMLを優先。実際の共通操作が必要になるまでUIライブラリは追加しない。
- UI変更時は1440px・390px・320px程度で実際にレンダリングし、日本語折り返し・はみ出し・キーボード操作・状態表現を確認する。ソースを読んだだけで表示確認済みとは報告しない。
- タブ、グラフ、デバイス制御、追加のコンポーネント層は現在の受け入れ条件で必要な場合のみ実装する。

## 変更と検証

- 受け入れ条件を満たす最小変更を選ぶ。IoT共通化、イベントバス、無用なRepository層や状態管理ライブラリなどを将来用に増やさない。
- 変更内容に応じて`npm run check`、`npm run typecheck`、`npm run test`、`npm run build`を実施し、最終差分を自己レビューする。Azure側の変更にはbackend/infraの検証を加える。
- 最終修正後のCI結果と対象SHAを確認する。CI・配備・本番の動作検証は別の証拠として扱い、実施していない検証を「成功」としない。
- 自己レビュー後、認証・永続化・特権付きワークフロー・破壊的変更などの高リスク作業は可能なら独立レビューを行う。`@codex review`は実行ごとに具体的な理由を説明し、明示的な承認を得る。自動呼び出しは禁止。
- PRには主要変更、受け入れ条件と証拠、未実施の検証、残存リスクを簡潔に記載する。
