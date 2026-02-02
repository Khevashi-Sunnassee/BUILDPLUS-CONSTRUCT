import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Clock, Save, Loader2, Globe, Upload, Image, Trash2 } from "lucide-react";
import defaultLogo from "@assets/LTE_STRUCTURE_LOGO_1769926222936.png";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

  const { data: settings, isLoading } = useQuery<GlobalSettings>({
    queryKey: ["/api/admin/settings"],
  });


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

    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
      toast({ title: "Logo must be less than 500KB", variant: "destructive" });
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

      {/* Logo Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Company Logo
          </CardTitle>
          <CardDescription>
            Upload your company logo to display in the app and reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                PNG, JPG or SVG. Max 500KB. Displayed in sidebar and reports.
              </p>
            </div>
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
    </div>
  );
}
