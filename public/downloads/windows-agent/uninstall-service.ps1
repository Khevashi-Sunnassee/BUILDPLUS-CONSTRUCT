# BuildPlus Ai Time Tracking Agent - Service Uninstall Script
# Run as Administrator

param(
    [string]$InstallPath = "C:\Program Files\BuildPlusTimeTracking",
    [string]$ServiceName = "BuildPlusTimeTracking",
    [switch]$KeepConfig
)

$ErrorActionPreference = "Stop"

Write-Host "BuildPlus Ai Time Tracking Agent - Service Uninstaller" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run this script as Administrator" -ForegroundColor Red
    exit 1
}

# Stop and remove service
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Stopping service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    Write-Host "Removing service..." -ForegroundColor Yellow
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "Service removed." -ForegroundColor Green
} else {
    Write-Host "Service not found." -ForegroundColor Yellow
}

# Remove installation directory
if (Test-Path $InstallPath) {
    Write-Host "Removing installation files..." -ForegroundColor Yellow
    Remove-Item -Path $InstallPath -Recurse -Force
    Write-Host "Installation files removed." -ForegroundColor Green
}

# Remove config (optional)
$configPath = "C:\ProgramData\BuildPlusTimeTracking"
if (-not $KeepConfig -and (Test-Path $configPath)) {
    Write-Host "Removing configuration and logs..." -ForegroundColor Yellow
    Remove-Item -Path $configPath -Recurse -Force
    Write-Host "Configuration removed." -ForegroundColor Green
} elseif ($KeepConfig) {
    Write-Host "Configuration kept at: $configPath" -ForegroundColor Yellow
}

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host "Uninstallation Complete!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
