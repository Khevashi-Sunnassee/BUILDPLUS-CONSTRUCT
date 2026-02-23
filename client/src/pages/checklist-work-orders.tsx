import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, CheckCircle2, Clock, ClipboardList,
  Loader2, Search, User, ArrowLeft, XCircle,
  PanelRightClose, PanelRightOpen, AlertCircle, Wrench,
  ChevronDown, ChevronUp, Save
} from "lucide-react";

interface WorkOrder {
  id: string;
  companyId: string;
  checklistInstanceId: string;
  fieldId: string;
  fieldName: string;
  sectionName: string;
  triggerValue: string | null;
  result: string | null;
  details: string | null;
  photos: unknown[];
  status: string;
  priority: string;
  assignedTo: string | null;
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
}

interface ChecklistDetail {
  workOrder: any;
  instance: any;
  template: any;
}

interface CompanyUser {
  id: string;
  name: string | null;
  email: string;
}

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
        {tiles.map((t) => (
          <Skeleton key={t.key} className="h-20 rounded-lg" />
        ))}
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

function ChecklistPreviewPanel({ workOrderId }: { workOrderId: string }) {
  const { data, isLoading } = useQuery<ChecklistDetail>({
    queryKey: ["/api/checklist/work-orders", workOrderId, "checklist-detail"],
    queryFn: () => fetch(`/api/checklist/work-orders/${workOrderId}/checklist-detail`, { credentials: "include" }).then(r => r.json()),
    enabled: !!workOrderId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48" data-testid="loader-checklist-preview">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.instance || !data?.template) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2" data-testid="empty-checklist-preview">
        <ClipboardList className="h-10 w-10 opacity-30" />
        <p className="text-sm">Checklist data not available</p>
      </div>
    );
  }

  const { instance, template, workOrder } = data;
  const responses = (instance.responses || {}) as Record<string, any>;
  const sections = (template.sections || []) as Array<{ id: string; name: string; fields: Array<{ id: string; label: string; type: string; options?: string[] }> }>;

  const failedFieldId = workOrder?.fieldId;

  return (
    <div className="space-y-4" data-testid="panel-checklist-preview">
      <div className="space-y-1">
        <h4 className="font-semibold text-sm">{template.name}</h4>
        <p className="text-xs text-muted-foreground">
          Instance: {instance.instanceNumber || instance.id.slice(0, 8)}
        </p>
        <div className="flex gap-2 mt-1">
          <Badge variant="outline" className="text-xs">{instance.status?.replace(/_/g, " ")}</Badge>
          {instance.completionRate && (
            <Badge variant="secondary" className="text-xs">{Number(instance.completionRate).toFixed(0)}% complete</Badge>
          )}
        </div>
      </div>

      <Separator />

      <ScrollArea className="h-[calc(100vh-420px)]">
        <div className="space-y-4 pr-2">
          {sections.map((section) => (
            <div key={section.id} className="space-y-2">
              <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{section.name}</h5>
              <div className="space-y-1.5">
                {section.fields.map((field) => {
                  const response = responses[field.id];
                  const isFailed = field.id === failedFieldId;
                  const displayValue = response?.value ?? response ?? "\u2014";

                  return (
                    <div
                      key={field.id}
                      className={`flex items-start justify-between gap-2 p-2 rounded text-sm ${isFailed ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 ring-1 ring-red-300 dark:ring-red-700" : "bg-muted/30"}`}
                      data-testid={`checklist-field-${field.id}`}
                    >
                      <span className={`flex-1 ${isFailed ? "font-medium text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                        {field.label}
                      </span>
                      <span className={`font-medium text-right max-w-[120px] truncate ${isFailed ? "text-red-700 dark:text-red-300" : ""}`}>
                        {typeof displayValue === "object" ? JSON.stringify(displayValue) : String(displayValue)}
                      </span>
                      {isFailed && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ChecklistWorkOrdersPage() {
  useDocumentTitle("Work Orders");

  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showPanel, setShowPanel] = useState(true);
  const [editDetails, setEditDetails] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState<string>("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editResolutionNotes, setEditResolutionNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<WorkOrderStats>({
    queryKey: ["/api/checklist/work-orders/stats"],
  });

  const { data: workOrders = [], isLoading: ordersLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/checklist/work-orders"],
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
      setIsDirty(false);
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
        o.fieldName.toLowerCase().includes(q) ||
        o.sectionName.toLowerCase().includes(q) ||
        (o.templateName || "").toLowerCase().includes(q) ||
        (o.instanceNumber || "").toLowerCase().includes(q) ||
        (o.assignedUserName || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [workOrders, statusFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return filteredOrders.find(o => o.id === selectedId) || null;
  }, [filteredOrders, selectedId]);

  const handleSelectOrder = useCallback((order: WorkOrder) => {
    setSelectedId(order.id);
    setEditDetails(order.details || "");
    setEditAssignedTo(order.assignedTo || "");
    setEditStatus(order.status);
    setEditPriority(order.priority);
    setEditResolutionNotes(order.resolutionNotes || "");
    setIsDirty(false);
    if (!showPanel) setShowPanel(true);
  }, [showPanel]);

  const handleSave = useCallback(() => {
    if (!selectedId) return;
    updateMutation.mutate({
      id: selectedId,
      updates: {
        details: editDetails,
        assignedTo: editAssignedTo || null,
        status: editStatus,
        priority: editPriority,
        resolutionNotes: editResolutionNotes || null,
      },
    });
  }, [selectedId, editDetails, editAssignedTo, editStatus, editPriority, editResolutionNotes, updateMutation]);

  const handleFieldChange = useCallback((setter: (v: string) => void) => {
    return (value: string) => {
      setter(value);
      setIsDirty(true);
    };
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
              <h1 className="text-xl font-semibold" data-testid="text-page-title">Work Orders</h1>
              <p className="text-sm text-muted-foreground">Checklist-triggered work orders requiring action</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPanel(!showPanel)}
            data-testid="button-toggle-panel"
          >
            {showPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>

        <DashboardTiles
          stats={stats}
          isLoading={statsLoading}
          activeFilter={statusFilter}
          onFilterClick={setStatusFilter}
        />

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search work orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={`${showPanel && selectedOrder ? "w-1/2 lg:w-3/5" : "w-full"} border-r overflow-hidden flex flex-col`}>
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2" data-testid="empty-list">
                  <ClipboardList className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No work orders found</p>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = order.id === selectedId;
                  return (
                    <div
                      key={order.id}
                      className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                      onClick={() => handleSelectOrder(order)}
                      data-testid={`work-order-row-${order.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate" data-testid={`text-field-name-${order.id}`}>
                              {order.fieldName}
                            </p>
                            <StatusBadge status={order.status} />
                            <PriorityBadge priority={order.priority} />
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {order.sectionName} {order.templateName ? `\u00B7 ${order.templateName}` : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>Result: <span className="font-medium text-foreground">{order.result || "\u2014"}</span></span>
                            {order.assignedUserName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {order.assignedUserName}
                              </span>
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

        {showPanel && selectedOrder && (
          <div className="w-1/2 lg:w-2/5 flex flex-col overflow-hidden bg-background" data-testid="panel-detail">
            <div className="p-4 border-b space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm" data-testid="text-detail-title">Work Order Details</h3>
                <Button
                  variant="default"
                  size="sm"
                  disabled={!isDirty || updateMutation.isPending}
                  onClick={handleSave}
                  data-testid="button-save"
                >
                  {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Field</label>
                  <p className="text-sm font-medium" data-testid="text-detail-field">{selectedOrder.fieldName}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Section</label>
                  <p className="text-sm" data-testid="text-detail-section">{selectedOrder.sectionName}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Result</label>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400" data-testid="text-detail-result">{selectedOrder.result || "\u2014"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Created</label>
                  <p className="text-sm" data-testid="text-detail-created">{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
              </div>

              <Separator />

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
                <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
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
                <label className="text-xs font-medium text-muted-foreground">Instructions / Details</label>
                <Textarea
                  value={editDetails}
                  onChange={(e) => { setEditDetails(e.target.value); setIsDirty(true); }}
                  placeholder="Add instructions for the assignee..."
                  className="min-h-[60px] text-sm resize-none"
                  data-testid="textarea-details"
                />
              </div>

              {(editStatus === "resolved" || editStatus === "closed") && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Resolution Notes</label>
                  <Textarea
                    value={editResolutionNotes}
                    onChange={(e) => { setEditResolutionNotes(e.target.value); setIsDirty(true); }}
                    placeholder="Describe the resolution..."
                    className="min-h-[60px] text-sm resize-none"
                    data-testid="textarea-resolution"
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="p-4 flex-1 overflow-auto">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-3">Checklist Reference</h4>
              <ChecklistPreviewPanel workOrderId={selectedOrder.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
