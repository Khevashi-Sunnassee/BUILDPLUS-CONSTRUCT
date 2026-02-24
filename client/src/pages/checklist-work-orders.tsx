import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, CheckCircle2, Clock, ClipboardList,
  Loader2, Search, User, XCircle, AlertCircle, Wrench,
  Save, Calendar, Building2, Tag, FileText, MessageSquare,
  Paperclip, Info, UserCheck, UserX,
} from "lucide-react";
import { EntitySidebar } from "@/components/EntitySidebar";
import type { EntitySidebarRoutes } from "@/lib/sidebar-utils";

interface WorkOrder {
  id: string;
  companyId: string;
  checklistInstanceId: string | null;
  fieldId: string | null;
  fieldName: string | null;
  sectionName: string | null;
  triggerValue: string | null;
  result: string | null;
  details: string | null;
  photos: unknown[];
  status: string;
  priority: string;
  workOrderType: string | null;
  assignedTo: string | null;
  supplierId: string | null;
  supplierName: string | null;
  dueDate: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  templateName: string | null;
  instanceNumber: string | null;
  instanceStatus: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  workOrderNumber: string | null;
  title: string | null;
  issueDescription: string | null;
  assetId: string | null;
  assetName: string | null;
  assetTag: string | null;
  assetLocation: string | null;
  assetConditionBefore: string | null;
  assetConditionAfter: string | null;
  estimatedCost: string | null;
  actualCost: string | null;
  vendorNotes: string | null;
  requestedById: string | null;
  requestedDate: string | null;
  desiredServiceDate: string | null;
}

interface WorkOrderStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  cancelled: number;
  critical: number;
  high: number;
  unassigned: number;
  assigned: number;
  byType: Record<string, number>;
}

interface CompanyUser {
  id: string;
  name: string | null;
  email: string;
}

