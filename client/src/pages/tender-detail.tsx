import { useState, useRef, useCallback, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { TENDER_MEMBER_ROUTES } from "@shared/api-routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, FileText, Eye, Pencil, Plus, Loader2, ChevronDown, ChevronRight,
  DollarSign, Users, Mail, Package, Layers, Link2, Unlink, AlertTriangle, Download, Search, X,
  Sparkles, UserPlus, Phone, Building2, MapPin, Send, Trash2, StickyNote, Paperclip, Upload, MessageSquare,
  Image, File,
} from "lucide-react";

interface TenderDetail {
  id: string;
  tenderNumber: string;
  title: string;
  description: string | null;
  status: string;
  openDate: string | null;
  closedDate: string | null;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  jobId: string;
  job: { id: string; name: string; jobNumber: string } | null;
  createdBy: { id: string; name: string } | null;
  members?: Array<{ id: string; supplierId: string; status: string; supplier: { id: string; name: string; email: string | null } }>;
}

interface TenderMemberWithDetails {
  id: string;
  tenderId: string;
  supplierId: string;
  status: string;
  invitedAt: string | null;
  sentAt: string | null;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    keyContact: string | null;
    defaultCostCodeId: string | null;
  } | null;
  costCode: { id: string; code: string; name: string } | null;
}

interface CostCodeOption {
  id: string;
  code: string;
  name: string;
}

interface FoundSupplier {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  specialty: string;
  location: string;
  estimatedDistanceKm?: number;
  tradeCategory?: string;
  costCodeId?: string;
}

interface SubmissionWithDetails {
  id: string;
  tenderId: string;
  supplierId: string;
  totalPrice: string | null;
  subtotal: string | null;
  taxAmount: string | null;
  status: string;
  coverNote: string | null;
  notes: string | null;
  submittedAt: string | null;
  createdAt: string;
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
}

interface TenderPackageDoc {
  id: string;
  bundleId: string | null;
  documentId: string | null;
  bundle: { id: string; bundleName: string; qrCodeId: string } | null;
  document: { id: string; title: string; documentNumber: string | null; version: string | null; revision: string | null; isLatestVersion: boolean | null; status: string | null; isStale: boolean; fileName: string | null } | null;
}

interface LinkedScope {
  id: string;
  scopeId: string;
  tenderId: string;
  sortOrder: number;
  scope: {
    id: string;
    name: string;
    status: string;
    trade: { id: string; name: string; costCodeId?: string | null } | null;
  };
}

interface ScopeDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  trade: { id: string; name: string } | null;
  items: Array<{
    id: string;
    category: string | null;
    description: string;
    details: string | null;
    status: string;
    sortOrder: number;
  }>;
}

interface LineItemData {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
  costCode: { id: string; code: string; name: string } | null;
}

interface TenderNoteData {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ScopeOption {
  id: string;
  name: string;
  status: string;
  trade: { id: string; name: string } | null;
}

function formatCurrency(value: string | null | undefined): string {
  const num = parseFloat(value || "0");
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TenderStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Draft</Badge>;
    case "OPEN":
      return <Badge variant="default" data-testid={`badge-status-${status}`}>Open</Badge>;
    case "UNDER_REVIEW":
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>Under Review</Badge>;
    case "APPROVED":
      return <Badge variant="default" className="bg-green-600 text-white" data-testid={`badge-status-${status}`}>Approved</Badge>;
    case "CLOSED":
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Closed</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}>Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function SubmissionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUBMITTED":
      return <Badge variant="default" data-testid={`badge-sub-status-${status}`}>Submitted</Badge>;
    case "REVISED":
      return <Badge variant="outline" data-testid={`badge-sub-status-${status}`}>Revised</Badge>;
    case "APPROVED":
      return <Badge variant="default" className="bg-green-600 text-white" data-testid={`badge-sub-status-${status}`}>Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive" data-testid={`badge-sub-status-${status}`}>Rejected</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function SubmissionRow({ submission, tenderId }: { submission: SubmissionWithDetails; tenderId: string }) {
  const [expanded, setExpanded] = useState(false);

