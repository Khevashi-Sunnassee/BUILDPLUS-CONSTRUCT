import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronLeft,
  Save,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  X,
  Filter,
  Eye,
  EyeOff,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PROGRESS_CLAIMS_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { PANEL_LIFECYCLE_LABELS, PANEL_LIFECYCLE_COLORS } from "@shared/schema";

interface ClaimablePanel {
  id: string;
  panelMark: string;
  level: string | null;
  panelType: string;
  lifecycleStatus: number;
  panelArea: string | null;
  panelVolume: string | null;
  building: string | null;
  description: string | null;
  revenue: string;
  isClaimed: boolean;
  hasReachedPhase: boolean;
  autoPercent: number;
  claimableAtPhase: number;
}

interface ClaimItemState {
  panelId: string;
  panelMark: string;
  level: string | null;
  panelRevenue: number;
  percentComplete: number;
  lineTotal: number;
  lifecycleStatus: number;
  isClaimed: boolean;
}

interface Job {
  id: string;
  jobNumber: string;
  name: string;
}

interface ProgressClaim {
  id: string;
  jobId: string;
  claimNumber: string;
  status: string;
  claimDate: string;
  claimType: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  internalNotes: string | null;
  jobName: string | null;
  jobNumber: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
}

interface ClaimItemFromServer {
  id: string;
  panelId: string;
  panelMark: string;
  level: string | null;
  panelRevenue: string;
  percentComplete: string;
  lineTotal: string;
  lifecycleStatus: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  APPROVED: "outline",
  REJECTED: "destructive",
};

