#!/usr/bin/env bash
set -euo pipefail

# ── Config ──────────────────────────────────────────────
MARKER_FILE=".chatgipite-installed"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"
WORKSPACE_DIR="$PWD"
SERVER_JS="$APP_DIR/server.js"
SERVER_NAME="chatgipite"

# ── Defaults ────────────────────────────────────────────
FORCE=false
UNINSTALL=false
UPDATE=false
CLIENT="claudedesktop"
SKIP_TEST=false
GLOBAL_CONFIG=false
CLIENT_EXPLICIT=false
STATUS=false

# ── Parse flags ─────────────────────────────────────────
show_help() {
    cat <<EOF
Usage: ./install.sh [options]

Options:
  -c, --client TYPE   claudedesktop, claude, cursor, windsurf, vscode, gemini,
                      codex, zed, kilo, opencode, goose, pidev, all
                      (default: claudedesktop)
  -f, --force         Skip prompts, overwrite existing config
  -u, --uninstall     Remove ChatGipite from MCP client config
      --upgrade       Re-run npm install and update MCP config paths
      --update        Alias for --upgrade
      --status        Show where this server is currently installed
      --global        Write to global config path (claude, cursor, gemini, codex,
                      opencode, all)
      --skip-test     Skip server validation
  -h, --help          Show this help

Examples:
  ./install.sh                        Install for Claude Desktop
  ./install.sh -c claude              Install for Claude Code (workspace)
  ./install.sh -c claude --global     Install for Claude Code (global)
  ./install.sh -c cursor              Install for Cursor (workspace)
  ./install.sh -c cursor --global     Install for Cursor (global)
  ./install.sh -c windsurf            Install for Windsurf
  ./install.sh -c vscode              Install for VS Code (workspace .vscode/mcp.json)
  ./install.sh -c gemini              Install for Gemini CLI (workspace)
  ./install.sh -c codex               Install for OpenAI Codex CLI (workspace)
  ./install.sh -c zed                 Install for Zed (global)
  ./install.sh -c all                 Install for all detected clients
  ./install.sh --status               Show installation status
  ./install.sh --upgrade              Upgrade npm deps
  ./install.sh --upgrade -c all       Upgrade + reconfigure all clients
  ./install.sh -u                     Uninstall
  ./install.sh -u -c all              Uninstall from all client configs
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)          FORCE=true; shift ;;
        -u|--uninstall)      UNINSTALL=true; shift ;;
        --update|--upgrade)  UPDATE=true; shift ;;
        --status)            STATUS=true; shift ;;
        -c|--client)         CLIENT="$2"; CLIENT_EXPLICIT=true; shift 2 ;;
        --global)            GLOBAL_CONFIG=true; shift ;;
        --skip-test)         SKIP_TEST=true; shift ;;
        -h|--help)           show_help ;;
        *) echo "Unknown option: $1"; show_help ;;
    esac
done

# ── Helpers ─────────────────────────────────────────────
info()  { echo "  $*"; }
ok()    { echo "  OK: $*"; }
err()   { echo "  ERROR: $*" >&2; }
die()   { err "$*"; exit 1; }

if [[ "$UNINSTALL" == true && "$CLIENT_EXPLICIT" == false ]]; then
    CLIENT="all"
fi

if [[ "$GLOBAL_CONFIG" == true ]]; then
    case "$CLIENT" in
        claude|cursor|gemini|codex|opencode|both|all) ;;
        *) die "--global is only valid with -c claude, cursor, gemini, codex, opencode, or all" ;;
    esac
fi

get_version() {
    node -e "const p=require('$APP_DIR/package.json'); console.log(p.version);" 2>/dev/null \
        || echo "unknown"
}

get_installed_version() {
    local marker="$APP_DIR/$MARKER_FILE"
    [[ -f "$marker" ]] && cat "$marker" || echo ""
}

