import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
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
import {
  Plus, Loader2, DollarSign, ChevronDown, ChevronRight,
  Receipt, ArrowLeft, FileText, Users, Save, Trash2,
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

interface TenderSheetData {
  tender: Tender;
  budgetLines: BudgetLineWithCodes[];
  submissions: SubmissionWithSupplier[];
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

export default function JobTendersPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/jobs/:id/tenders");
  const jobId = params?.id;

  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [createTenderOpen, setCreateTenderOpen] = useState(false);
  const [addSubmissionOpen, setAddSubmissionOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deleteConfirmTender, setDeleteConfirmTender] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formSubCoverNote, setFormSubCoverNote] = useState("");

  const { data: job, isLoading: loadingJob } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const { data: jobTenders = [], isLoading: loadingTenders } = useQuery<TenderWithSubmissions[]>({
    queryKey: [`/api/jobs/${jobId}/tenders`],
    enabled: !!jobId,
  });

  const { data: suppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: sheetData, isLoading: loadingSheet } = useQuery<TenderSheetData>({
    queryKey: [`/api/jobs/${jobId}/tenders/${selectedTenderId}/sheet`],
    enabled: !!jobId && !!selectedTenderId,
  });

  const selectedTender = jobTenders.find(t => t.id === selectedTenderId);
  const selectedSubmission = sheetData?.submissions.find(s => s.id === selectedSubmissionId);

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

  function selectSubmission(subId: string) {
    setSelectedSubmissionId(subId);
    const sub = sheetData?.submissions.find(s => s.id === subId);
    loadLineAmountsForSubmission(sub);
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

  const createTenderMutation = useMutation({
    mutationFn: async (data: { jobId: string; title: string; description?: string; notes?: string }) => {
      return apiRequest("POST", "/api/tenders", data);
    },
    onSuccess: async (res) => {
      const newTender = await res.json();
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      toast({ title: "Tender created successfully" });
      setCreateTenderOpen(false);
      setFormTitle("");
      setFormDescription("");
      setFormNotes("");
      setSelectedTenderId(newTender.id);
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
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders/${selectedTenderId}/sheet`] });
      toast({ title: "Supplier submission added" });
      setAddSubmissionOpen(false);
      setFormSupplierId("");
      setFormSubCoverNote("");
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
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders/${selectedTenderId}/sheet`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
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

  if (loadingJob || loadingTenders) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/jobs/${jobId}/budget`}>
            <Button variant="ghost" size="icon" data-testid="button-back-to-budget">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Tender Sheets
            </h1>
            <p className="text-sm text-muted-foreground">
              {job?.name} ({job?.jobNumber})
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateTenderOpen(true)} data-testid="button-new-tender">
          <Plus className="h-4 w-4 mr-2" />
          New Tender
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tenders ({jobTenders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {jobTenders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-tenders">
                  No tenders yet. Create your first tender to get started.
                </p>
              ) : (
                jobTenders.map((tender) => (
                  <div
                    key={tender.id}
                    className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedTenderId === tender.id ? "border-primary bg-accent/50" : "hover-elevate"}`}
                    onClick={() => {
                      setSelectedTenderId(tender.id);
                      setSelectedSubmissionId(null);
                      setLineAmounts({});
                      setHasUnsavedChanges(false);
                    }}
                    data-testid={`card-tender-${tender.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{tender.tenderNumber}</span>
                      <TenderStatusBadge status={tender.status} />
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">{tender.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {tender.submissionCount} supplier{tender.submissionCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {selectedTenderId === tender.id && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmTender(tender.id); }}
                          className="text-destructive"
                          data-testid={`button-delete-tender-${tender.id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {!selectedTenderId ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground" data-testid="text-select-tender">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">Select a tender</p>
                <p className="text-sm mt-1">Choose a tender from the list or create a new one to view the tender sheet.</p>
              </CardContent>
            </Card>
          ) : loadingSheet ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : sheetData ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      {selectedTender?.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedTender?.tenderNumber} - Select a supplier submission to enter tender amounts
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => setAddSubmissionOpen(true)} data-testid="button-add-submission">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Supplier
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {sheetData.submissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-submissions">
                      No supplier submissions yet. Add a supplier to start entering tender amounts.
                    </p>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      {sheetData.submissions.map((sub) => (
                        <div
                          key={sub.id}
                          className={`p-3 rounded-md border cursor-pointer transition-colors min-w-[180px] ${selectedSubmissionId === sub.id ? "border-primary bg-accent/50" : "hover-elevate"}`}
                          onClick={() => selectSubmission(sub.id)}
                          data-testid={`card-submission-${sub.id}`}
                        >
                          <p className="text-sm font-medium">{sub.supplier?.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            {formatCurrency(sub.totalPrice)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedSubmissionId && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="h-4 w-4" />
                      Tender Amounts - {selectedSubmission?.supplier?.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {hasUnsavedChanges && (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-400">
                          Unsaved changes
                        </Badge>
                      )}
                      <Button
                        onClick={() => saveLinesMutation.mutate()}
                        disabled={saveLinesMutation.isPending || !hasUnsavedChanges}
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
                                          <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setLineAmount(line.costCodeId, line.childCostCodeId, e.target.value)}
                                            className="text-right font-mono h-8 w-full"
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
                              <TableCell className="text-right font-mono font-bold">
                                {formatCurrency(sheetData.budgetLines.reduce((sum, l) => sum + parseFloat(l.estimatedBudget || "0"), 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">
                                {formatCurrency(getGrandTotal())}
                              </TableCell>
                              <TableCell className="text-right">
                                {(() => {
                                  const totalEst = sheetData.budgetLines.reduce((sum, l) => sum + parseFloat(l.estimatedBudget || "0"), 0);
                                  const totalTender = getGrandTotal();
                                  const diff = totalEst - totalTender;
                                  return totalTender > 0 ? (
                                    <span className={`font-mono font-bold ${diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      {formatCurrency(diff)}
                                    </span>
                                  ) : <span className="text-muted-foreground">-</span>;
                                })()}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </div>

      <Dialog open={createTenderOpen} onOpenChange={setCreateTenderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tender</DialogTitle>
            <DialogDescription>Create a new tender for this job.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Concrete Works"
                data-testid="input-tender-title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Tender description..."
                data-testid="input-tender-description"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Internal notes..."
                data-testid="input-tender-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTenderOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!formTitle.trim() || !jobId) return;
                createTenderMutation.mutate({
                  jobId,
                  title: formTitle.trim(),
                  description: formDescription.trim() || undefined,
                  notes: formNotes.trim() || undefined,
                });
              }}
              disabled={createTenderMutation.isPending || !formTitle.trim()}
              data-testid="button-submit-tender"
            >
              {createTenderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Tender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addSubmissionOpen} onOpenChange={setAddSubmissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Supplier Submission</DialogTitle>
            <DialogDescription>Add a supplier to this tender. You can then enter their pricing against each cost code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Supplier</Label>
              <Select value={formSupplierId} onValueChange={setFormSupplierId}>
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
                value={formSubCoverNote}
                onChange={(e) => setFormSubCoverNote(e.target.value)}
                placeholder="Supplier cover note..."
                data-testid="input-submission-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSubmissionOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!formSupplierId || !selectedTenderId) return;
                addSubmissionMutation.mutate({
                  tenderId: selectedTenderId,
                  supplierId: formSupplierId,
                  coverNote: formSubCoverNote.trim() || undefined,
                });
              }}
              disabled={addSubmissionMutation.isPending || !formSupplierId}
              data-testid="button-submit-submission"
            >
              {addSubmissionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmTender} onOpenChange={(open) => !open && setDeleteConfirmTender(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tender?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this tender and all associated submissions and line items. This action cannot be undone.
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
    </div>
  );
}
