# Stage 1 · Discovery meeting (2 to 3 hours plus a site walk)

**Goal:** leave the meeting with:
- the client's four objective answers;
- the electrical facts from the SLD;
- the commercial picture;
- a site walk record;
- an agreed data request, with an owner and a date for each item.

Stage 1 has two parts: before the meeting and after it.

## Before the meeting
1. Generate the pack: `node scripts/btm.mjs docs <file> meeting-pack --save` (deliverable `s1-pack`). It holds the agenda, what is already known, a question sheet that lists the unanswered items first, the key questions, the site walk checklist and what to bring.
2. Go through it with the user. Offer to tailor the key questions to the industry; a cold store, a glove factory and a data centre each have different critical loads.
3. Record `s1.meeting_date`. Then pause: tell the user to come back after the meeting, and remind them to save the file.

## After the meeting: debrief
Ask the user to tell you how it went, in their own words or by pasting their notes. Then fill the gaps one group at a time (`fields <file> --stage 1 --missing`):

1. **Meeting:** date and attendees.
2. **The four answers:**
   - Why do they want it (drivers)?
   - How will it run (operating mode, grid parallel or stand-alone)?
   - Export or no export?
   - Gas source?

   If the client was unsure, the playbook default is grid-parallel, zero export, baseload during production hours, pipeline gas. Record that, and say it will be stated as an assumption in the proposal.
3. **Operations:**
   - The lowest site load (this sets the zero-export limit).
   - Peak load and shifts.
   - Critical loads.
   - Outages.
   - Power quality.
   - Large motors.
   - Growth plans.
4. **Electrical, from the SLD walk-through:**
   - Connection voltage.
   - Candidate bus.
   - Spare bay.
   - Switchboard rating.
   - Transformer MVA and %Z.
   - Utility fault level.
   - Motor contribution.
   - Bus tie.
   - Incomer and busbar ratings.
   - Relays and the last protection study.
   - Any utility restrictions.

   If the user has photos of nameplates, read them and propose the values.
5. **Gas and thermal:** pressure, tie-in point, heat user, heat type, demand and hours.
6. **Commercial:** capex or PPA, payback or IRR hurdle, decision maker, budget cycle, timeline, what would make it fail.
7. **Site walk checklist** and its notes.
8. **Next steps:** data owners agreed, and the proposal meeting date.

After the electrical answers, run `calc` and tell the user immediately about any red flag:
- The fault level is over the switchboard rating.
- The lowest stable output is above the minimum load.
- No spare bay.
- The utility does not allow parallel operation.

These change the scope and the price, so flag them now, not in week 4.

## `s1-notes` · Meeting notes and agreed next steps (you write it)
Structure:
1. Attendees and date.
2. The client's objective in their own words, then the four answers.
3. Key facts learned: operations, electrical, gas and heat, commercial.
4. Red flags found so far, from `calc`.
5. Agreed next steps: data request items with owner and date, and the proposal meeting date.
6. Open questions.

The notes can go to the client, so keep them factual. Save with `deliverable add <file> s1-notes notes.md`.

## Exit
Required answers are recorded and `s1-notes` is saved. Then run `stage <file> complete 1` and move on to the formal data request. It should go out within 48 hours.