# ── Node detection ───────────────────────────────────────
find_node() {
    for cmd in node nodejs; do
        if command -v "$cmd" &>/dev/null; then
            local ver
            ver=$("$cmd" --version 2>/dev/null | sed 's/v//' | cut -d. -f1) || continue
            if [[ "$ver" -ge 20 ]]; then
                command -v "$cmd"
                return 0
            fi
        fi
    done
    return 1
}

# ── MCP config paths ─────────────────────────────────────
get_desktop_config_path() {
    case "$(uname -s)" in
        Darwin)
            echo "$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
        Linux)
            if grep -qi microsoft /proc/version 2>/dev/null; then
                local appdata
                appdata=$(cmd.exe /c "echo %APPDATA%" 2>/dev/null | tr -d '\r')
                echo "$appdata/Claude/claude_desktop_config.json"
            else
                echo "$HOME/.config/Claude/claude_desktop_config.json"
            fi ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "$APPDATA/Claude/claude_desktop_config.json" ;;
        *)
            echo "$HOME/.config/Claude/claude_desktop_config.json" ;;
    esac
}

get_code_config_path() {
    echo "$WORKSPACE_DIR/.mcp.json"
}

get_global_code_config_paths() {
    local found=()
    [[ -f "$HOME/.claude.json"     ]] && found+=("$HOME/.claude.json")
    [[ -f "$HOME/.claude/mcp.json" ]] && found+=("$HOME/.claude/mcp.json")
    if [[ ${#found[@]} -eq 0 ]]; then
        found+=("$HOME/.claude.json")
    fi
    printf '%s\n' "${found[@]}"
}

get_cursor_config_path() {
    if [[ "$GLOBAL_CONFIG" == true ]]; then
        echo "$HOME/.cursor/mcp.json"
    else
        echo "$WORKSPACE_DIR/.cursor/mcp.json"
    fi
}

get_windsurf_config_path() {
    echo "$HOME/.codeium/windsurf/mcp_config.json"
}

get_vscode_config_path() {
    echo "$WORKSPACE_DIR/.vscode/mcp.json"
}

get_gemini_config_path() {
    if [[ "$GLOBAL_CONFIG" == true ]]; then
        echo "$HOME/.gemini/settings.json"
    else
        echo "$WORKSPACE_DIR/.gemini/settings.json"
    fi
}

get_codex_config_path() {
    if [[ "$GLOBAL_CONFIG" == true ]]; then
        echo "$HOME/.codex/config.toml"
    else
        echo "$WORKSPACE_DIR/.codex/config.toml"
    fi
}

get_zed_config_path() {
    echo "$HOME/.config/zed/settings.json"
}

get_kilo_config_path() {
    echo "$WORKSPACE_DIR/.kilocode/mcp.json"
}

get_opencode_config_path() {
    if [[ "$GLOBAL_CONFIG" == true ]]; then
        echo "$HOME/.config/opencode/opencode.json"
    else
        echo "$WORKSPACE_DIR/opencode.json"
    fi
}

get_goose_config_path() {
    echo "$HOME/.config/goose/config.yaml"
}

# ── JSON merge/remove (mcpServers) ────────────────────────
merge_mcp_config() {
    local config_path="$1"
    local server_js="$2"

    if [[ -f "$config_path" ]]; then
        cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"
        info "Backed up existing config"
    fi

    node -e "
const fs = require('fs'), path = require('path');
const configPath = path.resolve(process.argv[1]);
const serverJs   = path.resolve(process.argv[2]);
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
config.mcpServers = config.mcpServers || {};
config.mcpServers['$SERVER_NAME'] = { command: 'node', args: [serverJs] };
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
" "$config_path" "$server_js"
}

remove_mcp_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 0

    cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"

    node -e "
const fs = require('fs');
const configPath = process.argv[1];
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { process.exit(0); }
const servers = config.mcpServers || {};
if ('$SERVER_NAME' in servers) {
    delete servers['$SERVER_NAME'];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log('  Removed $SERVER_NAME from config');
} else {
    console.log('  $SERVER_NAME not found in config');
}
" "$config_path"
}

# ── VS Code (servers key) ─────────────────────────────────
merge_vscode_config() {
    local config_path="$1"
    local server_js="$2"

    if [[ -f "$config_path" ]]; then
        cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"
        info "Backed up existing config"
    fi

    node -e "
const fs = require('fs'), path = require('path');
const configPath = path.resolve(process.argv[1]);
const serverJs   = path.resolve(process.argv[2]);
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
config.servers = config.servers || {};
config.servers['$SERVER_NAME'] = { type: 'stdio', command: 'node', args: [serverJs] };
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
" "$config_path" "$server_js"
}

remove_vscode_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 0

    cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"

    node -e "
const fs = require('fs');
const configPath = process.argv[1];
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { process.exit(0); }
const servers = config.servers || {};
if ('$SERVER_NAME' in servers) {
    delete servers['$SERVER_NAME'];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log('  Removed $SERVER_NAME from VS Code config');
} else {
    console.log('  $SERVER_NAME not found in VS Code config');
}
" "$config_path"
}

# ── Codex TOML ────────────────────────────────────────────
merge_codex_config() {
    local config_path="$1"
    local server_js="$2"

    if [[ -f "$config_path" ]]; then
        cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"
        info "Backed up existing config"
    fi

    node -e "
const fs = require('fs');
const path = require('path');
const configPath = process.argv[1];
const serverJs = process.argv[2];
const sn = '$SERVER_NAME';
const sectionHeader = '[mcp_servers.' + sn + ']';
const newSection = '\\n' + sectionHeader + '\\ncommand = \"node ' + serverJs + '\"\\nstartup_timeout_sec = 30\\ntool_timeout_sec = 300\\nenabled = true\\n';
fs.mkdirSync(path.dirname(path.resolve(configPath)), { recursive: true });
let existing = '';
try { existing = fs.readFileSync(configPath, 'utf8'); } catch {}
if (existing.includes(sectionHeader)) {
    const lines = existing.split('\\n');
    const startIdx = lines.findIndex(l => l.trim() === sectionHeader);
    if (startIdx !== -1) {
        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
            if (lines[i].match(/^\[/)) { endIdx = i; break; }
        }
        lines.splice(startIdx, endIdx - startIdx);
        existing = lines.join('\\n');
    }
}
existing = existing.trimEnd();
if (existing) existing += '\\n';
fs.writeFileSync(configPath, existing + newSection);
" "$config_path" "$server_js"
}

remove_codex_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 0

    cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"

    node -e "
const fs = require('fs');
const configPath = process.argv[1];
const sn = '$SERVER_NAME';
const sectionHeader = '[mcp_servers.' + sn + ']';
let existing = '';
try { existing = fs.readFileSync(configPath, 'utf8'); } catch { process.exit(0); }
if (!existing.includes(sectionHeader)) {
    console.log('  $SERVER_NAME not found in codex config');
    process.exit(0);
}
const lines = existing.split('\\n');
const startIdx = lines.findIndex(l => l.trim() === sectionHeader);
if (startIdx !== -1) {
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
        if (lines[i].match(/^\[/)) { endIdx = i; break; }
    }
    lines.splice(startIdx, endIdx - startIdx);
    fs.writeFileSync(configPath, lines.join('\\n'));
    console.log('  Removed $SERVER_NAME from codex config');
}
" "$config_path"
}

