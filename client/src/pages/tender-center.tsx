import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
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
  Plus, Eye, Pencil, Trash2, Loader2, Search, FileText, ChevronDown, ChevronRight,
  DollarSign, Users, Send,
} from "lucide-react";
import type { Tender, TenderSubmission, Job } from "@shared/schema";

type TenderStatus = "DRAFT" | "OPEN" | "UNDER_REVIEW" | "APPROVED" | "CLOSED" | "CANCELLED";
type SubmissionStatus = "SUBMITTED" | "REVISED" | "APPROVED" | "REJECTED";

interface TenderWithDetails extends Tender {
  job: { id: string; name: string; jobNumber: string } | null;
  createdBy: { id: string; name: string } | null;
}

interface SubmissionWithDetails extends TenderSubmission {
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
}

interface SupplierOption {
  id: string;
  name: string;
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

const STATUS_LABELS: Record<TenderStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  SUBMITTED: "Submitted",
  REVISED: "Revised",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function TenderStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "DRAFT":
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>{STATUS_LABELS.DRAFT}</Badge>;
    case "OPEN":
      return <Badge variant="default" data-testid={`badge-status-${status}`}>{STATUS_LABELS.OPEN}</Badge>;
    case "UNDER_REVIEW":
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{STATUS_LABELS.UNDER_REVIEW}</Badge>;
    case "APPROVED":
      return <Badge variant="default" className="bg-green-600 text-white" data-testid={`badge-status-${status}`}>{STATUS_LABELS.APPROVED}</Badge>;
    case "CLOSED":
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>{STATUS_LABELS.CLOSED}</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}>{STATUS_LABELS.CANCELLED}</Badge>;
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

