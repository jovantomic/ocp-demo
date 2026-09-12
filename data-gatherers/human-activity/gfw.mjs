import { array, credential, location, required, url } from '../shared/core.mjs';

export default {
  id: 'gfw', category: 'human-activity', access: 'Token; non-commercial API',
  docs: 'https://globalfishingwatch.org/our-apis/documentation/docs/v3/events/get-all-events',
  licenceRef: 'https://globalfishingwatch.org/our-apis/documentation/docs/terms-of-use',
  validate(c, env) { credential(env, 'GFW_API_TOKEN'); required(c, 'startDate'); required(c, 'endDate'); },
  async gather(ctx) {
    const c = ctx.config; const limit = c.pageSize ?? 100; const maxPages = c.maxPages ?? 2; let offset = 0;
    const datasets = c.datasets ?? ['public-global-fishing-events:latest'];
    for (let page = 0; page < maxPages; page++) {
      const { data, raw } = await ctx.request(url('https://gateway.api.globalfishingwatch.org/v3/events', {
        ...(c.query ?? {}), datasets, 'start-date': c.startDate, 'end-date': c.endDate, limit, offset,
      }), { headers: { Authorization: `Bearer ${ctx.env.GFW_API_TOKEN}` } });
      const rows = array(data.entries, 'entries');
      for (const r of rows) ctx.emit(raw, r, {
        entityId: r.id, metric: 'vessel_event', value: r.type, unit: 'event-type', kind: 'inferred-event',
        observationStart: r.start, observationEnd: r.end, vessel: r.vessel ?? null,
        location: location(r.position?.lat, r.position?.lon),
        datasetVersion: raw.datasetHeader ?? null, datasetsRequested: datasets,
        qualityFlags: ['inferred-from-tracking-not-measured-catch'],
      });
      if (!rows.length || rows.length < limit || offset + rows.length >= data.total) return;
      const next = data.nextOffset ?? offset + rows.length;
      if (next <= offset) throw new Error('GFW pagination did not advance');
      offset = next;
      if (page === maxPages - 1) ctx.partial('maxPages reached; GFW selection incomplete');
    }
  },
};
