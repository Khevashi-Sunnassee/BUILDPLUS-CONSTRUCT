import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AP_INVOICE_ROUTES } from "@shared/api-routes";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Search, Upload, Trash2, MoreHorizontal, FileText, CheckCircle, XCircle, Clock, AlertTriangle, Filter, Loader2, Eye, Send, Settings } from "lucide-react";

interface ApInvoice {
  id: string;
  invoiceNumber: string | null;
  supplierName: string | null;
  supplierId: string | null;
  companyName: string | null;
  companyId: string | null;
  uploadedAt: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalInc: string | number | null;
  totalEx: string | number | null;
  totalTax: string | number | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  riskScore: number | null;
  status: string;
  description: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  isUrgent: boolean | null;
  isOnHold: boolean | null;
  currency: string | null;
  postPeriod: string | null;
}

interface InvoiceListResponse {
  invoices: ApInvoice[];
  total: number;
  page: number;
  limit: number;
}

interface StatusCounts {
  waiting_on_me: number;
  draft: number;
  pending_review: number;
  approved: number;
  exported: number;
  failed_export: number;
  rejected: number;
  all: number;
}

const STATUS_TABS = [
  { key: "waiting_on_me", label: "Waiting On Me", showCount: true },
  { key: "draft", label: "Drafts", showCount: false },
  { key: "pending_review", label: "Pending Review", showCount: false },
  { key: "approved", label: "Approved", showCount: false },
  { key: "exported", label: "Exported", showCount: false },
  { key: "failed_export", label: "Failed Export", showCount: false },
  { key: "rejected", label: "Rejected", showCount: true },
  { key: "all", label: "All", showCount: false },
] as const;

