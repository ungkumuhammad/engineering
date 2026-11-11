# Load data: formats and cleaning

## Accepted interval data (`btm.mjs load`, or the dashboard's Load tab)
A CSV or TXT file in one of these layouts:
- Timestamp in the first column, then a value column: `2025-01-01 00:15,5230`.
- Date and time in two columns, then a value: `13/01/2025;00:30;25,5`.

What is detected automatically:

| Item | Detected |
|---|---|
| Delimiter | `,` `;` tab or `|` |
| Header row | Yes, if there is one |
| Date order | Day/month (`dmy`) or month/day (`mdy`), from any day above 12. If it cannot tell, it assumes `dmy`; pass `--date-order mdy` for US files |
| Time format | AM/PM accepted |
| Decimal comma | Accepted when the delimiter is `;` |

**Value column:** the first mostly-numeric column after the timestamp. Pass `--column "Name"` or a 0-based index to choose another one, for example when the file has kW, kVAr and kVA.

**Unit:** read from the header (`kWh` → energy per interval, `MW`, otherwise `kW`). Override with `--unit kW|MW|kWh|MWh`. Energy per interval is converted to average kW.

**Interval:** the median spacing, snapped to 1, 5, 10, 15, 30 or 60 min. Anything finer than 15 min is averaged to 15 min to keep the file small. Daily data is refused; use bills instead.

**Several files** (for example one per month) merge into one series. Where they overlap, the newer file wins. Gaps are kept as empty intervals: they are not filled, they are skipped, and the totals are scaled to a year. Use `--replace` to start over.

Timestamps are read as local clock time, with no time-zone or daylight-saving shift. Most meters stamp the end of the interval; a one-interval shift does not matter for sizing.

## Monthly bills (`btm.mjs bills`)
Header with a month column (`2025-01`, `01/2025` or `Jan 2025`), a kWh column, and optionally a maximum demand (kW) column and a cost column. Bills give annual energy and the peak, but not the minimum load: ask the client for that (`ops.min_load_mw`).

## What the analysis uses
| Measure | Used for |
|---|---|
| Peak | The site peak |
| 5th percentile | The minimum during normal operation, which is the minimum for sizing and turn-down. The lowest 5% of hours (shutdowns, holidays) are hours when the engines simply stop; the dispatch counts them as "hours stopped, low load". The absolute minimum and the 1st percentile are reported too |
| Record shorter than 330 days | The client's stated minimum (`ops.min_load_mw`) is preferred, if given. Annual energy is scaled from the record. Say that seasonal effects are missing |

To override any derived value, set the `calc.*` field (for example `set <file> calc.minload=4.5`). Clear it with `calc.minload=` to go back to the data.

## Checks to make with the user
- **Coverage below 95%:** are the gaps meter faults or shutdowns?
- **Spikes:** a single interval far above the rest is often a meter error. Ask before trusting the peak.
- **Values in the wrong unit:** for example an "average 9,600" in a file that says MW.
- **Several incomers:** the site load is the sum of the meters. Combine them in a spreadsheet first, or import the main revenue meter only.
- **On-site generation that already exists:** for example solar. The meter shows net load; ask for gross.
