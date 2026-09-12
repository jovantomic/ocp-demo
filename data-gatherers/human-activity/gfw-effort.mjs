import { unzipSync } from 'fflate';
import { array, credential, location, number, required, url } from '../shared/core.mjs';

export function parseReport(bytes) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return JSON.parse(bytes.toString('utf8'));
  let size = 0;
  const entries = unzipSync(bytes, { filter(entry) {
    if (!entry.name.endsWith('.json')) return false;
    size += entry.originalSize;
    if (size > 25000000) throw new Error('GFW report expanded JSON exceeds 25 MB');
    return true;
  } });
  for (const data of Object.values(entries)) {
    const parsed = JSON.parse(Buffer.from(data).toString('utf8'));
    if (Array.isArray(parsed.entries)) return parsed;
  }
  throw new Error('No recognizable JSON report in GFW ZIP');
}
export default {
  id: 'gfw-effort', category: 'human-activity', access: 'Token; non-commercial regional fishing-hours report',
  docs: 'https://globalfishingwatch.org/our-apis/documentation/docs/v3/4wings/report',
  licenceRef: 'https://globalfishingwatch.org/our-apis/documentation/docs/terms-of-use',
  validate(c, env) { credential(env, 'GFW_API_TOKEN'); required(c, 'startDate'); required(c, 'endDate'); required(c, 'geojson'); },
  async gather(ctx) {
    const c = ctx.config;
    const { data, raw } = await ctx.request(url('https://gateway.api.globalfishingwatch.org/v3/4wings/report', {
      format: 'JSON', 'datasets[0]': 'public-global-fishing-effort:latest', 'date-range': `${c.startDate},${c.endDate}`,
      'spatial-resolution': 'LOW', 'spatial-aggregation': false, 'temporal-resolution': 'DAILY', 'group-by': 'FLAG',
    }), { method: 'POST', format: 'buffer', headers: { Authorization: `Bearer ${ctx.env.GFW_API_TOKEN}`, 'Content-Type': 'application/json' }, body: { geojson: c.geojson } });
    const report = parseReport(data);
    for (const entry of array(report.entries, 'report.entries')) {
      const groups = 'hours' in entry ? [[raw.datasetHeader, [entry]]] : Object.entries(entry);
      for (const [dataset, rows] of groups) for (const r of array(rows, 'report dataset rows')) ctx.emit(raw, r, {
        entityId: `${r.flag ?? ''}:${r.lat}:${r.lon}`, metric: 'apparent_fishing_hours', value: number(r.hours), unit: 'h', kind: 'inferred-activity',
        observationStart: r.date, observationEnd: /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? `${r.date}T23:59:59.999Z` : r.date,
        datasetVersion: dataset, location: location(r.lat, r.lon), flag: r.flag ?? null, vesselCount: number(r.vesselIDs),
        qualityFlags: ['inferred-from-tracking-not-measured-catch'],
      });
    }
  },
};
