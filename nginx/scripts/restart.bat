@echo off
echo ========================================
echo  AccountSystem Nginx Proxy Restarting
echo ========================================

REM Get the project root directory
cd /d "%~dp0..\.."

echo 🔄 Restarting nginx...

REM Test configuration first
echo Testing configuration...
nginx -t -c "%cd%\nginx\conf\nginx.conf"
if %ERRORLEVEL% neq 0 (
    echo ❌ Configuration test failed! Not restarting.
    pause
    exit /b 1
)

REM Try graceful reload first
echo Attempting graceful reload...
nginx -s reload -c "%cd%\nginx\conf\nginx.conf" 2>nul
if %ERRORLEVEL% == 0 (
    echo ✅ Configuration reloaded successfully!
    echo 🌐 AccountSystem Proxy running at http://localhost:7000
    pause
    exit /b 0
)

REM If reload failed, do full restart
echo Graceful reload failed, performing full restart...

REM Stop nginx
call "%~dp0stop.bat"

REM Wait a moment
timeout /t 2 /nobreak > nul

REM Start nginx
call "%~dp0start.bat"