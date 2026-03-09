# ChatGipite by Lugitech

> *"Ang Chat bot ng mga Gipit"*

![version](https://img.shields.io/badge/version-0.1.0-blue)
![node](https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-compatible-blueviolet)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![license](https://img.shields.io/badge/license-MIT-green)

Business idea generation, validation, and execution planning as an MCP server. Runs a full pipeline from raw idea to financial model, pitch deck, and go-to-market playbook — all stored locally per idea.

## Quick Start

**Linux / macOS / Git Bash (Windows):**
```bash
cd ChatGipite
./install.sh                              # Claude Desktop
./install.sh -c claude                    # Claude Code (workspace-local)
./install.sh -c claude --global           # Claude Code (global user config)
./install.sh -c cursor                    # Cursor (workspace-local)
./install.sh -c cursor --global           # Cursor (global)
./install.sh -c windsurf                  # Windsurf (global only)
./install.sh -c vscode                    # VS Code (.vscode/mcp.json)
./install.sh -c gemini                    # Gemini CLI (workspace-local)
./install.sh -c gemini --global           # Gemini CLI (global)
./install.sh -c codex                     # OpenAI Codex CLI (workspace-local)
./install.sh -c codex --global            # OpenAI Codex CLI (global)
./install.sh -c zed                       # Zed (global)
./install.sh -c kilo                      # Kilo Code
./install.sh -c opencode                  # OpenCode (workspace-local)
./install.sh -c opencode --global         # OpenCode (global)
./install.sh -c goose                     # Goose
./install.sh -c all                       # all detected clients
```

**Windows (Command Prompt / PowerShell):**
```bat
cd ChatGipite
install.bat                               REM Claude Desktop
install.bat -c claude                     REM Claude Code (workspace-local)
install.bat -c claude --global            REM Claude Code (global user config)
install.bat -c cursor                     REM Cursor (workspace-local)
install.bat -c cursor --global            REM Cursor (global)
install.bat -c windsurf                   REM Windsurf (global only)
install.bat -c vscode                     REM VS Code (.vscode/mcp.json)
install.bat -c gemini                     REM Gemini CLI (workspace-local)
install.bat -c gemini --global            REM Gemini CLI (global)
install.bat -c codex                      REM OpenAI Codex CLI (workspace-local)
install.bat -c codex --global             REM OpenAI Codex CLI (global)
install.bat -c zed                        REM Zed (global)
install.bat -c kilo                       REM Kilo Code
install.bat -c opencode                   REM OpenCode (workspace-local)
install.bat -c opencode --global          REM OpenCode (global)
install.bat -c goose                      REM Goose
install.bat -c all                        REM all detected clients
```

The installer runs `npm install`, writes the MCP config entry, and validates the server.

## Supported MCP Clients

| Client | `-c TYPE` | Config written | Notes |
|--------|-----------|----------------|-------|
| Claude Desktop | `claudedesktop` | OS-specific `claude_desktop_config.json` | Restart required |
| Claude Code | `claude` | `.mcp.json` (workspace) or `~/.claude.json` (global) | Use `--global` for user scope |
| Cursor | `cursor` | `.cursor/mcp.json` or `~/.cursor/mcp.json` (global) | Use `--global` for global |
| Windsurf | `windsurf` | `~/.codeium/windsurf/mcp_config.json` | Global only |
| VS Code | `vscode` | `.vscode/mcp.json` | Workspace-local; global via VS Code settings UI |
| Gemini CLI | `gemini` | `.gemini/settings.json` or `~/.gemini/settings.json` (global) | Use `--global` for global |
| Codex CLI | `codex` | `.codex/config.toml` or `~/.codex/config.toml` (global) | TOML; use `--global` for global |
| Zed | `zed` | `~/.config/zed/settings.json` | Global only |
| Kilo Code | `kilo` | `.kilocode/mcp.json` | Workspace-local only |
| OpenCode | `opencode` | `opencode.json` / `~/.config/opencode/opencode.json` | Use `--global` for global |
| Goose | `goose` | `~/.config/goose/config.yaml` | Global only |
| pi.dev | `pidev` | n/a | Prints manual instructions; no auto-config |
| All above | `all` | All detected existing configs | Skips clients not yet installed |

## Installer Flags

```
  -c, --client TYPE   claudedesktop, claude, cursor, windsurf, vscode, gemini, codex,
                      zed, kilo, opencode, goose, pidev, all  (default: claudedesktop)
  -f, --force         Skip prompts, overwrite existing config
  -u, --uninstall     Remove from MCP client config
      --upgrade       Upgrade deps and reconfigure (alias: --update)
      --status        Show where this server is currently installed
      --global        Write to global config (claude, cursor, gemini, codex, opencode)
      --skip-test     Skip server validation
  -h, --help          Show this help
```

### Check install status

```bash
./install.sh --status
```

### Upgrade

Pull the latest source first (or re-download and extract), then:

```bash
./install.sh --upgrade                    # reinstall deps
./install.sh --upgrade -c all             # also reconfigure all clients
```

`--update` is an alias for `--upgrade`.

### Uninstall

```bash
./install.sh -u -c all
install.bat -u -c all   # Windows
```

## Manual Setup

```bash
npm install
node server.js   # verify it starts, then Ctrl+C
```

No API key required for fully local use — set `default_provider: ollama` in `config/providers.yaml`.
For Anthropic/Claude: `export ANTHROPIC_API_KEY=sk-ant-...`

Add ChatGipite to your MCP client config (use absolute paths):

### Claude Desktop

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"]
    }
  }
}
```

### Claude Code

Workspace-local (`.mcp.json` in your project root):
```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"]
    }
  }
}
```

Global user scope:
```bash
claude mcp add --scope user chatgipite -- node /absolute/path/to/ChatGipite/server.js
```

### Cursor

`.cursor/mcp.json` (workspace) or `~/.cursor/mcp.json` (global):
```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"]
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"]
    }
  }
}
```

### VS Code

`.vscode/mcp.json` in your workspace root (note: VS Code uses `servers`, not `mcpServers`):
```json
{
  "servers": {
    "chatgipite": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"]
    }
  }
}
```

For user-level config, add via VS Code Settings UI under `mcp.servers`.

### Gemini CLI

`.gemini/settings.json` (workspace) or `~/.gemini/settings.json` (global):
```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"]
    }
  }
}
```

### OpenAI Codex CLI

`.codex/config.toml` (workspace) or `~/.codex/config.toml` (global):
```toml
[mcp_servers.chatgipite]
command = "node /absolute/path/to/ChatGipite/server.js"
startup_timeout_sec = 30
tool_timeout_sec = 300
enabled = true
```

### Zed

`~/.config/zed/settings.json`:
```json
{
  "context_servers": {
    "chatgipite": {
      "command": {
        "path": "node",
        "args": ["/absolute/path/to/ChatGipite/server.js"],
        "env": {}
      }
    }
  }
}
```

### Kilo Code

`.kilocode/mcp.json` in your workspace root:
```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"]
    }
  }
}
```

### OpenCode

`opencode.json` (workspace) or `~/.config/opencode/opencode.json` (global):
```json
{
  "mcp": {
    "chatgipite": {
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"]
    }
  }
}
```

### Goose

`~/.config/goose/config.yaml`:
```yaml
extensions:
  chatgipite:
    type: stdio
    cmd: node
    args:
      - /absolute/path/to/ChatGipite/server.js
    enabled: true
