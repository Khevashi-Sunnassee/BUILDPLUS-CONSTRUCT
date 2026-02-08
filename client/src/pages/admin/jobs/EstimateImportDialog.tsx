import { useRef } from "react";
import {
  Loader2,
  FileSpreadsheet,
  FileUp,
  Upload,
  XCircle,
  CheckCircle2,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UseMutationResult } from "@tanstack/react-query";
import type { JobWithPanels } from "./types";

interface EstimateImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateJob: JobWithPanels | null;
  estimateFile: File | null;
  setEstimateFile: (file: File | null) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  replaceExisting: boolean;
  setReplaceExisting: (replace: boolean) => void;
  importResult: any;
  setImportResult: (result: any) => void;
  jobTotals: {
    totalAreaM2: number;
    totalVolumeM3: number;
    totalElements: number;
    pendingCount: number;
    validatedCount: number;
  } | null | undefined;
  importEstimateMutation: UseMutationResult<any, any, any, any>;
  onRunImport: () => void;
  onFileSelect: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  navigate: (path: string) => void;
}

export function EstimateImportDialog({
  open,
  onOpenChange,
  estimateJob,
  estimateFile,
  setEstimateFile,
  isDragging,
  setIsDragging,
  replaceExisting,
  setReplaceExisting,
  importResult,
  setImportResult,
  jobTotals,
  importEstimateMutation,
  onRunImport,
  onFileSelect,
  onDrop,
  navigate,
}: EstimateImportDialogProps) {
  const estimateFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Import from Estimate - {estimateJob?.name}
          </DialogTitle>
          <DialogDescription>
            Upload an estimate Excel file to automatically create panels from TakeOff sheets.
            Panels will be set to PENDING status until validated.
          </DialogDescription>
        </DialogHeader>

        {jobTotals && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4" />
                <span className="font-medium">Current Job Totals</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Elements</div>
                  <div className="font-semibold text-lg">{jobTotals.totalElements}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Area (m²)</div>
                  <div className="font-semibold text-lg">{jobTotals.totalAreaM2.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Volume (m³)</div>
                  <div className="font-semibold text-lg">{jobTotals.totalVolumeM3.toFixed(3)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                    Pending: {jobTotals.pendingCount}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    Validated: {jobTotals.validatedCount}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"}
            ${estimateFile ? "bg-muted/50" : ""}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => estimateFileInputRef.current?.click()}
          data-testid="dropzone-estimate-file"
        >
          <input
            ref={estimateFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelect(file);
            }}
            data-testid="input-estimate-file"
          />
          {estimateFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div className="text-left">
                <div className="font-medium">{estimateFile.name}</div>
                <div className="text-sm text-muted-foreground">
                  {(estimateFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEstimateFile(null);
                  setImportResult(null);
                }}
                data-testid="button-remove-file"
              >
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <div className="font-medium">Drop estimate Excel file here</div>
              <div className="text-sm text-muted-foreground mt-1">
                or click to browse (.xlsx, .xls)
              </div>
            </>
          )}
        </div>

        {estimateFile && !importResult && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="replaceExisting"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="h-4 w-4"
              data-testid="checkbox-replace-existing"
            />
            <label htmlFor="replaceExisting" className="text-sm">
              Replace existing imported panels (source=3) for this job
            </label>
          </div>
        )}

        {importResult && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">Import Complete</span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <div className="text-muted-foreground">Sheets</div>
                  <div className="font-semibold">{importResult.totals.sheetsProcessed}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Imported</div>
                  <div className="font-semibold text-green-600">{importResult.totals.imported}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Duplicates</div>
                  <div className="font-semibold text-yellow-600">{importResult.totals.duplicates}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Skipped</div>
                  <div className="font-semibold text-muted-foreground">{importResult.totals.skipped}</div>
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-auto">
                {importResult.sheets?.map((sheet: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{sheet.takeoffCategory}</Badge>
                      <span className="text-muted-foreground">{sheet.sheetName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-green-600">{sheet.created} added</span>
                      {sheet.duplicates > 0 && (
                        <span className="text-yellow-600">{sheet.duplicates} dup</span>
                      )}
                      {sheet.errors?.length > 0 && (
                        <span className="text-destructive">{sheet.errors.length} errors</span>
                      )}
                    </div>
                  </div>
                ))}
                {importResult.sheets?.some((s: any) => s.errors?.length > 0) && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                    <p className="text-sm font-medium text-destructive mb-2">Error Details:</p>
                    <ul className="text-sm text-destructive/80 list-disc list-inside space-y-1">
                      {importResult.sheets?.flatMap((sheet: any) => 
                        sheet.errors?.map((error: string, idx: number) => (
                          <li key={`${sheet.sheetName}-${idx}`}>
                            <span className="font-medium">{sheet.sheetName}:</span> {error}
                          </li>
                        )) || []
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-estimate-dialog"
          >
            {importResult ? "Close" : "Cancel"}
          </Button>
          {!importResult && (
            <Button
              onClick={onRunImport}
              disabled={!estimateFile || importEstimateMutation.isPending}
              data-testid="button-run-estimate-import"
            >
              {importEstimateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importEstimateMutation.isPending ? "Importing..." : "Import Panels"}
            </Button>
          )}
          {importResult && (
            <Button
              onClick={() => navigate(`/admin/panels?jobId=${estimateJob?.id}`)}
              data-testid="button-view-imported-panels"
            >
              View Imported Panels
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
