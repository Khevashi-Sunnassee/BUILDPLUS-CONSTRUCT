import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AP_INVOICE_ROUTES } from "@shared/api-routes";
import { useRoute, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Download, FileText, Plus, Send, Shield, ShieldAlert, ShieldCheck,
  Clock, Pause, AlertTriangle, X, Pencil, Check, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, FolderOpen, Loader2, BarChart3
} from "lucide-react";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  supplierId: string | null;
  companyId: string;
  invoiceDate: string | null;
  dueDate: string | null;
  description: string | null;
  totalEx: string | null;
  totalTax: string | null;
  totalInc: string | null;
  currency: string | null;
  status: string;
  assigneeUserId: string | null;
  createdByUserId: string;
  uploadedAt: string;
  riskScore: number | null;
  riskReasons: string[] | null;
  isUrgent: boolean;
  isOnHold: boolean;
  postPeriod: string | null;
  supplier?: { id: string; name: string } | null;
  assigneeUser?: { id: string; name: string; email: string } | null;
  createdByUser?: { id: string; name: string; email: string } | null;
  documents?: Array<{ id: string; fileName: string; mimeType: string; storageKey: string; fileSize?: number }>;
  extractedFields?: Array<{ id: string; fieldKey: string; fieldValue: string | null; confidence: number | null; bboxJson?: any }>;
  splits?: Array<any>;
  approvals?: Array<any>;
  activity?: Array<{ id: string; activityType: string; message: string; actorName?: string; createdAt: string; metaJson?: any }>;
  comments?: Array<{ id: string; userId: string; userName?: string; body: string; createdAt: string }>;
}

interface InvoiceSplit {
  id?: string;
  itemId: number;
  description: string;
  splitPercent: number;
  extendedCost: number;
  total: number;
  glCode: string;
  jobId: string;
}

interface ActivityItem {
  id: string;
  activityType: string;
  message: string;
  actorName?: string;
  createdAt: string;
  metaJson?: any;
}

interface CommentItem {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
}

