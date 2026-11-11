#!/usr/bin/env node
// Command line tool for BTM gas engine project files (*.btm.json).
// Uses the same engine as the dashboard. Node 18+, no dependencies.
// Run with no arguments for help.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const B = require('./engine.js');
const WHO = process.env.BTM_WHO || 'agent';

const HELP = `btm.mjs: BTM gas engine project files

  new <dir> --name "Project" [--client "Co"] [--currency USD]   create <dir>/<slug>.btm.json
  status <file> [--json]                    stages, % done, open items, gates
  fields <file> [--stage N] [--missing] [--json]   question catalogue with current answers
  set <file> key=value [key=value ...]      set answers (lists: a;b;c   booleans: yes/no   clear: key=)
  unknown <file> <key> "note"               record that an answer is unknown (counts as answered, logged in E1)
  get <file> <key>
  stage <file> start|complete|skip|reopen <N> [--reason "..."]
  load <file> <csv> [more.csv] [--unit kW|MW|kWh|MWh] [--date-order dmy|mdy] [--column name|index] [--replace]
  bills <file> <csv>                        monthly bills: month,kWh,max_kW[,cost]
  calc <file> [--json]                      run every Stage 3 calculation and print the results
  docs <file> <kind> [--out file.md] [--save]
        kinds: status | hypothesis | meeting-pack | data-request | data-request-csv | results | proposal
        --save stores it in the project file as that stage's deliverable
  deliverable <file> add <id> <file.md> [--title "..."] [--stage N]
  deliverable <file> list
  deliverable <file> export <dir>           write every deliverable to <dir>/<id>.md
  dr <file> <DRn> key=value ...             update a data request row (status, received, note, owner, due)
  ex <file> <En> key=value ...              update an exercise (status, note)
  check <file> <Cn> key=value ...           update an SLD check (status, note)
  review <file> <index> key=value ...       update an E14 review row (name, date, status, note); index from 1
  json <file> get|set|push|del <path> [json]   edit any part, e.g. risks, schedule, assumptions, tariff_periods
  options <file> <id> [<id>]                choose the options for the proposal (ids from calc, e.g. 7x2)
  dashboard <out.html>                      copy the dashboard next to the project file
  validate <file>
`;

function die(msg) { console.error('Error: ' + msg); process.exit(1); }
function flags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const nxt = args[i + 1];
      if (nxt === undefined || nxt.startsWith('--')) out[k] = true; else { out[k] = nxt; i++; }
    } else out._.push(a);
  }
  return out;
}
function load(file) {
  if (!file) die('Give the project file path.');
  if (!existsSync(file)) die('No such file: ' + file);
  try { return B.parseProject(readFileSync(file, 'utf8')); } catch (e) { die(e.message); }
}
function save(file, p) {
  const tmp = file + '.tmp';
  writeFileSync(tmp, B.serialize(p));
  renameSync(tmp, file);
}
function kv(list) {
  return list.map((s) => {
    const i = s.indexOf('=');
    if (i < 0) die('Expected key=value, got "' + s + '"');
    return [s.slice(0, i).trim(), s.slice(i + 1)];
  });
}
function pct(x) { return B.fmt(100 * x, 0) + '%'; }
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[/^\d+$/.test(k) ? +k : k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k) => { const kk = /^\d+$/.test(k) ? +k : k; if (o[kk] === undefined) o[kk] = {}; o = o[kk]; });
  o[/^\d+$/.test(keys.at(-1)) ? +keys.at(-1) : keys.at(-1)] = value;
}

