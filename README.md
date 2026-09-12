# Signal Desk — research application

A prediction-first research application wrapping the internal Ocean Context Protocol demo. The protocol name is not exposed as the user-facing product. Signal Desk is the current working product name. All simulation prices, sensor observations, transactions, vessels, generated events and results are synthetic. Curated external news references are real published reporting, explicitly separate from the simulation. Relationships are engineered into a deterministic toy process; no trained model, validated alpha or real execution is present. External news does not drive the engine.

## Run

The current project declares Node.js 22+; Python 3 serves the static UI. The frontend itself uses browser-native modules and no UI library. Optional gatherer dependencies are declared separately in package.json.

```sh
npm ci
npm start
# Open http://127.0.0.1:4173
```

`npm start` builds the app, then serves `dist/` on loopback. `npm run build` refreshes the static output; it can also be served by any static web server. Rebuild and refresh after source edits. `npm test` runs focused Node tests for calculation policy, costs, scenarios and time cutoffs.

## Research workflow

- **Predictions:** filter interests by market, instrument query, projected direction and minimum projected movement; sort by movement or name. Cards show actual seven-day outputs from the engine and observed/scenario mini-charts. The event feed combines existing synthetic events with calculated completed-sale summaries, ocean observations and vessel delay records, all respecting the replay cutoff. The News filter shows curated real articles from Associated Press and NOAA, with source/date/link and explicit separation from synthetic events. News references are filtered by their publication dates.
- **Signal detail:** open a prediction for its own price history and optional scenario band. Direct input evidence shows raw factor values, prior-day values, scenario adjustments, effective values, weights, instrument exposure and exact contributions. Expand the original daily input JSON and inspect separate source tables for supply, ocean, completed transactions, vessels, events and prices. These tables clearly distinguish research context from inputs actually consumed by the engine. Geography is a secondary evidence tab. Full signal exports include input records, instrument settings and contextual source records.
- **Model Lab:** disable supply, transport or ocean factors in the existing engine, compare full and enabled input projections, and select `baseline`, `constraint`, `recovery` or `weather`. Injected scenarios affect current projections only; fixtures and historical portfolio results are unchanged.
- **Paper Portfolio:** replay the existing long/cash policy, compare strategy equity with frictionless buy-and-hold, inspect trades, and recompute costs between 0 and 1,000 basis points.
- **Data Room:** actual manifest totals, cutoff-filtered tables or JSON, text filtering, pagination, dataset downloads, signal snapshots, ledger CSV and experiment JSON. Dataset downloads contain all matching records across pages. Exports carry synthetic disclosure and current settings. No-trade CSV exports contain an explicitly labelled metadata row.

Replay starts at observation 79 (2026-06-03), within the synthetic supply constraint period. The overview initially shows all markets; each signal opens its own analysis. The bottom Historical Replay bar is removed. A compact As of date field in the header changes the shared research cutoff, bounded by the available dataset period; there is no exposed playback control. State is local to the browser session and is not a shared database.

## Source layout

- `src/frontend/app.js`: shared application state, replay, navigation and export wiring.
- `src/frontend/views/predictions.js`: prediction discovery, interest filtering, contextual event feed and individual signal analysis.
- `src/frontend/views/`: Model Lab, Paper Portfolio, Data Room and shared signal inspector.
- `src/frontend/components/evidence.js`: direct input lineage, scenario adjustment tables and contextual record inspection.
- `src/frontend/components/select.js`: styled accessible option menus with arrow keys, typeahead, Escape and outside-click dismissal. Native select values still drive existing state handlers.
- `src/frontend/components/`: SVG geography, price/equity charts and UI helpers.
- `src/frontend/styles.css`: responsive research-terminal layout, keyboard focus and reduced-motion support.
- `src/frontend/data/repository.js`: one cached loading/validation boundary. Exposes `getAssets`, `getMarketHistory`, `getObservations`, `getEvents`, `getVessels`, `getNews`, `getManifest` and cutoff-filtered records. Prices, observations and vessels are indexed before use.
- `src/logic/engine.js`: original deterministic signal formula and long/cash paper replay, preserved unchanged.
- `data/synthetic/`: authoritative JSON fixtures; `public/maps/land.geojson`: supplied Natural Earth geography.
- `scripts/build.mjs`: synchronizes the source frontend, logic, fixtures and geography into `dist/` without replacing source data.
- `tests/`: focused signal, portfolio, cutoff, repository and gatherer tests, including mocked provider responses and failure recovery.

## Regenerate fixtures

```sh
npm run generate
npm run build
npm test
```

`scripts/generate-data.mjs` owns generation seed `20260912` and scenario parameters. `config/demo.json` documents them rather than overriding them. Regeneration replaces synthetic JSON fixtures reproducibly. The manifest records version, range, counts and seed.

## Simulation conventions and limitations

