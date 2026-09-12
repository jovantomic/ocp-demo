import { array, number, location, required } from '../shared/core.mjs';

export default {
  id: 'erddap', category: 'ocean', access: 'Public, dataset-specific',
  docs: 'https://coastwatch.noaa.gov/erddap/rest.html', licenceRef: 'https://coastwatch.noaa.gov/erddap/legal.html',
  validate(c) { required(c, 'datasetId'); required(c, 'query'); required(c, 'licenceRef'); array(required(c, 'variables'), 'variables'); },
  async gather(ctx) {
    const c = ctx.config;
    const server = new URL(c.server ?? 'https://coastwatch.noaa.gov/erddap/');
    if (server.protocol !== 'https:') throw new Error('ERDDAP requires HTTPS');
    const mode = c.mode ?? 'tabledap';
    if (!['tabledap', 'griddap'].includes(mode)) throw new Error('mode must be tabledap or griddap');
    const endpoint = new URL(`${mode}/${encodeURIComponent(c.datasetId)}.json`, server.href.endsWith('/') ? server : server.href + '/');
    endpoint.search = c.query;
    const { data, raw } = await ctx.request(endpoint.href);
    const table = data.table;
    const names = array(table?.columnNames, 'columnNames');
    const rows = array(table.rows, 'rows');
    for (const metric of c.variables) if (!names.includes(metric)) throw new Error(`Missing ERDDAP column: ${metric}`);
    for (const row of rows) {
      const record = Object.fromEntries(names.map((name, i) => [name, row[i]]));
      for (const metric of c.variables) ctx.emit(raw, record, {
        datasetVersion: c.datasetVersion ?? null, entityId: `${c.datasetId}:${record[c.idColumn ?? 'station'] ?? `${record.latitude},${record.longitude},${record.depth ?? ''}`}`,
        metric, value: number(record[metric]), unit: table.columnUnits?.[names.indexOf(metric)] ?? null,
        observationStart: record[c.timeColumn ?? 'time'], observationEnd: record[c.timeColumn ?? 'time'],
        kind: c.kind ?? 'observation', issueTime: c.issueTime ?? null,
        location: location(record[c.latitudeColumn ?? 'latitude'], record[c.longitudeColumn ?? 'longitude']),
        depth: record.depth ?? null, licenceRef: c.licenceRef,
        qualityFlags: c.qualityFlags ?? [],
      });
    }
  },
};
