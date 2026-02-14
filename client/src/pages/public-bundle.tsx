import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, AlertCircle, AlertTriangle, Clock, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DOCUMENT_ROUTES } from "@shared/api-routes";

interface PublicBundleDocument {
  id: string;
  title: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  version?: string;
  revision?: string;
  documentNumber?: string;
  isLatestVersion?: boolean;
  isStale?: boolean;
}

interface PublicBundle {
  bundleName: string;
  description: string | null;
  items: PublicBundleDocument[];
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PublicBundlePage() {
  const { qrCodeId } = useParams<{ qrCodeId: string }>();

  const { data: bundle, isLoading, error } = useQuery<PublicBundle>({
    queryKey: [DOCUMENT_ROUTES.PUBLIC_BUNDLE(qrCodeId || "")],
    queryFn: async () => {
      const response = await fetch(DOCUMENT_ROUTES.PUBLIC_BUNDLE(qrCodeId || ""));
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to load bundle");
      }
      return response.json();
    },
    enabled: !!qrCodeId,
  });

  const handleDownload = (documentId: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = `${DOCUMENT_ROUTES.PUBLIC_BUNDLE(qrCodeId || "")}/documents/${documentId}/download`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="main" aria-label="Public Bundle">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading bundle...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" role="main" aria-label="Public Bundle">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Bundle Unavailable</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "This bundle is not available or has expired."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" role="main" aria-label="Public Bundle">
        <Alert className="max-w-md">
          <Clock className="h-4 w-4" />
          <AlertTitle>Bundle Not Found</AlertTitle>
          <AlertDescription>
            The requested document bundle could not be found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const staleCount = bundle.items.filter((doc) => doc.isStale).length;

  return (
    <div className="min-h-screen bg-background py-8 px-4" role="main" aria-label="Public Bundle">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Package className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-bundle-name">{bundle.bundleName}</h1>
          {bundle.description && (
            <p className="text-muted-foreground" data-testid="text-bundle-description">{bundle.description}</p>
          )}
          <div className="flex justify-center gap-2 flex-wrap">
            <Badge variant="outline">
              {bundle.items.length} document{bundle.items.length !== 1 ? "s" : ""}
            </Badge>
            {staleCount > 0 && (
              <Badge
                variant="destructive"
                data-testid="badge-public-bundle-stale-count"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {staleCount} outdated
              </Badge>
            )}
          </div>
        </div>

        {staleCount > 0 && (
          <Alert variant="destructive" data-testid="alert-public-bundle-stale">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Some documents are outdated</AlertTitle>
            <AlertDescription>
              {staleCount} document{staleCount !== 1 ? "s have" : " has"} been superseded by newer versions. Contact the bundle owner for updates.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documents</CardTitle>
            <CardDescription>Click to download any document from this bundle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bundle.items.map((doc) => (
              <div 
                key={doc.id}
                className={`flex items-center justify-between gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors ${doc.isStale ? "border-destructive" : ""}`}
                data-testid={`public-bundle-doc-${doc.id}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className={`h-8 w-8 shrink-0 ${doc.isStale ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium" data-testid={`text-doc-title-${doc.id}`}>{doc.title}</p>
                      {doc.isStale && (
                        <Badge
                          variant="destructive"
                          className="shrink-0"
                          data-testid={`badge-stale-public-doc-${doc.id}`}
                        >
                          Superseded
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(doc.fileSize)} • {doc.originalName}
                      {doc.version && ` • v${doc.version}${doc.revision || ""}`}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => handleDownload(doc.id, doc.originalName)}
                  className="shrink-0"
                  data-testid={`button-download-${doc.id}`}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          BuildPlus Ai Management System
        </p>
      </div>
    </div>
  );
}