# ── Zed (context_servers) ─────────────────────────────────
merge_zed_config() {
    local config_path="$1"
    local server_js="$2"

    if [[ -f "$config_path" ]]; then
        cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"
        info "Backed up existing config"
    fi

    node -e "
const fs = require('fs'), path = require('path');
const configPath = path.resolve(process.argv[1]);
const serverJs   = path.resolve(process.argv[2]);
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
config.context_servers = config.context_servers || {};
config.context_servers['$SERVER_NAME'] = {
    command: { path: 'node', args: [serverJs], env: {} }
};
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
" "$config_path" "$server_js"
}

remove_zed_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 0

    cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"

    node -e "
const fs = require('fs');
const configPath = process.argv[1];
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { process.exit(0); }
const cs = config.context_servers || {};
if ('$SERVER_NAME' in cs) {
    delete cs['$SERVER_NAME'];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log('  Removed $SERVER_NAME from Zed config');
} else {
    console.log('  $SERVER_NAME not found in Zed config');
}
" "$config_path"
}

# ── OpenCode ──────────────────────────────────────────────
merge_opencode_config() {
    local config_path="$1"
    if [[ -f "$config_path" ]]; then
        cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"
        info "Backed up existing config"
    fi

    node -e "
const fs = require('fs'), path = require('path');
const configPath = path.resolve(process.argv[1]);
const serverJs   = path.resolve(process.argv[2]);
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
config.mcp = config.mcp || {};
config.mcp['$SERVER_NAME'] = { type: 'local', command: ['node', serverJs] };
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
" "$config_path" "$SERVER_JS"
}

