import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  Loader2,
  X,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queryClient, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface KbUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KbUploadDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: KbUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "text">("file");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");

  const resetForm = () => {
    setSelectedFile(null);
    setFileTitle("");
    setTextTitle("");
    setTextContent("");
    setDragActive(false);
  };

  const uploadFileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", fileTitle.trim() || selectedFile.name);

      const token = getCsrfToken();
      const headers: Record<string, string> = {};
      if (token) headers["x-csrf-token"] = token;

      const res = await fetch(`/api/kb/projects/${projectId}/documents/upload`, {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document uploaded", description: "Processing started. It will be ready for questions shortly." });
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", projectId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const addTextMutation = useMutation({
    mutationFn: async () => {
      const token = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-csrf-token"] = token;

      const res = await fetch(`/api/kb/projects/${projectId}/documents`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          title: textTitle.trim(),
          content: textContent.trim(),
          sourceType: "TEXT",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add document");
      }
      const doc = await res.json();
      await fetch(`/api/kb/documents/${doc.id}/process`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      return doc;
    },
    onSuccess: () => {
      toast({ title: "Document added", description: "Processing started. It will be ready for questions shortly." });
      queryClient.invalidateQueries({ queryKey: ["/api/kb/projects", projectId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add document", description: error.message, variant: "destructive" });
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      if (!fileTitle) setFileTitle(file.name.replace(/\.[^.]+$/, ""));
    }
  }, [fileTitle, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      if (!fileTitle) setFileTitle(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const isPending = uploadFileMutation.isPending || addTextMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-kb-upload">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Add Document to Knowledge Base
          </DialogTitle>
          <DialogDescription>
            Add a document to <span className="font-medium">{projectName}</span>. The system will automatically process and index it for AI search.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "file" | "text")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" data-testid="tab-file-upload">
              <FileUp className="h-4 w-4 mr-1.5" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="text" data-testid="tab-text-paste">
              <FileText className="h-4 w-4 mr-1.5" />
              Paste Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4 mt-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
                selectedFile && "border-green-500 bg-green-50 dark:bg-green-950/20"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-kb-file"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".txt,.md,.csv,.json,.xml,.pdf,.doc,.docx,.rtf,.html"
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="h-10 w-10 mx-auto text-green-600" />
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    data-testid="btn-remove-file"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {dragActive ? "Drop file here" : "Drag & drop a file, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports TXT, MD, CSV, JSON, XML, PDF, DOC, DOCX (max 10MB)
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Document Title</Label>
              <Input
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="Auto-filled from filename"
                data-testid="input-kb-file-title"
              />
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Document Title</Label>
              <Input
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="e.g., Safety Manual 2024"
                data-testid="input-kb-text-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste your document content here..."
                rows={10}
                className="font-mono text-xs"
                data-testid="input-kb-text-content"
              />
              {textContent && (
                <p className="text-xs text-muted-foreground">
                  ~{Math.ceil(textContent.length / 3.5)} tokens
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }} data-testid="btn-cancel-kb-upload">
            Cancel
          </Button>
          {tab === "file" ? (
            <Button
              onClick={() => uploadFileMutation.mutate()}
              disabled={!selectedFile || isPending}
              data-testid="btn-confirm-kb-upload"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload & Process
            </Button>
          ) : (
            <Button
              onClick={() => addTextMutation.mutate()}
              disabled={!textTitle.trim() || !textContent.trim() || isPending}
              data-testid="btn-confirm-kb-text"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Add & Process
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
