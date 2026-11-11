// Inlines scripts/engine.js into scripts/dashboard.src.html and writes assets/dashboard.html,
// a single self-contained file (works offline, from disk, and as a claude.ai artifact).
// Run after changing either source: node scripts/build_dashboard.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const engine = readFileSync(join(here, 'engine.js'), 'utf8');
if (/<\/script/i.test(engine)) throw new Error('engine.js must not contain a closing script tag');
const src = readFileSync(join(here, 'dashboard.src.html'), 'utf8');
const marker = '/*__ENGINE__*/';
if (!src.includes(marker)) throw new Error('marker missing in dashboard.src.html');
const out = src.split(marker).join(engine);
writeFileSync(join(here, '../assets/dashboard.html'), out);
console.log('assets/dashboard.html written (' + Math.round(out.length / 1024) + ' KB)');
