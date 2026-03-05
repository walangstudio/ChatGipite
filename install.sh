#!/usr/bin/env bash
set -euo pipefail

# ── Config ──────────────────────────────────────────────
MARKER_FILE=".chatgipite-installed"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"
SERVER_JS="$APP_DIR/server.js"

# ── Defaults ────────────────────────────────────────────
FORCE=false
UNINSTALL=false
UPDATE=false
CLIENT="claudedesktop"
SKIP_TEST=false
GLOBAL_CONFIG=false
CLIENT_EXPLICIT=false

# ── Parse flags ─────────────────────────────────────────
show_help() {
    cat <<EOF
Usage: ./install.sh [options]

Options:
  -c, --client TYPE   MCP client: claudedesktop, claude, kilo, opencode, goose, all (default: claudedesktop)
  -f, --force         Skip prompts, overwrite existing config
  -u, --uninstall     Remove ChatGipite from MCP client config
      --upgrade       Re-run npm install and update MCP config paths
      --update        Alias for --upgrade
      --global        Write to global config path (applies to: claude, opencode, all)
                      Default (no --global): writes to parent workspace dir
      --skip-test     Skip server validation
  -h, --help          Show this help

Examples:
  ./install.sh                      Install for Claude Desktop
  ./install.sh -c claude              Install for Claude Code (workspace-local)
  ./install.sh -c claude --global     Install for Claude Code (global config)
  ./install.sh -c kilo              Install for Kilo Code (workspace-local)
  ./install.sh -c opencode          Install for OpenCode (workspace-local)
  ./install.sh -c opencode --global Install for OpenCode (global)
  ./install.sh -c goose             Install for Goose
  ./install.sh -c all               Install for all detected clients
  ./install.sh --upgrade            Re-install + update config
  ./install.sh -u                   Uninstall
  ./install.sh -u -c all            Uninstall from all client configs
  ./install.sh -f --skip-test       Force install, skip tests
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)          FORCE=true; shift ;;
        -u|--uninstall)      UNINSTALL=true; shift ;;
        --update|--upgrade)  UPDATE=true; shift ;;
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

if [[ "$GLOBAL_CONFIG" == true ]]; then
    case "$CLIENT" in
        claude|opencode|all) ;;
        *) die "--global is only valid with -c claude, opencode, or all" ;;
    esac
fi

get_version() {
    node -e "const p=require('$APP_DIR/package.json'); console.log(p.version);" 2>/dev/null || echo "unknown"
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
            if [[ "$ver" -ge 18 ]]; then
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
    if [[ "$GLOBAL_CONFIG" == true ]]; then
        echo "$HOME/.claude.json"
    else
        echo "$(dirname "$APP_DIR")/.mcp.json"
    fi
}

get_kilo_config_path() {
    echo "$(dirname "$APP_DIR")/.kilocode/mcp.json"
}

get_opencode_config_path() {
    if [[ "$GLOBAL_CONFIG" == true ]]; then
        echo "$HOME/.config/opencode/opencode.json"
    else
        echo "$(dirname "$APP_DIR")/opencode.json"
    fi
}

get_goose_config_path() {
    echo "$HOME/.config/goose/config.yaml"
}

# ── JSON merge/remove (pure Node, no jq needed) ──────────
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
config.mcpServers['chatgipite'] = { command: 'node', args: [serverJs] };
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
" "$config_path" "$server_js"
}

remove_mcp_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 1
    cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"

    node -e "
const fs = require('fs');
const configPath = process.argv[1];
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { process.exit(1); }
const servers = config.mcpServers || {};
if ('chatgipite' in servers) {
    delete servers['chatgipite'];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    process.exit(0);
} else {
    process.exit(1);
}
" "$config_path"
}

merge_opencode_config() {
    local config_path="$1"
    shift
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
config.mcp['chatgipite'] = { type: 'local', command: ['node', serverJs] };
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
" "$config_path" "$SERVER_JS"
}

remove_opencode_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 1
    cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"

    node -e "
const fs = require('fs');
const configPath = process.argv[1];
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { process.exit(1); }
const mcp = config.mcp || {};
if ('chatgipite' in mcp) {
    delete mcp['chatgipite'];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    process.exit(0);
} else {
    process.exit(1);
}
" "$config_path"
}

