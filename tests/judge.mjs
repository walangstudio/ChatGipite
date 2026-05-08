#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const date = process.argv[2] || new Date().toISOString().split('T')[0];
const dir = path.join(__dirname, 'results', date);
if (!fs.existsSync(dir)) {
  console.error(`No results directory at ${dir}. Run \`npm run test:ab\` first.`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf-8'));
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY not set — judge needs an API key.');
  process.exit(1);
}

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic.Anthropic({ apiKey });

// The two comparisons that answer different questions:
//  • b vs a       — does Phase 2 (tightened prompts) hold quality vs pre-Phase-2?
//  • b vs vanilla — does our prompt deliver real value vs default Claude with
//                   no system prompt?
const COMPARISONS = [
  { left: 'b', right: 'a',       label: 'tightened-vs-baseline' },
  { left: 'b', right: 'vanilla', label: 'tightened-vs-vanilla' },
];

const RUBRIC = (leftLabel, rightLabel) => `You are a strict evaluator comparing two outputs.

Output L (${leftLabel}) and Output R (${rightLabel}) — same task, two prompt variants.

Score each on 1-5 (5 = best):
1. Specificity — concrete numbers, names, examples vs generic claims
2. Structure adherence — followed a clear, useful output format
3. Factual plausibility — claims look defensible, not fabricated
4. Actionability — a founder could act on this tomorrow
5. Conciseness — every sentence earns its place

Return STRICT JSON only:
{
  "L": {"specificity": N, "structure": N, "plausibility": N, "actionability": N, "conciseness": N},
  "R": {"specificity": N, "structure": N, "plausibility": N, "actionability": N, "conciseness": N},
  "winner": "L" | "R" | "tie",
  "rationale": "one sentence — what specifically made the winner better"
}`;

// Group runs by (sample, agent) keeping a map of variant -> file path.
const groups = new Map();
for (const r of summary.runs) {
  if (!r.ok) continue;
  const k = `${r.sample}__${r.agent}`;
  if (!groups.has(k)) groups.set(k, {});
  groups.get(k)[r.variant] = path.join(dir, r.sample, `${r.agent}-${r.variant}.md`);
}

const verdicts = [];
for (const [key, vmap] of groups) {
  const [sample, agent] = key.split('__');
  for (const cmp of COMPARISONS) {
    if (!vmap[cmp.left] || !vmap[cmp.right]) continue;
    const lText = fs.readFileSync(vmap[cmp.left], 'utf-8');
    const rText = fs.readFileSync(vmap[cmp.right], 'utf-8');

    process.stderr.write(`▶ ${sample} / ${agent} / ${cmp.label}…\n`);
    try {
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: RUBRIC(cmp.left, cmp.right),
        messages: [{
          role: 'user',
          content: `### Output L (${cmp.left})\n\n${lText}\n\n---\n\n### Output R (${cmp.right})\n\n${rText}\n\nReturn only the JSON object.`,
        }],
      });
      const text = resp.content.find((c) => c.type === 'text')?.text || '';
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
      // Translate L/R back to actual variant names so the report is readable.
      const winner =
        json.winner === 'tie' ? 'tie' :
        json.winner === 'L' ? cmp.left :
        json.winner === 'R' ? cmp.right : 'unknown';
      verdicts.push({
        sample, agent, comparison: cmp.label,
        left: cmp.left, right: cmp.right,
        winner, rationale: json.rationale,
        scores: { [cmp.left]: json.L, [cmp.right]: json.R },
        chars: { [cmp.left]: lText.length, [cmp.right]: rText.length },
      });
      process.stderr.write(`  → winner: ${winner}\n`);
    } catch (e) {
      verdicts.push({ sample, agent, comparison: cmp.label, error: e.message });
      process.stderr.write(`  ✗ ${e.message}\n`);
    }
  }
}

fs.writeFileSync(path.join(dir, 'verdicts.json'), JSON.stringify(verdicts, null, 2));

// Aggregate per comparison label.
const aggByCmp = {};
const perAgent = {};
for (const v of verdicts) {
  if (!v.winner) continue;
  aggByCmp[v.comparison] = aggByCmp[v.comparison] || { wins: {}, total: 0 };
  aggByCmp[v.comparison].wins[v.winner] = (aggByCmp[v.comparison].wins[v.winner] || 0) + 1;
  aggByCmp[v.comparison].total += 1;
  const k = `${v.agent}::${v.comparison}`;
  perAgent[k] = perAgent[k] || { agent: v.agent, comparison: v.comparison, wins: {} };
  perAgent[k].wins[v.winner] = (perAgent[k].wins[v.winner] || 0) + 1;
}

const lines = [
  `# Prompt Test Report — ${date}`,
  '',
  `**Comparisons run:** ${Object.keys(aggByCmp).join(', ')}`,
  '',
  '## Aggregate by comparison',
  '| Comparison | Result |',
  '|------------|--------|',
  ...Object.entries(aggByCmp).map(([cmp, agg]) => {
    const parts = Object.entries(agg.wins).map(([k, n]) => `${k}=${n}`).join(' · ');
    return `| ${cmp} | ${parts} (${agg.total} pairs) |`;
  }),
  '',
  '## Per-agent breakdown',
  '| Agent | Comparison | Wins |',
  '|-------|------------|------|',
  ...Object.values(perAgent).map((p) => {
    const parts = Object.entries(p.wins).map(([k, n]) => `${k}=${n}`).join(' · ');
    return `| ${p.agent} | ${p.comparison} | ${parts} |`;
  }),
  '',
  '## Detail',
  '| Sample | Agent | Comparison | Winner | Rationale |',
  '|--------|-------|------------|--------|-----------|',
  ...verdicts
    .filter((v) => v.winner)
    .map((v) => `| ${v.sample} | ${v.agent} | ${v.comparison} | **${v.winner}** | ${v.rationale} |`),
];
fs.writeFileSync(path.join(dir, 'REPORT.md'), lines.join('\n'));
process.stderr.write(`\nReport written to ${path.join(dir, 'REPORT.md')}\n`);
