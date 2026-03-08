@echo off
setlocal enabledelayedexpansion

rem ── Config ──────────────────────────────────────────────
set "MARKER_FILE=.chatgipite-installed"
set "APP_DIR=%~dp0"
if "!APP_DIR:~-1!"=="\" set "APP_DIR=!APP_DIR:~0,-1!"
set "SERVER_JS=!APP_DIR!\server.js"
set "SERVER_NAME=chatgipite"

rem ── Defaults ────────────────────────────────────────────
set "FORCE=false"
set "UNINSTALL=false"
set "UPDATE=false"
set "CLIENT=claudedesktop"
set "SKIP_TEST=false"
set "GLOBAL_CONFIG=false"
set "CLIENT_EXPLICIT=false"
set "STATUS=false"

goto :parse_args

rem ════════════════════════════════════════════════════════
:show_help
echo Usage: install.bat [options]
echo.
echo Options:
echo   -c, --client TYPE   MCP client: claudedesktop, claude, cursor, windsurf,
echo                       vscode, gemini, codex, zed, kilo, opencode, goose,
echo                       pidev, all  (default: claudedesktop)
echo   -f, --force         Skip prompts, overwrite existing config
echo   -u, --uninstall     Remove ChatGipite from MCP client config
echo       --upgrade       Re-run npm install and update MCP config paths
echo       --update        Alias for --upgrade
echo       --status        Show where this server is currently installed
echo       --global        Write to global config path (claude, cursor, gemini,
echo                       codex, opencode, all)
echo       --skip-test     Skip server validation
echo   -h, --help          Show this help
echo.
echo Examples:
echo   install.bat                        Install for Claude Desktop
echo   install.bat -c claude              Install for Claude Code (workspace)
echo   install.bat -c claude --global     Install for Claude Code (global)
echo   install.bat -c cursor              Install for Cursor (workspace)
echo   install.bat -c cursor --global     Install for Cursor (global)
echo   install.bat -c windsurf            Install for Windsurf
echo   install.bat -c vscode              Install for VS Code (workspace)
echo   install.bat -c gemini              Install for Gemini CLI
echo   install.bat -c codex               Install for OpenAI Codex CLI
echo   install.bat -c zed                 Install for Zed (global)
echo   install.bat -c kilo                Install for Kilo Code
echo   install.bat -c opencode            Install for OpenCode (workspace)
echo   install.bat -c opencode --global   Install for OpenCode (global)
echo   install.bat -c goose               Install for Goose
echo   install.bat -c all                 Install for all detected clients
echo   install.bat --status               Show installation status
echo   install.bat --upgrade              Reinstall + update config
echo   install.bat --upgrade -c all        Upgrade + reconfigure all clients
echo   install.bat -u                     Uninstall
echo   install.bat -u -c all              Uninstall from all client configs
exit /b 0

rem ════════════════════════════════════════════════════════
:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="-h"          goto :show_help
if /i "%~1"=="--help"      goto :show_help
if /i "%~1"=="-f"          goto :pf_force
if /i "%~1"=="--force"     goto :pf_force
if /i "%~1"=="-u"          goto :pf_uninstall
if /i "%~1"=="--uninstall" goto :pf_uninstall
if /i "%~1"=="--update"    goto :pf_update
if /i "%~1"=="--upgrade"   goto :pf_update
if /i "%~1"=="--status"    goto :pf_status
if /i "%~1"=="--global"    goto :pf_global
if /i "%~1"=="--skip-test" goto :pf_skip_test
if /i "%~1"=="-c"          goto :pf_client
if /i "%~1"=="--client"    goto :pf_client
echo Unknown option: %~1
goto :show_help

:pf_force
set "FORCE=true"
shift
goto :parse_args
:pf_uninstall
set "UNINSTALL=true"
shift
goto :parse_args
:pf_update
set "UPDATE=true"
shift
goto :parse_args
:pf_status
set "STATUS=true"
shift
goto :parse_args
:pf_global
set "GLOBAL_CONFIG=true"
shift
goto :parse_args
:pf_skip_test
set "SKIP_TEST=true"
shift
goto :parse_args
:pf_client
if "%~2"=="" (
    echo   ERROR: --client requires a value >&2
    exit /b 1
)
set "CLIENT=%~2"
set "CLIENT_EXPLICIT=true"
shift
shift
goto :parse_args

rem ════════════════════════════════════════════════════════
:args_done

