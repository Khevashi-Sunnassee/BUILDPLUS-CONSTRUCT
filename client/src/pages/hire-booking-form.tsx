import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { PageHelpButton } from "@/components/help/page-help-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, CalendarIcon, Save, Send, Check, X, Truck, Package, RotateCcw, Lock, Loader2, Printer, Mail, MapPin } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Supplier, Job, Employee, HireBooking } from "@shared/schema";
import { ASSET_CATEGORIES } from "@shared/schema";
import { HIRE_ROUTES, PROCUREMENT_ROUTES, JOBS_ROUTES, EMPLOYEE_ROUTES, ASSET_ROUTES, FACTORIES_ROUTES } from "@shared/api-routes";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface Factory {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  isActive: boolean;
}

interface Asset {
  id: string;
  name: string;
  assetTag: string;
  category: string;
  status: string;
  chargeOutRate?: string;
}

interface BookingWithDetails extends HireBooking {
  assetCategoryName: string;
  supplier?: Supplier | null;
  job?: Job | null;
  requestedByEmployee?: Employee | null;
}

interface EmailFormState {
  to: string;
  cc: string;
  subject: string;
  message: string;
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
  hireLocationMode: z.enum(["manual", "factory"]),
  hireLocation: z.string().nullable().optional(),
  hireLocationFactoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).refine((data) => {
  if (data.hireSource === "external" && !data.supplierId) return false;
  return true;
}, { message: "Supplier is required for external hire", path: ["supplierId"] })
.refine((data) => {
  if (data.hireSource === "internal" && !data.assetId) return false;
  return true;
}, { message: "Asset is required for internal hire", path: ["assetId"] })
.refine((data) => {
  if (data.hireStartDate && data.hireEndDate) {
    return data.hireEndDate >= data.hireStartDate;
  }
  return true;
}, { message: "End date must be on or after the start date", path: ["hireEndDate"] });

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

const ACTION_DESCRIPTIONS: Record<string, { label: string; ariaLabel: string; dialogTitle: string; dialogDescription: string }> = {
  submit: {
    label: "Submit for Approval",
    ariaLabel: "Submit this booking for approval, changing status from Draft to Requested",
    dialogTitle: "Submit for Approval",
    dialogDescription: "This will change the booking status from Draft to Requested and send it for approval.",
  },
  approve: {
    label: "Approve",
    ariaLabel: "Approve this booking request, changing status from Requested to Approved",
    dialogTitle: "Approve Booking",
    dialogDescription: "This will change the booking status from Requested to Approved.",
  },
  reject: {
    label: "Reject",
    ariaLabel: "Reject this booking request, changing status from Requested to Cancelled",
    dialogTitle: "Reject Booking",
    dialogDescription: "This will reject the booking and change its status to Cancelled.",
  },
  book: {
    label: "Mark as Booked",
    ariaLabel: "Mark this booking as booked with the supplier, changing status from Approved to Booked",
    dialogTitle: "Confirm Booking",
    dialogDescription: "This will change the booking status from Approved to Booked, indicating the equipment has been reserved.",
  },
  "on-hire": {
    label: "Mark as On Hire",
    ariaLabel: "Mark this equipment as currently on hire, changing status from Booked to On Hire",
    dialogTitle: "Mark as On Hire",
    dialogDescription: "This will change the booking status from Booked to On Hire, indicating the equipment is actively in use.",
  },
  return: {
    label: "Mark as Returned",
    ariaLabel: "Mark this equipment as returned, changing status to Returned",
    dialogTitle: "Mark as Returned",
    dialogDescription: "This will change the booking status to Returned, indicating the equipment has been sent back.",
  },
  cancel: {
    label: "Cancel Booking",
    ariaLabel: "Cancel this booking entirely, changing status to Cancelled",
    dialogTitle: "Cancel Booking",
    dialogDescription: "This will cancel the booking. This action may not be reversible.",
  },
  close: {
    label: "Close",
    ariaLabel: "Close this booking, changing status from Returned to Closed",
    dialogTitle: "Close Booking",
    dialogDescription: "This will close the booking, indicating all processes are complete.",
  },
};

const NON_EDITABLE_STATUSES = new Set(["CANCELLED", "CLOSED"]);