const DOC_MAP = {
  hypothesis: { id: 's0-hypothesis', stage: 0, title: 'First hypothesis (ballpark)', fn: (p) => B.hypothesisMd(p) },
  'meeting-pack': { id: 's1-pack', stage: 1, title: 'Meeting agenda, question sheet and site walk checklist', fn: (p) => B.meetingPackMd(p) },
  'data-request': { id: 's2-request', stage: 2, title: 'Formal data request (table and email)', fn: (p) => B.dataRequestMd(p) },
  'data-request-csv': { id: null, fn: (p) => B.dataRequestCsv(p) },
  results: { id: 's3-results', stage: 3, title: 'Exercise results summary (E1 to E14)', fn: (p) => B.resultsMd(p) },
  proposal: { id: 's4-proposal', stage: 4, title: 'Proposal package (draft)', fn: (p) => B.proposalMd(p) },
  status: { id: null, fn: (p) => B.statusMd(p) }
};

function printStatus(p, json) {
  const a = B.analyse(p);
  const stages = B.STAGES.map((s) => ({ n: s.n, title: s.title, status: p.stages[s.n].status, skip_reason: p.stages[s.n].skip_reason, progress: B.stageProgress(p, s.n) }));
  if (json) { console.log(JSON.stringify({ current_stage: p.current_stage, stages, gates: a.gates }, null, 1)); return; }
  console.log(B.statusMd(p));
  console.log('Gates: ' + a.gates.map((g) => g.id + ' ' + g.status).join(' · '));
  if (p.load) console.log('Load data: ' + p.load.kw.length + ' intervals of ' + p.load.interval_min + ' min from ' + p.load.start);
  console.log('Deliverables saved: ' + (p.deliverables.map((d) => d.id).join(', ') || 'none'));
}

function printFields(p, f) {
  const stages = f.stage !== undefined ? [B.STAGES[+f.stage]] : B.STAGES;
  const out = [];
  stages.forEach((s) => s.groups.forEach((g) => g.fields.forEach((fd) => {
    const has = B.answered(p, fd.k);
    if (f.missing && has) return;
    out.push({ key: fd.k, stage: s.n, group: g.title, label: fd.l, type: fd.t, unit: fd.u, required: fd.req, options: fd.opts, help: fd.help, fallback: fd.fb,
      value: p.fields[fd.k] ?? null, unknown: p.unknown[fd.k] ?? null });
  })));
  if (f.json) { console.log(JSON.stringify(out, null, 1)); return; }
  let lastG = '';
  out.forEach((x) => {
    if (x.group !== lastG) { console.log('\n## Stage ' + x.stage + ' · ' + x.group); lastG = x.group; }
    const v = x.unknown ? 'UNKNOWN (' + x.unknown + ')' : (x.value === null ? '—' : Array.isArray(x.value) ? x.value.join('; ') : String(x.value));
    console.log((x.required ? '* ' : '  ') + x.key + ' = ' + v + '   [' + x.label + (x.unit ? ', ' + x.unit : '') + (x.options ? ', options: ' + x.options.join(' | ') : '') + ']');
  });
}

