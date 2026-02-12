import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Loader2,
  X,
  AlertTriangle,
  Check,
  ChevronRight,
  ChevronLeft,
  Layers,
  Eye,
  CheckCircle2,
  Circle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, getCsrfToken } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DOCUMENT_ROUTES } from "@shared/api-routes";

interface AnalyzedPage {
  pageNumber: number;
  drawingNumber: string;
  title: string;
  revision: string;
  version: string;
  scale: string;
  projectName: string;
  projectNumber: string;
  discipline: string;
  level: string;
  client: string;
  date: string;
  thumbnail: string;
  textPreview: string;
  conflictAction: string;
  conflictDocument: {
    id: string;
    title: string;
    revision: string;
    version: string;
  } | null;
  selected: boolean;
  action: string;
  confirmed: boolean;
  jobId: string;
  typeId: string;
  disciplineId: string;
  categoryId: string;
}

interface AnalysisResult {
  totalPages: number;
  pages: AnalyzedPage[];
  matchedJob: { id: string; name: string } | null;
  jobs: { id: string; name: string }[];
  originalFileName: string;
}

interface DrawingPackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = "upload" | "review" | "confirm";

export function DrawingPackageDialog({ open, onOpenChange }: DrawingPackageDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [pages, setPages] = useState<AnalyzedPage[]>([]);
  const [globalJobId, setGlobalJobId] = useState<string>("");
  const [globalTypeId, setGlobalTypeId] = useState<string>("");
  const [globalDisciplineId, setGlobalDisciplineId] = useState<string>("");
  const [globalCategoryId, setGlobalCategoryId] = useState<string>("");
  const [activePage, setActivePage] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [isMaximized, setIsMaximized] = useState(false);

  const { data: docTypes } = useQuery<any[]>({
    queryKey: [DOCUMENT_ROUTES.TYPES],
    enabled: open && step !== "upload",
  });

  const { data: disciplines } = useQuery<any[]>({
    queryKey: [DOCUMENT_ROUTES.DISCIPLINES],
    enabled: open && step !== "upload",
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: [DOCUMENT_ROUTES.CATEGORIES],
    enabled: open && step !== "upload",
  });

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = await getCsrfToken();
      const res = await fetch(DOCUMENT_ROUTES.DRAWING_PACKAGE_ANALYZE, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Analysis failed");
      }
      return res.json();
    },
    onSuccess: (data: AnalysisResult) => {
      setAnalysisResult(data);
      const pagesWithSelection = data.pages.map((p) => ({
        ...p,
        selected: p.conflictAction !== "skip",
        action: p.conflictAction === "none" ? "register" : p.conflictAction,
        confirmed: false,
        jobId: "",
        typeId: "",
        disciplineId: "",
        categoryId: "",
        version: p.version || "1.0",
      }));
      setPages(pagesWithSelection);
      if (data.matchedJob?.id) {
        setGlobalJobId(data.matchedJob.id);
      }
      setActivePage(1);
      setStep("review");
    },
    onError: (error: Error) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const selectedPages = pages.filter((p) => p.selected);
      if (selectedPages.length === 0) throw new Error("No drawings selected");

      const formData = new FormData();
      formData.append("file", selectedFile);
      const toId = (v: string) => (!v || v === "__none__" || v === "__inherit__") ? null : v;
      const resolveId = (pageVal: string, globalVal: string) => toId(pageVal) ?? toId(globalVal);
      formData.append("jobId", toId(globalJobId) || "");
      formData.append("drawings", JSON.stringify(selectedPages.map((p) => ({
        pageNumber: p.pageNumber,
        drawingNumber: p.drawingNumber,
        title: p.title,
        revision: p.revision,
        version: p.version,
        scale: p.scale,
        projectName: p.projectName,
        discipline: p.discipline,
        level: p.level,
        client: p.client,
        date: p.date,
        action: p.action,
        conflictDocumentId: p.conflictDocument?.id || null,
        jobId: resolveId(p.jobId, globalJobId),
        typeId: resolveId(p.typeId, globalTypeId),
        disciplineId: resolveId(p.disciplineId, globalDisciplineId),
        categoryId: resolveId(p.categoryId, globalCategoryId),
      }))));

      const csrfToken = await getCsrfToken();
      const res = await fetch(DOCUMENT_ROUTES.DRAWING_PACKAGE_REGISTER, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const registered = data.results?.filter((r: any) => r.status === "registered").length || 0;
      const skipped = data.results?.filter((r: any) => r.status === "skipped").length || 0;
      toast({
        title: "Drawing Package Processed",
        description: `${registered} drawing(s) registered${skipped > 0 ? `, ${skipped} skipped` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = useCallback(() => {
    setStep("upload");
    setSelectedFile(null);
    setAnalysisResult(null);
    setPages([]);
    setGlobalJobId("");
    setGlobalTypeId("");
    setGlobalDisciplineId("");
    setGlobalCategoryId("");
    setActivePage(1);
    setPreviewZoom(1);
    onOpenChange(false);
  }, [onOpenChange]);

  const validateAndSetFile = (file: File) => {
    if (file.type !== "application/pdf") {
      toast({ title: "Invalid File", description: "Please select a PDF file", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleAnalyze = () => {
    if (selectedFile) analyzeMutation.mutate(selectedFile);
  };

  const updatePageField = (pageNum: number, field: string, value: string | boolean) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, [field]: value } : p))
    );
  };

  const togglePageSelection = (pageNum: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, selected: !p.selected } : p))
    );
  };

  const confirmPage = (pageNum: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, confirmed: true } : p))
    );
    const nextUnconfirmed = pages.find((p) => p.pageNumber > pageNum && p.selected && !p.confirmed);
    if (nextUnconfirmed) setActivePage(nextUnconfirmed.pageNumber);
  };

  const currentPage = pages.find((p) => p.pageNumber === activePage);
  const selectedCount = pages.filter((p) => p.selected).length;
  const confirmedCount = pages.filter((p) => p.selected && p.confirmed).length;
  const conflictCount = pages.filter((p) => p.conflictDocument).length;

  const steps: WizardStep[] = ["upload", "review", "confirm"];
  const stepLabels: Record<WizardStep, string> = {
    upload: "Upload PDF",
    review: "Review & Edit",
    confirm: "Confirm & Register",
  };
  const currentStepIndex = steps.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`flex flex-col ${isMaximized ? "max-w-[100vw] w-[100vw] max-h-[100vh] h-[100vh] rounded-none" : "max-w-[95vw] w-[1400px] max-h-[92vh]"}`} data-testid="dialog-drawing-package">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Drawing Package Processor
            </DialogTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsMaximized((v) => !v)}
              data-testid="button-maximize-dialog"
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
          <DialogDescription>
            Upload a multi-page PDF to extract, review, and register individual drawings
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 mb-2" data-testid="wizard-steps">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
                  i === currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : i < currentStepIndex
                    ? "bg-muted text-foreground"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {i < currentStepIndex ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="w-3.5 text-center">{i + 1}</span>
                )}
                {stepLabels[s]}
              </div>
              {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
          {step === "review" && (
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="secondary">{selectedCount} selected</Badge>
              <Badge variant="secondary">{confirmedCount}/{selectedCount} confirmed</Badge>
              {conflictCount > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {conflictCount} conflicts
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {step === "upload" && (
            <div className="space-y-4 p-1 h-full">
              <Card className="h-full">
                <CardContent className="pt-6 h-full flex flex-col justify-center">
                  <div
                    className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                      isDragging ? "border-primary bg-primary/5" : "hover-elevate"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    data-testid="dropzone-drawing-package"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                      data-testid="input-drawing-package-file"
                    />
                    <Upload className={`h-16 w-16 mx-auto mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-lg font-medium mb-1">
                      {isDragging
                        ? "Drop your PDF here"
                        : selectedFile
                        ? selectedFile.name
                        : "Drag & drop a PDF file here, or click to browse"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFile
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                        : "Multi-page PDF drawing packages are supported"}
                    </p>
                  </div>
                  {selectedFile && (
                    <div className="flex items-center justify-between mt-4 p-3 rounded-md bg-muted">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        <div>
                          <p className="text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {step === "review" && analysisResult && (
            <div className="flex gap-4 h-full">
              <div className="w-[320px] flex-shrink-0 flex flex-col h-full border rounded-md overflow-hidden">
                <div className="p-3 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2">Global Defaults</h3>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Job</Label>
                      <Select value={globalJobId} onValueChange={setGlobalJobId}>
                        <SelectTrigger className="text-xs" data-testid="select-global-job">
                          <SelectValue placeholder="Select job..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No job</SelectItem>
                          {(analysisResult.jobs || []).map((j) => (
                            <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {analysisResult.matchedJob && globalJobId === analysisResult.matchedJob.id && (
                        <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" /> Auto-matched
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Document Type</Label>
                      <Select value={globalTypeId} onValueChange={setGlobalTypeId}>
                        <SelectTrigger className="text-xs" data-testid="select-global-type">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No type</SelectItem>
                          {(docTypes || []).map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.typeName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Discipline</Label>
                      <Select value={globalDisciplineId} onValueChange={setGlobalDisciplineId}>
                        <SelectTrigger className="text-xs" data-testid="select-global-discipline">
                          <SelectValue placeholder="Select discipline..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No discipline</SelectItem>
                          {(disciplines || []).map((d: any) => (
                            <SelectItem key={d.id} value={d.id}>{d.disciplineName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="p-2 border-b bg-muted/20 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">Pages ({pages.length})</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm"
                      onClick={() => setPages(p => p.map(pg => ({ ...pg, selected: true })))}
                      data-testid="button-select-all">All</Button>
                    <Button variant="ghost" size="sm"
                      onClick={() => setPages(p => p.map(pg => ({ ...pg, selected: false })))}
                      data-testid="button-deselect-all">None</Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="p-1">
                    {pages.map((page) => (
                      <div
                        key={page.pageNumber}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer mb-0.5 transition-colors ${
                          activePage === page.pageNumber
                            ? "bg-primary/10 border border-primary/30"
                            : "hover-elevate"
                        } ${!page.selected ? "opacity-40" : ""}`}
                        onClick={() => setActivePage(page.pageNumber)}
                        data-testid={`page-item-${page.pageNumber}`}
                      >
                        <Checkbox
                          checked={page.selected}
                          onCheckedChange={() => togglePageSelection(page.pageNumber)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0"
                          data-testid={`checkbox-page-${page.pageNumber}`}
                        />
                        {page.thumbnail && (
                          <div className="w-10 h-10 rounded overflow-hidden border flex-shrink-0 bg-white">
                            <img
                              src={`data:image/png;base64,${page.thumbnail}`}
                              alt={`Page ${page.pageNumber}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium truncate">
                              {page.drawingNumber || `Page ${page.pageNumber}`}
                            </span>
                            {page.confirmed && (
                              <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {page.title || "Untitled"} {page.revision ? `Rev ${page.revision}` : ""}
                          </p>
                        </div>
                        {page.conflictDocument && (
                          <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col h-full min-w-0">
                {currentPage ? (
                  <div className="flex gap-4 h-full">
                    <div className="w-[340px] flex-shrink-0 flex flex-col h-full border rounded-md overflow-hidden">
                      <div className="p-3 border-b bg-muted/30 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          Page {currentPage.pageNumber} Details
                        </h3>
                        {currentPage.confirmed ? (
                          <Badge variant="secondary" className="text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmed
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Circle className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </div>

                      <div className="p-3 space-y-3 flex-1 min-h-0 overflow-y-auto">
                        <div>
                          <Label className="text-xs text-muted-foreground">Drawing Number</Label>
                          <Input
                            value={currentPage.drawingNumber}
                            onChange={(e) => updatePageField(currentPage.pageNumber, "drawingNumber", e.target.value)}
                            className="text-sm font-mono"
                            data-testid="input-drawing-number"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Title</Label>
                          <Input
                            value={currentPage.title}
                            onChange={(e) => updatePageField(currentPage.pageNumber, "title", e.target.value)}
                            className="text-sm"
                            data-testid="input-title"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Revision</Label>
                            <Input
                              value={currentPage.revision}
                              onChange={(e) => updatePageField(currentPage.pageNumber, "revision", e.target.value)}
                              className="text-sm font-mono"
                              data-testid="input-revision"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Version</Label>
                            <Input
                              value={currentPage.version}
                              onChange={(e) => updatePageField(currentPage.pageNumber, "version", e.target.value)}
                              className="text-sm font-mono"
                              data-testid="input-version"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Scale</Label>
                            <Input
                              value={currentPage.scale}
                              onChange={(e) => updatePageField(currentPage.pageNumber, "scale", e.target.value)}
                              className="text-sm"
                              data-testid="input-scale"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Level</Label>
                            <Input
                              value={currentPage.level}
                              onChange={(e) => updatePageField(currentPage.pageNumber, "level", e.target.value)}
                              className="text-sm"
                              data-testid="input-level"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Date</Label>
                          <Input
                            value={currentPage.date}
                            onChange={(e) => updatePageField(currentPage.pageNumber, "date", e.target.value)}
                            className="text-sm"
                            data-testid="input-date"
                          />
                        </div>

                        <Separator />

                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Job {currentPage.jobId ? "" : <span className="text-[10px] opacity-60">(inherits global)</span>}
                          </Label>
                          <Select
                            value={currentPage.jobId || "__inherit__"}
                            onValueChange={(v) => updatePageField(currentPage.pageNumber, "jobId", v === "__inherit__" ? "" : v)}
                          >
                            <SelectTrigger className="text-xs" data-testid="select-page-job">
                              <SelectValue placeholder="Inherit from global" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__inherit__">Inherit global default</SelectItem>
                              <SelectItem value="__none__">No job</SelectItem>
                              {(analysisResult?.jobs || []).map((j) => (
                                <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Document Type {currentPage.typeId ? "" : <span className="text-[10px] opacity-60">(inherits global)</span>}
                          </Label>
                          <Select
                            value={currentPage.typeId || "__inherit__"}
                            onValueChange={(v) => updatePageField(currentPage.pageNumber, "typeId", v === "__inherit__" ? "" : v)}
                          >
                            <SelectTrigger className="text-xs" data-testid="select-page-type">
                              <SelectValue placeholder="Inherit from global" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__inherit__">Inherit global default</SelectItem>
                              <SelectItem value="__none__">No type</SelectItem>
                              {(docTypes || []).map((t: any) => (
                                <SelectItem key={t.id} value={t.id}>{t.typeName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Discipline {currentPage.disciplineId ? "" : <span className="text-[10px] opacity-60">(inherits global)</span>}
                          </Label>
                          <Select
                            value={currentPage.disciplineId || "__inherit__"}
                            onValueChange={(v) => updatePageField(currentPage.pageNumber, "disciplineId", v === "__inherit__" ? "" : v)}
                          >
                            <SelectTrigger className="text-xs" data-testid="select-page-discipline">
                              <SelectValue placeholder="Inherit from global" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__inherit__">Inherit global default</SelectItem>
                              <SelectItem value="__none__">No discipline</SelectItem>
                              {(disciplines || []).map((d: any) => (
                                <SelectItem key={d.id} value={d.id}>{d.disciplineName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {currentPage.conflictDocument && (
                          <>
                            <Separator />
                            <div>
                              <Label className="text-xs text-amber-600 flex items-center gap-1 mb-1">
                                <AlertTriangle className="h-3 w-3" /> Conflict Detected
                              </Label>
                              <p className="text-xs text-muted-foreground mb-2">
                                Existing: "{currentPage.conflictDocument.title}" Rev {currentPage.conflictDocument.revision}
                              </p>
                              <Select
                                value={currentPage.action}
                                onValueChange={(v) => updatePageField(currentPage.pageNumber, "action", v)}
                              >
                                <SelectTrigger className="text-xs" data-testid="select-conflict-action">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="supersede">
                                    Supersede existing
                                  </SelectItem>
                                  <SelectItem value="skip">Skip this page</SelectItem>
                                  <SelectItem value="keep_both">Keep both versions</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="p-3 border-t">
                        <Button
                          className="w-full"
                          onClick={() => confirmPage(currentPage.pageNumber)}
                          disabled={!currentPage.selected}
                          data-testid="button-confirm-page"
                        >
                          {currentPage.confirmed ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Re-confirm Page {currentPage.pageNumber}
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Confirm Page {currentPage.pageNumber}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col h-full border rounded-md min-w-0">
                      <div className="p-2 border-b bg-muted/30 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Page Preview</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" 
                            onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))}
                            data-testid="button-zoom-out">
                            <ZoomOut className="h-3.5 w-3.5" />
                          </Button>
                          <span className="text-xs text-muted-foreground w-10 text-center">
                            {Math.round(previewZoom * 100)}%
                          </span>
                          <Button size="icon" variant="ghost" 
                            onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))}
                            data-testid="button-zoom-in">
                            <ZoomIn className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" 
                            onClick={() => setPreviewZoom(1)}
                            data-testid="button-zoom-reset">
                            <span className="text-[10px]">1:1</span>
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto bg-muted/10 flex items-start justify-center p-4">
                        {currentPage.thumbnail ? (
                          <img
                            src={`data:image/png;base64,${currentPage.thumbnail}`}
                            alt={`Page ${currentPage.pageNumber} preview`}
                            className="border shadow-sm bg-white"
                            style={{
                              transform: `scale(${previewZoom})`,
                              transformOrigin: "top center",
                              maxWidth: "100%",
                            }}
                            data-testid="img-page-preview"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <FileText className="h-16 w-16 mb-4" />
                            <p className="text-sm">Preview not available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Select a page from the list to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="overflow-y-auto h-full p-1 space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Registration Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Source File</p>
                      <p className="text-sm font-medium truncate">{selectedFile?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Drawings to Register</p>
                      <p className="text-sm font-medium">{selectedCount} of {pages.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Confirmed</p>
                      <p className="text-sm font-medium">{confirmedCount} of {selectedCount}</p>
                    </div>
                    {globalJobId && globalJobId !== "__none__" && (
                      <div>
                        <p className="text-xs text-muted-foreground">Default Job</p>
                        <p className="text-sm font-medium truncate">
                          {analysisResult?.jobs.find((j) => j.id === globalJobId)?.name || globalJobId}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="rounded-md border overflow-auto max-h-[40vh]">
                    <div className="grid grid-cols-[2.5rem_1fr_1fr_3.5rem_3.5rem_5rem_5rem_4rem] bg-muted/50 sticky top-0 z-10 border-b text-xs font-medium">
                      <div className="p-2">Pg</div>
                      <div className="p-2">Drawing No.</div>
                      <div className="p-2">Title</div>
                      <div className="p-2">Rev</div>
                      <div className="p-2">Ver</div>
                      <div className="p-2">Job</div>
                      <div className="p-2">Status</div>
                      <div className="p-2">Action</div>
                    </div>
                    {pages.filter((p) => p.selected).map((page) => {
                      const effectiveJobId = page.jobId || globalJobId;
                      const jobName = effectiveJobId && effectiveJobId !== "__none__"
                        ? analysisResult?.jobs.find((j) => j.id === effectiveJobId)?.name || ""
                        : "";
                      return (
                        <div key={page.pageNumber} className="grid grid-cols-[2.5rem_1fr_1fr_3.5rem_3.5rem_5rem_5rem_4rem] border-b text-sm items-center" data-testid={`confirm-row-${page.pageNumber}`}>
                          <div className="p-2 text-muted-foreground">{page.pageNumber}</div>
                          <div className="p-2 font-mono truncate">{page.drawingNumber || "-"}</div>
                          <div className="p-2 truncate">{page.title || "-"}</div>
                          <div className="p-2 font-mono">{page.revision || "-"}</div>
                          <div className="p-2 font-mono">{page.version || "1.0"}</div>
                          <div className="p-2 truncate text-xs">{jobName || "-"}</div>
                          <div className="p-2">
                            {page.confirmed ? (
                              <Badge variant="secondary" className="text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                                Confirmed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Pending</Badge>
                            )}
                          </div>
                          <div className="p-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {page.conflictDocument ? page.action : "register"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-3 border-t flex-wrap">
          <div className="flex items-center gap-2">
            {step !== "upload" && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === "confirm") setStep("review");
                  else setStep("upload");
                }}
                disabled={analyzeMutation.isPending || registerMutation.isPending}
                data-testid="button-back"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel-drawing-package">
              Cancel
            </Button>
            {step === "upload" && (
              <Button
                onClick={handleAnalyze}
                disabled={!selectedFile || analyzeMutation.isPending}
                data-testid="button-analyze"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Analyze PDF
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
            {step === "review" && (
              <Button
                onClick={() => setStep("confirm")}
                disabled={selectedCount === 0}
                data-testid="button-next-confirm"
              >
                Review & Confirm
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === "confirm" && (
              <Button
                onClick={() => registerMutation.mutate()}
                disabled={registerMutation.isPending || selectedCount === 0}
                data-testid="button-register-drawings"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Register {selectedCount} Drawing{selectedCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