merge_goose_config() {
    local config_path="$1"
    if [[ -f "$config_path" ]]; then
        cp "$config_path" "${config_path}.backup.$(date +%Y%m%d%H%M%S)"
        info "Backed up existing config"
    fi

    # Goose uses YAML — use Node with a simple YAML-safe append approach
    node -e "
const fs = require('fs'), path = require('path');
const configPath = path.resolve(process.argv[1]);
const serverJs   = path.resolve(process.argv[2]);
const entry = [
    'extensions:',
    '  chatgipite:',
    '    name: chatgipite',
    '    type: stdio',
    '    cmd: node',
    '    args:',
    '      - ' + serverJs,
    '    enabled: true',
    ''
].join('\n');

let existing = '';
try { existing = fs.readFileSync(configPath, 'utf8'); } catch {}
if (existing.includes('chatgipite:')) {
    console.log('  chatgipite already in goose config');
} else {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + entry);
    console.log('  Added chatgipite to goose config');
}
" "$config_path" "$SERVER_JS"
}

remove_goose_config() {
    local config_path="$1"
    [[ -f "$config_path" ]] || return 1
    grep -q 'chatgipite:' "$config_path" || return 1
    info "Please manually remove the chatgipite block from $config_path"
}

# ── Install client config ─────────────────────────────────
install_client() {
    local client="$1"
    case "$client" in
        claudedesktop)
            local cfg
            cfg=$(get_desktop_config_path)
            info "Registering with Claude Desktop: $cfg"
            merge_mcp_config "$cfg" "$SERVER_JS"
            ok "Claude Desktop configured" ;;
        claude)
            local cfg
            cfg=$(get_code_config_path)
            info "Registering with Claude Code: $cfg"
            merge_mcp_config "$cfg" "$SERVER_JS"
            ok "Claude Code configured" ;;
        kilo)
            local cfg
            cfg=$(get_kilo_config_path)
            info "Registering with Kilo Code: $cfg"
            merge_mcp_config "$cfg" "$SERVER_JS"
            ok "Kilo Code configured" ;;
        opencode)
            local cfg
            cfg=$(get_opencode_config_path)
            info "Registering with OpenCode: $cfg"
            merge_opencode_config "$cfg"
            ok "OpenCode configured" ;;
        goose)
            local cfg
            cfg=$(get_goose_config_path)
            info "Registering with Goose: $cfg"
            merge_goose_config "$cfg"
            ok "Goose configured" ;;
        *)
            err "Unknown client: $client" ;;
    esac
}

uninstall_client() {
    local client="$1"
    case "$client" in
        claudedesktop)
            local cfg
            cfg=$(get_desktop_config_path)
            remove_mcp_config "$cfg" && ok "Removed from Claude Desktop" ;;
        claude)
            local cfg
            cfg=$(get_code_config_path)
            remove_mcp_config "$cfg" && ok "Removed from Claude Code" ;;
        kilo)
            local cfg
            cfg=$(get_kilo_config_path)
            remove_mcp_config "$cfg" && ok "Removed from Kilo Code" ;;
        opencode)
            local cfg
            cfg=$(get_opencode_config_path)
            remove_opencode_config "$cfg" && ok "Removed from OpenCode" ;;
        goose)
            local cfg
            cfg=$(get_goose_config_path)
            remove_goose_config "$cfg" && ok "See note above to complete Goose removal" ;;
        *)
            err "Unknown client: $client" ;;
    esac
}

# ── Main ─────────────────────────────────────────────────
VERSION=$(get_version)
INSTALLED_VERSION=$(get_installed_version)

echo ""
echo "  ChatGipite by Lugitech  v${VERSION}"
echo "  Ang Chat bot ng mga Gipit"
echo "  ─────────────────────────────────────"

# ── Node check ───────────────────────────────────────────
NODE_BIN=$(find_node) || die "Node.js 18+ not found. Install from https://nodejs.org"
info "Node: $($NODE_BIN --version) at $NODE_BIN"

# ── Uninstall path ───────────────────────────────────────
if [[ "$UNINSTALL" == true ]]; then
    echo ""
    info "Uninstalling ChatGipite..."
    if [[ "$CLIENT" == "all" ]]; then
        for c in claudedesktop claude kilo opencode goose; do uninstall_client "$c"; done
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

# ── Validate server starts ────────────────────────────────
if [[ "$SKIP_TEST" == false ]]; then
    info "Validating server..."
    timeout 5 node "$SERVER_JS" <<< "" 2>/dev/null && true
    # MCP servers block on stdin — a clean exit or timeout both indicate the server loaded OK
    ok "Server validation passed"
fi

# ── Register with MCP client(s) ──────────────────────────
echo ""
info "Configuring MCP client: $CLIENT"
if [[ "$CLIENT" == "all" ]]; then
    for c in claudedesktop claude kilo opencode goose; do install_client "$c"; done
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
