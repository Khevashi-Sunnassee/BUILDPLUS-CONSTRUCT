import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Download,
  FileCode,
  Monitor,
  Settings,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Cpu,
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
import { useToast } from "@/hooks/use-toast";

interface DeviceInfo {
  id: string;
  deviceName: string;
  deviceKey?: string;
}

export default function DownloadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (text: string, keyId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedKey(null), 2000);
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Version 1.0.0</Badge>
              <span>Windows 10/11</span>
            </div>
            <p className="text-sm">
              Automatically captures active document, view, sheet information, and panel marks from your Revit sessions.
            </p>
            <Button className="w-full" data-testid="button-download-revit">
              <Download className="h-4 w-4 mr-2" />
              Download Revit Add-in
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Version 1.0.0</Badge>
              <span>Windows 10/11</span>
            </div>
            <p className="text-sm">
              Automatically captures active drawing, layout information, and drawing codes from your AutoCAD sessions.
            </p>
            <Button className="w-full" data-testid="button-download-acad">
              <Download className="h-4 w-4 mr-2" />
              Download AutoCAD Add-in
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Version 1.0.0</Badge>
            <span>Windows 10/11</span>
            <span>Runs as system service</span>
          </div>
          <p className="text-sm">
            The Windows Agent runs in the background and communicates with the Revit/AutoCAD add-ins to capture and upload time tracking data to the portal.
          </p>
          <Button className="w-full" data-testid="button-download-agent">
            <Download className="h-4 w-4 mr-2" />
            Download Windows Agent
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
                      Download the Revit Add-in
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Click the "Download Revit Add-in" button above to download the installer package.</p>
                    <p>The download includes:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>LTETimeTracking.addin - Add-in manifest file</li>
                      <li>LTETimeTracking.dll - Add-in binary</li>
                    </ul>
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
                    <p>Copy the files to your Revit add-ins folder:</p>
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
                    <p>Close and reopen Revit. You should see the LTE Time Tracking panel in the Add-Ins tab.</p>
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
                    <p>The add-in will show a green indicator when connected to the Windows Agent.</p>
                    <p>Open a project file and verify that the current document name appears in the add-in panel.</p>
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
                      Download the AutoCAD Add-in
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Click the "Download AutoCAD Add-in" button above to download the installer package.</p>
                    <p>The download includes:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>LTETimeTracking.bundle - AutoCAD bundle package</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step2">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">2</Badge>
                      Install the Bundle
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Copy the bundle folder to AutoCAD's ApplicationPlugins folder:</p>
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
                    <p>Type NETLOAD at the command prompt if the add-in doesn't auto-load.</p>
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
                    <p>Type LTETRACK at the command prompt to open the tracking panel.</p>
                    <p>The panel will show connection status and current document information.</p>
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
                      Install the Windows Agent
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Run the downloaded installer with administrator privileges.</p>
                    <p>The agent will be installed as a Windows service that starts automatically.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step3">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">3</Badge>
                      Configure the Agent
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Open the configuration file at:</p>
                    <code className="block bg-muted px-3 py-2 rounded text-sm font-mono mb-2">
                      C:\ProgramData\LTETimeTracking\config.json
                    </code>
                    <p>Add your settings:</p>
                    <pre className="bg-muted px-3 py-2 rounded text-sm font-mono overflow-x-auto">
{`{
  "serverUrl": "${window.location.origin}",
  "deviceKey": "YOUR_DEVICE_KEY_HERE",
  "userEmail": "${user?.email || "your.email@lte.com.au"}"
}`}
                    </pre>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step4">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">4</Badge>
                      Start the Service
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Start the LTE Time Tracking service:</p>
                    <code className="block bg-muted px-3 py-2 rounded text-sm font-mono">
                      net start LTETimeTracking
                    </code>
                    <p>Or restart your computer - the service will start automatically.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step5">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 justify-center">5</Badge>
                      Verify Connection
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Check the agent status in the system tray.</p>
                    <p>A green icon indicates successful connection to the server.</p>
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
          <div className="grid gap-4 md:grid-cols-3">
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
