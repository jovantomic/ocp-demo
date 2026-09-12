# OCP data gatherers

Run from the project root with Node.js 22+:

```sh
npm install
npm run gather -- --list
npm run gather -- --all --dry-run
npm run gather -- --all
npm run gather -- --source india-news
npm run gather -- --source open-meteo,ecb,comtrade
```

`--all` runs only enabled sources in `config/gatherers.json`, sequentially. `--source` explicitly selects a source even when disabled. `--config FILE` selects an alternative JSON config; file paths inside an import config are relative to the project root. `--dry-run` shows selection without network, credentials validation or output files. `{startDate}` and `{endDate}` expand to seven days ago and today in UTC. A failed source does not stop other selected sources; the final exit code is 1 if any failed. Partial extracts have an explicit `partial` manifest status and warnings.

The default enabled set is Open-Meteo, ECB, OBIS, GBIF, GDACS and India news. This is a bounded local research configuration, not a globally exhaustive or continuously running feed. The original synthetic location coordinates are reused as query locations only; returned provider data is not synthetic.

## Implemented adapters

| CLI source | Data and configuration | Access |
|---|---|---|
| `open-meteo` | Hourly wave height/direction/period, SST, ocean current speed/direction for six ocean locations; variables configurable | No key for non-commercial endpoint; `OPEN_METEO_API_KEY` selects customer endpoint |
| `ecb` | Daily EUR-base reference rates: USD, INR, JPY, THB, SGD, CNY | No key; date range/currencies configurable |
| `obis` | Marine species occurrences, locations, dates, original taxon/dataset identifiers | No key; sequential `after` pagination; large bulk analysis belongs on OBIS GeoParquet |
| `gbif` | Species occurrences, coordinates, event intervals, provider quality issues | No key; offset pagination; default goldfish in India |
| `gdacs` | Disaster alerts, intervals, severity and event location | No key; date/country filters and page budget; HTTP 204 is an empty result |
| `india-news` | RSS/Atom headlines, publisher links, publication time, categories and keyword topics | PIB, Indian Express, Economic Times enabled; The Hindu disabled pending access/reuse verification |
| `comtrade` | Reported trade value in USD, net weight, quantity and units, reporter/partner/commodity/flow | Optional `COMTRADE_API_KEY`; no-key preview always labelled partial; default India's 2024 freshwater ornamental fish exports (`030111`) |
| `estat` | Japanese statistical values and complete dimension codes | `ESTAT_APP_ID`; select a real `statsDataId` and supply `timeMapping` for opaque time codes |
| `gfw` | Inferred fishing, encounter, loitering, port-visit or AIS-gap events | `GFW_API_TOKEN`; choose `datasets`; bounded pagination |
| `gfw-vessels` | Vessel identity and registry records | `GFW_API_TOKEN`; text/identifier search |
| `gfw-effort` | Daily apparent fishing hours by flag/grid cell inside a GeoJSON polygon | `GFW_API_TOKEN`; one bounded report, direct JSON or ZIP; no automatic concurrent/repeated report submission |
| `aisstream` | Compressed AIS WebSocket capture: positions and ship metadata | `AISSTREAM_API_KEY`; geographic boxes, duration and message cap |
| `erddap` | Configurable NOAA/other ERDDAP tabledap or griddap numeric variables with provider units | Public dataset; exact query/column selection required; supplied NOAA sample returned HTTP 403 in local verification |
| `copernicus` | NetCDF forecast subset, default potential temperature near Kochi | Scientific SDK + Copernicus credentials; separate sample configs for salinity and currents |
| `era5` | NetCDF atmospheric reanalysis, default small 2024 regional sample | Scientific SDK + `CDSAPI_KEY`; accepted dataset terms on the CDS account |
| `argo` | Temperature, salinity and pressure profiles with provider QC | Scientific SDK, public ERDDAP backend; spatial/time/depth box |
| `nasa-ocean` | Earthdata granules, default MODIS Aqua NRT L3 chlorophyll; regular-grid geographic crop | Scientific SDK + Earthdata credentials; granule/observation caps |

The additional names `fao-fishstat`, `eumofa`, `noaa-landings` and `incois` use the implemented **mapped CSV/JSON import adapter**. They are not automatic provider-specific live API integrations. Supply an official export file or exact HTTPS download URL, dataset identity, licence and column mapping. No endpoint, unit, species mapping or release timestamp is guessed.

Commercial Kpler feeds and financial equity providers are outside this open-data implementation. Real goldfish auction transactions and breeder inventories still require a source agreement/export. AIS activity is not catch, occurrence counts are not fish stocks, trade values are not individual auction prices.

## Credentials and scientific SDKs

Copy `.env.example` to `.env` and fill only needed credentials; existing process environment wins over `.env`. Keep secrets out of configs and the frontend. API request URLs in manifests redact key/token/appId query parameters; authorization headers are never persisted. Public GET redirects are followed with a cap; authenticated cross-origin redirects are refused.

