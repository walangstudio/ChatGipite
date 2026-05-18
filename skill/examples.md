# ChatGipite Skill — examples

Quick recipes the model can copy-adapt.

## 1. Generate ideas in a sector

```bash
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_generate '{"sector":"healthtech","problem":"chronic-disease medication adherence","count":3}'
```

## 2. Validate one idea, then deep-dive

```bash
# returns the idea_slug in its first line
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_validate '{"idea":"AI medication-adherence coach for older adults"}'

# follow-ups using the slug
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_competitors '{"idea_slug":"ai-medication-adherence-coach-for-older-a","market":"US"}'
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_financials  '{"idea_slug":"ai-medication-adherence-coach-for-older-a","assumptions":{"price_per_user":29,"monthly_churn_pct":4}}'
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_pricing     '{"idea_slug":"ai-medication-adherence-coach-for-older-a"}'
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_gtm         '{"idea_slug":"ai-medication-adherence-coach-for-older-a"}'
```

## 3. One-shot full run (6 steps)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_full_run '{"idea":"Subscription marketplace for refurbished e-bikes","sector":"mobility"}'
```

## 4. Name + availability

```bash
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_name '{"idea_slug":"refurbished-e-bike-marketplace","style":"coined","count":8}'
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_name_check '{"name":"Velora"}'
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_name_check '{"name":"Velora","tlds":["com","io","ai"],"socials":["x","github","instagram"]}'
```

Standalone CLI (no MCP/skill needed, runs anywhere Node ≥20 runs):

```bash
node scripts/check-name.mjs "Velora" --tlds com,io,ai --socials x,github --json
npm run check-name -- "Velora"
```

## 5. Recall prior work

```bash
node ${CLAUDE_SKILL_DIR}/scripts/run-tool.mjs biz_recall '{"query":"e-bike pricing","limit":5}'
```

## Reading slugs

`biz_validate` prints `**Idea slug:** \`<slug>\`` as its first line. Capture that slug for all subsequent calls. Or compute it: lowercase, non-alphanumerics → `-`, trimmed to 50 chars.
