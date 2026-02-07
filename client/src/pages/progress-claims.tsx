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
import { Plus, Eye, Edit, Search, X, Trash2, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PROGRESS_CLAIMS_ROUTES } from "@shared/api-routes";

interface ProgressClaimListItem {
  id: string;
  claimNumber: string;
  status: string;
  claimDate: string;
  claimType: string;
  subtotal: string;
  taxAmount: string;
  total: string;
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
    return {
      total: claims.length,
      draft: claims.filter((c) => c.status === "DRAFT").length,
      submitted: claims.filter((c) => c.status === "SUBMITTED").length,
      approved: claims.filter((c) => c.status === "APPROVED").length,
      rejected: claims.filter((c) => c.status === "REJECTED").length,
      totalValue: claims.filter((c) => c.status === "APPROVED").reduce((sum, c) => sum + parseFloat(c.total || "0"), 0),
    };
  }, [claims]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
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
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Progress Claims</h1>
          <p className="text-sm text-muted-foreground">Manage progress claims across all jobs</p>
        </div>
        <Button onClick={() => navigate("/progress-claims/new")} data-testid="button-new-claim">
          <Plus className="h-4 w-4 mr-2" />
          New Claim
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card data-testid="stat-total">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Claims</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-draft">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Draft</p>
            <p className="text-2xl font-bold">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-submitted">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending Approval</p>
            <p className="text-2xl font-bold">{stats.submitted}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-approved">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-value">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approved Value</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-claims-list">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">All Claims</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search claims..."
                  className="pl-8 w-[200px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
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
                    <TableHead>Created By</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim) => (
                    <TableRow key={claim.id} data-testid={`row-claim-${claim.id}`}>
                      <TableCell className="font-mono font-medium" data-testid={`text-claim-number-${claim.id}`}>
                        {claim.claimNumber}
                      </TableCell>
                      <TableCell data-testid={`text-claim-job-${claim.id}`}>
                        <div>
                          <span className="font-medium">{claim.jobNumber}</span>
                          <span className="text-muted-foreground ml-1 text-sm">{claim.jobName}</span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-claim-creator-${claim.id}`}>
                        {claim.createdByName || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {claim.claimType === "SUMMARY" ? "Summary" : "Detail"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-claim-total-${claim.id}`}>
                        {formatCurrency(claim.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[claim.status] || "secondary"} data-testid={`badge-status-${claim.id}`}>
                          {claim.status}
                        </Badge>
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
