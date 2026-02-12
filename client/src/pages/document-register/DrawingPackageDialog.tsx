import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Loader2,
  X,
  AlertTriangle,
  Check,
  ChevronRight,
  ChevronLeft,
  Pencil,
  SkipForward,
  Replace,
  Copy,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DOCUMENT_ROUTES } from "@shared/api-routes";

interface AnalyzedPage {
  pageNumber: number;
  drawingNumber: string;
  title: string;
  revision: string;
  scale: string;
  projectName: string;
  projectNumber: string;
  discipline: string;
  level: string;
  client: string;
  date: string;
  conflictAction: string;
  conflictDocument: {
    id: string;
    title: string;
    revision: string;
    version: string;
  } | null;
  selected: boolean;
  action: string;
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

type WizardStep = "upload" | "review" | "configure" | "confirm";

export function DrawingPackageDialog({ open, onOpenChange }: DrawingPackageDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [pages, setPages] = useState<AnalyzedPage[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
      }));
      setPages(pagesWithSelection);
      if (data.matchedJob?.id) {
        setSelectedJobId(data.matchedJob.id);
      }
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
      formData.append("jobId", selectedJobId || "");
      formData.append("drawings", JSON.stringify(selectedPages.map((p) => ({
        pageNumber: p.pageNumber,
        drawingNumber: p.drawingNumber,
        title: p.title,
        revision: p.revision,
        scale: p.scale,
        projectName: p.projectName,
        discipline: p.discipline,
        level: p.level,
        client: p.client,
        date: p.date,
        action: p.action,
        conflictDocumentId: p.conflictDocument?.id || null,
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
    setSelectedJobId("");
    setEditingPage(null);
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
    if (selectedFile) {
      analyzeMutation.mutate(selectedFile);
    }
  };

  const togglePageSelection = (pageNum: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, selected: !p.selected } : p))
    );
  };

  const toggleAllPages = (selected: boolean) => {
    setPages((prev) => prev.map((p) => ({ ...p, selected })));
  };

  const updatePageField = (pageNum: number, field: string, value: string) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, [field]: value } : p))
    );
  };

  const selectedCount = pages.filter((p) => p.selected).length;
  const conflictCount = pages.filter((p) => p.conflictDocument).length;

  const stepLabels: Record<WizardStep, string> = {
    upload: "Upload PDF",
    review: "Review Drawings",
    configure: "Configure",
    confirm: "Confirm",
  };

  const steps: WizardStep[] = ["upload", "review", "configure", "confirm"];
  const currentStepIndex = steps.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col" data-testid="dialog-drawing-package">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Drawing Package Processor
          </DialogTitle>
          <DialogDescription>
            Upload a multi-page PDF to extract and register individual drawings
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 mb-4" data-testid="wizard-steps">
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
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {step === "upload" && (
            <div className="space-y-4 p-1">
              <Card>
                <CardContent className="pt-6">
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "hover-elevate"
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
                    <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
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
                        onClick={() => setSelectedFile(null)}
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
            <div className="space-y-4 p-1">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{analysisResult.totalPages} pages</Badge>
                  <Badge variant="secondary">{selectedCount} selected</Badge>
                  {conflictCount > 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {conflictCount} conflicts
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleAllPages(true)} data-testid="button-select-all">
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleAllPages(false)} data-testid="button-deselect-all">
                    Deselect All
                  </Button>
                </div>
              </div>

              {analysisResult.matchedJob && (
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Matched Job:</span>
                      <span>{analysisResult.matchedJob.name}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={pages.every((p) => p.selected)}
                          onCheckedChange={(checked) => toggleAllPages(!!checked)}
                          data-testid="checkbox-select-all-drawings"
                        />
                      </TableHead>
                      <TableHead className="w-12">Page</TableHead>
                      <TableHead>Drawing No.</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-16">Rev</TableHead>
                      <TableHead className="w-24">Discipline</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((page) => (
                      <TableRow
                        key={page.pageNumber}
                        className={!page.selected ? "opacity-50" : ""}
                        data-testid={`row-drawing-${page.pageNumber}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={page.selected}
                            onCheckedChange={() => togglePageSelection(page.pageNumber)}
                            data-testid={`checkbox-drawing-${page.pageNumber}`}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{page.pageNumber}</TableCell>
                        <TableCell>
                          {editingPage === page.pageNumber ? (
                            <Input
                              value={page.drawingNumber}
                              onChange={(e) => updatePageField(page.pageNumber, "drawingNumber", e.target.value)}
                              className="h-8"
                              data-testid={`input-drawing-number-${page.pageNumber}`}
                            />
                          ) : (
                            <span className="font-mono text-sm">{page.drawingNumber || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingPage === page.pageNumber ? (
                            <Input
                              value={page.title}
                              onChange={(e) => updatePageField(page.pageNumber, "title", e.target.value)}
                              className="h-8"
                              data-testid={`input-title-${page.pageNumber}`}
                            />
                          ) : (
                            <span className="text-sm">{page.title || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingPage === page.pageNumber ? (
                            <Input
                              value={page.revision}
                              onChange={(e) => updatePageField(page.pageNumber, "revision", e.target.value)}
                              className="h-8 w-14"
                              data-testid={`input-revision-${page.pageNumber}`}
                            />
                          ) : (
                            <span className="font-mono text-sm">{page.revision || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{page.discipline || "-"}</span>
                        </TableCell>
                        <TableCell>
                          {page.conflictDocument ? (
                            <div className="space-y-1">
                              <Badge
                                variant="outline"
                                className={
                                  page.action === "supersede"
                                    ? "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30"
                                    : page.action === "skip"
                                    ? "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                                    : "text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30"
                                }
                              >
                                {page.action === "supersede" && <Replace className="h-3 w-3 mr-1" />}
                                {page.action === "skip" && <SkipForward className="h-3 w-3 mr-1" />}
                                {page.action === "keep_both" && <Copy className="h-3 w-3 mr-1" />}
                                {page.action}
                              </Badge>
                              <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                                vs Rev {page.conflictDocument.revision}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-xs">New</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingPage(editingPage === page.pageNumber ? null : page.pageNumber)}
                            data-testid={`button-edit-drawing-${page.pageNumber}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {step === "configure" && (
            <div className="space-y-6 p-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Job Assignment</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger data-testid="select-job">
                      <SelectValue placeholder="Select a job (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(analysisResult?.jobs || []).map((job: any) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.jobNumber ? `${job.jobNumber} - ${job.name}` : job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {analysisResult?.matchedJob && selectedJobId === analysisResult.matchedJob.id && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" />
                      Auto-matched from drawing metadata
                    </p>
                  )}
                </CardContent>
              </Card>

              {conflictCount > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Conflict Resolution ({conflictCount})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pages
                      .filter((p) => p.conflictDocument)
                      .map((page) => (
                        <div
                          key={page.pageNumber}
                          className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted flex-wrap"
                          data-testid={`conflict-row-${page.pageNumber}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{page.drawingNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              New Rev {page.revision} vs Existing Rev {page.conflictDocument?.revision}
                            </p>
                          </div>
                          <Select
                            value={page.action}
                            onValueChange={(val) => updatePageField(page.pageNumber, "action", val)}
                          >
                            <SelectTrigger className="w-[140px]" data-testid={`select-action-${page.pageNumber}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="supersede">Supersede</SelectItem>
                              <SelectItem value="skip">Skip</SelectItem>
                              <SelectItem value="keep_both">Keep Both</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4 p-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Source File</p>
                      <p className="text-sm font-medium">{selectedFile?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Drawings to Register</p>
                      <p className="text-sm font-medium">{selectedCount} of {pages.length}</p>
                    </div>
                    {selectedJobId && (
                      <div>
                        <p className="text-sm text-muted-foreground">Target Job</p>
                        <p className="text-sm font-medium">
                          {(analysisResult?.jobs || []).find((j: any) => j.id === selectedJobId)?.name || selectedJobId}
                        </p>
                      </div>
                    )}
                    {conflictCount > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Conflicts</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">
                            {pages.filter((p) => p.action === "supersede").length} supersede
                          </Badge>
                          <Badge variant="secondary">
                            {pages.filter((p) => p.action === "skip" && p.conflictDocument).length} skip
                          </Badge>
                          <Badge variant="secondary">
                            {pages.filter((p) => p.action === "keep_both").length} keep both
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="rounded-md border overflow-auto max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Drawing No.</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Rev</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pages
                          .filter((p) => p.selected)
                          .map((page) => (
                            <TableRow key={page.pageNumber} data-testid={`confirm-row-${page.pageNumber}`}>
                              <TableCell className="font-mono text-sm">{page.drawingNumber || "-"}</TableCell>
                              <TableCell className="text-sm">{page.title || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">{page.revision || "-"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {page.conflictDocument ? page.action : "register"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-4 border-t flex-wrap">
          <div className="flex items-center gap-2">
            {step !== "upload" && (
              <Button
                variant="outline"
                onClick={() => setStep(steps[currentStepIndex - 1])}
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
                onClick={() => setStep("configure")}
                disabled={selectedCount === 0}
                data-testid="button-next-configure"
              >
                Configure
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === "configure" && (
              <Button onClick={() => setStep("confirm")} data-testid="button-next-confirm">
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
