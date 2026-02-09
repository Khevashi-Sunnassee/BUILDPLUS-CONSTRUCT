import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, CalendarIcon, Save, Send, Check, X, Truck, Package, RotateCcw, Lock, Loader2 } from "lucide-react";
import type { Supplier, Job, Employee, HireBooking } from "@shared/schema";
import { ASSET_CATEGORIES } from "@shared/schema";
import { HIRE_ROUTES, PROCUREMENT_ROUTES, JOBS_ROUTES, EMPLOYEE_ROUTES, ASSET_ROUTES } from "@shared/api-routes";

interface Asset {
  id: string;
  name: string;
  assetTag: string;
  category: string;
  status: string;
  chargeOutRate?: string;
}

const formSchema = z.object({
  hireSource: z.enum(["internal", "external"]),
  equipmentDescription: z.string().min(1, "Equipment description is required"),
  assetCategoryIndex: z.number().int().min(0, "Asset category is required"),
  assetId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  jobId: z.string().min(1, "Job is required"),
  costCode: z.string().optional().nullable(),
  requestedByUserId: z.string().min(1, "Requested by is required"),
  responsiblePersonUserId: z.string().min(1, "Responsible person is required"),
  siteContactUserId: z.string().nullable().optional(),
  hireStartDate: z.date({ required_error: "Start date is required" }),
  hireEndDate: z.date({ required_error: "End date is required" }),
  expectedReturnDate: z.date().nullable().optional(),
  rateType: z.enum(["day", "week", "month", "custom"]),
  rateAmount: z.string().min(1, "Rate amount is required"),
  chargeRule: z.enum(["calendar_days", "business_days", "minimum_days"]),
  quantity: z.number().int().min(1),
  deliveryRequired: z.boolean(),
  deliveryAddress: z.string().nullable().optional(),
  deliveryCost: z.string().nullable().optional(),
  pickupRequired: z.boolean(),
  pickupCost: z.string().nullable().optional(),
  supplierReference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).refine((data) => {
  if (data.hireSource === "external" && !data.supplierId) return false;
  return true;
}, { message: "Supplier is required for external hire", path: ["supplierId"] })
.refine((data) => {
  if (data.hireSource === "internal" && !data.assetId) return false;
  return true;
}, { message: "Asset is required for internal hire", path: ["assetId"] });

type FormValues = z.infer<typeof formSchema>;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  REQUESTED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  BOOKED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  PICKED_UP: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  ON_HIRE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  RETURNED: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  CLOSED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REQUESTED: "Requested",
  APPROVED: "Approved",
  BOOKED: "Booked",
  PICKED_UP: "Picked Up",
  ON_HIRE: "On Hire",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
};

