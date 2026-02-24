import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield,
  Users,
  Eye,
  EyeOff,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Settings2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { User, UserPermission, PermissionLevel, PermissionType } from "@shared/schema";
import { FUNCTION_KEYS } from "@shared/schema";
import { ADMIN_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

interface UserWithPermissions {
  user: User;
  permissions: UserPermission[];
}

const FUNCTION_LABELS: Record<string, string> = {
  tasks: "Tasks",
  chat: "Chat",
  jobs: "Jobs",
  panel_register: "Panel Register",
  document_register: "Document Register",
  photo_gallery: "Photo Gallery",
  checklists: "Checklists",
  work_orders: "Work Orders",
  weekly_job_logs: "Weekly Job Logs",
  mail_register: "Mail Register",
  broadcast: "Broadcast",
  help_center: "Help Center",
  knowledge_base: "Knowledge Base",
  production_slots: "Production Slots",
  production_schedule: "Production Schedule",
  production_report: "Production Booking",
  drafting_program: "Drafting Program",
  daily_reports: "Drafting Register",
  drafting_emails: "Drafting Emails",
  reo_scheduling: "Reo Scheduling",
  pm_call_logs: "PM Call Logs",
  logistics: "Logistics",
  sales_pipeline: "Sales Pipeline",
  contract_hub: "Contract Hub",
  progress_claims: "Progress Claims",
  purchase_orders: "Purchase Orders",
  capex_requests: "CAPEX Requests",
  hire_bookings: "Hire Bookings",
  tenders: "Tenders",
  scopes: "Scope of Works",
  weekly_wages: "Weekly Wages",
  admin_assets: "Asset Register",
  ap_invoices: "AP Invoices",
  myob_integration: "MYOB Integration",
  kpi_dashboard: "KPI Dashboard",
  manager_review: "Manager Review",
  checklist_reports: "Checklist Reports",
  reports: "Reports & Downloads",
  job_activities: "Job Activities",
  tender_emails: "Tender Emails",
  email_processing: "Email Processing",
  budgets: "Budgets",
  admin_settings: "Settings",
  admin_companies: "Companies",
  admin_factories: "Factories",
  admin_panel_types: "Panel Types",
  admin_document_config: "Document Config",
  admin_checklist_templates: "Checklist Templates",
  admin_item_catalog: "Items & Categories",
  admin_devices: "Devices",
  admin_users: "Users",
  admin_user_permissions: "User Permissions",
  admin_job_types: "Job Types & Workflows",
  admin_jobs: "Jobs Management",
  admin_customers: "Customers",
  admin_suppliers: "Suppliers",
  admin_employees: "Employees",
  admin_zones: "Zones",
  admin_work_types: "Work Types",
  admin_trailer_types: "Trailer Types",
  admin_data_management: "Data Management",
  admin_cost_codes: "Cost Codes",
  admin_email_templates: "Email Templates",
  admin_external_api: "External API",
  mobile_qr_scanner: "QR Scanner (Mobile)",
  mobile_dashboard: "Dashboard (Mobile)",
  mobile_profile: "Profile (Mobile)",
};

interface PermissionSection {
  label: string;
  keys: string[];
}

const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    label: "Core Features",
    keys: ["tasks", "chat", "jobs", "panel_register", "document_register", "photo_gallery", "checklists", "work_orders", "weekly_job_logs", "mail_register", "broadcast", "help_center", "knowledge_base", "job_activities"],
  },
  {
    label: "Production & Scheduling",
    keys: ["production_slots", "production_schedule", "production_report", "drafting_program", "daily_reports", "drafting_emails", "reo_scheduling", "pm_call_logs", "logistics"],
  },
  {
    label: "Finance & Commercial",
    keys: ["sales_pipeline", "contract_hub", "progress_claims", "purchase_orders", "capex_requests", "hire_bookings", "tenders", "scopes", "budgets", "weekly_wages", "admin_assets", "ap_invoices", "myob_integration", "tender_emails", "email_processing"],
  },
  {
    label: "Analytics & Reporting",
    keys: ["kpi_dashboard", "manager_review", "checklist_reports", "reports"],
  },
  {
    label: "Administration",
    keys: ["admin_settings", "admin_companies", "admin_factories", "admin_panel_types", "admin_document_config", "admin_checklist_templates", "admin_item_catalog", "admin_devices", "admin_users", "admin_user_permissions", "admin_job_types", "admin_jobs", "admin_data_management", "admin_cost_codes", "admin_email_templates", "admin_external_api"],
  },
  {
    label: "Contacts",
    keys: ["admin_customers", "admin_suppliers", "admin_employees"],
  },
  {
    label: "Other",
    keys: ["admin_zones", "admin_work_types", "admin_trailer_types"],
  },
  {
    label: "Mobile-Only Features",
    keys: ["mobile_qr_scanner", "mobile_dashboard", "mobile_profile"],
  },
];

