import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PM_CALL_LOGS_ROUTES, JOBS_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Truck,
  FileText,
  MessageSquare,
  Send,
  Loader2,
  Construction,
} from "lucide-react";

interface LevelCycleTime {
  id: string;
  jobId: string;
  buildingNumber: number;
  level: string;
  levelOrder: number;
  pourLabel: string | null;
  sequenceOrder: number;
  cycleDays: number;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  manualStartDate: string | null;
  manualEndDate: string | null;
}

interface LevelStatus {
  levelCycleTimeId: string;
  level: string;
  buildingNumber: number;
  pourLabel: string | null;
  sequenceOrder: number;
  status: "PENDING" | "ON_TIME" | "LATE";
  daysLate: number;
  originalStartDate: string | null;
  originalEndDate: string | null;
  adjustedStartDate: string | null;
  adjustedEndDate: string | null;
  showTimeInfo: boolean;
  confirmedTime: string;
  confirmedDeliveryDate: string;
}

const STEPS = [
  { id: "job", title: "Select Job", icon: Construction },
  { id: "schedule", title: "Pour Schedule Review", icon: Calendar },
  { id: "concerns", title: "Concerns & Issues", icon: AlertTriangle },
  { id: "actions", title: "Actions & Notifications", icon: Send },
  { id: "review", title: "Review & Submit", icon: Check },
];

function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

