import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Paperclip,
  Trash2,
  X,
  Send,
  Upload,
  FileText,
  Image,
  File,
} from "lucide-react";

interface BudgetLineInfo {
  id: string;
  costCode: { code: string; name: string };
  childCostCode: { code: string; name: string } | null;
}

interface BudgetLineUpdate {
  id: string;
  budgetLineId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  files?: BudgetLineFileItem[];
}

interface BudgetLineFileItem {
  id: string;
  budgetLineId: string;
  updateId: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploadedById: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string | null; email: string } | null;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

async function apiUpload(url: string, formData: FormData) {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || res.statusText);
  }
  return res;
}

export function BudgetLineSidebar({
  line,
  jobId,
  onClose,
  initialTab,
}: {
  line: BudgetLineInfo | null;
  jobId: string;
  onClose: () => void;
  initialTab?: "updates" | "files";
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"updates" | "files">(initialTab || "updates");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, line?.id]);

  const [newUpdate, setNewUpdate] = useState("");
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: updates = [], isLoading: updatesLoading } = useQuery<BudgetLineUpdate[]>({
    queryKey: [`/api/budget-lines/${line?.id}/updates`],
    enabled: !!line,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<BudgetLineFileItem[]>({
    queryKey: [`/api/budget-lines/${line?.id}/files`],
    enabled: !!line,
  });

  const createUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/budget-lines/${line?.id}/updates`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/updates`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget"] });
      setNewUpdate("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/budget-line-updates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/updates`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, updateId }: { file: File; updateId?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (updateId) formData.append("updateId", updateId);
      const res = await apiUpload(`/api/budget-lines/${line?.id}/files`, formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/files`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget"] });
      toast({ title: "File uploaded" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/budget-line-files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/files`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget"] });
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileMutation.mutate({ file });
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const timestamp = Date.now();
          const extension = item.type.split("/")[1] || "png";
          const newFileName = `screenshot_${timestamp}.${extension}`;
          Object.defineProperty(file, "name", { writable: true, value: newFileName });
          imageFiles.push(file);
        }
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      setPastedImages((prev) => [...prev, ...imageFiles]);
      toast({ title: `${imageFiles.length} image(s) pasted`, description: "Click Post Update to upload" });
    }
  }, [toast]);

  const removePastedImage = (index: number) => {
    setPastedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePostUpdate = async () => {
    if (!newUpdate.trim() && pastedImages.length === 0) return;
    try {
      const content = newUpdate.trim();
      const update = await createUpdateMutation.mutateAsync(content);
      const updateId = update?.id;
      if (pastedImages.length > 0) {
        for (const file of pastedImages) {
          await uploadFileMutation.mutateAsync({ file, updateId });
        }
        queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/updates`] });
      }
      setPastedImages([]);
    } catch (error) {}
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-4 w-4" />;
    if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!line) return null;

  const lineLabel = line.childCostCode
    ? `${line.childCostCode.code} - ${line.childCostCode.name}`
    : `${line.costCode.code} - ${line.costCode.name}`;

  return (
    <Sheet open={!!line} onOpenChange={() => onClose()}>
      <SheetContent className="w-[400px] sm:w-[500px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg truncate">{lineLabel}</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="btn-close-budget-sidebar">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant={activeTab === "updates" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("updates")}
              data-testid="tab-budget-updates"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Updates
            </Button>
            <Button
              variant={activeTab === "files" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("files")}
              data-testid="tab-budget-files"
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Files
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "updates" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Textarea
                  ref={textareaRef}
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Write an update - paste screenshots here"
                  className="min-h-[80px] resize-none"
                  data-testid="input-budget-new-update"
                />
                {pastedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-muted/30">
                    {pastedImages.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Pasted screenshot ${index + 1}`}
                          className="h-16 w-auto rounded border object-cover"
                        />
                        <button
                          onClick={() => removePastedImage(index)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`btn-remove-budget-pasted-image-${index}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <span className="text-xs text-muted-foreground self-center">
                      {pastedImages.length} screenshot(s) ready to upload
                    </span>
                  </div>
                )}
              </div>
              <Button
                onClick={handlePostUpdate}
                disabled={(!newUpdate.trim() && pastedImages.length === 0) || createUpdateMutation.isPending || uploadFileMutation.isPending}
                className="w-full"
                data-testid="btn-budget-post-update"
              >
                <Send className="h-4 w-4 mr-2" />
                {uploadFileMutation.isPending ? "Uploading..." : "Post Update"}
              </Button>

              {updatesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : updates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No updates yet</p>
                  <p className="text-sm">Share progress or notes about this budget line</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="border rounded-lg p-3 group" data-testid={`budget-update-${update.id}`}>
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(update.user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{update.user.name || update.user.email}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(update.createdAt), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                          {update.content && (
                            <p className="text-sm mt-1 whitespace-pre-wrap">{update.content}</p>
                          )}
                          {update.files && update.files.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {update.files.map((file) =>
                                file.mimeType?.startsWith("image/") ? (
                                  <a key={file.id} href={file.fileUrl || "#"} target="_blank" rel="noopener noreferrer" className="block">
                                    <img
                                      src={file.fileUrl || ""}
                                      alt={file.fileName || ""}
                                      className="max-w-full max-h-48 rounded border object-contain cursor-pointer hover:opacity-90"
                                      data-testid={`budget-update-image-${file.id}`}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={file.id}
                                    href={file.fileUrl || "#"}
                                    download={file.fileName || "file"}
                                    className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate"
                                    data-testid={`budget-update-file-${file.id}`}
                                  >
                                    <Paperclip className="h-4 w-4" />
                                    {file.fileName}
                                  </a>
                                )
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteUpdateMutation.mutate(update.id)}
                          data-testid={`btn-delete-budget-update-${update.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFileMutation.isPending}
                data-testid="btn-budget-upload-file"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadFileMutation.isPending ? "Uploading..." : "Upload File"}
              </Button>

              {filesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No files attached</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border rounded-lg group hover-elevate"
                      data-testid={`budget-file-${file.id}`}
                    >
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)} {file.createdAt && `\u2022 ${format(new Date(file.createdAt), "dd/MM/yyyy")}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteFileMutation.mutate(file.id)}
                        data-testid={`btn-delete-budget-file-${file.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
