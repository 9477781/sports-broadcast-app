var BROADCAST_SPREADSHEET_ID = '1O2nDHDesyfwweHqK9jp7L3bwgqWnAXoXxQuoCEqG_bQ';
var BROADCAST_SHEET_NAME = '放映情報';
var BROADCAST_TIME_ZONE = 'Asia/Tokyo';
var BROADCAST_FEED_PATH = 'public/data/broadcast.json';
var BROADCAST_YES_CELL = '〇：放映する';
// Public destination allowlist. Changing repositories requires reviewing this value too.
var BROADCAST_GITHUB_REPOSITORY = '9477781/sports-broadcast-app';

/** Pure sheet-snapshot to public-feed mapping. This function performs no I/O. */
function buildBroadcastFeed(snapshot) {
  if (!broadcastIsRecord_(snapshot)) throw new Error('Snapshot must be an object.');
  if (snapshot.sheetName !== BROADCAST_SHEET_NAME) throw new Error('Unexpected source tab.');
  if (!Array.isArray(snapshot.headers) || snapshot.headers.length !== 4) {
    throw new Error('Snapshot must contain the four event header rows.');
  }

  var eventCount = Array.isArray(snapshot.headers[0]) ? snapshot.headers[0].length : 0;
  if (eventCount < 1) throw new Error('No event columns were found.');
  for (var headerIndex = 0; headerIndex < 4; headerIndex += 1) {
    if (!Array.isArray(snapshot.headers[headerIndex]) || snapshot.headers[headerIndex].length !== eventCount) {
      throw new Error('Event header rows must have matching widths.');
    }
  }
  if (!Array.isArray(snapshot.displayDates) || snapshot.displayDates.length < eventCount) {
    throw new Error('Display dates do not cover all event columns.');
  }
  if (!Array.isArray(snapshot.storeRows) || !Array.isArray(snapshot.statusRows)
      || snapshot.storeRows.length !== snapshot.statusRows.length) {
    throw new Error('Store and status rows must be aligned.');
  }

  var sourceUpdatedAt = broadcastRequiredText_(snapshot.sourceUpdatedAt, 'sourceUpdatedAt');
  if (!broadcastIsTimestamp_(sourceUpdatedAt)) throw new Error('sourceUpdatedAt must be a valid ISO timestamp.');

  var matches = [];
  var duplicateMatchKeys = Object.create(null);
  for (var eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
    var date = broadcastDate_(snapshot.headers[0][eventIndex]);
    var sport = broadcastOptionalText_(snapshot.headers[1][eventIndex], '', 'headers[1][' + eventIndex + ']');
    var match = broadcastOptionalText_(snapshot.headers[2][eventIndex], '', 'headers[2][' + eventIndex + ']');
    var matchEn = broadcastOptionalText_(snapshot.headers[3][eventIndex], match, 'headers[3][' + eventIndex + ']');
    var displayDate = broadcastOptionalText_(snapshot.displayDates[eventIndex], date, 'displayDates[' + eventIndex + ']');
    if (!sport || !match) throw new Error('Event sport and Japanese match title are required at column ' + (eventIndex + 13) + '.');

    var matchKey = JSON.stringify([date, match]);
    if (duplicateMatchKeys[matchKey]) throw new Error('Duplicate event date and Japanese match title at column ' + (eventIndex + 13) + '.');
    duplicateMatchKeys[matchKey] = true;
    matches.push({ date: date, display_date: displayDate, sport: sport, match: match, match_en: matchEn, matchKey: matchKey });
  }

  var lastNonemptyRow = -1;
  for (var rowIndex = 0; rowIndex < snapshot.storeRows.length; rowIndex += 1) {
    var storeRow = snapshot.storeRows[rowIndex];
    var statusRow = snapshot.statusRows[rowIndex];
    if (!Array.isArray(storeRow) || !Array.isArray(statusRow)) throw new Error('Store/status rows must be arrays at row ' + rowIndex + '.');
    if (broadcastRowHasContent_(storeRow) || broadcastRowHasContent_(statusRow)) lastNonemptyRow = rowIndex;
  }
  if (lastNonemptyRow < 0) throw new Error('No source store rows were found. Refusing to replace the public feed.');

  var storeIds = Object.create(null);
  var stores = [];
  for (var storeIndex = 0; storeIndex <= lastNonemptyRow; storeIndex += 1) {
    var values = snapshot.storeRows[storeIndex];
    var statusValues = snapshot.statusRows[storeIndex];
    if (!broadcastRowHasContent_(values) && !broadcastRowHasContent_(statusValues)) {
      throw new Error('An empty row appears before the end of store data at row ' + (storeIndex + 5) + '.');
    }
    if (values.length < 3 || values.length > 9) throw new Error('Store row must contain 3 to 9 C:K fields at row ' + (storeIndex + 5) + '.');
    if (statusValues.length > eventCount) {
      for (var extraIndex = eventCount; extraIndex < statusValues.length; extraIndex += 1) {
        if (!broadcastIsEmpty_(statusValues[extraIndex])) throw new Error('Status data exists without an event header at row ' + (storeIndex + 5) + '.');
      }
    }

    var id = broadcastRequiredText_(values[0], 'storeRows[' + storeIndex + '][0]');
    if (storeIds[id]) throw new Error('Duplicate store id: ' + id + '.');
    storeIds[id] = true;

    var name = broadcastRequiredText_(values[2], 'storeRows[' + storeIndex + '][2]');
    var prefecture = broadcastOptionalText_(values[5], '未登録', 'storeRows[' + storeIndex + '][5]') || '未登録';
    var store = {
      id: id,
      url: broadcastOptionalText_(values[1], '', 'storeRows[' + storeIndex + '][1]'),
      name: name,
      name_en: broadcastOptionalText_(values[7], name, 'storeRows[' + storeIndex + '][7]') || name,
      address: broadcastOptionalText_(values[3], '', 'storeRows[' + storeIndex + '][3]'),
      region: broadcastOptionalText_(values[4], '未登録', 'storeRows[' + storeIndex + '][4]') || '未登録',
      prefecture: prefecture,
      prefecture_en: broadcastOptionalText_(values[8], prefecture === '未登録' ? 'Unspecified' : prefecture, 'storeRows[' + storeIndex + '][8]') || (prefecture === '未登録' ? 'Unspecified' : prefecture),
      city: broadcastOptionalText_(values[6], '未登録', 'storeRows[' + storeIndex + '][6]') || '未登録',
      matches: []
    };

    for (var matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
      var event = matches[matchIndex];
      var statusValue = matchIndex < statusValues.length ? statusValues[matchIndex] : undefined;
      if (broadcastStatus_(statusValue) !== 'showing') continue;
      store.matches.push({
        date: event.date,
        display_date: event.display_date,
        sport: event.sport,
        match: event.match,
        match_en: event.match_en,
        broadcastStatus: 'showing'
      });
    }
    if (store.matches.length > 0) stores.push(store);
  }

  return { updatedAt: sourceUpdatedAt, data: stores };
}

