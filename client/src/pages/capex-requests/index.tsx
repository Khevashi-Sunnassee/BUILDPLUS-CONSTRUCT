import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, X, Trash2, Edit, Eye, ArrowUp, ArrowDown, ArrowUpDown, Loader2, ShoppingCart, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Department } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatCurrency } from "@/lib/format";
import { CapexForm } from "./CapexForm";
import { CapexDetailSheet, StatusBadge } from "./CapexDetailSheet";
import type { CapexRequestWithDetails, ReplacementPrefill } from "./types";

type CapexStatusFilter = "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
type CapexSortField = "capexNumber" | "title" | "requestedBy" | "total" | "department" | "status" | "createdAt" | "category" | "job";
type CapexSortDirection = "asc" | "desc";

function formatDateShort(dateString: string | Date | null | undefined): string {
  if (!dateString) return "-";
  try {
    const date = typeof dateString === "string" ? parseISO(dateString) : dateString;
    return format(date, "dd/MM/yyyy");
  } catch {
    return "-";
  }
}

export default function CapexRequestsPage() {
  useDocumentTitle("CAPEX Requests");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CapexStatusFilter>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [selectedCapex, setSelectedCapex] = useState<CapexRequestWithDetails | null>(null);
  const [editCapex, setEditCapex] = useState<CapexRequestWithDetails | null>(null);
  const [replacementPrefill, setReplacementPrefill] = useState<ReplacementPrefill | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCapex, setDeletingCapex] = useState<CapexRequestWithDetails | null>(null);
  const [sortField, setSortField] = useState<CapexSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<CapexSortDirection>("desc");
  const [autoOpenId, setAutoOpenId] = useState<string | null>(() => {
    const params = new URLSearchParams(searchParams);
    return params.get("open");
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get("create") === "replacement" && params.get("assetId")) {
      setReplacementPrefill({
        assetId: params.get("assetId")!,
        assetName: params.get("assetName") || "",
        assetTag: params.get("assetTag") || "",
        assetCategory: params.get("assetCategory") || "",
        assetCurrentValue: params.get("assetCurrentValue") || "",
        assetLocation: params.get("assetLocation") || "",
      });
      setCreateSheetOpen(true);
    }
  }, []);

  const { data: requests = [], isLoading } = useQuery<CapexRequestWithDetails[]>({
    queryKey: ["/api/capex-requests"],
  });

  const { data: departmentsList = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  useEffect(() => {
    if (autoOpenId && requests.length > 0 && !selectedCapex) {
      const match = requests.find((r) => r.id === autoOpenId);
      if (match) {
        setSelectedCapex(match);
        setAutoOpenId(null);
      }
    }
  }, [autoOpenId, requests, selectedCapex]);

  const toggleSort = (field: CapexSortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/capex-requests/${id}/draft`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capex-requests"] });
      toast({ title: "CAPEX request deleted" });
      setDeleteDialogOpen(false);
      setDeletingCapex(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(req => {
      if (statusFilter !== "ALL" && req.status !== statusFilter) return false;
      if (departmentFilter !== "all" && req.departmentId !== departmentFilter) return false;
      if (categoryFilter !== "all" && req.equipmentCategory !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const title = req.equipmentTitle?.toLowerCase() || "";
        const capexNum = (req.capexNumber || "").toLowerCase();
        const dept = (req.department?.name || "").toLowerCase();
        const jobInfo = req.job ? `${req.job.jobNumber} ${req.job.name}`.toLowerCase() : "";
        const requester = (req.requestedBy?.name || req.requestedBy?.email || "").toLowerCase();
        if (!title.includes(query) && !capexNum.includes(query) && !dept.includes(query) && !jobInfo.includes(query) && !requester.includes(query)) return false;
      }
      return true;
    });

    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "capexNumber":
          cmp = (a.capexNumber || "").localeCompare(b.capexNumber || "");
          break;
        case "title":
          cmp = (a.equipmentTitle || "").localeCompare(b.equipmentTitle || "");
          break;
        case "requestedBy":
          cmp = (a.requestedBy?.name || a.requestedBy?.email || "").localeCompare(b.requestedBy?.name || b.requestedBy?.email || "");
          break;
        case "total": {
          const aTotal = parseFloat(String(a.totalEquipmentCost || "0"));
          const bTotal = parseFloat(String(b.totalEquipmentCost || "0"));
          cmp = aTotal - bTotal;
          break;
        }
        case "department":
          cmp = (a.department?.name || "").localeCompare(b.department?.name || "");
          break;
        case "status":
          cmp = (a.status || "").localeCompare(b.status || "");
          break;
        case "createdAt": {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          cmp = aDate - bDate;
          break;
        }
        case "category":
          cmp = (a.equipmentCategory || "").localeCompare(b.equipmentCategory || "");
          break;
        case "job":
          cmp = (a.job?.jobNumber || "").localeCompare(b.job?.jobNumber || "");
          break;
      }
      return cmp * dir;
    });
  }, [requests, statusFilter, departmentFilter, categoryFilter, searchQuery, sortField, sortDirection]);

  const clearFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("all");
    setCategoryFilter("all");
    setStatusFilter("ALL");
  };

  const hasActiveFilters = searchQuery.trim() || departmentFilter !== "all" || categoryFilter !== "all" || statusFilter !== "ALL";

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    requests.forEach(r => { if (r.equipmentCategory) cats.add(r.equipmentCategory); });
    return [...cats].sort();
  }, [requests]);

  return (
    <div className="space-y-6" role="main" aria-label="CAPEX Requests">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle data-testid="text-capex-page-title">CAPEX Requests</CardTitle>
            <CardDescription>Manage capital expenditure requests</CardDescription>
          </div>
          <Button onClick={() => setCreateSheetOpen(true)} data-testid="button-new-capex">
            <Plus className="h-4 w-4 mr-2" />
            New CAPEX Request
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search CAPEX number, title, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-capex"
                aria-label="Search CAPEX requests"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-department-filter">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentsList.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="btn-clear-filters">
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>

          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as CapexStatusFilter)} className="mb-6">
            <TabsList className="flex-wrap" data-testid="tabs-status-filter">
              <TabsTrigger value="ALL" data-testid="tab-all">All ({requests.length})</TabsTrigger>
              <TabsTrigger value="DRAFT" data-testid="tab-draft">Draft</TabsTrigger>
              <TabsTrigger value="SUBMITTED" data-testid="tab-submitted">Under Review</TabsTrigger>
              <TabsTrigger value="APPROVED" data-testid="tab-approved">Approved</TabsTrigger>
              <TabsTrigger value="REJECTED" data-testid="tab-rejected">Rejected</TabsTrigger>
              <TabsTrigger value="WITHDRAWN" data-testid="tab-withdrawn">Withdrawn</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
              {hasActiveFilters ? (
                <>
                  <p>No CAPEX requests match your filters</p>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
                    Clear all filters
                  </Button>
                </>
              ) : (
                "No CAPEX requests found"
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                Showing {filteredRequests.length} of {requests.length} CAPEX requests
              </p>
              <Table data-testid="table-capex-requests">
                <TableHeader>
                  <TableRow>
                    {([
                      { field: "capexNumber" as CapexSortField, label: "CAPEX #", testId: "th-capex-number" },
                      { field: "title" as CapexSortField, label: "Title", testId: "th-title" },
                      { field: "requestedBy" as CapexSortField, label: "Requested By", testId: "th-requested-by" },
                      { field: "total" as CapexSortField, label: "Total Cost", testId: "th-total" },
                      { field: "department" as CapexSortField, label: "Department", testId: "th-department" },
                      { field: "status" as CapexSortField, label: "Status", testId: "th-status" },
                      { field: "job" as CapexSortField, label: "Job", testId: "th-job" },
                      { field: "createdAt" as CapexSortField, label: "Created", testId: "th-created" },
                    ]).map(col => (
                      <TableHead
                        key={col.field}
                        data-testid={col.testId}
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort(col.field)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortField === col.field ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-foreground" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-foreground" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                          )}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead data-testid="th-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req) => (
                    <TableRow key={req.id} data-testid={`row-capex-${req.id}`}>
                      <TableCell data-testid={`cell-capex-number-${req.id}`}>
                        <span className="font-medium">{req.capexNumber || "-"}</span>
                      </TableCell>
                      <TableCell data-testid={`cell-title-${req.id}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="max-w-[200px] truncate">{req.equipmentTitle}</span>
                          {req.equipmentCategory && (
                            <Badge variant="outline" className="text-xs">{req.equipmentCategory}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`cell-requested-by-${req.id}`}>
                        {req.requestedBy?.name || req.requestedBy?.email || "-"}
                      </TableCell>
                      <TableCell data-testid={`cell-total-${req.id}`}>
                        {formatCurrency(req.totalEquipmentCost)}
                      </TableCell>
                      <TableCell data-testid={`cell-department-${req.id}`}>
                        <span className="text-sm text-muted-foreground">{req.department?.name || "-"}</span>
                      </TableCell>
                      <TableCell data-testid={`cell-status-${req.id}`}>
                        <StatusBadge status={req.status} />
                      </TableCell>
                      <TableCell data-testid={`cell-job-${req.id}`}>
                        <span className="text-sm text-muted-foreground">
                          {req.job ? `${req.job.jobNumber}` : "-"}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`cell-created-${req.id}`}>
                        {formatDateShort(req.createdAt)}
                      </TableCell>
                      <TableCell data-testid={`cell-actions-${req.id}`}>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setSelectedCapex(req)}
                                data-testid={`button-view-${req.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View</TooltipContent>
                          </Tooltip>
                          {req.status === "DRAFT" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditCapex(req)}
                                  data-testid={`button-edit-${req.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          )}
                          {req.status === "APPROVED" && !req.purchaseOrderId && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => navigate(`/purchase-orders/new?capexId=${req.id}`)}
                                  data-testid={`button-create-po-${req.id}`}
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Create PO</TooltipContent>
                            </Tooltip>
                          )}
                          {req.purchaseOrder && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => navigate(`/purchase-orders/${req.purchaseOrder!.id}`)}
                                  data-testid={`button-view-po-${req.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View PO {req.purchaseOrder.poNumber}</TooltipContent>
                            </Tooltip>
                          )}
                          {req.status === "DRAFT" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setDeletingCapex(req);
                                    setDeleteDialogOpen(true);
                                  }}
                                  data-testid={`button-delete-${req.id}`}
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createSheetOpen} onOpenChange={(open) => { setCreateSheetOpen(open); if (!open) setReplacementPrefill(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-capex">
          <DialogHeader>
            <DialogTitle>{replacementPrefill ? "New CAPEX Request - Asset Replacement" : "New CAPEX Request"}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <CapexForm
              onSave={() => { setCreateSheetOpen(false); setReplacementPrefill(null); }}
              onClose={() => { setCreateSheetOpen(false); setReplacementPrefill(null); }}
              replacementPrefill={replacementPrefill}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedCapex} onOpenChange={(open) => !open && setSelectedCapex(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="sheet-detail-capex">
          <SheetHeader>
            <SheetTitle>CAPEX Request Details</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedCapex && (
              <CapexDetailSheet capex={selectedCapex} onClose={() => setSelectedCapex(null)} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!editCapex} onOpenChange={(open) => !open && setEditCapex(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-capex">
          <DialogHeader>
            <DialogTitle>Edit CAPEX Request</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {editCapex && (
              <CapexForm capex={editCapex} onSave={() => setEditCapex(null)} onClose={() => setEditCapex(null)} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-capex">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CAPEX Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingCapex?.capexNumber || deletingCapex?.equipmentTitle}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCapex && deleteMutation.mutate(deletingCapex.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
