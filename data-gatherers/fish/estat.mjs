import { array, credential, number, required, url } from '../shared/core.mjs';

export default {
  id: 'estat', category: 'fish', access: 'Free registered app ID',
  docs: 'https://www.e-stat.go.jp/api/en', licenceRef: 'https://www.e-stat.go.jp/en/terms-of-use',
  validate(c, env) { required(c, 'statsDataId'); credential(env, 'ESTAT_APP_ID'); },
  async gather(ctx) {
    const c = ctx.config; const maxPages = c.maxPages ?? 2; const limit = c.pageSize ?? 1000; let position = 1;
    for (let page = 0; page < maxPages; page++) {
      const { data, raw } = await ctx.request(url('https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData', { ...(c.query ?? {}), appId: ctx.env.ESTAT_APP_ID, statsDataId: c.statsDataId, lang: 'E', startPosition: position, limit }));
      const result = data.GET_STATS_DATA;
      if (Number(result?.RESULT?.STATUS) !== 0) throw new Error('e-Stat rejected the query; verify statsDataId and app ID');
      const values = result.STATISTICAL_DATA?.DATA_INF?.VALUE;
      for (const r of values ? (Array.isArray(values) ? values : [values]) : []) ctx.emit(raw, r, {
        entityId: `${c.statsDataId}:${r['@area'] ?? ''}:${r['@cat01'] ?? ''}:${r['@tab'] ?? ''}`,
        metric: c.metric ?? 'statistical_value', value: number(r.$), unit: r['@unit'] ?? null,
        observationStart: c.timeMapping?.[r['@time']]?.start ?? null,
        observationEnd: c.timeMapping?.[r['@time']]?.end ?? null,
        kind: 'statistical-aggregate', dimensions: Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith('@'))),
        qualityFlags: ['aggregate-not-individual-sale', 'estat-time-code-retained'],
      });
      const next = Number(result.STATISTICAL_DATA?.RESULT_INF?.NEXT_KEY);
      if (!next) return;
      if (next <= position) throw new Error('e-Stat pagination did not advance');
      position = next;
      if (page === maxPages - 1) ctx.partial('maxPages reached; e-Stat selection incomplete');
    }
  },
};
