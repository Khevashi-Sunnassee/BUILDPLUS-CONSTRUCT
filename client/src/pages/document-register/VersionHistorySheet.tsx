import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Download,
  Eye,
  Mail,
  Sparkles,
  Loader2,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getCsrfToken, queryClient, apiRequest } from "@/lib/queryClient";
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import type { Document, DocumentWithDetails } from "./types";
import { statusConfig, formatDate } from "./types";

interface VersionHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentWithDetails | null;
  onSendEmail?: (doc: Document) => void;
}

export function VersionHistorySheet({ open, onOpenChange, document: versionHistoryDoc, onSendEmail }: VersionHistorySheetProps) {
  const { toast } = useToast();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [localSummaries, setLocalSummaries] = useState<Record<string, string>>({});
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [overlayMode, setOverlayMode] = useState<"overlay" | "side-by-side" | "both">("overlay");
  const [overlayDpi, setOverlayDpi] = useState(150);
  const [overlaySensitivity, setOverlaySensitivity] = useState(30);
  const [overlayPage, setOverlayPage] = useState(0);
  const [overlayResult, setOverlayResult] = useState<any>(null);
  const [showCompareSettings, setShowCompareSettings] = useState(false);

  const { data: versionHistory = [], isLoading } = useQuery<Document[]>({
    queryKey: [DOCUMENT_ROUTES.VERSIONS(versionHistoryDoc?.id || "")],
    enabled: !!versionHistoryDoc?.id && open,
  });

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
    },
    onError: (error: Error) => {
      toast({ title: "Comparison Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleAnalyzeChanges = async (versionId: string) => {
    setAnalyzingId(versionId);
    try {
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.ANALYZE_EXISTING_VERSIONS(versionId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }
      if (data.summary) {
        setLocalSummaries(prev => ({ ...prev, [versionId]: data.summary }));
        queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.VERSIONS(versionHistoryDoc?.id || "")] });
        toast({ title: "Analysis Complete", description: "AI version comparison summary generated" });
      }
    } catch (error: any) {
      toast({ title: "Analysis Failed", description: error.message || "Could not analyze document changes", variant: "destructive" });
    } finally {
      setAnalyzingId(null);
    }
  };

  const toggleVersionSelection = useCallback((versionId: string) => {
    setSelectedVersions(prev => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        if (next.size >= 2) {
          const firstId = next.values().next().value;
          if (firstId) next.delete(firstId);
        }
        next.add(versionId);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    const ids = Array.from(selectedVersions);
    if (ids.length !== 2) return;

    const idx0 = versionHistory.findIndex(v => v.id === ids[0]);
    const idx1 = versionHistory.findIndex(v => v.id === ids[1]);
    const olderFirst = idx0 > idx1 ? ids[0] : ids[1];
    const newerFirst = idx0 > idx1 ? ids[1] : ids[0];

    visualDiffMutation.mutate({
      docId1: olderFirst,
      docId2: newerFirst,
      page: overlayPage,
      dpi: overlayDpi,
      sensitivity: overlaySensitivity,
      mode: overlayMode,
    });
  }, [selectedVersions, versionHistory, overlayPage, overlayDpi, overlaySensitivity, overlayMode, visualDiffMutation]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setSelectedVersions(new Set());
      setOverlayResult(null);
      setShowCompareSettings(false);
    }
  };

  const canCompare = selectedVersions.size === 2;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>
            {versionHistoryDoc?.title}
          </SheetDescription>
        </SheetHeader>

        {canCompare && (
          <div className="flex-shrink-0 mt-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleCompare}
                disabled={visualDiffMutation.isPending}
                data-testid="button-compare-versions"
              >
                {visualDiffMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Compare Selected
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompareSettings(!showCompareSettings)}
                data-testid="button-toggle-compare-settings"
              >
                Settings
                {showCompareSettings ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedVersions(new Set());
                  setOverlayResult(null);
                }}
                data-testid="button-clear-selection"
              >
                Clear
              </Button>
            </div>

            {showCompareSettings && (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-md bg-muted/50 border">
                <div>
                  <Label className="text-xs">Mode</Label>
                  <Select value={overlayMode} onValueChange={(v) => setOverlayMode(v as "overlay" | "side-by-side" | "both")}>
                    <SelectTrigger data-testid="select-version-compare-mode">
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
                  <Label className="text-xs">DPI</Label>
                  <Select value={String(overlayDpi)} onValueChange={(v) => setOverlayDpi(Number(v))}>
                    <SelectTrigger data-testid="select-version-compare-dpi">
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
                    <SelectTrigger data-testid="select-version-compare-sensitivity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">High (10)</SelectItem>
                      <SelectItem value="30">Medium (30)</SelectItem>
                      <SelectItem value="50">Low (50)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Page</Label>
                  <Input
                    type="number"
                    min={1}
                    value={overlayPage + 1}
                    onChange={(e) => setOverlayPage(Math.max(0, parseInt(e.target.value || "1") - 1))}
                    data-testid="input-version-compare-page"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="space-y-4" data-testid="skeleton-version-history">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-12" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <div className="flex gap-1">
                        <Skeleton className="h-9 w-9 rounded-md" />
                        <Skeleton className="h-9 w-9 rounded-md" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : versionHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No version history available</p>
          ) : (
            versionHistory.map((version) => {
              const status = statusConfig[version.status] || statusConfig.DRAFT;
              const summary = localSummaries[version.id] || version.changeSummary;
              const hasParent = !!version.parentDocumentId;
              const isAnalyzing = analyzingId === version.id;
              const isSelected = selectedVersions.has(version.id);

              return (
                <Card key={version.id} className={`${version.isLatestVersion ? "border-primary" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-2">
                      <div className="pt-0.5 flex-shrink-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleVersionSelection(version.id)}
                          data-testid={`checkbox-version-${version.id}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-medium">v{version.version}{version.revision}</span>
                            {version.isLatestVersion && (
                              <Badge variant="outline" className="text-primary border-primary">Latest</Badge>
                            )}
                            <Badge className={status.className}>{status.label}</Badge>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => window.open(DOCUMENT_ROUTES.VIEW(version.id), "_blank")}
                                  data-testid={`button-view-version-${version.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = DOCUMENT_ROUTES.DOWNLOAD(version.id);
                                    link.download = version.originalName;
                                    link.click();
                                  }}
                                  data-testid={`button-download-version-${version.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                            {onSendEmail && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => onSendEmail(version)}
                                    data-testid={`button-email-version-${version.id}`}
                                  >
                                    <Mail className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Send via Email</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(version.createdAt)}
                        </p>
                      </div>
                    </div>

                    {summary && (
                      <div className="mt-3 p-2 rounded-md bg-muted/50 border text-sm" data-testid={`text-change-summary-${version.id}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="text-xs font-medium text-muted-foreground">AI Version Summary</span>
                        </div>
                        <p className="text-sm leading-relaxed">{summary}</p>
                      </div>
                    )}
                    {!summary && hasParent && !isAnalyzing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs text-muted-foreground"
                        onClick={() => handleAnalyzeChanges(version.id)}
                        data-testid={`button-analyze-changes-${version.id}`}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Analyze Version Changes
                      </Button>
                    )}
                    {isAnalyzing && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Analyzing changes...</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {overlayResult && (
            <div className="space-y-3 pb-4">
              <Separator />
              <div className="text-sm font-medium">Comparison Results</div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={overlayResult.changePercentage > 5 ? "destructive" : "secondary"} data-testid="badge-version-change-pct">
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
                      data-testid="img-version-overlay-result"
                    />
                  </div>
                  <div className="flex gap-2 items-center text-xs text-muted-foreground flex-wrap">
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-500/70" /> Removed content
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/60 ml-2" /> Added content
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(DOCUMENT_ROUTES.DOWNLOAD(overlayResult.overlayDocumentId), "_blank")}
                    data-testid="button-download-version-overlay"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Overlay
                  </Button>
                </div>
              )}

              {overlayResult.aiSummary && (
                <Card className="bg-muted/50" data-testid="card-version-ai-summary">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">AI Comparison Summary</div>
                        <p className="text-sm leading-relaxed" data-testid="text-version-ai-summary">{overlayResult.aiSummary}</p>
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
                      data-testid="img-version-sbs-result"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
