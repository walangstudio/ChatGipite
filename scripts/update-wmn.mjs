#!/usr/bin/env node
// Refresh the vendored WhatsMyName dataset (CC BY-SA 4.0, unmodified).
// Usage: node scripts/update-wmn.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.resolve(__dirname, '..', 'data', 'wmn-data.json');
const URL = 'https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json';

const res = await fetch(URL);
if (!res.ok) {
  console.error(`fetch failed: HTTP ${res.status}`);
  process.exit(1);
}
const text = await res.text();
const json = JSON.parse(text); // validate
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, text);
console.log(`wmn-data.json updated — ${json.sites.length} sites. Update the snapshot date in data/WHATSMYNAME-ATTRIBUTION.md.`);
