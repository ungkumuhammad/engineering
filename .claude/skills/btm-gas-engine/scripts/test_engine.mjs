// Tests for engine.js and the CLI. Run: node scripts/test_engine.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const B = require('./engine.js');
const here = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('FAIL ' + name); } }
function near(a, b, tol, name) { ok(Math.abs(a - b) <= tol, name + ' (got ' + a + ', want ' + b + ')'); }

// --- playbook numbers
{
  const p = B.newProject({ name: 'T' });
  B.setField(p, 'elec.connection_kv', 11); B.setField(p, 'elec.tx_mva', 20); B.setField(p, 'elec.tx_z_pct', 10); B.setField(p, 'elec.grid_fault_mva', 500); B.setField(p, 'elec.motor_ka', 1.5);
  const r = B.resolveInputs(p, null);
  near(r.v.ifault, 9.0, 0.05, 'utility 7.5 kA + motors 1.5 kA');
  // 12.5 MVA generator at 11 kV, X"d 15% -> 4.4 kA
  near(12.5 / (Math.sqrt(3) * 11 * 0.15), 4.37, 0.01, 'generator contribution');
  near(B.pAtLeast(3, 2, 0.95), 0.99275, 1e-5, 'binomial availability');
  // derate: 35 C, 50 m, MN 75 -> 5%
  const a = B.analyse(p);
  near(a.derate.pct, 5, 1e-9, 'derate rule');
  near(a.options.find((o) => o.c.mw === 3.3).genCost, 6 * 3.412 * 1.108 / 0.43 + 13, 1e-9, 'generation cost formula');
  ok(a.options.length === 5 && a.gates.length === 4, 'five classes, four gates');
}
// --- finance helpers
near(B.irr([-100, 60, 60]), 0.1307, 1e-3, 'irr');
near(B.npv(0.1, [-100, 110]), 0, 1e-9, 'npv');
near(B.crf(0.1, 10), 0.16275, 1e-4, 'crf');

