import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MobileLayout } from "@/components/layout/mobile-layout";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Clock, XCircle,
  ClipboardList, Wrench, Tag, User, Building2, Calendar,
  Search, Loader2, ChevronRight, Mail, Save, FileText,
  ArrowLeft, RefreshCw, Play,
} from "lucide-react";

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

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  resolved: { label: "Resolved", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-500/20 text-gray-300" },
  medium: { label: "Medium", color: "bg-blue-500/20 text-blue-300" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-300" },
  critical: { label: "Critical", color: "bg-red-500/20 text-red-300" },
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Wrench }> = {
  defect: { label: "Defect", color: "text-red-400", icon: AlertCircle },
  maintenance: { label: "Maintenance", color: "text-blue-400", icon: Wrench },
  safety: { label: "Safety", color: "text-orange-400", icon: AlertTriangle },
  corrective_action: { label: "Corrective", color: "text-purple-400", icon: CheckCircle2 },
  inspection: { label: "Inspection", color: "text-teal-400", icon: ClipboardList },
  warranty: { label: "Warranty", color: "text-indigo-400", icon: FileText },
  general: { label: "General", color: "text-gray-400", icon: Tag },
  service_request: { label: "Service Request", color: "text-cyan-400", icon: Wrench },
};

type TabId = "all_open" | "mine";

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-500/20 text-gray-400", icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.color}`} data-testid={`badge-status-${status}`}>
      {config.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] || { label: priority, color: "bg-gray-500/20 text-gray-300" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.color}`} data-testid={`badge-priority-${priority}`}>
      {config.label}
    </span>
  );
}

function getOrderDisplayTitle(order: WorkOrder): string {
  return order.title || order.workOrderNumber || order.fieldName || "Work Order";
}

function getOrderSubtitle(order: WorkOrder): string {
  const parts: string[] = [];
  if (order.workOrderNumber && order.title) parts.push(order.workOrderNumber);
  if (order.sectionName) parts.push(order.sectionName);
  if (order.templateName) parts.push(order.templateName);
  if (order.assetName) parts.push(order.assetName);
  return parts.join(" \u00B7 ");
}

function OrderCard({ order, onClick }: { order: WorkOrder; onClick: () => void }) {
  const typeConfig = TYPE_CONFIG[order.workOrderType || "general"] || TYPE_CONFIG.general;
  const TypeIcon = typeConfig.icon;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-white/10 bg-white/5 p-4 active:scale-[0.99] transition-transform"
      data-testid={`work-order-card-${order.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`flex items-center gap-1 text-xs font-medium ${typeConfig.color}`}>
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </span>
            <StatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} />
          </div>
          <p className="text-sm font-semibold text-white truncate" data-testid={`text-field-${order.id}`}>
            {getOrderDisplayTitle(order)}
          </p>
          <p className="text-xs text-white/50 mt-0.5 truncate">
            {getOrderSubtitle(order)}
          </p>
          {order.estimatedCost && (
            <p className="text-[11px] text-white/40 mt-1">
              Est. ${parseFloat(order.estimatedCost).toLocaleString()}
              {order.actualCost ? ` \u00B7 Actual $${parseFloat(order.actualCost).toLocaleString()}` : ""}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40 flex-wrap">
            {order.assignedUserName && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {order.assignedUserName}
              </span>
            )}
            {order.supplierName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {order.supplierName}
              </span>
            )}
            {order.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDate(order.dueDate)}
              </span>
            )}
            <span>{formatDate(order.createdAt)}</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-white/30 flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

