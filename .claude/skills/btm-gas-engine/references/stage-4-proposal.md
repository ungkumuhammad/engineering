# Stage 4 · Proposal package and presentation (weeks 5 to 6)

**Goal:** a proposal the client can say yes to, presenting two options side by side, with a clear ask for the next step: a feasibility study, FEED or a letter of intent.

## Steps
1. **Confirm the offer** with the user:
   - Option A and Option B (`options <file> <idA> <idB>`, and `set s4.option_a=… s4.option_b=…` in words);
   - capex, PPA or both (`s4.offer_type`);
   - the ask: its scope, cost and duration (`s4.next_step`, `s4.next_step_cost`, `s4.next_step_weeks`).
2. **Generate the draft:** `node scripts/btm.mjs docs <file> proposal --save --out <dir>/proposal.md`. The draft holds every number from the file. Lines in _[Agent: …]_ are for you to complete:
   - **Executive summary:** 3 to 4 plain sentences linking the recommendation to the drivers the client gave in Stage 1, in their own words where possible.
   - **Technical solution:** the tapping point and why it was chosen, the protection, the gas route, and heat recovery or electric-only.
   - **Commercial offer:** price basis, validity, exclusions. For a PPA, also the tariff structure, take-or-pay, gas price pass-through, availability guarantee and term.
   - **The ask:** scope of the next step, what the client gets from it, its cost and duration.

   Also add a short "What we assumed" paragraph pointing to the assumptions table. Leave the numbers exactly as generated.

   Save the finished text with `deliverable add <file> s4-proposal <dir>/proposal.md`.
3. **Package checklist.** Go through the `pkg.*` items with the user and tick each one that is in the package:
   - executive summary;
   - options compared;
   - concept SLD;
   - layout;
   - equipment list and budget BoQ;
   - financial model;
   - commercial offer;
   - schedule;
   - risks and assumptions;
   - the ask.

   The concept SLD, layout and equipment list are drawings and documents the TSM produces. Track them here but do not invent them.
4. **`s4-agenda` · Presentation agenda (you write it).**
   1. Recap of the client's objectives (5 min).
   2. The recommendation (10 min).
   3. Options and trade-offs (15 min).
   4. Economics and sensitivities (15 min).
   5. Risks and assumptions (10 min).
   6. Decision and next steps (5 min).

   Add a one-line speaking note per item, and list the likely objections with a short answer to each. Draw the objections from the sensitivities and the risk register: gas price, utility approval, the fault level, the first unit's lead time.
5. **Practical tips** to give the user before the meeting:
   - Do not promise firm savings beyond what the load profile and a confirmed gas price support. Show the range.
   - The OEM has confirmed the site-rated output and gas needs, or the proposal says it has not yet.
   - The protection engineer has reviewed the tapping point (E14).
6. **After the presentation**, record `s4.presentation_date`, `s4.decision` and `s4.decision_notes`. Then write **`s4-decision` · Decision record**, covering:
   - the decision and who made it;
   - conditions and follow-ups, each with an owner and a date;
   - what changes in scope;
   - the next stage of work: the FEED or feasibility scope, or the reason the client declined and what would reopen it.

## Exit
Required answers are recorded and the three deliverables are saved. Then run `stage <file> complete 4`. The project file is now the full record of the pre-sales work. Remind the user to save it, and to keep it with the FEED or feasibility kickoff documents.
