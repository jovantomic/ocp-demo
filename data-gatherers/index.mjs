import openMeteo from './ocean/open-meteo.mjs';
import erddap from './ocean/erddap.mjs';
import { scientificSource } from './ocean/scientific.mjs';
import { occurrenceSource } from './fish/occurrences.mjs';
import estat from './fish/estat.mjs';
import ecb from './markets/ecb.mjs';
import comtrade from './markets/comtrade.mjs';
import gfw from './human-activity/gfw.mjs';
import gfwVessels from './human-activity/gfw-vessels.mjs';
import gfwEffort from './human-activity/gfw-effort.mjs';
import gdacs from './human-activity/gdacs.mjs';
import aisstream from './human-activity/aisstream.mjs';
import news from './news/rss.mjs';
import { tabularSource } from './shared/tabular.mjs';

export const sources = Object.fromEntries([
  openMeteo, erddap, occurrenceSource('obis'), occurrenceSource('gbif'), estat, ecb, comtrade, gfw, gfwVessels, gfwEffort, gdacs, aisstream, news,
  ...['copernicus', 'era5', 'argo', 'nasa-ocean'].map(scientificSource),
  tabularSource('fao-fishstat', 'https://www.fao.org/statistics/data-dissemination/fishery-and-aquaculture/'),
  tabularSource('eumofa', 'https://fishery-aquaculture-market-observatory.ec.europa.eu/en/data/dashboards/first-sale-monthly-data'),
  tabularSource('noaa-landings', 'https://www.fisheries.noaa.gov/national/sustainable-fisheries/commercial-fisheries-landings'),
  tabularSource('incois', 'https://incois.gov.in/site/dataholdings.jsp'),
].map(source => [source.id, source]));
