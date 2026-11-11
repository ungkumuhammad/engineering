# Stage 3 · Exercises E1 to E14 (2 to 4 weeks)

**Goal:**
- turn the data into two well-tested options;
- write a costed business case;
- produce a risk register and a schedule;
- get a signed-off internal review.

Check the go/no-go gates early: there is no point building a proposal that cannot win.

## How to run it
Work through the exercises in order. After each one:
1. Record its status: `ex <file> E2 status=Done note="…"`. Put the finding in the note in one or two sentences; the proposal uses it.
2. Run `calc` again whenever an input changes.
3. Tell the user what changed.

They can do the same work, and look at the charts, in the dashboard. Remind them to save there and upload the file back here.

Calculation inputs are the `calc.*` fields. Leave one empty and the engine uses project data, then load data, then the playbook default, in that order. `calc` prints the source of each value. Every "default" still in use is listed in E1. Try to replace each default with project data before the proposal.

### Gates first (run `calc`)
| Gate | Question | If it fails |
|---|---|---|
| G1 | Is gas available at a price where the generation cost is below the grid tariff? | Re-scope: other gas routes (E6), CHP for heat credit (E7), or stop |
| G2 | Can the plant turn down below the site minimum load, or is export allowed? | Smaller units, more units, or an export application |
| G3 | Does the utility permit parallel operation? | Island mode or backup only, or stop |
| G4 | Can the switchboard take the fault current, or is fixing it affordable? | Price the upgrade (`set calc.switchgear_upgrade=…`), add reactors, use another bus or voltage |

If any gate is a clear Fail, tell the user now and agree a changed scope with them before going on.

### The exercises
- **E1 Assumptions log.** Automatic: defaults in use, `unknown` answers, and data requests set to "Fallback used". Add the user's own assumptions: `json <file> push assumptions '{"item":"…","assumption":"…","source":"…","risk":"…"}'`.
- **E2 Load profile.** Import the data (see `load-data.md`). Report:
  - the period and its coverage;
  - peak and absolute minimum, each with its time;
  - minimum during normal operation (the 5th percentile, used for sizing);
  - base load and load factor;
  - annual MWh;
  - weekday against weekend.

  Compare the data with the minimum load the client gave. Explain any big gap: shutdowns, a meter fault, or the client guessing.
- **E3 Tariff.** Confirm the time-of-use bands, then report the load-weighted and blended tariffs and the running window. If the bills give an average all-in cost, cross-check it against the tariff.
- **E4 Sizing and configuration.**
  - Replace the example engine classes with OEM data when it arrives (`json <file> set engine_classes '[…]'`).
  - Agree N or N+1 with the user.
  - Compare the options from `calc`: which pass, the capacity factor from dispatch, the hours stopped for low load.
  - Choose two options with the user: `options <file> <idA> <idB>`.
- **E5 Electrical screening.**
  - C1, C2 and C4 are calculated. Set C3 (bus tie), C5 (earthing and vector group) and C6 (meter and PCC) with the user: `check <file> C3 status=Pass note="…"`.
  - Name the tapping point (`set elec.candidate_bus=…`).
  - Decide whether the switchboard needs an upgrade.
  - Remind the user that a protection engineer must review this (E14).
- **E6 Gas supply.** Fill in the delivered prices for each route (`json <file> set gas_options.1.price 11.5`), then recommend the route.
- **E7 Heat recovery.** Only if there is a heat user (`heat.enabled=Yes`). Report the heat credit. Otherwise mark E7 as "Not applicable", with an electric-only note.
- **E8 Site layout concept.** Agree with the user where the engines, gas station and stack go. Record the footprint, routes, noise and stack notes in E8's note. Offer a simple text sketch.
- **E9 Permits and utility pathway.** List each approval with how long it takes and who owns it, taken from Stage 0 research. Note the critical path, usually the utility approval, in E9's note. Update the schedule rows to match.
- **E10 Cost estimate.** Engine class cost per kW is all-in installed cost. Add site-specific items: `set calc.switchgear_upgrade=… calc.gas_connection=… calc.development=…`. Replace the class costs with the OEM budget quote when it arrives.
- **E11 Business case.**
  - Report LCOE, year-1 saving, payback, IRR and NPV.
  - Report the sensitivities: gas ±20%, tariff ±15%, capex ±20%, utilisation ±15%, availability ±5 points.
  - If the client wants a PPA or is undecided, include the indicative PPA price and the client's saving under it.
  - Set the finance inputs with the user: years, discount rate, escalation, investor IRR.
- **E12 Risk register.** Start from the seven playbook risks. Add the project-specific ones with likelihood, impact and owner (`json <file> push risks '{…}'`).
- **E13 Schedule.** Adjust the default milestones (`json <file> set schedule.6.weeks 70`) to the OEM lead time, the permit durations and the client's timeline.
- **E14 Internal review.** Three sign-offs: protection engineer, commercial review, pricing approval. Record each with `review <file> 1 name="…" date=… status=Approved note="…"`. A reviewer's comments may change the inputs; rerun `calc` after any change.

## Deliverable
`node scripts/btm.mjs docs <file> results --save` (deliverable `s3-results`). Regenerate it after the last change.

## Exit
Every exercise is Done or Not applicable, all three reviews are Approved, and `s3-results` is saved. Then run `stage <file> complete 3`.
