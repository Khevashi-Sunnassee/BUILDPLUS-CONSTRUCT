import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { MultiFileDropZone } from "@/components/MultiFileDropZone";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  Plus,
  Lock,
  Unlock,
  ClipboardList,
} from "lucide-react";

interface BudgetLineInfo {
  id: string;
  costCode: { code: string; name: string };
  childCostCode: { code: string; name: string } | null;
  estimateLocked: boolean;
  estimatedBudget: string;
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

interface DetailItem {
  id: string;
  budgetLineId: string;
  item: string;
  quantity: string;
  unit: string;
  price: string;
  lineTotal: string;
  notes: string | null;
  sortOrder: number;
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

const UNIT_OPTIONS = ["EA", "SQM", "M3", "LM", "M2", "M", "HR", "DAY", "TONNE", "KG", "LOT"];

function formatCurrency(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 });
}

export function BudgetLineSidebar({
  line,
  jobId,
  onClose,
  onBudgetUpdated,
  initialTab,
}: {
  line: BudgetLineInfo | null;
  jobId: string;
  onClose: () => void;
  onBudgetUpdated?: () => void;
  initialTab?: "updates" | "files" | "items";
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"updates" | "files" | "items">(initialTab || "updates");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, line?.id]);

  const [newUpdate, setNewUpdate] = useState("");
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: updates = [], isLoading: updatesLoading } = useQuery<BudgetLineUpdate[]>({
    queryKey: [`/api/budget-lines/${line?.id}/updates`],
    enabled: !!line,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<BudgetLineFileItem[]>({
    queryKey: [`/api/budget-lines/${line?.id}/files`],
    enabled: !!line,
  });

  const { data: detailItems = [], isLoading: detailItemsLoading } = useQuery<DetailItem[]>({
    queryKey: [`/api/budget-lines/${line?.id}/detail-items`],
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

  const createDetailItemMutation = useMutation({
    mutationFn: async (data: { item: string; quantity?: string; unit?: string; price?: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/budget-lines/${line?.id}/detail-items`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/detail-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      onBudgetUpdated?.();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const updateDetailItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; item?: string; quantity?: string; unit?: string; price?: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/budget-line-detail-items/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/detail-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      onBudgetUpdated?.();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteDetailItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/budget-line-detail-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/detail-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      onBudgetUpdated?.();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      const res = await apiRequest("PATCH", `/api/budget-lines/${line?.id}/toggle-lock`, { locked });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      onBudgetUpdated?.();
      toast({ title: "Budget lock updated" });
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
    } catch (error) {
      console.error("Failed to process budget line:", error);
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

  if (!line) return null;

  const lineLabel = line.childCostCode
    ? `${line.childCostCode.code} - ${line.childCostCode.name}`
    : `${line.costCode.code} - ${line.costCode.name}`;

  const detailItemsTotal = detailItems.reduce((sum, item) => sum + parseFloat(item.lineTotal || "0"), 0);

  return (
    <Sheet open={!!line} onOpenChange={() => onClose()}>
      <SheetContent className="w-[600px] sm:w-[750px] p-0 flex flex-col !sm:max-w-[750px]" style={{ maxWidth: "750px" }}>
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
            <Button
              variant={activeTab === "items" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("items")}
              data-testid="tab-budget-items"
            >
              <ClipboardList className="h-4 w-4 mr-1" />
              Items
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
              <MultiFileDropZone
                onFiles={handleMultiFileUpload}
                disabled={uploadFileMutation.isPending}
                compact
                label="Drop files here or click to browse"
                hint="Drag multiple files at once, including from Outlook"
                uploadingLabel="Uploading..."
                testId="dropzone-budget-files"
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

          {activeTab === "items" && (
            <DetailItemsTab
              lineId={line.id}
              jobId={jobId}
              detailItems={detailItems}
              detailItemsLoading={detailItemsLoading}
              detailItemsTotal={detailItemsTotal}
              estimateLocked={line.estimateLocked}
              estimatedBudget={line.estimatedBudget}
              onCreateItem={(data) => createDetailItemMutation.mutateAsync(data)}
              onUpdateItem={(data) => updateDetailItemMutation.mutateAsync(data)}
              onDeleteItem={(id) => deleteDetailItemMutation.mutateAsync(id)}
              onToggleLock={(locked) => toggleLockMutation.mutate(locked)}
              isCreating={createDetailItemMutation.isPending}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailItemsTab({
  lineId,
  jobId,
  detailItems,
  detailItemsLoading,
  detailItemsTotal,
  estimateLocked,
  estimatedBudget,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onToggleLock,
  isCreating,
}: {
  lineId: string;
  jobId: string;
  detailItems: DetailItem[];
  detailItemsLoading: boolean;
  detailItemsTotal: number;
  estimateLocked: boolean;
  estimatedBudget: string;
  onCreateItem: (data: { item: string; quantity?: string; unit?: string; price?: string; notes?: string }) => Promise<any>;
  onUpdateItem: (data: { id: string; item?: string; quantity?: string; unit?: string; price?: string; notes?: string }) => Promise<any>;
  onDeleteItem: (id: string) => Promise<any>;
  onToggleLock: (locked: boolean) => void;
  isCreating: boolean;
}) {
  const [newItem, setNewItem] = useState({ item: "", quantity: "1", unit: "EA", price: "0", notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleAddItem = async () => {
    if (!newItem.item.trim()) return;
    await onCreateItem({
      item: newItem.item.trim(),
      quantity: newItem.quantity || "1",
      unit: newItem.unit || "EA",
      price: newItem.price || "0",
      notes: newItem.notes || undefined,
    });
    setNewItem({ item: "", quantity: "1", unit: "EA", price: "0", notes: "" });
  };

  const startEdit = (item: DetailItem) => {
    setEditingId(item.id);
    setEditValues({
      item: item.item,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      notes: item.notes || "",
    });
  };

  const saveEdit = async (id: string) => {
    await onUpdateItem({
      id,
      item: editValues.item,
      quantity: editValues.quantity,
      unit: editValues.unit,
      price: editValues.price,
      notes: editValues.notes,
    });
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit(id);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const newLineTotal = (parseFloat(newItem.quantity || "0") * parseFloat(newItem.price || "0"));
  const editLineTotal = editingId ? (parseFloat(editValues.quantity || "0") * parseFloat(editValues.price || "0")) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Line items that make up the estimated budget
        </div>
        <Button
          variant={estimateLocked ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleLock(!estimateLocked)}
          data-testid="btn-toggle-budget-lock"
        >
          {estimateLocked ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
          {estimateLocked ? "Locked" : "Unlocked"}
        </Button>
      </div>

      {estimateLocked && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estimated budget is locked to items total</span>
            <span className="font-mono font-medium">{formatCurrency(detailItemsTotal)}</span>
          </div>
          {parseFloat(estimatedBudget || "0") !== detailItemsTotal && (
            <div className="text-xs text-muted-foreground mt-1">
              Syncing budget to {formatCurrency(detailItemsTotal)}...
            </div>
          )}
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[30%]">Item</TableHead>
              <TableHead className="text-xs text-right w-[12%]">Qty</TableHead>
              <TableHead className="text-xs w-[12%]">Unit</TableHead>
              <TableHead className="text-xs text-right w-[15%]">Price</TableHead>
              <TableHead className="text-xs text-right w-[15%]">Total</TableHead>
              <TableHead className="text-xs w-[16%]">Notes</TableHead>
              <TableHead className="text-xs w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detailItemsLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : detailItems.length === 0 && !isCreating ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  No line items yet. Add items below to break down this budget.
                </TableCell>
              </TableRow>
            ) : (
              detailItems.map((item) => (
                <TableRow key={item.id} className="group" data-testid={`detail-item-row-${item.id}`}>
                  {editingId === item.id ? (
                    <>
                      <TableCell className="p-1">
                        <Input
                          value={editValues.item}
                          onChange={(e) => setEditValues({ ...editValues, item: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="h-8 text-xs"
                          autoFocus
                          data-testid={`input-edit-item-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          value={editValues.quantity}
                          onChange={(e) => setEditValues({ ...editValues, quantity: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="h-8 text-xs text-right"
                          data-testid={`input-edit-qty-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select value={editValues.unit} onValueChange={(v) => setEditValues({ ...editValues, unit: v })}>
                          <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-unit-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={editValues.price}
                          onChange={(e) => setEditValues({ ...editValues, price: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="h-8 text-xs text-right"
                          data-testid={`input-edit-price-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <span className="text-xs font-mono">{formatCurrency(editLineTotal)}</span>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={editValues.notes}
                          onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="h-8 text-xs"
                          placeholder="Notes"
                          data-testid={`input-edit-notes-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveEdit(item.id)} data-testid={`btn-save-item-${item.id}`}>
                            <Send className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onMouseDown={(e) => e.preventDefault()} onClick={cancelEdit} data-testid={`btn-cancel-item-${item.id}`}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell
                        className="text-xs cursor-pointer"
                        onClick={() => startEdit(item)}
                        data-testid={`text-item-desc-${item.id}`}
                      >
                        {item.item}
                      </TableCell>
                      <TableCell
                        className="text-xs text-right font-mono cursor-pointer"
                        onClick={() => startEdit(item)}
                      >
                        {parseFloat(item.quantity).toLocaleString()}
                      </TableCell>
                      <TableCell
                        className="text-xs cursor-pointer"
                        onClick={() => startEdit(item)}
                      >
                        {item.unit}
                      </TableCell>
                      <TableCell
                        className="text-xs text-right font-mono cursor-pointer"
                        onClick={() => startEdit(item)}
                      >
                        {formatCurrency(item.price)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {formatCurrency(item.lineTotal)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]" title={item.notes || ""}>
                        {item.notes || "-"}
                      </TableCell>
                      <TableCell className="p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 invisible group-hover:visible"
                          onClick={() => onDeleteItem(item.id)}
                          data-testid={`btn-delete-item-${item.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}

            <TableRow className="bg-muted/30" data-testid="row-new-detail-item">
              <TableCell className="p-1">
                <Input
                  value={newItem.item}
                  onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                  placeholder="Add item..."
                  className="h-8 text-xs"
                  data-testid="input-new-item"
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                  className="h-8 text-xs text-right"
                  data-testid="input-new-qty"
                />
              </TableCell>
              <TableCell className="p-1">
                <Select value={newItem.unit} onValueChange={(v) => setNewItem({ ...newItem, unit: v })}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-new-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                  className="h-8 text-xs text-right"
                  data-testid="input-new-price"
                />
              </TableCell>
              <TableCell className="p-1 text-right">
                <span className="text-xs font-mono text-muted-foreground">{formatCurrency(newLineTotal)}</span>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                  placeholder="Notes"
                  className="h-8 text-xs"
                  data-testid="input-new-notes"
                />
              </TableCell>
              <TableCell className="p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleAddItem}
                  disabled={!newItem.item.trim() || isCreating}
                  data-testid="btn-add-detail-item"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm font-medium">Total</span>
        <span className="text-sm font-mono font-bold" data-testid="text-detail-items-total">
          {formatCurrency(detailItemsTotal)}
        </span>
      </div>
    </div>
  );
}
