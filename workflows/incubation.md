---
name: incubation
description: Lean idea-incubation loop — validate, surface riskiest assumptions, model the canvas, define the North Star, scope the MVP, decide pivot/persevere
steps:
  - id: validate
    agent: validator
    task: "Perform a full viability analysis on this business idea: {{goal}}. Additional context: {{params.constraints}}"
    output_path: "ideas/{{slug}}/brief.md"

  - id: assumptions
    agent: incubation-coach
    task: "Produce the \"assumptions\" block: rank the riskiest assumptions and write a Test Card for the riskiest one for: {{goal}}. Use the validation brief as context."
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/assumptions.md"

  - id: lean
    agent: canvas-strategist
    task: "Canvas type: lean. Produce the Lean Canvas (Running Lean 3rd ed) for: {{goal}}. Use the validation brief as input."
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/lean-canvas.md"

  - id: vpc
    agent: canvas-strategist
    task: "Canvas type: vpc. Produce the Value Proposition Canvas for: {{goal}}. Use the validation brief as input."
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/value-prop.md"

  - id: northstar
    agent: north-star-architect
    task: "Define the North Star Metric and input model for: {{goal}}. Use the validation brief as context."
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/north-star.md"

  - id: mvp
    agent: mvp-scoper
    task: "Scope the smallest MVP that tests the riskiest assumption for: {{goal}}. Use the validation brief and assumption map as context."
    depends_on:
      - validate
      - assumptions
    output_path: "ideas/{{slug}}/mvp.md"

  - id: decision
    agent: incubation-coach
    task: "Produce the \"decision\" block: a pivot/persevere/kill verdict for {{goal}}, weighing the assumption map, Lean Canvas, Value Proposition Canvas, North Star, and MVP scope."
    depends_on:
      - validate
      - assumptions
      - lean
      - vpc
      - northstar
      - mvp
    output_path: "ideas/{{slug}}/incubation-decision.md"
---

# Incubation Workflow

Fast idea-incubation loop for launching faster:

1. **Validate**: viability, ICP, ICE
2. **Assumptions**: riskiest-assumption map + Test Card
3. **Lean Canvas**: Running Lean 3rd ed (parallel)
4. **Value Proposition Canvas**: demand-side fit (parallel)
5. **North Star**: metric + input model + Customer Factory (parallel)
6. **MVP Scope**: smallest test of the riskiest assumption
7. **Decision**: pivot / persevere / kill with this-week actions

All artifacts saved to `ideas/{slug}/`.
