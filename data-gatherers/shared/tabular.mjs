import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { array, location, number, required } from './core.mjs';

/** Explicit mapped exports; no guessed provider endpoints or statistical column meanings. */
export function tabularSource(id, docs) {
  return {
    id, category: 'imports', access: 'Mapped CSV/JSON export (local file or configured HTTPS download)', docs, licenceRef: docs,
    validate(c) {
      if (!!c.file === !!c.downloadUrl) throw new Error('Set exactly one of file or downloadUrl');
      required(c, 'licenceRef'); required(c, 'datasetId'); required(c, 'mapping');
      required(c.mapping, 'entityId'); required(c.mapping, 'time'); required(c.mapping, 'metrics');
    },
    async gather(ctx) {
      const c = ctx.config; const format = c.format ?? 'csv';
      if (!['csv', 'json'].includes(format)) throw new Error('Tabular import format must be csv or json');
      let text, raw;
      if (c.file) {
        const file = path.resolve(ctx.root, c.file); const bytes = await readFile(file);
        raw = await ctx.raw(bytes, { origin: 'user-supplied-export', originalFilename: path.basename(file) }, format);
        text = bytes.toString('utf8');
      } else {
        if (new URL(c.downloadUrl).protocol !== 'https:') throw new Error('Download requires HTTPS');
        const response = await ctx.request(c.downloadUrl, { format: 'text' }); text = response.data; raw = response.raw;
      }
      let rows = format === 'csv' ? parse(text, { columns: true, bom: true, skip_empty_lines: true, delimiter: c.delimiter ?? ',' }) : JSON.parse(text);
      if (c.rowsKey) rows = rows[c.rowsKey];
      array(rows, 'tabular rows');
      const m = c.mapping;
      const columns = [m.entityId, m.time, ...m.metrics.map(metric => metric.column)];
      for (const row of rows) {
        for (const column of columns) if (!(column in row)) throw new Error(`Missing mapped column: ${column}`);
        const period = String(row[m.time]);
        let start = row[m.time], end = m.endTime ? row[m.endTime] : start;
        if (c.timeFormat === 'year') { if (!/^\d{4}$/.test(period)) throw new Error('Invalid year'); start = `${period}-01-01T00:00:00Z`; end = `${period}-12-31T23:59:59.999Z`; }
        else if (c.timeFormat === 'month') {
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid month');
          start = `${period}-01T00:00:00Z`; end = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 1) - 1).toISOString();
        }
        for (const metric of m.metrics) ctx.emit(raw, row, {
          entityId: `${c.datasetId}:${row[m.entityId]}`, metric: metric.name, value: number(row[metric.column]), unit: metric.unit ?? (metric.unitColumn ? row[metric.unitColumn] : null),
          observationStart: start, observationEnd: end, providerPublishedAt: m.publishedAt ? row[m.publishedAt] : null,
          kind: c.kind ?? 'statistical-aggregate', licenceRef: c.licenceRef,
          location: m.latitude && m.longitude ? location(row[m.latitude], row[m.longitude]) : null,
          qualityFlags: ['mapped-export', ...(c.qualityFlags ?? [])],
        });
      }
    },
  };
}
