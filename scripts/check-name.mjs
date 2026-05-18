#!/usr/bin/env node
// Standalone brand-name availability checker. Cross-platform (Node >=20, no deps
// beyond the repo's). Usage:
//   node scripts/check-name.mjs "Brand Name" [--tlds com,io,ai] [--socials all|x,github] [--json]
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { checkAvailability, DEFAULT_TLDS, DEFAULT_SOCIALS } = await import(
  pathToFileURL(path.resolve(__dirname, '..', 'lib', 'name-checker.js')).href
);

const argv = process.argv.slice(2);
const opts = { tlds: null, socials: null, json: false };
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--json') opts.json = true;
  else if (a === '--tlds') opts.tlds = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--socials') opts.socials = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--help' || a === '-h') opts.help = true;
  else positional.push(a);
}

const name = positional.join(' ').trim();
if (opts.help || !name) {
  process.stdout.write(
    [
      'Usage: node scripts/check-name.mjs "Brand Name" [options]',
      '',
      '  --tlds com,io,ai     domains to check (default: ' + DEFAULT_TLDS.join(',') + ')',
      '  --socials x,github   socials to check, or "all" (default: ' + DEFAULT_SOCIALS.join(',') + ')',
      '  --json               machine-readable JSON output',
      '',
    ].join('\n'),
  );
  process.exit(name ? 0 : 1);
}

const result = await checkAvailability(name, { tlds: opts.tlds, socials: opts.socials });

if (opts.json) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

const mark = (a) => (a === true ? '✅ available' : a === false ? '❌ taken' : '⚠️ unknown');
const pad = (s, n) => String(s).padEnd(n);
const out = [`\nBrand: ${result.name}  (handle: ${result.handle})`, ''];
out.push('Domains');
for (const d of result.domains) out.push(`  ${pad(d.domain, 28)} ${mark(d.available)}  ${d.status}`);
out.push('', 'Socials');
for (const s of result.socials) out.push(`  ${pad(s.platform, 28)} ${mark(s.available)}  ${s.status}`);
out.push('', `Summary: ${result.summary}`, '');
process.stdout.write(out.join('\n'));