const STATUS_BADGE_CONFIG: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  draft: { variant: "secondary" },
  pending_review: { variant: "default" },
  waiting_on_me: { variant: "default", className: "bg-amber-500 text-white" },
  approved: { variant: "default", className: "bg-green-600 text-white" },
  exported: { variant: "default", className: "bg-blue-600 text-white" },
  failed_export: { variant: "destructive" },
  rejected: { variant: "destructive" },
  on_hold: { variant: "outline" },
};

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(amount: string | number | null | undefined): string {
  const n = parseFloat(String(amount || "0"));
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
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

function RiskBar({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  const clamped = Math.max(0, Math.min(100, score));
  let color = "bg-green-500";
  if (clamped > 66) color = "bg-red-500";
  else if (clamped > 33) color = "bg-amber-500";
  return (
    <div className="flex items-center gap-2" data-testid="risk-bar">
      <div className="w-16 h-2 rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{clamped}</span>
    </div>
  );
}

function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      await apiUpload(AP_INVOICE_ROUTES.UPLOAD, formData);
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      toast({ title: "Invoices uploaded successfully" });
      setFiles([]);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-upload">
        <DialogHeader>
          <DialogTitle>Upload Invoices</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover-elevate"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to select files or drag and drop</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG accepted</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) setFiles(Array.from(e.target.files));
            }}
            data-testid="input-file-upload"
          />
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{f.name}</span>
                  <span className="text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-upload">
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={files.length === 0 || uploading} data-testid="button-confirm-upload">
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload {files.length > 0 ? `(${files.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
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

export default function ApInvoicesPage() {
  useDocumentTitle("Invoices");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [flagFilter, setFlagFilter] = useState("all");
  const [uploadedByFilter, setUploadedByFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { page: String(page), limit: "50" };
    if (activeTab !== "all") params.status = activeTab;
    if (search.trim()) params.q = search.trim();
    if (flagFilter !== "all") params.flagged = flagFilter;
    if (uploadedByFilter !== "all") params.uploadedBy = uploadedByFilter;
    if (companyFilter !== "all") params.companyId = companyFilter;
    return params;
  }, [activeTab, search, page, flagFilter, uploadedByFilter, companyFilter]);

  const { data: invoiceData, isLoading } = useQuery<InvoiceListResponse>({
    queryKey: [AP_INVOICE_ROUTES.LIST, queryParams],
  });

  const { data: statusCounts } = useQuery<StatusCounts>({
    queryKey: [AP_INVOICE_ROUTES.COUNTS],
  });

  const invoices = invoiceData?.invoices || [];
  const total = invoiceData?.total || 0;

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach((inv) => {
      if (inv.companyId && inv.companyName) map.set(inv.companyId, inv.companyName);
    });
    return Array.from(map.entries());
  }, [invoices]);

  const uploaders = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach((inv) => {
      if (inv.createdByUserId && inv.createdByName) map.set(inv.createdByUserId, inv.createdByName);
    });
    return Array.from(map.entries());
  }, [invoices]);

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("POST", AP_INVOICE_ROUTES.BULK_APPROVE, { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      setSelectedRows(new Set());
      toast({ title: "Invoices approved" });
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedRows.size === invoices.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(invoices.map((inv) => inv.id)));
    }
  }, [invoices, selectedRows.size]);

  const getCount = (key: string): number => {
    if (!statusCounts) return 0;
    return (statusCounts as any)[key] || 0;
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 space-y-4 flex-1 overflow-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Invoices</h1>
          <div className="flex items-center gap-2">
            <Link href="/ap-invoices/approval-rules">
              <Button variant="outline" size="icon" data-testid="button-approval-rules">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-invoices">
              <Upload className="h-4 w-4 mr-2" />
              Upload Invoices
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for invoices..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-search"
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
                onClick={() => { setActiveTab(tab.key); setPage(1); setSelectedRows(new Set()); }}
                data-testid={`tab-${tab.key}`}
              >
                {tab.label}
                {tab.showCount && count > 0 && (
                  <Badge variant="secondary" className="ml-1.5" data-testid={`count-${tab.key}`}>
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={flagFilter} onValueChange={(v) => { setFlagFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" data-testid="select-flag-filter">
              <SelectValue placeholder="Flags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flags</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={uploadedByFilter} onValueChange={(v) => { setUploadedByFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]" data-testid="select-uploaded-by-filter">
              <SelectValue placeholder="Uploaded by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Uploaders</SelectItem>
              {uploaders.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]" data-testid="select-company-filter">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-2">
          <span className="text-sm text-muted-foreground" data-testid="text-selected-count">
            {selectedRows.size > 0 ? `${selectedRows.size} invoice${selectedRows.size > 1 ? "s" : ""} selected` : "No invoices selected"}
          </span>
          <div className="flex gap-2">
            {selectedRows.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedRows(new Set())} data-testid="button-clear-selection">
                Clear
              </Button>
            )}
            <Button
              size="sm"
              disabled={selectedRows.size === 0 || bulkApproveMutation.isPending}
              onClick={() => bulkApproveMutation.mutate(Array.from(selectedRows))}
              data-testid="button-approve-selected"
            >
              {bulkApproveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Approve selected ({selectedRows.size})
            </Button>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No invoices found</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload your first invoice to get started.</p>
            <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-empty">
              <Upload className="h-4 w-4 mr-2" />
              Upload Invoices
            </Button>
          </div>
        ) : (
          <>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={invoices.length > 0 && selectedRows.size === invoices.length}
                        onCheckedChange={toggleAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Invoice Total</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Risk Warning</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer"
                      data-testid={`row-invoice-${inv.id}`}
                      onClick={() => navigate(`/ap-invoices/${inv.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRows.has(inv.id)}
                          onCheckedChange={() => toggleRow(inv.id)}
                          data-testid={`checkbox-row-${inv.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/ap-invoices/${inv.id}`}
                          className="text-primary font-medium hover:underline"
                          onClick={(e: any) => e.stopPropagation()}
                          data-testid={`link-invoice-${inv.id}`}
                        >
                          {inv.invoiceNumber || "—"}
                        </Link>
                      </TableCell>
                      <TableCell data-testid={`text-supplier-${inv.id}`}>{inv.supplierName || "—"}</TableCell>
                      <TableCell>{formatDate(inv.uploadedAt)}</TableCell>
                      <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                      <TableCell>{formatDate(inv.dueDate)}</TableCell>
                      <TableCell className="text-right font-medium" data-testid={`text-total-${inv.id}`}>
                        {formatCurrency(inv.totalInc)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="text-sm">{inv.assigneeName || "Unassigned"}</span>
                          <Link
                            href={`/ap-invoices/${inv.id}?tab=approval`}
                            className="block text-xs text-primary hover:underline"
                            onClick={(e: any) => e.stopPropagation()}
                            data-testid={`link-approval-path-${inv.id}`}
                          >
                            View Approval Path
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RiskBar score={inv.riskScore} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[150px]">
                          {inv.description || "—"}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${inv.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/ap-invoices/${inv.id}`)} data-testid={`action-view-${inv.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await apiRequest("POST", AP_INVOICE_ROUTES.APPROVE(inv.id));
                                  queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
                                  queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
                                  toast({ title: "Invoice approved" });
                                } catch (err: any) {
                                  toast({ title: "Error", description: err.message, variant: "destructive" });
                                }
                              }}
                              data-testid={`action-approve-${inv.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await apiRequest("POST", AP_INVOICE_ROUTES.REJECT(inv.id));
                                  queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
                                  queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
                                  toast({ title: "Invoice rejected" });
                                } catch (err: any) {
                                  toast({ title: "Error", description: err.message, variant: "destructive" });
                                }
                              }}
                              data-testid={`action-reject-${inv.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={async () => {
                                try {
                                  await apiRequest("DELETE", AP_INVOICE_ROUTES.BY_ID(inv.id));
                                  queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
                                  queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
                                  toast({ title: "Invoice deleted" });
                                } catch (err: any) {
                                  toast({ title: "Error", description: err.message, variant: "destructive" });
                                }
                              }}
                              data-testid={`action-delete-${inv.id}`}
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
                <span className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                  Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="button-prev-page">
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)} data-testid="button-next-page">
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}