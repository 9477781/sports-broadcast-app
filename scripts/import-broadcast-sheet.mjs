import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourcePath = path.join(projectRoot, 'broadcast-source.local');
const gasPath = path.join(projectRoot, 'GAS_BROADCAST.gs');
const decoderPath = path.join(projectRoot, 'services', 'broadcastData.ts');
const outputPath = path.join(projectRoot, 'public', 'data', 'broadcast.json');

const EXPECTED_SPREADSHEET_ID = '1O2nDHDesyfwweHqK9jp7L3bwgqWnAXoXxQuoCEqG_bQ';
const EXPECTED_TAB_NAME = '放映情報';

export function loadPureBuilder(gasSource) {
  const sandbox = vm.createContext({});
  new vm.Script(gasSource, { filename: 'GAS_BROADCAST.gs' }).runInContext(sandbox, { timeout: 1000 });
  if (typeof sandbox.buildBroadcastFeed !== 'function') {
    throw new Error('GAS_BROADCAST.gs did not define the pure feed builder.');
  }
  return sandbox.buildBroadcastFeed;
}

export function validateSnapshotIdentity(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Local snapshot must be an object.');
  }
  if (snapshot.spreadsheetId !== EXPECTED_SPREADSHEET_ID
      || snapshot.sheetName !== EXPECTED_TAB_NAME
      || snapshot.sheetId !== 0
      || snapshot.firstStoreRow !== 5
      || snapshot.firstMatchColumn !== 13) {
    throw new Error('Local snapshot does not match the confirmed broadcast sheet layout.');
  }
  if (!Array.isArray(snapshot.headers) || snapshot.headers.length !== 4
      || !Array.isArray(snapshot.storeRows) || !Array.isArray(snapshot.statusRows)) {
    throw new Error('Local snapshot is missing required sheet ranges.');
  }
}

export async function decodeWithProjectDecoder(feed) {
  const decoderSource = await fs.readFile(decoderPath, 'utf8');
  const compiled = ts.transpileModule(decoderSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const decoderModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  return decoderModule.decodeBroadcastData(feed);
}

export function summarizeFeed(feed) {
  let matches = 0;
  let showing = 0;
  let notShowing = 0;
  let unconfirmed = 0;
  let firstDate = null;
  let lastDate = null;
  for (const store of feed.data) {
    for (const match of store.matches) {
      matches += 1;
      if (match.broadcastStatus === 'showing') showing += 1;
      else if (match.broadcastStatus === 'not_showing') notShowing += 1;
      else unconfirmed += 1;
      if (firstDate === null || match.date < firstDate) firstDate = match.date;
      if (lastDate === null || match.date > lastDate) lastDate = match.date;
    }
  }
  return { stores: feed.data.length, matches, showing, not_showing: notShowing, unconfirmed, firstDate, lastDate };
}

export async function buildFeedFromSnapshot(snapshot, gasSource) {
  validateSnapshotIdentity(snapshot);
  const buildBroadcastFeed = loadPureBuilder(gasSource);
  const built = buildBroadcastFeed(snapshot);
  const decoded = await decodeWithProjectDecoder(built);
  return { feed: decoded, summary: summarizeFeed(decoded) };
}

export async function importBroadcastSnapshot() {
  const snapshot = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  const gasSource = await fs.readFile(gasPath, 'utf8');
  const { feed, summary } = await buildFeedFromSnapshot(snapshot, gasSource);
  const expectedOutput = path.resolve(projectRoot, 'public', 'data', 'broadcast.json');
  if (path.resolve(outputPath) !== expectedOutput) throw new Error('Refusing to write outside public/data/broadcast.json.');
  await fs.writeFile(outputPath, JSON.stringify(feed, null, 2) + '\n', 'utf8');
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  importBroadcastSnapshot()
    .then(summary => console.log(JSON.stringify(summary)))
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Broadcast snapshot import failed.');
      process.exitCode = 1;
    });
}