remove_opencode_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 0

    cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"

    node -e "
const fs = require('fs');
const configPath = process.argv[1];
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { process.exit(0); }
const mcp = config.mcp || {};
if ('$SERVER_NAME' in mcp) {
    delete mcp['$SERVER_NAME'];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log('  Removed $SERVER_NAME from config');
} else {
    console.log('  $SERVER_NAME not found in config');
}
" "$config_path"
}

# ── Goose YAML ────────────────────────────────────────────
merge_goose_config() {
    local config_path="$1"
    if [[ -f "$config_path" ]]; then
        cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"
        info "Backed up existing config"
    fi

    node -e "
const fs = require('fs'), path = require('path');
const configPath = path.resolve(process.argv[1]);
const serverJs   = path.resolve(process.argv[2]);
const entry = [
    'extensions:',
    '  $SERVER_NAME:',
    '    name: $SERVER_NAME',
    '    type: stdio',
    '    cmd: node',
    '    args:',
    '      - ' + serverJs,
    '    enabled: true',
    ''
].join('\\n');

let existing = '';
try { existing = fs.readFileSync(configPath, 'utf8'); } catch {}
if (existing.includes('$SERVER_NAME:')) {
    console.log('  $SERVER_NAME already in goose config');
} else {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, existing + (existing && !existing.endsWith('\\n') ? '\\n' : '') + entry);
    console.log('  Added $SERVER_NAME to goose config');
}
" "$config_path" "$SERVER_JS"
}

remove_goose_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 0
    grep -q '$SERVER_NAME:' "$config_path" || { info "$SERVER_NAME not found in goose config"; return 0; }
    info "Please manually remove the $SERVER_NAME block from $config_path"
}

# ── Status helpers ────────────────────────────────────────
_check_in_json() {
    local config_path="$1"
    [[ -f "$config_path" ]] || { echo "NO"; return; }
    grep -q "\"$SERVER_NAME\"" "$config_path" 2>/dev/null && echo "YES" || echo "NO"
}

_check_in_toml() {
    local config_path="$1"
    [[ -f "$config_path" ]] || { echo "NO"; return; }
    grep -q "^\[mcp_servers\.$SERVER_NAME\]" "$config_path" 2>/dev/null && echo "YES" || echo "NO"
}

_check_in_yaml() {
    local config_path="$1"
    [[ -f "$config_path" ]] || { echo "NO"; return; }
    grep -q "  $SERVER_NAME:" "$config_path" 2>/dev/null && echo "YES" || echo "NO"
}

