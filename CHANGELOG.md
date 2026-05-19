# Changelog

All notable changes to ChatGipite are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-05-20

### Added
- **Brand-name checker rewrite** (`lib/name-checker.js`): domain availability now resolves RDAP → WHOIS → DNS instead of bare `dns.lookup` (which gave false available/taken on registered-but-unparked domains). Multi-TLD (default com,io,ai,co,app,dev,net,org). Socials expanded 4 → 9 (X, Instagram, TikTok, LinkedIn, GitHub, YouTube, Facebook, Reddit, Threads); 403/429/451 reported as bot-squat/blocked, never a hard "taken".
- **Standalone CLI** `scripts/check-name.mjs` + `npm run check-name`: brand-name checks without MCP/skill. `--tlds`, `--socials`, `--json` flags.
- **`biz_name_check`** accepts optional `tlds` and `socials` filters.
- **`scripts/live-verify.mjs`**: live smoke-test against any OpenAI-compatible provider (probes models, runs validator + a P3 agent, flags passthrough fallback). Key read from env, never stored.
- **Canvas suite**: new `canvas-strategist` subagent. `biz_canvas` now takes `canvas_type` (bmc default / lean / vpc / mission / ai-platform). New tools `biz_lean_canvas`, `biz_value_prop`, `biz_mission_canvas`, `biz_ai_canvas`. Lean Canvas follows Running Lean 3rd ed (sub-fields + prescribed fill order + Customer Factory metrics).
- **Strategy / fast-launch tools**: subagents `north-star-architect`, `incubation-coach`, `working-backwards-writer`, `mvp-scoper`. Tools `biz_north_star`, `biz_rice_score`, `biz_assumptions`, `biz_prfaq`, `biz_mvp`.
- **Incubation + launch pipelines**: `workflows/incubation.md` (`biz_incubate`: validate → assumptions/Test Card → Lean+VPC+North Star → MVP → pivot/persevere) and `workflows/launch-sprint.md` (`biz_launch_sprint`: validate → PR/FAQ → MVP → GTM → checklist). 36 tools total.
- **Opt-in WhatsMyName-driven social detection** (`CHATGIPITE_WMN=1`, `lib/wmn.js`). Uses the community-maintained `wmn-data.json` (CC BY-SA 4.0, vendored unmodified at `data/wmn-data.json`, attribution in `data/WHATSMYNAME-ATTRIBUTION.md`, refresh via `npm run update-wmn`) — queries each platform directly with vetted `e_/m_` signatures instead of hand-rolled regexes. Fixes TikTok detection (uses its `oembed` endpoint). Legally clean: no third-party aggregator in the loop. IG/X have no usable WMN entry / stay login-walled → honest "verify manually", never a guess.
- **Opt-in headless-browser social fallback** (`lib/social-browser.js`, `CHATGIPITE_PLAYWRIGHT=1`, `playwright` optionalDependency + `npx playwright install chromium`). For HEAD-blocked socials it loads the profile in headless Chromium and asserts available/taken **only on hard evidence** (HTTP 404 / explicit not-found / explicit profile marker); a login/anti-bot wall stays "verify manually" — never a guess. IG/X logged-out remain unresolvable (wall), by design honest.

### Fixed
- **False "taken" on Instagram/TikTok**: HEAD returns HTTP 200 for *any* handle on login-walled platforms (IG/TikTok/X/Facebook), so the prior `200 → taken` logic reported every handle as taken. These now return inconclusive → defer to browser fallback or honest "unknown".
- **`biz_rice_score` emitted a Validation Report, not RICE**: it reused the `validator` agent, whose strong output template overrode the RICE task string. New dedicated `rice-scorer` subagent (Reach/Impact/Confidence/Effort + shown arithmetic + verdict). Verified live via the MCP server on NVIDIA.
- **OpenAI-compatible reasoning models**: `dispatchOpenAICompat` only read `message.content`; reasoning models (qwen3.x, deepseek-r1) return the answer in `message.reasoning_content`, so every call silently fell back to passthrough. Now falls back to `reasoning_content`. Verified live against NVIDIA `qwen/qwen3.5-122b-a10b`.

### Changed
- `biz_name_check` / `biz_name` result shape: `domain` (single) → `domains` (array, one per TLD). Output tables widened.
- `config/providers.yaml` NVIDIA example model corrected to a verified id (`qwen/qwen3.5-122b-a10b`); the old `qwen/qwen3.5-397b-a17b` did not exist.
- `tests/judge.mjs` now uses the shared provider adapter instead of a hardcoded Anthropic client, so the A/B harness runs on any configured provider (no longer requires `ANTHROPIC_API_KEY`). Consistent with `tests/run-ab.mjs`.
- **BMC modernized + reassigned**: moved off the generic `writer` agent to `canvas-strategist`; pulls personas/pricing/financials and adds defensibility + cross-checks. `writer` now owns the pitch deck only.

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
