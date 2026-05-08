#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dispatch } from '../lib/llm-adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const samples = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts/samples.json'), 'utf-8'));
const date = new Date().toISOString().split('T')[0];
const outDir = path.join(__dirname, 'results', date);
fs.mkdirSync(outDir, { recursive: true });

function loadSpec(variant, agentId) {
  switch (variant) {
    case 'vanilla': // No system prompt at all — measures the prompt's marginal value.
      return '';
    case 'a': // Pre-modernization baseline.
      return fs.readFileSync(path.join(__dirname, 'prompts/baseline', `${agentId}.md`), 'utf-8');
    case 'b': // Current tightened prompt.
      return fs.readFileSync(path.join(ROOT, 'subagents', `${agentId}.md`), 'utf-8');
    default:
      throw new Error(`unknown variant: ${variant}`);
  }
}

function fillTemplate(tpl, sample) {
  return tpl.replace(/\{idea\}/g, sample.idea).replace(/\{context\}/g, sample.context);
}

async function runOne(sample, agent, variant) {
  const spec = loadSpec(variant, agent.id);
  const task = fillTemplate(agent.task_template, sample);
  const t0 = Date.now();
  const output = await dispatch(agent.id, spec, task, '');
  const elapsed = Date.now() - t0;
  const sampleDir = path.join(outDir, sample.slug);
  fs.mkdirSync(sampleDir, { recursive: true });
  fs.writeFileSync(path.join(sampleDir, `${agent.id}-${variant}.md`), output);
  return { sample: sample.slug, agent: agent.id, variant, chars: output.length, elapsed_ms: elapsed };
}

// `vanilla` (no system prompt) measures whether our prompt is doing real work
// vs default Claude behaviour. `a` is the pre-Phase-2 baseline. `b` is current.
const VARIANTS = (process.env.AB_VARIANTS || 'a,b,vanilla').split(',').map((s) => s.trim());

const summary = { date, variants: VARIANTS, runs: [] };
for (const sample of samples.samples) {
  for (const agent of samples.agents) {
    for (const variant of VARIANTS) {
      process.stderr.write(`▶ ${sample.slug} / ${agent.id} / ${variant}…\n`);
      try {
        const r = await runOne(sample, agent, variant);
        summary.runs.push({ ...r, ok: true });
        process.stderr.write(`  ✓ ${r.chars} chars in ${(r.elapsed_ms / 1000).toFixed(1)}s\n`);
      } catch (e) {
        summary.runs.push({ sample: sample.slug, agent: agent.id, variant, ok: false, error: e.message });
        process.stderr.write(`  ✗ ${e.message}\n`);
      }
    }
  }
}

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
process.stderr.write(`\nDone — outputs in ${outDir}\n`);
process.stderr.write(`Run \`npm run test:judge ${date}\` to score them.\n`);
