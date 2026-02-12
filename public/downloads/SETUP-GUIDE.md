# BuildPlus Ai Time Tracking - Complete Setup Guide for Beginners

This guide will walk you through setting up the BuildPlus Ai Time Tracking system step-by-step. No prior experience required!

---

## Table of Contents
1. [Prerequisites - What You Need First](#1-prerequisites---what-you-need-first)
2. [Installing Visual Studio](#2-installing-visual-studio)
3. [Building the Windows Agent](#3-building-the-windows-agent)
4. [Installing the Windows Agent](#4-installing-the-windows-agent)
5. [Building the Revit Add-in](#5-building-the-revit-add-in)
6. [Installing the Revit Add-in](#6-installing-the-revit-add-in)
7. [Building the AutoCAD Add-in](#7-building-the-autocad-add-in)
8. [Installing the AutoCAD Add-in](#8-installing-the-autocad-add-in)
9. [Testing Everything Works](#9-testing-everything-works)
10. [Troubleshooting Common Problems](#10-troubleshooting-common-problems)

---

## 1. Prerequisites - What You Need First

Before starting, make sure you have:

- [ ] Windows 10 or Windows 11 (64-bit)
- [ ] Autodesk Revit 2022, 2023, 2024, or 2025 (if using Revit)
- [ ] AutoCAD 2022, 2023, 2024, or 2025 (if using AutoCAD)
- [ ] Administrator access to your computer
- [ ] Internet connection
- [ ] Your **Device Key** from your administrator (you'll need this later)

---

## 2. Installing Visual Studio

Visual Studio is a free program that lets you build the add-ins.

### Step 2.1: Download Visual Studio
1. Open your web browser (Chrome, Edge, Firefox)
2. Go to: https://visualstudio.microsoft.com/downloads/
3. Click the **"Free download"** button under **"Visual Studio Community 2022"**
4. Wait for the file to download (it's called `VisualStudioSetup.exe`)

### Step 2.2: Run the Installer
1. Open your Downloads folder
2. Double-click `VisualStudioSetup.exe`
3. If Windows asks "Do you want to allow this app to make changes?", click **Yes**

### Step 2.3: Choose What to Install
1. Wait for the installer to load (this takes a minute)
2. You'll see a screen with checkboxes called "Workloads"
3. Check these boxes:
   - ✅ **.NET desktop development**
   - ✅ **Desktop development with C++** (optional, but recommended)
4. On the right side, make sure **.NET Framework 4.8 development tools** is checked

### Step 2.4: Start Installation
1. Click the **Install** button at the bottom right
2. Wait for installation to complete (this can take 15-30 minutes)
3. When finished, click **Launch**
4. You can skip sign-in by clicking "Skip this for now" or sign in with a Microsoft account

### Step 2.5: Install .NET 6 SDK (for Windows Agent)
1. Open your browser and go to: https://dotnet.microsoft.com/download/dotnet/6.0
2. Under ".NET 6.0", click the **Windows x64** installer link
3. Run the downloaded file and follow the prompts
4. Click **Install**, then **Close** when done

**Congratulations!** Visual Studio is now installed.

---

## 3. Building the Windows Agent

The Windows Agent is the background service that collects time data and sends it to the server.

### Step 3.1: Download the Source Code
1. Open your web browser
2. Go to your BuildPlus Ai Time Tracking portal
3. Click **Downloads** in the sidebar
4. Click **"View Source Code"** under Windows Agent
5. You'll see a list of files - download each one:
   - Right-click each file → **Save link as...** → Save to a folder called `C:\BuildPlus\windows-agent\`

   Files to download:
   - `Program.cs`
   - `BuildPlusTimeTracking.Agent.csproj`
   - `ConfigManager.cs`
   - `TimeBlockQueue.cs`
   - `PipeListenerService.cs`
   - `UploadService.cs`
   - `build.bat`
   - `install-service.ps1`
   - `README.md`

### Step 3.2: Open the Project in Visual Studio
1. Open **Visual Studio 2022**
2. On the start screen, click **"Open a project or solution"**
3. Navigate to `C:\BuildPlus\windows-agent\`
4. Click on `BuildPlusTimeTracking.Agent.csproj`
5. Click **Open**

### Step 3.3: Build the Project
1. Wait for Visual Studio to load the project (may take a minute)
2. At the top of Visual Studio, find the dropdown that says **"Debug"**
3. Click it and change it to **"Release"**
4. Go to menu: **Build** → **Build Solution**
5. Look at the bottom of the screen for "Build succeeded"

### Step 3.4: Find Your Built Files
1. In Visual Studio, go to menu: **Build** → **Publish Selection**
2. Or manually find them at:
   ```
   C:\BuildPlus\windows-agent\bin\Release\net6.0-windows\win-x64\publish\
   ```
3. You should see `BuildPlusTimeTracking.Agent.exe`

**Alternative: Use the Build Script**
1. Open File Explorer
2. Navigate to `C:\BuildPlus\windows-agent\`
3. Double-click `build.bat`
4. A black window will appear showing the build progress
5. When it says "Build successful!", press any key to close

---

## 4. Installing the Windows Agent

### Step 4.1: Create Installation Folder
1. Open File Explorer
2. Navigate to `C:\Program Files\`
3. Right-click in empty space → **New** → **Folder**
4. Name it `BuildPlusTimeTracking`
5. If Windows asks for permission, click **Continue**

### Step 4.2: Copy the Agent
1. Go to your build output folder:
   ```
   C:\BuildPlus\windows-agent\bin\Release\net6.0-windows\win-x64\publish\
   ```
2. Select `BuildPlusTimeTracking.Agent.exe`
3. Right-click → **Copy**
4. Go to `C:\Program Files\BuildPlusTimeTracking\`
5. Right-click → **Paste**

### Step 4.3: Configure the Agent
1. Press **Windows key + R** to open Run dialog
2. Type `%PROGRAMDATA%` and press Enter
3. Create a new folder called `BuildPlusTimeTracking`
4. Inside that folder, create a new text file
5. Rename it from `New Text Document.txt` to `config.json`
   - If you don't see ".txt", go to View → check "File name extensions"
6. Right-click `config.json` → **Open with** → **Notepad**
7. Paste this content (replace the values with your actual information):

```json
{
  "ServerUrl": "https://your-portal-url.replit.app",
  "DeviceKey": "paste-your-device-key-here",
  "UserEmail": "your.email@company.com",
  "Timezone": "Australia/Melbourne",
  "UploadIntervalSeconds": 60,
  "MaxBatchSize": 50
}
```

8. Save the file (Ctrl+S)
9. Close Notepad

**Important:** Get your Device Key from your administrator. It looks like a long random string.

### Step 4.4: Install as Windows Service
1. Click the **Start** button
2. Type `PowerShell`
3. Right-click **Windows PowerShell** → **Run as administrator**
4. Click **Yes** if asked
5. Type these commands (press Enter after each):

```powershell
cd "C:\Program Files\BuildPlusTimeTracking"

New-Service -Name "BuildPlusTimeTracking" -DisplayName "BuildPlus Ai Time Tracking Agent" -BinaryPathName "C:\Program Files\BuildPlusTimeTracking\BuildPlusTimeTracking.Agent.exe" -StartupType Automatic

Start-Service BuildPlusTimeTracking
```

6. To verify it's running, type:
```powershell
Get-Service BuildPlusTimeTracking
```

You should see "Running" in the Status column.

---

## 5. Building the Revit Add-in

### Step 5.1: Download the Source Code
1. Go to your BuildPlus Ai Time Tracking portal → Downloads
2. Click **"View Source Code"** under Revit Add-in
3. Download all files to `C:\BuildPlus\revit-addin\`:
   - `App.cs`
   - `BuildPlusTimeTracking.csproj`
   - `BuildPlusTimeTracking.addin`
   - `build.bat`
   - `README.md`

### Step 5.2: Set Up the Revit SDK Path
1. Right-click the **Start** button → **System**
2. Click **Advanced system settings** on the right
3. Click **Environment Variables** button
4. Under "User variables", click **New**
5. Variable name: `REVIT_SDK`
6. Variable value: (depends on your Revit version)
   - Revit 2024: `C:\Program Files\Autodesk\Revit 2024`
   - Revit 2023: `C:\Program Files\Autodesk\Revit 2023`
   - Revit 2025: `C:\Program Files\Autodesk\Revit 2025`
7. Click **OK** three times to close all dialogs

### Step 5.3: Open and Build in Visual Studio
1. Open **Visual Studio 2022**
2. Click **"Open a project or solution"**
3. Navigate to `C:\BuildPlus\revit-addin\`
4. Select `BuildPlusTimeTracking.csproj` → **Open**
5. Change the dropdown at the top from **Debug** to **Release**
6. Go to menu: **Build** → **Build Solution**
7. Wait for "Build succeeded" message

### Step 5.4: Find Your Built Files
The compiled files are at:
```
C:\BuildPlus\revit-addin\bin\Release\net48\
```

You need these files:
- `BuildPlusTimeTracking.Revit.dll`
- `Newtonsoft.Json.dll`

---

## 6. Installing the Revit Add-in

### Step 6.1: Find the Revit Add-ins Folder
1. Press **Windows key + R**
2. Type `%APPDATA%\Autodesk\Revit\Addins` and press Enter
3. Open the folder matching your Revit year (e.g., `2024`)
   - If it doesn't exist, create it

### Step 6.2: Copy the Files
1. Copy these files from `C:\BuildPlus\revit-addin\bin\Release\net48\`:
   - `BuildPlusTimeTracking.Revit.dll`
   - `Newtonsoft.Json.dll`
   
2. Also copy from `C:\BuildPlus\revit-addin\`:
   - `BuildPlusTimeTracking.addin`

3. Paste all three files into the Revit Addins folder:
   ```
   %APPDATA%\Autodesk\Revit\Addins\2024\
   ```

### Step 6.3: Start Revit and Allow the Add-in
1. Open Revit
2. You may see a security warning about loading add-ins
3. Click **"Always Load"** to allow the BuildPlus Ai Time Tracking add-in
4. The add-in is now active in the background

---

## 7. Building the AutoCAD Add-in

### Step 7.1: Download the Source Code
1. Go to your BuildPlus Ai Time Tracking portal → Downloads
2. Click **"View Source Code"** under AutoCAD Add-in
3. Download all files to `C:\BuildPlus\acad-addin\`:
   - `App.cs`
   - `BuildPlusTimeTracking.AutoCAD.csproj`
   - `PackageContents.xml`
   - `build.bat`
   - `README.md`

### Step 7.2: Set Up the AutoCAD SDK Path
1. Right-click the **Start** button → **System**
2. Click **Advanced system settings**
3. Click **Environment Variables**
4. Under "User variables", click **New**
5. Variable name: `ACAD_SDK`
6. Variable value: (depends on your AutoCAD version)
   - AutoCAD 2024: `C:\Program Files\Autodesk\AutoCAD 2024`
   - AutoCAD 2023: `C:\Program Files\Autodesk\AutoCAD 2023`
   - AutoCAD 2025: `C:\Program Files\Autodesk\AutoCAD 2025`
7. Click **OK** three times

### Step 7.3: Build the Project
1. Open **Visual Studio 2022**
2. Click **"Open a project or solution"**
3. Navigate to `C:\BuildPlus\acad-addin\`
4. Select `BuildPlusTimeTracking.AutoCAD.csproj` → **Open**
5. Change dropdown to **Release**
6. Go to **Build** → **Build Solution**
7. Wait for "Build succeeded"

---

## 8. Installing the AutoCAD Add-in

### Step 8.1: Create the Bundle Folder
1. Open File Explorer
2. Press **Windows key + R**
3. Type `%APPDATA%\Autodesk\ApplicationPlugins` and press Enter
4. Create a new folder called `BuildPlusTimeTracking.bundle`
5. Inside that folder, create another folder called `Contents`

### Step 8.2: Copy the Files
1. Copy from `C:\BuildPlus\acad-addin\bin\Release\net48\`:
   - `BuildPlusTimeTracking.AutoCAD.dll`
   - `Newtonsoft.Json.dll`
   
2. Paste them into:
   ```
   %APPDATA%\Autodesk\ApplicationPlugins\BuildPlusTimeTracking.bundle\Contents\
   ```

3. Copy from `C:\BuildPlus\acad-addin\`:
   - `PackageContents.xml`
   
4. Paste it into (NOT the Contents folder, the main bundle folder):
   ```
   %APPDATA%\Autodesk\ApplicationPlugins\BuildPlusTimeTracking.bundle\
   ```

Your final folder structure should look like:
```
BuildPlusTimeTracking.bundle\
    PackageContents.xml
    Contents\
        BuildPlusTimeTracking.AutoCAD.dll
        Newtonsoft.Json.dll
```

### Step 8.3: Start AutoCAD
1. Open AutoCAD
2. The add-in should load automatically
3. To verify, type `BPTRACK` in the command line and press Enter
4. You should see "BuildPlus Ai Time Tracking Status" information

---

## 9. Testing Everything Works

### Test 1: Check the Windows Agent is Running
1. Press **Windows key + R**
2. Type `services.msc` and press Enter
3. Look for "BuildPlus Ai Time Tracking Agent"
4. Status should show "Running"

### Test 2: Check Revit Add-in
1. Open Revit
2. Open any project file
3. Work for a few minutes
4. Check your BuildPlus Ai Time Tracking portal Dashboard
5. You should see time entries appearing

### Test 3: Check AutoCAD Add-in
1. Open AutoCAD
2. Type `BPTRACK` and press Enter
3. You should see status information
4. Open a drawing and work for a few minutes
5. Check your portal Dashboard for entries

---

## 10. Troubleshooting Common Problems

### Problem: "Build failed" in Visual Studio
**Solution:**
1. Make sure you set the REVIT_SDK or ACAD_SDK environment variable correctly
2. Close Visual Studio completely
3. Reopen Visual Studio and try again
4. Check that Revit/AutoCAD is installed in the default location

### Problem: Revit shows "Unknown publisher" warning
**Solution:**
1. This is normal for custom add-ins
2. Click "Always Load" to trust the add-in
3. You only need to do this once

### Problem: AutoCAD doesn't load the add-in
**Solution:**
1. Open AutoCAD
2. Type `NETLOAD` and press Enter
3. Browse to: `%APPDATA%\Autodesk\ApplicationPlugins\BuildPlusTimeTracking.bundle\Contents\BuildPlusTimeTracking.AutoCAD.dll`
4. Click Open

### Problem: No data appearing in the portal
**Solution:**
1. Check the Windows Agent is running (see Test 1 above)
2. Verify your config.json has the correct:
   - ServerUrl (your portal address)
   - DeviceKey (from your administrator)
   - UserEmail (your login email)
3. Restart the agent service:
   - Open PowerShell as Administrator
   - Type: `Restart-Service BuildPlusTimeTracking`

### Problem: "Access denied" when creating folders
**Solution:**
1. Right-click the program you're using
2. Select "Run as administrator"
3. Try the operation again

---

## Need More Help?

Contact your system administrator or email: support@buildplus.ai

---

*Last updated: February 2026*
