import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { AP_INVOICE_ROUTES } from "@shared/api-routes";
import { useRoute, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  ArrowLeft, FileText, Clock, ChevronLeft, ChevronRight,
  Loader2, ZoomIn, ZoomOut, AlertTriangle, User, Calendar,
  DollarSign, ShieldCheck, ShieldAlert, Shield, Pause, Zap,
  MessageSquare, Check, X,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  supplierId: string | null;
  companyId: string;
  invoiceDate: string | null;
  dueDate: string | null;
  description: string | null;
  totalEx: string | null;
  totalTax: string | null;
  totalInc: string | null;
  currency: string | null;
  status: string;
  assigneeUserId: string | null;
  createdByUserId: string;
  uploadedAt: string;
  riskScore: number | null;
  riskReasons: string[] | null;
  isUrgent: boolean;
  isOnHold: boolean;
  postPeriod: string | null;
  supplier?: { id: string; name: string } | null;
  assigneeUser?: { id: string; name: string; email: string } | null;
  createdByUser?: { id: string; name: string; email: string } | null;
  documents?: Array<{ id: string; fileName: string; mimeType: string; storageKey: string; fileSize?: number }>;
  extractedFields?: Array<{ id: string; fieldKey: string; fieldValue: string | null; confidence: number | null }>;
  splits?: Array<any>;
  approvals?: Array<any>;
  activity?: Array<{ id: string; activityType: string; message: string; actorName?: string; createdAt: string }>;
  comments?: Array<{ id: string; userId: string; userName?: string; body: string; createdAt: string }>;
}

interface PageThumbnail {
  pageNumber: number;
  thumbnail: string;
  width: number;
  height: number;
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amount: string | number | null | undefined): string {
  const n = parseFloat(String(amount || "0"));
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  imported: "bg-gray-500 text-white",
  processed: "bg-amber-500 text-white",
  confirmed: "bg-indigo-500 text-white",
  partially_approved: "bg-blue-500 text-white",
  approved: "bg-green-600 text-white",
  rejected: "bg-red-500 text-white",
  on_hold: "bg-orange-500 text-white",
  exported: "bg-emerald-600 text-white",
  failed_export: "bg-red-400 text-white",
};

type MobileTab = "invoice" | "document" | "details";