const PERMISSION_COLORS: Record<PermissionLevel, string> = {
  HIDDEN: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  VIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  VIEW_AND_UPDATE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  VIEW_OWN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  VIEW_AND_UPDATE_OWN: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

const PERMISSION_ICONS: Record<PermissionLevel, React.ReactNode> = {
  HIDDEN: <EyeOff className="h-3 w-3" />,
  VIEW: <Eye className="h-3 w-3" />,
  VIEW_AND_UPDATE: <Pencil className="h-3 w-3" />,
  VIEW_OWN: <Eye className="h-3 w-3" />,
  VIEW_AND_UPDATE_OWN: <Pencil className="h-3 w-3" />,
};

const SUPPORTS_OWN_LEVELS = ["purchase_orders", "tasks", "weekly_job_logs", "pm_call_logs"];

const ALL_PERMISSION_LEVELS: PermissionLevel[] = ["HIDDEN", "VIEW_OWN", "VIEW", "VIEW_AND_UPDATE_OWN", "VIEW_AND_UPDATE"];

function buildDefaultPermissions(): Record<string, PermissionLevel> {
  const perms: Record<string, PermissionLevel> = {};
  for (const key of FUNCTION_KEYS) {
    perms[key] = "VIEW_AND_UPDATE";
  }
  return perms;
}

function PermissionTypeEditor({
  open,
  onOpenChange,
  editingType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingType: PermissionType | null;
}) {
  const { toast } = useToast();
  const isEditing = !!editingType;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>(buildDefaultPermissions());
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingType) {
        setName(editingType.name);
        setDescription(editingType.description || "");
        setPermissions(editingType.permissions as Record<string, PermissionLevel>);
        setIsDefault(editingType.isDefault);
      } else {
        setName("");
        setDescription("");
        setPermissions(buildDefaultPermissions());
        setIsDefault(false);
      }
    }
  }, [open, editingType]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; permissions: Record<string, PermissionLevel>; isDefault: boolean }) => {
      return apiRequest("POST", ADMIN_ROUTES.PERMISSION_TYPES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PERMISSION_TYPES] });
      toast({ title: "Permission type created", description: "The permission type has been created successfully." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create permission type", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; permissions: Record<string, PermissionLevel>; isDefault: boolean }) => {
      return apiRequest("PATCH", ADMIN_ROUTES.PERMISSION_TYPE_BY_ID(editingType!.id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PERMISSION_TYPES] });
      toast({ title: "Permission type updated", description: "The permission type has been updated successfully." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update permission type", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Validation error", description: "Name is required", variant: "destructive" });
      return;
    }
    const data = { name: name.trim(), description: description.trim(), permissions, isDefault };
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const setPermission = (key: string, level: PermissionLevel) => {
    setPermissions(prev => ({ ...prev, [key]: level }));
  };

  const setSectionAll = (sectionKeys: string[], level: PermissionLevel) => {
    setPermissions(prev => {
      const next = { ...prev };
      for (const key of sectionKeys) {
        next[key] = level;
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-permission-type-dialog-title">
            {isEditing ? "Edit Permission Type" : "Create Permission Type"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the permission type name, description, and access levels."
              : "Define a reusable set of permissions that can be applied to users."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pt-name">Name</Label>
              <Input
                id="pt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Project Manager"
                data-testid="input-permission-type-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-description">Description</Label>
              <Input
                id="pt-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                data-testid="input-permission-type-description"
              />
            </div>
          </div>

          <div className="space-y-4">
            {PERMISSION_SECTIONS.map(section => (
              <div key={section.label}>
                <div className="flex items-center gap-2 py-2 mb-1 flex-wrap">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section.label}</h4>
                  <div className="flex-1 h-px bg-border" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Set All:</span>
                    <Select
                      onValueChange={(value) => setSectionAll(section.keys, value as PermissionLevel)}
                      data-testid={`select-set-all-${section.label.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <SelectTrigger className="w-48" data-testid={`select-trigger-set-all-${section.label.replace(/\s+/g, '-').toLowerCase()}`}>
                        <SelectValue placeholder="Set all..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIDDEN">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4 text-red-500" />
                            Hidden
                          </div>
                        </SelectItem>
                        <SelectItem value="VIEW_OWN">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-500" />
                            View Own Only
                          </div>
                        </SelectItem>
                        <SelectItem value="VIEW">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-yellow-500" />
                            View All
                          </div>
                        </SelectItem>
                        <SelectItem value="VIEW_AND_UPDATE_OWN">
                          <div className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-cyan-500" />
                            View & Edit Own
                          </div>
                        </SelectItem>
                        <SelectItem value="VIEW_AND_UPDATE">
                          <div className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-green-500" />
                            View & Edit All
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">Feature</TableHead>
                      <TableHead>Access Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.keys.map(functionKey => (
                      <TableRow key={functionKey}>
                        <TableCell className="font-medium">{FUNCTION_LABELS[functionKey] || functionKey}</TableCell>
                        <TableCell>
                          <Select
                            value={permissions[functionKey] || "VIEW_AND_UPDATE"}
                            onValueChange={(value) => setPermission(functionKey, value as PermissionLevel)}
                          >
                            <SelectTrigger className="w-48" data-testid={`select-pt-permission-${functionKey}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HIDDEN">
                                <div className="flex items-center gap-2">
                                  <EyeOff className="h-4 w-4 text-red-500" />
                                  Hidden
                                </div>
                              </SelectItem>
                              {SUPPORTS_OWN_LEVELS.includes(functionKey) && (
                                <SelectItem value="VIEW_OWN">
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-blue-500" />
                                    View Own Only
                                  </div>
                                </SelectItem>
                              )}
                              <SelectItem value="VIEW">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4 text-yellow-500" />
                                  View All
                                </div>
                              </SelectItem>
                              {SUPPORTS_OWN_LEVELS.includes(functionKey) && (
                                <SelectItem value="VIEW_AND_UPDATE_OWN">
                                  <div className="flex items-center gap-2">
                                    <Pencil className="h-4 w-4 text-cyan-500" />
                                    View & Edit Own Only
                                  </div>
                                </SelectItem>
                              )}
                              <SelectItem value="VIEW_AND_UPDATE">
                                <div className="flex items-center gap-2">
                                  <Pencil className="h-4 w-4 text-green-500" />
                                  View & Edit All
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} data-testid="button-cancel-permission-type">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-permission-type">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyPermissionTypeDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}) {
  const { toast } = useToast();
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: permissionTypes } = useQuery<PermissionType[]>({
    queryKey: [ADMIN_ROUTES.PERMISSION_TYPES],
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", ADMIN_ROUTES.USER_PERMISSION_APPLY_TYPE(userId), { permissionTypeId: selectedTypeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permission type applied", description: `Permissions have been updated for ${userName}.` });
      setSelectedTypeId("");
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply permission type", variant: "destructive" });
    },
  });

  const selectedType = permissionTypes?.find(t => t.id === selectedTypeId);

  const handleApplyClick = () => {
    if (!selectedTypeId) {
      toast({ title: "Select a type", description: "Please select a permission type to apply.", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmApply = () => {
    setConfirmOpen(false);
    applyMutation.mutate();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-apply-type-dialog-title">Apply Permission Type</DialogTitle>
            <DialogDescription>
              Select a permission type to apply to <strong>{userName}</strong>. This will overwrite all existing permissions for this user.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Permission Type</Label>
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger data-testid="select-apply-permission-type">
                  <SelectValue placeholder="Select a permission type..." />
                </SelectTrigger>
                <SelectContent>
                  {permissionTypes?.map(pt => (
                    <SelectItem key={pt.id} value={pt.id} data-testid={`select-item-type-${pt.id}`}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedType && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium">{selectedType.name}</p>
                {selectedType.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedType.description}</p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(() => {
                    const perms = selectedType.permissions as Record<string, PermissionLevel>;
                    const counts: Record<string, number> = {};
                    for (const level of Object.values(perms)) {
                      counts[level] = (counts[level] || 0) + 1;
                    }
                    return Object.entries(counts).map(([level, count]) => (
                      <Badge key={level} className={PERMISSION_COLORS[level as PermissionLevel]} variant="secondary">
                        {PERMISSION_ICONS[level as PermissionLevel]} {count} {level.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applyMutation.isPending} data-testid="button-cancel-apply-type">
              Cancel
            </Button>
            <Button onClick={handleApplyClick} disabled={applyMutation.isPending || !selectedTypeId} data-testid="button-apply-permission-type">
              {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Apply Permission Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to apply "{selectedType?.name}" to {userName}? This will overwrite all existing permissions for this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm-apply">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApply} data-testid="button-confirm-apply-type">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PermissionTypesTab() {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingType, setEditingType] = useState<PermissionType | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: permissionTypes, isLoading } = useQuery<PermissionType[]>({
    queryKey: [ADMIN_ROUTES.PERMISSION_TYPES],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ADMIN_ROUTES.PERMISSION_TYPE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PERMISSION_TYPES] });
      toast({ title: "Permission type deleted", description: "The permission type has been deleted." });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete permission type", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    setEditingType(null);
    setEditorOpen(true);
  };

  const handleEdit = (pt: PermissionType) => {
    setEditingType(pt);
    setEditorOpen(true);
  };

  const handleEditorClose = (open: boolean) => {
    if (!open) {
      setEditingType(null);
    }
    setEditorOpen(open);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-muted-foreground">
          Create reusable permission templates that can be quickly applied to users.
        </p>
        <Button onClick={handleCreate} data-testid="button-create-permission-type">
          <Plus className="h-4 w-4 mr-2" />
          Create Permission Type
        </Button>
      </div>

      {permissionTypes && permissionTypes.length > 0 ? (
        <div className="grid gap-4">
          {permissionTypes.map(pt => {
            const perms = pt.permissions as Record<string, PermissionLevel>;
            const counts: Record<string, number> = {};
            for (const level of Object.values(perms)) {
              counts[level] = (counts[level] || 0) + 1;
            }

            return (
              <Card key={pt.id} data-testid={`card-permission-type-${pt.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Settings2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-permission-type-name-${pt.id}`}>{pt.name}</CardTitle>
                        {pt.description && (
                          <CardDescription data-testid={`text-permission-type-desc-${pt.id}`}>{pt.description}</CardDescription>
                        )}
                      </div>
                      {pt.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(pt)} data-testid={`button-edit-permission-type-${pt.id}`}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(pt.id)} data-testid={`button-delete-permission-type-${pt.id}`}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(counts).map(([level, count]) => (
                      <Badge key={level} className={PERMISSION_COLORS[level as PermissionLevel]} variant="secondary">
                        {PERMISSION_ICONS[level as PermissionLevel]} {count} {level.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No permission types defined</p>
            <p className="text-muted-foreground mb-4">Create permission types to quickly apply standardized access levels to users.</p>
            <Button onClick={handleCreate} data-testid="button-create-permission-type-empty">
              <Plus className="h-4 w-4 mr-2" />
              Create First Permission Type
            </Button>
          </CardContent>
        </Card>
      )}

      <PermissionTypeEditor
        key={editingType?.id || "new"}
        open={editorOpen}
        onOpenChange={handleEditorClose}
        editingType={editingType}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permission Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this permission type? This action cannot be undone. Existing user permissions will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-type">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              data-testid="button-confirm-delete-type"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function UserPermissionsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [applyTypeUserId, setApplyTypeUserId] = useState<string | null>(null);
  const [applyTypeUserName, setApplyTypeUserName] = useState<string>("");

  const { data: usersWithPermissions, isLoading, refetch } = useQuery<UserWithPermissions[]>({
    queryKey: [ADMIN_ROUTES.USER_PERMISSIONS],
  });

  const initializeMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", ADMIN_ROUTES.USER_PERMISSION_INITIALIZE(userId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permissions initialized", description: "All function permissions have been set up for this user." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to initialize permissions", variant: "destructive" });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ userId, functionKey, permissionLevel }: { userId: string; functionKey: string; permissionLevel: PermissionLevel }) => {
      return apiRequest("PUT", ADMIN_ROUTES.USER_PERMISSION_UPDATE(userId, functionKey), { permissionLevel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permission updated", description: "User permission has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update permission", variant: "destructive" });
    },
  });

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const getPermissionForFunction = (permissions: UserPermission[], functionKey: string): PermissionLevel => {
    const perm = permissions.find(p => p.functionKey === functionKey);
    return (perm?.permissionLevel as PermissionLevel) || "VIEW_AND_UPDATE";
  };

  const countPermissions = (permissions: UserPermission[]) => {
    const counts = { HIDDEN: 0, VIEW: 0, VIEW_AND_UPDATE: 0, VIEW_OWN: 0, VIEW_AND_UPDATE_OWN: 0, unset: 0 };
    const permMap = new Map(permissions.map(p => [p.functionKey, p.permissionLevel]));
    
    for (const key of FUNCTION_KEYS) {
      const level = permMap.get(key);
      if (!level) {
        counts.unset++;
      } else if (level in counts) {
        counts[level as keyof typeof counts]++;
      }
    }
    return counts;
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="User Permissions" aria-busy="true">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="User Permissions">
      {!embedded && (
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">User Permissions</h1>
                <PageHelpButton pageHelpKey="page.admin.user-permissions" />
              </div>
              <p className="text-muted-foreground">Control access to functions for each user</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-permissions">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}
      {embedded && (
        <div className="flex items-center justify-end">
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-permissions">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Permission Levels</CardTitle>
          <CardDescription>Understanding what each level means</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                <EyeOff className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">Hidden</p>
                <p className="text-sm text-red-600 dark:text-red-400">Not visible to user</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-blue-700 dark:text-blue-300">View Own</p>
                <p className="text-sm text-blue-600 dark:text-blue-400">See only own records</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
              <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                <Eye className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="font-semibold text-yellow-700 dark:text-yellow-300">View All</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">See all records</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800">
              <div className="p-2 rounded-full bg-cyan-100 dark:bg-cyan-900">
                <Pencil className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="font-semibold text-cyan-700 dark:text-cyan-300">Edit Own</p>
                <p className="text-sm text-cyan-600 dark:text-cyan-400">View & edit own records</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <Pencil className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-green-700 dark:text-green-300">Edit All</p>
                <p className="text-sm text-green-600 dark:text-green-400">Full access to all records</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="users" data-testid="tabs-permissions">
        <TabsList data-testid="tabs-list-permissions">
          <TabsTrigger value="users" data-testid="tab-trigger-users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="permission-types" data-testid="tab-trigger-permission-types">
            <Settings2 className="h-4 w-4 mr-2" />
            Permission Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="space-y-4">
            {usersWithPermissions?.map(({ user, permissions }) => {
              const isExpanded = expandedUsers.has(user.id);
              const counts = countPermissions(permissions);
              const hasUnsetPermissions = counts.unset > 0;

              return (
                <Collapsible key={user.id} open={isExpanded} onOpenChange={() => toggleUser(user.id)}>
                  <Card className="overflow-visible" data-testid={`card-user-${user.id}`}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="p-2 rounded-full bg-primary/10">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{user.name || user.email}</CardTitle>
                              <CardDescription>{user.email}</CardDescription>
                            </div>
                            <Badge variant="outline" className="ml-2">{user.role}</Badge>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex gap-2 flex-wrap">
                              {counts.HIDDEN > 0 && (
                                <Badge className={PERMISSION_COLORS.HIDDEN}>
                                  {PERMISSION_ICONS.HIDDEN} {counts.HIDDEN} Hidden
                                </Badge>
                              )}
                              {counts.VIEW_OWN > 0 && (
                                <Badge className={PERMISSION_COLORS.VIEW_OWN}>
                                  {PERMISSION_ICONS.VIEW_OWN} {counts.VIEW_OWN} Own
                                </Badge>
                              )}
                              {counts.VIEW > 0 && (
                                <Badge className={PERMISSION_COLORS.VIEW}>
                                  {PERMISSION_ICONS.VIEW} {counts.VIEW} View
                                </Badge>
                              )}
                              {counts.VIEW_AND_UPDATE_OWN > 0 && (
                                <Badge className={PERMISSION_COLORS.VIEW_AND_UPDATE_OWN}>
                                  {PERMISSION_ICONS.VIEW_AND_UPDATE_OWN} {counts.VIEW_AND_UPDATE_OWN} Edit Own
                                </Badge>
                              )}
                              {counts.VIEW_AND_UPDATE > 0 && (
                                <Badge className={PERMISSION_COLORS.VIEW_AND_UPDATE}>
                                  {PERMISSION_ICONS.VIEW_AND_UPDATE} {counts.VIEW_AND_UPDATE} Full
                                </Badge>
                              )}
                              {hasUnsetPermissions && (
                                <Badge variant="secondary">{counts.unset} Not Set</Badge>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          {hasUnsetPermissions && (
                            <Button
                              onClick={(e) => { e.stopPropagation(); initializeMutation.mutate(user.id); }}
                              disabled={initializeMutation.isPending}
                              data-testid={`button-initialize-${user.id}`}
                            >
                              {initializeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                              Initialize All
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setApplyTypeUserId(user.id);
                              setApplyTypeUserName(user.name || user.email);
                            }}
                            data-testid={`button-apply-type-${user.id}`}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Apply Permission Type
                          </Button>
                        </div>
                        {hasUnsetPermissions && (
                          <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            <p className="font-medium text-amber-800 dark:text-amber-200">Some permissions are not set</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300">Initialize to set all functions to "View & Update" by default, or apply a permission type.</p>
                          </div>
                        )}
                        <div className="space-y-4">
                          {PERMISSION_SECTIONS.map(section => (
                            <div key={section.label}>
                              <div className="flex items-center gap-2 py-2 mb-1">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section.label}</h4>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-1/2">Feature</TableHead>
                                    <TableHead>Access Level</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {section.keys.map(functionKey => {
                                    const currentLevel = getPermissionForFunction(permissions, functionKey);
                                    return (
                                      <TableRow key={functionKey} data-testid={`row-permission-${user.id}-${functionKey}`}>
                                        <TableCell className="font-medium">{FUNCTION_LABELS[functionKey] || functionKey}</TableCell>
                                        <TableCell>
                                          <Select
                                            value={currentLevel}
                                            onValueChange={(value) => {
                                              updatePermissionMutation.mutate({
                                                userId: user.id,
                                                functionKey,
                                                permissionLevel: value as PermissionLevel,
                                              });
                                            }}
                                            disabled={updatePermissionMutation.isPending}
                                          >
                                            <SelectTrigger className="w-48" data-testid={`select-permission-${user.id}-${functionKey}`}>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="HIDDEN">
                                                <div className="flex items-center gap-2">
                                                  <EyeOff className="h-4 w-4 text-red-500" />
                                                  Hidden
                                                </div>
                                              </SelectItem>
                                              {SUPPORTS_OWN_LEVELS.includes(functionKey) && (
                                                <SelectItem value="VIEW_OWN">
                                                  <div className="flex items-center gap-2">
                                                    <Eye className="h-4 w-4 text-blue-500" />
                                                    View Own Only
                                                  </div>
                                                </SelectItem>
                                              )}
                                              <SelectItem value="VIEW">
                                                <div className="flex items-center gap-2">
                                                  <Eye className="h-4 w-4 text-yellow-500" />
                                                  View All
                                                </div>
                                              </SelectItem>
                                              {SUPPORTS_OWN_LEVELS.includes(functionKey) && (
                                                <SelectItem value="VIEW_AND_UPDATE_OWN">
                                                  <div className="flex items-center gap-2">
                                                    <Pencil className="h-4 w-4 text-cyan-500" />
                                                    View & Edit Own Only
                                                  </div>
                                                </SelectItem>
                                              )}
                                              <SelectItem value="VIEW_AND_UPDATE">
                                                <div className="flex items-center gap-2">
                                                  <Pencil className="h-4 w-4 text-green-500" />
                                                  View & Edit All
                                                </div>
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>

          {(!usersWithPermissions || usersWithPermissions.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No users found</p>
                <p className="text-muted-foreground">Add users in the Users section to manage their permissions</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="permission-types">
          <PermissionTypesTab />
        </TabsContent>
      </Tabs>

      {applyTypeUserId && (
        <ApplyPermissionTypeDialog
          open={!!applyTypeUserId}
          onOpenChange={(open) => { if (!open) { setApplyTypeUserId(null); setApplyTypeUserName(""); } }}
          userId={applyTypeUserId}
          userName={applyTypeUserName}
        />
      )}
    </div>
  );
}
