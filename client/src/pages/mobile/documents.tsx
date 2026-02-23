import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import {
  Search,
  FileText,
  Image,
  File,
  ChevronLeft,
  Eye,
  Share2,
  Download,
  X,
  Loader2,
  Filter,
  Briefcase,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import { JOBS_ROUTES } from "@shared/api-routes";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface Document {
  id: string;
  documentNumber: string | null;
  title: string;
  description: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  version: string;
  revision: string;
  createdAt: string;
  typeId: string | null;
  jobId: string | null;
}

interface DocumentType {
  id: string;
  typeName: string;
  prefix: string;
  color: string | null;
}

interface Job {
  id: number;
  jobNumber: string;
  name: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf")) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "APPROVED": return "text-green-400 bg-green-500/20";
    case "DRAFT": return "text-yellow-400 bg-yellow-500/20";
    case "REVIEW": return "text-blue-400 bg-blue-500/20";
    case "SUPERSEDED": return "text-white/40 bg-white/10";
    default: return "text-white/60 bg-white/10";
  }
}

function PinchZoomImageViewer({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [isGesturing, setIsGesturing] = useState(false);

  const pinchRef = useRef<{ dist: number; cx: number; cy: number; scale: number; tx: number; ty: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const lastTapRef = useRef(0);

  const [imgLoaded, setImgLoaded] = useState(false);

  const getContentBounds = useCallback(() => {
    if (!containerRef.current || !imgRef.current || !imgLoaded) return { maxX: 0, maxY: 0 };
    const cRect = containerRef.current.getBoundingClientRect();
    const img = imgRef.current;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return { maxX: 0, maxY: 0 };
    const fitScale = Math.min(cRect.width / natW, cRect.height / natH);
    const displayW = natW * fitScale * scaleRef.current;
    const displayH = natH * fitScale * scaleRef.current;
    return {
      maxX: Math.max(0, (displayW - cRect.width) / 2),
      maxY: Math.max(0, (displayH - cRect.height) / 2),
    };
  }, [imgLoaded]);

  const clamp = useCallback((tx: number, ty: number) => {
    const { maxX, maxY } = getContentBounds();
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }, [getContentBounds]);

  const applyTransform = useCallback((s: number, t: { x: number; y: number }, animate = false) => {
    scaleRef.current = s;
    translateRef.current = t;
    setScale(s);
    setTranslate(t);
    setIsGesturing(!animate);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        scale: scaleRef.current,
        tx: translateRef.current.x,
        ty: translateRef.current.y,
      };
      panRef.current = null;
      setIsGesturing(true);
    } else if (e.touches.length === 1 && scaleRef.current > 1.01) {
      panRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        tx: translateRef.current.x,
        ty: translateRef.current.y,
      };
      setIsGesturing(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchRef.current.dist;
      const newScale = Math.max(0.5, Math.min(5, pinchRef.current.scale * ratio));

      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const originX = cx - rect.left - rect.width / 2;
        const originY = cy - rect.top - rect.height / 2;
        const scaleDelta = newScale / pinchRef.current.scale;
        const newTx = pinchRef.current.tx + originX * (1 - scaleDelta);
        const newTy = pinchRef.current.ty + originY * (1 - scaleDelta);

        const clamped = clamp(newTx, newTy);
        applyTransform(newScale, clamped);
      }
    } else if (e.touches.length === 1 && panRef.current && scaleRef.current > 1.01) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panRef.current.startX;
      const dy = e.touches[0].clientY - panRef.current.startY;
      const clamped = clamp(panRef.current.tx + dx, panRef.current.ty + dy);
      applyTransform(scaleRef.current, clamped);
    }
  }, [clamp, applyTransform]);

  const resetGesture = useCallback(() => {
    pinchRef.current = null;
    panRef.current = null;
    setIsGesturing(false);
    if (scaleRef.current < 1) {
      applyTransform(1, { x: 0, y: 0 }, true);
    }
  }, [applyTransform]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    resetGesture();
    if (e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (scaleRef.current > 1.1) {
          applyTransform(1, { x: 0, y: 0 }, true);
        } else {
          applyTransform(2.5, { x: 0, y: 0 }, true);
        }
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  }, [applyTransform, resetGesture]);

  const zoomIn = useCallback(() => {
    const s = Math.min(5, scaleRef.current * 1.5);
    applyTransform(s, clamp(translateRef.current.x, translateRef.current.y), true);
  }, [clamp, applyTransform]);

  const zoomOut = useCallback(() => {
    const s = Math.max(1, scaleRef.current / 1.5);
    const t = s <= 1 ? { x: 0, y: 0 } : clamp(translateRef.current.x, translateRef.current.y);
    applyTransform(s, t, true);
  }, [clamp, applyTransform]);

  const resetZoom = useCallback(() => {
    applyTransform(1, { x: 0, y: 0 }, true);
  }, [applyTransform]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-[#1a1a2e]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetGesture}
        style={{ touchAction: scale > 1.01 ? "none" : "pan-y" }}
        data-testid="pinch-zoom-container"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
        )}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isGesturing ? "none" : "transform 0.2s ease-out",
            willChange: "transform",
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain select-none"
            onLoad={() => { setLoading(false); setImgLoaded(true); }}
            draggable={false}
            data-testid="doc-viewer-image"
          />
        </div>
      </div>
      <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
    </div>
  );
}

