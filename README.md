# 投資ニュース・ダイジェスト（LINE配信）

日本株・米国株・グローバル経済ニュースをRSSで収集し、AIが重要度の高いものを要約・選定して、
毎日 **6:00（日本時間）** にLINEへ自動配信するパーソナルサービスです。

紹介ページ（仕組み・配信サンプル）: https://news-weld-six.vercel.app/

（Vercel Hobbyプランはcron jobが1日1回までのため、1日1回の配信にしています。1日複数回配信したい場合は、外部cronサービスから `/api/cron/news` を直接叩くか、Vercel Proへのアップグレードが必要です）

## 仕組み

1. Vercel Cron が毎朝6:00(JST)に `/api/cron/news` を呼び出す
2. `src/lib/sources.ts` に登録されたRSSフィードから過去24時間分の記事を収集（`src/lib/fetchNews.ts`）。異なるソースが同じ出来事を報じている場合はタイトルの類似度から「ほぼ重複」と判定し、1件にまとめる
3. AI（Vercel AI Gateway経由、無料枠モデル `zai/glm-4.6v-flash` を使用。障害時は同じく無料枠の `poolside/laguna-s-2.1-free` / `inclusionai/ling-3.0-flash-free` に自動フォールバック）が記事群から重要な上位5件を選び、詳しい要約・経済/株式市場への影響予測・重要度スコア付けを行う（`src/lib/summarize.ts`）。`src/lib/watchlist.ts` に銘柄・テーマを登録しておくと、関連ニュースの優先度が上がる
4. LINE Messaging API でテキストメッセージとして配信（`src/lib/line.ts`）。日本株/米国株/グローバルの地域別に見出しを分けて表示し、1件のメッセージがLINEの文字数上限（5000文字）を超える場合は自動で複数メッセージに分割して送信する
5. 配信処理自体が失敗した場合は、エラー内容を要約したLINEメッセージで通知する（`notifyDigestFailure`, ベストエフォート）

RSSソースは `src/lib/sources.ts` を編集するだけで追加・削除できます。

## 銘柄ウォッチリスト

`src/lib/watchlist.ts` の `WATCHLIST` 配列に銘柄名・ティッカー・テーマ（例: `"トヨタ自動車"`, `"7203"`, `"NVIDIA"`, `"半導体"`）を追加すると、
AIによるニュース選定時にそれらに関連する記事の優先度が上がります。空のままなら、これまで通り全体的な重要度のみで選定されます。

## 必要な環境変数

| 変数名 | 用途 | 必須 |
|---|---|---|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway経由でLLMを呼ぶための鍵 | ○ |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging APIのチャネルアクセストークン | ○ |
| `LINE_USER_IDS` | 配信先となるLINEユーザーIDのリスト（カンマまたは改行区切り、複数人可） | ○ |
| `LINE_CHANNEL_SECRET` | Webhook署名検証用（ユーザーID取得時のみ使用） | ユーザーID取得時のみ |
| `CRON_SECRET` | cronエンドポイントを保護するための秘密文字列（自分で決める） | 推奨 |

## セットアップ手順

### 1. LINE Messaging API のチャネルを作る（無料）

1. https://developers.line.biz/console/ にアクセスし、LINEアカウントでログイン
2. 「新規プロバイダー作成」→ 適当な名前（例: `個人ニュースBot`）を入力して作成
3. 作成したプロバイダー内で「新規チャネル作成」→ **Messaging API** を選択
4. チャネル名（例: `投資ニュースBot`）、業種、説明などを入力してチャネルを作成
5. 作成後、チャネルの「Messaging API設定」タブを開く
   - **チャネルアクセストークン（長期）** の「発行」を押し、表示された値を控える → `LINE_CHANNEL_ACCESS_TOKEN`
   - 「チャネル基本設定」タブにある **チャネルシークレット** を控える → `LINE_CHANNEL_SECRET`
   - 同じ画面にある **QRコード** を自分のLINEアプリで読み取り、Botを友だち追加する
   - 「応答メッセージ」機能はオフにしておく（Botの自動応答と混線しないように）

### 2. LINEユーザーIDを取得する（配信したい人数分）

このプロジェクトには `/api/line/webhook` という確認用のWebhookを用意してあります。誰がメッセージを送っても、その人自身のユーザーIDを返信するだけなので、配信したい人全員がこの手順を行えます。

1. 先に手順3〜4を行い、一度デプロイして本番URL（例: `https://your-app.vercel.app`）を確定させる
2. LINE Developersの「Messaging API設定」→ Webhook URLに `https://your-app.vercel.app/api/line/webhook` を設定し、Webhookの利用を「オン」にする
3. 配信したい人各自が、QRコードからBotを友だち追加し、何かメッセージ（例: `id`）を送る
4. Botから「あなたのLINEユーザーIDはこちらです」という返信が届くので、その値を控える
5. 全員分のIDをカンマ区切りでまとめ、`vercel env add LINE_USER_IDS`（例: `U0fdb...,U1a2b...`）で登録する。人を追加したくなったら、同じ手順でIDを取得し、`LINE_USER_IDS` の値にカンマ区切りで追加してから再デプロイすればよい
6. 全員分のID取得が終わったら、Webhookはオフに戻してよい（以降は使わない）

### 3. Vercel CLI のインストールとプロジェクトのリンク

```bash
npm i -g vercel
vercel link
```

### 4. 環境変数の設定

```bash
vercel env add AI_GATEWAY_API_KEY
vercel env add LINE_CHANNEL_ACCESS_TOKEN
vercel env add LINE_CHANNEL_SECRET
vercel env add LINE_USER_IDS
vercel env add CRON_SECRET
```

ローカル開発用に `.env.local` にも同じ値を設定してください（`vercel env pull` でも取得可能）。

### 5. デプロイ

```bash
vercel --prod
```

デプロイすると `vercel.ts` に定義されたCronスケジュール（毎日6:00 JST）が自動的に登録されます。

## 動作確認

デプロイ後、または `npm run dev` でローカル起動後に `/test` ページ（例: `http://localhost:3000/test`）にアクセスすると、
`CRON_SECRET` を入力して手動で実行できます。「プレビューのみ」にチェックを入れると、LINEに送信せずメッセージ内容だけ確認できます。

