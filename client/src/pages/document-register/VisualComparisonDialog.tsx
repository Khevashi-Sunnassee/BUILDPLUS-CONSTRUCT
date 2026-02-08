import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Download,
  Loader2,
  Layers,
  Sparkles,
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
                  value={overlayPage + 1}
                  onChange={(e) => setOverlayPage(Math.max(0, parseInt(e.target.value || "1") - 1))}
                  className="w-20"
                  data-testid="input-overlay-page"
                />
                <span className="text-xs text-muted-foreground">(1-indexed)</span>
              </div>
            )}

            {overlayResult && (
              <div className="space-y-3">
                <Separator />
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={overlayResult.changePercentage > 5 ? "destructive" : "secondary"} data-testid="badge-change-pct">
                    {overlayResult.changePercentage}% Changed
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {overlayResult.changedPixels?.toLocaleString()} of {overlayResult.totalPixels?.toLocaleString()} pixels differ
                  </span>
                </div>

                {overlayResult.overlayDocumentId && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Overlay Result</div>
                    <div className="border rounded-md overflow-hidden bg-muted">
                      <img
                        src={DOCUMENT_ROUTES.VIEW(overlayResult.overlayDocumentId)}
                        alt="Visual overlay comparison"
                        className="w-full h-auto"
                        data-testid="img-overlay-result"
                      />
                    </div>
                    <div className="flex gap-2 items-center text-xs text-muted-foreground">
                      <span className="inline-block w-3 h-3 rounded-sm bg-red-500/70" /> Removed content
                      <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/60 ml-2" /> Added content
                    </div>
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
                    <div className="border rounded-md overflow-hidden bg-muted">
                      <img
                        src={DOCUMENT_ROUTES.VIEW(overlayResult.sideBySideDocumentId)}
                        alt="Side-by-side comparison"
                        className="w-full h-auto"
                        data-testid="img-sbs-result"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-overlay-cancel">
                {overlayResult ? "Close" : "Cancel"}
              </Button>
              {overlayResult && overlayResult.overlayDocumentId && (
                <Button
                  variant="outline"
                  onClick={() => window.open(DOCUMENT_ROUTES.DOWNLOAD(overlayResult.overlayDocumentId), "_blank")}
                  data-testid="button-overlay-download"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Overlay
                </Button>
              )}
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
                ) : overlayResult ? (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Re-compare
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
