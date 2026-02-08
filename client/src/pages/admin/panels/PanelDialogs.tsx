import { useRef } from "react";
import {
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  QrCode,
  ExternalLink,
  Printer,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job } from "@shared/schema";
import { isJobVisibleInDropdowns } from "@shared/job-phases";
import type { ConsolidationData, ConsolidationWarning } from "./types";
import { getSourceLabel } from "./types";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importData: any[];
  selectedJobForImport: string;
  setSelectedJobForImport: (v: string) => void;
  importErrors: string[];
  jobs: Job[] | undefined;
  onImport: (data: { data: any[]; jobId?: string }) => void;
  importPending: boolean;
}

export function ImportDialog({
  open, onOpenChange, importData, selectedJobForImport, setSelectedJobForImport,
  importErrors, jobs, onImport, importPending,
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Panels from Excel
          </DialogTitle>
          <DialogDescription>
            Review the data before importing. {importData.length} rows found.
            {importData.some(r => r["Job Number"] || r.jobNumber || r.job_number || r["Job"]) 
              ? " Job numbers detected in Excel."
              : " No job numbers in Excel - select a fallback job below."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Fallback Job (used when Excel row has no Job Number)</label>
            <Select value={selectedJobForImport} onValueChange={setSelectedJobForImport}>
              <SelectTrigger className="mt-1" data-testid="select-import-job">
                <SelectValue placeholder="Select fallback job (optional if job in Excel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No fallback - require job in Excel</SelectItem>
                {jobs?.filter(j => isJobVisibleInDropdowns(String(j.jobPhase ?? "CONTRACTED") as any)).map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.jobNumber} - {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {importErrors.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-md">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Import Validation Errors ({importErrors.length})
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1 mb-2">
                No records were added for rows with invalid job numbers. Ensure the job exists in the system.
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside max-h-24 overflow-auto">
                {importErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="max-h-[200px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Number</TableHead>
                  <TableHead>Panel Mark</TableHead>
                  <TableHead>Panel Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Est. Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importData.slice(0, 10).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">{row["Job Number"] || row.jobNumber || row.job_number || row["Job"] || "-"}</TableCell>
                    <TableCell className="font-mono">{row.panelMark || row["Panel Mark"] || row["Mark"] || "-"}</TableCell>
                    <TableCell>{row.panelType || row["Panel Type"] || row["Type"] || "WALL"}</TableCell>
                    <TableCell>{row.description || row["Description"] || "-"}</TableCell>
                    <TableCell>{row.estimatedHours || row["Estimated Hours"] || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {importData.length > 10 && (
              <div className="p-2 text-center text-sm text-muted-foreground">
                ... and {importData.length - 10} more rows
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onImport({ 
              data: importData, 
              jobId: selectedJobForImport === "none" ? undefined : selectedJobForImport 
            })}
            disabled={importPending}
            data-testid="button-confirm-import"
          >
            {importPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Upload className="h-4 w-4 mr-2" />
            Import {importData.length} Panels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deletingPanelId: string | null;
  onDelete: (id: string) => void;
  deletePending: boolean;
}

export function DeleteDialog({ open, onOpenChange, deletingPanelId, onDelete, deletePending }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Panel?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this panel from the register.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deletingPanelId && onDelete(deletingPanelId)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete"
          >
            {deletePending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceToDelete: number | null;
  setSourceToDelete: (s: number | null) => void;
  sourceCounts: { source: number; count: number }[] | undefined;
  onDelete: (source: number) => void;
  deletePending: boolean;
}

export function DeleteSourceDialog({ open, onOpenChange, sourceToDelete, setSourceToDelete, sourceCounts, onDelete, deletePending }: DeleteSourceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete All {sourceToDelete ? getSourceLabel(sourceToDelete) : ""} Panels?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all {sourceCounts?.find(s => s.source === sourceToDelete)?.count || 0} panels 
            that were created via {sourceToDelete ? getSourceLabel(sourceToDelete) : ""}.
            This action cannot be undone.
            <br /><br />
            <strong>Note:</strong> Panels with production records or approved for production cannot be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSourceToDelete(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => sourceToDelete && onDelete(sourceToDelete)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-source"
          >
            {deletePending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: Job[] | undefined;
  onDownload: () => void;
}

export function TemplateDialog({ open, onOpenChange, jobs, onDownload }: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Download Panel Import Template
          </DialogTitle>
          <DialogDescription>
            Before downloading the template, please confirm:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Have you loaded jobs into the system?
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
              No panels can be added for jobs that do not exist in the system. The template will include a "Jobs Reference" sheet with all current jobs.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p><strong>Current Jobs in System:</strong> {jobs?.length || 0}</p>
            {jobs && jobs.length > 0 && (
              <ul className="mt-2 list-disc list-inside max-h-32 overflow-auto">
                {jobs.slice(0, 10).map(j => (
                  <li key={j.id}>{j.jobNumber} - {j.name}</li>
                ))}
                {jobs.length > 10 && <li className="text-muted-foreground">...and {jobs.length - 10} more</li>}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onDownload} disabled={!jobs || jobs.length === 0} data-testid="button-confirm-download-template">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCodePanel: { id: string; panelMark: string; jobNumber?: string } | null;
  qrCodeRef: React.RefObject<HTMLDivElement>;
}

export function QrCodeDialog({ open, onOpenChange, qrCodePanel, qrCodeRef }: QrCodeDialogProps) {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-qr-code">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Panel QR Code
          </DialogTitle>
          <DialogDescription>
            Scan this code to view panel details and history
          </DialogDescription>
        </DialogHeader>
        {qrCodePanel && (
          <div className="flex flex-col items-center space-y-4">
            <div className="text-center">
              <p className="font-mono font-bold text-lg">{qrCodePanel.panelMark}</p>
              {qrCodePanel.jobNumber && (
                <p className="text-sm text-muted-foreground">Job: {qrCodePanel.jobNumber}</p>
              )}
            </div>
            <div 
              ref={qrCodeRef}
              className="bg-white p-4 rounded-lg shadow-sm"
              data-testid="qr-code-container"
            >
              <QRCodeSVG
                value={`${window.location.origin}/panel/${qrCodePanel.id}`}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center break-all max-w-[280px]">
              {window.location.origin}/panel/{qrCodePanel.id}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const svg = qrCodeRef.current?.querySelector('svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = document.createElement('img');
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx?.drawImage(img, 0, 0);
                      const pngUrl = canvas.toDataURL('image/png');
                      const downloadLink = document.createElement('a');
                      downloadLink.download = `panel-${qrCodePanel.panelMark}-qr.png`;
                      downloadLink.href = pngUrl;
                      downloadLink.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                  }
                }}
                data-testid="button-download-qr"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!qrCodePanel || !qrCodeRef.current) return;
                  const printWindow = window.open('', '_blank', 'width=400,height=500');
                  if (!printWindow) {
                    toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to print the QR code" });
                    return;
                  }
                  const svg = qrCodeRef.current.querySelector('svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>QR Code - ${qrCodePanel.panelMark}</title>
                            <style>
                              body { 
                                display: flex; 
                                flex-direction: column; 
                                align-items: center; 
                                justify-content: center; 
                                min-height: 100vh; 
                                margin: 0; 
                                font-family: system-ui, sans-serif;
                              }
                              .panel-info { 
                                text-align: center; 
                                margin-bottom: 20px;
                              }
                              .panel-mark { 
                                font-size: 24px; 
                                font-weight: bold; 
                                font-family: monospace;
                              }
                              .job-number { 
                                font-size: 14px; 
                                color: #666; 
                                margin-top: 4px;
                              }
                              .qr-container { 
                                padding: 20px; 
                                background: white; 
                                border-radius: 8px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                              }
                              @media print {
                                body { justify-content: flex-start; padding-top: 50px; }
                                .qr-container { box-shadow: none; }
                              }
                            </style>
                          </head>
                          <body>
                            <div class="panel-info">
                              <div class="panel-mark">${qrCodePanel.panelMark}</div>
                              ${qrCodePanel.jobNumber ? `<div class="job-number">Job: ${qrCodePanel.jobNumber}</div>` : ''}
                            </div>
                            <div class="qr-container">${svgData}</div>
                            <script>
                              window.onload = function() {
                                window.print();
                                window.onafterprint = function() { window.close(); };
                              };
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                }}
                data-testid="button-print-qr"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`/panel/${qrCodePanel.id}`, '_blank')}
                data-testid="button-open-panel-details"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Details
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ConsolidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consolidationData: ConsolidationData | null;
  setConsolidationData: (data: ConsolidationData | null) => void;
  consolidationWarnings: Record<string, ConsolidationWarning> | null;
  setConsolidationWarnings: (w: Record<string, ConsolidationWarning> | null) => void;
  consolidationCheckLoading: boolean;
  onConsolidate: (data: { panelIds: string[]; primaryPanelId: string; newPanelMark: string; newLoadWidth: string; newLoadHeight: string }) => void;
  consolidatePending: boolean;
}

export function ConsolidationDialog({
  open, onOpenChange, consolidationData, setConsolidationData,
  consolidationWarnings, setConsolidationWarnings, consolidationCheckLoading,
  onConsolidate, consolidatePending,
}: ConsolidationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); setConsolidationData(null); setConsolidationWarnings(null); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Consolidate Panels</DialogTitle>
          <DialogDescription>
            Review the consolidated panel details before processing
          </DialogDescription>
        </DialogHeader>
        {consolidationData && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 bg-muted/20">
              <h4 className="font-medium mb-2">Panels Being Consolidated</h4>
              <div className="space-y-1">
                {consolidationData.panels.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-sm" data-testid={`consolidation-panel-${p.id}`}>
                    <span className="font-mono">{p.panelMark}</span>
                    <span className="text-muted-foreground">
                      {p.loadWidth || "?"} x {p.loadHeight || "?"} mm
                      {p.id === consolidationData.primaryPanelId && (
                        <Badge variant="outline" className="ml-2 text-xs">Primary</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Panel Mark</Label>
                <Input
                  value={consolidationData.newPanelMark}
                  onChange={(e) => setConsolidationData({ ...consolidationData, newPanelMark: e.target.value })}
                  data-testid="input-consolidation-panel-mark"
                />
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Input
                  value={consolidationData.panels.find((p: any) => p.id === consolidationData.primaryPanelId)?.level || ""}
                  disabled
                  data-testid="input-consolidation-level"
                />
              </div>
              <div className="space-y-2">
                <Label>New Width (mm)</Label>
                <Input
                  value={consolidationData.newWidth}
                  onChange={(e) => setConsolidationData({ ...consolidationData, newWidth: e.target.value })}
                  data-testid="input-consolidation-width"
                />
              </div>
              <div className="space-y-2">
                <Label>New Height (mm)</Label>
                <Input
                  value={consolidationData.newHeight}
                  onChange={(e) => setConsolidationData({ ...consolidationData, newHeight: e.target.value })}
                  data-testid="input-consolidation-height"
                />
              </div>
            </div>

            {consolidationCheckLoading && (
              <div className="rounded-md border p-3 bg-muted/20 text-sm text-muted-foreground">
                Checking for existing records...
              </div>
            )}

            {consolidationWarnings && (() => {
              const panelsWithRecords = Object.entries(consolidationWarnings).filter(
                ([, w]) => w.draftingLogs > 0 || w.timerSessions > 0 || w.loadListEntries > 0
              );
              if (panelsWithRecords.length === 0) return null;
              return (
                <div className="rounded-md border border-red-500/50 p-3 bg-red-500/10 text-sm" data-testid="consolidation-warnings">
                  <p className="font-medium text-red-600 dark:text-red-400">
                    Warning: The following panels have existing records that will be affected:
                  </p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {panelsWithRecords.map(([id, w]) => (
                      <li key={id} className="flex flex-col">
                        <span className="font-mono font-medium">{w.panelMark}</span>
                        <span className="pl-4">
                          {w.draftingLogs > 0 && <span className="mr-3">{w.draftingLogs} drafting log{w.draftingLogs !== 1 ? "s" : ""}</span>}
                          {w.timerSessions > 0 && <span className="mr-3">{w.timerSessions} timer session{w.timerSessions !== 1 ? "s" : ""}</span>}
                          {w.loadListEntries > 0 && <span>{w.loadListEntries} load list entr{w.loadListEntries !== 1 ? "ies" : "y"}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                    Consumed panels will be retired. Their existing records will remain but the panels will be hidden from selection dropdowns.
                  </p>
                </div>
              );
            })()}

            <div className="rounded-md border border-amber-500/50 p-3 bg-amber-500/10 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                The following panels will be retired from the register:
              </p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {consolidationData.panels
                  .filter((p: any) => p.id !== consolidationData.primaryPanelId)
                  .map((p: any) => (
                    <li key={p.id}>{p.panelMark} ({p.loadWidth} x {p.loadHeight}mm)</li>
                  ))}
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { onOpenChange(false); setConsolidationData(null); }} data-testid="button-cancel-consolidation">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!consolidationData) return;
                  onConsolidate({
                    panelIds: consolidationData.panels.map((p: any) => p.id),
                    primaryPanelId: consolidationData.primaryPanelId,
                    newPanelMark: consolidationData.newPanelMark,
                    newLoadWidth: consolidationData.newWidth,
                    newLoadHeight: consolidationData.newHeight,
                  });
                }}
                disabled={consolidatePending || consolidationCheckLoading}
                data-testid="button-process-consolidation"
              >
                {consolidatePending ? "Processing..." : consolidationCheckLoading ? "Checking Records..." : "Process Consolidation"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
