// Opt-in headless-browser fallback for socials that bot-block HEAD requests
// (IG / TikTok / X mainly). Off unless CHATGIPITE_PLAYWRIGHT=1 AND `playwright`
// is installed (it is an optionalDependency + needs `npx playwright install
// chromium`). Honest by design: only asserts available on an explicit
// "not found" page and taken on an explicit profile marker; a login/anti-bot
// wall stays null ("verify manually") rather than guessing — IG and X gate
// logged-out profile views, so they will often still resolve to null.
import { BROWSER_UA } from './ua.js';

const RULES = {
  x: {
    notFound: /this account doesn.?t exist|account suspended/i,
    wall: /log in to x|sign in to x|something went wrong|\/i\/flow\/login|x\.com\/login/i,
    taken: /data-testid="UserName"|"profile_banner"|\/photo\b/i,
  },
  instagram: {
    notFound: /Sorry, this page isn.?t available/i,
    wall: /\/accounts\/login|Log in to see|loginForm/i,
    taken: /"@[\w.]+"\s*[•|-]\s*Instagram|profilePage_|edge_followed_by/i,
  },
  tiktok: {
    notFound: /Couldn.?t find this account/i,
    wall: /verify to continue|\/captcha|please wait while we verify/i,
    taken: /"uniqueId":"|"authorId":|data-e2e="user-title"/i,
  },
  linkedin: {
    notFound: /Page not found|this page doesn.?t exist/i,
    wall: /authwall|\/login|join LinkedIn|sign in to see/i,
    // Not /\/company\// — that path is in the request URL itself, so it echoes
    // back in nearly every response and would assert "taken" universally.
    taken: /"companyName":|org-top-card-summary|"universalName":/i,
  },
  youtube: {
    // No bare /404/ — it matches stray status tokens in JSON on valid pages.
    // A real 404 is handled by the HTTP status check below.
    notFound: /This page isn.?t available|does not exist/i,
    wall: /consent\.youtube|before you continue/i,
    taken: /"channelId"|subscriberCountText|ytInitialData/i,
  },
  facebook: {
    notFound: /content isn.?t available|page isn.?t available|isn.?t available right now/i,
    wall: /log in to continue|\/login\b|loginform/i,
    taken: /"entity_id"|profile_tab|pageID/i,
  },
};

let pwModule;
async function loadPlaywright() {
  if (pwModule === undefined) {
    try {
      pwModule = (await import('playwright')).chromium;
    } catch {
      pwModule = null; // not installed
    }
  }
  return pwModule;
}

// targets: [{ key, url }] → { [key]: { available, status } }
export async function resolveViaBrowser(targets, { timeoutMs = 15000 } = {}) {
  // Keys with no detection rule can only ever resolve to null — skip them
  // before spending a Chromium nav.
  const ruled = targets.filter((t) => RULES[t.key]);
  const out = Object.fromEntries(
    targets.filter((t) => !RULES[t.key]).map((t) => [t.key, { available: null, status: 'no browser rule — verify manually' }]),
  );
  if (!ruled.length) return out;

  const chromium = await loadPlaywright();
  if (!chromium) {
    for (const t of ruled) out[t.key] = { available: null, status: 'playwright not installed — run: npx playwright install chromium' };
    return out;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const { key, url } of ruled) {
      const rule = RULES[key];
      const context = await browser.newContext({ userAgent: BROWSER_UA });
      try {
        const page = await context.newPage();
        // Drop heavy resources — we only need the DOM/text.
        await page.route('**/*', (route) =>
          ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue(),
        );
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        const status = resp ? resp.status() : 0;
        const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
        const html = (await page.content().catch(() => '')).slice(0, 200000);
        const hay = `${text}\n${html}`;
        // Conservative: assert ONLY on hard evidence. The common logged-out
        // IG/TikTok/X case is a JS wall with HTTP 200 and no profile markers —
        // that must be null ("verify manually"), never a guessed taken/free.
        const nf = rule && rule.notFound.test(hay) && !rule.wall.test(hay);
        const tk = rule && rule.taken.test(hay) && !rule.notFound.test(hay);
        if (status === 404 || nf) {
          out[key] = { available: true, status: 'available (browser)' };
        } else if (tk) {
          out[key] = { available: false, status: 'taken (browser)' };
        } else {
          out[key] = { available: null, status: 'login/anti-bot wall (browser) — verify manually' };
        }
      } catch (e) {
        out[key] = { available: null, status: `browser check failed (${e.name})` };
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}
