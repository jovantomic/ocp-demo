import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runSource, createContext, redactUrl, location } from '../data-gatherers/shared/core.mjs';
import { sources } from '../data-gatherers/index.mjs';
import { parseFeed } from '../data-gatherers/news/rss.mjs';
import { parseReport } from '../data-gatherers/human-activity/gfw-effort.mjs';
import { zipSync, strToU8 } from 'fflate';

async function temporary(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ocp-gather-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const response = (data, status = 200, headers = {}) => new Response(typeof data === 'string' ? data : JSON.stringify(data), { status, headers });
async function records(root, manifest) {
  const text = await readFile(path.join(root, manifest.output), 'utf8');
  return text.trim() ? text.trim().split('\n').map(JSON.parse) : [];
}
const probe = { id: 'probe', licenceRef: 'https://example.org/licence', async gather(ctx) {
  const { data, raw } = await ctx.request('https://example.org/data?appId=private-key');
  ctx.emit(raw, data, { entityId: 'test', metric: 'temperature', value: data.value, unit: 'C', observationStart: '2024-01-01' });
} };

test('raw provenance, stable IDs and first-seen survive repeated runs without overwriting history', async t => {
  const root = await temporary(t); const options = { root, fetch: async () => response({ value: 0 }) };
  const a = await runSource(probe, {}, options); const b = await runSource(probe, {}, options);
  const [first] = await records(root, a); const [second] = await records(root, b);
  assert.equal(first.id, second.id); assert.equal(first.firstSeenAt, second.firstSeenAt);
  assert.equal(first.value, 0); assert.equal(first.synthetic, false); assert.equal(first.providerPublishedAt, null);
  assert.equal(first.rawRecordHash.length, 64); assert.notEqual(a.output, b.output);
  assert.equal(await readFile(path.join(root, first.rawFile), 'utf8'), '{"value":0}');
  assert.ok(!JSON.stringify(a).includes('private-key'));
  assert.ok(a.responses[0].url.includes('REDACTED'));
});

test('429 retries respect Retry-After and preserve each response', async t => {
  const root = await temporary(t); let calls = 0; const delays = [];
  const result = await runSource(probe, {}, { root, sleep: async ms => delays.push(ms), fetch: async () => ++calls === 1 ? response({ error: 'rate' }, 429, { 'retry-after': '2' }) : response({ value: 3 }) });
  assert.equal(calls, 2); assert.deepEqual(delays, [2000]); assert.equal(result.responses.length, 2);
});

test('HTTP failure saves failed manifest and releases provider lock', async t => {
  const root = await temporary(t);
  await assert.rejects(runSource(probe, { attempts: 1 }, { root, fetch: async () => response('unauthorized', 401) }), /HTTP 401/);
  const files = await readdir(path.join(root, 'data/processed/probe'));
  assert.ok(!files.includes('.lock')); assert.ok(!files.includes('latest.json'));
  const manifest = JSON.parse(await readFile(path.join(root, 'data/processed/probe', files.find(f => f.endsWith('.manifest.json')))));
  assert.equal(manifest.status, 'failed'); assert.equal(manifest.responses.length, 1);
});

test('oversized responses and invalid JSON fail, rather than report empty success', async t => {
  const root = await temporary(t);
  await assert.rejects(runSource(probe, { maxResponseBytes: 3 }, { root, fetch: async () => response('too big') }), /exceeds/);
  await assert.rejects(runSource(probe, {}, { root, fetch: async () => response('<html>bad</html>') }), /invalid JSON/);
});

test('same-provider concurrent writers are refused', async t => {
  const root = await temporary(t); const a = await createContext(probe, {}, { root });
  await assert.rejects(createContext(probe, {}, { root }), /already running/);
  await a.finish();
});

test('Open-Meteo uses UTC, preserves units and missing values, never fabricates issue time', async t => {
  const root = await temporary(t);
  const result = await runSource(sources['open-meteo'], { locations: [{ id: 'S01', lat: 9.8, lon: 76.1 }], variables: ['wave_height'] }, { root, fetch: async input => {
    assert.equal(new URL(input).searchParams.get('timeformat'), 'unixtime');
    return response({ latitude: 9.8, longitude: 76.1, hourly: { time: [1704067200, 1704070800], wave_height: [0, null] }, hourly_units: { wave_height: 'm' } });
  } });
  const rows = await records(root, result);
  assert.equal(rows[0].observationStart, '2024-01-01T00:00:00.000Z'); assert.equal(rows[0].value, 0);
  assert.equal(rows[0].issueTime, null); assert.equal(rows[0].kind, 'forecast');
  assert.equal(rows[0].unit, 'm'); assert.ok(rows[1].qualityFlags.includes('missing-value'));
  assert.ok(rows[0].qualityFlags.includes('forecast-issue-time-unknown'));
});

test('GBIF paginates sequentially and marks bounded results partial', async t => {
  const root = await temporary(t); const offsets = [];
  const result = await runSource(sources.gbif, { pageSize: 1, maxPages: 2 }, { root, fetch: async input => {
    const offset = Number(new URL(input).searchParams.get('offset')); offsets.push(offset);
    return response({ results: [{ key: offset, eventDate: '2020-01-01/2020-01-02', decimalLatitude: 0, decimalLongitude: 0, scientificName: 'Test fish', issues: [] }], endOfRecords: false });
  } });
  assert.deepEqual(offsets, [0, 1]); assert.equal(result.status, 'partial');
  assert.equal((await records(root, result))[0].observationEnd, '2020-01-02T00:00:00.000Z');
});

test('OBIS uses after cursor and stops on empty page', async t => {
  const root = await temporary(t); let calls = 0;
  const result = await runSource(sources.obis, { pageSize: 1, maxPages: 3 }, { root, fetch: async input => {
    calls++;
    if (calls === 1) return response({ results: [{ id: 'record-1', eventDate: '2020-01-01' }] });
    assert.equal(new URL(input).searchParams.get('after'), 'record-1'); return response({ results: [] });
  } });
  assert.equal(result.status, 'complete'); assert.equal(calls, 2);
});

test('ECB keeps quote direction and does not turn missing CSV values into zero', async t => {
  const root = await temporary(t);
  const result = await runSource(sources.ecb, { startDate: '2024-01-01', endDate: '2024-01-02' }, { root, fetch: async () => response('CURRENCY,TIME_PERIOD,OBS_VALUE,OBS_STATUS\nUSD,2024-01-01,1.1,A\nINR,2024-01-02,,M\n') });
  const rows = await records(root, result);
  assert.equal(rows[0].entityId, 'EURUSD'); assert.equal(rows[0].unit, 'USD/EUR'); assert.equal(rows[1].value, null);
});

test('Comtrade preview is always partial and keeps quantities separate from USD values', async t => {
  const root = await temporary(t);
  const result = await runSource(sources.comtrade, { period: '2024', reporterCode: 699, cmdCode: '030111' }, { root, env: {}, fetch: async input => {
    assert.ok(input.includes('/public/v1/preview/'));
    return response({ data: [{ reporterCode: 699, partnerCode: 0, flowCode: 'X', cmdCode: '030111', refYear: 2024, primaryValue: 100, netWgt: null, qty: 12, qtyUnitAbbr: 'u', isQtyEstimated: true }] });
  } });
  const rows = await records(root, result); assert.equal(result.status, 'partial'); assert.equal(rows.length, 3);
  assert.equal(rows[0].observationEnd, '2024-12-31T23:59:59.999Z'); assert.equal(rows[1].value, null); assert.equal(rows[2].unit, 'u');
});

test('e-Stat keeps opaque time code without invented dates and follows NEXT_KEY', async t => {
  const root = await temporary(t); let calls = 0;
  const result = await runSource(sources.estat, { statsDataId: 'test', maxPages: 2 }, { root, env: { ESTAT_APP_ID: 'secret' }, fetch: async input => {
    calls++; if (calls === 2) assert.equal(new URL(input).searchParams.get('startPosition'), '2');
    return response({ GET_STATS_DATA: { RESULT: { STATUS: 0 }, STATISTICAL_DATA: { DATA_INF: { VALUE: { '@time': '2024000000', '@cat01': String(calls), '@unit': 't', $: '3' } }, RESULT_INF: { NEXT_KEY: calls === 1 ? 2 : 0 } } } });
  } });
  assert.equal(calls, 2); const rows = await records(root, result); assert.equal(rows[0].observationStart, null); assert.equal(rows[0].dimensions['@time'], '2024000000');
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('RSS and Atom parse publication dates, encoded titles, alternate links; reject DTD and HTML', () => {
  const rows = parseFeed('<rss version="2.0"><channel><item><title><![CDATA[Ports & fish]]></title><link>https://example.org/a</link><pubDate>Fri, 11 Sep 2026 10:00:00 GMT</pubDate><description>Fish exports</description></item></channel></rss>');
  assert.equal(rows[0].title, 'Ports & fish');
  const atom = parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>A</title><link rel="self" href="https://example.org/api"/><link rel="alternate" href="https://example.org/story"/><published>2024-01-01T00:00:00Z</published></entry></feed>');
  assert.equal(atom[0].link, 'https://example.org/story');
  assert.throws(() => parseFeed('<!DOCTYPE rss><rss/>'), /DTD/);
  assert.throws(() => parseFeed('<html><body>login</body></html>'), /not an RSS/);
});

test('news topic filter avoids substring false positives and isolates failing publishers', async t => {
  const root = await temporary(t);
  const result = await runSource(sources['india-news'], { feeds: [{ name: 'Good', url: 'https://example.org/rss', licenceRef: 'https://example.org/terms' }, { name: 'Bad', url: 'https://bad.example/rss', licenceRef: 'https://bad.example/terms' }], topics: { ports: ['port'] }, attempts: 1 }, { root, fetch: async input => input.includes('bad.example') ? response('forbidden', 403) : response('<rss><channel><item><title>Sport report</title></item><item><title>Port closure</title><link>https://example.org/port</link><pubDate>2024-01-01T00:00:00Z</pubDate></item></channel></rss>') });
  const rows = await records(root, result); assert.equal(rows.length, 1); assert.equal(rows[0].value, 'Port closure');
  assert.equal(rows[0].observationStart, null); assert.equal(rows[0].providerPublishedAt, '2024-01-01T00:00:00.000Z');
  assert.equal(result.status, 'partial'); assert.ok(!('summaryForMatching' in rows[0]));
});

test('all failed news feeds report failure', async t => {
  const root = await temporary(t);
  await assert.rejects(runSource(sources['india-news'], { attempts: 1, feeds: [{ name: 'Bad', url: 'https://example.org/rss', licenceRef: 'https://example.org/terms' }] }, { root, fetch: async () => response('<html/>') }), /All enabled/);
});

test('ERDDAP honors provider units and preserves zero coordinates', async t => {
  const root = await temporary(t);
  const result = await runSource(sources.erddap, { datasetId: 'test', query: 'time,latitude,longitude,temp', variables: ['temp'], licenceRef: 'https://example.org/licence' }, { root, fetch: async () => response({ table: { columnNames: ['time', 'latitude', 'longitude', 'temp'], columnUnits: ['UTC', 'degrees_north', 'degrees_east', 'degree_C'], rows: [['2024-01-01', 0, 0, 25]] } }) });
  const [row] = await records(root, result); assert.equal(row.unit, 'degree_C'); assert.deepEqual(row.location, { lat: 0, lon: 0 });
});

test('mapped exports handle quoted CSV fields, periods and missing values without guessing schema', async t => {
  const root = await temporary(t); await writeFile(path.join(root, 'export.csv'), 'species,year,value\n"Fish, A",2024,0\nFish B,2024,..\n');
  const config = { file: 'export.csv', datasetId: 'example', licenceRef: 'https://example.org/terms', timeFormat: 'year', mapping: { entityId: 'species', time: 'year', metrics: [{ column: 'value', name: 'production', unit: 't' }] } };
  const result = await runSource(sources['fao-fishstat'], config, { root });
  const rows = await records(root, result); assert.equal(rows[0].entityId, 'example:Fish, A'); assert.equal(rows[0].value, 0); assert.equal(rows[1].value, null);
  assert.equal(rows[0].observationEnd, '2024-12-31T23:59:59.999Z');
  await assert.rejects(runSource(sources.eumofa, { ...config, mapping: { ...config.mapping, time: 'missing' } }, { root }), /Missing mapped column/);
});

test('keyed adapters fail before creating output when credentials are absent', async t => {
  const root = await temporary(t);
  await assert.rejects(runSource(sources.gfw, {}, { root, env: {} }), /GFW_API_TOKEN/);
  await assert.rejects(runSource(sources.aisstream, {}, { root, env: {} }), /AISSTREAM_API_KEY/);
  assert.deepEqual(await readdir(root), []);
});

test('coordinate and URL helpers reject sentinels and redact query secrets', () => {
  assert.equal(location(91, 181), null); assert.equal(location(null, 10), null);
  const u = redactUrl('https://example.org/?subscription-key=SECRET&appId=SECRET&foo=ok');
  assert.ok(!u.includes('SECRET')); assert.ok(u.includes('foo=ok'));
});

test('public RSS redirects are followed but authenticated cross-origin redirects are refused', async t => {
  const root = await temporary(t); let calls = 0;
  const source = { ...probe, async gather(ctx) { await ctx.request('https://example.org/feed', { format: 'text' }); } };
  const result = await runSource(source, {}, { root, fetch: async input => {
    calls++; if (calls === 1) return response('', 301, { location: 'https://www.example.org/feed' });
    assert.equal(input, 'https://www.example.org/feed'); return response('<rss/>');
  } });
  assert.equal(result.status, 'complete'); assert.equal(calls, 2);
  await assert.rejects(runSource(probe, {}, { root, fetch: async () => response('', 302, { location: 'https://other.example/data' }) }), /unsafe/);
});

test('GDACS HTTP 204 is a successful empty result', async t => {
  const root = await temporary(t);
  const result = await runSource(sources.gdacs, { startDate: '2024-01-01', endDate: '2024-01-02' }, { root, fetch: async () => new Response(null, { status: 204 }) });
  assert.equal(result.status, 'complete'); assert.equal(result.records, 0);
});

test('GFW report accepts direct and ZIP JSON, preserving dataset version and hours', async t => {
  const root = await temporary(t);
  const report = { entries: [{ 'public-global-fishing-effort:v4': [{ date: '2024-01-01', flag: 'IND', hours: 1.5, lat: 10, lon: 76, vesselIDs: 2 }] }] };
  const zipped = zipSync({ 'report.json': strToU8(JSON.stringify(report)), 'caveats.txt': strToU8('Provider caveats') });
  assert.deepEqual(parseReport(zipped), report);
  const result = await runSource(sources['gfw-effort'], { startDate: '2024-01-01', endDate: '2024-01-02', geojson: { type: 'Polygon', coordinates: [] } }, { root, env: { GFW_API_TOKEN: 'private' }, fetch: async (_input, options) => {
    assert.equal(options.method, 'POST'); assert.ok(JSON.parse(options.body).geojson); return new Response(zipped);
  } });
  const [r] = await records(root, result); assert.equal(r.value, 1.5); assert.equal(r.unit, 'h'); assert.equal(r.datasetVersion, 'public-global-fishing-effort:v4');
});

test('GFW events and vessel registry preserve identity, event intervals and resolved datasets', async t => {
  const root = await temporary(t);
  const result = await runSource(sources.gfw, { startDate: '2024-01-01', endDate: '2024-01-02' }, { root, env: { GFW_API_TOKEN: 'private' }, fetch: async () => response({ entries: [{ id: 'event-1', type: 'fishing', start: '2024-01-01T01:00:00Z', end: '2024-01-01T02:00:00Z', vessel: { id: 'vessel-1' }, position: { lat: 10, lon: 76 } }], total: 1 }, 200, { 'x-datasets': 'resolved:v4' }) });
  const [r] = await records(root, result); assert.equal(r.datasetVersion, 'resolved:v4'); assert.equal(r.vessel.id, 'vessel-1'); assert.equal(r.observationEnd, '2024-01-01T02:00:00.000Z');
  const vessels = await runSource(sources['gfw-vessels'], { search: '123' }, { root, env: { GFW_API_TOKEN: 'private' }, fetch: async () => response({ entries: [{ id: 'vessel-1', selfReportedInfo: [{ ssvid: '123' }] }], total: 1 }) });
  assert.equal((await records(root, vessels))[0].kind, 'registry');
});

test('invalid request configuration never leaves a provider locked', async t => {
  const root = await temporary(t);
  for (const config of [{ maxResponseBytes: 0 }, { attempts: 0 }, { timeoutMs: 0 }]) {
    await assert.rejects(createContext(probe, config, { root }), /must be an integer/);
  }
  const ctx = await createContext(probe, {}, { root });
  await ctx.finish();
});

test('report POST is not resubmitted after an ambiguous network failure', async t => {
  const root = await temporary(t); let calls = 0;
  const source = { ...probe, async gather(ctx) { await ctx.request('https://example.org/report', { method: 'POST', body: { region: 'test' } }); } };
  await assert.rejects(runSource(source, { attempts: 3 }, { root, fetch: async () => { calls++; throw new Error('connection lost'); } }), /network\/timeout failure/);
  assert.equal(calls, 1);
  assert.ok(!(await readdir(path.join(root, 'data/processed/probe'))).includes('.lock'));
});

test('snapshot write failure releases lock without a second finalization masking the error', async t => {
  const root = await temporary(t);
  const { mkdir } = await import('node:fs/promises');
  const source = { ...probe, async gather(ctx) { await mkdir(path.join(ctx.processedDir, 'latest.json')); } };
  await assert.rejects(runSource(source, {}, { root }), error => error.code === 'EISDIR');
  const files = await readdir(path.join(root, 'data/processed/probe'));
  assert.ok(!files.includes('.lock'));
  assert.ok(!files.some(f => f.endsWith('.tmp')));
  const manifest = JSON.parse(await readFile(path.join(root, 'data/processed/probe', files.find(f => f.endsWith('.manifest.json')))));
  assert.equal(manifest.status, 'complete');
});
