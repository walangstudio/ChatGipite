# ChatGipite by Lugitech

> *"Ang Chat bot ng mga Gipit"*

![version](https://img.shields.io/badge/version-0.3.0-blue)
![node](https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-compatible-blueviolet)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![license](https://img.shields.io/badge/license-MIT-green)

Business idea generation, validation, and execution planning as an MCP server. Runs a full pipeline from raw idea to financial model, pitch deck, and go-to-market playbook — all stored locally per idea.

## Claude Code: install as a skill (recommended)

Skills load on demand — ~50 tokens of overhead until invoked, vs ~5–8K for the full MCP server. For Claude Code users, this is the lightest option.

```bash
./install.sh -c skill        # macOS / Linux / Git Bash
install.bat -c skill         REM Windows (admin shell needed for junction)
```

Installs to `~/.claude/skills/chatgipite/` as a symlink/junction back to this repo. Updating the repo updates the skill in place. Inside Claude Code, just ask: *"validate this idea: …"* — the skill is auto-discovered and dispatches to the same handler code as the MCP server.

For non-Claude-Code clients (Cursor, Zed, Gemini CLI, Codex, etc.), keep using the MCP install paths below. Both can coexist.

## Quick Start

**Linux / macOS / Git Bash (Windows):**
```bash
cd ChatGipite
./install.sh                              # Claude Desktop
./install.sh -c claude                    # Claude Code (workspace-local)
./install.sh -c claude --global           # Claude Code (global user config)
./install.sh -c skill                     # Claude Code skill (recommended for Claude Code)
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
./install.sh -c all                       # all detected MCP clients (skill is opt-in)
```

**Windows (Command Prompt / PowerShell):**
```bat
cd ChatGipite
install.bat                               REM Claude Desktop
install.bat -c claude                     REM Claude Code (workspace-local)
install.bat -c claude --global            REM Claude Code (global user config)
install.bat -c skill                      REM Claude Code skill (recommended for Claude Code)
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
install.bat -c all                        REM all detected MCP clients (skill is opt-in)
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
| Claude Code skill | `skill` | `~/.claude/skills/chatgipite/` (symlink) | Lowest context cost; Claude Code only |
| All above | `all` | All detected existing configs | Skips clients not yet installed |

## Installer Flags

```
  -c, --client TYPE   claudedesktop, claude, cursor, windsurf, vscode, gemini, codex,
                      zed, kilo, opencode, goose, pidev, skill, all  (default: claudedesktop)
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

Add ChatGipite to your MCP client config (use absolute paths).

Most clients use the same `mcpServers` JSON — add this block to the config file for your client:

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

| Client | Config file |
|--------|-------------|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` (Win) · `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) · `~/.config/Claude/claude_desktop_config.json` (Linux) |
| Claude Code | `.mcp.json` (workspace) or `~/.claude.json` (global) |
| Cursor | `.cursor/mcp.json` (workspace) or `~/.cursor/mcp.json` (global) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Gemini CLI | `.gemini/settings.json` (workspace) or `~/.gemini/settings.json` (global) |
| Kilo Code | `.kilocode/mcp.json` |

**Claude Code global (CLI):**
```bash
claude mcp add --scope user chatgipite -- node /absolute/path/to/ChatGipite/server.js
```

**Clients with different config format** — use the same `command`/`args` values, different structure:

| Client | Config file | Key difference |
|--------|-------------|----------------|
| VS Code | `.vscode/mcp.json` | Top-level key is `servers` (not `mcpServers`), add `"type": "stdio"` |
| Zed | `~/.config/zed/settings.json` | Top-level key is `context_servers`, command is nested: `{ "path": ..., "args": ..., "env": {} }` |
| OpenAI Codex | `.codex/config.toml` | TOML format: `[mcp_servers.chatgipite]`, `command = "node /absolute/path/to/ChatGipite/server.js"` |
| OpenCode | `opencode.json` or `~/.config/opencode/opencode.json` | Top-level key is `mcp` (not `mcpServers`) |
| Goose | `~/.config/goose/config.yaml` | YAML format: under `extensions`, uses `cmd`/`args`/`type: stdio`/`enabled: true` |

On Windows, use `C:\absolute\path\to\ChatGipite\server.js`. Restart the client after editing any config.

## Tools

### Idea generation & validation
| Tool | Output |
|------|--------|
| `biz_generate` | Business ideas from a sector, problem, or constraints (`count` param, default 1) |
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
| `biz_canvas` | Strategy canvas; `canvas_type`: bmc (default) / lean / vpc / mission / ai-platform |
| `biz_lean_canvas` | Lean Canvas (Running Lean 3rd ed) — best for unproven ideas |
| `biz_value_prop` | Value Proposition Canvas (jobs/pains/gains ↔ value map) |
| `biz_mission_canvas` | Mission Model Canvas (mission-driven / non-profit / gov) |
| `biz_ai_canvas` | AI Canvas + Platform Canvas (model-core or multi-sided) |
| `biz_pitchdeck` | 10-slide pitch deck content |
| `biz_playbook` | 30/60/90-day execution plan with milestones, KPIs, risk flags |
| `biz_name` | Name candidates with live domain and social availability check |
| `biz_name_check` | Availability check for a name: domains via RDAP→WHOIS→DNS (com/io/ai/co/app/dev/net/org) + 9 socials (X, Instagram, TikTok, LinkedIn, GitHub, YouTube, Facebook, Reddit, Threads). Also a standalone CLI: `node scripts/check-name.mjs "Name"`. Optional: `CHATGIPITE_WMN=1` uses the maintained WhatsMyName signatures (fixes TikTok etc.; `npm run update-wmn` to refresh). `CHATGIPITE_PLAYWRIGHT=1` + `npx playwright install chromium` adds a headless-browser fallback. IG/X stay "verify manually" (login-walled — nothing logged-out resolves them). |
| `biz_synthesis` | Executive brief: conviction score (1-10), 5 key decisions, 90-day action roadmap |
| `biz_north_star` | North Star Metric + input model + Customer Factory + guardrails |
| `biz_rice_score` | RICE prioritization (Reach × Impact × Confidence / Effort) |
| `biz_assumptions` | Riskiest-assumption map + Test Card (hypothesis/metric/threshold/timebox) |
| `biz_prfaq` | Working-Backwards press release + internal/customer FAQ |
| `biz_mvp` | Smallest MVP scope to test the riskiest assumption |

### Pipelines
| Tool | Output |
|------|--------|
| `biz_full_run` | 7-step pipeline: validate → competitors → financials → canvas → pitchdeck → playbook → names |
| `biz_deep_run` | 15-step workflow + names: validate → personas → trends → market → TAM → financials → model → SWOT → pricing → GTM → journey → risks → landscape → expansion → synthesis → names |
| `biz_incubate` | Incubation loop: validate → assumptions → lean canvas + value-prop + north star → MVP → pivot/persevere decision |
| `biz_launch_sprint` | Working-Backwards launch: validate → PR/FAQ → MVP → GTM → launch checklist |
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
biz_full_run      {idea: "AI triage assistant for rural clinics"}
biz_deep_run      {idea: "AI triage assistant for rural clinics"}   ← deep version (15 steps, ~16 artifacts)
biz_incubate      {idea: "AI triage assistant for rural clinics"}   ← lean incubation loop (7 artifacts)
biz_launch_sprint {idea: "AI triage assistant for rural clinics"}   ← Working-Backwards launch (5 artifacts)
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

The client LLM (what you chat with in your IDE) and ChatGipite's internal agents are independent. You can use ChatGipite from Cursor with GPT-4o while the analysis runs on a local Ollama model.

### Config resolution order

ChatGipite looks for provider config in this order:

1. `CHATGIPITE_CONFIG` env var — absolute path to any yaml/json file
2. `providers.yaml` in the MCP server's working directory
3. `providers.json` in the MCP server's working directory
4. `config/providers.yaml` in the install directory (default)

### Using a project-specific config

Drop a `providers.yaml` anywhere and point to it via the env var in your MCP config:

```json
{
  "mcpServers": {
    "chatgipite": {
      "command": "node",
      "args": ["/absolute/path/to/ChatGipite/server.js"],
      "env": {
        "CHATGIPITE_CONFIG": "/path/to/my-project/providers.yaml"
      }
    }
  }
}
```

Or set it in your shell before launching the client:

```bash
export CHATGIPITE_CONFIG=/path/to/my-project/providers.yaml
# Windows
set CHATGIPITE_CONFIG=C:\path\to\my-project\providers.yaml
```

### Supported providers

| Provider | Type | Notes |
|----------|------|-------|
| `anthropic` | Native SDK | Default. Set `ANTHROPIC_API_KEY`. |
| `ollama` | Local HTTP | No key needed. |
| `openai` | OpenAI-compatible | Set `OPENAI_API_KEY`. |
| `openrouter` | OpenAI-compatible | Access 200+ models. Set `OPENROUTER_API_KEY`. |
| `groq` | OpenAI-compatible | Fast inference. Set `GROQ_API_KEY`. |
| `nvidia` | OpenAI-compatible | NVIDIA NIM. Set `NVIDIA_API_KEY`. |
| `google` | OpenAI-compatible | Gemini via OpenAI-compat endpoint. Set `GOOGLE_API_KEY`. |
| `lmstudio` | OpenAI-compatible | Local. No key needed. Default port `1234`. |
| `jan` | OpenAI-compatible | Local. No key needed. Default port `1337`. |

Any endpoint following the `/v1/chat/completions` spec works with `type: openai_compatible` — including Azure OpenAI, Mistral, Together AI, Kilo, and others.

No API key configured for a provider? ChatGipite falls back to passthrough — the host model (the one you're chatting with) handles the analysis instead.

### Sample config

```yaml
default_provider: ollama

providers:
  ollama:
    default_model: llama3.2
    base_url: http://localhost:11434

  lmstudio:
    type: openai_compatible
    default_model: your-loaded-model-name
    base_url: http://localhost:1234/v1

  nvidia:
    type: openai_compatible
    default_model: qwen/qwen3.5-397b-a17b   # recommended on NVIDIA NIM; markedly better than llama-3.3-70b on structured analysis
    base_url: https://integrate.api.nvidia.com/v1
    api_key: nvapi-...   # or set NVIDIA_API_KEY env var

  openrouter:
    type: openai_compatible
    default_model: openai/gpt-4o
    base_url: https://openrouter.ai/api/v1
    # api_key: ...  (set OPENROUTER_API_KEY env var)

# Route specific agents to specific providers
agent_providers:
  ideator: lmstudio       # fast local generation
  validator: nvidia       # stronger model for validation
  financial-analyst: openrouter

# Override model per agent (stacks on top of agent_providers)
model_per_agent:
  financial-analyst: anthropic/claude-opus-4-5
```

### Debug logging

Set `CHATGIPITE_DEBUG=1` to enable verbose logging to `chatgipite.log` in the install directory:

```json
"env": { "CHATGIPITE_DEBUG": "1", "CHATGIPITE_CONFIG": "/path/to/providers.yaml" }
```

### Prompt cache threshold (Anthropic)

`lib/llm-adapter.js` only attaches `cache_control` when the system prompt or context block is ≥ 8192 chars (~2048 tokens, the Sonnet 4.6 minimum). Below that threshold the API silently no-ops the cache header — so smaller prompts won't show `cache_read_input_tokens` in debug logs. This is intentional, not a bug.

## Troubleshooting

**Windows: `fetch failed` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` against any HTTPS provider.**
On corporate networks with TLS-intercepting proxies (Zscaler, Netskope, ZTNA), Node's bundled CA store doesn't trust the company root. Run with system CA:

```bat
set NODE_OPTIONS=--use-system-ca
```

Or add it to the MCP env block:

```json
"env": { "NODE_OPTIONS": "--use-system-ca", "ANTHROPIC_API_KEY": "..." }
```

This pulls in the OS trust store (which already has your corporate root).

## Prompt A/B test harness

`tests/run-ab.mjs` + `tests/judge.mjs` compare current subagent prompts against a frozen pre-modernization baseline and a no-system-prompt vanilla variant. See `tests/README.md`. Requires `ANTHROPIC_API_KEY` for the judge step (~$2-3 per run).

## Requirements

- Node.js 20+ (Node 24 supported)
- LLM API key (optional — Ollama works out of the box for fully local use)

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
