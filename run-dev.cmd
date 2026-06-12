@echo off
setlocal

set "ROOT=%~dp0"
set "NODE_DIR=%ROOT%.tools\node-v26.3.0-win-x64"
set "PNPM_CMD=%LOCALAPPDATA%\pnpm\pnpm.CMD"

if not exist "%NODE_DIR%\node.exe" (
  echo Local Node runtime was not found in "%NODE_DIR%".
  exit /b 1
)

if not exist "%PNPM_CMD%" (
  echo pnpm was not found at "%PNPM_CMD%".
  echo Re-run the local setup from Codex or install pnpm first.
  exit /b 1
)

set "PATH=%NODE_DIR%;%PATH%"
call "%PNPM_CMD%" dev

