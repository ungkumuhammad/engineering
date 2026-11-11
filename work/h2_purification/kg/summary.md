# H2 Gas Purification Unit: process knowledge graph summary

Built from `AQ010-B50-333_PID_H2_GAS_PURIFICATION_UNIT.pdf` (1 sheets) by pid-to-kg 0.1.0 on 2026-11-11. The graph has 189 nodes and 223 edges; this summary covers equipment-level flow, instruments and control loops. Query `graph.duckdb` or `graph.json` for pipe-segment and valve detail.

| Equipment | Instruments | Valves & fittings | Pipe segments | Control loops | Off-page links |
|---|---|---|---|---|---|
| 2 | 15 | 63 | 86 | 9 | 12 |

## Sheets

| Page | Drawing | Title | Type |
|---|---|---|---|
| 1 | AQ010-B50-333 | P&ID H2 GAS PURIFICATION UNIT | pid |

## Process flow (equipment to equipment)

Each line reads *upstream → downstream*, with the pipe lines and in-line items between them. Pipes, valves and instruments are collapsed; use `kg_query.py path` for the full route.


## Equipment

| Tag | Kind | Description | Fed by | Feeds | Status | Sheets |
|---|---|---|---|---|---|---|
| U-36001A | package_unit | H2 GAS PURIFICATION UNIT (U-36001A/B, train A) |  |  |  | AQ010-B50-333 |
| U-36001B | package_unit | H2 GAS PURIFICATION UNIT (U-36001A/B, train B) |  |  |  | AQ010-B50-333 |

## Instruments

Location is where the instrument senses the process. Pipe locations read `line (upstream item -> downstream item)`.

| Tag | Variable | Function | Mounted | Senses | Loop |
|---|---|---|---|---|---|
| AC-36001 | analysis | controller | dcs |  | A-36001 |
| AC-36002 | analysis | controller | dcs |  | A-36002 |
| AT-36001 | analysis | transmitter | field | 4"-H2-C50H-360001 (ball valve -> ball valve) | A-36001 |
| AT-36002 | analysis | transmitter | field | 4"-H2-C50H-360001 (ball valve -> ball valve) | A-36002 |
| FC-39001 | flow | controller | dcs |  | F-39001 |
| FC-39002 | flow | controller | dcs |  | F-39002 |
| FC-39003 | flow | controller | dcs |  | F-39003 |
| FT-39001 | flow | transmitter | field | in-line on 2"-H2-C50H-390031 (ZV-39001 -> HYDROGEN GAS B50-341 TO VE-39001) | F-39001 |
| FT-39002 | flow | transmitter | field | in-line on 1"-H2-G53H-390003 (HYDROGEN GAS B50-341 FROM VE-39002A-I -> globe valve) | F-39003 |
| PC-36001 | pressure | controller | dcs |  | P-36001 |
| PI-39004 | pressure | indicator | dcs |  | F-39002, F-39003, P-39004 |
| PT-36001 | pressure | transmitter | field | 4"-H2-C50H-360001 (ball valve -> ball valve) | P-36001 |
| PT-39004 | pressure | transmitter | field | 1"-H2-G53H-390003 (HYDROGEN GAS B50-341 FROM VE-39002A-I -> FT-39002) | P-39004 |
| TI-36001 | temperature | indicator | dcs |  | T-36001 |
| TT-36001 | temperature | transmitter | field | 4"-H2-C50H-360001 (ball valve -> ball valve) | T-36001 |

## Control loops