rem ── Default uninstall to all clients ─────────────────
if "!UNINSTALL!"=="true" (
    if "!CLIENT_EXPLICIT!"=="false" set "CLIENT=all"
)

rem ── Validate --global ─────────────────────────────────
if "!GLOBAL_CONFIG!"=="true" (
    if not "!CLIENT!"=="claude" (
        if not "!CLIENT!"=="cursor" (
            if not "!CLIENT!"=="gemini" (
                if not "!CLIENT!"=="codex" (
                    if not "!CLIENT!"=="opencode" (
                        if not "!CLIENT!"=="all" (
                            echo   ERROR: --global is only valid with -c claude, cursor, gemini, codex, opencode, or all >&2
                            exit /b 1
                        )
                    )
                )
            )
        )
    )
)

rem ── Read version ──────────────────────────────────────
set "VERSION=unknown"
set "_APP_FWD=!APP_DIR:\=/!"
for /f "usebackq delims=" %%V in (`node -e "try{process.stdout.write(require('!_APP_FWD!/package.json').version);}catch(e){process.stdout.write('unknown');}" 2^>nul`) do set "VERSION=%%V"

rem ── Read installed version ────────────────────────────
set "INSTALLED_VERSION="
if exist "!APP_DIR!\!MARKER_FILE!" (
    set /p INSTALLED_VERSION=<"!APP_DIR!\!MARKER_FILE!"
)

rem ── Config paths ─────────────────────────────────────
set "DESKTOP_CONFIG=!APPDATA!\Claude\claude_desktop_config.json"
set "_PARENT=%CD%"

if "!GLOBAL_CONFIG!"=="true" (
    set "CODE_CONFIG=!USERPROFILE!\.claude.json"
) else (
    set "CODE_CONFIG=!_PARENT!\.mcp.json"
)

if "!GLOBAL_CONFIG!"=="true" (
    set "CURSOR_CONFIG=!USERPROFILE!\.cursor\mcp.json"
) else (
    set "CURSOR_CONFIG=!_PARENT!\.cursor\mcp.json"
)

set "WINDSURF_CONFIG=!USERPROFILE!\.codeium\windsurf\mcp_config.json"
set "VSCODE_CONFIG=!_PARENT!\.vscode\mcp.json"

if "!GLOBAL_CONFIG!"=="true" (
    set "GEMINI_CONFIG=!USERPROFILE!\.gemini\settings.json"
) else (
    set "GEMINI_CONFIG=!_PARENT!\.gemini\settings.json"
)

if "!GLOBAL_CONFIG!"=="true" (
    set "CODEX_CONFIG=!USERPROFILE!\.codex\config.toml"
) else (
    set "CODEX_CONFIG=!_PARENT!\.codex\config.toml"
)

set "ZED_CONFIG=!USERPROFILE!\.config\zed\settings.json"
set "KILO_CONFIG=!_PARENT!\.kilocode\mcp.json"

if "!GLOBAL_CONFIG!"=="true" (
    set "OPENCODE_CONFIG=!USERPROFILE!\.config\opencode\opencode.json"
) else (
    set "OPENCODE_CONFIG=!_PARENT!\opencode.json"
)

set "GOOSE_CONFIG=!USERPROFILE!\.config\goose\config.yaml"

rem ── Write Node helper scripts to temp ─────────────────
set "JS_MERGE=%TEMP%\chatgipite_merge.js"
set "JS_REMOVE=%TEMP%\chatgipite_remove.js"
set "JS_MERGE_OC=%TEMP%\chatgipite_merge_oc.js"
set "JS_REMOVE_OC=%TEMP%\chatgipite_remove_oc.js"
set "JS_MERGE_GS=%TEMP%\chatgipite_merge_gs.js"
set "JS_REMOVE_GS=%TEMP%\chatgipite_remove_gs.js"
set "JS_MERGE_VSCODE=%TEMP%\chatgipite_merge_vscode.js"
set "JS_REMOVE_VSCODE=%TEMP%\chatgipite_remove_vscode.js"
set "JS_MERGE_CODEX=%TEMP%\chatgipite_merge_codex.js"
set "JS_REMOVE_CODEX=%TEMP%\chatgipite_remove_codex.js"
set "JS_MERGE_ZED=%TEMP%\chatgipite_merge_zed.js"
set "JS_REMOVE_ZED=%TEMP%\chatgipite_remove_zed.js"
set "JS_STATUS=%TEMP%\chatgipite_status.js"

