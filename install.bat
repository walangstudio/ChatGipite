@echo off
setlocal enabledelayedexpansion

rem ── Config ──────────────────────────────────────────────
set "MARKER_FILE=.chatgipite-installed"
set "APP_DIR=%~dp0"
if "!APP_DIR:~-1!"=="\" set "APP_DIR=!APP_DIR:~0,-1!"
set "SERVER_JS=!APP_DIR!\server.js"

rem ── Defaults ────────────────────────────────────────────
set "FORCE=false"
set "UNINSTALL=false"
set "UPDATE=false"
set "CLIENT=desktop"
set "SKIP_TEST=false"
set "GLOBAL_CONFIG=false"
set "CLIENT_EXPLICIT=false"

goto :parse_args

rem ════════════════════════════════════════════════════════
:show_help
echo Usage: install.bat [options]
echo.
echo Options:
echo   -c, --client TYPE   MCP client: desktop, code, kilo, opencode, goose, all (default: desktop)
echo   -f, --force         Skip prompts, overwrite existing config
echo   -u, --uninstall     Remove ChatGipite from MCP client config
echo       --upgrade       Re-run npm install and update MCP config paths
echo       --update        Alias for --upgrade
echo       --global        Write to global config path (applies to: code, opencode, all)
echo                       Default (no --global): writes to parent workspace dir
echo       --skip-test     Skip server validation
echo   -h, --help          Show this help
echo.
echo Examples:
echo   install.bat                      Install for Claude Desktop
echo   install.bat -c code              Install for Claude Code (workspace-local)
echo   install.bat -c code --global     Install for Claude Code (global config)
echo   install.bat -c kilo              Install for Kilo Code
echo   install.bat -c opencode          Install for OpenCode (workspace-local)
echo   install.bat -c opencode --global Install for OpenCode (global)
echo   install.bat -c goose             Install for Goose
echo   install.bat -c all               Install for all detected clients
echo   install.bat --upgrade            Reinstall + update config
echo   install.bat -u                   Uninstall
echo   install.bat -u -c all            Uninstall from all client configs
echo   install.bat -f --skip-test       Force install, skip tests
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

rem ── Validate --global ─────────────────────────────────
if "!GLOBAL_CONFIG!"=="true" (
    if not "!CLIENT!"=="code" (
        if not "!CLIENT!"=="opencode" (
            if not "!CLIENT!"=="all" (
                echo   ERROR: --global is only valid with -c code, opencode, or all >&2
                exit /b 1
            )
        )
    )
)

rem ── Read version ──────────────────────────────────────
set "VERSION=unknown"
set "_PY_VER=%TEMP%\chatgipite_ver.js"
echo try{const p=require('!APP_DIR!\package.json');process.stdout.write(p.version);}catch{process.stdout.write('unknown');} > "!_PY_VER!"
for /f "usebackq delims=" %%V in (`node "!_PY_VER!" 2^>nul`) do set "VERSION=%%V"
del /f /q "!_PY_VER!" 2>nul

rem ── Read installed version ────────────────────────────
set "INSTALLED_VERSION="
if exist "!APP_DIR!\!MARKER_FILE!" (
    set /p INSTALLED_VERSION=<"!APP_DIR!\!MARKER_FILE!"
)

rem ── Config paths ─────────────────────────────────────
set "DESKTOP_CONFIG=!APPDATA!\Claude\claude_desktop_config.json"

if "!GLOBAL_CONFIG!"=="true" (
    if exist "!USERPROFILE!\.claude\mcp.json" (
        set "CODE_CONFIG=!USERPROFILE!\.claude\mcp.json"
    ) else (
        set "CODE_CONFIG=!USERPROFILE!\.claude.json"
    )
) else (
    for %%I in ("!APP_DIR!") do set "_PARENT=%%~dpI"
    if "!_PARENT:~-1!"=="\" set "_PARENT=!_PARENT:~0,-1!"
    set "CODE_CONFIG=!_PARENT!\.mcp.json"
)

