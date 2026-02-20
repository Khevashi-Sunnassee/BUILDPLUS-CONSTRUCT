import { z } from "zod";
import type { Asset, Department } from "@shared/schema";
import type { UseFormReturn } from "react-hook-form";
import type { UseMutationResult } from "@tanstack/react-query";

export const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(num);
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
};

export const daysSinceDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return "Future";
    if (diff === 0) return "Today";
    return `${diff.toLocaleString()}d`;
  } catch {
    return "-";
  }
};

export const assetFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().optional().nullable(),
  status: z.string().optional(),
  condition: z.string().optional(),
  location: z.string().optional(),
  department: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  assignedTo: z.string().optional(),
  fundingMethod: z.string().optional(),
  remarks: z.string().optional(),
  supplier: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  currentValue: z.string().optional(),
  usefulLifeYears: z.coerce.number().optional().nullable(),
  depreciationMethod: z.string().optional(),
  depreciationRate: z.string().optional(),
  accumulatedDepreciation: z.string().optional(),
  depreciationThisPeriod: z.string().optional(),
  bookValue: z.string().optional(),
  yearsDepreciated: z.coerce.number().optional().nullable(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  engineNumber: z.string().optional(),
  vinNumber: z.string().optional(),
  yearOfManufacture: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  specifications: z.string().optional(),
  operatingHours: z.coerce.number().optional().nullable(),
  barcode: z.string().optional(),
  leaseStartDate: z.string().optional(),
  leaseEndDate: z.string().optional(),
  leaseMonthlyPayment: z.string().optional(),
  balloonPayment: z.string().optional(),
  leaseTerm: z.coerce.number().optional().nullable(),
  lessor: z.string().optional(),
  loanAmount: z.string().optional(),
  interestRate: z.string().optional(),
  loanTerm: z.coerce.number().optional().nullable(),
  lender: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  insurancePremium: z.string().optional(),
  insuranceExcess: z.string().optional(),
  insuranceStartDate: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
  insuranceStatus: z.string().optional(),
  insuranceNotes: z.string().optional(),
  capexRequestId: z.string().optional(),
  capexDescription: z.string().optional(),
  isBookable: z.boolean().optional(),
  requiresTransport: z.boolean().optional(),
  transportType: z.string().optional(),
});

export type AssetFormData = z.infer<typeof assetFormSchema>;

export const defaultFormValues: AssetFormData = {
  name: "",
  category: "",
  description: "",
  quantity: null,
  status: "active",
  condition: "good",
  location: "",
  department: "",
  departmentId: null,
  assignedTo: "",
  fundingMethod: "purchased",
  remarks: "",
  supplier: "",
  supplierId: "",
  purchaseDate: "",
  purchasePrice: "",
  warrantyExpiry: "",
  currentValue: "",
  usefulLifeYears: null,
  depreciationMethod: "",
  depreciationRate: "",
  accumulatedDepreciation: "",
  depreciationThisPeriod: "",
  bookValue: "",
  yearsDepreciated: null,
  manufacturer: "",
  model: "",
  serialNumber: "",
  registrationNumber: "",
  engineNumber: "",
  vinNumber: "",
  yearOfManufacture: "",
  countryOfOrigin: "",
  specifications: "",
  operatingHours: null,
  barcode: "",
  leaseStartDate: "",
  leaseEndDate: "",
  leaseMonthlyPayment: "",
  balloonPayment: "",
  leaseTerm: null,
  lessor: "",
  loanAmount: "",
  interestRate: "",
  loanTerm: null,
  lender: "",
  insuranceProvider: "",
  insurancePolicyNumber: "",
  insurancePremium: "",
  insuranceExcess: "",
  insuranceStartDate: "",
  insuranceExpiryDate: "",
  insuranceStatus: "",
  insuranceNotes: "",
  capexRequestId: "",
  capexDescription: "",
  isBookable: false,
  requiresTransport: false,
  transportType: "",
};

export type SortField = "purchasePrice" | "name" | "purchaseDate" | "daysSincePurchase" | null;
export type SortDir = "asc" | "desc";

