@echo off
echo Starting AccountSystem Nginx Proxy...

REM Create logs directory
cd /d "%~dp0..\.."
if not exist "nginx\logs" mkdir "nginx\logs"

REM Go to nginx installation directory
cd /d "C:\tools\nginx-1.27.5"

REM Test configuration
echo Testing configuration...
nginx.exe -t -c "E:\My projects\AccountSystem\nginx\conf\nginx.conf"
if %ERRORLEVEL% neq 0 (
    echo ❌ Configuration test failed!
    pause
    exit /b 1
)

REM Start nginx
echo Starting nginx...
nginx.exe -c "E:\My projects\AccountSystem\nginx\conf\nginx.conf"

if %ERRORLEVEL% == 0 (
    echo ✅ Nginx started successfully!
    echo 🌐 Proxy running at http://localhost:7000
    echo.
    echo Routes:
    echo   /account          → localhost:3001
    echo   /api/v1/account   → localhost:3000  
    echo   /api/v1/todo      → localhost:5000
    echo   /                 → localhost:3002
) else (
    echo ❌ Failed to start nginx
)

pause