# Project file format (`*.btm.json`)

One JSON file per project. Written by `btm.mjs` and the dashboard. `schema` is `"btm-gas-engine-project"` and `version` is 1. Older or partial files are filled in automatically when opened.

| Key | Content |
|---|---|
| `created`, `updated` | ISO timestamps |
| `fields` | Flat map of answers, e.g. `"site.altitude_m": 40`. The keys and their types come from the stage catalogue in `scripts/engine.js` (`STAGES`). List them with `btm.mjs fields <file>` |
| `unknown` | Map of field key → note, for answers the user does not know. Counts as answered and goes into the E1 assumptions log |
| `stages` | 5 entries: `{n, status: not_started\|in_progress\|complete\|skipped, started, completed, skip_reason}` |
| `current_stage` | 0 to 4 |
| `load` | `null`, or `{start: "YYYY-MM-DDTHH:MM", interval_min, kw: [numbers or null], sources: [...]}`. A uniform grid of average kW per interval, with `null` for gaps |
| `bills` | `[{month: "2025-01", kwh, max_kw, cost}]` |
| `tariff_periods` | `[{name, rate (per MWh), days: all\|weekday\|weekend, from, to}]`. Each overrides the base rate in its hours; later rows win |
| `engine_classes` | `[{mw, eff %, min % stable load, kv, om per MWh, cx installed cost per kW}]` |
| `data_request` | `[{id: DR1…, item, why, owner, due, status, received, note, fallback, ex}]` |
| `exercises` | `[{id: E1…E14, status, note}]` |
| `checks` | `[{id: C1…C6, status, note}]`. C1, C2 and C4 are also calculated |
| `gas_options` | `[{name, price per MMBtu or null, note}]` |
| `assumptions` | User-added E1 rows `{item, assumption, source, risk}` |
| `risks` | `[{risk, effect, mitigation, l, i, owner}]` |
| `schedule` | `[{task, start (week), weeks}]` |
| `review` | `[{role, name, date, status: Pending\|Approved\|Changes requested, note}]` |
| `selected_options` | Option ids for proposal Options A and B, e.g. `["7x2", "5x3.3"]`. Empty means the best two are used |
| `deliverables` | `[{id, stage, title, markdown, updated}]` |
| `log` | `[{t, who, text}]`, the last 500 changes |

Calculation inputs live in `fields` as `calc.*` keys. An empty value means "use project data, then load data, then the playbook default". The analysis results are not stored: both tools recompute them from the inputs. So the file is the only thing to save, and opening it anywhere gives the same numbers.

Size: about 100 KB with a year of hourly data, about 350 KB with 15-minute data.
