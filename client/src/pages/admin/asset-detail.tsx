import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHelpButton } from "@/components/help/page-help-button";
import DOMPurify from "dompurify";
import { ASSET_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import type { Asset, AssetMaintenance, AssetTransfer, AssetRepairRequest, Department } from "@shared/schema";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_CONDITIONS,
  ASSET_FUNDING_METHODS,
} from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  ArrowLeft,
  Pencil,
  Trash2,
  Sparkles,
  Plus,
  Loader2,
  ImageIcon,
  RefreshCw,
  Wrench,
} from "lucide-react";

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(num);
};

const displayValue = (val: string | number | null | undefined) => {
  if (val === null || val === undefined || val === "") return "-";
  return String(val);
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span>-</span>;
  const colorMap: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    awaiting_service: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    in_service: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    disposed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    sold: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    stolen: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    lost: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  };
  const labelMap: Record<string, string> = {
    awaiting_service: "Awaiting Service",
    in_service: "In Service",
  };
  return (
    <Badge
      data-testid="badge-asset-status"
      className={`capitalize ${colorMap[status] || ""}`}
    >
      {labelMap[status] || status}
    </Badge>
  );
}

function FieldDisplay({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm" data-testid={testId}>{value}</p>
    </div>
  );
}

export default function AssetDetailPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/assets/:id");
  const id = params?.id;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("basic");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [basicEditOpen, setBasicEditOpen] = useState(false);
  const [financialEditOpen, setFinancialEditOpen] = useState(false);
  const [technicalEditOpen, setTechnicalEditOpen] = useState(false);
  const [insuranceEditOpen, setInsuranceEditOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  const [basicForm, setBasicForm] = useState<Record<string, any>>({});
  const [financialForm, setFinancialForm] = useState<Record<string, any>>({});
  const [technicalForm, setTechnicalForm] = useState<Record<string, any>>({});
  const [insuranceForm, setInsuranceForm] = useState<Record<string, any>>({});
  const [maintenanceForm, setMaintenanceForm] = useState<Record<string, any>>({});
  const [transferForm, setTransferForm] = useState<Record<string, any>>({});

  const { data: asset, isLoading } = useQuery<Asset>({
    queryKey: [ASSET_ROUTES.BY_ID(id!), id],
    enabled: !!id,
  });

  const { data: maintenanceRecords = [], isLoading: maintenanceLoading } = useQuery<AssetMaintenance[]>({
    queryKey: [ASSET_ROUTES.MAINTENANCE, id],
    queryFn: async () => {
      const res = await fetch(ASSET_ROUTES.MAINTENANCE(id!), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch maintenance records");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: transfers = [], isLoading: transfersLoading } = useQuery<AssetTransfer[]>({
    queryKey: [ASSET_ROUTES.TRANSFERS, id],
    queryFn: async () => {
      const res = await fetch(ASSET_ROUTES.TRANSFERS(id!), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transfers");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: departmentsList = [] } = useQuery<Department[]>({
    queryKey: [ADMIN_ROUTES.DEPARTMENTS],
  });
  const activeDepartments = departmentsList.filter((d) => d.isActive);

  const { data: repairRequests = [], isLoading: repairsLoading } = useQuery<any[]>({
    queryKey: [ASSET_ROUTES.REPAIR_REQUESTS_BY_ASSET(id!), id],
    queryFn: async () => {
      const res = await fetch(ASSET_ROUTES.REPAIR_REQUESTS_BY_ASSET(id!), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch repair requests");
      return res.json();
    },
    enabled: !!id,
  });

  const invalidateAsset = () => {
    queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
    queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.BY_ID(id!), id] });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("PUT", ASSET_ROUTES.BY_ID(id!), data);
    },
    onSuccess: () => {
      invalidateAsset();
      toast({ title: "Asset updated successfully" });
      setBasicEditOpen(false);
      setFinancialEditOpen(false);
      setTechnicalEditOpen(false);
      setInsuranceEditOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update asset", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", ASSET_ROUTES.BY_ID(id!), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      toast({ title: "Asset deleted" });
      navigate("/admin/asset-register");
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete asset", description: error.message, variant: "destructive" });
    },
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", ASSET_ROUTES.AI_SUMMARY(id!), {});
    },
    onSuccess: () => {
      invalidateAsset();
      toast({ title: "AI analysis generated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to generate AI analysis", description: error.message, variant: "destructive" });
    },
  });

  const addMaintenanceMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("POST", ASSET_ROUTES.MAINTENANCE(id!), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.MAINTENANCE, id] });
      toast({ title: "Maintenance record added" });
      setMaintenanceDialogOpen(false);
      setMaintenanceForm({});
    },
    onError: (error: any) => {
      toast({ title: "Failed to add maintenance record", description: error.message, variant: "destructive" });
    },
  });

  const deleteMaintenanceMutation = useMutation({
    mutationFn: async (recordId: string) => {
      return apiRequest("DELETE", ASSET_ROUTES.MAINTENANCE_BY_ID(id!, recordId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.MAINTENANCE, id] });
      toast({ title: "Maintenance record deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete record", description: error.message, variant: "destructive" });
    },
  });

  const serviceRequestMutation = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error("Asset not loaded");
      const res = await apiRequest("POST", "/api/checklist/instances/from-asset", {
        assetId: id,
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
      navigate(`/checklists/${data.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create service checklist", description: error.message, variant: "destructive" });
    },
  });

  const addTransferMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("POST", ASSET_ROUTES.TRANSFERS(id!), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.TRANSFERS, id] });
      toast({ title: "Transfer recorded" });
      setTransferDialogOpen(false);
      setTransferForm({});
    },
    onError: (error: any) => {
      toast({ title: "Failed to record transfer", description: error.message, variant: "destructive" });
    },
  });

  const openBasicEdit = () => {
    if (!asset) return;
    setBasicForm({
      name: asset.name || "",
      description: asset.description || "",
      category: asset.category || "",
      status: asset.status || "active",
      condition: asset.condition || "",
      location: asset.location || "",
      department: asset.department || "",
      departmentId: (asset as any).departmentId || null,
      assignedTo: asset.assignedTo || "",
      fundingMethod: asset.fundingMethod || "",
      quantity: asset.quantity ?? 1,
      barcode: asset.barcode || "",
      qrCode: asset.qrCode || "",
      remarks: asset.remarks || "",
    });
    setBasicEditOpen(true);
  };

  const openFinancialEdit = () => {
    if (!asset) return;
    setFinancialForm({
      purchasePrice: asset.purchasePrice || "",
      currentValue: asset.currentValue || "",
      depreciationMethod: asset.depreciationMethod || "",
      depreciationRate: asset.depreciationRate || "",
      accumulatedDepreciation: asset.accumulatedDepreciation || "",
      depreciationThisPeriod: asset.depreciationThisPeriod || "",
      bookValue: asset.bookValue || "",
      yearsDepreciated: asset.yearsDepreciated ?? "",
      usefulLifeYears: asset.usefulLifeYears ?? "",
      purchaseDate: asset.purchaseDate || "",
      supplier: asset.supplier || "",
      warrantyExpiry: asset.warrantyExpiry || "",
      leaseStartDate: asset.leaseStartDate || "",
      leaseEndDate: asset.leaseEndDate || "",
      leaseMonthlyPayment: asset.leaseMonthlyPayment || "",
      balloonPayment: asset.balloonPayment || "",
      leaseTerm: asset.leaseTerm ?? "",
      lessor: asset.lessor || "",
      loanAmount: asset.loanAmount || "",
      interestRate: asset.interestRate || "",
      loanTerm: asset.loanTerm ?? "",
      lender: asset.lender || "",
    });
    setFinancialEditOpen(true);
  };

  const openTechnicalEdit = () => {
    if (!asset) return;
    setTechnicalForm({
      manufacturer: asset.manufacturer || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      registrationNumber: asset.registrationNumber || "",
      engineNumber: asset.engineNumber || "",
      vinNumber: asset.vinNumber || "",
      yearOfManufacture: asset.yearOfManufacture || "",
      countryOfOrigin: asset.countryOfOrigin || "",
      specifications: asset.specifications || "",
      operatingHours: asset.operatingHours || "",
    });
    setTechnicalEditOpen(true);
  };

  const openInsuranceEdit = () => {
    if (!asset) return;
    setInsuranceForm({
      insuranceProvider: asset.insuranceProvider || "",
      insurancePolicyNumber: asset.insurancePolicyNumber || "",
      insurancePremium: asset.insurancePremium || "",
      insuranceExcess: asset.insuranceExcess || "",
      insuranceStartDate: asset.insuranceStartDate || "",
      insuranceExpiryDate: asset.insuranceExpiryDate || "",
      insuranceStatus: asset.insuranceStatus || "",
      insuranceNotes: asset.insuranceNotes || "",
    });
    setInsuranceEditOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Asset not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/admin/asset-register")}
          data-testid="button-back-to-register"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Asset Register
        </Button>
      </div>
    );
  }

  const photos = Array.isArray(asset.photos) ? asset.photos : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/asset-register")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate" data-testid="text-asset-name">
              {asset.name}
            </h1>
            <PageHelpButton pageHelpKey="page.admin.asset-detail" />
          </div>
          <Badge variant="outline" data-testid="badge-asset-tag" className="mt-1">
            {asset.assetTag}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={asset.status} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={openBasicEdit}
                data-testid="button-edit-asset"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit asset details</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                data-testid="button-delete-asset"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent>Permanently delete this asset</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => aiMutation.mutate()}
                disabled={aiMutation.isPending}
                data-testid="button-generate-ai"
              >
                {aiMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate AI Analysis
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate an AI-powered summary and analysis of this asset</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams({
                    create: "replacement",
                    assetId: id!,
                    assetName: asset.name || "",
                    assetTag: asset.assetTag || "",
                    assetCategory: asset.category || "",
                    assetCurrentValue: asset.currentValue || "",
                    assetLocation: asset.location || "",
                  });
                  navigate(`/capex-requests?${params.toString()}`);
                }}
                data-testid="button-replace-asset"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Replace
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create a CAPEX replacement request for this asset</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => serviceRequestMutation.mutate()}
                disabled={serviceRequestMutation.isPending}
                data-testid="button-repair-asset"
              >
                {serviceRequestMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wrench className="mr-2 h-4 w-4" />
                )}
                Service / Repair
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open an Equipment Maintenance checklist for service or repair</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap" data-testid="tabs-list">
          <TabsTrigger value="basic" data-testid="tab-basic">Basic Information</TabsTrigger>
          <TabsTrigger value="photos" data-testid="tab-photos">Photos</TabsTrigger>
          <TabsTrigger value="financial" data-testid="tab-financial">Financial</TabsTrigger>
          <TabsTrigger value="technical" data-testid="tab-technical">Technical</TabsTrigger>
          <TabsTrigger value="insurance" data-testid="tab-insurance">Insurance</TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="transfers" data-testid="tab-transfers">Transfers</TabsTrigger>
          <TabsTrigger value="repairs" data-testid="tab-repairs">Repairs</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">AI Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Basic Information</CardTitle>
              <Button variant="outline" onClick={openBasicEdit} data-testid="button-edit-basic">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldDisplay label="Asset Tag" value={displayValue(asset.assetTag)} testId="text-asset-tag" />
                <FieldDisplay label="Name" value={displayValue(asset.name)} testId="text-name" />
                <FieldDisplay label="Description" value={displayValue(asset.description)} testId="text-description" />
                <FieldDisplay label="Category" value={displayValue(asset.category)} testId="text-category" />
                <FieldDisplay label="Status" value={displayValue(asset.status)} testId="text-status" />
                <FieldDisplay label="Condition" value={displayValue(asset.condition)} testId="text-condition" />
                <FieldDisplay label="Location" value={displayValue(asset.location)} testId="text-location" />
                <FieldDisplay label="Department" value={displayValue(asset.department)} testId="text-department" />
                <FieldDisplay label="Assigned To" value={displayValue(asset.assignedTo)} testId="text-assigned-to" />
                <FieldDisplay label="Funding Method" value={displayValue(asset.fundingMethod)} testId="text-funding-method" />
                <FieldDisplay label="Quantity" value={displayValue(asset.quantity)} testId="text-quantity" />
                <FieldDisplay label="Barcode" value={displayValue(asset.barcode)} testId="text-barcode" />
                <FieldDisplay label="QR Code" value={displayValue(asset.qrCode)} testId="text-qr-code" />
                <FieldDisplay label="Remarks" value={displayValue(asset.remarks)} testId="text-remarks" />
                <FieldDisplay label="Bookable" value={asset.isBookable ? "Yes" : "No"} testId="text-bookable" />
                <FieldDisplay label="Requires Transport" value={asset.requiresTransport ? "Yes" : "No"} testId="text-requires-transport" />
                {asset.requiresTransport && (
                  <FieldDisplay label="Transport Type" value={displayValue(asset.transportType)} testId="text-transport-type" />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Photos are managed through the Document Register
              </p>
              {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <p>No photos available for this asset.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((photo: any, idx: number) => (
                    <div key={idx} className="border rounded-md p-2 space-y-2">
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt={photo.description || `Photo ${idx + 1}`}
                          className="w-full h-40 object-cover rounded-md"
                          data-testid={`img-photo-${idx}`}
                        />
                      ) : (
                        <div className="w-full h-40 bg-muted rounded-md flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {photo.description && (
                        <p className="text-xs text-muted-foreground">{photo.description}</p>
                      )}
                      {photo.category && (
                        <Badge variant="outline" className="text-xs">{photo.category}</Badge>
                      )}
                      {photo.tags && Array.isArray(photo.tags) && (
                        <div className="flex flex-wrap gap-1">
                          {photo.tags.map((tag: string, ti: number) => (
                            <Badge key={ti} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Financial Information</CardTitle>
              <Button variant="outline" onClick={openFinancialEdit} data-testid="button-edit-financial">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldDisplay label="Purchase Price" value={formatCurrency(asset.purchasePrice)} testId="text-purchase-price" />
                <FieldDisplay label="Current Value" value={formatCurrency(asset.currentValue)} testId="text-current-value" />
                <FieldDisplay label="Depreciation Method" value={displayValue(asset.depreciationMethod)} testId="text-depreciation-method" />
                <FieldDisplay label="Depreciation Rate" value={asset.depreciationRate ? `${asset.depreciationRate}%` : "-"} testId="text-depreciation-rate" />
                <FieldDisplay label="Accumulated Depreciation" value={formatCurrency(asset.accumulatedDepreciation)} testId="text-accumulated-depreciation" />
                <FieldDisplay label="Depreciation This Period" value={formatCurrency(asset.depreciationThisPeriod)} testId="text-depreciation-period" />
                <FieldDisplay label="Book Value" value={formatCurrency(asset.bookValue)} testId="text-book-value" />
                <FieldDisplay label="Years Depreciated" value={displayValue(asset.yearsDepreciated)} testId="text-years-depreciated" />
                <FieldDisplay label="Useful Life (Years)" value={displayValue(asset.usefulLifeYears)} testId="text-useful-life" />
                <FieldDisplay label="Purchase Date" value={displayValue(asset.purchaseDate)} testId="text-purchase-date" />
                <FieldDisplay label="Supplier" value={displayValue(asset.supplier)} testId="text-supplier" />
                <FieldDisplay label="Warranty Expiry" value={displayValue(asset.warrantyExpiry)} testId="text-warranty-expiry" />
              </div>

              {asset.fundingMethod === "leased" && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Lease Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldDisplay label="Lease Start Date" value={displayValue(asset.leaseStartDate)} testId="text-lease-start" />
                    <FieldDisplay label="Lease End Date" value={displayValue(asset.leaseEndDate)} testId="text-lease-end" />
                    <FieldDisplay label="Monthly Payment" value={formatCurrency(asset.leaseMonthlyPayment)} testId="text-lease-payment" />
                    <FieldDisplay label="Balloon Payment" value={formatCurrency(asset.balloonPayment)} testId="text-balloon-payment" />
                    <FieldDisplay label="Lease Term (months)" value={displayValue(asset.leaseTerm)} testId="text-lease-term" />
                    <FieldDisplay label="Lessor" value={displayValue(asset.lessor)} testId="text-lessor" />
                  </div>
                </div>
              )}

              {asset.fundingMethod === "financed" && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Finance Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldDisplay label="Loan Amount" value={formatCurrency(asset.loanAmount)} testId="text-loan-amount" />
                    <FieldDisplay label="Interest Rate" value={asset.interestRate ? `${asset.interestRate}%` : "-"} testId="text-interest-rate" />
                    <FieldDisplay label="Loan Term (months)" value={displayValue(asset.loanTerm)} testId="text-loan-term" />
                    <FieldDisplay label="Lender" value={displayValue(asset.lender)} testId="text-lender" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technical">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Technical Information</CardTitle>
              <Button variant="outline" onClick={openTechnicalEdit} data-testid="button-edit-technical">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldDisplay label="Manufacturer" value={displayValue(asset.manufacturer)} testId="text-manufacturer" />
                <FieldDisplay label="Model" value={displayValue(asset.model)} testId="text-model" />
                <FieldDisplay label="Serial Number" value={displayValue(asset.serialNumber)} testId="text-serial-number" />
                <FieldDisplay label="Registration Number" value={displayValue(asset.registrationNumber)} testId="text-registration-number" />
                <FieldDisplay label="Engine Number" value={displayValue(asset.engineNumber)} testId="text-engine-number" />
                <FieldDisplay label="VIN Number" value={displayValue(asset.vinNumber)} testId="text-vin-number" />
                <FieldDisplay label="Year of Manufacture" value={displayValue(asset.yearOfManufacture)} testId="text-year-manufacture" />
                <FieldDisplay label="Country of Origin" value={displayValue(asset.countryOfOrigin)} testId="text-country-origin" />
                <FieldDisplay label="Specifications" value={displayValue(asset.specifications)} testId="text-specifications" />
                <FieldDisplay label="Operating Hours" value={displayValue(asset.operatingHours)} testId="text-operating-hours" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Insurance Information</CardTitle>
              <Button variant="outline" onClick={openInsuranceEdit} data-testid="button-edit-insurance">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldDisplay label="Insurance Provider" value={displayValue(asset.insuranceProvider)} testId="text-insurance-provider" />
                <FieldDisplay label="Policy Number" value={displayValue(asset.insurancePolicyNumber)} testId="text-policy-number" />
                <FieldDisplay label="Premium (annual)" value={formatCurrency(asset.insurancePremium)} testId="text-premium" />
                <FieldDisplay label="Excess" value={formatCurrency(asset.insuranceExcess)} testId="text-excess" />
                <FieldDisplay label="Start Date" value={displayValue(asset.insuranceStartDate)} testId="text-insurance-start" />
                <FieldDisplay label="Expiry Date" value={displayValue(asset.insuranceExpiryDate)} testId="text-insurance-expiry" />
                <FieldDisplay label="Insurance Status" value={displayValue(asset.insuranceStatus)} testId="text-insurance-status" />
                <FieldDisplay label="Insurance Notes" value={displayValue(asset.insuranceNotes)} testId="text-insurance-notes" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Maintenance Records</CardTitle>
              <Button
                onClick={() => {
                  setMaintenanceForm({ maintenanceType: "", maintenanceDate: "", cost: "", serviceProvider: "", description: "" });
                  setMaintenanceDialogOpen(true);
                }}
                data-testid="button-add-maintenance"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Record
              </Button>
            </CardHeader>
            <CardContent>
              {maintenanceLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : maintenanceRecords.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No maintenance records found.</p>
              ) : (
                <Table data-testid="table-maintenance">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Service Provider</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceRecords.map((record) => (
                      <TableRow key={record.id} data-testid={`row-maintenance-${record.id}`}>
                        <TableCell>{displayValue(record.maintenanceDate)}</TableCell>
                        <TableCell>{displayValue(record.maintenanceType)}</TableCell>
                        <TableCell>{displayValue(record.description)}</TableCell>
                        <TableCell>{displayValue(record.serviceProvider)}</TableCell>
                        <TableCell>{formatCurrency(record.cost)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMaintenanceMutation.mutate(record.id)}
                            data-testid={`button-delete-maintenance-${record.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Transfer History</CardTitle>
              <Button
                onClick={() => {
                  setTransferForm({ transferDate: "", fromLocation: "", toLocation: "", fromDepartment: "", toDepartment: "", fromAssignee: "", toAssignee: "", reason: "" });
                  setTransferDialogOpen(true);
                }}
                data-testid="button-add-transfer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Transfer
              </Button>
            </CardHeader>
            <CardContent>
              {transfersLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : transfers.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No transfer records found.</p>
              ) : (
                <Table data-testid="table-transfers">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From Location</TableHead>
                      <TableHead>To Location</TableHead>
                      <TableHead>From Dept</TableHead>
                      <TableHead>To Dept</TableHead>
                      <TableHead>From Assignee</TableHead>
                      <TableHead>To Assignee</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Transferred By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((t) => (
                      <TableRow key={t.id} data-testid={`row-transfer-${t.id}`}>
                        <TableCell>{displayValue(t.transferDate)}</TableCell>
                        <TableCell>{displayValue(t.fromLocation)}</TableCell>
                        <TableCell>{displayValue(t.toLocation)}</TableCell>
                        <TableCell>{displayValue(t.fromDepartment)}</TableCell>
                        <TableCell>{displayValue(t.toDepartment)}</TableCell>
                        <TableCell>{displayValue(t.fromAssignee)}</TableCell>
                        <TableCell>{displayValue(t.toAssignee)}</TableCell>
                        <TableCell>{displayValue(t.reason)}</TableCell>
                        <TableCell>{displayValue(t.transferredBy)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repairs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Repair / Service History</CardTitle>
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/asset-repair/new?assetId=${id}`)}
                data-testid="button-new-repair"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            </CardHeader>
            <CardContent>
              {repairsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : repairRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wrench className="h-12 w-12 mb-2" />
                  <p>No repair or service requests for this asset.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repair #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Est. Cost</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairRequests.map((r: any) => (
                      <TableRow key={r.id} data-testid={`row-repair-${r.id}`}>
                        <TableCell className="font-mono text-sm" data-testid={`text-repair-number-${r.id}`}>
                          {r.repairNumber}
                        </TableCell>
                        <TableCell data-testid={`text-repair-title-${r.id}`}>{r.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              r.priority === "URGENT" ? "border-red-500 text-red-700 dark:text-red-400" :
                              r.priority === "HIGH" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                              r.priority === "MEDIUM" ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" :
                              "border-muted-foreground"
                            }
                            data-testid={`badge-priority-${r.id}`}
                          >
                            {r.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={r.status === "COMPLETED" ? "default" : "outline"}
                            data-testid={`badge-status-${r.id}`}
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.requestedDate ? new Date(r.requestedDate).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.estimatedCost
                            ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(r.estimatedCost))
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/asset-repair/new?assetId=${id}&editId=${r.id}`)}
                            data-testid={`button-edit-repair-${r.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>AI Summary</CardTitle>
              <Button
                onClick={() => aiMutation.mutate()}
                disabled={aiMutation.isPending}
                data-testid="button-generate-ai-tab"
              >
                {aiMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate AI Analysis
              </Button>
            </CardHeader>
            <CardContent>
              {asset.aiSummary ? (
                <div>
                  <div
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(asset.aiSummary) }}
                    data-testid="text-ai-summary"
                  />
                  <p className="text-xs text-muted-foreground mt-4">
                    Last updated: {asset.updatedAt ? new Date(asset.updatedAt).toLocaleString() : "-"}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground" data-testid="text-ai-empty">
                  No AI analysis generated yet. Click 'Generate AI Analysis' to create one.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              onClick={() => deleteMutation.mutate()}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={basicEditOpen} onOpenChange={setBasicEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Basic Information</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={basicForm.name || ""}
                onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={basicForm.category || ""} onValueChange={(v) => setBasicForm({ ...basicForm, category: v })}>
                <SelectTrigger data-testid="select-edit-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={basicForm.status || ""} onValueChange={(v) => setBasicForm({ ...basicForm, status: v })}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={basicForm.condition || ""} onValueChange={(v) => setBasicForm({ ...basicForm, condition: v })}>
                <SelectTrigger data-testid="select-edit-condition">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={basicForm.location || ""}
                onChange={(e) => setBasicForm({ ...basicForm, location: e.target.value })}
                data-testid="input-edit-location"
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={basicForm.departmentId || "none"} onValueChange={(v) => setBasicForm({ ...basicForm, departmentId: v === "none" ? null : v })}>
                <SelectTrigger data-testid="select-edit-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {activeDepartments.slice().sort((a, b) => a.name.localeCompare(b.name)).map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Input
                value={basicForm.assignedTo || ""}
                onChange={(e) => setBasicForm({ ...basicForm, assignedTo: e.target.value })}
                data-testid="input-edit-assigned-to"
              />
            </div>
            <div className="space-y-2">
              <Label>Funding Method</Label>
              <Select value={basicForm.fundingMethod || ""} onValueChange={(v) => setBasicForm({ ...basicForm, fundingMethod: v })}>
                <SelectTrigger data-testid="select-edit-funding">
                  <SelectValue placeholder="Select funding" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_FUNDING_METHODS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={basicForm.quantity ?? ""}
                onChange={(e) => setBasicForm({ ...basicForm, quantity: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-quantity"
              />
            </div>
            <div className="space-y-2">
              <Label>Barcode</Label>
              <Input
                value={basicForm.barcode || ""}
                onChange={(e) => setBasicForm({ ...basicForm, barcode: e.target.value })}
                data-testid="input-edit-barcode"
              />
            </div>
            <div className="space-y-2">
              <Label>QR Code</Label>
              <Input
                value={basicForm.qrCode || ""}
                onChange={(e) => setBasicForm({ ...basicForm, qrCode: e.target.value })}
                data-testid="input-edit-qr-code"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={basicForm.description || ""}
                onChange={(e) => setBasicForm({ ...basicForm, description: e.target.value })}
                data-testid="input-edit-description"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Remarks</Label>
              <Textarea
                value={basicForm.remarks || ""}
                onChange={(e) => setBasicForm({ ...basicForm, remarks: e.target.value })}
                data-testid="input-edit-remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBasicEditOpen(false)} data-testid="button-cancel-basic">
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate(basicForm)}
              disabled={updateMutation.isPending}
              data-testid="button-save-basic"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={financialEditOpen} onOpenChange={setFinancialEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Financial Information</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Purchase Price</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.purchasePrice || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, purchasePrice: e.target.value })}
                data-testid="input-edit-purchase-price"
              />
            </div>
            <div className="space-y-2">
              <Label>Current Value</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.currentValue || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, currentValue: e.target.value })}
                data-testid="input-edit-current-value"
              />
            </div>
            <div className="space-y-2">
              <Label>Depreciation Method</Label>
              <Input
                value={financialForm.depreciationMethod || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, depreciationMethod: e.target.value })}
                data-testid="input-edit-depreciation-method"
              />
            </div>
            <div className="space-y-2">
              <Label>Depreciation Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.depreciationRate || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, depreciationRate: e.target.value })}
                data-testid="input-edit-depreciation-rate"
              />
            </div>
            <div className="space-y-2">
              <Label>Accumulated Depreciation</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.accumulatedDepreciation || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, accumulatedDepreciation: e.target.value })}
                data-testid="input-edit-accumulated-depreciation"
              />
            </div>
            <div className="space-y-2">
              <Label>Depreciation This Period</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.depreciationThisPeriod || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, depreciationThisPeriod: e.target.value })}
                data-testid="input-edit-depreciation-period"
              />
            </div>
            <div className="space-y-2">
              <Label>Book Value</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.bookValue || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, bookValue: e.target.value })}
                data-testid="input-edit-book-value"
              />
            </div>
            <div className="space-y-2">
              <Label>Years Depreciated</Label>
              <Input
                type="number"
                value={financialForm.yearsDepreciated || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, yearsDepreciated: parseInt(e.target.value) || "" })}
                data-testid="input-edit-years-depreciated"
              />
            </div>
            <div className="space-y-2">
              <Label>Useful Life (Years)</Label>
              <Input
                type="number"
                value={financialForm.usefulLifeYears || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, usefulLifeYears: parseInt(e.target.value) || "" })}
                data-testid="input-edit-useful-life"
              />
            </div>
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={financialForm.purchaseDate || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, purchaseDate: e.target.value })}
                data-testid="input-edit-purchase-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={financialForm.supplier || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, supplier: e.target.value })}
                data-testid="input-edit-supplier"
              />
            </div>
            <div className="space-y-2">
              <Label>Warranty Expiry</Label>
              <Input
                type="date"
                value={financialForm.warrantyExpiry || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, warrantyExpiry: e.target.value })}
                data-testid="input-edit-warranty-expiry"
              />
            </div>
            <div className="space-y-2">
              <Label>Lease Start Date</Label>
              <Input
                type="date"
                value={financialForm.leaseStartDate || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, leaseStartDate: e.target.value })}
                data-testid="input-edit-lease-start"
              />
            </div>
            <div className="space-y-2">
              <Label>Lease End Date</Label>
              <Input
                type="date"
                value={financialForm.leaseEndDate || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, leaseEndDate: e.target.value })}
                data-testid="input-edit-lease-end"
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Payment</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.leaseMonthlyPayment || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, leaseMonthlyPayment: e.target.value })}
                data-testid="input-edit-monthly-payment"
              />
            </div>
            <div className="space-y-2">
              <Label>Balloon Payment</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.balloonPayment || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, balloonPayment: e.target.value })}
                data-testid="input-edit-balloon-payment"
              />
            </div>
            <div className="space-y-2">
              <Label>Lease Term (months)</Label>
              <Input
                type="number"
                value={financialForm.leaseTerm || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, leaseTerm: parseInt(e.target.value) || "" })}
                data-testid="input-edit-lease-term"
              />
            </div>
            <div className="space-y-2">
              <Label>Lessor</Label>
              <Input
                value={financialForm.lessor || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, lessor: e.target.value })}
                data-testid="input-edit-lessor"
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.loanAmount || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, loanAmount: e.target.value })}
                data-testid="input-edit-loan-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={financialForm.interestRate || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, interestRate: e.target.value })}
                data-testid="input-edit-interest-rate"
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Term (months)</Label>
              <Input
                type="number"
                value={financialForm.loanTerm || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, loanTerm: parseInt(e.target.value) || "" })}
                data-testid="input-edit-loan-term"
              />
            </div>
            <div className="space-y-2">
              <Label>Lender</Label>
              <Input
                value={financialForm.lender || ""}
                onChange={(e) => setFinancialForm({ ...financialForm, lender: e.target.value })}
                data-testid="input-edit-lender"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinancialEditOpen(false)} data-testid="button-cancel-financial">
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate(financialForm)}
              disabled={updateMutation.isPending}
              data-testid="button-save-financial"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={technicalEditOpen} onOpenChange={setTechnicalEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Technical Information</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input
                value={technicalForm.manufacturer || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, manufacturer: e.target.value })}
                data-testid="input-edit-manufacturer"
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={technicalForm.model || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, model: e.target.value })}
                data-testid="input-edit-model"
              />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input
                value={technicalForm.serialNumber || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, serialNumber: e.target.value })}
                data-testid="input-edit-serial-number"
              />
            </div>
            <div className="space-y-2">
              <Label>Registration Number</Label>
              <Input
                value={technicalForm.registrationNumber || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, registrationNumber: e.target.value })}
                data-testid="input-edit-registration-number"
              />
            </div>
            <div className="space-y-2">
              <Label>Engine Number</Label>
              <Input
                value={technicalForm.engineNumber || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, engineNumber: e.target.value })}
                data-testid="input-edit-engine-number"
              />
            </div>
            <div className="space-y-2">
              <Label>VIN Number</Label>
              <Input
                value={technicalForm.vinNumber || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, vinNumber: e.target.value })}
                data-testid="input-edit-vin-number"
              />
            </div>
            <div className="space-y-2">
              <Label>Year of Manufacture</Label>
              <Input
                value={technicalForm.yearOfManufacture || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, yearOfManufacture: e.target.value })}
                data-testid="input-edit-year-manufacture"
              />
            </div>
            <div className="space-y-2">
              <Label>Country of Origin</Label>
              <Input
                value={technicalForm.countryOfOrigin || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, countryOfOrigin: e.target.value })}
                data-testid="input-edit-country-origin"
              />
            </div>
            <div className="space-y-2">
              <Label>Operating Hours</Label>
              <Input
                type="number"
                step="0.1"
                value={technicalForm.operatingHours || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, operatingHours: e.target.value })}
                data-testid="input-edit-operating-hours"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Specifications</Label>
              <Textarea
                value={technicalForm.specifications || ""}
                onChange={(e) => setTechnicalForm({ ...technicalForm, specifications: e.target.value })}
                data-testid="input-edit-specifications"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTechnicalEditOpen(false)} data-testid="button-cancel-technical">
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate(technicalForm)}
              disabled={updateMutation.isPending}
              data-testid="button-save-technical"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={insuranceEditOpen} onOpenChange={setInsuranceEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Insurance Information</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Insurance Provider</Label>
              <Input
                value={insuranceForm.insuranceProvider || ""}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceProvider: e.target.value })}
                data-testid="input-edit-insurance-provider"
              />
            </div>
            <div className="space-y-2">
              <Label>Policy Number</Label>
              <Input
                value={insuranceForm.insurancePolicyNumber || ""}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insurancePolicyNumber: e.target.value })}
                data-testid="input-edit-policy-number"
              />
            </div>
            <div className="space-y-2">
              <Label>Premium (annual)</Label>
              <Input
                type="number"
                step="0.01"
                value={insuranceForm.insurancePremium || ""}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insurancePremium: e.target.value })}
                data-testid="input-edit-premium"
              />
            </div>
            <div className="space-y-2">
              <Label>Excess</Label>
              <Input
                type="number"
                step="0.01"
                value={insuranceForm.insuranceExcess || ""}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceExcess: e.target.value })}
                data-testid="input-edit-excess"
              />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={insuranceForm.insuranceStartDate || ""}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceStartDate: e.target.value })}
                data-testid="input-edit-insurance-start"
              />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={insuranceForm.insuranceExpiryDate || ""}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceExpiryDate: e.target.value })}
                data-testid="input-edit-insurance-expiry"
              />
            </div>
            <div className="space-y-2">
              <Label>Insurance Status</Label>
              <Input
                value={insuranceForm.insuranceStatus || ""}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceStatus: e.target.value })}
                data-testid="input-edit-insurance-status"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Insurance Notes</Label>
              <Textarea
                value={insuranceForm.insuranceNotes || ""}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceNotes: e.target.value })}
                data-testid="input-edit-insurance-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsuranceEditOpen(false)} data-testid="button-cancel-insurance">
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate(insuranceForm)}
              disabled={updateMutation.isPending}
              data-testid="button-save-insurance"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Maintenance Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Input
                value={maintenanceForm.maintenanceType || ""}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceType: e.target.value })}
                data-testid="input-maintenance-type"
              />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={maintenanceForm.maintenanceDate || ""}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceDate: e.target.value })}
                data-testid="input-maintenance-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={maintenanceForm.cost || ""}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                data-testid="input-maintenance-cost"
              />
            </div>
            <div className="space-y-2">
              <Label>Service Provider</Label>
              <Input
                value={maintenanceForm.serviceProvider || ""}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceProvider: e.target.value })}
                data-testid="input-maintenance-provider"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={maintenanceForm.description || ""}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                data-testid="input-maintenance-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)} data-testid="button-cancel-maintenance">
              Cancel
            </Button>
            <Button
              onClick={() => addMaintenanceMutation.mutate(maintenanceForm)}
              disabled={addMaintenanceMutation.isPending || !maintenanceForm.maintenanceType || !maintenanceForm.maintenanceDate}
              data-testid="button-save-maintenance"
            >
              {addMaintenanceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Transfer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Transfer Date *</Label>
              <Input
                type="date"
                value={transferForm.transferDate || ""}
                onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                data-testid="input-transfer-date"
              />
            </div>
            <div className="space-y-2">
              <Label>From Location</Label>
              <Input
                value={transferForm.fromLocation || ""}
                onChange={(e) => setTransferForm({ ...transferForm, fromLocation: e.target.value })}
                data-testid="input-transfer-from-location"
              />
            </div>
            <div className="space-y-2">
              <Label>To Location</Label>
              <Input
                value={transferForm.toLocation || ""}
                onChange={(e) => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                data-testid="input-transfer-to-location"
              />
            </div>
            <div className="space-y-2">
              <Label>From Department</Label>
              <Select value={transferForm.fromDepartment || "none"} onValueChange={(v) => setTransferForm({ ...transferForm, fromDepartment: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-transfer-from-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {activeDepartments.slice().sort((a, b) => a.name.localeCompare(b.name)).map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Department</Label>
              <Select value={transferForm.toDepartment || "none"} onValueChange={(v) => setTransferForm({ ...transferForm, toDepartment: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-transfer-to-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {activeDepartments.slice().sort((a, b) => a.name.localeCompare(b.name)).map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Assignee</Label>
              <Input
                value={transferForm.fromAssignee || ""}
                onChange={(e) => setTransferForm({ ...transferForm, fromAssignee: e.target.value })}
                data-testid="input-transfer-from-assignee"
              />
            </div>
            <div className="space-y-2">
              <Label>To Assignee</Label>
              <Input
                value={transferForm.toAssignee || ""}
                onChange={(e) => setTransferForm({ ...transferForm, toAssignee: e.target.value })}
                data-testid="input-transfer-to-assignee"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Reason</Label>
              <Textarea
                value={transferForm.reason || ""}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                data-testid="input-transfer-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)} data-testid="button-cancel-transfer">
              Cancel
            </Button>
            <Button
              onClick={() => addTransferMutation.mutate(transferForm)}
              disabled={addTransferMutation.isPending || !transferForm.transferDate}
              data-testid="button-save-transfer"
            >
              {addTransferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}