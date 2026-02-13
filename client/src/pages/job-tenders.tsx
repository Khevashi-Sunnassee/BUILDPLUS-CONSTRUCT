import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Loader2, DollarSign, ChevronDown, ChevronRight,
  Receipt, ArrowLeft, FileText, Save, Trash2, Target,
  Paperclip, X, Search, AlertTriangle,
} from "lucide-react";
import type { Job, Tender, BudgetLine } from "@shared/schema";

interface SupplierOption {
  id: string;
  name: string;
}

interface TenderWithSubmissions extends Tender {
  createdBy: { id: string; name: string } | null;
  submissions: SubmissionWithSupplier[];
  submissionCount: number;
}

interface SubmissionWithSupplier {
  id: string;
  tenderId: string;
  supplierId: string;
  totalPrice: string | null;
  status: string;
  coverNote: string | null;
  notes: string | null;
  supplier: { id: string; name: string } | null;
  lineItems?: TenderLineItemData[];
}

interface TenderLineItemData {
  id: string;
  costCodeId: string | null;
  childCostCodeId: string | null;
  lineTotal: string;
}

interface BudgetLineWithCodes extends BudgetLine {
  costCode: { id: string; code: string; name: string };
  childCostCode: { id: string; code: string; name: string } | null;
}

interface TenderDocumentData {
  id: string;
  tenderId: string;
  documentId: string | null;
  name: string | null;
  description: string | null;
  document: { id: string; title: string | null; documentNumber: string | null; fileName: string | null } | null;
}

interface TenderSheetData {
  tender: Tender;
  budgetLines: BudgetLineWithCodes[];
  submissions: SubmissionWithSupplier[];
  documents: TenderDocumentData[];
}

interface GroupedLines {
  parentCostCodeId: string;
  parentCode: string;
  parentName: string;
  lines: BudgetLineWithCodes[];
}

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "number" ? value : parseFloat(value || "0");
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
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

