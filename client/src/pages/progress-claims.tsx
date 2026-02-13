import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Eye, Edit, Search, X, Trash2, FileText, Shield } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PROGRESS_CLAIMS_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

interface ProgressClaimListItem {
  id: string;
  claimNumber: string;
  status: string;
  claimDate: string;
  claimType: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  retentionRate: string | null;
  retentionAmount: string | null;
  retentionHeldToDate: string | null;
  netClaimAmount: string | null;
  jobId: string;
  jobName: string | null;
  jobNumber: string | null;
  createdById: string;
  createdByName: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  createdAt: string;
  contractValue: string;
  claimedToDate: string;
  remainingValue: string;
}

type StatusFilter = "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  APPROVED: "outline",
  REJECTED: "destructive",
};

function formatCurrency(value: string | number | null | undefined): string {
  const num = parseFloat(String(value || "0"));
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num);
}

export default function ProgressClaimsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [deleteTarget, setDeleteTarget] = useState<ProgressClaimListItem | null>(null);

  const { data: claims = [], isLoading } = useQuery<ProgressClaimListItem[]>({
    queryKey: [PROGRESS_CLAIMS_ROUTES.LIST],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", PROGRESS_CLAIMS_ROUTES.BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROGRESS_CLAIMS_ROUTES.LIST] });
      toast({ title: "Claim deleted" });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      if (statusFilter !== "ALL" && claim.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          claim.claimNumber.toLowerCase().includes(q) ||
          (claim.jobName || "").toLowerCase().includes(q) ||
          (claim.jobNumber || "").toLowerCase().includes(q) ||
          (claim.createdByName || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [claims, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const approvedClaims = claims.filter((c) => c.status === "APPROVED");
    const uniqueJobIds = [...new Set(claims.map(c => c.jobId))];
    let totalContractValue = 0;
    let totalClaimedToDate = 0;
    const seenJobs = new Set<string>();
    for (const claim of claims) {
      if (!seenJobs.has(claim.jobId)) {
        seenJobs.add(claim.jobId);
        totalContractValue += parseFloat(claim.contractValue || "0");
        totalClaimedToDate += parseFloat(claim.claimedToDate || "0");
      }
    }
    return {
      total: claims.length,
      draft: claims.filter((c) => c.status === "DRAFT").length,
      submitted: claims.filter((c) => c.status === "SUBMITTED").length,
      approved: approvedClaims.length,
      rejected: claims.filter((c) => c.status === "REJECTED").length,
      totalApprovedValue: approvedClaims.reduce((sum, c) => sum + parseFloat(c.subtotal || "0"), 0),
      totalContractValue,
      totalClaimedToDate,
      totalRemaining: totalContractValue - totalClaimedToDate,
    };
  }, [claims]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6" role="main" aria-label="Progress Claims" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" role="main" aria-label="Progress Claims">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Progress Claims</h1>
            <PageHelpButton pageHelpKey="page.progress-claims" />
          </div>
          <p className="text-sm text-muted-foreground">Manage progress claims across all jobs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate("/progress-claims/retention-report")} data-testid="button-retention-report">
            <Shield className="h-4 w-4 mr-2" />
            Retention Report
          </Button>
          <Button onClick={() => navigate("/progress-claims/new")} data-testid="button-new-claim">
            <Plus className="h-4 w-4 mr-2" />
            New Claim
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" aria-live="polite">
        <Card data-testid="stat-total">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Claims</p>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.draft} draft, {stats.submitted} pending
            </p>
          </CardContent>
        </Card>
        <Card data-testid="stat-approved">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-contract-value">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Contract Value</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalContractValue)}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-approved-value">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approved Value</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalApprovedValue)}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-claimed-to-date">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Claimed to Date</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalClaimedToDate)}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-remaining">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalRemaining)}</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-claims-list">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">All Claims</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search claims..."
                  className="pl-8 w-[200px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                  aria-label="Search claims"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setSearchQuery("")}
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || statusFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); }}
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredClaims.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-claims">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No progress claims found</p>
              <p className="text-sm">Create your first progress claim to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-claims">
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim #</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">This Claim</TableHead>
                    <TableHead className="text-right">Retention</TableHead>
                    <TableHead className="text-right">Net Claim</TableHead>
                    <TableHead className="text-right">Claimed to Date</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => (
                    <TableRow key={claim.id} data-testid={`row-claim-${claim.id}`}>
                      <TableCell data-testid={`text-claim-number-${claim.id}`}>
                        <span className="font-mono font-medium">{claim.claimNumber}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {claim.claimType === "SUMMARY" ? "Summary" : "Detail"}
                          {claim.createdByName && <span className="ml-1">by {claim.createdByName}</span>}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-claim-job-${claim.id}`}>
                        <div>
                          <span className="font-medium">{claim.jobNumber}</span>
                          <span className="text-muted-foreground ml-1 text-sm">{claim.jobName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[claim.status] || "secondary"} data-testid={`badge-status-${claim.id}`}>
                          {claim.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-claim-total-${claim.id}`}>
                        {formatCurrency(claim.subtotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600 dark:text-orange-400" data-testid={`text-retention-${claim.id}`}>
                        {parseFloat(claim.retentionAmount || "0") > 0
                          ? `-${formatCurrency(claim.retentionAmount)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-net-claim-${claim.id}`}>
                        {claim.netClaimAmount ? formatCurrency(claim.netClaimAmount) : formatCurrency(claim.total)}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-claimed-to-date-${claim.id}`}>
                        {formatCurrency(claim.claimedToDate)}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-remaining-${claim.id}`}>
                        {formatCurrency(claim.remainingValue)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {claim.claimDate ? format(new Date(claim.claimDate), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {claim.status === "DRAFT" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/progress-claims/${claim.id}/edit`)}
                                  data-testid={`button-edit-${claim.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/progress-claims/${claim.id}`)}
                                  data-testid={`button-view-${claim.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View</TooltipContent>
                            </Tooltip>
                          )}
                          {(claim.status === "DRAFT" || claim.status === "REJECTED") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteTarget(claim)}
                                  data-testid={`button-delete-${claim.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          )}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Progress Claim</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete claim {deleteTarget?.claimNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
