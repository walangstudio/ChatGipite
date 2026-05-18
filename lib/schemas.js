import { z } from 'zod';

// Common bounded primitives. Max lengths cap memory + LLM cost on adversarial
// or accidentally-pasted-novel inputs. Numbers picked so legitimate use is
// never blocked, abuse is.
const SHORT_STR_MAX = 200;
const LONG_STR_MAX = 8000;

// Slug is a security boundary: handlers use it as a path segment under ideas/,
// so anything outside [a-z0-9-] would allow path traversal.
const slug = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, 'must be lowercase alphanumerics and hyphens only');
const ideaSlug = z.object({ idea_slug: slug });

const idea = z.string().min(3).max(LONG_STR_MAX);
const optShort = z.string().max(SHORT_STR_MAX).optional().default('');
const optLong = z.string().max(LONG_STR_MAX).optional().default('');
const assumptions = z.record(z.string().max(80), z.any()).optional().default({});

export const schemas = {
  biz_generate: z.object({
    sector: optShort,
    problem: optLong,
    constraints: optLong,
    count: z.number().int().min(1).max(10).optional().default(1),
  }),

  biz_validate: z.object({
    idea,
    context: optLong,
  }),

  biz_ice_score: z.object({
    idea,
    context: optLong,
  }),

  biz_canvas: ideaSlug,

  biz_pitchdeck: ideaSlug,

  biz_name: z.object({
    idea_slug: slug,
    style: optShort,
    count: z.number().int().min(1).max(20).optional().default(8),
  }),

  biz_name_check: z.object({
    name: z.string().min(1).max(60),
    tlds: z.array(z.string().max(20)).max(20).optional(),
    socials: z.array(z.string().max(20)).max(20).optional(),
  }),

  biz_competitors: z.object({
    idea_slug: slug,
    market: optShort,
  }),

  biz_financials: z.object({
    idea_slug: slug,
    assumptions,
  }),

  biz_playbook: ideaSlug,

  biz_full_run: z.object({
    idea,
    sector: optShort,
    constraints: optLong,
  }),

  biz_tam: z.object({
    idea_slug: slug,
    geography: optShort,
  }),

  biz_personas: z.object({
    idea_slug: slug,
    segment_focus: optShort,
  }),

  biz_trends: z.object({
    idea_slug: slug,
    horizon: z.enum(['1yr', '3yr', '5yr']).optional().default('3yr'),
  }),

  biz_swot: ideaSlug,

  biz_pricing: z.object({
    idea_slug: slug,
    model_preference: optShort,
  }),

  biz_gtm: z.object({
    idea_slug: slug,
    stage: optShort,
  }),

  biz_journey: z.object({
    idea_slug: slug,
    persona: optShort,
  }),

  biz_landscape: z.object({
    idea_slug: slug,
    market: optShort,
  }),

  biz_model: z.object({
    idea_slug: slug,
    assumptions,
  }),

  biz_risks: ideaSlug,

  biz_expansion: z.object({
    idea_slug: slug,
    target_markets: optShort,
  }),

  biz_synthesis: ideaSlug,

  biz_deep_run: z.object({
    idea,
    sector: optShort,
    constraints: optLong,
  }),

  biz_recall: z.object({
    query: z.string().min(1).max(SHORT_STR_MAX),
    limit: z.number().int().min(1).max(50).optional().default(10),
    type: z.string().max(80).optional(),
  }),
};

export function validate(toolName, args) {
  const schema = schemas[toolName];
  if (!schema) {
    return { ok: false, code: 'UNKNOWN_TOOL', message: `Unknown tool: ${toolName}` };
  }
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    }));
    const summary = issues.map((i) => `${i.path || '<root>'}: ${i.message}`).join('; ');
    return { ok: false, code: 'INVALID_INPUT', message: summary, issues };
  }
  return { ok: true, value: parsed.data };
}
