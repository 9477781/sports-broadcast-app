import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../GAS_BROADCAST.gs', import.meta.url), 'utf8');
const token = 'test-token-never-log';
const sha = 'a'.repeat(40);
const config = {
  BROADCAST_GITHUB_OWNER: '9477781',
  BROADCAST_GITHUB_REPO: 'sports-broadcast-app',
  BROADCAST_GITHUB_BRANCH: 'main',
  BROADCAST_GITHUB_PATH: 'public/data/broadcast.json',
  BROADCAST_GITHUB_TOKEN: token,
};
const snapshot = {
  sheetName: '放映情報', sourceUpdatedAt: '2026-10-22T10:00:00.000Z',
  headers: [['2026-10-23'], ['Soccer'], ['川崎vs岡山(16:00)'], ['Kawasaki vs Okayama']],
  displayDates: ['10月23日(金)'],
  storeRows: [['001', 'https://example.com/store', '店舗', '住所', '関東', '東京都', '新宿区', 'Store', 'Tokyo']],
  statusRows: [['〇：放映する']],
};
function harness({ properties = {}, statuses = [200, 200, 200, 200], invalidJsonAt = -1, fetchError = false, locked = false, empty = false, mailError = false } = {}) {
  const requests = [], logs = [], emails = [], triggers = [], schedule = [];
  let releases = 0;
  const props = { ...config, ...properties };
  const context = vm.createContext({
    console: { log: text => logs.push(text), error: text => logs.push(text) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] ?? null, setProperties: values => Object.assign(props,values) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => { releases++; } }) },
    Utilities: {
      newBlob: text => ({ getBytes: () => Buffer.from(text, 'utf8') }),
      base64Encode: bytes => Buffer.from(bytes).toString('base64'),
      formatDate: () => '2026-10-22 23:00:00',
    },
    MailApp: { sendEmail: message => { if(mailError) throw new Error('Mail unavailable'); emails.push(message); } },
    ScriptApp: {
      EventType: { CLOCK: 'CLOCK' }, getProjectTriggers: () => [...triggers],
      deleteTrigger: trigger => { const i=triggers.indexOf(trigger); if(i>=0)triggers.splice(i,1); },
      newTrigger: handler => {
        const builder={timeBased:()=>builder,inTimezone:v=>{schedule.push(['timezone',v]);return builder;},atHour:v=>{schedule.push(['hour',v]);return builder;},everyDays:v=>{schedule.push(['days',v]);return builder;},create:()=>{const t={getEventType:()=> 'CLOCK',getHandlerFunction:()=>handler};triggers.push(t);return t;}};
        return builder;
      },
    },
    UrlFetchApp: { fetch: (url, options) => {
      requests.push({ url, ...options });
      if (fetchError) throw new Error(`private network error ${token}`);
      const index = requests.length - 1;
      const body = index === 0 ? { full_name: '9477781/sports-broadcast-app' }
        : index === 1 ? { name: 'main' }
        : { type: 'file', path: 'public/data/broadcast.json', sha };
      return { getResponseCode: () => statuses[index] ?? 500,
        getContentText: () => index === invalidJsonAt ? 'invalid' : JSON.stringify(body) };
    } },
  });
  vm.runInContext(source, context);
  const feed = context.buildBroadcastFeed(snapshot);
  if (empty) feed.data = [];
  context.readBroadcastFeed_ = () => feed;
  return { context, requests, logs, emails, triggers, schedule, releases: () => releases };
}
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }

