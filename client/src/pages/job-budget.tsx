import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
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
  Plus, Pencil, Trash2, Loader2, DollarSign, TrendingUp, BarChart3,
  Receipt, Target, Settings2, ListPlus,
} from "lucide-react";
import type { JobBudget, BudgetLine, CostCode, Job } from "@shared/schema";

interface BudgetLineWithDetails extends BudgetLine {
  costCode: { id: string; code: string; name: string };
  childCostCode: { id: string; code: string; name: string } | null;
  tenderSubmission: { id: string; totalPrice: string | null; status: string } | null;
  contractor: { id: string; name: string } | null;
}

interface BudgetWithLines extends JobBudget {
  lines: BudgetLineWithDetails[];
}

interface BudgetSummary {
  budget: JobBudget | null;
  totalEstimatedBudget: string;
  totalTenderAmounts: string;
  totalVariations: string;
  totalForecastCost: string;
  lineCount: number;
  customerPrice: string;
  profitTargetPercent: string;
  profitMargin: string;
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

export default function JobBudgetPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/jobs/:id/budget");
  const jobId = params?.id;

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BudgetLineWithDetails | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BudgetLineWithDetails | null>(null);
  const [budgetEditOpen, setBudgetEditOpen] = useState(false);

  const [initEstimatedBudget, setInitEstimatedBudget] = useState("");
  const [initProfitTarget, setInitProfitTarget] = useState("");
  const [initCustomerPrice, setInitCustomerPrice] = useState("");
  const [initNotes, setInitNotes] = useState("");

