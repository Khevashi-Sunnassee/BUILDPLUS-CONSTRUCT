import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft, Edit2, User, Shield, KeyRound,
  EyeOff, Eye, Pencil, Minus, Loader2, Save,
  Briefcase, Factory, Truck, DollarSign, BarChart3, Settings,
  Smartphone, Users as UsersIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User as UserType, PermissionType } from "@shared/schema";
import { FUNCTION_KEYS } from "@shared/schema";
import type { PermissionLevel } from "@shared/schema";
import { ADMIN_ROUTES } from "@shared/api-routes";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

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
  icon: typeof Briefcase;
  keys: string[];
}

const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    label: "Core Features",
    icon: Briefcase,
    keys: [
      "tasks", "chat", "jobs", "panel_register", "document_register",
      "photo_gallery", "checklists", "work_orders", "weekly_job_logs",
      "mail_register", "broadcast", "help_center", "knowledge_base",
      "job_activities",
    ],
  },
  {
    label: "Production & Planning",
    icon: Factory,
    keys: [
      "production_slots", "production_schedule", "production_report",
      "drafting_program", "daily_reports", "drafting_emails",
      "reo_scheduling", "pm_call_logs",
    ],
  },
  {
    label: "Logistics & Delivery",
    icon: Truck,
    keys: ["logistics"],
  },
  {
    label: "Finance & Commercial",
    icon: DollarSign,
    keys: [
      "sales_pipeline", "contract_hub", "progress_claims",
      "purchase_orders", "capex_requests", "hire_bookings",
      "tenders", "scopes", "budgets", "weekly_wages",
      "admin_assets", "ap_invoices", "myob_integration",
      "tender_emails", "email_processing",
    ],
  },
  {
    label: "Analytics & Reporting",
    icon: BarChart3,
    keys: [
      "kpi_dashboard", "manager_review", "checklist_reports", "reports",
    ],
  },
  {
    label: "Administration",
    icon: Settings,
    keys: [
      "admin_settings", "admin_companies", "admin_factories",
      "admin_panel_types", "admin_document_config", "admin_checklist_templates",
      "admin_item_catalog", "admin_devices", "admin_users", "admin_user_permissions",
      "admin_job_types", "admin_jobs", "admin_customers", "admin_suppliers",
      "admin_employees", "admin_zones", "admin_work_types", "admin_trailer_types",
      "admin_data_management", "admin_cost_codes", "admin_email_templates",
      "admin_external_api",
    ],
  },
  {
    label: "Mobile-Only Features",
    icon: Smartphone,
    keys: ["mobile_qr_scanner", "mobile_dashboard", "mobile_profile"],
  },
];

const SUPPORTS_OWN = ["purchase_orders", "tasks", "weekly_job_logs", "pm_call_logs"];

