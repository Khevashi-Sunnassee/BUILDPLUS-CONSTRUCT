import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  Hash,
  ArrowLeft,
  Filter,
  CheckCircle,
  Clock as ClockIcon,
  AlertCircle,
  Pause,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
import { useLocation, useSearch } from "wouter";
import type { Job, PanelRegister, PanelTypeConfig } from "@shared/schema";

const panelSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  panelMark: z.string().min(1, "Panel mark is required"),
  panelType: z.string().min(1, "Panel type is required"),
  description: z.string().optional(),
  drawingCode: z.string().optional(),
  sheetNumber: z.string().optional(),
  estimatedHours: z.number().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]),
});

type PanelFormData = z.infer<typeof panelSchema>;

interface PanelWithJob extends PanelRegister {
  job: Job;
}

export default function AdminPanelsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const filterJobId = urlParams.get("jobId");
  
  const [panelDialogOpen, setPanelDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<PanelRegister | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPanelId, setDeletingPanelId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [selectedJobForImport, setSelectedJobForImport] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: panels, isLoading: panelsLoading } = useQuery<PanelWithJob[]>({
    queryKey: ["/api/admin/panels"],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
  });

  const { data: panelTypes } = useQuery<PanelTypeConfig[]>({
    queryKey: ["/api/panel-types"],
  });

  const filteredPanels = panels?.filter(panel => {
    if (filterJobId && panel.jobId !== filterJobId) return false;
    if (statusFilter !== "all" && panel.status !== statusFilter) return false;
    return true;
  });

  const currentJob = jobs?.find(j => j.id === filterJobId);

  const panelForm = useForm<PanelFormData>({
    resolver: zodResolver(panelSchema),
    defaultValues: {
      jobId: filterJobId || "",
      panelMark: "",
      panelType: "WALL",
      description: "",
      drawingCode: "",
      sheetNumber: "",
      estimatedHours: undefined,
      status: "NOT_STARTED",
    },
  });

  useEffect(() => {
    if (filterJobId) {
      panelForm.setValue("jobId", filterJobId);
    }
  }, [filterJobId, panelForm]);

  const createPanelMutation = useMutation({
    mutationFn: async (data: PanelFormData) => {
      return apiRequest("POST", "/api/admin/panels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Panel created successfully" });
      setPanelDialogOpen(false);
      panelForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create panel", description: error.message, variant: "destructive" });
    },
  });

  const updatePanelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PanelFormData }) => {
      return apiRequest("PUT", `/api/admin/panels/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Panel updated successfully" });
      setPanelDialogOpen(false);
      setEditingPanel(null);
      panelForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to update panel", variant: "destructive" });
    },
  });

  const deletePanelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/panels/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: "Panel deleted" });
      setDeleteDialogOpen(false);
      setDeletingPanelId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete panel", variant: "destructive" });
    },
  });

  const importPanelsMutation = useMutation({
    mutationFn: async ({ data, jobId }: { data: any[]; jobId: string }) => {
      return apiRequest("POST", "/api/admin/panels/import", { data, jobId });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      toast({ title: `Imported ${result.imported} panels, ${result.skipped} skipped` });
      setImportDialogOpen(false);
      setImportData([]);
      setSelectedJobForImport("");
    },
    onError: () => {
      toast({ title: "Import failed", variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setImportData(jsonData);
      setSelectedJobForImport(filterJobId || "");
      setImportDialogOpen(true);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const template = [
      { "Panel Mark": "PM-001", "Panel Type": "WALL", "Description": "Panel description", "Drawing Code": "DWG-001", "Sheet Number": "A001", "Estimated Hours": 8 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Panels");
    XLSX.writeFile(wb, "panels_template.xlsx");
  };

  const openCreateDialog = () => {
    setEditingPanel(null);
    panelForm.reset({
      jobId: filterJobId || "",
      panelMark: "",
      panelType: "WALL",
      description: "",
      drawingCode: "",
      sheetNumber: "",
      estimatedHours: undefined,
      status: "NOT_STARTED",
    });
    setPanelDialogOpen(true);
  };

  const openEditDialog = (panel: PanelRegister) => {
    setEditingPanel(panel);
    panelForm.reset({
      jobId: panel.jobId,
      panelMark: panel.panelMark,
      panelType: panel.panelType || "WALL",
      description: panel.description || "",
      drawingCode: panel.drawingCode || "",
      sheetNumber: panel.sheetNumber || "",
      estimatedHours: panel.estimatedHours || undefined,
      status: panel.status,
    });
    setPanelDialogOpen(true);
  };

  const onSubmit = (data: PanelFormData) => {
    if (editingPanel) {
      updatePanelMutation.mutate({ id: editingPanel.id, data });
    } else {
      createPanelMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      NOT_STARTED: { variant: "outline", icon: AlertCircle },
      IN_PROGRESS: { variant: "default", icon: ClockIcon },
      COMPLETED: { variant: "secondary", icon: CheckCircle },
      ON_HOLD: { variant: "destructive", icon: Pause },
    };
    const { variant, icon: Icon } = config[status] || config.NOT_STARTED;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getProgress = (panel: PanelRegister) => {
    if (!panel.estimatedHours || panel.estimatedHours === 0) return null;
    const percent = Math.min(100, ((panel.actualHours || 0) / panel.estimatedHours) * 100);
    return percent;
  };

  const statusCounts = {
    total: filteredPanels?.length || 0,
    notStarted: filteredPanels?.filter(p => p.status === "NOT_STARTED").length || 0,
    inProgress: filteredPanels?.filter(p => p.status === "IN_PROGRESS").length || 0,
    completed: filteredPanels?.filter(p => p.status === "COMPLETED").length || 0,
    onHold: filteredPanels?.filter(p => p.status === "ON_HOLD").length || 0,
  };

  if (panelsLoading) {
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
          {filterJobId && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/jobs")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-panels-title">
              Panel Register
              {currentJob && <span className="text-muted-foreground ml-2">- {currentJob.jobNumber}</span>}
            </h1>
            <p className="text-muted-foreground">
              {filterJobId ? `Panels for ${currentJob?.name || "job"}` : "Manage panel register for all jobs"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-file-upload"
          />
          <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-panel">
            <Plus className="h-4 w-4 mr-2" />
            Add Panel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("all")} data-testid="card-filter-all">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.total}</div>
            <div className="text-sm text-muted-foreground">Total Panels</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("NOT_STARTED")} data-testid="card-filter-not-started">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-muted-foreground">{statusCounts.notStarted}</div>
            <div className="text-sm text-muted-foreground">Not Started</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("IN_PROGRESS")} data-testid="card-filter-in-progress">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-500">{statusCounts.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("COMPLETED")} data-testid="card-filter-completed">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{statusCounts.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("ON_HOLD")} data-testid="card-filter-on-hold">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-500">{statusCounts.onHold}</div>
            <div className="text-sm text-muted-foreground">On Hold</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Panel List
              </CardTitle>
              <CardDescription>
                {filteredPanels?.length || 0} panels {statusFilter !== "all" && `(${statusFilter.replace("_", " ")})`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {!filterJobId && <TableHead>Job</TableHead>}
                <TableHead>Panel Mark</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Drawing / Sheet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPanels?.map((panel) => (
                <TableRow key={panel.id} data-testid={`row-panel-${panel.id}`}>
                  {!filterJobId && (
                    <TableCell>
                      <span className="font-mono text-sm">{panel.job.jobNumber}</span>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-medium">{panel.panelMark}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{panel.panelType?.replace("_", " ") || "WALL"}</Badge>
                  </TableCell>
                  <TableCell>{panel.description || "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {panel.drawingCode && <div>Drawing: {panel.drawingCode}</div>}
                      {panel.sheetNumber && <div>Sheet: {panel.sheetNumber}</div>}
                      {!panel.drawingCode && !panel.sheetNumber && "-"}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(panel.status)}</TableCell>
                  <TableCell>
                    {panel.estimatedHours ? (
                      <div className="space-y-1 w-24">
                        <Progress value={getProgress(panel) || 0} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {panel.actualHours || 0} / {panel.estimatedHours}h
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {panel.actualHours || 0}h logged
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(panel)}
                        data-testid={`button-edit-panel-${panel.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingPanelId(panel.id);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`button-delete-panel-${panel.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredPanels || filteredPanels.length === 0) && (
                <TableRow>
                  <TableCell colSpan={filterJobId ? 7 : 8} className="text-center py-8 text-muted-foreground">
                    No panels found. Add a panel or import from Excel.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={panelDialogOpen} onOpenChange={setPanelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPanel ? "Edit Panel" : "Create New Panel"}</DialogTitle>
            <DialogDescription>
              {editingPanel ? "Update panel details" : "Add a new panel to the register"}
            </DialogDescription>
          </DialogHeader>
          <Form {...panelForm}>
            <form onSubmit={panelForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={panelForm.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!filterJobId}>
                      <FormControl>
                        <SelectTrigger data-testid="select-panel-job">
                          <SelectValue placeholder="Select job" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobs?.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.jobNumber} - {job.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={panelForm.control}
                  name="panelMark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Panel Mark</FormLabel>
                      <FormControl>
                        <Input placeholder="PM-001" {...field} data-testid="input-panel-mark" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={panelForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-panel-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="ON_HOLD">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={panelForm.control}
                name="panelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Panel Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-panel-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {panelTypes && panelTypes.length > 0 ? (
                          panelTypes.map((pt) => (
                            <SelectItem key={pt.id} value={pt.code}>{pt.name}</SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="WALL">Wall</SelectItem>
                            <SelectItem value="COLUMN">Column</SelectItem>
                            <SelectItem value="CUBE_BASE">Cube Base</SelectItem>
                            <SelectItem value="CUBE_RING">Cube Ring</SelectItem>
                            <SelectItem value="LANDING_WALL">Landing Wall</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={panelForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Panel description" {...field} data-testid="input-panel-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={panelForm.control}
                  name="drawingCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drawing Code</FormLabel>
                      <FormControl>
                        <Input placeholder="DWG-001" {...field} data-testid="input-panel-drawing" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={panelForm.control}
                  name="sheetNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sheet Number</FormLabel>
                      <FormControl>
                        <Input placeholder="A001" {...field} data-testid="input-panel-sheet" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={panelForm.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="8"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-panel-hours"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPanelDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPanelMutation.isPending || updatePanelMutation.isPending}
                  data-testid="button-save-panel"
                >
                  {(createPanelMutation.isPending || updatePanelMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingPanel ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Panels from Excel
            </DialogTitle>
            <DialogDescription>
              Select a job and review the data before importing. {importData.length} rows found.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Import to Job</label>
              <Select value={selectedJobForImport} onValueChange={setSelectedJobForImport}>
                <SelectTrigger className="mt-1" data-testid="select-import-job">
                  <SelectValue placeholder="Select job for import" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[250px] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Panel Mark</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Drawing Code</TableHead>
                    <TableHead>Sheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.slice(0, 10).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{row.panelMark || row["Panel Mark"] || row["Mark"] || "-"}</TableCell>
                      <TableCell>{row.description || row["Description"] || "-"}</TableCell>
                      <TableCell>{row.drawingCode || row["Drawing Code"] || "-"}</TableCell>
                      <TableCell>{row.sheetNumber || row["Sheet Number"] || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {importData.length > 10 && (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  ... and {importData.length - 10} more rows
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => importPanelsMutation.mutate({ data: importData, jobId: selectedJobForImport })}
              disabled={importPanelsMutation.isPending || !selectedJobForImport}
              data-testid="button-confirm-import"
            >
              {importPanelsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              Import {importData.length} Panels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Panel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this panel from the register.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPanelId && deletePanelMutation.mutate(deletingPanelId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deletePanelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
