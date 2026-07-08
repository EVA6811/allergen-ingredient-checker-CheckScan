@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"
set "PROJECT_DIR=%~dp0"
set "NODE_VERSION=20.18.0"
set "LOCAL_TOOLS_DIR=%PROJECT_DIR%.tools"
set "LOCAL_NODE_DIR=%LOCAL_TOOLS_DIR%\node-v%NODE_VERSION%-win-x64"

echo.
echo ============================================
echo  CheckScan demo launcher
echo ============================================
echo.

if not exist ".env" (
  echo [SETUP] .env file was not found.
  echo         This file is not included in assignment submissions because it contains a private API key.
  echo.
  set /p "GEMINI_KEY=Enter Gemini API key now, or press Enter to create a template only: "
  if defined GEMINI_KEY (
    > ".env" echo VITE_GEMINI_API_KEY=!GEMINI_KEY!
    echo [OK] .env was created with the API key you entered.
  ) else (
    if exist ".env.example" (
      copy /Y ".env.example" ".env" >nul
    ) else (
      > ".env" echo VITE_GEMINI_API_KEY=your_gemini_api_key_here
    )
    echo [WARN] .env was created as a template.
    echo        Open .env and replace your_gemini_api_key_here with a real Gemini API key.
    start "" notepad ".env"
    echo.
    pause
  )
  echo.
)

call :ensure_node
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] node_modules was not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

set "SERVER_PIDS="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"127\.0\.0\.1:5173 .*LISTENING"') do (
  echo !SERVER_PIDS! | findstr /C:"%%P" >nul
  if errorlevel 1 set "SERVER_PIDS=!SERVER_PIDS! %%P"
)

if defined SERVER_PIDS (
  echo [WARN] A server is already running on http://127.0.0.1:5173.
  echo        PID:%SERVER_PIDS%
  echo.
  choice /C CR /N /M "Press C to cancel, or R to stop the existing server and restart: "
  if errorlevel 2 goto restart_existing_server
  if errorlevel 1 (
    echo.
    echo [INFO] Demo launch canceled. Existing server was left running.
    pause
    exit /b 0
  )
)

:start_server
echo [INFO] Starting Vite dev server...
start "CheckScan Dev Server" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%PROJECT_DIR%'; npm run dev -- --host 127.0.0.1"

echo [INFO] Opening browser...
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo.
echo Demo URL: http://127.0.0.1:5173
echo Close the "CheckScan Dev Server" command window after the demo.
echo.
pause
exit /b 0

:restart_existing_server
echo.
echo [INFO] Stopping existing server...
for %%P in (%SERVER_PIDS%) do (
  taskkill /PID %%P /T /F >nul 2>nul
)
timeout /t 2 /nobreak >nul
goto start_server

:ensure_node
where node >nul 2>nul
if not errorlevel 1 (
  where npm >nul 2>nul
  if not errorlevel 1 (
    for /f "tokens=*" %%V in ('node -v') do echo [OK] Node.js %%V detected.
    exit /b 0
  )
)

if exist "%LOCAL_NODE_DIR%\node.exe" (
  set "PATH=%LOCAL_NODE_DIR%;%PATH%"
  echo [OK] Using portable Node.js from .tools.
  exit /b 0
)

echo [SETUP] Node.js/npm was not found on this computer.
echo         Downloading portable Node.js v%NODE_VERSION% into .tools...
echo         This does not require administrator permissions.
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo [ERROR] PowerShell was not found, so Node.js cannot be installed automatically.
  echo         Install Node.js 20 or later manually, then run this file again.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $version='%NODE_VERSION%'; $tools=Join-Path (Get-Location) '.tools'; $zip=Join-Path $tools ('node-v' + $version + '-win-x64.zip'); $url='https://nodejs.org/dist/v' + $version + '/node-v' + $version + '-win-x64.zip'; New-Item -ItemType Directory -Force -Path $tools | Out-Null; Invoke-WebRequest -Uri $url -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath $tools -Force"
if errorlevel 1 (
  echo.
  echo [ERROR] Portable Node.js download or extraction failed.
  echo         Check the school network connection, firewall, or proxy settings.
  echo         If downloads are blocked, copy both .tools and node_modules from another computer, or install Node.js manually.
  exit /b 1
)

if exist "%LOCAL_NODE_DIR%\node.exe" (
  set "PATH=%LOCAL_NODE_DIR%;%PATH%"
  echo [OK] Portable Node.js is ready.
  exit /b 0
)

echo [ERROR] Portable Node.js was downloaded, but node.exe was not found.
exit /b 1
