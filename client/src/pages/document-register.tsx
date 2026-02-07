import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";
import {
  FileText,
  Upload,
  Download,
  Eye,
  Search,
  Filter,
  Plus,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Package,
  FolderOpen,
  QrCode,
  Copy,
  ExternalLink,
  ChevronDown,
  Layers,
  Mail,
  Send,
  Paperclip,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DOCUMENT_ROUTES, JOBS_ROUTES, PANELS_ROUTES, PROCUREMENT_ROUTES, TASKS_ROUTES } from "@shared/api-routes";
import type { 
  Document, 
  DocumentTypeConfig, 
  DocumentDiscipline, 
  DocumentCategory,
  DocumentTypeStatus,
  DocumentWithDetails,
  Job,
  PanelRegister,
  Supplier,
  PurchaseOrder,
  Task
} from "@shared/schema";

const uploadFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  typeId: z.string().optional(),
  disciplineId: z.string().optional(),
  categoryId: z.string().optional(),
  documentTypeStatusId: z.string().optional(),
  jobId: z.string().optional(),
  panelId: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  taskId: z.string().optional(),
  tags: z.string().optional(),
  isConfidential: z.boolean().default(false),
});

type UploadFormValues = z.infer<typeof uploadFormSchema>;

const bundleFormSchema = z.object({
  bundleName: z.string().min(1, "Bundle name is required"),
  description: z.string().optional(),
  allowGuestAccess: z.boolean().default(true),
  expiresAt: z.string().optional(),
});

type BundleFormValues = z.infer<typeof bundleFormSchema>;

interface DocumentBundle {
  id: string;
  bundleName: string;
  description: string | null;
  qrCodeId: string;
  jobId: string | null;
  supplierId: string | null;
  allowGuestAccess: boolean;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    documentId: string;
    document?: DocumentWithDetails;
    addedAt: string;
  }>;
}

interface DocumentsResponse {
  documents: DocumentWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const statusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
  REVIEW: { label: "In Review", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
  SUPERSEDED: { label: "Superseded", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: History },
  ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: Package },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface SendDocumentsEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocuments: DocumentWithDetails[];
  onSuccess: () => void;
}