export default function PmCallLogFormPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);

  const [selectedJobId, setSelectedJobId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [callDateTime, setCallDateTime] = useState(
    new Date().toISOString().slice(0, 16)
  );

  const [levelStatuses, setLevelStatuses] = useState<LevelStatus[]>([]);


  const [draftingConcerns, setDraftingConcerns] = useState("");
  const [clientDesignChanges, setClientDesignChanges] = useState("");
  const [issuesReported, setIssuesReported] = useState("");
  const [installationProblems, setInstallationProblems] = useState("");
  const [notes, setNotes] = useState("");

  const [notifyManager, setNotifyManager] = useState(false);
  const [notifyClient, setNotifyClient] = useState(false);
  const [notifyProduction, setNotifyProduction] = useState(false);
  const [updateProductionSchedule, setUpdateProductionSchedule] = useState(false);
  const [updateDraftingSchedule, setUpdateDraftingSchedule] = useState(false);
  const [notificationEmails, setNotificationEmails] = useState("");
  const [notificationPhone, setNotificationPhone] = useState("");

  const { data: jobs, isLoading: jobsLoading } = useQuery<{ id: string; name: string; siteContact?: string | null; siteContactPhone?: string | null; primaryContact?: string | null }[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: upcomingLevels, isLoading: levelsLoading } = useQuery<LevelCycleTime[]>({
    queryKey: [PM_CALL_LOGS_ROUTES.JOB_UPCOMING_LEVELS(selectedJobId)],
    enabled: !!selectedJobId,
  });

  const { data: allLevels } = useQuery<LevelCycleTime[]>({
    queryKey: [ADMIN_ROUTES.JOB_PROGRAMME(selectedJobId)],
    enabled: !!selectedJobId,
  });

  const hasProgramme = allLevels && allLevels.length > 0;

  const selectedJob = useMemo(
    () => jobs?.find((j) => j.id === selectedJobId),
    [jobs, selectedJobId]
  );

  function formatLevelDisplay(level: string, pourLabel: string | null, buildingNumber: number): string {
    const numMatch = level.match(/^L?(\d+)$/i);
    const levelPart = numMatch ? `Level ${numMatch[1]}` : level;
    const pourPart = pourLabel ? ` - Pour ${pourLabel}` : "";
    const buildingPart = buildingNumber > 1 ? `Building ${buildingNumber} - ` : "";
    return `${buildingPart}${levelPart}${pourPart}`;
  }

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    setLevelStatuses([]);
    const job = jobs?.find((j) => j.id === jobId);
    if (job) {
      setContactName(job.siteContact || job.primaryContact || "");
      setContactPhone(job.siteContactPhone || "");
    }
  };

  const initializeLevelStatuses = () => {
    if (upcomingLevels && levelStatuses.length === 0) {
      setLevelStatuses(
        upcomingLevels.map((lvl) => ({
          levelCycleTimeId: lvl.id,
          level: lvl.level,
          buildingNumber: lvl.buildingNumber,
          pourLabel: lvl.pourLabel,
          sequenceOrder: lvl.sequenceOrder,
          status: "PENDING" as const,
          daysLate: 0,
          originalStartDate: lvl.manualStartDate || lvl.estimatedStartDate,
          originalEndDate: lvl.manualEndDate || lvl.estimatedEndDate,
          adjustedStartDate: null,
          adjustedEndDate: null,
          showTimeInfo: false,
          confirmedTime: "",
          confirmedDeliveryDate: "",
        }))
      );
    }
  };

  const handleLevelStatusChange = (idx: number, status: "PENDING" | "ON_TIME" | "LATE") => {
    setLevelStatuses((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        status,
        daysLate: status === "ON_TIME" ? 0 : updated[idx].daysLate,
        adjustedStartDate: null,
        adjustedEndDate: null,
      };
      return updated;
    });
  };

  const handleDaysLateChange = (idx: number, days: number) => {
    setLevelStatuses((prev) => {
      const updated = [...prev];
      const lvl = updated[idx];
      const origStart = lvl.originalStartDate ? new Date(lvl.originalStartDate) : null;
      const origEnd = lvl.originalEndDate ? new Date(lvl.originalEndDate) : null;
      updated[idx] = {
        ...lvl,
        daysLate: days,
        adjustedStartDate: origStart ? addWorkingDays(origStart, days).toISOString() : null,
        adjustedEndDate: origEnd ? addWorkingDays(origEnd, days).toISOString() : null,
      };
      return updated;
    });
  };

  const hasLateItems = levelStatuses.some((l) => l.status === "LATE" && l.daysLate > 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const levelsWithTimes = levelStatuses.filter((l) => l.confirmedTime || l.confirmedDeliveryDate);
      const aggregatedDeliveryTime = levelsWithTimes
        .map((l) => {
          const label = formatLevelDisplay(l.level, l.pourLabel, l.buildingNumber);
          return l.confirmedTime ? `${label}: ${l.confirmedTime}` : null;
        })
        .filter(Boolean)
        .join("; ") || null;
      const latestDeliveryDate = levelsWithTimes
        .map((l) => l.confirmedDeliveryDate)
        .filter(Boolean)
        .sort()
        .pop() || null;

      return apiRequest("POST", PM_CALL_LOGS_ROUTES.LIST, {
        jobId: selectedJobId,
        contactName,
        contactPhone: contactPhone || null,
        callDateTime,
        deliveryTime: aggregatedDeliveryTime,
        nextDeliveryDate: latestDeliveryDate,
        draftingConcerns: draftingConcerns || null,
        clientDesignChanges: clientDesignChanges || null,
        issuesReported: issuesReported || null,
        installationProblems: installationProblems || null,
        notes: notes || null,
        notifyManager,
        notifyClient,
        notifyProduction,
        updateProductionSchedule: hasLateItems ? updateProductionSchedule : false,
        updateDraftingSchedule: hasLateItems ? updateDraftingSchedule : false,
        notificationEmails: notificationEmails || null,
        notificationPhone: notificationPhone || null,
        levels: levelStatuses,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PM_CALL_LOGS_ROUTES.LIST] });
      toast({ title: "Call log saved successfully" });
      navigate("/pm-call-logs");
    },
    onError: () => {
      toast({ title: "Failed to save call log", variant: "destructive" });
    },
  });

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!selectedJobId && !!contactName && !!callDateTime && hasProgramme === true;
      case 1:
        return levelStatuses.length > 0;
      default:
        return true;
    }
  };

  const goToStep = (step: number) => {
    if (step === 1 && selectedJobId) {
      initializeLevelStatuses();
    }
    setCurrentStep(step);
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="job" data-testid="label-job">Select Job / Project</Label>
              {jobsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedJobId} onValueChange={handleJobSelect}>
                  <SelectTrigger data-testid="select-job">
                    <SelectValue placeholder="Choose a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs?.map((job) => (
                      <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedJobId && hasProgramme === false && (
              <Card className="border-destructive">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive" data-testid="text-no-programme-warning">
                      No Job Programme Found
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This job does not have a production programme set up yet. A job programme with pour 
                      sequence and cycle times is required before you can record a call log.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate(`/admin/jobs/${selectedJobId}/programme`)}
                      data-testid="button-go-to-programme"
                    >
                      Set Up Job Programme
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Site PM name..."
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone number..."
                  data-testid="input-contact-phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="callDateTime">Call Date & Time</Label>
              <Input
                id="callDateTime"
                type="datetime-local"
                value={callDateTime}
                onChange={(e) => setCallDateTime(e.target.value)}
                data-testid="input-call-datetime"
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium" data-testid="text-schedule-title">
                Pour Schedule — Next 60 Days
              </h3>
              <p className="text-sm text-muted-foreground">
                For each level, mark whether the builder reports on time or late. If late, enter how many working days.
              </p>
            </div>

            {levelsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : levelStatuses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No upcoming levels within the next 60 days.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {levelStatuses.map((lvl, idx) => (
                  <Card key={lvl.levelCycleTimeId} data-testid={`card-level-${idx}`}>
                    <CardContent className="p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm" data-testid={`text-level-name-${idx}`}>
                              {formatLevelDisplay(lvl.level, lvl.pourLabel, lvl.buildingNumber)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                            <span>Start: {formatDate(lvl.originalStartDate)}</span>
                            <span>End: {formatDate(lvl.originalEndDate)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={lvl.showTimeInfo ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:border-blue-600 dark:hover:bg-blue-700 no-default-hover-elevate" : ""}
                            onClick={() => {
                              setLevelStatuses((prev) => {
                                const updated = [...prev];
                                updated[idx] = { ...updated[idx], showTimeInfo: !updated[idx].showTimeInfo };
                                return updated;
                              });
                            }}
                            data-testid={`button-confirm-time-${idx}`}
                          >
                            <Truck className="h-3.5 w-3.5 mr-1" />
                            Confirm Time
                          </Button>
                          <Button
                            size="sm"
                            variant={lvl.status === "ON_TIME" ? "outline" : "default"}
                            className={lvl.status === "ON_TIME" ? "bg-green-600 text-white border-green-600 hover:bg-green-700 dark:bg-green-600 dark:text-white dark:border-green-600 dark:hover:bg-green-700 no-default-hover-elevate" : ""}
                            onClick={() => handleLevelStatusChange(idx, "ON_TIME")}
                            data-testid={`button-ontime-${idx}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            On Time
                          </Button>
                          <Button
                            size="sm"
                            variant={lvl.status === "LATE" ? "destructive" : "outline"}
                            onClick={() => handleLevelStatusChange(idx, "LATE")}
                            data-testid={`button-late-${idx}`}
                          >
                            <Clock className="h-3.5 w-3.5 mr-1" />
                            Late
                          </Button>
                        </div>
                      </div>

                      {lvl.showTimeInfo && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Delivery Time</Label>
                              <Input
                                value={lvl.confirmedTime}
                                onChange={(e) => {
                                  setLevelStatuses((prev) => {
                                    const updated = [...prev];
                                    updated[idx] = { ...updated[idx], confirmedTime: e.target.value };
                                    return updated;
                                  });
                                }}
                                placeholder="e.g. 6:00 AM"
                                data-testid={`input-confirmed-time-${idx}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Delivery Date</Label>
                              <Input
                                type="date"
                                value={lvl.confirmedDeliveryDate}
                                onChange={(e) => {
                                  setLevelStatuses((prev) => {
                                    const updated = [...prev];
                                    updated[idx] = { ...updated[idx], confirmedDeliveryDate: e.target.value };
                                    return updated;
                                  });
                                }}
                                data-testid={`input-confirmed-delivery-date-${idx}`}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {lvl.status === "LATE" && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          <div className="flex items-center gap-3">
                            <Label className="text-sm whitespace-nowrap">Days Late:</Label>
                            <Input
                              type="number"
                              min={1}
                              value={lvl.daysLate || ""}
                              onChange={(e) => handleDaysLateChange(idx, parseInt(e.target.value) || 0)}
                              className="w-24"
                              data-testid={`input-days-late-${idx}`}
                            />
                          </div>
                          {lvl.daysLate > 0 && lvl.adjustedStartDate && (
                            <div className="bg-muted/50 rounded-md p-2 text-xs space-y-1">
                              <p className="font-medium text-destructive">Adjusted Dates:</p>
                              <p>New Start: {formatDate(lvl.adjustedStartDate)}</p>
                              <p>New End: {formatDate(lvl.adjustedEndDate)}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium">Concerns & Issues</h3>
              <p className="text-sm text-muted-foreground">Document any concerns or issues raised during the call.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="draftingConcerns">Drafting Concerns</Label>
                <Textarea
                  id="draftingConcerns"
                  value={draftingConcerns}
                  onChange={(e) => setDraftingConcerns(e.target.value)}
                  placeholder="Any concerns about drawings or design..."
                  data-testid="input-drafting-concerns"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientDesignChanges">Client Design Changes</Label>
                <Textarea
                  id="clientDesignChanges"
                  value={clientDesignChanges}
                  onChange={(e) => setClientDesignChanges(e.target.value)}
                  placeholder="Any design changes requested by the client..."
                  data-testid="input-client-design-changes"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuesReported">Issues Reported by Client</Label>
                <Textarea
                  id="issuesReported"
                  value={issuesReported}
                  onChange={(e) => setIssuesReported(e.target.value)}
                  placeholder="Any issues the client has raised..."
                  data-testid="input-issues-reported"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installationProblems">Installation Problems</Label>
                <Textarea
                  id="installationProblems"
                  value={installationProblems}
                  onChange={(e) => setInstallationProblems(e.target.value)}
                  placeholder="Any on-site installation issues..."
                  data-testid="input-installation-problems"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any other notes from the call..."
                  data-testid="input-notes"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium">Actions & Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Select what actions to trigger and who to notify based on this call.
              </p>
            </div>

            {hasLateItems && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule Updates
                  </CardTitle>
                  <CardDescription>
                    Late items were recorded. Choose whether to update the production and drafting schedules.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="updateProduction"
                      checked={updateProductionSchedule}
                      onCheckedChange={(v) => setUpdateProductionSchedule(!!v)}
                      data-testid="checkbox-update-production"
                    />
                    <div>
                      <Label htmlFor="updateProduction" className="font-medium cursor-pointer">
                        Update Production Schedule
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Adjusts production slot dates based on reported delays
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="updateDrafting"
                      checked={updateDraftingSchedule}
                      onCheckedChange={(v) => setUpdateDraftingSchedule(!!v)}
                      data-testid="checkbox-update-drafting"
                    />
                    <div>
                      <Label htmlFor="updateDrafting" className="font-medium cursor-pointer">
                        Update Drafting Schedule
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Adjusts drawing due dates based on new production dates
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Choose who should be notified about this call log.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="notifyManager"
                    checked={notifyManager}
                    onCheckedChange={(v) => setNotifyManager(!!v)}
                    data-testid="checkbox-notify-manager"
                  />
                  <div>
                    <Label htmlFor="notifyManager" className="font-medium cursor-pointer">
                      Notify Manager
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Send a notification to the project manager
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="notifyClient"
                    checked={notifyClient}
                    onCheckedChange={(v) => setNotifyClient(!!v)}
                    data-testid="checkbox-notify-client"
                  />
                  <div>
                    <Label htmlFor="notifyClient" className="font-medium cursor-pointer">
                      Email Client
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Send an email summary to the client contact
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="notifyProduction"
                    checked={notifyProduction}
                    onCheckedChange={(v) => setNotifyProduction(!!v)}
                    data-testid="checkbox-notify-production"
                  />
                  <div>
                    <Label htmlFor="notifyProduction" className="font-medium cursor-pointer">
                      Notify Production
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alert the production team about schedule changes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(notifyManager || notifyClient || notifyProduction) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Notification Recipients
                  </CardTitle>
                  <CardDescription>
                    Enter the email addresses and/or phone numbers to send notifications to.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notificationEmails">Email Addresses</Label>
                    <Input
                      id="notificationEmails"
                      value={notificationEmails}
                      onChange={(e) => setNotificationEmails(e.target.value)}
                      placeholder="email@example.com, another@example.com"
                      data-testid="input-notification-emails"
                    />
                    <p className="text-xs text-muted-foreground">
                      Separate multiple email addresses with commas. A detailed HTML summary will be sent.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notificationPhone">SMS Phone Numbers</Label>
                    <Input
                      id="notificationPhone"
                      value={notificationPhone}
                      onChange={(e) => setNotificationPhone(e.target.value)}
                      placeholder="0412 345 678"
                      data-testid="input-notification-phone"
                    />
                    <p className="text-xs text-muted-foreground">
                      Australian mobile numbers. A text summary will be sent via SMS.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium">Review & Submit</h3>
              <p className="text-sm text-muted-foreground">Review the call log details before saving.</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Job</p>
                    <p className="font-medium" data-testid="text-review-job">{selectedJob?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="font-medium" data-testid="text-review-contact">{contactName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Call Date/Time</p>
                    <p className="font-medium">{new Date(callDateTime).toLocaleString("en-AU")}</p>
                  </div>
                  {contactPhone && (
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{contactPhone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {levelStatuses.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Schedule Status</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2">
                    {levelStatuses.map((lvl, idx) => (
                      <div key={idx} className="text-sm py-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {formatLevelDisplay(lvl.level, lvl.pourLabel, lvl.buildingNumber)}
                          </span>
                          <div className="flex items-center gap-2">
                            {(lvl.confirmedTime || lvl.confirmedDeliveryDate) && (
                              <Badge variant="outline" data-testid={`badge-review-logistics-${idx}`}>
                                <Truck className="h-3 w-3 mr-1" />
                                {lvl.confirmedTime}{lvl.confirmedTime && lvl.confirmedDeliveryDate ? " / " : ""}{lvl.confirmedDeliveryDate ? formatDate(lvl.confirmedDeliveryDate) : ""}
                              </Badge>
                            )}
                            {lvl.status === "PENDING" ? (
                              <Badge variant="outline" data-testid={`badge-review-pending-${idx}`}>
                                Pending
                              </Badge>
                            ) : lvl.status === "ON_TIME" ? (
                              <Badge className="bg-green-600 text-white border-green-600 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-review-ontime-${idx}`}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                On Time
                              </Badge>
                            ) : (
                              <Badge variant="destructive" data-testid={`badge-review-late-${idx}`}>
                                <Clock className="h-3 w-3 mr-1" />
                                {lvl.daysLate} days late
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {(draftingConcerns || clientDesignChanges || issuesReported || installationProblems || notes) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Concerns & Notes</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {draftingConcerns && (
                    <div>
                      <p className="text-xs text-muted-foreground">Drafting Concerns</p>
                      <p className="text-sm">{draftingConcerns}</p>
                    </div>
                  )}
                  {clientDesignChanges && (
                    <div>
                      <p className="text-xs text-muted-foreground">Client Design Changes</p>
                      <p className="text-sm">{clientDesignChanges}</p>
                    </div>
                  )}
                  {issuesReported && (
                    <div>
                      <p className="text-xs text-muted-foreground">Issues Reported</p>
                      <p className="text-sm">{issuesReported}</p>
                    </div>
                  )}
                  {installationProblems && (
                    <div>
                      <p className="text-xs text-muted-foreground">Installation Problems</p>
                      <p className="text-sm">{installationProblems}</p>
                    </div>
                  )}
                  {notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm">{notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  {updateProductionSchedule && <Badge>Production Schedule Update</Badge>}
                  {updateDraftingSchedule && <Badge>Drafting Schedule Update</Badge>}
                  {notifyManager && <Badge variant="secondary">Notify Manager</Badge>}
                  {notifyClient && <Badge variant="secondary">Email Client</Badge>}
                  {notifyProduction && <Badge variant="secondary">Notify Production</Badge>}
                  {!updateProductionSchedule && !updateDraftingSchedule && !notifyManager && !notifyClient && !notifyProduction && (
                    <span className="text-sm text-muted-foreground">No actions selected</span>
                  )}
                </div>
                {(notificationEmails || notificationPhone) && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {notificationEmails && (
                      <div>
                        <p className="text-xs text-muted-foreground">Email Recipients</p>
                        <p className="text-sm font-medium" data-testid="text-review-emails">{notificationEmails}</p>
                      </div>
                    )}
                    {notificationPhone && (
                      <div>
                        <p className="text-xs text-muted-foreground">SMS Recipients</p>
                        <p className="text-sm font-medium" data-testid="text-review-phone">{notificationPhone}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pm-call-logs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-form-title">New PM Call Log</h1>
          <p className="text-sm text-muted-foreground">
            Record a weekly project manager call
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 md:gap-2" data-testid="stepper">
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          return (
            <div key={step.id} className="flex items-center gap-1 md:gap-2">
              {idx > 0 && <Separator orientation="horizontal" className="w-4 md:w-8" />}
              <button
                onClick={() => idx < currentStep && goToStep(idx)}
                disabled={idx > currentStep}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs md:text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                    ? "bg-muted text-foreground cursor-pointer"
                    : "text-muted-foreground"
                }`}
                data-testid={`step-${step.id}`}
              >
                <StepIcon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{step.title}</span>
              </button>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => goToStep(currentStep - 1)}
          disabled={currentStep === 0}
          data-testid="button-prev-step"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={() => goToStep(currentStep + 1)}
            disabled={!canProceedFromStep(currentStep)}
            data-testid="button-next-step"
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            data-testid="button-submit"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Save Call Log
          </Button>
        )}
      </div>
    </div>
  );
}
