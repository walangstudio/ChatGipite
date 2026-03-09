---
name: deep-analysis
description: Full 15-step deep strategic analysis pipeline
steps:
  - id: validate
    agent: validator
    task: "Perform a full viability analysis on this business idea: {{goal}}. Additional context: {{params.constraints}}"
    output_path: "ideas/{{slug}}/brief.md"

  - id: personas
    agent: persona-analyst
    task: "Generate customer personas with JTBD framing and ICP prioritization for this business idea: {{goal}}"
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/personas.md"

  - id: trends
    agent: trend-analyst
    task: "Analyze industry trends, PESTLE factors, and market timing for this business idea: {{goal}}"
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/trends.md"

  - id: market
    agent: market-analyst
    task: "Analyze the competitive landscape for this business idea: {{goal}}"
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/competitive.md"

  - id: tam
    agent: market-analyst
    task: "Produce a deep TAM/SAM/SOM analysis using top-down and bottom-up methodology for: {{goal}}. Use the validation brief and competitive analysis as context."
    depends_on:
      - validate
      - market
    output_path: "ideas/{{slug}}/tam.md"

  - id: financials
    agent: financial-analyst
    task: "Build a financial model for this business idea: {{goal}}. Use the validation analysis as context."
    depends_on:
      - validate
    output_path: "ideas/{{slug}}/financials.md"

  - id: model
    agent: financial-modeler
    task: "Build a 3-scenario financial model (base/upside/downside) with cohort retention and sensitivity analysis for: {{goal}}. Use the validation brief and basic financials as context."
    depends_on:
      - validate
      - financials
    output_path: "ideas/{{slug}}/model.md"

  - id: swot
    agent: strategy-analyst
    task: "Produce a SWOT analysis + Porter's Five Forces for this business idea: {{goal}}. Use the competitive analysis as context."
    depends_on:
      - validate
      - market
    output_path: "ideas/{{slug}}/swot.md"

  - id: pricing
    agent: pricing-strategist
    task: "Design a 3-tier pricing architecture with competitor price table and expansion revenue paths for: {{goal}}. Use persona and competitive analysis as context."
    depends_on:
      - validate
      - personas
      - market
    output_path: "ideas/{{slug}}/pricing.md"

  - id: gtm
    agent: gtm-strategist
    task: "Create a go-to-market strategy with beachhead segment, channels, and launch plan for: {{goal}}. Use personas, competitive, and pricing analysis as context."
    depends_on:
      - validate
      - personas
      - market
      - pricing
    output_path: "ideas/{{slug}}/gtm.md"

  - id: journey
    agent: journey-mapper
    task: "Map the 7-stage customer journey with moments of truth and drop-off risks for: {{goal}}. Use persona analysis as context."
    depends_on:
      - validate
      - personas
    output_path: "ideas/{{slug}}/journey.md"

  - id: risks
    agent: risk-analyst
    task: "Build a risk register, scenario analysis, and regulatory assessment for: {{goal}}. Use financials and competitive analysis as context."
    depends_on:
      - validate
      - financials
      - market
    output_path: "ideas/{{slug}}/risks.md"

  - id: landscape
    agent: competitive-intelligence
    task: "Produce a deep competitive intelligence analysis with funding trajectories, moat mapping, and white space for: {{goal}}. Use the competitive analysis as a starting point."
    depends_on:
      - validate
      - market
    output_path: "ideas/{{slug}}/landscape.md"

  - id: expansion
    agent: expansion-strategist
    task: "Design a market entry and 3-phase expansion roadmap with go/no-go criteria for: {{goal}}. Use TAM and competitive analysis as context."
    depends_on:
      - validate
      - tam
      - market
    output_path: "ideas/{{slug}}/expansion.md"

  - id: synthesis
    agent: executive-advisor
    task: "Synthesize all available analysis into a board-level executive brief with conviction score and strategic recommendation for: {{goal}}."
    depends_on:
      - validate
      - personas
      - trends
      - market
      - tam
      - financials
      - model
      - swot
      - pricing
      - gtm
      - journey
      - risks
      - landscape
      - expansion
    output_path: "ideas/{{slug}}/synthesis.md"
---

# Deep Analysis Workflow

Full 15-step strategic analysis pipeline:

1. **Validate**: viability, ICP, ICE score
2. **Personas**: JTBD-framed segments, ICP priority, WTP
3. **Trends**: PESTLE, S-curve, tailwinds/headwinds, timing
4. **Market**: competitive landscape, gaps, differentiation
5. **TAM**: top-down + bottom-up market sizing
6. **Financials**: unit economics, P&L, break-even
7. **Model**: 3-scenario P&L, cohort retention, sensitivity table
8. **SWOT**: SWOT table + Porter's Five Forces
9. **Pricing**: 3-tier architecture, value metric, expansion revenue
10. **GTM**: motion, beachhead, 0→100 and 100→1000 channels
11. **Journey**: 7-stage customer journey map
12. **Risks**: risk register, scenarios, regulatory flags
13. **Landscape**: deep competitive intelligence, moats, white space
14. **Expansion**: market entry modes, phased roadmap, go/no-go criteria
15. **Synthesis**: executive brief, conviction score, 5 key decisions

All artifacts saved to `ideas/{slug}/`.
