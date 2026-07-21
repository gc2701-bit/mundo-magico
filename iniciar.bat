@echo off
cd /d "%~dp0"
set PORT=8000

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js no esta instalado. Descargalo de https://nodejs.org
    pause
    exit /b 1
)

start "" http://localhost:%PORT%/index.html
node ".claude\static-server.js"
pause
