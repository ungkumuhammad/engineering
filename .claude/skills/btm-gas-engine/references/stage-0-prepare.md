# Stage 0 · Before the first meeting (about 1 week)

**Goal:** walk into the discovery meeting knowing the site, the tariff, the gas situation and the rules, with a ballpark size and savings range, and with the client already sending the basics.

## Order of work

Run `node scripts/btm.mjs fields <file> --stage 0 --missing` and work through the groups in this order. Ask one group at a time.

1. **Project and people.** Project name, client, industry, site name, client contact, TSM name, account lead, target meeting date, currency.
2. **Site location and climate.** City and country first. Then offer to look up the altitude and the hot-day design temperature (1% cooling design temperature for the nearest weather station). Confirm both with the user before recording them. Above 500 m and above 30 °C the engine derates, so these matter.
3. **Utility and tariff.** Utility name, tariff class, average energy charge (in the project currency per MWh), demand charge per kW-month, whether there are time-of-use bands, and the source. If the tariff has peak and off-peak bands, record them as `tariff_periods`:
   `node scripts/btm.mjs json <file> push tariff_periods '{"name":"Peak","rate":140,"days":"weekday","from":8,"to":22}'`
   Rates are per MWh. Convert from per-kWh by × 1000. Hours run from `from` up to `to`, and may wrap past midnight.
4. **Gas.** Availability (pipeline at site, nearby, none, unknown), distributor, indicative industrial gas price per MMBtu (HHV), LHV and methane number if known. Convert the price if it is quoted per GJ (× 1.055 gives per MMBtu) or per kWh.
5. **Rules and permits.** Is parallel operation allowed, is export allowed, is a licence needed, and which emission and noise limits apply.
6. **Client operations.** Shifts, expansion plans, any size they mentioned.
7. **First look from the bills.** Maximum demand (kW) and annual consumption (MWh). If the user has the bills as a table, import them with `bills`. If they already have interval data, import it with `load` now: the hypothesis gets much better.
8. **Pre-meeting request and meeting pack.** Record the date the short request was sent, what has arrived, and the meeting pack checklist.

Only ask the user what you cannot find. For each answer they don't have, record `unknown` with the playbook fallback (shown by `fields`).

## Deliverables

Write these four and save each with `deliverable add`.

### `s0-brief` · Desk research brief (you write it)
A one-page brief for the TSM to read before the meeting:
- Client and site in two lines.
- Utility, tariff class, energy and demand charges, time-of-use bands, with sources.
- Gas: availability, supplier, indicative price, with sources.
- Rules: parallel operation, export, licence, emissions.
- Climate and altitude, and the derate they imply (from `calc`).
- The three biggest unknowns, and how the meeting will close them.

### `s0-request` · Pre-meeting data request email (you write it)
A short email asking for four things only:
1. The last 12 months of electricity bills.
2. The single line diagram, whatever version they have.
3. A site plan.
4. Any load data they already have (BMS, SCADA or utility portal export).

Use a friendly tone and keep it to about 120 words, with no jargon. Give a date that is two working days before the meeting.

### `s0-hypothesis` · First hypothesis (generated)
`node scripts/btm.mjs docs <file> hypothesis --save`. Read it, then tell the user:
- the indicative configuration;
- the generation cost against the tariff;
- the payback range;
- the defaults still in use.

It is a ballpark only, never a promise. If no option passes, say which check fails and what would fix it.

### `s0-pack` · Meeting pack checklist (you write it)
A checklist the TSM ticks before leaving:
- the playbook one-pager;
- 2 or 3 reference projects (ask the user which);
- the typical configurations sheet (1×10, 2×5, 3×3.3, 4×2.5 MW);
- the indicative generation cost per MWh from the hypothesis;
- an NDA if needed;
- PPE, a camera and a torch for the site walk.

Who goes: the TSM and the account lead, plus an electrical engineer if the client's electrical engineer will attend.

## Exit
`status` shows no missing required fields, and all four deliverables are saved. Then:
1. Run `stage <file> complete 0`.
2. Remind the user to save the file.
3. Offer to generate the Stage 1 meeting pack.