function TenderCurrencyInput({ value, onChange, disabled, ...props }: { value: string; onChange: (val: string) => void; disabled?: boolean; [key: string]: any }) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!focused) {
      setDisplayValue(value);
    }
  }, [value, focused]);

  const formatDisplay = (raw: string) => {
    const num = parseFloat(raw);
    if (isNaN(num) || raw === "" || num === 0) return "";
    return new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
      <Input
        {...props}
        className="pl-5 text-right font-mono h-8 w-full"
        type={focused ? "number" : "text"}
        step={focused ? "0.01" : undefined}
        min={focused ? "0" : undefined}
        value={focused ? displayValue : formatDisplay(value)}
        placeholder="0.00"
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
          setFocused(true);
          setDisplayValue(value);
        }}
        onBlur={() => {
          setFocused(false);
          if (displayValue) {
            const num = parseFloat(displayValue);
            if (!isNaN(num)) {
              onChange(num.toString());
            }
          }
        }}
        onChange={(e) => {
          setDisplayValue(e.target.value);
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

function TenderKPICards({ totalEstimated, totalTender, difference }: { totalEstimated: number; totalTender: number; difference: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card data-testid="card-total-estimated">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Est. Budget Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-estimated">
            {formatCurrency(totalEstimated)}
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-total-tender">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tender Total</CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-tender">
            {formatCurrency(totalTender)}
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-difference">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Difference to Budget</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${difference >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-difference">
            {totalTender > 0 ? formatCurrency(difference) : "-"}
          </div>
          {totalTender > 0 && totalEstimated > 0 && (
            <p className={`text-xs mt-1 ${difference >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-difference-pct">
              {difference >= 0 ? "Under" : "Over"} budget by {Math.abs((difference / totalEstimated) * 100).toFixed(1)}%
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TenderAmountsTable({
  groupedBudgetLines, collapsedGroups, toggleGroup,
  getLineAmount, setLineAmount, getGroupTotal,
  totalEstimated, totalTender, difference, isLocked
}: {
  groupedBudgetLines: GroupedLines[];
  collapsedGroups: Set<string>;
  toggleGroup: (id: string) => void;
  getLineAmount: (costCodeId: string, childCostCodeId: string | null) => string;
  setLineAmount: (costCodeId: string, childCostCodeId: string | null, value: string) => void;
  getGroupTotal: (group: GroupedLines) => number;
  totalEstimated: number;
  totalTender: number;
  difference: number;
  isLocked: boolean;
}) {
  return (
    <div className="border rounded-md overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead className="w-24">Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right w-32">Est. Budget</TableHead>
            <TableHead className="text-right w-40">Tender Amount</TableHead>
            <TableHead className="text-right w-32">Diff to Budget</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedBudgetLines.map((group) => {
            const isCollapsed = collapsedGroups.has(group.parentCostCodeId);
            const hasChildren = group.lines.some(l => l.childCostCode);
            const groupTenderTotal = getGroupTotal(group);
            const groupEstTotal = group.lines.reduce((sum, l) => sum + parseFloat(l.estimatedBudget || "0"), 0);
            const groupDiff = groupEstTotal - groupTenderTotal;
            return (
              <Fragment key={group.parentCostCodeId}>
                <TableRow
                  className="bg-muted/40 cursor-pointer"
                  onClick={() => toggleGroup(group.parentCostCodeId)}
                  data-testid={`row-tender-parent-${group.parentCostCodeId}`}
                >
                  <TableCell className="px-2">
                    {hasChildren ? (
                      isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono font-bold">
                    {group.parentCode}
                  </TableCell>
                  <TableCell className="font-bold">
                    {group.parentName}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(groupEstTotal)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(groupTenderTotal)}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${groupDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {groupTenderTotal > 0 ? formatCurrency(groupDiff) : "-"}
                  </TableCell>
                </TableRow>
                {!isCollapsed && group.lines.map((line) => {
                  const amount = getLineAmount(line.costCodeId, line.childCostCodeId);
                  const est = parseFloat(line.estimatedBudget || "0");
                  const tender = parseFloat(amount || "0");
                  const diff = est - tender;
                  return (
                    <TableRow key={line.id} data-testid={`row-tender-line-${line.id}`}>
                      <TableCell />
                      <TableCell className="font-mono text-sm text-muted-foreground pl-6">
                        {line.childCostCode ? line.childCostCode.code : line.costCode.code}
                      </TableCell>
                      <TableCell className="text-sm">
                        {line.childCostCode ? line.childCostCode.name : line.costCode.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {formatCurrency(line.estimatedBudget)}
                      </TableCell>
                      <TableCell className="text-right p-1">
                        <TenderCurrencyInput
                          value={amount}
                          onChange={(val) => setLineAmount(line.costCodeId, line.childCostCodeId, val)}
                          disabled={isLocked}
                          data-testid={`input-tender-amount-${line.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {tender > 0 ? (
                          <span className={`font-mono text-sm ${diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {formatCurrency(diff)}
                          </span>
                        ) : (
                          <span className="font-mono text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            );
          })}
          <TableRow className="bg-muted/50 font-medium" data-testid="row-tender-totals">
            <TableCell />
            <TableCell colSpan={2} className="font-bold">Total</TableCell>
            <TableCell className="text-right font-mono font-bold" data-testid="cell-totals-estimated">
              {formatCurrency(totalEstimated)}
            </TableCell>
            <TableCell className="text-right font-mono font-bold" data-testid="cell-totals-tender">
              {formatCurrency(totalTender)}
            </TableCell>
            <TableCell className="text-right" data-testid="cell-totals-difference">
              {totalTender > 0 ? (
                <span className={`font-mono font-bold ${difference >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(difference)}
                </span>
              ) : <span className="text-muted-foreground">-</span>}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function CreateTenderDialog({
  open, onOpenChange, jobId, jobDocuments,
  onSubmit, isPending
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobDocuments: { id: string; title: string | null; documentNumber: string | null; fileName: string | null; revision: string | null }[];
  onSubmit: (data: { title: string; description?: string; notes?: string; documentIds?: string[] }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [docSearchTerm, setDocSearchTerm] = useState("");

  useEffect(() => {
    if (!open) { setTitle(""); setDescription(""); setNotes(""); setSelectedDocIds(new Set()); setDocSearchTerm(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tender</DialogTitle>
          <DialogDescription>Create a new tender for this job. Select documents from the document register to include as a tender bundle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Concrete Works Package"
              data-testid="input-tender-title"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tender description..."
              className="resize-none"
              data-testid="input-tender-description"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              className="resize-none"
              data-testid="input-tender-notes"
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 mb-2" data-testid="label-tender-documents">
              <Paperclip className="h-4 w-4" />
              Tender Documents ({selectedDocIds.size} selected)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select documents from this job's document register to create a tender bundle.
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search documents..."
                value={docSearchTerm}
                onChange={(e) => setDocSearchTerm(e.target.value)}
                data-testid="input-doc-search"
              />
            </div>
            {jobDocuments.length > 0 ? (
              <Card>
                <ScrollArea className="h-48">
                  <div className="divide-y">
                    {jobDocuments
                      .filter(doc => {
                        if (!docSearchTerm.trim()) return true;
                        const term = docSearchTerm.toLowerCase();
                        return (
                          doc.title?.toLowerCase().includes(term) ||
                          doc.documentNumber?.toLowerCase().includes(term) ||
                          doc.fileName?.toLowerCase().includes(term)
                        );
                      })
                      .map((doc) => (
                        <label
                          key={doc.id}
                          className="flex items-center gap-3 px-3 py-2 hover-elevate cursor-pointer"
                          data-testid={`doc-select-${doc.id}`}
                        >
                          <Checkbox
                            checked={selectedDocIds.has(doc.id)}
                            onCheckedChange={(checked) => {
                              setSelectedDocIds(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(doc.id);
                                else next.delete(doc.id);
                                return next;
                              });
                            }}
                          />
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{doc.title || doc.fileName || "Untitled"}</p>
                            {doc.documentNumber && (
                              <p className="text-xs text-muted-foreground">{doc.documentNumber}{doc.revision ? ` Rev ${doc.revision}` : ""}</p>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                </ScrollArea>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground py-2">No documents found for this job.</p>
            )}
            {selectedDocIds.size > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Array.from(selectedDocIds).map(id => {
                  const doc = jobDocuments.find(d => d.id === id);
                  return doc ? (
                    <Badge key={id} variant="secondary" className="gap-1" data-testid={`badge-selected-doc-${id}`}>
                      <FileText className="h-3 w-3" />
                      {doc.documentNumber || doc.title || doc.fileName || "Untitled"}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create-tender">Cancel</Button>
          <Button
            onClick={() => {
              if (!title.trim() || !jobId) return;
              onSubmit({
                title: title.trim(),
                description: description.trim() || undefined,
                notes: notes.trim() || undefined,
                documentIds: selectedDocIds.size > 0 ? Array.from(selectedDocIds) : undefined,
              });
            }}
            disabled={isPending || !title.trim()}
            data-testid="button-submit-tender"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Tender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSupplierDialog({
  open, onOpenChange, suppliers, onSubmit, isPending
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
  onSubmit: (supplierId: string, coverNote?: string) => void;
  isPending: boolean;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [coverNote, setCoverNote] = useState("");

  useEffect(() => {
    if (!open) { setSupplierId(""); setCoverNote(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Supplier to Tender</DialogTitle>
          <DialogDescription>Select a supplier to enter their tender pricing against the budget cost codes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger data-testid="select-supplier">
                <SelectValue placeholder="Select supplier..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cover Note</Label>
            <Textarea
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder="Supplier cover note or reference..."
              className="resize-none"
              data-testid="input-submission-note"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add-supplier">Cancel</Button>
          <Button
            onClick={() => {
              if (!supplierId) return;
              onSubmit(supplierId, coverNote.trim() || undefined);
            }}
            disabled={isPending || !supplierId}
            data-testid="button-submit-submission"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function JobTendersPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/jobs/:id/tenders");
  const jobId = params?.id;
  const [location, setLocation] = useLocation();
  const previousLocationRef = useRef(location);

  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [createTenderOpen, setCreateTenderOpen] = useState(false);
  const [addSubmissionOpen, setAddSubmissionOpen] = useState(false);
  const [addBundleOpen, setAddBundleOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deleteConfirmTender, setDeleteConfirmTender] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const [selectedBundleId, setSelectedBundleId] = useState("");

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (hasUnsavedChanges && location !== previousLocationRef.current) {
      const userConfirmed = window.confirm("You have unsaved tender amounts. Leaving this page will discard your changes. Continue?");
      if (!userConfirmed) {
        setLocation(previousLocationRef.current);
        return;
      }
      setHasUnsavedChanges(false);
    }
    previousLocationRef.current = location;
  }, [location, hasUnsavedChanges]);

  const { data: job, isLoading: loadingJob, error: jobError } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const { data: jobTenders = [], isLoading: loadingTenders, error: tendersError } = useQuery<TenderWithSubmissions[]>({
    queryKey: ["/api/jobs", jobId, "tenders"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/tenders`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tenders");
      return res.json();
    },
    enabled: !!jobId,
  });

  const { data: suppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ["/api/procurement/suppliers/active"],
  });

  const { data: jobDocumentsResult } = useQuery<{ documents: { id: string; title: string | null; documentNumber: string | null; fileName: string | null; revision: string | null }[] }>({
    queryKey: ["/api/documents", { jobId }],
    queryFn: async () => {
      const res = await fetch(`/api/documents?jobId=${jobId}&limit=200&excludeChat=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!jobId,
  });
  const jobDocuments = jobDocumentsResult?.documents || [];

  const { data: jobBundles = [] } = useQuery<{ id: string; bundleName: string; description: string | null; createdAt: string }[]>({
    queryKey: ["/api/document-bundles", { jobId }],
    queryFn: async () => {
      const res = await fetch(`/api/document-bundles?jobId=${jobId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bundles");
      return res.json();
    },
    enabled: !!jobId,
  });

  const { data: sheetData, isLoading: loadingSheet, error: sheetError } = useQuery<TenderSheetData>({
    queryKey: ["/api/jobs", jobId, "tenders", selectedTenderId, "sheet"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/tenders/${selectedTenderId}/sheet`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tender sheet");
      return res.json();
    },
    enabled: !!jobId && !!selectedTenderId,
  });

  const selectedTender = jobTenders.find(t => t.id === selectedTenderId);
  const selectedSubmission = sheetData?.submissions.find(s => s.id === selectedSubmissionId);

  const isLocked = selectedTender ? ["CLOSED", "CANCELLED", "APPROVED"].includes(selectedTender.status) : false;

  const groupedBudgetLines = useMemo((): GroupedLines[] => {
    if (!sheetData?.budgetLines) return [];
    const groups = new Map<string, GroupedLines>();
    for (const line of sheetData.budgetLines) {
      const pid = line.costCodeId;
      if (!groups.has(pid)) {
        groups.set(pid, {
          parentCostCodeId: pid,
          parentCode: line.costCode.code,
          parentName: line.costCode.name,
          lines: [],
        });
      }
      groups.get(pid)!.lines.push(line);
    }
    return Array.from(groups.values()).sort((a, b) => a.parentCode.localeCompare(b.parentCode));
  }, [sheetData?.budgetLines]);

  function loadLineAmountsForSubmission(submission: SubmissionWithSupplier | undefined) {
    if (!submission?.lineItems) {
      setLineAmounts({});
      return;
    }
    const amounts: Record<string, string> = {};
    for (const item of submission.lineItems) {
      const key = `${item.costCodeId || ""}:${item.childCostCodeId || ""}`;
      amounts[key] = item.lineTotal || "0";
    }
    setLineAmounts(amounts);
    setHasUnsavedChanges(false);
  }

  useEffect(() => {
    if (!hasUnsavedChanges && selectedSubmissionId && sheetData) {
      const sub = sheetData.submissions.find(s => s.id === selectedSubmissionId);
      if (sub) {
        loadLineAmountsForSubmission(sub);
      }
    }
  }, [sheetData, selectedSubmissionId]);

  const [unsavedWarningAction, setUnsavedWarningAction] = useState<(() => void) | null>(null);

  function confirmOrWarn(action: () => void) {
    if (hasUnsavedChanges) {
      setUnsavedWarningAction(() => action);
    } else {
      action();
    }
  }

  function selectTender(tenderId: string) {
    const doSwitch = () => {
      setSelectedTenderId(tenderId);
      setSelectedSubmissionId(null);
      setLineAmounts({});
      setHasUnsavedChanges(false);
    };
    confirmOrWarn(doSwitch);
  }

  function selectSubmission(subId: string) {
    const doSwitch = () => {
      setSelectedSubmissionId(subId);
      const sub = sheetData?.submissions.find(s => s.id === subId);
      loadLineAmountsForSubmission(sub);
    };
    confirmOrWarn(doSwitch);
  }

  function getLineAmount(costCodeId: string, childCostCodeId: string | null): string {
    const key = `${costCodeId}:${childCostCodeId || ""}`;
    return lineAmounts[key] || "";
  }

  function setLineAmount(costCodeId: string, childCostCodeId: string | null, value: string) {
    const key = `${costCodeId}:${childCostCodeId || ""}`;
    setLineAmounts(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  }

  function getGroupTotal(group: GroupedLines): number {
    let total = 0;
    for (const line of group.lines) {
      const key = `${line.costCodeId}:${line.childCostCodeId || ""}`;
      total += parseFloat(lineAmounts[key] || "0") || 0;
    }
    return total;
  }

  function getGrandTotal(): number {
    let total = 0;
    for (const val of Object.values(lineAmounts)) {
      total += parseFloat(val || "0") || 0;
    }
    return total;
  }

  function getTotalEstimated(): number {
    if (!sheetData?.budgetLines) return 0;
    return sheetData.budgetLines.reduce((sum, l) => sum + parseFloat(l.estimatedBudget || "0"), 0);
  }

  const createTenderMutation = useMutation({
    mutationFn: async (data: { jobId: string; title: string; description?: string; notes?: string; documentIds?: string[] }) => {
      return apiRequest("POST", "/api/tenders", data);
    },
    onSuccess: async (res) => {
      const newTender = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders"] });
      toast({ title: "Tender created successfully" });
      setCreateTenderOpen(false);
      setSelectedTenderId(newTender.id);
      setSelectedSubmissionId(null);
      setLineAmounts({});
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addSubmissionMutation = useMutation({
    mutationFn: async (data: { tenderId: string; supplierId: string; coverNote?: string }) => {
      return apiRequest("POST", `/api/tenders/${data.tenderId}/submissions`, data);
    },
    onSuccess: async (res) => {
      const newSub = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders", selectedTenderId, "sheet"] });
      toast({ title: "Supplier added to tender" });
      setAddSubmissionOpen(false);
      setTimeout(() => {
        setSelectedSubmissionId(newSub.id);
        setLineAmounts({});
        setHasUnsavedChanges(false);
      }, 500);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addBundleMutation = useMutation({
    mutationFn: async (data: { bundleId: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/tenders/${selectedTenderId}/documents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders", selectedTenderId, "sheet"] });
      toast({ title: "Document bundle attached to tender" });
      setAddBundleOpen(false);
      setSelectedBundleId("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeDocumentMutation = useMutation({
    mutationFn: async (packageId: string) => {
      return apiRequest("DELETE", `/api/jobs/${jobId}/tenders/${selectedTenderId}/documents/${packageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders", selectedTenderId, "sheet"] });
      toast({ title: "Document removed from tender" });
      setDeleteDocId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveLinesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTenderId || !selectedSubmissionId || !sheetData) return;
      const lines = sheetData.budgetLines.map(bl => ({
        costCodeId: bl.costCodeId,
        childCostCodeId: bl.childCostCodeId || null,
        amount: getLineAmount(bl.costCodeId, bl.childCostCodeId),
      }));
      return apiRequest("POST", `/api/jobs/${jobId}/tenders/${selectedTenderId}/submissions/${selectedSubmissionId}/upsert-lines`, { lines });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders", selectedTenderId, "sheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      toast({ title: "Tender amounts saved" });
      setHasUnsavedChanges(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTenderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tenders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders"] });
      toast({ title: "Tender deleted" });
      setDeleteConfirmTender(null);
      if (selectedTenderId === deleteConfirmTender) {
        setSelectedTenderId(null);
        setSelectedSubmissionId(null);
        setLineAmounts({});
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function toggleGroup(parentId: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  if (!jobId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground" data-testid="text-no-job-id">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500 opacity-60" />
            <p className="text-lg font-medium">Job Not Found</p>
            <p className="text-sm mt-1">No job ID was provided. Please navigate to a job first.</p>
            <Link href="/jobs">
              <Button variant="outline" className="mt-4" data-testid="button-go-to-jobs">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Jobs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingJob || loadingTenders) {
    return (
      <div className="p-6 space-y-4" data-testid="loading-tender-page">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (jobError || tendersError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center" data-testid="text-error-state">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-60" />
            <p className="text-lg font-medium">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(jobError as Error)?.message || (tendersError as Error)?.message || "Failed to load tender data"}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] }); queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders"] }); }} data-testid="button-retry-load">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalEstimated = getTotalEstimated();
  const totalTender = getGrandTotal();
  const difference = totalEstimated - totalTender;

  return (
    <div className="p-6 space-y-6" role="main" aria-label="Job Tenders">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/jobs/${jobId}/budget`}>
            <Button variant="ghost" size="icon" data-testid="button-back-to-budget">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Job Tender Sheets
            </h1>
            <p className="text-sm text-muted-foreground">
              {job?.jobNumber} - {job?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/jobs/${jobId}/budget`}>
            <Button variant="outline" data-testid="button-view-budget">
              <DollarSign className="h-4 w-4 mr-2" />
              View Budget
            </Button>
          </Link>
          <Button onClick={() => setCreateTenderOpen(true)} data-testid="button-new-tender">
            <Plus className="h-4 w-4 mr-2" />
            New Tender
          </Button>
        </div>
      </div>

      <Card data-testid="card-tender-selection">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5" />
            Tender Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tender</Label>
              <Select
                value={selectedTenderId || ""}
                onValueChange={(val) => selectTender(val)}
              >
                <SelectTrigger data-testid="select-tender">
                  <SelectValue placeholder="Select a tender..." />
                </SelectTrigger>
                <SelectContent>
                  {jobTenders.map((tender) => (
                    <SelectItem key={tender.id} value={tender.id}>
                      {tender.tenderNumber} - {tender.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTenderId && sheetData && (
              <div className="space-y-2">
                <Label>Supplier</Label>
                {sheetData.submissions.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">No suppliers yet</p>
                    <Button variant="outline" size="sm" onClick={() => setAddSubmissionOpen(true)} disabled={isLocked} data-testid="button-add-first-supplier">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Supplier
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedSubmissionId || ""}
                      onValueChange={(val) => selectSubmission(val)}
                    >
                      <SelectTrigger data-testid="select-supplier-submission">
                        <SelectValue placeholder="Select supplier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetData.submissions.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.supplier?.name || "Unknown"} ({formatCurrency(sub.totalPrice)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setAddSubmissionOpen(true)} disabled={isLocked} data-testid="button-add-supplier">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {selectedTenderId && selectedTender && (
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 h-9">
                  <TenderStatusBadge status={selectedTender.status} />
                  {isLocked && (
                    <Badge variant="outline" data-testid="badge-locked-status">Editing locked - tender is {selectedTender.status}</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmTender(selectedTenderId)}
                    className="text-destructive ml-auto"
                    disabled={selectedTender.submissionCount > 0}
                    title={selectedTender.submissionCount > 0 ? "Remove all suppliers before deleting" : "Delete this tender"}
                    data-testid="button-delete-selected-tender"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>

          {selectedTenderId && sheetData && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label className="flex items-center gap-1" data-testid="label-tender-documents">
                  <Paperclip className="h-3 w-3" />
                  Tender Document Bundles ({sheetData.documents?.length || 0})
                </Label>
                <Button variant="outline" size="sm" onClick={() => setAddBundleOpen(true)} disabled={isLocked} data-testid="button-add-bundle">
                  <Plus className="h-3 w-3 mr-1" />
                  Attach Bundle
                </Button>
              </div>
              {sheetData.documents && sheetData.documents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sheetData.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-1" data-testid={`badge-bundle-${doc.id}`}>
                      <Badge variant="secondary" className="gap-1">
                        <Paperclip className="h-3 w-3" />
                        {doc.bundle?.bundleName || doc.name || "Untitled Bundle"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDocId(doc.id)}
                        data-testid={`button-remove-bundle-${doc.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-bundles">
                  No document bundles attached to this tender yet.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTenderId && sheetData && selectedSubmissionId && (
        <TenderKPICards totalEstimated={totalEstimated} totalTender={totalTender} difference={difference} />
      )}

      {!selectedTenderId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground" data-testid="text-select-tender">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Select a Tender</p>
            <p className="text-sm mt-1">Choose a tender from the dropdown above, or create a new one to start entering amounts.</p>
          </CardContent>
        </Card>
      ) : loadingSheet ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : sheetError ? (
        <Card>
          <CardContent className="py-12 text-center" data-testid="text-sheet-error">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive opacity-60" />
            <p className="font-medium">Failed to load tender sheet</p>
            <p className="text-sm text-muted-foreground mt-1">{(sheetError as Error)?.message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tenders", selectedTenderId, "sheet"] })} data-testid="button-retry-sheet">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : sheetData && !selectedSubmissionId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground" data-testid="text-select-supplier">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Select a Supplier</p>
            <p className="text-sm mt-1">Choose a supplier from the dropdown above to enter tender amounts against each cost code.</p>
            {sheetData.submissions.length === 0 && (
              <Button variant="outline" className="mt-4" onClick={() => setAddSubmissionOpen(true)} data-testid="button-add-supplier-cta">
                <Plus className="h-4 w-4 mr-2" />
                Add First Supplier
              </Button>
            )}
          </CardContent>
        </Card>
      ) : sheetData && selectedSubmissionId ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Tender Amounts - {selectedSubmission?.supplier?.name}
              <Badge variant="secondary" className="ml-2">
                {selectedTender?.tenderNumber}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-400">
                  Unsaved changes
                </Badge>
              )}
              <Button
                onClick={() => saveLinesMutation.mutate()}
                disabled={saveLinesMutation.isPending || !hasUnsavedChanges || isLocked}
                data-testid="button-save-tender-lines"
              >
                {saveLinesMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sheetData.budgetLines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-budget-lines">
                No budget lines found. Add budget lines in the Budget page first.
              </div>
            ) : (
              <TenderAmountsTable
                groupedBudgetLines={groupedBudgetLines}
                collapsedGroups={collapsedGroups}
                toggleGroup={toggleGroup}
                getLineAmount={getLineAmount}
                setLineAmount={setLineAmount}
                getGroupTotal={getGroupTotal}
                totalEstimated={totalEstimated}
                totalTender={totalTender}
                difference={difference}
                isLocked={isLocked}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <CreateTenderDialog
        open={createTenderOpen}
        onOpenChange={setCreateTenderOpen}
        jobId={jobId}
        jobDocuments={jobDocuments}
        onSubmit={(data) => {
          createTenderMutation.mutate({ jobId, ...data });
        }}
        isPending={createTenderMutation.isPending}
      />

      <AddSupplierDialog
        open={addSubmissionOpen}
        onOpenChange={setAddSubmissionOpen}
        suppliers={suppliers}
        onSubmit={(supplierId, coverNote) => {
          if (!selectedTenderId) return;
          addSubmissionMutation.mutate({
            tenderId: selectedTenderId,
            supplierId,
            coverNote,
          });
        }}
        isPending={addSubmissionMutation.isPending}
      />

      <Dialog open={addBundleOpen} onOpenChange={setAddBundleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Document Bundle</DialogTitle>
            <DialogDescription>Select a document bundle from this job to attach to the tender.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document Bundle</Label>
              {jobBundles.length > 0 ? (
                <Select value={selectedBundleId} onValueChange={setSelectedBundleId}>
                  <SelectTrigger data-testid="select-bundle">
                    <SelectValue placeholder="Select a document bundle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobBundles
                      .filter(b => !sheetData?.documents?.some((d: any) => d.bundleId === b.id))
                      .map((bundle) => (
                        <SelectItem key={bundle.id} value={bundle.id}>
                          {bundle.bundleName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No document bundles found for this job. Create a bundle first when creating a new tender, or from the Documents section.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddBundleOpen(false); setSelectedBundleId(""); }} data-testid="button-cancel-add-bundle">Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedBundleId) return;
                addBundleMutation.mutate({ bundleId: selectedBundleId });
              }}
              disabled={addBundleMutation.isPending || !selectedBundleId}
              data-testid="button-submit-bundle"
            >
              {addBundleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Attach Bundle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmTender} onOpenChange={(open) => !open && setDeleteConfirmTender(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tender?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this tender. Tenders with existing supplier submissions cannot be deleted - remove all suppliers first. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmTender && deleteTenderMutation.mutate(deleteConfirmTender)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-tender"
            >
              {deleteTenderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Bundle?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this document bundle from the tender. The bundle and its documents will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocId && removeDocumentMutation.mutate(deleteDocId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-remove-document"
            >
              {removeDocumentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unsavedWarningAction} onOpenChange={(open) => !open && setUnsavedWarningAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved tender amounts. Switching now will discard your changes. Would you like to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-discard">Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (unsavedWarningAction) {
                  unsavedWarningAction();
                  setUnsavedWarningAction(null);
                }
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-discard"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
