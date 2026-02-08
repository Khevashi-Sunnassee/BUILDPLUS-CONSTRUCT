import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Upload,
  Download,
  FileText,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, getCsrfToken } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_ROUTES, DOCUMENT_ROUTES } from "@shared/api-routes";
import type { PanelDocument, DocumentsResponse } from "./types";
import { DOC_STATUS_COLORS } from "./types";

export function PanelDocumentsTab({ panelId, productionPdfUrl }: { panelId: string; productionPdfUrl?: string | null }) {
  const { toast } = useToast();
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"PRELIM" | "IFA" | "IFC">("PRELIM");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [existingIfcDoc, setExistingIfcDoc] = useState<PanelDocument | null>(null);
  const [supersededDocumentId, setSupersededDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documentsResponse, isLoading } = useQuery<DocumentsResponse>({
    queryKey: [DOCUMENT_ROUTES.PANEL_DOCUMENTS(panelId)],
  });

  const documents = documentsResponse?.documents || [];
  const hasIfcDocument = documents.some(d => d.status === "IFC" && d.isLatestVersion);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.PANEL_DOCUMENT_UPLOAD(panelId), {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.PANEL_DOCUMENTS(panelId)] });
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadStatus("PRELIM");
      setSupersededDocumentId(null);
      toast({ title: "Success", description: "Document uploaded successfully" });
    },
    onError: (error: any) => {
      if (error.message?.includes("IFC document already exists")) {
        const ifcDoc = documents.find(d => d.status === "IFC" && d.isLatestVersion);
        if (ifcDoc) {
          setExistingIfcDoc(ifcDoc);
        }
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleUpload = () => {
    if (!uploadFile || !uploadTitle) {
      toast({ title: "Error", description: "Please provide a title and file", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("title", uploadTitle);
    formData.append("status", uploadStatus);
    if (supersededDocumentId) {
      formData.append("supersededDocumentId", supersededDocumentId);
    }

    uploadMutation.mutate(formData);
  };

  const handleSupersede = (docId: string) => {
    setSupersededDocumentId(docId);
    setExistingIfcDoc(null);
    toast({ title: "Ready to Supersede", description: "Upload your new IFC document" });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Panel Documents</h3>
          <p className="text-xs text-muted-foreground">{documents.length} document(s) registered</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowUploadDialog(true)}
          data-testid="button-upload-panel-document"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {productionPdfUrl && (
        <div className="border rounded-lg p-3 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-medium">Production IFC Drawing</h4>
                <p className="text-xs text-muted-foreground">Uploaded during production approval</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild data-testid="button-download-ifc-pdf">
              <a href={ADMIN_ROUTES.PANEL_DOWNLOAD_PDF(panelId)} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border rounded-md bg-muted/30">
          <FileIcon className="h-10 w-10 text-muted-foreground mb-2" />
          <h3 className="font-medium text-muted-foreground text-sm">No Documents</h3>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Upload panel documents with PRELIM, IFA, or IFC status
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20">Version</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{doc.title}</div>
                      <div className="text-xs text-muted-foreground">{doc.originalName}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={DOC_STATUS_COLORS[doc.status] || ""} variant="outline">
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">v{doc.version}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatFileSize(doc.fileSize)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild data-testid={`button-view-document-${doc.id}`}>
                        <a href={DOCUMENT_ROUTES.VIEW(doc.id)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" asChild data-testid={`button-download-document-${doc.id}`}>
                        <a href={DOCUMENT_ROUTES.DOWNLOAD(doc.id)} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Panel Document</DialogTitle>
            <DialogDescription>
              Upload a document and select its status (PRELIM, IFA, or IFC)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Document Title</Label>
              <Input
                id="doc-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g., Panel Shop Drawing Rev A"
                data-testid="input-document-title"
              />
            </div>

            <div className="space-y-2">
              <Label>Document Status</Label>
              <div className="flex gap-2">
                {(["PRELIM", "IFA", "IFC"] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={uploadStatus === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setUploadStatus(status);
                      if (status === "IFC" && hasIfcDocument && !supersededDocumentId) {
                        const ifcDoc = documents.find(d => d.status === "IFC" && d.isLatestVersion);
                        if (ifcDoc) setExistingIfcDoc(ifcDoc);
                      } else {
                        setExistingIfcDoc(null);
                      }
                    }}
                    data-testid={`button-status-${status.toLowerCase()}`}
                  >
                    {status}
                  </Button>
                ))}
              </div>
              {existingIfcDoc && (
                <div className="mt-2 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950 text-sm">
                  <p className="text-amber-800 dark:text-amber-200 font-medium mb-2">
                    An IFC document already exists for this panel
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-xs mb-2">
                    "{existingIfcDoc.title}" (v{existingIfcDoc.version})
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSupersede(existingIfcDoc.id)}
                    data-testid="button-supersede-ifc"
                  >
                    Supersede this document
                  </Button>
                </div>
              )}
              {supersededDocumentId && (
                <div className="mt-2 p-2 border rounded bg-green-50 dark:bg-green-950 text-sm">
                  <p className="text-green-800 dark:text-green-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Document will supersede the existing IFC
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>File</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.ifc"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{uploadFile.name}</span>
                    <span className="text-xs text-muted-foreground">({formatFileSize(uploadFile.size)})</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select a file</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, CAD, IFC supported</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !uploadFile || !uploadTitle || (uploadStatus === "IFC" && hasIfcDocument && !supersededDocumentId)}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
