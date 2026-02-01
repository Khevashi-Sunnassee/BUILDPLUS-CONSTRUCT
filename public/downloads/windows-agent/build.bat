@echo off
echo ============================================
echo LTE Time Tracking - Windows Agent Builder
echo ============================================
echo.

REM Check for dotnet
where dotnet >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: .NET SDK not found. Please install .NET 6.0 SDK or later.
    pause
    exit /b 1
)

echo Building Windows Agent...
echo.

dotnet restore
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to restore packages.
    pause
    exit /b 1
)

echo.
echo Publishing self-contained executable...
echo.

dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Publish failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Build successful!
echo.
echo Output file:
echo   bin\Release\net6.0-windows\win-x64\publish\LTETimeTracking.Agent.exe
echo.
echo To install as a Windows service:
echo   1. Copy the exe to C:\Program Files\LTETimeTracking\
echo   2. Run install-service.ps1 as Administrator
echo.
echo See README.md for detailed instructions.
echo ============================================
pause
