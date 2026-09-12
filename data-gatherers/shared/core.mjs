import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function required(config, key) {
  if (config[key] === undefined || config[key] === null || config[key] === '') throw new Error(`Missing configuration: ${key}`);
  return config[key];
}
export function positive(value, name, maximum = 1000000) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  return value;
}
export function credential(env, key) {
  if (!env[key]) throw new Error(`Set ${key} in the environment`);
  return env[key];
}
export function url(base, params = {}) {
  const result = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach(v => result.searchParams.append(key, v));
    else result.searchParams.set(key, value);
  }
  return result.toString();
}
export function redactUrl(input) {
  const parsed = new URL(input);
  parsed.username = ''; parsed.password = '';
  for (const key of [...parsed.searchParams.keys()]) {
    if (/key|token|password|secret|appid/i.test(key)) parsed.searchParams.set(key, '[REDACTED]');
  }
  return parsed.toString();
}
export function timestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
export function location(lat, lon) {
  lat = number(lat); lon = number(lon);
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
export function array(value, label) {
  if (!Array.isArray(value)) throw new Error(`Unexpected provider schema: ${label} must be an array`);
  return value;
}
export async function atomicJson(file, data) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(data, null, 2) + '\n');
    await rename(temp, file);
  } finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
}

/** One persisted run per provider; same-provider runs are locked across processes. */
export async function createContext(source, config, options = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(source.id)) throw new Error('Invalid source ID');
  const maxBytes = positive(config.maxResponseBytes ?? 25000000, 'maxResponseBytes', 500000000);
  const timeoutMs = positive(config.timeoutMs ?? 30000, 'timeoutMs', 300000);
  const configuredAttempts = positive(config.attempts ?? 3, 'attempts', 5);
  const root = path.resolve(options.root ?? '.');
  const rawDir = path.join(root, 'data/raw', source.id);
  const processedDir = path.join(root, 'data/processed', source.id);
  await mkdir(rawDir, { recursive: true }); await mkdir(processedDir, { recursive: true });
  const lockPath = path.join(processedDir, '.lock');
  const lock = await open(lockPath, 'wx').catch(e => { if (e.code !== 'EEXIST') throw e; throw new Error(`${source.id} already running; inspect ${lockPath} if a prior process crashed`); });
  const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
  const seenPath = path.join(processedDir, 'first-seen.json');
  let seen;
  try { seen = JSON.parse(await readFile(seenPath, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') { await lock.close(); await unlink(lockPath); throw e; } seen = {}; }
  const records = new Map(); const responses = [];
  const warnings = new Set();
  let partial = false;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const wait = options.sleep ?? sleep;
  const manifest = { runId, sourceId: source.id, startedAt: new Date().toISOString(), status: 'running', responses, warnings: [], records: 0 };
  try { await atomicJson(path.join(processedDir, `${runId}.manifest.json`), manifest); }
  catch (error) { await lock.close(); await unlink(lockPath); throw error; }
  const ctx = {
    source, config, env: options.env ?? process.env, root, runId, rawDir, processedDir,
    warn(message) { warnings.add(message); },
    partial(message) { partial = true; warnings.add(message); },
    async raw(bytes, meta = {}, extension = 'json') {
      const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      const rawHash = hash(buffer);
      const filename = `${rawHash}.${extension.replace(/[^a-z0-9]/gi, '')}`;
      await writeFile(path.join(rawDir, filename), buffer, { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
      const result = { rawHash, rawFile: path.relative(root, path.join(rawDir, filename)), retrievedAt: new Date().toISOString(), ...meta };
      responses.push(result);
      return result;
    },
    async request(input, { headers = {}, method = 'GET', body, format = 'json' } = {}) {
      const safeUrl = redactUrl(input);
      // A timed-out report submission may already have succeeded at the provider.
      const attempts = ['GET', 'HEAD'].includes(method) ? configuredAttempts : 1;
      for (let attempt = 0; attempt < attempts; attempt++) {
        let response, bytes;
        try {
          let target = input;
          const signal = AbortSignal.timeout(timeoutMs);
          for (let redirects = 0; ; redirects++) {
            response = await fetchImpl(target, { method, headers: { Accept: 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal, redirect: 'manual' });
            if (![301, 302, 303, 307, 308].includes(response.status)) break;
            const destination = response.headers.get('location');
            if (!destination || redirects >= 5 || method !== 'GET') throw new Error('unsafe-redirect');
            const next = new URL(destination, target);
            const authenticated = Object.keys(headers).some(k => /authorization|key|token/i.test(k)) || [...new URL(input).searchParams.keys()].some(k => /appid|key|token|password|secret/i.test(k));
            if (next.protocol !== 'https:' || (authenticated && next.origin !== new URL(input).origin)) throw new Error('unsafe-redirect');
            await response.body?.cancel();
            target = next.href;
          }
          const chunks = []; let size = 0;
          for await (const chunk of response.body ?? []) {
            size += chunk.length;
            if (size > maxBytes) throw new Error('response-too-large');
            chunks.push(chunk);
          }
          bytes = Buffer.concat(chunks);
        } catch (e) {
          if (e.message === 'response-too-large') throw new Error(`${source.id}: response exceeds maxResponseBytes`);
          if (e.message === 'unsafe-redirect') throw new Error(`${source.id}: unsafe or excessive HTTP redirects`);
          if (attempt + 1 === attempts) throw new Error(`${source.id}: network/timeout failure (${new URL(input).host})`);
          await wait(500 * 2 ** attempt); continue;
        }
        const raw = await ctx.raw(bytes, { url: safeUrl, finalUrl: response.url ? redactUrl(response.url) : safeUrl, method, status: response.status, datasetHeader: response.headers.get('x-datasets') }, format === 'json' ? 'json' : format === 'buffer' ? 'bin' : 'txt');
        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) {
            const retry = response.headers.get('retry-after');
            const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 500 * 2 ** attempt;
            if (delay > 60000) throw new Error(`${source.id}: HTTP ${response.status}; provider requests retry after more than 60 seconds`);
            await wait(Math.max(0, Number.isFinite(delay) ? delay : 1000)); continue;
          }
          throw new Error(`${source.id}: HTTP ${response.status} (${new URL(input).host}); raw response saved`);
        }
        let data;
        try { data = response.status === 204 ? null : format === 'json' ? JSON.parse(bytes.toString('utf8')) : format === 'buffer' ? bytes : bytes.toString('utf8'); }
        catch { throw new Error(`${source.id}: invalid JSON; raw response saved`); }
        return { data, raw };
      }
    },
    emit(raw, original, fields) {
      const start = timestamp(fields.observationStart);
      const end = timestamp(fields.observationEnd ?? fields.observationStart);
      const flags = new Set(fields.qualityFlags ?? []);
      if (!start) flags.add('observation-time-unknown');
      if (fields.observationStart && !start) flags.add('invalid-observation-time');
      const publication = timestamp(fields.providerPublishedAt);
      if (!publication) flags.add('publication-time-unknown');
      if (fields.kind === 'forecast' && !timestamp(fields.issueTime)) flags.add('forecast-issue-time-unknown');
      const rawRecordHash = hash(original);
      const id = hash([source.id, fields.datasetVersion ?? config.datasetVersion ?? null, fields.entityId, fields.metric, start, end, rawRecordHash]);
      seen[id] ??= raw.retrievedAt;
      const record = {
        ...fields, id, sourceId: source.id, synthetic: false,
        datasetVersion: fields.datasetVersion ?? config.datasetVersion ?? null,
        entityId: String(fields.entityId ?? rawRecordHash),
        observationStart: start, observationEnd: end,
        providerPublishedAt: publication, firstSeenAt: seen[id], retrievedAt: raw.retrievedAt,
        issueTime: fields.kind === 'forecast' ? timestamp(fields.issueTime) : null,
        validTime: fields.kind === 'forecast' ? timestamp(fields.validTime ?? fields.observationStart) : null,
        value: fields.value ?? null, unit: fields.unit ?? null,
        qualityFlags: [...flags], licenceRef: fields.licenceRef ?? source.licenceRef,
        rawRecordHash, rawResponseHash: raw.rawHash, rawFile: raw.rawFile,
      };
      if (record.value === null) record.qualityFlags.push('missing-value');
      records.set(id, record);
    },
    async finish(error) {
      try {
        const file = `${runId}.jsonl`;
        await writeFile(path.join(processedDir, file), [...records.values()].map(r => JSON.stringify(r) + '\n').join(''));
        await atomicJson(seenPath, seen);
        Object.assign(manifest, { finishedAt: new Date().toISOString(), status: error ? 'failed' : partial ? 'partial' : 'complete', records: records.size, warnings: [...warnings], output: path.relative(root, path.join(processedDir, file)), ...(error ? { error: error.message } : {}) });
        await atomicJson(path.join(processedDir, `${runId}.manifest.json`), manifest);
        if (!error) await atomicJson(path.join(processedDir, 'latest.json'), manifest);
        return manifest;
      } finally {
        await lock.close(); await unlink(lockPath);
      }
    },
  };
  return ctx;
}

export async function runSource(source, config, options) {
  source.validate?.(config, options?.env ?? process.env);
  const ctx = await createContext(source, config, options);
  try { await source.gather(ctx); }
  catch (error) { await ctx.finish(error); throw error; }
  return await ctx.finish();
}
