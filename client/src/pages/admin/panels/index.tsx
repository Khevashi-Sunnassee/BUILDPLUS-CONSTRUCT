import { useState, useRef, useEffect, Fragment, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ExcelJS from "exceljs";
import {
  ClipboardList,
  Plus,
  Loader2,
  Upload,
  Download,
  ArrowLeft,
  Filter,
  CheckCircle,
  Clock as ClockIcon,
  AlertCircle,
  Pause,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  BarChart3,
  Trash2,
  Printer,
  Combine,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation, useSearch } from "wouter";
import type { Job, PanelRegister, PanelTypeConfig, Factory } from "@shared/schema";
import { ADMIN_ROUTES, CHAT_ROUTES, PANEL_TYPES_ROUTES, FACTORIES_ROUTES, USER_ROUTES, SETTINGS_ROUTES, PANELS_ROUTES } from "@shared/api-routes";
import { isJobVisibleInDropdowns } from "@shared/job-phases";
import defaultLogo from "@/assets/lte-logo.png";
import { PageHelpButton } from "@/components/help/page-help-button";

import {
  panelSchema,
  type PanelFormData,
  type PanelWithJob,
  type PaginatedResponse,
  type WorkType,
  type BuildFormData,
  type ConsolidationData,
  type ConsolidationWarning,
  getSourceLabel,
  formatNumber,
} from "./types";
import { PanelEditDialog } from "./PanelEditDialog";
import { PanelBuildDialog } from "./PanelBuildDialog";
import { ImportDialog, DeleteDialog, DeleteSourceDialog, TemplateDownloadDialog, QrCodeDialog, ConsolidationDialog } from "./PanelDialogs";
import { PanelTableRow } from "./PanelTableRow";

export default function AdminPanelsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const filterJobId = urlParams.get("jobId");

  const [panelDialogOpen, setPanelDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<PanelRegister | null>(null);
  const [panelDialogTab, setPanelDialogTab] = useState<string>("details");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPanelId, setDeletingPanelId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [selectedJobForImport, setSelectedJobForImport] = useState<string>("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [factoryFilterInitialized, setFactoryFilterInitialized] = useState(false);
  const [panelTypeFilter, setPanelTypeFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [groupByJob, setGroupByJob] = useState<boolean>(false);
  const [groupByPanelType, setGroupByPanelType] = useState<boolean>(true);
  const [groupByLevel, setGroupByLevel] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "summary">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [collapsedJobs, setCollapsedJobs] = useState<Set<string>>(new Set());
  const [collapsedPanelTypes, setCollapsedPanelTypes] = useState<Set<string>>(new Set());
  const [collapsedLevels, setCollapsedLevels] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [consolidationMode, setConsolidationMode] = useState(false);
  const [selectedConsolidationPanels, setSelectedConsolidationPanels] = useState<Set<string>>(new Set());
  const [consolidationData, setConsolidationData] = useState<ConsolidationData | null>(null);
  const [consolidationDialogOpen, setConsolidationDialogOpen] = useState(false);
  const [consolidationWarnings, setConsolidationWarnings] = useState<Record<string, ConsolidationWarning> | null>(null);
  const [consolidationCheckLoading, setConsolidationCheckLoading] = useState(false);

  const [buildDialogOpen, setBuildDialogOpen] = useState(false);
  const [buildingPanel, setBuildingPanel] = useState<PanelRegister | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [buildFormData, setBuildFormData] = useState<BuildFormData>({
    loadWidth: "",
    loadHeight: "",
    panelThickness: "",
    panelVolume: "",
    panelMass: "",
    panelArea: "",
    liftFcm: "",
    concreteStrengthMpa: "",
    rotationalLifters: "",
    primaryLifters: "",
    productionPdfUrl: "",
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [deleteSourceDialogOpen, setDeleteSourceDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<number | null>(null);

  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [qrCodePanel, setQrCodePanel] = useState<{ id: string; panelMark: string; jobNumber?: string } | null>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const width = parseFloat(buildFormData.loadWidth) || 0;
    const height = parseFloat(buildFormData.loadHeight) || 0;
    const thickness = parseFloat(buildFormData.panelThickness) || 0;
    const areaM2 = (width * height) / 1_000_000;
    const volumeM3 = (width * height * thickness) / 1_000_000_000;
    const density = 2500;
    const massKg = volumeM3 * density;
    setBuildFormData(prev => ({
      ...prev,
      panelArea: areaM2 > 0 ? areaM2.toFixed(3) : "",
      panelVolume: volumeM3 > 0 ? volumeM3.toFixed(3) : "",
      panelMass: massKg > 0 ? Math.round(massKg).toString() : "",
    }));
  }, [buildFormData.loadWidth, buildFormData.loadHeight, buildFormData.panelThickness]);

  const queryParams = new URLSearchParams({
    page: currentPage.toString(),
    limit: pageSize.toString(),
  });
  if (jobFilter !== "all") queryParams.set("jobId", jobFilter);
  if (factoryFilter !== "all") queryParams.set("factoryId", factoryFilter);
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);

  const { data: panelData, isLoading: panelsLoading } = useQuery<PaginatedResponse>({
    queryKey: [ADMIN_ROUTES.PANELS, currentPage, pageSize, jobFilter, factoryFilter, debouncedSearch, statusFilter],
    queryFn: async () => {
      const res = await fetch(`${ADMIN_ROUTES.PANELS}?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch panels");
      return res.json();
    },
  });

  const panels = panelData?.panels;
  const totalPages = panelData?.totalPages || 1;
  const totalPanels = panelData?.total || 0;

  const panelIds = panels?.map(p => p.id) || [];
  const { data: panelCounts } = useQuery<Record<string, { messageCount: number; documentCount: number }>>({
    queryKey: [CHAT_ROUTES.PANELS_COUNTS, panelIds],
    queryFn: async () => {
      if (panelIds.length === 0) return {};
      const csrfToken = getCsrfToken();
      const res = await fetch(CHAT_ROUTES.PANELS_COUNTS, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({ panelIds }),
        credentials: "include",
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: panelIds.length > 0,
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: [ADMIN_ROUTES.JOBS],
  });

  const { data: factories } = useQuery<Factory[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  const { data: userSettings } = useQuery<{ selectedFactoryIds: string[]; defaultFactoryId: string | null }>({
    queryKey: [USER_ROUTES.SETTINGS],
  });

  useEffect(() => {
    if (!factoryFilterInitialized && userSettings) {
      if (userSettings.defaultFactoryId) {
        setFactoryFilter(userSettings.defaultFactoryId);
      }
      setFactoryFilterInitialized(true);
    }
  }, [userSettings, factoryFilterInitialized]);

  const { data: panelTypes } = useQuery<PanelTypeConfig[]>({
    queryKey: [PANEL_TYPES_ROUTES.LIST],
  });

  const { data: workTypes } = useQuery<WorkType[]>({
    queryKey: [SETTINGS_ROUTES.WORK_TYPES],
  });

  const normalizePanelType = useCallback((storedValue: string | null | undefined): string => {
    if (!storedValue || !panelTypes || panelTypes.length === 0) return "";
    const matchByCode = panelTypes.find(pt => pt.code === storedValue);
    if (matchByCode) return matchByCode.code;
    const normalizedStored = storedValue.toUpperCase().replace(/ /g, "_");
    const matchByName = panelTypes.find(pt =>
      pt.name.toUpperCase().replace(/ /g, "_") === normalizedStored
    );
    if (matchByName) return matchByName.code;
    const matchByNormalizedCode = panelTypes.find(pt =>
      pt.code.toUpperCase().replace(/ /g, "_") === normalizedStored
    );
    if (matchByNormalizedCode) return matchByNormalizedCode.code;
    return panelTypes[0]?.code || "";
  }, [panelTypes]);

  const { data: sourceCounts } = useQuery<{ source: number; count: number }[]>({
    queryKey: [ADMIN_ROUTES.PANELS_SOURCE_COUNTS],
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.logoBase64 || defaultLogo;
  const companyName = brandingSettings?.companyName || "LTE Precast Concrete Structures";

  const deleteBySourceMutation = useMutation({
    mutationFn: async (source: number) => {
      return apiRequest("DELETE", ADMIN_ROUTES.PANELS_BY_SOURCE(source));
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS_SOURCE_COUNTS] });
      toast({ title: `Deleted ${result.deleted} panels` });
      setDeleteSourceDialogOpen(false);
      setSourceToDelete(null);
    },
    onError: async (error: any) => {
      const errorData = error.response ? await error.response.json().catch(() => ({})) : {};
      toast({
        title: "Cannot delete panels",
        description: errorData.error || "Some panels have production records",
        variant: "destructive"
      });
    },
  });

  const getPanelTypeColor = (panelType: string | null | undefined): string | null => {
    if (!panelType || !panelTypes) return null;
    const pt = panelTypes.find(t => t.code === panelType || t.name === panelType || t.code.toUpperCase() === panelType.toUpperCase());
    return pt?.color || null;
  };

  const getFactoryName = (factoryId: string | null | undefined): string => {
    if (!factoryId || !factories) return "-";
    const factory = factories.find(f => f.id === factoryId);
    return factory?.name || "-";
  };

  const filteredPanels = panels?.filter(panel => {
    if (panel.consolidatedIntoPanelId) return false;
    if (filterJobId && panel.jobId !== filterJobId) return false;
    if (jobFilter !== "all" && panel.jobId !== jobFilter) return false;
    if (factoryFilter !== "all" && panel.job.factoryId !== factoryFilter) return false;
    if (statusFilter !== "all" && panel.status !== statusFilter) return false;
    if (panelTypeFilter !== "all" && panel.panelType !== panelTypeFilter) return false;
    if (levelFilter !== "all" && panel.level !== levelFilter) return false;
    if (searchTerm && !panel.panelMark.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  })?.sort((a, b) => {
    const buildingA = a.building || "";
    const buildingB = b.building || "";
    if (buildingA !== buildingB) {
      return buildingA.localeCompare(buildingB, undefined, { numeric: true });
    }
    const levelA = a.level || "";
    const levelB = b.level || "";
    return levelA.localeCompare(levelB, undefined, { numeric: true });
  });

  const panelsByJob = filteredPanels?.reduce((acc, panel) => {
    const jobId = panel.jobId;
    if (!acc[jobId]) {
      acc[jobId] = { job: panel.job, panels: [] };
    }
    acc[jobId].panels.push(panel);
    return acc;
  }, {} as Record<string, { job: Job; panels: PanelWithJob[] }>) || {};

  const panelsByType = filteredPanels?.reduce((acc, panel) => {
    const type = panel.panelType || "UNKNOWN";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(panel);
    return acc;
  }, {} as Record<string, PanelWithJob[]>) || {};

  const panelsByLevel = filteredPanels?.reduce((acc, panel) => {
    const level = panel.level || "No Level";
    if (!acc[level]) {
      acc[level] = [];
    }
    acc[level].push(panel);
    return acc;
  }, {} as Record<string, PanelWithJob[]>) || {};

  const uniquePanelTypes = Array.from(new Set(panels?.map(p => p.panelType).filter(Boolean) || [])).sort();
  const uniqueLevels = Array.from(new Set(panels?.map(p => p.level).filter(Boolean) || [])).sort((a, b) =>
    a!.localeCompare(b!, undefined, { numeric: true })
  );

  const toggleJobCollapse = (jobId: string) => {
    setCollapsedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const togglePanelTypeCollapse = (panelType: string) => {
    setCollapsedPanelTypes(prev => {
      const next = new Set(prev);
      if (next.has(panelType)) next.delete(panelType);
      else next.add(panelType);
      return next;
    });
  };

  const toggleLevelCollapse = (level: string) => {
    setCollapsedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const currentJob = jobs?.find(j => j.id === filterJobId);

  const handlePrintPanelList = useCallback(() => {
    if (!filteredPanels || filteredPanels.length === 0) {
      toast({ title: "No panels to print", variant: "destructive" });
      return;
    }

    const effectiveJobId = filterJobId || (jobFilter !== "all" ? jobFilter : null);
    const effectiveJob = effectiveJobId ? jobs?.find(j => j.id === effectiveJobId) : null;
    const jobName = effectiveJob ? `${effectiveJob.jobNumber} - ${effectiveJob.name}` : "All Jobs";
    const showJobColumn = !effectiveJobId;
    const dateStr = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

    const getStatusLabel = (status: string) => {
      const map: Record<string, string> = {
        NOT_STARTED: "Not Started",
        IN_PROGRESS: "In Progress",
        COMPLETED: "Completed",
        ON_HOLD: "On Hold",
        PENDING: "Pending",
      };
      return map[status] || status;
    };

    const getStatusColor = (status: string) => {
      const map: Record<string, string> = {
        NOT_STARTED: "#6b7280",
        IN_PROGRESS: "#3b82f6",
        COMPLETED: "#22c55e",
        ON_HOLD: "#f59e0b",
        PENDING: "#a855f7",
      };
      return map[status] || "#6b7280";
    };

    const sortedPanels = [...filteredPanels].sort((a, b) => {
      const buildA = a.building || "";
      const buildB = b.building || "";
      if (buildA !== buildB) return buildA.localeCompare(buildB, undefined, { numeric: true });
      const lvlA = a.level || "";
      const lvlB = b.level || "";
      if (lvlA !== lvlB) return lvlA.localeCompare(lvlB, undefined, { numeric: true });
      return a.panelMark.localeCompare(b.panelMark, undefined, { numeric: true });
    });

    const totalQty = sortedPanels.reduce((sum, p) => sum + (p.qty || 1), 0);
    const totalArea = sortedPanels.reduce((sum, p) => sum + (p.panelArea ? parseFloat(p.panelArea) : 0), 0);
    const totalVolume = sortedPanels.reduce((sum, p) => sum + (p.panelVolume ? parseFloat(p.panelVolume) : 0), 0);
    const totalMass = sortedPanels.reduce((sum, p) => sum + (p.panelMass ? parseFloat(p.panelMass) : 0), 0);

    const activeFilters: string[] = [];
    if (statusFilter !== "all") activeFilters.push(`Status: ${getStatusLabel(statusFilter)}`);
    if (panelTypeFilter !== "all") activeFilters.push(`Type: ${panelTypeFilter}`);
    if (levelFilter !== "all") activeFilters.push(`Level: ${levelFilter}`);
    if (factoryFilter !== "all") {
      const fName = factories?.find(f => f.id === factoryFilter)?.name || factoryFilter;
      activeFilters.push(`Factory: ${fName}`);
    }

    const panelRows = sortedPanels.map((panel, idx) => {
      const jobDisplay = showJobColumn ? `<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;white-space:nowrap;">${panel.job?.jobNumber || "-"}</td>` : "";
      return `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f9fafb"};">
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;color:#6b7280;">${idx + 1}</td>
        ${jobDisplay}
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;white-space:nowrap;">${getFactoryName(panel.job?.factoryId)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;font-weight:600;font-family:monospace;">${panel.panelMark}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.panelType || "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.building || "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.level || "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;">${panel.qty || 1}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${formatNumber(panel.loadWidth)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${formatNumber(panel.loadHeight)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelThickness ? parseFloat(panel.panelThickness).toFixed(0) : "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelArea ? parseFloat(panel.panelArea).toFixed(2) : "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelVolume ? parseFloat(panel.panelVolume).toFixed(3) : "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelMass ? parseFloat(panel.panelMass).toLocaleString("en-AU") : "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;font-family:monospace;">${panel.concreteStrengthMpa || "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">
          <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:500;color:#fff;background:${getStatusColor(panel.status)};">${getStatusLabel(panel.status)}</span>
        </td>
      </tr>`;
    }).join("");

    const jobColHeader = showJobColumn ? `<th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Job</th>` : "";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to print the panel list" });
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Panel List - ${jobName}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 12mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1f2937;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:3px solid #1f2937;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="${reportLogo}" alt="Company Logo" style="height:48px;width:auto;object-fit:contain;" />
      <div>
        <div style="font-size:18px;font-weight:700;color:#1f2937;">${companyName}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">Panel Register</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:600;color:#1f2937;">${jobName}</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">Generated: ${dateStr} at ${timeStr}</div>
      ${activeFilters.length > 0 ? `<div style="font-size:9px;color:#9ca3af;margin-top:2px;">Filters: ${activeFilters.join(" | ")}</div>` : ""}
    </div>
  </div>

  <div style="display:flex;gap:16px;margin-bottom:12px;">
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#0369a1;">${sortedPanels.length}</div>
      <div style="font-size:9px;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;">Panels</div>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#15803d;">${totalQty}</div>
      <div style="font-size:9px;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;">Total Qty</div>
    </div>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#a16207;">${totalArea.toFixed(2)}</div>
      <div style="font-size:9px;color:#a16207;text-transform:uppercase;letter-spacing:0.5px;">Total m\u00B2</div>
    </div>
    <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#7e22ce;">${totalVolume.toFixed(3)}</div>
      <div style="font-size:9px;color:#7e22ce;text-transform:uppercase;letter-spacing:0.5px;">Total m\u00B3</div>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#c2410c;">${totalMass.toLocaleString("en-AU")}</div>
      <div style="font-size:9px;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;">Total kg</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #d1d5db;border-radius:4px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;width:30px;">#</th>
        ${jobColHeader}
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Factory</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Panel Mark</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Type</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Building</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Level</th>
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Qty</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Width (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Height (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Thick (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Area (m\u00B2)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Vol (m\u00B3)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Mass (kg)</th>
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">MPa</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${panelRows}
    </tbody>
    <tfoot>
      <tr style="background:#f3f4f6;font-weight:700;">
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;" colspan="${showJobColumn ? 7 : 6}">TOTALS</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:center;">${totalQty}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;" colspan="3"></td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalArea.toFixed(2)}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalVolume.toFixed(3)}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalMass.toLocaleString("en-AU")}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;" colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:8px;border-top:1px solid #e5e7eb;">
    <div style="font-size:8px;color:#9ca3af;">${companyName} - Confidential</div>
    <div style="font-size:8px;color:#9ca3af;">Page 1 of 1</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  }, [filteredPanels, currentJob, filterJobId, jobFilter, jobs, statusFilter, panelTypeFilter, levelFilter, factoryFilter, factories, reportLogo, companyName, toast]);

  const panelForm = useForm<PanelFormData>({
    resolver: zodResolver(panelSchema),
    defaultValues: {
      jobId: filterJobId || "",
      panelMark: "",
      panelType: "WALL",
      description: "",
      drawingCode: "",
      sheetNumber: "",
      building: "",
      level: "",
      structuralElevation: "",
      estimatedHours: undefined,
      status: "NOT_STARTED",
      workTypeId: 1,
    },
  });

  useEffect(() => {
    if (filterJobId) {
      panelForm.setValue("jobId", filterJobId);
    }
  }, [filterJobId, panelForm]);

  const createPanelMutation = useMutation({
    mutationFn: async (data: PanelFormData) => {
      return apiRequest("POST", ADMIN_ROUTES.PANELS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel created successfully" });
      setPanelDialogOpen(false);
      panelForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create panel", description: error.message, variant: "destructive" });
    },
  });

  const updatePanelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PanelFormData }) => {
      return apiRequest("PUT", ADMIN_ROUTES.PANEL_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel updated successfully" });
      setPanelDialogOpen(false);
      setEditingPanel(null);
      panelForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to update panel", variant: "destructive" });
    },
  });

  const validatePanelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", ADMIN_ROUTES.PANEL_VALIDATE(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel validated successfully", description: "Panel is now available for drafting work" });
      setPanelDialogOpen(false);
      setEditingPanel(null);
      panelForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to validate panel", variant: "destructive" });
    },
  });

  const deletePanelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ADMIN_ROUTES.PANEL_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel deleted" });
      setDeleteDialogOpen(false);
      setDeletingPanelId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete panel", variant: "destructive" });
    },
  });

  const importPanelsMutation = useMutation({
    mutationFn: async ({ data, jobId }: { data: any[]; jobId?: string }) => {
      return apiRequest("POST", ADMIN_ROUTES.PANELS_IMPORT, { data, jobId: jobId || undefined });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
        const jobErrors = result.errors.filter((e: string) => e.includes("not found"));
        if (jobErrors.length > 0 && result.imported === 0) {
          toast({
            title: "Import Failed - Jobs Not Found",
            description: `No records were imported. ${jobErrors.length} row(s) have invalid job numbers.`,
            variant: "destructive"
          });
          return;
        }
        toast({
          title: `Imported ${result.imported} panels`,
          description: `${result.skipped} skipped, ${result.errors.length} errors`,
          variant: result.imported > 0 ? "default" : "destructive"
        });
      } else {
        toast({ title: `Successfully imported ${result.imported} panels` });
        setImportDialogOpen(false);
        setImportData([]);
        setSelectedJobForImport("");
        setImportErrors([]);
      }
    },
    onError: async (error: any) => {
      const errorData = error.response ? await error.response.json().catch(() => ({})) : {};
      setImportErrors(errorData.details || []);
      toast({
        title: "Import failed",
        description: errorData.error || error.message,
        variant: "destructive"
      });
    },
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async ({ panelId, pdfBase64, fileName }: { panelId: string; pdfBase64: string; fileName: string }) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.PANEL_UPLOAD_PDF(panelId), { pdfBase64, fileName });
      return res.json();
    },
  });

  const analyzePdfMutation = useMutation({
    mutationFn: async ({ panelId, pdfBase64 }: { panelId: string; pdfBase64: string }) => {
      return apiRequest("POST", ADMIN_ROUTES.PANEL_ANALYZE_PDF(panelId), { pdfBase64 });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      if (result.extracted) {
        setBuildFormData((prev) => ({
          ...prev,
          loadWidth: result.extracted.loadWidth || "",
          loadHeight: result.extracted.loadHeight || "",
          panelThickness: result.extracted.panelThickness || "",
          panelVolume: result.extracted.panelVolume || "",
          panelMass: result.extracted.panelMass || "",
          panelArea: result.extracted.panelArea || "",
          liftFcm: result.extracted.liftFcm || "",
          concreteStrengthMpa: result.extracted.concreteStrengthMpa || result.extracted.day28Fc || "",
          rotationalLifters: result.extracted.rotationalLifters || "",
          primaryLifters: result.extracted.primaryLifters || "",
        }));
        toast({ title: "PDF analyzed successfully" });
      }
      setIsAnalyzing(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to analyze PDF", description: error.message, variant: "destructive" });
      setIsAnalyzing(false);
    },
  });

  const approveProductionMutation = useMutation({
    mutationFn: async ({ panelId, data }: { panelId: string; data: typeof buildFormData }) => {
      return apiRequest("POST", ADMIN_ROUTES.PANEL_APPROVE_PRODUCTION(panelId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel approved for production" });
      closeBuildDialog();
    },
    onError: (error: any) => {
      toast({ title: "Failed to approve panel", description: error.message, variant: "destructive" });
    },
  });

  const revokeApprovalMutation = useMutation({
    mutationFn: async (panelId: string) => {
      return apiRequest("POST", ADMIN_ROUTES.PANEL_REVOKE_PRODUCTION(panelId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Production approval revoked" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to revoke approval", description: error.message, variant: "destructive" });
    },
  });

  const openBuildDialog = (panel: PanelRegister) => {
    if (panel.status === "PENDING") {
      toast({
        title: "Panel must be validated first",
        description: "This panel is still pending validation. Please validate it before setting up for production.",
        variant: "destructive"
      });
      return;
    }
    setBuildingPanel(panel);
    setValidationErrors([]);
    setBuildFormData({
      loadWidth: panel.loadWidth || "",
      loadHeight: panel.loadHeight || "",
      panelThickness: panel.panelThickness || "",
      panelVolume: panel.panelVolume || "",
      panelMass: panel.panelMass || "",
      panelArea: panel.panelArea || "",
      liftFcm: panel.liftFcm || "",
      concreteStrengthMpa: panel.concreteStrengthMpa || panel.day28Fc || "",
      rotationalLifters: panel.rotationalLifters || "",
      primaryLifters: panel.primaryLifters || "",
      productionPdfUrl: panel.productionPdfUrl || "",
    });
    setPdfFile(null);
    setBuildDialogOpen(true);
  };

  const closeBuildDialog = () => {
    setBuildDialogOpen(false);
    setBuildingPanel(null);
    setPdfFile(null);
    setValidationErrors([]);
    setBuildFormData({
      loadWidth: "",
      loadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
      panelArea: "",
      liftFcm: "",
      concreteStrengthMpa: "",
      rotationalLifters: "",
      primaryLifters: "",
      productionPdfUrl: "",
    });
  };

  const handlePdfDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "application/pdf" || file.name.endsWith(".pdf"))) {
      setPdfFile(file);
    } else {
      toast({ title: "Please upload a PDF file", variant: "destructive" });
    }
  }, [toast]);

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const analyzePdf = async () => {
    if (!pdfFile || !buildingPanel) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(",")[1];
      if (base64) {
        try {
          const uploadResult = await uploadPdfMutation.mutateAsync({
            panelId: buildingPanel.id,
            pdfBase64: base64,
            fileName: pdfFile.name
          });
          if (uploadResult.objectPath) {
            setBuildFormData((prev) => ({
              ...prev,
              productionPdfUrl: uploadResult.objectPath,
            }));
          }
          analyzePdfMutation.mutate({ panelId: buildingPanel.id, pdfBase64: base64 });
        } catch (error: any) {
          toast({ title: "Error uploading PDF", description: error.message, variant: "destructive" });
          setIsAnalyzing(false);
        }
      }
    };
    reader.readAsDataURL(pdfFile);
  };

  const handleApproveProduction = () => {
    if (!buildingPanel) return;
    const errors: string[] = [];
    if (!buildFormData.loadWidth) errors.push("Load Width is required");
    if (!buildFormData.loadHeight) errors.push("Load Height is required");
    if (!buildFormData.panelThickness) errors.push("Panel Thickness is required");
    if (!buildFormData.concreteStrengthMpa) errors.push("Concrete Strength f'c (MPa) is required");
    if (!buildFormData.liftFcm) errors.push("Lift f'cm is required");
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Validation Required",
        description: "Please fill in all required fields before approving for production.",
        variant: "destructive",
      });
      return;
    }
    setValidationErrors([]);
    approveProductionMutation.mutate({ panelId: buildingPanel.id, data: buildFormData });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value || "");
    });
    const jsonData: any[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowObj: any = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (headers[colNumber]) {
          rowObj[headers[colNumber]] = cell.value;
        }
      });
      if (Object.keys(rowObj).length > 0) jsonData.push(rowObj);
    });
    setImportData(jsonData);
    setSelectedJobForImport(filterJobId || "");
    setImportErrors([]);
    setImportDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = async () => {
    if (!jobs || jobs.length === 0) {
      toast({
        title: "No Jobs in System",
        description: "Please load jobs into the system before downloading the template. No panels can be added for jobs that don't exist.",
        variant: "destructive",
      });
      return;
    }
    if (!panelTypes || panelTypes.length === 0) {
      toast({
        title: "No Panel Types Configured",
        description: "Please configure panel types in the system before importing panels.",
        variant: "destructive",
      });
      return;
    }
    const template = panelTypes.map((pt, index) => ({
      "Job Number": jobs[0]?.jobNumber || "JOB-001",
      "Panel Mark": `PM-${String(index + 1).padStart(3, '0')}`,
      "Panel Type": pt.code,
      "Description": `${pt.name} panel example`,
      "Drawing Code": `DWG-${String(index + 1).padStart(3, '0')}`,
      "Sheet Number": `A${String(index + 1).padStart(3, '0')}`,
      "Building": "1",
      "Zone": "",
      "Level": "1",
      "Structural Elevation": "CCB",
      "Reckli Detail": "",
      "Qty": 1,
      "Width (mm)": 3000,
      "Height (mm)": 2800,
      "Thickness (mm)": 200,
      "Area (m²)": 8.4,
      "Volume (m³)": 1.68,
      "Weight (kg)": pt.expectedWeightPerM3 ? Number(pt.expectedWeightPerM3) * 1.68 : 4200,
      "Concrete Strength (MPa)": "40",
      "Takeoff Category": `${pt.name} TakeOff`,
      "Estimated Hours": 8
    }));
    const wb = new ExcelJS.Workbook();
    const panelsSheet = wb.addWorksheet("Panels");
    const panelHeaders = Object.keys(template[0]);
    panelsSheet.addRow(panelHeaders);
    template.forEach(row => panelsSheet.addRow(panelHeaders.map(h => (row as any)[h])));
    const panelTypesData = panelTypes.map(pt => ({
      "Panel Type": pt.name,
      "Code": pt.code,
      "Supply Cost ($/m²)": pt.supplyCostPerM2 || "",
      "Install Cost ($/m²)": pt.installCostPerM2 || "",
      "Sell Rate ($/m²)": pt.sellRatePerM2 || "",
      "Expected Weight (kg/m³)": pt.expectedWeightPerM3 || "",
    }));
    const panelTypesSheet = wb.addWorksheet("Panel Types Reference");
    const ptHeaders = Object.keys(panelTypesData[0]);
    panelTypesSheet.addRow(ptHeaders);
    panelTypesData.forEach(row => panelTypesSheet.addRow(ptHeaders.map(h => (row as any)[h])));
    const jobsData = jobs.map(j => ({
      "Job Number": j.jobNumber,
      "Job Name": j.name,
      "Client": j.client || "",
      "Crane Capacity": j.craneCapacity || "",
      "Status": j.status,
    }));
    const jobsSheet = wb.addWorksheet("Jobs Reference");
    const jobHeaders = Object.keys(jobsData[0]);
    jobsSheet.addRow(jobHeaders);
    jobsData.forEach(row => jobsSheet.addRow(jobHeaders.map(h => (row as any)[h])));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "panels_import_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    setTemplateDialogOpen(false);
  };

  const openCreateDialog = () => {
    setEditingPanel(null);
    panelForm.reset({
      jobId: filterJobId || "",
      panelMark: "",
      panelType: "WALL",
      description: "",
      drawingCode: "",
      sheetNumber: "",
      building: "",
      level: "",
      structuralElevation: "",
      reckliDetail: "",
      estimatedHours: undefined,
      status: "NOT_STARTED",
      loadWidth: "",
      loadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
      qty: 1,
      concreteStrengthMpa: "",
      workTypeId: 1,
    });
    setPanelDialogOpen(true);
  };

  const openEditDialog = (panel: PanelRegister) => {
    setEditingPanel(panel);
    panelForm.reset({
      jobId: panel.jobId,
      panelMark: panel.panelMark,
      panelType: normalizePanelType(panel.panelType),
      description: panel.description || "",
      drawingCode: panel.drawingCode || "",
      sheetNumber: panel.sheetNumber || "",
      building: panel.building || "",
      level: panel.level || "",
      structuralElevation: panel.structuralElevation || "",
      reckliDetail: panel.reckliDetail || "",
      estimatedHours: panel.estimatedHours || undefined,
      status: panel.status,
      loadWidth: panel.loadWidth || "",
      loadHeight: panel.loadHeight || "",
      panelThickness: panel.panelThickness || "",
      panelVolume: panel.panelVolume || "",
      panelMass: panel.panelMass || "",
      qty: panel.qty || 1,
      concreteStrengthMpa: panel.concreteStrengthMpa || "",
      workTypeId: panel.workTypeId || 1,
    });
    setPanelDialogOpen(true);
  };

  const onSubmit = (data: PanelFormData) => {
    if (editingPanel) {
      updatePanelMutation.mutate({ id: editingPanel.id, data });
    } else {
      createPanelMutation.mutate(data);
    }
  };

  const consolidateMutation = useMutation({
    mutationFn: async (data: { panelIds: string[]; primaryPanelId: string; newPanelMark: string; newLoadWidth: string; newLoadHeight: string }) => {
      const res = await apiRequest("POST", "/api/panels/consolidate", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panels/admin"] });
      toast({ title: "Panels consolidated successfully" });
      setConsolidationMode(false);
      setSelectedConsolidationPanels(new Set());
      setConsolidationDialogOpen(false);
      setConsolidationData(null);
    },
    onError: (error: any) => {
      toast({ title: "Consolidation Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleConsolidationProceed = async () => {
    const selectedPanels = (filteredPanels || []).filter(p => selectedConsolidationPanels.has(p.id));
    if (selectedPanels.length < 2) return;
    const jobIds = new Set(selectedPanels.map(p => p.jobId));
    if (jobIds.size > 1) {
      toast({ title: "Validation Error", description: "All panels must belong to the same job", variant: "destructive" });
      return;
    }
    const panelTypeSet = new Set(selectedPanels.map(p => p.panelType));
    if (panelTypeSet.size > 1) {
      toast({ title: "Validation Error", description: "All panels must be the same panel type", variant: "destructive" });
      return;
    }
    const mpas = new Set(selectedPanels.map(p => p.concreteStrengthMpa || ""));
    if (mpas.size > 1) {
      toast({ title: "Validation Error", description: "Cannot consolidate panels with different concrete strengths (MPa)", variant: "destructive" });
      return;
    }
    const thicknesses = new Set(selectedPanels.map(p => p.panelThickness || ""));
    if (thicknesses.size > 1) {
      toast({ title: "Validation Error", description: "Cannot consolidate panels with different panel thicknesses", variant: "destructive" });
      return;
    }
    const sortedByLevel = [...selectedPanels].sort((a, b) => {
      const levelOrder = ["basement", "ground", "g", "l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l10", "roof"];
      const aLevel = (a.level || "").toLowerCase();
      const bLevel = (b.level || "").toLowerCase();
      const aIdx = levelOrder.findIndex(l => aLevel.includes(l));
      const bIdx = levelOrder.findIndex(l => bLevel.includes(l));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return (a.level || "").localeCompare(b.level || "", undefined, { numeric: true });
    });
    const primaryPanel = sortedByLevel[0];
    const widths = selectedPanels.map(p => parseFloat(p.loadWidth || "0"));
    const heights = selectedPanels.map(p => parseFloat(p.loadHeight || "0"));
    const allWidthsSame = new Set(widths).size === 1;
    const allHeightsSame = new Set(heights).size === 1;
    let newWidth: string;
    let newHeight: string;
    if (allWidthsSame) {
      newWidth = String(widths[0]);
      newHeight = String(heights.reduce((sum, h) => sum + h, 0));
    } else if (allHeightsSame) {
      newWidth = String(widths.reduce((sum, w) => sum + w, 0));
      newHeight = String(heights[0]);
    } else {
      toast({ title: "Validation Error", description: "Cannot consolidate panels: widths or heights must match across all selected panels", variant: "destructive" });
      return;
    }
    const newPanelMark = primaryPanel.panelMark.endsWith("C")
      ? primaryPanel.panelMark
      : primaryPanel.panelMark + "C";
    setConsolidationData({
      primaryPanelId: primaryPanel.id,
      panels: selectedPanels,
      newPanelMark,
      newWidth,
      newHeight,
    });
    setConsolidationDialogOpen(true);
    setConsolidationCheckLoading(true);
    setConsolidationWarnings(null);
    try {
      const res = await apiRequest("POST", "/api/panels/consolidation-check", { panelIds: selectedPanels.map(p => p.id) });
      const data = await res.json();
      setConsolidationWarnings(data);
    } catch (err) {
      console.error("Failed to check consolidation records:", err);
    } finally {
      setConsolidationCheckLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; className?: string }> = {
      NOT_STARTED: { variant: "outline", icon: AlertCircle },
      IN_PROGRESS: { variant: "default", icon: ClockIcon },
      COMPLETED: { variant: "secondary", icon: CheckCircle },
      ON_HOLD: { variant: "destructive", icon: Pause },
      PENDING: { variant: "outline", icon: AlertCircle, className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700" },
    };
    const { variant, icon: Icon, className } = config[status] || config.NOT_STARTED;
    return (
      <Badge variant={variant} className={`gap-1 ${className || ""}`}>
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const statusCounts = {
    total: filteredPanels?.length || 0,
    notStarted: filteredPanels?.filter(p => p.status === "NOT_STARTED").length || 0,
    inProgress: filteredPanels?.filter(p => p.status === "IN_PROGRESS").length || 0,
    completed: filteredPanels?.filter(p => p.status === "COMPLETED").length || 0,
    onHold: filteredPanels?.filter(p => p.status === "ON_HOLD").length || 0,
    pending: filteredPanels?.filter(p => p.status === "PENDING").length || 0,
  };

  const volumeAreaTotals = {
    totalM2: filteredPanels?.reduce((sum, p) => sum + parseFloat(p.panelArea || "0"), 0) || 0,
    totalM3: filteredPanels?.reduce((sum, p) => sum + parseFloat(p.panelVolume || "0"), 0) || 0,
    completedM2: filteredPanels?.filter(p => p.status === "COMPLETED").reduce((sum, p) => sum + parseFloat(p.panelArea || "0"), 0) || 0,
    completedM3: filteredPanels?.filter(p => p.status === "COMPLETED").reduce((sum, p) => sum + parseFloat(p.panelVolume || "0"), 0) || 0,
  };

  const panelsByBuildingAndLevel = filteredPanels?.reduce((acc, panel) => {
    const building = panel.building || "Unassigned";
    const level = panel.level || "Unassigned";
    if (!acc[building]) acc[building] = {};
    if (!acc[building][level]) {
      acc[building][level] = { count: 0, area: 0, volume: 0, completed: 0, panels: [] };
    }
    acc[building][level].count++;
    acc[building][level].area += parseFloat(panel.panelArea || "0");
    acc[building][level].volume += parseFloat(panel.panelVolume || "0");
    if (panel.status === "COMPLETED") acc[building][level].completed++;
    acc[building][level].panels.push(panel);
    return acc;
  }, {} as Record<string, Record<string, { count: number; area: number; volume: number; completed: number; panels: PanelRegister[] }>>);

  const sortedBuildings = Object.keys(panelsByBuildingAndLevel || {}).sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const sortLevel = (a: string, b: string) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    const levelOrder = ["basement", "ground", "g", "l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l10", "roof"];
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aIdx = levelOrder.findIndex(l => aLower.includes(l));
    const bIdx = levelOrder.findIndex(l => bLower.includes(l));
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  };

  const handleToggleConsolidation = useCallback((panelId: string, checked: boolean) => {
    setSelectedConsolidationPanels(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(panelId);
      else newSet.delete(panelId);
      return newSet;
    });
  }, []);

  const handleOpenQrCode = useCallback((panel: PanelWithJob) => {
    const job = jobs?.find(j => j.id === panel.jobId);
    setQrCodePanel({ id: panel.id, panelMark: panel.panelMark, jobNumber: job?.jobNumber });
    setQrCodeDialogOpen(true);
  }, [jobs]);

  const handleDeletePanel = useCallback((panelId: string) => {
    setDeletingPanelId(panelId);
    setDeleteDialogOpen(true);
  }, []);

  const renderTableRow = (panel: PanelWithJob, options: { showJobColumn: boolean; showFactoryColumn: boolean; indented: boolean; fourthColumnContent: "type" | "job" }) => (
    <PanelTableRow
      key={panel.id}
      panel={panel}
      consolidationMode={consolidationMode}
      selectedConsolidationPanels={selectedConsolidationPanels}
      onToggleConsolidation={handleToggleConsolidation}
      panelCounts={panelCounts}
      showJobColumn={options.showJobColumn}
      showFactoryColumn={options.showFactoryColumn}
      indented={options.indented}
      fourthColumnContent={options.fourthColumnContent}
      getPanelTypeColor={getPanelTypeColor}
      getFactoryName={getFactoryName}
      getStatusBadge={getStatusBadge}
      onOpenBuildDialog={openBuildDialog}
      onOpenQrCode={handleOpenQrCode}
      onOpenEditDialog={openEditDialog}
      onDeletePanel={handleDeletePanel}
      jobs={jobs}
    />
  );

  if (panelsLoading) {
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
        <div className="flex items-center gap-4">
          {filterJobId && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/jobs")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-panels-title">
              Panel Register
              {currentJob && <span className="text-muted-foreground ml-2">- {currentJob.jobNumber}</span>}
            </h1>
              <PageHelpButton pageHelpKey="page.panels" />
            </div>
            <p className="text-muted-foreground">
              {filterJobId ? `Panels for ${currentJob?.name || "job"}` : "Manage panel register for all jobs"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-file-upload"
          />
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          {sourceCounts && sourceCounts.length > 0 && (
            <Select
              value=""
              onValueChange={(value) => {
                if (value) {
                  setSourceToDelete(parseInt(value));
                  setDeleteSourceDialogOpen(true);
                }
              }}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-bulk-delete">
                <Trash2 className="h-4 w-4 mr-2" />
                <span>Bulk Delete</span>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3].map(source => {
                  const count = sourceCounts.find(s => s.source === source)?.count || 0;
                  if (count === 0) return null;
                  return (
                    <SelectItem key={source} value={source.toString()} data-testid={`option-delete-source-${source}`}>
                      {getSourceLabel(source)} ({count} panels)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          <Button
            variant={consolidationMode ? "destructive" : "outline"}
            onClick={() => {
              if (consolidationMode && selectedConsolidationPanels.size >= 2) {
                handleConsolidationProceed();
              } else if (consolidationMode) {
                setConsolidationMode(false);
                setSelectedConsolidationPanels(new Set());
              } else {
                setConsolidationMode(true);
                setSelectedConsolidationPanels(new Set());
              }
            }}
            data-testid="button-consolidate-panel"
          >
            <Combine className="h-4 w-4 mr-2" />
            {consolidationMode
              ? selectedConsolidationPanels.size >= 2
                ? `Consolidate ${selectedConsolidationPanels.size} Panels`
                : "Cancel Consolidation"
              : "Consolidate Panel"}
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-panel">
            <Plus className="h-4 w-4 mr-2" />
            Add Panel
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintPanelList}
            disabled={!filteredPanels || filteredPanels.length === 0}
            data-testid="button-print-panel-list"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("all")} data-testid="card-filter-all">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.total}</div>
            <div className="text-sm text-muted-foreground">Total Panels</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("NOT_STARTED")} data-testid="card-filter-not-started">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-muted-foreground">{statusCounts.notStarted}</div>
            <div className="text-sm text-muted-foreground">Not Started</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("IN_PROGRESS")} data-testid="card-filter-in-progress">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-500">{statusCounts.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("COMPLETED")} data-testid="card-filter-completed">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{statusCounts.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("ON_HOLD")} data-testid="card-filter-on-hold">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-500">{statusCounts.onHold}</div>
            <div className="text-sm text-muted-foreground">On Hold</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card data-testid="card-total-m2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{volumeAreaTotals.totalM2.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total m²</div>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-m2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{volumeAreaTotals.completedM2.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Completed m²</div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-m3">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{volumeAreaTotals.totalM3.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total m³</div>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-m3">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{volumeAreaTotals.completedM3.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Completed m³</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {viewMode === "list" ? "Panel List" : "Building & Level Summary"}
              </CardTitle>
              <CardDescription>
                {filteredPanels?.length || 0} panels {statusFilter !== "all" && `(${statusFilter.replace("_", " ")})`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                >
                  <ClipboardList className="h-4 w-4 mr-1" />
                  List
                </Button>
                <Button
                  variant={viewMode === "summary" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("summary")}
                  data-testid="button-view-summary"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Summary
                </Button>
              </div>
              {viewMode === "list" && (
                <>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search panel mark..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[180px]"
                      data-testid="input-search-panel"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="group-by-job"
                      checked={groupByJob}
                      onCheckedChange={(checked) => {
                        setGroupByJob(checked);
                        if (checked) setGroupByPanelType(false);
                      }}
                      data-testid="switch-group-by-job"
                    />
                    <Label htmlFor="group-by-job" className="text-sm cursor-pointer">
                      Group by Job
                    </Label>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-factory-filter">
                    <SelectValue placeholder="All Factories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Factories</SelectItem>
                    {factories?.filter(f => f.isActive).map(factory => (
                      <SelectItem key={factory.id} value={factory.id}>
                        {factory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!filterJobId && (
                  <Select value={jobFilter} onValueChange={setJobFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-job-filter">
                      <SelectValue placeholder="All Jobs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      {jobs?.filter(j => j.status === "ACTIVE" && isJobVisibleInDropdowns((j as any).jobPhase || "CONTRACTED")).map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.jobNumber} - {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending Validation</SelectItem>
                    <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={panelTypeFilter} onValueChange={setPanelTypeFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-panel-type-filter">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniquePanelTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-level-filter">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {uniqueLevels.map(level => (
                      <SelectItem key={level} value={level!}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 ml-2">
                  <Switch
                    id="group-by-type"
                    checked={groupByPanelType}
                    onCheckedChange={(checked) => {
                      setGroupByPanelType(checked);
                      if (checked) { setGroupByJob(false); setGroupByLevel(false); }
                    }}
                    data-testid="switch-group-by-type"
                  />
                  <Label htmlFor="group-by-type" className="text-sm whitespace-nowrap">Group by Type</Label>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Switch
                    id="group-by-level"
                    checked={groupByLevel}
                    onCheckedChange={(checked) => {
                      setGroupByLevel(checked);
                      if (checked) { setGroupByJob(false); setGroupByPanelType(false); }
                    }}
                    data-testid="switch-group-by-level"
                  />
                  <Label htmlFor="group-by-level" className="text-sm whitespace-nowrap">Group by Level</Label>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "summary" ? (
            <div className="space-y-6">
              {sortedBuildings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No panels to display
                </div>
              ) : (
                sortedBuildings.map((building) => {
                  const levels = panelsByBuildingAndLevel?.[building] || {};
                  const sortedLevels = Object.keys(levels).sort(sortLevel);
                  const buildingTotals = {
                    count: Object.values(levels).reduce((sum, l) => sum + l.count, 0),
                    area: Object.values(levels).reduce((sum, l) => sum + l.area, 0),
                    volume: Object.values(levels).reduce((sum, l) => sum + l.volume, 0),
                    completed: Object.values(levels).reduce((sum, l) => sum + l.completed, 0),
                  };
                  return (
                    <Card key={building} className="border" data-testid={`card-building-${building}`}>
                      <CardHeader className="py-3 px-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Layers className="h-5 w-5" />
                            Building: {building}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm">
                            <span><strong>{buildingTotals.count}</strong> panels</span>
                            <span><strong>{buildingTotals.completed}</strong> completed</span>
                            <span><strong>{buildingTotals.area.toFixed(2)}</strong> m²</span>
                            <span><strong>{buildingTotals.volume.toFixed(2)}</strong> m³</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[200px]">Level</TableHead>
                              <TableHead className="text-center">Panels</TableHead>
                              <TableHead className="text-center">Completed</TableHead>
                              <TableHead className="text-right">Area (m²)</TableHead>
                              <TableHead className="text-right">Volume (m³)</TableHead>
                              <TableHead className="text-center">Progress</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedLevels.map((level) => {
                              const data = levels[level];
                              const progress = data.count > 0 ? (data.completed / data.count) * 100 : 0;
                              return (
                                <TableRow key={level} data-testid={`row-level-${building}-${level}`}>
                                  <TableCell className="font-medium">{level}</TableCell>
                                  <TableCell className="text-center">{data.count}</TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-green-600">{data.completed}</span>
                                  </TableCell>
                                  <TableCell className="text-right">{data.area.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">{data.volume.toFixed(3)}</TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center gap-2 justify-center">
                                      <Progress value={progress} className="w-20 h-2" />
                                      <span className="text-xs text-muted-foreground w-10">{progress.toFixed(0)}%</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                {consolidationMode && <TableHead className="w-10"></TableHead>}
                {!filterJobId && !groupByJob && !groupByPanelType && <TableHead>Job</TableHead>}
                <TableHead>Factory</TableHead>
                <TableHead>Panel Mark</TableHead>
                <TableHead>{groupByPanelType ? "Job" : "Type"}</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-center w-12">Qty</TableHead>
                <TableHead className="text-right w-20">Width (mm)</TableHead>
                <TableHead className="text-right w-20">Height (mm)</TableHead>
                <TableHead className="text-right w-20">Area (m²)</TableHead>
                <TableHead className="text-right w-20">Vol (m³)</TableHead>
                <TableHead className="text-right w-16">MPa</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Drawing Status</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupByPanelType ? (
                Object.entries(panelsByType).length > 0 ? (
                  Object.entries(panelsByType).sort(([a], [b]) => a.localeCompare(b)).map(([panelType, typePanels]) => {
                    const isCollapsed = collapsedPanelTypes.has(panelType);
                    return (
                      <Fragment key={panelType}>
                        <TableRow
                          className="bg-muted/50 hover:bg-muted cursor-pointer"
                          onClick={() => togglePanelTypeCollapse(panelType)}
                          data-testid={`row-type-group-${panelType}`}
                        >
                          <TableCell colSpan={consolidationMode ? 17 : 16}>
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <Layers className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{panelType}</span>
                              <Badge variant="secondary" className="ml-2">
                                {typePanels.length} panel{typePanels.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && typePanels.map((panel) =>
                          renderTableRow(panel, { showJobColumn: false, showFactoryColumn: true, indented: true, fourthColumnContent: "job" })
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={consolidationMode ? 17 : 16} className="text-center py-8 text-muted-foreground">
                      No panels found. Add a panel or import from Excel.
                    </TableCell>
                  </TableRow>
                )
              ) : groupByJob && !filterJobId ? (
                Object.entries(panelsByJob).length > 0 ? (
                  Object.entries(panelsByJob).map(([jobId, { job, panels: jobPanels }]) => {
                    const isCollapsed = collapsedJobs.has(jobId);
                    return (
                      <Fragment key={jobId}>
                        <TableRow
                          className="bg-muted/50 hover:bg-muted cursor-pointer"
                          onClick={() => toggleJobCollapse(jobId)}
                          data-testid={`row-job-group-${jobId}`}
                        >
                          <TableCell colSpan={consolidationMode ? 17 : 16}>
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <Layers className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{job.jobNumber}</span>
                              <span className="text-muted-foreground">- {job.name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {jobPanels.length} panel{jobPanels.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && jobPanels.map((panel) =>
                          renderTableRow(panel, { showJobColumn: false, showFactoryColumn: false, indented: true, fourthColumnContent: "type" })
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={consolidationMode ? 17 : 16} className="text-center py-8 text-muted-foreground">
                      No panels found. Add a panel or import from Excel.
                    </TableCell>
                  </TableRow>
                )
              ) : groupByLevel ? (
                Object.entries(panelsByLevel).length > 0 ? (
                  Object.entries(panelsByLevel).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([level, levelPanels]) => {
                    const isCollapsed = collapsedLevels.has(level);
                    return (
                      <Fragment key={level}>
                        <TableRow
                          className="bg-muted/50 hover:bg-muted cursor-pointer"
                          onClick={() => toggleLevelCollapse(level)}
                          data-testid={`row-level-group-${level}`}
                        >
                          <TableCell colSpan={consolidationMode ? 17 : 16}>
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <Layers className="h-4 w-4 text-primary" />
                              <span className="font-semibold">Level: {level}</span>
                              <Badge variant="secondary" className="ml-2">
                                {levelPanels.length} panel{levelPanels.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && levelPanels.map((panel) =>
                          renderTableRow(panel, { showJobColumn: !filterJobId, showFactoryColumn: true, indented: true, fourthColumnContent: "type" })
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={consolidationMode ? 17 : 16} className="text-center py-8 text-muted-foreground">
                      No panels found. Add a panel or import from Excel.
                    </TableCell>
                  </TableRow>
                )
              ) : (
                <>
                  {filteredPanels?.map((panel) =>
                    renderTableRow(panel, { showJobColumn: !filterJobId, showFactoryColumn: true, indented: false, fourthColumnContent: "type" })
                  )}
                  {(!filteredPanels || filteredPanels.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={filterJobId ? (consolidationMode ? 16 : 15) : (consolidationMode ? 17 : 16)} className="text-center py-8 text-muted-foreground">
                        No panels found. Add a panel or import from Excel.
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>

          {viewMode === "list" && (
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalPanels)} of {totalPanels} panels</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[80px] h-8" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  data-testid="button-first-page"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  data-testid="button-last-page"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
          </>
        )}
        </CardContent>
      </Card>

      <PanelEditDialog
        open={panelDialogOpen}
        onOpenChange={setPanelDialogOpen}
        editingPanel={editingPanel}
        panelDialogTab={panelDialogTab}
        setPanelDialogTab={setPanelDialogTab}
        panelForm={panelForm}
        onSubmit={onSubmit}
        createPending={createPanelMutation.isPending}
        updatePending={updatePanelMutation.isPending}
        validatePending={validatePanelMutation.isPending}
        onValidate={(id) => validatePanelMutation.mutate(id)}
        jobs={jobs}
        panelTypes={panelTypes}
        workTypes={workTypes}
        filterJobId={filterJobId}
      />

      <PanelBuildDialog
        open={buildDialogOpen}
        onClose={closeBuildDialog}
        buildingPanel={buildingPanel}
        buildFormData={buildFormData}
        setBuildFormData={setBuildFormData}
        validationErrors={validationErrors}
        pdfFile={pdfFile}
        setPdfFile={setPdfFile}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        isAnalyzing={isAnalyzing}
        pdfInputRef={pdfInputRef}
        onPdfDrop={handlePdfDrop}
        onPdfSelect={handlePdfSelect}
        onAnalyzePdf={analyzePdf}
        onApproveProduction={handleApproveProduction}
        approveProductionPending={approveProductionMutation.isPending}
        onRevokeApproval={(id) => revokeApprovalMutation.mutate(id)}
        revokeApprovalPending={revokeApprovalMutation.isPending}
      />

      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importData={importData}
        importErrors={importErrors}
        selectedJobForImport={selectedJobForImport}
        setSelectedJobForImport={setSelectedJobForImport}
        jobs={jobs}
        onImport={(data, jobId) => importPanelsMutation.mutate({ data, jobId })}
        importPending={importPanelsMutation.isPending}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => deletingPanelId && deletePanelMutation.mutate(deletingPanelId)}
        deletePending={deletePanelMutation.isPending}
      />

      <DeleteSourceDialog
        open={deleteSourceDialogOpen}
        onOpenChange={setDeleteSourceDialogOpen}
        sourceToDelete={sourceToDelete}
        sourceCounts={sourceCounts}
        onConfirm={(source) => deleteBySourceMutation.mutate(source)}
        deletePending={deleteBySourceMutation.isPending}
        onCancel={() => setSourceToDelete(null)}
      />

      <TemplateDownloadDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        jobs={jobs}
        onDownload={downloadTemplate}
      />

      <QrCodeDialog
        open={qrCodeDialogOpen}
        onOpenChange={setQrCodeDialogOpen}
        qrCodePanel={qrCodePanel}
        qrCodeRef={qrCodeRef}
      />

      <ConsolidationDialog
        open={consolidationDialogOpen}
        onOpenChange={(open) => { if (!open) { setConsolidationDialogOpen(false); setConsolidationData(null); setConsolidationWarnings(null); } }}
        consolidationData={consolidationData}
        setConsolidationData={setConsolidationData}
        consolidationWarnings={consolidationWarnings}
        consolidationCheckLoading={consolidationCheckLoading}
        onProcess={() => {
          if (!consolidationData) return;
          consolidateMutation.mutate({
            panelIds: consolidationData.panels.map(p => p.id),
            primaryPanelId: consolidationData.primaryPanelId,
            newPanelMark: consolidationData.newPanelMark,
            newLoadWidth: consolidationData.newWidth,
            newLoadHeight: consolidationData.newHeight,
          });
        }}
        processPending={consolidateMutation.isPending}
        onCancel={() => { setConsolidationDialogOpen(false); setConsolidationData(null); }}
      />
    </div>
  );
}
