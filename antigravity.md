# Sports Broadcast Information

## アプリの目的と実装状況

参加店舗ごとに各スポーツ試合の放映予定を確認する日英対応viewerです。React 19、Vite 6、TypeScript 5.8で動作し、地域/都道府県ボタン、店舗/日付/競技/カード選択、試合情報も対象とするキーワード検索を備えています。画面にはAsia/Tokyoの今日から9日後までの「放映あり」の試合だけを表示します。Gemini API keyは不要です。

予約混雑viewerから放映有無viewerへのフロントエンド移行は完了しています。Appは `/data/broadcast.json` を初回表示・retry時、表示中の1分ごと、タブ復帰時にキャッシュなしで読み込みます。更新時に一時的な取得失敗があっても最後の正常な表示と言語・検索条件を保持します。入力snapshotは115店舗、91イベント列、10,465セル、2026-10-23〜31、showing 742、not_showing 9,723、unconfirmed 0です。公開feedは放映ありの106店舗・742件だけで、241,566 bytes（全状態版から約91.7%削減）です。入力の全状態はシート・非公開snapshotに残します。これはローカル変換の結果であり、GASからの実送信が稼働中であることを意味しません。

画面はAsia/Tokyoの今日〜+9日までの10暦日を対象にします。公開feedには `showing` と放映ありの試合がある店舗だけを含め、`not_showing` / `unconfirmed` は送信しません。UIでも防御的に状態・期間を確認します。時計のタイムゾーンは使わず、1分ごと・タブ復帰時にJST期間を更新します。Resetはキーワード・地域・都道府県・店舗・日付・競技・カードの一時条件だけを消し、この固定表示条件は解除しません。

## 検索・表示UI

キーワードは明示的な「検索」ボタンまたはEnterで適用し、入力中は結果を変えません。店舗名・住所・地域・都道府県・市区町村、同一試合の試合名・競技・日付を日英で検索します。語は空白区切りのAND条件で、別々の試合にある語を組み合わせません。店舗情報だけで全語が一致した場合は、その店舗の表示対象試合を残します。地域と都道府県は単一選択ボタン、店舗・日付・競技・カードは複数選択ドロップダウンです。モバイルカードでは試合ごとの「放映あり」badgeを表示せず、PCの表では表示します。

店舗リンク自体は表示します。店舗リンクの補足文は `constants.ts` の `SHOW_STORE_LINK_NOTICE` フラグ（現在 `false`）を有効にした場合のみ表示します。ヘッダーの「公式スポーツイベントTOPに戻る」リンクは `SHOW_SPORTS_EVENTS_RETURN_LINK`（同ファイル、現在 `false`）で制御し、URLと日英文言を保持しています。どちらも `true` にすると該当要素を復帰できます。

画面の選択欄は「店舗／日付」「競技／カード」の2列2段です。条件は同じ試合に対してANDで適用し、同じ項目の複数選択はORです。カードの識別子は元の日時・試合名を保持します。`services/broadcastPresentation.ts` で対戦表記を `A VS B` に統一し、日本語UIの英語併記を省きます。競技バッジの色はPC/スマホで共通、日本語・英語は切替表示です。この整形のために元シートやGASを変更しません。

## 入力シート

確認済みのスプレッドシートは「スポーツ放映データ」、gid 0のタブ「放映情報」、timezone `Asia/Tokyo` です。ヘッダーは4行で、M列から最後の有効イベント列まで可変幅で読みます（91列固定にしない）。C:KはID、URL、店舗名、住所、地域、都道府県、市区町村、英語店舗名、英語都道府県名。L4は厳密に `放映可否`。イベント列の行1〜4は日付、競技、日本語試合名（時刻を含む）、英語試合名です。

日付は年を補完・推測せず、Apps Script wrapperはDate値を `Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd')` で正規化します。ローカルsnapshotのGoogle Sheets serial dateは純builderが1899-12-30基準で処理します。

状態セルはtrim後に厳密に `〇：放映する` の場合だけ `showing` として出力します。空文字、null、または有効イベント列内の省略セルは内部的に `not_showing`（放映取消はセル消去）、予期しない非空値は `unconfirmed` と判定し、どちらも公開feedから除外します。放映ありが0件の店舗も除外します。部分文字列一致は禁止です。wire JSONの状態欠落・未知値はfrontend decoderが `unconfirmed` にします。全件取消は正常な `data: []` を送って旧予定を消し、UIは予定なしを表示します。入力店舗行がない異常はbuilderで拒否します。

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

