# BTM Gas Engine Playbook (technical reference)

A condensed version of the playbook for a 10 MW gas engine behind the meter. Read the section you need.

Headline numbers: 10 MW electrical = 12.5 MVA at 0.8 power factor. That is about 656 A at 11 kV, but about 18 kA at 0.4 kV. It burns about 2,400 Nm³/h of natural gas.

## 1. Objective
Four answers decide everything:
1. **Why?** Lower cost than the grid, reliability or backup, power quality, heat or cooling (CHP), or sustainability.
2. **How will it run?** Baseload, peak shaving or island; in parallel with the grid or stand-alone.
3. **Export?** Most BTM projects are zero export. The answer sets the protection design and the utility approval.
4. **Gas?** Pipeline, CNG or LNG. This is the biggest project risk.

Default if the client is unsure: grid-parallel, zero export, baseload during production hours, pipeline gas. State these assumptions on the first page of the proposal.

## 2. Data and fallbacks
| Data | Needed for | If missing | Risk to flag |
|---|---|---|---|
| As-built SLD | Tapping point | Walk the site, photograph panels and nameplates, redraw in CAD, client's engineer signs it. Ask the original contractor, switchgear OEM and utility. | Hidden feeders. Write "redrawn and verified on site on [date]". Allow 3 to 5 days per MV substation. |
| 12 months of interval load | Sizing, minimum load, savings | Utility smart-meter export; BMS, SCADA or historian; power logger for 2 to 4 weeks scaled with the bills; last resort: load list × shift hours × diversity | Minimum load and savings are estimates. Size conservatively and show savings as a range. |
| Tariff and bills | Business case | Regulator's published tariff for the class; tariff category from the contract; one-page billing summary | Wrong demand-charge assumption. Show payback at tariff ±15%. |
| Utility fault level and agreement | Fault check, grid rules | Formal request to the utility. Estimate meanwhile from the transformer: Isc ≈ S ÷ (√3 × V × Z%). For 20 MVA, 11 kV, Z 10% that is 10.5 kA, ignoring the grid (worst case). | Mark results "preliminary, subject to utility data". |
| Transformer data | Fault level, reverse power | Nameplate photo (kVA, %Z, vector group, taps, cooling); test report; typical Z 6 to 10% for 5 to 25 MVA | The real impedance may be lower, which raises the fault level. |
| Switchgear data | Can the board take new generation? | Nameplate (kV, A, kA, year); OEM type-test certificate by serial number; assume 12.5 kA until verified | Board replacement or reactors. Carry a contingency. |
| Relay settings | Coordination | Download them with the OEM software; last coordination study; otherwise put a survey and a new study in scope | Miscoordination shows up only after connection. Price the study. |
| Site layout | Hall, cooling, stack, gas station | Satellite, drone, civil drawings, site visit; OEM footprint. Containers need less civil work. | Noise, stack height and distance to the substation can move the layout. |
| Gas supply | Fuel train, running cost | CNG virtual pipeline, LNG with storage and vaporizer, pipeline extension quote, biogas or LPG share, dual-fuel with diesel | Delivered cost can be much higher. Rerun the economics for each route. |
| Heat demand | CHP decision | Electric-only with radiators; absorption chiller for a chilled-water load; sell heat to a neighbour | Without a heat user, the economics rest on gas price against tariff alone. |

## 3. Tapping point
- **Connect at medium voltage** (6.6, 11, 13.8, 20 or 33 kV), at the bus voltage or through a step-up transformer.
- **Connect to the main MV switchboard, after the utility meter.** Choose a bus section with steady load, a spare breaker position and a short cable run.

**Backfeed (reverse power, export):** power flows out through the meter when the site load is below the engine output, for example at night. Utilities usually forbid it without an agreement. Utility-side relays and transformers expect one-way flow, and there is an islanding safety risk. Prevent it with:
- a 32R reverse power relay that trips or ramps the engine down;
- a zero-export controller that keeps output below the load in real time;
- sizing near the minimum load, or several smaller engines (minimum stable load is about 40 to 50% per unit);
- or an early export application if the client wants export.

