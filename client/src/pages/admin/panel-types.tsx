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
  AlertTriangle,
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
  supplyCostPerM2: z.string().optional(),
  supplyCostPerM3: z.string().optional(),
  installCostPerM2: z.string().optional(),
  installCostPerM3: z.string().optional(),
  totalRatePerM2: z.string().optional(),
  totalRatePerM3: z.string().optional(),
  marginPercent: z.string().optional(),
  sellRatePerM2: z.string().optional(),
  sellRatePerM3: z.string().optional(),
  expectedWeightPerM3: z.string().optional(),
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

  // Fetch cost summaries for margin validation
  const { data: costSummaries, refetch: refetchCostSummaries } = useQuery<Record<string, { totalCostPercent: number; profitMargin: number }>>({
    queryKey: ["/api/admin/panel-types/cost-summaries"],
  });

  // Helper to check if margin matches breakup
  const getMarginStatus = (type: PanelTypeConfig) => {
    const panelMargin = parseFloat(type.sellRatePerM2 || "0") > 0 && parseFloat(type.totalRatePerM2 || "0") > 0
      ? (((parseFloat(type.sellRatePerM2!) - parseFloat(type.totalRatePerM2!)) / parseFloat(type.sellRatePerM2!)) * 100)
      : null;
    
    const breakupSummary = costSummaries?.[type.id];
    if (!breakupSummary || panelMargin === null) {
      return { hasBreakup: !!breakupSummary, matches: false, panelMargin, breakupMargin: breakupSummary?.profitMargin };
    }
    
    // Allow 0.5% tolerance for rounding differences
    const matches = Math.abs(panelMargin - breakupSummary.profitMargin) < 0.5;
    return { hasBreakup: true, matches, panelMargin, breakupMargin: breakupSummary.profitMargin };
  };

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

  // Default cost components for new panel types
  const defaultCostComponents: CostComponent[] = [
    { name: "REO", percentageOfRevenue: "10" },
    { name: "CONCRETE", percentageOfRevenue: "7" },
    { name: "LABOUR", percentageOfRevenue: "50" },
    { name: "DRAFTING", percentageOfRevenue: "3" },
    { name: "LOGISTICS", percentageOfRevenue: "6" },
    { name: "GENERAL OVERHEADS", percentageOfRevenue: "12" },
  ];

  useEffect(() => {
    if (currentCostComponents) {
      if (currentCostComponents.length > 0) {
        // Use existing components if they exist
        setCostComponents(currentCostComponents.map(c => ({
          id: c.id,
          name: c.name,
          percentageOfRevenue: c.percentageOfRevenue,
        })));
      } else {
        // Use default components if no existing components
        setCostComponents(defaultCostComponents);
      }
    }
  }, [currentCostComponents]);

  const form = useForm<PanelTypeFormData>({
    resolver: zodResolver(panelTypeSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      supplyCostPerM2: "",
      supplyCostPerM3: "",
      installCostPerM2: "",
      installCostPerM3: "",
      totalRatePerM2: "",
      totalRatePerM3: "",
      marginPercent: "20",
      sellRatePerM2: "",
      sellRatePerM3: "",
      expectedWeightPerM3: "2500",
      isActive: true,
    },
  });

  // Watch cost fields to auto-calculate total rates
  const supplyCostM2 = form.watch("supplyCostPerM2");
  const supplyCostM3 = form.watch("supplyCostPerM3");
  const installCostM2 = form.watch("installCostPerM2");
  const installCostM3 = form.watch("installCostPerM3");
  const marginPercent = form.watch("marginPercent");

  // Auto-calculate Total Rate = Supply + Install
  useEffect(() => {
    const supply = parseFloat(supplyCostM2 || "0") || 0;
    const install = parseFloat(installCostM2 || "0") || 0;
    const total = supply + install;
    form.setValue("totalRatePerM2", total > 0 ? total.toFixed(2) : "");
  }, [supplyCostM2, installCostM2, form]);

  useEffect(() => {
    const supply = parseFloat(supplyCostM3 || "0") || 0;
    const install = parseFloat(installCostM3 || "0") || 0;
    const total = supply + install;
    form.setValue("totalRatePerM3", total > 0 ? total.toFixed(2) : "");
  }, [supplyCostM3, installCostM3, form]);

  // Calculate Sell Rate from Margin (Sell = Total / (1 - Margin%))
  const calculateSellFromMargin = (total: number, marginPercentVal: number): number => {
    if (marginPercentVal >= 100) return total * 10; // Cap at very high sell rate
    if (marginPercentVal <= 0) return total;
    return total / (1 - marginPercentVal / 100);
  };

  // Update both sell rates when margin changes
  useEffect(() => {
    const margin = parseFloat(marginPercent || "0") || 0;
    
    const totalM2 = parseFloat(form.getValues("totalRatePerM2") || "0") || 0;
    if (totalM2 > 0) {
      const sellM2 = calculateSellFromMargin(totalM2, margin);
      form.setValue("sellRatePerM2", sellM2.toFixed(2));
    }
    
    const totalM3 = parseFloat(form.getValues("totalRatePerM3") || "0") || 0;
    if (totalM3 > 0) {
      const sellM3 = calculateSellFromMargin(totalM3, margin);
      form.setValue("sellRatePerM3", sellM3.toFixed(2));
    }
  }, [marginPercent, form]);

  // Recalculate sell rates when total changes (using current margin)
  useEffect(() => {
    const margin = parseFloat(form.getValues("marginPercent") || "0") || 0;
    const total = parseFloat(form.getValues("totalRatePerM2") || "0") || 0;
    if (total > 0 && margin > 0) {
      const sell = calculateSellFromMargin(total, margin);
      form.setValue("sellRatePerM2", sell.toFixed(2));
    }
  }, [supplyCostM2, installCostM2]);

  useEffect(() => {
    const margin = parseFloat(form.getValues("marginPercent") || "0") || 0;
    const total = parseFloat(form.getValues("totalRatePerM3") || "0") || 0;
    if (total > 0 && margin > 0) {
      const sell = calculateSellFromMargin(total, margin);
      form.setValue("sellRatePerM3", sell.toFixed(2));
    }
  }, [supplyCostM3, installCostM3]);

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
    onSuccess: async () => {
      toast({ title: "Cost breakup saved successfully" });
      // Invalidate and refetch to ensure status updates immediately
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-types/cost-summaries"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/panel-types", costBreakupType?.id, "cost-components"] });
      setCostBreakupDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to save cost breakup", variant: "destructive" });
    },
  });

  const handleOpenCostBreakup = (type: PanelTypeConfig) => {
    setCostBreakupType(type);
    // Set default components initially - will be replaced by existing data if any
    setCostComponents(defaultCostComponents);
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
      supplyCostPerM2: "",
      supplyCostPerM3: "",
      installCostPerM2: "",
      installCostPerM3: "",
      totalRatePerM2: "",
      totalRatePerM3: "",
      marginPercent: "20",
      sellRatePerM2: "",
      sellRatePerM3: "",
      expectedWeightPerM3: "2500",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (type: PanelTypeConfig) => {
    setEditingType(type);
    
    // Calculate margin from existing total and sell rates (use M2 as reference)
    const totalM2 = parseFloat(type.totalRatePerM2 || "0") || 0;
    const sellM2 = parseFloat(type.sellRatePerM2 || "0") || 0;
    
    let margin = "20";
    if (totalM2 > 0 && sellM2 > 0) {
      margin = (((sellM2 - totalM2) / sellM2) * 100).toFixed(1);
    }
    
    form.reset({
      code: type.code,
      name: type.name,
      description: type.description || "",
      supplyCostPerM2: type.supplyCostPerM2 || "",
      supplyCostPerM3: type.supplyCostPerM3 || "",
      installCostPerM2: type.installCostPerM2 || "",
      installCostPerM3: type.installCostPerM3 || "",
      totalRatePerM2: type.totalRatePerM2 || "",
      totalRatePerM3: type.totalRatePerM3 || "",
      marginPercent: margin,
      sellRatePerM2: type.sellRatePerM2 || "",
      sellRatePerM3: type.sellRatePerM3 || "",
      expectedWeightPerM3: type.expectedWeightPerM3 || "2500",
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
            Define default rates per m² and m³ for each panel type. These rates serve as defaults for jobs.
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
                  <TableHead className="text-right">Margin %</TableHead>
                  <TableHead className="text-right">Total/m²</TableHead>
                  <TableHead className="text-right">Total/m³</TableHead>
                  <TableHead className="text-right">Sell/m²</TableHead>
                  <TableHead className="text-right">Sell/m³</TableHead>
                  <TableHead className="text-right">Weight/m³</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!panelTypes?.length ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No panel types configured. Add your first panel type to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  panelTypes.map((type) => {
                    const marginStatus = getMarginStatus(type);
                    // Pending if: no breakup exists OR breakup exists but margins don't match
                    const needsBreakupAdjustment = !marginStatus.matches;
                    
                    return (
                    <TableRow 
                      key={type.id} 
                      data-testid={`row-panel-type-${type.id}`}
                      className={needsBreakupAdjustment ? "bg-red-50 dark:bg-red-950/30" : ""}
                    >
                      <TableCell>
                        <Badge variant="outline">{type.code}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>
                        {needsBreakupAdjustment ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                              Adjust Breakup
                            </span>
                          </div>
                        ) : type.isActive ? (
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
                      <TableCell className={`text-right font-mono text-sm ${needsBreakupAdjustment ? "text-red-600 dark:text-red-400 font-bold" : ""}`}>
                        {marginStatus.panelMargin !== null ? `${marginStatus.panelMargin.toFixed(1)}%` : "-"}
                        {needsBreakupAdjustment && marginStatus.breakupMargin !== undefined && (
                          <div className="text-xs text-red-500">
                            Breakup: {marginStatus.breakupMargin.toFixed(1)}%
                          </div>
                        )}
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
                      <TableCell className="text-right font-mono text-sm">
                        {type.expectedWeightPerM3 || "2500"} kg
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
                  );
                  })
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
                  <FormField
                    control={form.control}
                    name="installCostPerM2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Install Cost per m²</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-install-cost-m2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="installCostPerM3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Install Cost per m³</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7"
                              {...field}
                              data-testid="input-install-cost-m3"
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
                  Total Cost (Auto-calculated: Supply + Install)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalRatePerM2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Cost per m²</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7 bg-muted"
                              {...field}
                              readOnly
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
                        <FormLabel>Total Cost per m³</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7 bg-muted"
                              {...field}
                              readOnly
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
                  Margin & Sell Rates
                </h4>
                <p className="text-sm text-muted-foreground">
                  Set the margin percentage to automatically calculate sell rates for both m² and m³.
                </p>
                <FormField
                  control={form.control}
                  name="marginPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Margin %</FormLabel>
                      <FormControl>
                        <div className="relative w-32">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="20"
                            className="pr-7"
                            {...field}
                            data-testid="input-margin-percent"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sellRatePerM2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sell Rate per m² (Auto-calculated)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7 bg-muted"
                              {...field}
                              readOnly
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
                        <FormLabel>Sell Rate per m³ (Auto-calculated)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-7 bg-muted"
                              {...field}
                              readOnly
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
                name="expectedWeightPerM3"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Weight per m³</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          placeholder="2500"
                          className="pr-10"
                          {...field}
                          data-testid="input-expected-weight-m3"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">kg</span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Default weight per cubic meter for load calculations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
          
          {/* Show Panel Type Margin for Reference */}
          {costBreakupType && (() => {
            const marginStatus = getMarginStatus(costBreakupType);
            return marginStatus.panelMargin !== null ? (
              <div className={`p-3 rounded-md border ${
                marginStatus.hasBreakup && !marginStatus.matches 
                  ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800" 
                  : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
              }`}>
                <div className="flex items-center gap-2">
                  {marginStatus.hasBreakup && !marginStatus.matches ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  )}
                  <div className="text-sm">
                    <span className="font-medium">Panel Type Margin: </span>
                    <span className="font-bold">{marginStatus.panelMargin.toFixed(1)}%</span>
                  </div>
                </div>
                {marginStatus.hasBreakup && !marginStatus.matches && (
                  <p className="text-xs text-red-600 mt-1">
                    Breakup profit margin ({(100 - totalPercentage).toFixed(1)}%) must match the panel type margin ({marginStatus.panelMargin.toFixed(1)}%)
                  </p>
                )}
                {!marginStatus.hasBreakup && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Adjust cost components so profit margin equals {marginStatus.panelMargin.toFixed(1)}%
                  </p>
                )}
              </div>
            ) : null;
          })()}
          
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
                      className="w-full pr-8"
                      data-testid={`input-component-percentage-${index}`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">%</span>
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
              <span className="font-medium">Total Cost:</span>
              <span className={`font-bold ${totalPercentage > 100 ? "text-destructive" : "text-green-600"}`}>
                {totalPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
              <span className="font-medium">Profit Margin:</span>
              <span className={`font-bold ${totalPercentage > 100 ? "text-destructive" : "text-blue-600"}`}>
                {(100 - totalPercentage).toFixed(1)}%
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
            {(() => {
              const marginStatus = costBreakupType ? getMarginStatus(costBreakupType) : null;
              const breakupProfitMargin = 100 - totalPercentage;
              const panelMargin = marginStatus?.panelMargin ?? 0;
              // Allow 0.5% tolerance for rounding
              const marginsMatch = Math.abs(breakupProfitMargin - panelMargin) < 0.5;
              const canSave = !saveCostComponentsMutation.isPending && totalPercentage <= 100 && marginsMatch;
              
              return (
                <Button
                  type="button"
                  onClick={handleSaveCostComponents}
                  disabled={!canSave}
                  data-testid="button-save-cost-breakup"
                >
                  {saveCostComponentsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  {marginsMatch ? "Save" : "Margins Must Match"}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
