import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Edit2, User, Shield, KeyRound, CheckCircle2, EyeOff, Eye, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { User as UserType } from "@shared/schema";
import { ADMIN_ROUTES } from "@shared/api-routes";

const FUNCTION_LABELS: Record<string, string> = {
  tasks: "Tasks",
  chat: "Chat",
  jobs: "Jobs",
  panel_register: "Panel Register",
  document_register: "Document Register",
  photo_gallery: "Photo Gallery",
  checklists: "Checklists",
  weekly_job_logs: "Weekly Job Logs",
  broadcast: "Broadcast",
  production_slots: "Production Slots",
  production_report: "Production Schedule",
  drafting_program: "Drafting Program",
  daily_reports: "Drafting Register",
  reo_scheduling: "Reo Scheduling",
  pm_call_logs: "PM Call Logs",
  logistics: "Logistics",
  sales_pipeline: "Sales Pipeline",
  contract_hub: "Contract Hub",
  progress_claims: "Progress Claims",
  purchase_orders: "Purchase Orders",
  hire_bookings: "Hire Bookings",
  weekly_wages: "Weekly Wages",
  admin_assets: "Asset Register",
  kpi_dashboard: "KPI Dashboard",
  manager_review: "Manager Review",
  checklist_reports: "Checklist Reports",
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
  tenders: "Tenders",
  budgets: "Budgets",
  scopes: "Scopes",
};

function getPermissionBadge(level: string) {
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

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: [ADMIN_ROUTES.USER_BY_ID(id)],
    enabled: !!id,
  });

  const { data: permissions = [], isLoading: permLoading } = useQuery<UserPermission[]>({
    queryKey: [`/api/admin/user-permissions/${id}`],
    enabled: !!id,
  });

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

  const corePermissions = permissions.filter(p => !p.functionKey.startsWith("admin_"));
  const adminPermissions = permissions.filter(p => p.functionKey.startsWith("admin_"));

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
          ) : permissions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground" data-testid="text-no-permissions">
                <KeyRound className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No permissions configured for this user.</p>
                <p className="text-xs mt-1">Permissions can be initialized from the Users list page.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card data-testid="card-core-permissions">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Core Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Function</TableHead>
                          <TableHead className="text-right">Access Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {corePermissions.map((p) => (
                          <TableRow key={p.functionKey} data-testid={`row-perm-${p.functionKey}`}>
                            <TableCell className="font-medium">{FUNCTION_LABELS[p.functionKey] || p.functionKey}</TableCell>
                            <TableCell className="text-right">{getPermissionBadge(p.permissionLevel)}</TableCell>
                          </TableRow>
                        ))}
                        {corePermissions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No core permissions</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-admin-permissions">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-500" />
                    Admin Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Function</TableHead>
                          <TableHead className="text-right">Access Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminPermissions.map((p) => (
                          <TableRow key={p.functionKey} data-testid={`row-perm-${p.functionKey}`}>
                            <TableCell className="font-medium">{FUNCTION_LABELS[p.functionKey] || p.functionKey}</TableCell>
                            <TableCell className="text-right">{getPermissionBadge(p.permissionLevel)}</TableCell>
                          </TableRow>
                        ))}
                        {adminPermissions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No admin permissions</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
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
    </div>
  );
}
