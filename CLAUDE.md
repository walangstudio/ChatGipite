# ChatGipite by Lugitech

> *"Ang Chat bot ng mga Gipit"*

MCP stdio server for business idea generation, validation, and execution planning.
Compatible with Claude Code, Cursor, Zed, Windsurf, Continue.dev, and any MCP-capable client.

The LLM you chat with and the LLM ChatGipite uses internally for analysis are independent.
Configure the internal agents in `config/providers.yaml`.

## Setup

The installer handles `npm install` and MCP config registration:

```bash
# macOS / Linux / Git Bash on Windows
./install.sh -c code          # Claude Code, workspace scope
./install.sh -c code --global # Claude Code, global scope
./install.sh -c all           # all detected clients
./install.sh --help

# Windows (cmd)
install.bat -c code
install.bat -c all
```

Manual:
```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
node server.js
```

For local/offline use: set `default_provider: ollama` in `config/providers.yaml`.

## Manual MCP Config

Replace `<INSTALL_DIR>` with the absolute path to this folder.

### Claude Code (`~/.claude/mcp.json`)
```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["<INSTALL_DIR>/server.js"],
      "env": { "ANTHROPIC_API_KEY": "your-key-here" }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["<INSTALL_DIR>/server.js"],
      "env": { "ANTHROPIC_API_KEY": "your-key-here" }
    }
  }
}
```

### Zed (`~/.config/zed/settings.json`)
```json
{
  "context_servers": {
    "chatgipite": {
      "command": {
        "path": "node",
        "args": ["<INSTALL_DIR>/server.js"],
        "env": { "ANTHROPIC_API_KEY": "your-key-here" }
      }
    }
  }
}
```

### Continue.dev (`.continue/config.json`)
```json
{
  "mcpServers": [
    {
      "name": "chatgipite",
      "command": "node",
      "args": ["<INSTALL_DIR>/server.js"],
      "env": { "ANTHROPIC_API_KEY": "your-key-here" }
    }
  ]
}
```

### Windsurf (`~/.codeium/windsurf/mcp_config.json`)
```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["<INSTALL_DIR>/server.js"],
      "env": { "ANTHROPIC_API_KEY": "your-key-here" }
    }
  }
}
```

## Tools

| Tool | What it does |
|------|-------------|
| `biz_generate` | Generate 5 business ideas from a sector or problem statement |
| `biz_validate` | Viability analysis: problem, ICP, solution, market size, ICE score |
| `biz_ice_score` | ICE score only (Impact / Confidence / Ease, 1-10 each) |
| `biz_canvas` | Business Model Canvas (9 blocks) |
| `biz_pitchdeck` | 10-slide pitch deck content |
| `biz_name` | Name candidates with live domain and social availability check |
| `biz_name_check` | Availability check for a specific name (.com, Instagram, LinkedIn, TikTok) |
| `biz_competitors` | Competitor list, gap analysis, differentiation angles |
| `biz_financials` | Unit economics, LTV:CAC, break-even, P&L projection |
| `biz_playbook` | 30/60/90-day execution plan with milestones and KPIs |
| `biz_full_run` | Full pipeline in one call, all artifacts saved to disk |
| `biz_recall` | Full-text search across all stored analyses |

## Typical Flow

Step by step:
```
biz_generate    {sector: "healthtech"}
biz_validate    {idea: "..."}
biz_competitors {idea_slug: "..."}
biz_financials  {idea_slug: "..."}
biz_canvas      {idea_slug: "..."}
biz_pitchdeck   {idea_slug: "..."}
biz_name        {idea_slug: "..."}
biz_name_check  {name: "SpecificName"}
biz_playbook    {idea_slug: "..."}
```

Or in one call:
```
biz_full_run {idea: "..."}
```

## Artifacts

Saved to `ideas/{slug}/`:

| File | Contents |
|------|----------|
| `brief.md` | Validation analysis and ICE score |
| `competitive.md` | Competitor landscape |
| `financials.md` | Financial model |
| `canvas.md` | Business Model Canvas |
| `pitchdeck.md` | Pitch deck |
| `playbook.md` | 30/60/90-day plan |
| `names.md` | Name candidates with availability table |