**Generator incomer bay** (top to bottom):
- busbar connection;
- isolator;
- circuit breaker 52G;
- CTs and VT;
- earth switch;
- surge arrester;
- cable to the generator.

The relay reads the CTs and VT and commands the breaker. Its functions: 87G differential, 32 reverse or export power, 50/51 overcurrent, 27/59/81 voltage and frequency, 25 synchro-check. If there is no spare bay, add an end panel from the OEM, or a new generator board connected by cable to a spare breaker. If the board is at its limit, replacing it may be cheaper.

**Fault current:** a fault is a shortcut that bypasses the load, so only source and wiring impedance limit the current. Every source on the bus feeds it: the grid, the generators, and running motors for a few cycles. Heat and force grow with the square of the current. The board's short-circuit rating (kA) must stay above the fault level at its bus. The generator contribution is Isc ≈ S ÷ (√3 × V × X″d). For 12.5 MVA, 11 kV and X″d 15% that is about 4.4 kA, or 6.7 × rated current. X″d is typically 12 to 20%; X′d about 25% and Xd about 200% govern the later, lower currents.

The playbook example: utility through T1 7.5 kA + motors 1.5 kA = 9.0 kA, inside a 12.5 kA board. Adding the engine gives 13.4 kA, over the rating. The peak (making) current is about 2.5 × the kA value. Fixes:
- replace the board or the over-stressed breakers;
- add current-limiting reactors;
- use a generator with higher X″d, or a step-up transformer with higher impedance;
- connect to another bus section or run with the bus tie open;
- connect at a higher voltage.

**Six checks on the SLD:**
| # | Check | Passes when | If it fails |
|---|---|---|---|
| 1 | Fault level at the bus | Total under the breaking rating with margin; peak under the making rating (about 2.5 × kA) | Reactors, higher-rated board, another bus or voltage |
| 2 | Busbar and incomer current | Every section and breaker carries the worst-case flow, with the engine on and with it tripped | Uprate, or move the tapping point |
| 3 | Bus tie position | The section's minimum load is above the engine output, or tie logic and interlocks are designed | Bigger section, change tie operation, synchronize at the tie |
| 4 | Reverse power through the transformer | No export possible, or the transformer and relays are rated and set for reverse flow | 32R, export limit, new relay settings |
| 5 | Earthing and vector group | Ground-fault current limited and still detected | NGR, delta-star transformer |
| 6 | Meter and PCC position | All engine output is downstream of the revenue meter, with a check meter on the generator | Agree metering with the utility |

Have a protection engineer review the tapping point. Fault level and relay coordination are the most common reasons a tapping point changes late in a project.

## 4. Electrical scope
**Configuration:** 1 × 10, 2 × 5, 3 × 3.3 or 4 × 2.5 MW. Several units give redundancy, better part load and staged maintenance. One large unit is cheaper per kW but less available. Size on site-rated output, not ISO output.

**New equipment:**
- generator breaker and bay;
- step-up transformer if needed;
- generator control and synchronizing panel;
- power management system.

**Protection:**
- generator: 87G, 32, 40, 46, 59/27, 81, 51V, 64;
- interconnection: 25, 27/59, 81 O/U, 32R, ROCOF or vector shift, and transfer trip if the utility requires it.

**Controls:** auto-synchronizing, load sharing, load shedding, and black start for island mode.

**Studies:** load flow, short circuit, protection coordination, transient stability, harmonics and flicker, arc flash.

**When to run the studies:**
| Stage | Studies | Why then |
|---|---|---|
| Before the proposal | Hand fault level, reverse power, load flow screening | Picks the tapping point; tells you whether the board needs replacing, which changes the price |
| Feasibility or FEED | Load flow, short circuit (IEC 60909), protection coordination, harmonics and flicker screening | The utility wants it with the application; fixes the protection scope and ratings |
| Detailed design | Transient stability, motor starting, arc flash, earthing, relay settings | Needs the real generator, excitation and governor models |
| Commissioning | Final settings check, as-built models, arc flash labels | Settings proven by site tests |

