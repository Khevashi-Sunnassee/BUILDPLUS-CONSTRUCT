import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SuburbLookup } from "@/components/suburb-lookup";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X,
  Tag,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTitle } from "@/hooks/use-document-title";
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
import type { Supplier } from "@shared/schema";
import { PROCUREMENT_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

interface CostCode {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  keyContact: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  abn: z.string().optional().or(z.literal("")),
  acn: z.string().optional().or(z.literal("")),
  addressLine1: z.string().optional().or(z.literal("")),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  postcode: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  paymentTerms: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  defaultCostCodeId: z.string().optional().nullable().or(z.literal("")),
  isActive: z.boolean().default(true),
  isEquipmentHire: z.boolean().default(false),
  availableForTender: z.boolean().default(false),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

const AUSTRALIAN_STATES = [
  { value: "VIC", label: "Victoria" },
  { value: "NSW", label: "New South Wales" },
  { value: "QLD", label: "Queensland" },
  { value: "SA", label: "South Australia" },
  { value: "WA", label: "Western Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "NT", label: "Northern Territory" },
  { value: "ACT", label: "Australian Capital Territory" },
];

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  details: {
    created: string[];
    updated: string[];
    skipped: string[];
    errors: string[];
  };
}

export default function AdminSuppliersPage() {
  useDocumentTitle("Suppliers");
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [costCodeFilter, setCostCodeFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const toggleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }, [sortColumn]);

  const SortIcon = useCallback(({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  }, [sortColumn, sortDirection]);

  const { data: suppliersRaw, isLoading, isError, error, refetch } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS],
  });

  const { data: costCodes = [] } = useQuery<CostCode[]>({
    queryKey: ["/api/cost-codes"],
  });

  const parentCostCodes = useMemo(() => costCodes.filter(cc => !cc.parentId), [costCodes]);

  const costCodeMap = useMemo(() => {
    const map: Record<string, CostCode> = {};
    for (const cc of parentCostCodes) {
      map[cc.id] = cc;
    }
    return map;
  }, [parentCostCodes]);

  const suppliers = useMemo(() => {
    if (!suppliersRaw) return undefined;
    let filtered = suppliersRaw;
    if (costCodeFilter) {
      if (costCodeFilter === "__none__") {
        filtered = filtered.filter(s => !s.defaultCostCodeId);
      } else {
        filtered = filtered.filter(s => s.defaultCostCodeId === costCodeFilter);
      }
    }
    if (typeFilter) {
      if (typeFilter === "tender") {
        filtered = filtered.filter(s => s.availableForTender);
      } else if (typeFilter === "hire") {
        filtered = filtered.filter(s => s.isEquipmentHire);
      } else if (typeFilter === "tender_hire") {
        filtered = filtered.filter(s => s.availableForTender && s.isEquipmentHire);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.keyContact || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q) ||
        (s.abn || "").toLowerCase().includes(q) ||
        (s.city || "").toLowerCase().includes(q) ||
        (s.defaultCostCodeId && costCodeMap[s.defaultCostCodeId] &&
          (`${costCodeMap[s.defaultCostCodeId].code} ${costCodeMap[s.defaultCostCodeId].name}`).toLowerCase().includes(q))
      );
    }
    return [...filtered].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortColumn) {
        case "name": aVal = a.name || ""; bVal = b.name || ""; break;
        case "keyContact": aVal = a.keyContact || ""; bVal = b.keyContact || ""; break;
        case "email": aVal = a.email || ""; bVal = b.email || ""; break;
        case "phone": aVal = a.phone || ""; bVal = b.phone || ""; break;
        case "abn": aVal = a.abn || ""; bVal = b.abn || ""; break;
        case "costCode": {
          const aCc = a.defaultCostCodeId ? costCodeMap[a.defaultCostCodeId] : null;
          const bCc = b.defaultCostCodeId ? costCodeMap[b.defaultCostCodeId] : null;
          aVal = aCc ? `${aCc.code} ${aCc.name}` : "";
          bVal = bCc ? `${bCc.code} ${bCc.name}` : "";
          break;
        }
        case "type": {
          const aType = [a.availableForTender ? "Tender" : "", a.isEquipmentHire ? "Hire" : ""].filter(Boolean).join(" ");
          const bType = [b.availableForTender ? "Tender" : "", b.isEquipmentHire ? "Hire" : ""].filter(Boolean).join(" ");
          aVal = aType;
          bVal = bType;
          break;
        }
        case "status": aVal = a.isActive ? "Active" : "Inactive"; bVal = b.isActive ? "Active" : "Inactive"; break;
        default: aVal = a.name || ""; bVal = b.name || "";
      }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [suppliersRaw, sortColumn, sortDirection, searchQuery, costCodeFilter, typeFilter, costCodeMap]);

  const totalPages = Math.ceil((suppliers?.length || 0) / pageSize);
  const paginatedSuppliers = useMemo(() => {
    if (!suppliers) return [];
    const start = (currentPage - 1) * pageSize;
    return suppliers.slice(start, start + pageSize);
  }, [suppliers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortColumn, sortDirection, costCodeFilter, typeFilter]);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = getCsrfToken();
      const res = await fetch(PROCUREMENT_ROUTES.SUPPLIERS_IMPORT, {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        throw new Error(err.error || "Import failed");
      }
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE] });
      toast({
        title: "Import complete",
        description: `${result.created} created, ${result.updated} updated, ${result.skipped} unchanged`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    importMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    window.open(PROCUREMENT_ROUTES.SUPPLIERS_TEMPLATE, "_blank");
  };

  const handleExport = () => {
    window.open(PROCUREMENT_ROUTES.SUPPLIERS_EXPORT, "_blank");
  };

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      keyContact: "",
      email: "",
      phone: "",
      abn: "",
      acn: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postcode: "",
      country: "Australia",
      paymentTerms: "",
      notes: "",
      defaultCostCodeId: "",
      isActive: true,
      isEquipmentHire: false,
      availableForTender: false,
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      return apiRequest("POST", PROCUREMENT_ROUTES.SUPPLIERS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_EQUIPMENT_HIRE] });
      toast({ title: "Supplier created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create supplier", description: error.message, variant: "destructive" });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SupplierFormData }) => {
      return apiRequest("PATCH", PROCUREMENT_ROUTES.SUPPLIER_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_EQUIPMENT_HIRE] });
      toast({ title: "Supplier updated successfully" });
      setDialogOpen(false);
      setEditingSupplier(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update supplier", description: error.message, variant: "destructive" });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", PROCUREMENT_ROUTES.SUPPLIER_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS] });
      toast({ title: "Supplier deleted" });
      setDeleteDialogOpen(false);
      setDeletingSupplierId(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete supplier", description: error.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingSupplier(null);
    form.reset({
      name: "",
      keyContact: "",
      email: "",
      phone: "",
      abn: "",
      acn: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postcode: "",
      country: "Australia",
      paymentTerms: "",
      notes: "",
      defaultCostCodeId: "",
      isActive: true,
      isEquipmentHire: false,
      availableForTender: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    form.reset({
      name: supplier.name,
      keyContact: supplier.keyContact || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      abn: supplier.abn || "",
      acn: supplier.acn || "",
      addressLine1: supplier.addressLine1 || "",
      addressLine2: supplier.addressLine2 || "",
      city: supplier.city || "",
      state: supplier.state || "",
      postcode: supplier.postcode || "",
      country: supplier.country || "Australia",
      paymentTerms: supplier.paymentTerms || "",
      notes: supplier.notes || "",
      defaultCostCodeId: supplier.defaultCostCodeId || "",
      isActive: supplier.isActive,
      isEquipmentHire: supplier.isEquipmentHire,
      availableForTender: supplier.availableForTender,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: SupplierFormData) => {
    const payload = {
      ...data,
      defaultCostCodeId: data.defaultCostCodeId || null,
    };
    if (editingSupplier) {
      updateSupplierMutation.mutate({ id: editingSupplier.id, data: payload });
    } else {
      createSupplierMutation.mutate(payload);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Suppliers Management">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6" role="main" aria-label="Suppliers Management">
        <QueryErrorState error={error} onRetry={refetch} message="Failed to load suppliers" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Suppliers Management">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-suppliers-title">Supplier Management</h1>
            <PageHelpButton pageHelpKey="page.admin.suppliers" />
          </div>
          <p className="text-muted-foreground">Manage suppliers and their contact information</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport} data-testid="button-export-suppliers">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => { setImportResult(null); setImportDialogOpen(true); }} data-testid="button-import-suppliers">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-supplier">
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9 pr-9"
            data-testid="input-search-suppliers"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search-suppliers"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="w-[250px]">
          <Select value={costCodeFilter || "all"} onValueChange={(v) => setCostCodeFilter(v === "all" ? "" : v)}>
            <SelectTrigger data-testid="select-filter-cost-code">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <SelectValue placeholder="Filter by cost code..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cost Codes</SelectItem>
              <SelectItem value="__none__">No Cost Code</SelectItem>
              {parentCostCodes.filter(cc => cc.isActive).map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  {cc.code} - {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
            <SelectTrigger data-testid="select-filter-type">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <SelectValue placeholder="Filter by type..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="tender">Available for Tender</SelectItem>
              <SelectItem value="hire">Equipment Hire</SelectItem>
              <SelectItem value="tender_hire">Tender &amp; Hire</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(costCodeFilter || typeFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setCostCodeFilter(""); setTypeFilter(""); }}
            data-testid="button-clear-filters"
          >
            <X className="h-3 w-3 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Suppliers
          </CardTitle>
          <CardDescription>
            {suppliers?.length || 0} supplier{suppliers?.length !== 1 ? "s" : ""}{searchQuery ? " found" : " configured"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suppliers && suppliers.length > 0 ? (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")} data-testid="sort-supplier-name">
                    <span className="flex items-center">Name<SortIcon column="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("keyContact")} data-testid="sort-supplier-contact">
                    <span className="flex items-center">Key Contact<SortIcon column="keyContact" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("email")} data-testid="sort-supplier-email">
                    <span className="flex items-center">Email<SortIcon column="email" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("phone")} data-testid="sort-supplier-phone">
                    <span className="flex items-center">Phone<SortIcon column="phone" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("costCode")} data-testid="sort-supplier-cost-code">
                    <span className="flex items-center">Cost Code<SortIcon column="costCode" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("type")} data-testid="sort-supplier-type">
                    <span className="flex items-center">Type<SortIcon column="type" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")} data-testid="sort-supplier-status">
                    <span className="flex items-center">Status<SortIcon column="status" /></span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                    <TableCell className="font-medium" data-testid={`text-supplier-name-${supplier.id}`}>
                      {supplier.name}
                    </TableCell>
                    <TableCell data-testid={`text-supplier-contact-${supplier.id}`}>
                      {supplier.keyContact || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-supplier-email-${supplier.id}`}>
                      {supplier.email || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-supplier-phone-${supplier.id}`}>
                      {supplier.phone || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-supplier-cost-code-${supplier.id}`}>
                      {supplier.defaultCostCodeId && costCodeMap[supplier.defaultCostCodeId] ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          {costCodeMap[supplier.defaultCostCodeId].code} - {costCodeMap[supplier.defaultCostCodeId].name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-supplier-type-${supplier.id}`}>
                      <div className="flex items-center gap-1 flex-wrap">
                        {supplier.availableForTender && (
                          <Badge variant="outline" data-testid={`badge-supplier-tender-${supplier.id}`}>
                            Tender
                          </Badge>
                        )}
                        {supplier.isEquipmentHire && (
                          <Badge variant="outline" data-testid={`badge-supplier-hire-${supplier.id}`}>
                            Hire
                          </Badge>
                        )}
                        {!supplier.availableForTender && !supplier.isEquipmentHire && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.isActive ? "default" : "secondary"} data-testid={`badge-supplier-status-${supplier.id}`}>
                        {supplier.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(supplier)}
                          data-testid={`button-edit-supplier-${supplier.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingSupplierId(supplier.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-supplier-${supplier.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 pt-4">
                <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                  Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, suppliers?.length || 0)} of {suppliers?.length || 0}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} data-testid="button-prev-page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2" data-testid="text-current-page">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} data-testid="button-next-page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No suppliers configured yet</p>
              <p className="text-sm">Click "Add Supplier" to create your first supplier</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
            <DialogDescription>
              {editingSupplier ? "Update the supplier details" : "Create a new supplier for your organization"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Supplier name" {...field} data-testid="input-supplier-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="keyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Contact</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact person" {...field} data-testid="input-supplier-key-contact" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-supplier-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+61 400 000 000" {...field} data-testid="input-supplier-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Net 30" {...field} data-testid="input-supplier-payment-terms" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="defaultCostCodeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Cost Code (Parent)</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-supplier-cost-code">
                          <SelectValue placeholder="Select cost code..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No cost code</SelectItem>
                        {parentCostCodes.filter(cc => cc.isActive).map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.code} - {cc.name}
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
                  control={form.control}
                  name="abn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ABN</FormLabel>
                      <FormControl>
                        <Input placeholder="00 000 000 000" {...field} className="font-mono" data-testid="input-supplier-abn" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="acn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ACN</FormLabel>
                      <FormControl>
                        <Input placeholder="000 000 000" {...field} className="font-mono" data-testid="input-supplier-acn" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="Street address" {...field} data-testid="input-supplier-address1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Unit, building, etc." {...field} data-testid="input-supplier-address2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City / Suburb</FormLabel>
                      <FormControl>
                        <SuburbLookup
                          value={field.value || ""}
                          onChange={field.onChange}
                          onSelect={(result) => {
                            field.onChange(result.suburb);
                            form.setValue("state", result.state);
                            form.setValue("postcode", result.postcode);
                          }}
                          placeholder="Start typing suburb..."
                          data-testid="input-supplier-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-supplier-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AUSTRALIAN_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
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
                  name="postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input placeholder="0000" {...field} data-testid="input-supplier-postcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Australia" {...field} data-testid="input-supplier-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about this supplier" 
                        {...field} 
                        data-testid="input-supplier-notes"
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
                        Inactive suppliers won't appear in selection lists
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-supplier-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="availableForTender"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Available for Tender</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        This supplier will appear in the Tender Center members list
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-supplier-available-tender"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isEquipmentHire"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Equipment Hire</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        This supplier will appear in the Hire Booking form
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-supplier-equipment-hire"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-supplier">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}
                  data-testid="button-save-supplier"
                >
                  {(createSupplierMutation.isPending || updateSupplierMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingSupplier ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-supplier">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSupplierId && deleteSupplierMutation.mutate(deletingSupplierId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-supplier"
            >
              {deleteSupplierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Suppliers
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file to import suppliers. Existing suppliers (matched by name) will have their missing details updated. New suppliers will be created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-download-supplier-template">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <p className="text-sm text-muted-foreground">Use this template for best results</p>
            </div>

            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-supplier-import-file"
              />
              {importMutation.isPending ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Importing suppliers...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-select-supplier-file"
                  >
                    Select File
                  </Button>
                  <p className="text-sm text-muted-foreground">Accepts .xlsx, .xls, or .csv files</p>
                </div>
              )}
            </div>

            {importResult && (
              <div className="space-y-3 border rounded-md p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Import Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{importResult.created}</Badge>
                    <span>New suppliers created</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{importResult.updated}</Badge>
                    <span>Suppliers updated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{importResult.skipped}</Badge>
                    <span>Unchanged (skipped)</span>
                  </div>
                  {importResult.errors > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{importResult.errors}</Badge>
                      <span>Errors</span>
                    </div>
                  )}
                </div>

                {importResult.details.created.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Created:</p>
                    <p className="text-xs">{importResult.details.created.join(", ")}</p>
                  </div>
                )}
                {importResult.details.updated.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Updated:</p>
                    <p className="text-xs">{importResult.details.updated.join(", ")}</p>
                  </div>
                )}
                {importResult.details.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Errors:</p>
                    {importResult.details.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive flex items-start gap-1">
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-close-import-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
