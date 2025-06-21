@echo off
echo ========================================
echo   AccountSystem Nginx Proxy Stopping
echo ========================================

REM Get the project root directory  
cd /d "%~dp0..\.."

REM Stop nginx gracefully
echo Stopping nginx gracefully...
nginx -s quit -c "%cd%\nginx\conf\nginx.conf"

REM Wait a moment
timeout /t 3 /nobreak > nul

REM Check if nginx is still running
tasklist /FI "IMAGENAME eq nginx.exe" 2>NUL | find /I /N "nginx.exe" > nul
if %ERRORLEVEL% == 0 (
    echo Nginx still running, force stopping...
    taskkill /F /IM nginx.exe > nul 2>&1
    timeout /t 1 /nobreak > nul
)

REM Final check
tasklist /FI "IMAGENAME eq nginx.exe" 2>NUL | find /I /N "nginx.exe" > nul
if %ERRORLEVEL% == 0 (
    echo ❌ Failed to stop nginx completely
) else (
    echo ✅ Nginx stopped successfully!
    echo AccountSystem proxy is now offline
)

echo.
pause