import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { dispatch } from './llm-adapter.js';

const require = createRequire(import.meta.url);

// Default 12000 chars. Large enough that synthesis-style waves combining several
// upstream artifacts can clear the Anthropic 8192-char prompt-cache minimum on
// the dep-context block.
const MAX_DEP_CONTEXT_CHARS = parseInt(process.env.MAX_DEP_CONTEXT_CHARS || '12000', 10);

function parseWorkflow(workflowPath) {
  const content = fs.readFileSync(workflowPath, 'utf-8');
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) throw new Error(`Workflow at ${workflowPath} missing YAML front-matter`);
  const yaml = require('js-yaml');
  return yaml.load(match[1].replace(/\r\n/g, '\n'));
}

const specCache = new Map();
function loadAgentSpec(agentId, workspace) {
  const key = `${workspace}::${agentId}`;
  if (specCache.has(key)) return specCache.get(key);
  const specPath = path.join(workspace, 'subagents', `${agentId}.md`);
  let spec;
  try {
    spec = fs.readFileSync(specPath, 'utf-8');
  } catch {
    spec = `You are the ${agentId} agent. Complete the task as described.`;
  }
  specCache.set(key, spec);
  return spec;
}

function readContextFiles(files, workspace) {
  if (!files?.length) return '';
  return files.map((f) => {
    try {
      return `### ${f}\n${fs.readFileSync(path.join(workspace, f), 'utf-8')}`;
    } catch {
      return `### ${f}\n(not found)`;
    }
  }).join('\n\n');
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? `${text.substring(0, max)}\n…[truncated ${text.length - max} chars]` : text;
}

function slugFor(goal, params) {
  return params.slug || goal.replace(/[^a-z0-9]+/gi, '-').toLowerCase().substring(0, 40);
}

async function executeStep(step, ctx) {
  const { id, agent, task: taskTemplate, depends_on = [], output_path, context_files = [] } = step;
  const { results, statuses, goal, params, workspace, mem, name, log } = ctx;

  const failedDeps = depends_on.filter((d) => statuses[d] === 'failed' || statuses[d] === 'skipped');
  if (failedDeps.length) {
    statuses[id] = 'skipped';
    results[id] = `SKIPPED: dependencies failed: ${failedDeps.join(', ')}`;
    log.push(`## Step: ${id} (agent: ${agent})`);
    log.push(`**Status:** ⏭️ Skipped — failed deps: ${failedDeps.join(', ')}\n`);
    return;
  }

  const task = taskTemplate
    .replace(/\{\{goal\}\}/g, goal)
    .replace(/\{\{params\.(\w+)\}\}/g, (_, k) => params[k] || '')
    .replace(/\{\{results\.(\w+)\}\}/g, (_, k) => (results[k] ? truncate(results[k], MAX_DEP_CONTEXT_CHARS) : '(no output)'));

  const fileContext = readContextFiles(context_files, workspace);
  const depContext = depends_on
    .map((dep) => (results[dep] ? `### Output from step "${dep}":\n${truncate(results[dep], MAX_DEP_CONTEXT_CHARS)}` : ''))
    .filter(Boolean)
    .join('\n\n');
  const context = [fileContext, depContext].filter(Boolean).join('\n\n');

  log.push(`## Step: ${id} (agent: ${agent})`);
  log.push(`**Task:** ${task.substring(0, 200)}`);

  try {
    const agentSpec = loadAgentSpec(agent, workspace);
    const output = await dispatch(agent, agentSpec, task, context);
    results[id] = output;
    statuses[id] = 'ok';

    if (output_path) {
      const outPath = output_path
        .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0])
        .replace(/\{\{slug\}\}/g, slugFor(goal, params));
      const abs = path.join(workspace, outPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, output);
      log.push(`**Output written to:** ${outPath}`);
    }

    log.push(`**Status:** ✅ Complete\n`);
    mem.store('agent_outputs', `${name}/${id}: ${task.substring(0, 100)}`, { agent, workflow: name, step: id });
  } catch (err) {
    statuses[id] = 'failed';
    results[id] = `ERROR: ${err.message}`;
    log.push(`**Status:** ❌ Failed: ${err.message}\n`);
  }
}

export async function run(name, goal, params, workspace, mem) {
  const workflowPath = path.join(workspace, 'workflows', `${name}.md`);
  if (!fs.existsSync(workflowPath)) return `Workflow "${name}" not found`;

  let workflow;
  try {
    workflow = parseWorkflow(workflowPath);
  } catch (err) {
    return `Failed to parse workflow "${name}": ${err.message}`;
  }

  const { steps = [] } = workflow;
  if (!steps.length) return `Workflow "${name}" has no steps.`;

  const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
  const knownIds = new Set(steps.map((s) => s.id));
  for (const s of steps) {
    for (const d of s.depends_on || []) {
      if (!knownIds.has(d)) {
        return `Workflow "${name}" step "${s.id}" depends on unknown step "${d}"`;
      }
    }
  }

  const results = {};
  const statuses = {};
  const log = [`# Workflow: ${name}`, `**Goal:** ${goal}`, `**Started:** ${new Date().toISOString()}`, ''];
  const ctx = { results, statuses, goal, params, workspace, mem, name, log };

  const t0 = Date.now();
  let waveNum = 0;
  while (Object.keys(statuses).length < steps.length) {
    const ready = steps.filter(
      (s) => statuses[s.id] === undefined && (s.depends_on || []).every((d) => statuses[d] !== undefined),
    );
    if (!ready.length) {
      const stuck = steps.filter((s) => statuses[s.id] === undefined).map((s) => s.id);
      log.push(`**Aborted:** could not schedule remaining steps: ${stuck.join(', ')}`);
      stuck.forEach((id) => { statuses[id] = 'skipped'; results[id] = 'SKIPPED: scheduler deadlock'; });
      break;
    }
    waveNum += 1;
    log.push(`### Wave ${waveNum}: ${ready.map((s) => s.id).join(', ')}`);
    await Promise.all(ready.map((s) => executeStep(stepById[s.id], ctx)));
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const okCount = Object.values(statuses).filter((s) => s === 'ok').length;
  const failCount = Object.values(statuses).filter((s) => s === 'failed').length;
  const skipCount = Object.values(statuses).filter((s) => s === 'skipped').length;
  log.push(`---\n*Workflow complete in ${elapsed}s — ${okCount} ok, ${failCount} failed, ${skipCount} skipped, across ${waveNum} wave(s).*`);
  const summary = log.join('\n');

  const reportPath = path.join(workspace, 'reports', `workflow-${name}-${new Date().toISOString().split('T')[0]}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, summary);

  return { summary, results, statuses };
}
