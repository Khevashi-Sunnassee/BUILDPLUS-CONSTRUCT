import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  DollarSign,
  CheckCircle,
  XCircle,
  PieChart,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import type { PanelTypeConfig } from "@shared/schema";

const panelTypeSchema = z.object({
  code: z.string().min(1, "Code is required").toUpperCase(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  labourCostPerM2: z.string().optional(),
  labourCostPerM3: z.string().optional(),
  supplyCostPerM2: z.string().optional(),
  supplyCostPerM3: z.string().optional(),
  totalRatePerM2: z.string().optional(),
  totalRatePerM3: z.string().optional(),
  sellRatePerM2: z.string().optional(),
  sellRatePerM3: z.string().optional(),
  isActive: z.boolean().default(true),
});

type PanelTypeFormData = z.infer<typeof panelTypeSchema>;

interface CostComponent {
  id?: string;
  name: string;
  percentageOfRevenue: string;
}

export default function AdminPanelTypesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<PanelTypeConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
  const [costBreakupDialogOpen, setCostBreakupDialogOpen] = useState(false);
  const [costBreakupType, setCostBreakupType] = useState<PanelTypeConfig | null>(null);
  const [costComponents, setCostComponents] = useState<CostComponent[]>([]);

  const { data: panelTypes, isLoading } = useQuery<PanelTypeConfig[]>({
    queryKey: ["/api/admin/panel-types"],
  });

  const { data: currentCostComponents, refetch: refetchCostComponents } = useQuery<CostComponent[]>({
    queryKey: ["/api/panel-types", costBreakupType?.id, "cost-components"],
    queryFn: async () => {
      if (!costBreakupType?.id) return [];
      const res = await fetch(`/api/panel-types/${costBreakupType.id}/cost-components`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cost components");
      return res.json();
    },
    enabled: !!costBreakupType?.id && costBreakupDialogOpen,
  });

  useEffect(() => {
    if (currentCostComponents) {
      setCostComponents(currentCostComponents.map(c => ({
        id: c.id,
        name: c.name,
        percentageOfRevenue: c.percentageOfRevenue,
      })));
    }
  }, [currentCostComponents]);

  const form = useForm<PanelTypeFormData>({
    resolver: zodResolver(panelTypeSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      labourCostPerM2: "",
      labourCostPerM3: "",
      supplyCostPerM2: "",
      supplyCostPerM3: "",
      totalRatePerM2: "",
      totalRatePerM3: "",
      sellRatePerM2: "",
      sellRatePerM3: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PanelTypeFormData) => {
      return apiRequest("POST", "/api/admin/panel-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panel-types"] });
      toast({ title: "Panel type created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create panel type", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PanelTypeFormData }) => {
      return apiRequest("PUT", `/api/admin/panel-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panel-types"] });
      toast({ title: "Panel type updated successfully" });
      setDialogOpen(false);
      setEditingType(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update panel type", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/panel-types/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panel-types"] });
      toast({ title: "Panel type deleted" });
      setDeleteDialogOpen(false);
      setDeletingTypeId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete panel type", variant: "destructive" });
    },
  });

  const saveCostComponentsMutation = useMutation({
    mutationFn: async ({ panelTypeId, components }: { panelTypeId: string; components: CostComponent[] }) => {
      return apiRequest("PUT", `/api/panel-types/${panelTypeId}/cost-components`, { components });
    },
    onSuccess: () => {
      toast({ title: "Cost breakup saved successfully" });
      refetchCostComponents();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to save cost breakup", variant: "destructive" });
    },
  });

  const handleOpenCostBreakup = (type: PanelTypeConfig) => {
    setCostBreakupType(type);
    setCostComponents([]);
    setCostBreakupDialogOpen(true);
  };

  const handleAddComponent = () => {
    setCostComponents([...costComponents, { name: "", percentageOfRevenue: "" }]);
  };

  const handleRemoveComponent = (index: number) => {
    setCostComponents(costComponents.filter((_, i) => i !== index));
  };

  const handleComponentChange = (index: number, field: keyof CostComponent, value: string) => {
    const updated = [...costComponents];
    updated[index] = { ...updated[index], [field]: value };
    setCostComponents(updated);
  };

  const handleSaveCostComponents = () => {
    if (!costBreakupType) return;
    const total = costComponents.reduce((sum, c) => sum + (parseFloat(c.percentageOfRevenue) || 0), 0);
    if (total > 100) {
      toast({ title: "Total percentage cannot exceed 100%", variant: "destructive" });
      return;
    }
    saveCostComponentsMutation.mutate({ panelTypeId: costBreakupType.id, components: costComponents });
  };

  const totalPercentage = costComponents.reduce((sum, c) => sum + (parseFloat(c.percentageOfRevenue) || 0), 0);

  const handleOpenCreate = () => {
    setEditingType(null);
    form.reset({
      code: "",
      name: "",
      description: "",
      labourCostPerM2: "",
      labourCostPerM3: "",
      supplyCostPerM2: "",
      supplyCostPerM3: "",
      totalRatePerM2: "",
      totalRatePerM3: "",
      sellRatePerM2: "",
      sellRatePerM3: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (type: PanelTypeConfig) => {
    setEditingType(type);
    form.reset({
      code: type.code,
      name: type.name,
      description: type.description || "",
      labourCostPerM2: type.labourCostPerM2 || "",
      labourCostPerM3: type.labourCostPerM3 || "",
      supplyCostPerM2: type.supplyCostPerM2 || "",
      supplyCostPerM3: type.supplyCostPerM3 || "",
      totalRatePerM2: type.totalRatePerM2 || "",
      totalRatePerM3: type.totalRatePerM3 || "",
      sellRatePerM2: type.sellRatePerM2 || "",
      sellRatePerM3: type.sellRatePerM3 || "",
      isActive: type.isActive,
    });
    setDialogOpen(true);
  };

  const handleConfirmDelete = (id: string) => {
    setDeletingTypeId(id);
    setDeleteDialogOpen(true);
  };

  const onSubmit = (data: PanelTypeFormData) => {
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "-";
    const num = parseFloat(value);
    return isNaN(num) ? "-" : `$${num.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-panel-types-title">
            <Layers className="h-6 w-6" />
            Panel Types
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure panel types with default rates for labour, supply, and revenue tracking
          </p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-create-panel-type">
          <Plus className="h-4 w-4 mr-2" />
          Add Panel Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Panel Types</CardTitle>
          <CardDescription>
            Define default rates per m² and m³ for each panel type. These rates serve as defaults for projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Labour/m²</TableHead>
                  <TableHead className="text-right">Labour/m³</TableHead>
                  <TableHead className="text-right">Supply/m²</TableHead>
                  <TableHead className="text-right">Supply/m³</TableHead>
                  <TableHead className="text-right">Total/m²</TableHead>
                  <TableHead className="text-right">Total/m³</TableHead>
                  <TableHead className="text-right">Sell/m²</TableHead>
                  <TableHead className="text-right">Sell/m³</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!panelTypes?.length ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                      No panel types configured. Add your first panel type to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  panelTypes.map((type) => (
                    <TableRow key={type.id} data-testid={`row-panel-type-${type.id}`}>
                      <TableCell>
                        <Badge variant="outline">{type.code}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>
                        {type.isActive ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(type.labourCostPerM2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(type.labourCostPerM3)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(type.supplyCostPerM2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(type.supplyCostPerM3)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(type.totalRatePerM2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(type.totalRatePerM3)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">
                        {formatCurrency(type.sellRatePerM2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">
                        {formatCurrency(type.sellRatePerM3)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenCostBreakup(type)}
                            title="Cost Breakup"
                            data-testid={`button-cost-breakup-${type.id}`}
                          >
                            <PieChart className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(type)}
                            data-testid={`button-edit-panel-type-${type.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleConfirmDelete(type.id)}
                            data-testid={`button-delete-panel-type-${type.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Edit Panel Type" : "Add Panel Type"}
            </DialogTitle>
            <DialogDescription>
              Configure rates for this panel type. All rates are in dollars.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="WALL"
                          {...field}
                          data-testid="input-panel-type-code"
                        />
                      </FormControl>
                      <FormDescription>Unique identifier (uppercase)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Wall Panel"
                          {...field}
                          data-testid="input-panel-type-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description of this panel type..."
                        {...field}
                        data-testid="input-panel-type-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Cost Rates
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="labourCostPerM2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Labour Cost per m²</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-labour-cost-m2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="labourCostPerM3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Labour Cost per m³</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-labour-cost-m3"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="supplyCostPerM2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supply Cost per m²</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-supply-cost-m2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="supplyCostPerM3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supply Cost per m³</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-supply-cost-m3"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Rates
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalRatePerM2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Rate per m²</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-total-rate-m2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalRatePerM3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Rate per m³</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-total-rate-m3"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-green-600 dark:text-green-400">
                  <DollarSign className="h-4 w-4" />
                  Sell Rates (Revenue)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sellRatePerM2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sell Rate per m²</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-sell-rate-m2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sellRatePerM3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sell Rate per m³</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-sell-rate-m3"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Inactive panel types won't appear in dropdown menus
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-panel-type-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-panel-type"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingType ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Panel Type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this panel type. Panels using this type will retain their current type code but may not be editable. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTypeId && deleteMutation.mutate(deletingTypeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={costBreakupDialogOpen} onOpenChange={setCostBreakupDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Cost Breakup - {costBreakupType?.name}
            </DialogTitle>
            <DialogDescription>
              Define cost components as percentages of revenue. Total must not exceed 100%.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {costComponents.map((component, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Component name (e.g., Labour)"
                    value={component.name}
                    onChange={(e) => handleComponentChange(index, "name", e.target.value)}
                    className="flex-1"
                    data-testid={`input-component-name-${index}`}
                  />
                  <div className="relative w-24">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={component.percentageOfRevenue}
                      onChange={(e) => handleComponentChange(index, "percentageOfRevenue", e.target.value)}
                      className="pr-6"
                      data-testid={`input-component-percentage-${index}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveComponent(index)}
                    data-testid={`button-remove-component-${index}`}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddComponent}
              data-testid="button-add-component"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
              <span className="font-medium">Total:</span>
              <span className={`font-bold ${totalPercentage > 100 ? "text-destructive" : "text-green-600"}`}>
                {totalPercentage.toFixed(1)}%
              </span>
            </div>
            {totalPercentage > 100 && (
              <p className="text-sm text-destructive">Total percentage cannot exceed 100%</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCostBreakupDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveCostComponents}
              disabled={saveCostComponentsMutation.isPending || totalPercentage > 100}
              data-testid="button-save-cost-breakup"
            >
              {saveCostComponentsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