export const GROUP_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-l-blue-500", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-l-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-l-amber-500", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-l-purple-500", text: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-l-rose-500", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-l-cyan-500", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-l-orange-500", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-l-indigo-500", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-teal-50 dark:bg-teal-950/30", border: "border-l-teal-500", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-l-pink-500", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-lime-50 dark:bg-lime-950/30", border: "border-l-lime-500", text: "text-lime-700 dark:text-lime-300" },
  { bg: "bg-sky-50 dark:bg-sky-950/30", border: "border-l-sky-500", text: "text-sky-700 dark:text-sky-300" },
];

export interface ChartDataItem {
  month: string;
  count: number;
  total: number;
  cumulativeValue: number;
}

export interface AssetStats {
  total: number;
  totalPurchasePrice: number;
  totalCurrentValue: number;
  active: number;
  leased: number;
}

export interface AssetStatsCardsProps {
  stats: AssetStats;
}

export interface AssetFiltersProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  fundingFilter: string;
  setFundingFilter: (v: string) => void;
  bookableFilter: string;
  setBookableFilter: (v: string) => void;
  transportFilter: string;
  setTransportFilter: (v: string) => void;
  groupByMode: "category" | "month" | "none";
  setGroupByMode: (v: "category" | "month" | "none") => void;
  setCollapsedGroups: (v: Record<string, boolean>) => void;
  showGraph: boolean;
  setShowGraph: (v: boolean) => void;
  setChartMonthFilter: (v: string | null) => void;
}

export interface AssetChartProps {
  chartData: ChartDataItem[];
  chartMonthFilter: string | null;
  setChartMonthFilter: (v: string | null) => void;
}

export interface AssetTableProps {
  groupByMode: "category" | "month" | "none";
  groupedAssets: [string, Asset[]][] | null;
  filteredAndSortedAssets: Asset[];
  assets: Asset[] | undefined;
  collapsedGroups: Record<string, boolean>;
  toggleGroup: (category: string) => void;
  sortField: SortField;
  sortDir: SortDir;
  handleSort: (f: SortField) => void;
  openEditDialog: (asset: Asset) => void;
  setDeletingAssetId: (id: string | null) => void;
  setDeleteDialogOpen: (open: boolean) => void;
  navigate: (path: string) => void;
  serviceChecklistAssetId: string | null;
  setServiceChecklistAssetId: (id: string | null) => void;
  serviceChecklistMutation: UseMutationResult<any, any, Asset, unknown>;
}

export interface ServiceCallsTabProps {
  serviceStatusFilter: string;
  setServiceStatusFilter: (v: string) => void;
  filteredRepairRequests: any[];
  repairStatusCounts: Record<string, number>;
  repairsLoading: boolean;
  serviceStatusMutation: UseMutationResult<void, Error, { id: string; status: string }, unknown>;
  navigate: (path: string) => void;
}

export interface AssetFormDialogProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  editingAsset: Asset | null;
  form: UseFormReturn<AssetFormData>;
  onSubmit: (data: AssetFormData) => void;
  createMutation: UseMutationResult<any, any, AssetFormData, unknown>;
  updateMutation: UseMutationResult<any, any, AssetFormData & { id: string }, unknown>;
  suppliersList: { id: string; name: string }[];
  activeDepartments: Department[];
  watchedFundingMethod: string | undefined;
}

export interface AssetImportDialogProps {
  importDialogOpen: boolean;
  setImportDialogOpen: (open: boolean) => void;
  importing: boolean;
  importResult: { imported?: number; errors?: string[] } | null;
  handleImportFile: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface AssetDeleteDialogProps {
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  deletingAssetId: string | null;
  deleteMutation: UseMutationResult<any, any, string, unknown>;
}

export interface ServiceChecklistDialogProps {
  serviceDialogOpen: boolean;
  setServiceDialogOpen: (open: boolean) => void;
  serviceInstanceId: string | null;
  setServiceInstanceId: (id: string | null) => void;
  serviceHasChanges: boolean;
  serviceResponses: Record<string, unknown>;
  setServiceResponses: (r: Record<string, unknown>) => void;
  setServiceHasChanges: (v: boolean) => void;
  serviceInstance: any;
  serviceTemplate: any;
  serviceWorkOrders: any[];
  saveServiceMutation: UseMutationResult<any, any, void, unknown>;
  handleServiceComplete: () => void;
  serviceCompleteDialogOpen: boolean;
  setServiceCompleteDialogOpen: (open: boolean) => void;
  completeServiceMutation: UseMutationResult<any, any, void, unknown>;
}
