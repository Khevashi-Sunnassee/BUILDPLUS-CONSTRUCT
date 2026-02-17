import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Plus, Eye, Pencil, Trash2, Loader2, Search, FileText,
  Users, Send, Mail, Package, X, Info,
} from "lucide-react";
import type { Tender, TenderSubmission, TenderMember, Job } from "@shared/schema";

type TenderStatus = "DRAFT" | "OPEN" | "UNDER_REVIEW" | "APPROVED" | "CLOSED" | "CANCELLED";

interface TenderWithDetails extends Tender {
  job: { id: string; name: string; jobNumber: string } | null;
  createdBy: { id: string; name: string } | null;
  memberCount?: number;
  members?: Array<{ id: string; supplierId: string; status: string; supplier: { id: string; name: string; email: string | null } }>;
}

interface TenderMemberWithSupplier {
  id: string;
  tenderId: string;
  supplierId: string;
  status: string;
  invitedAt: string | null;
  sentAt: string | null;
  supplier: { id: string; name: string; email: string | null };
}

interface BundleOption {
  id: string;
  bundleName: string;
  jobId: string | null;
}

interface SubmissionWithDetails extends TenderSubmission {
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
}

interface SupplierOption {
  id: string;
  name: string;
  availableForTender: boolean;
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

export default function TenderCenterPage() {
  useDocumentTitle("Tender Center");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [jobFilter, setJobFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [tenderFormOpen, setTenderFormOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<TenderWithDetails | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TenderWithDetails | null>(null);

  const [formJobId, setFormJobId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TenderStatus>("DRAFT");
  const [formOpenDate, setFormOpenDate] = useState("");
  const [formClosedDate, setFormClosedDate] = useState("");
  const [formBundleId, setFormBundleId] = useState("");
  const [formMemberIds, setFormMemberIds] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState("");
  const [formActiveTab, setFormActiveTab] = useState("details");

  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [invitationTender, setInvitationTender] = useState<TenderWithDetails | null>(null);
  const [invitationSelectedIds, setInvitationSelectedIds] = useState<string[]>([]);
  const [invitationSubject, setInvitationSubject] = useState("");
  const [invitationMessage, setInvitationMessage] = useState("");


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
    queryKey: ["/api/procurement/suppliers"],
  });

  const { data: bundles = [] } = useQuery<BundleOption[]>({
    queryKey: ["/api/document-bundles"],
  });

  const { data: invitationMembers = [], isLoading: loadingInvitationMembers } = useQuery<TenderMemberWithSupplier[]>({
    queryKey: ["/api/tenders", invitationTender?.id, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${invitationTender!.id}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!invitationTender,
  });

  const { data: invitationPackages = [] } = useQuery<Array<{ id: string; bundleId: string | null; bundle: { id: string; bundleName: string; qrCodeId: string } | null; document: { id: string; title: string } | null }>>({
    queryKey: ["/api/tenders", invitationTender?.id, "packages"],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${invitationTender!.id}/packages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch packages");
      return res.json();
    },
    enabled: !!invitationTender,
  });

  const invitationBundles = useMemo(() => {
    const seen = new Set<string>();
    return invitationPackages
      .filter(p => {
        if (!p.bundle?.id || !p.bundle?.qrCodeId) return false;
        if (seen.has(p.bundle.id)) return false;
        seen.add(p.bundle.id);
        return true;
      })
      .map(p => p.bundle!);
  }, [invitationPackages]);

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
    mutationFn: async (data: Record<string, any>) => {
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
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      return apiRequest("PATCH", `/api/tenders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      toast({ title: "Tender updated successfully" });
      closeTenderForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendInvitationsMutation = useMutation({
    mutationFn: async ({ tenderId, memberIds, subject, message }: { tenderId: string; memberIds: string[]; subject: string; message: string }) => {
      const res = await apiRequest("POST", `/api/tenders/${tenderId}/send-invitations`, { memberIds, subject, message });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      if (invitationTender) {
        queryClient.invalidateQueries({ queryKey: ["/api/tenders", invitationTender.id, "members"] });
      }
      toast({ title: `Invitations sent`, description: `${data.sent} email(s) sent successfully${data.failed > 0 ? `, ${data.failed} failed` : ""}` });
      setInvitationDialogOpen(false);
      setInvitationTender(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send invitations", description: error.message, variant: "destructive" });
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
    setFormOpenDate("");
    setFormClosedDate("");
    setFormBundleId("");
    setFormMemberIds([]);
    setFormNotes("");
    setFormActiveTab("details");
    setTenderFormOpen(true);
  }

  function openEditTender(tender: TenderWithDetails) {
    setEditingTender(tender);
    setFormJobId(tender.jobId);
    setFormTitle(tender.title);
    setFormDescription(tender.description || "");
    setFormStatus(tender.status as TenderStatus);
    setFormOpenDate(tender.openDate ? format(new Date(tender.openDate), "yyyy-MM-dd") : "");
    setFormClosedDate(tender.closedDate ? format(new Date(tender.closedDate), "yyyy-MM-dd") : "");
    setFormBundleId(tender.bundleId || "");
    setFormMemberIds(tender.members?.map(m => m.supplierId) || []);
    setFormNotes(tender.notes || "");
    setFormActiveTab("details");
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
    if (formOpenDate && formClosedDate && new Date(formClosedDate) < new Date(formOpenDate)) {
      toast({ title: "Closed Date cannot be before Open Date", variant: "destructive" });
      return;
    }
    const data: Record<string, any> = {
      jobId: formJobId,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
      openDate: formOpenDate || undefined,
      closedDate: formClosedDate || undefined,
      bundleId: formBundleId || undefined,
      memberIds: formMemberIds,
      notes: formNotes.trim() || undefined,
    };
    if (editingTender) {
      updateTenderMutation.mutate({ id: editingTender.id, ...data });
    } else {
      createTenderMutation.mutate(data);
    }
  }

  function openInvitationDialog(tender: TenderWithDetails) {
    setInvitationTender(tender);
    setInvitationSubject(`Tender Invitation: ${tender.tenderNumber} - ${tender.title}`);
    setInvitationMessage(
      `Dear Supplier,\n\nYou are invited to submit a tender for:\n\nTender: ${tender.tenderNumber}\nTitle: ${tender.title}\n${tender.job ? `Job: ${tender.job.jobNumber} - ${tender.job.name}\n` : ""}${tender.closedDate ? `Closing Date: ${format(new Date(tender.closedDate), "dd/MM/yyyy")}\n` : ""}\nPlease review the tender documents and submit your response.\n\nRegards`
    );
    setInvitationSelectedIds([]);
    setInvitationDialogOpen(true);
  }

  useEffect(() => {
    if (invitationMembers.length > 0 && invitationSelectedIds.length === 0) {
      setInvitationSelectedIds(invitationMembers.filter(m => !!m.supplier.email).map(m => m.id));
    }
  }, [invitationMembers]);

  function handleSendInvitations() {
    if (!invitationTender || invitationSelectedIds.length === 0) {
      toast({ title: "No members selected", variant: "destructive" });
      return;
    }
    if (!invitationSubject.trim()) {
      toast({ title: "Subject is required", variant: "destructive" });
      return;
    }
    sendInvitationsMutation.mutate({
      tenderId: invitationTender.id,
      memberIds: invitationSelectedIds,
      subject: invitationSubject.trim(),
      message: invitationMessage.trim(),
    });
  }

  function toggleMemberSupplier(supplierId: string) {
    setFormMemberIds(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
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
    <div className="p-6 space-y-6" role="main" aria-label="Tender Center">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-tender-center-title">Tender Center</h1>
          <p className="text-sm text-muted-foreground">Manage tenders, submissions and pricing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate("/tender-emails")} data-testid="button-tender-inbox">
            <Mail className="h-4 w-4 mr-2" />
            Email Inbox
          </Button>
          <Button onClick={openCreateTender} data-testid="button-new-tender">
            <Plus className="h-4 w-4 mr-2" />
            New Tender
          </Button>
        </div>
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
                    <TableHead className="w-28">Closed Date</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="w-20">Members</TableHead>
                    <TableHead className="w-36 text-right">Actions</TableHead>
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
                        {tender.closedDate ? format(new Date(tender.closedDate), "dd/MM/yyyy") : tender.dueDate ? format(new Date(tender.dueDate), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-tender-created-by-${tender.id}`}>
                        {tender.createdBy?.name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-tender-members-${tender.id}`}>
                        {tender.memberCount ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openInvitationDialog(tender)}
                            data-testid={`button-mail-tender-${tender.id}`}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => navigate(`/tenders/${tender.id}`)}
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
        <DialogContent className="max-w-2xl" data-testid="dialog-tender-form">
          <DialogHeader>
            <DialogTitle>{editingTender ? "Edit Tender" : "New Tender"}</DialogTitle>
            <DialogDescription>
              {editingTender ? "Update the tender details below." : "Create a new tender for a job."}
            </DialogDescription>
          </DialogHeader>
          <Tabs value={formActiveTab} onValueChange={setFormActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" data-testid="tab-tender-details">Details</TabsTrigger>
              <TabsTrigger value="members" data-testid="tab-tender-members">
                Members {formMemberIds.length > 0 && <Badge variant="secondary" className="ml-1">{formMemberIds.length}</Badge>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4 mt-4">
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
                  <Label htmlFor="tender-open-date">Open Date</Label>
                  <Input
                    id="tender-open-date"
                    type="date"
                    value={formOpenDate}
                    onChange={(e) => setFormOpenDate(e.target.value)}
                    data-testid="input-tender-open-date"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tender-closed-date">Closed Date</Label>
                  <Input
                    id="tender-closed-date"
                    type="date"
                    value={formClosedDate}
                    onChange={(e) => setFormClosedDate(e.target.value)}
                    data-testid="input-tender-closed-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Document Bundle</Label>
                  <Select value={formBundleId || "none"} onValueChange={(v) => setFormBundleId(v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-tender-bundle">
                      <SelectValue placeholder="Select bundle..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No bundle</SelectItem>
                      {bundles.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <div className="flex items-center gap-2">
                            <Package className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{b.bundleName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            </TabsContent>
            <TabsContent value="members" className="mt-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select suppliers to invite as tender members. You can send invitations after saving.
                </p>
                <div className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300" data-testid="text-tender-members-note">
                    Only suppliers marked as "Available for Tender" are shown here. To add more suppliers to this list, enable the "Available for Tender" toggle on the Suppliers page under Admin.
                  </p>
                </div>
                {suppliers.filter(s => s.availableForTender).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-suppliers">
                    No suppliers are marked as available for tender. Enable "Available for Tender" on the Suppliers page to add them here.
                  </div>
                ) : (
                  <div className="border rounded-md max-h-[350px] overflow-y-auto">
                    {suppliers.filter(s => s.availableForTender).map((supplier) => (
                      <div
                        key={supplier.id}
                        className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover-elevate"
                        data-testid={`row-member-supplier-${supplier.id}`}
                      >
                        <Checkbox
                          id={`member-${supplier.id}`}
                          checked={formMemberIds.includes(supplier.id)}
                          onCheckedChange={() => toggleMemberSupplier(supplier.id)}
                          data-testid={`checkbox-member-${supplier.id}`}
                        />
                        <Label htmlFor={`member-${supplier.id}`} className="flex-1 cursor-pointer text-sm">
                          {supplier.name}
                        </Label>
                        {formMemberIds.includes(supplier.id) && (
                          <Badge variant="secondary" className="text-xs">Selected</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {formMemberIds.length} supplier(s) selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFormMemberIds(suppliers.filter(s => s.availableForTender).map(s => s.id))}
                      data-testid="button-select-all-members"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFormMemberIds([])}
                      data-testid="button-clear-all-members"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={closeTenderForm} data-testid="button-cancel-tender">Cancel</Button>
            <Button onClick={handleTenderSubmit} disabled={isTenderFormPending} data-testid="button-save-tender">
              {isTenderFormPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTender ? "Save Changes" : "Create Tender"}
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

      <Dialog open={invitationDialogOpen} onOpenChange={(open) => { if (!open) { setInvitationDialogOpen(false); setInvitationTender(null); } }}>
        <DialogContent className="max-w-[700px] max-h-[85vh] p-0 gap-0 overflow-hidden" data-testid="dialog-send-invitations">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2" data-testid="text-invitation-title">
              <Mail className="h-5 w-5" />
              Send Tender Invitations
            </DialogTitle>
            <DialogDescription>
              {invitationTender && `${invitationTender.tenderNumber} - ${invitationTender.title}`}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 180px)" }}>
            <div className="px-6 py-4 space-y-4">
              {loadingInvitationMembers ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : invitationMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-invitation-members">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No members added to this tender yet.</p>
                  <p className="text-xs mt-1">Edit the tender and add members in the Members tab first.</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium mb-3">Tender invitations will be sent to the following members:</p>
                    <div className="border rounded-md">
                      {invitationMembers.map((member) => {
                        const isSelected = invitationSelectedIds.includes(member.id);
                        const hasEmail = !!member.supplier.email;
                        return (
                          <div
                            key={member.id}
                            className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 ${!hasEmail ? "opacity-50" : ""}`}
                            data-testid={`row-invitation-member-${member.id}`}
                          >
                            <Checkbox
                              id={`inv-member-${member.id}`}
                              checked={isSelected}
                              disabled={!hasEmail}
                              onCheckedChange={(checked) => {
                                setInvitationSelectedIds(prev =>
                                  checked
                                    ? [...prev, member.id]
                                    : prev.filter(id => id !== member.id)
                                );
                              }}
                              data-testid={`checkbox-invitation-${member.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{member.supplier.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {hasEmail ? member.supplier.email : "No email address"}
                              </p>
                            </div>
                            {member.status === "SENT" && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">Previously Sent</Badge>
                            )}
                            {!hasEmail && (
                              <Badge variant="destructive" className="text-xs flex-shrink-0">No Email</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {invitationSelectedIds.length} of {invitationMembers.filter(m => !!m.supplier.email).length} member(s) selected
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInvitationSelectedIds(invitationMembers.filter(m => !!m.supplier.email).map(m => m.id))}
                          data-testid="button-select-all-invitations"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInvitationSelectedIds([])}
                          data-testid="button-clear-invitations"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="inv-subject">Subject</Label>
                      <Input
                        id="inv-subject"
                        value={invitationSubject}
                        onChange={(e) => setInvitationSubject(e.target.value)}
                        data-testid="input-invitation-subject"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-message">Message</Label>
                      <Textarea
                        id="inv-message"
                        value={invitationMessage}
                        onChange={(e) => setInvitationMessage(e.target.value)}
                        rows={8}
                        className="resize-none text-sm"
                        data-testid="input-invitation-message"
                      />
                    </div>
                  </div>

                  {invitationBundles.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-4" data-testid="section-email-bundles">
                      <div className="flex items-start gap-3">
                        <Package className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                            Document Bundle{invitationBundles.length > 1 ? "s" : ""} Included in Email
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                            The following document bundle{invitationBundles.length > 1 ? "s" : ""} will be automatically included in the invitation email with a QR code and direct link for each:
                          </p>
                          <div className="space-y-2">
                            {invitationBundles.map((bundle, idx) => (
                              <div key={bundle.id || idx} className="flex items-center gap-2 text-sm">
                                <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <span className="text-blue-800 dark:text-blue-300 truncate" data-testid={`text-bundle-name-${idx}`}>{bundle.bundleName}</span>
                                <Badge variant="secondary" className="text-xs flex-shrink-0">QR + Link</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {invitationBundles.length === 0 && invitationPackages.length === 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-4" data-testid="section-no-bundles-warning">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">No Document Bundles Attached</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                            This tender has no document bundles. Add a document bundle in the tender's Packages tab to include QR codes and document links in the invitation email.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
            <Button
              variant="outline"
              onClick={() => { setInvitationDialogOpen(false); setInvitationTender(null); }}
              data-testid="button-cancel-invitations"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvitations}
              disabled={sendInvitationsMutation.isPending || invitationSelectedIds.length === 0}
              data-testid="button-send-invitations"
            >
              {sendInvitationsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Invitations
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

