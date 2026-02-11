import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Factory,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  MapPin,
  Bed,
  Calendar,
  X,
  Search,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Factory as FactoryType, ProductionBed } from "@shared/schema";
import { PageHelpButton } from "@/components/help/page-help-button";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const factorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(10, "Code must be 10 characters or less"),
  address: z.string().optional().nullable(),
  streetAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  latitude: z.union([z.number(), z.string(), z.null()]).optional().transform(v => v === "" ? null : typeof v === "string" ? parseFloat(v) || null : v),
  longitude: z.union([z.number(), z.string(), z.null()]).optional().transform(v => v === "" ? null : typeof v === "string" ? parseFloat(v) || null : v),
  cfmeuCalendar: z.enum(["VIC_ONSITE", "VIC_OFFSITE", "QLD"]).nullable().optional(),
  inheritWorkDays: z.boolean().default(true),
  workDays: z.array(z.boolean()).length(7),
  color: z.string().default("#3B82F6"),
  isActive: z.boolean().default(true),
});

type FactoryFormData = z.infer<typeof factorySchema>;

const bedSchema = z.object({
  name: z.string().min(1, "Name is required"),
  lengthMm: z.number().nullable().optional(),
  widthMm: z.number().nullable().optional(),
  isActive: z.boolean().default(true),
});

type BedFormData = z.infer<typeof bedSchema>;

interface FactoryWithBeds extends FactoryType {
  beds?: ProductionBed[];
}

