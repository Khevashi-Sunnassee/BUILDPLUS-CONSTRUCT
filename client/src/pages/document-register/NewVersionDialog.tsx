import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import type { DocumentWithDetails } from "./types";

interface NewVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentWithDetails | null;
}

export function NewVersionDialog({ open, onOpenChange, document: selectedDocument }: NewVersionDialogProps) {
  const { toast } = useToast();
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const [isAnalyzingVersion, setIsAnalyzingVersion] = useState(false);
  const [aiVersionSummary, setAiVersionSummary] = useState("");

  const newVersionMutation = useMutation({
    mutationFn: async ({ documentId, formData }: { documentId: string; formData: FormData }) => {
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.NEW_VERSION(documentId), {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "New version uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST] });
      onOpenChange(false);
      setVersionFile(null);
      setChangeSummary("");
      setAiVersionSummary("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAIAnalysis = async (file: File) => {
    if (!selectedDocument) return;

    setIsAnalyzingVersion(true);
    setAiVersionSummary("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("originalDocumentId", selectedDocument.id);

      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.ANALYZE_VERSION, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAiVersionSummary(data.summary || "");
        if (data.summary && !changeSummary) {
          setChangeSummary(data.summary);
        }
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
    } finally {
      setIsAnalyzingVersion(false);
    }
  };

  const handleNewVersion = () => {
    if (!selectedDocument || !versionFile) return;

    const formData = new FormData();
    formData.append("file", versionFile);
    formData.append("changeSummary", changeSummary || aiVersionSummary);

    newVersionMutation.mutate({ documentId: selectedDocument.id, formData });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload New Version</DialogTitle>
          <DialogDescription>
            Upload a new version of "{selectedDocument?.title}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  setVersionFile(file);
                  handleAIAnalysis(file);
                }
              };
              input.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.add("border-primary", "bg-primary/5");
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("border-primary", "bg-primary/5");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("border-primary", "bg-primary/5");
              const file = e.dataTransfer.files?.[0];
              if (file) {
                setVersionFile(file);
                handleAIAnalysis(file);
              }
            }}
            data-testid="version-dropzone"
          >
            {versionFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <span>{versionFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setVersionFile(null); setAiVersionSummary(""); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Click to select file or drag and drop</p>
              </>
            )}
          </div>

          {isAnalyzingVersion && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI is analyzing document changes...</span>
            </div>
          )}

          {aiVersionSummary && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">AI Generated</span>
                Version Summary
              </Label>
              <div className="bg-muted/50 rounded-lg p-3 text-sm border">
                {aiVersionSummary}
              </div>
            </div>
          )}

          <div>
            <Label>Change Summary</Label>
            <Textarea
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Describe what changed in this version (or use AI-generated summary above)"
              rows={3}
              data-testid="input-change-summary"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleNewVersion}
            disabled={newVersionMutation.isPending || !versionFile}
            data-testid="button-submit-version"
          >
            {newVersionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Upload Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
