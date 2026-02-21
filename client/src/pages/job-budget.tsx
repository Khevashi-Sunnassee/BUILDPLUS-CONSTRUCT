import { useState, useMemo, Fragment, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format";
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
  Plus, Trash2, Loader2, DollarSign, TrendingUp, BarChart3,
  Receipt, Target, Settings2, ListPlus, ChevronDown, ChevronRight, X,
  MessageSquare, Paperclip, ClipboardList, FileText,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { JobBudget, BudgetLine, CostCode, Job } from "@shared/schema";
import { BudgetLineSidebar } from "@/components/budget/BudgetLineSidebar";

interface BudgetLineWithDetails extends BudgetLine {
  costCode: { id: string; code: string; name: string };
  childCostCode: { id: string; code: string; name: string } | null;
  tenderSubmission: { id: string; totalPrice: string | null; status: string } | null;
  contractor: { id: string; name: string } | null;
  updatesCount: number;
  filesCount: number;
  tenderCount: number;
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
  const [sidebarLine, setSidebarLine] = useState<BudgetLineWithDetails | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"updates" | "files" | "items">("updates");

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

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingCells, setEditingCells] = useState<Record<string, { estimatedBudget: string; variationsAmount: string; forecastCost: string; notes: string }>>({});

  const activeCostCodes = useMemo(() => {
    return costCodes.filter((cc) => cc.isActive);
  }, [costCodes]);

  const filteredChildCodes = useMemo(() => {
    if (!lineCostCodeId) return [];
    const parent = costCodesWithChildren.find((cc: any) => cc.id === lineCostCodeId);
    return (parent?.children || []).filter((child: any) => child.isActive);
  }, [lineCostCodeId, costCodesWithChildren]);

  interface GroupedBudget {
    parentCostCodeId: string;
    parentCode: string;
    parentName: string;
    lines: BudgetLineWithDetails[];
    totalEstimated: number;
    totalTenderPrice: number;
    totalVariations: number;
    totalForecast: number;
  }

  const groupedBudgetLines = useMemo((): GroupedBudget[] => {
    const groups = new Map<string, GroupedBudget>();
    for (const line of budgetLines) {
      const pid = line.costCodeId;
      if (!groups.has(pid)) {
        groups.set(pid, {
          parentCostCodeId: pid,
          parentCode: line.costCode.code,
          parentName: line.costCode.name,
          lines: [],
          totalEstimated: 0,
          totalTenderPrice: 0,
          totalVariations: 0,
          totalForecast: 0,
        });
      }
      const group = groups.get(pid)!;
      group.lines.push(line);
      group.totalEstimated += parseFloat(line.estimatedBudget || "0");
      group.totalTenderPrice += parseFloat(line.tenderSubmission?.totalPrice || "0");
      group.totalVariations += parseFloat(line.variationsAmount || "0");
      group.totalForecast += parseFloat(line.forecastCost || "0");
    }
    return Array.from(groups.values()).sort((a, b) => a.parentCode.localeCompare(b.parentCode));
  }, [budgetLines]);

  function toggleGroup(parentId: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  function startInlineEdit(line: BudgetLineWithDetails) {
    setEditingCells(prev => ({
      ...prev,
      [line.id]: {
        estimatedBudget: line.estimatedBudget || "0",
        variationsAmount: line.variationsAmount || "0",
        forecastCost: line.forecastCost || "0",
        notes: line.notes || "",
      },
    }));
  }

  function cancelInlineEdit(lineId: string) {
    setEditingCells(prev => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  function updateInlineField(lineId: string, field: string, value: string) {
    setEditingCells(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }));
  }

  const savingRef = useRef<Set<string>>(new Set());

  function saveInlineEdit(lineId: string) {
    const data = editingCells[lineId];
    if (!data || savingRef.current.has(lineId)) return;
    savingRef.current.add(lineId);
    updateLineMutation.mutate({
      id: lineId,
      estimatedBudget: data.estimatedBudget,
      variationsAmount: data.variationsAmount,
      forecastCost: data.forecastCost,
      notes: data.notes,
    }, {
      onSuccess: () => { savingRef.current.delete(lineId); cancelInlineEdit(lineId); },
      onError: () => { savingRef.current.delete(lineId); },
    });
  }

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
      updateLineMutation.mutate({ id: editingLine.id, ...data }, {
        onSuccess: () => closeLineDialog(),
      });
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

  const sidebarLineData = useMemo(() => {
    if (!sidebarLine) return null;
    return {
      id: sidebarLine.id,
      costCode: sidebarLine.costCode,
      childCostCode: sidebarLine.childCostCode,
      estimateLocked: sidebarLine.estimateLocked ?? false,
      estimatedBudget: sidebarLine.estimatedBudget ?? "0",
    };
  }, [sidebarLine]);

  if (!jobId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground" data-testid="text-no-job">No job selected.</p>
      </div>
    );
  }

  if (loadingJob || loadingBudget) {
    return (
      <div className="p-6 space-y-4" aria-busy="true">
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
    <div className="p-6 space-y-6" role="main" aria-label="Job Budget">
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
            <Link href={`/jobs/${jobId}/tenders`}>
              <Button variant="outline" data-testid="button-tender-sheets">
                <FileText className="h-4 w-4 mr-2" />
                Tender Sheets
              </Button>
            </Link>
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
              <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
              <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
              <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
              <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
              <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
                  min="0"
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
                  min="0"
                  max="100"
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
                  min="0"
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
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-24">Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-14 text-center"></TableHead>
                      <TableHead className="text-right w-28">Est. Budget</TableHead>
                      <TableHead className="text-center w-16">Tenders</TableHead>
                      <TableHead className="text-right w-28">Tender Price</TableHead>
                      <TableHead className="text-right w-28">Diff to Budget</TableHead>
                      <TableHead className="w-32">Contractor</TableHead>
                      <TableHead className="text-right w-28">Variations</TableHead>
                      <TableHead className="text-right w-28">Forecast Cost</TableHead>
                      <TableHead className="text-right w-28">Loss / Gain</TableHead>
                      <TableHead className="w-12 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedBudgetLines.map((group) => {
                      const isCollapsed = collapsedGroups.has(group.parentCostCodeId);
                      const hasChildren = group.lines.some(l => l.childCostCode);
                      return (
                        <Fragment key={group.parentCostCodeId}>{/* Parent group header row */}
                          <TableRow
                            key={`parent-${group.parentCostCodeId}`}
                            className="bg-muted/40 cursor-pointer"
                            onClick={() => toggleGroup(group.parentCostCodeId)}
                            data-testid={`row-parent-${group.parentCostCodeId}`}
                          >
                            <TableCell className="px-2">
                              {hasChildren ? (
                                isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono font-bold" data-testid={`text-parent-code-${group.parentCostCodeId}`}>
                              {group.parentCode}
                            </TableCell>
                            <TableCell className="font-bold" data-testid={`text-parent-name-${group.parentCostCodeId}`}>
                              {group.parentName}
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right font-mono font-semibold" data-testid={`text-parent-estimated-${group.parentCostCodeId}`}>
                              {formatCurrency(group.totalEstimated)}
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right font-mono font-semibold" data-testid={`text-parent-tender-${group.parentCostCodeId}`}>
                              {formatCurrency(group.totalTenderPrice)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold" data-testid={`text-parent-diff-${group.parentCostCodeId}`}>
                              {formatCurrency(group.totalEstimated - group.totalTenderPrice)}
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right font-mono font-semibold" data-testid={`text-parent-variations-${group.parentCostCodeId}`}>
                              {formatCurrency(group.totalVariations)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold" data-testid={`text-parent-forecast-${group.parentCostCodeId}`}>
                              {formatCurrency(group.totalForecast)}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-semibold ${group.totalEstimated - group.totalForecast >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid={`text-parent-lossorgain-${group.parentCostCodeId}`}>
                              {formatCurrency(group.totalEstimated - group.totalForecast)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                          {/* Child rows */}
                          {!isCollapsed && group.lines.map((line) => {
                            const isEditing = !!editingCells[line.id];
                            const editData = editingCells[line.id];
                            return (
                              <TableRow key={line.id} data-testid={`row-budget-line-${line.id}`}>
                                <TableCell />
                                <TableCell className="font-mono text-sm text-muted-foreground pl-6" data-testid={`text-line-code-${line.id}`}>
                                  {line.childCostCode ? line.childCostCode.code : line.costCode.code}
                                </TableCell>
                                <TableCell className="text-sm" data-testid={`text-line-name-${line.id}`}>
                                  {line.childCostCode ? line.childCostCode.name : line.costCode.name}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="relative">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => { e.stopPropagation(); setSidebarLine(line); setSidebarTab("updates"); }}
                                            data-testid={`btn-line-updates-${line.id}`}
                                          >
                                            <MessageSquare className="h-4 w-4" />
                                          </Button>
                                          {line.updatesCount > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center pointer-events-none">
                                              {line.updatesCount}
                                            </span>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>Updates ({line.updatesCount})</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="relative">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => { e.stopPropagation(); setSidebarLine(line); setSidebarTab("files"); }}
                                            data-testid={`btn-line-files-${line.id}`}
                                          >
                                            <Paperclip className="h-4 w-4" />
                                          </Button>
                                          {line.filesCount > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center pointer-events-none">
                                              {line.filesCount}
                                            </span>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>Files ({line.filesCount})</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={(e) => { e.stopPropagation(); setSidebarLine(line); setSidebarTab("items"); }}
                                          data-testid={`btn-line-items-${line.id}`}
                                        >
                                          <ClipboardList className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Line Items</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                                {/* Estimated Budget - editable */}
                                <TableCell className="text-right p-1">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editData.estimatedBudget}
                                      onChange={(e) => updateInlineField(line.id, "estimatedBudget", e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(line.id); if (e.key === "Escape") cancelInlineEdit(line.id); }}
                                      onBlur={() => saveInlineEdit(line.id)}
                                      className="text-right font-mono h-8 w-full"
                                      autoFocus
                                      data-testid={`input-inline-estimated-${line.id}`}
                                    />
                                  ) : (
                                    <span className="font-mono text-sm cursor-pointer" onClick={(e) => { e.stopPropagation(); startInlineEdit(line); }} data-testid={`text-line-estimated-${line.id}`}>
                                      {formatCurrency(line.estimatedBudget)}
                                    </span>
                                  )}
                                </TableCell>
                                {/* No. Tenders */}
                                <TableCell className="text-center" data-testid={`text-line-tenders-${line.id}`}>
                                  <span className="text-sm">{line.tenderCount || 0}</span>
                                </TableCell>
                                {/* Selected Tender Price */}
                                <TableCell className="text-right" data-testid={`text-line-tender-price-${line.id}`}>
                                  <span className="font-mono text-sm">
                                    {line.tenderSubmission ? formatCurrency(line.tenderSubmission.totalPrice) : "-"}
                                  </span>
                                </TableCell>
                                {/* Difference to Budget */}
                                <TableCell className="text-right" data-testid={`text-line-diff-${line.id}`}>
                                  {(() => {
                                    const est = parseFloat(line.estimatedBudget || "0");
                                    const tender = parseFloat(line.tenderSubmission?.totalPrice || "0");
                                    const diff = est - tender;
                                    if (!line.tenderSubmission) return <span className="font-mono text-sm text-muted-foreground">-</span>;
                                    return (
                                      <span className={`font-mono text-sm ${diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                        {formatCurrency(diff)}
                                      </span>
                                    );
                                  })()}
                                </TableCell>
                                {/* Selected Contractor */}
                                <TableCell data-testid={`text-line-contractor-${line.id}`}>
                                  <span className="text-sm truncate block max-w-[120px]">
                                    {line.contractor?.name || "-"}
                                  </span>
                                </TableCell>
                                {/* Variations - editable */}
                                <TableCell className="text-right p-1">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editData.variationsAmount}
                                      onChange={(e) => updateInlineField(line.id, "variationsAmount", e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(line.id); if (e.key === "Escape") cancelInlineEdit(line.id); }}
                                      onBlur={() => saveInlineEdit(line.id)}
                                      className="text-right font-mono h-8 w-full"
                                      data-testid={`input-inline-variations-${line.id}`}

                                    />
                                  ) : (
                                    <span className="font-mono text-sm cursor-pointer" onClick={(e) => { e.stopPropagation(); startInlineEdit(line); }} data-testid={`text-line-variations-${line.id}`}>
                                      {formatCurrency(line.variationsAmount)}
                                    </span>
                                  )}
                                </TableCell>
                                {/* Forecast Cost - editable */}
                                <TableCell className="text-right p-1">
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editData.forecastCost}
                                      onChange={(e) => updateInlineField(line.id, "forecastCost", e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(line.id); if (e.key === "Escape") cancelInlineEdit(line.id); }}
                                      onBlur={() => saveInlineEdit(line.id)}
                                      className="text-right font-mono h-8 w-full"
                                      data-testid={`input-inline-forecast-${line.id}`}
                                    />
                                  ) : (
                                    <span className="font-mono text-sm cursor-pointer" onClick={(e) => { e.stopPropagation(); startInlineEdit(line); }} data-testid={`text-line-forecast-${line.id}`}>
                                      {formatCurrency(line.forecastCost)}
                                    </span>
                                  )}
                                </TableCell>
                                {/* Loss or Gain */}
                                <TableCell className="text-right" data-testid={`text-line-lossorgain-${line.id}`}>
                                  {(() => {
                                    const est = parseFloat(line.estimatedBudget || "0");
                                    const forecast = parseFloat(line.forecastCost || "0");
                                    const lossOrGain = est - forecast;
                                    return (
                                      <span className={`font-mono text-sm ${lossOrGain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                        {formatCurrency(lossOrGain)}
                                      </span>
                                    );
                                  })()}
                                </TableCell>
                                {/* Actions */}
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => cancelInlineEdit(line.id)}
                                      data-testid={`button-cancel-inline-${line.id}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setDeleteConfirm(line)}
                                      data-testid={`button-delete-line-${line.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                    {budgetLines.length > 0 && summary && (
                      <TableRow className="bg-muted/50 font-medium" data-testid="row-budget-totals">
                        <TableCell />
                        <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-estimated">
                          {formatCurrency(summary.totalEstimatedBudget)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-tender">
                          {formatCurrency(summary.totalTenderAmounts)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-diff">
                          {formatCurrency(parseFloat(summary.totalEstimatedBudget || "0") - parseFloat(summary.totalTenderAmounts || "0"))}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-variations">
                          {formatCurrency(summary.totalVariations)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold" data-testid="text-totals-forecast">
                          {formatCurrency(summary.totalForecastCost)}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold ${parseFloat(summary.totalEstimatedBudget || "0") - parseFloat(summary.totalForecastCost || "0") >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-totals-lossorgain">
                          {formatCurrency(parseFloat(summary.totalEstimatedBudget || "0") - parseFloat(summary.totalForecastCost || "0"))}
                        </TableCell>
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
                  min="0"
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
                min="0"
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
                min="0"
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
                  min="0"
                  max="100"
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
                  min="0"
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

      {jobId && (
        <BudgetLineSidebar
          line={sidebarLineData}
          jobId={jobId}
          onClose={() => setSidebarLine(null)}
          onBudgetUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
            queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
          }}
          initialTab={sidebarTab}
        />
      )}
    </div>
  );
}
