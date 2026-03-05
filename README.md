# ChatGipite by Lugitech

> *"Ang Chat bot ng mga Gipit"*

Business idea generation, validation, and execution planning as an MCP tool server.

## Tools

| Tool | Output |
|------|--------|
| `biz_generate` | 5 differentiated business ideas from a sector or problem statement |
| `biz_validate` | Viability analysis: problem, ICP, solution, revenue model, market size, ICE score |
| `biz_ice_score` | Impact / Confidence / Ease scoring (1-10 each) with rationale |
| `biz_canvas` | Business Model Canvas (all 9 blocks) |
| `biz_pitchdeck` | 10-slide pitch deck content |
| `biz_name` | Name candidates with live domain and social availability check |
| `biz_name_check` | Availability check for a specific name (.com DNS, Instagram, LinkedIn, TikTok) |
| `biz_competitors` | Competitor table, gap analysis, differentiation strategy |
| `biz_financials` | Unit economics, LTV:CAC ratio, break-even, 12-month P&L |
| `biz_playbook` | 30/60/90-day execution plan with milestones, KPIs, risk flags |
| `biz_full_run` | Full pipeline in one call: validate, compete, financials, canvas, deck, playbook, names |
| `biz_recall` | Full-text search across all stored analyses |

## Requirements

- Node.js 20+ (Node 24 supported)
- LLM API key (optional — Ollama works out of the box for fully local use)

## Install

```bash
# macOS / Linux / Git Bash on Windows
./install.sh                        # Claude Desktop (default)
./install.sh -c claude              # Claude Code, workspace scope
./install.sh -c claude --global     # Claude Code, global scope
./install.sh -c claudedesktop       # Claude Desktop (explicit)
./install.sh -c kilo                # Kilo Code
./install.sh -c opencode            # OpenCode, workspace scope
./install.sh -c opencode --global   # OpenCode, global scope
./install.sh -c goose               # Goose
./install.sh -c all                 # all detected clients
./install.sh --help

# Windows (cmd)
install.bat -c claude
install.bat -c all
```

The installer runs `npm install` and writes the MCP config entry automatically.

## Supported Clients (auto-configured by installer)

- Claude Code (workspace `.mcp.json` or global `~/.claude/mcp.json`)
- Claude Desktop
- Kilo Code (`.kilocode/mcp.json`)
- OpenCode (`opencode.json` or global)
- Goose (`~/.config/goose/config.yaml`)

For Cursor, Zed, Windsurf, and Continue.dev, see the manual config blocks in `CLAUDE.md`.

## Manual Setup

```bash
npm install
node server.js
```

No API key required for local use — set `default_provider: ollama` in `config/providers.yaml`.
To use Anthropic/Claude, set the key in your environment or MCP client config:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

```
# Generate ideas in a sector
biz_generate {sector: "edtech"}

# Full analysis of a specific idea
biz_full_run {idea: "AI tutor for Filipino high school students"}

# Check name availability
biz_name_check {name: "TuturAI"}

# Search previous analyses
biz_recall {query: "edtech Philippines"}
```

Artifacts are saved to `ideas/{slug}/`:

| File | Contents |
|------|----------|
| `brief.md` | Validation analysis and ICE score |
| `competitive.md` | Competitor analysis |
| `financials.md` | Unit economics and P&L |
| `canvas.md` | Business Model Canvas |
| `pitchdeck.md` | Pitch deck |
| `playbook.md` | 30/60/90-day execution plan |
| `names.md` | Name candidates with availability table |

## Configuration

Edit `config/providers.yaml` to change the LLM used for internal analysis agents.
Default is `claude-sonnet-4-6`. Ollama is supported for fully local operation.

The client LLM (what you chat with in your IDE) and ChatGipite's internal agents run independently. You can use ChatGipite from Cursor with GPT-4o while the analysis runs on Claude, or swap everything to Ollama.

## Uninstall

```bash
./install.sh -u -c all
install.bat -u -c all   # Windows
```
