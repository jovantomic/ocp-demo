import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { sources } from '../data-gatherers/index.mjs';
import { runSource, positive } from '../data-gatherers/shared/core.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  source: { type: 'string' }, config: { type: 'string' }, all: { type: 'boolean' }, list: { type: 'boolean' },
  'dry-run': { type: 'boolean' }, help: { type: 'boolean' },
} });
if (values.help || (!values.source && !values.all && !values.list)) {
  console.log('Usage: npm run gather -- --list | --source NAME[,NAME] | --all [--config FILE] [--dry-run]\n--all runs enabled sources. --source explicitly selects even a disabled source. Dates {startDate}/{endDate} resolve to UTC last seven days/today.');
} else if (values.list) {
  for (const source of Object.values(sources)) console.log(`${source.id.padEnd(17)} ${source.category.padEnd(15)} ${source.access}`);
} else {
  try {
    if (values.all && values.source) throw new Error('Choose --all or --source, not both');
    const file = values.config ? path.resolve(values.config) : path.join(root, 'config/gatherers.json');
    const original = await readFile(file, 'utf8');
    const end = new Date(); const start = new Date(end.valueOf() - 7 * 86400000);
    const config = JSON.parse(original.replaceAll('{startDate}', start.toISOString().slice(0, 10)).replaceAll('{endDate}', end.toISOString().slice(0, 10)));
    const ids = values.source ? [...new Set(values.source.split(',').map(s => s.trim()))] : Object.keys(config.sources).filter(id => config.sources[id].enabled);
    if (!ids.length) throw new Error('No sources selected');
    // Validate the selection before any network work or disk output.
    for (const id of ids) if (!sources[id] || !config.sources[id]) throw new Error(`Unknown or unconfigured source: ${id}`);
    let failures = 0;
    for (const id of ids) {
      const settings = { ...(config.defaults ?? {}), ...config.sources[id] };
      try {
        for (const name of ['maxPages', 'pageSize', 'maxRecords', 'workerTimeoutSeconds']) if (settings[name] !== undefined) positive(settings[name], name);
        if (values['dry-run']) {
          console.log(`${id}: ${sources[id].access}; configuration selected; no requests made`);
          continue;
        }
        console.log(`${id}: gathering…`);
        const result = await runSource(sources[id], settings, { root });
        console.log(`${id}: ${result.status}; ${result.records} records → ${result.output}`);
        for (const warning of result.warnings) console.log(`  ${warning}`);
      } catch (error) { failures++; console.error(`${id}: FAILED — ${error.message}`); }
    }
    if (failures) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
