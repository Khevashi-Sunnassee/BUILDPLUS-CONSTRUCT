import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileText, Package, Wrench, DollarSign, ShieldCheck, Building2, Loader2, Search, Check, X, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ASSET_CATEGORIES, CAPEX_PURCHASE_REASONS } from "@shared/schema";
import type { User, Job, Department, Supplier, Asset } from "@shared/schema";
import type { CapexRequestWithDetails, ReplacementPrefill } from "./types";

interface CostCodeOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

const capexFormSchema = z.object({
  costCodeId: z.string().min(1, "Please select a valid cost code"),
  equipmentTitle: z.string().min(1, "Equipment title is required"),
});

function CostCodeCombobox({ value, onChange, costCodes, error }: { value: string; onChange: (val: string) => void; costCodes: CostCodeOption[]; error?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedCode = costCodes.find((c) => c.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return costCodes;
    const q = search.toLowerCase();
    return costCodes.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [search, costCodes]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          error ? "border-destructive" : "border-input"
        } bg-background`}
        data-testid="combobox-cost-code"
      >
        <span className={selectedCode ? "text-foreground" : "text-muted-foreground"}>
          {selectedCode ? `${selectedCode.code} — ${selectedCode.name}` : "Search and select cost code..."}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg" data-testid="combobox-cost-code-dropdown">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder="Search cost codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              data-testid="input-search-cost-code"
              autoFocus
            />
            {value && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setSearch("");
                }}
                className="ml-1 rounded-sm p-1 hover:bg-muted"
                data-testid="button-clear-cost-code"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No cost codes found</p>
            ) : (
              filtered.map((cc) => (
                <button
                  key={cc.id}
                  type="button"
                  onClick={() => {
                    onChange(cc.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
                    cc.id === value ? "bg-accent" : ""
                  }`}
                  data-testid={`option-cost-code-${cc.id}`}
                >
                  <Check className={`mr-2 h-4 w-4 ${cc.id === value ? "opacity-100" : "opacity-0"}`} />
                  <div className="flex-1 text-left">
                    <span className="font-medium">{cc.code}</span>
                    <span className="ml-2 text-muted-foreground">{cc.name}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive mt-1" data-testid="text-cost-code-error">{error}</p>}

      {selectedCode && selectedCode.description && (
        <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1" data-testid="text-cost-code-description">
          {selectedCode.description}
        </p>
      )}
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children }: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode }) {
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

function CurrencyInput({ value, onChange, ...props }: { value: string; onChange: (val: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
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

export function CapexForm({ capex, onSave, onClose, replacementPrefill }: { capex?: CapexRequestWithDetails | null; onSave: () => void; onClose: () => void; replacementPrefill?: ReplacementPrefill | null }) {
  const { toast } = useToast();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
    costCodeId: capex?.costCodeId || "",
  });

  const { data: jobsList = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: departmentsList = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: usersList = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: suppliersList = [] } = useQuery<Supplier[]>({ queryKey: ["/api/procurement/suppliers/active"] });
  const { data: assetsList = [] } = useQuery<Asset[]>({ queryKey: ["/api/admin/assets"], enabled: formData.isReplacement });
  const { data: factoriesList = [] } = useQuery<{ id: string; name: string; code: string }[]>({ queryKey: ["/api/factories"] });
  const { data: costCodesList = [] } = useQuery<CostCodeOption[]>({ queryKey: ["/api/cost-codes"] });

  const handleSave = () => {
    const result = capexFormSchema.safeParse({
      costCodeId: formData.costCodeId,
      equipmentTitle: formData.equipmentTitle,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        errors[field] = err.message;
      });
      setValidationErrors(errors);
      toast({ title: "Validation Error", description: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }

    setValidationErrors({});
    saveMutation.mutate();
  };

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
        costCodeId: formData.costCodeId || null,
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

  const update = (field: string, value: string | boolean | string[]) => setFormData((prev) => ({ ...prev, [field]: value }));

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
                {(Array.isArray(jobsList) ? jobsList : []).map((j: Job) => (
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
                {(Array.isArray(departmentsList) ? departmentsList : []).map((d: Department) => (
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
                {(Array.isArray(usersList) ? usersList : []).map((u: User) => (
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
                {(Array.isArray(usersList) ? usersList : []).map((u: User) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email} {u.role ? `(${u.role})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cost Code *</Label>
            <CostCodeCombobox
              value={formData.costCodeId}
              onChange={(val) => {
                update("costCodeId", val);
                if (val) setValidationErrors((prev) => { const next = { ...prev }; delete next.costCodeId; return next; });
              }}
              costCodes={costCodesList}
              error={validationErrors.costCodeId}
            />
          </div>
          <div>
            <Label>Equipment Title *</Label>
            <Input
              value={formData.equipmentTitle}
              onChange={(e) => {
                update("equipmentTitle", e.target.value);
                if (e.target.value.trim()) setValidationErrors((prev) => { const next = { ...prev }; delete next.equipmentTitle; return next; });
              }}
              className={validationErrors.equipmentTitle ? "border-destructive" : ""}
              data-testid="input-equipment-title"
              required
            />
            {validationErrors.equipmentTitle && <p className="text-xs text-destructive mt-1">{validationErrors.equipmentTitle}</p>}
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
                    {(Array.isArray(assetsList) ? assetsList : []).map((a: Asset) => (
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
                {(Array.isArray(suppliersList) ? suppliersList : []).map((s: Supplier) => (
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
                {(Array.isArray(factoriesList) ? factoriesList : []).map((f: { id: string; name: string; code: string }) => (
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
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-capex">
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {capex ? "Update" : "Create"} Request
        </Button>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-capex">Cancel</Button>
      </div>
    </div>
  );
}
