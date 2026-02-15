import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { TASKS_ROUTES } from "@shared/api-routes";
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
  FileText,
  Image,
  File,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Task, TaskUpdate, TaskFile } from "./types";
import { getInitials } from "./types";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";

export function TaskSidebar({
  task,
  onClose,
  initialTab,
}: {
  task: Task | null;
  onClose: () => void;
  initialTab?: "updates" | "files" | "activity";
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"updates" | "files" | "activity">(initialTab || "updates");
  const [newUpdate, setNewUpdate] = useState("");
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialTab && task) {
      setActiveTab(initialTab);
    }
  }, [initialTab, task]);

  const { data: updates = [], isLoading: updatesLoading } = useQuery<TaskUpdate[]>({
    queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")],
    enabled: !!task,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<TaskFile[]>({
    queryKey: [TASKS_ROUTES.FILES(task?.id || "")],
    enabled: !!task,
  });

  const createUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", TASKS_ROUTES.UPDATES(task?.id || ""), { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      setNewUpdate("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", TASKS_ROUTES.UPDATE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
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
      const res = await apiUpload(TASKS_ROUTES.FILES(task?.id || ""), formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.FILES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "File uploaded" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", TASKS_ROUTES.FILE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.FILES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleMultiFileUpload = useCallback((files: File[]) => {
    for (const file of files) {
      uploadFileMutation.mutate({ file });
    }
  }, [uploadFileMutation]);

  const emailDropMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload(TASKS_ROUTES.EMAIL_DROP(task?.id || ""), formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")] });
      queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.GROUPS] });
      toast({ title: "Email added to updates" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to process email" });
    },
  });

  const [emailDragging, setEmailDragging] = useState(false);
  const emailDragCounter = useRef(0);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  const toggleEmailExpand = (id: string) => {
    setExpandedEmails(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdatesDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    emailDragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setEmailDragging(true);
    }
  }, []);

  const handleUpdatesDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    emailDragCounter.current--;
    if (emailDragCounter.current === 0) {
      setEmailDragging(false);
    }
  }, []);

  const handleUpdatesDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleUpdatesDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEmailDragging(false);
    emailDragCounter.current = 0;

    const droppedFiles: File[] = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) droppedFiles.push(file);
        }
      }
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        droppedFiles.push(e.dataTransfer.files[i]);
      }
    }

    const emailFiles = droppedFiles.filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith(".eml") || name.endsWith(".msg");
    });
    const otherFiles = droppedFiles.filter(f => {
      const name = f.name.toLowerCase();
      return !name.endsWith(".eml") && !name.endsWith(".msg");
    });

    for (const file of emailFiles) {
      emailDropMutation.mutate(file);
    }
    for (const file of otherFiles) {
      uploadFileMutation.mutate({ file });
    }
  }, [emailDropMutation, uploadFileMutation]);

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
          Object.defineProperty(file, 'name', {
            writable: true,
            value: newFileName
          });
          imageFiles.push(file);
        }
      }
    }
    
    if (imageFiles.length > 0) {
      e.preventDefault();
      setPastedImages(prev => [...prev, ...imageFiles]);
      toast({ title: `${imageFiles.length} image(s) pasted`, description: "Click Post Update to upload" });
    }
  }, [toast]);

  const removePastedImage = (index: number) => {
    setPastedImages(prev => prev.filter((_, i) => i !== index));
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
        queryClient.invalidateQueries({ queryKey: [TASKS_ROUTES.UPDATES(task?.id || "")] });
      }
      
      setPastedImages([]);
    } catch (error) {
    }
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

  if (!task) return null;

  return (
    <Sheet open={!!task} onOpenChange={() => onClose()}>
      <SheetContent className="w-[400px] sm:w-[500px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">{task.title}</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="btn-close-sidebar">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant={activeTab === "updates" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("updates")}
              data-testid="tab-updates"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Updates
            </Button>
            <Button
              variant={activeTab === "files" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("files")}
              data-testid="tab-files"
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Files
            </Button>
            <Button
              variant={activeTab === "activity" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("activity")}
              data-testid="tab-activity"
            >
              Activity Log
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "updates" && (
            <div
              className="space-y-4"
              onDragEnter={handleUpdatesDragEnter}
              onDragLeave={handleUpdatesDragLeave}
              onDragOver={handleUpdatesDragOver}
              onDrop={handleUpdatesDrop}
            >
              {emailDragging && (
                <div className="border-2 border-dashed border-primary rounded-md p-4 text-center bg-primary/5 transition-colors">
                  <Mail className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium text-primary">Drop emails or files here</p>
                  <p className="text-xs text-muted-foreground">.eml and .msg files will be parsed as emails</p>
                </div>
              )}
              {emailDropMutation.isPending && (
                <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                  <Mail className="h-4 w-4 animate-pulse text-primary" />
                  <span className="text-sm text-muted-foreground">Processing email...</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Textarea
                  ref={textareaRef}
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Write a note, paste screenshots, or drag emails from Outlook"
                  className="min-h-[80px] resize-none"
                  data-testid="input-new-update"
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
                          data-testid={`btn-remove-pasted-image-${index}`}
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
                data-testid="btn-post-update"
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
                  <p className="text-sm">Write a note, drop an email, or share files to get things moving</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="border rounded-lg p-3 group" data-testid={`update-${update.id}`}>
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(update.user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{update.user.name || update.user.email}</span>
                            {update.contentType === "email" && (
                              <Badge variant="secondary" className="text-xs">
                                <Mail className="h-3 w-3 mr-1" />
                                Email
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(update.createdAt), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>

                          {update.contentType === "email" ? (
                            <div className="mt-2 border rounded-md bg-muted/20">
                              <div
                                className="flex items-center gap-2 p-2 cursor-pointer"
                                onClick={() => toggleEmailExpand(update.id)}
                                data-testid={`btn-toggle-email-${update.id}`}
                              >
                                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm font-medium truncate flex-1">
                                  {update.emailSubject || "(No Subject)"}
                                </span>
                                {expandedEmails.has(update.id) ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>
                              {expandedEmails.has(update.id) && (
                                <div className="border-t p-2 space-y-1">
                                  {update.emailFrom && (
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">From:</span> {update.emailFrom}
                                    </p>
                                  )}
                                  {update.emailTo && (
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">To:</span> {update.emailTo}
                                    </p>
                                  )}
                                  {update.emailDate && (
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">Date:</span>{" "}
                                      {(() => {
                                        try {
                                          return format(new Date(update.emailDate), "dd/MM/yyyy HH:mm");
                                        } catch {
                                          return update.emailDate;
                                        }
                                      })()}
                                    </p>
                                  )}
                                  <div className="mt-2 pt-2 border-t">
                                    <p className="text-sm whitespace-pre-wrap">{update.content}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            update.content && (
                              <p className="text-sm mt-1 whitespace-pre-wrap">{update.content}</p>
                            )
                          )}

                          {update.files && update.files.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {update.files.map((file) => (
                                file.mimeType?.startsWith("image/") ? (
                                  <a
                                    key={file.id}
                                    href={file.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={file.fileUrl}
                                      alt={file.fileName}
                                      className="max-w-full max-h-48 rounded border object-contain cursor-pointer hover:opacity-90"
                                      data-testid={`update-image-${file.id}`}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={file.id}
                                    href={file.fileUrl}
                                    download={file.fileName}
                                    className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate"
                                    data-testid={`update-file-${file.id}`}
                                  >
                                    <Paperclip className="h-4 w-4" />
                                    {file.fileName}
                                  </a>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteUpdateMutation.mutate(update.id)}
                          data-testid={`btn-delete-update-${update.id}`}
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
              <MultiFileDropZone
                onFiles={handleMultiFileUpload}
                disabled={uploadFileMutation.isPending}
                compact
                label="Drop files here or click to browse"
                hint="Drag multiple files at once, including from Outlook"
                uploadingLabel="Uploading..."
                testId="dropzone-task-files"
              />

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
                      data-testid={`file-${file.id}`}
                    >
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)} • {format(new Date(file.createdAt), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteFileMutation.mutate(file.id)}
                        data-testid={`btn-delete-file-${file.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <p>Activity log coming soon</p>
                <p className="text-sm">Track all changes made to this task</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
