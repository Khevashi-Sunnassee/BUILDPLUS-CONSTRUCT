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
  Receipt, ArrowLeft, FileText, Save, Trash2, Target,
  Paperclip, X,
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

export default function JobTendersPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/jobs/:id/tenders");
  const jobId = params?.id;

  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [createTenderOpen, setCreateTenderOpen] = useState(false);
  const [addSubmissionOpen, setAddSubmissionOpen] = useState(false);
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deleteConfirmTender, setDeleteConfirmTender] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formSubCoverNote, setFormSubCoverNote] = useState("");
  const [formDocName, setFormDocName] = useState("");
  const [formDocDescription, setFormDocDescription] = useState("");
  const [formDocumentId, setFormDocumentId] = useState("");

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

  const { data: allDocuments = [] } = useQuery<{ id: string; title: string | null; documentNumber: string | null; fileName: string | null }[]>({
    queryKey: ["/api/documents"],
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

  function selectTender(tenderId: string) {
    setSelectedTenderId(tenderId);
    setSelectedSubmissionId(null);
    setLineAmounts({});
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

  function getTotalEstimated(): number {
    if (!sheetData?.budgetLines) return 0;
    return sheetData.budgetLines.reduce((sum, l) => sum + parseFloat(l.estimatedBudget || "0"), 0);
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
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders/${selectedTenderId}/sheet`] });
      toast({ title: "Supplier added to tender" });
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

  const addDocumentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; documentId?: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/tenders/${selectedTenderId}/documents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders/${selectedTenderId}/sheet`] });
      toast({ title: "Document added to tender" });
      setAddDocumentOpen(false);
      setFormDocName("");
      setFormDocDescription("");
      setFormDocumentId("");
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
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tenders/${selectedTenderId}/sheet`] });
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

  const totalEstimated = getTotalEstimated();
  const totalTender = getGrandTotal();
  const difference = totalEstimated - totalTender;

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

      <Card>
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
                    <Button variant="outline" size="sm" onClick={() => setAddSubmissionOpen(true)} data-testid="button-add-first-supplier">
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
                    <Button variant="outline" size="icon" onClick={() => setAddSubmissionOpen(true)} data-testid="button-add-supplier">
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
                <Label className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  Tender Documents ({sheetData.documents?.length || 0})
                </Label>
                <Button variant="outline" size="sm" onClick={() => setAddDocumentOpen(true)} data-testid="button-add-document">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Document
                </Button>
              </div>
              {sheetData.documents && sheetData.documents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sheetData.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-1" data-testid={`badge-document-${doc.id}`}>
                      <Badge variant="secondary" className="gap-1">
                        <FileText className="h-3 w-3" />
                        {doc.name || doc.document?.title || "Untitled"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setDeleteDocId(doc.id)}
                        data-testid={`button-remove-doc-${doc.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-documents">
                  No documents attached to this tender yet.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTenderId && sheetData && selectedSubmissionId && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
            </CardContent>
          </Card>
        </div>
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
                        {formatCurrency(totalEstimated)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(totalTender)}
                      </TableCell>
                      <TableCell className="text-right">
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
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={createTenderOpen} onOpenChange={setCreateTenderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tender</DialogTitle>
            <DialogDescription>Create a new tender for this job. Each tender tracks pricing from a single supplier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Concrete Works - Supplier A"
                data-testid="input-tender-title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Tender description..."
                className="resize-none"
                data-testid="input-tender-description"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Internal notes..."
                className="resize-none"
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
            <DialogTitle>Add Supplier to Tender</DialogTitle>
            <DialogDescription>Select a supplier to enter their tender pricing against the budget cost codes.</DialogDescription>
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
                placeholder="Supplier cover note or reference..."
                className="resize-none"
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

      <Dialog open={addDocumentOpen} onOpenChange={setAddDocumentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tender Document</DialogTitle>
            <DialogDescription>Attach a reference document to this tender (e.g. specifications, drawings, scope). You can link an existing document or add a named reference.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {allDocuments.length > 0 && (
              <div>
                <Label>Link Existing Document (optional)</Label>
                <Select value={formDocumentId} onValueChange={(val) => {
                  setFormDocumentId(val);
                  if (val && !formDocName.trim()) {
                    const doc = allDocuments.find(d => d.id === val);
                    if (doc) setFormDocName(doc.title || doc.fileName || "");
                  }
                }}>
                  <SelectTrigger data-testid="select-existing-document">
                    <SelectValue placeholder="Select from existing documents..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allDocuments.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.documentNumber ? `${doc.documentNumber} - ` : ""}{doc.title || doc.fileName || "Untitled"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Document Name</Label>
              <Input
                value={formDocName}
                onChange={(e) => setFormDocName(e.target.value)}
                placeholder="e.g. Structural Drawings Rev C"
                data-testid="input-document-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formDocDescription}
                onChange={(e) => setFormDocDescription(e.target.value)}
                placeholder="Optional description..."
                className="resize-none"
                data-testid="input-document-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDocumentOpen(false); setFormDocumentId(""); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!formDocName.trim()) return;
                addDocumentMutation.mutate({
                  name: formDocName.trim(),
                  description: formDocDescription.trim() || undefined,
                  documentId: formDocumentId || undefined,
                });
              }}
              disabled={addDocumentMutation.isPending || !formDocName.trim()}
              data-testid="button-submit-document"
            >
              {addDocumentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Document
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

      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this document reference from the tender. The original document will not be deleted.
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
    </div>
  );
}
