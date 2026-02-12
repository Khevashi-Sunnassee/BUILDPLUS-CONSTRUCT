import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, ChevronDown, ChevronRight, Send, Check, X, Undo2, Trash2, Edit, Clock, FileText, History, DollarSign, Wrench, Building2, ShieldCheck, Package, Loader2, ShoppingCart, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ASSET_CATEGORIES, CAPEX_PURCHASE_REASONS } from "@shared/schema";
import type { CapexRequest, User, Job, Department, Supplier, Asset } from "@shared/schema";

interface CapexRequestWithDetails extends CapexRequest {
  requestedBy: User;
  approvingManager?: User | null;
  proposedAssetManager?: User | null;
  approvedBy?: User | null;
  rejectedBy?: User | null;
  job?: Job | null;
  department?: { id: string; name: string; code: string } | null;
  preferredSupplier?: Supplier | null;
  factory?: { id: string; name: string; code: string } | null;
  replacementAsset?: Asset | null;
  purchaseOrder?: { id: string; poNumber: string; status: string; total: string | null } | null;
}

interface AuditEvent {
  id: string;
  capexRequestId: string;
  eventType: string;
  actorId: string;
  actorName: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }> = {
  DRAFT: { variant: "secondary" },
  SUBMITTED: { variant: "default" },
  APPROVED: { variant: "default", className: "bg-green-600 text-white" },
  REJECTED: { variant: "destructive" },
  WITHDRAWN: { variant: "outline" },
};

