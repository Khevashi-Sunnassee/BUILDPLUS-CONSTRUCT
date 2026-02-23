import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TENDER_INBOX_ROUTES } from "@shared/api-routes";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, Upload, Trash2, MoreHorizontal, FileText, CheckCircle, XCircle, Clock, Loader2, Eye, Settings, Mail, Copy, Check, RefreshCw, LinkIcon, Inbox } from "lucide-react";
import { SortIcon } from "@/components/ui/sort-icon";

interface TenderEmail {
  id: string;
  companyId: string;
  resendEmailId: string;
  fromAddress: string;
  toAddress: string | null;
  subject: string | null;
  status: string;
  supplierId: string | null;
  tenderId: string | null;
  tenderSubmissionId: string | null;
  attachmentCount: number | null;
  processingError: string | null;
  processedAt: string | null;
  matchedAt: string | null;
  createdAt: string;
  supplierName?: string | null;
  tenderName?: string | null;
}

interface TenderEmailListResponse {
  emails: TenderEmail[];
  total: number;
  page: number;
  limit: number;
}

interface StatusCounts {
  RECEIVED: number;
  PROCESSING: number;
  PROCESSED: number;
  MATCHED: number;
  ARCHIVED: number;
  FAILED: number;
  all: number;
}

const STATUS_TABS = [
  { key: "all", label: "All", showCount: false },
  { key: "RECEIVED", label: "Received", showCount: true },
  { key: "PROCESSING", label: "Processing", showCount: true },
  { key: "PROCESSED", label: "Processed", showCount: true },
  { key: "MATCHED", label: "Matched", showCount: true },
  { key: "ARCHIVED", label: "Archived", showCount: false },
  { key: "FAILED", label: "Failed", showCount: true },
] as const;

