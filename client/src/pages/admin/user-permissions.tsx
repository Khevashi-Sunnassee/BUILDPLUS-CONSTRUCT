import { useState } from "react";
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
import type { User, UserPermission, PermissionLevel } from "@shared/schema";
import { FUNCTION_KEYS } from "@shared/schema";

interface UserWithPermissions {
  user: User;
  permissions: UserPermission[];
}

const FUNCTION_LABELS: Record<string, string> = {
  daily_reports: "Daily Reports",
  production_report: "Production Report",
  logistics: "Logistics",
  weekly_wages: "Weekly Wage Reports",
  kpi_dashboard: "KPI Dashboard",
  jobs: "Jobs",
  panel_register: "Panel Register",
  admin_users: "Admin: Users",
  admin_devices: "Admin: Devices",
  admin_jobs: "Admin: Jobs",
  admin_settings: "Admin: Settings",
  admin_panel_types: "Admin: Panel Types",
  admin_work_types: "Admin: Work Types",
  admin_trailer_types: "Admin: Trailer Types",
  admin_user_permissions: "Admin: User Permissions",
};

const PERMISSION_COLORS: Record<PermissionLevel, string> = {
  HIDDEN: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  VIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  VIEW_AND_UPDATE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const PERMISSION_ICONS: Record<PermissionLevel, React.ReactNode> = {
  HIDDEN: <EyeOff className="h-3 w-3" />,
  VIEW: <Eye className="h-3 w-3" />,
  VIEW_AND_UPDATE: <Pencil className="h-3 w-3" />,
};

export default function UserPermissionsPage() {
  const { toast } = useToast();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const { data: usersWithPermissions, isLoading, refetch } = useQuery<UserWithPermissions[]>({
    queryKey: ["/api/admin/user-permissions"],
  });

  const initializeMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/user-permissions/${userId}/initialize`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-permissions"] });
      toast({ title: "Permissions initialized", description: "All function permissions have been set up for this user." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to initialize permissions", variant: "destructive" });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ userId, functionKey, permissionLevel }: { userId: string; functionKey: string; permissionLevel: PermissionLevel }) => {
      return apiRequest("PUT", `/api/admin/user-permissions/${userId}/${functionKey}`, { permissionLevel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-permissions"] });
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
    const counts = { HIDDEN: 0, VIEW: 0, VIEW_AND_UPDATE: 0, unset: 0 };
    const permMap = new Map(permissions.map(p => [p.functionKey, p.permissionLevel]));
    
    for (const key of FUNCTION_KEYS) {
      const level = permMap.get(key);
      if (!level) {
        counts.unset++;
      } else {
        counts[level as keyof typeof counts]++;
      }
    }
    return counts;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
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
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">User Permissions</h1>
            <p className="text-muted-foreground">Control access to functions for each user</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-permissions">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Permission Levels</CardTitle>
          <CardDescription>Understanding what each level means</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                <EyeOff className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">Hidden</p>
                <p className="text-sm text-red-600 dark:text-red-400">Function is not visible to user</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
              <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                <Eye className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="font-semibold text-yellow-700 dark:text-yellow-300">View Only</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Can see but not modify data</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <Pencil className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-green-700 dark:text-green-300">View & Update</p>
                <p className="text-sm text-green-600 dark:text-green-400">Full access to view and modify</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {usersWithPermissions?.map(({ user, permissions }) => {
          const isExpanded = expandedUsers.has(user.id);
          const counts = countPermissions(permissions);
          const hasUnsetPermissions = counts.unset > 0;

          return (
            <Collapsible key={user.id} open={isExpanded} onOpenChange={() => toggleUser(user.id)}>
              <Card className="overflow-hidden" data-testid={`card-user-${user.id}`}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{user.name || user.email}</CardTitle>
                          <CardDescription>{user.email}</CardDescription>
                        </div>
                        <Badge variant="outline" className="ml-2">{user.role}</Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                          {counts.HIDDEN > 0 && (
                            <Badge className={PERMISSION_COLORS.HIDDEN}>
                              {PERMISSION_ICONS.HIDDEN} {counts.HIDDEN} Hidden
                            </Badge>
                          )}
                          {counts.VIEW > 0 && (
                            <Badge className={PERMISSION_COLORS.VIEW}>
                              {PERMISSION_ICONS.VIEW} {counts.VIEW} View
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
                    {hasUnsetPermissions && (
                      <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200">Some permissions are not set</p>
                          <p className="text-sm text-amber-700 dark:text-amber-300">Initialize to set all functions to "View & Update" by default</p>
                        </div>
                        <Button
                          onClick={() => initializeMutation.mutate(user.id)}
                          disabled={initializeMutation.isPending}
                          data-testid={`button-initialize-${user.id}`}
                        >
                          {initializeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                          Initialize All
                        </Button>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/2">Function</TableHead>
                          <TableHead>Permission Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {FUNCTION_KEYS.map(functionKey => {
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
                                    <SelectItem value="VIEW">
                                      <div className="flex items-center gap-2">
                                        <Eye className="h-4 w-4 text-yellow-500" />
                                        View Only
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="VIEW_AND_UPDATE">
                                      <div className="flex items-center gap-2">
                                        <Pencil className="h-4 w-4 text-green-500" />
                                        View & Update
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
    </div>
  );
}
