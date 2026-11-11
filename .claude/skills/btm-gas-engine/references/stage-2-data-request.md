# Stage 2 · Formal data request (send within 48 hours)

**Goal:** a written request with an owner and a due date for each item, tracked until every item is received or replaced by its fallback.

## Steps
1. Show the ten default items (`json <file> get data_request`). Update the owners and due dates to what was agreed in the meeting:
   `node scripts/btm.mjs dr <file> DR1 owner="Client (Mr Tan, facilities)" due=2026-11-20 status=Requested`
   If an item does not apply (for example DR8 thermal data when there is no heat user), set `status="Not needed"`. If the meeting added an item, push a row with a new id:
   `json <file> push data_request '{"id":"DR11","item":"…","why":"…","owner":"…","due":"…","status":"Requested","received":"","note":"","fallback":"…","ex":"E5"}'`
2. Record `s2.sent_to`, then generate the request: `node scripts/btm.mjs docs <file> data-request --save` (deliverable `s2-request`). It contains the table, the fallbacks and an email draft. Read the email and polish the tone if the user asks. Offer the CSV version: `docs <file> data-request-csv --out <path>.csv`.
3. Once the user has sent it, record `s2.sent_date`.

## Tracking (this can overlap with Stage 3)
Each time the user comes back, ask what has arrived since last time. Update the status of each row:

| Status | When to use it |
|---|---|
| `Received` | The item arrived complete |
| `Partial` | Part of the item arrived (for example 3 months of load data instead of 12) |
| `Fallback used` | The item will not arrive. Write the fallback in `note`, which feeds the E1 assumptions log |
| `Not needed` | The item does not apply |

Import data as soon as it arrives. Load data goes in with `load` (see `load-data.md`). Use `set` for nameplate values, the utility fault level, relay data and the gas price.

**Do not wait for every item.** The playbook rule is to keep moving: use the fallback and record it. The utility fault level (DR3) often arrives last. Use the transformer estimate and mark the fault results "preliminary, subject to utility data".

## Exit
`s2.sent_date` is recorded, and every row is Received, Partial, Fallback used or Not needed. Stage 3 may start while the last items are still outstanding, but only if the user asks. In that case complete Stage 2 with `--reason` listing what is still outstanding.
