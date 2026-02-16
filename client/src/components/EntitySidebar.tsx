import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUpload } from "@/lib/queryClient";
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
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import { EmailViewDialog } from "@/components/EmailViewDialog";
import {
  getFileIcon,
  formatFileSize,
  getInitials,
  type EntitySidebarRoutes,
  type SidebarUpdate,
  type SidebarFile,
} from "@/lib/sidebar-utils";

export type EntityTab = "updates" | "files" | "activity" | string;

interface ExtraTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface EntitySidebarProps {
  entityId: string | null;
  entityName: string;
  routes: EntitySidebarRoutes;
  invalidationKeys?: string[][];
  onClose: () => void;
  initialTab?: EntityTab;
  testIdPrefix?: string;
  sheetWidth?: string;
  extraTabs?: ExtraTab[];
  renderExtraTab?: (tabId: string) => ReactNode;
  hideActivityTab?: boolean;
  emptyUpdatesMessage?: string;
  emptyFilesMessage?: string;
}

export function EntitySidebar({
  entityId,
  entityName,
  routes,
  invalidationKeys = [],
  onClose,
  initialTab = "updates",
  testIdPrefix = "entity",
  sheetWidth = "w-[400px] sm:w-[500px]",
  extraTabs = [],
  renderExtraTab,
  hideActivityTab = false,
  emptyUpdatesMessage = "Write a note, drop an email, or share files to get things moving",
  emptyFilesMessage = "Upload files or paste screenshots to attach them",
}: EntitySidebarProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<EntityTab>(initialTab);
  const [newUpdate, setNewUpdate] = useState("");
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialTab && entityId) {
      setActiveTab(initialTab);
    }
  }, [initialTab, entityId]);

  const invalidateAll = useCallback(() => {
    for (const key of invalidationKeys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, [invalidationKeys]);

  const { data: updates = [], isLoading: updatesLoading } = useQuery<SidebarUpdate[]>({
    queryKey: [routes.UPDATES(entityId || "")],
    enabled: !!entityId,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<SidebarFile[]>({
    queryKey: [routes.FILES(entityId || "")],
    enabled: !!entityId,
  });

  const createUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", routes.UPDATES(entityId || ""), { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [routes.UPDATES(entityId || "")] });
      invalidateAll();
      setNewUpdate("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", routes.UPDATE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [routes.UPDATES(entityId || "")] });
      invalidateAll();
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
      const res = await apiUpload(routes.FILES(entityId || ""), formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [routes.FILES(entityId || "")] });
      invalidateAll();
      toast({ title: "File uploaded" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", routes.FILE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [routes.FILES(entityId || "")] });
      invalidateAll();
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleMultiFileUpload = useCallback((filesToUpload: File[]) => {
    for (const file of filesToUpload) {
      uploadFileMutation.mutate({ file });
    }
  }, [uploadFileMutation]);

  const emailDropMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload(routes.EMAIL_DROP(entityId || ""), formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [routes.UPDATES(entityId || "")] });
      invalidateAll();
      toast({ title: "Email added to updates" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to process email" });
    },
  });

  const [emailDragging, setEmailDragging] = useState(false);
  const emailDragCounter = useRef(0);
  const [selectedEmail, setSelectedEmail] = useState<SidebarUpdate | null>(null);

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
            value: newFileName,
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
      const content = newUpdate.trim() || "(attachment)";
      const update = await createUpdateMutation.mutateAsync(content);
      const updateId = update?.id;

      if (pastedImages.length > 0) {
        for (const file of pastedImages) {
          await uploadFileMutation.mutateAsync({ file, updateId });
        }
        queryClient.invalidateQueries({ queryKey: [routes.UPDATES(entityId || "")] });
      }

      setPastedImages([]);
    } catch (_error) {
    }
  };

  if (!entityId) return null;

  return (
    <Sheet open={!!entityId} onOpenChange={() => onClose()}>
      <SheetContent className={`${sheetWidth} p-0 flex flex-col`}>
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg truncate">{entityName}</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid={`btn-close-${testIdPrefix}-sidebar`}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant={activeTab === "updates" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("updates")}
              data-testid={`${testIdPrefix}-tab-updates`}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Updates
            </Button>
            <Button
              variant={activeTab === "files" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("files")}
              data-testid={`${testIdPrefix}-tab-files`}
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Files
            </Button>
            {!hideActivityTab && (
              <Button
                variant={activeTab === "activity" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("activity")}
                data-testid={`${testIdPrefix}-tab-activity`}
              >
                Activity Log
              </Button>
            )}
            {extraTabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                data-testid={`${testIdPrefix}-tab-${tab.id}`}
              >
                {tab.icon}
                {tab.label}
              </Button>
            ))}
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
                  data-testid={`${testIdPrefix}-input-update`}
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
                          data-testid={`${testIdPrefix}-btn-remove-pasted-${index}`}
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
                data-testid={`${testIdPrefix}-btn-post-update`}
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
                  <p className="text-sm">{emptyUpdatesMessage}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="border rounded-lg p-3 group" data-testid={`${testIdPrefix}-update-${update.id}`}>
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
                            <div
                              className="mt-2 border rounded-md overflow-hidden cursor-pointer hover-elevate"
                              onClick={() => setSelectedEmail(update)}
                              data-testid={`${testIdPrefix}-btn-open-email-${update.id}`}
                            >
                              <div className="p-3 bg-muted/30 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                  <span className="text-sm font-medium truncate flex-1">
                                    {update.emailSubject || "(No Subject)"}
                                  </span>
                                </div>
                                {update.emailFrom && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
                                    <span className="font-medium">From:</span>
                                    <span className="truncate">{update.emailFrom}</span>
                                  </div>
                                )}
                                {update.emailDate && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
                                    <span className="font-medium">Date:</span>
                                    <span>{(() => { try { return format(new Date(update.emailDate), "dd/MM/yyyy HH:mm"); } catch { return update.emailDate; } })()}</span>
                                  </div>
                                )}
                              </div>
                              {update.content && (
                                <div className="px-3 py-2 border-t">
                                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{update.content}</p>
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
                                      data-testid={`${testIdPrefix}-update-image-${file.id}`}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={file.id}
                                    href={file.fileUrl}
                                    download={file.fileName}
                                    className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate"
                                    data-testid={`${testIdPrefix}-update-file-${file.id}`}
                                  >
                                    {getFileIcon(file.mimeType, file.fileName)}
                                    <span className="truncate">{file.fileName}</span>
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
                          data-testid={`${testIdPrefix}-btn-delete-update-${update.id}`}
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
                testId={`dropzone-${testIdPrefix}-files`}
              />

              {filesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No files yet</p>
                  <p className="text-sm">{emptyFilesMessage}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border rounded-lg group hover-elevate"
                      data-testid={`${testIdPrefix}-file-${file.id}`}
                    >
                      {getFileIcon(file.mimeType, file.fileName)}
                      <div className="flex-1 min-w-0">
                        <a
                          href={file.fileUrl}
                          download={file.fileName}
                          className="text-sm font-medium hover:underline truncate block"
                          data-testid={`${testIdPrefix}-file-download-${file.id}`}
                        >
                          {file.fileName}
                        </a>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {file.fileSize ? <span>{formatFileSize(file.fileSize)}</span> : null}
                          {file.uploadedBy && (
                            <span>by {file.uploadedBy.name || file.uploadedBy.email}</span>
                          )}
                          <span>{format(new Date(file.createdAt), "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                      {file.mimeType?.startsWith("image/") && (
                        <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={file.fileUrl}
                            alt={file.fileName}
                            className="h-10 w-10 rounded border object-cover"
                          />
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteFileMutation.mutate(file.id)}
                        data-testid={`${testIdPrefix}-btn-delete-file-${file.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && !hideActivityTab && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Activity log</p>
              <p className="text-sm">
                Combined view of all updates and file uploads, ordered by date.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  ...updates.map(u => ({ type: "update" as const, date: u.createdAt, data: u })),
                  ...files.filter(f => !f.updateId).map(f => ({ type: "file" as const, date: f.createdAt, data: f })),
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-left">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                      <div className="text-sm">
                        {item.type === "update" ? (
                          <>
                            <span className="font-medium">{(item.data as SidebarUpdate).user?.name || "Someone"}</span>
                            {(item.data as SidebarUpdate).contentType === "email" ? (
                              <span className="text-muted-foreground"> dropped an email: {(item.data as SidebarUpdate).emailSubject}</span>
                            ) : (
                              <span className="text-muted-foreground"> posted an update</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{(item.data as SidebarFile).uploadedBy?.name || "Someone"}</span>
                            <span className="text-muted-foreground"> uploaded {(item.data as SidebarFile).fileName}</span>
                          </>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(item.date), "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                  ))}
                {updates.length === 0 && files.length === 0 && (
                  <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                )}
              </div>
            </div>
          )}

          {extraTabs.some(t => t.id === activeTab) && renderExtraTab?.(activeTab)}
        </div>
      </SheetContent>

      <EmailViewDialog
        email={selectedEmail}
        open={!!selectedEmail}
        onOpenChange={(open) => { if (!open) setSelectedEmail(null); }}
      />
    </Sheet>
  );
}