export default function ProgressClaimFormPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [matchNew] = useRoute("/progress-claims/new");
  const [matchEdit, editParams] = useRoute("/progress-claims/:id/edit");
  const [matchView, viewParams] = useRoute("/progress-claims/:id");

  const claimId = editParams?.id || viewParams?.id;
  const isNew = matchNew;
  const isEditing = matchEdit;
  const isViewOnly = matchView && !matchEdit && !matchNew;
  const isDraftMode = isNew || isEditing;

  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [claimItems, setClaimItems] = useState<ClaimItemState[]>([]);
  const [claimType, setClaimType] = useState<string>("DETAIL");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [taxRate, setTaxRate] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClaimed, setShowClaimed] = useState(false);
  const [showNotProduced, setShowNotProduced] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: jobsList = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: existingClaim } = useQuery<ProgressClaim>({
    queryKey: ["/api/progress-claims", claimId],
    enabled: !!claimId,
  });

  const { data: existingItems = [] } = useQuery<ClaimItemFromServer[]>({
    queryKey: ["/api/progress-claims", claimId, "items"],
    enabled: !!claimId,
  });

  useEffect(() => {
    if (existingClaim && !initialized) {
      setSelectedJobId(existingClaim.jobId);
      setClaimType(existingClaim.claimType || "DETAIL");
      setNotes(existingClaim.notes || "");
      setInternalNotes(existingClaim.internalNotes || "");
      setTaxRate(parseFloat(existingClaim.taxRate || "10"));
    }
  }, [existingClaim, initialized]);

  const jobId = selectedJobId || existingClaim?.jobId;

  const { data: claimablePanels = [], isLoading: loadingPanels } = useQuery<ClaimablePanel[]>({
    queryKey: [PROGRESS_CLAIMS_ROUTES.CLAIMABLE_PANELS(jobId!)],
    enabled: !!jobId,
  });

  const { data: jobSummary } = useQuery<{ contractValue: string; claimedToDate: string; remainingValue: string }>({
    queryKey: [PROGRESS_CLAIMS_ROUTES.JOB_SUMMARY(jobId!)],
    enabled: !!jobId,
  });

  useEffect(() => {
    if (claimablePanels.length > 0 && !initialized) {
      if (existingItems.length > 0) {
        const existingMap = new Map(existingItems.map(item => [item.panelId, item]));
        const items: ClaimItemState[] = claimablePanels.map(panel => {
          const existing = existingMap.get(panel.id);
          if (existing) {
            const rev = parseFloat(existing.panelRevenue || "0");
            const pct = parseFloat(existing.percentComplete || "0");
            return {
              panelId: panel.id,
              panelMark: panel.panelMark,
              level: panel.level,
              panelRevenue: rev,
              percentComplete: pct,
              lineTotal: rev * pct / 100,
              lifecycleStatus: panel.lifecycleStatus,
              isClaimed: panel.isClaimed,
            };
          }
          return {
            panelId: panel.id,
            panelMark: panel.panelMark,
            level: panel.level,
            panelRevenue: parseFloat(panel.revenue || "0"),
            percentComplete: panel.autoPercent,
            lineTotal: parseFloat(panel.revenue || "0") * panel.autoPercent / 100,
            lifecycleStatus: panel.lifecycleStatus,
            isClaimed: panel.isClaimed,
          };
        });
        setClaimItems(items);
        setInitialized(true);
      } else if (isNew) {
        const items: ClaimItemState[] = claimablePanels.map(panel => ({
          panelId: panel.id,
          panelMark: panel.panelMark,
          level: panel.level,
          panelRevenue: parseFloat(panel.revenue || "0"),
          percentComplete: panel.autoPercent,
          lineTotal: parseFloat(panel.revenue || "0") * panel.autoPercent / 100,
          lifecycleStatus: panel.lifecycleStatus,
          isClaimed: panel.isClaimed,
        }));
        setClaimItems(items);
        setInitialized(true);
      }
    }
  }, [claimablePanels, existingItems, initialized, isNew]);

  const updatePercent = useCallback((panelId: string, pct: number) => {
    setClaimItems(prev => prev.map(item => {
      if (item.panelId === panelId) {
        const clamped = Math.max(0, Math.min(100, pct));
        return { ...item, percentComplete: clamped, lineTotal: item.panelRevenue * clamped / 100 };
      }
      return item;
    }));
  }, []);

  const claimableAtPhase = claimablePanels[0]?.claimableAtPhase ?? 8;

  const filteredItems = useMemo(() => {
    return claimItems.filter(item => {
      if (!showClaimed && item.isClaimed) return false;
      if (!showNotProduced && item.lifecycleStatus < claimableAtPhase && !item.isClaimed) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.panelMark.toLowerCase().includes(q) || (item.level || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [claimItems, showClaimed, showNotProduced, searchQuery, claimableAtPhase]);

  const levels = useMemo(() => {
    const lvlSet = new Set<string>();
    filteredItems.forEach(item => {
      if (item.level) lvlSet.add(item.level);
    });
    return Array.from(lvlSet).sort();
  }, [filteredItems]);

  const groupedByLevel = useMemo(() => {
    const groups: Record<string, ClaimItemState[]> = {};
    filteredItems.forEach(item => {
      const key = item.level || "Unassigned";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredItems]);

  const activeItems = useMemo(() => {
    return claimItems.filter(item => item.percentComplete > 0 && !item.isClaimed);
  }, [claimItems]);

  const subtotal = useMemo(() => {
    return activeItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [activeItems]);
  const taxAmount = subtotal * taxRate / 100;
  const total = subtotal + taxAmount;

  const summaryByLevel = useMemo(() => {
    const summary: Record<string, { level: string; count: number; total: number }> = {};
    activeItems.forEach(item => {
      const key = item.level || "Unassigned";
      if (!summary[key]) summary[key] = { level: key, count: 0, total: 0 };
      summary[key].count++;
      summary[key].total += item.lineTotal;
    });
    return Object.values(summary).sort((a, b) => a.level.localeCompare(b.level));
  }, [activeItems]);

  const invalidateClaimQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [PROGRESS_CLAIMS_ROUTES.LIST] });
    if (claimId) {
      queryClient.invalidateQueries({ queryKey: ["/api/progress-claims", claimId] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress-claims", claimId, "items"] });
    }
  }, [claimId]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", PROGRESS_CLAIMS_ROUTES.LIST, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateClaimQueries();
      toast({ title: "Progress claim created" });
      navigate(`/progress-claims/${data.id}/edit`);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", PROGRESS_CLAIMS_ROUTES.BY_ID(claimId!), data);
      return res.json();
    },
    onSuccess: () => {
      invalidateClaimQueries();
      toast({ title: "Progress claim updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", PROGRESS_CLAIMS_ROUTES.SUBMIT(claimId!));
    },
    onSuccess: () => {
      invalidateClaimQueries();
      toast({ title: "Claim submitted for approval" });
      navigate("/progress-claims");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", PROGRESS_CLAIMS_ROUTES.APPROVE(claimId!));
    },
    onSuccess: () => {
      invalidateClaimQueries();
      toast({ title: "Claim approved" });
      navigate("/progress-claims");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      await apiRequest("POST", PROGRESS_CLAIMS_ROUTES.REJECT(claimId!), { reason });
    },
    onSuccess: () => {
      invalidateClaimQueries();
      toast({ title: "Claim rejected" });
      navigate("/progress-claims");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = useCallback(() => {
    const itemsPayload = claimItems
      .filter(item => !item.isClaimed)
      .map(item => ({
        panelId: item.panelId,
        panelMark: item.panelMark,
        level: item.level,
        panelRevenue: item.panelRevenue.toFixed(2),
        percentComplete: item.percentComplete.toFixed(2),
      }));

    const payload = {
      jobId: jobId,
      claimType,
      notes,
      internalNotes,
      taxRate: String(taxRate),
      items: itemsPayload,
    };

    if (isNew) {
      createMutation.mutate(payload);
    } else if (claimId) {
      updateMutation.mutate(payload);
    }
  }, [claimItems, jobId, claimType, notes, internalNotes, taxRate, isNew, claimId]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const getLifecycleBadge = (status: number) => {
    const label = PANEL_LIFECYCLE_LABELS[status] || `Status ${status}`;
    const colors = PANEL_LIFECYCLE_COLORS[status];
    if (!colors) return <Badge variant="outline">{label}</Badge>;
    return (
      <Badge className={`${colors.bg} ${colors.text} ${colors.border} border text-xs`}>
        {label}
      </Badge>
    );
  };

  if (!isNew && !existingClaim && claimId) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/progress-claims")} data-testid="button-back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {isNew ? "New Progress Claim" : existingClaim?.claimNumber || "Progress Claim"}
          </h1>
          {existingClaim && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusBadgeVariant[existingClaim.status]} data-testid="badge-claim-status">
                {existingClaim.status}
              </Badge>
              <span className="text-sm text-muted-foreground">{existingClaim.jobNumber} - {existingClaim.jobName}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDraftMode && (
            <Button onClick={handleSave} disabled={isSaving || !jobId} data-testid="button-save">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
          )}
          {isEditing && existingClaim?.status === "DRAFT" && (
            <Button variant="default" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} data-testid="button-submit">
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit for Approval
            </Button>
          )}
          {isViewOnly && existingClaim?.status === "SUBMITTED" && (
            <>
              <Button variant="default" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-approve">
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={rejectMutation.isPending} data-testid="button-reject">
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {existingClaim?.status === "REJECTED" && existingClaim.rejectionReason && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
            <p className="text-sm text-muted-foreground">{existingClaim.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {jobId && jobSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-this-claim">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">This Claim</p>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1" data-testid="text-this-claim-value">{formatCurrency(subtotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">{activeItems.length} panels</p>
            </CardContent>
          </Card>
          <Card data-testid="card-contract-value">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Contract Value</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1" data-testid="text-contract-value">{formatCurrency(jobSummary.contractValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total job value</p>
            </CardContent>
          </Card>
          <Card data-testid="card-claimed-to-date">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Claimed to Date</p>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1" data-testid="text-claimed-to-date">{formatCurrency(jobSummary.claimedToDate)}</p>
              {parseFloat(jobSummary.contractValue) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {((parseFloat(jobSummary.claimedToDate) / parseFloat(jobSummary.contractValue)) * 100).toFixed(1)}% of contract
                </p>
              )}
            </CardContent>
          </Card>
          <Card data-testid="card-remaining-value">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1" data-testid="text-remaining-value">{formatCurrency(jobSummary.remainingValue)}</p>
              {parseFloat(jobSummary.contractValue) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {((parseFloat(jobSummary.remainingValue) / parseFloat(jobSummary.contractValue)) * 100).toFixed(1)}% remaining
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {isNew && (
            <Card data-testid="card-job-selection">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Select Job</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedJobId} onValueChange={(v) => { setSelectedJobId(v); setInitialized(false); setClaimItems([]); }}>
                  <SelectTrigger data-testid="select-job">
                    <SelectValue placeholder="Choose a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobsList.map((job) => (
                      <SelectItem key={job.id} value={job.id} data-testid={`option-job-${job.id}`}>
                        {job.jobNumber} - {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {jobId && (
            <Card data-testid="card-panel-grid">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-lg">Panel Claim Details</CardTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search panels..."
                        className="pl-8 w-[180px]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-panels"
                      />
                      {searchQuery && (
                        <Button variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setSearchQuery("")}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={showNotProduced} onCheckedChange={setShowNotProduced} id="show-not-produced" data-testid="switch-show-not-produced" />
                      <Label htmlFor="show-not-produced" className="text-sm cursor-pointer">Show Not Yet Produced</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={showClaimed} onCheckedChange={setShowClaimed} id="show-claimed" data-testid="switch-show-claimed" />
                      <Label htmlFor="show-claimed" className="text-sm cursor-pointer">Show Claimed</Label>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPanels ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-panels">
                    <p>No panels match the current filters</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedByLevel).sort(([a], [b]) => a.localeCompare(b)).map(([level, items]) => {
                      const levelSubtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
                      const levelClaimableCount = items.filter(i => i.percentComplete > 0 && !i.isClaimed).length;
                      return (
                        <div key={level} data-testid={`group-level-${level}`}>
                          <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm">Level: {level}</h3>
                              <Badge variant="outline" className="text-xs">{items.length} panels</Badge>
                              {levelClaimableCount > 0 && (
                                <Badge variant="secondary" className="text-xs">{levelClaimableCount} claimable</Badge>
                              )}
                            </div>
                            <span className="text-sm font-mono font-medium">{formatCurrency(levelSubtotal)}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[120px]">Panel</TableHead>
                                  <TableHead>Phase</TableHead>
                                  <TableHead className="text-right w-[120px]">Revenue</TableHead>
                                  <TableHead className="text-right w-[100px]">% Claimed</TableHead>
                                  <TableHead className="text-right w-[120px]">Claim Amount</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((item) => (
                                  <TableRow
                                    key={item.panelId}
                                    className={item.isClaimed ? "opacity-50" : ""}
                                    data-testid={`row-panel-${item.panelId}`}
                                  >
                                    <TableCell className="font-mono font-medium" data-testid={`text-panel-mark-${item.panelId}`}>
                                      {item.panelMark}
                                    </TableCell>
                                    <TableCell>
                                      {getLifecycleBadge(item.lifecycleStatus)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {formatCurrency(item.panelRevenue)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {isDraftMode && !item.isClaimed ? (
                                        <Input
                                          type="number"
                                          min={0}
                                          max={100}
                                          step={1}
                                          className="w-[80px] text-right ml-auto"
                                          value={item.percentComplete}
                                          onChange={(e) => updatePercent(item.panelId, parseFloat(e.target.value) || 0)}
                                          data-testid={`input-percent-${item.panelId}`}
                                        />
                                      ) : (
                                        <span className="font-mono" data-testid={`text-percent-${item.panelId}`}>
                                          {item.percentComplete}%
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium" data-testid={`text-line-total-${item.panelId}`}>
                                      {formatCurrency(item.lineTotal)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card data-testid="card-claim-summary">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Claim Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Claim Type</Label>
                <Select value={claimType} onValueChange={setClaimType} disabled={!isDraftMode}>
                  <SelectTrigger data-testid="select-claim-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DETAIL">Detail (Every Panel)</SelectItem>
                    <SelectItem value="SUMMARY">Summary (By Level)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {claimType === "SUMMARY" && summaryByLevel.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">By Level</p>
                  {summaryByLevel.map((row) => (
                    <div key={row.level} className="flex items-center justify-between text-sm" data-testid={`summary-level-${row.level}`}>
                      <span>{row.level} <span className="text-muted-foreground">({row.count} panels)</span></span>
                      <span className="font-mono">{formatCurrency(row.total)}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Active Panels</span>
                  <span className="font-mono" data-testid="text-active-count">{activeItems.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono" data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>GST ({taxRate}%)</span>
                  <span className="font-mono" data-testid="text-tax">{formatCurrency(taxAmount)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span className="font-mono text-lg" data-testid="text-total">{formatCurrency(total)}</span>
                </div>
              </div>

              {isDraftMode && (
                <div className="space-y-2">
                  <Label className="text-sm">Tax Rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    data-testid="input-tax-rate"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-notes">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  disabled={!isDraftMode}
                  data-testid="textarea-notes"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Internal Notes</Label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  disabled={!isDraftMode}
                  data-testid="textarea-internal-notes"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Progress Claim</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this claim. This will be visible to the claim creator.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Reason for Rejection</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="mt-2"
              placeholder="Enter reason for rejection..."
              data-testid="textarea-rejection-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectionReason(""); }} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              onClick={() => {
                rejectMutation.mutate(rejectionReason.trim());
                setRejectDialogOpen(false);
                setRejectionReason("");
              }}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