for %%I in ("!APP_DIR!") do set "_PARENT=%%~dpI"
if "!_PARENT:~-1!"=="\" set "_PARENT=!_PARENT:~0,-1!"
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

rem -- JS_MERGE --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE!"
echo const cfgPath=path.resolve(process.argv[1]), srvJs=path.resolve(process.argv[2]); >> "!JS_MERGE!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch{} >> "!JS_MERGE!"
echo cfg.mcpServers=cfg.mcpServers^|^|{}; >> "!JS_MERGE!"
echo cfg.mcpServers['chatgipite']={command:'node',args:[srvJs]}; >> "!JS_MERGE!"
echo fs.mkdirSync(path.dirname(cfgPath),{recursive:true}); >> "!JS_MERGE!"
echo fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n'); >> "!JS_MERGE!"

rem -- JS_REMOVE --
echo const fs=require('fs'); > "!JS_REMOVE!"
echo const cfgPath=process.argv[1]; >> "!JS_REMOVE!"
echo if(!fs.existsSync(cfgPath))process.exit(0); >> "!JS_REMOVE!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch{process.exit(0);} >> "!JS_REMOVE!"
echo const s=cfg.mcpServers^|^|{}; >> "!JS_REMOVE!"
echo if('chatgipite' in s){delete s['chatgipite'];fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n');console.log('  Removed chatgipite from config');}else{console.log('  chatgipite not found in config');} >> "!JS_REMOVE!"

rem -- JS_MERGE_OC --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE_OC!"
echo const cfgPath=path.resolve(process.argv[1]),srvJs=path.resolve(process.argv[2]); >> "!JS_MERGE_OC!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch{} >> "!JS_MERGE_OC!"
echo cfg.mcp=cfg.mcp^|^|{}; >> "!JS_MERGE_OC!"
echo cfg.mcp['chatgipite']={type:'local',command:['node',srvJs]}; >> "!JS_MERGE_OC!"
echo fs.mkdirSync(path.dirname(cfgPath),{recursive:true}); >> "!JS_MERGE_OC!"
echo fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n'); >> "!JS_MERGE_OC!"

rem -- JS_REMOVE_OC --
echo const fs=require('fs'); > "!JS_REMOVE_OC!"
echo const cfgPath=process.argv[1]; >> "!JS_REMOVE_OC!"
echo if(!fs.existsSync(cfgPath))process.exit(0); >> "!JS_REMOVE_OC!"
echo let cfg={}; try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch{process.exit(0);} >> "!JS_REMOVE_OC!"
echo const m=cfg.mcp^|^|{}; >> "!JS_REMOVE_OC!"
echo if('chatgipite' in m){delete m['chatgipite'];fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n');console.log('  Removed chatgipite from opencode config');}else{console.log('  chatgipite not found');} >> "!JS_REMOVE_OC!"

rem -- JS_MERGE_GS (Goose YAML append) --
echo const fs=require('fs'),path=require('path'); > "!JS_MERGE_GS!"
echo const cfgPath=path.resolve(process.argv[1]),srvJs=path.resolve(process.argv[2]); >> "!JS_MERGE_GS!"
echo const entry=['extensions:','  chatgipite:','    name: chatgipite','    type: stdio','    cmd: node','    args:','      - '+srvJs,'    enabled: true',''].join('\n'); >> "!JS_MERGE_GS!"
echo let existing=''; try{existing=fs.readFileSync(cfgPath,'utf8');}catch{} >> "!JS_MERGE_GS!"
echo if(existing.includes('chatgipite:')){console.log('  chatgipite already in goose config');}else{fs.mkdirSync(path.dirname(cfgPath),{recursive:true});fs.writeFileSync(cfgPath,existing+(existing^&^&!existing.endsWith('\n')?'\n':'')+entry);console.log('  Added chatgipite to goose config');} >> "!JS_MERGE_GS!"

rem ════════════════════════════════════════════════════════
echo.
echo   ChatGipite by Lugitech  v!VERSION!
echo   Ang Chat bot ng mga Gipit
echo   ─────────────────────────────────────

rem ── Node check ──────────────────────────────────────
set "NODE_BIN="
for %%N in (node nodejs) do (
    if "!NODE_BIN!"=="" (
        where %%N >nul 2>&1 && (
            for /f "usebackq delims=" %%V in (`%%N --version 2^>nul`) do (
                set "_NV=%%V"
                set "_NV=!_NV:v=!"
                for /f "tokens=1 delims=." %%M in ("!_NV!") do (
                    if %%M GEQ 18 set "NODE_BIN=%%N"
                )
            )
        )
    )
)
if "!NODE_BIN!"=="" (
    echo   ERROR: Node.js 18+ not found. Install from https://nodejs.org >&2
    exit /b 1
)
for /f "usebackq delims=" %%V in (`!NODE_BIN! --version 2^>nul`) do echo   Node: %%V

rem ── Uninstall path ──────────────────────────────────
if "!UNINSTALL!"=="true" (
    echo.
    echo   Uninstalling ChatGipite...
    if "!CLIENT!"=="all" (
        for %%C in (desktop code kilo opencode goose) do call :uninstall_client %%C
    ) else (
        call :uninstall_client !CLIENT!
    )
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
                echo.
                echo   Already installed v!INSTALLED_VERSION!. Use --upgrade to reinstall.
                goto :cleanup
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
    echo. | timeout /t 2 /nobreak >nul 2>&1
    echo   OK: Server validation passed
)

rem ── Register with MCP client(s) ──────────────────────
echo.
echo   Configuring MCP client: !CLIENT!
if "!CLIENT!"=="all" (
    for %%C in (desktop code kilo opencode goose) do call :install_client %%C
) else (
    call :install_client !CLIENT!
)

rem ── Write marker ─────────────────────────────────────
echo !VERSION!> "!APP_DIR!\!MARKER_FILE!"

echo.
echo   ─────────────────────────────────────
echo   OK: ChatGipite v!VERSION! installed.
echo.
echo   Next steps:
echo   1. Set ANTHROPIC_API_KEY in your environment or client config
echo   2. Restart your MCP client
echo   3. Call biz_full_run to validate your first idea
echo.
goto :cleanup

rem ════════════════════════════════════════════════════════
:install_client
set "_C=%~1"
if /i "!_C!"=="desktop" (
    echo   Registering with Claude Desktop: !DESKTOP_CONFIG!
    call :backup_config "!DESKTOP_CONFIG!"
    node "!JS_MERGE!" "!DESKTOP_CONFIG!" "!SERVER_JS!"
    echo   OK: Claude Desktop configured
    goto :eof
)
if /i "!_C!"=="code" (
    echo   Registering with Claude Code: !CODE_CONFIG!
    call :backup_config "!CODE_CONFIG!"
    node "!JS_MERGE!" "!CODE_CONFIG!" "!SERVER_JS!"
    echo   OK: Claude Code configured
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
echo   ERROR: Unknown client: !_C! >&2
goto :eof

rem ════════════════════════════════════════════════════════
:uninstall_client
set "_C=%~1"
if /i "!_C!"=="desktop" (
    echo   Removing from Claude Desktop
    node "!JS_REMOVE!" "!DESKTOP_CONFIG!" & goto :eof
)
if /i "!_C!"=="code" (
    echo   Removing from Claude Code
    node "!JS_REMOVE!" "!CODE_CONFIG!" & goto :eof
)
if /i "!_C!"=="kilo" (
    echo   Removing from Kilo Code
    node "!JS_REMOVE!" "!KILO_CONFIG!" & goto :eof
)
if /i "!_C!"=="opencode" (
    echo   Removing from OpenCode
    node "!JS_REMOVE_OC!" "!OPENCODE_CONFIG!" & goto :eof
)
if /i "!_C!"=="goose" (
    echo   Please manually remove the chatgipite block from !GOOSE_CONFIG!
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
:cleanup
for %%F in ("!JS_MERGE!" "!JS_REMOVE!" "!JS_MERGE_OC!" "!JS_REMOVE_OC!" "!JS_MERGE_GS!") do (
    del /f /q %%F 2>nul
)
endlocal
exit /b 0