Scientific workers automatically use `.venv-gatherers/bin/python` when present, or `OCP_PYTHON`, or `python3`:

```sh
python3 -m venv .venv-gatherers
.venv-gatherers/bin/python -m pip install -r data-gatherers/requirements.txt
npm run gather -- --source copernicus
npm run gather -- --source copernicus --config data-gatherers/configs/copernicus-salinity.json
npm run gather -- --source copernicus --config data-gatherers/configs/copernicus-currents.json
npm run gather -- --source era5
npm run gather -- --source argo
npm run gather -- --source nasa-ocean
```

Choose variables that exist in the selected dataset. ERA5 uses provider request names such as `2m_temperature` and NetCDF output names such as `t2m`. NASA support targets regular L3 grids; hierarchical/swath products need explicit group/coordinate handling and are not automatically supported. CMR bounding boxes find intersecting files; the worker separately crops L3 latitude/longitude coordinates. Observation/granule limits are explicit, not claims of complete coverage.

## Example mapped export

This is an illustrative schema, **not the column layout of every FAO/EUMOFA export**. Match it to the actual downloaded file.

```json
{
  "sources": {
    "fao-fishstat": {
      "enabled": true,
      "file": "data/raw/my-official-export.csv",
      "datasetId": "actual-provider-dataset-id",
      "datasetVersion": "actual-export-version",
      "licenceRef": "https://provider.example/actual-licence",
      "format": "csv",
      "timeFormat": "year",
      "mapping": {
        "entityId": "Species",
        "time": "Year",
        "metrics": [{ "column": "Quantity", "name": "production", "unit": "t" }]
      }
    }
  }
}
```

`downloadUrl` replaces `file` for an official HTTPS export. `rowsKey` selects an array in JSON; `delimiter` supports other CSV delimiters. `timeFormat` may be `year`, `month`, or omitted for parseable timestamps. Map `endTime`, `publishedAt`, `latitude`, `longitude` and per-metric `unitColumn` where available. Suppressed/non-numeric numeric values become null with `missing-value`, never zero.

## Persistence and provenance

- `data/raw/<source>/<sha256>.*`: original HTTP payloads / imported exports / SDK subset files, content addressed. Provider error responses are retained too.
- `data/processed/<source>/<run-id>.jsonl`: immutable snapshot of normalized records from one run.
- `<run-id>.manifest.json`: complete/partial/failed status, response references, counts, warnings and output path.
- `latest.json`: pointer/metadata for the last successful or partial run, never a failed run.
- `first-seen.json`: persistent per-observation-revision first-seen index. It grows with history; this prototype does not compact it.

Stable observation IDs include source, resolved/configured dataset version, entity, metric, observation interval and original record hash. Repeated identical records deduplicate within a run; historical snapshots remain separate. Revised original records create new revisions with new first-seen times. A `.lock` prevents same-source writers from racing; after a crashed process inspect and remove its stale lock before retrying.

The current implementation buffers a bounded HTTP response and normalized run in memory. Keep page/response/observation budgets small; partition larger extractions. Scientific raw staging files are retained for inspection, including files from interrupted SDK runs. Argo's raw NetCDF is an SDK materialization, **not byte-identical raw upstream HTTP responses**; this distinction is recorded in its manifest.

Forecast issue time is null unless explicitly available/configured. Open-Meteo retrieval time and generation duration are not model issue times. Unknown publication times stay null. News publication time does not substitute for the event time in the story. Do not run a historical evaluation using modern first-seen timestamps as fabricated historical publication dates.

The static demo/engine continues to consume `data/synthetic/`. Gathered files are stored for research and are not silently copied into `dist/` or treated as validated model inputs.

## News and access terms

The normalized news records contain titles, publisher links, publication times, categories and matched topics. RSS descriptions are used for keyword matching but not copied into normalized summaries. Raw publisher-provided RSS is retained locally; article pages and paywalls are not crawled. Feed refreshes deduplicate identical entries by revision hash. Topic matching is a keyword filter, not sentiment analysis or fact verification.

Sources and relevant documentation:

- [PIB official RSS](https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=3)
- [Indian Express RSS and personal/non-commercial terms](https://indianexpress.com/rss/)
- [Economic Times RSS and personal/non-commercial terms](https://economictimes.indiatimes.com/rss_index.cms)
- [Open-Meteo commercial access](https://open-meteo.com/en/pricing)
- [GFW non-commercial API](https://api-doc.globalfishingwatch.org/our-apis/documentation/)
- [Copernicus Marine licence](https://marine.copernicus.eu/user-corner/service-commitments-and-licence)

Data being publicly reachable does not grant redistribution or commercial rights. Dataset-specific licences travel with normalized records. The enabled local research feed settings are not a commercial publishing licence.

## Validation

`npm test` covers provider fixtures, pagination/caps, missing values, quote direction, event/forecast times, raw storage, first-seen stability, retries, errors, locks, redaction, RSS/Atom and mapped exports. These fixture tests do not certify live availability. See `docs/gatherer-validation.md` for dated network results and credential-dependent limitations.
