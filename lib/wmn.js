// Optional WhatsMyName-driven social detection. Opt-in via CHATGIPITE_WMN=1.
// Uses the community-maintained wmn-data.json (CC BY-SA 4.0, vendored unmodified
// at data/wmn-data.json — see data/WHATSMYNAME-ATTRIBUTION.md). We make the
// request directly to the target platform using WMN's vetted e_/m_ signatures
// instead of hand-rolled regexes. Still cannot beat IG/X login walls — those
// resolve to null (honest), never a guess.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = process.env.WMN_DATA_PATH || path.resolve(__dirname, '..', 'data', 'wmn-data.json');

// Our social key → preferred WMN site `name` (first that exists wins). No live
// Twitter/X or LinkedIn entry exists in WMN (X blocks everything) → those keys
// fall back to the HEAD/browser path.
const KEY_TO_WMN = {
  instagram: ['Instagram'],
  tiktok: ['TikTok'],
  reddit: ['Reddit'],
  threads: ['Threads'],
  facebook: ['Facebook'],
  github: ['GitHub (User)'],
  youtube: ['YouTube User', 'YouTube Channel', 'YouTube User2'],
};

let index;
function loadIndex() {
  if (index !== undefined) return index;
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const byName = new Map(data.sites.map((s) => [s.name, s]));
    index = {};
    for (const [key, names] of Object.entries(KEY_TO_WMN)) {
      const hit = names.map((n) => byName.get(n)).find(Boolean);
      if (hit) index[key] = hit;
    }
  } catch {
    index = null; // dataset missing — caller falls back
  }
  return index;
}

export function wmnSiteFor(key) {
  const idx = loadIndex();
  return idx ? idx[key] || null : null;
}

export async function checkWmn(site, account, { timeoutMs = 7000 } = {}) {
  const url = site.uri_check.replace(/\{account\}/g, encodeURIComponent(account));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual', // Threads marks "missing" as a 302 — don't follow it away.
      headers: site.headers || {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/json',
      },
    });
    const status = res.status;
    let body = '';
    if (site.e_string || site.m_string) {
      try { body = (await res.text()).slice(0, 300000); } catch { body = ''; }
    }
    const isExist = status === site.e_code && (!site.e_string || body.includes(site.e_string));
    const isMissing = status === site.m_code && (!site.m_string || body.includes(site.m_string));
    // WMN "exists" = account taken; "missing" = handle free.
    if (isExist && !isMissing) return { available: false, status: 'taken (WMN)' };
    if (isMissing && !isExist) return { available: true, status: 'available (WMN)' };
    return { available: null, status: `inconclusive (WMN; HTTP ${status}) — verify manually` };
  } catch (e) {
    return { available: null, status: `WMN check failed (${e.name})` };
  } finally {
    clearTimeout(timer);
  }
}
