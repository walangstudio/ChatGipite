---
name: chatgipite
description: Generate, validate, and stress-test business ideas. Use when the user asks for idea generation, viability/ICE scoring, market sizing, competitor or landscape analysis, financial models, pricing, GTM/playbook plans, customer journeys, risk registers, pitch decks, business model canvas, expansion roadmaps, executive synthesis, or business-name + domain/social availability checks.
allowed-tools: Bash(node *)
---

# ChatGipite Skill

Run business-idea analysis tools that bundle structured prompts, multi-agent workflows, and SQLite-backed memory. Each tool below maps to a specialized subagent prompt and saves artifacts under `ideas/<slug>/`.

## How to invoke a tool

```bash
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs <tool_name> '<json_args>'
```

The script writes the tool's text output to stdout. Non-zero exit + stderr JSON on validation/runtime failure.

The script auto-detects the ChatGipite installation via `CHATGIPITE_HOME` env var, falling back to the parent of `${CLAUDE_SKILL_DIR}`. If neither resolves, ask the user to set `CHATGIPITE_HOME` to the absolute path of the ChatGipite repo.

## Single-tool calls (cheap, ~one agent dispatch)

- `biz_generate` — `{"sector"?, "problem"?, "constraints"?, "count"?:1}` → idea briefs
- `biz_validate` — `{"idea", "context"?}` → viability report + ICE; saves `brief.md`
- `biz_ice_score` — `{"idea", "context"?}` → ICE only
- `biz_canvas` — `{"idea_slug", "canvas_type"?:"bmc|lean|vpc|mission|ai-platform"}` → strategy canvas (default bmc)
- `biz_lean_canvas` — `{"idea_slug"}` → Lean Canvas (unproven ideas)
- `biz_value_prop` — `{"idea_slug"}` → Value Proposition Canvas
- `biz_mission_canvas` — `{"idea_slug"}` → Mission Model Canvas
- `biz_ai_canvas` — `{"idea_slug"}` → AI / Platform Canvas
- `biz_pitchdeck` — `{"idea_slug"}` → 10-slide deck
- `biz_competitors` — `{"idea_slug", "market"?}` → direct/indirect comp analysis
- `biz_financials` — `{"idea_slug", "assumptions"?}` → unit economics + 12-mo P&L
- `biz_playbook` — `{"idea_slug"}` → 30/60/90 plan
- `biz_tam` — `{"idea_slug", "geography"?}` → TAM/SAM/SOM
- `biz_personas` — `{"idea_slug", "segment_focus"?}` → 3-5 JTBD personas
- `biz_trends` — `{"idea_slug", "horizon"?:"1yr"|"3yr"|"5yr"}` → PESTLE + S-curve
- `biz_swot` — `{"idea_slug"}` → SWOT + Five Forces
- `biz_pricing` — `{"idea_slug", "model_preference"?}` → 3-tier pricing
- `biz_gtm` — `{"idea_slug", "stage"?}` → GTM with beachhead
- `biz_journey` — `{"idea_slug", "persona"?}` → 7-stage customer journey
- `biz_landscape` — `{"idea_slug", "market"?}` → deep competitive intel
- `biz_model` — `{"idea_slug", "assumptions"?}` → 3-scenario model + cohort + sensitivity
- `biz_risks` — `{"idea_slug"}` → risk register + scenarios + 90-day tests
- `biz_expansion` — `{"idea_slug", "target_markets"?}` → entry mode + 3-phase roadmap
- `biz_synthesis` — `{"idea_slug"}` → board-level executive brief from all artifacts
- `biz_north_star` — `{"idea_slug"}` → North Star metric + input model + guardrails
- `biz_rice_score` — `{"idea", "context"?}` → RICE prioritization score
- `biz_assumptions` — `{"idea_slug"}` → riskiest-assumption map + Test Card
- `biz_prfaq` — `{"idea_slug"}` → Working-Backwards press release + FAQ
- `biz_mvp` — `{"idea_slug"}` → smallest MVP scope to test the riskiest assumption

## Naming + availability

- `biz_name` — `{"idea_slug", "style"?, "count"?:8}` → name candidates + live DNS/social checks
- `biz_name_check` — `{"name", "tlds"?, "socials"?}` → availability (RDAP→WHOIS→DNS + 9 socials). Also standalone: `node scripts/check-name.mjs "Name"`

## Pipelines (run multiple agents)

- `biz_full_run` — `{"idea", "sector"?, "constraints"?}` → 6-step (validate → competitors → financials → canvas → pitchdeck → playbook) + names. Slow.
- `biz_deep_run` — `{"idea", "sector"?, "constraints"?}` → 15-step deep analysis + synthesis. Very slow.
- `biz_incubate` — `{"idea", "sector"?, "constraints"?}` → validate → assumptions → lean+vpc+north-star → MVP → pivot/persevere. Fast-launch loop.
- `biz_launch_sprint` — `{"idea", "sector"?, "constraints"?}` → validate → PR/FAQ → MVP → GTM → launch checklist.

## Memory recall

- `biz_recall` — `{"query", "limit"?:10, "type"?}` → FTS5 search over all stored artifacts

## Typical flow

1. `biz_generate` for ideas in a sector
2. `biz_validate` on the chosen idea — note the returned `idea_slug`
3. Use that slug with `biz_competitors`, `biz_financials`, `biz_canvas`, etc.
4. Or run `biz_full_run` / `biz_deep_run` for the full bundle

## Bash invocation examples

```bash
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_validate '{"idea":"AI legal triage for SMB law firms"}'
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_competitors '{"idea_slug":"ai-legal-triage-for-smb-law-firms","market":"US"}'
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_full_run '{"idea":"Subscription marketplace for refurbished e-bikes"}'
```

## API key

ChatGipite needs `ANTHROPIC_API_KEY` (or another provider configured in `config/providers.yaml`). Without one, the dispatcher falls back to passthrough mode — it returns the system prompt + task for the host model (you) to complete inline. Inform the user if you detect passthrough output (it begins with `> **[ChatGipite passthrough]**`).