const STATUS_BADGE_CONFIG: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  received: { variant: "outline" },
  processing: { variant: "default", className: "bg-amber-500 text-white dark:bg-amber-600" },
  processed: { variant: "default", className: "bg-indigo-500 text-white dark:bg-indigo-600" },
  matched: { variant: "default", className: "bg-green-600 text-white dark:bg-green-700" },
  archived: { variant: "secondary" },
  failed: { variant: "destructive" },
  no_attachments: { variant: "outline", className: "text-muted-foreground" },
  no_pdf_attachments: { variant: "outline", className: "text-muted-foreground" },
};

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  const config = STATUS_BADGE_CONFIG[normalized] || { variant: "secondary" as const };
  const displayLabel = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-status-${normalized}`}>
      {displayLabel}
    </Badge>
  );
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const validateFiles = useCallback((selectedFiles: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];
    for (const f of selectedFiles) {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${f.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit (${(f.size / 1024 / 1024).toFixed(1)}MB)`);
      } else if (!ALLOWED_MIME_TYPES.includes(f.type)) {
        errors.push(`"${f.name}" is not a supported file type (PDF, JPG, PNG only)`);
      } else {
        valid.push(f);
      }
    }
    return { valid, errors };
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      await apiUpload(TENDER_INBOX_ROUTES.UPLOAD, formData);
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.COUNTS] });
      toast({ title: "Tender documents uploaded successfully" });
      setFiles([]);
      setFileErrors([]);
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-tender-upload">
        <DialogHeader>
          <DialogTitle>Upload Tender Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover-elevate"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-tender-upload"
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Click to select tender documents</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG accepted (max {MAX_FILE_SIZE_MB}MB each)</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                const { valid, errors } = validateFiles(Array.from(e.target.files));
                setFiles(valid);
                setFileErrors(errors);
                if (errors.length > 0) {
                  toast({ title: "Some files were rejected", description: errors.join(". "), variant: "destructive" });
                }
              }
            }}
            data-testid="input-tender-file-upload"
          />
          {fileErrors.length > 0 && (
            <div className="text-xs text-destructive space-y-0.5" data-testid="text-file-errors">
              {fileErrors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>{f.name}</span>
                  <span className="text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-tender-upload">
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={files.length === 0 || uploading} data-testid="button-confirm-tender-upload">
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload {files.length > 0 ? `(${files.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TenderInboxSettings {
  isEnabled: boolean;
  inboundEmailAddress: string | null;
  autoExtract: boolean;
}

function TenderInboxSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

  const { data: settings, isLoading } = useQuery<TenderInboxSettings>({
    queryKey: [TENDER_INBOX_ROUTES.SETTINGS],
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<TenderInboxSettings>) => {
      await apiRequest("PUT", TENDER_INBOX_ROUTES.SETTINGS, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.SETTINGS] });
      toast({ title: "Tender inbox settings updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update settings", description: err.message, variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    if (!settings?.inboundEmailAddress) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(settings.inboundEmailAddress);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = settings.inboundEmailAddress;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy to clipboard", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-tender-inbox-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Tender Email Inbox
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : settings ? (
          <div className="space-y-6 py-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium" data-testid="label-tender-inbox-enabled">Enable Tender Email Inbox</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive tender submissions via email automatically
                </p>
              </div>
              <Switch
                checked={settings.isEnabled}
                onCheckedChange={(checked) => updateMutation.mutate({ isEnabled: checked })}
                disabled={updateMutation.isPending}
                data-testid="switch-tender-inbox-enabled"
              />
            </div>

            {settings.isEnabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Inbound Email Address</Label>
                  <p className="text-xs text-muted-foreground">
                    Configured in Company Settings &gt; Email tab
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={settings.inboundEmailAddress || "Not configured"}
                      readOnly
                      className="bg-muted"
                      data-testid="input-tender-inbound-email"
                    />
                    {settings.inboundEmailAddress && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopy}
                        data-testid="button-copy-tender-email"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm font-medium">Auto-Extract</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automatically extract data from attachments using AI
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoExtract}
                    onCheckedChange={(checked) => updateMutation.mutate({ autoExtract: checked })}
                    disabled={updateMutation.isPending}
                    data-testid="switch-tender-auto-extract"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground" data-testid="text-tender-inbox-no-settings">
            Unable to load inbox settings. Please try again.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function TenderEmailsPage({ embedded = false }: { embedded?: boolean } = {}) {
  if (!embedded) useDocumentTitle("Tender Emails");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [inboxSettingsOpen, setInboxSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { page: String(page), limit: "50" };
    if (activeTab !== "all") params.status = activeTab;
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (sortBy) { params.sortBy = sortBy; params.sortOrder = sortOrder; }
    return params;
  }, [activeTab, debouncedSearch, page, sortBy, sortOrder]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams(queryParams);
    return `${TENDER_INBOX_ROUTES.LIST}?${p.toString()}`;
  }, [queryParams]);

  const { data: emailData, isLoading } = useQuery<TenderEmailListResponse>({
    queryKey: [TENDER_INBOX_ROUTES.LIST, queryParams],
    queryFn: async () => {
      const res = await fetch(queryString, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tender emails");
      return res.json();
    },
  });

  const { data: statusCounts } = useQuery<StatusCounts>({
    queryKey: [TENDER_INBOX_ROUTES.COUNTS],
  });

  const emails = emailData?.emails || [];
  const total = emailData?.total || 0;

  const checkEmailsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", TENDER_INBOX_ROUTES.CHECK_EMAILS);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Checking for new tender emails..." });
      const refreshIntervals = [3000, 8000, 15000, 25000];
      for (const delay of refreshIntervals) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.LIST] });
          queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.COUNTS] });
        }, delay);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Failed to check emails", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", TENDER_INBOX_ROUTES.BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.COUNTS] });
      toast({ title: "Tender email deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  }, [sortBy]);


  const getCount = (key: string): number => {
    if (!statusCounts) return 0;
    return (statusCounts as any)[key] || 0;
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      <div className={embedded ? "space-y-4 flex-1 overflow-auto" : "p-6 space-y-4 flex-1 overflow-auto"}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!embedded && <h1 className="text-2xl font-semibold" data-testid="text-tender-emails-title">Tender Emails</h1>}
          <div className={`flex items-center gap-2 ${embedded ? "ml-auto" : ""}`}>
            <Button
              variant="outline"
              onClick={() => checkEmailsMutation.mutate()}
              disabled={checkEmailsMutation.isPending}
              data-testid="button-check-tender-emails"
            >
              {checkEmailsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Check Emails
            </Button>
            <Button variant="outline" size="icon" onClick={() => setInboxSettingsOpen(true)} data-testid="button-tender-inbox-settings">
              <Mail className="h-4 w-4" />
            </Button>
            <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-tender-docs">
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tender emails..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-tender-search"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count = getCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                data-testid={`tab-tender-${tab.key.toLowerCase()}`}
              >
                {tab.label}
                {tab.showCount && count > 0 && (
                  <Badge variant="secondary" className="ml-1.5" data-testid={`count-tender-${tab.key.toLowerCase()}`}>
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="tender-emails-empty">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No tender emails found</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload tender documents or configure email inbox to get started.</p>
            <div className="flex gap-2">
              <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-tender-empty">
                <Upload className="h-4 w-4 mr-2" />
                Upload Documents
              </Button>
              <Button variant="outline" onClick={() => setInboxSettingsOpen(true)} data-testid="button-setup-inbox-empty">
                <Settings className="h-4 w-4 mr-2" />
                Setup Inbox
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("subject")} data-testid="sort-tender-subject">
                        Subject <SortIcon column="subject" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("fromAddress")} data-testid="sort-tender-from">
                        From <SortIcon column="fromAddress" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Tender</TableHead>
                    <TableHead className="text-center">Files</TableHead>
                    <TableHead>
                      <button type="button" className="flex items-center hover:text-foreground" onClick={() => handleSort("createdAt")} data-testid="sort-tender-date">
                        Received <SortIcon column="createdAt" sortColumn={sortBy || ""} sortDirection={sortOrder} />
                      </button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow
                      key={email.id}
                      className="cursor-pointer"
                      data-testid={`row-tender-email-${email.id}`}
                      onClick={() => navigate(`/tender-emails/${email.id}`)}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="text-left text-foreground font-medium hover:underline line-clamp-1 max-w-[250px]"
                          onClick={(e) => { e.stopPropagation(); navigate(`/tender-emails/${email.id}`); }}
                          data-testid={`link-tender-email-${email.id}`}
                        >
                          {email.subject || "No Subject"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm line-clamp-1 max-w-[200px]" data-testid={`text-tender-from-${email.id}`}>
                          {email.fromAddress}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`text-tender-supplier-${email.id}`}>
                        {(email as any).supplierName || (email.supplierId ? <Badge variant="outline"><LinkIcon className="h-3 w-3 mr-1" />Linked</Badge> : <span className="text-muted-foreground">\u2014</span>)}
                      </TableCell>
                      <TableCell data-testid={`text-tender-linked-${email.id}`}>
                        {(email as any).tenderName || (email.tenderId ? <Badge variant="outline"><LinkIcon className="h-3 w-3 mr-1" />Linked</Badge> : <span className="text-muted-foreground">\u2014</span>)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm" data-testid={`text-tender-files-${email.id}`}>
                          {email.attachmentCount || 0}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`text-tender-received-${email.id}`}>
                        {formatDateTime(email.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={email.status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-tender-actions-${email.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/tender-emails/${email.id}`)}
                              data-testid={`action-tender-view-${email.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(email.id)}
                              data-testid={`action-tender-delete-${email.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {total > 50 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground" data-testid="text-tender-pagination-info">
                  Showing {(page - 1) * 50 + 1}\u2013{Math.min(page * 50, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="button-tender-prev-page">
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)} data-testid="button-tender-next-page">
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <TenderInboxSettingsDialog open={inboxSettingsOpen} onOpenChange={setInboxSettingsOpen} />
    </div>
  );
}