# ── Install/Uninstall client ──────────────────────────────
install_client() {
    local client="$1"
    case "$client" in
        claudedesktop)
            local cfg; cfg=$(get_desktop_config_path)
            info "Registering with Claude Desktop: $cfg"
            merge_mcp_config "$cfg" "$SERVER_JS"
            ok "Claude Desktop configured" ;;
        claude)
            if [[ "$GLOBAL_CONFIG" == true ]]; then
                info "Registering with Claude Code (global)"
                while IFS= read -r gp; do
                    merge_mcp_config "$gp" "$SERVER_JS"
                done < <(get_global_code_config_paths)
            else
                local cfg; cfg=$(get_code_config_path)
                info "Registering with Claude Code: $cfg"
                merge_mcp_config "$cfg" "$SERVER_JS"
            fi
            ok "Claude Code configured" ;;
        cursor)
            local cfg; cfg=$(get_cursor_config_path)
            info "Registering with Cursor: $cfg"
            merge_mcp_config "$cfg" "$SERVER_JS"
            ok "Cursor configured" ;;
        windsurf)
            local cfg; cfg=$(get_windsurf_config_path)
            info "Registering with Windsurf: $cfg"
            merge_mcp_config "$cfg" "$SERVER_JS"
            ok "Windsurf configured" ;;
        vscode)
            local cfg; cfg=$(get_vscode_config_path)
            info "Registering with VS Code: $cfg"
            info "Note: for global VS Code config, use the VS Code command palette"
            merge_vscode_config "$cfg" "$SERVER_JS"
            ok "VS Code configured" ;;
        gemini)
            local cfg; cfg=$(get_gemini_config_path)
            info "Registering with Gemini CLI: $cfg"
            merge_mcp_config "$cfg" "$SERVER_JS"
            ok "Gemini CLI configured" ;;
        codex)
            local cfg; cfg=$(get_codex_config_path)
            info "Registering with Codex CLI: $cfg"
            merge_codex_config "$cfg" "$SERVER_JS"
            ok "Codex CLI configured" ;;
        zed)
            local cfg; cfg=$(get_zed_config_path)
            info "Registering with Zed: $cfg"
            merge_zed_config "$cfg" "$SERVER_JS"
            ok "Zed configured" ;;
        kilo)
            local cfg; cfg=$(get_kilo_config_path)
            info "Registering with Kilo Code: $cfg"
            merge_mcp_config "$cfg" "$SERVER_JS"
            ok "Kilo Code configured" ;;
        opencode)
            local cfg; cfg=$(get_opencode_config_path)
            info "Registering with OpenCode: $cfg"
            merge_opencode_config "$cfg"
            ok "OpenCode configured" ;;
        goose)
            local cfg; cfg=$(get_goose_config_path)
            info "Registering with Goose: $cfg"
            merge_goose_config "$cfg"
            ok "Goose configured" ;;
        pidev)
            echo ""
            echo "  pi.dev does not support MCP servers natively."
            echo "  pi.dev uses TypeScript extensions and CLI tools instead."
            echo "  To use ChatGipite concepts in pi.dev, see: https://pi.dev/docs/extensions"
            echo "" ;;
        *)
            err "Unknown client: $client" ;;
    esac
}