function LocationPicker({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function AdminFactoriesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<FactoryWithBeds | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFactoryId, setDeletingFactoryId] = useState<string | null>(null);
  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<ProductionBed | null>(null);
  const [deleteBedDialogOpen, setDeleteBedDialogOpen] = useState(false);
  const [deletingBedId, setDeletingBedId] = useState<string | null>(null);
  const [viewingFactory, setViewingFactory] = useState<FactoryWithBeds | null>(null);

  const { data: factories, isLoading } = useQuery<FactoryType[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  const { data: globalSettings } = useQuery<{ productionWorkDays?: boolean[] }>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });

  const globalWorkDays = (globalSettings?.productionWorkDays as boolean[]) || [false, true, true, true, true, true, false];

  const form = useForm<FactoryFormData>({
    resolver: zodResolver(factorySchema),
    defaultValues: {
      name: "",
      code: "",
      address: "",
      streetAddress: "",
      city: "",
      postcode: "",
      state: "",
      latitude: null,
      longitude: null,
      cfmeuCalendar: null,
      inheritWorkDays: true,
      workDays: [false, true, true, true, true, true, false],
      color: "#3B82F6",
      isActive: true,
    },
  });

  const inheritWorkDays = form.watch("inheritWorkDays");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapZoom, setMapZoom] = useState(4);

  const geocodeAddress = useCallback(async () => {
    const street = form.getValues("streetAddress") || "";
    const city = form.getValues("city") || "";
    const postcode = form.getValues("postcode") || "";
    const state = form.getValues("state") || "";
    const parts = [street, city, state, postcode].filter(Boolean);
    if (parts.length < 2) return;
    const query = parts.join(", ") + ", Australia";
    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lon) {
          form.setValue("latitude", data.lat);
          form.setValue("longitude", data.lon);
          setMapZoom(14);
        }
      }
    } catch {
    } finally {
      setIsGeocoding(false);
    }
  }, [form]);

  const debouncedGeocode = useCallback(() => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => {
      geocodeAddress();
    }, 1000);
  }, [geocodeAddress]);

  const bedForm = useForm<BedFormData>({
    resolver: zodResolver(bedSchema),
    defaultValues: {
      name: "",
      lengthMm: null,
      widthMm: null,
      isActive: true,
    },
  });

  const createFactoryMutation = useMutation({
    mutationFn: async (data: FactoryFormData) => {
      return apiRequest("POST", ADMIN_ROUTES.FACTORIES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.FACTORIES] });
      toast({ title: "Factory created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create factory", description: error.message, variant: "destructive" });
    },
  });

  const updateFactoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FactoryFormData }) => {
      return apiRequest("PATCH", ADMIN_ROUTES.FACTORY_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.FACTORIES] });
      toast({ title: "Factory updated successfully" });
      setDialogOpen(false);
      setEditingFactory(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update factory", variant: "destructive" });
    },
  });

  const deleteFactoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ADMIN_ROUTES.FACTORY_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.FACTORIES] });
      toast({ title: "Factory deleted" });
      setDeleteDialogOpen(false);
      setDeletingFactoryId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete factory", variant: "destructive" });
    },
  });

  const createBedMutation = useMutation({
    mutationFn: async ({ factoryId, data }: { factoryId: string; data: BedFormData }) => {
      return apiRequest("POST", ADMIN_ROUTES.FACTORY_BEDS(factoryId), data);
    },
    onSuccess: () => {
      if (viewingFactory) {
        queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.FACTORIES, viewingFactory.id] });
        fetchFactoryDetails(viewingFactory.id);
      }
      toast({ title: "Production bed created" });
      setBedDialogOpen(false);
      bedForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create production bed", description: error.message, variant: "destructive" });
    },
  });

  const updateBedMutation = useMutation({
    mutationFn: async ({ factoryId, bedId, data }: { factoryId: string; bedId: string; data: BedFormData }) => {
      return apiRequest("PATCH", ADMIN_ROUTES.FACTORY_BED_BY_ID(factoryId, bedId), data);
    },
    onSuccess: () => {
      if (viewingFactory) {
        fetchFactoryDetails(viewingFactory.id);
      }
      toast({ title: "Production bed updated" });
      setBedDialogOpen(false);
      setEditingBed(null);
      bedForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to update production bed", variant: "destructive" });
    },
  });

  const deleteBedMutation = useMutation({
    mutationFn: async ({ factoryId, bedId }: { factoryId: string; bedId: string }) => {
      return apiRequest("DELETE", ADMIN_ROUTES.FACTORY_BED_BY_ID(factoryId, bedId), {});
    },
    onSuccess: () => {
      if (viewingFactory) {
        fetchFactoryDetails(viewingFactory.id);
      }
      toast({ title: "Production bed deleted" });
      setDeleteBedDialogOpen(false);
      setDeletingBedId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete production bed", variant: "destructive" });
    },
  });

  const fetchFactoryDetails = async (id: string) => {
    const response = await fetch(ADMIN_ROUTES.FACTORY_BY_ID(id), { credentials: "include" });
    if (response.ok) {
      const data = await response.json();
      setViewingFactory(data);
    }
  };

  const openCreateDialog = () => {
    setEditingFactory(null);
    form.reset({
      name: "",
      code: "",
      address: "",
      streetAddress: "",
      city: "",
      postcode: "",
      state: "",
      latitude: null,
      longitude: null,
      cfmeuCalendar: null,
      inheritWorkDays: true,
      workDays: [false, true, true, true, true, true, false],
      color: "#3B82F6",
      isActive: true,
    });
    setMapZoom(4);
    setDialogOpen(true);
  };

  const openEditDialog = (factory: FactoryType) => {
    setEditingFactory(factory);
    const f = factory as any;
    form.reset({
      name: factory.name,
      code: factory.code,
      address: factory.address || "",
      streetAddress: f.streetAddress || "",
      city: f.city || "",
      postcode: f.postcode || "",
      state: factory.state || "",
      latitude: factory.latitude ? parseFloat(String(factory.latitude)) : null,
      longitude: factory.longitude ? parseFloat(String(factory.longitude)) : null,
      cfmeuCalendar: factory.cfmeuCalendar || null,
      inheritWorkDays: factory.inheritWorkDays ?? true,
      workDays: (factory.workDays as boolean[]) || [false, true, true, true, true, true, false],
      color: factory.color || "#3B82F6",
      isActive: factory.isActive,
    });
    setMapZoom(factory.latitude ? 14 : 4);
    setDialogOpen(true);
  };

  const onSubmit = (data: FactoryFormData) => {
    const parts = [data.streetAddress, data.city, data.state, data.postcode].filter(Boolean);
    const composedAddress = parts.length > 0 ? parts.join(", ") : null;
    const submitData = { ...data, address: composedAddress };
    if (editingFactory) {
      updateFactoryMutation.mutate({ id: editingFactory.id, data: submitData });
    } else {
      createFactoryMutation.mutate(submitData);
    }
  };

  const openBedCreateDialog = () => {
    setEditingBed(null);
    bedForm.reset({
      name: "",
      lengthMm: null,
      widthMm: null,
      isActive: true,
    });
    setBedDialogOpen(true);
  };

  const openBedEditDialog = (bed: ProductionBed) => {
    setEditingBed(bed);
    bedForm.reset({
      name: bed.name,
      lengthMm: bed.lengthMm,
      widthMm: bed.widthMm,
      isActive: bed.isActive,
    });
    setBedDialogOpen(true);
  };

  const onBedSubmit = (data: BedFormData) => {
    if (!viewingFactory) return;
    if (editingBed) {
      updateBedMutation.mutate({ factoryId: viewingFactory.id, bedId: editingBed.id, data });
    } else {
      createBedMutation.mutate({ factoryId: viewingFactory.id, data });
    }
  };

  const factoriesWithCoords = factories?.filter(f => f.latitude && f.longitude) || [];
  const mapCenter: [number, number] = factoriesWithCoords.length > 0
    ? [
        factoriesWithCoords.reduce((sum, f) => sum + parseFloat(String(f.latitude)), 0) / factoriesWithCoords.length,
        factoriesWithCoords.reduce((sum, f) => sum + parseFloat(String(f.longitude)), 0) / factoriesWithCoords.length,
      ]
    : [-37.8136, 144.9631];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Factory Management</h1>
              <PageHelpButton pageHelpKey="page.admin.factories" />
            </div>
            <p className="text-sm text-muted-foreground">Manage production facilities and their beds</p>
          </div>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-factory">
          <Plus className="h-4 w-4 mr-2" />
          Add Factory
        </Button>
      </div>

      {factories && factories.length > 0 && factories.some(f => f.latitude && f.longitude) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Factory Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] rounded-md overflow-hidden relative" style={{ zIndex: 0 }}>
              <MapContainer
                center={mapCenter}
                zoom={5}
                style={{ height: "100%", width: "100%", zIndex: 0 }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {factories.filter(f => f.latitude && f.longitude).map(factory => (
                  <Marker
                    key={factory.id}
                    position={[parseFloat(String(factory.latitude)), parseFloat(String(factory.longitude))]}
                    eventHandlers={{
                      click: () => fetchFactoryDetails(factory.id),
                    }}
                  >
                    <Popup>
                      <div className="text-center">
                        <strong>{factory.name}</strong>
                        <br />
                        <span className="text-muted-foreground">{factory.code}</span>
                        {(() => {
                          const f = factory as any;
                          const parts = [f.streetAddress, f.city, f.state, f.postcode].filter(Boolean);
                          const addr = parts.length > 0 ? parts.join(", ") : factory.address;
                          return addr ? (
                            <>
                              <br />
                              <span className="text-xs">{addr}</span>
                            </>
                          ) : null;
                        })()}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Factories</CardTitle>
          <CardDescription>All production facilities</CardDescription>
        </CardHeader>
        <CardContent>
          {!factories || factories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No factories configured. Click "Add Factory" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>CFMEU Calendar</TableHead>
                  <TableHead>Work Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factories.map(factory => (
                  <TableRow 
                    key={factory.id} 
                    className="hover-elevate cursor-pointer"
                    onClick={() => fetchFactoryDetails(factory.id)}
                    data-testid={`row-factory-${factory.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: factory.color || "#3B82F6" }}
                        />
                        <span className="font-medium">{factory.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{factory.code}</TableCell>
                    <TableCell>{factory.state || "-"}</TableCell>
                    <TableCell>
                      {factory.cfmeuCalendar ? (
                        <Badge variant="outline">{factory.cfmeuCalendar.replace("_", " ")}</Badge>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-0.5">
                          {dayNames.map((day, i) => {
                            const displayDays = factory.inheritWorkDays ? globalWorkDays : (factory.workDays as boolean[]);
                            return (
                              <span
                                key={day}
                                className={`text-xs px-1 rounded ${
                                  displayDays?.[i]
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {day[0]}
                              </span>
                            );
                          })}
                        </div>
                        {factory.inheritWorkDays && (
                          <span className="text-xs text-muted-foreground">(inherited)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={factory.isActive ? "default" : "secondary"}>
                        {factory.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(factory)}
                          data-testid={`button-edit-factory-${factory.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setDeletingFactoryId(factory.id);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-factory-${factory.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFactory ? "Edit Factory" : "Add Factory"}</DialogTitle>
            <DialogDescription>
              {editingFactory ? "Update factory details" : "Add a new production facility"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Melbourne Factory" data-testid="input-factory-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="MEL" data-testid="input-factory-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="streetAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        onChange={e => { field.onChange(e.target.value); debouncedGeocode(); }}
                        placeholder="123 Industrial Avenue"
                        data-testid="input-factory-street-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City / Suburb</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          onChange={e => { field.onChange(e.target.value); debouncedGeocode(); }}
                          placeholder="Melbourne"
                          data-testid="input-factory-city"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={v => { field.onChange(v); debouncedGeocode(); }} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-factory-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="VIC">Victoria</SelectItem>
                          <SelectItem value="NSW">New South Wales</SelectItem>
                          <SelectItem value="QLD">Queensland</SelectItem>
                          <SelectItem value="WA">Western Australia</SelectItem>
                          <SelectItem value="SA">South Australia</SelectItem>
                          <SelectItem value="TAS">Tasmania</SelectItem>
                          <SelectItem value="NT">Northern Territory</SelectItem>
                          <SelectItem value="ACT">Australian Capital Territory</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          onChange={e => { field.onChange(e.target.value); debouncedGeocode(); }}
                          placeholder="3000"
                          maxLength={4}
                          data-testid="input-factory-postcode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input type="color" {...field} className="w-12 h-9 p-1" data-testid="input-factory-color" />
                          <Input {...field} placeholder="#3B82F6" className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Latitude</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            {...field}
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="-37.8136"
                            data-testid="input-factory-latitude"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longitude</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            {...field}
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="144.9631"
                            data-testid="input-factory-longitude"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={geocodeAddress}
                    disabled={isGeocoding}
                    data-testid="button-geocode-address"
                  >
                    {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Card className="p-0">
                <CardContent className="p-2">
                  <p className="text-xs text-muted-foreground mb-2">Click on the map to set location, or fill in the address fields above to auto-locate</p>
                  <div className="h-[200px] rounded-md overflow-hidden">
                    <MapContainer
                      center={[form.watch("latitude") || -37.8136, form.watch("longitude") || 144.9631]}
                      zoom={mapZoom}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <LocationPicker
                        onChange={(lat, lng) => {
                          form.setValue("latitude", lat);
                          form.setValue("longitude", lng);
                        }}
                      />
                      <MapCenterUpdater center={[form.watch("latitude") || -37.8136, form.watch("longitude") || 144.9631]} zoom={mapZoom} />
                      {form.watch("latitude") && form.watch("longitude") && (
                        <Marker position={[form.watch("latitude")!, form.watch("longitude")!]} />
                      )}
                    </MapContainer>
                  </div>
                </CardContent>
              </Card>

              <FormField
                control={form.control}
                name="cfmeuCalendar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CFMEU Calendar</FormLabel>
                    <Select 
                      onValueChange={v => field.onChange(v === "__NONE__" ? null : v)} 
                      value={field.value || "__NONE__"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-cfmeu-calendar">
                          <SelectValue placeholder="Select CFMEU calendar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__NONE__">None</SelectItem>
                        <SelectItem value="VIC_ONSITE">VIC Onsite (36hr)</SelectItem>
                        <SelectItem value="VIC_OFFSITE">VIC Offsite (38hr)</SelectItem>
                        <SelectItem value="QLD">QLD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      RDO and public holiday calendar for working day calculations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Card className="p-0">
                <CardContent className="p-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="inheritWorkDays"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Production Staff Work Days</FormLabel>
                          <FormDescription>
                            {field.value ? "Using global settings" : "Using custom work days for this factory"}
                          </FormDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Inherit from global</span>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                              data-testid="switch-inherit-workdays" 
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workDays"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          {dayNames.map((day, index) => {
                            const displayDays = inheritWorkDays ? globalWorkDays : field.value;
                            return (
                              <div key={day} className="flex flex-col items-center gap-1">
                                <span className="text-xs text-muted-foreground">{day}</span>
                                <Checkbox
                                  checked={displayDays[index]}
                                  disabled={inheritWorkDays}
                                  onCheckedChange={checked => {
                                    if (!inheritWorkDays) {
                                      const newDays = [...field.value];
                                      newDays[index] = !!checked;
                                      field.onChange(newDays);
                                    }
                                  }}
                                  data-testid={`checkbox-workday-${index}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        {inheritWorkDays && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Work days inherited from global settings. Turn off "Inherit from global" to customize.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Factory is available for selection</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-factory-active" />
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
                  disabled={createFactoryMutation.isPending || updateFactoryMutation.isPending}
                  data-testid="button-save-factory"
                >
                  {(createFactoryMutation.isPending || updateFactoryMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingFactory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingFactory} onOpenChange={open => !open && setViewingFactory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: viewingFactory?.color || "#3B82F6" }}
              />
              {viewingFactory?.name}
              <Badge variant="outline" className="ml-2">{viewingFactory?.code}</Badge>
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const f = viewingFactory as any;
                const parts = [f?.streetAddress, f?.city, f?.state, f?.postcode].filter(Boolean);
                return parts.length > 0 ? parts.join(", ") : (viewingFactory?.address || "No address");
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">State:</span>
                <span className="ml-2 font-medium">{viewingFactory?.state || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CFMEU:</span>
                <span className="ml-2 font-medium">
                  {viewingFactory?.cfmeuCalendar?.replace("_", " ") || "None"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={viewingFactory?.isActive ? "default" : "secondary"} className="ml-2">
                  {viewingFactory?.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Bed className="h-4 w-4" />
                  Production Beds
                </h4>
                <Button size="sm" onClick={openBedCreateDialog} data-testid="button-add-bed">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Bed
                </Button>
              </div>

              {!viewingFactory?.beds || viewingFactory.beds.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground border rounded-md">
                  No production beds configured
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Length (mm)</TableHead>
                      <TableHead>Width (mm)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingFactory.beds.map(bed => (
                      <TableRow key={bed.id} data-testid={`row-bed-${bed.id}`}>
                        <TableCell className="font-medium">{bed.name}</TableCell>
                        <TableCell>{bed.lengthMm?.toLocaleString() || "-"}</TableCell>
                        <TableCell>{bed.widthMm?.toLocaleString() || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={bed.isActive ? "default" : "secondary"}>
                            {bed.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openBedEditDialog(bed)}
                              data-testid={`button-edit-bed-${bed.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setDeletingBedId(bed.id);
                                setDeleteBedDialogOpen(true);
                              }}
                              data-testid={`button-delete-bed-${bed.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingFactory(null)}>
              Close
            </Button>
            <Button onClick={() => viewingFactory && openEditDialog(viewingFactory)} data-testid="button-edit-viewing-factory">
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Factory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bedDialogOpen} onOpenChange={setBedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBed ? "Edit Production Bed" : "Add Production Bed"}</DialogTitle>
            <DialogDescription>
              Configure a production bed for {viewingFactory?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...bedForm}>
            <form onSubmit={bedForm.handleSubmit(onBedSubmit)} className="space-y-4">
              <FormField
                control={bedForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Bed 1" data-testid="input-bed-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={bedForm.control}
                  name="lengthMm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Length (mm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ""}
                          onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="12000"
                          data-testid="input-bed-length"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bedForm.control}
                  name="widthMm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Width (mm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ""}
                          onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="3600"
                          data-testid="input-bed-width"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={bedForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Bed is available for scheduling</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-bed-active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBedDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBedMutation.isPending || updateBedMutation.isPending}
                  data-testid="button-save-bed"
                >
                  {(createBedMutation.isPending || updateBedMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingBed ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Factory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this factory? This action cannot be undone.
              All production beds associated with this factory will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFactoryId && deleteFactoryMutation.mutate(deletingFactoryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-factory"
            >
              {deleteFactoryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteBedDialogOpen} onOpenChange={setDeleteBedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Production Bed</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this production bed? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => viewingFactory && deletingBedId && deleteBedMutation.mutate({ factoryId: viewingFactory.id, bedId: deletingBedId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-bed"
            >
              {deleteBedMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