  const [editEstimatedBudget, setEditEstimatedBudget] = useState("");
  const [editProfitTarget, setEditProfitTarget] = useState("");
  const [editCustomerPrice, setEditCustomerPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [lineCostCodeId, setLineCostCodeId] = useState("");
  const [lineChildCostCodeId, setLineChildCostCodeId] = useState("");
  const [lineEstimatedBudget, setLineEstimatedBudget] = useState("");
  const [lineVariations, setLineVariations] = useState("");
  const [lineForecastCost, setLineForecastCost] = useState("");
  const [lineNotes, setLineNotes] = useState("");
  const [lineContractorId, setLineContractorId] = useState("");

  const { data: job, isLoading: loadingJob } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const { data: budgetData, isLoading: loadingBudget } = useQuery<BudgetWithLines | null>({
    queryKey: ["/api/jobs", jobId, "budget"],
    enabled: !!jobId,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<BudgetSummary>({
    queryKey: ["/api/jobs", jobId, "budget", "summary"],
    enabled: !!jobId,
  });

  const { data: budgetLines = [], isLoading: loadingLines } = useQuery<BudgetLineWithDetails[]>({
    queryKey: ["/api/jobs", jobId, "budget", "lines"],
    enabled: !!jobId && !!budgetData,
  });

  const { data: costCodes = [] } = useQuery<CostCode[]>({
    queryKey: ["/api/cost-codes"],
  });

  const { data: suppliers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: costCodesWithChildren = [] } = useQuery<any[]>({
    queryKey: ["/api/cost-codes-with-children"],
  });

  const activeCostCodes = useMemo(() => {
    return costCodes.filter((cc) => cc.isActive);
  }, [costCodes]);

  const filteredChildCodes = useMemo(() => {
    if (!lineCostCodeId) return [];
    const parent = costCodesWithChildren.find((cc: any) => cc.id === lineCostCodeId);
    return (parent?.children || []).filter((child: any) => child.isActive);
  }, [lineCostCodeId, costCodesWithChildren]);

  const initBudgetMutation = useMutation({
    mutationFn: async (data: { estimatedTotalBudget?: string; profitTargetPercent?: string; customerPrice?: string; notes?: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/budget`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      toast({ title: "Budget initialized successfully" });
      setInitEstimatedBudget("");
      setInitProfitTarget("");
      setInitCustomerPrice("");
      setInitNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async (data: { estimatedTotalBudget?: string; profitTargetPercent?: string; customerPrice?: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/jobs/${jobId}/budget`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      toast({ title: "Budget updated successfully" });
      setBudgetEditOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createLineMutation = useMutation({
    mutationFn: async (data: { costCodeId: string; estimatedBudget?: string; variationsAmount?: string; forecastCost?: string; notes?: string; selectedContractorId?: string; childCostCodeId?: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/budget/lines`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      toast({ title: "Budget line added" });
      closeLineDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; costCodeId?: string; estimatedBudget?: string; variationsAmount?: string; forecastCost?: string; notes?: string; selectedContractorId?: string; childCostCodeId?: string }) => {
      return apiRequest("PATCH", `/api/jobs/${jobId}/budget/lines/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      toast({ title: "Budget line updated" });
      closeLineDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/jobs/${jobId}/budget/lines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      toast({ title: "Budget line deleted" });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createFromCostCodesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/budget/lines/create-from-cost-codes`);
    },
    onSuccess: async (res: Response) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      toast({ title: data.message || `Created ${data.created} budget line(s)` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function openCreateLine() {
    setEditingLine(null);
    setLineCostCodeId("");
    setLineEstimatedBudget("");
    setLineVariations("");
    setLineForecastCost("");
    setLineNotes("");
    setLineContractorId("");
    setLineChildCostCodeId("");
    setLineDialogOpen(true);
  }

  function openEditLine(line: BudgetLineWithDetails) {
    setEditingLine(line);
    setLineCostCodeId(line.costCodeId);
    setLineChildCostCodeId(line.childCostCodeId || "");
    setLineEstimatedBudget(line.estimatedBudget || "");
    setLineVariations(line.variationsAmount || "");
    setLineForecastCost(line.forecastCost || "");
    setLineNotes(line.notes || "");
    setLineContractorId(line.selectedContractorId || "");
    setLineDialogOpen(true);
  }

  function closeLineDialog() {
    setLineDialogOpen(false);
    setEditingLine(null);
  }

  function handleLineSave() {
    if (!lineCostCodeId) {
      toast({ title: "Cost code is required", variant: "destructive" });
      return;
    }
    const data = {
      costCodeId: lineCostCodeId,
      estimatedBudget: lineEstimatedBudget || undefined,
      variationsAmount: lineVariations || undefined,
      forecastCost: lineForecastCost || undefined,
      notes: lineNotes.trim() || undefined,
      selectedContractorId: lineContractorId || undefined,
      childCostCodeId: lineChildCostCodeId && lineChildCostCodeId !== "__none__" ? lineChildCostCodeId : undefined,
    };
    if (editingLine) {
      updateLineMutation.mutate({ id: editingLine.id, ...data });
    } else {
      createLineMutation.mutate(data);
    }
  }

  function openBudgetEdit() {
    if (budgetData) {
      setEditEstimatedBudget(budgetData.estimatedTotalBudget || "");
      setEditProfitTarget(budgetData.profitTargetPercent || "");
      setEditCustomerPrice(budgetData.customerPrice || "");
      setEditNotes(budgetData.notes || "");
    }
    setBudgetEditOpen(true);
  }

  function handleBudgetUpdate() {
    updateBudgetMutation.mutate({
      estimatedTotalBudget: editEstimatedBudget || undefined,
      profitTargetPercent: editProfitTarget || undefined,
      customerPrice: editCustomerPrice || undefined,
      notes: editNotes.trim() || undefined,
    });
  }

  function handleInitBudget() {
    initBudgetMutation.mutate({
      estimatedTotalBudget: initEstimatedBudget || undefined,
      profitTargetPercent: initProfitTarget || undefined,
      customerPrice: initCustomerPrice || undefined,
      notes: initNotes.trim() || undefined,
    });
  }

  const isLineFormPending = createLineMutation.isPending || updateLineMutation.isPending;
  const budgetExists = budgetData !== null && budgetData !== undefined;

  if (!jobId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground" data-testid="text-no-job">No job selected.</p>
      </div>
    );
  }

  if (loadingJob || loadingBudget) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Job Budget</h1>
          {job && (
            <p className="text-sm text-muted-foreground" data-testid="text-job-info">
              {job.jobNumber} - {job.name}
            </p>
          )}
        </div>
        {budgetExists && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={openBudgetEdit} data-testid="button-edit-budget">
              <Settings2 className="h-4 w-4 mr-2" />
              Edit Budget
            </Button>
            <Button
              variant="outline"
              onClick={() => createFromCostCodesMutation.mutate()}
              disabled={createFromCostCodesMutation.isPending}
              data-testid="button-create-from-cost-codes"
            >
              {createFromCostCodesMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ListPlus className="h-4 w-4 mr-2" />
              )}
              Create from Cost Codes
            </Button>
            <Button onClick={openCreateLine} data-testid="button-add-line">
              <Plus className="h-4 w-4 mr-2" />
              Add Budget Line
            </Button>
          </div>
        )}
      </div>

      {budgetExists && summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card data-testid="card-total-estimated">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Estimated Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-estimated">
                {formatCurrency(summary.totalEstimatedBudget)}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-tender">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tender Cost</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tender">
                {formatCurrency(summary.totalTenderAmounts)}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-variations">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Variations</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-variations">
                {formatCurrency(summary.totalVariations)}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-forecast">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Forecast</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-forecast">
                {formatCurrency(summary.totalForecastCost)}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-profit-margin">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-profit-margin">
                {parseFloat(summary.profitMargin || "0").toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Target: {parseFloat(summary.profitTargetPercent || "0").toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!budgetExists && (
        <Card data-testid="card-init-budget">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Initialize Budget
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              No budget exists for this job yet. Set up the initial budget parameters below.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="init-budget">Estimated Total Budget</Label>
                <Input
                  id="init-budget"
                  type="number"
                  step="0.01"
                  value={initEstimatedBudget}
                  onChange={(e) => setInitEstimatedBudget(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-init-estimated-budget"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="init-profit">Profit Target %</Label>
                <Input
                  id="init-profit"
                  type="number"
                  step="0.01"
                  value={initProfitTarget}
                  onChange={(e) => setInitProfitTarget(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-init-profit-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="init-price">Customer Price</Label>
                <Input
                  id="init-price"
                  type="number"
                  step="0.01"
                  value={initCustomerPrice}
                  onChange={(e) => setInitCustomerPrice(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-init-customer-price"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="init-notes">Notes</Label>
              <Textarea
                id="init-notes"
                value={initNotes}
                onChange={(e) => setInitNotes(e.target.value)}
                placeholder="Optional notes..."
                className="resize-none"
                data-testid="input-init-notes"
              />
            </div>
            <Button onClick={handleInitBudget} disabled={initBudgetMutation.isPending} data-testid="button-init-budget">
              {initBudgetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Initialize Budget
            </Button>
          </CardContent>
        </Card>
      )}

      {budgetExists && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Budget Lines ({budgetLines.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLines ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : budgetLines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-lines">
                No budget lines yet. Add your first budget line to get started.
              </div>
            ) : (
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Cost Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Estimated Budget</TableHead>
                      <TableHead className="text-right">Tender Amount</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead className="text-right">Variations</TableHead>
                      <TableHead className="text-right">Forecast Cost</TableHead>
                      <TableHead className="hidden lg:table-cell">Notes</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetLines.map((line) => (
                      <TableRow key={line.id} data-testid={`row-budget-line-${line.id}`}>
                        <TableCell className="font-mono font-medium" data-testid={`text-line-code-${line.id}`}>
                          {line.costCode.code}{line.childCostCode ? ` > ${line.childCostCode.code}` : ""}
                        </TableCell>
                        <TableCell data-testid={`text-line-name-${line.id}`}>
                          {line.costCode.name}{line.childCostCode ? ` > ${line.childCostCode.name}` : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono" data-testid={`text-line-estimated-${line.id}`}>
                          {formatCurrency(line.estimatedBudget)}
                        </TableCell>
                        <TableCell className="text-right font-mono" data-testid={`text-line-tender-${line.id}`}>
                          {line.tenderSubmission ? formatCurrency(line.tenderSubmission.totalPrice) : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`text-line-contractor-${line.id}`}>
                          {line.contractor?.name || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono" data-testid={`text-line-variations-${line.id}`}>
                          {formatCurrency(line.variationsAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono" data-testid={`text-line-forecast-${line.id}`}>
                          {formatCurrency(line.forecastCost)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-xs truncate">
                          {line.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditLine(line)}
                              data-testid={`button-edit-line-${line.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteConfirm(line)}
                              data-testid={`button-delete-line-${line.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {budgetLines.length > 0 && summary && (
                      <TableRow className="bg-muted/50 font-medium" data-testid="row-budget-totals">
                        <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-estimated">
                          {formatCurrency(summary.totalEstimatedBudget)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-tender">
                          {formatCurrency(summary.totalTenderAmounts)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-variations">
                          {formatCurrency(summary.totalVariations)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-forecast">
                          {formatCurrency(summary.totalForecastCost)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell" />
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={lineDialogOpen} onOpenChange={(open) => { if (!open) closeLineDialog(); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-budget-line">
          <DialogHeader>
            <DialogTitle>{editingLine ? "Edit Budget Line" : "Add Budget Line"}</DialogTitle>
            <DialogDescription>
              {editingLine ? "Update the budget line details below." : "Add a new budget line for a cost code."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cost Code</Label>
              <Select value={lineCostCodeId} onValueChange={(val) => { setLineCostCodeId(val); setLineChildCostCodeId(""); }}>
                <SelectTrigger data-testid="select-line-cost-code">
                  <SelectValue placeholder="Select a cost code..." />
                </SelectTrigger>
                <SelectContent>
                  {activeCostCodes.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id} data-testid={`option-cost-code-${cc.id}`}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredChildCodes.length > 0 && (
              <div className="space-y-2">
                <Label>Child Code (Optional)</Label>
                <Select value={lineChildCostCodeId} onValueChange={setLineChildCostCodeId}>
                  <SelectTrigger data-testid="select-line-child-cost-code">
                    <SelectValue placeholder="Select a child code..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {filteredChildCodes.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id} data-testid={`option-child-code-${cc.id}`}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="line-estimated">Estimated Budget</Label>
                <Input
                  id="line-estimated"
                  type="number"
                  step="0.01"
                  value={lineEstimatedBudget}
                  onChange={(e) => setLineEstimatedBudget(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-line-estimated-budget"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="line-variations">Variations Amount</Label>
                <Input
                  id="line-variations"
                  type="number"
                  step="0.01"
                  value={lineVariations}
                  onChange={(e) => setLineVariations(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-line-variations"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="line-forecast">Forecast Cost</Label>
              <Input
                id="line-forecast"
                type="number"
                step="0.01"
                value={lineForecastCost}
                onChange={(e) => setLineForecastCost(e.target.value)}
                placeholder="0.00"
                data-testid="input-line-forecast"
              />
            </div>
            <div className="space-y-2">
              <Label>Contractor (optional)</Label>
              <Select value={lineContractorId} onValueChange={setLineContractorId}>
                <SelectTrigger data-testid="select-line-contractor">
                  <SelectValue placeholder="Select contractor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`option-supplier-${s.id}`}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="line-notes">Notes</Label>
              <Textarea
                id="line-notes"
                value={lineNotes}
                onChange={(e) => setLineNotes(e.target.value)}
                placeholder="Optional notes..."
                className="resize-none"
                data-testid="input-line-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeLineDialog} data-testid="button-cancel-line">Cancel</Button>
            <Button onClick={handleLineSave} disabled={isLineFormPending} data-testid="button-save-line">
              {isLineFormPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLine ? "Save Changes" : "Add Line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={budgetEditOpen} onOpenChange={(open) => { if (!open) setBudgetEditOpen(false); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-edit-budget">
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
            <DialogDescription>Update the top-level budget parameters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-budget-total">Estimated Total Budget</Label>
              <Input
                id="edit-budget-total"
                type="number"
                step="0.01"
                value={editEstimatedBudget}
                onChange={(e) => setEditEstimatedBudget(e.target.value)}
                placeholder="0.00"
                data-testid="input-edit-estimated-budget"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-profit-target">Profit Target %</Label>
                <Input
                  id="edit-profit-target"
                  type="number"
                  step="0.01"
                  value={editProfitTarget}
                  onChange={(e) => setEditProfitTarget(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-edit-profit-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-customer-price">Customer Price</Label>
                <Input
                  id="edit-customer-price"
                  type="number"
                  step="0.01"
                  value={editCustomerPrice}
                  onChange={(e) => setEditCustomerPrice(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-edit-customer-price"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-budget-notes">Notes</Label>
              <Textarea
                id="edit-budget-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes..."
                className="resize-none"
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetEditOpen(false)} data-testid="button-cancel-edit-budget">Cancel</Button>
            <Button onClick={handleBudgetUpdate} disabled={updateBudgetMutation.isPending} data-testid="button-save-budget">
              {updateBudgetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget Line</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the budget line for "{deleteConfirm?.costCode?.code} - {deleteConfirm?.costCode?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteLineMutation.mutate(deleteConfirm.id)}
              data-testid="button-confirm-delete"
            >
              {deleteLineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
