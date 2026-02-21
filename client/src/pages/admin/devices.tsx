import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow } from "date-fns";
import {
  Monitor,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Copy,
  Check,
  Loader2,
  User,
  Clock,
  AlertCircle,
  Key,
} from "lucide-react";
import { ADMIN_ROUTES } from "@shared/api-routes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
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
import type { Device, User as UserType } from "@shared/schema";
import { PageHelpButton } from "@/components/help/page-help-button";

interface DeviceWithUser extends Device {
  user: UserType;
}

const deviceSchema = z.object({
  userId: z.string().min(1, "User is required"),
  deviceName: z.string().min(1, "Device name is required"),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

export default function AdminDevicesPage({ embedded = false, companyId }: { embedded?: boolean; companyId?: string } = {}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [newDeviceKey, setNewDeviceKey] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const companyIdParam = companyId ? `?companyId=${companyId}` : "";

  const { data: devices, isLoading } = useQuery<DeviceWithUser[]>({
    queryKey: companyId ? [ADMIN_ROUTES.DEVICES, { companyId }] : [ADMIN_ROUTES.DEVICES],
  });

  const { data: users } = useQuery<UserType[]>({
    queryKey: companyId ? [ADMIN_ROUTES.USERS, { companyId }] : [ADMIN_ROUTES.USERS],
  });

  const form = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      userId: "",
      deviceName: "",
    },
  });

  const devicesQueryKey = companyId ? [ADMIN_ROUTES.DEVICES, { companyId }] : [ADMIN_ROUTES.DEVICES];

  const createDeviceMutation = useMutation({
    mutationFn: async (data: DeviceFormData) => {
      const res = await apiRequest("POST", `${ADMIN_ROUTES.DEVICES}${companyIdParam}`, data);
      return res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: devicesQueryKey });
      setDialogOpen(false);
      form.reset();
      if (data.deviceKey) {
        setNewDeviceKey(data.deviceKey);
        setKeyDialogOpen(true);
      }
    },
    onError: () => {
      toast({ title: "Failed to create device", variant: "destructive" });
    },
  });

  const toggleDeviceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `${ADMIN_ROUTES.DEVICE_BY_ID(id)}${companyIdParam}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: devicesQueryKey });
      toast({ title: "Device status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update device", variant: "destructive" });
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `${ADMIN_ROUTES.DEVICE_BY_ID(id)}${companyIdParam}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: devicesQueryKey });
      toast({ title: "Device deleted" });
      setDeleteDialogOpen(false);
      setDeletingDeviceId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete device", variant: "destructive" });
    },
  });

  const onSubmit = (data: DeviceFormData) => {
    createDeviceMutation.mutate(data);
  };

  const copyKey = async () => {
    if (newDeviceKey) {
      await navigator.clipboard.writeText(newDeviceKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Device Management">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Device Management">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-devices-title">
              Device Management
            </h1>
              <PageHelpButton pageHelpKey="page.admin.devices" />
            </div>
            <p className="text-muted-foreground">
              Provision and manage Windows Agent devices
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-device">
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>
      )}

      <Card>
        {embedded && (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Devices
              </CardTitle>
              <CardDescription>Provision and manage Windows Agent devices</CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-add-device-embedded">
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </CardHeader>
        )}
        <CardContent className={embedded ? "" : "pt-6"}>
          {devices && devices.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>OS / Agent</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id} data-testid={`row-device-${device.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{device.deviceName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{device.user.name || device.user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{device.os}</span>
                          {device.agentVersion && (
                            <span className="text-xs text-muted-foreground">
                              v{device.agentVersion}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {device.lastSeenAt ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">
                              {formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={device.isActive ? "outline" : "secondary"}>
                          {device.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleDeviceMutation.mutate({
                              id: device.id,
                              isActive: !device.isActive
                            })}
                            data-testid={`button-toggle-${device.id}`}
                          >
                            {device.isActive ? (
                              <PowerOff className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Power className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingDeviceId(device.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-${device.id}`}
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
              <Monitor className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No devices registered</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add a device to start tracking time
              </p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            <DialogDescription>
              Register a new Windows Agent device for time tracking
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.slice().sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '')).map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deviceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="WORKSTATION-01" data-testid="input-device-name" />
                    </FormControl>
                    <FormDescription>
                      A unique identifier for this workstation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDeviceMutation.isPending}
                  data-testid="button-create-device"
                >
                  {createDeviceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Device
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Device Key Generated
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                This key will only be shown once. Copy it now.
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all" data-testid="text-device-key">
                {newDeviceKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyKey}
                data-testid="button-copy-key"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Add this key to the Windows Agent configuration file on the target workstation.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setKeyDialogOpen(false)} data-testid="button-close-key-dialog">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the device key. The Windows Agent will no longer be able to submit time entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDeviceId && deleteDeviceMutation.mutate(deletingDeviceId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDeviceMutation.isPending ? (
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
