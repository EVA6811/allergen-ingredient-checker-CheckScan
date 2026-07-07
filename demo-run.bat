@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"
set "PROJECT_DIR=%~dp0"

echo.
echo ============================================
echo  CheckScan demo launcher
echo ============================================
echo.

if not exist ".env" (
  echo [WARN] .env file was not found.
  echo        Gemini API analysis may fail until VITE_GEMINI_API_KEY is configured.
  echo.
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
