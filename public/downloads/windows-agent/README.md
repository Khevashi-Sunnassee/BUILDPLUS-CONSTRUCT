# LTE Time Tracking - Windows Agent

## Overview
The Windows Agent is a background service that:
- Receives time tracking data from Revit/AutoCAD add-ins via named pipe
- Batches and uploads data to the LTE Time Tracking portal
- Handles network failures with automatic retry
- Runs as a Windows service with automatic startup

## Requirements
- Windows 10/11 (64-bit)
- .NET 6.0 Runtime (or use self-contained build)

## Building

### Prerequisites
1. Install .NET 6.0 SDK or later
2. Visual Studio 2022 or VS Code with C# extension

### Build Steps
```bash
# Build for development
dotnet build

# Build self-contained executable
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true

# Output: bin\Release\net6.0-windows\win-x64\publish\LTETimeTracking.Agent.exe
```

## Installation

### As a Windows Service (Recommended)

1. Copy the published files to a permanent location:
   ```
   C:\Program Files\LTETimeTracking\
     LTETimeTracking.Agent.exe
   ```

2. Create the service using PowerShell (as Administrator):
   ```powershell
   New-Service -Name "LTETimeTracking" `
     -DisplayName "LTE Time Tracking Agent" `
     -Description "Uploads CAD/Revit time tracking data to the portal" `
     -BinaryPathName "C:\Program Files\LTETimeTracking\LTETimeTracking.Agent.exe" `
     -StartupType Automatic
   ```

3. Start the service:
   ```powershell
   Start-Service LTETimeTracking
   ```

### For Development/Testing

Run directly from command line:
```bash
dotnet run
```

Or run the compiled executable:
```bash
.\LTETimeTracking.Agent.exe
```

## Configuration

The agent reads configuration from:
`C:\ProgramData\LTETimeTracking\config.json`

Example config:
```json
{
  "ServerUrl": "https://your-portal.replit.app",
  "DeviceKey": "your-device-key-from-admin-panel",
  "UserEmail": "drafter@lte.com.au",
  "Timezone": "Australia/Melbourne",
  "UploadIntervalSeconds": 60,
  "MaxBatchSize": 50
}
```

### Configuration Fields

| Field | Description | Default |
|-------|-------------|---------|
| ServerUrl | Portal URL | (required) |
| DeviceKey | Device API key from admin | (required) |
| UserEmail | User's email for attribution | (required) |
| Timezone | IANA timezone identifier | Australia/Melbourne |
| UploadIntervalSeconds | How often to upload batches | 60 |
| MaxBatchSize | Max blocks per upload | 50 |

## Getting Your Device Key

1. Log into the portal as an Admin
2. Navigate to Admin > Devices
3. Click "Add Device"
4. Select your user account
5. Enter a device name (e.g., "WORKSTATION-01")
6. Copy the generated Device Key
7. Paste into config.json

**Important**: The device key is only shown once. Keep it secure.

## Logs

Logs are written to:
- Windows Event Log (source: LTETimeTracking)
- Console output (when running in console mode)

View logs:
```powershell
Get-EventLog -LogName Application -Source LTETimeTracking -Newest 50
```

## Architecture

```
┌─────────────────┐     Named Pipe      ┌─────────────────┐
│  Revit Add-in   │────────────────────▶│                 │
└─────────────────┘                     │                 │
                                        │  Windows Agent  │──────▶ Portal API
┌─────────────────┐     Named Pipe      │                 │
│ AutoCAD Add-in  │────────────────────▶│                 │
└─────────────────┘                     └─────────────────┘
```

## Troubleshooting

### Service won't start
- Check Windows Event Viewer for errors
- Verify config.json exists and is valid JSON
- Ensure the executable path is correct

### Data not appearing in portal
- Verify DeviceKey and ServerUrl in config
- Check network connectivity to the portal
- Look for upload errors in Event Log

### Add-ins not connecting
- Ensure agent service is running
- Check that named pipe "LTETimeTrackingPipe" exists:
  ```powershell
  [System.IO.Directory]::GetFiles("\\.\\pipe\\") | Select-String "LTE"
  ```

## Uninstalling

```powershell
# Stop and remove service
Stop-Service LTETimeTracking
sc.exe delete LTETimeTracking

# Remove files
Remove-Item -Recurse "C:\Program Files\LTETimeTracking"
Remove-Item -Recurse "C:\ProgramData\LTETimeTracking"
```

## Support
Contact: support@lte.com.au
