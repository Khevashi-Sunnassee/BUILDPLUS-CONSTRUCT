import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  Package,
  Search,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Activity,
  Truck,
  Loader2,
} from "lucide-react";
import { ASSET_ROUTES } from "@shared/api-routes";
import type { Asset } from "@shared/schema";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_CONDITIONS,
  ASSET_FUNDING_METHODS,
} from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { PageHelpButton } from "@/components/help/page-help-button";

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(num);
};

const assetFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  status: z.string().optional(),
  condition: z.string().optional(),
  location: z.string().optional(),
  department: z.string().optional(),
  assignedTo: z.string().optional(),
  fundingMethod: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetFormSchema>;

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span>-</span>;
  const variant =
    status === "active"
      ? "default"
      : status === "disposed" || status === "sold"
        ? "secondary"
        : "destructive";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

function ConditionBadge({ condition }: { condition: string | null | undefined }) {
  if (!condition) return <span>-</span>;
  return (
    <Badge variant="outline" className="capitalize">
      {condition}
    </Badge>
  );
}

export default function AssetRegisterPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fundingFilter, setFundingFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: [ASSET_ROUTES.LIST],
  });

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
      status: "active",
      condition: "good",
      location: "",
      department: "",
      assignedTo: "",
      fundingMethod: "purchased",
    },
  });

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    return assets.filter((asset) => {
      const query = searchQuery.toLowerCase();
      if (query) {
        const matchesSearch =
          (asset.name || "").toLowerCase().includes(query) ||
          (asset.assetTag || "").toLowerCase().includes(query) ||
          (asset.manufacturer || "").toLowerCase().includes(query) ||
          (asset.model || "").toLowerCase().includes(query) ||
          (asset.serialNumber || "").toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (categoryFilter !== "all" && asset.category !== categoryFilter) return false;
      if (statusFilter !== "all" && asset.status !== statusFilter) return false;
      if (fundingFilter !== "all" && asset.fundingMethod !== fundingFilter) return false;
      return true;
    });
  }, [assets, searchQuery, categoryFilter, statusFilter, fundingFilter]);

  const stats = useMemo(() => {
    if (!assets) return { total: 0, totalValue: 0, active: 0, leased: 0 };
    return {
      total: assets.length,
      totalValue: assets.reduce((sum, a) => {
        const val = a.currentValue ? parseFloat(String(a.currentValue)) : 0;
        return sum + (isNaN(val) ? 0 : val);
      }, 0),
      active: assets.filter((a) => a.status === "active").length,
      leased: assets.filter((a) => a.fundingMethod === "leased").length,
    };
  }, [assets]);

  const createMutation = useMutation({
    mutationFn: async (data: AssetFormData) => {
      return apiRequest("POST", ASSET_ROUTES.CREATE, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      toast({ title: "Asset created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create asset", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssetFormData }) => {
      return apiRequest("PATCH", ASSET_ROUTES.BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      toast({ title: "Asset updated successfully" });
      setDialogOpen(false);
      setEditingAsset(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update asset", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ASSET_ROUTES.BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      toast({ title: "Asset deleted" });
      setDeleteDialogOpen(false);
      setDeletingAssetId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete asset", description: error.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingAsset(null);
    form.reset({
      name: "",
      category: "",
      description: "",
      status: "active",
      condition: "good",
      location: "",
      department: "",
      assignedTo: "",
      fundingMethod: "purchased",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    form.reset({
      name: asset.name,
      category: asset.category,
      description: asset.description || "",
      status: asset.status || "active",
      condition: asset.condition || "",
      location: asset.location || "",
      department: asset.department || "",
      assignedTo: asset.assignedTo || "",
      fundingMethod: asset.fundingMethod || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: AssetFormData) => {
    if (editingAsset) {
      updateMutation.mutate({ id: editingAsset.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" style={{ fontFamily: "helvetica, sans-serif" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ fontFamily: "helvetica, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Package className="h-6 w-6 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Asset Register
          </h1>
            <PageHelpButton pageHelpKey="page.admin.asset-register" />
          </div>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-asset">
          <Plus className="h-4 w-4 mr-2" />
          Add Asset
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-assets">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-value">
              {formatCurrency(stats.totalValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Assets</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-assets">
              {stats.active}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leased Assets</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-leased-assets">
              {stats.leased}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, tag, manufacturer, model, serial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-category-filter">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {ASSET_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ASSET_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fundingFilter} onValueChange={setFundingFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-funding-filter">
            <SelectValue placeholder="Funding Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Funding</SelectItem>
            {ASSET_FUNDING_METHODS.map((f) => (
              <SelectItem key={f} value={f} className="capitalize">
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Purchase Price</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {assets && assets.length > 0
                      ? "No assets match the current filters"
                      : "No assets found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setLocation(`/admin/assets/${asset.id}`)}
                    data-testid={`row-asset-${asset.id}`}
                  >
                    <TableCell className="font-mono text-sm" data-testid={`text-asset-tag-${asset.id}`}>
                      {asset.assetTag}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-asset-name-${asset.id}`}>
                      {asset.name}
                    </TableCell>
                    <TableCell data-testid={`text-asset-category-${asset.id}`}>
                      {asset.category}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={asset.status} />
                    </TableCell>
                    <TableCell>
                      <ConditionBadge condition={asset.condition} />
                    </TableCell>
                    <TableCell data-testid={`text-asset-location-${asset.id}`}>
                      {asset.location || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono" data-testid={`text-asset-purchase-price-${asset.id}`}>
                      {formatCurrency(asset.purchasePrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono" data-testid={`text-asset-current-value-${asset.id}`}>
                      {formatCurrency(asset.currentValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(asset);
                          }}
                          data-testid={`button-edit-asset-${asset.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingAssetId(asset.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-asset-${asset.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
            <DialogDescription>
              {editingAsset ? "Update the asset details below." : "Fill in the details to create a new asset."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-asset-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-asset-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSET_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-asset-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSET_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSET_CONDITIONS.map((c) => (
                            <SelectItem key={c} value={c} className="capitalize">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-asset-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-department" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-assigned-to" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="fundingMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Funding Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-asset-funding-method">
                          <SelectValue placeholder="Select funding method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSET_FUNDING_METHODS.map((f) => (
                          <SelectItem key={f} value={f} className="capitalize">
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel-asset"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-asset"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingAsset ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingAssetId) {
                  deleteMutation.mutate(deletingAssetId);
                }
              }}
              data-testid="button-confirm-delete"
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