interface ApprovalPathStep {
  id: string;
  userName: string;
  role: string;
  status: string;
  timestamp?: string;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(amount: string | number | null | undefined): string {
  const n = parseFloat(String(amount || "0"));
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function getRiskLevel(score: number | null): { label: string; color: string; bgColor: string; icon: typeof Shield } {
  if (score === null || score === undefined) return { label: "Unknown", color: "text-muted-foreground", bgColor: "bg-muted", icon: Shield };
  if (score <= 33) return { label: "Low Risk", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800", icon: ShieldCheck };
  if (score <= 66) return { label: "Medium Risk", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: ShieldAlert };
  return { label: "High Risk", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", icon: ShieldAlert };
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function RiskCard({ invoice }: { invoice: InvoiceDetail }) {
  const risk = getRiskLevel(invoice.riskScore);
  const RiskIcon = risk.icon;
  return (
    <Card className={`border ${risk.bgColor}`} data-testid="card-risk">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <RiskIcon className={`h-5 w-5 ${risk.color}`} />
            <div>
              <span className={`text-sm font-semibold ${risk.color}`} data-testid="text-risk-level">{risk.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">Risk Score: {invoice.riskScore ?? "N/A"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold" data-testid="text-invoice-total">{formatCurrency(invoice.totalInc)}</p>
            <p className="text-xs text-muted-foreground">Invoice Total</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-muted-foreground">Supplier Avg</p>
            <p className="text-xs text-muted-foreground">—</p>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs">Trend</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditableField({ label, value, fieldKey, onSave, onFocus, type = "text" }: {
  label: string;
  value: string;
  fieldKey: string;
  onSave: (key: string, val: string) => void;
  onFocus: (key: string) => void;
  type?: "text" | "date";
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) {
      onSave(fieldKey, editValue);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover-elevate cursor-pointer group"
      onFocus={() => onFocus(fieldKey)}
      onClick={() => { onFocus(fieldKey); if (!editing) setEditing(true); }}
      data-testid={`field-${fieldKey}`}
    >
      <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[100px]">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1 justify-end">
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setEditValue(value); setEditing(false); } }}
            className="h-7 text-sm max-w-[200px]"
            autoFocus
            data-testid={`input-${fieldKey}`}
          />
        </div>
      ) : (
        <span className="text-sm font-medium text-right truncate" data-testid={`value-${fieldKey}`}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}

function InvoiceSummaryCard({ invoice, onFieldSave, onFieldFocus }: {
  invoice: InvoiceDetail;
  onFieldSave: (key: string, val: string) => void;
  onFieldFocus: (key: string) => void;
}) {
  const fields = [
    { label: "Invoice Number", key: "invoiceNumber", value: invoice.invoiceNumber || "" },
    { label: "Supplier", key: "supplierName", value: invoice.supplier?.name || "" },
    { label: "Invoice Date", key: "invoiceDate", value: invoice.invoiceDate ? invoice.invoiceDate.split("T")[0] : "", type: "date" as const },
    { label: "Due Date", key: "dueDate", value: invoice.dueDate ? invoice.dueDate.split("T")[0] : "", type: "date" as const },
    { label: "Post Period", key: "postPeriod", value: invoice.postPeriod || "" },
    { label: "Description", key: "description", value: invoice.description || "" },
  ];

  return (
    <Card data-testid="card-invoice-summary">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">General Information</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-0.5">
        {fields.map((f) => (
          <EditableField
            key={f.key}
            label={f.label}
            value={f.value}
            fieldKey={f.key}
            onSave={onFieldSave}
            onFocus={onFieldFocus}
            type={f.type || "text"}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SplitsTable({ invoiceId, invoiceTotal, splits, onSplitsChange }: {
  invoiceId: string;
  invoiceTotal: number;
  splits: InvoiceSplit[];
  onSplitsChange: (splits: InvoiceSplit[]) => void;
}) {
  const { toast } = useToast();

  const totalSplitPercent = useMemo(() => splits.reduce((sum, s) => sum + (s.splitPercent || 0), 0), [splits]);
  const totalAmount = useMemo(() => splits.reduce((sum, s) => sum + (s.total || 0), 0), [splits]);
  const variance = invoiceTotal - totalAmount;

  const saveMutation = useMutation({
    mutationFn: async (updatedSplits: InvoiceSplit[]) => {
      await apiRequest("PUT", AP_INVOICE_ROUTES.SPLITS(invoiceId), { splits: updatedSplits });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId)] });
      toast({ title: "Splits saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save splits", description: err.message, variant: "destructive" });
    },
  });

  const updateSplit = (index: number, field: keyof InvoiceSplit, value: string | number) => {
    const updated = [...splits];
    (updated[index] as any)[field] = value;
    if (field === "splitPercent") {
      updated[index].total = invoiceTotal * (Number(value) / 100);
      updated[index].extendedCost = updated[index].total;
    }
    onSplitsChange(updated);
  };

  const addSplit = () => {
    onSplitsChange([
      ...splits,
      { itemId: splits.length + 1, description: "", splitPercent: 0, extendedCost: 0, total: 0, glCode: "", jobId: "" },
    ]);
  };

  return (
    <Card data-testid="card-splits">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold">Cost Splits</CardTitle>
          <Button size="sm" variant="outline" onClick={addSplit} data-testid="button-add-split">
            <Plus className="h-3 w-3 mr-1" />
            Add Row
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${totalSplitPercent >= 100 ? "bg-green-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, totalSplitPercent)}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-medium" data-testid="text-split-percent">{totalSplitPercent.toFixed(1)}%</span>
          <span className={`text-xs font-medium ${Math.abs(variance) < 0.01 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-variance">
            Variance: {formatCurrency(variance)}
          </span>
        </div>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20">% Split</TableHead>
                <TableHead className="w-28 text-right">Ext. Cost</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
                <TableHead className="w-28">GL Code</TableHead>
                <TableHead className="w-28">Job</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {splits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    No splits added yet
                  </TableCell>
                </TableRow>
              ) : (
                splits.map((split, i) => (
                  <TableRow key={i} data-testid={`row-split-${i}`}>
                    <TableCell className="text-xs text-muted-foreground">{split.itemId}</TableCell>
                    <TableCell>
                      <Input
                        value={split.description}
                        onChange={(e) => updateSplit(i, "description", e.target.value)}
                        className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-1"
                        placeholder="Description"
                        data-testid={`input-split-desc-${i}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={split.splitPercent}
                        onChange={(e) => updateSplit(i, "splitPercent", parseFloat(e.target.value) || 0)}
                        className="h-7 text-sm border-0 bg-transparent p-0 w-16 focus-visible:ring-1"
                        data-testid={`input-split-percent-${i}`}
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(split.extendedCost)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(split.total)}</TableCell>
                    <TableCell>
                      <Input
                        value={split.glCode}
                        onChange={(e) => updateSplit(i, "glCode", e.target.value)}
                        className="h-7 text-sm border-0 bg-transparent p-0 w-24 focus-visible:ring-1"
                        placeholder="GL Code"
                        data-testid={`input-split-gl-${i}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={split.jobId}
                        onChange={(e) => updateSplit(i, "jobId", e.target.value)}
                        className="h-7 text-sm border-0 bg-transparent p-0 w-24 focus-visible:ring-1"
                        placeholder="Job"
                        data-testid={`input-split-job-${i}`}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {splits.length > 0 && (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(splits)}
              disabled={saveMutation.isPending}
              data-testid="button-save-splits"
            >
              {saveMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Save Splits
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivitiesFeed({ invoiceId }: { invoiceId: string }) {
  const { data: activities } = useQuery<ActivityItem[]>({
    queryKey: [AP_INVOICE_ROUTES.ACTIVITY(invoiceId)],
  });

  return (
    <Card data-testid="card-activities">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!activities || activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3" data-testid={`activity-${a.id}`}>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{getInitials(a.actorName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{a.actorName || "System"}</span>{" "}
                    <span className="text-muted-foreground">{a.message}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {formatDate(a.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentsSection({ invoiceId }: { invoiceId: string }) {
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");

  const { data: comments } = useQuery<CommentItem[]>({
    queryKey: [AP_INVOICE_ROUTES.COMMENTS(invoiceId)],
  });

  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      await apiRequest("POST", AP_INVOICE_ROUTES.COMMENTS(invoiceId), { body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COMMENTS(invoiceId)] });
      setCommentText("");
      toast({ title: "Comment added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add comment", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    addCommentMutation.mutate(commentText.trim());
  };

  return (
    <Card data-testid="card-comments">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Comments</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {comments && comments.length > 0 && (
          <div className="space-y-3 max-h-[200px] overflow-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3" data-testid={`comment-${c.id}`}>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{getInitials(c.userName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.userName}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-sm mt-0.5">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add comment or tag someone using the @ symbol..."
            className="resize-none text-sm min-h-[60px]"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitComment(); }}
            data-testid="textarea-comment"
          />
          <Button
            size="icon"
            onClick={handleSubmitComment}
            disabled={!commentText.trim() || addCommentMutation.isPending}
            data-testid="button-send-comment"
          >
            {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PdfViewer({ invoice, focusedField }: { invoice: InvoiceDetail; focusedField: string | null }) {
  const [zoom, setZoom] = useState(100);

  const doc = invoice.documents?.[0];
  const focusedFieldData = focusedField && invoice.extractedFields?.find(f => f.fieldKey === focusedField);
  const bbox = focusedFieldData?.bboxJson;

  return (
    <div className="flex flex-col h-full bg-muted/30" data-testid="panel-pdf-viewer">
      <div className="flex-1 relative overflow-auto p-4">
        {doc ? (
          <div className="relative w-full h-full" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
            {doc.mimeType?.includes("pdf") ? (
              <iframe
                src={AP_INVOICE_ROUTES.DOCUMENT(invoice.id)}
                className="w-full h-full min-h-[600px] border-0"
                title="Invoice PDF"
                data-testid="iframe-pdf-viewer"
              />
            ) : doc.mimeType?.startsWith("image/") ? (
              <img
                src={AP_INVOICE_ROUTES.DOCUMENT(invoice.id)}
                alt="Invoice document"
                className="max-w-full"
                data-testid="img-document"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-1">{doc.fileName}</p>
                <Badge variant="outline">Unsupported format</Badge>
              </div>
            )}
            {bbox && (
              <div
                className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none z-10"
                style={{
                  left: `${(bbox.x1 || 0) * 100}%`,
                  top: `${(bbox.y1 || 0) * 100}%`,
                  width: `${((bbox.x2 || 0) - (bbox.x1 || 0)) * 100}%`,
                  height: `${((bbox.y2 || 0) - (bbox.y1 || 0)) * 100}%`,
                }}
                data-testid="bbox-highlight"
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">No document uploaded</p>
            <p className="text-xs text-muted-foreground">Upload a PDF or image to view it here</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-t bg-background flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={!doc} data-testid="button-download-invoice">
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
          <Button variant="outline" size="sm" data-testid="button-document-management">
            <FolderOpen className="h-3 w-3 mr-1" />
            Documents
          </Button>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Page 1 of 1</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setZoom(Math.max(50, zoom - 10))} data-testid="button-zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs w-10 text-center">{zoom}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoom(Math.min(200, zoom + 10))} data-testid="button-zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApprovalPathSheet({ invoiceId, open, onOpenChange }: { invoiceId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: approvalPath } = useQuery<ApprovalPathStep[]>({
    queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId)],
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="sheet-approval-path">
        <SheetHeader>
          <SheetTitle>Approval Path</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {!approvalPath || approvalPath.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No approval path configured</p>
          ) : (
            approvalPath.map((step, i) => (
              <div key={step.id} className="flex items-start gap-3" data-testid={`approval-step-${i}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                  step.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.userName}</p>
                  <p className="text-xs text-muted-foreground">{step.role}</p>
                  {step.timestamp && <p className="text-xs text-muted-foreground mt-1">{formatDate(step.timestamp)}</p>}
                </div>
                <Badge variant={step.status === "approved" ? "default" : step.status === "rejected" ? "destructive" : "secondary"} className={step.status === "approved" ? "bg-green-600 text-white" : ""}>
                  {step.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ApInvoiceDetailPage() {
  const [, params] = useRoute("/ap-invoices/:id");
  const invoiceId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useDocumentTitle("Invoice Detail");

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [approvalSheetOpen, setApprovalSheetOpen] = useState(false);
  const [goToNext, setGoToNext] = useState(false);
  const [splits, setSplits] = useState<InvoiceSplit[]>([]);
  const [splitsInitialized, setSplitsInitialized] = useState(false);

  const { data: invoice, isLoading } = useQuery<InvoiceDetail>({
    queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId || "")],
    enabled: !!invoiceId,
  });

  const { data: splitsData } = useQuery<InvoiceSplit[]>({
    queryKey: [AP_INVOICE_ROUTES.SPLITS(invoiceId || "")],
    enabled: !!invoiceId,
  });

  if (splitsData && !splitsInitialized) {
    setSplits(splitsData);
    setSplitsInitialized(true);
  }

  const updateFieldMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await apiRequest("PATCH", AP_INVOICE_ROUTES.BY_ID(invoiceId!), { [key]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      toast({ title: "Field updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", AP_INVOICE_ROUTES.APPROVE(invoiceId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      toast({ title: "Invoice approved" });
      if (goToNext) navigate("/ap-invoices");
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", AP_INVOICE_ROUTES.REJECT(invoiceId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      toast({ title: "Invoice rejected" });
      if (goToNext) navigate("/ap-invoices");
    },
    onError: (err: Error) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  const onHoldMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", AP_INVOICE_ROUTES.ON_HOLD(invoiceId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      toast({ title: invoice?.isOnHold ? "Removed from hold" : "Placed on hold" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const urgentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", AP_INVOICE_ROUTES.URGENT(invoiceId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      toast({ title: invoice?.isUrgent ? "Removed urgent flag" : "Marked as urgent" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", AP_INVOICE_ROUTES.SUBMIT(invoiceId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      toast({ title: "Invoice submitted for approval" });
    },
    onError: (err: Error) => {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" });
    },
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", AP_INVOICE_ROUTES.EXTRACT(invoiceId!));
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
      toast({ title: "Extraction complete", description: `${data.fields?.length || 0} fields extracted` });
    },
    onError: (err: Error) => {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFieldSave = useCallback((key: string, value: string) => {
    updateFieldMutation.mutate({ key, value });
  }, [updateFieldMutation]);

  const handleFieldFocus = useCallback((key: string) => {
    setFocusedField(key);
  }, []);

  if (!invoiceId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Invoice not found</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full gap-0">
        <div className="w-[55%] p-6">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="w-[45%] p-6 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Invoice not found</p>
        <Button variant="outline" onClick={() => navigate("/ap-invoices")} data-testid="button-back-to-list">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
      </div>
    );
  }

  const invoiceTotal = parseFloat(String(invoice.totalInc || "0"));

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]" data-testid="page-invoice-detail">
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ap-invoices")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <h1 className="text-sm font-semibold" data-testid="text-invoice-number">
          Invoice {invoice.invoiceNumber || invoice.id}
        </h1>
        <Badge variant="secondary" data-testid="badge-status">
          {(invoice.status || "draft").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
        </Badge>
        {invoice.isOnHold && <Badge variant="outline" className="text-amber-600 border-amber-300">On Hold</Badge>}
        {invoice.isUrgent && <Badge variant="destructive">Urgent</Badge>}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {invoice.documents && invoice.documents.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
              data-testid="button-extract-ai"
            >
              {extractMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <BarChart3 className="h-3 w-3 mr-1" />
              )}
              {extractMutation.isPending ? "Extracting..." : "Extract with AI"}
            </Button>
          )}
          {invoice.status === "DRAFT" && (
            <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} data-testid="button-submit-invoice">
              {submitMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Submit
            </Button>
          )}
          {invoice.status === "PENDING_REVIEW" && (
            <>
              <Button size="sm" onClick={() => { setGoToNext(false); approveMutation.mutate(); }} disabled={approveMutation.isPending} data-testid="button-approve-invoice">
                <Check className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { setGoToNext(false); rejectMutation.mutate(); }} disabled={rejectMutation.isPending} data-testid="button-reject-invoice">
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => onHoldMutation.mutate()} disabled={onHoldMutation.isPending} data-testid="button-toggle-hold">
            <Pause className="h-3 w-3 mr-1" />
            {invoice.isOnHold ? "Remove Hold" : "Hold"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => urgentMutation.mutate()} disabled={urgentMutation.isPending} data-testid="button-toggle-urgent">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {invoice.isUrgent ? "Remove Urgent" : "Urgent"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[55%] border-r overflow-hidden">
          <PdfViewer invoice={invoice} focusedField={focusedField} />
        </div>

        <div className="w-[45%] overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <RiskCard invoice={invoice} />
              <InvoiceSummaryCard invoice={invoice} onFieldSave={handleFieldSave} onFieldFocus={handleFieldFocus} />

              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" className="text-primary underline-offset-4 hover:underline" onClick={() => setApprovalSheetOpen(true)} data-testid="button-view-approval-path">
                  View Approval Path
                </Button>
              </div>

              <SplitsTable
                invoiceId={invoiceId}
                invoiceTotal={invoiceTotal}
                splits={splits}
                onSplitsChange={setSplits}
              />

              <ActivitiesFeed invoiceId={invoiceId} />
              <CommentsSection invoiceId={invoiceId} />
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-background flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onHoldMutation.mutate()}
                disabled={onHoldMutation.isPending}
                className={`toggle-elevate ${invoice.isOnHold ? "toggle-elevated" : ""}`}
                data-testid="button-on-hold"
              >
                <Pause className="h-3 w-3 mr-1" />
                On Hold
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => urgentMutation.mutate()}
                disabled={urgentMutation.isPending}
                className={`toggle-elevate ${invoice.isUrgent ? "toggle-elevated" : ""}`}
                data-testid="button-urgent"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Urgent
              </Button>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={goToNext}
                  onCheckedChange={(v) => setGoToNext(!!v)}
                  id="go-next"
                  data-testid="checkbox-go-to-next"
                />
                <label htmlFor="go-next" className="text-xs text-muted-foreground cursor-pointer">Go to next invoice</label>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("/ap-invoices")} data-testid="button-close">
                Close
              </Button>
              <Button variant="outline" size="sm" data-testid="button-edit">
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/50"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                data-testid="button-reject"
              >
                {rejectMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-green-600 text-white"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                data-testid="button-approve"
              >
                {approveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                Approve
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ApprovalPathSheet invoiceId={invoiceId} open={approvalSheetOpen} onOpenChange={setApprovalSheetOpen} />
    </div>
  );
}
