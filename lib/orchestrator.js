import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { dispatch } from './llm-adapter.js';

const require = createRequire(import.meta.url);

function parseWorkflow(workflowPath) {
  const content = fs.readFileSync(workflowPath, 'utf-8');
  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) throw new Error(`Workflow at ${workflowPath} missing YAML front-matter`);
  const yaml = require('js-yaml');
  return yaml.load(match[1]);
}

function loadAgentSpec(agentId, workspace) {
  const specPath = path.join(workspace, 'subagents', `${agentId}.md`);
  try {
    return fs.readFileSync(specPath, 'utf-8');
  } catch {
    return `You are the ${agentId} agent. Complete the task as described.`;
  }
}

function readContextFiles(files, workspace) {
  if (!files?.length) return '';
  return files.map(f => {
    try {
      return `### ${f}\n${fs.readFileSync(path.join(workspace, f), 'utf-8')}`;
    } catch {
      return `### ${f}\n(not found)`;
    }
  }).join('\n\n');
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

  const results = {};
  const log = [`# Workflow: ${name}`, `**Goal:** ${goal}`, `**Started:** ${new Date().toISOString()}`, ''];

  for (const step of steps) {
    const { id, agent, task: taskTemplate, depends_on = [], output_path, context_files = [] } = step;

    let task = taskTemplate
      .replace(/\{\{goal\}\}/g, goal)
      .replace(/\{\{params\.(\w+)\}\}/g, (_, k) => params[k] || '')
      .replace(/\{\{results\.(\w+)\}\}/g, (_, k) => results[k] ? results[k].substring(0, 800) : '(no output)');

    const fileContext = readContextFiles(context_files, workspace);
    const depContext = depends_on
      .map(dep => results[dep] ? `### Output from step "${dep}":\n${results[dep]}` : '')
      .filter(Boolean)
      .join('\n\n');
    const context = [fileContext, depContext].filter(Boolean).join('\n\n');

    log.push(`## Step: ${id} (agent: ${agent})`);
    log.push(`**Task:** ${task.substring(0, 200)}`);

    try {
      const agentSpec = loadAgentSpec(agent, workspace);
      const output = await dispatch(agent, agentSpec, task, context);
      results[id] = output;

      if (output_path) {
        const outPath = output_path
          .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0])
          .replace(/\{\{slug\}\}/g, params.slug || goal.replace(/[^a-z0-9]+/gi, '-').toLowerCase().substring(0, 40));
        const abs = path.join(workspace, outPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, output);
        log.push(`**Output written to:** ${outPath}`);
      }

      log.push(`**Status:** ✅ Complete\n`);
      mem.store('agent_outputs', `${name}/${id}: ${task.substring(0, 100)}`, { agent, workflow: name, step: id });
    } catch (err) {
      log.push(`**Status:** Failed: ${err.message}\n`);
      results[id] = `ERROR: ${err.message}`;
    }
  }

  log.push(`---\n*Workflow complete. ${Object.keys(results).length} steps executed.*`);
  const summary = log.join('\n');

  const reportPath = path.join(workspace, 'reports', `workflow-${name}-${new Date().toISOString().split('T')[0]}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, summary);

  return { summary, results };
}
