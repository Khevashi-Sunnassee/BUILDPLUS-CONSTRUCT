import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import type { Document, DocumentWithDetails } from "./types";
import { statusConfig, formatDate } from "./types";

interface VersionHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentWithDetails | null;
}

export function VersionHistorySheet({ open, onOpenChange, document: versionHistoryDoc }: VersionHistorySheetProps) {
  const { data: versionHistory = [] } = useQuery<Document[]>({
    queryKey: [DOCUMENT_ROUTES.VERSIONS(versionHistoryDoc?.id || "")],
    enabled: !!versionHistoryDoc?.id && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>
            {versionHistoryDoc?.title}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {versionHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No version history available</p>
          ) : (
            versionHistory.map((version, index) => {
              const status = statusConfig[version.status] || statusConfig.DRAFT;
              return (
                <Card key={version.id} className={version.isLatestVersion ? "border-primary" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">v{version.version}{version.revision}</span>
                          {version.isLatestVersion && (
                            <Badge variant="outline" className="text-primary border-primary">Latest</Badge>
                          )}
                          <Badge className={status.className}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(version.createdAt)}
                        </p>
                        {version.changeSummary && (
                          <p className="text-sm mt-2">{version.changeSummary}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(DOCUMENT_ROUTES.VIEW(version.id), "_blank")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = DOCUMENT_ROUTES.DOWNLOAD(version.id);
                            link.download = version.originalName;
                            link.click();
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
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
