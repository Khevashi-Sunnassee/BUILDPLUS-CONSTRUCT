import { useRef } from "react";
import {
  Loader2,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Sparkles,
  Hammer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PanelRegister } from "@shared/schema";
import { ADMIN_ROUTES } from "@shared/api-routes";
import type { BuildFormData } from "./types";

interface PanelBuildDialogProps {
  open: boolean;
  onClose: () => void;
  buildingPanel: PanelRegister | null;
  buildFormData: BuildFormData;
  setBuildFormData: (data: BuildFormData | ((prev: BuildFormData) => BuildFormData)) => void;
  validationErrors: string[];
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  isDragging: boolean;
  setIsDragging: (d: boolean) => void;
  isAnalyzing: boolean;
  onAnalyzePdf: () => void;
  onApprove: () => void;
  onRevoke: (panelId: string) => void;
  onPdfDrop: (e: React.DragEvent) => void;
  onPdfSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  approvePending: boolean;
  revokePending: boolean;
}

export function PanelBuildDialog({
  open,
  onClose,
  buildingPanel,
  buildFormData,
  setBuildFormData,
  validationErrors,
  pdfFile,
  setPdfFile,
  isDragging,
  setIsDragging,
  isAnalyzing,
  onAnalyzePdf,
  onApprove,
  onRevoke,
  onPdfDrop,
  onPdfSelect,
  approvePending,
  revokePending,
}: PanelBuildDialogProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            {buildingPanel?.approvedForProduction ? "Edit Production Details" : "Set Up for Production"}
          </DialogTitle>
          <DialogDescription>
            {buildingPanel && (
              <span>
                Panel: <strong className="font-mono">{buildingPanel.panelMark}</strong>
                {buildingPanel.approvedForProduction && (
                  <Badge variant="secondary" className="ml-2 gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Currently Approved
                  </Badge>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Production Drawing PDF</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onPdfDrop}
            >
              {pdfFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{pdfFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPdfFile(null)}
                    data-testid="button-remove-pdf"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop a PDF here, or click to browse
                  </p>
                  <input
                    type="file"
                    ref={pdfInputRef}
                    accept=".pdf"
                    onChange={onPdfSelect}
                    className="hidden"
                    data-testid="input-pdf-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pdfInputRef.current?.click()}
                    data-testid="button-browse-pdf"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Browse
                  </Button>
                </div>
              )}
            </div>
            {pdfFile && (
              <Button
                onClick={onAnalyzePdf}
                disabled={isAnalyzing}
                className="w-full"
                data-testid="button-analyze-pdf"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isAnalyzing ? "Analyzing PDF..." : "Analyze PDF with AI"}
              </Button>
            )}
            {buildFormData.productionPdfUrl && !pdfFile && buildingPanel && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">IFC Document Attached</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid="button-view-pdf"
                >
                  <a href={ADMIN_ROUTES.PANEL_DOWNLOAD_PDF(buildingPanel.id)} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    View PDF
                  </a>
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loadWidth">Load Width (mm) <span className="text-red-500">*</span></Label>
              <Input
                id="loadWidth"
                value={buildFormData.loadWidth}
                onChange={(e) => setBuildFormData({ ...buildFormData, loadWidth: e.target.value })}
                placeholder="e.g., 3000"
                data-testid="input-load-width"
                className={validationErrors.includes("Load Width is required") ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loadHeight">Load Height (mm) <span className="text-red-500">*</span></Label>
              <Input
                id="loadHeight"
                value={buildFormData.loadHeight}
                onChange={(e) => setBuildFormData({ ...buildFormData, loadHeight: e.target.value })}
                placeholder="e.g., 2500"
                data-testid="input-load-height"
                className={validationErrors.includes("Load Height is required") ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panelThickness">Panel Thickness (mm) <span className="text-red-500">*</span></Label>
              <Input
                id="panelThickness"
                value={buildFormData.panelThickness}
                onChange={(e) => setBuildFormData({ ...buildFormData, panelThickness: e.target.value })}
                placeholder="e.g., 200"
                data-testid="input-panel-thickness"
                className={validationErrors.includes("Panel Thickness is required") ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panelArea">Panel Area (m²)</Label>
              <Input
                id="panelArea"
                value={buildFormData.panelArea}
                readOnly
                className="bg-muted"
                placeholder="Auto-calculated"
                data-testid="input-panel-area"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panelVolume">Panel Volume (m³)</Label>
              <Input
                id="panelVolume"
                value={buildFormData.panelVolume}
                readOnly
                className="bg-muted"
                placeholder="Auto-calculated"
                data-testid="input-panel-volume"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panelMass">Panel Mass (kg)</Label>
              <Input
                id="panelMass"
                value={buildFormData.panelMass}
                readOnly
                className="bg-muted"
                placeholder="Auto-calculated"
                data-testid="input-panel-mass"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="concreteStrengthMpa">Concrete Strength f'c (MPa) <span className="text-red-500">*</span></Label>
              <Input
                id="concreteStrengthMpa"
                value={buildFormData.concreteStrengthMpa}
                onChange={(e) => setBuildFormData({ ...buildFormData, concreteStrengthMpa: e.target.value })}
                placeholder="e.g., 40, 50, 65"
                data-testid="input-concrete-strength"
                className={validationErrors.includes("Concrete Strength f'c (MPa) is required") ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="liftFcm">Lift f'cm (MPa) <span className="text-red-500">*</span></Label>
              <Input
                id="liftFcm"
                value={buildFormData.liftFcm}
                onChange={(e) => setBuildFormData({ ...buildFormData, liftFcm: e.target.value })}
                placeholder="e.g., 25"
                data-testid="input-lift-fcm"
                className={validationErrors.includes("Lift f'cm is required") ? "border-red-500" : ""}
              />
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
              <p className="font-medium text-sm text-red-600 dark:text-red-400 mb-2">Please complete all required fields:</p>
              <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rotationalLifters">Rotational Lifters</Label>
              <Input
                id="rotationalLifters"
                value={buildFormData.rotationalLifters}
                onChange={(e) => setBuildFormData({ ...buildFormData, rotationalLifters: e.target.value })}
                placeholder="e.g., 2x ERH-2.5T"
                data-testid="input-rotational-lifters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryLifters">Primary Lifters</Label>
              <Input
                id="primaryLifters"
                value={buildFormData.primaryLifters}
                onChange={(e) => setBuildFormData({ ...buildFormData, primaryLifters: e.target.value })}
                placeholder="e.g., 4x Anchor Point"
                data-testid="input-primary-lifters"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {buildingPanel?.approvedForProduction && (
            <Button
              variant="destructive"
              onClick={() => buildingPanel && onRevoke(buildingPanel.id)}
              disabled={revokePending}
              data-testid="button-revoke-approval"
            >
              {revokePending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <XCircle className="h-4 w-4 mr-2" />
              Revoke Approval
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onApprove}
            disabled={approvePending}
            data-testid="button-approve-production"
          >
            {approvePending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {buildingPanel?.approvedForProduction ? "Update & Keep Approved" : "Approve for Production"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