function broadcastStatus_(value) {
  if (broadcastIsEmpty_(value)) return 'not_showing';
  return typeof value === 'string' && value.trim() === BROADCAST_YES_CELL ? 'showing' : 'unconfirmed';
}

function broadcastDate_(value) {
  if (typeof value === 'number' && isFinite(value)) {
    var serialDay = Math.floor(value);
    var serialDate = new Date(Date.UTC(1899, 11, 30) + serialDay * 86400000);
    return broadcastIsoDate_(serialDate.getUTCFullYear(), serialDate.getUTCMonth() + 1, serialDate.getUTCDate());
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return broadcastIsoDate_(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'string') {
    var text = value.trim();
    var dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(text);
    if (dateOnly && broadcastIsDateOnly_(dateOnly[1])) return dateOnly[1];
    var timestamp = /^(\d{4}-\d{2}-\d{2})T/.exec(text);
    if (timestamp && !isNaN(Date.parse(text)) && broadcastIsDateOnly_(timestamp[1])) return timestamp[1];
  }
  throw new Error('Invalid event date; use a spreadsheet date serial or an ISO date with its year.');
}

function broadcastIsoDate_(year, month, day) {
  var date = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  if (!broadcastIsDateOnly_(date)) throw new Error('Invalid event date.');
  return date;
}

function broadcastIsDateOnly_(value) {
  var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return false;
  var year = Number(parts[1]);
  var month = Number(parts[2]);
  var day = Number(parts[3]);
  var date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function broadcastIsTimestamp_(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !isNaN(Date.parse(value));
}

function broadcastIsRecord_(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function broadcastIsEmpty_(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function broadcastRowHasContent_(values) {
  for (var index = 0; index < values.length; index += 1) {
    if (!broadcastIsEmpty_(values[index])) return true;
  }
  return false;
}

function broadcastRequiredText_(value, path) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(path + ' must be a non-empty string.');
  return value.trim();
}

function broadcastOptionalText_(value, fallback, path) {
  if (broadcastIsEmpty_(value)) return fallback;
  if (typeof value !== 'string') throw new Error(path + ' must be a string when present.');
  return value.trim();
}

function previewBroadcastFeed() {
  var feed = readBroadcastFeed_();
  var summary = summarizeBroadcastFeed_(feed);
  console.log(JSON.stringify(summary));
  return summary;
}

function syncBroadcastFeed() {
  return writeBroadcastFeed_(false);
}

/** Explicit, one-time creation. Never called by the normal sync or diagnosis. */
function initializeBroadcastFeed() {
  return writeBroadcastFeed_(true);
}

/** Reads only. A successful GET cannot prove that the token can write Contents. */
function diagnoseBroadcastSync() {
  var report = { ok: false, stage: 'sheet', githubWrite: 'not_tested' };
  try {
    report.feed = summarizeBroadcastFeed_(readBroadcastFeed_());
    report.stage = 'configuration';
    var config = broadcastGithubConfig_();
    report.target = { repository: config.owner + '/' + config.repo, branch: config.branch, path: config.path };
    report.stage = 'github';
    var target = inspectBroadcastGithub_(config);
    report.file = target.exists ? 'exists' : 'missing';
    report.ok = true;
    report.nextStep = target.exists
      ? 'Read access verified. Contents write permission still requires an approved sync.'
      : 'Repository and branch are readable. Approve initializeBroadcastFeed to create the missing feed.';
  } catch (error) {
    // Only our sanitized errors are emitted; never expose token or response bodies.
    report.error = error.message;
  }
  console.log(JSON.stringify(report));
  return report;
}

function writeBroadcastFeed_(initialize) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Another broadcast sync is running. Try again after it finishes.');
  try {
    var feed = readBroadcastFeed_();
    // A validated sheet with no showing matches must publish data: [] to clear cancellations.
    // Missing source store rows are rejected by buildBroadcastFeed before reaching this point.
    var config = broadcastGithubConfig_();
    var target = inspectBroadcastGithub_(config);
    if (initialize && target.exists) throw new Error('The broadcast feed already exists. Use syncBroadcastFeed instead.');
    if (!initialize && !target.exists) throw new Error('The broadcast feed does not exist. Review the destination, then use initializeBroadcastFeed once.');

    var content = JSON.stringify(feed, null, 2) + '\n';
    var payload = {
      message: initialize ? 'Initialize sports broadcast feed' : 'Update sports broadcast feed',
      content: Utilities.base64Encode(Utilities.newBlob(content, 'application/json').getBytes()),
      branch: config.branch
    };
    if (target.exists) payload.sha = target.sha;
    var response = broadcastGithubRequest_(config, target.fileUrl, 'put', payload);
    var expectedCode = initialize ? 201 : 200;
    if (response.getResponseCode() !== expectedCode) {
      throw broadcastGithubHttpError_('GitHub feed write', response.getResponseCode());
    }
    var summary = summarizeBroadcastFeed_(feed);
    summary.operation = initialize ? 'created' : 'updated';
    console.log(JSON.stringify(summary));
    return summary;
  } finally {
    lock.releaseLock();
  }
}

/** Validate repository and branch before interpreting a file 404 as absence. */
function inspectBroadcastGithub_(config) {
  var repoUrl = 'https://api.github.com/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo);
  var repoResponse = broadcastGithubRequest_(config, repoUrl, 'get');
  if (repoResponse.getResponseCode() !== 200) throw broadcastGithubHttpError_('GitHub repository lookup', repoResponse.getResponseCode());
  var repo = broadcastGithubJson_(repoResponse);
  if (repo.full_name !== config.owner + '/' + config.repo || repo.archived === true || repo.disabled === true) {
    throw new Error('The configured GitHub repository is mismatched, archived, or disabled.');
  }
  var branchUrl = repoUrl + '/branches/' + encodeURIComponent(config.branch);
  var branchResponse = broadcastGithubRequest_(config, branchUrl, 'get');
  if (branchResponse.getResponseCode() !== 200) throw broadcastGithubHttpError_('GitHub branch lookup', branchResponse.getResponseCode());
  var fileUrl = repoUrl + '/contents/' + config.path.split('/').map(encodeURIComponent).join('/');
  var fileResponse = broadcastGithubRequest_(config, fileUrl + '?ref=' + encodeURIComponent(config.branch), 'get');
  var code = fileResponse.getResponseCode();
  if (code === 404) return { exists: false, fileUrl: fileUrl };
  if (code !== 200) throw broadcastGithubHttpError_('GitHub feed lookup', code);
  var existing = broadcastGithubJson_(fileResponse);
  if (existing.type !== 'file' || existing.path !== config.path || !/^[a-f0-9]{40}$/i.test(existing.sha || '')) {
    throw new Error('GitHub feed lookup did not return the expected file and SHA.');
  }
  return { exists: true, fileUrl: fileUrl, sha: existing.sha };
}

function broadcastGithubRequest_(config, url, method, payload) {
  var options = {
    method: method,
    headers: { Authorization: 'Bearer ' + config.token, Accept: 'application/vnd.github.object+json' },
    muteHttpExceptions: true,
    // Do not forward the token to a redirected destination.
    followRedirects: false
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  try {
    return UrlFetchApp.fetch(url, options);
  } catch (error) {
    throw new Error('GitHub connection failed. Check Apps Script authorization (script.external_request) and the Workspace allowlist for api.github.com.');
  }
}

function broadcastGithubJson_(response) {
  try { return JSON.parse(response.getContentText()); }
  catch (error) { throw new Error('GitHub returned invalid JSON.'); }
}

function broadcastGithubHttpError_(stage, code) {
  var hint = '';
  if (code === 401) hint = ' Check whether the token is valid and unexpired.';
  else if (code === 403) hint = ' Check token Contents permissions, repository rules, and API limits.';
  else if (code === 404) hint = ' Check repository, branch, and token access.';
  else if (code === 409 || code === 422) hint = ' Check concurrent changes and repository rules; diagnose again before retrying.';
  else if (code >= 300 && code < 400) hint = ' Redirects are not followed; review the configured repository.';
  return new Error(stage + ' failed (HTTP ' + code + ').' + hint);
}

function readBroadcastFeed_() {
  var spreadsheet = SpreadsheetApp.openById(BROADCAST_SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(BROADCAST_SHEET_NAME);
  if (!sheet) throw new Error('Configured broadcast tab was not found.');
  var broadcastHeader = String(sheet.getRange(4, 12).getDisplayValue() || '').trim();
  if (broadcastHeader !== '放映可否') throw new Error('Column L must be labeled 放映可否.');

  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 13) throw new Error('No event columns were found after column L.');
  var possibleEventCount = lastColumn - 12;
  var eventRange = sheet.getRange(1, 13, 4, possibleEventCount);
  var headerValues = eventRange.getValues();
  var headerDisplays = eventRange.getDisplayValues();
  var lastEventIndex = -1;
  for (var columnIndex = 0; columnIndex < possibleEventCount; columnIndex += 1) {
    for (var headerIndex = 0; headerIndex < 4; headerIndex += 1) {
      if (!broadcastIsEmpty_(headerValues[headerIndex][columnIndex])) lastEventIndex = columnIndex;
      else if (!broadcastIsEmpty_(headerDisplays[headerIndex][columnIndex])) lastEventIndex = columnIndex;
    }
  }
  if (lastEventIndex < 0) throw new Error('No valid event header columns were found.');
  var eventCount = lastEventIndex + 1;

  var normalizedHeaders = [[], [], [], []];
  for (var eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
    var rawDate = headerValues[0][eventIndex];
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      normalizedHeaders[0].push(Utilities.formatDate(rawDate, BROADCAST_TIME_ZONE, 'yyyy-MM-dd'));
    } else {
      normalizedHeaders[0].push(rawDate);
    }
    for (var textHeader = 1; textHeader < 4; textHeader += 1) {
      normalizedHeaders[textHeader].push(headerDisplays[textHeader][eventIndex]);
    }
  }

  var lastRow = sheet.getLastRow();
  var storeRows = [];
  var statusRows = [];
  if (lastRow >= 5) {
    var rowCount = lastRow - 4;
    storeRows = sheet.getRange(5, 3, rowCount, 9).getDisplayValues();
    statusRows = sheet.getRange(5, 13, rowCount, eventCount).getDisplayValues();
  }

  return buildBroadcastFeed({
    sheetName: BROADCAST_SHEET_NAME,
    sourceUpdatedAt: new Date().toISOString(),
    headers: normalizedHeaders,
    displayDates: headerDisplays[0].slice(0, eventCount),
    storeRows: storeRows,
    statusRows: statusRows
  });
}

function broadcastGithubConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var config = {
    owner: properties.getProperty('BROADCAST_GITHUB_OWNER'),
    repo: properties.getProperty('BROADCAST_GITHUB_REPO'),
    branch: properties.getProperty('BROADCAST_GITHUB_BRANCH'),
    path: properties.getProperty('BROADCAST_GITHUB_PATH'),
    token: properties.getProperty('BROADCAST_GITHUB_TOKEN')
  };
  var missing = [];
  Object.keys(config).forEach(function(key) {
    if (!config[key] || String(config[key]).trim() === '') missing.push('BROADCAST_GITHUB_' + key.toUpperCase());
  });
  if (missing.length) throw new Error('Missing Script Properties: ' + missing.join(', ') + '.');
  if (config.path !== BROADCAST_FEED_PATH) throw new Error('BROADCAST_GITHUB_PATH must be public/data/broadcast.json.');
  if (!/^[A-Za-z0-9_.-]+$/.test(config.owner) || !/^[A-Za-z0-9_.-]+$/.test(config.repo)) {
    throw new Error('GitHub owner/repository configuration is invalid.');
  }
  if (config.owner + '/' + config.repo !== BROADCAST_GITHUB_REPOSITORY) {
    throw new Error('GitHub repository is outside the reviewed destination allowlist.');
  }
  if (/\s|[\x00-\x1f\x7f]/.test(config.branch)) throw new Error('GitHub branch configuration is invalid.');
  return config;
}

function summarizeBroadcastFeed_(feed) {
  var showing = 0;
  var notShowing = 0;
  var unconfirmed = 0;
  var total = 0;
  var firstDate = null;
  var lastDate = null;
  feed.data.forEach(function(store) {
    store.matches.forEach(function(match) {
      total += 1;
      if (match.broadcastStatus === 'showing') showing += 1;
      else if (match.broadcastStatus === 'not_showing') notShowing += 1;
      else unconfirmed += 1;
      if (firstDate === null || match.date < firstDate) firstDate = match.date;
      if (lastDate === null || match.date > lastDate) lastDate = match.date;
    });
  });
  return { stores: feed.data.length, matches: total, showing: showing, not_showing: notShowing, unconfirmed: unconfirmed, firstDate: firstDate, lastDate: lastDate };
}
