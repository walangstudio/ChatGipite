#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import * as memory from './lib/memory.js';
import { dispatch } from './lib/llm-adapter.js';
import { run as runWorkflow } from './lib/orchestrator.js';
import { checkAvailability } from './lib/name-checker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const TOOLS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools/index.json'), 'utf-8'));

const WORKSPACE = __dirname;
const DB_PATH = path.join(WORKSPACE, 'db/chatgipite.sqlite');

const LOG_FILE = path.join(__dirname, 'chatgipite.log');
const log = process.env.CHATGIPITE_DEBUG
  ? (msg) => {
      const line = `${new Date().toISOString()} ${msg}\n`;
      process.stderr.write(line);
      fs.appendFileSync(LOG_FILE, line);
    }
  : () => {};

log(`server starting`);
log(`cwd: ${process.cwd()}`);
log(`CHATGIPITE_CONFIG: ${process.env.CHATGIPITE_CONFIG || '(not set)'}`);

memory.init(DB_PATH);

// ── helpers ────────────────────────────────────────────────────────────────

function loadAgentSpec(agentId) {
  const p = path.join(WORKSPACE, 'subagents', `${agentId}.md`);
  try { return fs.readFileSync(p, 'utf-8'); }
  catch { return `You are the ${agentId} agent. Complete the task as described.`; }
}

function toSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
}

