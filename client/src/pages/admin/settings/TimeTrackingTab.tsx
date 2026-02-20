import { Save, Loader2, Globe, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import type { UseMutationResult } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface SettingsFormData {
  tz: string;
  captureIntervalS: number;
  idleThresholdS: number;
  trackedApps: string;
  requireAddins: boolean;
}

export interface TimeTrackingTabProps {
  form: UseFormReturn<SettingsFormData>;
  onSubmit: (data: SettingsFormData) => void;
  updateMutation: UseMutationResult<any, any, SettingsFormData, any>;
}

export function TimeTrackingTab({ form, onSubmit, updateMutation }: TimeTrackingTabProps) {
  return (
    <TabsContent value="time-tracking" className="space-y-6">
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
                  <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
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
    </TabsContent>
  );
}
