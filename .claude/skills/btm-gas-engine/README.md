# BTM gas engine project skill

Takes a behind-the-meter gas engine project from first client contact to proposal, in five stages:

| Stage | What happens |
|---|---|
| 0 Prepare | Desk research, pre-meeting request, first hypothesis |
| 1 Discover | Meeting pack, then a debrief and meeting notes |
| 2 Request data | Formal data request and tracker |
| 3 Analyse | Exercises E1 to E14, go/no-go gates, internal review |
| 4 Propose | Proposal draft, presentation agenda, decision record |

Everything for a project lives in one file, `<name>.btm.json`. Save it, and upload it again to continue.

## Start a project
- **Claude Code, in this repository:** type `/btm-gas-engine` and say "new project", or attach a `.btm.json` file and say "continue".
- **As a dedicated agent (CLI):** `claude --agent btm-solution-manager`. Claude can also hand the work to the `btm-solution-manager` subagent. As a subagent it cannot ask you questions mid-task, so it returns them at the end.

## Dashboard
Open `assets/dashboard.html` in any browser; it works offline and from disk. It opens and saves the same project file and has:
- load data import and analysis (E2);
- tariff (E3), sizing and dispatch (E4), electrical screening (E5), gas and heat (E6, E7), cost and business case (E10, E11);
- registers (E1, E12, E13, E14);
- deliverables.

The agent copies the dashboard next to each project file with `node scripts/btm.mjs dashboard <path>`.

## For maintainers
| Path | Purpose |
|---|---|
| `scripts/engine.js` | The single calculation engine and question catalogue, shared by the CLI and the dashboard |
| `scripts/btm.mjs` | Command line tool used by the agent (Node 18+, no dependencies) |
| `scripts/dashboard.src.html` | Dashboard source. After editing it or `engine.js`, run `node scripts/build_dashboard.mjs` to rebuild `assets/dashboard.html` |
| `scripts/test_engine.mjs` | Tests: `node scripts/test_engine.mjs` |
| `assets/sample_load_hourly.csv`, `assets/sample_bills.csv` | Synthetic sample data, from `scripts/make_sample.mjs` |

Calculation rules follow the BTM Gas Engine Playbook; see `references/playbook.md`.
