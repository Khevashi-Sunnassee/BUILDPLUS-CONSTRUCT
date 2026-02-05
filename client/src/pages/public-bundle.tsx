import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, AlertCircle, Clock, Package, Loader2 } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading bundle...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
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

  return (
    <div className="min-h-screen bg-background py-8 px-4">
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
          <Badge variant="outline" className="mt-2">
            {bundle.items.length} document{bundle.items.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documents</CardTitle>
            <CardDescription>Click to download any document from this bundle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bundle.items.map((doc) => (
              <div 
                key={doc.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium" data-testid={`text-doc-title-${doc.id}`}>{doc.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(doc.fileSize)} • {doc.originalName}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => handleDownload(doc.id, doc.originalName)}
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
          LTE Performance Management System
        </p>
      </div>
    </div>
  );
}
