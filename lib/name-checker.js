import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

const SOCIAL_CHECKS = [
  { platform: 'Twitter/X', url: (h) => `https://twitter.com/${h}` },
  { platform: 'Instagram', url: (h) => `https://www.instagram.com/${h}/` },
  { platform: 'LinkedIn', url: (h) => `https://www.linkedin.com/company/${h}` },
  { platform: 'TikTok', url: (h) => `https://www.tiktok.com/@${h}` },
];

async function checkDomain(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = `${slug}.com`;

  try {
    await lookup(domain);
    return { domain, available: false, status: 'taken' };
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      return { domain, available: true, status: 'available' };
    }
    return { domain, available: null, status: `unknown (${err.code})` };
  }
}

async function checkSocialHandle(platform, url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Validea/1.0)',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (res.status === 404) return { platform, handle: url, available: true, status: 'available' };
    if (res.status === 200 || res.status === 301 || res.status === 302) return { platform, handle: url, available: false, status: 'taken' };
    return { platform, handle: url, available: null, status: `HTTP ${res.status}` };
  } catch {
    return { platform, handle: url, available: null, status: 'check failed (rate-limited or blocked)' };
  }
}

export async function checkAvailability(name) {
  const handle = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  const [domainResult, ...socialResults] = await Promise.all([
    checkDomain(name),
    ...SOCIAL_CHECKS.map(({ platform, url }) => checkSocialHandle(platform, url(handle))),
  ]);

  const allAvailable = domainResult.available &&
    socialResults.every(r => r.available !== false);

  return {
    name,
    handle,
    domain: domainResult,
    socials: socialResults,
    summary: allAvailable ? '✅ All channels appear available' : buildSummary(domainResult, socialResults),
  };
}

function buildSummary(domain, socials) {
  const taken = [];
  const available = [];
  const unknown = [];

  if (domain.available === false) taken.push(domain.domain);
  else if (domain.available === true) available.push(domain.domain);
  else unknown.push(domain.domain);

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
