import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { array, hash, required } from '../shared/core.mjs';

const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = value => String(typeof value === 'object' ? value?.['#text'] ?? '' : value ?? '').replace(/<[^>]*>/g, '').trim();
export function parseFeed(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('RSS DTD/entities are not supported');
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid RSS/Atom XML');
  const tree = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true }).parse(xml);
  if (!tree.rss?.channel && !tree.feed && !tree['rdf:RDF']) throw new Error('Response is not an RSS or Atom feed');
  const entries = list(tree.rss?.channel?.item ?? tree.feed?.entry ?? tree['rdf:RDF']?.item);
  return entries.map(r => {
    const links = list(r.link);
    const link = links.find(l => typeof l === 'string') ?? links.find(l => !l['@_rel'] || l['@_rel'] === 'alternate');
    let href = typeof link === 'string' ? link : link?.['@_href'];
    if (href && !/^https?:\/\//i.test(href)) href = null;
    return { original: r, title: text(r.title), link: href ?? null,
      guid: text(r.guid ?? r.id) || href || hash(r),
      publishedAt: text(r.pubDate ?? r.published ?? r['dc:date']) || null,
      updatedAt: text(r.updated) || null,
      categories: list(r.category).map(v => typeof v === 'object' ? v['@_term'] ?? text(v) : text(v)),
      summaryForMatching: text(r.description ?? r.summary),
    };
  });
}

export default {
  id: 'india-news', category: 'news', access: 'Public RSS/Atom; publisher-specific reuse terms',
  docs: 'https://indianexpress.com/rss/', licenceRef: 'Publisher terms stored per feed',
  validate(c) {
    for (const f of array(required(c, 'feeds'), 'feeds')) { required(f, 'name'); required(f, 'url'); required(f, 'licenceRef'); if (new URL(f.url).protocol !== 'https:') throw new Error('News feeds require HTTPS'); }
    if (!c.feeds.some(f => f.enabled !== false)) throw new Error('No enabled news feeds');
  },
  async gather(ctx) {
    let succeeded = 0;
    for (const feed of ctx.config.feeds.filter(f => f.enabled !== false)) {
      try {
        const { data, raw } = await ctx.request(feed.url, { format: 'text', headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
        for (const r of parseFeed(data)) {
          const searchable = `${r.title} ${r.summaryForMatching} ${r.categories.join(' ')}`.toLowerCase();
          const topics = Object.entries(ctx.config.topics ?? {}).filter(([, words]) => words.some(word => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(searchable))).map(([topic]) => topic);
          if (ctx.config.onlyRelevant !== false && Object.keys(ctx.config.topics ?? {}).length && !topics.length) continue;
          ctx.emit(raw, r.original, {
            entityId: `${feed.name}:${r.guid}`, metric: 'news_headline', value: r.title, unit: 'headline', kind: 'news',
            // Publication is not the time of the event reported in the story.
            observationStart: null, observationEnd: null, providerPublishedAt: r.publishedAt,
            publisher: feed.name, link: r.link, topics, categories: r.categories, updatedAt: r.updatedAt,
            licenceRef: feed.licenceRef, qualityFlags: ['publisher-report-not-verified-event', 'event-time-not-extracted', ...(feed.restrictions ?? [])],
          });
        }
        succeeded++;
      } catch { ctx.partial(`Feed failed: ${feed.name}; inspect raw response or retry this feed`); }
    }
    if (!succeeded) throw new Error('All enabled news feeds failed');
  },
};
