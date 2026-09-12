import { array, location, required, url } from '../shared/core.mjs';

export default {
  id: 'gdacs', category: 'human-activity', access: 'Public API',
  docs: 'https://www.gdacs.org/gdacsapi/swagger/index.html', licenceRef: 'https://www.gdacs.org/About/termofuse.aspx',
  validate(c) { required(c, 'startDate'); required(c, 'endDate'); },
  async gather(ctx) {
    const c = ctx.config; const maxPages = c.maxPages ?? 2; const pageSize = c.pageSize ?? 100;
    for (let page = 1; page <= maxPages; page++) {
      const { data, raw } = await ctx.request(url('https://www.gdacs.org/gdacsapi/api/Events/geteventlist/search', {
        ...(c.query ?? {}), fromDate: c.startDate, toDate: c.endDate, eventlist: c.eventTypes ?? 'TC;FL;EQ;TS;VO;DR;WF', pageNumber: page, pageSize,
      }));
      if (data === null) return;
      const rows = array(data.features, 'features');
      for (const feature of rows) {
        const p = feature.properties ?? {};
        ctx.emit(raw, feature, {
          entityId: `${p.eventtype}:${p.eventid}:${p.episodeid ?? ''}`, metric: 'disaster_alert', value: p.alertlevel ?? null, unit: 'alert-level', kind: 'event',
          observationStart: p.fromdate, observationEnd: p.todate,
          providerPublishedAt: p.datemodified ?? null,
          location: feature.geometry?.type === 'Point' ? location(feature.geometry.coordinates[1], feature.geometry.coordinates[0]) : null,
          eventType: p.eventtype, title: p.name ?? p.description ?? null, country: p.country ?? null,
          severity: p.severitydata ?? null, link: p.url?.report ?? null,
        });
      }
      if (rows.length < pageSize) return;
      if (page === maxPages) ctx.partial('GDACS page budget reached; no complete-history guarantee');
    }
  },
};
