@echo off
cd /d "%~dp0"
"src-tauri\target\release\vibe-account.exe" > ".tmp\explorer_run.log" 2>&1
echo EXITCODE=%ERRORLEVEL% >> ".tmp\explorer_run.log"