初回本番反映はcommit `40b1763c8bbb5e32d7035503604e53fd25200495`、Vercel deployment `dpl_GCh85auys5YG1gTzZXPNPYfjobGv`（Git/mainからの自動作成、READY）で完了しました。本番URLは `https://sports-congestion-app.vercel.app/`。HTTP 200、115店舗のfeedと `Cache-Control: no-store`、画面上の106店舗・放映あり742件、カード検索、日本語/英語切替、390pxのスマホ表示を確認済みです。型チェック・本番ビルド・GAS同期mock検証19件・JSON自動更新の画面検証6項目も成功しています。次の作業はシート側GASの放映形式への移行・安全なプロパティ設定・実送信確認です。GASから送る先は `9477781/sports-broadcast-app` の `main/public/data/broadcast.json` です。

その後、ユーザーが非放映データの送信不要を指定したため、公開JSONとGAS修正版を「放映ありの店舗・試合のみ」に軽量化しました。106店舗・742件の表示内容は全状態版の放映あり部分と完全一致します。全件取消は `data: []` で反映し、入力店舗行の欠落とは区別します。GAS同期mock検証はこの条件を含む21件へ更新済みです。外部のシート側GASは引き続き未変更です。

続いて、ユーザーがシート側GASの自動同期を毎日8時〜9時（日本時間）に設定し、失敗時だけ `ogawa@pub-hub.com` に通知するよう依頼しました（最初の宛先指定をユーザーが訂正済み）。実プロジェクトへ `Broadcast.gs` を追加し、既存 `コード.gs` をローカル `GAS_MENU.gs` と一致する内容へ保存しました。既存の翻訳処理は維持し、手動更新を新しい `syncBroadcastFeed()` へ接続しています。`configureBroadcastSchedule()` は `scheduledBroadcastSync` の毎日8時台のトリガーを登録し、同一同期の古い時間トリガーだけを置換します。設定時にはJSON・メールを送信しません。成功時メールはなく、失敗時のみ日時・同期先・認証値を除いたエラー概要を通知します。ローカルmock検証26件・メニューとの結合構文検証は成功。日次トリガー登録とユーザー承認によるメール送信の追加認可は完了し、GitHubトークン設定・GAS実送信確認が残っています。

`GAS_BROADCAST.gs` は実Apps Scriptの `Broadcast.gs` と一致する新feed用ソースです。設定関数は実行完了し、`scheduledBroadcastSync` の日次トリガー1件を登録済みです。実編集画面でも「午前8時〜9時」「GMT+09:00」を確認しました。実行ログは `githubTokenConfigured:false` のため、トークン設定と実送信確認は残っています。ユーザーからメール送信権限追加の明示承認を受け、Google認可画面の「次へ」を確定し認可画面の終了を確認しました。JSON送信・メール実送信は行っていません。

- `previewBroadcastFeed()` はシートを読んでfeedを生成し、件数集計のみ返す手動dry runです。
- `syncBroadcastFeed()` は手動更新と `scheduledBroadcastSync()` からの自動実行でGitHubを更新し、他pathを拒否します。
- `diagnoseBroadcastSync()` はGETのみの診断です。読取成功で書込権限を確認済みとは扱いません。
- `initializeBroadcastFeed()` は承認済みの初回手動実行専用です。リポジトリ・ブランチ読取成功と対象ファイルの不存在を確認した場合だけ作成し、既存ファイルの上書きは拒否します。
- Script Properties: `BROADCAST_GITHUB_OWNER=9477781`、`BROADCAST_GITHUB_REPO=sports-broadcast-app`、`BROADCAST_GITHUB_BRANCH=main`（運用開始時）、`BROADCAST_GITHUB_PATH=public/data/broadcast.json`、`BROADCAST_GITHUB_TOKEN`（未設定）。送信先許可リストも既存リポジトリに限定しています。
- 同期はContents APIで既存SHAをGETし、base64 JSONをPUTします。容量対応のためGETは `application/vnd.github.object+json` を要求し、PUT失敗時はHTTP statusだけを報告します。tokenはsourceに置かず、ログにも出しません。
- 実運用前にトークンを安全に設定し、手動preview件数と診断結果を照合してから同期関数を使います。日次トリガーとアプリの本番反映は完了しています。トークン未設定のまま次回の自動実行を迎えると、GitHub送信は失敗し通知対象になります。

2026-10-22の当初の実GAS確認では、指定シートに紐づくプロジェクトは旧予約形式を `public/data/status.json` へ送るコードで、スクリプトプロパティは未登録、確認アカウントの登録triggerは0件でした。その後、上記の放映用コードへ更新済みです。GASからのGitHub送信は未実施です。

既存の `GAS.txt`、`appscriptjson.txt`、`sync.bat`、download/debug/delete helpers、`public/data/status.json` は旧予約feed用で未変更です。新feedに対して実行・転用しないでください。