uninstall_client() {
    local client="$1"
    local cfg
    case "$client" in
        claudedesktop)
            cfg=$(get_desktop_config_path)
            if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                remove_mcp_config "$cfg" > /dev/null 2>&1; ok "Removed from Claude Desktop"; fi ;;
        claude)
            if [[ "$GLOBAL_CONFIG" == true ]]; then
                while IFS= read -r gp; do
                    if [[ "$(_check_in_json "$gp")" == "YES" ]]; then
                        remove_mcp_config "$gp" > /dev/null 2>&1; ok "Removed from Claude Code (global)"; fi
                done < <(get_global_code_config_paths)
            else
                cfg=$(get_code_config_path)
                if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                    remove_mcp_config "$cfg" > /dev/null 2>&1; ok "Removed from Claude Code"; fi
            fi ;;
        cursor)
            cfg=$(get_cursor_config_path)
            if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                remove_mcp_config "$cfg" > /dev/null 2>&1; ok "Removed from Cursor"; fi ;;
        windsurf)
            cfg=$(get_windsurf_config_path)
            if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                remove_mcp_config "$cfg" > /dev/null 2>&1; ok "Removed from Windsurf"; fi ;;
        vscode)
            cfg=$(get_vscode_config_path)
            if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                remove_vscode_config "$cfg" > /dev/null 2>&1; ok "Removed from VS Code"; fi ;;
        gemini)
            cfg=$(get_gemini_config_path)
            if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                remove_mcp_config "$cfg" > /dev/null 2>&1; ok "Removed from Gemini CLI"; fi ;;
        codex)
            cfg=$(get_codex_config_path)
            if [[ "$(_check_in_toml "$cfg")" == "YES" ]]; then
                remove_codex_config "$cfg" > /dev/null 2>&1; ok "Removed from Codex CLI"; fi ;;
        zed)
            cfg=$(get_zed_config_path)
            if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                remove_zed_config "$cfg" > /dev/null 2>&1; ok "Removed from Zed"; fi ;;
        kilo)
            cfg=$(get_kilo_config_path)
            if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                remove_mcp_config "$cfg" > /dev/null 2>&1; ok "Removed from Kilo Code"; fi ;;
        opencode)
            cfg=$(get_opencode_config_path)
            if [[ "$(_check_in_json "$cfg")" == "YES" ]]; then
                remove_opencode_config "$cfg" > /dev/null 2>&1; ok "Removed from OpenCode"; fi ;;
        goose)
            cfg=$(get_goose_config_path)
            if [[ "$(_check_in_yaml "$cfg")" == "YES" ]]; then
                remove_goose_config "$cfg" > /dev/null 2>&1; ok "Removed from Goose"; fi ;;
        *)
            err "Unknown client: $client" ;;
    esac
}

# ── Show status ───────────────────────────────────────────
show_status() {
    local version installed_version
    version=$(get_version)
    installed_version=$(get_installed_version)
    local _ws _gh
    _ws="$WORKSPACE_DIR"
    _gh="$HOME"

    echo ""
    echo "  ChatGipite v${version} — Status"
    echo "  ────────────────────────────────────────────────────────────────────────────"
    printf "  %-30s %-9s %s\n" "Client" "Installed" "Config path"
    echo "  ────────────────────────────────────────────────────────────────────────────"

    _row() {
        local label="$1" status="$2" path="$3"
        if [[ "$status" == "YES" ]]; then
            printf "  %-30s %-9s %s\n" "$label" "YES" "$path"
        else
            printf "  %-30s %s\n" "$label" "NO"
        fi
    }

    local p s
    p="$(get_desktop_config_path)";   s=$(_check_in_json "$p"); _row "claudedesktop" "$s" "$p"
    p="$(get_code_config_path)";      s=$(_check_in_json "$p"); _row "claude (workspace)" "$s" "$p"
    while IFS= read -r gp; do
        s=$(_check_in_json "$gp"); _row "claude (global)" "$s" "$gp"
    done < <(get_global_code_config_paths)
    p="$_ws/.cursor/mcp.json";        s=$(_check_in_json "$p"); _row "cursor (workspace)" "$s" "$p"
    p="$_gh/.cursor/mcp.json";        s=$(_check_in_json "$p"); _row "cursor (global)" "$s" "$p"
    p="$(get_windsurf_config_path)";  s=$(_check_in_json "$p"); _row "windsurf" "$s" "$p"
    p="$(get_vscode_config_path)";    s=$(_check_in_json "$p"); _row "vscode (workspace)" "$s" "$p"
    p="$_ws/.gemini/settings.json";   s=$(_check_in_json "$p"); _row "gemini (workspace)" "$s" "$p"
    p="$_gh/.gemini/settings.json";   s=$(_check_in_json "$p"); _row "gemini (global)" "$s" "$p"
    p="$_ws/.codex/config.toml";      s=$(_check_in_toml "$p"); _row "codex (workspace)" "$s" "$p"
    p="$_gh/.codex/config.toml";      s=$(_check_in_toml "$p"); _row "codex (global)" "$s" "$p"
    p="$(get_zed_config_path)";       s=$(_check_in_json "$p"); _row "zed" "$s" "$p"
    p="$(get_kilo_config_path)";      s=$(_check_in_json "$p"); _row "kilo" "$s" "$p"
    p="$_ws/opencode.json";           s=$(_check_in_json "$p"); _row "opencode (workspace)" "$s" "$p"
    p="$_gh/.config/opencode/opencode.json"; s=$(_check_in_json "$p"); _row "opencode (global)" "$s" "$p"
    p="$(get_goose_config_path)";     s=$(_check_in_yaml "$p"); _row "goose" "$s" "$p"

    echo "  ────────────────────────────────────────────────────────────────────────────"
    if [[ -n "$installed_version" ]]; then
        echo "  Package: v${installed_version} installed"
    else
        echo "  Package: not installed"
    fi
    echo ""
}

