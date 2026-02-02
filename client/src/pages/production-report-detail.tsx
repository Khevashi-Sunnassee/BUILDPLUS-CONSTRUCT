import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useRoute, useLocation } from "wouter";
import {
  Factory,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ArrowLeft,
  Calendar,
  Layers,
  Box,
  Square,
  LayoutGrid,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job, PanelRegister, ProductionEntry, User } from "@shared/schema";

const productionEntrySchema = z.object({
  panelId: z.string().min(1, "Panel is required"),
  jobId: z.string().min(1, "Job is required"),
  productionDate: z.string().min(1, "Date is required"),
  volumeM3: z.string().min(1, "Volume (m³) is required"),
  areaM2: z.string().min(1, "Area (m²) is required"),
  notes: z.string().optional(),
});

type ProductionEntryFormData = z.infer<typeof productionEntrySchema>;

interface ProductionEntryWithDetails extends ProductionEntry {
  panel: PanelRegister;
  job: Job;
  user: User;
  labourCost?: number;
  supplyCost?: number;
  totalCost?: number;
  revenue?: number;
  profit?: number;
}

interface ProductionSummaryWithCosts {
  entries: ProductionEntryWithDetails[];
  totals: {
    labourCost: number;
    supplyCost: number;
    totalCost: number;
    revenue: number;
    profit: number;
    volumeM3: number;
    areaM2: number;
    panelCount: number;
  };
}

