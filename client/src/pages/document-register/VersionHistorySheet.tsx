import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Eye,
  Mail,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getCsrfToken, queryClient } from "@/lib/queryClient";
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

  const { data: versionHistory = [], isLoading } = useQuery<Document[]>({
    queryKey: [DOCUMENT_ROUTES.VERSIONS(versionHistoryDoc?.id || "")],
    enabled: !!versionHistoryDoc?.id && open,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>
            {versionHistoryDoc?.title}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
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

              return (
                <Card key={version.id} className={version.isLatestVersion ? "border-primary" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium">v{version.version}{version.revision}</span>
                          {version.isLatestVersion && (
                            <Badge variant="outline" className="text-primary border-primary">Latest</Badge>
                          )}
                          <Badge className={status.className}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(version.createdAt)}
                        </p>
                        {summary && (
                          <div className="mt-2 p-2 rounded-md bg-muted/50 border text-sm" data-testid={`text-change-summary-${version.id}`}>
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
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
