import WebSocket from 'ws';
import { array, credential, location, number, positive, required } from '../shared/core.mjs';

export default {
  id: 'aisstream', category: 'human-activity', access: 'API key; bounded WebSocket capture',
  docs: 'https://aisstream.io/documentation', licenceRef: 'https://aisstream.io/terms-of-service',
  validate(c, env) {
    credential(env, 'AISSTREAM_API_KEY');
    for (const box of array(required(c, 'boundingBoxes'), 'boundingBoxes')) {
      if (!Array.isArray(box) || box.length !== 2 || box.some(p => !Array.isArray(p) || !location(p[0], p[1]))) throw new Error('Invalid AIS bounding box');
    }
    if (!c.boundingBoxes.length) throw new Error('AIS needs a bounding box');
    positive(c.durationSeconds ?? 30, 'durationSeconds', 3600); positive(c.maxMessages ?? 1000, 'maxMessages', 100000);
  },
  async gather(ctx) {
    const c = ctx.config;
    await new Promise((resolve, reject) => {
      const socket = new WebSocket('wss://stream.aisstream.io/v0/stream', { perMessageDeflate: true, handshakeTimeout: 15000, maxPayload: 1000000 });
      let count = 0, confirmed = false, done = false, queued = 0;
      let chain = Promise.resolve();
      const finish = error => {
        if (done) return; done = true; clearTimeout(timer); socket.terminate();
        chain.then(() => error ? reject(error) : resolve()).catch(reject);
      };
      const timer = setTimeout(() => {
        if (!confirmed && count === 0) finish(new Error('AIS stream did not confirm subscription or deliver data'));
        else { ctx.warn(`Bounded capture ended after ${c.durationSeconds ?? 30}s; ${count} messages`); finish(); }
      }, (c.durationSeconds ?? 30) * 1000);
      socket.on('open', () => socket.send(JSON.stringify({ APIKey: ctx.env.AISSTREAM_API_KEY, BoundingBoxes: c.boundingBoxes,
        FilterMessageTypes: c.messageTypes ?? ['PositionReport', 'StandardClassBPositionReport', 'ShipStaticData'],
        ...(c.mmsi ? { FiltersShipMMSI: c.mmsi } : {}),
      })));
      socket.on('error', () => finish(new Error('AIS WebSocket connection failed')));
      socket.on('close', () => { if (!done) finish(new Error('AIS connection closed before capture completed')); });
      socket.on('message', bytes => {
        if (done) return;
        if (++queued > 2000) { ctx.partial('AIS processing queue exceeded 2000 messages'); finish(); return; }
        chain = chain.then(async () => {
          queued--;
          const raw = await ctx.raw(bytes, { url: 'wss://stream.aisstream.io/v0/stream' });
          const r = JSON.parse(bytes.toString());
          if (r.error || r.Error) throw new Error('AIS subscription rejected');
          if (r.MessageType === 'SubscriptionConfirmation') { confirmed = true; if (!r.Message?.CompressionEnabled) ctx.warn('AIS compression not negotiated'); return; }
          if (!r.MetaData || !r.MessageType) throw new Error('Unexpected AIS message schema');
          const p = r.Message?.[r.MessageType] ?? {}; const meta = r.MetaData;
          ctx.emit(raw, r, {
            entityId: meta.MMSI ?? p.UserID, metric: r.MessageType, value: p, unit: 'ais-message', kind: 'vessel-observation',
            observationStart: meta.time_utc?.replace(' UTC', 'Z').replace(' ', 'T'),
            location: location(p.Latitude ?? meta.latitude ?? meta.Latitude, p.Longitude ?? meta.longitude ?? meta.Longitude),
            speedKnots: number(p.Sog) < 102.3 ? number(p.Sog) : null,
            courseDegrees: number(p.Cog) < 360 ? number(p.Cog) : null,
            headingDegrees: number(p.TrueHeading) < 360 ? number(p.TrueHeading) : null,
            shipName: meta.ShipName?.trim() ?? null,
            qualityFlags: ['ais-coverage-not-guaranteed', ...(p.Valid === false ? ['provider-invalid'] : [])],
          });
          count++;
          if (count >= (c.maxMessages ?? 1000)) { ctx.partial('AIS maxMessages reached'); finish(); }
        });
        chain.catch(() => finish(new Error('AIS message processing failed; inspect raw capture')));
      });
    });
  },
};
