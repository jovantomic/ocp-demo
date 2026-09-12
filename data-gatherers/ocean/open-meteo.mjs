import { array, location, number, required, url } from '../shared/core.mjs';

export default {
  id: 'open-meteo', category: 'ocean', access: 'No key for non-commercial endpoint; optional commercial key',
  licenceRef: 'https://open-meteo.com/en/terms',
  docs: 'https://open-meteo.com/en/docs/marine-weather-api',
  validate(c) {
    for (const p of array(required(c, 'locations'), 'locations')) if (!location(p.lat, p.lon)) throw new Error('Invalid location');
    if (!c.locations.length) throw new Error('At least one location required');
  },
  async gather(ctx) {
    const c = ctx.config;
    const variables = c.variables ?? ['wave_height', 'wave_direction', 'wave_period', 'sea_surface_temperature', 'ocean_current_velocity', 'ocean_current_direction'];
    for (const p of c.locations) {
      const endpoint = ctx.env.OPEN_METEO_API_KEY ? 'https://customer-marine-api.open-meteo.com/v1/marine' : 'https://marine-api.open-meteo.com/v1/marine';
      const { data, raw } = await ctx.request(url(endpoint, { latitude: p.lat, longitude: p.lon, hourly: variables.join(','), timezone: 'GMT', timeformat: 'unixtime', forecast_days: c.forecastDays ?? 2, past_days: c.pastDays ?? 0, apikey: ctx.env.OPEN_METEO_API_KEY }));
      if (data.error) throw new Error('Open-Meteo rejected the query');
      const times = array(data.hourly?.time, 'hourly.time');
      for (const metric of variables) {
        const values = array(data.hourly[metric], metric);
        if (values.length !== times.length) throw new Error(`Open-Meteo mismatched ${metric} and time lengths`);
        times.forEach((t, i) => ctx.emit(raw, { location: p.id ?? p, time: t, metric, value: values[i] }, {
          entityId: p.id ?? `${p.lat},${p.lon}`, metric, value: number(values[i]), unit: data.hourly_units?.[metric] ?? null,
          observationStart: t * 1000, observationEnd: t * 1000,
          kind: 'forecast', issueTime: null, location: location(data.latitude, data.longitude), requestedLocation: p,
          qualityFlags: ['model-output', 'not-a-measured-sensor'],
        }));
      }
    }
  },
};
