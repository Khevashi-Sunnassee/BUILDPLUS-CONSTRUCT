import { useState, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AP_INVOICE_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Check, X, Pause, Loader2, FileText, AlertTriangle, DollarSign, Calendar, Building2, Hash, Filter, Shield, ZoomIn, ZoomOut, RotateCcw, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface ApprovalInvoice {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  description: string | null;
  totalEx: string | null;
  totalTax: string | null;
  totalInc: string | null;
  currency: string | null;
  status: string;
  isUrgent: boolean | null;
  isOnHold: boolean | null;
  uploadedAt: string | null;
  riskScore: number | null;
  supplierName: string | null;
  supplierId: string | null;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  description: string | null;
  totalEx: string | null;
  totalTax: string | null;
  totalInc: string | null;
  currency: string | null;
  status: string;
  isUrgent: boolean | null;
  isOnHold: boolean | null;
  uploadedAt: string | null;
  riskScore: number | null;
  supplierName: string | null;
  splits: Array<{
    id: string;
    description: string | null;
    amount: string | null;
    taxCode: string | null;
    jobName: string | null;
    costCodeName: string | null;
  }>;
  approvalPath: Array<{
    stepIndex: number;
    status: string;
    approverName: string | null;
    approverEmail: string | null;
    decisionAt: string | null;
    note: string | null;
    ruleName: string | null;
    ruleType: string | null;
    ruleConditionsResolved: Array<{
      field: string;
      operator: string;
      values: string[];
      resolvedValues: string[];
    }> | null;
    isCurrent: boolean;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    fileSize: number | null;
    mimeType: string | null;
  }>;
}

function formatCurrency(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function InvoiceCard({ invoice, onSelect }: { invoice: ApprovalInvoice; onSelect: (inv: ApprovalInvoice) => void }) {
  return (
    <button
      onClick={() => onSelect(invoice)}
      className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99]"
      data-testid={`card-approval-${invoice.id}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 flex-shrink-0 mt-0.5">
        <FileText className="h-5 w-5 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate" data-testid={`text-inv-number-${invoice.id}`}>
            {invoice.invoiceNumber || "No Number"}
          </span>
          {invoice.isUrgent && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              <AlertTriangle className="h-3 w-3 mr-0.5" />
              Urgent
            </Badge>
          )}
          {invoice.isOnHold && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              <Pause className="h-3 w-3 mr-0.5" />
              On Hold
            </Badge>
          )}
        </div>
        <div className="text-xs text-white/60 truncate" data-testid={`text-supplier-${invoice.id}`}>
          {invoice.supplierName || "Unknown supplier"}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold text-white" data-testid={`text-amount-${invoice.id}`}>
            {formatCurrency(invoice.totalInc)}
          </span>
          {invoice.invoiceDate && (
            <span className="text-xs text-white/40">
              {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-white/30 flex-shrink-0 mt-2" />
    </button>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/40">{title}</div>
      {children}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {icon && <div className="text-white/40 mt-0.5">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/50">{label}</div>
        <div className="text-sm text-white">{value || "—"}</div>
      </div>
    </div>
  );
}

interface PageThumbnail {
  pageNumber: number;
  thumbnail: string;
  width: number;
  height: number;
}

function MobileDocViewer({ invoiceId, documents }: { invoiceId: string; documents: InvoiceDetail["documents"] }) {
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const doc = documents?.[0];
  const isImage = doc?.mimeType?.startsWith("image/");

  const { data: thumbnailData, isLoading } = useQuery<{ totalPages: number; pages: PageThumbnail[] }>({
    queryKey: [AP_INVOICE_ROUTES.PAGE_THUMBNAILS(invoiceId)],
    enabled: !!doc,
  });

  const numPages = thumbnailData?.totalPages || 0;
  const currentPageData = thumbnailData?.pages?.find(p => p.pageNumber === currentPage);

  const handleDownload = useCallback(() => {
    if (!doc) return;
    fetch(AP_INVOICE_ROUTES.DOCUMENT(invoiceId), { credentials: "include" })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName || "invoice";
        a.click();
        URL.revokeObjectURL(url);
      });
  }, [doc, invoiceId]);

  const getTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      lastTouchDistance.current = dist;
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [zoom, getTouchDistance]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      if (dist && lastTouchDistance.current) {
        const scale = dist / lastTouchDistance.current;
        setZoom(prev => Math.min(5, Math.max(0.5, prev * scale)));
        lastTouchDistance.current = dist;
      }
    } else if (e.touches.length === 1 && isPanning && containerRef.current) {
      const container = containerRef.current;
      const dx = panStart.x - e.touches[0].clientX;
      const dy = panStart.y - e.touches[0].clientY;
      container.scrollLeft += dx;
      container.scrollTop += dy;
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [isPanning, panStart, zoom, getTouchDistance]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
  }, []);

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/50">
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 mx-auto text-white/20" />
          <div className="text-sm">No document attached</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="h-8 w-8 text-white/70" data-testid="button-zoom-out-mobile">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-white/50 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="h-8 w-8 text-white/70" data-testid="button-zoom-in-mobile">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setZoom(1)} className="h-8 w-8 text-white/70" data-testid="button-zoom-reset-mobile">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {numPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="h-8 w-8 text-white/70">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-white/50">{currentPage}/{numPages}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} className="h-8 w-8 text-white/70">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={handleDownload} className="h-8 w-8 text-white/70" data-testid="button-download-mobile">
          <Download className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-black/20"
        style={{ touchAction: zoom > 1 ? "none" : "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="mobile-doc-viewer-container"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
          </div>
        ) : isImage ? (
          <div className="flex items-start justify-center p-2 min-h-full">
            <img
              src={AP_INVOICE_ROUTES.DOCUMENT(invoiceId)}
              alt="Invoice"
              className="max-w-full transition-transform duration-100"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
              draggable={false}
              data-testid="mobile-doc-image"
            />
          </div>
        ) : currentPageData ? (
          <div className="flex items-start justify-center p-2 min-h-full">
            <img
              src={`data:image/png;base64,${currentPageData.thumbnail}`}
              alt={`Page ${currentPage}`}
              className="max-w-full transition-transform duration-100"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
              draggable={false}
              data-testid="mobile-doc-page"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white/40">
            <div className="text-center space-y-2">
              <FileText className="h-10 w-10 mx-auto" />
              <div className="text-sm">Unable to preview document</div>
              <Button variant="outline" size="sm" onClick={handleDownload} className="border-white/20 text-white">
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceDetailSheet({ invoice, onClose }: { invoice: ApprovalInvoice; onClose: () => void }) {
  const { toast } = useToast();
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "document">("details");

  const { data: detail, isLoading: detailLoading } = useQuery<InvoiceDetail>({
    queryKey: ["/api/ap-invoices", invoice.id, "detail"],
    queryFn: async () => {
      const [invRes, splitsRes, approvalRes] = await Promise.all([
        fetch(AP_INVOICE_ROUTES.BY_ID(invoice.id), { credentials: "include" }),
        fetch(AP_INVOICE_ROUTES.SPLITS(invoice.id), { credentials: "include" }),
        fetch(AP_INVOICE_ROUTES.APPROVAL_PATH(invoice.id), { credentials: "include" }),
      ]);
      const inv = invRes.ok ? await invRes.json() : {};
      const splits = splitsRes.ok ? await splitsRes.json() : [];
      const approvalsData = approvalRes.ok ? await approvalRes.json() : { steps: [] };
      const approvals = approvalsData.steps || approvalsData || [];
      const documents = inv.documents || [];
      return { ...inv, splits, approvalPath: Array.isArray(approvals) ? approvals : [], documents };
    },
    enabled: !!invoice.id,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", AP_INVOICE_ROUTES.APPROVE(invoice.id), { note: approveNote || undefined });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice approved" });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.MY_APPROVALS] });
      queryClient.invalidateQueries({ queryKey: ["/api/ap-invoices"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", AP_INVOICE_ROUTES.REJECT(invoice.id), { note: rejectNote });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice rejected" });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.MY_APPROVALS] });
      queryClient.invalidateQueries({ queryKey: ["/api/ap-invoices"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  const onHoldMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", AP_INVOICE_ROUTES.ON_HOLD(invoice.id), {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.isOnHold ? "Invoice placed on hold" : "Invoice taken off hold" });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.MY_APPROVALS] });
      queryClient.invalidateQueries({ queryKey: ["/api/ap-invoices"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to toggle hold", description: err.message, variant: "destructive" });
    },
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending || onHoldMutation.isPending;

  return (
    <>
      <Sheet open onOpenChange={() => onClose()}>
        <SheetContent side="bottom" className="h-[95vh] bg-[#0D1117] border-white/10 p-0 rounded-t-2xl">
          <div className="flex flex-col h-full">
            <SheetHeader className="flex-shrink-0 border-b border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="text-white text-lg truncate" data-testid="text-detail-title">
                  {invoice.invoiceNumber || "Invoice"}
                </SheetTitle>
                <div className="flex items-center gap-1">
                  {invoice.isUrgent && (
                    <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                  )}
                </div>
              </div>
              <div className="text-sm text-white/60">{invoice.supplierName || "Unknown supplier"}</div>
            </SheetHeader>

            <div className="flex border-b border-white/10 flex-shrink-0">
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === "details" ? "border-blue-400 text-white" : "border-transparent text-white/50"}`}
                onClick={() => setActiveTab("details")}
                data-testid="tab-details"
              >
                <DollarSign className="h-4 w-4 inline-block mr-1.5" />
                Details
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === "document" ? "border-blue-400 text-white" : "border-transparent text-white/50"}`}
                onClick={() => setActiveTab("document")}
                data-testid="tab-document"
              >
                <FileText className="h-4 w-4 inline-block mr-1.5" />
                Document
                {detail?.documents && detail.documents.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">{detail.documents.length}</Badge>
                )}
              </button>
            </div>

            {activeTab === "document" ? (
              <MobileDocViewer invoiceId={invoice.id} documents={detail?.documents || []} />
            ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {detailLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full bg-white/10 rounded-xl" />
                  <Skeleton className="h-32 w-full bg-white/10 rounded-xl" />
                  <Skeleton className="h-24 w-full bg-white/10 rounded-xl" />
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="text-xs text-white/50 mb-1">Total (inc. GST)</div>
                    <div className="text-3xl font-bold text-white" data-testid="text-detail-total">
                      {formatCurrency(detail?.totalInc || invoice.totalInc)}
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-2 text-xs text-white/50">
                      <span>Ex: {formatCurrency(detail?.totalEx || invoice.totalEx)}</span>
                      <span>Tax: {formatCurrency(detail?.totalTax || invoice.totalTax)}</span>
                    </div>
                  </div>

                  <DetailSection title="Invoice Details">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                      <DetailRow icon={<Hash className="h-4 w-4" />} label="Invoice Number" value={detail?.invoiceNumber || invoice.invoiceNumber} />
                      <DetailRow icon={<Calendar className="h-4 w-4" />} label="Invoice Date" value={invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "dd MMM yyyy") : null} />
                      <DetailRow icon={<Calendar className="h-4 w-4" />} label="Due Date" value={invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : null} />
                      <DetailRow icon={<Building2 className="h-4 w-4" />} label="Supplier" value={invoice.supplierName} />
                      {(detail?.description || invoice.description) && (
                        <DetailRow icon={<FileText className="h-4 w-4" />} label="Description" value={detail?.description || invoice.description} />
                      )}
                    </div>
                  </DetailSection>

                  {detail?.splits && detail.splits.length > 0 && (
                    <DetailSection title="Coding / Splits">
                      <div className="space-y-2">
                        {detail.splits.map((split, idx) => (
                          <div key={split.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-white/50">Line {idx + 1}</span>
                              <span className="text-sm font-semibold text-white">{formatCurrency(split.amount)}</span>
                            </div>
                            {split.description && <div className="text-sm text-white/80">{split.description}</div>}
                            <div className="flex flex-wrap gap-2">
                              {split.jobName && (
                                <Badge variant="outline" className="text-[10px] border-white/20 text-white/70">{split.jobName}</Badge>
                              )}
                              {split.costCodeName && (
                                <Badge variant="outline" className="text-[10px] border-white/20 text-white/70">{split.costCodeName}</Badge>
                              )}
                              {split.taxCode && (
                                <Badge variant="outline" className="text-[10px] border-white/20 text-white/70">{split.taxCode}</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DetailSection>
                  )}

                  {detail?.approvalPath && detail.approvalPath.length > 0 && (
                    <DetailSection title="Approval Chain">
                      {(() => {
                        const firstWithRule = detail.approvalPath.find(s => s.ruleName);
                        const conditions = firstWithRule?.ruleConditionsResolved;
                        const ruleType = firstWithRule?.ruleType;
                        return (
                          <>
                            {firstWithRule?.ruleName && (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 mb-3" data-testid="mobile-rule-info">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-3.5 w-3.5 text-white/60" />
                                  <span className="text-sm font-medium text-white">{firstWithRule.ruleName}</span>
                                  <Badge variant="secondary" className="text-xs" data-testid="mobile-badge-rule-type">
                                    {ruleType === "USER_CATCH_ALL" ? "Catch All" : ruleType === "AUTO_APPROVE" ? "Auto" : "Conditional"}
                                  </Badge>
                                </div>
                                {ruleType === "USER_CATCH_ALL" ? (
                                  <div className="text-xs text-white/50">Applies to all invoices</div>
                                ) : conditions && Array.isArray(conditions) && conditions.length > 0 ? (
                                  <div className="space-y-1" data-testid="mobile-rule-conditions">
                                    <div className="flex items-center gap-1.5">
                                      <Filter className="h-3 w-3 text-white/40" />
                                      <span className="text-xs text-white/50 uppercase font-medium">Conditions</span>
                                    </div>
                                    {conditions.map((cond, ci) => {
                                      const fieldLabels: Record<string, string> = { COMPANY: "Company", AMOUNT: "Invoice Total", JOB: "Job", SUPPLIER: "Supplier", GL_CODE: "GL Code" };
                                      const opLabels: Record<string, string> = { EQUALS: "equals", NOT_EQUALS: "not equal to", GREATER_THAN: ">", LESS_THAN: "<", GREATER_THAN_OR_EQUALS: ">=", LESS_THAN_OR_EQUALS: "<=" };
                                      const vals = cond.resolvedValues?.length > 0 ? cond.resolvedValues : cond.values;
                                      const valueStr = cond.field === "AMOUNT" ? `$${parseFloat(vals[0] || "0").toLocaleString()}` : vals.join(", ");
                                      return (
                                        <div key={ci} className="text-xs text-white/70" data-testid={`mobile-condition-${ci}`}>
                                          {ci > 0 && <span className="text-white/40 mr-1">AND</span>}
                                          <span className="font-medium text-white/90">{fieldLabels[cond.field] || cond.field}</span>{" "}
                                          <span className="text-white/50">{opLabels[cond.operator] || cond.operator}</span>{" "}
                                          <span className="font-medium text-white/90">{valueStr}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                        {detail.approvalPath.map((step, idx) => {
                          const stepStatus = step.status;
                          const isApproved = stepStatus === "APPROVED";
                          const isRejected = stepStatus === "REJECTED";
                          const isPending = stepStatus === "PENDING";
                          return (
                            <div key={idx} className="flex items-start gap-3">
                              <div className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 mt-0.5 text-xs font-bold",
                                isApproved && "bg-green-500/20 text-green-400",
                                isRejected && "bg-red-500/20 text-red-400",
                                isPending && "bg-yellow-500/20 text-yellow-400",
                              )}>
                                {isApproved ? <Check className="h-4 w-4" /> : isRejected ? <X className="h-4 w-4" /> : idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white">{step.approverName || step.approverEmail || "Unknown"}</div>
                                <div className="text-xs text-white/50">
                                  {isPending ? "Awaiting decision" : step.decisionAt ? format(new Date(step.decisionAt), "dd MMM yyyy HH:mm") : stepStatus}
                                </div>
                                {step.note && <div className="text-xs text-white/60 mt-1 italic">"{step.note}"</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </DetailSection>
                  )}
                </>
              )}
            </div>
            )}

            <div className="flex-shrink-0 border-t border-white/10 px-4 py-3 space-y-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 text-white border-green-700"
                  onClick={() => setShowApproveDialog(true)}
                  disabled={isBusy}
                  data-testid="button-approve"
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Approve
                </Button>
                <Button
                  className="flex-1 bg-red-600 text-white border-red-700"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isBusy}
                  data-testid="button-reject"
                >
                  {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
                  Reject
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full border-white/20 text-white"
                onClick={() => onHoldMutation.mutate()}
                disabled={isBusy}
                data-testid="button-on-hold"
              >
                {onHoldMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                {invoice.isOnHold ? "Remove Hold" : "Place On Hold"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="bg-[#0D1117] border-white/10 text-white max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Invoice</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Approve {invoice.invoiceNumber || "this invoice"} for {formatCurrency(invoice.totalInc)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Optional note..."
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
            data-testid="input-approve-note"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white" data-testid="button-cancel-approve">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="bg-[#0D1117] border-white/10 text-white max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Invoice</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Reject {invoice.invoiceNumber || "this invoice"}? A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for rejection (required)..."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
            data-testid="input-reject-note"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white" data-testid="button-cancel-reject">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending || !rejectNote.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function MobileApApprovalsPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<ApprovalInvoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery<ApprovalInvoice[]>({
    queryKey: [AP_INVOICE_ROUTES.MY_APPROVALS],
  });

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile AP Approvals">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back-approvals">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-approvals-title">AP Approvals</div>
            <div className="text-sm text-white/60">
              {invoices.length > 0 ? `${invoices.length} pending your approval` : "No pending approvals"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-xl" />
          ))
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 mb-4">
              <Check className="h-8 w-8 text-green-400" />
            </div>
            <div className="text-lg font-semibold text-white/80">All caught up</div>
            <div className="text-sm text-white/50 mt-1">No invoices waiting for your approval</div>
          </div>
        ) : (
          invoices.map((inv) => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              onSelect={setSelectedInvoice}
            />
          ))
        )}
      </div>

      {selectedInvoice && (
        <InvoiceDetailSheet
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      <MobileBottomNav />
    </div>
  );
}