export default function HireBookingFormPage() {
  const [, params] = useRoute("/hire-bookings/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isNewForTitle = params?.id === "new";
  useDocumentTitle(isNewForTitle ? "New Hire Booking" : "Hire Booking");
  const isNew = params?.id === "new";
  const bookingId = isNew ? null : params?.id;
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const autoPrintDone = useRef(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailForm, setEmailForm] = useState<EmailFormState>({ to: "", cc: "", subject: "", message: "" });

  const { data: existingBooking, isLoading: bookingLoading } = useQuery<BookingWithDetails>({
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
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_EQUIPMENT_HIRE],
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

  const { data: factoriesList = [] } = useQuery<Factory[]>({
    queryKey: [FACTORIES_ROUTES.LIST],
  });

  const bookingNumber = existingBooking?.bookingNumber || nextNumber?.bookingNumber || "HIRE-######";
  const canEdit = isNew || (existingBooking ? !NON_EDITABLE_STATUSES.has(existingBooking.status) : false);

  useEffect(() => {
    if (existingBooking && !autoPrintDone.current) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("print") === "true") {
        autoPrintDone.current = true;
        setTimeout(() => window.print(), 500);
      }
    }
  }, [existingBooking]);

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
      hireLocationMode: "manual",
      hireLocation: "",
      hireLocationFactoryId: null,
      notes: "",
    },
  });

  const watchedFields = form.watch(["hireSource", "deliveryRequired", "pickupRequired", "assetId", "hireLocationMode"]);
  const hireSource = watchedFields[0];
  const deliveryRequired = watchedFields[1];
  const pickupRequired = watchedFields[2];
  const selectedAssetId = watchedFields[3];
  const hireLocationMode = watchedFields[4];

  const activeFactories = useMemo(() => factoriesList.filter(f => f.isActive), [factoriesList]);

  const sortedEmployees = useMemo(() =>
    [...employeesList].sort((a, b) => {
      const aName = `${a.firstName} ${a.lastName}`.toLowerCase();
      const bName = `${b.firstName} ${b.lastName}`.toLowerCase();
      return aName.localeCompare(bName);
    }),
    [employeesList]
  );

  const sortedJobs = useMemo(() =>
    [...jobsList].sort((a, b) => (a.jobNumber || a.name || "").localeCompare(b.jobNumber || b.name || "")),
    [jobsList]
  );

  const sortedSuppliers = useMemo(() =>
    [...suppliers].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [suppliers]
  );

  const internalAssets = useMemo(() => {
    if (hireSource !== "internal") return [];
    return [...assetsList]
      .filter((a) => a.status === "active")
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [assetsList, hireSource]);

  useEffect(() => {
    if (existingBooking && !isNew) {
      setSelectedStatus(existingBooking.status);
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
        hireLocationMode: existingBooking.hireLocationFactoryId ? "factory" : "manual",
        hireLocation: existingBooking.hireLocation || "",
        hireLocationFactoryId: existingBooking.hireLocationFactoryId || null,
        notes: existingBooking.notes || "",
      });
    }
  }, [existingBooking, isNew, form]);

  useEffect(() => {
    if (hireSource === "internal" && selectedAssetId) {
      const asset = assetsList.find((a) => a.id === selectedAssetId);
      if (asset) {
        const catIndex = ASSET_CATEGORIES.indexOf(asset.category as typeof ASSET_CATEGORIES[number]);
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

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const resolvedLocation = data.hireLocationMode === "factory" && data.hireLocationFactoryId
        ? activeFactories.find(f => f.id === data.hireLocationFactoryId)?.name || data.hireLocation || null
        : data.hireLocation || null;

      const { hireLocationMode: _, hireStartDate, hireEndDate, expectedReturnDate, ...formFields } = data;
      const payload = {
        ...formFields,
        hireStartDate: hireStartDate.toISOString(),
        hireEndDate: hireEndDate.toISOString(),
        expectedReturnDate: expectedReturnDate?.toISOString() || null,
        assetId: data.hireSource === "internal" ? data.assetId || null : null,
        supplierId: data.hireSource === "external" ? data.supplierId || null : null,
        hireLocation: resolvedLocation,
        hireLocationFactoryId: data.hireLocationMode === "factory" ? (data.hireLocationFactoryId || null) : null,
        ...((!isNew && selectedStatus) ? { status: selectedStatus } : {}),
      };

      if (isNew) {
        return apiRequest("POST", HIRE_ROUTES.LIST, payload);
      } else {
        return apiRequest("PATCH", HIRE_ROUTES.BY_ID(bookingId!), payload);
      }
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: [HIRE_ROUTES.LIST] });
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: [HIRE_ROUTES.LIST, bookingId] });
      }
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
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: [HIRE_ROUTES.LIST, bookingId] });
      }
      toast({ title: "Status updated" });
      setActionDialog(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!bookingId) throw new Error("Save the booking first");
      return apiRequest("POST", HIRE_ROUTES.SEND_EMAIL(bookingId), {
        to: emailForm.to,
        cc: emailForm.cc || undefined,
        subject: emailForm.subject || undefined,
        message: emailForm.message || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      setEmailDialogOpen(false);
      setEmailForm({ to: "", cc: "", subject: "", message: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send email", description: error.message, variant: "destructive" });
    },
  });

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleOpenEmailDialog = useCallback(() => {
    const supplierEmail = existingBooking?.supplier?.email || "";
    setEmailForm({
      to: supplierEmail,
      cc: "",
      subject: `Equipment Hire Booking ${bookingNumber}`,
      message: "",
    });
    setEmailDialogOpen(true);
  }, [existingBooking, bookingNumber]);

  const onSubmit = useCallback((data: FormValues) => {
    saveMutation.mutate(data);
  }, [saveMutation]);

  const handleActionDialogOpen = useCallback((action: string) => {
    setActionDialog(action);
  }, []);

  const updateEmailField = useCallback((field: keyof EmailFormState, value: string) => {
    setEmailForm(prev => ({ ...prev, [field]: value }));
  }, []);

  if (!isNew && bookingLoading) {
    return (
      <div className="p-6 space-y-4" role="main" aria-label="Hire Booking Form" aria-busy="true">
        <Skeleton className="h-10 w-48" aria-label="Loading booking title" />
        <Skeleton className="h-[600px] w-full" aria-label="Loading booking form" />
      </div>
    );
  }

  const currentActionMeta = actionDialog ? ACTION_DESCRIPTIONS[actionDialog] : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto hire-booking-print-area" role="main" aria-label={isNew ? "Create new hire booking" : `Hire booking ${bookingNumber}`}>
      <div className="flex items-center gap-4 flex-wrap no-print">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/hire-bookings")}
          aria-label="Go back to hire bookings list"
          data-testid="button-back-hire"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" data-testid="text-hire-form-title">
              {isNew ? "New Hire Booking" : `Hire Booking ${bookingNumber}`}
            </h1>
            <PageHelpButton pageHelpKey="page.hire-booking-form" />
          </div>
          <p className="text-sm text-muted-foreground" id="hire-form-description">
            {isNew ? "Create a new equipment hire booking" : "View and manage this hire booking"}
          </p>
        </div>
        {existingBooking && (
          <Badge className={STATUS_COLORS[existingBooking.status]} data-testid="badge-booking-status" aria-label={`Current status: ${STATUS_LABELS[existingBooking.status] || existingBooking.status}`}>
            {STATUS_LABELS[existingBooking.status] || existingBooking.status}
          </Badge>
        )}
      </div>

      {existingBooking && !isNew && (
        <nav className="flex items-center gap-2 flex-wrap no-print" aria-label="Booking actions" role="toolbar">
          {existingBooking.status === "DRAFT" && (
            <Button onClick={() => handleActionDialogOpen("submit")} aria-label={ACTION_DESCRIPTIONS.submit.ariaLabel} data-testid="button-submit-booking">
              <Send className="h-4 w-4 mr-2" aria-hidden="true" /> Submit for Approval
            </Button>
          )}
          {existingBooking.status === "REQUESTED" && (
            <>
              <Button onClick={() => handleActionDialogOpen("approve")} aria-label={ACTION_DESCRIPTIONS.approve.ariaLabel} data-testid="button-approve-booking">
                <Check className="h-4 w-4 mr-2" aria-hidden="true" /> Approve
              </Button>
              <Button variant="destructive" onClick={() => handleActionDialogOpen("reject")} aria-label={ACTION_DESCRIPTIONS.reject.ariaLabel} data-testid="button-reject-booking">
                <X className="h-4 w-4 mr-2" aria-hidden="true" /> Reject
              </Button>
            </>
          )}
          {existingBooking.status === "APPROVED" && (
            <Button onClick={() => handleActionDialogOpen("book")} aria-label={ACTION_DESCRIPTIONS.book.ariaLabel} data-testid="button-book-booking">
              <Package className="h-4 w-4 mr-2" aria-hidden="true" /> Mark as Booked
            </Button>
          )}
          {existingBooking.status === "BOOKED" && (
            <Button onClick={() => handleActionDialogOpen("on-hire")} aria-label={ACTION_DESCRIPTIONS["on-hire"].ariaLabel} data-testid="button-onhire-booking">
              <Truck className="h-4 w-4 mr-2" aria-hidden="true" /> Mark as On Hire
            </Button>
          )}
          {["ON_HIRE", "PICKED_UP"].includes(existingBooking.status) && (
            <Button onClick={() => handleActionDialogOpen("return")} aria-label={ACTION_DESCRIPTIONS.return.ariaLabel} data-testid="button-return-booking">
              <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" /> Mark as Returned
            </Button>
          )}
          {existingBooking.status === "RETURNED" && (
            <Button onClick={() => handleActionDialogOpen("close")} aria-label={ACTION_DESCRIPTIONS.close.ariaLabel} data-testid="button-close-booking">
              <Lock className="h-4 w-4 mr-2" aria-hidden="true" /> Close
            </Button>
          )}
          {!["CANCELLED", "CLOSED", "RETURNED"].includes(existingBooking.status) && (
            <Button variant="outline" onClick={() => handleActionDialogOpen("cancel")} aria-label={ACTION_DESCRIPTIONS.cancel.ariaLabel} data-testid="button-cancel-booking">
              <X className="h-4 w-4 mr-2" aria-hidden="true" /> Cancel Booking
            </Button>
          )}
          <Separator orientation="vertical" className="h-6 mx-1" aria-hidden="true" />
          <Button variant="outline" onClick={handlePrint} aria-label={`Print booking ${bookingNumber}`} data-testid="button-print-booking">
            <Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Print
          </Button>
          <Button variant="outline" onClick={handleOpenEmailDialog} aria-label={`Email booking ${bookingNumber} details`} data-testid="button-email-booking">
            <Mail className="h-4 w-4 mr-2" aria-hidden="true" /> Email
          </Button>
        </nav>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" aria-label="Hire booking form" aria-describedby="hire-form-description">
          <Card>
            <CardHeader>
              <CardTitle id="booking-details-heading">Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6" role="group" aria-labelledby="booking-details-heading">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="font-mono text-lg font-bold" data-testid="text-booking-number" aria-label={`Booking number: ${bookingNumber}`}>{bookingNumber}</div>
                {existingBooking && !isNew && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground" id="status-select-label">Status:</Label>
                    <Select value={selectedStatus || existingBooking.status} onValueChange={setSelectedStatus} disabled={!canEdit} aria-labelledby="status-select-label">
                      <SelectTrigger className="w-[180px]" data-testid="select-booking-status" aria-label="Change booking status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value} data-testid={`status-option-${value}`}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                          <SelectTrigger data-testid="select-hire-source" aria-label="Select equipment source: internal or external">
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
                          <SelectTrigger data-testid="select-asset-category" aria-label="Select asset category">
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
                          <SelectTrigger data-testid="select-internal-asset" aria-label="Select an internal asset to assign to this booking">
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
                          <SelectTrigger data-testid="select-supplier" aria-label="Select the hire company supplier">
                            <SelectValue placeholder="Select hire company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedSuppliers.map((s) => (
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
                        aria-required="true"
                        aria-label="Equipment description"
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
                        <SelectTrigger data-testid="select-job" aria-label="Select the project or job for this hire">
                          <SelectValue placeholder="Select job" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedJobs.map((j) => (
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
                        aria-label="Cost code, optional"
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
                          aria-label="Supplier reference number, optional"
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
              <CardTitle id="people-heading">People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" role="group" aria-labelledby="people-heading">
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
                          <SelectTrigger data-testid="select-requested-by" aria-label="Select the employee who requested this hire">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedEmployees.map((e) => (
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
                          <SelectTrigger data-testid="select-responsible-person" aria-label="Select the person responsible for this equipment">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedEmployees.map((e) => (
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
                          <SelectTrigger data-testid="select-site-contact" aria-label="Select site contact person, optional">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedEmployees.map((e) => (
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
              <CardTitle id="hire-period-heading">Hire Period & Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" role="group" aria-labelledby="hire-period-heading">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="hireStartDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel id="start-date-label">Hire Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="justify-start text-left font-normal" disabled={!canEdit} data-testid="button-start-date" aria-labelledby="start-date-label" aria-describedby="start-date-desc">
                              <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} data-testid="calendar-start-date" aria-label="Pick hire start date" />
                        </PopoverContent>
                      </Popover>
                      <span id="start-date-desc" className="sr-only">The date the hire period begins</span>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hireEndDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel id="end-date-label">Hire End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="justify-start text-left font-normal" disabled={!canEdit} data-testid="button-end-date" aria-labelledby="end-date-label" aria-describedby="end-date-desc">
                              <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} data-testid="calendar-end-date" aria-label="Pick hire end date" />
                        </PopoverContent>
                      </Popover>
                      <span id="end-date-desc" className="sr-only">The date the hire period ends</span>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expectedReturnDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel id="return-date-label">Expected Return Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="justify-start text-left font-normal" disabled={!canEdit} data-testid="button-return-date" aria-labelledby="return-date-label" aria-describedby="return-date-desc">
                              <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Select date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value || undefined} onSelect={(d) => field.onChange(d || null)} data-testid="calendar-return-date" aria-label="Pick expected return date" />
                        </PopoverContent>
                      </Popover>
                      <span id="return-date-desc" className="sr-only">The expected date for equipment return, optional</span>
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
                          <SelectTrigger data-testid="select-rate-type" aria-label="Select hire rate type">
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
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          disabled={!canEdit}
                          aria-required="true"
                          aria-label="Rate amount in dollars"
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
                          <SelectTrigger data-testid="select-charge-rule" aria-label="Select how hire charges are calculated">
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
                          step="1"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                          disabled={!canEdit}
                          aria-required="true"
                          aria-label="Number of equipment units"
                          data-testid="input-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormLabel className="flex items-center gap-2" id="hire-location-label">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Hire Location
                </FormLabel>
                <FormField
                  control={form.control}
                  name="hireLocationMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            if (v === "manual") {
                              form.setValue("hireLocationFactoryId", null);
                            } else {
                              form.setValue("hireLocation", "");
                            }
                          }}
                          className="flex items-center gap-4"
                          data-testid="radio-hire-location-mode"
                          aria-labelledby="hire-location-label"
                          aria-describedby="hire-location-desc"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="manual" id="loc-manual" data-testid="radio-location-manual" />
                            <Label htmlFor="loc-manual" className="cursor-pointer font-normal">Manual Entry</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="factory" id="loc-factory" data-testid="radio-location-factory" />
                            <Label htmlFor="loc-factory" className="cursor-pointer font-normal">Select Factory</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <span id="hire-location-desc" className="sr-only">Choose how to specify the equipment hire location</span>
                    </FormItem>
                  )}
                />

                {hireLocationMode === "manual" && (
                  <FormField
                    control={form.control}
                    name="hireLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="Enter hire location address..."
                            disabled={!canEdit}
                            aria-label="Hire location address"
                            data-testid="input-hire-location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {hireLocationMode === "factory" && (
                  <FormField
                    control={form.control}
                    name="hireLocationFactoryId"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          disabled={!canEdit}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-hire-location-factory" aria-label="Select factory as hire location">
                              <SelectValue placeholder="Select a factory..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {activeFactories.map((factory) => (
                              <SelectItem key={factory.id} value={factory.id}>
                                {factory.code} - {factory.name}
                                {factory.city ? ` (${factory.city}, ${factory.state || ""})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle id="delivery-heading">Delivery & Pickup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" role="group" aria-labelledby="delivery-heading">
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
                            aria-label="Toggle delivery required"
                            aria-describedby="delivery-switch-desc"
                            data-testid="switch-delivery-required"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0" id="delivery-switch-desc">Delivery Required</FormLabel>
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
                                aria-label="Delivery address"
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
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                disabled={!canEdit}
                                aria-label="Delivery cost in dollars"
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
                            aria-label="Toggle pickup required"
                            aria-describedby="pickup-switch-desc"
                            data-testid="switch-pickup-required"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0" id="pickup-switch-desc">Pickup Required</FormLabel>
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
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              disabled={!canEdit}
                              aria-label="Pickup cost in dollars"
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
              <CardTitle id="notes-heading">Notes</CardTitle>
            </CardHeader>
            <CardContent role="group" aria-labelledby="notes-heading">
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
                        aria-label="Additional notes for this hire booking"
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
            <div className="flex items-center justify-end gap-2 no-print" role="group" aria-label="Form actions">
              <Button variant="outline" type="button" onClick={() => navigate("/hire-bookings")} aria-label="Cancel and return to bookings list" data-testid="button-cancel-form">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} aria-label={isNew ? "Create new hire booking" : "Save changes to hire booking"} data-testid="button-save-hire">
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                )}
                {isNew ? "Create Booking" : "Save Changes"}
              </Button>
            </div>
          )}
        </form>
      </Form>

      <AlertDialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <AlertDialogContent role="alertdialog" aria-labelledby="action-dialog-title" aria-describedby="action-dialog-description">
          <AlertDialogHeader>
            <AlertDialogTitle id="action-dialog-title">
              {currentActionMeta?.dialogTitle || "Confirm Action"}
            </AlertDialogTitle>
            <AlertDialogDescription id="action-dialog-description">
              {currentActionMeta?.dialogDescription || "Are you sure you want to proceed?"}{" "}
              Booking: <strong>{bookingNumber}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog" aria-label="Cancel this action and close dialog">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionDialog) statusMutation.mutate(actionDialog);
              }}
              disabled={statusMutation.isPending}
              data-testid="button-confirm-dialog"
              aria-label={currentActionMeta ? `Confirm: ${currentActionMeta.dialogTitle}` : "Confirm action"}
            >
              {statusMutation.isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-lg" aria-labelledby="email-dialog-title" aria-describedby="email-dialog-description">
          <DialogHeader>
            <DialogTitle id="email-dialog-title">Email Hire Booking</DialogTitle>
            <DialogDescription id="email-dialog-description">
              Send booking {bookingNumber} details to the hire company or any recipient.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email-to">To (required)</Label>
              <Input
                id="email-to"
                value={emailForm.to}
                onChange={(e) => updateEmailField("to", e.target.value)}
                placeholder="recipient@example.com"
                aria-required="true"
                aria-label="Recipient email address"
                data-testid="input-email-to"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email-cc">CC (optional)</Label>
              <Input
                id="email-cc"
                value={emailForm.cc}
                onChange={(e) => updateEmailField("cc", e.target.value)}
                placeholder="cc@example.com"
                aria-label="CC email address, optional"
                data-testid="input-email-cc"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailForm.subject}
                onChange={(e) => updateEmailField("subject", e.target.value)}
                placeholder="Equipment Hire Booking"
                aria-label="Email subject line"
                data-testid="input-email-subject"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email-message">Message (optional)</Label>
              <Textarea
                id="email-message"
                value={emailForm.message}
                onChange={(e) => updateEmailField("message", e.target.value)}
                placeholder="Additional message to include..."
                rows={3}
                aria-label="Email message body, optional"
                data-testid="input-email-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} aria-label="Cancel sending email" data-testid="button-cancel-email">
              Cancel
            </Button>
            <Button
              onClick={() => sendEmailMutation.mutate()}
              disabled={!emailForm.to || sendEmailMutation.isPending}
              aria-label={`Send email to ${emailForm.to || "recipient"}`}
              data-testid="button-send-email"
            >
              {sendEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
