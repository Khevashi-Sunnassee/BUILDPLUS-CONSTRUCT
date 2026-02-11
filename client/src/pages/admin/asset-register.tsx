import { useState, useMemo, useRef } from "react";
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
  Upload,
  Download,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ASSET_ROUTES, PROCUREMENT_ROUTES } from "@shared/api-routes";
import type { Asset } from "@shared/schema";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_CONDITIONS,
  ASSET_FUNDING_METHODS,
  ASSET_TRANSPORT_TYPES,
} from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
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

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
};

const daysSinceDate = (value: string | null | undefined): string => {
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

const assetFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().optional().nullable(),
  status: z.string().optional(),
  condition: z.string().optional(),
  location: z.string().optional(),
  department: z.string().optional(),
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

type AssetFormData = z.infer<typeof assetFormSchema>;

const defaultFormValues: AssetFormData = {
  name: "",
  category: "",
  description: "",
  quantity: null,
  status: "active",
  condition: "good",
  location: "",
  department: "",
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

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">-</span>;
  const variant =
    status === "active"
      ? "default"
      : status === "awaiting_service" || status === "in_service"
        ? "outline"
        : status === "disposed" || status === "sold"
          ? "secondary"
          : "destructive";
  const label = status === "awaiting_service" ? "Awaiting Service"
    : status === "in_service" ? "In Service"
    : status;
  return (
    <Badge variant={variant} className={`capitalize ${status === "awaiting_service" ? "border-orange-500 text-orange-700 dark:text-orange-400" : status === "in_service" ? "border-blue-500 text-blue-700 dark:text-blue-400" : ""}`} data-testid="badge-status">
      {label}
    </Badge>
  );
}

function ConditionBadge({ condition }: { condition: string | null | undefined }) {
  if (!condition) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge variant="outline" className="capitalize">
      {condition}
    </Badge>
  );
}

function FormSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border rounded-md">
      <button
        type="button"
        className="flex items-center gap-2 w-full p-3 cursor-pointer font-medium text-sm text-left"
        onClick={() => setOpen(!open)}
        data-testid={`section-toggle-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        {title}
      </button>
      {open && (
        <div className="p-4 pt-0 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

type SortField = "purchasePrice" | "name" | "purchaseDate" | "daysSincePurchase" | null;
type SortDir = "asc" | "desc";

function SortableHeader({ label, field, currentSort, currentDir, onSort }: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = currentSort === field;
  return (
    <button
      type="button"
      className="flex items-center gap-1 cursor-pointer text-left whitespace-nowrap"
      onClick={() => onSort(field)}
      data-testid={`button-sort-${field}`}
    >
      {label}
      {active ? (
        currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export default function AssetRegisterPage() {
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

  const GROUP_COLORS = [
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

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: [ASSET_ROUTES.LIST],
  });

  const { data: suppliersList = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

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
      <div className="p-6 space-y-6">
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

  const renderAssetRow = (asset: Asset) => (
    <TableRow
      key={asset.id}
      className="cursor-pointer hover-elevate"
      onClick={() => openEditDialog(asset)}
      data-testid={`row-asset-${asset.id}`}
    >
      <TableCell className="text-sm" data-testid={`text-asset-category-${asset.id}`}>
        {asset.category || "-"}
      </TableCell>
      <TableCell className="font-mono text-xs" data-testid={`text-asset-tag-${asset.id}`}>
        {asset.assetTag}
      </TableCell>
      <TableCell className="font-medium max-w-[240px] truncate" data-testid={`text-asset-name-${asset.id}`}>
        {asset.name}
      </TableCell>
      <TableCell>
        <StatusBadge status={asset.status} />
      </TableCell>
      <TableCell className="text-sm" data-testid={`text-asset-purchase-date-${asset.id}`}>
        {formatDate(asset.purchaseDate)}
      </TableCell>
      <TableCell className="text-sm text-center" data-testid={`text-asset-useful-life-${asset.id}`}>
        {asset.usefulLifeYears ? `${asset.usefulLifeYears}y` : "-"}
      </TableCell>
      <TableCell className="text-sm text-center" data-testid={`text-asset-days-since-${asset.id}`}>
        {daysSinceDate(asset.purchaseDate)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm" data-testid={`text-asset-purchase-price-${asset.id}`}>
        {formatCurrency(asset.purchasePrice)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm" data-testid={`text-asset-current-value-${asset.id}`}>
        {formatCurrency(asset.currentValue)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
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
              const params = new URLSearchParams({
                create: "replacement",
                assetId: asset.id,
                assetName: asset.name || "",
                assetTag: asset.assetTag || "",
                assetCategory: asset.category || "",
                assetCurrentValue: asset.currentValue || "",
                assetLocation: asset.location || "",
              });
              navigate(`/capex-requests?${params.toString()}`);
            }}
            data-testid={`button-replace-asset-${asset.id}`}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/admin/asset-repair/new?assetId=${asset.id}`);
            }}
            data-testid={`button-repair-asset-${asset.id}`}
          >
            <Wrench className="h-4 w-4" />
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
  );

  const tableHeaders = (
    <TableRow>
      <TableHead>Category</TableHead>
      <TableHead className="w-[90px]">Tag</TableHead>
      <TableHead>
        <SortableHeader label="Name" field="name" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
      </TableHead>
      <TableHead>Status</TableHead>
      <TableHead>
        <SortableHeader label="Purchase Date" field="purchaseDate" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
      </TableHead>
      <TableHead className="text-center">Useful Life</TableHead>
      <TableHead className="text-center">
        <SortableHeader label="Days Since" field="daysSincePurchase" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
      </TableHead>
      <TableHead className="text-right">
        <SortableHeader label="Purchase Price" field="purchasePrice" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
      </TableHead>
      <TableHead className="text-right">Current Value</TableHead>
      <TableHead className="text-right w-[160px]">Actions</TableHead>
    </TableRow>
  );

  return (
    <div className="p-6 space-y-5">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Total Assets</span>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold mt-1" data-testid="stat-total-assets">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Total Purchase Price</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold mt-1" data-testid="stat-total-purchase-price">
              {formatCurrency(stats.totalPurchasePrice)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Current Value</span>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold mt-1" data-testid="stat-total-current-value">
              {formatCurrency(stats.totalCurrentValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Active Assets</span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold mt-1" data-testid="stat-active-assets">
              {stats.active}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Leased</span>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold mt-1" data-testid="stat-leased-assets">
              {stats.leased}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={pageTab} onValueChange={setPageTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
          <TabsTrigger value="service-calls" data-testid="tab-service-calls">
            Service Calls ({allRepairRequests.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {pageTab === "assets" && (<>
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
          <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
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
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
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
          <SelectTrigger className="w-[140px]" data-testid="select-funding-filter">
            <SelectValue placeholder="Funding" />
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
        <Select value={bookableFilter} onValueChange={setBookableFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-bookable-filter">
            <SelectValue placeholder="Bookable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookable</SelectItem>
            <SelectItem value="yes">Bookable</SelectItem>
            <SelectItem value="no">Not Bookable</SelectItem>
          </SelectContent>
        </Select>
        <Select value={transportFilter} onValueChange={setTransportFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-transport-filter">
            <SelectValue placeholder="Transport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transport</SelectItem>
            <SelectItem value="yes">Requires Transport</SelectItem>
            <SelectItem value="no">No Transport Needed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupByMode} onValueChange={(v) => { setGroupByMode(v as "category" | "month" | "none"); setCollapsedGroups({}); }}>
          <SelectTrigger className="w-[160px]" data-testid="select-group-by">
            <SelectValue placeholder="Group By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">Group by Category</SelectItem>
            <SelectItem value="month">Group by Month</SelectItem>
            <SelectItem value="none">No Grouping</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showGraph ? "default" : "outline"}
          onClick={() => { setShowGraph(!showGraph); if (showGraph) setChartMonthFilter(null); }}
          data-testid="button-view-graph"
          className="whitespace-nowrap"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          {showGraph ? "Hide Graph" : "View Graph"}
        </Button>
      </div>

      {showGraph && (
        <div className="space-y-4">
          {chartMonthFilter && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Filtered: {chartMonthFilter}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setChartMonthFilter(null)} data-testid="button-clear-chart-filter">
                Clear filter
              </Button>
            </div>
          )}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Spend per Month</CardTitle>
              <span className="text-xs text-muted-foreground">Click a bar to filter assets below</span>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No purchase date data available to display
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          backgroundColor: "hsl(var(--popover))",
                          color: "hsl(var(--popover-foreground))",
                          fontSize: "13px",
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Total Spend"]}
                        labelFormatter={(label) => label}
                        cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.5 }}
                      />
                      <Bar
                        dataKey="total"
                        name="total"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                        cursor="pointer"
                        onClick={(data: { month: string }) => {
                          if (chartMonthFilter === data.month) {
                            setChartMonthFilter(null);
                          } else {
                            setChartMonthFilter(data.month);
                          }
                        }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-spend-${index}`}
                            fill={chartMonthFilter === entry.month ? "hsl(215, 80%, 45%)" : "hsl(215, 70%, 55%)"}
                            stroke={chartMonthFilter === entry.month ? "hsl(215, 90%, 35%)" : "none"}
                            strokeWidth={chartMonthFilter === entry.month ? 2 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Asset Value Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          backgroundColor: "hsl(var(--popover))",
                          color: "hsl(var(--popover-foreground))",
                          fontSize: "13px",
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Cumulative Value"]}
                        labelFormatter={(label) => label}
                      />
                      <Bar dataKey="cumulativeValue" name="cumulativeValue" radius={[4, 4, 0, 0]} maxBarSize={40} fill="hsl(215, 70%, 55%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {groupByMode !== "none" && groupedAssets ? (
        <div className="space-y-3">
          {groupedAssets.map(([category, categoryAssets], groupIndex) => {
            const colorSet = GROUP_COLORS[groupIndex % GROUP_COLORS.length];
            const isCollapsed = !!collapsedGroups[category];
            return (
              <div key={category} className={`border-l-4 ${colorSet.border} rounded-none overflow-hidden`}>
                <div
                  className={`flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer select-none ${colorSet.bg}`}
                  onClick={() => toggleGroup(category)}
                  data-testid={`button-toggle-group-${category}`}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className={`h-4 w-4 ${colorSet.text}`} />
                    ) : (
                      <ChevronDown className={`h-4 w-4 ${colorSet.text}`} />
                    )}
                    <span className={`text-sm font-semibold ${colorSet.text}`}>{category}</span>
                    <Badge variant="secondary">{categoryAssets.length}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatCurrency(categoryAssets.reduce((sum, a) => sum + (a.purchasePrice ? parseFloat(String(a.purchasePrice)) : 0), 0))}
                  </span>
                </div>
                {!isCollapsed && (
                  <Card className="rounded-none border-0 border-t">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>{tableHeaders}</TableHeader>
                        <TableBody>
                          {categoryAssets.map(renderAssetRow)}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>{tableHeaders}</TableHeader>
              <TableBody>
                {filteredAndSortedAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {assets && assets.length > 0
                        ? "No assets match the current filters"
                        : "No assets found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedAssets.map(renderAssetRow)
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </>)}

      {pageTab === "service-calls" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={serviceStatusFilter} onValueChange={setServiceStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-service-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({repairStatusCounts.all || 0})</SelectItem>
                <SelectItem value="DRAFT">Draft ({repairStatusCounts.DRAFT || 0})</SelectItem>
                <SelectItem value="SUBMITTED">Submitted ({repairStatusCounts.SUBMITTED || 0})</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress ({repairStatusCounts.IN_PROGRESS || 0})</SelectItem>
                <SelectItem value="COMPLETED">Completed ({repairStatusCounts.COMPLETED || 0})</SelectItem>
                <SelectItem value="CANCELLED">Cancelled ({repairStatusCounts.CANCELLED || 0})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Service / Repair Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {repairsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : filteredRepairRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wrench className="h-12 w-12 mb-2" />
                  <p>No service calls found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repair #</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Requested Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Est. Cost</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRepairRequests.map((r: any) => (
                      <TableRow key={r.id} data-testid={`row-service-${r.id}`}>
                        <TableCell className="font-mono text-sm" data-testid={`text-service-number-${r.id}`}>
                          {r.repairNumber}
                        </TableCell>
                        <TableCell data-testid={`text-service-asset-${r.id}`}>
                          <div>
                            <span className="font-medium">{r.asset?.name || "-"}</span>
                            {r.asset?.assetTag && (
                              <span className="text-xs text-muted-foreground ml-1">({r.asset.assetTag})</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-service-title-${r.id}`}>{r.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              r.priority === "URGENT" ? "border-red-500 text-red-700 dark:text-red-400" :
                              r.priority === "HIGH" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                              r.priority === "MEDIUM" ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" :
                              "border-muted-foreground"
                            }
                            data-testid={`badge-service-priority-${r.id}`}
                          >
                            {r.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={r.status === "COMPLETED" ? "default" : r.status === "CANCELLED" ? "secondary" : "outline"}
                            className={
                              r.status === "IN_PROGRESS" ? "border-blue-500 text-blue-700 dark:text-blue-400" :
                              r.status === "SUBMITTED" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                              ""
                            }
                            data-testid={`badge-service-status-${r.id}`}
                          >
                            {r.status === "IN_PROGRESS" ? "In Progress" : r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.requestedBy?.name || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.requestedDate ? new Date(r.requestedDate).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.vendor?.name || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.estimatedCost
                            ? formatCurrency(r.estimatedCost)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {r.status === "DRAFT" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "SUBMITTED" })}
                                disabled={serviceStatusMutation.isPending}
                                data-testid={`button-submit-service-${r.id}`}
                              >
                                Submit
                              </Button>
                            )}
                            {r.status === "SUBMITTED" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "IN_PROGRESS" })}
                                disabled={serviceStatusMutation.isPending}
                                data-testid={`button-start-service-${r.id}`}
                              >
                                Start
                              </Button>
                            )}
                            {(r.status === "SUBMITTED" || r.status === "IN_PROGRESS") && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "COMPLETED" })}
                                disabled={serviceStatusMutation.isPending}
                                data-testid={`button-complete-service-${r.id}`}
                              >
                                Close
                              </Button>
                            )}
                            {r.status !== "COMPLETED" && r.status !== "CANCELLED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "CANCELLED" })}
                                disabled={serviceStatusMutation.isPending}
                                data-testid={`button-cancel-service-${r.id}`}
                              >
                                Cancel
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/admin/asset-repair/new?assetId=${r.assetId}&editId=${r.id}`)}
                              data-testid={`button-edit-service-${r.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
            <DialogDescription>
              {editingAsset ? "Update the asset details below." : "Fill in the details to create a new asset."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormSection title="General Information" defaultOpen>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
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
                      <FormLabel>Category *</FormLabel>
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
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-quantity" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-asset-remarks" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              <FormSection title="Purchase & Supplier">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <Select
                          value={field.value || "none"}
                          onValueChange={(val) => {
                            if (val === "none") {
                              field.onChange("");
                              form.setValue("supplier", "");
                            } else {
                              field.onChange(val);
                              const selected = suppliersList.find(s => s.id === val);
                              if (selected) form.setValue("supplier", selected.name);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-asset-supplier">
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Supplier</SelectItem>
                            {suppliersList.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-asset-purchase-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-asset-purchase-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="warrantyExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-asset-warranty-expiry" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              <FormSection title="Depreciation & Valuation">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currentValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Value</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-asset-current-value" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="usefulLifeYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Useful Life (Years)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-useful-life" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="depreciationMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depreciation Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-asset-depreciation-method">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Straight Line">Straight Line</SelectItem>
                            <SelectItem value="Diminishing Value">Diminishing Value</SelectItem>
                            <SelectItem value="Units of Production">Units of Production</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="depreciationRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depreciation Rate</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-asset-depreciation-rate" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="accumulatedDepreciation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accumulated Depreciation</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-asset-accumulated-depreciation" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="depreciationThisPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depreciation This Period</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-asset-depreciation-this-period" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bookValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Book Value</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-asset-book-value" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="yearsDepreciated"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years Depreciated</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-years-depreciated" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              <FormSection title="Identification & Specifications">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-manufacturer" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-serial-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="registrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-registration-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="engineNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engine Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-engine-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vinNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VIN Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-vin-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="yearOfManufacture"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year of Manufacture</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-year-of-manufacture" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="countryOfOrigin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country of Origin</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-country-of-origin" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="specifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specifications</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-asset-specifications" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="operatingHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operating Hours</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-operating-hours" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barcode</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-asset-barcode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {(watchedFundingMethod === "leased" || watchedFundingMethod === "financed") && (
                <FormSection title={watchedFundingMethod === "leased" ? "Lease Details" : "Finance Details"}>
                  {watchedFundingMethod === "leased" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="lessor" render={({ field }) => (<FormItem><FormLabel>Lessor</FormLabel><FormControl><Input {...field} data-testid="input-asset-lessor" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="leaseTerm" render={({ field }) => (<FormItem><FormLabel>Lease Term (Months)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-lease-term" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="leaseStartDate" render={({ field }) => (<FormItem><FormLabel>Lease Start</FormLabel><FormControl><Input type="date" {...field} data-testid="input-asset-lease-start" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="leaseEndDate" render={({ field }) => (<FormItem><FormLabel>Lease End</FormLabel><FormControl><Input type="date" {...field} data-testid="input-asset-lease-end" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="leaseMonthlyPayment" render={({ field }) => (<FormItem><FormLabel>Monthly Payment</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-lease-payment" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="balloonPayment" render={({ field }) => (<FormItem><FormLabel>Balloon Payment</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-balloon-payment" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                    </>
                  )}
                  {watchedFundingMethod === "financed" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="lender" render={({ field }) => (<FormItem><FormLabel>Lender</FormLabel><FormControl><Input {...field} data-testid="input-asset-lender" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="loanTerm" render={({ field }) => (<FormItem><FormLabel>Loan Term (Months)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-loan-term" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="loanAmount" render={({ field }) => (<FormItem><FormLabel>Loan Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-loan-amount" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Interest Rate (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-interest-rate" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                    </>
                  )}
                </FormSection>
              )}

              <FormSection title="Insurance">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="insuranceProvider" render={({ field }) => (<FormItem><FormLabel>Provider</FormLabel><FormControl><Input {...field} data-testid="input-asset-insurance-provider" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="insurancePolicyNumber" render={({ field }) => (<FormItem><FormLabel>Policy Number</FormLabel><FormControl><Input {...field} data-testid="input-asset-insurance-policy-number" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="insurancePremium" render={({ field }) => (<FormItem><FormLabel>Premium</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-insurance-premium" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="insuranceExcess" render={({ field }) => (<FormItem><FormLabel>Excess</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-insurance-excess" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="insuranceStartDate" render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-asset-insurance-start-date" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="insuranceExpiryDate" render={({ field }) => (<FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-asset-insurance-expiry-date" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField
                  control={form.control}
                  name="insuranceStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-insurance-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="insuranceNotes" render={({ field }) => (<FormItem><FormLabel>Insurance Notes</FormLabel><FormControl><Textarea {...field} data-testid="input-asset-insurance-notes" /></FormControl><FormMessage /></FormItem>)} />
              </FormSection>

              <FormSection title="Booking & Transport">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isBookable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Bookable Asset</FormLabel>
                          <p className="text-sm text-muted-foreground">This asset can be booked for use</p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-asset-bookable"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requiresTransport"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Requires Transport</FormLabel>
                          <p className="text-sm text-muted-foreground">Needs transport when moved</p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-asset-requires-transport"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {form.watch("requiresTransport") && (
                  <FormField
                    control={form.control}
                    name="transportType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transport Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-asset-transport-type">
                              <SelectValue placeholder="Select transport type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ASSET_TRANSPORT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </FormSection>

              <FormSection title="CAPEX">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="capexRequestId" render={({ field }) => (<FormItem><FormLabel>CAPEX Request ID</FormLabel><FormControl><Input {...field} data-testid="input-asset-capex-request-id" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="capexDescription" render={({ field }) => (<FormItem><FormLabel>CAPEX Description</FormLabel><FormControl><Textarea {...field} data-testid="input-asset-capex-description" /></FormControl><FormMessage /></FormItem>)} />
              </FormSection>

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

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Assets</DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xlsx/.xls) to import assets. AI will automatically categorize assets based on their name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
              }}
              disabled={importing}
              data-testid="input-import-file"
            />
            {importing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing and categorizing with AI...
              </div>
            )}
            {importResult && (
              <div className="space-y-2">
                {importResult.imported !== undefined && importResult.imported > 0 && (
                  <p className="text-sm text-green-600" data-testid="text-import-success">
                    Successfully imported {importResult.imported} assets.
                  </p>
                )}
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">Errors:</p>
                    <ul className="text-sm text-destructive list-disc pl-4 max-h-40 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <li key={i} data-testid={`text-import-error-${i}`}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-close-import">
              Close
            </Button>
          </DialogFooter>
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
