# LTE Time Tracking Agent - Service Installation Script
# Run as Administrator

param(
    [string]$InstallPath = "C:\Program Files\LTETimeTracking",
    [string]$ServiceName = "LTETimeTracking"
)

$ErrorActionPreference = "Stop"

Write-Host "LTE Time Tracking Agent - Service Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run this script as Administrator" -ForegroundColor Red
    exit 1
}

# Create installation directory
Write-Host "`nCreating installation directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Copy files
Write-Host "Copying files..." -ForegroundColor Yellow
$sourcePath = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item "$sourcePath\LTETimeTracking.Agent.exe" -Destination $InstallPath -Force

# Create config directory
$configPath = "C:\ProgramData\LTETimeTracking"
if (-not (Test-Path $configPath)) {
    New-Item -ItemType Directory -Path $configPath -Force | Out-Null
}

# Create default config if not exists
$configFile = "$configPath\config.json"
if (-not (Test-Path $configFile)) {
    Write-Host "Creating default configuration file..." -ForegroundColor Yellow
    $defaultConfig = @{
        ServerUrl = "https://your-portal.replit.app"
        DeviceKey = ""
        UserEmail = ""
        Timezone = "Australia/Melbourne"
        UploadIntervalSeconds = 60
        MaxBatchSize = 50
    } | ConvertTo-Json -Depth 10
    $defaultConfig | Out-File $configFile -Encoding UTF8
}

# Check if service exists
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "Stopping existing service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force
    Start-Sleep -Seconds 2
    
    Write-Host "Removing existing service..." -ForegroundColor Yellow
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

# Create the service
Write-Host "Creating Windows service..." -ForegroundColor Yellow
$binaryPath = "$InstallPath\LTETimeTracking.Agent.exe"

New-Service -Name $ServiceName `
    -DisplayName "LTE Time Tracking Agent" `
    -Description "Uploads CAD/Revit time tracking data to the portal" `
    -BinaryPathName $binaryPath `
    -StartupType Automatic

# Start the service
Write-Host "Starting service..." -ForegroundColor Yellow
Start-Service -Name $ServiceName

# Verify
$service = Get-Service -Name $ServiceName
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "Service Status: $($service.Status)" -ForegroundColor Green
Write-Host "`nIMPORTANT: Configure the agent by editing:" -ForegroundColor Yellow
Write-Host "  $configFile" -ForegroundColor White
Write-Host "`nYou need to set:" -ForegroundColor Yellow
Write-Host "  - ServerUrl: Your portal URL" -ForegroundColor White
Write-Host "  - DeviceKey: Get from Admin > Devices" -ForegroundColor White
Write-Host "  - UserEmail: Your login email" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
