# OCP UI validation — 2026-09-12

Built and opened the static application in Safari. Checked desktop/full-width and narrow-window layouts, including a phone-sized CSS viewport using browser zoom. This is browser responsive-layout inspection, not a physical-device test.

- Selected all eight instruments; each selected state and its price/unit updated at the retained cutoff.
- Watchlist search for Oranda returned one instrument.
- Selected Osaka: inventory 85.6, reporting delay 12 h on 2026-06-03. Advancing one day changed inventory to 91.1 and delay to 11 h. Ocean layer toggle removed ocean markers while supply markers remained.
- Replay updated price, signal, vessel observations and location evidence. Ordinary price history ended at the cutoff. Explicit outcome reveal displayed the evaluation disclosure.
- Model Lab supply ablation on 2026-06-04 changed Ranchu's seven-day projection from +5.16% to +1.22%. The constraint scenario changed full/enabled results to +9.71% / +1.73%, with historical portfolio separately labelled baseline.
- With supply disabled, increasing costs from 15 to 100 bps reduced portfolio ending equity from 105,048.13 to 102,388.15 simulated USD, while benchmark was unchanged.
- Data Room filter RANCHU at 2026-06-04 returned 80 price rows; pagination reached page 2/4; JSON detail mode worked.
- Downloaded all four export types through Safari. Parsed actual files to verify disclosure, cutoff, instrument and settings. Filtered dataset contained 80 qualifying rows. Ledger had three trades, 100 bps and baseline scenario. Copies retained in artifacts/exports/.
- Advanced replay through observation 179, then used playback to reach observation 180 (2026-09-12). Playback stopped and Play/Next were disabled at the boundary. Reset restored observation 79 and Ranchu.
- Node test suite: six passing tests cover deterministic signals for all instruments, future-price exclusion, data ablation, scenario non-mutation, explicit HOLD-to-cash/cost accounting, repository cache/count validation and all repository cutoffs.

No blocking rendering/runtime failure was observed during these workflows. Exact sensor publication-time availability, trained-model metrics, execution realism and real-provider integration remain unimplemented as documented in the README and application. Native automation did not reliably manipulate Safari's range slider directly; replay controls and boundary playback were exercised through the visible day buttons. Slider rendering preserves the input DOM node during updates so pointer drags are not interrupted by replacement.

## Prediction-first product revision

The application is now wrapped as Signal Desk, with protocol branding removed from the interface. The primary screen is prediction discovery with market, direction, movement and query filters, plus a typed context-event feed. Signal analysis contains dedicated history/projection, input lineage and contextual record tables. Geography is a secondary evidence tab.

Verified the new overview and market filtering in Safari: selecting fictional equities returned AQUA, PLGC and NAMI with their engine-computed projections. Opening Ranchu produced the individual history/projection view and three evidence tabs. New automated tests verify composed interest filters, sorting, derived sales totals, event type selection and event cutoffs. Eight tests pass.

Subsequent refinements add styled keyboard-accessible dropdowns, larger slider hit area, input evidence tables and full evidence export payloads. These refinements build and pass the calculation/data test suite. Further native browser control was stopped after user feedback about cursor/focus interference; do not treat the latest dropdown styling as having completed a fresh manual browser QA pass.

## External news addition

Added four real publisher-attributed references (AP and NOAA) in data/external/articles.json. Three meet the initial cutoff; the June 17 article remains excluded until that date. Added actual dated reporting to the News filter, external publisher links, signal-context records, full evidence exports and the Data Room. Records retain synthetic:false and model_input:false. News snapshot exports do not mislabel the records as synthetic. References are curated, not auto-refreshed; publication-date filtering is not proof of historical first-seen availability.

The updated test run passed 26 tests, including separately added gatherer tests. UI-owned tests verify the three/four-article cutoff transition, composed prediction filters and news separation. Native browser interaction remains paused to avoid taking over the user's cursor/focus.
