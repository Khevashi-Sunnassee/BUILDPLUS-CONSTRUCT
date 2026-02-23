import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Edit2, User, Shield, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User as UserType } from "@shared/schema";
import { ADMIN_ROUTES } from "@shared/api-routes";

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

export default function UserDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/users/:id");
  const id = params?.id || "";

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: [ADMIN_ROUTES.USER_BY_ID(id)],
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

            <Card data-testid="card-permissions">
              <CardHeader>
                <CardTitle className="text-lg">Permissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground" data-testid="text-permissions-info">
                  User permissions can be managed from the Users list page using the Permissions button.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/admin/users")}
                  data-testid="button-go-to-permissions"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Go to Users
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
