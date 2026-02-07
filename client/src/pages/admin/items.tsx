import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Upload,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Filter,
  FolderOpen,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Item, ItemCategory, Supplier } from "@shared/schema";
import { PROCUREMENT_ROUTES } from "@shared/api-routes";

const itemSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  unitOfMeasure: z.string().default("EA"),
  unitPrice: z.string().optional(),
  minOrderQty: z.string().optional(),
  leadTimeDays: z.string().optional(),
  isActive: z.boolean().default(true),
});

type ItemFormData = z.infer<typeof itemSchema>;

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CategoryFormData = z.infer<typeof categorySchema>;

const UNIT_OF_MEASURE_OPTIONS = [
  { value: "EA", label: "Each" },
  { value: "M", label: "Metre" },
  { value: "M2", label: "Square Metre" },
  { value: "M3", label: "Cubic Metre" },
  { value: "KG", label: "Kilogram" },
  { value: "T", label: "Tonne" },
  { value: "L", label: "Litre" },
  { value: "HR", label: "Hour" },
  { value: "DAY", label: "Day" },
];

interface CategoryGroup {
  category: ItemCategory | null;
  items: Item[];
}

function CategoryPanel({
  group,
  isOpen,
  onToggle,
  categories,
  suppliers,
  onEdit,
  onDelete,
}: {
  group: CategoryGroup;
  isOpen: boolean;
  onToggle: () => void;
  categories: ItemCategory[] | undefined;
  suppliers: Supplier[] | undefined;
  onEdit: (item: Item) => void;
  onDelete: (itemId: string) => void;
}) {
  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return "-";
    const supplier = suppliers?.find(s => s.id === supplierId);
    return supplier?.name || "-";
  };

  const categoryName = group.category?.name || "Uncategorized";
  const categoryId = group.category?.id || "uncategorized";

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between p-3 bg-muted/50 hover-elevate text-left"
            data-testid={`category-header-${categoryId}`}
          >
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">{categoryName}</span>
              <Badge variant="secondary" className="text-xs">
                {group.items.length} item{group.items.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right w-28">Unit Price</TableHead>
                <TableHead className="text-right w-20">Min Qty</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.items.map((item) => (
                <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                  <TableCell className="font-mono text-sm" data-testid={`text-item-code-${item.id}`}>
                    {item.code || "-"}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-item-name-${item.id}`}>
                    {item.name}
                  </TableCell>
                  <TableCell data-testid={`text-item-supplier-${item.id}`}>
                    {getSupplierName(item.supplierId)}
                  </TableCell>
                  <TableCell className="text-right font-mono" data-testid={`text-item-price-${item.id}`}>
                    {item.unitPrice ? `$${Number(item.unitPrice).toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-item-minqty-${item.id}`}>
                    {item.minOrderQty || 1}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "secondary"} data-testid={`badge-item-status-${item.id}`}>
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(item)}
                        data-testid={`button-edit-item-${item.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(item.id)}
                        data-testid={`button-delete-item-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function AdminItemsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("categories");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ItemCategory | null>(null);
  const [categoryDeleteDialogOpen, setCategoryDeleteDialogOpen] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: [PROCUREMENT_ROUTES.ITEMS],
  });

  const { data: allCategories } = useQuery<ItemCategory[]>({
    queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES],
  });

  const { data: activeCategories } = useQuery<ItemCategory[]>({
    queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES_ACTIVE],
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    return items.filter(item => {
      const matchesSearch = searchQuery === "" || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = filterCategory === "all" || 
        (filterCategory === "uncategorized" ? !item.categoryId : item.categoryId === filterCategory);
      
      const matchesStatus = filterStatus === "all" ||
        (filterStatus === "active" ? item.isActive : !item.isActive);
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, filterCategory, filterStatus]);

  const groupedItems = useMemo(() => {
    const groups: CategoryGroup[] = [];
    const categoryMap = new Map<string | null, Item[]>();
    const usedCategoryIds = new Set<string>();
    
    filteredItems.forEach(item => {
      const key = item.categoryId || null;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, []);
      }
      categoryMap.get(key)!.push(item);
    });

    const sortedCategories = allCategories?.slice().sort((a, b) => a.name.localeCompare(b.name)) || [];
    
    sortedCategories.forEach(category => {
      const categoryItems = categoryMap.get(category.id);
      if (categoryItems && categoryItems.length > 0) {
        groups.push({
          category,
          items: categoryItems.sort((a, b) => a.name.localeCompare(b.name)),
        });
        usedCategoryIds.add(category.id);
      }
    });

    categoryMap.forEach((categoryItems, categoryId) => {
      if (categoryId !== null && !usedCategoryIds.has(categoryId) && categoryItems.length > 0) {
        groups.push({
          category: { id: categoryId, name: `Unknown Category (${categoryId.substring(0, 8)}...)`, isActive: false, createdAt: new Date() } as ItemCategory,
          items: categoryItems.sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    });

    const uncategorizedItems = categoryMap.get(null);
    if (uncategorizedItems && uncategorizedItems.length > 0) {
      groups.push({
        category: null,
        items: uncategorizedItems.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    return groups;
  }, [filteredItems, allCategories]);

  const toggleCategory = (categoryId: string | null) => {
    const key = categoryId || "uncategorized";
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allKeys = new Set<string>();
    groupedItems.forEach(group => {
      allKeys.add(group.category?.id || "uncategorized");
    });
    setOpenCategories(allKeys);
  };

  const collapseAll = () => {
    setOpenCategories(new Set());
  };

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      categoryId: "",
      supplierId: "",
      unitOfMeasure: "EA",
      unitPrice: "",
      minOrderQty: "1",
      leadTimeDays: "",
      isActive: true,
    },
  });

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      return apiRequest("POST", PROCUREMENT_ROUTES.ITEM_CATEGORIES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES_ACTIVE] });
      toast({ title: "Category created successfully" });
      setCategoryDialogOpen(false);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create category", description: error.message, variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoryFormData }) => {
      return apiRequest("PATCH", PROCUREMENT_ROUTES.ITEM_CATEGORY_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES_ACTIVE] });
      toast({ title: "Category updated successfully" });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update category", description: error.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", PROCUREMENT_ROUTES.ITEM_CATEGORY_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES_ACTIVE] });
      toast({ title: "Category deleted" });
      setCategoryDeleteDialogOpen(false);
      setDeletingCategoryId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete category", description: error.message, variant: "destructive" });
    },
  });

  const openCreateCategoryDialog = () => {
    setEditingCategory(null);
    categoryForm.reset({
      name: "",
      description: "",
      isActive: true,
    });
    setCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: ItemCategory) => {
    setEditingCategory(category);
    categoryForm.reset({
      name: category.name,
      description: category.description || "",
      isActive: category.isActive,
    });
    setCategoryDialogOpen(true);
  };

  const onCategorySubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      const payload = {
        ...data,
        unitPrice: data.unitPrice ? parseFloat(data.unitPrice) : null,
        minOrderQty: data.minOrderQty ? parseInt(data.minOrderQty) : 1,
        leadTimeDays: data.leadTimeDays ? parseInt(data.leadTimeDays) : null,
        categoryId: data.categoryId || null,
        supplierId: data.supplierId || null,
      };
      return apiRequest("POST", PROCUREMENT_ROUTES.ITEMS, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEMS] });
      toast({ title: "Item created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create item", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ItemFormData }) => {
      const payload = {
        ...data,
        unitPrice: data.unitPrice ? parseFloat(data.unitPrice) : null,
        minOrderQty: data.minOrderQty ? parseInt(data.minOrderQty) : 1,
        leadTimeDays: data.leadTimeDays ? parseInt(data.leadTimeDays) : null,
        categoryId: data.categoryId || null,
        supplierId: data.supplierId || null,
      };
      return apiRequest("PATCH", PROCUREMENT_ROUTES.ITEM_BY_ID(id), payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEMS] });
      toast({ title: "Item updated successfully" });
      setDialogOpen(false);
      setEditingItem(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update item", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", PROCUREMENT_ROUTES.ITEM_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEMS] });
      toast({ title: "Item deleted" });
      setDeleteDialogOpen(false);
      setDeletingItemId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete item", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = getCsrfToken();
      const response = await fetch(PROCUREMENT_ROUTES.ITEMS_IMPORT, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import items");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEMS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES_ACTIVE] });
      toast({ 
        title: "Import Successful", 
        description: `${data.created} items created, ${data.updated} updated${data.categoriesCreated ? `, ${data.categoriesCreated} categories created` : ""}` 
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    form.reset({
      code: "",
      name: "",
      description: "",
      categoryId: "",
      supplierId: "",
      unitOfMeasure: "EA",
      unitPrice: "",
      minOrderQty: "1",
      leadTimeDays: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    form.reset({
      code: item.code || "",
      name: item.name,
      description: item.description || "",
      categoryId: item.categoryId || "",
      supplierId: item.supplierId || "",
      unitOfMeasure: item.unitOfMeasure || "EA",
      unitPrice: item.unitPrice ? String(item.unitPrice) : "",
      minOrderQty: item.minOrderQty ? String(item.minOrderQty) : "1",
      leadTimeDays: item.leadTimeDays ? String(item.leadTimeDays) : "",
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ItemFormData) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("all");
    setFilterStatus("all");
  };

  const hasActiveFilters = searchQuery !== "" || filterCategory !== "all" || filterStatus !== "all";

  if (isLoading) {
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-items-title">Item Catalog</h1>
          <p className="text-muted-foreground">Manage categories and inventory items</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories" className="flex items-center gap-2" data-testid="tab-categories">
            <FolderOpen className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2" data-testid="tab-items">
            <Package className="h-4 w-4" />
            Items
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Item Categories
                </CardTitle>
                <CardDescription>
                  {allCategories?.length || 0} categor{allCategories?.length !== 1 ? "ies" : "y"} configured
                </CardDescription>
              </div>
              <Button onClick={openCreateCategoryDialog} data-testid="button-create-category">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </CardHeader>
            <CardContent>
              {allCategories && allCategories.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCategories.map((category) => (
                      <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                        <TableCell className="font-medium" data-testid={`text-category-name-${category.id}`}>
                          {category.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[300px] truncate" data-testid={`text-category-description-${category.id}`}>
                          {category.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={category.isActive ? "default" : "secondary"} data-testid={`badge-category-status-${category.id}`}>
                            {category.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditCategoryDialog(category)}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingCategoryId(category.id);
                                setCategoryDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No categories configured yet</p>
                  <p className="text-sm">Click "Add Category" to create your first category</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="hidden"
              data-testid="input-import-file"
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
              data-testid="button-import-items"
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import Excel
            </Button>
            <Button onClick={openCreateDialog} data-testid="button-create-item">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Items
              </CardTitle>
              <CardDescription>
                {filteredItems.length} of {items?.length || 0} item{items?.length !== 1 ? "s" : ""} shown
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} data-testid="button-expand-all">
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
                Collapse All
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-items"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {allCategories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}{!category.isActive ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]" data-testid="select-filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {groupedItems.length > 0 ? (
            <div className="space-y-3">
              {groupedItems.map((group) => (
                <CategoryPanel
                  key={group.category?.id || "uncategorized"}
                  group={group}
                  isOpen={openCategories.has(group.category?.id || "uncategorized")}
                  onToggle={() => toggleCategory(group.category?.id || null)}
                  categories={allCategories}
                  suppliers={suppliers}
                  onEdit={openEditDialog}
                  onDelete={(itemId) => {
                    setDeletingItemId(itemId);
                    setDeleteDialogOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {hasActiveFilters ? (
                <>
                  <p>No items match your filters</p>
                  <Button variant="ghost" onClick={clearFilters} className="mt-2">
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p>No items in catalog yet</p>
                  <p className="text-sm">Click "Add Item" to create your first item</p>
                </>
              )}
            </div>
          )}
        </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the category details" : "Create a new category for organizing items"}
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Category name" {...field} data-testid="input-category-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Optional description for this category" 
                        {...field} 
                        data-testid="input-category-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={categoryForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Inactive categories won't appear in selection lists
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-category-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)} data-testid="button-cancel-category">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  data-testid="button-save-category"
                >
                  {(createCategoryMutation.isPending || updateCategoryMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingCategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={categoryDeleteDialogOpen} onOpenChange={setCategoryDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot be undone.
              Items using this category may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCategoryId && deleteCategoryMutation.mutate(deletingCategoryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-category"
            >
              {deleteCategoryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the item details" : "Create a new item for the catalog"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Item code" {...field} className="font-mono" data-testid="input-item-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Item name" {...field} data-testid="input-item-name" />
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
                        placeholder="Item description" 
                        {...field} 
                        data-testid="input-item-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeCategories?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
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
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Supplier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-supplier">
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers?.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="unitOfMeasure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measure</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-uom">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNIT_OF_MEASURE_OPTIONS.map((uom) => (
                            <SelectItem key={uom.value} value={uom.value}>
                              {uom.label} ({uom.value})
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
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-item-price" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="minOrderQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Order Qty</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="1" 
                          {...field} 
                          data-testid="input-item-minqty" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="leadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (Days)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        placeholder="Number of days" 
                        {...field} 
                        data-testid="input-item-leadtime" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Inactive items won't appear in selection lists
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-item-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-item">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-item"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingItem ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
              Purchase orders using this item may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-item">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItemId && deleteMutation.mutate(deletingItemId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-item"
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