export default function ProductionReportDetailPage() {
  const [, params] = useRoute("/production-report/:date");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const selectedDate = params?.date || format(new Date(), "yyyy-MM-dd");
  
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionEntryWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const { data: summaryData, isLoading: entriesLoading } = useQuery<ProductionSummaryWithCosts>({
    queryKey: ["/api/production-summary-with-costs", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/production-summary-with-costs?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch entries");
      return res.json();
    },
  });

  const entries = summaryData?.entries;
  const totals = summaryData?.totals;

  const { data: jobs } = useQuery<(Job & { panels: PanelRegister[] })[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const activeJobs = jobs?.filter(j => j.status === "ACTIVE") || [];

  const selectedJobPanels = useMemo(() => {
    if (!selectedJobId || !jobs) return [];
    const job = jobs.find(j => j.id === selectedJobId);
    return (job?.panels || []).filter(p => p.approvedForProduction);
  }, [selectedJobId, jobs]);

  const entryForm = useForm<ProductionEntryFormData>({
    resolver: zodResolver(productionEntrySchema),
    defaultValues: {
      panelId: "",
      jobId: "",
      productionDate: selectedDate,
      volumeM3: "",
      areaM2: "",
      notes: "",
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: ProductionEntryFormData) => {
      return apiRequest("POST", "/api/production-entries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-summary-with-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      toast({ title: "Production entry created successfully" });
      setEntryDialogOpen(false);
      entryForm.reset();
      setSelectedJobId("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to create entry", description: error.message, variant: "destructive" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductionEntryFormData }) => {
      return apiRequest("PUT", `/api/production-entries/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-summary-with-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      toast({ title: "Production entry updated successfully" });
      setEntryDialogOpen(false);
      setEditingEntry(null);
      entryForm.reset();
      setSelectedJobId("");
    },
    onError: () => {
      toast({ title: "Failed to update entry", variant: "destructive" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/production-entries/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-summary-with-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-reports"] });
      toast({ title: "Entry deleted" });
      setDeleteDialogOpen(false);
      setDeletingEntryId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete entry", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingEntry(null);
    setSelectedJobId("");
    entryForm.reset({
      panelId: "",
      jobId: "",
      productionDate: selectedDate,
      volumeM3: "",
      areaM2: "",
      notes: "",
    });
    setEntryDialogOpen(true);
  };

  const openEditDialog = (entry: ProductionEntryWithDetails) => {
    setEditingEntry(entry);
    setSelectedJobId(entry.jobId);
    entryForm.reset({
      panelId: entry.panelId,
      jobId: entry.jobId,
      productionDate: entry.productionDate,
      volumeM3: entry.volumeM3 || "",
      areaM2: entry.areaM2 || "",
      notes: entry.notes || "",
    });
    setEntryDialogOpen(true);
  };

  const onSubmit = (data: ProductionEntryFormData) => {
    if (editingEntry) {
      updateEntryMutation.mutate({ id: editingEntry.id, data });
    } else {
      createEntryMutation.mutate(data);
    }
  };

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    entryForm.setValue("jobId", jobId);
    entryForm.setValue("panelId", "");
  };

  const panelTypeCounts = useMemo(() => {
    if (!entries) return { walls: 0, columns: 0, cubeBases: 0, cubeRings: 0, landingWalls: 0, other: 0 };
    
    let walls = 0, columns = 0, cubeBases = 0, cubeRings = 0, landingWalls = 0, other = 0;
    
    for (const entry of entries) {
      const type = entry.panel.panelType || "OTHER";
      if (type === "WALL") walls++;
      else if (type === "COLUMN") columns++;
      else if (type === "CUBE_BASE") cubeBases++;
      else if (type === "CUBE_RING") cubeRings++;
      else if (type === "LANDING_WALL") landingWalls++;
      else other++;
    }
    
    return { walls, columns, cubeBases, cubeRings, landingWalls, other };
  }, [entries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = new Date(dateStr + "T00:00:00");
      return format(date, "EEEE, dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  if (entriesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/production-report")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-production-title">
              Production Report
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDateDisplay(selectedDate)}
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-entry">
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            PRODUCTION REPORT - QLD
          </CardTitle>
          <CardDescription>{formatDateDisplay(selectedDate)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Layers className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-bold">{totals?.panelCount || 0}</div>
                <div className="text-xs text-muted-foreground">Total Panels</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Box className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-2xl font-bold">{totals?.volumeM3?.toFixed(2) || "0.00"}</div>
                <div className="text-xs text-muted-foreground">Total m³</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Square className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <div className="text-2xl font-bold">{totals?.areaM2?.toFixed(2) || "0.00"}</div>
                <div className="text-xs text-muted-foreground">Total m²</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <LayoutGrid className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <div className="text-sm">
                  <span className="text-muted-foreground">W:</span> {panelTypeCounts.walls} {" "}
                  <span className="text-muted-foreground">C:</span> {panelTypeCounts.columns} {" "}
                  <span className="text-muted-foreground">CB:</span> {panelTypeCounts.cubeBases}
                </div>
                <div className="text-xs text-muted-foreground">Panel Types</div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="border-red-200 dark:border-red-900">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-red-500" />
                <div className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals?.totalCost || 0)}</div>
                <div className="text-xs text-muted-foreground">Total Cost</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Labour: {formatCurrency(totals?.labourCost || 0)} | Supply: {formatCurrency(totals?.supplyCost || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 dark:border-green-900">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals?.revenue || 0)}</div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </CardContent>
            </Card>
            <Card className={`${(totals?.profit || 0) >= 0 ? "border-green-200 dark:border-green-900" : "border-red-200 dark:border-red-900"}`}>
              <CardContent className="p-4 text-center">
                {(totals?.profit || 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 mx-auto mb-1 text-red-500" />
                )}
                <div className={`text-xl font-bold ${(totals?.profit || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(totals?.profit || 0)}
                </div>
                <div className="text-xs text-muted-foreground">Profit</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold">
                  {totals && totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : "0.0"}%
                </div>
                <div className="text-xs text-muted-foreground">Margin</div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-lg">
            <div className="bg-muted/50 px-4 py-2 border-b font-medium">
              FLAT PANELS
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Panel ID</TableHead>
                  <TableHead>Panel Type</TableHead>
                  <TableHead className="text-right">m³</TableHead>
                  <TableHead className="text-right">m²</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries?.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                    <TableCell>
                      <span className="font-mono text-sm">{entry.job.jobNumber} - {entry.job.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">{entry.panel.panelMark}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.panel.panelType?.replace("_", " ") || "WALL"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.volumeM3 ? parseFloat(entry.volumeM3).toFixed(2) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.areaM2 ? parseFloat(entry.areaM2).toFixed(2) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                      {formatCurrency(entry.totalCost || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                      {formatCurrency(entry.revenue || 0)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${(entry.profit || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(entry.profit || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(entry)}
                          data-testid={`button-edit-entry-${entry.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingEntryId(entry.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-entry-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!entries || entries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No production entries for this date. Click "Add Entry" to record production.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Production Entry" : "Add Production Entry"}</DialogTitle>
            <DialogDescription>
              {editingEntry ? "Update production details" : "Record production work for a panel"}
            </DialogDescription>
          </DialogHeader>
          <Form {...entryForm}>
            <form onSubmit={entryForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={entryForm.control}
                name="productionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Production Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-entry-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Job</FormLabel>
                <Select onValueChange={handleJobChange} value={selectedJobId}>
                  <SelectTrigger data-testid="select-entry-job">
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs?.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.jobNumber} - {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
              <FormField
                control={entryForm.control}
                name="panelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Panel (Approved for Production)</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedJobId || selectedJobPanels.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-entry-panel">
                          <SelectValue placeholder={
                            !selectedJobId 
                              ? "Select job first" 
                              : selectedJobPanels.length === 0 
                                ? "No approved panels" 
                                : "Select panel"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedJobPanels.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No panels approved for production.<br/>
                            Use the Panel Register to approve panels.
                          </div>
                        ) : (
                          selectedJobPanels.map((panel) => (
                            <SelectItem key={panel.id} value={panel.id}>
                              {panel.panelMark} - {panel.panelType?.replace("_", " ") || "WALL"}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={entryForm.control}
                  name="volumeM3"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volume (m³)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="2.50" 
                          {...field} 
                          data-testid="input-entry-volume" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={entryForm.control}
                  name="areaM2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area (m²)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="10.00" 
                          {...field} 
                          data-testid="input-entry-area" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={entryForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Additional notes..." data-testid="input-entry-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEntryMutation.isPending || updateEntryMutation.isPending}
                  data-testid="button-save-entry"
                >
                  {(createEntryMutation.isPending || updateEntryMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingEntry ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this production entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEntryId && deleteEntryMutation.mutate(deletingEntryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteEntryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