function ideaDir(slug) {
  const dir = path.join(WORKSPACE, 'ideas', slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readIdeaBrief(slug) {
  const p = path.join(WORKSPACE, 'ideas', slug, 'brief.md');
  try { return fs.readFileSync(p, 'utf-8'); }
  catch { return '(no brief found; run biz_validate first)'; }
}

function readArtifact(slug, file) {
  const p = path.join(WORKSPACE, 'ideas', slug, file);
  try { return fs.readFileSync(p, 'utf-8'); }
  catch { return null; }
}

function saveArtifact(slug, file, content) {
  ideaDir(slug);
  fs.writeFileSync(path.join(WORKSPACE, 'ideas', slug, file), content);
}

function ok(text) {
  return { content: [{ type: 'text', text }] };
}

function err(text) {
  return { content: [{ type: 'text', text: `❌ ${text}` }], isError: true };
}

// ── tool handlers ──────────────────────────────────────────────────────────

async function handleGenerate(args) {
  const { sector = '', problem = '', constraints = '', count = 1 } = args;

  const context = [
    sector && `Sector/Industry: ${sector}`,
    problem && `Core problem to solve: ${problem}`,
    constraints && `Constraints: ${constraints}`,
  ].filter(Boolean).join('\n');

  const task = `Generate ${count} original, differentiated business idea${count === 1 ? '' : 's'}${sector ? ` in the ${sector} sector` : ''}${problem ? ` addressing the problem: ${problem}` : ''}. For each idea, produce a full structured brief as specified.`;

  const spec = loadAgentSpec('ideator');
  const output = await dispatch('ideator', spec, task, context);

  memory.store('ideas', `Generated ideas: ${sector || problem || 'open'}`, { sector, problem });
  return ok(output);
}

async function handleValidate(args) {
  const { idea, context = '' } = args;
  const slug = toSlug(idea);

  const spec = loadAgentSpec('validator');
  const task = `Perform a full viability analysis on this business idea: "${idea}"`;
  const output = await dispatch('validator', spec, task, context);

  saveArtifact(slug, 'brief.md', `# Validation: ${idea}\n\n${output}`);
  memory.store('validations', `Validated: ${idea}`, { slug });

  return ok(`**Idea slug:** \`${slug}\`\n\n${output}`);
}

async function handleIceScore(args) {
  const { idea, context = '' } = args;

  const spec = loadAgentSpec('validator');
  const task = `Compute an ICE score for this business idea: "${idea}". Focus on Impact (1-10), Confidence (1-10), and Ease (1-10) with detailed rationale for each dimension and an overall recommendation.`;
  const output = await dispatch('validator', spec, task, context);

  memory.store('ice_scores', `ICE: ${idea}`, {});
  return ok(output);
}

async function handleCanvas(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);

  const spec = loadAgentSpec('writer');
  const task = `Generate a complete Business Model Canvas for idea slug: "${idea_slug}". Use the validation brief as your primary input.`;
  const output = await dispatch('writer', spec, task, brief);

  saveArtifact(idea_slug, 'canvas.md', output);
  memory.store('canvases', `Canvas: ${idea_slug}`, { slug: idea_slug });

  return ok(output);
}

async function handlePitchdeck(args) {
  const { idea_slug } = args;

  const brief = readIdeaBrief(idea_slug);
  const competitive = readArtifact(idea_slug, 'competitive.md') || '';
  const financials = readArtifact(idea_slug, 'financials.md') || '';

  const context = [
    brief && `## Validation Brief\n${brief}`,
    competitive && `## Competitive Analysis\n${competitive}`,
    financials && `## Financial Model\n${financials}`,
  ].filter(Boolean).join('\n\n---\n\n');

  const spec = loadAgentSpec('writer');
  const task = `Generate a complete 10-slide pitch deck for the business idea "${idea_slug}". Use all available analysis as input.`;
  const output = await dispatch('writer', spec, task, context);

  saveArtifact(idea_slug, 'pitchdeck.md', output);
  memory.store('pitchdecks', `Pitch deck: ${idea_slug}`, { slug: idea_slug });

  return ok(output);
}

async function handleName(args) {
  const { idea_slug, style = '', count = 8 } = args;
  const brief = readIdeaBrief(idea_slug);

  const spec = loadAgentSpec('ideator');
  const task = `Generate ${count} business name options for the idea described below. Naming style preference: ${style || 'mixed (coined, descriptive, metaphor, portmanteau)'}.

For each name output ONLY this exact format (one block per name, no extra text):
NAME: [the name]
STYLE: [naming style]
WHY: [1 sentence rationale]
SCORE: Memorability X/10, Pronounceability X/10, Uniqueness X/10

Generate a diverse set, varying the styles.`;

  const raw = await dispatch('ideator', spec, task, brief);

  // Extract all NAME: lines from the LLM output
  const nameMatches = [...raw.matchAll(/^NAME:\s*(.+)$/gim)];
  const generatedNames = nameMatches.map(m => m[1].trim()).filter(Boolean);

  // Run availability checks on every extracted name in parallel
  let availabilitySection = '';
  if (generatedNames.length > 0) {
    const checks = await Promise.all(generatedNames.map(n => checkAvailability(n)));
    const rows = checks.map(r => {
      const dot = r.domain.available ? '✅' : r.domain.available === false ? '❌' : '⚠️';
      const ig  = r.socials.find(s => s.platform === 'Instagram');
      const igS = ig?.available ? '✅' : ig?.available === false ? '❌' : '⚠️';
      const li  = r.socials.find(s => s.platform === 'LinkedIn');
      const liS = li?.available ? '✅' : li?.available === false ? '❌' : '⚠️';
      const tt  = r.socials.find(s => s.platform === 'TikTok');
      const ttS = tt?.available ? '✅' : tt?.available === false ? '❌' : '⚠️';
      return `| **${r.name}** | ${dot} \`${r.domain.domain}\` | ${igS} | ${liS} | ${ttS} |`;
    });
    availabilitySection = [
      '',
      '---',
      '',
      '## Availability Check',
      '| Name | .com | Instagram | LinkedIn | TikTok |',
      '|------|------|-----------|----------|--------|',
      ...rows,
      '',
      '> Note: Instagram/TikTok 403s are often bot-squatted handles. Verify manually before ruling them out.',
    ].join('\n');
  }

  const output = raw + availabilitySection;
  saveArtifact(idea_slug, 'names.md', output);
  memory.store('names', `Names for: ${idea_slug}`, { slug: idea_slug, names: generatedNames });

  return ok(output);
}

async function handleNameCheck(args) {
  const { name } = args;

  const result = await checkAvailability(name);

  const lines = [
    `# Availability Check: **${result.name}**`,
    `**Handle variant:** \`${result.handle}\``,
    '',
    `## Domain`,
    `- **${result.domain.domain}:** ${result.domain.available ? '✅ Available' : result.domain.available === false ? '❌ Taken' : '⚠️ Unknown'} (${result.domain.status})`,
    '',
    `## Social Handles (@${result.handle})`,
    ...result.socials.map(s =>
      `- **${s.platform}:** ${s.available ? '✅ Available' : s.available === false ? '❌ Taken' : '⚠️ Unknown'} (${s.status})`
    ),
    '',
    `## Summary`,
    result.summary,
  ];

  memory.store('name_checks', `Name check: ${name}`, { name, result: result.summary });
  return ok(lines.join('\n'));
}

async function handleCompetitors(args) {
  const { idea_slug, market = '' } = args;
  const brief = readIdeaBrief(idea_slug);

  const spec = loadAgentSpec('market-analyst');
  const task = `Analyze the competitive landscape for the business idea: "${idea_slug}"${market ? ` focused on the ${market} market` : ''}. Identify direct competitors, indirect competitors/substitutes, market gaps, and differentiation opportunities.`;
  const output = await dispatch('market-analyst', spec, task, brief);

  saveArtifact(idea_slug, 'competitive.md', output);
  memory.store('competitive', `Competitive: ${idea_slug}`, { slug: idea_slug });

  return ok(output);
}

async function handleFinancials(args) {
  const { idea_slug, assumptions = {} } = args;
  const brief = readIdeaBrief(idea_slug);

  const assumptionsText = Object.keys(assumptions).length
    ? `\n\nUse these specific assumptions:\n${JSON.stringify(assumptions, null, 2)}`
    : '';

  const spec = loadAgentSpec('financial-analyst');
  const task = `Build a financial model for the business idea: "${idea_slug}".${assumptionsText}`;
  const output = await dispatch('financial-analyst', spec, task, brief);

  saveArtifact(idea_slug, 'financials.md', output);
  memory.store('financials', `Financials: ${idea_slug}`, { slug: idea_slug });

  return ok(output);
}

async function handlePlaybook(args) {
  const { idea_slug } = args;

  const brief = readIdeaBrief(idea_slug);
  const financials = readArtifact(idea_slug, 'financials.md') || '';
  const competitive = readArtifact(idea_slug, 'competitive.md') || '';

  const context = [
    brief && `## Validation Brief\n${brief}`,
    financials && `## Financial Model\n${financials}`,
    competitive && `## Competitive Analysis\n${competitive}`,
  ].filter(Boolean).join('\n\n---\n\n');

  const spec = loadAgentSpec('strategist');
  const task = `Generate a 30/60/90-day execution playbook for the business idea: "${idea_slug}". Use all provided analysis to make specific, actionable recommendations.`;
  const output = await dispatch('strategist', spec, task, context);

  saveArtifact(idea_slug, 'playbook.md', output);
  memory.store('playbooks', `Playbook: ${idea_slug}`, { slug: idea_slug });

  return ok(output);
}

async function handleFullRun(args) {
  const { idea, sector = '', constraints = '' } = args;
  const slug = toSlug(idea);

  const params = { constraints, sector };
  const goalWithSlug = idea;

  // Patch orchestrator to use this slug for output paths
  // We inject slug into params so {{slug}} substitution works
  const patchedParams = { ...params, slug };

  const { summary, results } = await runWorkflow('full-analysis', goalWithSlug, patchedParams, WORKSPACE, memory);

  // Generate names with live availability checks via the same handler
  try {
    await handleName({ idea_slug: slug, style: 'mixed', count: 6 });
  } catch {
    // non-fatal
  }

  const artifactList = [
    `ideas/${slug}/brief.md`,
    `ideas/${slug}/competitive.md`,
    `ideas/${slug}/financials.md`,
    `ideas/${slug}/canvas.md`,
    `ideas/${slug}/pitchdeck.md`,
    `ideas/${slug}/playbook.md`,
    `ideas/${slug}/names.md`,
  ].filter(f => fs.existsSync(path.join(WORKSPACE, f)));

  const header = [
    `# Full Analysis Complete: ${idea}`,
    `**Slug:** \`${slug}\``,
    `**Artifacts generated:**`,
    ...artifactList.map(f => `- \`${f}\``),
    '',
    '---',
    '',
  ].join('\n');

  return ok(header + summary);
}

async function handleRecall(args) {
  const { query, limit = 10, type } = args;
  const results = memory.recall(query, limit, type && type !== 'all' ? type : null);

  if (!results.length) return ok(`No results found for: "${query}"`);

  const formatted = results.map((r, i) =>
    `### ${i + 1}. [${r.type}] ${r.content.substring(0, 150)}\n*${r.created_at}*`
  ).join('\n\n');

  return ok(`# Recall: "${query}"\n**${results.length} result(s) found**\n\n${formatted}`);
}

async function handleTam(args) {
  const { idea_slug, geography = '' } = args;
  const brief = readIdeaBrief(idea_slug);
  const spec = loadAgentSpec('market-analyst');
  const task = `Produce a deep TAM/SAM/SOM analysis using both top-down and bottom-up methodology for the business idea: "${idea_slug}".${geography ? ` Focus on the ${geography} geography.` : ''} Break down Total Addressable Market, Serviceable Addressable Market, and Serviceable Obtainable Market with explicit assumptions for each. Include 5-year market growth projections.`;
  const output = await dispatch('market-analyst', spec, task, brief);
  await saveArtifact(idea_slug, 'tam.md', output);
  memory.store('tam', `TAM: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handlePersonas(args) {
  const { idea_slug, segment_focus = '' } = args;
  const brief = readIdeaBrief(idea_slug);
  const spec = loadAgentSpec('persona-analyst');
  const task = `Generate 3-5 customer personas with Jobs-to-be-Done framing, ICP prioritization, and willingness-to-pay estimates for: "${idea_slug}".${segment_focus ? ` Focus on the ${segment_focus} segment.` : ''}`;
  const output = await dispatch('persona-analyst', spec, task, brief);
  await saveArtifact(idea_slug, 'personas.md', output);
  memory.store('personas', `Personas: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleTrends(args) {
  const { idea_slug, horizon = '3yr' } = args;
  const brief = readIdeaBrief(idea_slug);
  const tam = readArtifact(idea_slug, 'tam.md') ?? '';
  const context = [brief, tam].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('trend-analyst');
  const task = `Analyze industry trends using PESTLE and technology S-curves for: "${idea_slug}". Time horizon: ${horizon}. Identify tailwinds, headwinds, and market timing verdict.`;
  const output = await dispatch('trend-analyst', spec, task, context);
  await saveArtifact(idea_slug, 'trends.md', output);
  memory.store('trends', `Trends: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleSwot(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const context = [brief, comp].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('strategy-analyst');
  const task = `Produce a SWOT analysis + Porter's Five Forces (each force rated 1-5) with strategic cross-analysis for: "${idea_slug}"`;
  const output = await dispatch('strategy-analyst', spec, task, context);
  await saveArtifact(idea_slug, 'swot.md', output);
  memory.store('swot', `SWOT: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handlePricing(args) {
  const { idea_slug, model_preference = '' } = args;
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const context = [brief, personas, comp].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('pricing-strategist');
  const task = `Design a 3-tier pricing architecture with model selection, competitor price table, and expansion revenue paths for: "${idea_slug}".${model_preference ? ` Preferred model: ${model_preference}.` : ''}`;
  const output = await dispatch('pricing-strategist', spec, task, context);
  await saveArtifact(idea_slug, 'pricing.md', output);
  memory.store('pricing', `Pricing: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleGtm(args) {
  const { idea_slug, stage = '' } = args;
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const pricing = readArtifact(idea_slug, 'pricing.md') ?? '';
  const context = [brief, personas, comp, pricing].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('gtm-strategist');
  const task = `Create a go-to-market strategy with beachhead segment, channel plan, and launch roadmap for: "${idea_slug}".${stage ? ` Current stage: ${stage}.` : ''}`;
  const output = await dispatch('gtm-strategist', spec, task, context);
  await saveArtifact(idea_slug, 'gtm.md', output);
  memory.store('gtm', `GTM: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleJourney(args) {
  const { idea_slug, persona = '' } = args;
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const context = [brief, personas].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('journey-mapper');
  const task = `Map the 7-stage customer journey with moments of truth, drop-off risks, and delight opportunities for: "${idea_slug}".${persona ? ` Focus on persona: ${persona}.` : ''}`;
  const output = await dispatch('journey-mapper', spec, task, context);
  await saveArtifact(idea_slug, 'journey.md', output);
  memory.store('journey', `Journey: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleLandscape(args) {
  const { idea_slug, market = '' } = args;
  const brief = readIdeaBrief(idea_slug);
  const spec = loadAgentSpec('competitive-intelligence');
  const task = `Produce a deep competitive intelligence analysis with funding trajectories, moat assessment, white-space map, and positioning grid for: "${idea_slug}".${market ? ` Market focus: ${market}.` : ''}`;
  const output = await dispatch('competitive-intelligence', spec, task, brief);
  await saveArtifact(idea_slug, 'landscape.md', output);
  memory.store('landscape', `Landscape: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleModel(args) {
  const { idea_slug, assumptions = {} } = args;
  const brief = readIdeaBrief(idea_slug);
  const assumptionsText = Object.keys(assumptions).length
    ? `\n\nUse these specific base-case assumptions:\n${JSON.stringify(assumptions, null, 2)}`
    : '';
  const spec = loadAgentSpec('financial-modeler');
  const task = `Build a 3-scenario financial model (base/upside/downside) with monthly P&L, cohort retention, sensitivity analysis, and funding requirements for: "${idea_slug}".${assumptionsText}`;
  const output = await dispatch('financial-modeler', spec, task, brief);
  await saveArtifact(idea_slug, 'model.md', output);
  memory.store('model', `Model: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleRisks(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);
  const financials = readArtifact(idea_slug, 'financials.md') ?? '';
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const context = [brief, financials, comp].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('risk-analyst');
  const task = `Build a risk register (probability × impact), 3-scenario narratives, and regulatory assessment for: "${idea_slug}"`;
  const output = await dispatch('risk-analyst', spec, task, context);
  await saveArtifact(idea_slug, 'risks.md', output);
  memory.store('risks', `Risks: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleExpansion(args) {
  const { idea_slug, target_markets = '' } = args;
  const brief = readIdeaBrief(idea_slug);
  const tam = readArtifact(idea_slug, 'tam.md') ?? '';
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const context = [brief, tam, comp].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('expansion-strategist');
  const task = `Design a market entry mode analysis and 3-phase expansion roadmap with go/no-go criteria for: "${idea_slug}".${target_markets ? ` Target markets: ${target_markets}.` : ''}`;
  const output = await dispatch('expansion-strategist', spec, task, context);
  await saveArtifact(idea_slug, 'expansion.md', output);
  memory.store('expansion', `Expansion: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleSynthesis(args) {
  const { idea_slug } = args;
  const artifactFiles = [
    'brief.md', 'competitive.md', 'landscape.md', 'financials.md', 'model.md',
    'tam.md', 'personas.md', 'trends.md', 'swot.md', 'pricing.md',
    'gtm.md', 'journey.md', 'risks.md', 'expansion.md',
  ];
  const parts = artifactFiles
    .map(f => ({ file: f, content: readArtifact(idea_slug, f) }))
    .filter(({ content }) => content !== null)
    .map(({ file, content }) => `## ${file}\n\n${content}`);

  const context = parts.join('\n\n---\n\n');
  const spec = loadAgentSpec('executive-advisor');
  const task = `Synthesize all available analysis into a board-level executive brief with conviction score and strategic recommendation for: "${idea_slug}"`;
  const output = await dispatch('executive-advisor', spec, task, context);
  await saveArtifact(idea_slug, 'synthesis.md', output);
  memory.store('synthesis', `Synthesis: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

async function handleDeepRun(args) {
  const { idea, sector = '', constraints = '' } = args;
  const slug = toSlug(idea);
  const patchedParams = { constraints, sector, slug };

  const { summary } = await runWorkflow('deep-analysis', idea, patchedParams, WORKSPACE, memory);

  try {
    await handleName({ idea_slug: slug, style: 'mixed', count: 6 });
  } catch {
    // non-fatal
  }

  const artifactFiles = [
    'brief.md', 'personas.md', 'trends.md', 'competitive.md', 'tam.md',
    'financials.md', 'model.md', 'swot.md', 'pricing.md', 'gtm.md',
    'journey.md', 'risks.md', 'landscape.md', 'expansion.md', 'synthesis.md', 'names.md',
  ];
  const artifactList = artifactFiles
    .map(f => `ideas/${slug}/${f}`)
    .filter(f => fs.existsSync(path.join(WORKSPACE, f)));

  const header = [
    `# Deep Analysis Complete: ${idea}`,
    `**Slug:** \`${slug}\``,
    `**Artifacts generated:**`,
    ...artifactList.map(f => `- \`${f}\``),
    '',
    '---',
    '',
  ].join('\n');

  return ok(header + summary);
}

// ── server setup ───────────────────────────────────────────────────────────

const server = new Server(
  { name: 'chatgipite', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS.tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'biz_generate':    return await handleGenerate(args);
      case 'biz_validate':    return await handleValidate(args);
      case 'biz_ice_score':   return await handleIceScore(args);
      case 'biz_canvas':      return await handleCanvas(args);
      case 'biz_pitchdeck':   return await handlePitchdeck(args);
      case 'biz_name':        return await handleName(args);
      case 'biz_name_check':  return await handleNameCheck(args);
      case 'biz_competitors': return await handleCompetitors(args);
      case 'biz_financials':  return await handleFinancials(args);
      case 'biz_playbook':    return await handlePlaybook(args);
      case 'biz_full_run':    return await handleFullRun(args);
      case 'biz_tam':         return await handleTam(args);
      case 'biz_personas':    return await handlePersonas(args);
      case 'biz_trends':      return await handleTrends(args);
      case 'biz_swot':        return await handleSwot(args);
      case 'biz_pricing':     return await handlePricing(args);
      case 'biz_gtm':         return await handleGtm(args);
      case 'biz_journey':     return await handleJourney(args);
      case 'biz_landscape':   return await handleLandscape(args);
      case 'biz_model':       return await handleModel(args);
      case 'biz_risks':       return await handleRisks(args);
      case 'biz_expansion':   return await handleExpansion(args);
      case 'biz_synthesis':   return await handleSynthesis(args);
      case 'biz_deep_run':    return await handleDeepRun(args);
      case 'biz_recall':      return await handleRecall(args);
      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(`${name} failed: ${e.message}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
