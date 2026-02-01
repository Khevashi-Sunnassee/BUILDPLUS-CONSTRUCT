# LTE Time Tracking - Revit Add-in

## Overview
This Revit add-in automatically captures time tracking data including:
- Active document and file path
- Current view and sheet information
- Panel marks and drawing codes
- Session duration and idle time

## Requirements
- Windows 10/11 (64-bit)
- Autodesk Revit 2022, 2023, 2024, or 2025
- .NET Framework 4.8
- Visual Studio 2019 or later (for building)

## Building

### Prerequisites
1. Install Visual Studio 2019 or later with ".NET desktop development" workload
2. Install Revit (any supported version)
3. Set REVIT_SDK environment variable to your Revit installation folder:
   ```
   set REVIT_SDK=C:\Program Files\Autodesk\Revit 2024
   ```

### Build Steps
1. Open `LTETimeTracking.csproj` in Visual Studio
2. Restore NuGet packages
3. Build in Release configuration
4. Output: `bin\Release\net48\LTETimeTracking.Revit.dll`

## Installation

1. Copy these files to your Revit add-ins folder:
   - `LTETimeTracking.Revit.dll`
   - `LTETimeTracking.addin`
   - `Newtonsoft.Json.dll`

   Location: `%APPDATA%\Autodesk\Revit\Addins\2024\`
   (Replace "2024" with your Revit version)

2. Restart Revit

3. When prompted about loading add-ins, select "Always Load"

## How It Works

1. The add-in starts automatically when Revit launches
2. It monitors document and view changes
3. Every minute, it captures:
   - Current document path and name
   - Active view/sheet information
   - Panel marks (extracted from view/sheet names)
   - Drawing codes (extracted from file names)
4. Data is sent to the Windows Agent via named pipe
5. The agent batches and uploads to the portal

## Troubleshooting

### Add-in not loading
- Check that DLLs are in the correct add-ins folder
- Verify the .addin manifest file is present
- Check Revit's add-in manager (Add-Ins tab)

### Data not appearing in portal
- Ensure the Windows Agent service is running
- Check agent logs at `C:\ProgramData\LTETimeTracking\logs\`
- Verify network connectivity to the portal

## Support
Contact: support@lte.com.au
