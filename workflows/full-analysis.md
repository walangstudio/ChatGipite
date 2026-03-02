---
name: full-analysis
description: End-to-end business idea analysis pipeline
steps:
  - id: validate
    agent: validator
    task: "Perform a full viability analysis on this business idea: {{goal}}. Additional context: {{params.constraints}}"
    output_path: "ideas/{{slug}}/brief.md"

  - id: market
    agent: market-analyst
    task: "Analyze the competitive landscape for this business idea: {{goal}}"
    depends_on:
      - validate
    context_files: []
    output_path: "ideas/{{slug}}/competitive.md"

  - id: financials
    agent: financial-analyst
    task: "Build a financial model for this business idea: {{goal}}. Use the validation analysis as context."
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/financials.md"

  - id: canvas
    agent: writer
    task: "Generate a complete Business Model Canvas for this business idea: {{goal}}. Use the validation analysis and financial model as input."
    depends_on:
      - validate
      - financials
    output_path: "ideas/{{slug}}/canvas.md"

  - id: pitchdeck
    agent: writer
    task: "Generate a 10-slide pitch deck for this business idea: {{goal}}. Use all prior analysis as input."
    depends_on:
      - validate
      - market
      - financials
    output_path: "ideas/{{slug}}/pitchdeck.md"

  - id: playbook
    agent: strategist
    task: "Generate a 30/60/90-day execution playbook for: {{goal}}. Use all prior analysis as input."
    depends_on:
      - validate
      - market
      - financials
    output_path: "ideas/{{slug}}/playbook.md"
---

# Full Analysis Workflow

This workflow runs a complete end-to-end analysis of a business idea:

1. **Validate**: full viability analysis (problem, ICP, solution, revenue, market size, ICE score)
2. **Market**: competitive landscape and differentiation opportunities
3. **Financials**: unit economics, P&L, break-even, LTV:CAC
4. **Canvas**: Business Model Canvas (9 blocks)
5. **Pitch Deck**: 10-slide deck
6. **Playbook**: 30/60/90-day execution plan

All artifacts are saved to `ideas/{slug}/`.
