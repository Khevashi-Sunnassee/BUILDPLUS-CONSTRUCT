import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import {
  Download,
  Loader2,
  Layers,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowLeft,
  Move,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import type { DocumentWithDetails } from "./types";

interface VisualComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocIds: Set<string>;
  documents: DocumentWithDetails[];
}

function ZoomableImage({ src, alt, testId }: { src: string; alt: string; testId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom(prev => Math.min(10, Math.max(0.25, prev + delta)));
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} data-testid={`${testId}-zoom-out`}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-mono min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(10, z + 0.25))} data-testid={`${testId}-zoom-in`}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={resetView} data-testid={`${testId}-zoom-reset`}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        {zoom > 1 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Move className="h-3 w-3" /> Drag to pan
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">Ctrl + Scroll to zoom</span>
      </div>
      <div
        ref={containerRef}
        className="border rounded-md overflow-hidden bg-muted relative"
        style={{ cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-auto select-none"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 0.1s ease-out",
          }}
          draggable={false}
          data-testid={testId}
        />
      </div>
    </div>
  );
}

export function VisualComparisonDialog({ open, onOpenChange, selectedDocIds, documents }: VisualComparisonDialogProps) {
  const { toast } = useToast();
  const [overlayMode, setOverlayMode] = useState<"overlay" | "side-by-side" | "both">("overlay");
  const [overlayDpi, setOverlayDpi] = useState(150);
  const [overlaySensitivity, setOverlaySensitivity] = useState(30);
  const [overlayPage, setOverlayPage] = useState(0);
  const [overlayResult, setOverlayResult] = useState<any>(null);

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

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setOverlayResult(null);
    }
  };

  const selectedIds = Array.from(selectedDocIds);
  const docA = documents.find(d => d.id === selectedIds[0]);
  const docB = documents.find(d => d.id === selectedIds[1]);

  const hasResults = !!overlayResult;

  useEffect(() => {
    const mainEl = document.getElementById("main-content");
    if (hasResults && mainEl) {
      mainEl.style.position = "relative";
      mainEl.style.overflow = "hidden";
      return () => {
        mainEl.style.position = "";
        mainEl.style.overflow = "";
      };
    }
  }, [hasResults]);

  if (hasResults) {
    const mainEl = document.getElementById("main-content");
    const resultsContent = (
      <div
        className="absolute inset-0 z-30 bg-background flex flex-col"
        data-testid="fullscreen-comparison"
      >
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)} data-testid="button-comparison-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-semibold">Visual Document Comparison</h1>
          <div className="flex items-center gap-2 ml-2">
            <Badge variant={overlayResult.changePercentage > 5 ? "destructive" : "secondary"} data-testid="badge-change-pct">
              {overlayResult.changePercentage}% Changed
            </Badge>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {overlayResult.changedPixels?.toLocaleString()} of {overlayResult.totalPixels?.toLocaleString()} pixels differ
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-500/70" />
              <span className="text-xs text-muted-foreground">Removed</span>
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/60 ml-2" />
              <span className="text-xs text-muted-foreground">Added</span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            {overlayResult.overlayDocumentId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(DOCUMENT_ROUTES.DOWNLOAD(overlayResult.overlayDocumentId), "_blank")}
                data-testid="button-overlay-download"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            )}
            <Button
              size="sm"
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
              data-testid="button-overlay-regenerate"
            >
              {visualDiffMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Layers className="h-4 w-4 mr-1" />
              )}
              Re-compare
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">A:</span>
            <span className="font-medium truncate max-w-[200px]">{docA?.title}</span>
            <Badge variant="outline" className="text-[10px]">Rev {docA?.revision}</Badge>
          </div>
          <span className="text-muted-foreground">vs</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">B:</span>
            <span className="font-medium truncate max-w-[200px]">{docB?.title}</span>
            <Badge variant="outline" className="text-[10px]">Rev {docB?.revision}</Badge>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <Label className="text-xs">Mode</Label>
            <Select value={overlayMode} onValueChange={(v) => setOverlayMode(v as any)}>
              <SelectTrigger className="h-7 text-xs w-[110px]" data-testid="select-overlay-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overlay">Overlay</SelectItem>
                <SelectItem value="side-by-side">Side by Side</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">DPI</Label>
            <Select value={String(overlayDpi)} onValueChange={(v) => setOverlayDpi(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-[120px]" data-testid="select-overlay-dpi">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="72">72 (Fast)</SelectItem>
                <SelectItem value="150">150 (Standard)</SelectItem>
                <SelectItem value="300">300 (High)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Sensitivity</Label>
            <Select value={String(overlaySensitivity)} onValueChange={(v) => setOverlaySensitivity(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-[100px]" data-testid="select-overlay-sensitivity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">High (10)</SelectItem>
                <SelectItem value="30">Medium (30)</SelectItem>
                <SelectItem value="50">Low (50)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(docA?.mimeType === "application/pdf" || docB?.mimeType === "application/pdf") && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Page</Label>
              <Input
                type="number"
                min={1}
                step="1"
                value={overlayPage + 1}
                onChange={(e) => setOverlayPage(Math.max(0, parseInt(e.target.value || "1") - 1))}
                className="w-16 h-7 text-xs"
                data-testid="input-overlay-page"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          {overlayResult.overlayDocumentId && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Overlay Result</div>
              <ZoomableImage
                src={DOCUMENT_ROUTES.VIEW(overlayResult.overlayDocumentId)}
                alt="Visual overlay comparison"
                testId="img-overlay-result"
              />
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
              <ZoomableImage
                src={DOCUMENT_ROUTES.VIEW(overlayResult.sideBySideDocumentId)}
                alt="Side-by-side comparison"
                testId="img-sbs-result"
              />
            </div>
          )}
        </div>
      </div>
    );

    if (mainEl) {
      return createPortal(resultsContent, mainEl);
    }
    return resultsContent;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-overlay-title">Visual Document Comparison</DialogTitle>
          <DialogDescription>
            Compare two documents side-by-side or as an overlay to highlight pixel-level differences.
          </DialogDescription>
        </DialogHeader>

        {docA && docB && (
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
                <Select value={overlayMode} onValueChange={(v) => setOverlayMode(v as "overlay" | "side-by-side" | "both")}>
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
                  step="1"
                  value={overlayPage + 1}
                  onChange={(e) => setOverlayPage(Math.max(0, parseInt(e.target.value || "1") - 1))}
                  className="w-20"
                  data-testid="input-overlay-page"
                />
                <span className="text-xs text-muted-foreground">(1-indexed)</span>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-overlay-cancel">
                Cancel
              </Button>
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
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Generate Comparison
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
