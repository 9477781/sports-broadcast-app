# Sports Broadcast Information

参加店舗ごとに、各試合の放映予定を日英で確認する React + Vite アプリです。予約・混雑状況から放映有無へのフロントエンド移行は完了しています。公開JSONには「放映あり」の試合と、その試合がある店舗だけを含め、画面はAsia/Tokyoの今日から9日後までの10日間を表示します。Gemini API key は不要です。

## ローカル起動・feed生成

```sh
npm run dev
node scripts/import-broadcast-sheet.mjs
```

`scripts/import-broadcast-sheet.mjs` は、gitignored のローカル入力 `broadcast-source.local` と `GAS_BROADCAST.gs` の純変換関数を使って `public/data/broadcast.json` を生成します。Apps Script wrapper、Google Sheets、GitHub APIには接続しません。入力snapshotは個人・担当者列を含まず、A/B列を読み取らない変換仕様です。

## 現在のfeedと状態の意味

今回の入力snapshotは115店舗・91試合列（10,465店舗×試合セル）、2026-10-23〜2026-10-31、放映あり742件・放映なし9,723件・確認中0件です。`public/data/broadcast.json` には放映ありの106店舗・742件だけを出力しています。JSONは2,898,122 bytesから241,566 bytesへ約91.7%削減しました。入力snapshotの全状態はシート・非公開のローカル入力に残し、公開JSONには含めません。この生成成功はGASからの実送信の稼働を意味しません。

## 本番配信とデータ更新

本番は既存GitHubリポジトリ `9477781/sports-broadcast-app` の `main` と、Vercelの同名プロジェクトを使用します。`vercel.json` でGit連携の自動デプロイを有効にし、Viteの出力 `dist` を配信します。GASが `main` の `public/data/broadcast.json` を更新すると、GitHub連携による本番ビルド・デプロイの完了後に新JSONが配信されます。即時のファイル転送ではなく、ビルド時間が必要です。