function PdfViewer({ src, alt }: { src: string; alt: string }) {
  const [loading, setLoading] = useState(true);

  const openInBrowser = useCallback(() => {
    window.open(src, "_blank");
  }, [src]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        className="flex-1 overflow-auto relative bg-white"
        style={{ WebkitOverflowScrolling: "touch" } as any}
        data-testid="pdf-scroll-container"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#1a1a2e]">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
        )}
        <iframe
          src={src}
          className="w-full h-full border-0"
          title={alt}
          onLoad={() => setLoading(false)}
          data-testid="doc-viewer-iframe"
        />
      </div>
      <div className="flex-shrink-0 flex items-center justify-center gap-3 py-2 bg-[#0D1117] border-t border-white/10">
        <button
          onClick={openInBrowser}
          className="flex items-center justify-center gap-2 h-9 rounded-xl bg-blue-500/20 px-4 active:scale-[0.99]"
          data-testid="button-open-pdf-browser"
        >
          <ExternalLink className="h-4 w-4 text-blue-400" />
          <span className="text-sm text-blue-400 font-medium">Open for Full Zoom</span>
        </button>
      </div>
    </div>
  );
}

function ZoomControls({ scale, onZoomIn, onZoomOut, onReset }: { scale: number; onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-center gap-4 py-2 bg-[#0D1117] border-t border-white/10">
      <button
        onClick={onZoomOut}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
        data-testid="button-zoom-out"
      >
        <ZoomOut className="h-4 w-4 text-white/80" />
      </button>
      <button
        onClick={onReset}
        className="flex h-9 items-center justify-center rounded-xl bg-white/10 px-3 active:scale-[0.99]"
        data-testid="button-zoom-reset"
      >
        <RotateCcw className="h-3.5 w-3.5 text-white/80 mr-1.5" />
        <span className="text-xs text-white/80 font-medium">{Math.round(scale * 100)}%</span>
      </button>
      <button
        onClick={onZoomIn}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
        data-testid="button-zoom-in"
      >
        <ZoomIn className="h-4 w-4 text-white/80" />
      </button>
    </div>
  );
}

export default function MobileDocumentsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [viewingDoc, setViewingDoc] = useState(false);

  const queryPanelId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("panelId");
  }, [searchString]);

  const queryBundleId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("bundleId");
  }, [searchString]);

  const { data: bundleData, isLoading: isBundleLoading } = useQuery<any>({
    queryKey: [DOCUMENT_ROUTES.BUNDLES, queryBundleId],
    queryFn: async () => {
      const res = await fetch(`${DOCUMENT_ROUTES.BUNDLE_BY_ID(queryBundleId!)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bundle");
      return res.json();
    },
    enabled: !!queryBundleId,
  });

  const bundleDocIds = useMemo(() => {
    if (!queryBundleId || !bundleData?.items) return null;
    return new Set(bundleData.items.map((item: any) => item.documentId));
  }, [queryBundleId, bundleData]);

  const docsLimit = queryBundleId ? "200" : "50";
  const { data: docsResult, isLoading } = useQuery<{ documents: Document[]; total: number }>({
    queryKey: [DOCUMENT_ROUTES.LIST, { search: searchQuery, typeId: selectedTypeId, jobId: selectedJobId, panelId: queryPanelId, bundleId: queryBundleId, showLatestOnly: "true", limit: docsLimit }],
    queryFn: async () => {
      const params = new URLSearchParams({ showLatestOnly: "true", limit: docsLimit });
      if (searchQuery) params.set("search", searchQuery);
      if (selectedTypeId) params.set("typeId", selectedTypeId);
      if (selectedJobId) params.set("jobId", selectedJobId);
      if (queryPanelId) params.set("panelId", queryPanelId);
      const res = await fetch(`${DOCUMENT_ROUTES.LIST}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !queryBundleId || !!bundleData,
  });

  const { data: docTypes = [] } = useQuery<DocumentType[]>({
    queryKey: [DOCUMENT_ROUTES.TYPES_ACTIVE],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const isPrivileged = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { data: myJobMemberships = [] } = useQuery<string[]>({
    queryKey: [JOBS_ROUTES.MY_MEMBERSHIPS],
    enabled: !isPrivileged,
  });

  const isUnauthorizedJob = !isPrivileged && selectedJobId && !myJobMemberships.includes(selectedJobId);

  const allDocuments = docsResult?.documents || [];
  const documents = bundleDocIds
    ? allDocuments.filter(d => bundleDocIds.has(d.id))
    : allDocuments;

  const handleView = (doc: Document) => {
    setSelectedDoc(doc);
    setViewingDoc(true);
  };

  const handleShare = async (doc: Document) => {
    const viewUrl = `${window.location.origin}/api/documents/${doc.id}/view`;
    const shareData = {
      title: doc.title,
      text: `Document: ${doc.title}${doc.documentNumber ? ` (${doc.documentNumber})` : ""}`,
      url: viewUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(viewUrl);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({ title: "Failed to share document", variant: "destructive" });
      }
    }
  };

  const handleDownload = (doc: Document) => {
    const link = document.createElement("a");
    link.href = `/api/documents/${doc.id}/download`;
    link.download = doc.originalName;
    link.click();
  };

  if (viewingDoc && selectedDoc) {
    const FileIcon = getFileIcon(selectedDoc.mimeType);
    const isViewable = selectedDoc.mimeType.includes("pdf") || selectedDoc.mimeType.startsWith("image/");
    return (
      <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Documents">
        <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => { setViewingDoc(false); setSelectedDoc(null); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
              data-testid="button-back-from-doc-view"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold truncate">{selectedDoc.title}</div>
              {selectedDoc.documentNumber && (
                <div className="text-xs text-white/60">{selectedDoc.documentNumber}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col relative">
          {isViewable ? (
            selectedDoc.mimeType.startsWith("image/") ? (
              <PinchZoomImageViewer
                src={`/api/documents/${selectedDoc.id}/view`}
                alt={selectedDoc.title}
              />
            ) : (
              <PdfViewer
                src={`/api/documents/${selectedDoc.id}/view`}
                alt={selectedDoc.title}
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <FileIcon className="h-16 w-16 text-white/40 mb-4" />
              <p className="text-white/60 text-center mb-2">{selectedDoc.originalName}</p>
              <p className="text-white/40 text-sm mb-6">{formatFileSize(selectedDoc.fileSize)}</p>
              <p className="text-white/40 text-sm text-center">This file type cannot be previewed. Use the buttons below to download or share.</p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-white/10 bg-[#0D1117] px-4 py-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
          <div className="flex gap-3">
            <button
              onClick={() => handleShare(selectedDoc)}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-blue-500/20 text-blue-400 font-medium active:scale-[0.99]"
              data-testid="button-share-doc"
            >
              <Share2 className="h-5 w-5" />
              Share
            </button>
            <button
              onClick={() => handleDownload(selectedDoc)}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white/10 text-white font-medium active:scale-[0.99]"
              data-testid="button-download-doc"
            >
              <Download className="h-5 w-5" />
              Download
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Documents">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => {
                if (queryPanelId) setLocation(`/mobile/panels/${queryPanelId}`);
                else if (queryBundleId) setLocation("/mobile/scan");
                else setLocation("/mobile/more");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
              data-testid="button-back-to-more"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="text-2xl font-bold">{queryPanelId ? "Panel Documents" : queryBundleId ? "Bundle Documents" : "Documents"}</div>
              {queryPanelId && (
                <p className="text-xs text-white/50">Showing drawings for this panel</p>
              )}
              {queryBundleId && bundleData && (
                <p className="text-xs text-white/50">{bundleData.bundleName}</p>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-blue-400/50"
              data-testid="input-search-documents"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4 text-white/40" />
              </button>
            )}
          </div>
        </div>
      </div>

      {(docTypes.length > 0 || jobs.length > 0) && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            {jobs.length > 0 && (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Briefcase className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                <select
                  value={selectedJobId || ""}
                  onChange={(e) => setSelectedJobId(e.target.value || null)}
                  className="flex-1 min-w-0 h-9 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-medium px-3 appearance-none focus:outline-none focus:border-blue-400/50 [color-scheme:dark]"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em', paddingRight: '2rem' }}
                  data-testid="select-job-filter"
                >
                  <option value="">All Jobs</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={String(job.id)}>
                      {job.jobNumber} - {job.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {docTypes.length > 0 && (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Filter className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                <select
                  value={selectedTypeId || ""}
                  onChange={(e) => setSelectedTypeId(e.target.value || null)}
                  className="flex-1 min-w-0 h-9 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-medium px-3 appearance-none focus:outline-none focus:border-blue-400/50 [color-scheme:dark]"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em', paddingRight: '2rem' }}
                  data-testid="select-type-filter"
                >
                  <option value="">All Types</option>
                  {docTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.typeName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-2">
        {isUnauthorizedJob ? (
          <div className="flex flex-col items-center justify-center py-16" data-testid="unauthorized-job-message">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-3">
              <X className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-white/80 text-sm font-medium text-center">You are currently not authorised to view this job</p>
            <p className="text-white/40 text-xs mt-1 text-center">Contact the administrator for access</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-white/20 mb-3" />
            <p className="text-white/40 text-sm">
              {searchQuery ? "No documents match your search" : "No documents available"}
            </p>
          </div>
        ) : (
          documents.map((doc) => {
            const FileIcon = getFileIcon(doc.mimeType);
            const statusColor = getStatusColor(doc.status);
            return (
              <button
                key={doc.id}
                onClick={() => handleView(doc)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left active:scale-[0.99]"
                data-testid={`doc-item-${doc.id}`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 flex-shrink-0">
                  <FileIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{doc.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.documentNumber && (
                      <span className="text-xs text-white/40">{doc.documentNumber}</span>
                    )}
                    <span className="text-xs text-white/40">{formatFileSize(doc.fileSize)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                    {doc.status}
                  </span>
                  <span className="text-[10px] text-white/30">v{doc.version}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
