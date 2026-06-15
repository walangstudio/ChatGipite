---
name: perspectives
description: Six independent blind lenses in one parallel wave, then a reviewer reconciles them
steps:
  - id: contrarian
    agent: lens-contrarian
    task: "Analyze ONLY from the contrarian / pre-mortem lens. Subject: {{goal}}. Constraints: {{params.constraints}}"
    output_path: "ideas/{{slug}}/lens-contrarian.md"

  - id: customer
    agent: lens-customer
    task: "Analyze ONLY from the skeptical-buyer lens, at the purchase moment. Subject: {{goal}}. Constraints: {{params.constraints}}"
    output_path: "ideas/{{slug}}/lens-customer.md"

  - id: operator
    agent: lens-operator
    task: "Analyze ONLY from the operator lens — daily operational reality. Subject: {{goal}}. Constraints: {{params.constraints}}"
    output_path: "ideas/{{slug}}/lens-operator.md"

  - id: investor
    agent: lens-investor
    task: "Analyze ONLY from the investor lens — returns, ownership, fundability. Subject: {{goal}}. Constraints: {{params.constraints}}"
    output_path: "ideas/{{slug}}/lens-investor.md"

  - id: regulator
    agent: lens-regulator
    task: "Analyze ONLY from the regulator / ethics / harm lens. Subject: {{goal}}. Constraints: {{params.constraints}}"
    output_path: "ideas/{{slug}}/lens-regulator.md"

  - id: futurist
    agent: lens-futurist
    task: "Analyze ONLY from the 5-year futurist lens — second-order effects. Subject: {{goal}}. Constraints: {{params.constraints}}"
    output_path: "ideas/{{slug}}/lens-futurist.md"

  - id: review
    agent: perspective-reviewer
    task: "Reconcile all six independent lenses into one panel review for: {{goal}}. Surface agreements, conflicts, and blind spots; give a net verdict."
    depends_on:
      - contrarian
      - customer
      - operator
      - investor
      - regulator
      - futurist
    output_path: "ideas/{{slug}}/perspective-review.md"
---

# Perspectives Workflow

Six blind lenses run in one parallel wave, then one reconciling reviewer.

Independence is by construction: no lens depends on another, so each only sees the
subject (passed via `{{goal}}`), never a sibling's output. The `review` step depends on
all six, so the reviewer receives every lens output in-memory and adjudicates the panel.

1. **Contrarian** — pre-mortem, the fatal assumptions
2. **Customer** — the buyer at the purchase moment
3. **Operator** — daily operational reality, what breaks at 10x
4. **Investor** — returns, ownership, fundability
5. **Regulator** — legal/ethics/harm exposure
6. **Futurist** — 5-year second-order effects
7. **Review** — reconcile agreements / conflicts / blind spots → net verdict

All artifacts saved to `ideas/{slug}/`.
