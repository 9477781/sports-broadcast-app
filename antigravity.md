# Sports Broadcast Information

## アプリの目的と実装状況

参加店舗ごとに各スポーツ試合の放映予定を確認する日英対応viewerです。React 19、Vite 6、TypeScript 5.8で動作し、地域/都道府県ボタン、店舗/日付/競技/カード選択、試合情報も対象とするキーワード検索を備えています。画面にはAsia/Tokyoの今日から9日後までの「放映あり」の試合だけを表示します。Gemini API keyは不要です。

予約混雑viewerから放映有無viewerへのフロントエンド移行は完了しています。Appは `/data/broadcast.json` を初回表示・retry時、表示中の1分ごと、タブ復帰時にキャッシュなしで読み込みます。更新時に一時的な取得失敗があっても最後の正常な表示と言語・検索条件を保持します。今回のローカルsnapshotから実feed JSONを生成済みです（115店舗、91イベント列、10,465 match records、2026-10-23〜31、showing 742、not_showing 9,723、unconfirmed 0）。今回のsnapshotでは115店舗すべての店舗メタデータが揃っています。これはローカル変換の結果であり、GASからの同期が稼働中であることを意味しません。

画面はAsia/Tokyoの今日〜+9日までの10暦日を対象にします。範囲内の `showing` だけを、他の選択肢計算・検索より先に絞り込みます。元feedには `not_showing` / `unconfirmed` と期間外試合も保持しますが、画面には表示しません。時計のタイムゾーンは使わず、1分ごと・タブ復帰時にJST期間を更新します。Resetはキーワード・地域・都道府県・店舗・日付・競技・カードの一時条件だけを消し、この固定表示条件は解除しません。

## 検索・表示UI

キーワードは明示的な「検索」ボタンまたはEnterで適用し、入力中は結果を変えません。店舗名・住所・地域・都道府県・市区町村、同一試合の試合名・競技・日付を日英で検索します。語は空白区切りのAND条件で、別々の試合にある語を組み合わせません。店舗情報だけで全語が一致した場合は、その店舗の表示対象試合を残します。地域と都道府県は単一選択ボタン、店舗・日付・競技・カードは複数選択ドロップダウンです。モバイルカードでは試合ごとの「放映あり」badgeを表示せず、PCの表では表示します。

店舗リンク自体は表示します。店舗リンクの補足文は `constants.ts` の `SHOW_STORE_LINK_NOTICE` フラグ（現在 `false`）を有効にした場合のみ表示します。ヘッダーの「公式スポーツイベントTOPに戻る」リンクは `SHOW_SPORTS_EVENTS_RETURN_LINK`（同ファイル、現在 `false`）で制御し、URLと日英文言を保持しています。どちらも `true` にすると該当要素を復帰できます。

画面の選択欄は「店舗／日付」「競技／カード」の2列2段です。条件は同じ試合に対してANDで適用し、同じ項目の複数選択はORです。カードの識別子は元の日時・試合名を保持します。`services/broadcastPresentation.ts` で対戦表記を `A VS B` に統一し、日本語UIの英語併記を省きます。競技バッジの色はPC/スマホで共通、日本語・英語は切替表示です。この整形のために元シートやGASを変更しません。

## 入力シート

確認済みのスプレッドシートは「スポーツ放映データ」、gid 0のタブ「放映情報」、timezone `Asia/Tokyo` です。ヘッダーは4行で、M列から最後の有効イベント列まで可変幅で読みます（91列固定にしない）。C:KはID、URL、店舗名、住所、地域、都道府県、市区町村、英語店舗名、英語都道府県名。L4は厳密に `放映可否`。イベント列の行1〜4は日付、競技、日本語試合名（時刻を含む）、英語試合名です。

日付は年を補完・推測せず、Apps Script wrapperはDate値を `Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd')` で正規化します。ローカルsnapshotのGoogle Sheets serial dateは純builderが1899-12-30基準で処理します。

状態セルはtrim後に厳密に `〇：放映する` の場合だけ `showing`。空文字、null、または有効イベント列内の省略セルは `not_showing`（放映取消はセル消去）。予期しない非空値は `unconfirmed` です。部分文字列一致は禁止です。wire JSONの状態欠落・未知値はfrontend decoderが `unconfirmed` にします。

