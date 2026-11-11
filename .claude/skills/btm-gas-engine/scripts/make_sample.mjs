// Generates assets/sample_load_hourly.csv and assets/sample_bills.csv:
// a synthetic year for a two-shift factory, peak about 15 MW, nights about 5 to 6 MW,
// weekends lower, a one-week shutdown in late December. Deterministic (seeded).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const rows = ['timestamp,load_kW'];
const bills = {};
const t0 = Date.UTC(2025, 0, 1);
for (let i = 0; i < 8760; i++) {
  const d = new Date(t0 + i * 3600e3), h = d.getUTCHours(), dow = d.getUTCDay(), doy = Math.floor(i / 24);
  const weekend = dow === 0 || dow === 6;
  const shutdown = d.getUTCMonth() === 11 && d.getUTCDate() >= 24 && d.getUTCDate() <= 31;
  const season = 1 + 0.06 * Math.sin((doy - 100) / 365 * 2 * Math.PI); // warmer months: more chiller load
  let mw;
  if (shutdown) mw = 1.6 + 0.3 * rnd();
  else if (weekend) mw = (dow === 6 && h >= 7 && h < 15) ? 9.5 : 6.2;
  else if (h >= 7 && h < 23) mw = 13.2 + (h >= 11 && h < 17 ? 1.0 : 0);
  else mw = 5.8;
  if (!shutdown) mw = mw * season + (rnd() - 0.5) * 0.9;
  const kw = Math.round(mw * 1000);
  const ts = d.toISOString().slice(0, 16).replace('T', ' ');
  rows.push(ts + ',' + kw);
  const m = ts.slice(0, 7);
  const b = bills[m] || (bills[m] = { kwh: 0, max: 0 });
  b.kwh += kw; b.max = Math.max(b.max, kw);
}
writeFileSync(join(here, '../assets/sample_load_hourly.csv'), rows.join('\n') + '\n');
const brow = ['month,kWh,max_demand_kW,cost'];
for (const [m, b] of Object.entries(bills)) brow.push(`${m},${b.kwh},${b.max},${Math.round(b.kwh * 0.12 + b.max * 9)}`);
writeFileSync(join(here, '../assets/sample_bills.csv'), brow.join('\n') + '\n');
console.log('wrote', rows.length - 1, 'hourly rows and', brow.length - 1, 'months');
