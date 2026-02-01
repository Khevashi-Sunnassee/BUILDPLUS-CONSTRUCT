@echo off
echo ============================================
echo LTE Time Tracking - Revit Add-in Builder
echo ============================================
echo.

REM Check for dotnet
where dotnet >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: .NET SDK not found. Please install .NET 6.0 SDK or later.
    pause
    exit /b 1
)

REM Check for REVIT_SDK environment variable
if "%REVIT_SDK%"=="" (
    echo WARNING: REVIT_SDK environment variable not set.
    echo Please set it to your Revit installation folder, e.g.:
    echo   set REVIT_SDK=C:\Program Files\Autodesk\Revit 2024
    echo.
    echo Attempting to find Revit installation...
    
    if exist "C:\Program Files\Autodesk\Revit 2025" (
        set REVIT_SDK=C:\Program Files\Autodesk\Revit 2025
    ) else if exist "C:\Program Files\Autodesk\Revit 2024" (
        set REVIT_SDK=C:\Program Files\Autodesk\Revit 2024
    ) else if exist "C:\Program Files\Autodesk\Revit 2023" (
        set REVIT_SDK=C:\Program Files\Autodesk\Revit 2023
    ) else if exist "C:\Program Files\Autodesk\Revit 2022" (
        set REVIT_SDK=C:\Program Files\Autodesk\Revit 2022
    ) else (
        echo ERROR: Could not find Revit installation.
        pause
        exit /b 1
    )
    echo Found Revit at: %REVIT_SDK%
)

echo.
echo Building Revit Add-in...
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
echo   bin\Release\net48\LTETimeTracking.Revit.dll
echo   bin\Release\net48\Newtonsoft.Json.dll
echo.
echo Copy these files along with LTETimeTracking.addin to:
echo   %%APPDATA%%\Autodesk\Revit\Addins\2024\
echo ============================================
pause
