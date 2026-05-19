#!/usr/bin/env node
// Live smoke-test against an OpenAI-compatible provider (default: NVIDIA).
// Verifies the dispatch path returns real completions (not passthrough) and
// that agents produce non-trivial output. Key is read from env, never stored.
//
//   NVIDIA_API_KEY=nvapi-... node scripts/live-verify.mjs
//   NVIDIA_API_KEY=... node scripts/live-verify.mjs --model meta/llama-3.3-70b-instruct
//   OPENAI_API_KEY=...  node scripts/live-verify.mjs --base https://api.openai.com/v1 --provider openai --model gpt-4o
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const provider = opt('provider', 'nvidia');
const baseUrl = opt('base', 'https://integrate.api.nvidia.com/v1');
const keyEnv = `${provider.toUpperCase()}_API_KEY`;
const apiKey = process.env[keyEnv];
if (!apiKey) {
  console.error(`Set ${keyEnv} in the environment first (a real terminal with network — not Claude Code).`);
  process.exit(2);
}

async function pickModel() {
  const forced = opt('model', null);
  if (forced) return forced;
  const res = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`models endpoint HTTP ${res.status}`);
  const ids = ((await res.json()).data || []).map((m) => m.id);
  const prefs = [/^qwen\/qwen3\.5/i, /^qwen\/qwen2\.5-72b/i, /^meta\/llama-3\.3-70b-instruct$/i, /^qwen\//i, /instruct/i];
  for (const re of prefs) {
    const hit = ids.find((i) => re.test(i));
    if (hit) return hit;
  }
  if (!ids.length) throw new Error('no models returned');
  return ids[0];
}

const model = await pickModel();
console.log(`provider=${provider} base=${baseUrl} model=${model}\n`);

const cfgPath = path.join(os.tmpdir(), `cg-live-${process.pid}.json`);
fs.writeFileSync(
  cfgPath,
  JSON.stringify({
    default_provider: provider,
    providers: { [provider]: { type: 'openai_compatible', default_model: model, base_url: baseUrl } },
  }),
);
process.env.CHATGIPITE_CONFIG = cfgPath;

const memory = await import(pathToFileURL(path.join(HOME, 'lib', 'memory.js')).href);
const { handlers } = await import(pathToFileURL(path.join(HOME, 'lib', 'handlers.js')).href);
memory.init(path.join(HOME, 'db', 'chatgipite.sqlite'));

const PASSTHROUGH = '[ChatGipite passthrough]';
let failed = 0;

async function step(label, tool, toolArgs) {
  process.stdout.write(`\n===== ${label} (${tool}) =====\n`);
  const out = (await handlers[tool](toolArgs)).content?.find((c) => c.type === 'text')?.text ?? '';
  const isPass = out.includes(PASSTHROUGH);
  const ok = !isPass && out.trim().length > 200;
  console.log(out.slice(0, 1600) + (out.length > 1600 ? '\n…[truncated]' : ''));
  console.log(`\n[${ok ? 'LIVE OK' : isPass ? 'PASSTHROUGH (call failed/fell back)' : 'TOO SHORT'}] ${out.length} chars`);
  if (!ok) failed += 1;
  return out;
}

await step('1/2 validator (existing agent)', 'biz_validate', {
  idea: 'AI meal-planning app for people with chronic kidney disease',
  context: '',
});
await step('2/2 incubation-coach (NEW P3 agent)', 'biz_assumptions', {
  idea_slug: 'ai-meal-planning-app-for-people-with-chronic-kidne',
});

fs.rmSync(cfgPath, { force: true });
console.log(`\n${failed === 0 ? '✅ ALL LIVE' : `❌ ${failed} step(s) not live`}`);
process.exit(failed === 0 ? 0 : 1);
