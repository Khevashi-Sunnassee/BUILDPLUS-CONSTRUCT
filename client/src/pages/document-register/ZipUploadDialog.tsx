import { useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileArchive,
  Upload,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Files,
  Trash2,
  FileText,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DOCUMENT_ROUTES, JOBS_ROUTES, PANELS_ROUTES, PROCUREMENT_ROUTES, TASKS_ROUTES } from "@shared/api-routes";
import {
  formatFileSize,
  type DocumentTypeConfig,
  type DocumentDiscipline,
  type DocumentCategory,
  type Job,
  type PanelRegister,
  type Supplier,
  type PurchaseOrder,
  type Task,
} from "./types";

interface ZipUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExtractedFile {
  fileName: string;
  entryPath: string;
  fileSize: number;
  mimeType: string;
  title: string;
  documentNumber: string;
  revision: string;
  version: string;
  extension: string;
  selected: boolean;
}

type Step = "upload" | "review";

export function ZipUploadDialog({ open, onOpenChange }: ZipUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const [typeId, setTypeId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [jobId, setJobId] = useState("");
  const [panelId, setPanelId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [tags, setTags] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);

  const { data: documentTypes = [] } = useQuery<DocumentTypeConfig[]>({
    queryKey: [DOCUMENT_ROUTES.TYPES_ACTIVE],
  });

  const { data: disciplines = [] } = useQuery<DocumentDiscipline[]>({
    queryKey: [DOCUMENT_ROUTES.DISCIPLINES_ACTIVE],
  });

  const { data: categories = [] } = useQuery<DocumentCategory[]>({
    queryKey: [DOCUMENT_ROUTES.CATEGORIES_ACTIVE],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: panels = [] } = useQuery<PanelRegister[]>({
    queryKey: [PANELS_ROUTES.LIST],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: [TASKS_ROUTES.LIST],
  });

  const extractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.ZIP_UPLOAD_EXTRACT, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to extract ZIP file");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const extractedFiles: ExtractedFile[] = data.files.map((f: any) => ({
        ...f,
        selected: true,
      }));
      setFiles(extractedFiles);
      setStep("review");
      toast({
        title: "ZIP Extracted",
        description: `Found ${extractedFiles.length} files in the archive`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!zipFile) throw new Error("No ZIP file");

      const selectedFiles = files.filter((f) => f.selected);
      if (selectedFiles.length === 0) throw new Error("No files selected for upload");

      const formData = new FormData();
      formData.append("file", zipFile);

      const metadata = selectedFiles.map((f) => ({
        fileName: f.fileName,
        entryPath: f.entryPath,
        title: f.title,
        documentNumber: f.documentNumber,
        revision: f.revision,
        version: f.version,
      }));
      formData.append("metadata", JSON.stringify(metadata));

      if (typeId) formData.append("typeId", typeId);
      if (disciplineId) formData.append("disciplineId", disciplineId);
      if (categoryId) formData.append("categoryId", categoryId);
      if (jobId) formData.append("jobId", jobId);
      if (panelId) formData.append("panelId", panelId);
      if (supplierId) formData.append("supplierId", supplierId);
      if (purchaseOrderId) formData.append("purchaseOrderId", purchaseOrderId);
      if (taskId) formData.append("taskId", taskId);
      if (tags) formData.append("tags", tags);
      formData.append("isConfidential", String(isConfidential));

      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.ZIP_UPLOAD_REGISTER, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "ZIP upload failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const { uploaded, errors, total } = data;
      toast({
        title: "Bulk Upload Complete",
        description: `${uploaded.length}/${total} documents uploaded successfully${errors.length > 0 ? `. ${errors.length} failed.` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleZipSelect = useCallback((file: File) => {
    if (!file.name.endsWith(".zip") && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
      toast({ title: "Invalid File", description: "Please select a ZIP file", variant: "destructive" });
      return;
    }
    if (file.size > 3 * 1024 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "ZIP file must be under 3GB", variant: "destructive" });
      return;
    }
    setZipFile(file);
    extractMutation.mutate(file);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleZipSelect(file);
  }, [handleZipSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleZipSelect(file);
    e.target.value = "";
  }, [handleZipSelect]);

  const updateFileEntry = useCallback((index: number, updates: Partial<ExtractedFile>) => {
    setFiles((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...updates } : entry))
    );
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setFiles((prev) => prev.map((f) => ({ ...f, selected: checked })));
  }, []);

  const handleClose = useCallback(() => {
    setStep("upload");
    setZipFile(null);
    setFiles([]);
    setTypeId("");
    setDisciplineId("");
    setCategoryId("");
    setJobId("");
    setPanelId("");
    setSupplierId("");
    setPurchaseOrderId("");
    setTaskId("");
    setTags("");
    setIsConfidential(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const selectedCount = files.filter((f) => f.selected).length;
  const allSelected = files.length > 0 && selectedCount === files.length;
  const clearValue = "_clear_";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Bulk Upload ZIP File
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload a ZIP file containing documents. All files will be extracted and listed for review."
              : `Review ${files.length} extracted files. Edit titles, document numbers, and revisions before uploading.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-4 pr-1">
          {step === "upload" && (
            <div
              className={`border-2 border-dashed rounded-md p-10 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="zip-upload-dropzone"
            >
              {extractMutation.isPending ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Extracting files from ZIP...</p>
                </div>
              ) : (
                <>
                  <FileArchive className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop a ZIP file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max ZIP size: 3GB. Supported file types inside: PDF, DOC, XLS, images, CAD files, and more.
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFileInput}
                data-testid="zip-upload-file-input"
              />
            </div>
          )}

          {step === "review" && files.length > 0 && (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedCount} of {files.length} selected</Badge>
                  {zipFile && (
                    <span className="text-sm text-muted-foreground">
                      from {zipFile.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setStep("upload"); setFiles([]); setZipFile(null); }}
                    data-testid="button-change-zip"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Change ZIP
                  </Button>
                </div>
              </div>

              <div className="border rounded-md flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => toggleAll(!!checked)}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead className="w-[200px]">File</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[140px]">Doc Number</TableHead>
                        <TableHead className="w-[70px]">Rev</TableHead>
                        <TableHead className="w-[70px]">Ver</TableHead>
                        <TableHead className="w-[80px]">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((entry, index) => (
                        <TableRow key={`${entry.fileName}-${index}`} className={!entry.selected ? "opacity-50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={entry.selected}
                              onCheckedChange={(checked) => updateFileEntry(index, { selected: !!checked })}
                              data-testid={`checkbox-file-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="text-sm truncate max-w-[170px]" title={entry.fileName}>
                                  {entry.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(entry.fileSize)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.title}
                              onChange={(e) => updateFileEntry(index, { title: e.target.value })}
                              className="h-8 text-sm"
                              disabled={!entry.selected}
                              data-testid={`input-zip-title-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.documentNumber}
                              onChange={(e) => updateFileEntry(index, { documentNumber: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="Auto"
                              disabled={!entry.selected}
                              data-testid={`input-zip-doc-number-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.revision}
                              onChange={(e) => updateFileEntry(index, { revision: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="A"
                              disabled={!entry.selected}
                              data-testid={`input-zip-revision-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.version}
                              onChange={(e) => updateFileEntry(index, { version: e.target.value })}
                              className="h-8 text-sm"
                              disabled={!entry.selected}
                              data-testid={`input-zip-version-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              .{entry.extension}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div className="grid grid-cols-4 gap-3 flex-shrink-0">
                <div>
                  <Label className="text-xs">Document Type</Label>
                  <Select value={typeId} onValueChange={(v) => setTypeId(v === clearValue ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-zip-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={clearValue}>— None —</SelectItem>
                      {documentTypes.slice().sort((a, b) => (a.typeName || "").localeCompare(b.typeName || "")).map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.prefix} - {type.typeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Discipline</Label>
                  <Select value={disciplineId} onValueChange={(v) => setDisciplineId(v === clearValue ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-zip-discipline">
                      <SelectValue placeholder="Select discipline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={clearValue}>— None —</SelectItem>
                      {disciplines.slice().sort((a, b) => (a.disciplineName || "").localeCompare(b.disciplineName || "")).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.shortForm || d.disciplineName} - {d.disciplineName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={categoryId} onValueChange={(v) => setCategoryId(v === clearValue ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-zip-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={clearValue}>— None —</SelectItem>
                      {categories.slice().sort((a, b) => (a.categoryName || "").localeCompare(b.categoryName || "")).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Job</Label>
                  <Select value={jobId} onValueChange={(v) => setJobId(v === clearValue ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-zip-job">
                      <SelectValue placeholder="Select job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={clearValue}>— None —</SelectItem>
                      {jobs.slice().sort((a, b) => (a.jobNumber || "").localeCompare(b.jobNumber || "") || (a.name || "").localeCompare(b.name || "")).map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.jobNumber} - {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 flex-shrink-0">
                <div>
                  <Label className="text-xs">Panel</Label>
                  <Select value={panelId} onValueChange={(v) => setPanelId(v === clearValue ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-zip-panel">
                      <SelectValue placeholder="Select panel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={clearValue}>— None —</SelectItem>
                      {panels.slice().sort((a, b) => (a.panelMark || "").localeCompare(b.panelMark || "")).map((panel) => (
                        <SelectItem key={panel.id} value={panel.id}>
                          {panel.panelMark}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Supplier</Label>
                  <Select value={supplierId} onValueChange={(v) => setSupplierId(v === clearValue ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-zip-supplier">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={clearValue}>— None —</SelectItem>
                      {suppliers.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Purchase Order</Label>
                  <Select value={purchaseOrderId} onValueChange={(v) => setPurchaseOrderId(v === clearValue ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-zip-po">
                      <SelectValue placeholder="Select PO" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={clearValue}>— None —</SelectItem>
                      {purchaseOrders.slice().sort((a, b) => (a.poNumber || "").localeCompare(b.poNumber || "")).map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.poNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Task</Label>
                  <Select value={taskId} onValueChange={(v) => setTaskId(v === clearValue ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-zip-task">
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={clearValue}>— None —</SelectItem>
                      {tasks.slice().sort((a, b) => (a.title || "").localeCompare(b.title || "")).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex-1">
                  <Label className="text-xs">Tags</Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Comma-separated tags"
                    className="h-8 text-sm"
                    data-testid="input-zip-tags"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <Switch
                    checked={isConfidential}
                    onCheckedChange={setIsConfidential}
                    data-testid="switch-zip-confidential"
                  />
                  <Label className="text-xs">Confidential</Label>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {step === "review" && (
            <div className="flex items-center gap-2 w-full justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedCount} of {files.length} files will be uploaded
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleClose} data-testid="button-cancel-zip">
                  Cancel
                </Button>
                <Button
                  onClick={() => registerMutation.mutate()}
                  disabled={selectedCount === 0 || registerMutation.isPending}
                  data-testid="button-confirm-zip-upload"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading {selectedCount} files...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {selectedCount} Documents
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
