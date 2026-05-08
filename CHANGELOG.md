# Changelog

All notable changes to ChatGipite are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-08

### Added
- **Claude Code skill mode**: install via `install.sh -c skill` / `install.bat -c skill`. Loads on demand (~50 tokens) instead of full MCP server startup (~5–8K). Lives at `~/.claude/skills/chatgipite/` as a symlink (Unix) or junction (Windows). Coexists with MCP installs.
- **`lib/handlers.js`**: tool handlers extracted from `server.js` so the skill wrapper and the MCP server share one implementation.
- **`lib/schemas.js`**: zod 4.4 schemas for all 25 tools. Bounded inputs (200 chars short / 8000 chars long), strict slug regex `/^[a-z0-9-]+$/` blocking path traversal, structured `INVALID_INPUT` errors with field-level issues.
- **Anthropic prompt caching**: `cache_control: ephemeral` attached to system + dep-context blocks ≥ 8192 chars (Sonnet 4.6's 2048-token minimum).
- **Parallel orchestrator**: topological wave scheduler replaces the sequential step loop. `deep-analysis`'s 15 steps now run in 5 waves. Dependents skip cleanly when an upstream step fails. `MAX_DEP_CONTEXT_CHARS` configurable (default 12000).
- **A/B prompt test harness** (`tests/run-ab.mjs`, `tests/judge.mjs`): 54-generation comparison across `a` (pre-modernization), `b` (current), and `vanilla` (no system prompt). 5-criterion rubric scored by `claude-sonnet-4-6`. `npm run test:ab && npm run test:judge`.
- **Bad-output anti-examples** in `validator`, `financial-analyst`, `market-analyst`, `competitive-intelligence` agent prompts.
- **Troubleshooting section** in README for Windows corporate-TLS networks (`NODE_OPTIONS=--use-system-ca`).

### Changed
- **SDK bumps**: `@anthropic-ai/sdk` 0.39 → 0.95, `@modelcontextprotocol/sdk` → 1.29, `better-sqlite3` 11 → 12.9 (Node 24 prebuilt fix).
- **Subagent prompts tightened**: 17 prompts shortened ~30% (~1,270 → ~889 lines aggregate). Stripped preamble / AI filler. Bullet templates over prose. Imperative one-liner rules.
- **`server.js`** is now a thin dispatcher; name + version sourced from `package.json` (no drift).
- **NVIDIA recommended model** in sample configs: `meta/llama-3.3-70b-instruct` → `qwen/qwen3.5-397b-a17b`. Markedly better on structured-output tasks per A/B results; Llama 3.3 still works but loses to baseline on 2 of 3 agents.
- **Structured errors**: every tool failure returns `{ code, message }` (`INVALID_INPUT` | `UNKNOWN_TOOL` | `INTERNAL`) instead of free-text strings.
- **`tools/index.json`**: backfilled `enum`, `minimum`, `maximum`, `pattern`, `minLength`, `maxLength` to mirror zod constraints — MCP clients now see consistent validation.
- **`lib/memory.js`**: throws on use-before-init instead of silent no-op on null `db`.
- **Installer**: `-c all` is MCP-only (skill is opt-in via `-c skill` to avoid silent skill installs on `--upgrade -c all`). Uninstall loops still cover skill for cleanup.

### Fixed
- **Path traversal**: slug fields previously accepted `../../etc/passwd`, which then reached `path.join(WORKSPACE, 'ideas', slug, ...)`. Now rejected by the slug regex at validation time.
- **DoS via large strings**: free-text fields had only `min` constraints in zod, no `max`. A 10MB `idea` string would have been accepted. Now bounded.
- **`server.js` version drift**: was hardcoded to "1.0.0" while `package.json` said `0.2.0`. Now sourced from `package.json`.
- **`install.sh` Git Bash bugs (7)**: `get_version` failed because Windows `node` rejects MSYS paths; `$NODE_BIN` unquoted broke on "Program Files"; `ln -s` produced fake symlinks (now uses `mklink /J` via temp .bat); double "claude (global)" status row when both `~/.claude.json` and `~/.claude/mcp.json` exist; missing skill row in status; uninstall fallback `rm -rf` would chase a junction and delete source repo (removed).
- **`install.bat` bugs (2)**: missing skill row in status; literal `(Claude Code)` inside an `if exist (...) else (...)` block parsed as the closing paren (escaped with `^(` `^)`).
- **Cache threshold**: `CACHE_MIN_CHARS` was 1024, below Anthropic's silent no-op floor (~8192 chars / 2048 tokens). Raised so cache_control actually fires on Sonnet 4.6.
- **Subagent spec re-reads**: `loadAgentSpec` was reading from disk on every dispatch (15+ reads per `biz_deep_run`). Now memoized in both `lib/handlers.js` and `lib/orchestrator.js`.
- **`toSlug`**: trailing-hyphen trim now happens *after* the substring cap, so a slug clipped at a hyphen boundary doesn't end with `-`.

## [0.2.0] - 2026-03-02

Multi-provider support, debugging instrumentation, and prompt updates to specify idea count. See git history.

## [0.1.0] - Initial release

24-tool MCP server for business idea generation, validation, and execution planning. SQLite FTS5-backed memory. 17 specialized subagents.
