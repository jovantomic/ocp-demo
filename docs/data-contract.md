# Data contract

Synthetic records must retain `synthetic: true`. Never mix them into a real-data evaluation without explicit labelling.

Provider adapters return source ID, dataset version (null if unknown), entity ID, observation start/end, provider publication time (null if unknown), first-seen time, retrieval time, value, unit, quality flags, licence reference and raw-record hash. Forecast inputs additionally carry issue time and valid time; unknown issue times stay null and are flagged.

Keep original responses in data/raw and normalized records in data/processed. Never fabricate historical publication times. Real credentials belong in environment variables, never JSON fixtures.

The existing synthetic fixture format is a separate demo format. Implemented gatherers write canonical JSONL records through `data-gatherers/shared/core.mjs`; see `data-gatherers/README.md` for the CLI and providers. Every gathered record carries `synthetic: false`, `rawRecordHash`, `rawResponseHash` and `rawFile`. Dataset-specific units and licensing are preserved. A null numeric measurement is missing, not zero.

`kind` distinguishes forecast, reanalysis, observation, occurrence, news, statistical/trade aggregate, inferred activity/event, reference rate and registry records. News publication time is not event occurrence time. Argo SDK materializations are identified separately from original provider files. Retrieval and first-seen times cannot establish historic model-input availability before collection began.
