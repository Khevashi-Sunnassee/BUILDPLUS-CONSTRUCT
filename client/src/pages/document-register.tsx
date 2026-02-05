import { useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { DOCUMENT_ROUTES, JOBS_ROUTES, PANELS_ROUTES, PROCUREMENT_ROUTES, TASKS_ROUTES } from "@shared/api-routes";
import type { 
  Document, 
  DocumentTypeConfig, 
  DocumentDiscipline, 
  DocumentCategory,
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
  const [showFilters, setShowFilters] = useState(false);
  
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
      jobId: "",
      panelId: "",
      supplierId: "",
      purchaseOrderId: "",
      taskId: "",
      tags: "",
      isConfidential: false,
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(DOCUMENT_ROUTES.UPLOAD, {
        method: "POST",
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

  const newVersionMutation = useMutation({
    mutationFn: async ({ documentId, formData }: { documentId: string; formData: FormData }) => {
      const response = await fetch(DOCUMENT_ROUTES.NEW_VERSION(documentId), {
        method: "POST",
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
    if (values.jobId) formData.append("jobId", values.jobId);
    if (values.panelId) formData.append("panelId", values.panelId);
    if (values.supplierId) formData.append("supplierId", values.supplierId);
    if (values.purchaseOrderId) formData.append("purchaseOrderId", values.purchaseOrderId);
    if (values.taskId) formData.append("taskId", values.taskId);
    if (values.tags) formData.append("tags", values.tags);
    formData.append("isConfidential", String(values.isConfidential));

    uploadMutation.mutate(formData);
  };

  const handleNewVersion = () => {
    if (!selectedDocumentForVersion || !versionFile) return;

    const formData = new FormData();
    formData.append("file", versionFile);
    formData.append("changeSummary", changeSummary);

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

  return (
    <div className="container mx-auto py-6 px-4 space-y-6" data-testid="document-register-page">
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
            onClick={() => setIsBundleDialogOpen(true)} 
            data-testid="button-create-bundle"
          >
            <QrCode className="h-4 w-4 mr-2" />
            Create Bundle
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
                    <SelectItem key={job.id} value={job.id}>{job.code} - {job.name}</SelectItem>
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
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
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
                  {documents.map((doc) => {
                    const status = statusConfig[doc.status] || statusConfig.DRAFT;
                    const StatusIcon = status.icon;
                    
                    return (
                      <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
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
                            <span className="text-sm">{doc.job.code}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">v{doc.version}{doc.revision}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={status.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
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
                  })}
                </TableBody>
              </Table>

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
                              {job.code} - {job.name}
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
        <DialogContent>
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
                  if (file) setVersionFile(file);
                };
                input.click();
              }}
            >
              {versionFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-6 w-6 text-primary" />
                  <span>{versionFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setVersionFile(null); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Click to select file</p>
                </>
              )}
            </div>
            <div>
              <Label>Change Summary</Label>
              <Textarea
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Describe what changed in this version"
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe this bundle" data-testid="input-bundle-description" />
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
                <Label>Select Documents ({selectedDocsForBundle.length} selected)</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {documents.map((doc) => (
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

      <Sheet open={isBundlesListOpen} onOpenChange={setIsBundlesListOpen}>
        <SheetContent className="w-[500px] sm:w-[600px] sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Document Bundles
            </SheetTitle>
            <SheetDescription>
              View all document bundles and their QR codes for sharing
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {bundlesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : bundles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No bundles created yet</p>
                <p className="text-sm mt-1">Create a bundle to share documents via QR code</p>
              </div>
            ) : (
              bundles.map((bundle) => (
                <Card key={bundle.id} className="hover-elevate" data-testid={`bundle-card-${bundle.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex gap-4">
                      <div 
                        className="bg-white p-2 rounded cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => setSelectedBundleForQR(bundle)}
                        title="Click to enlarge QR code"
                      >
                        <QRCodeSVG 
                          value={`${window.location.origin}/bundle/${bundle.qrCodeId}`}
                          size={80}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{bundle.bundleName}</h4>
                        {bundle.description && (
                          <p className="text-sm text-muted-foreground truncate">{bundle.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary">
                            {bundle.items?.length || 0} documents
                          </Badge>
                          {bundle.allowGuestAccess ? (
                            <Badge variant="outline" className="text-green-600">Guest Access</Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600">Restricted</Badge>
                          )}
                          {bundle.expiresAt && new Date(bundle.expiresAt) < new Date() && (
                            <Badge variant="destructive">Expired</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created: {formatDate(bundle.createdAt)}
                          {bundle.expiresAt && ` • Expires: ${formatDate(bundle.expiresAt)}`}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/bundle/${bundle.qrCodeId}`);
                              toast({ title: "Copied", description: "Bundle link copied to clipboard" });
                            }}
                            data-testid={`button-copy-link-${bundle.id}`}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/bundle/${bundle.qrCodeId}`, "_blank")}
                            data-testid={`button-open-bundle-${bundle.id}`}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

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
    </div>
  );
}
