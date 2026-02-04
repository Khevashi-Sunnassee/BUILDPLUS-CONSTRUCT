import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Clock, Save, Loader2, Globe, Upload, Image, Trash2, Building2, Calendar, Factory, AlertTriangle, Database, RefreshCw, CheckCircle } from "lucide-react";
import defaultLogo from "@assets/LTE_STRUCTURE_LOGO_1769926222936.png";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { GlobalSettings } from "@shared/schema";
import { ADMIN_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";

const settingsSchema = z.object({
  tz: z.string().min(1, "Timezone is required"),
  captureIntervalS: z.number().int().min(60).max(900),
  idleThresholdS: z.number().int().min(60).max(900),
  trackedApps: z.string().min(1, "At least one app must be tracked"),
  requireAddins: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [weekStartDay, setWeekStartDay] = useState<number>(1);
  const [productionWindowDays, setProductionWindowDays] = useState<number>(10);
  const [ifcDaysInAdvance, setIfcDaysInAdvance] = useState<number>(14);
  const [daysToAchieveIfc, setDaysToAchieveIfc] = useState<number>(21);
  const [productionDaysInAdvance, setProductionDaysInAdvance] = useState<number>(10);
  const [procurementDaysInAdvance, setProcurementDaysInAdvance] = useState<number>(7);
  const [procurementTimeDays, setProcurementTimeDays] = useState<number>(14);
  const [productionWorkDays, setProductionWorkDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [draftingWorkDays, setDraftingWorkDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [cfmeuCalendar, setCfmeuCalendar] = useState<string>("NONE");
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const deletionCategories = [
    { key: "panels", label: "Panels", description: "Panel register entries" },
    { key: "production_slots", label: "Production Slots", description: "Scheduled production slots" },
    { key: "drafting_program", label: "Drafting Program", description: "Drafting program entries" },
    { key: "daily_logs", label: "Daily Logs", description: "Time tracking logs and entries" },
    { key: "purchase_orders", label: "Purchase Orders", description: "All purchase orders and line items" },
    { key: "logistics", label: "Logistics", description: "Load lists and delivery records" },
    { key: "weekly_wages", label: "Weekly Wages", description: "Weekly wage reports" },
    { key: "chats", label: "Chats", description: "All conversations and messages" },
    { key: "tasks", label: "Tasks", description: "Task groups and tasks" },
    { key: "suppliers", label: "Suppliers", description: "Suppliers and item catalog" },
    { key: "jobs", label: "Jobs", description: "All job records" },
  ];

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const { data: settings, isLoading } = useQuery<GlobalSettings>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });

  // Sync company name, week start day, and production window days from settings
  useEffect(() => {
    if (settings?.companyName) {
      setCompanyName(settings.companyName);
    }
    if (settings?.weekStartDay !== undefined) {
      setWeekStartDay(settings.weekStartDay);
    }
    if (settings?.productionWindowDays !== undefined) {
      setProductionWindowDays(settings.productionWindowDays);
    }
    if (settings?.ifcDaysInAdvance !== undefined) {
      setIfcDaysInAdvance(settings.ifcDaysInAdvance);
    }
    if (settings?.daysToAchieveIfc !== undefined) {
      setDaysToAchieveIfc(settings.daysToAchieveIfc);
    }
    if (settings?.productionDaysInAdvance !== undefined) {
      setProductionDaysInAdvance(settings.productionDaysInAdvance);
    }
    if (settings?.procurementDaysInAdvance !== undefined) {
      setProcurementDaysInAdvance(settings.procurementDaysInAdvance);
    }
    if (settings?.procurementTimeDays !== undefined) {
      setProcurementTimeDays(settings.procurementTimeDays);
    }
    if (settings?.productionWorkDays) {
      setProductionWorkDays(settings.productionWorkDays as boolean[]);
    }
    if (settings?.draftingWorkDays) {
      setDraftingWorkDays(settings.draftingWorkDays as boolean[]);
    }
    if (settings?.cfmeuCalendar) {
      setCfmeuCalendar(settings.cfmeuCalendar);
    }
  }, [settings?.companyName, settings?.weekStartDay, settings?.productionWindowDays, settings?.ifcDaysInAdvance, settings?.daysToAchieveIfc, settings?.productionDaysInAdvance, settings?.procurementDaysInAdvance, settings?.procurementTimeDays, settings?.productionWorkDays, settings?.draftingWorkDays, settings?.cfmeuCalendar]);

  const saveCompanyNameMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", ADMIN_ROUTES.SETTINGS_COMPANY_NAME, { companyName: name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      queryClient.invalidateQueries({ queryKey: [SETTINGS_ROUTES.LOGO] });
      toast({ title: "Company name saved" });
    },
    onError: () => {
      toast({ title: "Failed to save company name", variant: "destructive" });
    },
  });

  const saveWeekStartDayMutation = useMutation({
    mutationFn: async (day: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { weekStartDay: day });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Week start day saved" });
    },
    onError: () => {
      toast({ title: "Failed to save week start day", variant: "destructive" });
    },
  });

  const saveProductionWindowDaysMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { productionWindowDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Production window days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save production window days", variant: "destructive" });
    },
  });

  const saveIfcDaysInAdvanceMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { ifcDaysInAdvance: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "IFC days in advance saved" });
    },
    onError: () => {
      toast({ title: "Failed to save IFC days in advance", variant: "destructive" });
    },
  });

  const saveDaysToAchieveIfcMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { daysToAchieveIfc: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Days to achieve IFC saved" });
    },
    onError: () => {
      toast({ title: "Failed to save days to achieve IFC", variant: "destructive" });
    },
  });

  const saveProductionDaysInAdvanceMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { productionDaysInAdvance: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Production days in advance saved" });
    },
    onError: () => {
      toast({ title: "Failed to save production days in advance", variant: "destructive" });
    },
  });

  const saveProcurementDaysInAdvanceMutation = useMutation({
    mutationFn: async (days: number) => {
      if (days >= ifcDaysInAdvance) {
        throw new Error(`Procurement days must be less than IFC days in advance (${ifcDaysInAdvance})`);
      }
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { procurementDaysInAdvance: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Procurement days in advance saved" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to save procurement days in advance", variant: "destructive" });
    },
  });

  const saveProcurementTimeDaysMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { procurementTimeDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Procurement time days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save procurement time days", variant: "destructive" });
    },
  });

  const saveProductionWorkDaysMutation = useMutation({
    mutationFn: async (days: boolean[]) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { productionWorkDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Production work days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save production work days", variant: "destructive" });
    },
  });

  const saveDraftingWorkDaysMutation = useMutation({
    mutationFn: async (days: boolean[]) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { draftingWorkDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Drafting work days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save drafting work days", variant: "destructive" });
    },
  });

  const saveCfmeuCalendarMutation = useMutation({
    mutationFn: async (calendar: string) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, { cfmeuCalendar: calendar });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "CFMEU calendar saved" });
    },
    onError: () => {
      toast({ title: "Failed to save CFMEU calendar", variant: "destructive" });
    },
  });

  interface CfmeuCalendarData {
    holidays: Array<{
      id: string;
      calendarType: string;
      date: string;
      name: string;
      holidayType: string;
      year: number;
    }>;
    summary: Record<string, { count: number; years: number[] }>;
  }

  const { data: cfmeuCalendarData, isLoading: cfmeuLoading } = useQuery<CfmeuCalendarData>({
    queryKey: [ADMIN_ROUTES.CFMEU_CALENDARS],
  });

  const syncCfmeuCalendarMutation = useMutation({
    mutationFn: async (calendarType: string) => {
      const response = await apiRequest("POST", ADMIN_ROUTES.CFMEU_SYNC, { calendarType });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.CFMEU_CALENDARS] });
      toast({ title: data.message || "Calendar synced successfully" });
    },
    onError: () => {
      toast({ title: "Failed to sync calendar", variant: "destructive" });
    },
  });

  const syncAllCfmeuCalendarsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", ADMIN_ROUTES.CFMEU_SYNC_ALL, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.CFMEU_CALENDARS] });
      toast({ title: "All calendars synced successfully" });
    },
    onError: () => {
      toast({ title: "Failed to sync calendars", variant: "destructive" });
    },
  });

  const { data: dataCounts, refetch: refetchCounts } = useQuery<Record<string, number>>({
    queryKey: [ADMIN_ROUTES.DATA_DELETION_COUNTS],
    enabled: showDeletePanel,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const validateDeletionMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const response = await apiRequest("POST", ADMIN_ROUTES.DATA_DELETION_VALIDATE, { categories });
      return response.json();
    },
    onSuccess: (data) => {
      setValidationResult(data);
      if (data.valid) {
        setShowConfirmDialog(true);
      }
    },
    onError: () => {
      toast({ title: "Failed to validate deletion", variant: "destructive" });
    },
  });

  const performDeletionMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const response = await apiRequest("POST", ADMIN_ROUTES.DATA_DELETION_DELETE, { categories });
      return response.json();
    },
    onSuccess: (data) => {
      setShowConfirmDialog(false);
      setSelectedCategories(new Set());
      setValidationResult(null);
      refetchCounts();
      const totalDeleted = Object.values(data.deleted as Record<string, number>).reduce((a, b) => a + b, 0);
      toast({ title: `Successfully deleted ${totalDeleted} records` });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({ title: "Failed to delete data", variant: "destructive" });
    },
  });

  const handleCategoryToggle = (key: string, checked: boolean) => {
    const newSet = new Set(selectedCategories);
    if (checked) {
      newSet.add(key);
    } else {
      newSet.delete(key);
    }
    setSelectedCategories(newSet);
    setValidationResult(null);
  };

  const handleValidateAndDelete = () => {
    if (selectedCategories.size === 0) {
      toast({ title: "Please select at least one category", variant: "destructive" });
      return;
    }
    validateDeletionMutation.mutate(Array.from(selectedCategories));
  };

  const handleConfirmDelete = () => {
    performDeletionMutation.mutate(Array.from(selectedCategories));
  };

  const uploadLogoMutation = useMutation({
    mutationFn: async (logoBase64: string) => {
      return apiRequest("POST", ADMIN_ROUTES.SETTINGS_LOGO, { logoBase64 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      queryClient.invalidateQueries({ queryKey: [SETTINGS_ROUTES.LOGO] });
      toast({ title: "Logo uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", ADMIN_ROUTES.SETTINGS_LOGO, { logoBase64: "" });
    },
    onSuccess: () => {
      setLogoPreview(null);
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      queryClient.invalidateQueries({ queryKey: [SETTINGS_ROUTES.LOGO] });
      toast({ title: "Logo removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove logo", variant: "destructive" });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo must be less than 2MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setLogoPreview(base64);
      uploadLogoMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      tz: "Australia/Melbourne",
      captureIntervalS: 300,
      idleThresholdS: 300,
      trackedApps: "revit,acad",
      requireAddins: true,
    },
    values: settings ? {
      tz: settings.tz,
      captureIntervalS: settings.captureIntervalS,
      idleThresholdS: settings.idleThresholdS,
      trackedApps: settings.trackedApps,
      requireAddins: settings.requireAddins,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      return apiRequest("PUT", ADMIN_ROUTES.SETTINGS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.SETTINGS] });
      toast({ title: "Settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data);
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
          Global Settings
        </h1>
        <p className="text-muted-foreground">
          Configure system-wide time tracking parameters
        </p>
      </div>

      {/* Company Branding Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Branding
          </CardTitle>
          <CardDescription>
            Configure your company name and logo for the app and reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              data-testid="input-company-name"
            />
            <p className="text-sm text-muted-foreground">
              Displayed on all reports and exports
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => saveCompanyNameMutation.mutate(companyName)}
              disabled={saveCompanyNameMutation.isPending || companyName === settings?.companyName}
              data-testid="button-save-company-name"
            >
              {saveCompanyNameMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Company Name
            </Button>
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                  <img 
                    src={logoPreview || settings?.logoBase64 || defaultLogo} 
                    alt="Company Logo" 
                    className="max-w-full max-h-full object-contain"
                    data-testid="img-logo-preview"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    data-testid="input-logo-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadLogoMutation.isPending}
                    data-testid="button-upload-logo"
                  >
                    {uploadLogoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Logo
                  </Button>
                  {settings?.logoBase64 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeLogoMutation.mutate()}
                      disabled={removeLogoMutation.isPending}
                      data-testid="button-remove-logo"
                    >
                      {removeLogoMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                      )}
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  PNG, JPG or SVG. Max 2MB. Displayed in sidebar and reports.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Week Configuration
          </CardTitle>
          <CardDescription>
            Configure the first day of the week for reports and scheduling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weekStartDay">Week Start Day</Label>
            <div className="flex items-center gap-4">
              <Select
                value={weekStartDay.toString()}
                onValueChange={(value) => setWeekStartDay(parseInt(value))}
              >
                <SelectTrigger className="w-48" data-testid="select-week-start-day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {dayNames.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveWeekStartDayMutation.mutate(weekStartDay)}
                disabled={saveWeekStartDayMutation.isPending || weekStartDay === settings?.weekStartDay}
                data-testid="button-save-week-start-day"
              >
                {saveWeekStartDayMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Weekly Job Reports will be aligned to this day. Users can only select dates that fall on this day.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Production Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Production Configuration
          </CardTitle>
          <CardDescription>
            Configure production scheduling parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productionWindowDays">Production Window Days</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={60}
                value={productionWindowDays}
                onChange={(e) => setProductionWindowDays(parseInt(e.target.value) || 10)}
                className="w-24"
                data-testid="input-production-window-days"
              />
              <span className="text-muted-foreground">days before due date</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveProductionWindowDaysMutation.mutate(productionWindowDays)}
                disabled={saveProductionWindowDaysMutation.isPending || productionWindowDays === settings?.productionWindowDays}
                data-testid="button-save-production-window-days"
              >
                {saveProductionWindowDaysMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Number of days before the Production Due Date when production can start. This defines the production window for scheduling panels.
            </p>
          </div>
          
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="ifcDaysInAdvance">IFC Days in Advance</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={60}
                value={ifcDaysInAdvance}
                onChange={(e) => setIfcDaysInAdvance(parseInt(e.target.value) || 14)}
                className="w-24"
                data-testid="input-ifc-days-in-advance"
              />
              <span className="text-muted-foreground">days before production</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveIfcDaysInAdvanceMutation.mutate(ifcDaysInAdvance)}
                disabled={saveIfcDaysInAdvanceMutation.isPending || ifcDaysInAdvance === settings?.ifcDaysInAdvance}
                data-testid="button-save-ifc-days"
              >
                {saveIfcDaysInAdvanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Number of days before production that a drawing needs to reach IFC (Issued For Construction) stage. Used for scheduling and deadline tracking.
            </p>
          </div>
          
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="daysToAchieveIfc">Days to Achieve IFC</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={60}
                value={daysToAchieveIfc}
                onChange={(e) => setDaysToAchieveIfc(parseInt(e.target.value) || 21)}
                className="w-24"
                data-testid="input-days-to-achieve-ifc"
              />
              <span className="text-muted-foreground">days to complete drafting</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveDaysToAchieveIfcMutation.mutate(daysToAchieveIfc)}
                disabled={saveDaysToAchieveIfcMutation.isPending || daysToAchieveIfc === settings?.daysToAchieveIfc}
                data-testid="button-save-days-to-achieve-ifc"
              >
                {saveDaysToAchieveIfcMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Number of days required to complete drafting work from start to reaching IFC stage. This defines the drafting window for scheduling resources.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="productionDaysInAdvance">Production Days in Advance of Site</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={90}
                value={productionDaysInAdvance}
                onChange={(e) => setProductionDaysInAdvance(parseInt(e.target.value) || 10)}
                className="w-24"
                data-testid="input-production-days-in-advance"
              />
              <span className="text-muted-foreground">days before site delivery</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveProductionDaysInAdvanceMutation.mutate(productionDaysInAdvance)}
                disabled={saveProductionDaysInAdvanceMutation.isPending || productionDaysInAdvance === settings?.productionDaysInAdvance}
                data-testid="button-save-production-days-in-advance"
              >
                {saveProductionDaysInAdvanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Number of days before panels need to be delivered to site that production should complete. This is used for production scheduling.
            </p>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="procurementDaysInAdvance">Procurement Days in Advance</Label>
            <div className="flex items-center gap-4 flex-wrap">
              <Input
                type="number"
                min={1}
                max={ifcDaysInAdvance - 1}
                value={procurementDaysInAdvance}
                onChange={(e) => setProcurementDaysInAdvance(parseInt(e.target.value) || 7)}
                className="w-24"
                data-testid="input-procurement-days-in-advance"
              />
              <span className="text-muted-foreground">days before production</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveProcurementDaysInAdvanceMutation.mutate(procurementDaysInAdvance)}
                disabled={saveProcurementDaysInAdvanceMutation.isPending || procurementDaysInAdvance === settings?.procurementDaysInAdvance || procurementDaysInAdvance >= ifcDaysInAdvance}
                data-testid="button-save-procurement-days-in-advance"
              >
                {saveProcurementDaysInAdvanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
            {procurementDaysInAdvance >= ifcDaysInAdvance && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Must be less than IFC Days in Advance ({ifcDaysInAdvance}) - procurement occurs after IFC date
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Number of days before production when procurement orders should be issued. Must be less than IFC days to ensure procurement happens after IFC date is achieved.
            </p>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="procurementTimeDays">Procurement Time (Days)</Label>
            <div className="flex items-center gap-4 flex-wrap">
              <Input
                type="number"
                min={1}
                max={90}
                value={procurementTimeDays}
                onChange={(e) => setProcurementTimeDays(parseInt(e.target.value) || 14)}
                className="w-24"
                data-testid="input-procurement-time-days"
              />
              <span className="text-muted-foreground">days for procurement</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveProcurementTimeDaysMutation.mutate(procurementTimeDays)}
                disabled={saveProcurementTimeDaysMutation.isPending || procurementTimeDays === settings?.procurementTimeDays}
                data-testid="button-save-procurement-time-days"
              >
                {saveProcurementTimeDaysMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Number of days required to complete procurement from order placement to delivery. This defines the procurement window for scheduling.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Work Days Settings
          </CardTitle>
          <CardDescription>
            Configure work days for production and drafting staff
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Production Staff Work Days</Label>
            <div className="flex flex-wrap gap-4">
              {dayNames.map((day, index) => (
                <div key={`production-${day}`} className="flex items-center gap-2">
                  <Checkbox
                    id={`production-day-${index}`}
                    checked={productionWorkDays[index]}
                    onCheckedChange={(checked) => {
                      const newDays = [...productionWorkDays];
                      newDays[index] = !!checked;
                      setProductionWorkDays(newDays);
                    }}
                    data-testid={`checkbox-production-${day.toLowerCase()}`}
                  />
                  <Label htmlFor={`production-day-${index}`} className="text-sm font-normal cursor-pointer">
                    {day}
                  </Label>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => saveProductionWorkDaysMutation.mutate(productionWorkDays)}
              disabled={saveProductionWorkDaysMutation.isPending || JSON.stringify(productionWorkDays) === JSON.stringify(settings?.productionWorkDays)}
              data-testid="button-save-production-work-days"
            >
              {saveProductionWorkDaysMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Production Days
            </Button>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Label>Drafting Staff Work Days</Label>
            <div className="flex flex-wrap gap-4">
              {dayNames.map((day, index) => (
                <div key={`drafting-${day}`} className="flex items-center gap-2">
                  <Checkbox
                    id={`drafting-day-${index}`}
                    checked={draftingWorkDays[index]}
                    onCheckedChange={(checked) => {
                      const newDays = [...draftingWorkDays];
                      newDays[index] = !!checked;
                      setDraftingWorkDays(newDays);
                    }}
                    data-testid={`checkbox-drafting-${day.toLowerCase()}`}
                  />
                  <Label htmlFor={`drafting-day-${index}`} className="text-sm font-normal cursor-pointer">
                    {day}
                  </Label>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => saveDraftingWorkDaysMutation.mutate(draftingWorkDays)}
              disabled={saveDraftingWorkDaysMutation.isPending || JSON.stringify(draftingWorkDays) === JSON.stringify(settings?.draftingWorkDays)}
              data-testid="button-save-drafting-work-days"
            >
              {saveDraftingWorkDaysMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Drafting Days
            </Button>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Label>CFMEU Calendar</Label>
            <div className="flex items-center gap-4">
              <Select value={cfmeuCalendar} onValueChange={setCfmeuCalendar}>
                <SelectTrigger className="w-[200px]" data-testid="select-cfmeu-calendar">
                  <SelectValue placeholder="Select calendar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="CFMEU_QLD">CFMEU QLD</SelectItem>
                  <SelectItem value="CFMEU_VIC">CFMEU VIC</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveCfmeuCalendarMutation.mutate(cfmeuCalendar)}
                disabled={saveCfmeuCalendarMutation.isPending || cfmeuCalendar === settings?.cfmeuCalendar}
                data-testid="button-save-cfmeu-calendar"
              >
                {saveCfmeuCalendarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Select a CFMEU calendar to exclude public holidays from work day calculations
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">CFMEU Calendar Data</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => syncAllCfmeuCalendarsMutation.mutate()}
                disabled={syncAllCfmeuCalendarsMutation.isPending}
                data-testid="button-sync-all-cfmeu"
              >
                {syncAllCfmeuCalendarsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync All Calendars
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Import RDOs and public holidays from CFMEU websites for accurate work day calculations.
            </p>

            {cfmeuLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { type: "VIC_ONSITE", label: "VIC On-Site (36hr)", description: "Victoria on-site construction RDOs" },
                  { type: "VIC_OFFSITE", label: "VIC Off-Site (38hr)", description: "Victoria off-site/factory RDOs" },
                  { type: "QLD", label: "QLD", description: "Queensland construction RDOs" },
                ].map((cal) => {
                  const summary = cfmeuCalendarData?.summary?.[cal.type];
                  return (
                    <div key={cal.type} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cal.label}</span>
                          {summary && summary.count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              {summary.count} holidays
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{cal.description}</p>
                        {summary && summary.years.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Years: {summary.years.sort().join(", ")}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => syncCfmeuCalendarMutation.mutate(cal.type)}
                        disabled={syncCfmeuCalendarMutation.isPending}
                        data-testid={`button-sync-${cal.type.toLowerCase()}`}
                      >
                        {syncCfmeuCalendarMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {cfmeuCalendarData?.holidays && cfmeuCalendarData.holidays.length > 0 && (
              <details className="pt-4">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  View imported holidays ({cfmeuCalendarData.holidays.length} total)
                </summary>
                <div className="mt-3 max-h-64 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Calendar</th>
                        <th className="text-left p-2">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cfmeuCalendarData.holidays.slice(0, 100).map((h, i) => (
                        <tr key={h.id || i} className="border-t">
                          <td className="p-2">{new Date(h.date).toLocaleDateString()}</td>
                          <td className="p-2">{h.name}</td>
                          <td className="p-2">{h.calendarType}</td>
                          <td className="p-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              h.holidayType === 'PUBLIC_HOLIDAY' 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' 
                                : h.holidayType === 'RDO' 
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                            }`}>
                              {h.holidayType}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cfmeuCalendarData.holidays.length > 100 && (
                    <p className="text-xs text-muted-foreground p-2 text-center border-t">
                      Showing first 100 of {cfmeuCalendarData.holidays.length} holidays
                    </p>
                  )}
                </div>
              </details>
            )}
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Timezone & Locale
              </CardTitle>
              <CardDescription>
                Configure the default timezone for all time calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="tz"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Australia/Melbourne" data-testid="input-timezone" />
                    </FormControl>
                    <FormDescription>
                      IANA timezone identifier (e.g., Australia/Melbourne)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Capture Settings
              </CardTitle>
              <CardDescription>
                Configure how the Windows Agent captures time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="captureIntervalS"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capture Interval (seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-capture-interval"
                      />
                    </FormControl>
                    <FormDescription>
                      How often the agent captures time blocks (60-900 seconds)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="idleThresholdS"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Idle Threshold (seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-idle-threshold"
                      />
                    </FormControl>
                    <FormDescription>
                      Time without input before marking as idle (60-900 seconds)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trackedApps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tracked Applications</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="revit,acad" data-testid="input-tracked-apps" />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of tracked applications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requireAddins"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Require Add-ins</FormLabel>
                      <FormDescription>
                        Only count time when add-ins provide context data
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-require-addins"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </form>
      </Form>

      {/* Data Management Section */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Delete data from the system. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showDeletePanel ? (
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeletePanel(true);
                setTimeout(() => refetchCounts(), 100);
              }}
              data-testid="button-show-delete-panel"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Data
            </Button>
          ) : (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Deleting data is permanent and cannot be undone. Please review your selections carefully.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {deletionCategories.map((category) => {
                  const count = dataCounts?.[category.key] ?? 0;
                  return (
                    <div
                      key={category.key}
                      className="flex items-start space-x-3 rounded-lg border p-3"
                    >
                      <Checkbox
                        id={`delete-${category.key}`}
                        checked={selectedCategories.has(category.key)}
                        onCheckedChange={(checked) =>
                          handleCategoryToggle(category.key, checked === true)
                        }
                        disabled={count === 0}
                        data-testid={`checkbox-delete-${category.key}`}
                      />
                      <div className="flex-1 space-y-1">
                        <Label
                          htmlFor={`delete-${category.key}`}
                          className={`font-medium ${count === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {category.label}
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({count} records)
                          </span>
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {validationResult && !validationResult.valid && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validation Errors</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-2 space-y-1">
                      {validationResult.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validationResult && validationResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warnings</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-2 space-y-1">
                      {validationResult.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeletePanel(false);
                    setSelectedCategories(new Set());
                    setValidationResult(null);
                  }}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleValidateAndDelete}
                  disabled={selectedCategories.size === 0 || validateDeletionMutation.isPending}
                  data-testid="button-validate-delete"
                >
                  {validateDeletionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Selected Data
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the selected data? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium mb-2">You are about to delete:</p>
            <ul className="list-disc pl-6 space-y-1">
              {Array.from(selectedCategories).map((key) => {
                const category = deletionCategories.find((c) => c.key === key);
                const count = dataCounts?.[key] ?? 0;
                return (
                  <li key={key}>
                    {category?.label} ({count} records)
                  </li>
                );
              })}
            </ul>
            {validationResult && validationResult.warnings.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-amber-600 mb-1">Warnings:</p>
                <ul className="list-disc pl-6 text-sm text-muted-foreground">
                  {validationResult.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              data-testid="button-cancel-confirm"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={performDeletionMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {performDeletionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Yes, Delete Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
