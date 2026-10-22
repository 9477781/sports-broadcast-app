/**
 * ==============================================================================
 * スポーツ放映情報：手動同期 + 対戦カード翻訳 + 自動同期設定
 * ==============================================================================
 */

// --- 設定項目 ---
const CONFIG = {
  SHEET_NAME: '放映情報',
  GITHUB_REPO: '9477781/sports-broadcast-app',
  JSON_FILE_PATH: 'public/data/broadcast.json'
};

// ヘッダー行の定義（0始まり）
const ROW_INDEX_DATE = 0;    // 1行目: 日付
const ROW_INDEX_SPORT = 1;   // 2行目: 競技名
const ROW_INDEX_MATCH = 2;   // 3行目: 対戦カード(日本語)
const ROW_INDEX_MATCH_EN = 3;// 4行目: 対戦カード(英語)
const DATA_START_ROW = 5;    // 5行目: データ開始行
const COL_INDEX_DATA_START = 12; // M列からデータ開始

/**
 * メニュー作成
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 アプリ更新')
    .addItem('GitHubへ手動データを送信', 'pushToGitHub')
    .addSeparator()
    .addItem('🌐 対戦カードを英語翻訳', 'translateMatchUps')
    .addSeparator()
    .addItem('⏰ 毎朝8時〜9時の自動同期を設定', 'setDailyTrigger')
    .addToUi();
}

// ========== 翻訳機能 ==========

/**
 * 翻訳メイン機能
 */
function translateMatchUps() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('翻訳開始', '日本語の対戦カードを元に英語表記(4行目)を更新します。実行しますか？', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    var lastCol = sheet.getLastColumn();
    var numCols = lastCol - COL_INDEX_DATA_START;
    if (numCols <= 0) return;

    // 3行目(日本語)を取得
    var matchUpValues = sheet.getRange(ROW_INDEX_MATCH + 1, COL_INDEX_DATA_START + 1, 1, numCols).getValues()[0];
    var translatedValues = [];

    for (var i = 0; i < matchUpValues.length; i++) {
      var jpText = String(matchUpValues[i] || "").trim();
      
      if (jpText === "" || jpText === "---" || jpText === "－") {
        translatedValues.push(jpText);
        continue;
      }

      var enText = translateAndFormat(jpText);
      translatedValues.push(enText);
    }

    // 4行目(英語)に書き込み
    sheet.getRange(ROW_INDEX_MATCH_EN + 1, COL_INDEX_DATA_START + 1, 1, translatedValues.length).setValues([translatedValues]);
    ui.alert('✅ 完了', '翻訳を反映しました。', ui.ButtonSet.OK);

  } catch (e) {
    ui.alert('❌ エラー', e.message, ui.ButtonSet.OK);
  }
}

/**
 * 翻訳と整形 (★ここで時間の削除処理を追加しました)
 */
function translateAndFormat(text) {
  try {
    // 1. カッコ（）や()で囲まれた部分（時間など）を削除
    // 例: "日本vs韓国（19:00）" -> "日本vs韓国"
    var textWithoutTime = text.replace(/[(（].*?[)）]/g, "").trim();

    // 2. 翻訳を実行
    var translated = LanguageApp.translate(textWithoutTime, 'ja', 'en');

    // 3. 英語の表記ゆれを整形
    translated = translated.replace(/ representative/gi, "")
                           .replace(/National Team/gi, "")
                           .replace(/ Japan's/gi, " Japan")
                           .replace(/ team/gi, "");
    translated = translated.replace(/ VS /gi, " vs ");
    if (translated.toLowerCase() === "undecided") translated = "TBD";
    if (translated.toLowerCase() === "open") translated = "OPEN";
    
    // 余計なピリオドなどの削除
    translated = translated.trim().replace(/\.$/, "");
    return translated;
  } catch (e) {
    return text;
  }
}


// Manual menu entry. Scheduled runs use scheduledBroadcastSync in Broadcast.gs.
function pushToGitHub() {
  var ui = SpreadsheetApp.getUi();
  try {
    var summary = syncBroadcastFeed();
    ui.alert('✅ GitHub同期完了', '放映ありの' + summary.stores + '店舗・' + summary.showing + '試合を反映しました。', ui.ButtonSet.OK);
    return summary;
  } catch (error) {
    ui.alert('❌ 同期エラー', error.message + '\n失敗通知先: ' + BROADCAST_FAILURE_EMAIL, ui.ButtonSet.OK);
    throw error;
  }
}

function setDailyTrigger() {
  var summary = configureBroadcastSchedule();
  SpreadsheetApp.getUi().alert('✅ 自動同期設定完了', '毎日8時〜9時（日本時間）に同期します。\n失敗通知先: ' + summary.failureEmail, SpreadsheetApp.getUi().ButtonSet.OK);
  return summary;
}
