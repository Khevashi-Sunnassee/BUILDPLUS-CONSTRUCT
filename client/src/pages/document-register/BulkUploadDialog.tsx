import { useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Loader2,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Files,
  Trash2,
  ArrowUpCircle,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, getCsrfToken, apiRequest } from "@/lib/queryClient";
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

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DuplicateInfo {
  id: string;
  title: string;
  version: string;
  revision: string;
  documentNumber: string;
  status: string;
}

interface FileEntry {
  file: File;
  title: string;
  documentNumber: string;
  revision: string;
  version: string;
  aiProcessed: boolean;
  aiLoading: boolean;
  duplicateInfo?: DuplicateInfo;
  supersedeDocumentId?: string;
  skipUpload?: boolean;
}

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
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

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const maxFiles = 50;
    const maxSize = 25 * 1024 * 1024;

    setFiles((prev) => {
      const remaining = maxFiles - prev.length;
      if (remaining <= 0) {
        toast({ title: "Limit Reached", description: `Maximum ${maxFiles} files allowed`, variant: "destructive" });
        return prev;
      }

      const toAdd = fileArray.slice(0, remaining);
      const oversized = toAdd.filter((f) => f.size > maxSize);
      if (oversized.length > 0) {
        toast({
          title: "File Too Large",
          description: `${oversized.length} file(s) exceed 25MB limit and were skipped`,
          variant: "destructive",
        });
      }

      const valid = toAdd.filter((f) => f.size <= maxSize);
      const entries: FileEntry[] = valid.map((file) => ({
        file,
        title: file.name.replace(/\.[^/.]+$/, ""),
        documentNumber: "",
        revision: "",
        version: "1.0",
        aiProcessed: false,
        aiLoading: false,
      }));
      return [...prev, ...entries];
    });
  }, [toast]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateFileEntry = useCallback((index: number, updates: Partial<FileEntry>) => {
    setFiles((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...updates } : entry))
    );
  }, []);

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
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }, [addFiles]);

  const [isExtracting, setIsExtracting] = useState(false);

  const extractMetadata = useCallback(async () => {
    if (files.length === 0) return;

    setIsExtracting(true);
    setFiles((prev) => prev.map((f) => ({ ...f, aiLoading: true })));

    try {
      const formData = new FormData();
      files.forEach((entry) => {
        formData.append("files", entry.file);
      });

      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.EXTRACT_METADATA, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to extract metadata");
      }

      const data = await response.json();
      const results = data.results as Array<{
        fileName: string;
        title: string;
        documentNumber: string;
        revision: string;
        version: string;
        success: boolean;
      }>;

      setFiles((prev) =>
        prev.map((entry) => {
          const result = results.find((r) => r.fileName === entry.file.name);
          if (result) {
            return {
              ...entry,
              title: result.title || entry.title,
              documentNumber: result.documentNumber || entry.documentNumber,
              revision: result.revision || entry.revision,
              version: result.version || entry.version,
              aiProcessed: true,
              aiLoading: false,
            };
          }
          return { ...entry, aiLoading: false };
        })
      );

      const successCount = results.filter((r) => r.success).length;
      toast({
        title: "AI Analysis Complete",
        description: `Extracted metadata from ${successCount}/${results.length} files`,
      });

      setTimeout(() => {
        checkForDuplicatesAfterExtract(results);
      }, 100);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to extract metadata from files",
        variant: "destructive",
      });
      setFiles((prev) => prev.map((f) => ({ ...f, aiLoading: false })));
    } finally {
      setIsExtracting(false);
    }
  }, [files, toast]);

  const checkForDuplicatesAfterExtract = useCallback(async (results: Array<{ fileName: string; documentNumber: string; success: boolean }>) => {
    const docNumbers = results
      .filter((r) => r.success && r.documentNumber)
      .map((r) => r.documentNumber.trim())
      .filter((n) => n.length > 0);

    if (docNumbers.length === 0) return;

    const uniqueNumbers = [...new Set(docNumbers)];

    try {
      const response = await apiRequest("POST", DOCUMENT_ROUTES.CHECK_DUPLICATES, {
        documentNumbers: uniqueNumbers,
      });
      const data = await response.json();
      const duplicates = data.duplicates || {};

      setFiles((prev) =>
        prev.map((entry) => {
          const trimmed = entry.documentNumber?.trim();
          if (trimmed && duplicates[trimmed] && duplicates[trimmed].length > 0) {
            return {
              ...entry,
              duplicateInfo: duplicates[trimmed][0],
            };
          }
          return entry;
        })
      );

      const dupCount = Object.keys(duplicates).length;
      if (dupCount > 0) {
        toast({
          title: "Duplicates Found",
          description: `${dupCount} document number(s) already exist. Choose to supersede or skip each.`,
          variant: "destructive",
        });
      }
    } catch {
    }
  }, [toast]);

  const checkForDuplicates = useCallback(async () => {
    const docNumbers = files
      .map((f) => f.documentNumber?.trim())
      .filter((n): n is string => !!n && n.length > 0);

    if (docNumbers.length === 0) return;

    const uniqueNumbers = [...new Set(docNumbers)];

    try {
      const response = await apiRequest("POST", DOCUMENT_ROUTES.CHECK_DUPLICATES, {
        documentNumbers: uniqueNumbers,
      });
      const data = await response.json();
      const duplicates = data.duplicates || {};

      setFiles((prev) =>
        prev.map((entry) => {
          const trimmed = entry.documentNumber?.trim();
          if (trimmed && duplicates[trimmed] && duplicates[trimmed].length > 0) {
            const existing = duplicates[trimmed][0];
            return {
              ...entry,
              duplicateInfo: existing,
              supersedeDocumentId: undefined,
              skipUpload: undefined,
            };
          }
          return {
            ...entry,
            duplicateInfo: undefined,
            supersedeDocumentId: undefined,
            skipUpload: undefined,
          };
        })
      );

      const dupCount = Object.keys(duplicates).length;
      if (dupCount > 0) {
        toast({
          title: "Duplicates Found",
          description: `${dupCount} document number(s) already exist. Choose to supersede or skip each.`,
          variant: "destructive",
        });
      }
    } catch {
    }
  }, [files, toast]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const filesToUpload = files.filter((f) => !f.skipUpload);
      if (filesToUpload.length === 0) {
        throw new Error("No files to upload (all were skipped)");
      }

      const formData = new FormData();
      filesToUpload.forEach((entry) => {
        formData.append("files", entry.file);
      });

      const metadata = filesToUpload.map((entry) => ({
        fileName: entry.file.name,
        title: entry.title,
        documentNumber: entry.documentNumber,
        revision: entry.revision,
        version: entry.version,
        supersedeDocumentId: entry.supersedeDocumentId || undefined,
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
      const response = await fetch(DOCUMENT_ROUTES.BULK_UPLOAD, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Bulk upload failed");
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

  const handleClose = useCallback(() => {
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

  const clearValue = "_clear_";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" />
            Add Multiple Documents
          </DialogTitle>
          <DialogDescription>
            Drag and drop files, set shared metadata, then use AI to extract titles and document numbers
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-4 pr-1">
          <div
            className={`border-2 border-dashed rounded-md text-center cursor-pointer transition-colors flex-shrink-0 ${
              files.length > 0 ? "p-3" : "p-6"
            } ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="bulk-upload-dropzone"
          >
            {files.length === 0 ? (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max 50 files, 25MB each
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Upload className="h-3.5 w-3.5" />
                Drop more files or click to add (max 50)
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFileSelect}
              data-testid="bulk-upload-file-input"
            />
          </div>

          {files.length > 0 && (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{files.length} file{files.length !== 1 ? "s" : ""}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatFileSize(files.reduce((sum, f) => sum + f.file.size, 0))} total
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={extractMetadata}
                    disabled={isExtracting || files.length === 0}
                    data-testid="button-ai-extract"
                  >
                    {isExtracting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    AI Extract Metadata
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkForDuplicates}
                    disabled={files.length === 0 || !files.some((f) => f.documentNumber?.trim())}
                    data-testid="button-check-duplicates"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Check Duplicates
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiles([])}
                    data-testid="button-clear-files"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="border rounded-md flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">File</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[140px]">Doc Number</TableHead>
                        <TableHead className="w-[70px]">Rev</TableHead>
                        <TableHead className="w-[70px]">Ver</TableHead>
                        <TableHead className="w-[50px]">Status</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((entry, index) => (
                        <TableRow key={`${entry.file.name}-${index}`} className={entry.skipUpload ? "opacity-50" : entry.duplicateInfo && !entry.supersedeDocumentId ? "bg-yellow-500/5" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="text-sm truncate max-w-[150px]" title={entry.file.name}>
                                  {entry.file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(entry.file.size)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.title}
                              onChange={(e) => updateFileEntry(index, { title: e.target.value })}
                              className="h-8 text-sm"
                              disabled={entry.skipUpload}
                              data-testid={`input-title-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.documentNumber}
                              onChange={(e) => updateFileEntry(index, { documentNumber: e.target.value, duplicateInfo: undefined, supersedeDocumentId: undefined, skipUpload: undefined })}
                              className="h-8 text-sm"
                              placeholder="Auto"
                              disabled={entry.skipUpload}
                              data-testid={`input-doc-number-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.revision}
                              onChange={(e) => updateFileEntry(index, { revision: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="A"
                              disabled={entry.skipUpload}
                              data-testid={`input-revision-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.version}
                              onChange={(e) => updateFileEntry(index, { version: e.target.value })}
                              className="h-8 text-sm"
                              disabled={entry.skipUpload}
                              data-testid={`input-version-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            {entry.skipUpload ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Ban className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>Skipped</TooltipContent>
                              </Tooltip>
                            ) : entry.duplicateInfo && entry.supersedeDocumentId ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <ArrowUpCircle className="h-4 w-4 text-blue-500" />
                                </TooltipTrigger>
                                <TooltipContent>Will supersede v{entry.duplicateInfo.version}{entry.duplicateInfo.revision}</TooltipContent>
                              </Tooltip>
                            ) : entry.duplicateInfo ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    <div>Duplicate: {entry.duplicateInfo.title}</div>
                                    <div>v{entry.duplicateInfo.version}{entry.duplicateInfo.revision} ({entry.duplicateInfo.status})</div>
                                    <div className="flex gap-1 pt-1">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="h-6 text-xs"
                                        onClick={() => updateFileEntry(index, { supersedeDocumentId: entry.duplicateInfo!.id })}
                                        data-testid={`button-supersede-${index}`}
                                      >
                                        Supersede
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-xs"
                                        onClick={() => updateFileEntry(index, { skipUpload: true })}
                                        data-testid={`button-skip-${index}`}
                                      >
                                        Skip
                                      </Button>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : entry.aiLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : entry.aiProcessed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(index)}
                              data-testid={`button-remove-file-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {files.some((f) => f.duplicateInfo && !f.supersedeDocumentId && !f.skipUpload) && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Some files have duplicate document numbers. Hover over the warning icon to choose <strong>Supersede</strong> or <strong>Skip</strong> for each.
                  </p>
                  <div className="flex gap-1 ml-auto flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFiles((prev) =>
                          prev.map((f) =>
                            f.duplicateInfo && !f.supersedeDocumentId && !f.skipUpload
                              ? { ...f, supersedeDocumentId: f.duplicateInfo!.id }
                              : f
                          )
                        );
                      }}
                      data-testid="button-supersede-all"
                    >
                      Supersede All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFiles((prev) =>
                          prev.map((f) =>
                            f.duplicateInfo && !f.supersedeDocumentId && !f.skipUpload
                              ? { ...f, skipUpload: true }
                              : f
                          )
                        );
                      }}
                      data-testid="button-skip-all-duplicates"
                    >
                      Skip All
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3 flex-shrink-0">
                <Label className="text-sm font-medium">Shared Metadata (applied to all files)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Job</Label>
                    <Select value={jobId} onValueChange={(v) => setJobId(v === clearValue ? "" : v)}>
                      <SelectTrigger data-testid="bulk-select-job">
                        <SelectValue placeholder="Select job" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={clearValue}>None</SelectItem>
                        {jobs.slice().sort((a, b) => (a.jobNumber || "").localeCompare(b.jobNumber || "")).map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.jobNumber} - {job.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Document Type</Label>
                    <Select value={typeId} onValueChange={(v) => setTypeId(v === clearValue ? "" : v)}>
                      <SelectTrigger data-testid="bulk-select-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={clearValue}>None</SelectItem>
                        {documentTypes.slice().sort((a, b) => (a.typeName || "").localeCompare(b.typeName || "")).map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.prefix} - {type.typeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Discipline</Label>
                    <Select value={disciplineId} onValueChange={(v) => setDisciplineId(v === clearValue ? "" : v)}>
                      <SelectTrigger data-testid="bulk-select-discipline">
                        <SelectValue placeholder="Select discipline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={clearValue}>None</SelectItem>
                        {disciplines.slice().sort((a, b) => (a.disciplineName || "").localeCompare(b.disciplineName || "")).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.shortForm || d.disciplineName} - {d.disciplineName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Select value={categoryId} onValueChange={(v) => setCategoryId(v === clearValue ? "" : v)}>
                      <SelectTrigger data-testid="bulk-select-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={clearValue}>None</SelectItem>
                        {categories.slice().sort((a, b) => (a.categoryName || "").localeCompare(b.categoryName || "")).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.categoryName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Panel</Label>
                    <Select value={panelId} onValueChange={(v) => setPanelId(v === clearValue ? "" : v)}>
                      <SelectTrigger data-testid="bulk-select-panel">
                        <SelectValue placeholder="Select panel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={clearValue}>None</SelectItem>
                        {panels.slice().sort((a, b) => (a.panelMark || "").localeCompare(b.panelMark || "")).map((panel) => (
                          <SelectItem key={panel.id} value={panel.id}>
                            {panel.panelMark}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Supplier</Label>
                    <Select value={supplierId} onValueChange={(v) => setSupplierId(v === clearValue ? "" : v)}>
                      <SelectTrigger data-testid="bulk-select-supplier">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={clearValue}>None</SelectItem>
                        {suppliers.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Purchase Order</Label>
                    <Select value={purchaseOrderId} onValueChange={(v) => setPurchaseOrderId(v === clearValue ? "" : v)}>
                      <SelectTrigger data-testid="bulk-select-purchase-order">
                        <SelectValue placeholder="Select PO" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={clearValue}>None</SelectItem>
                        {purchaseOrders.slice().sort((a, b) => (a.poNumber || "").localeCompare(b.poNumber || "")).map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.poNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Task</Label>
                    <Select value={taskId} onValueChange={(v) => setTaskId(v === clearValue ? "" : v)}>
                      <SelectTrigger data-testid="bulk-select-task">
                        <SelectValue placeholder="Select task" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={clearValue}>None</SelectItem>
                        {tasks.slice().sort((a, b) => (a.title || "").localeCompare(b.title || "")).map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tags</Label>
                    <Input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="Comma-separated"
                      data-testid="bulk-input-tags"
                    />
                  </div>

                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      checked={isConfidential}
                      onCheckedChange={setIsConfidential}
                      data-testid="bulk-switch-confidential"
                    />
                    <Label className="text-xs text-muted-foreground">Confidential</Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel-bulk">
            Cancel
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={
              uploadMutation.isPending ||
              files.length === 0 ||
              files.filter((f) => !f.skipUpload).length === 0 ||
              files.some((f) => f.duplicateInfo && !f.supersedeDocumentId && !f.skipUpload)
            }
            data-testid="button-submit-bulk-upload"
          >
            {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Upload {files.filter((f) => !f.skipUpload).length} Document{files.filter((f) => !f.skipUpload).length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
