# QA report: H2 Gas Purification Unit

Generated 2026-11-11T06:10:08+00:00 by pid-to-kg 0.1.0.

**0 errors, 15 warnings, 1 info.**

Errors must be fixed in the page extraction files before the graph is trusted. Warnings are things to re-check on the drawing (the *Re-check* column names the tiles). Info items are for the record.

| Severity | Code | Count |
|---|---|---|
| warning | `loop_no_final_element` | 3 |
| warning | `unmatched_off_page` | 12 |
| info | `low_confidence` | 1 |

## Details

| Severity | Page | Code | Item | Message | Re-check |
|---|---|---|---|---|---|
| warning |  | `loop_no_final_element` | LOOP:A-36001 | control loop A-36001 has a controller but no final element |  |
| warning |  | `loop_no_final_element` | LOOP:A-36002 | control loop A-36002 has a controller but no final element |  |
| warning |  | `loop_no_final_element` | LOOP:F-39001 | control loop F-39001 has a controller but no final element |  |
| warning | 1 | `unmatched_off_page` | P01.OPC2 | off-page connector 'COOLING WATER RETURN B50-423 TO HEADER' (to B50-423) has no matching connector or item | r2c1, r3c1 |
| warning | 1 | `unmatched_off_page` | P01.OPC5 | off-page connector 'H2 VENT GAS B50-491 TO HEADER' (to B50-491) has no matching connector or item | r2c1 |
| warning | 1 | `unmatched_off_page` | P01.OPC6 | off-page connector 'H2 VENT GAS B50-491 TO HEADER' (to B50-491) has no matching connector or item | r1c4 |
| warning | 1 | `unmatched_off_page` | P01.OPC7 | off-page connector 'H2 VENT GAS B50-491 TO HEADER' (to B50-491) has no matching connector or item | r1c4 |
| warning | 1 | `unmatched_off_page` | P01.OPC8 | off-page connector 'HYDROGEN GAS B50-101 TO BATTERY LIMIT' (to B50-101) has no matching connector or item | r2c4 |
| warning | 1 | `unmatched_off_page` | P01.OPC10 | off-page connector 'HYDROGEN GAS B50-341 TO VE-39001' (to B50-341) has no matching connector or item | r3c4 |
| warning | 1 | `unmatched_off_page` | P01.OPC11 | off-page connector 'SIGNAL B50-341 TO C-39001' (to B50-341) has no matching connector or item | r3c4 |
| warning | 1 | `unmatched_off_page` | P01.OPC12 | off-page connector 'WASTE WATER B50-481 TO PT-80001' (to B50-481) has no matching connector or item | r3c4 |
| warning | 1 | `unmatched_off_page` | P01.OPC1 | off-page connector 'COOLING WATER SUPPLY B50-423 FROM HEADER' (from B50-423) has no matching connector or item | r2c1, r3c1 |
| warning | 1 | `unmatched_off_page` | P01.OPC3 | off-page connector 'INSTRUMENT AIR B50-451 FROM HEADER' (from B50-451) has no matching connector or item | r3c1 |
| warning | 1 | `unmatched_off_page` | P01.OPC4 | off-page connector 'HYDROGEN GAS B50-332 FROM C-34001A/B' (from B50-332) has no matching connector or item | r3c1 |
| warning | 1 | `unmatched_off_page` | P01.OPC9 | off-page connector 'HYDROGEN GAS B50-341 FROM VE-39002A-I' (from B50-341) has no matching connector or item | r3c4 |
| info | 1 | `low_confidence` | P01.X1 | in-line item: rectangle with diagonal and pivot dot was read with confidence 0.50 | r2c3, r2c4 |