const WORK_ORDER_ROUTES: EntitySidebarRoutes = {
  UPDATES: (id) => `/api/checklist/work-orders/${id}/updates`,
  UPDATE_BY_ID: (id) => `/api/work-order-updates/${id}`,
  FILES: (id) => `/api/checklist/work-orders/${id}/files`,
  FILE_BY_ID: (id) => `/api/work-order-files/${id}`,
  EMAIL_DROP: (id) => `/api/checklist/work-orders/${id}/email-drop`,
};

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CONFIG: Record<string, { label: string; variant: "secondary" | "default" | "destructive" | "outline"; className?: string; icon: typeof Clock }> = {
  open: { label: "Open", variant: "destructive", icon: AlertCircle },
  in_progress: { label: "In Progress", variant: "default", className: "bg-amber-500 text-white dark:bg-amber-600", icon: Clock },
  resolved: { label: "Resolved", variant: "default", className: "bg-green-600 text-white dark:bg-green-700", icon: CheckCircle2 },
  closed: { label: "Closed", variant: "secondary", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  critical: { label: "Critical", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Wrench }> = {
  defect: { label: "Defect", color: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800", icon: AlertCircle },
  maintenance: { label: "Maintenance", color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800", icon: Wrench },
  safety: { label: "Safety", color: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800", icon: AlertTriangle },
  corrective_action: { label: "Corrective Action", color: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800", icon: CheckCircle2 },
  inspection: { label: "Inspection", color: "text-teal-600 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-950 dark:border-teal-800", icon: ClipboardList },
  warranty: { label: "Warranty", color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950 dark:border-indigo-800", icon: FileText },
  general: { label: "General", color: "text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950 dark:border-gray-800", icon: Tag },
  service_request: { label: "Service Request", color: "text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950 dark:border-cyan-800", icon: Wrench },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, variant: "secondary" as const, icon: Clock };
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] || { label: priority, className: "" };
  return (
    <Badge variant="outline" className={config.className} data-testid={`badge-priority-${priority}`}>
      {config.label}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.general;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} text-[10px] px-1.5 py-0 gap-1`} data-testid={`badge-type-${type}`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  );
}

function DashboardTiles({ stats, isLoading, activeFilter, onFilterClick }: {
  stats: WorkOrderStats | undefined;
  isLoading: boolean;
  activeFilter: string;
  onFilterClick: (filter: string) => void;
}) {
  const tiles = [
    { key: "all", label: "Total", value: stats?.total ?? 0, icon: ClipboardList, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950" },
    { key: "open", label: "Open", value: stats?.open ?? 0, icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950" },
    { key: "in_progress", label: "In Progress", value: stats?.inProgress ?? 0, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950" },
    { key: "resolved", label: "Resolved", value: stats?.resolved ?? 0, icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950" },
    { key: "critical", label: "Critical", value: stats?.critical ?? 0, icon: AlertTriangle, color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900" },
    { key: "high", label: "High Priority", value: stats?.high ?? 0, icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950" },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="loader-stats">
        {tiles.map((t) => <Skeleton key={t.key} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="container-stats">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const isActive = activeFilter === tile.key;
        return (
          <Card
            key={tile.key}
            className={`cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-primary" : ""}`}
            onClick={() => onFilterClick(tile.key)}
            data-testid={`tile-${tile.key}`}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${tile.bg}`}>
                <Icon className={`h-4 w-4 ${tile.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className="text-lg font-semibold" data-testid={`stat-value-${tile.key}`}>{tile.value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DetailTabContent({
  order,
  companyUsers,
  onSave,
  isPending,
}: {
  order: WorkOrder;
  companyUsers: CompanyUser[];
  onSave: (updates: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [editDetails, setEditDetails] = useState(order.details || "");
  const [editAssignedTo, setEditAssignedTo] = useState(order.assignedTo || "");
  const [editStatus, setEditStatus] = useState(order.status);
  const [editPriority, setEditPriority] = useState(order.priority);
  const [editResolutionNotes, setEditResolutionNotes] = useState(order.resolutionNotes || "");
  const [editType, setEditType] = useState(order.workOrderType || "general");
  const [editSupplierName, setEditSupplierName] = useState(order.supplierName || "");
  const [editDueDate, setEditDueDate] = useState(order.dueDate ? new Date(order.dueDate).toISOString().slice(0, 10) : "");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setEditDetails(order.details || "");
    setEditAssignedTo(order.assignedTo || "");
    setEditStatus(order.status);
    setEditPriority(order.priority);
    setEditResolutionNotes(order.resolutionNotes || "");
    setEditType(order.workOrderType || "general");
    setEditSupplierName(order.supplierName || "");
    setEditDueDate(order.dueDate ? new Date(order.dueDate).toISOString().slice(0, 10) : "");
    setIsDirty(false);
  }, [order.id]);

  const handleFieldChange = useCallback((setter: (v: string) => void) => {
    return (value: string) => {
      setter(value);
      setIsDirty(true);
    };
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      details: editDetails,
      assignedTo: editAssignedTo || null,
      status: editStatus,
      priority: editPriority,
      resolutionNotes: editResolutionNotes || null,
      workOrderType: editType,
      supplierName: editSupplierName || null,
      dueDate: editDueDate || null,
    });
    setIsDirty(false);
  }, [editDetails, editAssignedTo, editStatus, editPriority, editResolutionNotes, editType, editSupplierName, editDueDate, onSave]);

  return (
    <div className="p-4 space-y-4 overflow-y-auto" data-testid="tab-details">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Details</h4>
        <Button
          variant="default"
          size="sm"
          disabled={!isDirty || isPending}
          onClick={handleSave}
          data-testid="button-save-details"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Save
        </Button>
      </div>

      {order.workOrderNumber && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Work Order #</label>
          <p className="text-sm font-mono font-medium" data-testid="text-detail-wo-number">{order.workOrderNumber}</p>
        </div>
      )}

      {order.assetId && (
        <div className="rounded-md border p-2 bg-muted/30 space-y-1 mb-2">
          <label className="text-xs font-medium text-muted-foreground">Asset</label>
          <p className="text-sm font-medium" data-testid="text-detail-asset">{order.assetName || "—"}{order.assetTag ? ` (${order.assetTag})` : ""}</p>
          {order.assetLocation && <p className="text-xs text-muted-foreground">Location: {order.assetLocation}</p>}
          {order.assetConditionBefore && <p className="text-xs text-muted-foreground">Condition (before): {order.assetConditionBefore}</p>}
          {order.assetConditionAfter && <p className="text-xs text-muted-foreground">Condition (after): {order.assetConditionAfter}</p>}
        </div>
      )}

      {order.title && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <p className="text-sm font-medium" data-testid="text-detail-title">{order.title}</p>
        </div>
      )}

      {order.issueDescription && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Issue Description</label>
          <p className="text-sm" data-testid="text-detail-issue">{order.issueDescription}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {order.fieldName && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Field</label>
            <p className="text-sm font-medium" data-testid="text-detail-field">{order.fieldName}</p>
          </div>
        )}
        {order.sectionName && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Section</label>
            <p className="text-sm" data-testid="text-detail-section">{order.sectionName}</p>
          </div>
        )}
        {order.result && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Result</label>
            <p className="text-sm font-medium text-red-600 dark:text-red-400" data-testid="text-detail-result">{order.result}</p>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Created</label>
          <p className="text-sm" data-testid="text-detail-created">{formatDateTime(order.createdAt)}</p>
        </div>
        {order.estimatedCost && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Estimated Cost</label>
            <p className="text-sm font-medium" data-testid="text-detail-est-cost">${parseFloat(order.estimatedCost).toLocaleString()}</p>
          </div>
        )}
        {order.actualCost && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Actual Cost</label>
            <p className="text-sm font-medium" data-testid="text-detail-act-cost">${parseFloat(order.actualCost).toLocaleString()}</p>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Tag className="h-3 w-3" /> Type
        </label>
        <Select value={editType} onValueChange={handleFieldChange(setEditType)}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={editStatus} onValueChange={handleFieldChange(setEditStatus)}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Priority</label>
          <Select value={editPriority} onValueChange={handleFieldChange(setEditPriority)}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <User className="h-3 w-3" /> Assigned To
        </label>
        <Select value={editAssignedTo || "unassigned"} onValueChange={(v) => handleFieldChange(setEditAssignedTo)(v === "unassigned" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-assigned-to">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {companyUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Supplier
        </label>
        <Input
          value={editSupplierName}
          onChange={(e) => handleFieldChange(setEditSupplierName)(e.target.value)}
          placeholder="Enter supplier name"
          className="h-8 text-xs"
          data-testid="input-supplier"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" /> Due Date
        </label>
        <Input
          type="date"
          value={editDueDate}
          onChange={(e) => handleFieldChange(setEditDueDate)(e.target.value)}
          className="h-8 text-xs"
          data-testid="input-due-date"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Details / Notes</label>
        <Textarea
          value={editDetails}
          onChange={(e) => handleFieldChange(setEditDetails)(e.target.value)}
          placeholder="Add details..."
          className="min-h-[60px] text-xs"
          data-testid="textarea-details"
        />
      </div>

      {(editStatus === "resolved" || editStatus === "closed") && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Resolution Notes</label>
          <Textarea
            value={editResolutionNotes}
            onChange={(e) => handleFieldChange(setEditResolutionNotes)(e.target.value)}
            placeholder="How was this resolved?"
            className="min-h-[60px] text-xs"
            data-testid="textarea-resolution"
          />
        </div>
      )}

      {order.templateName && (
        <>
          <Separator />
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Source Checklist</label>
            <p className="text-sm">{order.templateName}</p>
            {order.instanceNumber && <p className="text-xs text-muted-foreground">Instance: {order.instanceNumber}</p>}
          </div>
        </>
      )}
    </div>
  );
}

export default function ChecklistWorkOrdersPage() {
  useDocumentTitle("Work Orders Hub");

  const { toast } = useToast();
  const urlParams = new URLSearchParams(window.location.search);
  const initialSelectedId = urlParams.get("selected");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignmentTab, setAssignmentTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(!!initialSelectedId);

  const { data: stats, isLoading: statsLoading } = useQuery<WorkOrderStats>({
    queryKey: ["/api/checklist/work-orders/stats"],
  });

  const { data: workOrders = [], isLoading: ordersLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/checklist/work-orders", { tab: assignmentTab, type: typeFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (assignmentTab !== "all") params.set("tab", assignmentTab);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const qs = params.toString();
      return fetch(`/api/checklist/work-orders${qs ? `?${qs}` : ""}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const { data: companyUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: ["/api/users"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/checklist/work-orders/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklist/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/checklist/work-orders/stats"] });
      toast({ title: "Work order updated" });
    },
    onError: () => {
      toast({ title: "Failed to update work order", variant: "destructive" });
    },
  });

  const filteredOrders = useMemo(() => {
    let filtered = workOrders;
    if (statusFilter === "critical") {
      filtered = filtered.filter(o => o.priority === "critical");
    } else if (statusFilter === "high") {
      filtered = filtered.filter(o => o.priority === "high");
    } else if (statusFilter !== "all") {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        (o.fieldName || "").toLowerCase().includes(q) ||
        (o.sectionName || "").toLowerCase().includes(q) ||
        (o.templateName || "").toLowerCase().includes(q) ||
        (o.instanceNumber || "").toLowerCase().includes(q) ||
        (o.assignedUserName || "").toLowerCase().includes(q) ||
        (o.supplierName || "").toLowerCase().includes(q) ||
        (o.title || "").toLowerCase().includes(q) ||
        (o.workOrderNumber || "").toLowerCase().includes(q) ||
        (o.assetName || "").toLowerCase().includes(q) ||
        (o.assetTag || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [workOrders, statusFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return workOrders.find(o => o.id === selectedId) || null;
  }, [workOrders, selectedId]);

  const handleSelectOrder = useCallback((order: WorkOrder) => {
    setSelectedId(order.id);
    setSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
    setSelectedId(null);
  }, []);

  if (ordersLoading) {
    return (
      <div className="p-4 space-y-4" data-testid="loader-page">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="page-work-orders">
      <div className="p-4 space-y-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold" data-testid="text-page-title">Work Orders Hub</h1>
              <p className="text-sm text-muted-foreground">Manage work orders, service requests, and checklist-triggered items</p>
            </div>
          </div>
        </div>

        <DashboardTiles
          stats={stats}
          isLoading={statsLoading}
          activeFilter={statusFilter}
          onFilterClick={setStatusFilter}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={assignmentTab} onValueChange={setAssignmentTab} data-testid="tabs-assignment">
            <TabsList>
              <TabsTrigger value="all" className="gap-1.5" data-testid="tab-all">
                <ClipboardList className="h-3.5 w-3.5" />
                All
                {stats && <Badge variant="secondary" className="ml-1 h-5 text-[10px] px-1.5">{stats.total}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="gap-1.5" data-testid="tab-unassigned">
                <UserX className="h-3.5 w-3.5" />
                Unassigned
                {stats && <Badge variant="secondary" className="ml-1 h-5 text-[10px] px-1.5">{stats.unassigned}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="assigned" className="gap-1.5" data-testid="tab-assigned">
                <UserCheck className="h-3.5 w-3.5" />
                Assigned
                {stats && <Badge variant="secondary" className="ml-1 h-5 text-[10px] px-1.5">{stats.assigned}</Badge>}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs" data-testid="select-type-filter">
              <Tag className="h-3 w-3 mr-1" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search work orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8"
              data-testid="input-search"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="divide-y">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2" data-testid="empty-list">
                <ClipboardList className="h-10 w-10 opacity-30" />
                <p className="text-sm">No work orders found</p>
                {assignmentTab !== "all" && (
                  <p className="text-xs">Try switching to the "All" tab</p>
                )}
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = order.id === selectedId;
                const displayName = order.title || order.fieldName || "Work Order";
                const subtitle = order.assetId
                  ? `${order.assetName || "Asset"}${order.assetTag ? ` (${order.assetTag})` : ""}`
                  : `${order.sectionName || ""}${order.templateName ? ` · ${order.templateName}` : ""}`;
                return (
                  <div
                    key={order.id}
                    className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                    onClick={() => handleSelectOrder(order)}
                    data-testid={`work-order-row-${order.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {order.workOrderNumber && (
                            <span className="text-xs font-mono text-muted-foreground">{order.workOrderNumber}</span>
                          )}
                          <p className="text-sm font-medium truncate" data-testid={`text-field-name-${order.id}`}>
                            {displayName}
                          </p>
                          <StatusBadge status={order.status} />
                          <PriorityBadge priority={order.priority} />
                          <TypeBadge type={order.workOrderType || "general"} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {subtitle}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {order.result && (
                            <span>Result: <span className="font-medium text-foreground">{order.result}</span></span>
                          )}
                          {order.issueDescription && !order.result && (
                            <span className="truncate max-w-[200px]">{order.issueDescription}</span>
                          )}
                          {order.assignedUserName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {order.assignedUserName}
                            </span>
                          )}
                          {order.supplierName && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {order.supplierName}
                            </span>
                          )}
                          {order.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {formatDate(order.dueDate)}
                            </span>
                          )}
                          {order.estimatedCost && (
                            <span>Est: ${parseFloat(order.estimatedCost).toLocaleString()}</span>
                          )}
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {selectedOrder && sidebarOpen && (
        <EntitySidebar
          entityId={selectedId}
          entityName={`WO: ${selectedOrder.workOrderNumber || selectedOrder.title || selectedOrder.fieldName || "Work Order"}`}
          routes={WORK_ORDER_ROUTES}
          invalidationKeys={[["/api/checklist/work-orders"], ["/api/checklist/work-orders/stats"]]}
          onClose={handleCloseSidebar}
          initialTab="details"
          testIdPrefix="wo"
          extraTabs={[
            { id: "details", label: "Details", icon: <Info className="h-4 w-4" /> },
          ]}
          renderExtraTab={(tabId) => {
            if (tabId === "details" && selectedOrder) {
              return (
                <DetailTabContent
                  key={selectedOrder.id}
                  order={selectedOrder}
                  companyUsers={companyUsers}
                  onSave={(updates) => {
                    if (selectedId) {
                      updateMutation.mutate({ id: selectedId, updates });
                    }
                  }}
                  isPending={updateMutation.isPending}
                />
              );
            }
            return null;
          }}
          emptyUpdatesMessage="No communication yet. Add a comment or drop an email."
          emptyFilesMessage="No files attached to this work order."
        />
      )}
    </div>
  );
}