function formatCurrency(value: string | null | undefined): string {
  const num = parseFloat(value || "0");
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TenderCenterPage() {
  const { toast } = useToast();
  const [jobFilter, setJobFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [tenderFormOpen, setTenderFormOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<TenderWithDetails | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TenderWithDetails | null>(null);
  const [detailTender, setDetailTender] = useState<TenderWithDetails | null>(null);

  const [submissionFormOpen, setSubmissionFormOpen] = useState(false);
  const [submissionTenderId, setSubmissionTenderId] = useState<string | null>(null);

  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  const [formJobId, setFormJobId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TenderStatus>("DRAFT");
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [subFormSupplierId, setSubFormSupplierId] = useState("");
  const [subFormCoverNote, setSubFormCoverNote] = useState("");
  const [subFormStatus, setSubFormStatus] = useState<SubmissionStatus>("SUBMITTED");
  const [subFormSubtotal, setSubFormSubtotal] = useState("");
  const [subFormTaxAmount, setSubFormTaxAmount] = useState("");
  const [subFormTotalPrice, setSubFormTotalPrice] = useState("");
  const [subFormNotes, setSubFormNotes] = useState("");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (jobFilter !== "ALL") params.set("jobId", jobFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    return params.toString();
  }, [jobFilter, statusFilter]);

  const tendersUrl = `/api/tenders${queryParams ? `?${queryParams}` : ""}`;

  const { data: tenders = [], isLoading: loadingTenders } = useQuery<TenderWithDetails[]>({
    queryKey: ["/api/tenders", jobFilter, statusFilter],
    queryFn: async () => {
      const res = await fetch(tendersUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tenders");
      return res.json();
    },
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: suppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ["/api/suppliers"],
  });

  const filteredTenders = useMemo(() => {
    if (!searchQuery.trim()) return tenders;
    const q = searchQuery.toLowerCase();
    return tenders.filter((t) =>
      t.tenderNumber.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      (t.job?.name || "").toLowerCase().includes(q) ||
      (t.job?.jobNumber || "").toLowerCase().includes(q) ||
      (t.createdBy?.name || "").toLowerCase().includes(q)
    );
  }, [tenders, searchQuery]);

  const createTenderMutation = useMutation({
    mutationFn: async (data: { jobId: string; title: string; description?: string; status?: string; dueDate?: string; notes?: string }) => {
      return apiRequest("POST", "/api/tenders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      toast({ title: "Tender created successfully" });
      closeTenderForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTenderMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; jobId?: string; title?: string; description?: string; status?: string; dueDate?: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/tenders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      toast({ title: "Tender updated successfully" });
      closeTenderForm();
      if (detailTender && editingTender) {
        setDetailTender(null);
      }
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
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      toast({ title: "Tender deleted" });
      setDeleteConfirm(null);
      if (detailTender) setDetailTender(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createSubmissionMutation = useMutation({
    mutationFn: async ({ tenderId, ...data }: { tenderId: string; supplierId: string; coverNote?: string; status?: string; subtotal?: string; taxAmount?: string; totalPrice?: string; notes?: string }) => {
      return apiRequest("POST", `/api/tenders/${tenderId}/submissions`, data);
    },
    onSuccess: () => {
      if (submissionTenderId) {
        queryClient.invalidateQueries({ queryKey: ["/api/tenders", submissionTenderId, "submissions"] });
      }
      toast({ title: "Submission added successfully" });
      closeSubmissionForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function openCreateTender() {
    setEditingTender(null);
    setFormJobId("");
    setFormTitle("");
    setFormDescription("");
    setFormStatus("DRAFT");
    setFormDueDate("");
    setFormNotes("");
    setTenderFormOpen(true);
  }

  function openEditTender(tender: TenderWithDetails) {
    setEditingTender(tender);
    setFormJobId(tender.jobId);
    setFormTitle(tender.title);
    setFormDescription(tender.description || "");
    setFormStatus(tender.status as TenderStatus);
    setFormDueDate(tender.dueDate ? format(new Date(tender.dueDate), "yyyy-MM-dd") : "");
    setFormNotes(tender.notes || "");
    setTenderFormOpen(true);
  }

  function closeTenderForm() {
    setTenderFormOpen(false);
    setEditingTender(null);
  }

  function handleTenderSubmit() {
    if (!formJobId || !formTitle.trim()) {
      toast({ title: "Job and Title are required", variant: "destructive" });
      return;
    }
    const data = {
      jobId: formJobId,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
      dueDate: formDueDate || undefined,
      notes: formNotes.trim() || undefined,
    };
    if (editingTender) {
      updateTenderMutation.mutate({ id: editingTender.id, ...data });
    } else {
      createTenderMutation.mutate(data);
    }
  }

  function openSubmissionForm(tenderId: string) {
    setSubmissionTenderId(tenderId);
    setSubFormSupplierId("");
    setSubFormCoverNote("");
    setSubFormStatus("SUBMITTED");
    setSubFormSubtotal("");
    setSubFormTaxAmount("");
    setSubFormTotalPrice("");
    setSubFormNotes("");
    setSubmissionFormOpen(true);
  }

  function closeSubmissionForm() {
    setSubmissionFormOpen(false);
    setSubmissionTenderId(null);
  }

  function handleSubmissionSubmit() {
    if (!subFormSupplierId || !submissionTenderId) {
      toast({ title: "Supplier is required", variant: "destructive" });
      return;
    }
    createSubmissionMutation.mutate({
      tenderId: submissionTenderId,
      supplierId: subFormSupplierId,
      coverNote: subFormCoverNote.trim() || undefined,
      status: subFormStatus,
      subtotal: subFormSubtotal || undefined,
      taxAmount: subFormTaxAmount || undefined,
      totalPrice: subFormTotalPrice || undefined,
      notes: subFormNotes.trim() || undefined,
    });
  }

  const isTenderFormPending = createTenderMutation.isPending || updateTenderMutation.isPending;

  if (loadingTenders) {
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
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-tender-center-title">Tender Center</h1>
          <p className="text-sm text-muted-foreground">Manage tenders, submissions and pricing</p>
        </div>
        <Button onClick={openCreateTender} data-testid="button-new-tender">
          <Plus className="h-4 w-4 mr-2" />
          New Tender
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-tenders"
          />
        </div>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-job-filter">
            <SelectValue placeholder="All Jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Jobs</SelectItem>
            {jobs.map((job) => (
              <SelectItem key={job.id} value={job.id} data-testid={`option-job-${job.id}`}>
                {job.jobNumber} - {job.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as TenderStatus[]).map((s) => (
              <SelectItem key={s} value={s} data-testid={`option-status-${s}`}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tenders ({filteredTenders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTenders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-tenders">
              No tenders found. Create your first tender to get started.
            </div>
          ) : (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Tender #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-28">Due Date</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenders.map((tender) => (
                    <TableRow key={tender.id} data-testid={`row-tender-${tender.id}`}>
                      <TableCell className="font-mono font-medium" data-testid={`text-tender-number-${tender.id}`}>
                        {tender.tenderNumber}
                      </TableCell>
                      <TableCell data-testid={`text-tender-title-${tender.id}`}>{tender.title}</TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-tender-job-${tender.id}`}>
                        {tender.job ? `${tender.job.jobNumber} - ${tender.job.name}` : "-"}
                      </TableCell>
                      <TableCell>
                        <TenderStatusBadge status={tender.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-tender-due-${tender.id}`}>
                        {tender.dueDate ? format(new Date(tender.dueDate), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-tender-created-by-${tender.id}`}>
                        {tender.createdBy?.name || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDetailTender(tender)}
                            data-testid={`button-view-tender-${tender.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditTender(tender)}
                            data-testid={`button-edit-tender-${tender.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(tender)}
                            data-testid={`button-delete-tender-${tender.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={tenderFormOpen} onOpenChange={(open) => { if (!open) closeTenderForm(); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-tender-form">
          <DialogHeader>
            <DialogTitle>{editingTender ? "Edit Tender" : "New Tender"}</DialogTitle>
            <DialogDescription>
              {editingTender ? "Update the tender details below." : "Create a new tender for a job."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tender-job">Job</Label>
              <Select value={formJobId} onValueChange={setFormJobId}>
                <SelectTrigger data-testid="select-tender-job">
                  <SelectValue placeholder="Select a job..." />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tender-title">Title</Label>
              <Input
                id="tender-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Tender title..."
                data-testid="input-tender-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tender-description">Description</Label>
              <Textarea
                id="tender-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description..."
                className="resize-none"
                data-testid="input-tender-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tender-status">Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TenderStatus)}>
                  <SelectTrigger data-testid="select-tender-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as TenderStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tender-due-date">Due Date</Label>
                <Input
                  id="tender-due-date"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  data-testid="input-tender-due-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tender-notes">Notes</Label>
              <Textarea
                id="tender-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Notes..."
                className="resize-none"
                data-testid="input-tender-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTenderForm} data-testid="button-cancel-tender">Cancel</Button>
            <Button onClick={handleTenderSubmit} disabled={isTenderFormPending} data-testid="button-save-tender">
              {isTenderFormPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTender ? "Save Changes" : "Create Tender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailTender} onOpenChange={(open) => { if (!open) { setDetailTender(null); setExpandedSubmissionId(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-tender-detail">
          {detailTender && (
            <TenderDetailContent
              tender={detailTender}
              onEdit={() => openEditTender(detailTender)}
              onAddSubmission={() => openSubmissionForm(detailTender.id)}
              expandedSubmissionId={expandedSubmissionId}
              onToggleSubmission={(id) => setExpandedSubmissionId(expandedSubmissionId === id ? null : id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={submissionFormOpen} onOpenChange={(open) => { if (!open) closeSubmissionForm(); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-submission-form">
          <DialogHeader>
            <DialogTitle>Add Submission</DialogTitle>
            <DialogDescription>Record a new supplier submission for this tender.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={subFormSupplierId} onValueChange={setSubFormSupplierId}>
                <SelectTrigger data-testid="select-submission-supplier">
                  <SelectValue placeholder="Select a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cover Note</Label>
              <Textarea
                value={subFormCoverNote}
                onChange={(e) => setSubFormCoverNote(e.target.value)}
                placeholder="Cover note..."
                className="resize-none"
                data-testid="input-submission-cover-note"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={subFormStatus} onValueChange={(v) => setSubFormStatus(v as SubmissionStatus)}>
                <SelectTrigger data-testid="select-submission-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SUBMISSION_STATUS_LABELS) as SubmissionStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{SUBMISSION_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label>Tax Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={subFormTaxAmount}
                  onChange={(e) => setSubFormTaxAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-submission-tax"
                />
              </div>
              <div className="space-y-2">
                <Label>Total Price</Label>
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
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={subFormNotes}
                onChange={(e) => setSubFormNotes(e.target.value)}
                placeholder="Notes..."
                className="resize-none"
                data-testid="input-submission-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSubmissionForm} data-testid="button-cancel-submission">Cancel</Button>
            <Button onClick={handleSubmissionSubmit} disabled={createSubmissionMutation.isPending} data-testid="button-save-submission">
              {createSubmissionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tender</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete tender "{deleteConfirm?.tenderNumber} - {deleteConfirm?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteTenderMutation.mutate(deleteConfirm.id)}
              data-testid="button-confirm-delete"
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

function TenderDetailContent({
  tender,
  onEdit,
  onAddSubmission,
  expandedSubmissionId,
  onToggleSubmission,
}: {
  tender: TenderWithDetails;
  onEdit: () => void;
  onAddSubmission: () => void;
  expandedSubmissionId: string | null;
  onToggleSubmission: (id: string) => void;
}) {
  const { data: submissions = [], isLoading: loadingSubs } = useQuery<SubmissionWithDetails[]>({
    queryKey: ["/api/tenders", tender.id, "submissions"],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tender.id}/submissions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {tender.tenderNumber}
          </DialogTitle>
          <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-tender-detail">
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Title</p>
            <p className="font-medium" data-testid="text-detail-title">{tender.title}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <TenderStatusBadge status={tender.status} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Job</p>
            <p data-testid="text-detail-job">
              {tender.job ? `${tender.job.jobNumber} - ${tender.job.name}` : "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Due Date</p>
            <p data-testid="text-detail-due-date">
              {tender.dueDate ? format(new Date(tender.dueDate), "dd/MM/yyyy") : "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created By</p>
            <p data-testid="text-detail-created-by">{tender.createdBy?.name || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created At</p>
            <p data-testid="text-detail-created-at">
              {format(new Date(tender.createdAt), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
        </div>

        {tender.description && (
          <div>
            <p className="text-sm text-muted-foreground">Description</p>
            <p className="text-sm" data-testid="text-detail-description">{tender.description}</p>
          </div>
        )}

        {tender.notes && (
          <div>
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="text-sm" data-testid="text-detail-notes">{tender.notes}</p>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Submissions ({submissions.length})
            </h3>
            <Button size="sm" onClick={onAddSubmission} data-testid="button-add-submission">
              <Plus className="h-4 w-4 mr-1" />
              Add Submission
            </Button>
          </div>

          {loadingSubs ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-empty-submissions">
              No submissions yet. Add a supplier submission to compare pricing.
            </div>
          ) : (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-28 text-right">Total Price</TableHead>
                    <TableHead className="w-28">Submitted At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => (
                    <SubmissionRow
                      key={sub.id}
                      submission={sub}
                      tenderId={tender.id}
                      isExpanded={expandedSubmissionId === sub.id}
                      onToggle={() => onToggleSubmission(sub.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SubmissionRow({
  submission,
  tenderId,
  isExpanded,
  onToggle,
}: {
  submission: SubmissionWithDetails;
  tenderId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { data: lineItems = [], isLoading: loadingItems } = useQuery<LineItemData[]>({
    queryKey: ["/api/tenders", tenderId, "submissions", submission.id, "line-items"],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}/submissions/${submission.id}/line-items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch line items");
      return res.json();
    },
    enabled: isExpanded,
  });

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
        data-testid={`row-submission-${submission.id}`}
      >
        <TableCell>
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </TableCell>
        <TableCell className="font-medium" data-testid={`text-submission-supplier-${submission.id}`}>
          {submission.supplier?.name || "-"}
        </TableCell>
        <TableCell>
          <SubmissionStatusBadge status={submission.status} />
        </TableCell>
        <TableCell className="text-right font-mono" data-testid={`text-submission-total-${submission.id}`}>
          {formatCurrency(submission.totalPrice)}
        </TableCell>
        <TableCell className="text-muted-foreground" data-testid={`text-submission-date-${submission.id}`}>
          {submission.submittedAt
            ? format(new Date(submission.submittedAt), "dd/MM/yyyy")
            : format(new Date(submission.createdAt), "dd/MM/yyyy")}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={5} className="p-0">
            <div className="p-4 bg-muted/30">
              {submission.coverNote && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Cover Note</p>
                  <p className="text-sm" data-testid={`text-submission-cover-note-${submission.id}`}>{submission.coverNote}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 mb-3">
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
                  <p className="text-sm font-mono font-semibold" data-testid={`text-submission-total-expanded-${submission.id}`}>{formatCurrency(submission.totalPrice)}</p>
                </div>
              </div>
              {submission.notes && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm" data-testid={`text-submission-notes-${submission.id}`}>{submission.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Line Items
                </p>
                {loadingItems ? (
                  <Skeleton className="h-8 w-full" />
                ) : lineItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No line items recorded.</p>
                ) : (
                  <div className="border rounded-md overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs w-16">Qty</TableHead>
                          <TableHead className="text-xs w-16">Unit</TableHead>
                          <TableHead className="text-xs w-24 text-right">Unit Price</TableHead>
                          <TableHead className="text-xs w-24 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item) => (
                          <TableRow key={item.id} data-testid={`row-line-item-${item.id}`}>
                            <TableCell className="text-sm">
                              {item.description}
                              {item.costCode && (
                                <Badge variant="secondary" className="ml-2 text-xs">{item.costCode.code}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{item.quantity}</TableCell>
                            <TableCell className="text-sm">{item.unit}</TableCell>
                            <TableCell className="text-sm text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-sm text-right font-mono">{formatCurrency(item.lineTotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