function OrderDetail({
  order,
  companyUsers,
  onClose,
}: {
  order: WorkOrder;
  companyUsers: CompanyUser[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [editStatus, setEditStatus] = useState(order.status);
  const [editPriority, setEditPriority] = useState(order.priority);
  const [editAssignedTo, setEditAssignedTo] = useState(order.assignedTo || "");
  const [editDetails, setEditDetails] = useState(order.details || "");
  const [editResolutionNotes, setEditResolutionNotes] = useState(order.resolutionNotes || "");
  const [isDirty, setIsDirty] = useState(false);

  const [showResolvePrompt, setShowResolvePrompt] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(order.supplierName || "");
  const [emailSubject, setEmailSubject] = useState(`Work Order: ${getOrderDisplayTitle(order)}`);
  const [emailBody, setEmailBody] = useState("");

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      return apiRequest("PATCH", `/api/checklist/work-orders/${order.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklist/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/checklist/work-orders/stats"] });
      toast({ title: "Work order updated" });
      setIsDirty(false);
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/checklist/work-orders/${order.id}/updates`, {
        content: emailBody,
        type: "email",
        emailSubject: emailSubject,
        emailTo: emailTo,
        emailBody: emailBody,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklist/work-orders"] });
      toast({ title: "Communication logged" });
      setEmailOpen(false);
      setEmailBody("");
    },
    onError: () => {
      toast({ title: "Failed to send email", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      status: editStatus,
      priority: editPriority,
      assignedTo: editAssignedTo || null,
      details: editDetails,
      resolutionNotes: editResolutionNotes || null,
    });
  };

  const handleStartWork = () => {
    updateMutation.mutate({ status: "in_progress" }, {
      onSuccess: () => {
        setEditStatus("in_progress");
      },
    });
  };

  const handleMarkResolved = () => {
    if (!showResolvePrompt) {
      setShowResolvePrompt(true);
      return;
    }
    updateMutation.mutate({
      status: "resolved",
      resolutionNotes: resolveNotes || null,
    }, {
      onSuccess: () => {
        setEditStatus("resolved");
        setEditResolutionNotes(resolveNotes);
        setShowResolvePrompt(false);
        setResolveNotes("");
      },
    });
  };

  const markField = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setIsDirty(true);
  };

  if (emailOpen) {
    return (
      <div className="flex flex-col h-full" data-testid="email-compose">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Button variant="ghost" size="icon" onClick={() => setEmailOpen(false)} className="text-white -ml-2" data-testid="button-back-email">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-white">Send Email</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/60">To</label>
            <Input
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="Recipient email"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              data-testid="input-email-to"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/60">Subject</label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              data-testid="input-email-subject"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/60">Message</label>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-white/30"
              data-testid="textarea-email-body"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-white/10">
          <Button
            onClick={() => emailMutation.mutate()}
            disabled={!emailBody.trim() || emailMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-send-email"
          >
            {emailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Send Email
          </Button>
        </div>
      </div>
    );
  }

  const typeConfig = TYPE_CONFIG[order.workOrderType || "general"] || TYPE_CONFIG.general;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="flex flex-col h-full" data-testid="order-detail">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white -ml-2" data-testid="button-back-detail">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white truncate">{getOrderDisplayTitle(order)}</h2>
          <p className="text-xs text-white/50 truncate">{getOrderSubtitle(order)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-40">
        <div className="flex items-center gap-2 flex-wrap">
          {order.workOrderNumber && (
            <span className="text-xs font-mono text-white/60 bg-white/10 px-2 py-0.5 rounded" data-testid="text-wo-number">
              {order.workOrderNumber}
            </span>
          )}
          <span className={`flex items-center gap-1 text-xs font-semibold ${typeConfig.color}`}>
            <TypeIcon className="h-3.5 w-3.5" />
            {typeConfig.label}
          </span>
          <StatusBadge status={order.status} />
          <PriorityBadge priority={order.priority} />
        </div>

        {(editStatus === "open" || editStatus === "in_progress") && (
          <div className="space-y-2" data-testid="section-quick-actions">
            {editStatus === "open" && (
              <Button
                onClick={handleStartWork}
                disabled={updateMutation.isPending}
                className="w-full bg-amber-600 text-white"
                data-testid="button-start-work"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Start Work
              </Button>
            )}
            {(editStatus === "open" || editStatus === "in_progress") && !showResolvePrompt && (
              <Button
                onClick={handleMarkResolved}
                disabled={updateMutation.isPending}
                className="w-full bg-green-600 text-white"
                data-testid="button-mark-resolved"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Resolved
              </Button>
            )}
            {showResolvePrompt && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 space-y-2" data-testid="resolve-prompt">
                <label className="text-xs font-medium text-green-300">Resolution Notes (optional)</label>
                <Textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="How was this resolved?"
                  className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  data-testid="textarea-resolve-notes"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowResolvePrompt(false)}
                    variant="outline"
                    className="flex-1 border-white/20 text-white/70"
                    data-testid="button-cancel-resolve"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMarkResolved}
                    disabled={updateMutation.isPending}
                    className="flex-1 bg-green-600 text-white"
                    data-testid="button-confirm-resolve"
                  >
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Resolve
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {order.issueDescription && (
          <div>
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Issue Description</label>
            <p className="text-sm text-white/70 mt-0.5" data-testid="text-issue-description">{order.issueDescription}</p>
          </div>
        )}

        {order.assetId && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5" data-testid="section-asset-info">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Asset</label>
            <p className="text-sm font-medium text-white" data-testid="text-asset-name">
              {order.assetName || "\u2014"}{order.assetTag ? ` (${order.assetTag})` : ""}
            </p>
            {order.assetLocation && (
              <p className="text-xs text-white/50">Location: {order.assetLocation}</p>
            )}
            {order.assetConditionBefore && (
              <p className="text-xs text-white/50">Condition (before): {order.assetConditionBefore}</p>
            )}
            {order.assetConditionAfter && (
              <p className="text-xs text-white/50">Condition (after): {order.assetConditionAfter}</p>
            )}
          </div>
        )}

        {(order.estimatedCost || order.actualCost) && (
          <div className="grid grid-cols-2 gap-3" data-testid="section-cost-info">
            {order.estimatedCost && (
              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Estimated Cost</label>
                <p className="text-sm font-medium text-white" data-testid="text-est-cost">${parseFloat(order.estimatedCost).toLocaleString()}</p>
              </div>
            )}
            {order.actualCost && (
              <div>
                <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Actual Cost</label>
                <p className="text-sm font-medium text-white" data-testid="text-act-cost">${parseFloat(order.actualCost).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        {order.desiredServiceDate && (
          <div>
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Desired Service Date</label>
            <p className="text-sm text-white/70 flex items-center gap-1 mt-0.5">
              <Calendar className="h-3.5 w-3.5" /> {formatDate(order.desiredServiceDate)}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Result</label>
            <p className="text-sm font-semibold text-red-400" data-testid="text-result">{order.result || "\u2014"}</p>
          </div>
          <div>
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Created</label>
            <p className="text-sm text-white/70" data-testid="text-created">{formatDateTime(order.createdAt)}</p>
          </div>
          {order.templateName && (
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Source</label>
              <p className="text-sm text-white/70">{order.templateName} {order.instanceNumber ? `#${order.instanceNumber}` : ""}</p>
            </div>
          )}
        </div>

        {order.vendorNotes && (
          <div>
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Vendor Notes</label>
            <p className="text-sm text-white/70 mt-0.5" data-testid="text-vendor-notes">{order.vendorNotes}</p>
          </div>
        )}

        <Separator className="bg-white/10" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Actions</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmailOpen(true)}
              className="border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
              data-testid="button-open-email"
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Send Email
            </Button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Status</label>
            <Select value={editStatus} onValueChange={markField(setEditStatus)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10" data-testid="select-status">
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
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Priority</label>
            <Select value={editPriority} onValueChange={markField(setEditPriority)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10" data-testid="select-priority">
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

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Assigned To</label>
            <Select value={editAssignedTo || "unassigned"} onValueChange={(v) => markField(setEditAssignedTo)(v === "unassigned" ? "" : v)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10" data-testid="select-assigned">
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
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Details / Notes</label>
            <Textarea
              value={editDetails}
              onChange={(e) => markField(setEditDetails)(e.target.value)}
              placeholder="Add notes..."
              className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-white/30"
              data-testid="textarea-details"
            />
          </div>

          {(editStatus === "resolved" || editStatus === "closed") && (
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Resolution Notes</label>
              <Textarea
                value={editResolutionNotes}
                onChange={(e) => markField(setEditResolutionNotes)(e.target.value)}
                placeholder="How was this resolved?"
                className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-white/30"
                data-testid="textarea-resolution"
              />
            </div>
          )}

          {order.supplierName && (
            <div>
              <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Supplier</label>
              <p className="text-sm text-white/70 flex items-center gap-1 mt-0.5">
                <Building2 className="h-3.5 w-3.5" /> {order.supplierName}
              </p>
            </div>
          )}

          {order.dueDate && (
            <div>
              <label className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Due Date</label>
              <p className="text-sm text-white/70 flex items-center gap-1 mt-0.5">
                <Calendar className="h-3.5 w-3.5" /> {formatDate(order.dueDate)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-[#0D1117]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <Button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
          data-testid="button-save"
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export default function MobileWorkOrders() {
  const [tab, setTab] = useState<TabId>("all_open");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const PAGE_SIZE = 20;

  const { data: stats, isError: statsError, refetch: refetchStats } = useQuery<WorkOrderStats>({
    queryKey: ["/api/checklist/work-orders/stats"],
  });

  const queryParams = tab === "mine" ? "?tab=mine" : "?status=open";

  const { data: workOrders = [], isLoading, isError: ordersError, refetch: refetchOrders } = useQuery<WorkOrder[]>({
    queryKey: [`/api/checklist/work-orders${queryParams}`],
  });

  const { data: companyUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: ["/api/users"],
  });

  const pullRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (pullRef.current && pullRef.current.scrollTop <= 0 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartY.current || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await Promise.all([refetchOrders(), refetchStats()]);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  }, [pullDistance, isRefreshing, refetchOrders, refetchStats]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return workOrders;
    const q = searchQuery.toLowerCase();
    return workOrders.filter(o =>
      (o.fieldName || "").toLowerCase().includes(q) ||
      (o.sectionName || "").toLowerCase().includes(q) ||
      (o.templateName || "").toLowerCase().includes(q) ||
      (o.assignedUserName || "").toLowerCase().includes(q) ||
      (o.supplierName || "").toLowerCase().includes(q) ||
      (o.title || "").toLowerCase().includes(q) ||
      (o.workOrderNumber || "").toLowerCase().includes(q) ||
      (o.assetName || "").toLowerCase().includes(q)
    );
  }, [workOrders, searchQuery]);

  if (selectedOrder) {
    return (
      <div className="fixed inset-0 flex flex-col bg-[#070B12] text-white z-50">
        <OrderDetail
          order={selectedOrder}
          companyUsers={companyUsers}
          onClose={() => setSelectedOrder(null)}
        />
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <MobileLayout title="Work Orders" showBackButton>
      <div
        ref={pullRef}
        className="flex-1 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullDistance > 0 ? `${pullDistance}px` : '0px' }}
          data-testid="pull-to-refresh-indicator"
        >
          <div className="flex flex-col items-center gap-1">
            <RefreshCw
              className={`h-5 w-5 text-blue-400 transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ transform: isRefreshing ? undefined : `rotate(${Math.min(pullDistance / PULL_THRESHOLD * 360, 360)}deg)` }}
            />
            <span className="text-[10px] text-white/50 font-medium">
              {isRefreshing ? 'Refreshing...' : pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      <div className="px-4 py-4 space-y-4">
        {statsError ? (
          <button
            onClick={() => refetchStats()}
            className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex flex-col items-center gap-2"
            data-testid="button-retry-stats"
          >
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-xs text-red-400 font-medium">Failed to load stats</p>
            <span className="text-[10px] text-white/40 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Tap to retry
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center" data-testid="stat-open">
              <div className="text-2xl font-bold text-red-400">{stats?.open ?? 0}</div>
              <div className="text-[10px] text-white/50 font-medium mt-0.5">Open</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center" data-testid="stat-in-progress">
              <div className="text-2xl font-bold text-amber-400">{stats?.inProgress ?? 0}</div>
              <div className="text-[10px] text-white/50 font-medium mt-0.5">In Progress</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center" data-testid="stat-critical">
              <div className="text-2xl font-bold text-orange-400">{stats?.critical ?? 0}</div>
              <div className="text-[10px] text-white/50 font-medium mt-0.5">Critical</div>
            </div>
          </div>
        )}

        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 gap-1" data-testid="tabs-container">
          <button
            onClick={() => { setTab("all_open"); setVisibleCount(PAGE_SIZE); }}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
              tab === "all_open"
                ? "bg-blue-600 text-white"
                : "text-white/60 active:bg-white/10"
            }`}
            data-testid="tab-all-open"
          >
            All Open
            <span className="ml-1 text-[10px] opacity-70">({stats?.open ?? 0})</span>
          </button>
          <button
            onClick={() => { setTab("mine"); setVisibleCount(PAGE_SIZE); }}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
              tab === "mine"
                ? "bg-blue-600 text-white"
                : "text-white/60 active:bg-white/10"
            }`}
            data-testid="tab-mine"
          >
            My Orders
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            placeholder="Search work orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10"
            data-testid="input-search"
          />
        </div>

        {ordersError ? (
          <button
            onClick={() => refetchOrders()}
            className="w-full flex flex-col items-center justify-center py-16 rounded-2xl border border-red-500/20 bg-red-500/5"
            data-testid="button-retry-orders"
          >
            <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
            <p className="text-sm font-medium text-red-400">Failed to load work orders</p>
            <span className="text-xs text-white/40 mt-2 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Tap to retry
            </span>
          </button>
        ) : isLoading ? (
          <div className="space-y-3" data-testid="skeleton-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Skeleton className="h-4 w-24 bg-white/10 mb-2" />
                <Skeleton className="h-5 w-48 bg-white/10 mb-1" />
                <Skeleton className="h-3 w-32 bg-white/10" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/40" data-testid="empty-state">
            <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {tab === "mine" ? "No work orders assigned to you" : "No open work orders"}
            </p>
            <p className="text-xs mt-1">
              {tab === "mine" ? "Orders assigned to you will appear here" : "All work orders are resolved"}
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="order-list">
            {filteredOrders.slice(0, visibleCount).map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
            {filteredOrders.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-blue-400 active:bg-white/10 transition-colors"
                data-testid="button-load-more"
              >
                Load More ({filteredOrders.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>
      </div>
      <MobileBottomNav />
    </MobileLayout>
  );
}
