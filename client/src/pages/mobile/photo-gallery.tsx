import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search,
  ImageIcon,
  ChevronLeft,
  Download,
  Share2,
  X,
  Loader2,
  Filter,
  Briefcase,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MessageSquare,
  Camera,
  Upload,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiUpload } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { DOCUMENT_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

const PHOTO_SUBJECTS = [
  { value: "progress", label: "Progress" },
  { value: "defect", label: "Defect" },
  { value: "safety", label: "Safety Issue" },
  { value: "quality", label: "Quality Inspection" },
  { value: "delivery", label: "Delivery" },
  { value: "site_conditions", label: "Site Conditions" },
  { value: "rework", label: "Rework" },
  { value: "damage", label: "Damage" },
  { value: "installation", label: "Installation" },
  { value: "completion", label: "Completion" },
  { value: "variation", label: "Variation" },
  { value: "hold_point", label: "Hold Point" },
  { value: "weather", label: "Weather" },
  { value: "equipment", label: "Equipment" },
  { value: "general", label: "General" },
] as const;

interface Photo {
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
  conversationId: string | null;
  messageId: string | null;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    return { x: Math.max(-maxX, Math.min(maxX, tx)), y: Math.max(-maxY, Math.min(maxY, ty)) };
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
      pinchRef.current = { dist: Math.hypot(dx, dy), cx: (e.touches[0].clientX + e.touches[1].clientX) / 2, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2, scale: scaleRef.current, tx: translateRef.current.x, ty: translateRef.current.y };
      panRef.current = null;
      setIsGesturing(true);
    } else if (e.touches.length === 1 && scaleRef.current > 1.01) {
      panRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, tx: translateRef.current.x, ty: translateRef.current.y };
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
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const originX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left - rect.width / 2;
        const originY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top - rect.height / 2;
        const scaleDelta = newScale / pinchRef.current.scale;
        applyTransform(newScale, clamp(pinchRef.current.tx + originX * (1 - scaleDelta), pinchRef.current.ty + originY * (1 - scaleDelta)));
      }
    } else if (e.touches.length === 1 && panRef.current && scaleRef.current > 1.01) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panRef.current.startX;
      const dy = e.touches[0].clientY - panRef.current.startY;
      applyTransform(scaleRef.current, clamp(panRef.current.tx + dx, panRef.current.ty + dy));
    }
  }, [clamp, applyTransform]);

  const resetGesture = useCallback(() => {
    pinchRef.current = null;
    panRef.current = null;
    setIsGesturing(false);
    if (scaleRef.current < 1) applyTransform(1, { x: 0, y: 0 }, true);
  }, [applyTransform]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    resetGesture();
    if (e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        applyTransform(scaleRef.current > 1.1 ? 1 : 2.5, { x: 0, y: 0 }, true);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  }, [applyTransform, resetGesture]);

  const zoomIn = useCallback(() => { const s = Math.min(5, scaleRef.current * 1.5); applyTransform(s, clamp(translateRef.current.x, translateRef.current.y), true); }, [clamp, applyTransform]);
  const zoomOut = useCallback(() => { const s = Math.max(1, scaleRef.current / 1.5); applyTransform(s, s <= 1 ? { x: 0, y: 0 } : clamp(translateRef.current.x, translateRef.current.y), true); }, [clamp, applyTransform]);
  const resetZoom = useCallback(() => { applyTransform(1, { x: 0, y: 0 }, true); }, [applyTransform]);

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
            data-testid="photo-viewer-image"
          />
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center justify-center gap-4 py-2 bg-[#0D1117] border-t border-white/10">
        <button onClick={zoomOut} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]" data-testid="button-zoom-out">
          <ZoomOut className="h-4 w-4 text-white/80" />
        </button>
        <button onClick={resetZoom} className="flex h-9 items-center justify-center rounded-xl bg-white/10 px-3 active:scale-[0.99]" data-testid="button-zoom-reset">
          <RotateCcw className="h-3.5 w-3.5 text-white/80 mr-1.5" />
          <span className="text-xs text-white/80 font-medium">{Math.round(scale * 100)}%</span>
        </button>
        <button onClick={zoomIn} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]" data-testid="button-zoom-in">
          <ZoomIn className="h-4 w-4 text-white/80" />
        </button>
      </div>
    </div>
  );
}