function formatCurrency(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_BADGE[status] || STATUS_BADGE.DRAFT;
  return (
    <Badge variant={config.variant} className={config.className} data-testid={`badge-status-${status}`}>
      {status === "SUBMITTED" ? "Under Review" : status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children }: { title: string; icon: any; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between" data-testid={`collapsible-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-4 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function CurrencyInput({ value, onChange, ...props }: { value: string; onChange: (val: string) => void; [key: string]: any }) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!focused) {
      setDisplayValue(value);
    }
  }, [value, focused]);

  const formatDisplay = (raw: string) => {
    const num = parseFloat(raw);
    if (isNaN(num) || raw === "") return "";
    return new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
      <Input
        {...props}
        className="pl-7"
        type={focused ? "number" : "text"}
        step={focused ? "0.01" : undefined}
        value={focused ? displayValue : formatDisplay(value)}
        onFocus={() => {
          setFocused(true);
          setDisplayValue(value);
        }}
        onBlur={() => {
          setFocused(false);
          if (displayValue) {
            const num = parseFloat(displayValue);
            if (!isNaN(num)) {
              onChange(num.toString());
            }
          }
        }}
        onChange={(e) => {
          setDisplayValue(e.target.value);
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

interface ReplacementPrefill {
  assetId: string;
  assetName: string;
  assetTag: string;
  assetCategory: string;
  assetCurrentValue: string;
  assetLocation: string;
}

function CapexForm({ capex, onSave, onClose, replacementPrefill }: { capex?: CapexRequestWithDetails | null; onSave: () => void; onClose: () => void; replacementPrefill?: ReplacementPrefill | null }) {
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    jobId: capex?.jobId || "",
    departmentId: capex?.departmentId || "",
    proposedAssetManagerId: capex?.proposedAssetManagerId || "",
    approvingManagerId: capex?.approvingManagerId || "",
    equipmentTitle: capex?.equipmentTitle || (replacementPrefill ? `Replacement for ${replacementPrefill.assetName} (${replacementPrefill.assetTag})` : ""),
    equipmentCategory: capex?.equipmentCategory || replacementPrefill?.assetCategory || "",
    equipmentDescription: capex?.equipmentDescription || "",
    purchaseReasons: (capex?.purchaseReasons as string[]) || (replacementPrefill ? ["replacement"] : []),
    isReplacement: capex?.isReplacement || !!replacementPrefill,
    replacementAssetId: capex?.replacementAssetId || replacementPrefill?.assetId || "",
    replacementReason: capex?.replacementReason || "",
    totalEquipmentCost: capex?.totalEquipmentCost || "",
    transportationCost: capex?.transportationCost || "",
    insuranceCost: capex?.insuranceCost || "",
    monthlyMaintenanceCost: capex?.monthlyMaintenanceCost || "",
    monthlyResourceCost: capex?.monthlyResourceCost || "",
    additionalCosts: capex?.additionalCosts || "",
    expectedPaybackPeriod: capex?.expectedPaybackPeriod || "",
    expectedResourceSavings: capex?.expectedResourceSavings || "",
    riskAnalysis: capex?.riskAnalysis || "",
    expectedUsefulLife: capex?.expectedUsefulLife || "",
    preferredSupplierId: capex?.preferredSupplierId || "",
    alternativeSuppliers: capex?.alternativeSuppliers || "",
    equipmentLocation: capex?.equipmentLocation || replacementPrefill?.assetLocation || "",
    factoryId: capex?.factoryId || "",
    factoryZone: capex?.factoryZone || "",
    proximityToInputMaterials: capex?.proximityToInputMaterials || "",
    siteReadiness: capex?.siteReadiness || "",
    newWorkflowDescription: capex?.newWorkflowDescription || "",
    safetyConsiderations: capex?.safetyConsiderations || "",
  });

  const { data: jobsList = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: departmentsList = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: usersList = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: suppliersList = [] } = useQuery<Supplier[]>({ queryKey: ["/api/procurement/suppliers/active"] });
  const { data: assetsList = [] } = useQuery<Asset[]>({ queryKey: ["/api/admin/assets"], enabled: formData.isReplacement });
  const { data: factoriesList = [] } = useQuery<{ id: string; name: string; code: string }[]>({ queryKey: ["/api/factories"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        jobId: formData.jobId || null,
        departmentId: formData.departmentId || null,
        proposedAssetManagerId: formData.proposedAssetManagerId || null,
        approvingManagerId: formData.approvingManagerId || null,
        equipmentCategory: formData.equipmentCategory || null,
        replacementAssetId: formData.replacementAssetId || null,
        preferredSupplierId: formData.preferredSupplierId || null,
        factoryId: formData.factoryId || null,
      };
      if (capex) {
        await apiRequest("PUT", `/api/capex-requests/${capex.id}`, payload);
      } else {
        await apiRequest("POST", "/api/capex-requests", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capex-requests"] });
      toast({ title: capex ? "CAPEX request updated" : "CAPEX request created" });
      onSave();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const update = (field: string, value: any) => setFormData((prev) => ({ ...prev, [field]: value }));

  const toggleReason = (reason: string) => {
    setFormData((prev) => ({
      ...prev,
      purchaseReasons: prev.purchaseReasons.includes(reason)
        ? prev.purchaseReasons.filter((r) => r !== reason)
        : [...prev.purchaseReasons, reason],
    }));
  };

  return (
    <div className="space-y-2">
      <CollapsibleSection title="General Information" icon={FileText} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label>Job</Label>
            <Select value={formData.jobId} onValueChange={(v) => update("jobId", v)}>
              <SelectTrigger data-testid="select-job"><SelectValue placeholder="Select job" /></SelectTrigger>
              <SelectContent>
                {(Array.isArray(jobsList) ? jobsList : []).map((j: any) => (
                  <SelectItem key={j.id} value={j.id}>{j.jobNumber} - {j.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Department</Label>
            <Select value={formData.departmentId} onValueChange={(v) => update("departmentId", v)}>
              <SelectTrigger data-testid="select-department"><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {(Array.isArray(departmentsList) ? departmentsList : []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Proposed Asset Manager</Label>
            <Select value={formData.proposedAssetManagerId} onValueChange={(v) => update("proposedAssetManagerId", v)}>
              <SelectTrigger data-testid="select-asset-manager"><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {(Array.isArray(usersList) ? usersList : []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Approving Manager</Label>
            <Select value={formData.approvingManagerId} onValueChange={(v) => update("approvingManagerId", v)}>
              <SelectTrigger data-testid="select-approving-manager"><SelectValue placeholder="Select approving manager" /></SelectTrigger>
              <SelectContent>
                {(Array.isArray(usersList) ? usersList : []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email} {u.role ? `(${u.role})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Equipment Title *</Label>
            <Input value={formData.equipmentTitle} onChange={(e) => update("equipmentTitle", e.target.value)} data-testid="input-equipment-title" required />
          </div>
          <div>
            <Label>Equipment Category</Label>
            <Select value={formData.equipmentCategory} onValueChange={(v) => update("equipmentCategory", v)}>
              <SelectTrigger data-testid="select-equipment-category"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {ASSET_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Equipment Description</Label>
            <Textarea value={formData.equipmentDescription} onChange={(e) => update("equipmentDescription", e.target.value)} data-testid="input-equipment-description" rows={3} />
          </div>
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Reasons for Purchase" icon={Package}>
        <div className="space-y-2">
          {CAPEX_PURCHASE_REASONS.map((reason) => (
            <div key={reason} className="flex items-center gap-2">
              <Checkbox
                checked={formData.purchaseReasons.includes(reason)}
                onCheckedChange={() => toggleReason(reason)}
                data-testid={`checkbox-reason-${reason.substring(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
              />
              <Label className="font-normal cursor-pointer" onClick={() => toggleReason(reason)}>{reason}</Label>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Replacement Information" icon={Wrench}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.isReplacement}
              onCheckedChange={(checked) => update("isReplacement", !!checked)}
              data-testid="checkbox-is-replacement"
            />
            <Label className="font-normal">This is a replacement for an existing asset</Label>
          </div>
          {formData.isReplacement && (
            <>
              <div>
                <Label>Asset Being Replaced</Label>
                <Select value={formData.replacementAssetId} onValueChange={(v) => update("replacementAssetId", v)}>
                  <SelectTrigger data-testid="select-replacement-asset"><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(assetsList) ? assetsList : []).map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.assetTag} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Replacement Reason</Label>
                <Textarea value={formData.replacementReason} onChange={(e) => update("replacementReason", e.target.value)} data-testid="input-replacement-reason" rows={3} />
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Cost Analysis" icon={DollarSign}>
        <div className="space-y-3">
          <div>
            <Label>Total Equipment Cost (AUD) *</Label>
            <CurrencyInput value={formData.totalEquipmentCost} onChange={(val) => update("totalEquipmentCost", val)} data-testid="input-total-cost" />
          </div>
          <div>
            <Label>Transportation Cost (AUD)</Label>
            <CurrencyInput value={formData.transportationCost} onChange={(val) => update("transportationCost", val)} data-testid="input-transportation-cost" />
          </div>
          <div>
            <Label>Insurance Cost (AUD)</Label>
            <CurrencyInput value={formData.insuranceCost} onChange={(val) => update("insuranceCost", val)} data-testid="input-insurance-cost" />
          </div>
          <div>
            <Label>Monthly Maintenance Cost (AUD)</Label>
            <CurrencyInput value={formData.monthlyMaintenanceCost} onChange={(val) => update("monthlyMaintenanceCost", val)} data-testid="input-maintenance-cost" />
          </div>
          <div>
            <Label>Monthly Resource Cost (AUD)</Label>
            <CurrencyInput value={formData.monthlyResourceCost} onChange={(val) => update("monthlyResourceCost", val)} data-testid="input-resource-cost" />
          </div>
          <div>
            <Label>Additional Costs (AUD)</Label>
            <CurrencyInput value={formData.additionalCosts} onChange={(val) => update("additionalCosts", val)} data-testid="input-additional-costs" />
          </div>
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Business Case" icon={ShieldCheck}>
        <div className="space-y-3">
          <div>
            <Label>Expected Payback Period</Label>
            <Input value={formData.expectedPaybackPeriod} onChange={(e) => update("expectedPaybackPeriod", e.target.value)} data-testid="input-payback-period" placeholder="e.g., 2 years" />
          </div>
          <div>
            <Label>Expected Resource Savings</Label>
            <Textarea value={formData.expectedResourceSavings} onChange={(e) => update("expectedResourceSavings", e.target.value)} data-testid="input-resource-savings" rows={2} />
          </div>
          <div>
            <Label>Risk Analysis</Label>
            <Textarea value={formData.riskAnalysis} onChange={(e) => update("riskAnalysis", e.target.value)} data-testid="input-risk-analysis" rows={2} />
          </div>
          <div>
            <Label>Expected Useful Life</Label>
            <Input value={formData.expectedUsefulLife} onChange={(e) => update("expectedUsefulLife", e.target.value)} data-testid="input-useful-life" placeholder="e.g., 10 years" />
          </div>
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Supplier Information" icon={Package}>
        <div className="space-y-3">
          <div>
            <Label>Preferred Supplier</Label>
            <Select value={formData.preferredSupplierId} onValueChange={(v) => update("preferredSupplierId", v)}>
              <SelectTrigger data-testid="select-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {(Array.isArray(suppliersList) ? suppliersList : []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Alternative Suppliers</Label>
            <Textarea value={formData.alternativeSuppliers} onChange={(e) => update("alternativeSuppliers", e.target.value)} data-testid="input-alt-suppliers" rows={2} />
          </div>
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Installation & Setup" icon={Building2}>
        <div className="space-y-3">
          <div>
            <Label>Equipment Location</Label>
            <Input value={formData.equipmentLocation} onChange={(e) => update("equipmentLocation", e.target.value)} data-testid="input-equipment-location" />
          </div>
          <div>
            <Label>Factory</Label>
            <Select value={formData.factoryId} onValueChange={(v) => update("factoryId", v)}>
              <SelectTrigger data-testid="select-factory"><SelectValue placeholder="Select factory" /></SelectTrigger>
              <SelectContent>
                {(Array.isArray(factoriesList) ? factoriesList : []).map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Factory Zone</Label>
            <Input value={formData.factoryZone} onChange={(e) => update("factoryZone", e.target.value)} data-testid="input-factory-zone" />
          </div>
          <div>
            <Label>Proximity to Input Materials</Label>
            <Textarea value={formData.proximityToInputMaterials} onChange={(e) => update("proximityToInputMaterials", e.target.value)} data-testid="input-proximity" rows={2} />
          </div>
          <div>
            <Label>Site Readiness</Label>
            <Textarea value={formData.siteReadiness} onChange={(e) => update("siteReadiness", e.target.value)} data-testid="input-site-readiness" rows={2} />
          </div>
          <div>
            <Label>New Workflow Description</Label>
            <Textarea value={formData.newWorkflowDescription} onChange={(e) => update("newWorkflowDescription", e.target.value)} data-testid="input-workflow" rows={2} />
          </div>
          <div>
            <Label>Safety Considerations</Label>
            <Textarea value={formData.safetyConsiderations} onChange={(e) => update("safetyConsiderations", e.target.value)} data-testid="input-safety" rows={2} />
          </div>
        </div>
      </CollapsibleSection>

      <div className="flex gap-2 pt-4">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formData.equipmentTitle} data-testid="button-save-capex">
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {capex ? "Update" : "Create"} Request
        </Button>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-capex">Cancel</Button>
      </div>
    </div>
  );
}

function ApprovalTimeline({ status, submittedAt, approvedAt, rejectedAt }: { status: string; submittedAt?: string | null; approvedAt?: string | null; rejectedAt?: string | null }) {
  const steps = [
    { label: "Draft", done: true },
    { label: "Submitted", done: ["SUBMITTED", "APPROVED", "REJECTED"].includes(status) },
    { label: status === "REJECTED" ? "Rejected" : "Approved", done: ["APPROVED", "REJECTED"].includes(status), isRejected: status === "REJECTED" },
  ];
  return (
    <div className="flex items-center gap-2 py-3" data-testid="approval-timeline">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium ${
            step.isRejected ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
            step.done ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
            "bg-muted text-muted-foreground"
          }`}>
            {step.done ? (step.isRejected ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />) : <Clock className="h-3 w-3" />}
            {step.label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

function DetailView({ capex, onClose }: { capex: CapexRequestWithDetails; onClose: () => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("form");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const { data: auditHistory = [] } = useQuery<AuditEvent[]>({
    queryKey: ["/api/capex-requests", capex.id, "audit-history"],
    queryFn: async () => {
      const res = await fetch(`/api/capex-requests/${capex.id}/audit-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit history");
      return res.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, data }: { action: string; data?: any }) => {
      const methodMap: Record<string, string> = {
        submit: "PUT",
        approve: "POST",
        reject: "POST",
        withdraw: "POST",
        discard: "DELETE",
      };
      const urlMap: Record<string, string> = {
        submit: `/api/capex-requests/${capex.id}/submit`,
        approve: `/api/capex-requests/${capex.id}/approve`,
        reject: `/api/capex-requests/${capex.id}/reject`,
        withdraw: `/api/capex-requests/${capex.id}/withdraw`,
        discard: `/api/capex-requests/${capex.id}/draft`,
      };
      await apiRequest(methodMap[action], urlMap[action], data);
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/capex-requests"] });
      const labels: Record<string, string> = {
        submit: "Request submitted for approval",
        approve: "Request approved",
        reject: "Request rejected",
        withdraw: "Request withdrawn",
        discard: "Draft discarded",
      };
      toast({ title: labels[action] || "Action completed" });
      setConfirmAction(null);
      setRejectDialogOpen(false);
      if (action === "discard") onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setConfirmAction(null);
    },
  });

  const canEdit = capex.status === "DRAFT";
  const isSubmitted = capex.status === "SUBMITTED";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-capex-number">{capex.capexNumber}</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-capex-title">{capex.equipmentTitle}</p>
        </div>
        <StatusBadge status={capex.status} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {capex.status === "DRAFT" && (
          <>
            <Button size="sm" onClick={() => setConfirmAction("submit")} data-testid="button-submit-capex">
              <Send className="h-4 w-4 mr-1" /> Submit
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmAction("discard")} data-testid="button-discard-capex">
              <Trash2 className="h-4 w-4 mr-1" /> Discard
            </Button>
          </>
        )}
        {isSubmitted && (
          <>
            <Button size="sm" onClick={() => setConfirmAction("approve")} className="bg-green-600 text-white" data-testid="button-approve-capex">
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)} data-testid="button-reject-capex">
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmAction("withdraw")} data-testid="button-withdraw-capex">
              <Undo2 className="h-4 w-4 mr-1" /> Withdraw
            </Button>
          </>
        )}
        {capex.status === "APPROVED" && !capex.purchaseOrderId && (
          <Button
            size="sm"
            onClick={() => navigate(`/purchase-orders/new?capexId=${capex.id}`)}
            data-testid="button-create-po-from-capex"
          >
            <ShoppingCart className="h-4 w-4 mr-1" /> Create Purchase Order
          </Button>
        )}
        {capex.purchaseOrder && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/purchase-orders/${capex.purchaseOrder!.id}`)}
            data-testid="button-view-linked-po"
          >
            <ExternalLink className="h-4 w-4 mr-1" /> View PO {capex.purchaseOrder.poNumber}
          </Button>
        )}
      </div>

      <ApprovalTimeline status={capex.status} submittedAt={capex.submittedAt as any} approvedAt={capex.approvedAt as any} rejectedAt={capex.rejectedAt as any} />

      {capex.status === "REJECTED" && capex.rejectionReason && (
        <Card className="border-destructive">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
            <p className="text-sm" data-testid="text-rejection-reason">{capex.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="form" data-testid="tab-form">CAPEX Form</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="form">
          {canEdit ? (
            <CapexForm capex={capex} onSave={onClose} onClose={onClose} />
          ) : (
            <div className="space-y-4">
              <DetailSection title="General Information">
                <DetailRow label="CAPEX Number" value={capex.capexNumber} />
                <DetailRow label="Job" value={capex.job ? `${capex.job.jobNumber} - ${capex.job.name}` : "-"} />
                <DetailRow label="Department" value={capex.department?.name} />
                <DetailRow label="Proposed Asset Manager" value={capex.proposedAssetManager?.name || capex.proposedAssetManager?.email} />
                <DetailRow label="Approving Manager" value={capex.approvingManager?.name || capex.approvingManager?.email} />
                <DetailRow label="Equipment Title" value={capex.equipmentTitle} />
                <DetailRow label="Equipment Category" value={capex.equipmentCategory} />
                <DetailRow label="Equipment Description" value={capex.equipmentDescription} />
              </DetailSection>
              <DetailSection title="Reasons for Purchase">
                <div className="flex flex-wrap gap-1">
                  {(capex.purchaseReasons as string[] || []).map((r) => (
                    <Badge key={r} variant="secondary">{r}</Badge>
                  ))}
                  {(!capex.purchaseReasons || (capex.purchaseReasons as string[]).length === 0) && <span className="text-sm text-muted-foreground">None specified</span>}
                </div>
              </DetailSection>
              {capex.isReplacement && (
                <DetailSection title="Replacement Information">
                  <DetailRow label="Replacement Asset" value={capex.replacementAsset ? `${capex.replacementAsset.assetTag} - ${capex.replacementAsset.name}` : "-"} />
                  <DetailRow label="Replacement Reason" value={capex.replacementReason} />
                </DetailSection>
              )}
              <DetailSection title="Cost Analysis">
                <DetailRow label="Total Equipment Cost" value={formatCurrency(capex.totalEquipmentCost)} />
                <DetailRow label="Transportation Cost" value={formatCurrency(capex.transportationCost)} />
                <DetailRow label="Insurance Cost" value={formatCurrency(capex.insuranceCost)} />
                <DetailRow label="Monthly Maintenance" value={formatCurrency(capex.monthlyMaintenanceCost)} />
                <DetailRow label="Monthly Resource" value={formatCurrency(capex.monthlyResourceCost)} />
                <DetailRow label="Additional Costs" value={formatCurrency(capex.additionalCosts)} />
              </DetailSection>
              {capex.purchaseOrder && (
                <DetailSection title="Linked Purchase Order">
                  <DetailRow label="PO Number" value={capex.purchaseOrder.poNumber} />
                  <DetailRow label="PO Status" value={capex.purchaseOrder.status} />
                  {capex.purchaseOrder.total && (
                    <DetailRow label="PO Total" value={formatCurrency(capex.purchaseOrder.total)} />
                  )}
                </DetailSection>
              )}
              <DetailSection title="Business Case">
                <DetailRow label="Expected Payback Period" value={capex.expectedPaybackPeriod} />
                <DetailRow label="Expected Resource Savings" value={capex.expectedResourceSavings} />
                <DetailRow label="Risk Analysis" value={capex.riskAnalysis} />
                <DetailRow label="Expected Useful Life" value={capex.expectedUsefulLife} />
              </DetailSection>
              <DetailSection title="Supplier Information">
                <DetailRow label="Preferred Supplier" value={capex.preferredSupplier?.name} />
                <DetailRow label="Alternative Suppliers" value={capex.alternativeSuppliers} />
              </DetailSection>
              <DetailSection title="Installation & Setup">
                <DetailRow label="Equipment Location" value={capex.equipmentLocation} />
                <DetailRow label="Factory" value={capex.factory?.name} />
                <DetailRow label="Factory Zone" value={capex.factoryZone} />
                <DetailRow label="Proximity to Input Materials" value={capex.proximityToInputMaterials} />
                <DetailRow label="Site Readiness" value={capex.siteReadiness} />
                <DetailRow label="New Workflow" value={capex.newWorkflowDescription} />
                <DetailRow label="Safety Considerations" value={capex.safetyConsiderations} />
              </DetailSection>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground" data-testid="text-documents-placeholder">
                Documents for this CAPEX request can be managed through the Document Register.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-3">
            {auditHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-history">No audit history available</p>
            ) : (
              auditHistory.map((event) => (
                <Card key={event.id} data-testid={`audit-event-${event.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <History className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium capitalize">{event.eventType.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">by {event.actorName || "Unknown"}</p>
                      {event.metadata?.reason && (
                        <p className="text-xs mt-1">Reason: {event.metadata.reason}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "submit" && "Submit for Approval"}
              {confirmAction === "approve" && "Approve Request"}
              {confirmAction === "withdraw" && "Withdraw Request"}
              {confirmAction === "discard" && "Discard Draft"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "submit" && "This will send the request for approval. Are you sure?"}
              {confirmAction === "approve" && "This will approve the CAPEX request. Are you sure?"}
              {confirmAction === "withdraw" && "This will withdraw the request back to draft. Are you sure?"}
              {confirmAction === "discard" && "This will permanently delete this draft. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && actionMutation.mutate({ action: confirmAction })}
              disabled={actionMutation.isPending}
              data-testid="button-confirm-action"
            >
              {actionMutation.isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject CAPEX Request</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={3}
            data-testid="input-reject-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reject">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionMutation.mutate({ action: "reject", data: { reason: rejectReason } })}
              disabled={actionMutation.isPending || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              {actionMutation.isPending ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground min-w-[160px] shrink-0">{label}:</span>
      <span data-testid={`text-detail-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value || "-"}</span>
    </div>
  );
}

export default function CapexRequestsPage() {
  const { toast } = useToast();
  const searchParams = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [selectedCapex, setSelectedCapex] = useState<CapexRequestWithDetails | null>(null);
  const [editCapex, setEditCapex] = useState<CapexRequestWithDetails | null>(null);
  const [replacementPrefill, setReplacementPrefill] = useState<ReplacementPrefill | null>(null);
  const [autoOpenId, setAutoOpenId] = useState<string | null>(() => {
    const params = new URLSearchParams(searchParams);
    return params.get("open");
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get("create") === "replacement" && params.get("assetId")) {
      setReplacementPrefill({
        assetId: params.get("assetId")!,
        assetName: params.get("assetName") || "",
        assetTag: params.get("assetTag") || "",
        assetCategory: params.get("assetCategory") || "",
        assetCurrentValue: params.get("assetCurrentValue") || "",
        assetLocation: params.get("assetLocation") || "",
      });
      setCreateSheetOpen(true);
    }
  }, []);

  const { data: requests = [], isLoading } = useQuery<CapexRequestWithDetails[]>({
    queryKey: ["/api/capex-requests"],
  });

  useEffect(() => {
    if (autoOpenId && requests.length > 0 && !selectedCapex) {
      const match = requests.find((r) => r.id === autoOpenId);
      if (match) {
        setSelectedCapex(match);
        setAutoOpenId(null);
      }
    }
  }, [autoOpenId, requests, selectedCapex]);

  const filtered = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter((r) =>
      r.equipmentTitle.toLowerCase().includes(q) ||
      (r.department?.name || "").toLowerCase().includes(q) ||
      (r.proposedAssetManager?.name || "").toLowerCase().includes(q) ||
      (r.capexNumber || "").toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, CapexRequestWithDetails[]> = {
      DRAFT: [],
      SUBMITTED: [],
      APPROVED: [],
      REJECTED: [],
    };
    filtered.forEach((r) => {
      const key = r.status === "WITHDRAWN" ? "DRAFT" : r.status;
      if (groups[key]) groups[key].push(r);
      else groups.DRAFT.push(r);
    });
    return groups;
  }, [filtered]);

  const columnLabels: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Under Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-capex-page-title">CAPEX Requests</h1>
          <p className="text-sm text-muted-foreground">Manage capital expenditure requests</p>
        </div>
        <Button onClick={() => setCreateSheetOpen(true)} data-testid="button-new-capex">
          <Plus className="h-4 w-4 mr-2" />
          New CAPEX Request
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, project, department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-capex"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(grouped).map(([status, items]) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold" data-testid={`text-column-${status.toLowerCase()}`}>{columnLabels[status]}</h2>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            {items.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">No requests</p>
                </CardContent>
              </Card>
            ) : (
              items.map((req) => (
                <Card
                  key={req.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedCapex(req)}
                  data-testid={`card-capex-${req.id}`}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight" data-testid={`text-title-${req.id}`}>{req.equipmentTitle}</p>
                      <StatusBadge status={req.status} />
                    </div>
                    {req.job && (
                      <p className="text-xs text-muted-foreground" data-testid={`text-project-${req.id}`}>{req.job.jobNumber} - {req.job.name}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span data-testid={`text-cost-${req.id}`}>{formatCurrency(req.totalEquipmentCost)}</span>
                      {req.department && <span data-testid={`text-dept-${req.id}`}>{req.department.name}</span>}
                    </div>
                    {req.equipmentCategory && (
                      <p className="text-xs text-muted-foreground" data-testid={`text-category-${req.id}`}>{req.equipmentCategory}</p>
                    )}
                    <p className="text-xs text-muted-foreground" data-testid={`text-time-${req.id}`}>
                      {req.submittedAt
                        ? `Submitted ${formatDistanceToNow(new Date(req.submittedAt), { addSuffix: true })}`
                        : `Created ${formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}`
                      }
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ))}
      </div>

      <Dialog open={createSheetOpen} onOpenChange={(open) => { setCreateSheetOpen(open); if (!open) setReplacementPrefill(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-capex">
          <DialogHeader>
            <DialogTitle>{replacementPrefill ? "New CAPEX Request - Asset Replacement" : "New CAPEX Request"}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <CapexForm
              onSave={() => { setCreateSheetOpen(false); setReplacementPrefill(null); }}
              onClose={() => { setCreateSheetOpen(false); setReplacementPrefill(null); }}
              replacementPrefill={replacementPrefill}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedCapex} onOpenChange={(open) => !open && setSelectedCapex(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="sheet-detail-capex">
          <SheetHeader>
            <SheetTitle>CAPEX Request Details</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedCapex && (
              <DetailView capex={selectedCapex} onClose={() => setSelectedCapex(null)} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!editCapex} onOpenChange={(open) => !open && setEditCapex(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-capex">
          <DialogHeader>
            <DialogTitle>Edit CAPEX Request</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {editCapex && (
              <CapexForm capex={editCapex} onSave={() => setEditCapex(null)} onClose={() => setEditCapex(null)} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}