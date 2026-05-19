import dns from 'dns';
import { promisify } from 'util';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const lookup = promisify(dns.lookup);

// whois npm is callback-based; wrap once.
const whoisLookup = (() => {
  const whois = require('whois');
  return (domain, opts) =>
    new Promise((resolve, reject) =>
      whois.lookup(domain, opts, (err, data) => (err ? reject(err) : resolve(data))),
    );
})();

export const DEFAULT_TLDS = ['com', 'io', 'ai', 'co', 'app', 'dev', 'net', 'org'];

// 404 = handle free. 200 = taken. 403/429/451 are bot-squat / rate-limit / geo —
// never treat as a hard "taken" (memory caveat: IG/TikTok/X 403 = unknown).
const SOCIAL_CHECKS = {
  x: { platform: 'X/Twitter', url: (h) => `https://x.com/${h}` },
  instagram: { platform: 'Instagram', url: (h) => `https://www.instagram.com/${h}/` },
  tiktok: { platform: 'TikTok', url: (h) => `https://www.tiktok.com/@${h}` },
  linkedin: { platform: 'LinkedIn', url: (h) => `https://www.linkedin.com/company/${h}` },
  github: { platform: 'GitHub', url: (h) => `https://github.com/${h}` },
  youtube: { platform: 'YouTube', url: (h) => `https://www.youtube.com/@${h}` },
  facebook: { platform: 'Facebook', url: (h) => `https://www.facebook.com/${h}` },
  reddit: { platform: 'Reddit', url: (h) => `https://www.reddit.com/user/${h}` },
  threads: { platform: 'Threads', url: (h) => `https://www.threads.net/@${h}` },
};
export const DEFAULT_SOCIALS = Object.keys(SOCIAL_CHECKS);

const RDAP_TIMEOUT_MS = 6000;
const WHOIS_TIMEOUT_MS = 6000;
const SOCIAL_TIMEOUT_MS = 5000;

const WHOIS_FREE = /(no match|not found|no data found|no entries found|status:\s*free|available for registration)/i;

async function withTimeout(ms, fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// RDAP is the source of truth: 200 = registered, 404 = not found. rdap.org
// returns 404 both for "available" and for "no RDAP service for this TLD", so a
// 404 is confirmed against WHOIS before we call a domain free. DNS is the last
// resort (a registered-but-unparked domain has no A record → false "available").
async function checkDomain(domain) {
  try {
    const res = await withTimeout(RDAP_TIMEOUT_MS, (signal) =>
      fetch(`https://rdap.org/domain/${domain}`, {
        signal,
        redirect: 'follow',
        headers: { Accept: 'application/rdap+json', 'User-Agent': 'ChatGipite-NameCheck/1.0' },
      }),
    );
    if (res.status === 200) return { domain, available: false, status: 'registered (RDAP)' };
    if (res.status === 404) return confirmFreeViaWhois(domain);
    if (res.status === 429) return checkDomainWhois(domain, 'RDAP rate-limited');
  } catch {
    return checkDomainWhois(domain, 'RDAP unreachable');
  }
  return checkDomainWhois(domain, `RDAP HTTP fallback`);
}

async function confirmFreeViaWhois(domain) {
  try {
    const data = await whoisLookup(domain, { timeout: WHOIS_TIMEOUT_MS, follow: 1 });
    if (WHOIS_FREE.test(data)) return { domain, available: true, status: 'available (RDAP+WHOIS)' };
    return { domain, available: false, status: 'registered (WHOIS)' };
  } catch {
    return checkDomainDns(domain, 'RDAP 404, WHOIS failed');
  }
}

async function checkDomainWhois(domain, why) {
  try {
    const data = await whoisLookup(domain, { timeout: WHOIS_TIMEOUT_MS, follow: 1 });
    if (WHOIS_FREE.test(data)) return { domain, available: true, status: `available (WHOIS; ${why})` };
    return { domain, available: false, status: `registered (WHOIS; ${why})` };
  } catch {
    return checkDomainDns(domain, why);
  }
}

async function checkDomainDns(domain, why) {
  try {
    await lookup(domain);
    return { domain, available: false, status: `resolves (DNS; ${why})` };
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return { domain, available: null, status: `unresolved — verify manually (DNS; ${why})` };
    }
    return { domain, available: null, status: `unknown (${err.code}; ${why})` };
  }
}

async function checkSocialHandle(platform, url) {
  try {
    const res = await withTimeout(SOCIAL_TIMEOUT_MS, (signal) =>
      fetch(url, {
        method: 'HEAD',
        signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatGipite-NameCheck/1.0)' },
        redirect: 'follow',
      }),
    );
    if (res.status === 404) return { platform, handle: url, available: true, status: 'available' };
    if (res.status === 200) return { platform, handle: url, available: false, status: 'taken' };
    if ([403, 429, 451].includes(res.status)) {
      return { platform, handle: url, available: null, status: `blocked/bot-squat (HTTP ${res.status}) — verify manually` };
    }
    return { platform, handle: url, available: null, status: `HTTP ${res.status}` };
  } catch {
    return { platform, handle: url, available: null, status: 'check failed (rate-limited or blocked)' };
  }
}

export function mark(available, withLabel = false) {
  if (available === true) return withLabel ? '✅ Available' : '✅';
  if (available === false) return withLabel ? '❌ Taken' : '❌';
  return withLabel ? '⚠️ Unknown' : '⚠️';
}

function normalizeTlds(tlds) {
  if (!tlds || !tlds.length) return DEFAULT_TLDS;
  return tlds.map((t) => String(t).toLowerCase().replace(/^\./, '')).filter(Boolean);
}

function normalizeSocials(socials) {
  if (!socials || !socials.length || socials.includes('all')) return DEFAULT_SOCIALS;
  return socials.map((s) => String(s).toLowerCase()).filter((s) => SOCIAL_CHECKS[s]);
}

export async function checkAvailability(name, opts = {}) {
  const handle = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tlds = normalizeTlds(opts.tlds);
  const socials = normalizeSocials(opts.socials);
  const unrecognizedSocials =
    opts.socials && !opts.socials.includes('all')
      ? opts.socials.map((s) => String(s).toLowerCase()).filter((s) => !SOCIAL_CHECKS[s])
      : [];

  const [domains, socialResults] = await Promise.all([
    Promise.all(tlds.map((tld) => checkDomain(`${handle}.${tld}`))),
    Promise.all(socials.map((s) => checkSocialHandle(SOCIAL_CHECKS[s].platform, SOCIAL_CHECKS[s].url(handle)))),
  ]);

  const allAvailable =
    domains.every((d) => d.available === true) && socialResults.every((r) => r.available !== false);

  return {
    name,
    handle,
    domains,
    socials: socialResults,
    unrecognizedSocials,
    summary: allAvailable ? '✅ All channels appear available' : buildSummary(domains, socialResults),
  };
}

function buildSummary(domains, socials) {
  const taken = [];
  const available = [];
  const unknown = [];

  for (const d of domains) {
    if (d.available === false) taken.push(d.domain);
    else if (d.available === true) available.push(d.domain);
    else unknown.push(d.domain);
  }
  for (const s of socials) {
    if (s.available === false) taken.push(s.platform);
    else if (s.available === true) available.push(s.platform);
    else unknown.push(s.platform);
  }

  const parts = [];
  if (taken.length) parts.push(`❌ Taken: ${taken.join(', ')}`);
  if (available.length) parts.push(`✅ Available: ${available.join(', ')}`);
  if (unknown.length) parts.push(`⚠️ Unknown: ${unknown.join(', ')}`);
  return parts.join(' | ');
}