| Loop | Type | Sensor(s) | Controller(s) | Final element(s) | Description |
|---|---|---|---|---|---|
| A-36001 | control | AT-36001 | AC-36001 |  | Control loop A-36001 (analysis). Sensed by AT-36001 (4"-H2-C50H-360001 (ball valve -> ball valve)). Controlled by AC-36001 (dcs). |
| A-36002 | control | AT-36002 | AC-36002 |  | Control loop A-36002 (analysis). Sensed by AT-36002 (4"-H2-C50H-360001 (ball valve -> ball valve)). Controlled by AC-36002 (dcs). |
| F-39001 | control | FT-39001 | FC-39001 |  | Control loop F-39001 (flow). Sensed by FT-39001 (in-line on 2"-H2-C50H-390031 (ZV-39001 -> HYDROGEN GAS B50-341 TO VE-39001)). Controlled by FC-39001 (dcs). |
| F-39002 | control | PI-39004 | FC-39002 | FV-39001 | Control loop F-39002 (flow). Sensed by PI-39004. Controlled by FC-39002 (dcs). Acts on FV-39001 on 1"-H2-G53H-390003. |
| F-39003 | control | FT-39002, PI-39004 | FC-39003 | FV-39002 | Control loop F-39003 (flow). Sensed by FT-39002, PI-39004 (in-line on 1"-H2-G53H-390003 (HYDROGEN GAS B50-341 FROM VE-39002A-I -> globe valve)). Controlled by FC-39003 (dcs). Acts on FV-39002. |
| P-36001 | control | PT-36001 | PC-36001 | PV-36001, PV-36002 | Control loop P-36001 (pressure). Sensed by PT-36001 (4"-H2-C50H-360001 (ball valve -> ball valve)). Controlled by PC-36001 (dcs). Acts on PV-36001 on 4"-H2-C50H-360001; PV-36002 on 4"-H2-C50H-360002. |
| P-39001 | monitoring |  |  |  | Monitoring loop P-39001 (pressure). |
| P-39004 | monitoring | PT-39004 |  |  | Monitoring loop P-39004 (pressure). Sensed by PT-39004 (1"-H2-G53H-390003 (HYDROGEN GAS B50-341 FROM VE-39002A-I -> FT-39002)). |
| T-36001 | monitoring | TT-36001 |  |  | Monitoring loop T-36001 (temperature). Sensed by TT-36001 (4"-H2-C50H-360001 (ball valve -> ball valve)). |

## Off-page connections

| Sheet | Connector | Direction | Other drawing | Linked to |
|---|---|---|---|---|
| AQ010-B50-333 | COOLING WATER SUPPLY B50-423 FROM HEADER | in | B50-423 | unmatched |
| AQ010-B50-333 | HYDROGEN GAS B50-341 TO VE-39001 | out | B50-341 | unmatched |
| AQ010-B50-333 | SIGNAL B50-341 TO C-39001 | out | B50-341 | unmatched |
| AQ010-B50-333 | WASTE WATER B50-481 TO PT-80001 | out | B50-481 | unmatched |
| AQ010-B50-333 | COOLING WATER RETURN B50-423 TO HEADER | out | B50-423 | unmatched |
| AQ010-B50-333 | INSTRUMENT AIR B50-451 FROM HEADER | in | B50-451 | unmatched |
| AQ010-B50-333 | HYDROGEN GAS B50-332 FROM C-34001A/B | in | B50-332 | unmatched |
| AQ010-B50-333 | H2 VENT GAS B50-491 TO HEADER | out | B50-491 | unmatched |
| AQ010-B50-333 | H2 VENT GAS B50-491 TO HEADER | out | B50-491 | unmatched |
| AQ010-B50-333 | H2 VENT GAS B50-491 TO HEADER | out | B50-491 | unmatched |
| AQ010-B50-333 | HYDROGEN GAS B50-101 TO BATTERY LIMIT | out | B50-101 | unmatched |
| AQ010-B50-333 | HYDROGEN GAS B50-341 FROM VE-39002A-I | in | B50-341 | unmatched |

## Data quality

0 errors, 15 warnings and 1 informational items; see `qa_report.md`. Every node carries `confidence` and the sheet region it was read from (`provenance`). This graph was machine-extracted from drawings and must be verified by a qualified engineer before use in design, operations or safety work.