## 5. Mechanical and gas
- **Fuel:** at 43% electrical efficiency, 10 MW needs about 23 MW of fuel, or about 2,300 to 2,400 Nm³/h.
- **Gas station:** regulating and metering, filtration, gas train, with pressure matched to the engine. Check the gas quality: heating value, methane number, H₂S.
- **Cooling and exhaust:** radiators or cooling towers; stack and silencers; oxidation catalyst or SCR as the permit requires.
- **Heat:** exhaust and jacket water give about 40 to 45% of fuel energy as heat. Use it in a hot water or steam boiler, or an absorption chiller.
- **Balance of plant:** foundations, ventilation, lube oil, fire and gas detection, noise control.

## 6. Permits
- Utility interconnection approval for parallel operation, needed even for zero export. It is often the longest item.
- Generation or captive licence, where it applies.
- Emissions and noise permit.
- Gas supply agreement.
- Building and fire approvals.

## 7. Business case
- **Capex:** engines, electrical, mechanical, gas, civil, engineering, commissioning.
- **Opex:** gas, LTSA or O&M, lube oil, catalyst, staff.
- **Generation cost** = gas price ÷ efficiency + O&M. Compare it with the tariff hour by hour, and add heat credits.
- **Metrics:** LCOE, payback, IRR and NPV, with sensitivities on gas price, tariff, utilization and availability.
- **Commercial model:** capex, or PPA or energy-as-a-service (BOO or BOOT). PPA terms cover the tariff structure, take-or-pay, gas price pass-through, availability guarantee and term.

## 8. Risks
| Risk | Mitigation |
|---|---|
| Gas price or supply | Fixed or indexed gas contract, dual fuel |
| Utility approval delay | Apply early; ask for the fault level and grid code up front |
| Fault level over the rating | Fault study in Step 3, contingency |
| Load below engine output | Zero-export control, multiple engines, correct sizing |
| Heat demand does not appear | Verify the thermal loads, electric-only fallback |
| Emissions | Confirm the limits early, specify a catalyst |
| OEM lead time 12 to 18 months | Reserve a slot, consider stock or used units |

## 9. Deliverables
1. Concept SLD with the tapping point and added bays.
2. Site layout.
3. Equipment list and budget BoQ.
4. Specification and guarantees.
5. Financial model and offer.
6. Schedule: studies and approvals, engineering, procurement, construction, commissioning, handover.
7. Risk register and assumptions list.
8. A clear next step: feasibility study, FEED or LOI.

**Practical tips:**
- Do not promise firm savings before you have the load profile and a confirmed gas price.
- Involve the OEM early for site-rated output, heat balance and gas needs.
- Have a protection engineer review the tapping point.

## Calculator rules used by the engine
- **Derate:** 1% per 100 m above 500 m; 1% per °C above 30 °C; 0.5% per methane number point below 70 (capped at 60%), unless overridden.
- **Units:** duty units = ceil(required MW ÷ (rated MW × (1 − derate))). N+1 adds one spare.
- **Turn-down:** lowest stable output = one unit × its minimum load %. It must be at or below the site minimum unless export is allowed.
- **Fault level:** each installed unit (spare included) adds (MW ÷ pf) ÷ (√3 × kV × (X″d + step-up Z if the generator kV differs from the connection kV)). Add this to the existing fault level and compare with the board rating.
- **Availability:** P(at least the duty number of units available), binomial with unit availability a.
- **Generation cost** = gas price (HHV per MMBtu) × 3.412 × 1.108 ÷ efficiency + O&M per MWh.
- **Dispatch (added by the skill):** in each interval the duty units supply min(load − import margin, duty capacity). The plant stops if that is below one unit's minimum stable load, or if the hour is outside the running window. The result is scaled by the expected share of duty units available, E[min(X, duty)] ÷ duty.
- **Demand saving:** monthly peak import before minus after, × demand charge × credited share.
