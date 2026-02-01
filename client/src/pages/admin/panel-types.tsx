import { useState } from "react";
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

export default function AdminPanelTypesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<PanelTypeConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);

  const { data: panelTypes, isLoading } = useQuery<PanelTypeConfig[]>({
    queryKey: ["/api/admin/panel-types"],
  });

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
    </div>
  );
}