export default function HireBookingFormPage() {
  const [, params] = useRoute("/hire-bookings/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isNew = params?.id === "new";
  const bookingId = isNew ? null : params?.id;
  const [actionDialog, setActionDialog] = useState<string | null>(null);

  const { data: existingBooking, isLoading: bookingLoading } = useQuery<HireBooking & { assetCategoryName: string }>({
    queryKey: [HIRE_ROUTES.LIST, bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      const res = await fetch(HIRE_ROUTES.BY_ID(bookingId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch booking");
      return res.json();
    },
    enabled: !!bookingId,
  });

  const { data: nextNumber } = useQuery<{ bookingNumber: string }>({
    queryKey: [HIRE_ROUTES.NEXT_NUMBER],
    enabled: isNew,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const { data: jobsList = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: employeesList = [] } = useQuery<Employee[]>({
    queryKey: [EMPLOYEE_ROUTES.ACTIVE],
  });

  const { data: assetsList = [] } = useQuery<Asset[]>({
    queryKey: [ASSET_ROUTES.LIST],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hireSource: "external",
      equipmentDescription: "",
      assetCategoryIndex: 0,
      assetId: null,
      supplierId: null,
      jobId: "",
      costCode: "",
      requestedByUserId: "",
      responsiblePersonUserId: "",
      siteContactUserId: null,
      hireStartDate: new Date(),
      hireEndDate: new Date(),
      expectedReturnDate: null,
      rateType: "day",
      rateAmount: "",
      chargeRule: "calendar_days",
      quantity: 1,
      deliveryRequired: false,
      deliveryAddress: "",
      deliveryCost: "",
      pickupRequired: false,
      pickupCost: "",
      supplierReference: "",
      notes: "",
    },
  });

  const hireSource = form.watch("hireSource");
  const deliveryRequired = form.watch("deliveryRequired");
  const pickupRequired = form.watch("pickupRequired");
  const selectedAssetId = form.watch("assetId");

  useEffect(() => {
    if (existingBooking && !isNew) {
      form.reset({
        hireSource: existingBooking.hireSource || "external",
        equipmentDescription: existingBooking.equipmentDescription || "",
        assetCategoryIndex: existingBooking.assetCategoryIndex ?? 0,
        assetId: existingBooking.assetId || null,
        supplierId: existingBooking.supplierId || null,
        jobId: existingBooking.jobId || "",
        costCode: existingBooking.costCode || "",
        requestedByUserId: existingBooking.requestedByUserId || "",
        responsiblePersonUserId: existingBooking.responsiblePersonUserId || "",
        siteContactUserId: existingBooking.siteContactUserId || null,
        hireStartDate: existingBooking.hireStartDate ? new Date(existingBooking.hireStartDate) : new Date(),
        hireEndDate: existingBooking.hireEndDate ? new Date(existingBooking.hireEndDate) : new Date(),
        expectedReturnDate: existingBooking.expectedReturnDate ? new Date(existingBooking.expectedReturnDate) : null,
        rateType: existingBooking.rateType || "day",
        rateAmount: existingBooking.rateAmount || "",
        chargeRule: existingBooking.chargeRule || "calendar_days",
        quantity: existingBooking.quantity || 1,
        deliveryRequired: existingBooking.deliveryRequired || false,
        deliveryAddress: existingBooking.deliveryAddress || "",
        deliveryCost: existingBooking.deliveryCost || "",
        pickupRequired: existingBooking.pickupRequired || false,
        pickupCost: existingBooking.pickupCost || "",
        supplierReference: existingBooking.supplierReference || "",
        notes: existingBooking.notes || "",
      });
    }
  }, [existingBooking, isNew, form]);

  useEffect(() => {
    if (hireSource === "internal" && selectedAssetId) {
      const asset = assetsList.find((a) => a.id === selectedAssetId);
      if (asset) {
        const catIndex = ASSET_CATEGORIES.indexOf(asset.category as any);
        if (catIndex >= 0) {
          form.setValue("assetCategoryIndex", catIndex);
        }
        if (asset.chargeOutRate) {
          form.setValue("rateAmount", asset.chargeOutRate);
        }
        if (!form.getValues("equipmentDescription")) {
          form.setValue("equipmentDescription", `${asset.name} (${asset.assetTag})`);
        }
      }
    }
  }, [selectedAssetId, hireSource, assetsList, form]);

  const internalAssets = useMemo(() => {
    return assetsList.filter((a) => a.status === "active");
  }, [assetsList]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        hireStartDate: data.hireStartDate.toISOString(),
        hireEndDate: data.hireEndDate.toISOString(),
        expectedReturnDate: data.expectedReturnDate?.toISOString() || null,
        assetId: data.hireSource === "internal" ? data.assetId : null,
        supplierId: data.hireSource === "external" ? data.supplierId : null,
      };

      if (isNew) {
        return apiRequest("POST", HIRE_ROUTES.LIST, payload);
      } else {
        return apiRequest("PATCH", HIRE_ROUTES.BY_ID(bookingId!), payload);
      }
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: [HIRE_ROUTES.LIST] });
      toast({ title: isNew ? "Hire booking created" : "Hire booking updated" });
      if (isNew) {
        const data = await response.json();
        navigate(`/hire-bookings/${data.id}`);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (action: string) => {
      const routeMap: Record<string, (id: string) => string> = {
        submit: HIRE_ROUTES.SUBMIT,
        approve: HIRE_ROUTES.APPROVE,
        reject: HIRE_ROUTES.REJECT,
        book: HIRE_ROUTES.BOOK,
        pickup: HIRE_ROUTES.PICKUP,
        "on-hire": HIRE_ROUTES.ON_HIRE,
        return: HIRE_ROUTES.RETURN,
        cancel: HIRE_ROUTES.CANCEL,
        close: HIRE_ROUTES.CLOSE,
      };
      const routeFn = routeMap[action];
      if (!routeFn || !bookingId) throw new Error("Invalid action");
      await apiRequest("POST", routeFn(bookingId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIRE_ROUTES.LIST] });
      toast({ title: "Status updated" });
      setActionDialog(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    saveMutation.mutate(data);
  };

  const canEdit = isNew || (existingBooking && ["DRAFT", "REQUESTED"].includes(existingBooking.status));
  const bookingNumber = existingBooking?.bookingNumber || nextNumber?.bookingNumber || "HIRE-######";

  if (!isNew && bookingLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/hire-bookings")} data-testid="button-back-hire">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-hire-form-title">
            {isNew ? "New Hire Booking" : `Hire Booking ${bookingNumber}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNew ? "Create a new equipment hire booking" : "View and manage this hire booking"}
          </p>
        </div>
        {existingBooking && (
          <Badge className={STATUS_COLORS[existingBooking.status]} data-testid="badge-booking-status">
            {STATUS_LABELS[existingBooking.status] || existingBooking.status}
          </Badge>
        )}
      </div>

      {existingBooking && !isNew && (
        <div className="flex items-center gap-2 flex-wrap">
          {existingBooking.status === "DRAFT" && (
            <Button onClick={() => setActionDialog("submit")} data-testid="button-submit-booking">
              <Send className="h-4 w-4 mr-2" /> Submit for Approval
            </Button>
          )}
          {existingBooking.status === "REQUESTED" && (
            <>
              <Button onClick={() => setActionDialog("approve")} data-testid="button-approve-booking">
                <Check className="h-4 w-4 mr-2" /> Approve
              </Button>
              <Button variant="destructive" onClick={() => setActionDialog("reject")} data-testid="button-reject-booking">
                <X className="h-4 w-4 mr-2" /> Reject
              </Button>
            </>
          )}
          {existingBooking.status === "APPROVED" && (
            <Button onClick={() => setActionDialog("book")} data-testid="button-book-booking">
              <Package className="h-4 w-4 mr-2" /> Mark as Booked
            </Button>
          )}
          {existingBooking.status === "BOOKED" && (
            <Button onClick={() => setActionDialog("on-hire")} data-testid="button-onhire-booking">
              <Truck className="h-4 w-4 mr-2" /> Mark as On Hire
            </Button>
          )}
          {["ON_HIRE", "PICKED_UP"].includes(existingBooking.status) && (
            <Button onClick={() => setActionDialog("return")} data-testid="button-return-booking">
              <RotateCcw className="h-4 w-4 mr-2" /> Mark as Returned
            </Button>
          )}
          {existingBooking.status === "RETURNED" && (
            <Button onClick={() => setActionDialog("close")} data-testid="button-close-booking">
              <Lock className="h-4 w-4 mr-2" /> Close
            </Button>
          )}
          {!["CANCELLED", "CLOSED", "RETURNED"].includes(existingBooking.status) && (
            <Button variant="outline" onClick={() => setActionDialog("cancel")} data-testid="button-cancel-booking">
              <X className="h-4 w-4 mr-2" /> Cancel Booking
            </Button>
          )}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="font-mono text-lg font-bold" data-testid="text-booking-number">{bookingNumber}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hireSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipment Source</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-hire-source">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="external">External (Hire Company)</SelectItem>
                          <SelectItem value="internal">Internal (Own Equipment)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assetCategoryIndex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Category</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(parseInt(v, 10))}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSET_CATEGORIES.map((cat, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {hireSource === "internal" && (
                <FormField
                  control={form.control}
                  name="assetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Internal Asset</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-internal-asset">
                            <SelectValue placeholder="Select an asset you own" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {internalAssets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.assetTag} - {asset.name} ({asset.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {hireSource === "external" && (
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hire Company (Supplier)</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-supplier">
                            <SelectValue placeholder="Select hire company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="equipmentDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe the equipment to be hired"
                        disabled={!canEdit}
                        data-testid="input-equipment-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project / Job</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!canEdit}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-job">
                          <SelectValue placeholder="Select job" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobsList.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.jobNumber} - {j.name}
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
                name="costCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Code (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="e.g. 1234-001"
                        disabled={!canEdit}
                        data-testid="input-cost-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {hireSource === "external" && (
                <FormField
                  control={form.control}
                  name="supplierReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Reference (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Supplier booking reference number"
                          disabled={!canEdit}
                          data-testid="input-supplier-reference"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="requestedByUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested By</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-requested-by">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employeesList.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.firstName} {e.lastName} ({e.employeeNumber})
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
                  name="responsiblePersonUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsible Person</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-responsible-person">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employeesList.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.firstName} {e.lastName} ({e.employeeNumber})
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
                  name="siteContactUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Contact (Optional)</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={(v) => field.onChange(v || null)}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-site-contact">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employeesList.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.firstName} {e.lastName} ({e.employeeNumber})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hire Period & Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="hireStartDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Hire Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="justify-start text-left font-normal" disabled={!canEdit} data-testid="button-start-date">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} data-testid="calendar-start-date" />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hireEndDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Hire End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="justify-start text-left font-normal" disabled={!canEdit} data-testid="button-end-date">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} data-testid="calendar-end-date" />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expectedReturnDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expected Return Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="justify-start text-left font-normal" disabled={!canEdit} data-testid="button-return-date">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value || undefined} onSelect={(d) => field.onChange(d || null)} data-testid="calendar-return-date" />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="rateType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
                        <FormControl>
                          <SelectTrigger data-testid="select-rate-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="day">Per Day</SelectItem>
                          <SelectItem value="week">Per Week</SelectItem>
                          <SelectItem value="month">Per Month</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rateAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          disabled={!canEdit}
                          data-testid="input-rate-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chargeRule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Charge Rule</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
                        <FormControl>
                          <SelectTrigger data-testid="select-charge-rule">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="calendar_days">Calendar Days</SelectItem>
                          <SelectItem value="business_days">Business Days</SelectItem>
                          <SelectItem value="minimum_days">Minimum Days</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                          disabled={!canEdit}
                          data-testid="input-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery & Pickup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="deliveryRequired"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!canEdit}
                            data-testid="switch-delivery-required"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Delivery Required</FormLabel>
                      </FormItem>
                    )}
                  />
                  {deliveryRequired && (
                    <>
                      <FormField
                        control={form.control}
                        name="deliveryAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Address</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value || ""}
                                placeholder="Delivery address"
                                disabled={!canEdit}
                                data-testid="input-delivery-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="deliveryCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Cost ($)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                disabled={!canEdit}
                                data-testid="input-delivery-cost"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="pickupRequired"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!canEdit}
                            data-testid="switch-pickup-required"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Pickup Required</FormLabel>
                      </FormItem>
                    )}
                  />
                  {pickupRequired && (
                    <FormField
                      control={form.control}
                      name="pickupCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pickup Cost ($)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              disabled={!canEdit}
                              data-testid="input-pickup-cost"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Additional notes..."
                        rows={4}
                        disabled={!canEdit}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {canEdit && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => navigate("/hire-bookings")} data-testid="button-cancel-form">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-hire">
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isNew ? "Create Booking" : "Save Changes"}
              </Button>
            </div>
          )}
        </form>
      </Form>

      <AlertDialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog === "submit" && "Submit for Approval"}
              {actionDialog === "approve" && "Approve Booking"}
              {actionDialog === "reject" && "Reject Booking"}
              {actionDialog === "book" && "Confirm Booking"}
              {actionDialog === "on-hire" && "Mark as On Hire"}
              {actionDialog === "return" && "Mark as Returned"}
              {actionDialog === "cancel" && "Cancel Booking"}
              {actionDialog === "close" && "Close Booking"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to proceed with this action for booking <strong>{bookingNumber}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionDialog) statusMutation.mutate(actionDialog);
              }}
              disabled={statusMutation.isPending}
              data-testid="button-confirm-dialog"
            >
              {statusMutation.isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