export default function MobilePhotoGallery() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [excludeChat, setExcludeChat] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [photoJobId, setPhotoJobId] = useState<string>("");
  const [photoSubject, setPhotoSubject] = useState<string>("");
  const [photoDescription, setPhotoDescription] = useState<string>("");

  const handleTakePhoto = () => {
    cameraInputRef.current?.click();
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCapturedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setCapturedPreview(previewUrl);
    setPhotoJobId("");
    setPhotoSubject("");
    setPhotoDescription("");
    setMetadataDialogOpen(true);

    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleCancelMetadata = () => {
    setMetadataDialogOpen(false);
    if (capturedPreview) URL.revokeObjectURL(capturedPreview);
    setCapturedFile(null);
    setCapturedPreview(null);
    setPhotoJobId("");
    setPhotoSubject("");
    setPhotoDescription("");
  };

  const handleConfirmUpload = async () => {
    if (!capturedFile || !photoJobId || !photoSubject) return;

    setIsUploading(true);
    try {
      const subjectLabel = PHOTO_SUBJECTS.find(s => s.value === photoSubject)?.label || photoSubject;
      const selectedJob = jobs.find(j => String(j.id) === photoJobId);
      const jobLabel = selectedJob ? `${selectedJob.jobNumber} - ${selectedJob.name}` : "";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const title = `${subjectLabel} - ${jobLabel} - ${timestamp}`;

      const formData = new FormData();
      formData.append("file", capturedFile);
      formData.append("title", title);
      formData.append("jobId", photoJobId);
      formData.append("tags", photoSubject);
      if (photoDescription) {
        formData.append("description", photoDescription);
      }

      await apiUpload("/api/documents/upload", formData);

      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      toast({ title: "Photo uploaded successfully" });
      handleCancelMetadata();
    } catch (error: any) {
      toast({ title: "Failed to upload photo", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmitPhoto = photoJobId !== "" && photoSubject !== "";

  const { data: photosResult, isLoading } = useQuery<{ documents: Photo[]; total: number }>({
    queryKey: [DOCUMENT_ROUTES.LIST, "mobile-photos", { search: searchQuery, jobId: selectedJobId, typeId: selectedTypeId, excludeChat }],
    queryFn: async () => {
      const params = new URLSearchParams({ showLatestOnly: "true", limit: "100", mimeTypePrefix: "image/" });
      if (searchQuery) params.set("search", searchQuery);
      if (selectedJobId) params.set("jobId", selectedJobId);
      if (selectedTypeId) params.set("typeId", selectedTypeId);
      if (excludeChat) params.set("excludeChat", "true");
      const res = await fetch(`${DOCUMENT_ROUTES.LIST}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch photos");
      return res.json();
    },
  });

  const { data: docTypes = [] } = useQuery<DocumentType[]>({
    queryKey: [DOCUMENT_ROUTES.TYPES_ACTIVE],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const isPrivileged = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { data: myJobMemberships = [] } = useQuery<string[]>({
    queryKey: [JOBS_ROUTES.MY_MEMBERSHIPS],
    enabled: !isPrivileged,
  });

  const isUnauthorizedJob = !isPrivileged && selectedJobId && !myJobMemberships.includes(selectedJobId);

  const photos = photosResult?.documents || [];

  const handleShare = async (photo: Photo) => {
    const viewUrl = `${window.location.origin}/api/documents/${photo.id}/view`;
    try {
      if (navigator.share) {
        await navigator.share({ title: photo.title, text: `Photo: ${photo.title}`, url: viewUrl });
      } else {
        await navigator.clipboard.writeText(viewUrl);
        toast({ title: "Link copied to clipboard" });
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({ title: "Failed to share photo", variant: "destructive" });
      }
    }
  };

  const handleDownload = (photo: Photo) => {
    const link = document.createElement("a");
    link.href = `/api/documents/${photo.id}/download`;
    link.download = photo.originalName;
    link.click();
  };

  if (viewingPhoto && selectedPhoto) {
    return (
      <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
        <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => { setViewingPhoto(false); setSelectedPhoto(null); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
              data-testid="button-back-from-photo-view"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold truncate">{selectedPhoto.title}</div>
              <div className="text-xs text-white/60">{formatFileSize(selectedPhoto.fileSize)}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col relative">
          <PinchZoomImageViewer
            src={`/api/documents/${selectedPhoto.id}/view`}
            alt={selectedPhoto.title}
          />
        </div>

        <div className="flex-shrink-0 border-t border-white/10 bg-[#0D1117] px-4 py-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
          <div className="flex gap-3">
            <button
              onClick={() => handleShare(selectedPhoto)}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-blue-500/20 text-blue-400 font-medium active:scale-[0.99]"
              data-testid="button-share-photo"
            >
              <Share2 className="h-5 w-5" />
              Share
            </button>
            <button
              onClick={() => handleDownload(selectedPhoto)}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white/10 text-white font-medium active:scale-[0.99]"
              data-testid="button-download-photo"
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
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setLocation("/mobile/more")}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
              data-testid="button-back-to-more"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="text-2xl font-bold">Photo Gallery</div>
              <p className="text-xs text-white/50">{photos.length} photos</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Search photos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-blue-400/50"
              data-testid="input-search-photos"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="button-clear-search">
                <X className="h-4 w-4 text-white/40" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 py-2 border-b border-white/10 space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              onClick={() => setExcludeChat(true)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                excludeChat
                  ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                  : "bg-white/5 border-white/10 text-white/60"
              }`}
              data-testid="filter-exclude-chat"
            >
              Project Only
            </button>
            <button
              onClick={() => setExcludeChat(false)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                !excludeChat
                  ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                  : "bg-white/5 border-white/10 text-white/60"
              }`}
              data-testid="filter-include-chat"
            >
              All Photos
            </button>
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                onClick={() => setSelectedJobId(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                  selectedJobId === null
                    ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                    : "bg-white/5 border-white/10 text-white/60"
                }`}
                data-testid="filter-all-jobs"
              >
                All Jobs
              </button>
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(selectedJobId === String(job.id) ? null : String(job.id))}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                    selectedJobId === String(job.id)
                      ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                  data-testid={`filter-job-${job.id}`}
                >
                  {job.jobNumber}
                </button>
              ))}
            </div>
          </div>
        )}

        {docTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                onClick={() => setSelectedTypeId(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                  selectedTypeId === null
                    ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                    : "bg-white/5 border-white/10 text-white/60"
                }`}
                data-testid="filter-all-types"
              >
                All Types
              </button>
              {docTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedTypeId(selectedTypeId === type.id ? null : type.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border active:scale-[0.99] ${
                    selectedTypeId === type.id
                      ? "bg-blue-500/20 border-blue-400/30 text-blue-400"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                  data-testid={`filter-type-${type.id}`}
                >
                  {type.typeName}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
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
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ImageIcon className="h-12 w-12 text-white/20 mb-3" />
            <p className="text-white/40 text-sm">
              {searchQuery ? "No photos match your search" : "No photos available"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => { setSelectedPhoto(photo); setViewingPhoto(true); }}
                className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 active:scale-[0.99]"
                data-testid={`photo-thumb-${photo.id}`}
              >
                <img
                  src={`/api/documents/${photo.id}/view`}
                  alt={photo.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {photo.conversationId && (
                  <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
                    <MessageSquare className="h-3 w-3 text-blue-400" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white font-medium truncate">{photo.title}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
        data-testid="input-camera-capture"
      />

      <Dialog open={metadataDialogOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto [&>button:last-child]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Photo Details</DialogTitle>
            <DialogDescription>
              Select a job and reason for this photo before uploading.
            </DialogDescription>
          </DialogHeader>

          {capturedPreview && (
            <div className="rounded-md overflow-hidden border bg-muted aspect-video flex items-center justify-center">
              <img
                src={capturedPreview}
                alt="Captured preview"
                className="w-full h-full object-cover"
                data-testid="img-photo-preview"
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-photo-job">
                Job <span className="text-destructive">*</span>
              </label>
              <Select value={photoJobId} onValueChange={setPhotoJobId} disabled={jobsLoading}>
                <SelectTrigger data-testid="select-photo-job">
                  <SelectValue placeholder={jobsLoading ? "Loading jobs..." : "Select a job"} />
                </SelectTrigger>
                <SelectContent>
                  {jobs.slice().sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || '')).map((job) => (
                    <SelectItem key={job.id} value={String(job.id)} data-testid={`option-job-${job.id}`}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {photoJobId === "" && (
                <p className="text-xs text-muted-foreground">Required - select which job this photo belongs to</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-photo-subject">
                Subject <span className="text-destructive">*</span>
              </label>
              <Select value={photoSubject} onValueChange={setPhotoSubject}>
                <SelectTrigger data-testid="select-photo-subject">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {PHOTO_SUBJECTS.map((subject) => (
                    <SelectItem key={subject.value} value={subject.value} data-testid={`option-subject-${subject.value}`}>
                      {subject.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {photoSubject === "" && (
                <p className="text-xs text-muted-foreground">Required - select the reason for this photo</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-photo-description">
                Description (optional)
              </label>
              <Input
                placeholder="Add a brief description..."
                value={photoDescription}
                onChange={(e) => setPhotoDescription(e.target.value)}
                data-testid="input-photo-description"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelMetadata}
              disabled={isUploading}
              className="flex-1"
              data-testid="button-cancel-photo-upload"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmUpload}
              disabled={!canSubmitPhoto || isUploading}
              className="flex-1"
              data-testid="button-confirm-photo-upload"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-20 right-4 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button
          onClick={handleTakePhoto}
          disabled={isUploading}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 active:scale-[0.97] disabled:opacity-60"
          data-testid="button-take-photo"
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Camera className="h-6 w-6" />
          )}
        </button>
      </div>

      <MobileBottomNav />
    </div>
  );
}