function SendDocumentsEmailDialog({ open, onOpenChange, selectedDocuments, onSuccess }: SendDocumentsEmailDialogProps) {
  const { toast } = useToast();
  const [toEmail, setToEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sendCopy, setSendCopy] = useState(false);

  const buildDocumentList = useCallback((docs: DocumentWithDetails[]) => {
    return docs.map((d) => `- ${d.title} (${d.originalName})`).join("\n");
  }, []);

  const resetForm = useCallback(() => {
    setToEmail("");
    setCcEmail("");
    setSubject("");
    setMessage("");
    setSendCopy(false);
  }, []);

  useEffect(() => {
    if (open && selectedDocuments.length > 0) {
      setToEmail("");
      setCcEmail("");
      setSendCopy(false);
      setSubject(`Documents - ${selectedDocuments.length} file${selectedDocuments.length > 1 ? "s" : ""} attached`);
      setMessage(
        `Hi,\n\nPlease find attached the documents you requested.\n\n${buildDocumentList(selectedDocuments)}\n\nKind regards`
      );
    }
  }, [open, selectedDocuments, buildDocumentList]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", DOCUMENT_ROUTES.SEND_DOCUMENTS_EMAIL, {
        to: toEmail,
        cc: ccEmail || undefined,
        subject,
        message,
        documentIds: selectedDocuments.map((d) => d.id),
        sendCopy,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Email sent", description: `Documents emailed to ${toEmail} (${data.attachedCount} files attached)` });
      onOpenChange(false);
      resetForm();
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: "Failed to send email", description: err.message || "An error occurred", variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!toEmail.trim()) {
      toast({ title: "Email required", description: "Please enter a recipient email address", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden" data-testid="dialog-send-documents-email">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2" data-testid="text-email-dialog-title">
            <Mail className="h-5 w-5" />
            Email Documents
          </DialogTitle>
          <DialogDescription>
            Send {selectedDocuments.length} document{selectedDocuments.length !== 1 ? "s" : ""} via email
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden" style={{ minHeight: "500px" }}>
          <div className="w-[420px] flex-shrink-0 border-r overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-email-to">To</Label>
              <Input
                id="doc-email-to"
                type="email"
                placeholder="recipient@example.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                data-testid="input-doc-email-to"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-email-cc">Cc</Label>
              <Input
                id="doc-email-cc"
                type="email"
                placeholder="cc@example.com"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                data-testid="input-doc-email-cc"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-email-subject">Subject</Label>
              <Input
                id="doc-email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="input-doc-email-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-email-message">Message</Label>
              <Textarea
                id="doc-email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className="resize-none text-sm"
                data-testid="input-doc-email-message"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="doc-send-copy"
                  checked={sendCopy}
                  onCheckedChange={(v) => setSendCopy(!!v)}
                  data-testid="checkbox-doc-send-copy"
                />
                <Label htmlFor="doc-send-copy" className="text-sm cursor-pointer">Send myself a copy</Label>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-doc-email">
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sendMutation.isPending} data-testid="button-send-doc-email">
                {sendMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send email
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
            <div className="flex border-b px-4">
              <div className="px-4 py-2.5 text-sm font-medium border-b-2 border-primary text-foreground">
                Email Preview
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <Card className="max-w-md mx-auto" data-testid="card-doc-email-preview">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center space-y-1">
                    <p className="text-lg font-semibold">Document Delivery</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDocuments.length} document{selectedDocuments.length !== 1 ? "s" : ""} attached
                    </p>
                  </div>
                  <Separator />
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {message}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>
                    {selectedDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border text-sm" data-testid={`email-attachment-${doc.id}`}>
                        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{doc.originalName} ({formatFileSize(doc.fileSize)})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentRegister() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [showLatestOnly, setShowLatestOnly] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [groupBy, setGroupBy] = useState<string>("job");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [selectedDocumentForVersion, setSelectedDocumentForVersion] = useState<DocumentWithDetails | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  
  const [versionHistoryDoc, setVersionHistoryDoc] = useState<DocumentWithDetails | null>(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  const [isBundleDialogOpen, setIsBundleDialogOpen] = useState(false);
  const [selectedDocsForBundle, setSelectedDocsForBundle] = useState<string[]>([]);
  const [createdBundle, setCreatedBundle] = useState<DocumentBundle | null>(null);
  const [isBundleViewOpen, setIsBundleViewOpen] = useState(false);
  const [isBundlesListOpen, setIsBundlesListOpen] = useState(false);
  const [selectedBundleForQR, setSelectedBundleForQR] = useState<DocumentBundle | null>(null);
  const [selectedBundleForView, setSelectedBundleForView] = useState<DocumentBundle | null>(null);
  const [deleteBundleDialogOpen, setDeleteBundleDialogOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<DocumentBundle | null>(null);
  const [isAnalyzingVersion, setIsAnalyzingVersion] = useState(false);
  const [aiVersionSummary, setAiVersionSummary] = useState("");

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const [isOverlayDialogOpen, setIsOverlayDialogOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<"overlay" | "side-by-side" | "both">("overlay");
  const [overlayDpi, setOverlayDpi] = useState(150);
  const [overlaySensitivity, setOverlaySensitivity] = useState(30);
  const [overlayPage, setOverlayPage] = useState(0);
  const [overlayResult, setOverlayResult] = useState<any>(null);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("limit", "25");
    if (search) params.append("search", search);
    if (statusFilter) params.append("status", statusFilter);
    if (typeFilter) params.append("typeId", typeFilter);
    if (disciplineFilter) params.append("disciplineId", disciplineFilter);
    if (jobFilter) params.append("jobId", jobFilter);
    params.append("showLatestOnly", String(showLatestOnly));
    return params.toString();
  }, [page, search, statusFilter, typeFilter, disciplineFilter, jobFilter, showLatestOnly]);

  const { data: documentsData, isLoading: documentsLoading } = useQuery<DocumentsResponse>({
    queryKey: [DOCUMENT_ROUTES.LIST, page, search, statusFilter, typeFilter, disciplineFilter, jobFilter, showLatestOnly],
    queryFn: async () => {
      const response = await fetch(`${DOCUMENT_ROUTES.LIST}?${buildQueryString()}`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
  });

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

  const { data: versionHistory = [] } = useQuery<Document[]>({
    queryKey: [DOCUMENT_ROUTES.VERSIONS(versionHistoryDoc?.id || "")],
    enabled: !!versionHistoryDoc?.id && isVersionHistoryOpen,
  });

  const { data: bundles = [], isLoading: bundlesLoading } = useQuery<DocumentBundle[]>({
    queryKey: [DOCUMENT_ROUTES.BUNDLES],
    enabled: isBundlesListOpen,
  });

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: "",
      description: "",
      typeId: "",
      disciplineId: "",
      categoryId: "",
      documentTypeStatusId: "",
      jobId: "",
      panelId: "",
      supplierId: "",
      purchaseOrderId: "",
      taskId: "",
      tags: "",
      isConfidential: false,
    },
  });

  const selectedUploadTypeId = uploadForm.watch("typeId");

  const { data: uploadTypeStatuses = [] } = useQuery<DocumentTypeStatus[]>({
    queryKey: [DOCUMENT_ROUTES.TYPE_STATUSES(selectedUploadTypeId || ""), selectedUploadTypeId],
    enabled: !!selectedUploadTypeId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.UPLOAD, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Document uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      setIsUploadOpen(false);
      setSelectedFile(null);
      uploadForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bundleForm = useForm<BundleFormValues>({
    resolver: zodResolver(bundleFormSchema),
    defaultValues: {
      bundleName: "",
      description: "",
      allowGuestAccess: true,
      expiresAt: "",
    },
  });

  const createBundleMutation = useMutation({
    mutationFn: async (data: BundleFormValues & { documentIds: string[] }) => {
      const response = await apiRequest("POST", DOCUMENT_ROUTES.BUNDLES, data);
      return response.json() as Promise<DocumentBundle>;
    },
    onSuccess: (bundle) => {
      toast({ title: "Success", description: "Document bundle created successfully" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.BUNDLES] });
      setIsBundleDialogOpen(false);
      setCreatedBundle(bundle);
      setIsBundleViewOpen(true);
      setSelectedDocsForBundle([]);
      bundleForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      await apiRequest("DELETE", DOCUMENT_ROUTES.BUNDLE_BY_ID(bundleId), {});
    },
    onSuccess: () => {
      toast({ title: "Bundle deleted" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.BUNDLES] });
      setDeleteBundleDialogOpen(false);
      setBundleToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: async ({ documentId, formData }: { documentId: string; formData: FormData }) => {
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.NEW_VERSION(documentId), {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "New version uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      setIsVersionDialogOpen(false);
      setSelectedDocumentForVersion(null);
      setVersionFile(null);
      setChangeSummary("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", DOCUMENT_ROUTES.STATUS(id), { status });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Status updated" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const visualDiffMutation = useMutation({
    mutationFn: async (params: {
      docId1: string;
      docId2: string;
      page?: number;
      dpi?: number;
      sensitivity?: number;
      mode?: "overlay" | "side-by-side" | "both";
    }) => {
      const response = await apiRequest("POST", DOCUMENT_ROUTES.VISUAL_DIFF, params);
      return response.json();
    },
    onSuccess: (data) => {
      setOverlayResult(data);
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
    },
    onError: (error: Error) => {
      toast({ title: "Comparison Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleUpload = (values: UploadFormValues) => {
    if (!selectedFile) {
      toast({ title: "Error", description: "Please select a file", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", values.title);
    if (values.description) formData.append("description", values.description);
    if (values.typeId) formData.append("typeId", values.typeId);
    if (values.disciplineId) formData.append("disciplineId", values.disciplineId);
    if (values.categoryId) formData.append("categoryId", values.categoryId);
    if (values.documentTypeStatusId) formData.append("documentTypeStatusId", values.documentTypeStatusId);
    if (values.jobId) formData.append("jobId", values.jobId);
    if (values.panelId) formData.append("panelId", values.panelId);
    if (values.supplierId) formData.append("supplierId", values.supplierId);
    if (values.purchaseOrderId) formData.append("purchaseOrderId", values.purchaseOrderId);
    if (values.taskId) formData.append("taskId", values.taskId);
    if (values.tags) formData.append("tags", values.tags);
    formData.append("isConfidential", String(values.isConfidential));

    uploadMutation.mutate(formData);
  };

  const handleAIAnalysis = async (file: File) => {
    if (!selectedDocumentForVersion) return;
    
    setIsAnalyzingVersion(true);
    setAiVersionSummary("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("originalDocumentId", selectedDocumentForVersion.id);
      
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.ANALYZE_VERSION, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiVersionSummary(data.summary || "");
        if (data.summary && !changeSummary) {
          setChangeSummary(data.summary);
        }
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
    } finally {
      setIsAnalyzingVersion(false);
    }
  };

  const handleNewVersion = () => {
    if (!selectedDocumentForVersion || !versionFile) return;

    const formData = new FormData();
    formData.append("file", versionFile);
    formData.append("changeSummary", changeSummary || aiVersionSummary);

    newVersionMutation.mutate({ documentId: selectedDocumentForVersion.id, formData });
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setStatusFilter("");
    setTypeFilter("");
    setDisciplineFilter("");
    setJobFilter("");
    setPage(1);
  };

  const documents = documentsData?.documents || [];
  const pagination = documentsData?.pagination;

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const groupedDocuments = useMemo(() => {
    if (groupBy === "none") return null;

    const groups = new Map<string, { label: string; docs: DocumentWithDetails[] }>();

    for (const doc of documents) {
      let key = "";
      let label = "";

      switch (groupBy) {
        case "job":
          key = doc.job?.id || "_unassigned";
          label = doc.job ? `${doc.job.jobNumber} - ${doc.job.name}` : "Unassigned";
          break;
        case "discipline":
          key = doc.discipline?.id || "_unassigned";
          label = doc.discipline?.disciplineName || "Unassigned";
          break;
        case "type":
          key = doc.type?.id || "_unassigned";
          label = doc.type ? `${doc.type.prefix} - ${doc.type.typeName}` : "Unassigned";
          break;
        case "category":
          key = doc.category?.id || "_unassigned";
          label = doc.category?.categoryName || "Unassigned";
          break;
        case "status": {
          const dts = doc.documentTypeStatus;
          key = dts?.id || doc.status;
          label = dts?.statusName || statusConfig[doc.status]?.label || doc.status;
          break;
        }
        default:
          key = "_all";
          label = "All Documents";
      }

      if (!groups.has(key)) {
        groups.set(key, { label, docs: [] });
      }
      groups.get(key)!.docs.push(doc);
    }

    const sorted = Array.from(groups.entries()).sort(([keyA, a], [keyB, b]) => {
      if (keyA === "_unassigned") return 1;
      if (keyB === "_unassigned") return -1;
      return a.label.localeCompare(b.label);
    });

    return sorted;
  }, [documents, groupBy]);

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((docs: DocumentWithDetails[]) => {
    setSelectedDocIds((prev) => {
      const allIds = docs.map((d) => d.id);
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      }
    });
  }, []);

  const renderDocumentRow = useCallback((doc: DocumentWithDetails) => {
    const legacyStatus = statusConfig[doc.status] || statusConfig.DRAFT;
    const StatusIcon = legacyStatus.icon;
    const docTypeStatus = doc.documentTypeStatus;

    return (
      <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
        <TableCell className="w-10">
          <Checkbox
            checked={selectedDocIds.has(doc.id)}
            onCheckedChange={() => toggleDocSelection(doc.id)}
            data-testid={`checkbox-doc-${doc.id}`}
          />
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{doc.title}</span>
            <span className="text-xs text-muted-foreground">{doc.originalName}</span>
            {doc.documentNumber && (
              <span className="text-xs text-blue-600">{doc.documentNumber}</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            {doc.type && <Badge variant="outline" className="w-fit">{doc.type.prefix}</Badge>}
            {doc.discipline && <Badge variant="secondary" className="w-fit text-xs">{doc.discipline.shortForm || doc.discipline.disciplineName}</Badge>}
          </div>
        </TableCell>
        <TableCell>
          {doc.job ? (
            <span className="text-sm">{doc.job.jobNumber} - {doc.job.name}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <span className="font-mono text-sm">v{doc.version}{doc.revision}</span>
        </TableCell>
        <TableCell>
          {docTypeStatus ? (
            <Badge
              variant="outline"
              className="w-fit border"
              style={{ backgroundColor: `${docTypeStatus.color}20`, borderColor: docTypeStatus.color, color: docTypeStatus.color }}
              data-testid={`badge-status-${doc.id}`}
            >
              <div className="w-2 h-2 rounded-full mr-1.5 flex-shrink-0" style={{ backgroundColor: docTypeStatus.color }} />
              {docTypeStatus.statusName}
            </Badge>
          ) : (
            <Badge className={legacyStatus.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {legacyStatus.label}
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatFileSize(doc.fileSize)}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDate(doc.createdAt)}
        </TableCell>
        <TableCell>
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => window.open(DOCUMENT_ROUTES.VIEW(doc.id), "_blank")}
              title="View"
              data-testid={`button-view-${doc.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                const link = document.createElement("a");
                link.href = DOCUMENT_ROUTES.DOWNLOAD(doc.id);
                link.download = doc.originalName;
                link.click();
              }}
              title="Download"
              data-testid={`button-download-${doc.id}`}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setVersionHistoryDoc(doc);
                setIsVersionHistoryOpen(true);
              }}
              title="Version History"
              data-testid={`button-history-${doc.id}`}
            >
              <History className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-actions-${doc.id}`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedDocumentForVersion(doc);
                    setIsVersionDialogOpen(true);
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Version
                </DropdownMenuItem>
                {doc.status === "DRAFT" && (
                  <DropdownMenuItem
                    onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "REVIEW" })}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Submit for Review
                  </DropdownMenuItem>
                )}
                {doc.status === "REVIEW" && (
                  <>
                    <DropdownMenuItem
                      onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "APPROVED" })}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "DRAFT" })}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Return to Draft
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  }, [updateStatusMutation, selectedDocIds, toggleDocSelection]);

  const renderDocumentTable = useCallback((docs: DocumentWithDetails[]) => {
    const allIds = docs.map((d) => d.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedDocIds.has(id));
    const someSelected = allIds.some((id) => selectedDocIds.has(id)) && !allSelected;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={() => toggleSelectAll(docs)}
                data-testid="checkbox-select-all"
              />
            </TableHead>
            <TableHead>Document</TableHead>
            <TableHead>Type / Discipline</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc) => renderDocumentRow(doc))}
        </TableBody>
      </Table>
    );
  }, [renderDocumentRow, selectedDocIds, toggleSelectAll]);

  return (
    <div className="space-y-6" data-testid="document-register-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Document Register</h1>
            <p className="text-muted-foreground">Manage project documents, versions, and bundles</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsBundlesListOpen(true)} 
            data-testid="button-view-bundles"
          >
            <Package className="h-4 w-4 mr-2" />
            View Bundles
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOverlayResult(null);
              setOverlayPage(0);
              setIsOverlayDialogOpen(true);
            }}
            disabled={selectedDocIds.size !== 2 || !Array.from(selectedDocIds).every(id => {
              const doc = documents.find(d => d.id === id);
              return doc && (doc.mimeType === "application/pdf" || doc.mimeType?.startsWith("image/"));
            })}
            data-testid="button-visual-overlay"
          >
            <Layers className="h-4 w-4 mr-2" />
            Compare ({selectedDocIds.size === 2 ? "2" : selectedDocIds.size})
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEmailDialogOpen(true)}
            disabled={selectedDocIds.size === 0}
            data-testid="button-email-documents"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email ({selectedDocIds.size})
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              if (selectedDocIds.size > 0) {
                setSelectedDocsForBundle(Array.from(selectedDocIds));
              } else {
                setSelectedDocsForBundle([]);
              }
              setIsBundleDialogOpen(true);
            }} 
            data-testid="button-create-bundle"
          >
            <QrCode className="h-4 w-4 mr-2" />
            Create Bundle{selectedDocIds.size > 0 ? ` (${selectedDocIds.size})` : ""}
          </Button>
          <Button onClick={() => setIsUploadOpen(true)} data-testid="button-upload-document">
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 items-center mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Button variant="outline" onClick={handleSearch} data-testid="button-search">
              Search
            </Button>
            <div className="flex items-center gap-2 ml-4">
              <Switch
                id="latest-only"
                checked={showLatestOnly}
                onCheckedChange={setShowLatestOnly}
                data-testid="switch-latest-only"
              />
              <Label htmlFor="latest-only" className="text-sm">Latest versions only</Label>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Group by</Label>
              <Select value={groupBy} onValueChange={(v) => { setGroupBy(v); setCollapsedGroups(new Set()); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-group-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="job">Job</SelectItem>
                  <SelectItem value="discipline">Discipline</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(statusConfig).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.typeName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={disciplineFilter} onValueChange={(v) => { setDisciplineFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-discipline-filter">
                  <SelectValue placeholder="All Disciplines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Disciplines</SelectItem>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.disciplineName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={jobFilter} onValueChange={(v) => { setJobFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]" data-testid="select-job-filter">
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>{job.jobNumber} - {job.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}

          {documentsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No documents found</h3>
              <p className="text-muted-foreground">Upload your first document to get started</p>
            </div>
          ) : groupedDocuments ? (
            <>
              <div className="space-y-4">
                {groupedDocuments.map(([key, { label, docs }]) => {
                  const isCollapsed = collapsedGroups.has(key);
                  return (
                    <div key={key} className="border rounded-md overflow-visible" data-testid={`group-${groupBy}-${key}`}>
                      <button
                        type="button"
                        className="flex items-center justify-between gap-3 w-full px-4 py-3 text-left hover-elevate transition-colors"
                        onClick={() => toggleGroup(key)}
                        data-testid={`button-toggle-group-${key}`}
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                          />
                          <span className="font-medium">{label}</span>
                          <Badge variant="secondary">{docs.length}</Badge>
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="border-t">
                          {renderDocumentTable(docs)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} documents
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!pagination.hasMore}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {renderDocumentTable(documents)}

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} documents
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!pagination.hasMore}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload a new document to the register</DialogDescription>
          </DialogHeader>
          <Form {...uploadForm}>
            <form onSubmit={uploadForm.handleSubmit(handleUpload)} className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Click to select a file or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">Max file size: 50MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      if (!uploadForm.getValues("title")) {
                        uploadForm.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={uploadForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Document title" data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Optional description" rows={2} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="typeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.prefix} - {type.typeName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="disciplineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discipline</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-discipline">
                            <SelectValue placeholder="Select discipline" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {disciplines.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.shortForm || d.disciplineName} - {d.disciplineName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.categoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedUploadTypeId && uploadTypeStatuses.length > 0 && (
                  <FormField
                    control={uploadForm.control}
                    name="documentTypeStatusId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-document-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {uploadTypeStatuses.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                  {s.statusName}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={uploadForm.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-job">
                            <SelectValue placeholder="Select job" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobs.map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.jobNumber} - {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="panelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Panel</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-panel">
                            <SelectValue placeholder="Select panel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {panels.map((panel) => (
                            <SelectItem key={panel.id} value={panel.id}>
                              {panel.panelMark}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-supplier">
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="purchaseOrderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Order</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-purchase-order">
                            <SelectValue placeholder="Select purchase order" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {purchaseOrders.map((po) => (
                            <SelectItem key={po.id} value={po.id}>
                              {po.poNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="taskId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task">
                            <SelectValue placeholder="Select task" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tasks.map((task) => (
                            <SelectItem key={task.id} value={task.id}>
                              {task.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Comma-separated tags" data-testid="input-tags" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={uploadForm.control}
                  name="isConfidential"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 pt-6">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-confidential" />
                      </FormControl>
                      <FormLabel className="!mt-0">Confidential</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploadMutation.isPending || !selectedFile} data-testid="button-submit-upload">
                  {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Upload
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVersionDialogOpen} onOpenChange={setIsVersionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload New Version</DialogTitle>
            <DialogDescription>
              Upload a new version of "{selectedDocumentForVersion?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    setVersionFile(file);
                    handleAIAnalysis(file);
                  }
                };
                input.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.add("border-primary", "bg-primary/5");
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove("border-primary", "bg-primary/5");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setVersionFile(file);
                  handleAIAnalysis(file);
                }
              }}
              data-testid="version-dropzone"
            >
              {versionFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-6 w-6 text-primary" />
                  <span>{versionFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setVersionFile(null); setAiVersionSummary(""); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Click to select file or drag and drop</p>
                </>
              )}
            </div>

            {isAnalyzingVersion && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is analyzing document changes...</span>
              </div>
            )}

            {aiVersionSummary && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">AI Generated</span>
                  Version Summary
                </Label>
                <div className="bg-muted/50 rounded-lg p-3 text-sm border">
                  {aiVersionSummary}
                </div>
              </div>
            )}

            <div>
              <Label>Change Summary</Label>
              <Textarea
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Describe what changed in this version (or use AI-generated summary above)"
                rows={3}
                data-testid="input-change-summary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVersionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleNewVersion}
              disabled={newVersionMutation.isPending || !versionFile}
              data-testid="button-submit-version"
            >
              {newVersionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isVersionHistoryOpen} onOpenChange={setIsVersionHistoryOpen}>
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
            <SheetDescription>
              {versionHistoryDoc?.title}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {versionHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No version history available</p>
            ) : (
              versionHistory.map((version, index) => {
                const status = statusConfig[version.status] || statusConfig.DRAFT;
                return (
                  <Card key={version.id} className={version.isLatestVersion ? "border-primary" : ""}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">v{version.version}{version.revision}</span>
                            {version.isLatestVersion && (
                              <Badge variant="outline" className="text-primary border-primary">Latest</Badge>
                            )}
                            <Badge className={status.className}>{status.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(version.createdAt)}
                          </p>
                          {version.changeSummary && (
                            <p className="text-sm mt-2">{version.changeSummary}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(DOCUMENT_ROUTES.VIEW(version.id), "_blank")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = DOCUMENT_ROUTES.DOWNLOAD(version.id);
                              link.download = version.originalName;
                              link.click();
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isBundleDialogOpen} onOpenChange={setIsBundleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Document Bundle</DialogTitle>
            <DialogDescription>
              Create a bundle of documents that can be shared via QR code
            </DialogDescription>
          </DialogHeader>
          <Form {...bundleForm}>
            <form onSubmit={bundleForm.handleSubmit((data) => {
              createBundleMutation.mutate({
                ...data,
                documentIds: selectedDocsForBundle,
              });
            })} className="space-y-4">
              <FormField
                control={bundleForm.control}
                name="bundleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bundle Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter bundle name" data-testid="input-bundle-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bundleForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Leave blank to auto-generate with AI based on selected documents" data-testid="input-bundle-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bundleForm.control}
                name="allowGuestAccess"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        data-testid="switch-guest-access"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Allow guest access via QR code</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={bundleForm.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" data-testid="input-bundle-expires" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                <Label>Documents ({selectedDocsForBundle.length} selected)</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {(selectedDocIds.size > 0 
                    ? documents.filter(doc => selectedDocsForBundle.includes(doc.id))
                    : documents
                  ).map((doc) => (
                    <div 
                      key={doc.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        selectedDocsForBundle.includes(doc.id) 
                          ? "bg-primary/10 border border-primary" 
                          : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        setSelectedDocsForBundle(prev => 
                          prev.includes(doc.id) 
                            ? prev.filter(id => id !== doc.id)
                            : [...prev, doc.id]
                        );
                      }}
                      data-testid={`bundle-doc-${doc.id}`}
                    >
                      <Checkbox
                        checked={selectedDocsForBundle.includes(doc.id)}
                        className="pointer-events-none"
                        data-testid={`checkbox-bundle-doc-${doc.id}`}
                      />
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm truncate">{doc.title}</span>
                      <Badge variant="outline" className="text-xs">{doc.revision}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsBundleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBundleMutation.isPending || selectedDocsForBundle.length === 0}
                  data-testid="button-create-bundle-submit"
                >
                  {createBundleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Bundle
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBundleViewOpen} onOpenChange={setIsBundleViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bundle Created Successfully</DialogTitle>
            <DialogDescription>
              {createdBundle?.bundleName}
            </DialogDescription>
          </DialogHeader>
          
          {createdBundle && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 p-6 bg-muted rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/bundle/${createdBundle.qrCodeId}`}
                  size={200}
                  level="H"
                  includeMargin
                  data-testid="qr-code-display"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code to access the bundle
                </p>
              </div>

              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/bundle/${createdBundle.qrCodeId}`}
                    data-testid="input-bundle-link"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/bundle/${createdBundle.qrCodeId}`);
                      toast({ title: "Copied!", description: "Link copied to clipboard" });
                    }}
                    data-testid="button-copy-link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`/bundle/${createdBundle.qrCodeId}`, "_blank")}
                    data-testid="button-open-bundle"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bundle Details</Label>
                <div className="text-sm space-y-1">
                  <p><strong>Documents:</strong> {createdBundle.items?.length || 0} files</p>
                  <p><strong>Guest Access:</strong> {createdBundle.allowGuestAccess ? "Enabled" : "Disabled"}</p>
                  {createdBundle.expiresAt && (
                    <p><strong>Expires:</strong> {formatDate(createdBundle.expiresAt)}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsBundleViewOpen(false)} data-testid="button-close-bundle-view">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBundlesListOpen} onOpenChange={setIsBundlesListOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Document Bundles
            </DialogTitle>
            <DialogDescription>
              All document bundles with their contents and sharing options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {bundlesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : bundles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No bundles created yet</p>
                <p className="text-sm mt-1">Create a bundle to share documents via QR code</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bundle Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Files</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundles.map((bundle) => (
                      <TableRow key={bundle.id} data-testid={`bundle-row-${bundle.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{bundle.bundleName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <p className="text-sm text-muted-foreground truncate">
                            {bundle.description || "No description"}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" data-testid={`badge-file-count-${bundle.id}`}>
                            {bundle.items?.length || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {bundle.allowGuestAccess ? (
                              <Badge variant="outline" className="text-green-600">Guest</Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600">Restricted</Badge>
                            )}
                            {bundle.expiresAt && new Date(bundle.expiresAt) < new Date() && (
                              <Badge variant="destructive">Expired</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(bundle.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSelectedBundleForView(bundle)}
                              title="View documents"
                              data-testid={`button-view-bundle-${bundle.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSelectedBundleForQR(bundle)}
                              title="Show QR code"
                              data-testid={`button-qr-bundle-${bundle.id}`}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setBundleToDelete(bundle);
                                setDeleteBundleDialogOpen(true);
                              }}
                              title="Delete bundle"
                              data-testid={`button-delete-bundle-${bundle.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBundleForView} onOpenChange={() => setSelectedBundleForView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {selectedBundleForView?.bundleName}
            </DialogTitle>
            {selectedBundleForView?.description && (
              <DialogDescription>{selectedBundleForView.description}</DialogDescription>
            )}
          </DialogHeader>
          {selectedBundleForView && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary">
                  {selectedBundleForView.items?.length || 0} documents
                </Badge>
                {selectedBundleForView.allowGuestAccess ? (
                  <Badge variant="outline" className="text-green-600">Guest Access Enabled</Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-600">Restricted Access</Badge>
                )}
                {selectedBundleForView.expiresAt && (
                  <span className="text-xs text-muted-foreground">
                    Expires: {formatDate(selectedBundleForView.expiresAt)}
                  </span>
                )}
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBundleForView.items?.length > 0 ? (
                      selectedBundleForView.items.map((item) => (
                        <TableRow key={item.id} data-testid={`bundle-doc-row-${item.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">
                                {item.document?.title || "Unknown Document"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {(item.document as any)?.revision || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(item.addedAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No documents in this bundle
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBundleForView(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBundleForQR} onOpenChange={() => setSelectedBundleForQR(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedBundleForQR?.bundleName}</DialogTitle>
            <DialogDescription className="text-center">
              Scan this QR code to access the bundle
            </DialogDescription>
          </DialogHeader>
          {selectedBundleForQR && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/bundle/${selectedBundleForQR.qrCodeId}`}
                  size={250}
                  level="H"
                />
              </div>
              <div className="flex items-center gap-2 w-full">
                <Input 
                  value={`${window.location.origin}/bundle/${selectedBundleForQR.qrCodeId}`}
                  readOnly
                  className="text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/bundle/${selectedBundleForQR.qrCodeId}`);
                    toast({ title: "Copied", description: "Link copied to clipboard" });
                  }}
                  data-testid="button-copy-qr-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                <p><strong>{selectedBundleForQR.items?.length || 0}</strong> documents in this bundle</p>
                {selectedBundleForQR.expiresAt && (
                  <p>Expires: {formatDate(selectedBundleForQR.expiresAt)}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => window.open(`/bundle/${selectedBundleForQR?.qrCodeId}`, "_blank")}
              data-testid="button-open-bundle-external"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Bundle
            </Button>
            <Button onClick={() => setSelectedBundleForQR(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendDocumentsEmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        selectedDocuments={documents.filter((d) => selectedDocIds.has(d.id))}
        onSuccess={() => setSelectedDocIds(new Set())}
      />

      <AlertDialog open={deleteBundleDialogOpen} onOpenChange={setDeleteBundleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the bundle "{bundleToDelete?.bundleName}" and remove all document associations. The documents themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bundleToDelete && deleteBundleMutation.mutate(bundleToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-bundle"
            >
              {deleteBundleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOverlayDialogOpen} onOpenChange={(open) => {
        setIsOverlayDialogOpen(open);
        if (!open) {
          setOverlayResult(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-overlay-title">Visual Document Comparison</DialogTitle>
            <DialogDescription>
              Compare two documents side-by-side or as an overlay to highlight pixel-level differences.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const selectedIds = Array.from(selectedDocIds);
            const docA = documents.find(d => d.id === selectedIds[0]);
            const docB = documents.find(d => d.id === selectedIds[1]);
            if (!docA || !docB) return null;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-1">Document A (Original)</div>
                      <div className="text-sm font-medium truncate" data-testid="text-overlay-doc-a">{docA.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{docA.originalName}</div>
                      <Badge variant="outline" className="mt-1 text-xs">Rev {docA.revision}</Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-1">Document B (Revised)</div>
                      <div className="text-sm font-medium truncate" data-testid="text-overlay-doc-b">{docB.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{docB.originalName}</div>
                      <Badge variant="outline" className="mt-1 text-xs">Rev {docB.revision}</Badge>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Comparison Mode</Label>
                    <Select value={overlayMode} onValueChange={(v) => setOverlayMode(v as any)}>
                      <SelectTrigger data-testid="select-overlay-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="overlay">Overlay</SelectItem>
                        <SelectItem value="side-by-side">Side by Side</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">DPI (Resolution)</Label>
                    <Select value={String(overlayDpi)} onValueChange={(v) => setOverlayDpi(Number(v))}>
                      <SelectTrigger data-testid="select-overlay-dpi">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="72">72 (Fast)</SelectItem>
                        <SelectItem value="150">150 (Standard)</SelectItem>
                        <SelectItem value="300">300 (High Quality)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Sensitivity</Label>
                    <Select value={String(overlaySensitivity)} onValueChange={(v) => setOverlaySensitivity(Number(v))}>
                      <SelectTrigger data-testid="select-overlay-sensitivity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">High (10)</SelectItem>
                        <SelectItem value="30">Medium (30)</SelectItem>
                        <SelectItem value="50">Low (50)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(docA.mimeType === "application/pdf" || docB.mimeType === "application/pdf") && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Page Number</Label>
                    <Input
                      type="number"
                      min={1}
                      value={overlayPage + 1}
                      onChange={(e) => setOverlayPage(Math.max(0, parseInt(e.target.value || "1") - 1))}
                      className="w-20"
                      data-testid="input-overlay-page"
                    />
                    <span className="text-xs text-muted-foreground">(1-indexed)</span>
                  </div>
                )}

                {overlayResult && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant={overlayResult.changePercentage > 5 ? "destructive" : "secondary"} data-testid="badge-change-pct">
                        {overlayResult.changePercentage}% Changed
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {overlayResult.changedPixels?.toLocaleString()} of {overlayResult.totalPixels?.toLocaleString()} pixels differ
                      </span>
                    </div>

                    {overlayResult.overlayDocumentId && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Overlay Result</div>
                        <div className="border rounded-md overflow-hidden bg-muted">
                          <img
                            src={DOCUMENT_ROUTES.VIEW(overlayResult.overlayDocumentId)}
                            alt="Visual overlay comparison"
                            className="w-full h-auto"
                            data-testid="img-overlay-result"
                          />
                        </div>
                        <div className="flex gap-2 items-center text-xs text-muted-foreground">
                          <span className="inline-block w-3 h-3 rounded-sm bg-red-500/70" /> Removed content
                          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/60 ml-2" /> Added content
                        </div>
                      </div>
                    )}

                    {overlayResult.aiSummary && (
                      <Card className="bg-muted/50" data-testid="card-ai-summary">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">AI Comparison Summary</div>
                              <p className="text-sm leading-relaxed" data-testid="text-ai-summary">{overlayResult.aiSummary}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {overlayResult.sideBySideDocumentId && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Side-by-Side Result</div>
                        <div className="border rounded-md overflow-hidden bg-muted">
                          <img
                            src={DOCUMENT_ROUTES.VIEW(overlayResult.sideBySideDocumentId)}
                            alt="Side-by-side comparison"
                            className="w-full h-auto"
                            data-testid="img-sbs-result"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsOverlayDialogOpen(false)} data-testid="button-overlay-cancel">
                    {overlayResult ? "Close" : "Cancel"}
                  </Button>
                  {overlayResult && overlayResult.overlayDocumentId && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(DOCUMENT_ROUTES.DOWNLOAD(overlayResult.overlayDocumentId), "_blank")}
                      data-testid="button-overlay-download"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Overlay
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const ids = Array.from(selectedDocIds);
                      visualDiffMutation.mutate({
                        docId1: ids[0],
                        docId2: ids[1],
                        page: overlayPage,
                        dpi: overlayDpi,
                        sensitivity: overlaySensitivity,
                        mode: overlayMode,
                      });
                    }}
                    disabled={visualDiffMutation.isPending}
                    data-testid="button-overlay-generate"
                  >
                    {visualDiffMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : overlayResult ? (
                      <>
                        <Layers className="h-4 w-4 mr-2" />
                        Re-compare
                      </>
                    ) : (
                      <>
                        <Layers className="h-4 w-4 mr-2" />
                        Generate Comparison
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
