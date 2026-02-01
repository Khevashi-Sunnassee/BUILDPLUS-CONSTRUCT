# LTE Time Tracking - AutoCAD Add-in

## Overview
This AutoCAD add-in automatically captures time tracking data including:
- Active drawing file path
- Current layout name
- Panel marks and drawing codes
- Session duration and idle time

## Requirements
- Windows 10/11 (64-bit)
- AutoCAD 2022, 2023, 2024, or 2025
- .NET Framework 4.8
- Visual Studio 2019 or later (for building)

## Building

### Prerequisites
1. Install Visual Studio 2019 or later with ".NET desktop development" workload
2. Install AutoCAD (any supported version)
3. Set ACAD_SDK environment variable to your AutoCAD installation folder:
   ```
   set ACAD_SDK=C:\Program Files\Autodesk\AutoCAD 2024
   ```

### Build Steps
1. Open `LTETimeTracking.AutoCAD.csproj` in Visual Studio
2. Restore NuGet packages
3. Build in Release configuration
4. Output: `bin\Release\net48\LTETimeTracking.AutoCAD.dll`

## Installation

### Option 1: Bundle Installation (Recommended)
1. Create folder structure:
   ```
   LTETimeTracking.bundle\
     PackageContents.xml
     Contents\
       LTETimeTracking.AutoCAD.dll
       Newtonsoft.Json.dll
   ```

2. Copy the bundle to:
   `%APPDATA%\Autodesk\ApplicationPlugins\`

3. Restart AutoCAD

### Option 2: Manual NETLOAD
1. Start AutoCAD
2. Type `NETLOAD` at the command prompt
3. Browse to `LTETimeTracking.AutoCAD.dll`
4. Click Open

## Commands

| Command | Description |
|---------|-------------|
| `LTETRACK` | Show current tracking status |
| `LTESEND` | Force send current time block to agent |

## How It Works

1. The add-in loads automatically when AutoCAD starts
2. It monitors document and layout changes
3. Every minute, it captures:
   - Current drawing path and name
   - Active layout name
   - Panel marks (extracted from file/layout names)
   - Drawing codes (extracted from file names)
4. Data is sent to the Windows Agent via named pipe
5. The agent batches and uploads to the portal

## Troubleshooting

### Add-in not loading
- Try manual NETLOAD
- Check AutoCAD's APPLOAD command for loaded apps
- Verify bundle folder structure is correct

### "LTETRACK" command not found
- Ensure the DLL loaded successfully
- Check for errors in AutoCAD command line

### Data not appearing in portal
- Ensure the Windows Agent service is running
- Check agent logs at `C:\ProgramData\LTETimeTracking\logs\`

## Support
Contact: support@lte.com.au
