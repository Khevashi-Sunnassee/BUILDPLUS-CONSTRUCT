import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, FileText, Eye, Pencil, Plus, Loader2, ChevronDown, ChevronRight,
  DollarSign, Users, Mail, Package, Layers, Link2, Unlink, AlertTriangle, Download, Search, X,
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
  job: { id: string; name: string; jobNumber: string } | null;
  createdBy: { id: string; name: string } | null;
  members?: Array<{ id: string; supplierId: string; status: string; supplier: { id: string; name: string; email: string | null } }>;
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
    trade: { id: string; name: string } | null;
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

export default function TenderDetailPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/tenders/:id");
  const tenderId = params?.id || "";
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("submissions");
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
        </TabsList>

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
      </Tabs>

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
    </div>
  );
}