// --- CSV parsing variants
{
  const iso = B.parseLoadCsv('time,kW\n2025-01-01 00:00,100\n2025-01-01 00:15,200\n2025-01-01 00:30,300\n');
  ok(iso.interval_min === 15 && iso.points[1].kw === 200, 'ISO 15-min kW');
  const dmy = B.parseLoadCsv('Date;Time;Energy kWh\n13/01/2025;00:00;25,5\n13/01/2025;00:30;30\n13/01/2025;01:00;35\n');
  ok(dmy.unit === 'kWh' && dmy.interval_min === 30 && Math.abs(dmy.points[0].kw - 51) < 1e-9, 'date+time columns, ; delimiter, decimal comma, kWh -> kW');
  ok(new Date(dmy.points[0].t).getUTCDate() === 13, 'DMY detected');
  const mdy = B.parseLoadCsv('ts,MW\n01/13/2025 1:00 PM,5\n01/13/2025 2:00 PM,6\n01/13/2025 3:00 PM,7\n');
  ok(mdy.unit === 'MW' && mdy.points[0].kw === 5000 && new Date(mdy.points[0].t).getUTCHours() === 13, 'MDY with AM/PM, MW');
  let threw = false; try { B.parseLoadCsv('a,b\nx,y\nz,w\n'); } catch (e) { threw = true; } ok(threw, 'rejects non-date file');
}
// --- import, merge, gaps
{
  const p = B.newProject({ name: 'T' });
  B.importLoad(p, B.parseLoadCsv('t,kW\n2025-01-01 00:00,1000\n2025-01-01 01:00,2000\n2025-01-01 02:00,3000\n'), 'a');
  B.importLoad(p, B.parseLoadCsv('t,kW\n2025-01-01 02:00,3500\n2025-01-01 04:00,5000\n2025-01-01 05:00,6000\n'), 'b');
  ok(p.load.kw.length === 6 && p.load.kw[2] === 3500 && p.load.kw[3] === null, 'merge overrides, gap is null');
  const s = B.loadStats(p.load);
  near(s.peak, 6, 1e-9, 'peak MW'); near(s.coverage, 5 / 6, 1e-9, 'coverage');
}
// --- sample year end to end
{
  const p = B.newProject({ name: 'T', currency: 'USD' });
  B.importLoad(p, B.parseLoadCsv(readFileSync(join(here, '../assets/sample_load_hourly.csv'), 'utf8')), 'sample');
  const a = B.analyse(p);
  ok(a.ls.points === 8760 && !a.ls.short_record, 'sample year loaded');
  ok(a.src.minload.indexOf('5th percentile') >= 0 && a.v.minload > 5 && a.v.minload < 6, 'minimum load from 5th percentile');
  const o = a.ranked[0];
  ok(o.dispatch.genMWh > 0 && o.dispatch.genMWh < a.ls.annual_mwh, 'dispatch energy below site energy');
  ok(o.dispatch.cf > 0 && o.dispatch.cf < 1, 'capacity factor in range');
  ok(o.econ.capex > 0 && o.econ.year1 > 0 && o.econ.irr > 0, 'economics positive for sample');
  ok(B.resultsMd(p, a).includes('E11 Business case') && B.proposalMd(p, a).includes('The ask'), 'markdown generators');
  // serialization round trip
  const back = B.parseProject(B.serialize(p));
  ok(back.load.kw.length === 8760 && back.results === undefined, 'round trip');
}
// --- stage gating
{
  const p = B.newProject({ name: 'T' });
  let threw = false; try { B.setStage(p, 2, 'start'); } catch (e) { threw = true; } ok(threw, 'cannot start stage 2 before 0 and 1');
  threw = false; try { B.setStage(p, 0, 'complete'); } catch (e) { threw = true; } ok(threw, 'cannot complete with open items without reason');
  threw = false; try { B.setStage(p, 0, 'skip'); } catch (e) { threw = true; } ok(threw, 'skip needs a reason');
  B.setStage(p, 0, 'skip', 'User already met the client');
  ok(p.stages[0].status === 'skipped' && p.current_stage === 1 && p.stages[1].status === 'in_progress', 'skip advances');
  threw = false; try { B.setField(p, 'gas.availability', 'nonsense'); } catch (e) { threw = true; } ok(threw, 'select validation');
  B.setUnknown(p, 'site.altitude_m', 'no map access');
  ok(B.answered(p, 'site.altitude_m') && B.analyse(p).assumptions.some((x) => /altitude/i.test(x.item)), 'unknown counts as answered and is logged');
}
// --- CLI smoke
{
  const dir = mkdtempSync(join(tmpdir(), 'btm-'));
  const cli = (...a) => execFileSync(process.execPath, [join(here, 'btm.mjs'), ...a], { encoding: 'utf8' });
  const file = cli('new', dir, '--name', 'CLI test', '--currency', 'USD').trim();
  cli('set', file, 'site.altitude_m=600', 'obj.drivers=Lower energy cost;Sustainability');
  cli('load', file, join(here, '../assets/sample_load_hourly.csv'));
  ok(cli('calc', file).includes('Options (best first)'), 'cli calc');
  cli('docs', file, 'hypothesis', '--save');
  ok(JSON.parse(readFileSync(file, 'utf8')).deliverables.length === 1, 'cli saves deliverable');
  ok(JSON.parse(cli('get', file, 'site.altitude_m')) === 600, 'cli get');
}
// --- dashboard freshness
{
  const engine = readFileSync(join(here, 'engine.js'), 'utf8');
  const built = existsSync(join(here, '../assets/dashboard.html')) ? readFileSync(join(here, '../assets/dashboard.html'), 'utf8') : '';
  const src = readFileSync(join(here, 'dashboard.src.html'), 'utf8');
  ok(built === src.split('/*__ENGINE__*/').join(engine), 'assets/dashboard.html is up to date (run node scripts/build_dashboard.mjs)');
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
