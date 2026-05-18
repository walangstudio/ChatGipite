---
name: launch-sprint
description: Working-Backwards launch sprint — validate, write the PR/FAQ, scope the MVP, plan GTM, produce the launch checklist
steps:
  - id: validate
    agent: validator
    task: "Perform a full viability analysis on this business idea: {{goal}}. Additional context: {{params.constraints}}"
    output_path: "ideas/{{slug}}/brief.md"

  - id: prfaq
    agent: working-backwards-writer
    task: "Produce the \"prfaq\" block: launch press release + internal/customer FAQ for: {{goal}}. Use the validation brief as context."
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/prfaq.md"

  - id: mvp
    agent: mvp-scoper
    task: "Scope the smallest launchable MVP for: {{goal}}. Use the validation brief and the PR/FAQ as context — the MVP must deliver the PR's single biggest benefit."
    depends_on:
      - validate
      - prfaq
    output_path: "ideas/{{slug}}/mvp.md"

  - id: gtm
    agent: gtm-strategist
    task: "Create a go-to-market plan with beachhead, channels, and a 30-day launch plan for: {{goal}}. Use the PR/FAQ and MVP scope as context."
    depends_on:
      - validate
      - prfaq
      - mvp
    output_path: "ideas/{{slug}}/gtm.md"

  - id: checklist
    agent: working-backwards-writer
    task: "Produce the \"checklist\" block: a launch checklist for {{goal}} with must-ship gates, day-0/day-1 items, success criteria, and explicitly deferred items. Use the PR/FAQ, MVP scope, and GTM plan as context."
    depends_on:
      - validate
      - prfaq
      - mvp
      - gtm
    output_path: "ideas/{{slug}}/launch-checklist.md"
---

# Launch Sprint Workflow

Working-Backwards-style fast launch:

1. **Validate**: viability gate
2. **PR/FAQ**: press release + FAQ written before building
3. **MVP Scope**: smallest thing that delivers the PR's core benefit
4. **GTM**: beachhead, channels, 30-day launch plan
5. **Checklist**: must-ship gates, day-0/1, success criteria, deferred

All artifacts saved to `ideas/{slug}/`.
