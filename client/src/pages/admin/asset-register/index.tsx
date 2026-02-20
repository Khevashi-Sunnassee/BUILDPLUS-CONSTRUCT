import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Package, Plus, Upload, Download } from "lucide-react";
import { ASSET_ROUTES, PROCUREMENT_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import type { Asset, Department } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PageHelpButton } from "@/components/help/page-help-button";
import { CHECKLIST_ROUTES } from "@shared/api-routes";
import type { ChecklistInstance, ChecklistTemplate, ChecklistWorkOrder } from "@shared/schema";
import { calculateCompletionRate, getMissingRequiredFields } from "@/components/checklist/checklist-form";
import {
  assetFormSchema,
  defaultFormValues,
  type AssetFormData,
  type SortField,
  type SortDir,
} from "./types";
import { AssetStatsCards } from "./AssetStatsCards";
import { AssetFilters } from "./AssetFilters";
import { AssetChart } from "./AssetChart";
import { AssetTable } from "./AssetTable";
import { ServiceCallsTab } from "./ServiceCallsTab";
import { AssetFormDialog } from "./AssetFormDialog";
import { AssetImportDialog, AssetDeleteDialog, ServiceChecklistDialog } from "./AssetDialogs";

export default function AssetRegisterPage() {
  useDocumentTitle("Asset Register");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fundingFilter, setFundingFilter] = useState("all");
  const [bookableFilter, setBookableFilter] = useState("all");
  const [transportFilter, setTransportFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported?: number; errors?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [groupByMode, setGroupByMode] = useState<"category" | "month" | "none">("category");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showGraph, setShowGraph] = useState(false);
  const [chartMonthFilter, setChartMonthFilter] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState("assets");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");

  const { data: allRepairRequests = [], isLoading: repairsLoading } = useQuery<any[]>({
    queryKey: [ASSET_ROUTES.REPAIR_REQUESTS],
    queryFn: async () => {
      const res = await fetch(ASSET_ROUTES.REPAIR_REQUESTS, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch service calls");
      return res.json();
    },
  });

  const serviceStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PUT", ASSET_ROUTES.REPAIR_REQUEST_BY_ID(id), { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.REPAIR_REQUESTS] });
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      toast({ title: "Service call updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [serviceChecklistAssetId, setServiceChecklistAssetId] = useState<string | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [serviceInstanceId, setServiceInstanceId] = useState<string | null>(null);
  const [serviceResponses, setServiceResponses] = useState<Record<string, unknown>>({});
  const [serviceHasChanges, setServiceHasChanges] = useState(false);
  const [serviceCompleteDialogOpen, setServiceCompleteDialogOpen] = useState(false);

  const { data: serviceInstance } = useQuery<ChecklistInstance>({
    queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(serviceInstanceId!)],
    enabled: !!serviceInstanceId && serviceDialogOpen,
  });

  const { data: serviceTemplate } = useQuery<ChecklistTemplate>({
    queryKey: [CHECKLIST_ROUTES.TEMPLATE_BY_ID(serviceInstance?.templateId || "")],
    enabled: !!serviceInstance?.templateId && serviceDialogOpen,
  });

  const { data: serviceWorkOrders = [] } = useQuery<ChecklistWorkOrder[]>({
    queryKey: [CHECKLIST_ROUTES.WORK_ORDERS_BY_INSTANCE(serviceInstanceId!)],
    enabled: !!serviceInstanceId && serviceDialogOpen,
  });

  const serviceChecklistMutation = useMutation({
    mutationFn: async (asset: Asset) => {
      const res = await apiRequest("POST", "/api/checklist/instances/from-asset", {
        assetId: asset.id,
        assetName: asset.name || "",
        assetTag: asset.assetTag || "",
        assetCategory: asset.category || "",
        assetLocation: asset.location || "",
        serialNumber: asset.serialNumber || "",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Service checklist created" });
      setServiceChecklistAssetId(null);
      setServiceInstanceId(data.id);
      setServiceResponses(data.responses || {});
      setServiceHasChanges(false);
      setServiceDialogOpen(true);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create service checklist", description: error.message, variant: "destructive" });
      setServiceChecklistAssetId(null);
    },
  });

  const saveServiceMutation = useMutation({
    mutationFn: async () => {
      const completionRate = serviceTemplate ? calculateCompletionRate(serviceTemplate, serviceResponses) : 0;
      return apiRequest("PUT", CHECKLIST_ROUTES.INSTANCE_BY_ID(serviceInstanceId!), {
        responses: serviceResponses,
        completionRate: completionRate.toFixed(2),
        status: serviceInstance?.status === "draft" ? "in_progress" : serviceInstance?.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(serviceInstanceId!)] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.WORK_ORDERS_BY_INSTANCE(serviceInstanceId!)] });
      setServiceHasChanges(false);
      toast({ title: "Saved", description: "Your progress has been saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save progress", variant: "destructive" });
    },
  });

  const completeServiceMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", CHECKLIST_ROUTES.INSTANCE_BY_ID(serviceInstanceId!), {
        responses: serviceResponses,
        completionRate: "100",
      });
      return apiRequest("PATCH", CHECKLIST_ROUTES.INSTANCE_COMPLETE(serviceInstanceId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(serviceInstanceId!)] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.WORK_ORDERS_BY_INSTANCE(serviceInstanceId!)] });
      setServiceHasChanges(false);
      setServiceCompleteDialogOpen(false);
      toast({ title: "Completed", description: "Service checklist has been completed" });
      setServiceDialogOpen(false);
      setServiceInstanceId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete checklist", variant: "destructive" });
    },
  });

  const handleServiceComplete = () => {
    if (!serviceTemplate) return;
    const missing = getMissingRequiredFields(serviceTemplate, serviceResponses);
    if (missing.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please complete: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}`,
        variant: "destructive",
      });
      return;
    }
    setServiceCompleteDialogOpen(true);
  };

  const filteredRepairRequests = useMemo(() => {
    if (serviceStatusFilter === "all") return allRepairRequests;
    return allRepairRequests.filter((r: any) => r.status === serviceStatusFilter);
  }, [allRepairRequests, serviceStatusFilter]);

  const repairStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allRepairRequests.length };
    allRepairRequests.forEach((r: any) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [allRepairRequests]);

  const toggleGroup = (category: string) => {
    setCollapsedGroups(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: [ASSET_ROUTES.LIST],
  });

  const { data: suppliersList = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const { data: departmentsList = [] } = useQuery<Department[]>({
    queryKey: [ADMIN_ROUTES.DEPARTMENTS],
  });
  const activeDepartments = departmentsList.filter((d) => d.isActive);

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: { ...defaultFormValues },
  });

  const watchedFundingMethod = form.watch("fundingMethod");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredAndSortedAssets = useMemo(() => {
    if (!assets) return [];
    const monthNames3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let result = assets.filter((asset) => {
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
      if (bookableFilter !== "all") {
        if (bookableFilter === "yes" && !asset.isBookable) return false;
        if (bookableFilter === "no" && asset.isBookable) return false;
      }
      if (transportFilter !== "all") {
        if (transportFilter === "yes" && !asset.requiresTransport) return false;
        if (transportFilter === "no" && asset.requiresTransport) return false;
      }
      if (chartMonthFilter) {
        if (!asset.purchaseDate) return false;
        const d = new Date(asset.purchaseDate);
        if (isNaN(d.getTime())) return false;
        const label = `${monthNames3[d.getMonth()]} ${d.getFullYear()}`;
        if (label !== chartMonthFilter) return false;
      }
      return true;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let valA: number, valB: number;
        if (sortField === "purchasePrice") {
          valA = a.purchasePrice ? parseFloat(String(a.purchasePrice)) : 0;
          valB = b.purchasePrice ? parseFloat(String(b.purchasePrice)) : 0;
        } else if (sortField === "name") {
          const cmp = (a.name || "").localeCompare(b.name || "");
          return sortDir === "asc" ? cmp : -cmp;
        } else if (sortField === "purchaseDate") {
          valA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
          valB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
        } else if (sortField === "daysSincePurchase") {
          valA = a.purchaseDate ? Math.floor((Date.now() - new Date(a.purchaseDate).getTime()) / 86400000) : -1;
          valB = b.purchaseDate ? Math.floor((Date.now() - new Date(b.purchaseDate).getTime()) / 86400000) : -1;
        } else {
          return 0;
        }
        if (isNaN(valA)) valA = 0;
        if (isNaN(valB)) valB = 0;
        return sortDir === "asc" ? valA - valB : valB - valA;
      });
    }

    return result;
  }, [assets, searchQuery, categoryFilter, statusFilter, fundingFilter, bookableFilter, transportFilter, chartMonthFilter, sortField, sortDir]);

  const groupedAssets = useMemo(() => {
    if (groupByMode === "none") return null;
    const groups: Record<string, Asset[]> = {};
    for (const asset of filteredAndSortedAssets) {
      let key: string;
      if (groupByMode === "month") {
        if (asset.purchaseDate) {
          const d = new Date(asset.purchaseDate);
          if (!isNaN(d.getTime())) {
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
          } else {
            key = "No Purchase Date";
          }
        } else {
          key = "No Purchase Date";
        }
      } else {
        key = asset.category || "Other";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    }
    if (groupByMode === "month") {
      return Object.entries(groups).sort(([a], [b]) => {
        if (a === "No Purchase Date") return 1;
        if (b === "No Purchase Date") return -1;
        const parseMonth = (s: string) => {
          const parts = s.split(" ");
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          return new Date(parseInt(parts[1]), monthNames.indexOf(parts[0])).getTime();
        };
        return parseMonth(b) - parseMonth(a);
      });
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredAndSortedAssets, groupByMode]);

  const stats = useMemo(() => {
    if (!assets) return { total: 0, totalPurchasePrice: 0, totalCurrentValue: 0, active: 0, leased: 0 };
    return {
      total: assets.length,
      totalPurchasePrice: assets.reduce((sum, a) => {
        const val = a.purchasePrice ? parseFloat(String(a.purchasePrice)) : 0;
        return sum + (isNaN(val) ? 0 : val);
      }, 0),
      totalCurrentValue: assets.reduce((sum, a) => {
        const val = a.currentValue ? parseFloat(String(a.currentValue)) : 0;
        return sum + (isNaN(val) ? 0 : val);
      }, 0),
      active: assets.filter((a) => a.status === "active").length,
      leased: assets.filter((a) => a.fundingMethod === "leased").length,
    };
  }, [assets]);

  const chartData = useMemo(() => {
    if (!assets) return [];
    const monthMap: Record<string, { count: number; total: number; sortKey: number }> = {};
    for (const asset of assets) {
      if (!asset.purchaseDate) continue;
      const d = new Date(asset.purchaseDate);
      if (isNaN(d.getTime())) continue;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const sortKey = d.getFullYear() * 100 + d.getMonth();
      if (!monthMap[label]) monthMap[label] = { count: 0, total: 0, sortKey };
      monthMap[label].count += 1;
      const price = asset.purchasePrice ? parseFloat(String(asset.purchasePrice)) : 0;
      monthMap[label].total += isNaN(price) ? 0 : price;
    }
    const sorted = Object.entries(monthMap)
      .sort(([, a], [, b]) => a.sortKey - b.sortKey);
    let cumulative = 0;
    return sorted.map(([month, data]) => {
      cumulative += data.total;
      return { month, count: data.count, total: data.total, cumulativeValue: cumulative };
    });
  }, [assets]);

  const createMutation = useMutation({
    mutationFn: async (data: AssetFormData) => {
      return apiRequest("POST", ASSET_ROUTES.CREATE, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      toast({ title: "Asset created successfully" });
      setDialogOpen(false);
      form.reset(defaultFormValues);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create asset", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AssetFormData & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", ASSET_ROUTES.UPDATE(id), rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      toast({ title: "Asset updated successfully" });
      setDialogOpen(false);
      setEditingAsset(null);
      form.reset(defaultFormValues);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update asset", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ASSET_ROUTES.DELETE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      toast({ title: "Asset deleted" });
      setDeleteDialogOpen(false);
      setDeletingAssetId(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete asset", description: err.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingAsset(null);
    form.reset(defaultFormValues);
    setDialogOpen(true);
  };

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset);
    form.reset({
      name: asset.name || "",
      category: asset.category || "",
      description: asset.description || "",
      quantity: asset.quantity ?? null,
      status: asset.status || "active",
      condition: asset.condition || "good",
      location: asset.location || "",
      department: asset.department || "",
      departmentId: (asset as any).departmentId || null,
      assignedTo: asset.assignedTo || "",
      fundingMethod: asset.fundingMethod || "purchased",
      remarks: asset.remarks || "",
      supplier: asset.supplier || "",
      supplierId: asset.supplierId || "",
      purchaseDate: asset.purchaseDate || "",
      purchasePrice: asset.purchasePrice ? String(asset.purchasePrice) : "",
      warrantyExpiry: asset.warrantyExpiry || "",
      currentValue: asset.currentValue ? String(asset.currentValue) : "",
      usefulLifeYears: asset.usefulLifeYears ?? null,
      depreciationMethod: asset.depreciationMethod || "",
      depreciationRate: asset.depreciationRate ? String(asset.depreciationRate) : "",
      accumulatedDepreciation: asset.accumulatedDepreciation ? String(asset.accumulatedDepreciation) : "",
      depreciationThisPeriod: asset.depreciationThisPeriod ? String(asset.depreciationThisPeriod) : "",
      bookValue: asset.bookValue ? String(asset.bookValue) : "",
      yearsDepreciated: asset.yearsDepreciated ?? null,
      manufacturer: asset.manufacturer || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      registrationNumber: asset.registrationNumber || "",
      engineNumber: asset.engineNumber || "",
      vinNumber: asset.vinNumber || "",
      yearOfManufacture: asset.yearOfManufacture || "",
      countryOfOrigin: asset.countryOfOrigin || "",
      specifications: asset.specifications || "",
      operatingHours: asset.operatingHours ? Number(asset.operatingHours) : null,
      barcode: asset.barcode || "",
      leaseStartDate: asset.leaseStartDate || "",
      leaseEndDate: asset.leaseEndDate || "",
      leaseMonthlyPayment: asset.leaseMonthlyPayment ? String(asset.leaseMonthlyPayment) : "",
      balloonPayment: asset.balloonPayment ? String(asset.balloonPayment) : "",
      leaseTerm: asset.leaseTerm ?? null,
      lessor: asset.lessor || "",
      loanAmount: asset.loanAmount ? String(asset.loanAmount) : "",
      interestRate: asset.interestRate ? String(asset.interestRate) : "",
      loanTerm: asset.loanTerm ?? null,
      lender: asset.lender || "",
      insuranceProvider: asset.insuranceProvider || "",
      insurancePolicyNumber: asset.insurancePolicyNumber || "",
      insurancePremium: asset.insurancePremium ? String(asset.insurancePremium) : "",
      insuranceExcess: asset.insuranceExcess ? String(asset.insuranceExcess) : "",
      insuranceStartDate: asset.insuranceStartDate || "",
      insuranceExpiryDate: asset.insuranceExpiryDate || "",
      insuranceStatus: asset.insuranceStatus || "",
      insuranceNotes: asset.insuranceNotes || "",
      capexRequestId: asset.capexRequestId || "",
      capexDescription: asset.capexDescription || "",
      isBookable: asset.isBookable ?? false,
      requiresTransport: asset.requiresTransport ?? false,
      transportType: asset.transportType || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: AssetFormData) => {
    if (editingAsset) {
      updateMutation.mutate({ ...data, id: editingAsset.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = getCsrfToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      const res = await fetch(ASSET_ROUTES.IMPORT, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response. The file may be too large or took too long to process. Please try again.");
      }
      if (!res.ok) {
        setImportResult({ errors: [result.error || result.message || "Import failed"] });
      } else {
        setImportResult({ imported: result.imported || 0, errors: result.errorDetails || [] });
        queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
        queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE] });
        toast({ title: `Successfully imported ${result.imported || 0} assets` });
      }
    } catch (err: any) {
      setImportResult({ errors: [err.message || "Import failed"] });
    } finally {
      setImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" role="main" aria-label="Asset Register" aria-busy="true">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5" role="main" aria-label="Asset Register">
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
        <div className="flex flex-wrap items-center gap-2">
          <a href={ASSET_ROUTES.TEMPLATE} download>
            <Button variant="outline" data-testid="button-download-template">
              <Download className="h-4 w-4 mr-2" />
              Template
            </Button>
          </a>
          <Button variant="outline" onClick={() => { setImportResult(null); setImportDialogOpen(true); }} data-testid="button-import-assets">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-add-asset">
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      <AssetStatsCards stats={stats} />

      <Tabs value={pageTab} onValueChange={setPageTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
          <TabsTrigger value="service-calls" data-testid="tab-service-calls">
            Service Calls ({allRepairRequests.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {pageTab === "assets" && (<>
        <AssetFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          fundingFilter={fundingFilter}
          setFundingFilter={setFundingFilter}
          bookableFilter={bookableFilter}
          setBookableFilter={setBookableFilter}
          transportFilter={transportFilter}
          setTransportFilter={setTransportFilter}
          groupByMode={groupByMode}
          setGroupByMode={setGroupByMode}
          setCollapsedGroups={setCollapsedGroups}
          showGraph={showGraph}
          setShowGraph={setShowGraph}
          setChartMonthFilter={setChartMonthFilter}
        />

        {showGraph && (
          <AssetChart
            chartData={chartData}
            chartMonthFilter={chartMonthFilter}
            setChartMonthFilter={setChartMonthFilter}
          />
        )}

        <AssetTable
          groupByMode={groupByMode}
          groupedAssets={groupedAssets}
          filteredAndSortedAssets={filteredAndSortedAssets}
          assets={assets}
          collapsedGroups={collapsedGroups}
          toggleGroup={toggleGroup}
          sortField={sortField}
          sortDir={sortDir}
          handleSort={handleSort}
          openEditDialog={openEditDialog}
          setDeletingAssetId={setDeletingAssetId}
          setDeleteDialogOpen={setDeleteDialogOpen}
          navigate={navigate}
          serviceChecklistAssetId={serviceChecklistAssetId}
          setServiceChecklistAssetId={setServiceChecklistAssetId}
          serviceChecklistMutation={serviceChecklistMutation}
        />
      </>)}

      {pageTab === "service-calls" && (
        <ServiceCallsTab
          serviceStatusFilter={serviceStatusFilter}
          setServiceStatusFilter={setServiceStatusFilter}
          filteredRepairRequests={filteredRepairRequests}
          repairStatusCounts={repairStatusCounts}
          repairsLoading={repairsLoading}
          serviceStatusMutation={serviceStatusMutation}
          navigate={navigate}
        />
      )}

      <AssetFormDialog
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        editingAsset={editingAsset}
        form={form}
        onSubmit={onSubmit}
        createMutation={createMutation}
        updateMutation={updateMutation}
        suppliersList={suppliersList}
        activeDepartments={activeDepartments}
        watchedFundingMethod={watchedFundingMethod}
      />

      <AssetImportDialog
        importDialogOpen={importDialogOpen}
        setImportDialogOpen={setImportDialogOpen}
        importing={importing}
        importResult={importResult}
        handleImportFile={handleImportFile}
        fileInputRef={fileInputRef}
      />

      <AssetDeleteDialog
        deleteDialogOpen={deleteDialogOpen}
        setDeleteDialogOpen={setDeleteDialogOpen}
        deletingAssetId={deletingAssetId}
        deleteMutation={deleteMutation}
      />

      <ServiceChecklistDialog
        serviceDialogOpen={serviceDialogOpen}
        setServiceDialogOpen={setServiceDialogOpen}
        serviceInstanceId={serviceInstanceId}
        setServiceInstanceId={setServiceInstanceId}
        serviceHasChanges={serviceHasChanges}
        serviceResponses={serviceResponses}
        setServiceResponses={setServiceResponses}
        setServiceHasChanges={setServiceHasChanges}
        serviceInstance={serviceInstance}
        serviceTemplate={serviceTemplate}
        serviceWorkOrders={serviceWorkOrders}
        saveServiceMutation={saveServiceMutation}
        handleServiceComplete={handleServiceComplete}
        serviceCompleteDialogOpen={serviceCompleteDialogOpen}
        setServiceCompleteDialogOpen={setServiceCompleteDialogOpen}
        completeServiceMutation={completeServiceMutation}
      />
    </div>
  );
}
