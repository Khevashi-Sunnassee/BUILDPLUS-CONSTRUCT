import { Save, Loader2, Calendar, Factory, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { UseMutationResult } from "@tanstack/react-query";
import type { GlobalSettings } from "@shared/schema";

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

export interface SchedulingTabProps {
  settings: GlobalSettings | undefined;
  dayNames: string[];
  weekStartDay: number;
  setWeekStartDay: (v: number) => void;
  saveWeekStartDayMutation: UseMutationResult<any, any, number, any>;
  productionWindowDays: number;
  setProductionWindowDays: (v: number) => void;
  saveProductionWindowDaysMutation: UseMutationResult<any, any, number, any>;
  ifcDaysInAdvance: number;
  setIfcDaysInAdvance: (v: number) => void;
  saveIfcDaysInAdvanceMutation: UseMutationResult<any, any, number, any>;
  daysToAchieveIfc: number;
  setDaysToAchieveIfc: (v: number) => void;
  saveDaysToAchieveIfcMutation: UseMutationResult<any, any, number, any>;
  productionDaysInAdvance: number;
  setProductionDaysInAdvance: (v: number) => void;
  saveProductionDaysInAdvanceMutation: UseMutationResult<any, any, number, any>;
  procurementDaysInAdvance: number;
  setProcurementDaysInAdvance: (v: number) => void;
  saveProcurementDaysInAdvanceMutation: UseMutationResult<any, any, number, any>;
  procurementTimeDays: number;
  setProcurementTimeDays: (v: number) => void;
  saveProcurementTimeDaysMutation: UseMutationResult<any, any, number, any>;
  productionWorkDays: boolean[];
  setProductionWorkDays: (v: boolean[]) => void;
  saveProductionWorkDaysMutation: UseMutationResult<any, any, boolean[], any>;
  draftingWorkDays: boolean[];
  setDraftingWorkDays: (v: boolean[]) => void;
  saveDraftingWorkDaysMutation: UseMutationResult<any, any, boolean[], any>;
  cfmeuCalendar: string;
  setCfmeuCalendar: (v: string) => void;
  saveCfmeuCalendarMutation: UseMutationResult<any, any, string, any>;
  cfmeuCalendarData: CfmeuCalendarData | undefined;
  cfmeuLoading: boolean;
  syncCfmeuCalendarMutation: UseMutationResult<any, any, string, any>;
  syncAllCfmeuCalendarsMutation: UseMutationResult<any, any, void, any>;
}

export function SchedulingTab({
  settings,
  dayNames,
  weekStartDay,
  setWeekStartDay,
  saveWeekStartDayMutation,
  productionWindowDays,
  setProductionWindowDays,
  saveProductionWindowDaysMutation,
  ifcDaysInAdvance,
  setIfcDaysInAdvance,
  saveIfcDaysInAdvanceMutation,
  daysToAchieveIfc,
  setDaysToAchieveIfc,
  saveDaysToAchieveIfcMutation,
  productionDaysInAdvance,
  setProductionDaysInAdvance,
  saveProductionDaysInAdvanceMutation,
  procurementDaysInAdvance,
  setProcurementDaysInAdvance,
  saveProcurementDaysInAdvanceMutation,
  procurementTimeDays,
  setProcurementTimeDays,
  saveProcurementTimeDaysMutation,
  productionWorkDays,
  setProductionWorkDays,
  saveProductionWorkDaysMutation,
  draftingWorkDays,
  setDraftingWorkDays,
  saveDraftingWorkDaysMutation,
  cfmeuCalendar,
  setCfmeuCalendar,
  saveCfmeuCalendarMutation,
  cfmeuCalendarData,
  cfmeuLoading,
  syncCfmeuCalendarMutation,
  syncAllCfmeuCalendarsMutation,
}: SchedulingTabProps) {
  return (
    <TabsContent value="scheduling" className="space-y-6">
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
                step="1"
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
                step="1"
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
                step="1"
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
                step="1"
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
                step="1"
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
              Number of days before production when procurement orders should be issued. Must be less than IFC days to ensure procurement happens after IFC date.
            </p>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="procurementTimeDays">Procurement Time (Days)</Label>
            <div className="flex items-center gap-4 flex-wrap">
              <Input
                type="number"
                min={1}
                max={90}
                step="1"
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
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
                    <div key={cal.type} className="flex items-center justify-between gap-4 p-3 border rounded-lg flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cal.label}</span>
                          {summary && summary.count > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {summary.count} holidays
                            </Badge>
                          )}
                          {(!summary || summary.count === 0) && (
                            <span className="text-xs text-muted-foreground">
                              Not synced
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
    </TabsContent>
  );
}