変換処理は欠損項目を旧データや名前から推定しません。今回snapshotに店舗メタデータ欠損はありません。A/B列の社員・担当者情報は読み込み・公開しません。文字列IDは先頭ゼロを保ち、数値化しません。

## ローカル変換

`broadcast-source.local` はgitignoredの提供済みsnapshotで、取込scriptはこのファイルだけを入力として使います。

```sh
node scripts/import-broadcast-sheet.mjs
```

`scripts/import-broadcast-sheet.mjs` は `GAS_BROADCAST.gs` をNode `vm` にロードし、I/Oを行わない `buildBroadcastFeed(snapshot)` だけを呼び出して `public/data/broadcast.json` を生成します。SpreadsheetApp、UrlFetchApp等のwrapper関数は呼びません。生成後は既存 `services/broadcastData.ts` decoderでfeedを検証し、件数集計だけを出力します。

## Apps Script同期準備

2026-10-22にユーザーが既存GitHubリポジトリの継続利用と放映用途への名称変更を決定しました。旧 `9477781/sports-reservation-app` は `9477781/sports-broadcast-app` に変更済みで、リポジトリID `1155095912` と履歴を維持しています。ローカルの `origin` とGAS修正版の送信先許可リストも新名称へ更新済みです。作業ブランチで変更を確認してから運用先 `main` へ反映します。放映feedは `public/data/broadcast.json` とし、旧予約feed `public/data/status.json` は保持します。

Vercelも既存プロジェクトID `prj_9i3JcNWMxLQwNlQbAnAnz6dcDcIe`（チーム `daigo-ogawas-projects`）の名称を `sports-broadcast-app` に変更済みです。GitHubの同じリポジトリIDとの連携と、既存公開ドメイン `sports-congestion-app.vercel.app` を保持しています。名称変更のための再デプロイは行っていません。

2026-10-22にユーザーが現行UI・同梱放映JSONのGitHub反映と本番デプロイを許可しました。`vercel.json` は `main` 更新時のGit自動デプロイとViteの `dist` 配信を設定し、JSONのHTTPキャッシュを無効にします。GASが `main/public/data/broadcast.json` を更新すると、本番デプロイ完了後、開いている画面も1分以内の再取得で反映する構成です。外部GASの変更・認証・トークン設定・送信は今回の本番反映に含めません。

`GAS_BROADCAST.gs` は新feed向けのreview可能なソースです。Apps Scriptへdeploy/実行はしておらず、Script Propertiesも未設定、自動triggerも作成していません。

- `previewBroadcastFeed()` はシートを読んでfeedを生成し、件数集計のみ返す手動dry runです。
- `syncBroadcastFeed()` は明示的な手動実行時のみGitHub更新を行い、他pathを拒否します。
- `diagnoseBroadcastSync()` はGETのみの診断です。読取成功で書込権限を確認済みとは扱いません。
- `initializeBroadcastFeed()` は承認済みの初回手動実行専用です。リポジトリ・ブランチ読取成功と対象ファイルの不存在を確認した場合だけ作成し、既存ファイルの上書きは拒否します。
- Script Properties: `BROADCAST_GITHUB_OWNER=9477781`、`BROADCAST_GITHUB_REPO=sports-broadcast-app`、`BROADCAST_GITHUB_BRANCH=main`（運用開始時）、`BROADCAST_GITHUB_PATH=public/data/broadcast.json`、`BROADCAST_GITHUB_TOKEN`（未設定）。送信先許可リストも既存リポジトリに限定しています。
- 同期はContents APIで既存SHAをGETし、base64 JSONをPUTします。容量対応のためGETは `application/vnd.github.object+json` を要求し、PUT失敗時はHTTP statusだけを報告します。tokenはsourceに置かず、ログにも出しません。
- 実運用前にPropertiesを安全に設定し、手動preview件数と診断結果を照合してから同期関数を使います。token設定・trigger schedule・本番反映は未実施です。

2026-10-22の実GAS確認では、指定シートに紐づくプロジェクトは旧予約形式を `public/data/status.json` へ送るコードで、スクリプトプロパティは未登録、確認アカウントの登録triggerは0件でした。外部通信scopeの要求はありますが、認可・管理者制限による実行可否は未検証です。今回の確認ではGASの変更・実行・GitHub送信はしていません。

既存の `GAS.txt`、`appscriptjson.txt`、`sync.bat`、download/debug/delete helpers、`public/data/status.json` は旧予約feed用で未変更です。新feedに対して実行・転用しないでください。