test('diagnosis performs GET only and never claims write access', () => {
  const h = harness(); const report = h.context.diagnoseBroadcastSync();
  assert.equal(report.ok, true); assert.equal(report.githubWrite, 'not_tested');
  assert.equal(report.file, 'exists'); assert.equal(h.requests.length, 3);
  assert.ok(h.requests.every(r => r.method === 'get' && r.followRedirects === false));
  assert.ok(h.logs.every(log => !log.includes(token)));
});
test('missing token stops diagnosis before network access', () => {
  const h = harness({ properties: { BROADCAST_GITHUB_TOKEN: null } });
  const report = h.context.diagnoseBroadcastSync();
  assert.equal(report.ok, false); assert.equal(report.stage, 'configuration');
  assert.match(report.error, /BROADCAST_GITHUB_TOKEN/); assert.equal(h.requests.length, 0);
});
test('missing file is reported without creating it', () => {
  const h = harness({ statuses: [200, 200, 404] });
  assert.equal(h.context.diagnoseBroadcastSync().file, 'missing'); assert.equal(h.requests.length, 3);
});
test('normal sync updates only the reviewed path, using its SHA and UTF-8 JSON', () => {
  const h = harness(); const result = h.context.syncBroadcastFeed();
  assert.equal(result.operation, 'updated'); assert.equal(h.releases(), 1);
  const put = h.requests.at(-1), payload = JSON.parse(put.payload);
  assert.equal(put.method, 'put'); assert.ok(put.url.endsWith('/contents/public/data/broadcast.json'));
  assert.equal(payload.sha, sha); assert.equal(payload.branch, 'main');
  const feed = JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8'));
  assert.equal(feed.data[0].id, '001'); assert.equal(feed.data[0].matches[0].broadcastStatus, 'showing');
  assert.equal(feed.data[0].name, '店舗'); assert.ok(!Object.hasOwn(feed.data[0], 'employee'));
});
test('normal sync never creates a missing file', () => {
  const h = harness({ statuses: [200, 200, 404] });
  assert.throws(() => h.context.syncBroadcastFeed(), /initializeBroadcastFeed/);
  assert.equal(h.requests.length, 3); assert.equal(h.releases(), 1);
});
test('explicit initialization creates a missing file without a SHA', () => {
  const h = harness({ statuses: [200, 200, 404, 201] });
  assert.equal(h.context.initializeBroadcastFeed().operation, 'created');
  assert.equal(Object.hasOwn(JSON.parse(h.requests.at(-1).payload), 'sha'), false);
});
test('initialization refuses to overwrite an existing file', () => {
  const h = harness(); assert.throws(() => h.context.initializeBroadcastFeed(), /already exists/);
  assert.equal(h.requests.length, 3); assert.equal(h.releases(), 1);
});
for (const [name, statuses, expectedCalls] of [
  ['repository 404', [404], 1], ['branch 404', [200, 404], 2],
  ['file 403', [200, 200, 403], 3], ['invalid token', [401], 1],
  ['repository redirect', [301], 1],
]) test(`${name} never causes a PUT`, () => {
  const h = harness({ statuses }); assert.throws(() => h.context.initializeBroadcastFeed(), /HTTP/);
  assert.equal(h.requests.length, expectedCalls); assert.equal(h.releases(), 1);
});
test('write permission denial is reported and not retried', () => {
  const h = harness({ statuses: [200, 200, 200, 403] });
  assert.throws(() => h.context.syncBroadcastFeed(), /Contents permissions/);
  assert.equal(h.requests.length, 4); assert.equal(h.releases(), 1);
});
test('concurrent change is reported and not overwritten', () => {
  const h = harness({ statuses: [200, 200, 200, 409] });
  assert.throws(() => h.context.syncBroadcastFeed(), /concurrent changes/); assert.equal(h.requests.length, 4);
});
test('unreviewed repository and path are rejected before networking', () => {
  for (const properties of [{ BROADCAST_GITHUB_REPO: 'other' }, { BROADCAST_GITHUB_PATH: 'public/data/status.json' }]) {
    const h = harness({ properties }); assert.throws(() => h.context.syncBroadcastFeed(), /allowlist|broadcast.json/);
    assert.equal(h.requests.length, 0); assert.equal(h.releases(), 1);
  }
});
test('network errors do not expose a credential', () => {
  const h = harness({ fetchError: true }); const report = h.context.diagnoseBroadcastSync();
  assert.match(report.error, /external_request/); assert.ok(!JSON.stringify(report).includes(token));
});
test('malformed GitHub response is rejected without writing', () => {
  const h = harness({ invalidJsonAt: 2 }); assert.throws(() => h.context.syncBroadcastFeed(), /invalid JSON/);
  assert.equal(h.requests.length, 3); assert.equal(h.releases(), 1);
});
test('validated zero-broadcast feed clears the previous public schedule', () => {
  const h = harness({ empty: true }); assert.equal(h.context.syncBroadcastFeed().operation, 'updated');
  const payload = JSON.parse(h.requests.at(-1).payload);
  assert.deepEqual(JSON.parse(Buffer.from(payload.content,'base64').toString('utf8')).data, []);
  assert.equal(h.requests.length, 4); assert.equal(h.releases(), 1);
});
test('only showing matches and stores with showing matches are exported', () => {
  const h = harness(); const input = structuredClone(snapshot);
  input.headers = [['2026-10-23','2026-10-24','2026-10-25'],['Soccer','Soccer','Soccer'],['A vs B','C vs D','E vs F'],['A vs B','C vs D','E vs F']];
  input.displayDates = ['10/23','10/24','10/25'];
  input.storeRows.push(['002','https://example.com/other','放映なし店舗']);
  input.statusRows = [['〇：放映する','','unexpected'],['',null,'‐：未実施']];
  const feed = h.context.buildBroadcastFeed(input);
  assert.equal(feed.data.length, 1); assert.equal(feed.data[0].id, '001');
  assert.equal(feed.data[0].matches.length, 1); assert.equal(feed.data[0].matches[0].broadcastStatus,'showing');
  input.statusRows[0][0] = '';
  assert.equal(h.context.buildBroadcastFeed(input).data.length, 0);
});
test('missing source stores cannot produce a clearing feed', () => {
  const h = harness(); const input = structuredClone(snapshot);
  input.storeRows=[]; input.statusRows=[];
  assert.throws(()=>h.context.buildBroadcastFeed(input), /No source store rows/);
});
test('lock contention performs no network access', () => {
  const h = harness({ locked: true }); assert.throws(() => h.context.syncBroadcastFeed(), /Another broadcast sync/);
  assert.equal(h.requests.length, 0); assert.equal(h.releases(), 0);
});
test('schedule is daily 08:00-09:00 JST, replaces old sync triggers, and sends nothing', () => {
  const h=harness();const unrelated={getEventType:()=> 'CLOCK',getHandlerFunction:()=> 'unrelated'};
  h.triggers.push(unrelated,{getEventType:()=> 'CLOCK',getHandlerFunction:()=> 'pushToGitHub'});
  const report=h.context.configureBroadcastSchedule();
  assert.equal(report.timeWindow,'08:00-09:00');assert.equal(report.timeZone,'Asia/Tokyo');
  assert.equal(report.failureEmail,'ogawa@pub-hub.com');
  assert.deepEqual(h.schedule,[['timezone','Asia/Tokyo'],['hour',8],['days',1]]);
  h.context.configureBroadcastSchedule();
  assert.equal(h.triggers.length,2);assert.ok(h.triggers.includes(unrelated));
  assert.equal(h.triggers.filter(t=>t.getHandlerFunction()==='scheduledBroadcastSync').length,1);
  assert.equal(h.requests.length,0);assert.equal(h.emails.length,0);
});
test('successful scheduled sync never emails',()=>{
  const h=harness();assert.equal(h.context.scheduledBroadcastSync().operation,'updated');assert.equal(h.emails.length,0);
});
test('failed scheduled sync emails the requested recipient once and still fails',()=>{
  const h=harness({statuses:[401]});assert.throws(()=>h.context.scheduledBroadcastSync(),/HTTP 401/);
  assert.equal(h.emails.length,1);assert.equal(h.emails[0].to,'ogawa@pub-hub.com');
  assert.ok(!JSON.stringify(h.emails).includes(token));
});
test('mail failure cannot hide the sync failure or leak credentials',()=>{
  const h=harness({statuses:[403],mailError:true});assert.throws(()=>h.context.scheduledBroadcastSync(),/HTTP 403/);
  assert.ok(!h.logs.join('\n').includes(token));
});
test('failure email redacts configured credentials',()=>{
  const h=harness();h.context.notifyBroadcastSyncFailure_(new Error('Failure '+token));
  assert.equal(h.emails.length,1);assert.ok(!h.emails[0].body.includes(token));
});
console.log(`${passed} broadcast sync checks passed. No real GitHub writes were performed.`);