function getRiskInfo(score: number | null) {
  if (score === null || score === undefined) return { label: "Unknown", color: "text-white/40", bgColor: "bg-white/5 border-white/10", Icon: Shield };
  if (score <= 33) return { label: "Low Risk", color: "text-green-400", bgColor: "bg-green-500/10 border-green-500/30", Icon: ShieldCheck };
  if (score <= 66) return { label: "Medium Risk", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/30", Icon: ShieldAlert };
  return { label: "High Risk", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/30", Icon: ShieldAlert };
}

function InvoiceTab({ invoice }: { invoice: InvoiceDetail }) {
  const normalized = invoice.status.toLowerCase().replace(/\s+/g, "_");
  const statusColor = STATUS_COLORS[normalized] || "bg-gray-500 text-white";
  const displayStatus = invoice.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const risk = getRiskInfo(invoice.riskScore);
  const RiskIcon = risk.Icon;

  return (
    <div className="space-y-4 p-4" data-testid="tab-content-invoice">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Status</span>
          <div className="flex items-center gap-2 flex-wrap">
            {invoice.isUrgent && (
              <Badge className="bg-red-600 text-white no-default-hover-elevate no-default-active-elevate" data-testid="badge-urgent">
                <Zap className="h-3 w-3 mr-1" />Urgent
              </Badge>
            )}
            {invoice.isOnHold && (
              <Badge className="bg-orange-500 text-white no-default-hover-elevate no-default-active-elevate" data-testid="badge-on-hold">
                <Pause className="h-3 w-3 mr-1" />On Hold
              </Badge>
            )}
            <Badge className={`${statusColor} no-default-hover-elevate no-default-active-elevate`} data-testid="badge-invoice-status">
              {displayStatus}
            </Badge>
          </div>
        </div>

        <div>
          <span className="text-xs text-white/50 block mb-0.5">Invoice Number</span>
          <span className="text-sm text-white font-medium" data-testid="text-invoice-number">{invoice.invoiceNumber || "\u2014"}</span>
        </div>

        <div>
          <span className="text-xs text-white/50 block mb-0.5">Supplier</span>
          <span className="text-sm text-white" data-testid="text-supplier-name">{invoice.supplier?.name || "\u2014"}</span>
        </div>

        {invoice.description && (
          <div>
            <span className="text-xs text-white/50 block mb-0.5">Description</span>
            <span className="text-sm text-white/80" data-testid="text-description">{invoice.description}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-white/40" />
          Amounts
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Total (Exc. Tax)</span>
          <span className="text-sm text-white" data-testid="text-total-ex">{formatCurrency(invoice.totalEx)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Tax</span>
          <span className="text-sm text-white" data-testid="text-total-tax">{formatCurrency(invoice.totalTax)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
          <span className="text-xs text-white/50 font-medium">Total (Inc. Tax)</span>
          <span className="text-sm text-white font-semibold" data-testid="text-total-inc">{formatCurrency(invoice.totalInc)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-white/40" />
          Dates
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Invoice Date</span>
          <span className="text-sm text-white" data-testid="text-invoice-date">{formatDate(invoice.invoiceDate)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Due Date</span>
          <span className="text-sm text-white" data-testid="text-due-date">{formatDate(invoice.dueDate)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Uploaded</span>
          <span className="text-sm text-white" data-testid="text-uploaded-at">{formatDateTime(invoice.uploadedAt)}</span>
        </div>
        {invoice.postPeriod && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white/50">Post Period</span>
            <span className="text-sm text-white" data-testid="text-post-period">{invoice.postPeriod}</span>
          </div>
        )}
      </div>

      <div className={`rounded-xl border p-4 space-y-2 ${risk.bgColor}`} data-testid="card-risk-score">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <RiskIcon className={`h-4 w-4 ${risk.color}`} />
            <span className={`text-sm font-semibold ${risk.color}`} data-testid="text-risk-level">{risk.label}</span>
          </div>
          <span className="text-sm text-white/60" data-testid="text-risk-score">
            Score: {invoice.riskScore ?? "N/A"}
          </span>
        </div>
        {invoice.riskReasons && invoice.riskReasons.length > 0 && (
          <div className="space-y-1 pt-1">
            {invoice.riskReasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-3 w-3 mt-0.5 text-white/40 shrink-0" />
                <span className="text-white/60" data-testid={`text-risk-reason-${i}`}>{reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <User className="h-4 w-4 text-white/40" />
          People
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Assignee</span>
          <span className="text-sm text-white" data-testid="text-assignee">
            {invoice.assigneeUser?.name || "\u2014"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Created By</span>
          <span className="text-sm text-white" data-testid="text-created-by">
            {invoice.createdByUser?.name || "\u2014"}
          </span>
        </div>
      </div>
    </div>
  );
}

function DocumentTab({ invoice }: { invoice: InvoiceDetail }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const docs = invoice.documents || [];

  const { data: thumbnailData, isLoading } = useQuery<{ totalPages: number; pages: PageThumbnail[] }>({
    queryKey: [AP_INVOICE_ROUTES.PAGE_THUMBNAILS(invoice.id)],
    enabled: docs.length > 0,
  });

  const numPages = thumbnailData?.totalPages || 0;
  const currentPageData = thumbnailData?.pages?.find(p => p.pageNumber === currentPage);

  const getTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getTouchCenter = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      lastTouchDistance.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [zoom, getTouchDistance, getTouchCenter]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      const newDist = getTouchDistance(e.touches);
      if (newDist !== null) {
        const scale = newDist / lastTouchDistance.current;
        setZoom(z => Math.min(5, Math.max(0.5, z * scale)));
        lastTouchDistance.current = newDist;
      }
      const newCenter = getTouchCenter(e.touches);
      if (lastTouchCenter.current && containerRef.current) {
        const dx = lastTouchCenter.current.x - newCenter.x;
        const dy = lastTouchCenter.current.y - newCenter.y;
        containerRef.current.scrollLeft += dx;
        containerRef.current.scrollTop += dy;
      }
      lastTouchCenter.current = newCenter;
    } else if (e.touches.length === 1 && isPanning && containerRef.current) {
      const dx = panStart.x - e.touches[0].clientX;
      const dy = panStart.y - e.touches[0].clientY;
      containerRef.current.scrollLeft += dx;
      containerRef.current.scrollTop += dy;
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [isPanning, panStart, getTouchDistance, getTouchCenter]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
    setIsPanning(false);
  }, []);

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/40" data-testid="empty-documents">
        <FileText className="h-10 w-10 opacity-30 mb-2" />
        <p className="text-sm">No documents attached</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="tab-content-document">
      <div className="p-3 space-y-2">
        <h3 className="text-sm font-semibold text-white/80">Documents ({docs.length})</h3>
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5"
            data-testid={`doc-item-${doc.id}`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 shrink-0">
              <FileText className="h-4 w-4 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate" data-testid={`doc-name-${doc.id}`}>{doc.fileName}</p>
              <p className="text-xs text-white/50">
                {doc.mimeType} {doc.fileSize ? `\u00B7 ${formatFileSize(doc.fileSize)}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {docs.length > 0 && (
        <div className="flex-1 flex flex-col border-t border-white/10">
          <div className="p-2 flex items-center justify-between gap-2 border-b border-white/10">
            <span className="text-xs text-white/60">Preview</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                className="text-white/60"
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-white/50 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(z => Math.min(5, z + 0.25))}
                className="text-white/60"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(1)}
                className="text-white/60"
                data-testid="button-zoom-reset"
              >
                <span className="text-[10px]">1:1</span>
              </Button>
            </div>
          </div>

          <div
            ref={containerRef}
            className="flex-1 overflow-auto p-2"
            style={{ cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default", touchAction: zoom > 1 ? "none" : "pan-y" }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            data-testid="container-document-preview"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-white/40" />
              </div>
            ) : currentPageData ? (
              <div className="flex items-start justify-center min-h-full">
                <img
                  src={`data:image/png;base64,${currentPageData.thumbnail}`}
                  alt={`Page ${currentPage}`}
                  className="shadow-lg rounded-sm"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top center",
                    maxWidth: zoom <= 1 ? "100%" : "none",
                    width: zoom <= 1 ? "auto" : `${currentPageData.width}px`,
                  }}
                  draggable={false}
                  data-testid="img-page-thumbnail"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-white/40">
                <p className="text-sm">No preview available</p>
              </div>
            )}
          </div>

          {numPages > 1 && (
            <div className="p-2 border-t border-white/10 flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="text-white/60"
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-white/60" data-testid="text-page-info">
                Page {currentPage} of {numPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                className="text-white/60"
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailsTab({ invoice, invoiceId }: { invoice: InvoiceDetail; invoiceId: string }) {
  const fields = invoice.extractedFields || [];
  const approvals = invoice.approvals || [];
  const comments = invoice.comments || [];

  const { data: activity } = useQuery<Array<{ id: string; activityType: string; message: string; actorName?: string; createdAt: string }>>({
    queryKey: [AP_INVOICE_ROUTES.ACTIVITY(invoiceId)],
    enabled: !!invoiceId,
  });

  const { data: fetchedComments } = useQuery<Array<{ id: string; userId: string; userName?: string; body: string; createdAt: string }>>({
    queryKey: [AP_INVOICE_ROUTES.COMMENTS(invoiceId)],
    enabled: !!invoiceId,
  });

  const allComments = fetchedComments || comments;

  const approvalStatusColors: Record<string, string> = {
    pending: "bg-gray-500 text-white",
    approved: "bg-green-600 text-white",
    rejected: "bg-red-500 text-white",
    skipped: "bg-gray-400 text-white",
  };

  return (
    <div className="space-y-4 p-4" data-testid="tab-content-details">
      {fields.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3" data-testid="card-extracted-fields">
          <h3 className="text-sm font-semibold text-white/80">Extracted Fields</h3>
          <div className="space-y-2">
            {fields.map((field) => (
              <div
                key={field.id}
                className="flex items-start justify-between gap-2 py-1.5 border-b border-white/5 last:border-0"
                data-testid={`extracted-field-${field.fieldKey}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white/50 block">
                    {field.fieldKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-sm text-white" data-testid={`text-field-value-${field.fieldKey}`}>
                    {field.fieldValue || "\u2014"}
                  </span>
                </div>
                {field.confidence !== null && field.confidence !== undefined && (
                  <Badge variant="outline" className="text-[10px] border-white/20 text-white/60 shrink-0" data-testid={`badge-confidence-${field.fieldKey}`}>
                    {(parseFloat(String(field.confidence)) * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {fields.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center" data-testid="card-no-fields">
          <p className="text-sm text-white/40">No extracted fields available</p>
        </div>
      )}

      {approvals.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3" data-testid="card-approvals">
          <h3 className="text-sm font-semibold text-white/80">Approval Path</h3>
          <div className="space-y-2">
            {approvals.map((approval: any, i: number) => {
              const status = (approval.status || "pending").toLowerCase();
              const statusBadge = approvalStatusColors[status] || "bg-gray-500 text-white";
              return (
                <div
                  key={approval.id || i}
                  className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0"
                  data-testid={`approval-step-${i}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/60 shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm text-white block truncate" data-testid={`text-approver-name-${i}`}>
                        {approval.approverName || approval.approverEmail || "Unknown"}
                      </span>
                      {approval.decisionAt && (
                        <span className="text-[10px] text-white/40" data-testid={`text-decision-date-${i}`}>
                          {formatDateTime(approval.decisionAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={`${statusBadge} no-default-hover-elevate no-default-active-elevate text-[10px]`} data-testid={`badge-approval-status-${i}`}>
                    {status.replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activity && activity.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3" data-testid="card-activity-log">
          <h3 className="text-sm font-semibold text-white/80">Activity</h3>
          <div className="space-y-2">
            {activity.map((act) => (
              <div key={act.id} className="flex items-start gap-2 text-xs" data-testid={`activity-${act.id}`}>
                <Clock className="h-3 w-3 mt-0.5 text-white/40 shrink-0" />
                <div className="min-w-0">
                  <span className="text-white/40">{formatDateTime(act.createdAt)}</span>
                  {act.actorName && (
                    <span className="ml-1 text-white/50">{act.actorName}</span>
                  )}
                  <span className="ml-1 text-white/70">{act.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {allComments.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3" data-testid="card-comments">
          <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-white/40" />
            Comments ({allComments.length})
          </h3>
          <div className="space-y-3">
            {allComments.map((comment: any) => (
              <div
                key={comment.id}
                className="rounded-lg border border-white/5 bg-white/5 p-3 space-y-1"
                data-testid={`comment-${comment.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-white/70" data-testid={`text-comment-author-${comment.id}`}>
                    {comment.userName || "Unknown"}
                  </span>
                  <span className="text-[10px] text-white/40" data-testid={`text-comment-date-${comment.id}`}>
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-white/80 leading-relaxed" data-testid={`text-comment-body-${comment.id}`}>
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ApprovalStep {
  id: string;
  stepIndex: number;
  approverUserId: string;
  status: string;
  decisionAt: string | null;
  note: string | null;
  approverName: string | null;
  approverEmail: string | null;
}

export default function MobileApInvoiceDetailPage() {
  const [, params] = useRoute("/mobile/ap-invoices/:id");
  const invoiceId = params?.id;
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<MobileTab>("invoice");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: invoice, isLoading } = useQuery<InvoiceDetail>({
    queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId || "")],
    enabled: !!invoiceId,
  });

  const { data: approvalPathData } = useQuery<{ steps: ApprovalStep[] } | ApprovalStep[]>({
    queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId || "")],
    enabled: !!invoiceId && !!user,
  });

  const approvalSteps: ApprovalStep[] = Array.isArray(approvalPathData)
    ? approvalPathData
    : (approvalPathData as any)?.steps || [];

  const currentPendingStep = approvalSteps.find(s => s.status === "PENDING");
  const isMyTurnToApprove = !!currentPendingStep && !!user && currentPendingStep.approverUserId === String(user.id);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", AP_INVOICE_ROUTES.APPROVE(invoiceId!), { note: approveNote || undefined });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice approved" });
      setShowApproveDialog(false);
      setApproveNote("");
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.MY_APPROVALS] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", AP_INVOICE_ROUTES.REJECT(invoiceId!), { note: rejectNote });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice rejected" });
      setShowRejectDialog(false);
      setRejectNote("");
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.MY_APPROVALS] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
    },
    onError: (err: Error) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  const onHoldMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", AP_INVOICE_ROUTES.ON_HOLD(invoiceId!), {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.isOnHold ? "Invoice placed on hold" : "Invoice taken off hold" });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.MY_APPROVALS] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to toggle hold", description: err.message, variant: "destructive" });
    },
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending || onHoldMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] overflow-hidden" data-testid="page-ap-invoice-detail-loading">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Skeleton className="h-8 w-8 rounded-lg bg-white/10" />
          <Skeleton className="h-5 w-48 bg-white/10" />
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="h-24 w-full rounded-xl bg-white/10" />
          <Skeleton className="h-24 w-full rounded-xl bg-white/10" />
          <Skeleton className="h-16 w-full rounded-xl bg-white/10" />
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] overflow-hidden" data-testid="page-ap-invoice-detail-not-found">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/mobile/email-processing")}
            className="text-white/70"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-white font-medium">Not Found</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-white/40">
          <FileText className="h-12 w-12 opacity-30 mb-2" />
          <p className="text-sm">Invoice not found</p>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  const normalized = invoice.status.toLowerCase().replace(/\s+/g, "_");
  const statusColor = STATUS_COLORS[normalized] || "bg-gray-500 text-white";
  const displayStatus = invoice.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const tabs: { key: MobileTab; label: string }[] = [
    { key: "invoice", label: "Invoice" },
    { key: "document", label: "Document" },
    { key: "details", label: "Details" },
  ];

  return (
    <>
      <div className="flex flex-col h-screen-safe bg-[#070B12] overflow-hidden" data-testid="page-ap-invoice-detail">
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/mobile/email-processing")}
            className="text-white/70"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate" data-testid="text-header-title">
              {invoice.invoiceNumber || "Invoice"}
            </p>
          </div>
          <Badge className={`${statusColor} no-default-hover-elevate no-default-active-elevate shrink-0`} data-testid="badge-header-status">
            {displayStatus}
          </Badge>
        </div>

        <div className="flex border-b border-white/10 flex-shrink-0" data-testid="tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                activeTab === tab.key
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/50"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`flex-1 overflow-y-auto ${isMyTurnToApprove ? "pb-36" : "pb-24"}`}>
          {activeTab === "invoice" && <InvoiceTab invoice={invoice} />}
          {activeTab === "document" && <DocumentTab invoice={invoice} />}
          {activeTab === "details" && <DetailsTab invoice={invoice} invoiceId={invoiceId!} />}
        </div>

        {isMyTurnToApprove && (
          <div className="flex-shrink-0 border-t border-white/10 bg-[#070B12] px-4 py-3 space-y-2" style={{ paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 60px), 72px)" }} data-testid="approval-actions">
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
        )}

        <MobileBottomNav />
      </div>

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