function getPermissionBadge(level: string | null) {
  if (!level) {
    return <Badge variant="secondary" className="gap-1 opacity-50"><Minus className="h-3 w-3" />Not Set</Badge>;
  }
  switch (level) {
    case "HIDDEN":
      return <Badge variant="secondary" className="gap-1"><EyeOff className="h-3 w-3" />Hidden</Badge>;
    case "VIEW":
      return <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-500"><Eye className="h-3 w-3" />View</Badge>;
    case "VIEW_AND_UPDATE":
      return <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/30"><Pencil className="h-3 w-3" />View & Edit</Badge>;
    case "VIEW_OWN":
      return <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-500"><Eye className="h-3 w-3" />View Own</Badge>;
    case "VIEW_AND_UPDATE_OWN":
      return <Badge className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/30"><Pencil className="h-3 w-3" />View & Edit Own</Badge>;
    default:
      return <Badge variant="secondary">{level}</Badge>;
  }
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

function getRoleBadge(role: string) {
  switch (role) {
    case "ADMIN":
      return <Badge variant="destructive">Admin</Badge>;
    case "MANAGER":
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Manager</Badge>;
    default:
      return <Badge variant="outline">User</Badge>;
  }
}

interface UserPermission {
  id: string;
  userId: string;
  functionKey: string;
  permissionLevel: string;
}

export default function UserDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/users/:id");
  const id = params?.id || "";
  const { toast } = useToast();
  const [applyTypeOpen, setApplyTypeOpen] = useState(false);

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: [ADMIN_ROUTES.USER_BY_ID(id)],
    enabled: !!id,
  });

  const { data: permissions = [], isLoading: permLoading } = useQuery<UserPermission[]>({
    queryKey: [`/api/admin/user-permissions/${id}`],
    enabled: !!id,
  });

  const initializeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", ADMIN_ROUTES.USER_PERMISSION_INITIALIZE(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user-permissions/${id}`] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permissions initialized", description: "All permissions have been set to default values." });
    },
    onError: () => {
      toast({ title: "Failed to initialize permissions", variant: "destructive" });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ functionKey, permissionLevel }: { functionKey: string; permissionLevel: PermissionLevel }) => {
      return apiRequest("PUT", ADMIN_ROUTES.USER_PERMISSION_UPDATE(id, functionKey), { permissionLevel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user-permissions/${id}`] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permission updated" });
    },
    onError: () => {
      toast({ title: "Failed to update permission", variant: "destructive" });
    },
  });

  const permMap = useMemo(() => new Map(permissions.map(p => [p.functionKey, p.permissionLevel])), [permissions]);

  const getPermLevel = (functionKey: string): PermissionLevel | null => {
    return (permMap.get(functionKey) as PermissionLevel) || null;
  };

  const hasUnset = useMemo(() => {
    return FUNCTION_KEYS.some(k => !permMap.has(k));
  }, [permMap]);

  const permissionStats = {
    total: FUNCTION_KEYS.length,
    configured: permissions.length,
    fullAccess: permissions.filter(p => p.permissionLevel === "VIEW_AND_UPDATE").length,
    viewOnly: permissions.filter(p => p.permissionLevel === "VIEW" || p.permissionLevel === "VIEW_OWN").length,
    hidden: permissions.filter(p => p.permissionLevel === "HIDDEN").length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="User Detail" data-testid="user-detail-loading">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6" role="main" aria-label="User Detail" data-testid="user-detail-not-found">
        <Button variant="ghost" onClick={() => setLocation("/admin/users")} data-testid="button-back-users">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            User not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="User Detail" data-testid="user-detail-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/users")} data-testid="button-back-users">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-user-detail-name">
              {user.name || "Unnamed User"}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={user.isActive ? "default" : "secondary"} data-testid="badge-user-status">
                {user.isActive ? "Active" : "Disabled"}
              </Badge>
              <span data-testid="badge-user-role">{getRoleBadge(user.role)}</span>
            </div>
          </div>
        </div>
        <Button onClick={() => setLocation("/admin/users")} data-testid="button-edit-user">
          <Edit2 className="h-4 w-4 mr-2" />
          Edit User
        </Button>
      </div>

      <Tabs defaultValue="overview" data-testid="tabs-user-detail">
        <TabsList data-testid="tabs-list-user-detail">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <User className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="permissions" data-testid="tab-permissions">
            <KeyRound className="h-4 w-4 mr-2" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-account-information">
              <CardHeader>
                <CardTitle className="text-lg">Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Name" value={user.name} />
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Phone" value={user.phone} />
                <InfoRow label="Address" value={(user as any).address} />
                <InfoRow label="Position" value={(user as any).position} />
              </CardContent>
            </Card>

            <Card data-testid="card-role-access">
              <CardHeader>
                <CardTitle className="text-lg">Role & Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span data-testid="text-user-role">{getRoleBadge(user.role)}</span>
                </div>
                <InfoRow label="User Type" value={user.userType || "-"} />
                <InfoRow label="Department" value={user.departmentId || "-"} />
              </CardContent>
            </Card>

            <Card data-testid="card-account-status">
              <CardHeader>
                <CardTitle className="text-lg">Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={user.isActive ? "default" : "secondary"} data-testid="text-user-active-status">
                    {user.isActive ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <InfoRow
                  label="Created"
                  value={user.createdAt ? format(new Date(user.createdAt), "dd/MM/yyyy") : "-"}
                />
              </CardContent>
            </Card>

            <Card data-testid="card-work-configuration">
              <CardHeader>
                <CardTitle className="text-lg">Work Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="PO Approver" value={user.poApprover ? "Yes" : "No"} />
                <InfoRow
                  label="PO Approval Limit"
                  value={user.poApprovalLimit ? `$${Number(user.poApprovalLimit).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                />
                <InfoRow label="Default Factory" value={user.defaultFactoryId || "-"} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          {permLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-[200px]" />
              <Skeleton className="h-[200px]" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                {hasUnset && (
                  <Button
                    size="sm"
                    onClick={() => initializeMutation.mutate()}
                    disabled={initializeMutation.isPending}
                    data-testid="button-initialize-permissions"
                  >
                    {initializeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Initialize All
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setApplyTypeOpen(true)}
                  data-testid="button-apply-type"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Apply Permission Type
                </Button>
              </div>

              {hasUnset && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Some permissions are not set</p>
                  <p className="text-amber-700 dark:text-amber-300">Click "Initialize All" to set defaults, or apply a permission type.</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card data-testid="stat-total-permissions">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-2xl font-bold">{permissionStats.configured}/{permissionStats.total}</div>
                    <div className="text-xs text-muted-foreground">Configured</div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-full-access">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-2xl font-bold text-green-500">{permissionStats.fullAccess}</div>
                    <div className="text-xs text-muted-foreground">Full Access</div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-view-only">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-2xl font-bold text-blue-500">{permissionStats.viewOnly}</div>
                    <div className="text-xs text-muted-foreground">View Only</div>
                  </CardContent>
                </Card>
                <Card data-testid="stat-hidden">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-2xl font-bold text-muted-foreground">{permissionStats.hidden}</div>
                    <div className="text-xs text-muted-foreground">Hidden</div>
                  </CardContent>
                </Card>
              </div>

              {PERMISSION_SECTIONS.map((section) => {
                const SectionIcon = section.icon;
                return (
                  <Card key={section.label} data-testid={`card-perm-section-${section.label.toLowerCase().replace(/\s+/g, "-")}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <SectionIcon className="h-5 w-5 text-primary" />
                        {section.label}
                        <Badge variant="outline" className="ml-auto text-xs">{section.keys.length}</Badge>
                        <Select
                          onValueChange={(value) => {
                            for (const key of section.keys) {
                              updatePermissionMutation.mutate({ functionKey: key, permissionLevel: value as PermissionLevel });
                            }
                          }}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs" data-testid={`select-set-all-${section.label.replace(/\s+/g, '-').toLowerCase()}`}>
                            <SelectValue placeholder="Set all..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HIDDEN">
                              <div className="flex items-center gap-2">
                                <EyeOff className="h-3 w-3 text-red-500" />
                                Hidden
                              </div>
                            </SelectItem>
                            <SelectItem value="VIEW">
                              <div className="flex items-center gap-2">
                                <Eye className="h-3 w-3 text-yellow-500" />
                                View All
                              </div>
                            </SelectItem>
                            <SelectItem value="VIEW_AND_UPDATE">
                              <div className="flex items-center gap-2">
                                <Pencil className="h-3 w-3 text-green-500" />
                                View & Edit All
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Function</TableHead>
                              <TableHead>Platform</TableHead>
                              <TableHead className="text-right">Access Level</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {section.keys.map((key) => {
                              const level = getPermLevel(key);
                              const isMobile = key.startsWith("mobile_");
                              const isAdmin = key.startsWith("admin_");
                              return (
                                <TableRow key={key} data-testid={`row-perm-${key}`}>
                                  <TableCell className="font-medium">{FUNCTION_LABELS[key] || key}</TableCell>
                                  <TableCell>
                                    {isMobile ? (
                                      <Badge variant="outline" className="text-xs gap-1"><Smartphone className="h-3 w-3" />Mobile</Badge>
                                    ) : isAdmin ? (
                                      <Badge variant="outline" className="text-xs gap-1"><Settings className="h-3 w-3" />Admin</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs gap-1"><UsersIcon className="h-3 w-3" />Web + Mobile</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Select
                                      value={level || ""}
                                      onValueChange={(value) => {
                                        updatePermissionMutation.mutate({ functionKey: key, permissionLevel: value as PermissionLevel });
                                      }}
                                      disabled={updatePermissionMutation.isPending}
                                    >
                                      <SelectTrigger className="w-48 ml-auto" data-testid={`select-perm-${key}`}>
                                        <SelectValue placeholder="Not set">
                                          {level ? getPermissionBadge(level) : <span className="text-muted-foreground">Not set</span>}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="HIDDEN">
                                          <div className="flex items-center gap-2">
                                            <EyeOff className="h-4 w-4 text-red-500" />
                                            Hidden
                                          </div>
                                        </SelectItem>
                                        {SUPPORTS_OWN.includes(key) && (
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
                                        {SUPPORTS_OWN.includes(key) && (
                                          <SelectItem value="VIEW_AND_UPDATE_OWN">
                                            <div className="flex items-center gap-2">
                                              <Pencil className="h-4 w-4 text-cyan-500" />
                                              View & Edit Own
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
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-authentication">
              <CardHeader>
                <CardTitle className="text-lg">Authentication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Email" value={user.email} />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Account Status</span>
                  <Badge variant={user.isActive ? "default" : "secondary"} data-testid="text-auth-status">
                    {user.isActive ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <InfoRow label="Last Login" value="-" />
              </CardContent>
            </Card>

            <Card data-testid="card-password">
              <CardHeader>
                <CardTitle className="text-lg">Password</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-password-info">
                  Password can be changed via the Edit User dialog on the Users list page.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {applyTypeOpen && (
        <ApplyPermissionTypeDialog
          open={applyTypeOpen}
          onOpenChange={setApplyTypeOpen}
          userId={id}
          userName={user.name || user.email}
        />
      )}
    </div>
  );
}

function ApplyPermissionTypeDialog({ open, onOpenChange, userId, userName }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}) {
  const { toast } = useToast();
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");

  const { data: permissionTypes } = useQuery<PermissionType[]>({
    queryKey: [ADMIN_ROUTES.PERMISSION_TYPES],
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", ADMIN_ROUTES.USER_PERMISSION_APPLY_TYPE(userId), { permissionTypeId: selectedTypeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/user-permissions/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.USER_PERMISSIONS] });
      toast({ title: "Permission type applied", description: `Permissions updated for ${userName}.` });
      setSelectedTypeId("");
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to apply permission type", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Permission Type</DialogTitle>
          <DialogDescription>
            Select a permission type to apply to <strong>{userName}</strong>. This will overwrite all existing permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
            <SelectTrigger data-testid="select-apply-perm-type">
              <SelectValue placeholder="Select a permission type..." />
            </SelectTrigger>
            <SelectContent>
              {permissionTypes?.map(pt => (
                <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applyMutation.isPending}>Cancel</Button>
          <Button
            onClick={() => {
              if (!selectedTypeId) {
                toast({ title: "Select a type first", variant: "destructive" });
                return;
              }
              applyMutation.mutate();
            }}
            disabled={applyMutation.isPending || !selectedTypeId}
            data-testid="button-confirm-apply-perm-type"
          >
            {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
