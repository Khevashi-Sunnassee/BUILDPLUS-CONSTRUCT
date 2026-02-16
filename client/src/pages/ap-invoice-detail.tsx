import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AP_INVOICE_ROUTES } from "@shared/api-routes";
import { useRoute, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/lib/auth";
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
  ZoomIn, ZoomOut, FolderOpen, Loader2, BarChart3, Filter
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
  description: string | null;
  percentage: string | null;
  amount: string;
  costCodeId: string | null;
  jobId: string | null;
  taxCodeId: string | null;
  sortOrder: number;
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

interface ResolvedCondition {
  field: string;
  operator: string;
  values: string[];
  resolvedValues: string[];
}

interface ApprovalPathStep {
  id: string;
  approverUserId: string;
  approverName: string | null;
  approverEmail: string | null;
  stepIndex: number;
  status: string;
  decisionAt: string | null;
  note: string | null;
  ruleName: string | null;
  ruleType: string | null;
  ruleConditionsResolved: ResolvedCondition[] | null;
  isCurrent: boolean;
}

interface ApprovalPathResponse {
  steps: ApprovalPathStep[];
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number | null;
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

  useEffect(() => {
    if (!editing) {
      setEditValue(value);
    }
  }, [value, editing]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) {
      onSave(fieldKey, editValue);
    }
  };

  return (
    <div
      className="flex items-start gap-2 py-1.5 px-2 rounded-md hover-elevate cursor-pointer group"
      onFocus={() => onFocus(fieldKey)}
      onClick={() => { onFocus(fieldKey); if (!editing) setEditing(true); }}
      data-testid={`field-${fieldKey}`}
    >
      <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[100px] pt-0.5">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1">
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setEditValue(value); setEditing(false); } }}
            className="h-7 text-sm flex-1"
            autoFocus
            data-testid={`input-${fieldKey}`}
          />
        </div>
      ) : (
        <span className="text-sm font-medium text-left break-words min-w-0" data-testid={`value-${fieldKey}`}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}