function printCalc(p, json) {
  const a = B.analyse(p);
  if (json) { console.log(JSON.stringify(B.snapshot(a), null, 1)); return; }
  const c = p.fields['meta.currency'] || '';
  console.log('Inputs (source):');
  ['target', 'red', 'peak', 'minload', 'ambient', 'alt', 'mn', 'vconn', 'ifault', 'rating', 'gas', 'tariff', 'avail'].forEach((k) => {
    const v = a.v[k];
    console.log('  ' + k.padEnd(9) + ' ' + String(typeof v === 'number' ? B.fmt(v, 2) : v).padEnd(10) + ' ' + a.src[k]);
  });
  console.log('Derate ' + B.fmt(a.derate.pct, 1) + '%');
  if (a.ls) console.log('Load: peak ' + B.fmt(a.ls.peak, 2) + ' MW, min ' + B.fmt(a.ls.min_abs, 2) + ', 5th pct ' + B.fmt(a.ls.p05, 2) + ', mean ' + B.fmt(a.ls.mean, 2) + ', ' + B.fmt(a.ls.annual_mwh, 0) + ' MWh/yr, coverage ' + pct(a.ls.coverage));
  console.log('\nOptions (best first):');
  a.ranked.forEach((o) => {
    console.log('  [' + o.id + '] ' + o.label.padEnd(18) + (o.pass ? 'PASS ' : 'fail ') +
      'floor ' + B.fmt(o.floor, 2) + ' MW, fault ' + B.fmt(o.iTot, 1) + ' kA, avail ' + pct(o.avail) +
      ', gen ' + B.fmt(o.dispatch.genMWh, 0) + ' MWh, CF ' + pct(o.dispatch.cf) + ', cost ' + B.fmt(o.genCost, 1) + '/MWh, capex ' + B.fmtMoney(o.econ.capex, c) +
      ', yr1 ' + B.fmtMoney(o.econ.year1, c) + ', payback ' + (o.econ.simplePayback ? B.fmt(o.econ.simplePayback, 1) + ' yr' : 'none') +
      ', IRR ' + (o.econ.irr !== null ? pct(o.econ.irr) : 'n/a'));
  });
  console.log('\nSelected for the proposal: ' + a.selected.map((o) => o.id).join(', '));
  console.log('Gates:');
  a.gates.forEach((g) => console.log('  ' + g.id + ' ' + g.status.padEnd(8) + g.title + ' — ' + g.detail));
  console.log('Auto assumptions (E1): ' + a.assumptions.length);
  a.assumptions.forEach((x) => console.log('  - ' + x.item + ': ' + x.assumption + ' (' + x.source + ')'));
}

