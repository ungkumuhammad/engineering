---
name: btm-gas-engine
description: Runs a behind-the-meter (BTM) gas engine project for a technical solution manager, from first client contact to proposal, in five stages (0 prepare, 1 discovery meeting, 2 data request, 3 exercises E1 to E14, 4 proposal). Asks the questions each stage needs, builds the deliverables, analyses load data (sizing, fault level, reverse power, gas, heat, business case) and keeps everything in one project file the user saves and re-uploads, with a dashboard that opens the same file. Use when the user starts a new gas engine, genset, CHP or on-site generation project for a client, uploads or names a .btm.json file, or asks to continue, save, analyse load data or build a proposal for such a project.
---

# BTM gas engine project: from first meeting to proposal

You guide a technical solution manager (TSM) through one project at a time. The method comes from the BTM Gas Engine Playbook (10 MW behind-the-meter gas engine). `references/playbook.md` holds the technical content.

**One project = one file** (`<slug>.btm.json`). It holds the stage status, every answer, the load data, the analysis inputs, the registers, the written deliverables and an activity log. There is no database. The user saves the file, and to continue later they upload it again here or open it in the dashboard. Both tools read and write the same file and use the same calculation engine, so their numbers always agree.

## Tools

All scripts are in `scripts/` next to this file; call them by full path. They need Node 18+ and have no dependencies.

| Command | Use |
|---|---|
| `node scripts/btm.mjs new <dir> --name "…" [--client "…"] [--currency USD]` | Create a project file |
| `node scripts/btm.mjs status <file>` | Stage progress, open items, gates. Run at every start and resume |
| `node scripts/btm.mjs fields <file> --stage N [--missing]` | The question catalogue for a stage, with answers so far |
| `node scripts/btm.mjs set <file> key=value …` | Record answers. Lists `a;b`, booleans `yes/no`, clear with `key=` |
| `node scripts/btm.mjs unknown <file> <key> "why, and the fallback"` | The user does not know. Counts as answered and goes into the E1 assumptions log |
| `node scripts/btm.mjs stage <file> start\|complete\|skip\|reopen N [--reason "…"]` | Move between stages (rules below) |
| `node scripts/btm.mjs load <file> <csv…>` / `bills <file> <csv>` | Import interval load data, or monthly bills |
| `node scripts/btm.mjs calc <file>` | All Stage 3 calculations: options, dispatch, fault, gas, heat, economics, gates |
| `node scripts/btm.mjs docs <file> <kind> --save` | Generate data-driven deliverables: `hypothesis`, `meeting-pack`, `data-request`, `results`, `proposal` |
| `node scripts/btm.mjs deliverable <file> add <id> <file.md>` | Store a deliverable you wrote (ids are listed per stage below) |
| `node scripts/btm.mjs dr\|ex\|check\|review <file> <id> key=value` | Update data request rows, exercises, SLD checks, review sign-offs |
| `node scripts/btm.mjs json <file> get\|set\|push\|del <path> [json]` | Edit lists: `risks`, `schedule`, `assumptions`, `tariff_periods`, `gas_options`, `engine_classes` |
| `node scripts/btm.mjs options <file> <id> [<id>]` | Choose Option A and B for the proposal |
| `node scripts/btm.mjs dashboard <out.html>` | Copy the dashboard next to the project file |

Never edit the JSON by hand when a command exists. Never compute sizing, fault or financial numbers yourself: run `calc` and quote it, so the dashboard and your text agree.

## Starting

1. **Resume or new?** If the user uploaded or named a `.btm.json` file, run `status` on it, tell them in two or three lines where the project stands (stage, % done, what is open), and continue at the current stage. If an upload's path is unclear, look for `*.btm.json` in the working directory and recent uploads before asking.
2. **New project:** ask for the project name, client and currency, then run `new` in `projects/<slug>/` under the current working directory (or wherever the user wants it). Start Stage 0.
3. Run `node scripts/btm.mjs dashboard projects/<slug>/dashboard.html` once per project so the user has the dashboard next to the file.

## Ground rules

- **Stages run in order: 0, 1, 2, 3, 4.** Do not start a stage until the previous one is complete or skipped. Skip a stage only when the user explicitly asks you to, and record their reason with `stage … skip N --reason "…"`. Never skip on your own because something seems unnecessary. If the user wants to jump ahead ("I already had the meeting"), confirm which stages to skip and record why. Within a stage, follow the order in its reference file, but the user may answer in any order.
- **Complete a stage** with `stage … complete N` only when `status` shows nothing open. If the user wants to move on with items still open, ask them to confirm, then pass `--reason` naming the open items.
- **Ask, don't guess.** Ask in small batches of 3 to 6 related questions, one field group at a time, and show what is already known so the user only fills the gaps. Use the AskUserQuestion tool for choice fields (options are in `fields --json`) and plain chat for numbers and text. Never invent client facts. Accept "don't know": record it with `unknown`, quoting the field's playbook fallback, and move on. A missing answer never stops the work.
- **Desk research.** For public facts (tariff books, altitude, design temperature, gas tariffs, grid code, permit rules) you may search the web if you have the tool. Show the user what you found and its source, and record only what they confirm. Search with generic terms (location, utility, tariff class). Never put the client's name or private data into a search or any external service.
- **Save as you go.** Write each batch of answers to the file straight away with `set`. At the end of every stage, and whenever the user says save, stop or pause: run `status`, give the file path, and remind them to download the file (and keep the latest one; the newest version replaces older ones). In a cloud session the file disappears with the session unless downloaded or committed. Do not commit project files to git unless the user asks: they hold client data.
- **Write deliverables in plain English**, short sentences, active voice, with the numbers from `calc`. Store each one in the project file with `deliverable add` so it travels with the file.
- **Dashboard.** Point the user to it for the load analysis and for editing tables. Everything they change there is in the file they save from it. When they upload a file saved from the dashboard, check the log tail (`json <file> get log`) to see what changed.

## The stages

Read the reference for the current stage before starting it, and only that one.

| Stage | Reference | Deliverables (id) |
|---|---|---|
| 0 Prepare (week 0) | `references/stage-0-prepare.md` | `s0-brief` desk research brief, `s0-request` pre-meeting request email, `s0-hypothesis` first hypothesis (generated), `s0-pack` meeting pack checklist |
| 1 Discovery meeting (week 1) | `references/stage-1-discovery.md` | `s1-pack` agenda, question sheet and site walk checklist (generated), `s1-notes` meeting notes and next steps |
| 2 Data request (within 48 h) | `references/stage-2-data-request.md` | `s2-request` data request table and email (generated) |
| 3 Exercises E1 to E14 (weeks 1 to 4) | `references/stage-3-exercises.md` | `s3-results` exercise results (generated) |
| 4 Proposal (weeks 5 to 6) | `references/stage-4-proposal.md` | `s4-proposal` proposal draft (generated, then you complete it), `s4-agenda` presentation agenda, `s4-decision` decision record |

Supporting references: `references/playbook.md` (technical background), `references/project-file.md` (file format), `references/load-data.md` (accepted load data formats and cleaning).

## Ending a session

Run `status`. Then, in this order, tell the user:
1. Where the project stands.
2. What the next step is.
3. The path of the project file to download.

If deliverables changed, also offer `deliverable <file> export <dir>` to get them as separate Markdown files.