function SupplierSearchField({ invoice, onSupplierSelect, onFocus }: {
  invoice: InvoiceDetail;
  onSupplierSelect: (supplierId: string | null, supplierName: string) => void;
  onFocus: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allSuppliers } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/procurement/suppliers/active"],
  });

  const filtered = useMemo(() => {
    if (!allSuppliers) return [];
    if (!search.trim()) return allSuppliers.slice(0, 20);
    const q = search.toLowerCase();
    return allSuppliers.filter(s => s.name.toLowerCase().includes(q)).slice(0, 20);
  }, [allSuppliers, search]);

  const exactMatch = useMemo(() => {
    if (!search.trim() || !allSuppliers) return false;
    return allSuppliers.some(s => s.name.toLowerCase() === search.toLowerCase());
  }, [allSuppliers, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setShowDropdown(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (supplier: { id: string; name: string }) => {
    onSupplierSelect(supplier.id, supplier.name);
    setEditing(false);
    setShowDropdown(false);
    setSearch("");
  };

  const handleCreateNew = () => {
    const name = search.trim();
    if (!name) return;
    onSupplierSelect(null, name);
    setEditing(false);
    setShowDropdown(false);
    setSearch("");
  };

  return (
    <div
      ref={containerRef}
      className="flex items-start gap-2 py-1.5 px-2 rounded-md hover-elevate cursor-pointer group relative"
      onClick={() => { onFocus(); if (!editing) { setEditing(true); setSearch(invoice.supplier?.name || ""); setShowDropdown(true); setTimeout(() => inputRef.current?.focus(), 0); } }}
      data-testid="field-supplierName"
    >
      <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[100px] pt-0.5">Supplier</span>
      {editing ? (
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search suppliers..."
            className="h-7 text-sm"
            autoFocus
            data-testid="input-supplierName"
          />
          {showDropdown && (
            <div className="absolute z-50 top-8 left-0 right-0 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto" data-testid="dropdown-supplier-results">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="px-3 py-1.5 text-sm cursor-pointer hover-elevate"
                  onClick={(e) => { e.stopPropagation(); handleSelect(s); }}
                  data-testid={`option-supplier-${s.id}`}
                >
                  {s.name}
                </div>
              ))}
              {search.trim() && !exactMatch && (
                <div
                  className="px-3 py-1.5 text-sm cursor-pointer hover-elevate border-t flex items-center gap-1.5 text-primary"
                  onClick={(e) => { e.stopPropagation(); handleCreateNew(); }}
                  data-testid="button-create-supplier"
                >
                  <Plus className="h-3 w-3" />
                  Add "{search.trim()}" as new supplier
                </div>
              )}
              {filtered.length === 0 && !search.trim() && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No suppliers found</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <span className="text-sm font-medium text-left break-words min-w-0" data-testid="value-supplierName">
          {invoice.supplier?.name || "—"}
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
    { label: "Invoice Date", key: "invoiceDate", value: invoice.invoiceDate ? invoice.invoiceDate.split("T")[0] : "", type: "date" as const },
    { label: "Due Date", key: "dueDate", value: invoice.dueDate ? invoice.dueDate.split("T")[0] : "", type: "date" as const },
    { label: "Post Period", key: "postPeriod", value: invoice.postPeriod || "" },
    { label: "Description", key: "description", value: invoice.description || "" },
  ];

  const handleSupplierSelect = (supplierId: string | null, supplierName: string) => {
    if (supplierId) {
      onFieldSave("supplierId", supplierId);
    } else {
      onFieldSave("supplierName", supplierName);
    }
  };

  return (
    <Card data-testid="card-invoice-summary">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">General Information</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-0.5">
        <EditableField
          label="Invoice Number"
          value={invoice.invoiceNumber || ""}
          fieldKey="invoiceNumber"
          onSave={onFieldSave}
          onFocus={onFieldFocus}
        />
        <SupplierSearchField
          invoice={invoice}
          onSupplierSelect={handleSupplierSelect}
          onFocus={() => onFieldFocus("supplierName")}
        />
        {fields.filter(f => f.key !== "invoiceNumber").map((f) => (
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

  const { data: jobs } = useQuery<Array<{ id: string; name: string; jobNumber: string }>>({
    queryKey: ["/api/jobs"],
  });

  const { data: costCodes } = useQuery<Array<{ id: string; code: string; name: string }>>({
    queryKey: ["/api/cost-codes-with-children"],
  });

  const totalAmount = useMemo(() => splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0), [splits]);
  const variance = invoiceTotal - totalAmount;
  const allocatedPercent = invoiceTotal > 0 ? (totalAmount / invoiceTotal) * 100 : 0;

  const saveMutation = useMutation({
    mutationFn: async (updatedSplits: InvoiceSplit[]) => {
      const payload = updatedSplits.map((s, idx) => ({
        description: s.description || null,
        percentage: s.percentage || null,
        amount: s.amount,
        costCodeId: s.costCodeId || null,
        jobId: s.jobId || null,
        taxCodeId: s.taxCodeId || null,
        sortOrder: idx,
      }));
      await apiRequest("PUT", AP_INVOICE_ROUTES.SPLITS(invoiceId), payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.SPLITS(invoiceId)] });
      toast({ title: "Splits saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save splits", description: err.message, variant: "destructive" });
    },
  });

  const updateSplit = (index: number, field: keyof InvoiceSplit, value: string | null) => {
    const updated = [...splits];
    (updated[index] as any)[field] = value;
    if (field === "percentage" && value) {
      const pct = parseFloat(value) || 0;
      updated[index].amount = (invoiceTotal * pct / 100).toFixed(2);
    }
    if (field === "amount" && value && invoiceTotal > 0) {
      updated[index].percentage = ((parseFloat(value) / invoiceTotal) * 100).toFixed(2);
    }
    onSplitsChange(updated);
  };

  const addSplit = () => {
    const remaining = invoiceTotal - totalAmount;
    onSplitsChange([
      ...splits,
      { description: null, percentage: invoiceTotal > 0 ? ((remaining / invoiceTotal) * 100).toFixed(2) : "0", amount: remaining > 0 ? remaining.toFixed(2) : "0.00", costCodeId: null, jobId: null, taxCodeId: null, sortOrder: splits.length },
    ]);
  };

  const removeSplit = (index: number) => {
    onSplitsChange(splits.filter((_, i) => i !== index));
  };

  return (
    <Card data-testid="card-splits">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold">Cost Splits</CardTitle>
          <Button size="sm" variant="outline" onClick={addSplit} data-testid="button-add-split">
            <Plus className="h-3 w-3 mr-1" />
            Add Line
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${allocatedPercent >= 99.9 ? "bg-green-500" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, allocatedPercent)}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-medium" data-testid="text-split-percent">{allocatedPercent.toFixed(1)}%</span>
          <span className={`text-xs font-medium ${Math.abs(variance) < 0.01 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-variance">
            Variance: {formatCurrency(variance)}
          </span>
        </div>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20">%</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-36">Cost Code</TableHead>
                <TableHead className="w-36">Job</TableHead>
                <TableHead className="w-10"></TableHead>
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
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={split.description || ""}
                        onChange={(e) => updateSplit(i, "description", e.target.value)}
                        className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-1"
                        placeholder="Description"
                        data-testid={`input-split-desc-${i}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={split.percentage || ""}
                        onChange={(e) => updateSplit(i, "percentage", e.target.value)}
                        className="h-7 text-sm border-0 bg-transparent p-0 w-16 focus-visible:ring-1"
                        data-testid={`input-split-percent-${i}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={split.amount}
                        onChange={(e) => updateSplit(i, "amount", e.target.value)}
                        className="h-7 text-sm border-0 bg-transparent p-0 w-24 text-right focus-visible:ring-1"
                        data-testid={`input-split-amount-${i}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={split.costCodeId || "none"} onValueChange={(v) => updateSplit(i, "costCodeId", v === "none" ? null : v)}>
                        <SelectTrigger className="h-7 text-sm border-0 bg-transparent p-0" data-testid={`select-split-costcode-${i}`}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(costCodes || []).map(cc => (
                            <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={split.jobId || "none"} onValueChange={(v) => updateSplit(i, "jobId", v === "none" ? null : v)}>
                        <SelectTrigger className="h-7 text-sm border-0 bg-transparent p-0" data-testid={`select-split-job-${i}`}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(jobs || []).map(j => (
                            <SelectItem key={j.id} value={j.id}>{j.jobNumber} - {j.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeSplit(i)} data-testid={`button-remove-split-${i}`}>
                        <X className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {splits.length > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              Total: {formatCurrency(totalAmount)} of {formatCurrency(invoiceTotal)}
            </span>
            {Math.abs(variance) > 0.02 && invoiceTotal > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-variance-warning">
                Split total must match invoice total
              </span>
            )}
            <Button
              size="sm"
              onClick={() => {
                if (Math.abs(variance) > 0.02 && invoiceTotal > 0) {
                  toast({ title: "Variance too high", description: `Split total ($${totalAmount.toFixed(2)}) does not match invoice total ($${invoiceTotal.toFixed(2)})`, variant: "destructive" });
                  return;
                }
                saveMutation.mutate(splits);
              }}
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

interface PageThumbnail {
  pageNumber: number;
  thumbnail: string;
  width: number;
  height: number;
}

function PdfViewer({ invoice, focusedField }: { invoice: InvoiceDetail; focusedField: string | null }) {
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const doc = invoice.documents?.[0];
  const focusedFieldData = focusedField ? invoice.extractedFields?.find(f => f.fieldKey === focusedField) : null;
  const bbox = focusedFieldData ? focusedFieldData.bboxJson : null;

  const { data: thumbnailData, isLoading, error } = useQuery<{ totalPages: number; pages: PageThumbnail[] }>({
    queryKey: [AP_INVOICE_ROUTES.PAGE_THUMBNAILS(invoice.id)],
    enabled: !!doc,
  });

  const numPages = thumbnailData?.totalPages || 0;
  const currentPageData = thumbnailData?.pages?.find(p => p.pageNumber === currentPage);
  const isImage = doc?.mimeType?.startsWith("image/");

  const handleDownload = useCallback(() => {
    if (!doc) return;
    fetch(AP_INVOICE_ROUTES.DOCUMENT(invoice.id), { credentials: "include" })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName || "invoice";
        a.click();
        URL.revokeObjectURL(url);
      });
  }, [doc, invoice.id]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, [zoom]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !containerRef.current) return;
    const container = containerRef.current;
    const dx = panStart.x - e.clientX;
    const dy = panStart.y - e.clientY;
    container.scrollLeft += dx;
    container.scrollTop += dy;
    setPanStart({ x: e.clientX, y: e.clientY });
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div className="flex flex-col h-full bg-muted/30" data-testid="panel-pdf-viewer">
      <div className="p-2 border-b bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate max-w-[200px]">{doc?.fileName || "Document"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            data-testid="button-zoom-out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon"
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            data-testid="button-zoom-in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon"
            onClick={() => setZoom(1)}
            data-testid="button-zoom-reset">
            <span className="text-[10px]">1:1</span>
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/10 p-4"
        style={{ cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default" }}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        {!doc ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">No document uploaded</p>
            <p className="text-xs text-muted-foreground">Upload a PDF or image to view it here</p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Rendering document...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-destructive">Failed to load document</p>
          </div>
        ) : currentPageData?.thumbnail ? (
          <div className="relative inline-block" style={{ width: `${zoom * 100}%`, maxWidth: "none" }}>
            <img
              src={isImage
                ? `data:${doc.mimeType};base64,${currentPageData.thumbnail}`
                : `data:image/png;base64,${currentPageData.thumbnail}`
              }
              alt={`Page ${currentPage}`}
              className="border shadow-sm bg-white w-full"
              draggable={false}
              data-testid="img-page-preview"
            />
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
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-16 w-16 mb-4" />
            <p className="text-sm">Preview not available</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2 border-t bg-background flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={!doc} onClick={handleDownload} data-testid="button-download-invoice">
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
          <Button variant="outline" size="sm" data-testid="button-document-management">
            <FolderOpen className="h-3 w-3 mr-1" />
            Documents
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {numPages > 1 ? (
            <>
              <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} data-testid="button-prev-page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>Page {currentPage} of {numPages}</span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} data-testid="button-next-page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <span>Page 1 of {numPages || 1}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const CONDITION_FIELD_LABELS: Record<string, string> = {
  COMPANY: "Company",
  AMOUNT: "Invoice Total",
  JOB: "Job",
  SUPPLIER: "Supplier",
  GL_CODE: "GL Code",
};

const CONDITION_OPERATOR_LABELS: Record<string, string> = {
  EQUALS: "equals",
  NOT_EQUALS: "does not equal",
  GREATER_THAN: "greater than",
  LESS_THAN: "less than",
  GREATER_THAN_OR_EQUALS: "greater than or equal to",
  LESS_THAN_OR_EQUALS: "less than or equal to",
};

function formatConditionValue(field: string, values: string[]) {
  if (!values || values.length === 0) return "";
  if (field === "AMOUNT") {
    return `$${parseFloat(values[0] || "0").toLocaleString()}`;
  }
  return values.join(", ");
}

function RuleConditionsDisplay({ conditions, ruleType }: { conditions: ResolvedCondition[] | null; ruleType: string | null }) {
  if (ruleType === "USER_CATCH_ALL") {
    return (
      <div className="rounded-md bg-muted/50 p-3 space-y-1.5" data-testid="rule-conditions-display">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground uppercase">Matching Conditions</span>
        </div>
        <p className="text-sm text-muted-foreground">Catch-all rule: applies to all invoices</p>
      </div>
    );
  }

  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return null;

  return (
    <div className="rounded-md bg-muted/50 p-3 space-y-1.5" data-testid="rule-conditions-display">
      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground uppercase">Matching Conditions</span>
      </div>
      <div className="space-y-1">
        {conditions.map((cond, i) => {
          const displayValues = cond.resolvedValues && cond.resolvedValues.length > 0
            ? cond.resolvedValues
            : cond.values;
          const valueStr = cond.field === "AMOUNT"
            ? formatConditionValue(cond.field, displayValues)
            : displayValues.join(", ");

          return (
            <div key={i} className="flex items-center gap-1.5 text-sm" data-testid={`condition-row-${i}`}>
              {i > 0 && <span className="text-xs font-semibold text-muted-foreground mr-1">AND</span>}
              <span className="font-medium">{CONDITION_FIELD_LABELS[cond.field] || cond.field}</span>
              <span className="text-muted-foreground">{CONDITION_OPERATOR_LABELS[cond.operator] || cond.operator}</span>
              <span className="font-medium">{valueStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApprovalPathSheet({ invoiceId, open, onOpenChange }: { invoiceId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: approvalData } = useQuery<ApprovalPathResponse>({
    queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId)],
    enabled: open,
  });

  const steps = approvalData?.steps || [];
  const totalSteps = approvalData?.totalSteps || 0;
  const completedSteps = approvalData?.completedSteps || 0;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const firstStepWithRule = steps.find(s => s.ruleName);
  const ruleConditions = firstStepWithRule?.ruleConditionsResolved || null;
  const ruleType = firstStepWithRule?.ruleType || null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="sheet-approval-path">
        <SheetHeader>
          <SheetTitle>Approval Path</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-approval-path">No approval path configured</p>
          ) : (
            <>
              {firstStepWithRule?.ruleName && (
                <div className="space-y-2" data-testid="rule-info-section">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Rule: {firstStepWithRule.ruleName}</span>
                    <Badge variant="secondary" className="text-xs" data-testid="badge-rule-type">
                      {ruleType === "USER_CATCH_ALL" ? "Catch All" : ruleType === "AUTO_APPROVE" ? "Auto" : "Conditional"}
                    </Badge>
                  </div>
                  <RuleConditionsDisplay conditions={ruleConditions} ruleType={ruleType} />
                </div>
              )}

              <div className="space-y-2" data-testid="approval-progress">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium" data-testid="text-approval-progress">{completedSteps} of {totalSteps} approved</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                    data-testid="bar-approval-progress"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                {steps.map((step, i) => {
                  const isApproved = step.status === "APPROVED";
                  const isRejected = step.status === "REJECTED";

                  return (
                    <div key={step.id} data-testid={`approval-step-${i}`}>
                      <div className="flex items-start gap-3 py-2">
                        <div className="flex flex-col items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isApproved ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                            isRejected ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                            step.isCurrent ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 ring-2 ring-blue-400" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {isApproved ? <Check className="h-4 w-4" /> :
                             isRejected ? <X className="h-4 w-4" /> :
                             step.stepIndex + 1}
                          </div>
                          {i < steps.length - 1 && (
                            <div className={`w-0.5 h-6 mt-1 ${isApproved ? "bg-green-400" : "bg-muted"}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium" data-testid={`text-approver-name-${i}`}>
                              {step.approverName || step.approverEmail || "Unknown"}
                            </p>
                            {step.isCurrent && (
                              <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 dark:text-blue-400" data-testid={`badge-current-step-${i}`}>
                                Current
                              </Badge>
                            )}
                          </div>
                          {step.decisionAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isApproved ? "Approved" : "Rejected"} {formatDate(step.decisionAt)}
                            </p>
                          )}
                          {step.note && (
                            <p className="text-xs text-muted-foreground mt-0.5 italic">
                              "{step.note}"
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={isApproved ? "default" : isRejected ? "destructive" : "secondary"}
                          className={isApproved ? "bg-green-600 text-white" : ""}
                          data-testid={`badge-step-status-${i}`}
                        >
                          {step.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
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

  const { user } = useAuth();
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

  const { data: approvalData } = useQuery<ApprovalPathResponse>({
    queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId || "")],
    enabled: !!invoiceId && invoice?.status === "PENDING_REVIEW",
  });

  const isCurrentApprover = useMemo(() => {
    if (!approvalData?.steps || !user?.id) return false;
    return approvalData.steps.some(s => s.isCurrent && s.approverUserId === user.id);
  }, [approvalData, user?.id]);

  const currentApproverName = useMemo(() => {
    if (!approvalData?.steps) return null;
    const current = approvalData.steps.find(s => s.isCurrent);
    return current ? (current.approverName || current.approverEmail || "Unknown") : null;
  }, [approvalData]);

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
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId!)] });
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
    mutationFn: async (note: string) => {
      await apiRequest("POST", AP_INVOICE_ROUTES.REJECT(invoiceId!), { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.APPROVAL_PATH(invoiceId!)] });
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

  const exportMyobMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", AP_INVOICE_ROUTES.EXPORT_MYOB(invoiceId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.BY_ID(invoiceId!)] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [AP_INVOICE_ROUTES.COUNTS] });
      toast({ title: "Invoice exported to MYOB" });
    },
    onError: (err: Error) => {
      toast({ title: "MYOB export failed", description: err.message, variant: "destructive" });
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

  const autoExtractTriggered = useRef(false);
  useEffect(() => {
    if (!invoice) return;
    if (autoExtractTriggered.current) return;
    const hasDoc = invoice.documents && invoice.documents.length > 0;
    const hasFields = invoice.extractedFields && invoice.extractedFields.length > 0;
    if (hasDoc && !hasFields && invoice.status === "DRAFT" && !extractMutation.isPending) {
      autoExtractTriggered.current = true;
      extractMutation.mutate();
    }
  }, [invoice]);

  const handleReject = useCallback(() => {
    const note = window.prompt("Please provide a reason for rejection:");
    if (!note || note.trim().length === 0) {
      toast({ title: "Rejection cancelled", description: "A reason is required to reject an invoice", variant: "destructive" });
      return;
    }
    rejectMutation.mutate(note.trim());
  }, [rejectMutation, toast]);

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
              <Button size="sm" onClick={() => { setGoToNext(false); approveMutation.mutate(); }} disabled={approveMutation.isPending || (approvalData && !isCurrentApprover)} data-testid="button-approve-invoice">
                <Check className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { setGoToNext(false); handleReject(); }} disabled={rejectMutation.isPending || (approvalData && !isCurrentApprover)} data-testid="button-reject-invoice">
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
              {approvalData && !isCurrentApprover && currentApproverName && (
                <span className="text-xs text-muted-foreground" data-testid="text-waiting-approver">
                  Waiting for {currentApproverName}
                </span>
              )}
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
                onClick={handleReject}
                disabled={rejectMutation.isPending || (approvalData && !isCurrentApprover)}
                data-testid="button-reject"
              >
                {rejectMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-green-600 text-white"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || (approvalData && !isCurrentApprover)}
                data-testid="button-approve"
              >
                {approveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                Approve
              </Button>
              {invoice.status === "APPROVED" && (
                <Button
                  size="sm"
                  onClick={() => exportMyobMutation.mutate()}
                  disabled={exportMyobMutation.isPending}
                  data-testid="button-export-myob"
                >
                  {exportMyobMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                  Export to MYOB
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ApprovalPathSheet invoiceId={invoiceId} open={approvalSheetOpen} onOpenChange={setApprovalSheetOpen} />
    </div>
  );
}
