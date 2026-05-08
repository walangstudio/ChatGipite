# Prompt A/B Test Harness

Compares the pre-modernization (`A`) vs post-modernization (`B`) subagent prompts on three fixed sample ideas, then has Claude judge the pairs.

## Setup

```sh
export ANTHROPIC_API_KEY=sk-ant-...
npm install
```

## Run

```sh
npm run test:ab          # run all 36 generations (3 samples × 6 agents × 2 variants)
npm run test:judge       # score the latest run; writes REPORT.md
```

## Variants

Three variants per (sample, agent), 54 generations total:
- `a` — pre-Phase-2 baseline prompt (frozen under `prompts/baseline/`)
- `b` — current tightened prompt (live, from `../subagents/`)
- `vanilla` — empty system prompt; measures whether our prompt does real work vs default Claude

Limit which variants run with `AB_VARIANTS=b,vanilla npm run test:ab`.

The judge runs **two comparisons** per (sample, agent):
- **b vs a** — does Phase 2 hold quality vs the pre-modernization prompts?
- **b vs vanilla** — does our prompt deliver real value vs no prompt at all?

## Outputs

```
tests/results/<date>/
├── summary.json
├── verdicts.json
├── REPORT.md                 # aggregate + per-agent + per-pair detail
└── <sample-slug>/
    ├── ideator-a.md          # baseline prompt output
    ├── ideator-b.md          # tightened prompt output
    ├── ideator-vanilla.md    # no system prompt
    └── …
```

## Files

- `prompts/samples.json` — 3 sample ideas + 6 task templates per agent
- `prompts/baseline/` — frozen pre-Phase-2 prompts (variant A)
- `../subagents/` — current prompts (variant B)
- `run-ab.mjs` — calls `dispatch()` once per (sample, agent, variant)
- `judge.mjs` — pairs A vs B and scores with claude-sonnet-4-6 on a 5-criterion rubric

## Rubric

Each output scored 1-5 on:
1. Specificity — concrete numbers/names vs generic claims
2. Structure adherence — followed the required output format
3. Factual plausibility — claims look defensible
4. Actionability — could a founder act on this tomorrow
5. Conciseness — every sentence earns its place

Winner: `a` | `b` | `tie` per pair.

## Cost

~54 × ~3K-token completions + ~36 × ~6K-token judgments. Budget $2-3 per run on Sonnet 4.6. Drop the `vanilla` variant (`AB_VARIANTS=a,b`) to halve the cost.
