import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
} from "lucide-react";
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
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { Zone } from "@shared/schema";

const zoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(10, "Code must be 10 characters or less"),
  description: z.string().optional(),
  color: z.string().default("#3B82F6"),
  isActive: z.boolean().default(true),
});

type ZoneFormData = z.infer<typeof zoneSchema>;

export default function AdminZonesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null);

  const { data: zones, isLoading } = useQuery<Zone[]>({
    queryKey: ["/api/admin/zones"],
  });

  const form = useForm<ZoneFormData>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      color: "#3B82F6",
      isActive: true,
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: async (data: ZoneFormData) => {
      return apiRequest("POST", "/api/admin/zones", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/zones"] });
      toast({ title: "Zone created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create zone", description: error.message, variant: "destructive" });
    },
  });

  const updateZoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ZoneFormData }) => {
      return apiRequest("PUT", `/api/admin/zones/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/zones"] });
      toast({ title: "Zone updated successfully" });
      setDialogOpen(false);
      setEditingZone(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update zone", variant: "destructive" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/zones/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/zones"] });
      toast({ title: "Zone deleted" });
      setDeleteDialogOpen(false);
      setDeletingZoneId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete zone", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingZone(null);
    form.reset({
      name: "",
      code: "",
      description: "",
      color: "#3B82F6",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (zone: Zone) => {
    setEditingZone(zone);
    form.reset({
      name: zone.name,
      code: zone.code,
      description: zone.description || "",
      color: zone.color || "#3B82F6",
      isActive: zone.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ZoneFormData) => {
    if (editingZone) {
      updateZoneMutation.mutate({ id: editingZone.id, data });
    } else {
      createZoneMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-zones-title">Zone Management</h1>
          <p className="text-muted-foreground">Define and organize zones for your projects</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-zone">
          <Plus className="h-4 w-4 mr-2" />
          Add Zone
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Zones
          </CardTitle>
          <CardDescription>
            {zones?.length || 0} zone{zones?.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {zones && zones.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id} data-testid={`row-zone-${zone.id}`}>
                    <TableCell>
                      <div 
                        className="w-6 h-6 rounded-md border"
                        style={{ backgroundColor: zone.color || "#3B82F6" }}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">{zone.code}</TableCell>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {zone.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={zone.isActive ? "default" : "secondary"}>
                        {zone.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(zone)}
                          data-testid={`button-edit-zone-${zone.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingZoneId(zone.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-zone-${zone.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No zones configured yet</p>
              <p className="text-sm">Click "Add Zone" to create your first zone</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? "Edit Zone" : "Add New Zone"}</DialogTitle>
            <DialogDescription>
              {editingZone ? "Update the zone details" : "Create a new zone for organizing your projects"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="ZONE1" 
                          {...field} 
                          className="font-mono uppercase"
                          maxLength={10}
                          data-testid="input-zone-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="color" 
                            {...field} 
                            className="w-12 h-9 p-1 cursor-pointer"
                            data-testid="input-zone-color"
                          />
                          <Input 
                            {...field} 
                            placeholder="#3B82F6"
                            className="font-mono"
                            data-testid="input-zone-color-hex"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Zone name" {...field} data-testid="input-zone-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Optional description for this zone" 
                        {...field} 
                        data-testid="input-zone-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Inactive zones won't appear in selection lists
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-zone-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createZoneMutation.isPending || updateZoneMutation.isPending}
                  data-testid="button-save-zone"
                >
                  {(createZoneMutation.isPending || updateZoneMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingZone ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this zone? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingZoneId && deleteZoneMutation.mutate(deletingZoneId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-zone"
            >
              {deleteZoneMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