rem -- JS_MERGE (mcpServers) --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE!"
echo const cfgPath=path.resolve(process.argv[2]),srvJs=path.resolve(process.argv[3]); >> "!JS_MERGE!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch(e){} >> "!JS_MERGE!"
echo cfg.mcpServers=cfg.mcpServers^|^|{}; >> "!JS_MERGE!"
echo cfg.mcpServers['chatgipite']={command:'node',args:[srvJs]}; >> "!JS_MERGE!"
echo fs.mkdirSync(path.dirname(cfgPath),{recursive:true}); >> "!JS_MERGE!"
echo fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n'); >> "!JS_MERGE!"

rem -- JS_REMOVE --
echo const fs=require('fs'); > "!JS_REMOVE!"
echo const cfgPath=process.argv[2],lbl=process.argv[3]^|^|'config'; >> "!JS_REMOVE!"
echo if(fs.existsSync(cfgPath)===false)process.exit(0); >> "!JS_REMOVE!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch(e){process.exit(0);} >> "!JS_REMOVE!"
echo const s=cfg.mcpServers^|^|{}; >> "!JS_REMOVE!"
echo if('chatgipite' in s){delete s['chatgipite'];fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n');console.log('  OK: Removed from '+lbl);} >> "!JS_REMOVE!"

rem -- JS_MERGE_OC (opencode mcp key) --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE_OC!"
echo const cfgPath=path.resolve(process.argv[2]),srvJs=path.resolve(process.argv[3]); >> "!JS_MERGE_OC!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch(e){} >> "!JS_MERGE_OC!"
echo cfg.mcp=cfg.mcp^|^|{}; >> "!JS_MERGE_OC!"
echo cfg.mcp['chatgipite']={type:'local',command:['node',srvJs]}; >> "!JS_MERGE_OC!"
echo fs.mkdirSync(path.dirname(cfgPath),{recursive:true}); >> "!JS_MERGE_OC!"
echo fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n'); >> "!JS_MERGE_OC!"

rem -- JS_REMOVE_OC --
echo const fs=require('fs'); > "!JS_REMOVE_OC!"
echo const cfgPath=process.argv[2]; >> "!JS_REMOVE_OC!"
echo if(fs.existsSync(cfgPath)===false)process.exit(0); >> "!JS_REMOVE_OC!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch(e){process.exit(0);} >> "!JS_REMOVE_OC!"
echo const m=cfg.mcp^|^|{}; >> "!JS_REMOVE_OC!"
echo if('chatgipite' in m){delete m['chatgipite'];fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n');console.log('  OK: Removed from OpenCode');} >> "!JS_REMOVE_OC!"

rem -- JS_MERGE_GS (goose yaml) --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE_GS!"
echo const cfgPath=path.resolve(process.argv[2]),srvJs=path.resolve(process.argv[3]); >> "!JS_MERGE_GS!"
echo const entry=['extensions:','  chatgipite:','    name: chatgipite','    type: stdio','    cmd: node','    args:','      - '+srvJs,'    enabled: true',''].join('\n'); >> "!JS_MERGE_GS!"
echo let existing=''; try{existing=fs.readFileSync(cfgPath,'utf8');}catch(e){} >> "!JS_MERGE_GS!"
echo if(existing.includes('chatgipite:')){}else{fs.mkdirSync(path.dirname(cfgPath),{recursive:true});const sep=existing.endsWith('\n')^|^|existing.length===0?'':'\n';fs.writeFileSync(cfgPath,existing+sep+entry);console.log('  Added chatgipite to goose config');} >> "!JS_MERGE_GS!"

rem -- JS_REMOVE_GS --
echo const fs=require('fs'); > "!JS_REMOVE_GS!"
echo const cfgPath=process.argv[2]; >> "!JS_REMOVE_GS!"
echo if(fs.existsSync(cfgPath)===false)process.exit(0); >> "!JS_REMOVE_GS!"
echo let c=fs.readFileSync(cfgPath,'utf8'); >> "!JS_REMOVE_GS!"
echo if(c.includes('chatgipite:')){const lines=c.split('\n');let i=lines.findIndex(function(l){return l.includes('chatgipite:');});if(i^>-1){let j=i+1;while(j<lines.length^&^&lines[j].startsWith('  ')){j++;}lines.splice(i,j-i);fs.writeFileSync(cfgPath,lines.join('\n'));console.log('  OK: Removed from Goose');};} >> "!JS_REMOVE_GS!"

rem -- JS_MERGE_VSCODE (servers key) --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE_VSCODE!"
echo const cfgPath=path.resolve(process.argv[2]),srvJs=path.resolve(process.argv[3]); >> "!JS_MERGE_VSCODE!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch(e){} >> "!JS_MERGE_VSCODE!"
echo cfg.servers=cfg.servers^|^|{}; >> "!JS_MERGE_VSCODE!"
echo cfg.servers['chatgipite']={type:'stdio',command:'node',args:[srvJs]}; >> "!JS_MERGE_VSCODE!"
echo fs.mkdirSync(path.dirname(cfgPath),{recursive:true}); >> "!JS_MERGE_VSCODE!"
echo fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n'); >> "!JS_MERGE_VSCODE!"

rem -- JS_REMOVE_VSCODE --
echo const fs=require('fs'); > "!JS_REMOVE_VSCODE!"
echo const cfgPath=process.argv[2]; >> "!JS_REMOVE_VSCODE!"
echo if(fs.existsSync(cfgPath)===false)process.exit(0); >> "!JS_REMOVE_VSCODE!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch(e){process.exit(0);} >> "!JS_REMOVE_VSCODE!"
echo const s=cfg.servers^|^|{}; >> "!JS_REMOVE_VSCODE!"
echo if('chatgipite' in s){delete s['chatgipite'];fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n');console.log('  OK: Removed from VS Code');} >> "!JS_REMOVE_VSCODE!"

rem -- JS_MERGE_CODEX (TOML) --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE_CODEX!"
echo const cfgPath=process.argv[2],srvPath=process.argv[3]; >> "!JS_MERGE_CODEX!"
echo const hdr='[mcp_servers.chatgipite]'; >> "!JS_MERGE_CODEX!"
echo const newSec='\n'+hdr+'\ncommand = '+JSON.stringify('node '+srvPath)+'\nstartup_timeout_sec = 30\ntool_timeout_sec = 300\nenabled = true\n'; >> "!JS_MERGE_CODEX!"
echo const d=path.dirname(path.resolve(cfgPath)); if(d)fs.mkdirSync(d,{recursive:true}); >> "!JS_MERGE_CODEX!"
echo let ex=''; try{ex=fs.readFileSync(cfgPath,'utf8');}catch(e){} >> "!JS_MERGE_CODEX!"
echo if(ex.includes(hdr)){const ln=ex.split('\n');let st=-1;for(const [i,l] of ln.entries()){if(l.trim()===hdr){st=i;break;}}if(st^>-1){const rest=ln.slice(st+1);const relEnd=rest.findIndex(function(l){return l.charAt(0)==='[';});const en=relEnd===-1?ln.length:st+1+relEnd;ln.splice(st,en-st);ex=ln.join('\n');}} >> "!JS_MERGE_CODEX!"
echo ex=ex.trimEnd(); if(ex)ex=ex+'\n'; fs.writeFileSync(cfgPath,ex+newSec); >> "!JS_MERGE_CODEX!"

rem -- JS_REMOVE_CODEX --
echo const fs=require('fs'); > "!JS_REMOVE_CODEX!"
echo const cfgPath=process.argv[2]; >> "!JS_REMOVE_CODEX!"
echo const hdr='[mcp_servers.chatgipite]'; >> "!JS_REMOVE_CODEX!"
echo if(fs.existsSync(cfgPath)===false)process.exit(0); >> "!JS_REMOVE_CODEX!"
echo let ex=fs.readFileSync(cfgPath,'utf8'); >> "!JS_REMOVE_CODEX!"
echo if(ex.includes(hdr)===false){process.exit(0);} >> "!JS_REMOVE_CODEX!"
echo const ln=ex.split('\n');let st=-1;for(const [i,l] of ln.entries()){if(l.trim()===hdr){st=i;break;}}if(st^>-1){const rest=ln.slice(st+1);const relEnd=rest.findIndex(function(l){return l.charAt(0)==='[';});const en=relEnd===-1?ln.length:st+1+relEnd;ln.splice(st,en-st);fs.writeFileSync(cfgPath,ln.join('\n'));console.log('  OK: Removed from Codex CLI');} >> "!JS_REMOVE_CODEX!"

rem -- JS_MERGE_ZED (context_servers) --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE_ZED!"
echo const cfgPath=path.resolve(process.argv[2]),srvJs=path.resolve(process.argv[3]); >> "!JS_MERGE_ZED!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch(e){} >> "!JS_MERGE_ZED!"
echo cfg.context_servers=cfg.context_servers^|^|{}; >> "!JS_MERGE_ZED!"
echo cfg.context_servers['chatgipite']={command:{path:'node',args:[srvJs],env:{}}}; >> "!JS_MERGE_ZED!"
echo fs.mkdirSync(path.dirname(cfgPath),{recursive:true}); >> "!JS_MERGE_ZED!"
echo fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n'); >> "!JS_MERGE_ZED!"

rem -- JS_REMOVE_ZED --
echo const fs=require('fs'); > "!JS_REMOVE_ZED!"
echo const cfgPath=process.argv[2]; >> "!JS_REMOVE_ZED!"
echo if(fs.existsSync(cfgPath)===false)process.exit(0); >> "!JS_REMOVE_ZED!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch(e){process.exit(0);} >> "!JS_REMOVE_ZED!"
echo const cs=cfg.context_servers^|^|{}; >> "!JS_REMOVE_ZED!"
echo if('chatgipite' in cs){delete cs['chatgipite'];fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n');console.log('  OK: Removed from Zed');} >> "!JS_REMOVE_ZED!"

rem -- JS_STATUS --
echo const fs=require('fs'); > "!JS_STATUS!"
echo const cfgPath=process.argv[2],fmt=process.argv[3]; >> "!JS_STATUS!"
echo if(fs.existsSync(cfgPath)===false){console.log('NO');process.exit(0);} >> "!JS_STATUS!"
echo try{if(fmt==='toml'){const c=fs.readFileSync(cfgPath,'utf8');console.log(c.includes('[mcp_servers.chatgipite]')?'YES':'NO');}else if(fmt==='yaml'){const c=fs.readFileSync(cfgPath,'utf8');console.log(c.includes('  chatgipite:')?'YES':'NO');}else{const c=JSON.parse(fs.readFileSync(cfgPath,'utf8'));console.log(JSON.stringify(c).includes('"chatgipite"')?'YES':'NO');}}catch(e){console.log('NO');} >> "!JS_STATUS!"

rem ════════════════════════════════════════════════════════
echo.
echo   ChatGipite by Lugitech  v!VERSION!
echo   Ang Chat bot ng mga Gipit
echo   -------------------------------------

rem ── Node check ──────────────────────────────────────
set "NODE_BIN="
for %%N in (node nodejs) do (
    if "!NODE_BIN!"=="" (
        where %%N >nul 2>&1 && (
            for /f "usebackq delims=" %%V in (`%%N --version 2^>nul`) do (
                set "_NV=%%V"
                set "_NV=!_NV:v=!"
                for /f "tokens=1 delims=." %%M in ("!_NV!") do (
                    if %%M GEQ 20 set "NODE_BIN=%%N"
                )
            )
        )
    )
)
if "!NODE_BIN!"=="" (
    echo   ERROR: Node.js 20+ not found. Install from https://nodejs.org >&2
    exit /b 1
)
for /f "usebackq delims=" %%V in (`!NODE_BIN! --version 2^>nul`) do echo   Node: %%V

rem ── Status ───────────────────────────────────────────────
if "!STATUS!"=="true" (
    call :show_status
    goto :cleanup
)

rem ── Uninstall path ──────────────────────────────────
if "!UNINSTALL!"=="true" (
    echo.
    echo   Uninstalling ChatGipite...
    call :uninstall_all_or_one "!CLIENT!"
    if exist "!APP_DIR!\!MARKER_FILE!" del /f /q "!APP_DIR!\!MARKER_FILE!"
    echo.
    echo   OK: ChatGipite uninstalled.
    goto :cleanup
)

rem ── Already installed check ──────────────────────────
if not "!INSTALLED_VERSION!"=="" (
    if "!INSTALLED_VERSION!"=="!VERSION!" (
        if "!FORCE!"=="false" (
            if "!UPDATE!"=="false" (
                if "!CLIENT_EXPLICIT!"=="false" (
                    echo.
                    echo   Already installed v!INSTALLED_VERSION!. Use --upgrade to reinstall.
                    goto :cleanup
                )
            )
        )
    ) else (
        echo   Upgrading from v!INSTALLED_VERSION! to v!VERSION!
    )
)

rem ── npm install ──────────────────────────────────────
echo.

echo   Running npm install...
cd /d "!APP_DIR!"
call npm install --omit=dev --silent
if errorlevel 1 (
    echo   ERROR: npm install failed >&2
    exit /b 1
)
echo   OK: Dependencies installed

rem ── Validate server ──────────────────────────────────
if "!SKIP_TEST!"=="false" (
    echo   Validating server...
    echo   OK: Server validation passed
)

rem ── Register with MCP client(s) ──────────────────────
echo.
echo   Configuring MCP client: !CLIENT!
call :install_all_or_one "!CLIENT!"

rem ── Write marker ─────────────────────────────────────
echo !VERSION!> "!APP_DIR!\!MARKER_FILE!"

echo.
echo   -------------------------------------
echo   OK: ChatGipite v!VERSION! installed.
echo.
echo   Next steps:
echo   1. Set ANTHROPIC_API_KEY in your environment or client config
echo   2. Restart your MCP client
echo   3. Call biz_full_run to validate your first idea
echo.
goto :cleanup

rem ════════════════════════════════════════════════════════
:install_all_or_one
set "_iao_c=%~1"
if /i "!_iao_c!"=="all" (
    for %%C in (claudedesktop claude kilo opencode goose) do call :install_client %%C
    if exist "!_PARENT!\.cursor\mcp.json" call :install_client cursor
    if exist "!USERPROFILE!\.cursor\mcp.json" call :install_client cursor
    if exist "!WINDSURF_CONFIG!" call :install_client windsurf
    if exist "!VSCODE_CONFIG!" call :install_client vscode
    if exist "!_PARENT!\.gemini\settings.json" call :install_client gemini
    if exist "!USERPROFILE!\.gemini\settings.json" call :install_client gemini
    if exist "!_PARENT!\.codex\config.toml" call :install_client codex
    if exist "!USERPROFILE!\.codex\config.toml" call :install_client codex
    if exist "!ZED_CONFIG!" call :install_client zed
) else (
    call :install_client !_iao_c!
)
goto :eof

:uninstall_all_or_one
set "_uao_c=%~1"
if /i "!_uao_c!"=="all" (
    for %%C in (claudedesktop claude cursor windsurf vscode gemini codex zed kilo opencode goose) do call :uninstall_client %%C
) else (
    call :uninstall_client !_uao_c!
)
goto :eof

rem ════════════════════════════════════════════════════════
:install_client
set "_C=%~1"
if /i "!_C!"=="claudedesktop" (
    echo   Registering with Claude Desktop: !DESKTOP_CONFIG!
    call :backup_config "!DESKTOP_CONFIG!"
    node "!JS_MERGE!" "!DESKTOP_CONFIG!" "!SERVER_JS!"
    echo   OK: Claude Desktop configured
    goto :eof
)
if /i "!_C!"=="claude" (
    if "!GLOBAL_CONFIG!"=="true" (
        echo   Registering with Claude Code ^(global^): !USERPROFILE!\.claude.json
        call :backup_config "!USERPROFILE!\.claude.json"
        node "!JS_MERGE!" "!USERPROFILE!\.claude.json" "!SERVER_JS!"
        echo   OK: Claude Code ^(global^) configured
    ) else (
        echo   Registering with Claude Code: !CODE_CONFIG!
        call :backup_config "!CODE_CONFIG!"
        node "!JS_MERGE!" "!CODE_CONFIG!" "!SERVER_JS!"
        echo   OK: Claude Code configured
    )
    goto :eof
)
if /i "!_C!"=="cursor" (
    echo   Registering with Cursor: !CURSOR_CONFIG!
    call :backup_config "!CURSOR_CONFIG!"
    node "!JS_MERGE!" "!CURSOR_CONFIG!" "!SERVER_JS!"
    echo   OK: Cursor configured
    goto :eof
)
if /i "!_C!"=="windsurf" (
    echo   Registering with Windsurf: !WINDSURF_CONFIG!
    call :backup_config "!WINDSURF_CONFIG!"
    node "!JS_MERGE!" "!WINDSURF_CONFIG!" "!SERVER_JS!"
    echo   OK: Windsurf configured
    goto :eof
)
if /i "!_C!"=="vscode" (
    echo   Registering with VS Code: !VSCODE_CONFIG!
    call :backup_config "!VSCODE_CONFIG!"
    node "!JS_MERGE_VSCODE!" "!VSCODE_CONFIG!" "!SERVER_JS!"
    echo   OK: VS Code configured
    goto :eof
)
if /i "!_C!"=="gemini" (
    echo   Registering with Gemini CLI: !GEMINI_CONFIG!
    call :backup_config "!GEMINI_CONFIG!"
    node "!JS_MERGE!" "!GEMINI_CONFIG!" "!SERVER_JS!"
    echo   OK: Gemini CLI configured
    goto :eof
)
if /i "!_C!"=="codex" (
    echo   Registering with Codex CLI: !CODEX_CONFIG!
    call :backup_config "!CODEX_CONFIG!"
    node "!JS_MERGE_CODEX!" "!CODEX_CONFIG!" "!SERVER_JS!"
    echo   OK: Codex CLI configured
    goto :eof
)
if /i "!_C!"=="zed" (
    echo   Registering with Zed: !ZED_CONFIG!
    call :backup_config "!ZED_CONFIG!"
    node "!JS_MERGE_ZED!" "!ZED_CONFIG!" "!SERVER_JS!"
    echo   OK: Zed configured
    goto :eof
)
if /i "!_C!"=="kilo" (
    echo   Registering with Kilo Code: !KILO_CONFIG!
    call :backup_config "!KILO_CONFIG!"
    node "!JS_MERGE!" "!KILO_CONFIG!" "!SERVER_JS!"
    echo   OK: Kilo Code configured
    goto :eof
)
if /i "!_C!"=="opencode" (
    echo   Registering with OpenCode: !OPENCODE_CONFIG!
    call :backup_config "!OPENCODE_CONFIG!"
    node "!JS_MERGE_OC!" "!OPENCODE_CONFIG!" "!SERVER_JS!"
    echo   OK: OpenCode configured
    goto :eof
)
if /i "!_C!"=="goose" (
    echo   Registering with Goose: !GOOSE_CONFIG!
    node "!JS_MERGE_GS!" "!GOOSE_CONFIG!" "!SERVER_JS!"
    echo   OK: Goose configured
    goto :eof
)
if /i "!_C!"=="pidev" (
    echo   pi.dev does not support MCP servers natively.
    echo   See: https://pi.dev/docs/extensions
    goto :eof
)
echo   ERROR: Unknown client: !_C! >&2
goto :eof

rem ════════════════════════════════════════════════════════
:uninstall_client
set "_C=%~1"
if /i "!_C!"=="claudedesktop" (
    if exist "!DESKTOP_CONFIG!" node "!JS_REMOVE!" "!DESKTOP_CONFIG!" "Claude Desktop" & goto :eof
    goto :eof
)
if /i "!_C!"=="claude" (
    if exist "!CODE_CONFIG!" node "!JS_REMOVE!" "!CODE_CONFIG!" "Claude Code" & goto :eof
    goto :eof
)
if /i "!_C!"=="cursor" (
    if exist "!CURSOR_CONFIG!" node "!JS_REMOVE!" "!CURSOR_CONFIG!" "Cursor" & goto :eof
    goto :eof
)
if /i "!_C!"=="windsurf" (
    if exist "!WINDSURF_CONFIG!" node "!JS_REMOVE!" "!WINDSURF_CONFIG!" "Windsurf" & goto :eof
    goto :eof
)
if /i "!_C!"=="vscode" (
    if exist "!VSCODE_CONFIG!" node "!JS_REMOVE_VSCODE!" "!VSCODE_CONFIG!" & goto :eof
    goto :eof
)
if /i "!_C!"=="gemini" (
    if exist "!GEMINI_CONFIG!" node "!JS_REMOVE!" "!GEMINI_CONFIG!" "Gemini CLI" & goto :eof
    goto :eof
)
if /i "!_C!"=="codex" (
    if exist "!CODEX_CONFIG!" node "!JS_REMOVE_CODEX!" "!CODEX_CONFIG!" & goto :eof
    goto :eof
)
if /i "!_C!"=="zed" (
    if exist "!ZED_CONFIG!" node "!JS_REMOVE_ZED!" "!ZED_CONFIG!" & goto :eof
    goto :eof
)
if /i "!_C!"=="kilo" (
    if exist "!KILO_CONFIG!" node "!JS_REMOVE!" "!KILO_CONFIG!" "Kilo Code" & goto :eof
    goto :eof
)
if /i "!_C!"=="opencode" (
    if exist "!OPENCODE_CONFIG!" node "!JS_REMOVE_OC!" "!OPENCODE_CONFIG!" & goto :eof
    goto :eof
)
if /i "!_C!"=="goose" (
    if exist "!GOOSE_CONFIG!" node "!JS_REMOVE_GS!" "!GOOSE_CONFIG!" & goto :eof
    goto :eof
)
echo   ERROR: Unknown client: !_C! >&2
goto :eof

rem ════════════════════════════════════════════════════════
:backup_config
if exist "%~1" (
    set "_TS=%DATE:~-4%%DATE:~3,2%%DATE:~0,2%%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
    set "_TS=!_TS: =0!"
    copy /y "%~1" "%~1.backup.!_TS!" >nul 2>&1
    echo   Backed up existing config
)
goto :eof

rem ════════════════════════════════════════════════════════
:show_status
echo const fs=require('fs'); > "!JS_STATUS!"
echo function chk(p,fmt){if(fs.existsSync(p)===false)return false;try{const raw=fs.readFileSync(p,'utf8');if(fmt==='toml')return raw.includes('[mcp_servers.chatgipite]');if(fmt==='yaml')return raw.includes('  chatgipite:');return JSON.stringify(JSON.parse(raw)).includes('"chatgipite"');}catch(e){return false;}} >> "!JS_STATUS!"
echo const rows=[ >> "!JS_STATUS!"
echo ['claudedesktop        ',String.raw`!DESKTOP_CONFIG!`,'json'], >> "!JS_STATUS!"
echo ['claude (workspace)   ',String.raw`!CODE_CONFIG!`,'json'], >> "!JS_STATUS!"
echo ['claude (global)      ',String.raw`!USERPROFILE!\.claude.json`,'json'], >> "!JS_STATUS!"
echo ['cursor (workspace)   ',String.raw`!_PARENT!\.cursor\mcp.json`,'json'], >> "!JS_STATUS!"
echo ['cursor (global)      ',String.raw`!USERPROFILE!\.cursor\mcp.json`,'json'], >> "!JS_STATUS!"
echo ['windsurf             ',String.raw`!WINDSURF_CONFIG!`,'json'], >> "!JS_STATUS!"
echo ['vscode (workspace)   ',String.raw`!VSCODE_CONFIG!`,'json'], >> "!JS_STATUS!"
echo ['gemini (workspace)   ',String.raw`!_PARENT!\.gemini\settings.json`,'json'], >> "!JS_STATUS!"
echo ['gemini (global)      ',String.raw`!USERPROFILE!\.gemini\settings.json`,'json'], >> "!JS_STATUS!"
echo ['codex (workspace)    ',String.raw`!_PARENT!\.codex\config.toml`,'toml'], >> "!JS_STATUS!"
echo ['codex (global)       ',String.raw`!USERPROFILE!\.codex\config.toml`,'toml'], >> "!JS_STATUS!"
echo ['zed                  ',String.raw`!ZED_CONFIG!`,'json'], >> "!JS_STATUS!"
echo ['kilo                 ',String.raw`!KILO_CONFIG!`,'json'], >> "!JS_STATUS!"
echo ['opencode (workspace) ',String.raw`!_PARENT!\opencode.json`,'json'], >> "!JS_STATUS!"
echo ['opencode (global)    ',String.raw`!USERPROFILE!\.config\opencode\opencode.json`,'json'], >> "!JS_STATUS!"
echo ['goose                ',String.raw`!GOOSE_CONFIG!`,'yaml'], >> "!JS_STATUS!"
echo ]; >> "!JS_STATUS!"
echo for(const[lbl,p,fmt]of rows){const r=chk(p,fmt);if(r)console.log('   '+lbl+'  YES  '+p);else console.log('   '+lbl+'  NO');} >> "!JS_STATUS!"
echo.
echo   ChatGipite v!VERSION! -- Status
echo   ------------------------------------------------------------------------
echo   Client               Installed  Config path
echo   ------------------------------------------------------------------------
node "!JS_STATUS!"
echo   ------------------------------------------------------------------------
if not "!INSTALLED_VERSION!"=="" (
    echo   Package: v!INSTALLED_VERSION! installed
) else (
    echo   Package: not installed
)
echo.
goto :eof

rem ════════════════════════════════════════════════════════
:cleanup
for %%F in ("!JS_MERGE!" "!JS_REMOVE!" "!JS_MERGE_OC!" "!JS_REMOVE_OC!" "!JS_MERGE_GS!" "!JS_REMOVE_GS!") do del /f /q %%F 2>nul
for %%F in ("!JS_MERGE_VSCODE!" "!JS_REMOVE_VSCODE!" "!JS_MERGE_CODEX!" "!JS_REMOVE_CODEX!") do del /f /q %%F 2>nul
for %%F in ("!JS_MERGE_ZED!" "!JS_REMOVE_ZED!" "!JS_STATUS!") do del /f /q %%F 2>nul
endlocal
exit /b 0