本番URL: [スポーツ放映情報](https://sports-congestion-app.vercel.app/)。2026-10-22にUIと同梱JSONを `main` へ反映し、Git連携による自動本番デプロイの `READY` を確認しました（初回反映commit `40b1763`、deployment `dpl_GCh85auys5YG1gTzZXPNPYfjobGv`）。本番JSONのHTTP 200・`Cache-Control: no-store`、PC/スマホ表示、カード検索、言語切替を確認済みです。

アプリはJSONを初回表示・再試行時に加え、表示中は1分ごと、タブ復帰時にも再取得します。取得時はブラウザーキャッシュを使わず、Vercel側も当該JSONに `Cache-Control: no-store` を設定します。更新時は言語・検索条件を維持し、一時的な取得エラーや不正JSONでは最後に取得できた正常な表示を保持します。初回の取得失敗時は再試行ボタンを表示します。

現在の同梱JSONは上記snapshotです。スプレッドシート側GASには放映用の同期処理を保存済みです。追加のメール送信認可・トリガー登録・GitHubトークン設定・GASからの実送信確認は未完了です。GASから送るJSONは以下のfeed形式と出力pathに合わせます。アプリのビルド・表示にAPIキーは不要です。

スプレッドシート「スポーツ放映データ」の「放映情報」タブでは、各イベント列の状態セルを次のように変換します。

| シートの値 | 内部判定 | 公開JSONへの出力 |
| --- | --- | --- |
| 前後空白をtrimした厳密値 `〇：放映する` | `showing` | 試合を含める |
| 空欄、null、正規イベント列内で省略された末尾セル | `not_showing` | 含めない |
| 予期しない非空値 | `unconfirmed` | 含めない |

放映を取り消す場合はセルを消去します。部分文字列一致はしません。feed decoderではwire値の欠落・未知値も `unconfirmed` として扱います。

放映ありの試合が0件の店舗は店舗情報ごと出力しません。全店舗の放映ありを取り消した場合は、正常な `{ updatedAt, data: [] }` を送って旧予定を消し、画面に「現在、放映予定がありません。」と表示します。入力シート自体に店舗行がない場合は読取異常として送信を止めます。

## feed形式

JSONルートは `updatedAt`（ISO日時または `null`）と `data` 配列を持ちます。店舗には文字列 `id`、店舗メタデータ、`matches` 配列があります。試合には `date`（`YYYY-MM-DD`）、`display_date`、`sport`、`match`、`match_en`、`broadcastStatus` があります。

以下は架空データの例です。

```json
{
  "updatedAt": null,
  "data": [
    {
      "id": "demo-store-0001",
      "url": "",
      "name": "架空サンプル店舗",
      "name_en": "Fictional Sample Store",
      "address": "東京都 千代田区（架空）",
      "region": "関東",
      "prefecture": "東京都",
      "prefecture_en": "Tokyo",
      "city": "千代田区",
      "matches": [
        {
          "date": "2099-01-01",
          "display_date": "2099/01/01",
          "sport": "サンプル競技",
          "match": "架空チームA vs 架空チームB",
          "match_en": "Fictional Team A vs Fictional Team B",
          "broadcastStatus": "showing"
        }
      ]
    }
  ]
}
```

## シートとの対応と欠損店舗情報

シートには4行のヘッダーがあります。C:Kは店舗ID、URL、日本語名、住所、地域、都道府県、市区町村、英語名、英語都道府県名です。L4は厳密に `放映可否`、M列以降がイベント列です。列数は固定せず、最後の有効イベントヘッダーまで読み込みます。日付は年を推測せず、シートの日付値をAsia/Tokyoで `YYYY-MM-DD` に変換します。

最新のローカルsnapshotでは115店舗すべての店舗メタデータが揃っています。変換処理は将来の任意項目欠損時にも旧データや店舗名から推定せず、定義済みの空欄/未登録値にします。デコーダーは住所の空文字を許可します。人事・担当者情報のA/B列はfeedに含めません。

## 画面の固定表示条件

AppはAsia/Tokyo基準で当日と翌9日分の10暦日を計算し、その期間内で `broadcastStatus === "showing"` の試合だけを表示します。時計のタイムゾーンではなくAsia/Tokyoを使い、1分ごと、およびタブ復帰時に期間を更新します。検索・地域・都道府県・店舗・日付・競技・カードの選択肢と表示はこの固定条件に該当する試合だけを対象にします。リセットしても期間と放映あり条件は解除されません。公開feedは放映ありだけですが、旧形式等で `not_showing` / `unconfirmed` が届いた場合も画面では除外します。期間外の放映あり試合も画面には表示しません。

## 検索と選択UI

キーワードは入力後に「検索」ボタンまたはEnterで適用します。店舗名・住所・地域・都道府県・市区町村、試合名・競技・日付（表示日付や `MM/DD` を含む）を日本語/英語で検索できます。空白区切りの語はすべて一致が必要で、試合情報の語は同じ試合内で照合します。店舗情報だけで全語が一致した場合は、その店舗の表示対象試合をすべて残します。入力中の文字は検索結果に反映されず、リセットで入力と適用済み検索の両方を消します。

選択欄は2列2段で、上段が「店舗／日付」、下段が「競技／カード」です。4項目とも複数選択でき、他の条件と同じ試合に対して照合します。地域と都道府県は単一選択ボタンで、キーワード等の一時条件で消えません。スマホでは地域・県のボタン列を横スクロールできます。

`services/broadcastPresentation.ts` がUIだけの表記を整えます。対戦表記は `A VS B`（前後に半角スペース）に統一し、日本語表示では英語試合名を併記しません。英語はEN切替時に表示します。競技名も言語に合わせ、サッカー=緑、バスケットボール=オレンジ、野球=青、ラグビー=赤、競馬=紫、その他イベント=グレーの共通バッジをPC/スマホで使います。元シート・GAS・JSON・識別キーは変更しません。

モバイルカードでは各試合の「放映あり」badgeを省き、PCの表では表示します。店舗リンクは維持しています。補足文「店舗名から公式店舗情報を確認できます。」は `constants.ts` の `SHOW_STORE_LINK_NOTICE` が `false` の間は表示されず、`true` にすると日英で表示します。ヘッダーの「公式スポーツイベントTOPに戻る」リンクもURLと文言を残したまま、`SHOW_SPORTS_EVENTS_RETURN_LINK` が `false` のため画面・アクセシビリティツリーに表示しません。

## GAS準備状況と手動運用

GitHubは既存リポジトリを継続利用し、2026-10-22に放映用途に合わせて [9477781/sports-broadcast-app](https://github.com/9477781/sports-broadcast-app) へ名前を変更しました（旧名 `sports-reservation-app`、リポジトリID `1155095912`）。既存履歴を保持し、放映用の変更を作業ブランチで確認した後、運用先の `main` に反映する方針です。ローカルの `origin` も新URLへ更新済みです。

Vercelも同じ既存プロジェクトの名称を `sports-broadcast-app` に変更しました（チーム `daigo-ogawas-projects`、プロジェクトID `prj_9i3JcNWMxLQwNlQbAnAnz6dcDcIe`）。リポジトリIDによる連携と既存公開ドメイン `sports-congestion-app.vercel.app` は保持されています。この名称変更に伴うアプリの再デプロイは行っていません。

スプレッドシートに紐づくApps Scriptへ、`GAS_BROADCAST.gs` を `Broadcast.gs` として保存し、既存 `コード.gs` を `GAS_MENU.gs` の内容へ更新しました。手動更新・翻訳メニューを保持し、手動更新と時間トリガーの両方を放映用JSONの同期に接続しています。`previewBroadcastFeed()` は生成件数のみ返し、GitHubを書き換えません。

`configureBroadcastSchedule()` は、現在の実行アカウントで毎日8時〜9時（`Asia/Tokyo`）に `scheduledBroadcastSync()` を1回実行する時間トリガーを登録します。同じ同期処理の古い時間トリガーだけを置き換え、他のトリガーは保持します。設定時にJSON送信・メール送信は行いません。手動更新と自動同期で失敗したときだけ `ogawa@pub-hub.com` へ通知し、成功時は通知しません。メール本文には日時・同期先・認証値を除いたエラー概要だけを含めます。Googleのメール送信追加認可とトリガー登録の最終確認は進行中です。

運用時のApps ScriptのScript Propertiesは次の設定とします。トークンはコード・リポジトリに保存しません。

| プロパティ | 設定値 |
| --- | --- |
| `BROADCAST_GITHUB_OWNER` | `9477781` |
| `BROADCAST_GITHUB_REPO` | `sports-broadcast-app` |
| `BROADCAST_GITHUB_BRANCH` | `main`（運用開始時） |
| `BROADCAST_GITHUB_PATH` | `public/data/broadcast.json` |
| `BROADCAST_GITHUB_TOKEN` | 当該リポジトリへのContents書込権限を持つトークン（未設定。既存 `GITHUB_TOKEN` も参照可能） |

ローカルGASの送信先許可リストも既存リポジトリに限定しています。出力先は `public/data/broadcast.json` のみで、旧 `status.json` を上書きしません。`diagnoseBroadcastSync()` はシート読取とGitHubのリポジトリ・ブランチ・ファイルのGETだけを行い、書込権限は未検証として報告します。`syncBroadcastFeed()` は既存ファイルのSHA取得に成功した場合のみ更新します。初回はアプリの確認済み変更と一緒にJSONを配置するか、別途承認した `initializeBroadcastFeed()` の手動実行で作成します。通常同期・診断から初回作成処理は呼びません。認証値やGitHubレスポンス本文はログ出力せず、リダイレクト追従・同時同期・入力店舗行の欠落を防止します。全件取消時の正常な空feedは送信できます。1MBを超える内容のSHA取得には `application/vnd.github.object+json` を使います（[GitHub Contents API](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28)）。

2026-10-22の当初の読み取り確認では、実GASは旧予約形式を `public/data/status.json` へ送るコードで、プロパティ未登録・確認アカウントの登録トリガー0件でした。その後のユーザーの依頼で、放映用送信処理と8時台の自動同期・失敗通知コードを上記の実GASへ保存しています。GitHubトークンの設定とGASからの実送信は未確認です。

`GAS.txt`、`appscriptjson.txt`、既存sync/download/debug/delete helpers、`public/data/status.json` は旧予約状況向けで未変更です。新broadcast feedに対して実行・転用しないでください。

## 検証

```sh
npx tsc --noEmit
npm run build
node scripts/verify-broadcast-sync.mjs
```