The signal engine combines supply pressure × 0.012, transport disruption × 0.004 and ocean anomaly × 0.001, scaled by asset exposure, then compounds the daily contribution over seven days. BUY requires a projected change above 1%; SELL is below −1%; otherwise HOLD. Contributions describe the engine, not causal effects. The scenario band uses instrument volatility × √7 and is not a statistically calibrated confidence interval.

The existing portfolio policy is intentionally preserved: BUY sets a full long position; **both SELL and HOLD set cash**, including liquidating a prior long. The signal at the previous close is filled at that same synthetic close and earns the next interval's close-to-close return. Each position change incurs the selected proportional cost before returns. Initial capital is 100,000 simulated USD. No final forced liquidation is performed. Maximum drawdown tracks strategy equity from the initial capital peak. The benchmark buys the same synthetic instrument at the first close and holds without costs. FX equity is a normalized return simulation, not a currency conversion/accounting system. There is no short selling, execution delay, slippage, liquidity or capacity model, nor any real order submission.

Daily replay is an end-of-day demonstration. Market records have availability timestamps, but station observations only have dates and reporting-delay metadata. Exact sensor publication-time reconstruction is not implemented. The toy engine consumes engineered daily factors rather than aggregating station data or sale records, and does not apply station reporting delays. This limitation is visible in the inspector. Inventory fields found in ocean-location sensor records are generator artifacts: the ocean inspector deliberately shows only environmental measurements. Supply hubs show inventory separately. Data Room retains raw fields with an explanatory note.

The map uses schematic longitude/latitude projection. Vessel coordinates are deterministic interpolation along illustrative routes using date-specific progress. Routes are not verified trade relationships. Context events open the relevant instrument or the selected location/vessel in an individual analysis without changing replay time. All events concern the shared synthetic supply-chain context; per-instrument event relevance scoring is not implemented. There is no statistical predictive-accuracy evaluation or training run.

At small widths interest filters move above the prediction list, cards become a single column, and event context and signal inspectors remain accessible below the main surface. Wide tables scroll internally; the research date remains available in the header. No external fonts, visualization libraries, servers beyond static file serving, or persistent external storage are required.

## Real data gatherers

The gatherer CLI implements ocean, species occurrence, FX reference rate, trade, vessel activity, disaster alert and RSS news adapters. See [adapter setup and access requirements](data-gatherers/README.md). Provider-specific credentials and optional Python SDKs are required only for the adapters that use them.

```sh
npm run gather -- --list
npm run gather -- --all --dry-run
npm run gather -- --source ecb,india-news
```

Copy `.env.example` to `.env` only when configuring credentialed sources. The default enabled set is bounded; `--all` runs it sequentially. Raw responses and normalized records are stored locally in `data/raw/` and `data/processed/`, excluded from Git and frontend builds. Each run retains provenance, first-seen time, units, quality flags and complete/partial/failed status. Failed runs do not replace the last successful snapshot. Non-idempotent report submissions are not automatically retried.

The frontend still loads fixtures and the curated news file; these adapters are not automatically model inputs. Its “Not connected” labels refer to that UI integration boundary. A real provider needs explicit repository mapping and a separately evaluated signal pipeline, following [the data contract](docs/data-contract.md). Credentials never belong in frontend files.

## Repository checks

```sh
npm test
npm run build
npm run gather -- --all --dry-run
```

GitHub Actions runs these checks on pushes and pull requests with Node.js 22. Network provider requests and optional credentialed SDKs are not run in CI. Build output, downloaded provider data, local environments and generated research exports stay outside version control.

## External news references

`data/external/articles.json` stores four short, attributed references curated on 2026-09-12 from Associated Press and NOAA. `scripts/build.mjs` copies them to `dist/news/`; the cached repository exposes them through `getNews(cutoff)` and the Data Room's news dataset. Three are available at the initial 2026-06-03 cutoff; the 2026-06-17 article remains hidden until its date.

These are not generated headlines, an automatic feed or a licensed full-text news archive. Articles link to the publisher; summaries are short paraphrases. NOAA's page was read directly; AP metadata/excerpts were available through publisher-attributed search results but full-page retrieval was unavailable. Records retain that verification distinction. The UI uses publication date for daily replay, not a reconstructed historical first-seen timestamp; retrieval happened on 2026-09-12.

News records carry `synthetic: false` and `model_input: false`. Signal exports retain their simulation label while including these separately identified contextual records. Exporting the news dataset itself marks the record set as real external reporting. Adding a reference does not change the toy signal or portfolio. The separately developed gatherers in `data-gatherers/` are not automatically wired into this frontend.

The user-facing vocabulary uses “simulated” instead of “synthetic”. `components/display-copy.js` normalizes rendered text and accessibility labels, including dynamically loaded descriptions and record-view labels. Raw datasets and exported provenance retain their original schema and flags.
