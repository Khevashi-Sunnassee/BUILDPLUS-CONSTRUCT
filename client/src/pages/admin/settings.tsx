import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Clock, Save, Loader2, Globe, Upload, Image, Trash2, Building2, Calendar, Factory, AlertTriangle, Database } from "lucide-react";
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
    queryKey: ["/api/admin/settings"],
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
  }, [settings?.companyName, settings?.weekStartDay, settings?.productionWindowDays, settings?.ifcDaysInAdvance, settings?.daysToAchieveIfc]);

  const saveCompanyNameMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/admin/settings/company-name", { companyName: name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/logo"] });
      toast({ title: "Company name saved" });
    },
    onError: () => {
      toast({ title: "Failed to save company name", variant: "destructive" });
    },
  });

  const saveWeekStartDayMutation = useMutation({
    mutationFn: async (day: number) => {
      return apiRequest("PUT", "/api/admin/settings", { weekStartDay: day });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Week start day saved" });
    },
    onError: () => {
      toast({ title: "Failed to save week start day", variant: "destructive" });
    },
  });

  const saveProductionWindowDaysMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", "/api/admin/settings", { productionWindowDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Production window days saved" });
    },
    onError: () => {
      toast({ title: "Failed to save production window days", variant: "destructive" });
    },
  });

  const saveIfcDaysInAdvanceMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", "/api/admin/settings", { ifcDaysInAdvance: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "IFC days in advance saved" });
    },
    onError: () => {
      toast({ title: "Failed to save IFC days in advance", variant: "destructive" });
    },
  });

  const saveDaysToAchieveIfcMutation = useMutation({
    mutationFn: async (days: number) => {
      return apiRequest("PUT", "/api/admin/settings", { daysToAchieveIfc: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Days to achieve IFC saved" });
    },
    onError: () => {
      toast({ title: "Failed to save days to achieve IFC", variant: "destructive" });
    },
  });

  const { data: dataCounts, refetch: refetchCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/admin/data-deletion/counts"],
    enabled: showDeletePanel,
  });

  const validateDeletionMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const response = await apiRequest("POST", "/api/admin/data-deletion/validate", { categories });
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
      const response = await apiRequest("POST", "/api/admin/data-deletion/delete", { categories });
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
      return apiRequest("POST", "/api/admin/settings/logo", { logoBase64 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/logo"] });
      toast({ title: "Logo uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/settings/logo", { logoBase64: "" });
    },
    onSuccess: () => {
      setLogoPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/logo"] });
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
      return apiRequest("PUT", "/api/admin/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
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
              onClick={() => setShowDeletePanel(true)}
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
