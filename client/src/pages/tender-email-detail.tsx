import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCtrlScrollZoom } from "@/hooks/use-ctrl-scroll-zoom";
import { TENDER_INBOX_ROUTES } from "@shared/api-routes";
import { useRoute, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, FileText, CheckCircle2, Clock, Pencil,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Loader2, LinkIcon, RefreshCw, Mail, Eye
} from "lucide-react";

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

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_BADGE_CONFIG: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  received: { variant: "outline" },
  processing: { variant: "default", className: "bg-amber-500 text-white dark:bg-amber-600" },
  processed: { variant: "default", className: "bg-indigo-500 text-white dark:bg-indigo-600" },
  matched: { variant: "default", className: "bg-green-600 text-white dark:bg-green-700" },
  archived: { variant: "secondary" },
  failed: { variant: "destructive" },
};

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

function PdfViewer({ email }: { email: TenderEmailDetail }) {
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const doc = email.documents?.[0];

  const { data: thumbnailData, isLoading } = useQuery<{ totalPages: number; pages: PageThumbnail[] }>({
    queryKey: [TENDER_INBOX_ROUTES.PAGE_THUMBNAILS(email.id)],
    enabled: !!doc,
  });

  const numPages = thumbnailData?.totalPages || 0;
  const currentPageData = thumbnailData?.pages?.find(p => p.pageNumber === currentPage);
  const isImage = doc?.mimeType?.startsWith("image/");

  useCtrlScrollZoom({ containerRef, zoom, setZoom, minZoom: 0.5, maxZoom: 5, step: 0.25 });

  const handleDownload = useCallback(() => {
    if (!doc) return;
    fetch(TENDER_INBOX_ROUTES.DOCUMENT_VIEW(email.id), { credentials: "include" })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName || "tender-document";
        a.click();
        URL.revokeObjectURL(url);
      });
  }, [doc, email.id]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, [zoom]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !containerRef.current) return;
    const container = containerRef.current;
    const dx = panStart.x - e.clientX;
    const dy = panStart.y - e.clientY;
    container.scrollLeft += dx;
    container.scrollTop += dy;
    setPanStart({ x: e.clientX, y: e.clientY });
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

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
      const container = containerRef.current;
      const dx = panStart.x - e.touches[0].clientX;
      const dy = panStart.y - e.touches[0].clientY;
      container.scrollLeft += dx;
      container.scrollTop += dy;
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [isPanning, panStart, getTouchDistance, getTouchCenter]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
    setIsPanning(false);
  }, []);

  return (
    <div className="flex flex-col h-full bg-muted/30" data-testid="panel-pdf-viewer">
      <div className="p-2 border-b bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{doc?.fileName || "Document"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            data-testid="button-zoom-out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon"
            onClick={() => setZoom(z => Math.min(5, z + 0.25))}
            data-testid="button-zoom-in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon"
            onClick={() => setZoom(1)}
            data-testid="button-zoom-reset">
            <span className="text-[10px]">1:1</span>
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="ghost" size="icon" onClick={handleDownload} data-testid="button-download-doc">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/10 p-2 md:p-4"
        style={{ cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default", touchAction: zoom > 1 ? "none" : "pan-y" }}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="container-pdf"
      >
        {!doc ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Mail className="h-12 w-12 opacity-30" />
            <p className="text-sm">No document attached</p>
            <p className="text-xs">This email may contain information in the body text only</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Failed to load document preview</p>
          </div>
        )}
      </div>

      {numPages > 1 && (
        <div className="p-2 border-t bg-muted/30 flex items-center justify-center gap-3">
          <Button variant="ghost" size="icon"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            data-testid="button-prev-page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Page {currentPage} of {numPages}
          </span>
          <Button variant="ghost" size="icon"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            data-testid="button-next-page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SupplierSearchField({ email, onSupplierSelect }: {
  email: TenderEmailDetail;
  onSupplierSelect: (supplierId: string | null, supplierName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allSuppliers } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/procurement/suppliers/active"],
  });

  const filtered = useMemo(() => {
    if (!allSuppliers) return [];
    if (!search.trim()) return allSuppliers.slice(0, 20);
    const q = search.toLowerCase();
    return allSuppliers.filter(s => s.name.toLowerCase().includes(q)).slice(0, 20);
  }, [allSuppliers, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setShowDropdown(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (supplier: { id: string; name: string }) => {
    onSupplierSelect(supplier.id, supplier.name);
    setEditing(false);
    setShowDropdown(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative" data-testid="field-supplier">
      <label className="text-xs text-muted-foreground mb-1 block">Supplier</label>
      {editing ? (
        <div className="relative">
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search suppliers..."
            className="text-sm"
            autoFocus
            data-testid="input-supplier-search"
          />
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 border rounded-md shadow-lg max-h-48 overflow-y-auto bg-card text-card-foreground mt-1" style={{ zIndex: 9999 }} data-testid="dropdown-supplier-results">
              {filtered.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="w-full text-left px-3 py-1.5 text-sm cursor-pointer hover-elevate"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(s); }}
                  data-testid={`option-supplier-${s.id}`}
                >
                  {s.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No suppliers found</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover-elevate min-h-9"
          onClick={() => { setEditing(true); setSearch(email.supplier?.name || ""); setShowDropdown(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          data-testid="button-select-supplier"
        >
          <span className={`text-sm ${email.supplier ? "font-medium" : "text-muted-foreground"}`}>
            {email.supplier?.name || "Select supplier..."}
          </span>
          {email.supplier && (
            <Badge variant="outline" className="ml-auto text-xs">Matched</Badge>
          )}
        </div>
      )}
    </div>
  );
}

function ExtractedFieldsCard({ email }: { email: TenderEmailDetail }) {
  const fields = email.extractedFields || [];
  if (fields.length === 0) return null;

  const priorityFields = ["supplier_name", "quote_number", "quote_date", "total_amount", "gst_amount", "scope_of_work"];

  const sorted = useMemo(() => {
    return [...fields].sort((a, b) => {
      const aIdx = priorityFields.indexOf(a.fieldKey);
      const bIdx = priorityFields.indexOf(b.fieldKey);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.fieldKey.localeCompare(b.fieldKey);
    });
  }, [fields]);

  return (
    <Card data-testid="card-extracted-fields">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3">Extracted Information</h3>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Field</TableHead>
                <TableHead className="text-xs">Value</TableHead>
                <TableHead className="text-xs w-16">Conf.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((field) => (
                <TableRow key={field.id} data-testid={`extracted-${field.fieldKey}`}>
                  <TableCell className="text-muted-foreground text-xs py-2">
                    {field.fieldKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </TableCell>
                  <TableCell className="text-sm font-medium py-2">{field.fieldValue || "\u2014"}</TableCell>
                  <TableCell className="py-2">
                    {field.confidence && (
                      <Badge variant="outline" className="text-xs">
                        {(parseFloat(String(field.confidence)) * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ emailId }: { emailId: string | undefined }) {
  const { data: activity } = useQuery<Array<{ id: string; activityType: string; message: string; createdAt: string }>>({
    queryKey: [TENDER_INBOX_ROUTES.ACTIVITY(emailId || "")],
    enabled: !!emailId,
  });

  if (!activity || activity.length === 0) return null;

  return (
    <Card data-testid="card-activity">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3">Activity</h3>
        <div className="space-y-2">
          {activity.map((act) => (
            <div key={act.id} className="flex items-start gap-2 text-xs" data-testid={`activity-${act.id}`}>
              <Clock className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-muted-foreground">{formatDateTime(act.createdAt)}</span>
                <span className="ml-2">{act.message}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TenderEmailDetailPage() {
  const [, params] = useRoute("/tender-emails/:id");
  const emailId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useDocumentTitle("Tender Email Detail");

  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedTenderId, setSelectedTenderId] = useState<string>("");
  const [mobileTab, setMobileTab] = useState<"document" | "details">("document");

  const { data: email, isLoading } = useQuery<TenderEmailDetail>({
    queryKey: [TENDER_INBOX_ROUTES.BY_ID(emailId || "")],
    queryFn: async () => {
      const res = await fetch(TENDER_INBOX_ROUTES.BY_ID(emailId!), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load email details");
      return res.json();
    },
    enabled: !!emailId,
  });

  const { data: jobs } = useQuery<Array<{ id: string; name: string; jobNumber?: string }>>({
    queryKey: ["/api/jobs"],
    select: (data: any) => {
      if (Array.isArray(data)) return data;
      if (data?.jobs) return data.jobs;
      return [];
    },
  });

  const { data: tenders } = useQuery<Array<{ id: string; name?: string; title?: string; jobId?: string }>>({
    queryKey: ["/api/tenders"],
    select: (data: any) => {
      if (Array.isArray(data)) return data;
      if (data?.tenders) return data.tenders;
      return [];
    },
  });

  const filteredTenders = useMemo(() => {
    if (!tenders) return [];
    if (!selectedJobId) return tenders;
    return tenders.filter(t => t.jobId === selectedJobId);
  }, [tenders, selectedJobId]);

  useEffect(() => {
    if (email?.tender?.jobId && !selectedJobId) {
      setSelectedJobId(email.tender.jobId);
    }
    if (email?.tenderId && !selectedTenderId) {
      setSelectedTenderId(email.tenderId);
    }
  }, [email]);

  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!emailId) return;
      await apiRequest("POST", TENDER_INBOX_ROUTES.EXTRACT(emailId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.BY_ID(emailId!)] });
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.COUNTS] });
      toast({ title: "Extraction started" });
    },
    onError: (err: Error) => {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    },
  });

  const matchMutation = useMutation({
    mutationFn: async ({ tenderId, supplierId }: { tenderId: string; supplierId: string }) => {
      if (!emailId) return;
      await apiRequest("POST", TENDER_INBOX_ROUTES.MATCH_TENDER(emailId), { tenderId, supplierId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.BY_ID(emailId!)] });
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.COUNTS] });
      toast({ title: "Email matched to tender" });
    },
    onError: (err: Error) => {
      toast({ title: "Match failed", description: err.message, variant: "destructive" });
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (!emailId) return;
      await apiRequest("PATCH", TENDER_INBOX_ROUTES.BY_ID(emailId), updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.BY_ID(emailId!)] });
      queryClient.invalidateQueries({ queryKey: [TENDER_INBOX_ROUTES.LIST] });
      toast({ title: "Updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSupplierSelect = useCallback((supplierId: string | null) => {
    if (supplierId) {
      patchMutation.mutate({ supplierId });
    }
  }, [patchMutation]);

  const handleMatch = useCallback(() => {
    if (!email?.supplierId) {
      toast({ title: "Select a supplier first", variant: "destructive" });
      return;
    }
    if (!selectedTenderId) {
      toast({ title: "Select a tender first", variant: "destructive" });
      return;
    }
    matchMutation.mutate({ tenderId: selectedTenderId, supplierId: email.supplierId });
  }, [email, selectedTenderId, matchMutation, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-73px)]" data-testid="page-tender-email-detail">
        <div className="flex items-center gap-3 px-4 py-2 border-b">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[55%] border-r p-8">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="w-[45%] p-4 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-73px)]">
        <div className="text-center">
          <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">Email not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/tender-emails")} data-testid="button-back-to-list">
            Back to Tender Emails
          </Button>
        </div>
      </div>
    );
  }

  const canMatch = email.status !== "MATCHED" && email.supplierId && selectedTenderId;
  const isMatched = email.status === "MATCHED";

  const detailsPanel = (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <Card data-testid="card-email-info">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Email Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">From</span>
                <span className="font-medium" data-testid="text-from">{email.fromAddress}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Received</span>
                <span data-testid="text-received">{formatDateTime(email.createdAt)}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Subject</span>
                <span className="font-medium" data-testid="text-subject">{email.subject || "\u2014"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Attachments</span>
                <span data-testid="text-attachments">{email.attachmentCount || 0}</span>
              </div>
              {email.processingError && (
                <div className="col-span-2">
                  <span className="text-xs text-destructive" data-testid="text-error">{email.processingError}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-matching">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold">Match to Tender</h3>

            <SupplierSearchField
              email={email}
              onSupplierSelect={(supplierId) => handleSupplierSelect(supplierId)}
            />

            <div data-testid="field-job">
              <label className="text-xs text-muted-foreground mb-1 block">Job</label>
              <Select value={selectedJobId} onValueChange={(val) => { setSelectedJobId(val); setSelectedTenderId(""); }}>
                <SelectTrigger data-testid="select-job">
                  <SelectValue placeholder="Select job..." />
                </SelectTrigger>
                <SelectContent>
                  {(jobs || []).map(job => (
                    <SelectItem key={job.id} value={job.id} data-testid={`option-job-${job.id}`}>
                      {job.jobNumber ? `${job.jobNumber} - ${job.name}` : job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div data-testid="field-tender">
              <label className="text-xs text-muted-foreground mb-1 block">Tender</label>
              <Select value={selectedTenderId} onValueChange={setSelectedTenderId}>
                <SelectTrigger data-testid="select-tender">
                  <SelectValue placeholder={selectedJobId ? "Select tender..." : "Select a job first..."} />
                </SelectTrigger>
                <SelectContent>
                  {filteredTenders.map(tender => (
                    <SelectItem key={tender.id} value={tender.id} data-testid={`option-tender-${tender.id}`}>
                      {tender.name || tender.title || `Tender #${tender.id.substring(0, 8)}`}
                    </SelectItem>
                  ))}
                  {filteredTenders.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No tenders found</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {isMatched && email.tender && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" data-testid="card-matched-info">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <div className="text-sm">
                  <span className="text-green-700 dark:text-green-400 font-medium">Matched to: </span>
                  <span className="text-green-700 dark:text-green-300">
                    {email.tender.name || email.tender.title || `Tender #${email.tender.id.substring(0, 8)}`}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    Matched on {formatDateTime(email.matchedAt)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <ExtractedFieldsCard email={email} />

        <ActivityFeed emailId={emailId} />
      </div>
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]" data-testid="page-tender-email-detail">
      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 border-b bg-background flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tender-emails")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <h1 className="text-sm font-semibold truncate" data-testid="text-email-subject">
          {email.subject || `Email from ${email.fromAddress}`}
        </h1>
        <StatusBadge status={email.status} />
        <div className="ml-auto hidden md:flex items-center gap-2 flex-wrap">
          {email.documents && email.documents.length > 0 && (email.status === "RECEIVED" || email.status === "FAILED") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
              data-testid="button-extract"
            >
              {extractMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <FileText className="h-3 w-3 mr-1" />
              )}
              Extract Data
            </Button>
          )}
          {email.status === "PROCESSED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
              data-testid="button-re-extract"
            >
              {extractMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Re-extract
            </Button>
          )}
          <Button
            size="sm"
            className={isMatched ? "bg-green-600 text-white" : ""}
            onClick={handleMatch}
            disabled={matchMutation.isPending || !canMatch}
            data-testid="button-match"
          >
            {matchMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LinkIcon className="h-3 w-3 mr-1" />}
            {isMatched ? "Re-match" : "Match to Tender"}
          </Button>
        </div>
      </div>

      <div className="md:hidden flex border-b bg-background">
        <button
          type="button"
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "document" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
          onClick={() => setMobileTab("document")}
          data-testid="tab-mobile-document"
        >
          <FileText className="h-4 w-4 inline-block mr-1.5" />
          Document
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${mobileTab === "details" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
          onClick={() => setMobileTab("details")}
          data-testid="tab-mobile-details"
        >
          <Pencil className="h-4 w-4 inline-block mr-1.5" />
          Details
        </button>
      </div>

      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-[55%] border-r overflow-hidden">
          <PdfViewer email={email} />
        </div>

        <div className="w-[45%] overflow-hidden flex flex-col">
          {detailsPanel}

          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-background flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate("/tender-emails")} data-testid="button-close">
              Close
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              {email.documents && email.documents.length > 0 && (email.status === "RECEIVED" || email.status === "FAILED") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => extractMutation.mutate()}
                  disabled={extractMutation.isPending}
                  data-testid="button-extract-bottom"
                >
                  {extractMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                  Extract
                </Button>
              )}
              <Button
                size="sm"
                className={isMatched ? "bg-green-600 text-white" : ""}
                onClick={handleMatch}
                disabled={matchMutation.isPending || !canMatch}
                data-testid="button-match-bottom"
              >
                {matchMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LinkIcon className="h-3 w-3 mr-1" />}
                {isMatched ? "Re-match" : "Match"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex md:hidden flex-1 overflow-hidden flex-col">
        {mobileTab === "document" ? (
          <div className="flex-1 overflow-hidden">
            <PdfViewer email={email} />
          </div>
        ) : (
          <>
            {detailsPanel}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-background flex-wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("/tender-emails")} data-testid="button-close-mobile">
                Close
              </Button>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleMatch}
                  disabled={matchMutation.isPending || !canMatch}
                  data-testid="button-match-mobile"
                >
                  {matchMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <LinkIcon className="h-3 w-3 mr-1" />}
                  Match
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