  const { data: lineItems = [], isLoading: loadingLineItems } = useQuery<LineItemData[]>({
    queryKey: ["/api/tenders", tenderId, "submissions", submission.id, "line-items"],
    enabled: expanded,
  });

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid={`row-submission-${submission.id}`}
      >
        <TableCell className="w-8">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell data-testid={`text-submission-supplier-${submission.id}`}>
          {submission.supplier?.name || "Unknown"}
        </TableCell>
        <TableCell>
          <SubmissionStatusBadge status={submission.status} />
        </TableCell>
        <TableCell className="font-mono" data-testid={`text-submission-total-${submission.id}`}>
          {formatCurrency(submission.totalPrice)}
        </TableCell>
        <TableCell className="text-muted-foreground" data-testid={`text-submission-date-${submission.id}`}>
          {submission.submittedAt ? format(new Date(submission.submittedAt), "dd/MM/yyyy") : submission.createdAt ? format(new Date(submission.createdAt), "dd/MM/yyyy") : "-"}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow data-testid={`row-submission-detail-${submission.id}`}>
          <TableCell colSpan={5} className="bg-muted/30 p-4">
            <div className="space-y-4">
              {submission.coverNote && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Cover Note</p>
                  <p className="text-sm" data-testid={`text-submission-covernote-${submission.id}`}>{submission.coverNote}</p>
                </div>
              )}
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-sm font-mono" data-testid={`text-submission-subtotal-${submission.id}`}>{formatCurrency(submission.subtotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tax</p>
                  <p className="text-sm font-mono" data-testid={`text-submission-tax-${submission.id}`}>{formatCurrency(submission.taxAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-mono font-medium" data-testid={`text-submission-total-expanded-${submission.id}`}>{formatCurrency(submission.totalPrice)}</p>
                </div>
              </div>
              {submission.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm" data-testid={`text-submission-notes-${submission.id}`}>{submission.notes}</p>
                </div>
              )}
              {loadingLineItems ? (
                <Skeleton className="h-20 w-full" />
              ) : lineItems.length > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2">Line Items</p>
                  <div className="border rounded-md overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-20">Qty</TableHead>
                          <TableHead className="w-16">Unit</TableHead>
                          <TableHead className="w-28 text-right">Unit Price</TableHead>
                          <TableHead className="w-28 text-right">Line Total</TableHead>
                          <TableHead>Cost Code</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item) => (
                          <TableRow key={item.id} data-testid={`row-lineitem-${item.id}`}>
                            <TableCell className="text-sm">{item.description}</TableCell>
                            <TableCell className="text-sm font-mono">{item.quantity}</TableCell>
                            <TableCell className="text-sm">{item.unit}</TableCell>
                            <TableCell className="text-sm font-mono text-right">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-sm font-mono text-right font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.costCode ? `${item.costCode.code} - ${item.costCode.name}` : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No line items</p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ScopeRow({ linkedScope, tenderId }: { linkedScope: LinkedScope; tenderId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const { data: scopeDetail, isLoading: loadingScopeDetail } = useQuery<ScopeDetail>({
    queryKey: ["/api/scopes", linkedScope.scopeId],
    enabled: expanded,
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/tenders/${tenderId}/scopes/${linkedScope.scopeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tenderId, "scopes"] });
      toast({ title: "Scope unlinked successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="border rounded-md" data-testid={`scope-item-${linkedScope.scopeId}`}>
      <div
        className="flex items-center justify-between gap-4 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-scope-${linkedScope.scopeId}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" data-testid={`text-scope-name-${linkedScope.scopeId}`}>{linkedScope.scope.name}</p>
            {linkedScope.scope.trade && (
              <p className="text-xs text-muted-foreground">{linkedScope.scope.trade.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" data-testid={`badge-scope-status-${linkedScope.scopeId}`}>{linkedScope.scope.status}</Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              unlinkMutation.mutate();
            }}
            disabled={unlinkMutation.isPending}
            data-testid={`button-unlink-scope-${linkedScope.scopeId}`}
          >
            {unlinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t p-3">
          {loadingScopeDetail ? (
            <Skeleton className="h-20 w-full" />
          ) : scopeDetail?.items && scopeDetail.items.length > 0 ? (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopeDetail.items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-scope-item-${item.id}`}>
                      <TableCell className="text-sm text-muted-foreground">{item.category || "-"}</TableCell>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.details || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={item.status === "INCLUDED" ? "default" : item.status === "EXCLUDED" ? "destructive" : "secondary"}
                          data-testid={`badge-scope-item-status-${item.id}`}
                        >
                          {item.status === "INCLUDED" ? "Included" : item.status === "EXCLUDED" ? "Excluded" : "N/A"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No scope items</p>
          )}
        </div>
      )}
    </div>
  );
}

interface InvitationUpdate {
  id: string;
  tenderMemberId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
  files: InvitationFile[];
}

interface InvitationFile {
  id: string;
  tenderMemberId: string;
  updateId: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedById: string | null;
  createdAt: string;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

function InvitationSidebar({
  invitation,
  onClose,
  initialTab,
}: {
  invitation: any | null;
  onClose: () => void;
  initialTab?: "updates" | "files" | "activity";
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"updates" | "files" | "activity">(initialTab || "updates");
  const [newUpdate, setNewUpdate] = useState("");
  const [pastedImages, setPastedImages] = useState<globalThis.File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialTab && invitation) setActiveTab(initialTab);
  }, [initialTab, invitation]);

  const memberId = invitation?.id || "";

  const { data: updates = [], isLoading: updatesLoading } = useQuery<InvitationUpdate[]>({
    queryKey: [TENDER_MEMBER_ROUTES.UPDATES(memberId)],
    enabled: !!invitation,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<InvitationFile[]>({
    queryKey: [TENDER_MEMBER_ROUTES.FILES(memberId)],
    enabled: !!invitation,
  });

  const createUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", TENDER_MEMBER_ROUTES.UPDATES(memberId), { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_MEMBER_ROUTES.UPDATES(memberId)] });
      setNewUpdate("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", TENDER_MEMBER_ROUTES.UPDATE_BY_ID(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_MEMBER_ROUTES.UPDATES(memberId)] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, updateId }: { file: globalThis.File; updateId?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (updateId) formData.append("updateId", updateId);
      const res = await apiUpload(TENDER_MEMBER_ROUTES.FILES(memberId), formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_MEMBER_ROUTES.FILES(memberId)] });
      queryClient.invalidateQueries({ queryKey: [TENDER_MEMBER_ROUTES.UPDATES(memberId)] });
      toast({ title: "File uploaded" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", TENDER_MEMBER_ROUTES.FILE_BY_ID(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TENDER_MEMBER_ROUTES.FILES(memberId)] });
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFileMutation.mutate({ file });
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const imageFiles: globalThis.File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const ts = Date.now();
          const ext = item.type.split("/")[1] || "png";
          const newName = `screenshot_${ts}.${ext}`;
          Object.defineProperty(file, 'name', { writable: true, value: newName });
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
        queryClient.invalidateQueries({ queryKey: [TENDER_MEMBER_ROUTES.UPDATES(memberId)] });
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

  if (!invitation) return null;

  const supplierName = invitation.supplier?.name || "Invitation";

  return (
    <Sheet open={!!invitation} onOpenChange={() => onClose()}>
      <SheetContent className="w-[400px] sm:w-[500px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-lg truncate">{supplierName}</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="btn-close-invitation-sidebar">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant={activeTab === "updates" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("updates")}
              data-testid="tab-invitation-updates"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Updates
            </Button>
            <Button
              variant={activeTab === "files" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("files")}
              data-testid="tab-invitation-files"
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Files
            </Button>
            <Button
              variant={activeTab === "activity" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("activity")}
              data-testid="tab-invitation-activity"
            >
              Activity Log
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
                  placeholder="Write an update and mention others with @ - paste screenshots here"
                  className="min-h-[80px] resize-none"
                  data-testid="input-invitation-update"
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
                data-testid="btn-post-invitation-update"
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
                  <p className="text-sm">Share progress, mention a teammate, or upload a file to get things moving</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="border rounded-lg p-3 group" data-testid={`invitation-update-${update.id}`}>
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(update.user?.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{update.user?.name || update.user?.email || "Unknown"}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(update.createdAt), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                          {update.content && (
                            <p className="text-sm mt-1 whitespace-pre-wrap">{update.content}</p>
                          )}
                          {update.files && update.files.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {update.files.map((file) => (
                                file.mimeType?.startsWith("image/") ? (
                                  <a key={file.id} href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                                    <img
                                      src={file.fileUrl}
                                      alt={file.fileName}
                                      className="max-w-full max-h-48 rounded border object-contain cursor-pointer hover:opacity-90"
                                      data-testid={`invitation-update-image-${file.id}`}
                                    />
                                  </a>
                                ) : (
                                  <a key={file.id} href={file.fileUrl} download={file.fileName} className="flex items-center gap-2 p-2 border rounded text-sm hover-elevate" data-testid={`invitation-update-file-${file.id}`}>
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
                          data-testid={`btn-delete-invitation-update-${update.id}`}
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
                data-testid="btn-upload-invitation-file"
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
                    <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg group hover-elevate" data-testid={`invitation-file-${file.id}`}>
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)} {file.createdAt && `\u00b7 ${format(new Date(file.createdAt), "dd/MM/yyyy")}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteFileMutation.mutate(file.id)}
                        data-testid={`btn-delete-invitation-file-${file.id}`}
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
                <p className="text-sm">Track all changes made to this invitation</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function TenderDetailPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/tenders/:id");
  const tenderId = params?.id || "";
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("invitations");
  const [submissionFormOpen, setSubmissionFormOpen] = useState(false);
  const [linkScopeOpen, setLinkScopeOpen] = useState(false);

  const [subFormSupplierId, setSubFormSupplierId] = useState("");
  const [subFormCoverNote, setSubFormCoverNote] = useState("");
  const [subFormStatus, setSubFormStatus] = useState("SUBMITTED");
  const [subFormSubtotal, setSubFormSubtotal] = useState("");
  const [subFormTaxAmount, setSubFormTaxAmount] = useState("");
  const [subFormTotalPrice, setSubFormTotalPrice] = useState("");
  const [subFormNotes, setSubFormNotes] = useState("");

  const [linkScopeId, setLinkScopeId] = useState("");
  const [scopeSearch, setScopeSearch] = useState("");

  const [findSuppliersOpen, setFindSuppliersOpen] = useState(false);
  const [findSuppliersStep, setFindSuppliersStep] = useState<"select-codes" | "confirm-radius" | "searching" | "results">("select-codes");
  const [selectedCostCodeIds, setSelectedCostCodeIds] = useState<string[]>([]);
  const [tradeSearchQuery, setTradeSearchQuery] = useState("");
  const [foundSuppliers, setFoundSuppliers] = useState<FoundSupplier[]>([]);
  const [selectedFoundSuppliers, setSelectedFoundSuppliers] = useState<Set<number>>(new Set());
  const [searchContext, setSearchContext] = useState<{ costCodes: string; location: string; projectType: string; searchRadiusKm?: number; projectScale?: string; projectValue?: string } | null>(null);
  const [userSearchRadius, setUserSearchRadius] = useState<number>(40);
  const [radiusInfo, setRadiusInfo] = useState<{ searchRadiusKm: number; projectScale: string; location: string; projectType: string; projectValue: string } | null>(null);
  const [loadingRadius, setLoadingRadius] = useState(false);

  const [sendInviteOpen, setSendInviteOpen] = useState(false);
  const [sendInviteMember, setSendInviteMember] = useState<TenderMemberWithDetails | null>(null);
  const [inviteSubject, setInviteSubject] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  const [selectedInvitation, setSelectedInvitation] = useState<any | null>(null);
  const [sidebarInitialTab, setSidebarInitialTab] = useState<"updates" | "files" | "activity">("updates");

  const { data: tender, isLoading, error } = useQuery<TenderDetail>({
    queryKey: ["/api/tenders", tenderId],
    enabled: !!tenderId,
  });

  useDocumentTitle(tender ? `Tender ${tender.tenderNumber}` : "Tender Detail");

  const { data: submissions = [], isLoading: loadingSubmissions } = useQuery<SubmissionWithDetails[]>({
    queryKey: ["/api/tenders", tenderId, "submissions"],
    enabled: !!tenderId,
  });

  const { data: packages = [], isLoading: loadingPackages } = useQuery<TenderPackageDoc[]>({
    queryKey: ["/api/tenders", tenderId, "packages"],
    enabled: !!tenderId,
  });

  const { data: linkedScopes = [], isLoading: loadingScopes } = useQuery<LinkedScope[]>({
    queryKey: ["/api/tenders", tenderId, "scopes"],
    enabled: !!tenderId,
  });

  const { data: tenderMembers = [], isLoading: loadingMembers } = useQuery<TenderMemberWithDetails[]>({
    queryKey: ["/api/tenders", tenderId, "members"],
    enabled: !!tenderId,
  });

  const { data: tenderNotesData = [], isLoading: loadingNotes } = useQuery<TenderNoteData[]>({
    queryKey: ["/api/tenders", tenderId, "notes"],
    enabled: !!tenderId,
  });

  const { data: rawCostCodes = [] } = useQuery<Array<CostCodeOption & { children?: CostCodeOption[] }>>({
    queryKey: ["/api/cost-codes-with-children"],
    enabled: findSuppliersOpen,
  });

  const costCodesData: CostCodeOption[] = rawCostCodes.map(({ id, code, name }) => ({ id, code, name }));

  const { data: suppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ["/api/procurement/suppliers"],
  });

  const { data: availableScopes = [] } = useQuery<ScopeOption[]>({
    queryKey: ["/api/scopes", { status: "ACTIVE" }],
    enabled: linkScopeOpen,
  });

  const createSubmissionMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", `/api/tenders/${tenderId}/submissions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tenderId, "submissions"] });
      toast({ title: "Submission added successfully" });
      closeSubmissionForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const linkScopeMutation = useMutation({
    mutationFn: async (scopeId: string) => {
      return apiRequest("POST", `/api/tenders/${tenderId}/scopes`, { scopeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tenderId, "scopes"] });
      toast({ title: "Scope linked successfully" });
      setLinkScopeOpen(false);
      setLinkScopeId("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const findSuppliersMutation = useMutation({
    mutationFn: async ({ costCodeIds, searchRadiusKm }: { costCodeIds: string[]; searchRadiusKm: number }) => {
      const res = await apiRequest("POST", `/api/tenders/${tenderId}/find-suppliers`, { costCodeIds, searchRadiusKm });
      return res.json();
    },
    onSuccess: (data: { suppliers: FoundSupplier[]; costCodeMapping?: Array<{ id: string; label: string }>; context: { costCodes: string; location: string; projectType: string; searchRadiusKm?: number; projectScale?: string; projectValue?: string } }) => {
      setFoundSuppliers(data.suppliers);
      setSelectedFoundSuppliers(new Set(data.suppliers.map((_, i) => i)));
      setSearchContext(data.context);
      setFindSuppliersStep("results");
    },
    onError: (error: Error) => {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
      setFindSuppliersStep("confirm-radius");
    },
  });

  const addFoundSuppliersMutation = useMutation({
    mutationFn: async (selectedSuppliers: FoundSupplier[]) => {
      const res = await apiRequest("POST", `/api/tenders/${tenderId}/add-found-suppliers`, {
        suppliers: selectedSuppliers,
        defaultCostCodeId: selectedCostCodeIds.length === 1 ? selectedCostCodeIds[0] : null,
      });
      return res.json();
    },
    onSuccess: (data: { added: number; skipped: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tenderId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/suppliers"] });
      toast({
        title: `${data.added} supplier(s) added`,
        description: data.skipped > 0 ? `${data.skipped} skipped (already exist)` : undefined,
      });
      closeFindSuppliersDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add suppliers", description: error.message, variant: "destructive" });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async ({ memberId, subject, message }: { memberId: string; subject: string; message: string }) => {
      const res = await apiRequest("POST", `/api/tenders/${tenderId}/members/${memberId}/send-invite`, { subject, message });
      return res.json();
    },
    onSuccess: (data: { supplierName: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tenderId, "members"] });
      toast({ title: `Invitation sent to ${data.supplierName}` });
      setSendInviteOpen(false);
      setSendInviteMember(null);
      setInviteSubject("");
      setInviteMessage("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send invitation", description: error.message, variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/tenders/${tenderId}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tenderId, "notes"] });
      toast({ title: "Note added" });
      setNoteContent("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      return apiRequest("PATCH", `/api/tenders/${tenderId}/notes/${noteId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tenderId, "notes"] });
      toast({ title: "Note updated" });
      setEditingNoteId(null);
      setEditingNoteContent("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("DELETE", `/api/tenders/${tenderId}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tenderId, "notes"] });
      toast({ title: "Note deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function openFindSuppliersDialog() {
    setFindSuppliersOpen(true);
    setFindSuppliersStep("select-codes");
    setSelectedCostCodeIds([]);
    setFoundSuppliers([]);
    setSelectedFoundSuppliers(new Set());
    setSearchContext(null);
    setRadiusInfo(null);
    setUserSearchRadius(40);
  }

  function closeFindSuppliersDialog() {
    setFindSuppliersOpen(false);
    setFindSuppliersStep("select-codes");
    setSelectedCostCodeIds([]);
    setTradeSearchQuery("");
    setFoundSuppliers([]);
    setSelectedFoundSuppliers(new Set());
    setSearchContext(null);
    setRadiusInfo(null);
    setUserSearchRadius(40);
  }

  async function handleProceedToRadius() {
    if (selectedCostCodeIds.length === 0) {
      toast({ title: "Please select at least one trade category", variant: "destructive" });
      return;
    }
    setLoadingRadius(true);
    try {
      const res = await apiRequest("GET", `/api/tenders/${tenderId}/search-radius`);
      const info = await res.json();
      setRadiusInfo(info);
      setUserSearchRadius(info.searchRadiusKm);
      setFindSuppliersStep("confirm-radius");
    } catch {
      toast({ title: "Failed to calculate search area", variant: "destructive" });
    } finally {
      setLoadingRadius(false);
    }
  }

  function handleFindSuppliers() {
    setFindSuppliersStep("searching");
    findSuppliersMutation.mutate({ costCodeIds: selectedCostCodeIds, searchRadiusKm: userSearchRadius });
  }

  function handleAddSelectedSuppliers() {
    const selected = foundSuppliers.filter((_, i) => selectedFoundSuppliers.has(i));
    if (selected.length === 0) {
      toast({ title: "Please select at least one supplier to add", variant: "destructive" });
      return;
    }
    addFoundSuppliersMutation.mutate(selected);
  }

  function toggleFoundSupplier(index: number) {
    setSelectedFoundSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleCostCode(id: string) {
    setSelectedCostCodeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function closeSubmissionForm() {
    setSubmissionFormOpen(false);
    setSubFormSupplierId("");
    setSubFormCoverNote("");
    setSubFormStatus("SUBMITTED");
    setSubFormSubtotal("");
    setSubFormTaxAmount("");
    setSubFormTotalPrice("");
    setSubFormNotes("");
  }

  function handleSubmissionSubmit() {
    if (!subFormSupplierId) {
      toast({ title: "Supplier is required", variant: "destructive" });
      return;
    }
    createSubmissionMutation.mutate({
      supplierId: subFormSupplierId,
      coverNote: subFormCoverNote.trim() || undefined,
      status: subFormStatus,
      subtotal: subFormSubtotal || undefined,
      taxAmount: subFormTaxAmount || undefined,
      totalPrice: subFormTotalPrice || undefined,
      notes: subFormNotes.trim() || undefined,
    });
  }

  const documentsWithDoc = packages.filter((p) => p.document?.id);
  const hasStaleDocuments = documentsWithDoc.some((p) => p.document?.isStale);

  const filteredAvailableScopes = availableScopes.filter((s) => {
    const alreadyLinked = linkedScopes.some((ls) => ls.scopeId === s.id);
    if (alreadyLinked) return false;
    if (!scopeSearch.trim()) return true;
    const q = scopeSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.trade?.name || "").toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="tender-detail-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4" data-testid="tender-detail-not-found">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Tender Not Found</h2>
        <p className="text-muted-foreground">The tender you are looking for does not exist or you do not have access.</p>
        <Link href="/tenders">
          <Button variant="outline" data-testid="button-back-to-tenders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenders
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tender-detail-page">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/tenders">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono" data-testid="text-tender-number">{tender.tenderNumber}</h1>
            <TenderStatusBadge status={tender.status} />
          </div>
          <p className="text-sm text-muted-foreground truncate" data-testid="text-tender-title">{tender.title}</p>
          {tender.job && (
            <p className="text-xs text-muted-foreground" data-testid="text-tender-job">
              {tender.job.jobNumber} - {tender.job.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => setLocation(`/tenders`)}
            data-testid="button-edit-tender"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            data-testid="button-send-invitations"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Invitations
          </Button>
        </div>
      </div>

      <Card data-testid="card-tender-metadata">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Open Date</p>
              <p className="text-sm" data-testid="text-open-date">
                {tender.openDate ? format(new Date(tender.openDate), "dd/MM/yyyy") : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closed Date</p>
              <p className="text-sm" data-testid="text-closed-date">
                {tender.closedDate ? format(new Date(tender.closedDate), "dd/MM/yyyy") : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="text-sm" data-testid="text-created-by">
                {tender.createdBy?.name || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm" data-testid="text-created-at">
                {format(new Date(tender.createdAt), "dd/MM/yyyy")}
              </p>
            </div>
          </div>
          {(tender.description || tender.notes) && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tender.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm" data-testid="text-description">{tender.description}</p>
                  </div>
                )}
                {tender.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm" data-testid="text-notes">{tender.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
          {tender.members && tender.members.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Members ({tender.members.length})
                </p>
                <div className="flex gap-2 flex-wrap">
                  {tender.members.map((m) => (
                    <Badge key={m.id} variant="outline" data-testid={`badge-member-${m.id}`}>
                      {m.supplier.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-tender-detail">
        <TabsList>
          <TabsTrigger value="invitations" data-testid="tab-invitations">
            <UserPlus className="h-4 w-4 mr-1" />
            Invitations ({tenderMembers.length})
          </TabsTrigger>
          <TabsTrigger value="submissions" data-testid="tab-submissions">
            <DollarSign className="h-4 w-4 mr-1" />
            Submissions ({submissions.length})
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <Package className="h-4 w-4 mr-1" />
            Documents ({documentsWithDoc.length})
          </TabsTrigger>
          <TabsTrigger value="scopes" data-testid="tab-scopes">
            <Layers className="h-4 w-4 mr-1" />
            Scopes ({linkedScopes.length})
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <StickyNote className="h-4 w-4 mr-1" />
            Notes ({tenderNotesData.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invitations" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-lg font-semibold" data-testid="text-invitations-heading">Invitations</h3>
            <Button onClick={openFindSuppliersDialog} data-testid="button-find-suppliers">
              <Sparkles className="h-4 w-4 mr-2" />
              Find Suppliers (AI)
            </Button>
          </div>
          {loadingMembers ? (
            <Skeleton className="h-32 w-full" />
          ) : tenderMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-invitations">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No suppliers invited yet</p>
              <p className="text-sm mt-1">Use AI-powered search to find and invite suppliers to this tender.</p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Trade Category</TableHead>
                    <TableHead>Linked Scopes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenderMembers.map((member) => {
                    const matchedScopes = linkedScopes.filter(ls => {
                      if (!ls.scope?.trade || !member.costCode) return false;
                      if (ls.scope.trade.costCodeId && member.costCode.id) {
                        return ls.scope.trade.costCodeId === member.costCode.id;
                      }
                      if (!ls.scope.trade.name || !member.costCode.name) return false;
                      return ls.scope.trade.name.toLowerCase() === member.costCode.name.toLowerCase();
                    });
                    return (
                    <TableRow key={member.id} data-testid={`row-invitation-${member.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium" data-testid={`text-supplier-name-${member.id}`}>
                              {member.supplier?.name || "Unknown"}
                            </div>
                            {member.supplier?.email && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {member.supplier.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {member.supplier?.keyContact && (
                            <div className="text-sm">{member.supplier.keyContact}</div>
                          )}
                          {member.supplier?.phone && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {member.supplier.phone}
                            </div>
                          )}
                          {!member.supplier?.keyContact && !member.supplier?.phone && (
                            <span className="text-sm text-muted-foreground">--</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.costCode ? (
                          <Badge variant="outline" data-testid={`badge-cost-code-${member.id}`}>
                            {member.costCode.code} - {member.costCode.name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`cell-linked-scopes-${member.id}`}>
                        {matchedScopes.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {matchedScopes.map(ls => (
                              <Badge key={ls.id} variant="secondary" data-testid={`badge-scope-${ls.id}`}>
                                <FileText className="h-3 w-3 mr-1" />
                                {ls.scope.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.status === "SENT" ? "default" : member.status === "DECLINED" ? "destructive" : "secondary"}
                          data-testid={`badge-status-${member.id}`}
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedInvitation(member);
                              setSidebarInitialTab("updates");
                            }}
                            data-testid={`button-updates-${member.id}`}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSendInviteMember(member);
                              setInviteSubject(`Tender Invitation - ${tender?.tenderNumber}: ${tender?.title}`);
                              setInviteMessage(`You are invited to submit a tender for ${tender?.title}.\n\nPlease review the attached documents and submit your proposal by the due date.\n\nRegards`);
                              setSendInviteOpen(true);
                            }}
                            disabled={!member.supplier?.email}
                            data-testid={`button-send-invite-${member.id}`}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-lg font-semibold">Submissions</h3>
            <Button onClick={() => setSubmissionFormOpen(true)} data-testid="button-add-submission">
              <Plus className="h-4 w-4 mr-2" />
              Add Submission
            </Button>
          </div>
          {loadingSubmissions ? (
            <Skeleton className="h-32 w-full" />
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-submissions">
              No submissions yet. Add a supplier submission to get started.
            </div>
          ) : (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-32">Total Price</TableHead>
                    <TableHead className="w-28">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => (
                    <SubmissionRow key={sub.id} submission={sub} tenderId={tenderId} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold">Documents</h3>
          {hasStaleDocuments && (
            <div className="flex items-center gap-2 p-3 border rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300" data-testid="banner-stale-documents">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm">Some documents in this tender package are out of date. Please review and update.</p>
            </div>
          )}
          {loadingPackages ? (
            <Skeleton className="h-32 w-full" />
          ) : documentsWithDoc.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-documents">
              No documents attached to this tender.
            </div>
          ) : (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-32">Document #</TableHead>
                    <TableHead className="w-24">Version</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-28">Staleness</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentsWithDoc.map((pkg) => {
                    const doc = pkg.document!;
                    return (
                      <TableRow key={pkg.id} data-testid={`row-document-${pkg.id}`}>
                        <TableCell data-testid={`text-doc-title-${pkg.id}`}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            {doc.title || doc.fileName || "Untitled"}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground" data-testid={`text-doc-number-${pkg.id}`}>
                          {doc.documentNumber || "-"}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={`text-doc-version-${pkg.id}`}>
                          {doc.version ? `v${doc.version}` : ""}{doc.revision || ""}
                        </TableCell>
                        <TableCell>
                          {doc.status ? (
                            <Badge variant="outline" data-testid={`badge-doc-status-${pkg.id}`}>{doc.status}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {doc.isStale ? (
                            <Badge variant="destructive" data-testid={`badge-doc-stale-${pkg.id}`}>Out of date</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Current</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open(`/api/documents/${doc.id}/view`, "_blank")}
                              data-testid={`button-view-doc-${pkg.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
                              data-testid={`button-download-doc-${pkg.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scopes" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-lg font-semibold">Scopes</h3>
            <Button onClick={() => setLinkScopeOpen(true)} data-testid="button-link-scope">
              <Link2 className="h-4 w-4 mr-2" />
              Link Scope
            </Button>
          </div>
          {loadingScopes ? (
            <Skeleton className="h-32 w-full" />
          ) : linkedScopes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-scopes">
              No scopes linked to this tender. Link a scope to define the work requirements.
            </div>
          ) : (
            <div className="space-y-2">
              {linkedScopes.map((ls) => (
                <ScopeRow key={ls.id} linkedScope={ls} tenderId={tenderId} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold">Notes</h3>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add a note..."
                className="resize-none"
                data-testid="input-tender-note"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => { if (noteContent.trim()) createNoteMutation.mutate(noteContent.trim()); }}
                  disabled={createNoteMutation.isPending || !noteContent.trim()}
                  data-testid="button-add-note"
                >
                  {createNoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </div>
            </CardContent>
          </Card>
          {loadingNotes ? (
            <Skeleton className="h-32 w-full" />
          ) : tenderNotesData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-notes">
              <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No notes yet</p>
              <p className="text-sm mt-1">Add a note above to record important information about this tender.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tenderNotesData.map((note) => (
                <Card key={note.id} data-testid={`card-note-${note.id}`}>
                  <CardContent className="pt-4">
                    {editingNoteId === note.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          className="resize-none"
                          data-testid={`input-edit-note-${note.id}`}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingNoteId(null); setEditingNoteContent(""); }} data-testid={`button-cancel-edit-note-${note.id}`}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateNoteMutation.mutate({ noteId: note.id, content: editingNoteContent.trim() })}
                            disabled={updateNoteMutation.isPending || !editingNoteContent.trim()}
                            data-testid={`button-save-note-${note.id}`}
                          >
                            {updateNoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm whitespace-pre-wrap" data-testid={`text-note-content-${note.id}`}>{note.content}</p>
                        <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            {note.createdBy?.name || "Unknown"} - {format(new Date(note.createdAt), "dd/MM/yyyy HH:mm")}
                            {note.updatedAt !== note.createdAt && " (edited)"}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}
                              data-testid={`button-edit-note-${note.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              disabled={deleteNoteMutation.isPending}
                              data-testid={`button-delete-note-${note.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>

      <InvitationSidebar
        invitation={selectedInvitation}
        onClose={() => setSelectedInvitation(null)}
        initialTab={sidebarInitialTab}
      />

      <Dialog open={sendInviteOpen} onOpenChange={(open) => { if (!open) { setSendInviteOpen(false); setSendInviteMember(null); setInviteSubject(""); setInviteMessage(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Invitation
            </DialogTitle>
            <DialogDescription>
              Send an email invitation to {sendInviteMember?.supplier?.name || "this supplier"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>To</Label>
              <Input
                value={sendInviteMember?.supplier?.email || ""}
                disabled
                data-testid="input-invite-to"
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={inviteSubject}
                onChange={(e) => setInviteSubject(e.target.value)}
                placeholder="Email subject..."
                data-testid="input-invite-subject"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Email message..."
                className="resize-none min-h-[120px]"
                data-testid="input-invite-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSendInviteOpen(false); setSendInviteMember(null); }} data-testid="button-cancel-invite">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (sendInviteMember) {
                  sendInviteMutation.mutate({
                    memberId: sendInviteMember.id,
                    subject: inviteSubject,
                    message: inviteMessage,
                  });
                }
              }}
              disabled={sendInviteMutation.isPending || !inviteSubject.trim() || !inviteMessage.trim()}
              data-testid="button-send-invite"
            >
              {sendInviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submissionFormOpen} onOpenChange={(open) => { if (!open) closeSubmissionForm(); else setSubmissionFormOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Submission</DialogTitle>
            <DialogDescription>Add a new supplier submission to this tender.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Supplier *</Label>
              <Select value={subFormSupplierId} onValueChange={setSubFormSupplierId}>
                <SelectTrigger data-testid="select-submission-supplier">
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`option-supplier-${s.id}`}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cover Note</Label>
              <Textarea
                value={subFormCoverNote}
                onChange={(e) => setSubFormCoverNote(e.target.value)}
                placeholder="Supplier cover note..."
                className="resize-none"
                data-testid="input-submission-covernote"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={subFormStatus} onValueChange={setSubFormStatus}>
                <SelectTrigger data-testid="select-submission-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="REVISED">Revised</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Subtotal</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={subFormSubtotal}
                  onChange={(e) => setSubFormSubtotal(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-submission-subtotal"
                />
              </div>
              <div>
                <Label>Tax</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={subFormTaxAmount}
                  onChange={(e) => setSubFormTaxAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-submission-tax"
                />
              </div>
              <div>
                <Label>Total</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={subFormTotalPrice}
                  onChange={(e) => setSubFormTotalPrice(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-submission-total"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={subFormNotes}
                onChange={(e) => setSubFormNotes(e.target.value)}
                placeholder="Internal notes..."
                className="resize-none"
                data-testid="input-submission-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSubmissionForm} data-testid="button-cancel-submission">Cancel</Button>
            <Button
              onClick={handleSubmissionSubmit}
              disabled={createSubmissionMutation.isPending || !subFormSupplierId}
              data-testid="button-submit-submission"
            >
              {createSubmissionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkScopeOpen} onOpenChange={(open) => { if (!open) { setLinkScopeOpen(false); setLinkScopeId(""); setScopeSearch(""); } else setLinkScopeOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Scope</DialogTitle>
            <DialogDescription>Link an active scope of works to this tender.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search scopes..."
                value={scopeSearch}
                onChange={(e) => setScopeSearch(e.target.value)}
                data-testid="input-scope-search"
              />
            </div>
            <div>
              <Label>Scope</Label>
              <Select value={linkScopeId} onValueChange={setLinkScopeId}>
                <SelectTrigger data-testid="select-link-scope">
                  <SelectValue placeholder="Select scope..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredAvailableScopes.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`option-scope-${s.id}`}>
                      {s.name}{s.trade ? ` (${s.trade.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLinkScopeOpen(false); setLinkScopeId(""); setScopeSearch(""); }} data-testid="button-cancel-link-scope">Cancel</Button>
            <Button
              onClick={() => { if (linkScopeId) linkScopeMutation.mutate(linkScopeId); }}
              disabled={linkScopeMutation.isPending || !linkScopeId}
              data-testid="button-submit-link-scope"
            >
              {linkScopeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Link Scope
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={findSuppliersOpen} onOpenChange={(open) => { if (!open) closeFindSuppliersDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {findSuppliersStep === "select-codes" && "Find Suppliers"}
              {findSuppliersStep === "confirm-radius" && "Set Search Area"}
              {findSuppliersStep === "searching" && "Searching for Suppliers..."}
              {findSuppliersStep === "results" && "AI-Found Suppliers"}
            </DialogTitle>
            <DialogDescription>
              {findSuppliersStep === "select-codes" && "Select trade categories to search for relevant suppliers in your project area."}
              {findSuppliersStep === "confirm-radius" && "Review the recommended search radius based on your project, then adjust if needed."}
              {findSuppliersStep === "searching" && "AI is searching for suppliers matching your trade categories and project location."}
              {findSuppliersStep === "results" && (
                <>Found {foundSuppliers.length} suppliers. Select which ones to add to this tender.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {findSuppliersStep === "select-codes" && (
            <div className="space-y-4">
              <Label>Trade Categories</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search trade categories..."
                  value={tradeSearchQuery}
                  onChange={(e) => setTradeSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-trade-categories"
                />
              </div>
              {(() => {
                const filtered = costCodesData.filter((cc) => {
                  if (!tradeSearchQuery.trim()) return true;
                  const q = tradeSearchQuery.toLowerCase();
                  return cc.code.toLowerCase().includes(q) || cc.name.toLowerCase().includes(q);
                });
                const allFilteredSelected = filtered.length > 0 && filtered.every((cc) => selectedCostCodeIds.includes(cc.id));
                return (
                  <>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (allFilteredSelected) {
                            setSelectedCostCodeIds((prev) => prev.filter((id) => !filtered.some((cc) => cc.id === id)));
                          } else {
                            setSelectedCostCodeIds((prev) => {
                              const newIds = new Set(prev);
                              filtered.forEach((cc) => newIds.add(cc.id));
                              return Array.from(newIds);
                            });
                          }
                        }}
                        data-testid="button-select-all-trades"
                      >
                        {allFilteredSelected ? "Deselect All" : "Select All"}
                        {tradeSearchQuery.trim() && ` (${filtered.length})`}
                      </Button>
                      {selectedCostCodeIds.length > 0 && (
                        <p className="text-sm text-muted-foreground">{selectedCostCodeIds.length} selected</p>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto border rounded-md p-3 space-y-2">
                      {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {costCodesData.length === 0 ? "No cost codes configured. Add cost codes in Settings first." : "No matching trade categories found."}
                        </p>
                      ) : (
                        filtered.map((cc) => (
                          <div key={cc.id} className="flex items-center gap-3 py-1" data-testid={`checkbox-cost-code-${cc.id}`}>
                            <Checkbox
                              id={`cc-${cc.id}`}
                              checked={selectedCostCodeIds.includes(cc.id)}
                              onCheckedChange={() => toggleCostCode(cc.id)}
                            />
                            <label htmlFor={`cc-${cc.id}`} className="text-sm cursor-pointer flex-1">
                              <span className="font-medium">{cc.code}</span> - {cc.name}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                );
              })()}
              <DialogFooter>
                <Button variant="outline" onClick={closeFindSuppliersDialog} data-testid="button-cancel-find-suppliers">Cancel</Button>
                <Button
                  onClick={handleProceedToRadius}
                  disabled={selectedCostCodeIds.length === 0 || loadingRadius}
                  data-testid="button-next-radius"
                >
                  {loadingRadius ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Next: Set Search Area
                </Button>
              </DialogFooter>
            </div>
          )}

          {findSuppliersStep === "confirm-radius" && radiusInfo && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <div><span className="font-medium">Project Type:</span> {radiusInfo.projectType}</div>
                <div><span className="font-medium">Location:</span> {radiusInfo.location}</div>
                <div><span className="font-medium">Estimated Value:</span> {radiusInfo.projectValue}</div>
                <div><span className="font-medium">Classification:</span> {radiusInfo.projectScale}</div>
              </div>

              <div className="space-y-3">
                <Label>Search Radius (km)</Label>
                <p className="text-sm text-muted-foreground">
                  We recommend <span className="font-medium">{radiusInfo.searchRadiusKm}km</span> based on your project type and value. Adjust if needed.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setUserSearchRadius(prev => Math.max(5, prev - 5))}
                    disabled={userSearchRadius <= 5}
                    data-testid="button-radius-decrease"
                  >
                    <span className="text-lg font-bold">-</span>
                  </Button>
                  <Input
                    type="number"
                    min={5}
                    max={500}
                    value={userSearchRadius}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 5 && val <= 500) setUserSearchRadius(val);
                    }}
                    className="w-24 text-center text-lg font-medium"
                    data-testid="input-search-radius"
                  />
                  <span className="text-sm text-muted-foreground">km</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setUserSearchRadius(prev => Math.min(500, prev + 5))}
                    disabled={userSearchRadius >= 500}
                    data-testid="button-radius-increase"
                  >
                    <span className="text-lg font-bold">+</span>
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[10, 25, 50, 75, 100, 150, 200].map((r) => (
                    <Button
                      key={r}
                      variant={userSearchRadius === r ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUserSearchRadius(r)}
                      data-testid={`button-radius-preset-${r}`}
                    >
                      {r}km
                    </Button>
                  ))}
                </div>
                {userSearchRadius !== radiusInfo.searchRadiusKm && (
                  <p className="text-xs text-muted-foreground">
                    Changed from recommended {radiusInfo.searchRadiusKm}km to {userSearchRadius}km
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setFindSuppliersStep("select-codes")} data-testid="button-back-to-codes-from-radius">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleFindSuppliers} data-testid="button-search-suppliers">
                  <Search className="h-4 w-4 mr-2" />
                  Search within {userSearchRadius}km
                </Button>
              </DialogFooter>
            </div>
          )}

          {findSuppliersStep === "searching" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">AI is analyzing your project details and searching for relevant suppliers...</p>
              <p className="text-xs text-muted-foreground">This may take 10-20 seconds</p>
            </div>
          )}

          {findSuppliersStep === "results" && (
            <div className="space-y-4">
              {searchContext && (
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                  <div><span className="font-medium">Location:</span> {searchContext.location}</div>
                  <div><span className="font-medium">Categories:</span> {searchContext.costCodes}</div>
                  <div><span className="font-medium">Project Type:</span> {searchContext.projectType}</div>
                  {searchContext.projectScale && (
                    <div><span className="font-medium">Project Scale:</span> {searchContext.projectScale}</div>
                  )}
                  {searchContext.searchRadiusKm && (
                    <div><span className="font-medium">Search Radius:</span> {searchContext.searchRadiusKm}km from job site</div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <Label>Select Suppliers to Add</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFoundSuppliers(new Set(foundSuppliers.map((_, i) => i)))}
                    data-testid="button-select-all-suppliers"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFoundSuppliers(new Set())}
                    data-testid="button-deselect-all-suppliers"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              {foundSuppliers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No suppliers found. Try different trade categories.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-4">
                  {(() => {
                    const grouped = new Map<string, { suppliers: FoundSupplier[]; indices: number[] }>();
                    foundSuppliers.forEach((supplier, index) => {
                      const category = supplier.tradeCategory || "Uncategorised";
                      const existing = grouped.get(category) || { suppliers: [], indices: [] };
                      existing.suppliers.push(supplier);
                      existing.indices.push(index);
                      grouped.set(category, existing);
                    });
                    return Array.from(grouped.entries()).map(([category, { suppliers: groupedSuppliers, indices }]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2 sticky top-0 bg-background z-10 py-1">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{category}</span>
                          <Badge variant="secondary" className="text-xs">{groupedSuppliers.length}</Badge>
                        </div>
                        <div className="space-y-2 pl-1">
                          {groupedSuppliers.map((supplier, groupIdx) => {
                            const globalIndex = indices[groupIdx];
                            return (
                              <div
                                key={globalIndex}
                                className={`border rounded-md p-3 cursor-pointer transition-colors ${
                                  selectedFoundSuppliers.has(globalIndex) ? "border-primary bg-primary/5" : "hover-elevate"
                                }`}
                                onClick={() => toggleFoundSupplier(globalIndex)}
                                data-testid={`card-found-supplier-${globalIndex}`}
                              >
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={selectedFoundSuppliers.has(globalIndex)}
                                    onCheckedChange={() => toggleFoundSupplier(globalIndex)}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium" data-testid={`text-found-name-${globalIndex}`}>{supplier.companyName}</span>
                                      {supplier.location && (
                                        <Badge variant="outline" className="text-xs">
                                          <MapPin className="h-3 w-3 mr-0.5" />
                                          {supplier.location}
                                        </Badge>
                                      )}
                                      {supplier.estimatedDistanceKm != null && (
                                        <Badge variant="secondary" className="text-xs">
                                          ~{supplier.estimatedDistanceKm}km
                                        </Badge>
                                      )}
                                    </div>
                                    {supplier.specialty && (
                                      <p className="text-sm text-muted-foreground mt-0.5">{supplier.specialty}</p>
                                    )}
                                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                                      {supplier.contactName && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Users className="h-3 w-3" /> {supplier.contactName}
                                        </span>
                                      )}
                                      {supplier.email && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Mail className="h-3 w-3" /> {supplier.email}
                                        </span>
                                      )}
                                      {supplier.phone && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Phone className="h-3 w-3" /> {supplier.phone}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              <DialogFooter className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={() => setFindSuppliersStep("confirm-radius")} data-testid="button-back-to-codes">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={handleAddSelectedSuppliers}
                  disabled={selectedFoundSuppliers.size === 0 || addFoundSuppliersMutation.isPending}
                  data-testid="button-add-selected-suppliers"
                >
                  {addFoundSuppliersMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add {selectedFoundSuppliers.size} Supplier{selectedFoundSuppliers.size !== 1 ? "s" : ""} to Tender
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <InvitationSidebar
        invitation={selectedInvitation}
        onClose={() => setSelectedInvitation(null)}
        initialTab={sidebarInitialTab}
      />
    </div>
  );
}