# ── Main ─────────────────────────────────────────────────
VERSION=$(get_version)
INSTALLED_VERSION=$(get_installed_version)

echo ""
echo "  ChatGipite by Lugitech  v${VERSION}"
echo "  Ang Chat bot ng mga Gipit"
echo "  ─────────────────────────────────────"

NODE_BIN=$(find_node) || die "Node.js 18+ not found. Install from https://nodejs.org"
info "Node: $($NODE_BIN --version) at $NODE_BIN"

# ── Status path ───────────────────────────────────────────
if [[ "$STATUS" == true ]]; then
    show_status
    exit 0
fi

# ── Uninstall path ───────────────────────────────────────
if [[ "$UNINSTALL" == true ]]; then
    echo ""
    info "Uninstalling ChatGipite..."
    if [[ "$CLIENT" == "all" ]]; then
        for c in claudedesktop claude cursor windsurf vscode gemini codex zed kilo opencode goose; do
            uninstall_client "$c"
        done
    else
        uninstall_client "$CLIENT"
    fi
    [[ -f "$APP_DIR/$MARKER_FILE" ]] && rm -f "$APP_DIR/$MARKER_FILE"
    echo ""
    ok "ChatGipite uninstalled."
    exit 0
fi

# ── Already installed check ──────────────────────────────
if [[ -n "$INSTALLED_VERSION" && "$INSTALLED_VERSION" == "$VERSION" && "$FORCE" == false && "$UPDATE" == false && "$CLIENT_EXPLICIT" == false ]]; then
    echo ""
    info "Already installed v${INSTALLED_VERSION}. Use --upgrade to reinstall or --force to overwrite."
    exit 0
fi

if [[ -n "$INSTALLED_VERSION" && "$INSTALLED_VERSION" != "$VERSION" ]]; then
    info "Upgrading from v${INSTALLED_VERSION} → v${VERSION}"
fi


# ── npm install ───────────────────────────────────────────
echo ""
info "Running npm install..."
cd "$APP_DIR"
npm install --omit=dev --silent
ok "Dependencies installed"

# ── Validate server ────────────────────────────────────────
if [[ "$SKIP_TEST" == false ]]; then
    info "Validating server..."
    timeout 5 node "$SERVER_JS" <<< "" 2>/dev/null && true
    ok "Server validation passed"
fi

# ── Register with MCP client(s) ──────────────────────────
echo ""
info "Configuring MCP client: $CLIENT"
if [[ "$CLIENT" == "all" ]]; then
    for c in claudedesktop claude cursor windsurf vscode gemini codex zed kilo opencode goose; do
        install_client "$c"
    done
else
    install_client "$CLIENT"
fi

# ── Write marker ─────────────────────────────────────────
echo "$VERSION" > "$APP_DIR/$MARKER_FILE"

echo ""
echo "  ─────────────────────────────────────"
ok "ChatGipite v${VERSION} installed."
echo ""
echo "  Next steps:"
echo "  1. Restart your MCP client"
echo "  2. Call biz_full_run to validate your first idea"
echo ""
echo "  LLM config (optional):"
echo "    No key needed  : set default_provider: ollama in config/providers.yaml"
echo "    Anthropic/Claude: export ANTHROPIC_API_KEY=sk-ant-... (or add to client env)"
echo ""
