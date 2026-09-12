import { array, credential, required, url } from '../shared/core.mjs';

export default {
  id: 'gfw-vessels', category: 'human-activity', access: 'Token; non-commercial API',
  docs: 'https://globalfishingwatch.org/our-apis/documentation/docs/v3/vessels/search',
  licenceRef: 'https://globalfishingwatch.org/our-apis/documentation/docs/terms-of-use',
  validate(c, env) { credential(env, 'GFW_API_TOKEN'); required(c, 'search'); },
  async gather(ctx) {
    const c = ctx.config; const limit = c.pageSize ?? 50;
    for (let page = 0; page < (c.maxPages ?? 2); page++) {
      const { data, raw } = await ctx.request(url('https://gateway.api.globalfishingwatch.org/v3/vessels/search', {
        query: c.search, 'datasets[0]': 'public-global-vessel-identity:latest', limit, offset: page * limit,
      }), { headers: { Authorization: `Bearer ${ctx.env.GFW_API_TOKEN}` } });
      const rows = array(data.entries, 'entries');
      for (const r of rows) ctx.emit(raw, r, { entityId: r.id, metric: 'vessel_identity', value: r, unit: 'registry-record', kind: 'registry', datasetVersion: raw.datasetHeader ?? r.dataset ?? null });
      if (rows.length < limit || (page + 1) * limit >= data.total) return;
      if (page + 1 === (c.maxPages ?? 2)) ctx.partial('GFW vessel page limit reached');
    }
  },
};
