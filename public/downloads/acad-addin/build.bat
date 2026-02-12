@echo off
echo ============================================
echo BuildPlus Ai Time Tracking - AutoCAD Add-in Builder
echo ============================================
echo.

REM Check for dotnet
where dotnet >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: .NET SDK not found. Please install .NET 6.0 SDK or later.
    pause
    exit /b 1
)

REM Check for ACAD_SDK environment variable
if "%ACAD_SDK%"=="" (
    echo WARNING: ACAD_SDK environment variable not set.
    echo Please set it to your AutoCAD installation folder, e.g.:
    echo   set ACAD_SDK=C:\Program Files\Autodesk\AutoCAD 2024
    echo.
    echo Attempting to find AutoCAD installation...
    
    if exist "C:\Program Files\Autodesk\AutoCAD 2025" (
        set ACAD_SDK=C:\Program Files\Autodesk\AutoCAD 2025
    ) else if exist "C:\Program Files\Autodesk\AutoCAD 2024" (
        set ACAD_SDK=C:\Program Files\Autodesk\AutoCAD 2024
    ) else if exist "C:\Program Files\Autodesk\AutoCAD 2023" (
        set ACAD_SDK=C:\Program Files\Autodesk\AutoCAD 2023
    ) else if exist "C:\Program Files\Autodesk\AutoCAD 2022" (
        set ACAD_SDK=C:\Program Files\Autodesk\AutoCAD 2022
    ) else (
        echo ERROR: Could not find AutoCAD installation.
        pause
        exit /b 1
    )
    echo Found AutoCAD at: %ACAD_SDK%
)

echo.
echo Building AutoCAD Add-in...
echo.

dotnet restore
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to restore packages.
    pause
    exit /b 1
)

dotnet build -c Release
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Build successful!
echo.
echo Output files:
echo   bin\Release\net48\BuildPlusTimeTracking.AutoCAD.dll
echo   bin\Release\net48\Newtonsoft.Json.dll
echo.
echo Installation options:
echo   1. Bundle: Create BuildPlusTimeTracking.bundle folder
echo   2. NETLOAD: Use NETLOAD command in AutoCAD
echo.
echo See README.md for detailed instructions.
echo ============================================
pause
