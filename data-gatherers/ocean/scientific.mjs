import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { createReadStream, existsSync } from 'node:fs';
import { credential, required, positive } from '../shared/core.mjs';

const worker = fileURLToPath(new URL('./scientific.py', import.meta.url));
const definitions = {
  copernicus: { docs: 'https://toolbox-docs.marine.copernicus.eu/en/stable/python-interface.html', keys: ['COPERNICUSMARINE_SERVICE_USERNAME', 'COPERNICUSMARINE_SERVICE_PASSWORD'], fields: ['datasetId', 'subset', 'variables'] },
  era5: { docs: 'https://cds.climate.copernicus.eu/en/how-to-api', keys: ['CDSAPI_KEY'], fields: ['datasetId', 'request', 'variables'] },
  argo: { docs: 'https://argopy.readthedocs.io/en/latest/', keys: [], fields: ['region', 'variables'] },
  'nasa-ocean': { docs: 'https://earthaccess.readthedocs.io/en/latest/user/explanation/search/', keys: ['EARTHDATA_USERNAME', 'EARTHDATA_PASSWORD'], fields: ['shortName', 'startDate', 'endDate', 'variables'] },
};
export function scientificSource(id) {
  const def = definitions[id];
  return {
    id, category: 'ocean', access: 'Optional Python SDK; configured dataset/subset', docs: def.docs, licenceRef: def.docs,
    validate(c, env) {
      def.keys.forEach(key => credential(env, key)); def.fields.forEach(key => required(c, key));
      required(c, 'licenceRef'); positive(c.maxObservations ?? 10000, 'maxObservations', 1000000);
    },
    async gather(ctx) {
      const staging = path.join(ctx.rawDir, ctx.runId);
      await mkdir(staging);
      await new Promise((resolve, reject) => {
        const localPython = path.join(ctx.root, '.venv-gatherers/bin/python');
        const child = spawn(ctx.env.OCP_PYTHON || (existsSync(localPython) ? localPython : 'python3'), [worker, id, staging], { env: ctx.env, stdio: ['pipe', 'ignore', 'pipe'] });
        let errorText = ''; let timedOut = false;
        child.stderr.on('data', chunk => { errorText = (errorText + chunk).slice(-2000); });
        const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, (ctx.config.workerTimeoutSeconds ?? 300) * 1000);
        child.on('error', () => { clearTimeout(timer); reject(new Error('Cannot start Python; set OCP_PYTHON to the gatherer virtualenv interpreter')); });
        child.on('close', code => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else if (/OCP_MISSING_DEPENDENCY/.test(errorText)) reject(new Error('Install data-gatherers/requirements.txt in a virtualenv and set OCP_PYTHON'));
          else reject(new Error(timedOut ? 'Scientific gatherer timed out' : 'Scientific SDK failed; verify credentials, dataset, variables and subset; partial files retained'));
        });
        child.stdin.on('error', () => {});
        child.stdin.end(JSON.stringify(ctx.config));
      });
      const manifest = JSON.parse(await readFile(path.join(staging, 'result.json'), 'utf8'));
      const files = new Map();
      for (const entry of manifest.files) {
        const bytes = await readFile(entry.path);
        const raw = await ctx.raw(bytes, { origin: entry.origin, datasetId: ctx.config.datasetId ?? ctx.config.shortName ?? 'argo', retrievedAt: entry.retrievedAt }, 'nc');
        files.set(entry.path, raw);
      }
      const lines = createInterface({ input: createReadStream(path.join(staging, 'observations.jsonl')), crlfDelay: Infinity });
      for await (const line of lines) {
        const r = JSON.parse(line);
        ctx.emit(files.get(r.file), r.original, { ...r.fields, licenceRef: ctx.config.licenceRef });
      }
      if (manifest.partial) ctx.partial('Scientific subset exceeded configured observation/granule cap');
      manifest.warnings.forEach(w => ctx.warn(w));
    },
  };
}
