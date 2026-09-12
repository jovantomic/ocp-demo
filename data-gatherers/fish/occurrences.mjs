import { array, location, number, positive, url } from '../shared/core.mjs';

export function occurrenceSource(id) {
  const obis = id === 'obis';
  return {
    id, category: 'fish', access: 'Public API; sequential bounded downloads',
    docs: obis ? 'https://obis.org/data/access/' : 'https://techdocs.gbif.org/en/openapi/v1/occurrence',
    licenceRef: obis ? 'https://manual.obis.org/policy.html' : 'https://www.gbif.org/terms',
    validate(c) { positive(c.pageSize ?? 100, 'pageSize', obis ? 1000 : 300); positive(c.maxPages ?? 2, 'maxPages', 100); },
    async gather(ctx) {
      const c = ctx.config; const pageSize = c.pageSize ?? 100; const maxPages = c.maxPages ?? 2;
      let after;
      for (let page = 0; page < maxPages; page++) {
        const { data, raw } = await ctx.request(url(obis ? 'https://api.obis.org/v3/occurrence' : 'https://api.gbif.org/v1/occurrence/search', {
          ...(c.query ?? {}), ...(obis ? { size: pageSize, after } : { limit: pageSize, offset: page * pageSize }),
        }));
        const rows = array(data.results, 'results');
        for (const r of rows) {
          const date = r.eventDate ?? r.date_start;
          const dates = typeof date === 'string' ? date.split('/') : [];
          ctx.emit(raw, r, {
            entityId: r.id ?? r.key ?? r.occurrenceID, metric: 'species_occurrence', value: r.occurrenceStatus ?? 'PRESENT', unit: 'occurrence-status', kind: 'occurrence',
            observationStart: dates[0], observationEnd: dates[1] ?? dates[0], location: location(r.decimalLatitude, r.decimalLongitude),
            scientificName: r.scientificName ?? null, taxonId: r.taxonID ?? r.taxonKey ?? null,
            individualCount: number(r.individualCount), datasetId: r.dataset_id ?? r.datasetKey ?? null,
            licenceRef: r.license ?? ctx.source.licenceRef, qualityFlags: ['not-a-stock-estimate', ...(r.issues ?? [])],
          });
        }
        if (!rows.length || rows.length < pageSize || data.endOfRecords === true) return;
        if (obis) {
          const next = rows.at(-1)?.id;
          if (!next || next === after) throw new Error('OBIS pagination cursor missing or repeated');
          after = next;
        }
        if (page === maxPages - 1) ctx.partial('maxPages reached; occurrence selection may be incomplete');
      }
    },
  };
}
