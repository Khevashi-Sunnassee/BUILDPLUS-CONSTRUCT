import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  Loader2,
  Mail,
  User,
  Power,
  PowerOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import type { User as UserType, Role } from "@shared/schema";

const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(["USER", "MANAGER", "ADMIN"]),
  poApprover: z.boolean().optional(),
  poApprovalLimit: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users"],
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      role: "USER",
      poApprover: false,
      poApprovalLimit: "",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create user", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      return apiRequest("PUT", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
      setDialogOpen(false);
      setEditingUser(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PUT", `/api/admin/users/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted" });
      setDeleteDialogOpen(false);
      setDeletingUserId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });

  const openEditUser = (user: UserType) => {
    setEditingUser(user);
    form.reset({
      email: user.email,
      name: user.name || "",
      password: "",
      role: user.role as "USER" | "MANAGER" | "ADMIN",
      poApprover: user.poApprover || false,
      poApprovalLimit: user.poApprovalLimit || "",
    });
    setDialogOpen(true);
  };

  const openNewUser = () => {
    setEditingUser(null);
    form.reset({ email: "", name: "", password: "", role: "USER", poApprover: false, poApprovalLimit: "" });
    setDialogOpen(true);
  };

  const onSubmit = (data: UserFormData) => {
    if (editingUser) {
      const updateData: Partial<UserFormData> = {
        email: data.email,
        name: data.name,
        role: data.role,
        poApprover: data.poApprover,
        poApprovalLimit: data.poApprovalLimit,
      };
      if (data.password) {
        updateData.password = data.password;
      }
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return <ShieldAlert className="h-4 w-4 text-red-600" />;
      case "MANAGER":
        return <ShieldCheck className="h-4 w-4 text-blue-600" />;
      default:
        return <Shield className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadge = (role: Role) => {
    const variants: Record<Role, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      ADMIN: { variant: "destructive", label: "Admin" },
      MANAGER: { variant: "default", label: "Manager" },
      USER: { variant: "secondary", label: "User" },
    };
    const config = variants[role] || variants.USER;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-users-title">
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage users and their roles
          </p>
        </div>
        <Button onClick={openNewUser} data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {users && users.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            {getRoleIcon(user.role as Role)}
                          </div>
                          <span className="font-medium">{user.name || "Unnamed"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role as Role)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "outline" : "secondary"}>
                          {user.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.createdAt), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleUserMutation.mutate({
                              id: user.id,
                              isActive: !user.isActive
                            })}
                            data-testid={`button-toggle-${user.id}`}
                          >
                            {user.isActive ? (
                              <PowerOff className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Power className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditUser(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingUserId(user.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No users yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create a user to get started
              </p>
              <Button className="mt-4" onClick={openNewUser}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user details and role"
                : "Create a new user account"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="user@company.com" data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Smith" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{editingUser ? "New Password (optional)" : "Password"}</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="••••••••" data-testid="input-password" />
                    </FormControl>
                    {editingUser && (
                      <FormDescription>
                        Leave blank to keep current password
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Managers can approve time entries. Admins have full access.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">Purchase Order Approval</h4>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="poApprover"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>PO Approver</FormLabel>
                          <FormDescription>
                            Allow this user to approve purchase orders
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-po-approver"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {form.watch("poApprover") && (
                    <FormField
                      control={form.control}
                      name="poApprovalLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Approval Limit ($)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="e.g. 5000.00"
                              data-testid="input-po-approval-limit"
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum PO value this user can approve. Leave blank for unlimited.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  data-testid="button-save-user"
                >
                  {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {editingUser ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account and their associated devices.
              Time entries will be preserved for reporting purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUserId && deleteUserMutation.mutate(deletingUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
