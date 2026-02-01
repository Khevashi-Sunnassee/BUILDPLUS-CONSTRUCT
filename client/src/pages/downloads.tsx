import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  Download,
  FileCode,
  Settings,
  AlertCircle,
  Cpu,
  FolderArchive,
  Github,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DownloadsPage() {
  const { user } = useAuth();

  const downloadSourcePackage = (packageName: string) => {
    const basePath = `/downloads/${packageName}`;
    window.open(basePath, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-downloads-title">
          Downloads & Setup
        </h1>
        <p className="text-muted-foreground">
          Download and configure the LTE Time Tracking tools for your workstation
        </p>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
        <FolderArchive className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>Source Code Packages:</strong> These downloads contain complete C# source code projects. 
          You'll need Visual Studio 2019+ and the appropriate Autodesk software installed to build them.
          See the README.md files in each package for detailed build instructions.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <FileCode className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Revit Add-in</CardTitle>
                <CardDescription>For Autodesk Revit 2022-2025</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Version 1.0.0</Badge>
              <Badge variant="outline">C# / .NET 4.8</Badge>
              <Badge variant="outline">Windows</Badge>
            </div>
            <p className="text-sm">
              Automatically captures active document, view, sheet information, and panel marks from your Revit sessions.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Files included:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li>App.cs - Main add-in code</li>
                <li>LTETimeTracking.csproj - Project file</li>
                <li>LTETimeTracking.addin - Manifest</li>
                <li>build.bat - Build script</li>
                <li>README.md - Setup instructions</li>
              </ul>
            </div>
            <Button 
              className="w-full" 
              data-testid="button-download-revit"
              asChild
            >
              <a href="/downloads/revit-addin/" target="_blank">
                <Github className="h-4 w-4 mr-2" />
                View Source Code
                <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <FileCode className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <CardTitle>AutoCAD Add-in</CardTitle>
                <CardDescription>For AutoCAD 2022-2025</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Version 1.0.0</Badge>
              <Badge variant="outline">C# / .NET 4.8</Badge>
              <Badge variant="outline">Windows</Badge>
            </div>
            <p className="text-sm">
              Automatically captures active drawing, layout information, and drawing codes from your AutoCAD sessions.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Files included:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li>App.cs - Main add-in code</li>
                <li>LTETimeTracking.AutoCAD.csproj - Project</li>
                <li>PackageContents.xml - Bundle manifest</li>
                <li>build.bat - Build script</li>
                <li>README.md - Setup instructions</li>
              </ul>
            </div>
            <Button 
              className="w-full" 
              data-testid="button-download-acad"
              asChild
            >
              <a href="/downloads/acad-addin/" target="_blank">
                <Github className="h-4 w-4 mr-2" />
                View Source Code
                <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <Cpu className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle>Windows Agent</CardTitle>
              <CardDescription>Background service for time tracking</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Version 1.0.0</Badge>
            <Badge variant="outline">C# / .NET 6.0</Badge>
            <Badge variant="outline">Windows Service</Badge>
          </div>
          <p className="text-sm">
            The Windows Agent runs in the background and communicates with the Revit/AutoCAD add-ins 
            to capture and upload time tracking data to the portal.
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Files included:</strong></p>
            <ul className="list-disc list-inside ml-2">
              <li>Program.cs - Entry point</li>
              <li>ConfigManager.cs - Configuration handler</li>
              <li>PipeListenerService.cs - Named pipe listener</li>
              <li>UploadService.cs - API upload service</li>
              <li>TimeBlockQueue.cs - Data queue</li>
              <li>install-service.ps1 - Installation script</li>
              <li>build.bat - Build script</li>
              <li>README.md - Setup instructions</li>
            </ul>
          </div>
          <Button 
            className="w-full" 
            data-testid="button-download-agent"
            asChild
          >
            <a href="/downloads/windows-agent/" target="_blank">
              <Github className="h-4 w-4 mr-2" />
              View Source Code
              <ExternalLink className="h-3 w-3 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Installation Guide
          </CardTitle>
          <CardDescription>
            Follow these steps to set up time tracking on your workstation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="revit">
            <TabsList className="mb-4">
              <TabsTrigger value="revit" data-testid="tab-revit">Revit Setup</TabsTrigger>
              <TabsTrigger value="acad" data-testid="tab-acad">AutoCAD Setup</TabsTrigger>
              <TabsTrigger value="agent" data-testid="tab-agent">Agent Setup</TabsTrigger>
            </TabsList>

            <TabsContent value="revit" className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="step1">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">1</Badge>
                      Download and Build
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Download the Revit Add-in source code and build it with Visual Studio:</p>
                    <ol className="list-decimal list-inside ml-4 space-y-1">
                      <li>Open <code className="bg-muted px-1 rounded">LTETimeTracking.csproj</code> in Visual Studio</li>
                      <li>Set environment variable: <code className="bg-muted px-1 rounded">REVIT_SDK=C:\Program Files\Autodesk\Revit 2024</code></li>
                      <li>Build in Release configuration</li>
                      <li>Or run <code className="bg-muted px-1 rounded">build.bat</code></li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step2">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">2</Badge>
                      Install the Add-in
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Copy the built files to your Revit add-ins folder:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><code className="bg-muted px-1 rounded">LTETimeTracking.Revit.dll</code></li>
                      <li><code className="bg-muted px-1 rounded">LTETimeTracking.addin</code></li>
                      <li><code className="bg-muted px-1 rounded">Newtonsoft.Json.dll</code></li>
                    </ul>
                    <p className="mt-2">Destination:</p>
                    <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                      %APPDATA%\Autodesk\Revit\Addins\2024\
                    </code>
                    <p className="text-sm">Replace "2024" with your Revit version year.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step3">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">3</Badge>
                      Restart Revit
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Close and reopen Revit. You should see the LTE Time Tracking loaded in the Add-Ins manager.</p>
                    <p>If prompted about loading add-ins from an unknown publisher, click "Always Load".</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step4">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">4</Badge>
                      Verify Connection
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>The add-in communicates with the Windows Agent via named pipe.</p>
                    <p>Ensure the Windows Agent is running and configured before opening Revit projects.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="acad" className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="step1">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">1</Badge>
                      Download and Build
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Download the AutoCAD Add-in source code and build it:</p>
                    <ol className="list-decimal list-inside ml-4 space-y-1">
                      <li>Open <code className="bg-muted px-1 rounded">LTETimeTracking.AutoCAD.csproj</code> in Visual Studio</li>
                      <li>Set environment variable: <code className="bg-muted px-1 rounded">ACAD_SDK=C:\Program Files\Autodesk\AutoCAD 2024</code></li>
                      <li>Build in Release configuration</li>
                      <li>Or run <code className="bg-muted px-1 rounded">build.bat</code></li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step2">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">2</Badge>
                      Install as Bundle
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Create bundle folder structure:</p>
                    <pre className="bg-muted px-3 py-2 rounded text-sm font-mono overflow-x-auto">
{`LTETimeTracking.bundle/
  PackageContents.xml
  Contents/
    LTETimeTracking.AutoCAD.dll
    Newtonsoft.Json.dll`}
                    </pre>
                    <p className="mt-2">Copy to:</p>
                    <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                      %APPDATA%\Autodesk\ApplicationPlugins\
                    </code>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step3">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">3</Badge>
                      Restart AutoCAD
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Close and reopen AutoCAD. The add-in will load automatically.</p>
                    <p>Alternative: Type <code className="bg-muted px-1 rounded">NETLOAD</code> and browse to the DLL.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step4">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">4</Badge>
                      Verify with Commands
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Available commands:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><code className="bg-muted px-1 rounded">LTETRACK</code> - Show tracking status</li>
                      <li><code className="bg-muted px-1 rounded">LTESEND</code> - Force send current data</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="agent" className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="step1">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">1</Badge>
                      Get Your Device Key
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Contact your administrator to provision a device for your workstation.</p>
                    <p>They will provide you with a <strong>Device Key</strong> that looks like:</p>
                    <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                      xK9mN2pQrS4tU5vW6xY7zA8bC9dE0fGh...
                    </code>
                    <div className="flex items-center gap-2 mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-amber-700 dark:text-amber-400">
                        Keep your device key secure. It cannot be recovered after initial provisioning.
                      </span>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step2">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">2</Badge>
                      Build the Agent
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Build the Windows Agent:</p>
                    <ol className="list-decimal list-inside ml-4 space-y-1">
                      <li>Install .NET 6.0 SDK or later</li>
                      <li>Open command prompt in the agent folder</li>
                      <li>Run <code className="bg-muted px-1 rounded">build.bat</code></li>
                    </ol>
                    <p className="mt-2">Output: <code className="bg-muted px-1 rounded">LTETimeTracking.Agent.exe</code></p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step3">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">3</Badge>
                      Install as Windows Service
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Run PowerShell as Administrator:</p>
                    <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                      .\install-service.ps1
                    </code>
                    <p className="mt-2">This will:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Copy files to Program Files</li>
                      <li>Create the Windows service</li>
                      <li>Set to start automatically</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step4">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">4</Badge>
                      Configure the Agent
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Edit the configuration file at:</p>
                    <code className="block bg-muted px-3 py-2 rounded text-sm font-mono mb-2">
                      C:\ProgramData\LTETimeTracking\config.json
                    </code>
                    <pre className="bg-muted px-3 py-2 rounded text-sm font-mono overflow-x-auto">
{`{
  "ServerUrl": "${window.location.origin}",
  "DeviceKey": "YOUR_DEVICE_KEY_HERE",
  "UserEmail": "${user?.email || "your.email@lte.com.au"}",
  "Timezone": "Australia/Melbourne",
  "UploadIntervalSeconds": 60,
  "MaxBatchSize": 50
}`}
                    </pre>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step5">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">5</Badge>
                      Start and Verify
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Start the service:</p>
                    <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                      net start LTETimeTracking
                    </code>
                    <p className="mt-2">Check Windows Event Viewer for logs.</p>
                    <p>Open Revit or AutoCAD and verify time entries appear on your Dashboard.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <h4 className="font-medium">Build Requirements</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Visual Studio 2019+</li>
                <li>.NET 6.0 SDK</li>
                <li>.NET Framework 4.8</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Operating System</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Windows 10 (64-bit)</li>
                <li>Windows 11 (64-bit)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Revit Versions</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Autodesk Revit 2022</li>
                <li>Autodesk Revit 2023</li>
                <li>Autodesk Revit 2024</li>
                <li>Autodesk Revit 2025</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">AutoCAD Versions</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>AutoCAD 2022</li>
                <li>AutoCAD 2023</li>
                <li>AutoCAD 2024</li>
                <li>AutoCAD 2025</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">
            If you're having trouble setting up the time tracking tools, contact your system administrator or the LTE IT support team.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">Support Email</Badge>
            <span>support@lte.com.au</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