function updateRow(p, list, id, pairs, allowed, label) {
  const row = typeof id === 'number' ? p[list][id] : p[list].find((r) => r.id.toLowerCase() === String(id).toLowerCase());
  if (!row) die('No ' + label + ' ' + id);
  kv(pairs).forEach(([k, v]) => {
    if (!allowed.includes(k)) die(label + ' fields: ' + allowed.join(', '));
    if (k === 'status') {
      const opts = { data_request: B.DR_STATUS, exercises: B.EX_STATUS, checks: B.CHECK_STATUS, review: ['Pending', 'Approved', 'Changes requested'] }[list];
      const hit = opts.find((o) => o.toLowerCase() === v.toLowerCase()) || opts.find((o) => o.toLowerCase().startsWith(v.toLowerCase()));
      if (!hit) die('Status options: ' + opts.join(' | '));
      v = hit;
    }
    row[k] = v;
  });
  B.addLog(p, 'Updated ' + label + ' ' + (row.id || row.role) + ': ' + pairs.join(', '), WHO);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const f = flags(rest);
  const file = f._[0];
  switch (cmd) {
    case undefined: case 'help': case '--help': console.log(HELP); return;
    case 'new': {
      const dir = f._[0] || '.';
      if (!f.name) die('--name is required');
      const p = B.newProject({ name: f.name, client: f.client, currency: f.currency, by: WHO });
      mkdirSync(dir, { recursive: true });
      const out = join(dir, B.fileName(p));
      if (existsSync(out) && !f.force) die(out + ' exists. Use --force to overwrite.');
      save(out, p);
      console.log(resolve(out));
      return;
    }
    case 'status': printStatus(load(file), f.json); return;
    case 'fields': printFields(load(file), f); return;
    case 'get': { const p = load(file); const k = f._[1]; console.log(JSON.stringify(p.fields[k] ?? (p.unknown[k] ? 'UNKNOWN: ' + p.unknown[k] : null))); return; }
    case 'set': {
      const p = load(file);
      const pairs = kv(f._.slice(1));
      const errs = [];
      pairs.forEach(([k, v]) => { try { B.setField(p, k, v, WHO); } catch (e) { errs.push(e.message); } });
      if (errs.length) die(errs.join('\n'));
      save(file, p);
      pairs.forEach(([k]) => console.log(k + ' = ' + JSON.stringify(p.fields[k] ?? null)));
      return;
    }
    case 'unknown': { const p = load(file); B.setUnknown(p, f._[1], f._.slice(2).join(' ') || 'Unknown', WHO); save(file, p); console.log('Marked ' + f._[1] + ' unknown'); return; }
    case 'stage': {
      const p = load(file);
      const [, action, n] = f._;
      try { B.setStage(p, +n, action, typeof f.reason === 'string' ? f.reason : null, WHO); } catch (e) { die(e.message); }
      save(file, p);
      console.log('Stage ' + n + ' ' + action + '. Current stage: ' + p.current_stage);
      return;
    }
    case 'load': {
      const p = load(file);
      const csvs = f._.slice(1);
      if (!csvs.length) die('Give at least one CSV file.');
      csvs.forEach((csv, i) => {
        const parsed = B.parseLoadCsv(readFileSync(csv, 'utf8'), { unit: f.unit, dateOrder: f['date-order'], valueColumn: f.column });
        console.log(basename(csv) + ': ' + parsed.points.length + ' rows (' + parsed.skipped + ' skipped), column "' + parsed.valueName + '", ' + parsed.unit + ', ' + parsed.interval_min + ' min, dates ' + parsed.dateOrder);
        B.importLoad(p, parsed, basename(csv), { replace: !!f.replace && i === 0, who: WHO });
      });
      save(file, p);
      const s = B.loadStats(p.load);
      console.log('Series: ' + s.start + ' to ' + s.end + ', ' + p.load.interval_min + ' min, coverage ' + pct(s.coverage) + ', peak ' + B.fmt(s.peak, 2) + ' MW, min ' + B.fmt(s.min_abs, 2) + ' MW, 5th pct ' + B.fmt(s.p05, 2) + ' MW, ' + B.fmt(s.annual_mwh, 0) + ' MWh/yr' + (s.short_record ? ' (SHORT RECORD: under 330 days)' : ''));
      return;
    }
    case 'bills': {
      const p = load(file);
      p.bills = B.parseBillsCsv(readFileSync(f._[1], 'utf8'));
      B.addLog(p, 'Imported ' + p.bills.length + ' months of bills', WHO);
      save(file, p);
      const b = B.billsStats(p.bills);
      console.log(p.bills.length + ' months: ' + B.fmt(b.annual_mwh, 0) + ' MWh/yr, peak ' + B.fmt(b.peak, 2) + ' MW' + (b.avg_cost_per_mwh ? ', average cost ' + B.fmt(b.avg_cost_per_mwh, 1) + '/MWh' : ''));
      return;
    }
    case 'calc': printCalc(load(file), f.json); return;
    case 'docs': {
      const p = load(file);
      const kind = f._[1];
      const d = DOC_MAP[kind];
      if (!d) die('Kinds: ' + Object.keys(DOC_MAP).join(', '));
      const md = d.fn(p);
      if (f.out) { mkdirSync(dirname(f.out), { recursive: true }); writeFileSync(f.out, md); console.log('Wrote ' + resolve(f.out)); }
      else if (!f.save) process.stdout.write(md);
      if (f.save) {
        if (!d.id) die(kind + ' is not a stage deliverable.');
        B.addDeliverable(p, { id: d.id, stage: d.stage, title: d.title, markdown: md }, WHO);
        save(file, p);
        console.log('Saved deliverable ' + d.id + ' in the project file');
      }
      return;
    }
    case 'deliverable': {
      const p = load(file);
      const sub = f._[1];
      if (sub === 'list') { p.deliverables.forEach((d) => console.log(d.id.padEnd(16) + ' stage ' + d.stage + '  ' + d.title + '  (' + d.updated + ', ' + d.markdown.length + ' chars)')); return; }
      if (sub === 'add') {
        const id = f._[2], md = readFileSync(f._[3], 'utf8');
        let def = null;
        B.STAGES.forEach((s) => s.deliverables.forEach((x) => { if (x.id === id) def = { ...x, stage: s.n }; }));
        const stage = f.stage !== undefined ? +f.stage : def ? def.stage : p.current_stage;
        B.addDeliverable(p, { id, stage, title: typeof f.title === 'string' ? f.title : def ? def.title : id, markdown: md }, WHO);
        save(file, p);
        console.log('Saved deliverable ' + id + (def ? '' : ' (custom id, stage ' + stage + ')'));
        return;
      }
      if (sub === 'export') {
        const dir = f._[2] || '.';
        mkdirSync(dir, { recursive: true });
        p.deliverables.forEach((d) => { writeFileSync(join(dir, d.id + '.md'), d.markdown); console.log(join(dir, d.id + '.md')); });
        return;
      }
      die('deliverable add|list|export');
    }
    case 'dr': { const p = load(file); updateRow(p, 'data_request', f._[1], f._.slice(2), ['status', 'received', 'note', 'owner', 'due', 'item', 'why'], 'data request'); save(file, p); console.log('ok'); return; }
    case 'ex': { const p = load(file); updateRow(p, 'exercises', f._[1], f._.slice(2), ['status', 'note'], 'exercise'); save(file, p); console.log('ok'); return; }
    case 'check': { const p = load(file); updateRow(p, 'checks', f._[1], f._.slice(2), ['status', 'note'], 'check'); save(file, p); console.log('ok'); return; }
    case 'review': { const p = load(file); updateRow(p, 'review', +f._[1] - 1, f._.slice(2), ['name', 'date', 'status', 'note'], 'review'); save(file, p); console.log('ok'); return; }
    case 'json': {
      const p = load(file);
      const [, op, path, raw] = f._;
      if (op === 'get') { console.log(JSON.stringify(getPath(p, path), null, 1)); return; }
      if (['fields', 'schema', 'version'].includes(path.split('.')[0])) die('Use set for fields. schema and version are fixed.');
      let val;
      if (op !== 'del') { try { val = JSON.parse(raw); } catch (e) { die('Value must be JSON: ' + e.message); } }
      if (op === 'set') setPath(p, path, val);
      else if (op === 'push') { const arr = getPath(p, path); if (!Array.isArray(arr)) die(path + ' is not a list'); arr.push(val); }
      else if (op === 'del') {
        const keys = path.split('.'), last = keys.pop(), parent = keys.length ? getPath(p, keys.join('.')) : p;
        if (Array.isArray(parent)) parent.splice(+last, 1); else delete parent[last];
      } else die('json get|set|push|del');
      B.addLog(p, 'json ' + op + ' ' + path, WHO);
      const v = B.validate(p); if (v.errors.length) die(v.errors.join(' '));
      save(file, p);
      console.log('ok');
      return;
    }
    case 'options': {
      const p = load(file);
      const ids = f._.slice(1);
      const a = B.analyse(p);
      ids.forEach((id) => { if (!a.options.some((o) => o.id === id)) die('No option ' + id + '. Options: ' + a.options.map((o) => o.id).join(', ')); });
      p.selected_options = ids;
      B.addLog(p, 'Selected options ' + ids.join(', '), WHO);
      save(file, p);
      console.log('Selected ' + (ids.join(', ') || 'none (automatic: best two)'));
      return;
    }
    case 'dashboard': {
      const out = f._[0] || 'dashboard.html';
      const src = join(here, '../assets/dashboard.html');
      if (!existsSync(src)) die('assets/dashboard.html is missing. Run node scripts/build_dashboard.mjs');
      mkdirSync(dirname(resolve(out)), { recursive: true });
      copyFileSync(src, out);
      console.log(resolve(out));
      return;
    }
    case 'validate': {
      const p = JSON.parse(readFileSync(file, 'utf8'));
      const v = B.validate(p);
      v.errors.forEach((e) => console.log('ERROR ' + e));
      v.warnings.forEach((w) => console.log('warning ' + w));
      if (!v.errors.length) console.log('Valid project file.');
      process.exit(v.errors.length ? 1 : 0);
    }
    default: die('Unknown command ' + cmd + '\n' + HELP);
  }
}
try { main(); } catch (e) { die(e.message); }
