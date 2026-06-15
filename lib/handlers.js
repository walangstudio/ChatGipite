import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';

import * as memory from './memory.js';
import { dispatch } from './llm-adapter.js';
import { run as runWorkflow } from './orchestrator.js';
import { checkAvailability, mark } from './name-checker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');

// Bounded fan-out: handleName checks N names × (TLDs + socials); without a cap
// that is 150+ concurrent sockets and triggers WHOIS/RDAP rate-limiting.
async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Memoize subagent specs — read on every dispatch and never change at runtime.
// Avoids 15+ disk reads per deep-analysis run.
const specCache = new Map();
function loadAgentSpec(agentId) {
  if (specCache.has(agentId)) return specCache.get(agentId);
  const p = path.join(WORKSPACE, 'subagents', `${agentId}.md`);
  let spec;
  try { spec = fs.readFileSync(p, 'utf-8'); }
  catch { spec = `You are the ${agentId} agent. Complete the task as described.`; }
  specCache.set(agentId, spec);
  return spec;
}

function toSlug(text) {
  // Trim hyphens *after* the substring cap so a slug clipped at a hyphen
  // boundary doesn't end with a trailing hyphen.
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 50)
    .replace(/^-+|-+$/g, '');
}

function shortHash(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
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

// Read a durable reference doc from knowledge/ (grounds specialist agents).
function readKnowledge(file) {
  try { return fs.readFileSync(path.join(WORKSPACE, 'knowledge', file), 'utf-8'); }
  catch { return ''; }
}

function saveArtifact(slug, file, content) {
  ideaDir(slug);
  fs.writeFileSync(path.join(WORKSPACE, 'ideas', slug, file), content);
}

function ok(text) {
  return { content: [{ type: 'text', text }] };
}

// Accept EITHER a saved idea_slug OR raw product text (new or existing product).
function resolveSubject(args) {
  if (args.idea_slug) return { slug: args.idea_slug, subjectText: readIdeaBrief(args.idea_slug) };
  // A product can pass Zod min(3) yet slugify to empty (all-punctuation, or a
  // non-Latin script like CJK). Fall back to a deterministic hash so artifacts
  // never land in the ideas/ root and the slug we persist matches the slug the
  // workflow derives (orchestrator's slugFor treats '' as falsy and re-derives).
  const slug = toSlug(args.product) || `subject-${shortHash(args.product)}`;
  // Persist ONLY subject.md (a name unique to raw-product input). Do NOT write
  // brief.md: it would clobber a validated idea's brief on a slug collision, and
  // neither the perspectives workflow (lenses read {{goal}}) nor runPsych (reads
  // the subject text directly) needs it.
  saveArtifact(slug, 'subject.md', `# Subject (raw input)\n\n${args.product}`);
  return { slug, subjectText: args.product };
}

export async function handleGenerate(args) {
  const { sector, problem, constraints, count } = args;
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

export async function handleValidate(args) {
  const { idea, context } = args;
  const slug = toSlug(idea);
  const spec = loadAgentSpec('validator');
  const task = `Perform a full viability analysis on this business idea: "${idea}"`;
  const output = await dispatch('validator', spec, task, context);
  saveArtifact(slug, 'brief.md', `# Validation: ${idea}\n\n${output}`);
  memory.store('validations', `Validated: ${idea}`, { slug });
  return ok(`**Idea slug:** \`${slug}\`\n\n${output}`);
}

export async function handleIceScore(args) {
  const { idea, context } = args;
  const spec = loadAgentSpec('validator');
  const task = `Compute an ICE score for this business idea: "${idea}". Focus on Impact (1-10), Confidence (1-10), and Ease (1-10) with detailed rationale for each dimension and an overall recommendation.`;
  const output = await dispatch('validator', spec, task, context);
  memory.store('ice_scores', `ICE: ${idea}`, {});
  return ok(output);
}

const CANVAS_TYPES = {
  bmc: { file: 'canvas.md', label: 'Business Model Canvas' },
  lean: { file: 'lean-canvas.md', label: 'Lean Canvas (Running Lean 3rd ed)' },
  vpc: { file: 'value-prop.md', label: 'Value Proposition Canvas' },
  mission: { file: 'mission-canvas.md', label: 'Mission Model Canvas' },
  'ai-platform': { file: 'ai-canvas.md', label: 'AI / Platform Canvas' },
};

async function runCanvas(idea_slug, type) {
  const canvasKey = CANVAS_TYPES[type] ? type : 'bmc';
  const meta = CANVAS_TYPES[canvasKey];
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const pricing = readArtifact(idea_slug, 'pricing.md') ?? '';
  const financials = readArtifact(idea_slug, 'financials.md') ?? '';
  const context = [
    brief && `## Validation Brief\n${brief}`,
    personas && `## Personas\n${personas}`,
    pricing && `## Pricing\n${pricing}`,
    financials && `## Financials\n${financials}`,
  ].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('canvas-strategist');
  const task = `Canvas type: ${canvasKey}. Produce the ${meta.label} for idea slug: "${idea_slug}" using the provided brief and any analyses as input.`;
  const output = await dispatch('canvas-strategist', spec, task, context);
  saveArtifact(idea_slug, meta.file, output);
  memory.store('canvases', `${meta.label}: ${idea_slug}`, { slug: idea_slug, canvas: canvasKey });
  return ok(output);
}

export async function handleCanvas(args) {
  const { idea_slug, canvas_type } = args;
  return runCanvas(idea_slug, canvas_type || 'bmc');
}

export async function handleLeanCanvas(args) {
  return runCanvas(args.idea_slug, 'lean');
}

export async function handleValueProp(args) {
  return runCanvas(args.idea_slug, 'vpc');
}

export async function handleMissionCanvas(args) {
  return runCanvas(args.idea_slug, 'mission');
}

export async function handleAiCanvas(args) {
  return runCanvas(args.idea_slug, 'ai-platform');
}

export async function handlePitchdeck(args) {
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

export async function handleName(args) {
  const { idea_slug, style, count } = args;
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
  const nameMatches = [...raw.matchAll(/^NAME:\s*(.+)$/gim)];
  const generatedNames = nameMatches.map((m) => m[1].trim()).filter(Boolean);

  let availabilitySection = '';
  if (generatedNames.length > 0) {
    const pick = (socials, platform) => mark(socials.find((s) => s.platform === platform)?.available);
    const checks = await mapLimit(generatedNames, 3, (n) => checkAvailability(n));
    const rows = checks.map((r) => {
      const dom = r.domains.find((d) => d.domain.endsWith('.com')) || r.domains[0];
      return `| **${r.name}** | ${mark(dom.available)} \`${dom.domain}\` | ${pick(r.socials, 'X/Twitter')} | ${pick(r.socials, 'Instagram')} | ${pick(r.socials, 'LinkedIn')} | ${pick(r.socials, 'GitHub')} |`;
    });
    availabilitySection = [
      '', '---', '',
      '## Availability Check',
      '| Name | .com | X | Instagram | LinkedIn | GitHub |',
      '|------|------|---|-----------|----------|--------|',
      ...rows,
      '',
      '> Note: IG/TikTok/X 403s are often bot-squatted or geo-blocked, not taken. Verify manually before ruling them out.',
    ].join('\n');
  }

  const output = raw + availabilitySection;
  saveArtifact(idea_slug, 'names.md', output);
  memory.store('names', `Names for: ${idea_slug}`, { slug: idea_slug, names: generatedNames });
  return ok(output);
}

export async function handleNameCheck(args) {
  const { name, tlds, socials } = args;
  const result = await checkAvailability(name, { tlds, socials });
  const lines = [
    `# Availability Check: **${result.name}**`,
    `**Handle variant:** \`${result.handle}\``,
    '',
    `## Domains`,
    ...result.domains.map((d) => `- **${d.domain}:** ${mark(d.available, true)} (${d.status})`),
    '',
    `## Social Handles (@${result.handle})`,
    ...result.socials.map((s) => `- **${s.platform}:** ${mark(s.available, true)} (${s.status})`),
    '',
    `## Summary`,
    result.summary,
  ];
  if (result.unrecognizedSocials?.length) {
    lines.push('', `> Ignored unrecognized socials: ${result.unrecognizedSocials.join(', ')}`);
  }
  memory.store('name_checks', `Name check: ${name}`, { name, result: result.summary });
  return ok(lines.join('\n'));
}

export async function handleCompetitors(args) {
  const { idea_slug, market } = args;
  const brief = readIdeaBrief(idea_slug);
  const spec = loadAgentSpec('market-analyst');
  const task = `Analyze the competitive landscape for the business idea: "${idea_slug}"${market ? ` focused on the ${market} market` : ''}. Identify direct competitors, indirect competitors/substitutes, market gaps, and differentiation opportunities.`;
  const output = await dispatch('market-analyst', spec, task, brief);
  saveArtifact(idea_slug, 'competitive.md', output);
  memory.store('competitive', `Competitive: ${idea_slug}`, { slug: idea_slug });
  return ok(output);
}

export async function handleFinancials(args) {
  const { idea_slug, assumptions } = args;
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

export async function handlePlaybook(args) {
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

export async function handleFullRun(args) {
  const { idea, sector, constraints } = args;
  const slug = toSlug(idea);
  const patchedParams = { constraints, sector, slug };
  const { summary } = await runWorkflow('full-analysis', idea, patchedParams, WORKSPACE, memory);

  try { await handleName({ idea_slug: slug, style: 'mixed', count: 6 }); } catch {}

  const artifactList = [
    `ideas/${slug}/brief.md`,
    `ideas/${slug}/competitive.md`,
    `ideas/${slug}/financials.md`,
    `ideas/${slug}/canvas.md`,
    `ideas/${slug}/pitchdeck.md`,
    `ideas/${slug}/playbook.md`,
    `ideas/${slug}/names.md`,
  ].filter((f) => fs.existsSync(path.join(WORKSPACE, f)));

  const header = [
    `# Full Analysis Complete: ${idea}`,
    `**Slug:** \`${slug}\``,
    `**Artifacts generated:**`,
    ...artifactList.map((f) => `- \`${f}\``),
    '', '---', '',
  ].join('\n');

  return ok(header + summary);
}

export async function handleRecall(args) {
  const { query, limit, type } = args;
  const results = memory.recall(query, limit, type && type !== 'all' ? type : null);
  if (!results.length) return ok(`No results found for: "${query}"`);
  const formatted = results.map((r, i) =>
    `### ${i + 1}. [${r.type}] ${r.content.substring(0, 150)}\n*${r.created_at}*`,
  ).join('\n\n');
  return ok(`# Recall: "${query}"\n**${results.length} result(s) found**\n\n${formatted}`);
}

export async function handleTam(args) {
  const { idea_slug, geography } = args;
  const brief = readIdeaBrief(idea_slug);
  const spec = loadAgentSpec('market-analyst');
  const task = `Produce a deep TAM/SAM/SOM analysis using both top-down and bottom-up methodology for the business idea: "${idea_slug}".${geography ? ` Focus on the ${geography} geography.` : ''} Break down Total Addressable Market, Serviceable Addressable Market, and Serviceable Obtainable Market with explicit assumptions for each. Include 5-year market growth projections.`;
  const output = await dispatch('market-analyst', spec, task, brief);
  saveArtifact(idea_slug, 'tam.md', output);
  memory.store('tam', `TAM: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handlePersonas(args) {
  const { idea_slug, segment_focus } = args;
  const brief = readIdeaBrief(idea_slug);
  const spec = loadAgentSpec('persona-analyst');
  const task = `Generate 3-5 customer personas with Jobs-to-be-Done framing, ICP prioritization, and willingness-to-pay estimates for: "${idea_slug}".${segment_focus ? ` Focus on the ${segment_focus} segment.` : ''}`;
  const output = await dispatch('persona-analyst', spec, task, brief);
  saveArtifact(idea_slug, 'personas.md', output);
  memory.store('personas', `Personas: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleTrends(args) {
  const { idea_slug, horizon } = args;
  const brief = readIdeaBrief(idea_slug);
  const tam = readArtifact(idea_slug, 'tam.md') ?? '';
  const context = [brief, tam].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('trend-analyst');
  const task = `Analyze industry trends using PESTLE and technology S-curves for: "${idea_slug}". Time horizon: ${horizon}. Identify tailwinds, headwinds, and market timing verdict.`;
  const output = await dispatch('trend-analyst', spec, task, context);
  saveArtifact(idea_slug, 'trends.md', output);
  memory.store('trends', `Trends: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleSwot(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const context = [brief, comp].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('strategy-analyst');
  const task = `Produce a SWOT analysis + Porter's Five Forces (each force rated 1-5) with strategic cross-analysis for: "${idea_slug}"`;
  const output = await dispatch('strategy-analyst', spec, task, context);
  saveArtifact(idea_slug, 'swot.md', output);
  memory.store('swot', `SWOT: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handlePricing(args) {
  const { idea_slug, model_preference } = args;
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const context = [brief, personas, comp].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('pricing-strategist');
  const task = `Design a 3-tier pricing architecture with model selection, competitor price table, and expansion revenue paths for: "${idea_slug}".${model_preference ? ` Preferred model: ${model_preference}.` : ''}`;
  const output = await dispatch('pricing-strategist', spec, task, context);
  saveArtifact(idea_slug, 'pricing.md', output);
  memory.store('pricing', `Pricing: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleGtm(args) {
  const { idea_slug, stage } = args;
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const pricing = readArtifact(idea_slug, 'pricing.md') ?? '';
  const context = [brief, personas, comp, pricing].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('gtm-strategist');
  const task = `Create a go-to-market strategy with beachhead segment, channel plan, and launch roadmap for: "${idea_slug}".${stage ? ` Current stage: ${stage}.` : ''}`;
  const output = await dispatch('gtm-strategist', spec, task, context);
  saveArtifact(idea_slug, 'gtm.md', output);
  memory.store('gtm', `GTM: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleJourney(args) {
  const { idea_slug, persona } = args;
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const context = [brief, personas].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('journey-mapper');
  const task = `Map the 7-stage customer journey with moments of truth, drop-off risks, and delight opportunities for: "${idea_slug}".${persona ? ` Focus on persona: ${persona}.` : ''}`;
  const output = await dispatch('journey-mapper', spec, task, context);
  saveArtifact(idea_slug, 'journey.md', output);
  memory.store('journey', `Journey: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleLandscape(args) {
  const { idea_slug, market } = args;
  const brief = readIdeaBrief(idea_slug);
  const spec = loadAgentSpec('competitive-intelligence');
  const task = `Produce a deep competitive intelligence analysis with funding trajectories, moat assessment, white-space map, and positioning grid for: "${idea_slug}".${market ? ` Market focus: ${market}.` : ''}`;
  const output = await dispatch('competitive-intelligence', spec, task, brief);
  saveArtifact(idea_slug, 'landscape.md', output);
  memory.store('landscape', `Landscape: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleModel(args) {
  const { idea_slug, assumptions } = args;
  const brief = readIdeaBrief(idea_slug);
  const assumptionsText = Object.keys(assumptions).length
    ? `\n\nUse these specific base-case assumptions:\n${JSON.stringify(assumptions, null, 2)}`
    : '';
  const spec = loadAgentSpec('financial-modeler');
  const task = `Build a 3-scenario financial model (base/upside/downside) with monthly P&L, cohort retention, sensitivity analysis, and funding requirements for: "${idea_slug}".${assumptionsText}`;
  const output = await dispatch('financial-modeler', spec, task, brief);
  saveArtifact(idea_slug, 'model.md', output);
  memory.store('model', `Model: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleRisks(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);
  const financials = readArtifact(idea_slug, 'financials.md') ?? '';
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const context = [brief, financials, comp].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('risk-analyst');
  const task = `Build a risk register (probability × impact), 3-scenario narratives, and regulatory assessment for: "${idea_slug}"`;
  const output = await dispatch('risk-analyst', spec, task, context);
  saveArtifact(idea_slug, 'risks.md', output);
  memory.store('risks', `Risks: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleExpansion(args) {
  const { idea_slug, target_markets } = args;
  const brief = readIdeaBrief(idea_slug);
  const tam = readArtifact(idea_slug, 'tam.md') ?? '';
  const comp = readArtifact(idea_slug, 'competitive.md') ?? '';
  const context = [brief, tam, comp].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('expansion-strategist');
  const task = `Design a market entry mode analysis and 3-phase expansion roadmap with go/no-go criteria for: "${idea_slug}".${target_markets ? ` Target markets: ${target_markets}.` : ''}`;
  const output = await dispatch('expansion-strategist', spec, task, context);
  saveArtifact(idea_slug, 'expansion.md', output);
  memory.store('expansion', `Expansion: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handleSynthesis(args) {
  const { idea_slug } = args;
  const artifactFiles = [
    'brief.md', 'subject.md', 'competitive.md', 'landscape.md', 'financials.md', 'model.md',
    'tam.md', 'personas.md', 'trends.md', 'swot.md', 'pricing.md',
    'gtm.md', 'journey.md', 'risks.md', 'expansion.md',
    'perspective-review.md', 'product-psychology.md', 'marketing-psychology.md',
  ];
  const parts = artifactFiles
    .map((f) => ({ file: f, content: readArtifact(idea_slug, f) }))
    .filter(({ content }) => content !== null)
    .map(({ file, content }) => `## ${file}\n\n${content}`);
  const context = parts.join('\n\n---\n\n');
  const spec = loadAgentSpec('executive-advisor');
  const task = `Synthesize all available analysis into a board-level executive brief with conviction score and strategic recommendation for: "${idea_slug}"`;
  const output = await dispatch('executive-advisor', spec, task, context);
  saveArtifact(idea_slug, 'synthesis.md', output);
  memory.store('synthesis', `Synthesis: ${idea_slug}`, { idea: idea_slug });
  return ok(output);
}

export async function handlePerspectives(args) {
  const { slug, subjectText } = resolveSubject(args);
  const { summary } = await runWorkflow(
    'perspectives', subjectText, { constraints: args.constraints || '', slug }, WORKSPACE, memory,
  );
  memory.store('perspectives', `Perspectives: ${slug}`, { slug });
  return ok(`# Perspective Analysis\n**Slug:** \`${slug}\`\n\n---\n\n${summary}`);
}

async function runPsych(agentId, artifact, memType, args) {
  const { slug, subjectText } = resolveSubject(args);
  const personas = readArtifact(slug, 'personas.md') ?? '';
  const journey = readArtifact(slug, 'journey.md') ?? '';
  const context = [
    subjectText,
    personas && `## Personas\n${personas}`,
    journey && `## Journey\n${journey}`,
  ].filter(Boolean).join('\n\n---\n\n');
  const mode = args.mode || 'full';
  const spec = loadAgentSpec(agentId);
  const task = `Mode: ${mode}. Apply your psychology lens and run the technique-density audit for: "${slug}".`;
  const output = await dispatch(agentId, spec, task, context);
  saveArtifact(slug, artifact, output);
  memory.store(memType, `${memType}: ${slug}`, { slug, mode });
  return ok(output);
}

export function handleProductPsych(args) {
  return runPsych('product-psychologist', 'product-psychology.md', 'product_psych', args);
}

export function handleMarketingPsych(args) {
  return runPsych('marketing-psychologist', 'marketing-psychology.md', 'marketing_psych', args);
}

export async function handleEngagement(args) {
  const { slug, subjectText } = resolveSubject(args);
  const personas = readArtifact(slug, 'personas.md') ?? '';
  const journey = readArtifact(slug, 'journey.md') ?? '';
  const kb = readKnowledge('engagement-ethics.md');
  const mode = args.mode || 'full';
  const context = [
    subjectText,
    personas && `## Personas\n${personas}`,
    journey && `## Journey\n${journey}`,
    kb && `## Reference — Engagement Ethics Knowledge Base\n${kb}`,
  ].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('engagement-ethicist');
  const task = `Mode: ${mode}. Audit "${slug}" for addictive/abusive engagement patterns (warn with severity + regulatory exposure) and prescribe ethical engagement/retention. Ground every claim in the reference knowledge base.`;
  const output = await dispatch('engagement-ethicist', spec, task, context);
  saveArtifact(slug, 'engagement.md', output);
  memory.store('engagement', `Engagement audit: ${slug}`, { slug, mode });
  return ok(output);
}

export async function handleDeepRun(args) {
  const { idea, sector, constraints } = args;
  const slug = toSlug(idea);
  const patchedParams = { constraints, sector, slug };
  const { summary } = await runWorkflow('deep-analysis', idea, patchedParams, WORKSPACE, memory);

  try { await handleName({ idea_slug: slug, style: 'mixed', count: 6 }); } catch {}

  const artifactFiles = [
    'brief.md', 'personas.md', 'trends.md', 'competitive.md', 'tam.md',
    'financials.md', 'model.md', 'swot.md', 'pricing.md', 'gtm.md',
    'journey.md', 'risks.md', 'landscape.md', 'expansion.md',
    'lens-contrarian.md', 'lens-customer.md', 'lens-operator.md',
    'lens-investor.md', 'lens-regulator.md', 'lens-futurist.md',
    'perspective-review.md', 'product-psychology.md', 'marketing-psychology.md',
    'synthesis.md', 'names.md',
  ];
  const artifactList = artifactFiles
    .map((f) => `ideas/${slug}/${f}`)
    .filter((f) => fs.existsSync(path.join(WORKSPACE, f)));

  const header = [
    `# Deep Analysis Complete: ${idea}`,
    `**Slug:** \`${slug}\``,
    `**Artifacts generated:**`,
    ...artifactList.map((f) => `- \`${f}\``),
    '', '---', '',
  ].join('\n');

  return ok(header + summary);
}

export async function handleNorthStar(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const context = [brief, personas].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('north-star-architect');
  const task = `Define the North Star Metric and input model for: "${idea_slug}".`;
  const output = await dispatch('north-star-architect', spec, task, context);
  saveArtifact(idea_slug, 'north-star.md', output);
  memory.store('north_star', `North Star: ${idea_slug}`, { slug: idea_slug });
  return ok(output);
}

export async function handleRiceScore(args) {
  const { idea, context } = args;
  const spec = loadAgentSpec('rice-scorer');
  const task = `Compute the RICE score for: "${idea}". Emit only the RICE Score format.`;
  const output = await dispatch('rice-scorer', spec, task, context);
  memory.store('rice_scores', `RICE: ${idea}`, {});
  return ok(output);
}

export async function handleAssumptions(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);
  const spec = loadAgentSpec('incubation-coach');
  const task = `Produce the "assumptions" block: rank the riskiest assumptions and write a Test Card for the riskiest one for: "${idea_slug}".`;
  const output = await dispatch('incubation-coach', spec, task, brief);
  saveArtifact(idea_slug, 'assumptions.md', output);
  memory.store('assumptions', `Assumptions: ${idea_slug}`, { slug: idea_slug });
  return ok(output);
}

export async function handlePrfaq(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);
  const personas = readArtifact(idea_slug, 'personas.md') ?? '';
  const context = [brief, personas].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('working-backwards-writer');
  const task = `Produce the "prfaq" block: a launch press release + internal/customer FAQ for: "${idea_slug}".`;
  const output = await dispatch('working-backwards-writer', spec, task, context);
  saveArtifact(idea_slug, 'prfaq.md', output);
  memory.store('prfaq', `PR/FAQ: ${idea_slug}`, { slug: idea_slug });
  return ok(output);
}

export async function handleMvp(args) {
  const { idea_slug } = args;
  const brief = readIdeaBrief(idea_slug);
  const assumptions = readArtifact(idea_slug, 'assumptions.md') ?? '';
  const context = [brief, assumptions].filter(Boolean).join('\n\n---\n\n');
  const spec = loadAgentSpec('mvp-scoper');
  const task = `Scope the smallest MVP that tests the riskiest assumption for: "${idea_slug}".`;
  const output = await dispatch('mvp-scoper', spec, task, context);
  saveArtifact(idea_slug, 'mvp.md', output);
  memory.store('mvp', `MVP: ${idea_slug}`, { slug: idea_slug });
  return ok(output);
}

async function runPipeline(workflowName, args, artifactFiles, title) {
  const { idea, sector, constraints } = args;
  const slug = toSlug(idea);
  const { summary } = await runWorkflow(workflowName, idea, { constraints, sector, slug }, WORKSPACE, memory);
  const artifactList = artifactFiles
    .map((f) => `ideas/${slug}/${f}`)
    .filter((f) => fs.existsSync(path.join(WORKSPACE, f)));
  const header = [
    `# ${title}: ${idea}`,
    `**Slug:** \`${slug}\``,
    `**Artifacts generated:**`,
    ...artifactList.map((f) => `- \`${f}\``),
    '', '---', '',
  ].join('\n');
  return ok(header + summary);
}

export async function handleIncubate(args) {
  return runPipeline(
    'incubation',
    args,
    ['brief.md', 'assumptions.md', 'lean-canvas.md', 'value-prop.md', 'north-star.md', 'mvp.md', 'incubation-decision.md'],
    'Incubation Complete',
  );
}

export async function handleLaunchSprint(args) {
  return runPipeline(
    'launch-sprint',
    args,
    ['brief.md', 'prfaq.md', 'mvp.md', 'gtm.md', 'launch-checklist.md'],
    'Launch Sprint Complete',
  );
}

export const handlers = {
  biz_generate: handleGenerate,
  biz_validate: handleValidate,
  biz_ice_score: handleIceScore,
  biz_canvas: handleCanvas,
  biz_lean_canvas: handleLeanCanvas,
  biz_value_prop: handleValueProp,
  biz_mission_canvas: handleMissionCanvas,
  biz_ai_canvas: handleAiCanvas,
  biz_pitchdeck: handlePitchdeck,
  biz_name: handleName,
  biz_name_check: handleNameCheck,
  biz_competitors: handleCompetitors,
  biz_financials: handleFinancials,
  biz_playbook: handlePlaybook,
  biz_full_run: handleFullRun,
  biz_tam: handleTam,
  biz_personas: handlePersonas,
  biz_trends: handleTrends,
  biz_swot: handleSwot,
  biz_pricing: handlePricing,
  biz_gtm: handleGtm,
  biz_journey: handleJourney,
  biz_landscape: handleLandscape,
  biz_model: handleModel,
  biz_risks: handleRisks,
  biz_expansion: handleExpansion,
  biz_synthesis: handleSynthesis,
  biz_perspectives: handlePerspectives,
  biz_product_psych: handleProductPsych,
  biz_marketing_psych: handleMarketingPsych,
  biz_engagement: handleEngagement,
  biz_deep_run: handleDeepRun,
  biz_north_star: handleNorthStar,
  biz_rice_score: handleRiceScore,
  biz_assumptions: handleAssumptions,
  biz_prfaq: handlePrfaq,
  biz_mvp: handleMvp,
  biz_incubate: handleIncubate,
  biz_launch_sprint: handleLaunchSprint,
  biz_recall: handleRecall,
};