```

### pi.dev

pi.dev does not support MCP servers natively. It uses TypeScript extensions instead. Add a minimal bridge:

```typescript
// ~/.pi/extensions/chatgipite-bridge.ts
import { Extension } from "@pi-dev/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export default class ChatGipiteBridge extends Extension {
  name = "chatgipite";

  async activate() {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["/absolute/path/to/ChatGipite/server.js"],
    });
    const client = new Client({ name: "chatgipite-bridge", version: "1.0.0" }, {});
    await client.connect(transport);
    this.registerMcpClient(client);
  }
}
```

Register in `~/.pi/agent/settings.json`:
```json
{
  "extensions": ["~/.pi/extensions/chatgipite-bridge.ts"]
}
```

On Windows, use `C:\absolute\path\to\ChatGipite\server.js`. Restart the client after editing any config.

## Tools

### Idea generation & validation
| Tool | Output |
|------|--------|
| `biz_generate` | 5 differentiated business ideas from a sector or problem statement |
| `biz_validate` | Viability analysis: problem, ICP, solution, revenue model, market size, ICE score |
| `biz_ice_score` | Impact / Confidence / Ease scoring (1-10 each) with rationale |

### Market & customer analysis
| Tool | Output |
|------|--------|
| `biz_tam` | Deep TAM/SAM/SOM sizing — top-down + bottom-up with 5-year projections |
| `biz_personas` | 3-5 JTBD-framed customer personas, ICP priority matrix, WTP per segment |
| `biz_trends` | PESTLE + technology S-curve analysis, tailwinds/headwinds, market timing verdict |
| `biz_competitors` | Competitor table, gap analysis, differentiation strategy |
| `biz_landscape` | Deep competitive intelligence: funding trajectories, moat analysis, white-space map, positioning grid |

### Strategy & positioning
| Tool | Output |
|------|--------|
| `biz_swot` | SWOT table + Porter's Five Forces (rated 1-5) with SO/WO/ST/WT cross-analysis |
| `biz_pricing` | 3-tier pricing architecture, value metric, competitor price table, expansion revenue paths |
| `biz_gtm` | GTM motion, beachhead segment, 0→100 and 100→1000 channels, 30-day launch plan |
| `biz_journey` | 7-stage customer journey map, moments of truth, drop-off risks, delight opportunities |
| `biz_expansion` | Market entry modes, 3-phase expansion roadmap, localization requirements, go/no-go criteria |

### Financial modeling & risk
| Tool | Output |
|------|--------|
| `biz_financials` | Unit economics, LTV:CAC ratio, break-even, 12-month P&L |
| `biz_model` | 3-scenario P&L (base/upside/downside), cohort retention, sensitivity table, funding requirements |
| `biz_risks` | Risk register (probability × impact), scenario narratives, regulatory flags, 90-day assumption tests |

### Presentation & execution
| Tool | Output |
|------|--------|
| `biz_canvas` | Business Model Canvas (all 9 blocks) |
| `biz_pitchdeck` | 10-slide pitch deck content |
| `biz_playbook` | 30/60/90-day execution plan with milestones, KPIs, risk flags |
| `biz_name` | Name candidates with live domain and social availability check |
| `biz_name_check` | Availability check for a specific name (.com DNS, Instagram, LinkedIn, TikTok) |
| `biz_synthesis` | Executive brief: conviction score (1-10), 5 key decisions, 90-day action roadmap |

### Pipelines
| Tool | Output |
|------|--------|
| `biz_full_run` | 7-step pipeline: validate → competitors → financials → canvas → pitchdeck → playbook → names |
| `biz_deep_run` | 15-step workflow + names: validate → personas → trends → market → TAM → financials → model → SWOT → pricing → GTM → journey → risks → landscape → expansion → synthesis → names |
| `biz_recall` | Full-text search across all stored analyses |

## Typical Flow

Step by step (standard):
```
biz_generate    {sector: "healthtech"}
biz_validate    {idea: "AI triage assistant for rural clinics"}
biz_competitors {idea_slug: "ai-triage-assistant-for-rural-clinics"}
biz_financials  {idea_slug: "ai-triage-assistant-for-rural-clinics"}
biz_canvas      {idea_slug: "ai-triage-assistant-for-rural-clinics"}
biz_pitchdeck   {idea_slug: "ai-triage-assistant-for-rural-clinics"}
biz_name        {idea_slug: "ai-triage-assistant-for-rural-clinics"}
biz_playbook    {idea_slug: "ai-triage-assistant-for-rural-clinics"}
```

Full pipeline in one call:
```
biz_full_run  {idea: "AI triage assistant for rural clinics"}
biz_deep_run  {idea: "AI triage assistant for rural clinics"}   ← deep version (15 steps, ~16 artifacts)
```

## Artifacts

Saved to `ideas/{slug}/`:

### Standard (`biz_full_run`)
| File | Contents |
|------|----------|
| `brief.md` | Validation analysis and ICE score |
| `competitive.md` | Competitor landscape |
| `financials.md` | Financial model |
| `canvas.md` | Business Model Canvas |
| `pitchdeck.md` | Pitch deck |
| `playbook.md` | 30/60/90-day plan |
| `names.md` | Name candidates with availability table |

### Deep (`biz_deep_run`)
All of the above, plus:

| File | Contents |
|------|----------|
| `personas.md` | Customer personas, ICP matrix, WTP |
| `trends.md` | PESTLE, S-curve, market timing |
| `tam.md` | TAM/SAM/SOM sizing |
| `model.md` | 3-scenario financial model |
| `swot.md` | SWOT + Porter's Five Forces |
| `pricing.md` | Pricing architecture |
| `gtm.md` | Go-to-market strategy |
| `journey.md` | Customer journey map |
| `risks.md` | Risk register and scenarios |
| `landscape.md` | Deep competitive intelligence |
| `expansion.md` | Market entry and expansion roadmap |
| `synthesis.md` | Executive brief with conviction score |

## Configuration

Edit `config/providers.yaml` to change the LLM used for internal analysis agents. Default is `claude-sonnet-4-6`. Ollama is supported for fully local operation.

The client LLM (what you chat with in your IDE) and ChatGipite's internal agents are independent. You can use ChatGipite from Cursor with GPT-4o while the analysis runs on Claude.

## Requirements

- Node.js 20+ (Node 24 supported)
- LLM API key (optional — Ollama works out of the box for fully local use)

## License

MIT
