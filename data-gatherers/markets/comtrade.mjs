import { array, number, required, url } from '../shared/core.mjs';

export default {
  id: 'comtrade', category: 'markets', access: 'Limited public preview or subscription key',
  docs: 'https://uncomtrade.org/docs/un-comtrade-api/', licenceRef: 'https://uncomtrade.org/docs/policy-on-use-and-re-dissemination/',
  validate(c) { required(c, 'period'); required(c, 'reporterCode'); required(c, 'cmdCode'); },
  async gather(ctx) {
    const c = ctx.config; const key = ctx.env.COMTRADE_API_KEY; const maxrecords = c.maxRecords ?? 500;
    const frequency = c.frequency ?? 'A';
    if (!['A', 'M'].includes(frequency)) throw new Error('Comtrade frequency must be A or M');
    const { data, raw } = await ctx.request(url(`https://comtradeapi.un.org/${key ? 'data/v1/get' : 'public/v1/preview'}/C/${frequency}/HS`, {
      period: c.period, reporterCode: c.reporterCode, cmdCode: c.cmdCode, partnerCode: c.partnerCode ?? 0,
      partner2Code: 0, flowCode: c.flowCode ?? 'M', customsCode: 'C00', motCode: 0, maxrecords, 'subscription-key': key,
    }));
    if (data.error) throw new Error('Comtrade returned an API error');
    const rows = array(data.data, 'data');
    if (!key) ctx.partial('Comtrade preview is limited; not a complete trade extract');
    else if (rows.length >= maxrecords) ctx.partial('maxRecords reached; partition query by period/reporter/commodity');
    for (const r of rows) {
      const year = Number(r.refYear); const month = frequency === 'M' ? Number(r.refMonth) : 1;
      const start = year && month ? new Date(Date.UTC(year, month - 1, 1)).toISOString() : null;
      const end = year && month ? new Date(Date.UTC(year + (frequency === 'A' ? 1 : 0), frequency === 'A' ? 0 : month, 1) - 1).toISOString() : null;
      for (const [field, metric, unit] of [['primaryValue', 'trade_value', 'USD'], ['netWgt', 'trade_net_weight', 'kg'], ['qty', 'trade_quantity', r.qtyUnitAbbr ?? null]]) ctx.emit(raw, r, {
        entityId: `${r.reporterCode}:${r.partnerCode}:${r.flowCode}:${r.cmdCode}`, metric, value: number(r[field]), unit,
        observationStart: start, observationEnd: end, kind: 'trade-aggregate',
        reporterCode: r.reporterCode, partnerCode: r.partnerCode, commodityCode: r.cmdCode, flowCode: r.flowCode,
        qualityFlags: ['aggregate-not-individual-sale', ...(r.isQtyEstimated ? ['quantity-estimated'] : []), ...(r.isNetWgtEstimated ? ['weight-estimated'] : [])],
      });
    }
  },
};
