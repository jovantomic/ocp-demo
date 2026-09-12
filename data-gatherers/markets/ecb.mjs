import { parse } from 'csv-parse/sync';
import { number, required, url } from '../shared/core.mjs';

export default {
  id: 'ecb', category: 'markets', access: 'Public, no key',
  docs: 'https://data.ecb.europa.eu/help/api/data-examples', licenceRef: 'https://www.ecb.europa.eu/services/disclaimer/html/index.en.html',
  validate(c) { required(c, 'startDate'); required(c, 'endDate'); },
  async gather(ctx) {
    const c = ctx.config;
    const currencies = c.currencies ?? ['USD', 'INR', 'JPY', 'THB', 'SGD', 'CNY'];
    if (!currencies.length || currencies.some(s => !/^[A-Z]{3}$/.test(s))) throw new Error('Invalid ECB currency codes');
    const { data, raw } = await ctx.request(url(`https://data-api.ecb.europa.eu/service/data/EXR/D.${currencies.join('+')}.EUR.SP00.A`, { startPeriod: c.startDate, endPeriod: c.endDate, format: 'csvdata' }), { format: 'text', headers: { Accept: 'text/csv' } });
    const rows = parse(data, { columns: true, bom: true, skip_empty_lines: true });
    if (rows.length && !('OBS_VALUE' in rows[0])) throw new Error('Unexpected ECB CSV schema');
    for (const r of rows) ctx.emit(raw, r, {
      entityId: `EUR${r.CURRENCY}`, metric: 'fx_reference_rate', value: number(r.OBS_VALUE), unit: `${r.CURRENCY}/EUR`, kind: 'reference-rate',
      observationStart: r.TIME_PERIOD, observationEnd: r.TIME_PERIOD, providerPublishedAt: null,
      qualityFlags: ['daily-reference-not-executable', ...(r.OBS_STATUS ? [`provider-status:${r.OBS_STATUS}`] : [])],
    });
  },
};
