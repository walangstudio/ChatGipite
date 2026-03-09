---
name: quick-validate
description: "Fast validation: ICE score and Business Model Canvas"
steps:
  - id: validate
    agent: validator
    task: "Perform a viability analysis with ICE score for this business idea: {{goal}}"
    output_path: "ideas/{{slug}}/brief.md"

  - id: canvas
    agent: writer
    task: "Generate a Business Model Canvas for: {{goal}}. Use the validation analysis as input."
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/canvas.md"
---

# Quick Validate Workflow

Fast pass: Validation + ICE score + Business Model Canvas.

Use this for rapid idea screening before committing to a full analysis.
