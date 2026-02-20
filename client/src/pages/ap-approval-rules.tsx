import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AP_APPROVAL_RULES_ROUTES, USER_ROUTES, ADMIN_ROUTES, JOBS_ROUTES, PROCUREMENT_ROUTES } from "@shared/api-routes";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, MoreHorizontal, Trash2, Pencil, ChevronUp, ChevronDown, X, Loader2, HelpCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ApApprovalCondition } from "@shared/schema";

interface ApprovalRule {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  ruleType: string;
  isActive: boolean;
  priority: number;
  conditions: ApApprovalCondition[] | { minAmount?: string; maxAmount?: string; supplierId?: string } | null;
  approverUserIds: string[];
  autoApprove: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface JobOption {
  id: string;
  name: string;
  jobNumber: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

const FIELD_LABELS: Record<string, string> = {
  COMPANY: "Company",
  AMOUNT: "Invoice Total",
  JOB: "Job",
  SUPPLIER: "Supplier",
  GL_CODE: "GL Code",
};

const OPERATOR_LABELS: Record<string, string> = {
  EQUALS: "Equals",
  NOT_EQUALS: "Not Equals",
  GREATER_THAN: "Greater than",
  LESS_THAN: "Less than",
  GREATER_THAN_OR_EQUALS: "Greater than or equals",
  LESS_THAN_OR_EQUALS: "Less than or equals",
};

const FIELD_OPTIONS = [
  { value: "COMPANY", label: "Company" },
  { value: "AMOUNT", label: "Invoice Total" },
  { value: "JOB", label: "Job" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "GL_CODE", label: "GL Code" },
];

function getOperatorsForField(field: string) {
  switch (field) {
    case "COMPANY":
    case "SUPPLIER":
      return [
        { value: "EQUALS", label: "Equals" },
        { value: "NOT_EQUALS", label: "Not Equals" },
      ];
    case "AMOUNT":
      return [
        { value: "EQUALS", label: "Equals" },
        { value: "GREATER_THAN", label: "Greater than" },
        { value: "LESS_THAN", label: "Less than" },
        { value: "GREATER_THAN_OR_EQUALS", label: "Greater than or equals" },
        { value: "LESS_THAN_OR_EQUALS", label: "Less than or equals" },
      ];
    case "JOB":
    case "GL_CODE":
      return [{ value: "EQUALS", label: "Equals" }];
    default:
      return [{ value: "EQUALS", label: "Equals" }];
  }
}

function isConditionsArray(conditions: any): conditions is ApApprovalCondition[] {
  return Array.isArray(conditions);
}

function getTypeBadge(ruleType: string) {
  switch (ruleType) {
    case "USER_CATCH_ALL":
      return <Badge className="bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" data-testid="badge-type-user-catch-all">User (Catch All)</Badge>;
    case "USER":
      return <Badge className="bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" data-testid="badge-type-user">User</Badge>;
    case "AUTO_APPROVE":
      return <Badge className="bg-blue-600 text-white no-default-hover-elevate no-default-active-elevate" data-testid="badge-type-auto">Auto</Badge>;
    default:
      return <Badge variant="secondary" data-testid="badge-type-unknown">{ruleType}</Badge>;
  }
}

function ConditionValueDisplay({
  condition,
  companies,
  jobs,
  suppliers,
}: {
  condition: ApApprovalCondition;
  companies: CompanyOption[];
  jobs: JobOption[];
  suppliers: SupplierOption[];
}) {
  const resolveValue = (val: string) => {
    switch (condition.field) {
      case "COMPANY": {
        const c = companies.find((co) => co.id === val);
        return c?.name || val;
      }
      case "JOB": {
        const j = jobs.find((jo) => jo.id === val);
        return j ? `${j.name}` : val;
      }
      case "SUPPLIER": {
        const s = suppliers.find((su) => su.id === val);
        return s?.name || val;
      }
      default:
        return val;
    }
  };

  if (condition.values.length === 0) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex flex-col gap-0.5">
      {condition.values.map((v, i) => (
        <div key={i} className="flex items-center gap-1 flex-wrap">
          <span className="bg-muted px-2 py-0.5 rounded text-sm">{resolveValue(v)}</span>
          {i < condition.values.length - 1 && (
            <span className="text-xs text-muted-foreground font-medium">OR</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ConditionsDisplay({
  conditions,
  companies,
  jobs,
  suppliers,
}: {
  conditions: ApprovalRule["conditions"];
  companies: CompanyOption[];
  jobs: JobOption[];
  suppliers: SupplierOption[];
}) {
  if (!conditions) return <span className="text-muted-foreground text-sm">No conditions</span>;

  if (isConditionsArray(conditions)) {
    return (
      <div className="space-y-1">
        {conditions.map((cond, i) => (
          <div key={i} className="flex items-start gap-3">
            {i > 0 && (
              <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0 pt-1">AND</span>
            )}
            {i === 0 && <span className="w-8 shrink-0" />}
            <span className="text-sm min-w-[90px] shrink-0">{FIELD_LABELS[cond.field] || cond.field}</span>
            <span className="text-sm font-medium min-w-[120px] shrink-0">{OPERATOR_LABELS[cond.operator] || cond.operator}</span>
            <ConditionValueDisplay condition={cond} companies={companies} jobs={jobs} suppliers={suppliers} />
          </div>
        ))}
      </div>
    );
  }

  const legacy = conditions as { minAmount?: string; maxAmount?: string; supplierId?: string };
  const parts: string[] = [];
  if (legacy.minAmount) parts.push(`Min Amount: $${legacy.minAmount}`);
  if (legacy.maxAmount) parts.push(`Max Amount: $${legacy.maxAmount}`);
  if (legacy.supplierId) parts.push(`Supplier: ${legacy.supplierId}`);
  return <span className="text-sm text-muted-foreground">{parts.join(", ") || "Legacy conditions"}</span>;
}

function ConditionEditor({
  condition,
  index,
  showAnd,
  companies,
  jobs,
  suppliers,
  onUpdate,
  onRemove,
}: {
  condition: ApApprovalCondition;
  index: number;
  showAnd: boolean;
  companies: CompanyOption[];
  jobs: JobOption[];
  suppliers: SupplierOption[];
  onUpdate: (index: number, updated: ApApprovalCondition) => void;
  onRemove: (index: number) => void;
}) {
  const operators = getOperatorsForField(condition.field);
  const supportsMultiValue = ["COMPANY", "JOB", "SUPPLIER"].includes(condition.field);

  const handleFieldChange = (newField: string) => {
    const newOps = getOperatorsForField(newField);
    onUpdate(index, {
      field: newField as ApApprovalCondition["field"],
      operator: newOps[0].value as ApApprovalCondition["operator"],
      values: [],
    });
  };

  const handleAddValue = (val: string) => {
    if (!val || condition.values.includes(val)) return;
    onUpdate(index, { ...condition, values: [...condition.values, val] });
  };

  const handleRemoveValue = (valIndex: number) => {
    onUpdate(index, { ...condition, values: condition.values.filter((_, i) => i !== valIndex) });
  };

  const renderValueInput = () => {
    switch (condition.field) {
      case "COMPANY":
        return (
          <div className="space-y-2">
            <Select onValueChange={handleAddValue} value="" data-testid={`select-condition-value-${index}`}>
              <SelectTrigger data-testid={`trigger-condition-value-${index}`}>
                <SelectValue placeholder="Select company..." />
              </SelectTrigger>
              <SelectContent>
                {companies
                  .filter((c) => !condition.values.includes(c.id))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {condition.values.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {condition.values.map((v, vi) => {
                  const co = companies.find((c) => c.id === v);
                  return (
                    <Badge key={vi} variant="secondary" className="gap-1" data-testid={`badge-condition-value-${index}-${vi}`}>
                      {co?.name || v}
                      <button onClick={() => handleRemoveValue(vi)} className="ml-1"><X className="h-3 w-3" /></button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "JOB":
        return (
          <div className="space-y-2">
            <Select onValueChange={handleAddValue} value="" data-testid={`select-condition-value-${index}`}>
              <SelectTrigger data-testid={`trigger-condition-value-${index}`}>
                <SelectValue placeholder="Select job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs
                  .filter((j) => !condition.values.includes(j.id))
                  .map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.jobNumber} - {j.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {condition.values.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {condition.values.map((v, vi) => {
                  const jo = jobs.find((j) => j.id === v);
                  return (
                    <Badge key={vi} variant="secondary" className="gap-1" data-testid={`badge-condition-value-${index}-${vi}`}>
                      {jo ? `${jo.name}` : v}
                      <button onClick={() => handleRemoveValue(vi)} className="ml-1"><X className="h-3 w-3" /></button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "SUPPLIER":
        return (
          <div className="space-y-2">
            <Select onValueChange={handleAddValue} value="" data-testid={`select-condition-value-${index}`}>
              <SelectTrigger data-testid={`trigger-condition-value-${index}`}>
                <SelectValue placeholder="Select supplier..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers
                  .filter((s) => !condition.values.includes(s.id))
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {condition.values.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {condition.values.map((v, vi) => {
                  const su = suppliers.find((s) => s.id === v);
                  return (
                    <Badge key={vi} variant="secondary" className="gap-1" data-testid={`badge-condition-value-${index}-${vi}`}>
                      {su?.name || v}
                      <button onClick={() => handleRemoveValue(vi)} className="ml-1"><X className="h-3 w-3" /></button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "AMOUNT":
        return (
          <Input
            type="number"
            min="0"
            step="0.01"
            value={condition.values[0] || ""}
            onChange={(e) => onUpdate(index, { ...condition, values: e.target.value ? [e.target.value] : [] })}
            placeholder="Enter amount..."
            data-testid={`input-condition-value-${index}`}
          />
        );
      case "GL_CODE":
        return (
          <Input
            value={condition.values[0] || ""}
            onChange={(e) => onUpdate(index, { ...condition, values: e.target.value ? [e.target.value] : [] })}
            placeholder="Enter GL code..."
            data-testid={`input-condition-value-${index}`}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      {showAnd && (
        <div className="flex items-center gap-2 py-1">
          <span className="text-xs font-semibold text-muted-foreground">AND</span>
          <div className="flex-1 border-t" />
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={condition.field} onValueChange={handleFieldChange} data-testid={`select-condition-field-${index}`}>
            <SelectTrigger data-testid={`trigger-condition-field-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={condition.operator}
            onValueChange={(v) => onUpdate(index, { ...condition, operator: v as ApApprovalCondition["operator"] })}
            data-testid={`select-condition-operator-${index}`}
          >
            <SelectTrigger data-testid={`trigger-condition-operator-${index}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div>{renderValueInput()}</div>
        </div>
        <Button size="icon" variant="ghost" onClick={() => onRemove(index)} data-testid={`button-remove-condition-${index}`}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ApproversList({
  approverIds,
  users,
  onUpdate,
}: {
  approverIds: string[];
  users: UserOption[];
  onUpdate: (newIds: string[]) => void;
}) {
  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...approverIds];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onUpdate(next);
  };

  const moveDown = (i: number) => {
    if (i >= approverIds.length - 1) return;
    const next = [...approverIds];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onUpdate(next);
  };

  const remove = (i: number) => {
    onUpdate(approverIds.filter((_, idx) => idx !== i));
  };

  const addApprover = (userId: string) => {
    if (!userId || approverIds.includes(userId)) return;
    onUpdate([...approverIds, userId]);
  };

  const availableUsers = users.filter((u) => !approverIds.includes(u.id));

  return (
    <div className="space-y-2">
      <Label>Approvers</Label>
      {approverIds.length > 0 && (
        <div className="space-y-1 border rounded-md p-2">
          {approverIds.map((uid, i) => {
            const user = users.find((u) => u.id === uid);
            return (
              <div key={uid} className="flex items-center gap-2 py-1" data-testid={`approver-row-${i}`}>
                <span className="text-sm font-medium w-6 text-muted-foreground">{i + 1}.</span>
                <span className="text-sm flex-1">{user?.name || user?.email || uid}</span>
                <Button size="icon" variant="ghost" onClick={() => moveUp(i)} disabled={i === 0} data-testid={`button-approver-up-${i}`}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => moveDown(i)} disabled={i >= approverIds.length - 1} data-testid={`button-approver-down-${i}`}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(i)} data-testid={`button-approver-remove-${i}`}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {availableUsers.length > 0 && (
        <Select onValueChange={addApprover} value="" data-testid="select-add-approver">
          <SelectTrigger data-testid="trigger-add-approver">
            <SelectValue placeholder="Add approver..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function RuleFormDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: ApprovalRule | null;
}) {
  const { toast } = useToast();
  const isEditing = !!rule;

  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [ruleType, setRuleType] = useState(rule?.ruleType || "USER");
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [priority, setPriority] = useState(rule?.priority ?? 0);
  const [conditions, setConditions] = useState<ApApprovalCondition[]>(() => {
    if (rule?.conditions && isConditionsArray(rule.conditions)) return rule.conditions;
    return [];
  });
  const [approverIds, setApproverIds] = useState<string[]>(rule?.approverUserIds || []);

  const { data: usersList } = useQuery<UserOption[]>({ queryKey: [USER_ROUTES.LIST], enabled: open });
  const { data: companiesList } = useQuery<CompanyOption[]>({ queryKey: [ADMIN_ROUTES.COMPANIES], enabled: open });
  const { data: jobsList } = useQuery<JobOption[]>({ queryKey: [JOBS_ROUTES.LIST], enabled: open });
  const { data: suppliersList } = useQuery<SupplierOption[]>({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS], enabled: open });

  const users = usersList || [];
  const companies = companiesList || [];
  const jobs = jobsList || [];
  const suppliers = suppliersList || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", AP_APPROVAL_RULES_ROUTES.LIST, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_APPROVAL_RULES_ROUTES.LIST] });
      toast({ title: "Approval rule created" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create rule", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", AP_APPROVAL_RULES_ROUTES.BY_ID(rule!.id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_APPROVAL_RULES_ROUTES.LIST] });
      toast({ title: "Approval rule updated" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update rule", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      ruleType,
      isActive,
      priority,
      conditions: ruleType === "USER_CATCH_ALL" ? [] : conditions,
      approverUserIds: ruleType === "AUTO_APPROVE" ? [] : approverIds,
      autoApprove: ruleType === "AUTO_APPROVE",
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const addCondition = () => {
    setConditions([...conditions, { field: "COMPANY", operator: "EQUALS", values: [] }]);
  };

  const updateCondition = (index: number, updated: ApApprovalCondition) => {
    const next = [...conditions];
    next[index] = updated;
    setConditions(next);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-rule-form">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Approval Rule" : "Create Approval Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Name *</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rule name"
              data-testid="input-rule-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-description">Description</Label>
            <Input
              id="rule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="input-rule-description"
            />
          </div>
          <div className="space-y-2">
            <Label>Rule Type</Label>
            <Select value={ruleType} onValueChange={setRuleType} data-testid="select-rule-type">
              <SelectTrigger data-testid="trigger-rule-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER_CATCH_ALL">User (Catch All)</SelectItem>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="AUTO_APPROVE">Auto Approve</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {ruleType !== "USER_CATCH_ALL" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Conditions</Label>
                <Button size="sm" variant="outline" onClick={addCondition} data-testid="button-add-condition">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Condition
                </Button>
              </div>
              {conditions.length === 0 && (
                <p className="text-sm text-muted-foreground">No conditions added. Click "Add Condition" to start.</p>
              )}
              {conditions.map((cond, i) => (
                <ConditionEditor
                  key={i}
                  condition={cond}
                  index={i}
                  showAnd={i > 0}
                  companies={companies}
                  jobs={jobs}
                  suppliers={suppliers}
                  onUpdate={updateCondition}
                  onRemove={removeCondition}
                />
              ))}
            </div>
          )}

          {ruleType !== "AUTO_APPROVE" && (
            <ApproversList approverIds={approverIds} users={users} onUpdate={setApproverIds} />
          )}

          <div className="space-y-2">
            <Label htmlFor="rule-priority">Priority</Label>
            <Input
              id="rule-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              min={0}
              step="1"
              data-testid="input-rule-priority"
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="rule-enabled"
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid="switch-rule-enabled"
            />
            <Label htmlFor="rule-enabled">Enabled</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-rule">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || isSaving} data-testid="button-save-rule">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ApApprovalRulesPage() {
  useDocumentTitle("Approval Rules");
  const { toast } = useToast();

  const [showUserRules, setShowUserRules] = useState(true);
  const [showAutoApprove, setShowAutoApprove] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: rules, isLoading } = useQuery<ApprovalRule[]>({
    queryKey: [AP_APPROVAL_RULES_ROUTES.LIST],
  });

  const { data: usersList } = useQuery<UserOption[]>({ queryKey: [USER_ROUTES.LIST] });
  const { data: companiesList } = useQuery<CompanyOption[]>({ queryKey: [ADMIN_ROUTES.COMPANIES] });
  const { data: jobsList } = useQuery<JobOption[]>({ queryKey: [JOBS_ROUTES.LIST] });
  const { data: suppliersList } = useQuery<SupplierOption[]>({ queryKey: [PROCUREMENT_ROUTES.SUPPLIERS] });

  const users = usersList || [];
  const companies = companiesList || [];
  const jobs = jobsList || [];
  const suppliers = suppliersList || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", AP_APPROVAL_RULES_ROUTES.BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AP_APPROVAL_RULES_ROUTES.LIST] });
      toast({ title: "Approval rule deleted" });
      setDeleteConfirmId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete rule", description: err.message, variant: "destructive" });
    },
  });

  const filteredRules = useMemo(() => {
    if (!rules) return [];
    return rules.filter((r) => {
      if (showUserRules && !showAutoApprove) {
        if (r.ruleType === "AUTO_APPROVE") return false;
      }
      if (showAutoApprove && !showUserRules) {
        if (r.ruleType !== "AUTO_APPROVE") return false;
      }
      if (!showUserRules && !showAutoApprove) return false;

      if (typeFilter !== "all" && r.ruleType !== typeFilter) return false;
      if (statusFilter === "enabled" && !r.isActive) return false;
      if (statusFilter === "disabled" && r.isActive) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !(r.description || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rules, showUserRules, showAutoApprove, typeFilter, statusFilter, searchQuery]);

  const handleEdit = (rule: ApprovalRule) => {
    setEditingRule(rule);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    if (!open) {
      setFormOpen(false);
      setEditingRule(null);
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.name || user?.email || userId;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 space-y-4 flex-1 overflow-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/ap-invoices">
              <Button variant="ghost" size="sm" data-testid="button-back-invoices">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Approval Rules</h1>
          </div>
          <Button onClick={handleCreate} data-testid="button-create-rule">
            Create approval rule
          </Button>
        </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">User based approval rules:</span>
            <Switch
              checked={showUserRules}
              onCheckedChange={setShowUserRules}
              data-testid="switch-user-rules"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Auto-approve rules:</span>
            <Switch
              checked={showAutoApprove}
              onCheckedChange={setShowAutoApprove}
              data-testid="switch-auto-approve"
            />
          </div>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for rules..."
            className="pl-9"
            data-testid="input-search-rules"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <div className="grid grid-cols-[1fr_150px_2fr_1fr_120px_50px] gap-4 px-4 py-3 border-b bg-muted/30 items-center">
          <span className="text-xs font-medium text-muted-foreground uppercase">Name</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">Type</span>
            <Select value={typeFilter} onValueChange={setTypeFilter} data-testid="select-type-filter">
              <SelectTrigger className="h-6 w-auto border-0 bg-transparent p-0 text-xs gap-1" data-testid="trigger-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="USER_CATCH_ALL">User (Catch All)</SelectItem>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="AUTO_APPROVE">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase">Conditions</span>
          <span className="text-xs font-medium text-muted-foreground uppercase">Approvers</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">Status</span>
            <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
              <SelectTrigger className="h-6 w-auto border-0 bg-transparent p-0 text-xs gap-1" data-testid="trigger-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-8 text-center" data-testid="empty-rules">
            <p className="text-sm text-muted-foreground">No approval rules found.</p>
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="grid grid-cols-[1fr_150px_2fr_1fr_120px_50px] gap-4 px-4 py-4 border-b last:border-b-0 items-start"
              data-testid={`row-rule-${rule.id}`}
            >
              <div>
                <button
                  className="text-sm font-medium text-primary hover:underline text-left"
                  onClick={() => handleEdit(rule)}
                  data-testid={`link-rule-name-${rule.id}`}
                >
                  {rule.name}
                </button>
              </div>
              <div>{getTypeBadge(rule.ruleType)}</div>
              <div>
                <ConditionsDisplay
                  conditions={rule.conditions}
                  companies={companies}
                  jobs={jobs}
                  suppliers={suppliers}
                />
              </div>
              <div className="space-y-0.5">
                {rule.approverUserIds.map((uid, i) => (
                  <div key={uid} className="text-sm" data-testid={`text-approver-${rule.id}-${i}`}>
                    <span className="text-muted-foreground">{i + 1}.</span>{" "}
                    {getUserName(uid)}
                  </div>
                ))}
                {rule.approverUserIds.length === 0 && (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
              <div>
                <Badge
                  variant={rule.isActive ? "default" : "secondary"}
                  className={rule.isActive ? "bg-green-600 text-white no-default-hover-elevate no-default-active-elevate" : ""}
                  data-testid={`badge-status-${rule.id}`}
                >
                  {rule.isActive ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid={`button-actions-${rule.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(rule)} data-testid={`menu-edit-${rule.id}`}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteConfirmId(rule.id)}
                      className="text-destructive"
                      data-testid={`menu-delete-${rule.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>

        {formOpen && (
          <RuleFormDialog
            open={formOpen}
            onOpenChange={handleFormClose}
            rule={editingRule}
          />
        )}

        <Dialog open={deleteConfirmId !== null} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
          <DialogContent data-testid="dialog-delete-rule-confirm">
            <DialogHeader>
              <DialogTitle>Delete Approval Rule</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this approval rule? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
