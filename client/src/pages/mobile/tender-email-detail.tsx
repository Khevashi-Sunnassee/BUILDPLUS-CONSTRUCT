import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { TENDER_INBOX_ROUTES } from "@shared/api-routes";
import { useRoute, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, FileText, Clock, ChevronLeft, ChevronRight,
  Loader2, Mail, ZoomIn, ZoomOut, AlertTriangle,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface TenderEmailDetail {
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
  supplier?: { id: string; name: string } | null;
  tender?: { id: string; name?: string; title?: string; jobId?: string } | null;
  tenderSubmission?: { id: string } | null;
  documents?: Array<{ id: string; fileName: string; mimeType: string; storageKey: string; fileSize?: number }>;
  extractedFields?: Array<{ id: string; fieldKey: string; fieldValue: string | null; confidence: number | null }>;
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

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_COLORS: Record<string, string> = {
  received: "bg-gray-500 text-white",
  processing: "bg-amber-500 text-white",
  processed: "bg-indigo-500 text-white",
  matched: "bg-green-600 text-white",
  archived: "bg-gray-400 text-white",
  failed: "bg-red-500 text-white",
};

type MobileTab = "email" | "documents" | "details";

function EmailTab({ email }: { email: TenderEmailDetail }) {
  const normalized = email.status.toLowerCase().replace(/\s+/g, "_");
  const statusColor = STATUS_COLORS[normalized] || "bg-gray-500 text-white";
  const displayStatus = email.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4 p-4" data-testid="tab-content-email">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white/50">Status</span>
            <Badge className={`${statusColor} no-default-hover-elevate no-default-active-elevate`} data-testid="badge-email-status">
              {displayStatus}
            </Badge>
          </div>
          <div>
            <span className="text-xs text-white/50 block mb-0.5">From</span>
            <span className="text-sm text-white" data-testid="text-from-address">{email.fromAddress}</span>
          </div>
          {email.toAddress && (
            <div>
              <span className="text-xs text-white/50 block mb-0.5">To</span>
              <span className="text-sm text-white" data-testid="text-to-address">{email.toAddress}</span>
            </div>
          )}
          <div>
            <span className="text-xs text-white/50 block mb-0.5">Subject</span>
            <span className="text-sm text-white" data-testid="text-subject">{email.subject || "\u2014"}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-white/80">Dates</h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Received</span>
          <span className="text-sm text-white" data-testid="text-received-date">{formatDateTime(email.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Processed</span>
          <span className="text-sm text-white" data-testid="text-processed-date">{formatDateTime(email.processedAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">Matched</span>
          <span className="text-sm text-white" data-testid="text-matched-date">{formatDateTime(email.matchedAt)}</span>
        </div>
        {email.attachmentCount !== null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white/50">Attachments</span>
            <span className="text-sm text-white" data-testid="text-attachment-count">{email.attachmentCount}</span>
          </div>
        )}
      </div>

      {email.processingError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-1" data-testid="card-processing-error">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <h3 className="text-sm font-semibold text-red-300">Processing Error</h3>
          </div>
          <p className="text-xs text-red-200/80" data-testid="text-processing-error">{email.processingError}</p>
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ email }: { email: TenderEmailDetail }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const docs = email.documents || [];

  const { data: thumbnailData, isLoading } = useQuery<{ totalPages: number; pages: PageThumbnail[] }>({
    queryKey: [TENDER_INBOX_ROUTES.PAGE_THUMBNAILS(email.id)],
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
    <div className="flex flex-col h-full" data-testid="tab-content-documents">
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

function DetailsTab({ email, emailId }: { email: TenderEmailDetail; emailId: string }) {
  const fields = email.extractedFields || [];

  const { data: activity } = useQuery<Array<{ id: string; activityType: string; message: string; createdAt: string }>>({
    queryKey: [TENDER_INBOX_ROUTES.ACTIVITY(emailId)],
    enabled: !!emailId,
  });

  return (
    <div className="space-y-4 p-4" data-testid="tab-content-details">
      {email.supplier && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2" data-testid="card-supplier-info">
          <h3 className="text-sm font-semibold text-white/80">Supplier</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white" data-testid="text-supplier-name">{email.supplier.name}</span>
            <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-300">Matched</Badge>
          </div>
        </div>
      )}

      {email.tender && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2" data-testid="card-tender-info">
          <h3 className="text-sm font-semibold text-white/80">Tender</h3>
          <span className="text-sm text-white" data-testid="text-tender-name">
            {email.tender.name || email.tender.title || "\u2014"}
          </span>
          {email.tender.jobId && (
            <p className="text-xs text-white/40" data-testid="text-tender-job-id">Job: {email.tender.jobId}</p>
          )}
        </div>
      )}

      {!email.supplier && !email.tender && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center" data-testid="card-no-match">
          <p className="text-sm text-white/40">No supplier or tender matched yet</p>
        </div>
      )}

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

      {activity && activity.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3" data-testid="card-activity-log">
          <h3 className="text-sm font-semibold text-white/80">Activity</h3>
          <div className="space-y-2">
            {activity.map((act) => (
              <div key={act.id} className="flex items-start gap-2 text-xs" data-testid={`activity-${act.id}`}>
                <Clock className="h-3 w-3 mt-0.5 text-white/40 shrink-0" />
                <div>
                  <span className="text-white/40">{formatDateTime(act.createdAt)}</span>
                  <span className="ml-2 text-white/70">{act.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MobileTenderEmailDetailPage() {
  const [, params] = useRoute("/mobile/tender-emails/:id");
  const emailId = params?.id;
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<MobileTab>("email");

  const { data: email, isLoading } = useQuery<TenderEmailDetail>({
    queryKey: [TENDER_INBOX_ROUTES.BY_ID(emailId || "")],
    enabled: !!emailId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#070B12]" data-testid="page-tender-email-detail-loading">
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

  if (!email) {
    return (
      <div className="flex flex-col min-h-screen bg-[#070B12]" data-testid="page-tender-email-detail-not-found">
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
          <Mail className="h-12 w-12 opacity-30 mb-2" />
          <p className="text-sm">Email not found</p>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  const normalized = email.status.toLowerCase().replace(/\s+/g, "_");
  const statusColor = STATUS_COLORS[normalized] || "bg-gray-500 text-white";
  const displayStatus = email.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const tabs: { key: MobileTab; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "documents", label: "Documents" },
    { key: "details", label: "Details" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#070B12]" data-testid="page-tender-email-detail">
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
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate" data-testid="text-header-subject">
            {email.subject || "No subject"}
          </p>
        </div>
        <Badge className={`${statusColor} no-default-hover-elevate no-default-active-elevate shrink-0`} data-testid="badge-header-status">
          {displayStatus}
        </Badge>
      </div>

      <div className="flex border-b border-white/10" data-testid="tab-bar">
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

      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === "email" && <EmailTab email={email} />}
        {activeTab === "documents" && <DocumentsTab email={email} />}
        {activeTab === "details" && <DetailsTab email={email} emailId={emailId!} />}
      </div>

      <MobileBottomNav />
    </div>
  );
}