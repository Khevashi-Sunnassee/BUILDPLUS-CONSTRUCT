import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { dateInputProps } from "@/lib/validation";
import { PM_CALL_LOGS_ROUTES, JOBS_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Truck,
  Send,
  MessageSquare,
  Loader2,
  Construction,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

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
  { id: "job", label: "Job" },
  { id: "schedule", label: "Schedule" },
  { id: "concerns", label: "Issues" },
  { id: "actions", label: "Notify" },
  { id: "review", label: "Review" },
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

export default function MobilePmCallLogFormPage() {
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

  const { data: jobs, isLoading: jobsLoading } = useQuery<
    {
      id: string;
      name: string;
      siteContact?: string | null;
      siteContactPhone?: string | null;
      primaryContact?: string | null;
    }[]
  >({
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

  const hasProgramme = useMemo(() => allLevels && allLevels.length > 0, [allLevels]);

  const selectedJob = useMemo(
    () => jobs?.find((j) => j.id === selectedJobId),
    [jobs, selectedJobId]
  );

  function formatLevelDisplay(
    level: string,
    pourLabel: string | null,
    buildingNumber: number
  ): string {
    const numMatch = level.match(/^L?(\d+)$/i);
    const levelPart = numMatch ? `Level ${numMatch[1]}` : level;
    const pourPart = pourLabel ? ` - Pour ${pourLabel}` : "";
    const buildingPart = buildingNumber > 1 ? `Bldg ${buildingNumber} - ` : "";
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

  const handleLevelStatusChange = (
    idx: number,
    status: "PENDING" | "ON_TIME" | "LATE"
  ) => {
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
      const origStart = lvl.originalStartDate
        ? new Date(lvl.originalStartDate)
        : null;
      const origEnd = lvl.originalEndDate
        ? new Date(lvl.originalEndDate)
        : null;
      updated[idx] = {
        ...lvl,
        daysLate: days,
        adjustedStartDate: origStart
          ? addWorkingDays(origStart, days).toISOString()
          : null,
        adjustedEndDate: origEnd
          ? addWorkingDays(origEnd, days).toISOString()
          : null,
      };
      return updated;
    });
  };

  const hasLateItems = useMemo(() => levelStatuses.some(
    (l) => l.status === "LATE" && l.daysLate > 0
  ), [levelStatuses]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const levelsWithTimes = levelStatuses.filter(
        (l) => l.confirmedTime || l.confirmedDeliveryDate
      );
      const aggregatedDeliveryTime =
        levelsWithTimes
          .map((l) => {
            const label = formatLevelDisplay(
              l.level,
              l.pourLabel,
              l.buildingNumber
            );
            return l.confirmedTime ? `${label}: ${l.confirmedTime}` : null;
          })
          .filter(Boolean)
          .join("; ") || null;
      const latestDeliveryDate =
        levelsWithTimes
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
      navigate("/mobile/pm-call-logs");
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
    return new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Select Job</Label>
              {jobsLoading ? (
                <Skeleton className="h-10 w-full bg-white/5" />
              ) : (
                <Select value={selectedJobId} onValueChange={handleJobSelect}>
                  <SelectTrigger
                    className="bg-white/5 border-white/10 text-white"
                    aria-required="true"
                    data-testid="select-job"
                  >
                    <SelectValue placeholder="Choose a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs?.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedJobId && hasProgramme === false && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400" role="alert" aria-live="assertive" data-testid="text-no-programme-warning">
                      No Job Programme Found
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      A job programme with pour sequence is required before recording a call log.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Contact Name</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Site PM name..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                aria-required="true"
                data-testid="input-contact-name"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Contact Phone</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone number..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                data-testid="input-contact-phone"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Call Date & Time</Label>
              <Input
                type="datetime-local"
                value={callDateTime}
                onChange={(e) => setCallDateTime(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
                aria-required="true"
                data-testid="input-call-datetime"
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-white/50">
                Mark each level as on time or late.
              </p>
            </div>

            {levelsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full bg-white/5" />
                ))}
              </div>
            ) : levelStatuses.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <Calendar className="h-10 w-10 mx-auto text-white/30 mb-3" />
                <p className="text-white/50">
                  No upcoming levels within the next 60 days.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {levelStatuses.map((lvl, idx) => (
                  <div
                    key={lvl.levelCycleTimeId}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    data-testid={`card-level-${idx}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className="font-semibold text-sm text-white"
                        data-testid={`text-level-name-${idx}`}
                      >
                        {formatLevelDisplay(
                          lvl.level,
                          lvl.pourLabel,
                          lvl.buildingNumber
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-white/40 mb-3 flex flex-wrap gap-3">
                      <span>Start: {formatDate(lvl.originalStartDate)}</span>
                      <span>End: {formatDate(lvl.originalEndDate)}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className={
                          lvl.showTimeInfo
                            ? "flex-1 bg-blue-600 text-white border-blue-600 no-default-hover-elevate"
                            : "flex-1 border-white/20 text-white/70"
                        }
                        onClick={() => {
                          setLevelStatuses((prev) => {
                            const updated = [...prev];
                            updated[idx] = {
                              ...updated[idx],
                              showTimeInfo: !updated[idx].showTimeInfo,
                            };
                            return updated;
                          });
                        }}
                        data-testid={`button-confirm-time-${idx}`}
                      >
                        <Truck className="h-3.5 w-3.5 mr-1" />
                        Time
                      </Button>
                      <Button
                        size="sm"
                        variant={lvl.status === "ON_TIME" ? "outline" : "default"}
                        className={
                          lvl.status === "ON_TIME"
                            ? "flex-1 bg-green-600 text-white border-green-600 no-default-hover-elevate"
                            : "flex-1"
                        }
                        onClick={() => handleLevelStatusChange(idx, "ON_TIME")}
                        data-testid={`button-ontime-${idx}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        On Time
                      </Button>
                      <Button
                        size="sm"
                        variant={lvl.status === "LATE" ? "destructive" : "outline"}
                        className={
                          lvl.status !== "LATE"
                            ? "flex-1 border-white/20 text-white/70"
                            : "flex-1"
                        }
                        onClick={() => handleLevelStatusChange(idx, "LATE")}
                        data-testid={`button-late-${idx}`}
                      >
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Late
                      </Button>
                    </div>

                    {lvl.showTimeInfo && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-white/50">
                            Delivery Time
                          </Label>
                          <Input
                            value={lvl.confirmedTime}
                            onChange={(e) => {
                              setLevelStatuses((prev) => {
                                const updated = [...prev];
                                updated[idx] = {
                                  ...updated[idx],
                                  confirmedTime: e.target.value,
                                };
                                return updated;
                              });
                            }}
                            placeholder="e.g. 6:00 AM"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                            data-testid={`input-confirmed-time-${idx}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-white/50">
                            Delivery Date
                          </Label>
                          <Input
                            type="date"
                            {...dateInputProps}
                            value={lvl.confirmedDeliveryDate}
                            onChange={(e) => {
                              setLevelStatuses((prev) => {
                                const updated = [...prev];
                                updated[idx] = {
                                  ...updated[idx],
                                  confirmedDeliveryDate: e.target.value,
                                };
                                return updated;
                              });
                            }}
                            className="bg-white/5 border-white/10 text-white"
                            data-testid={`input-confirmed-delivery-date-${idx}`}
                          />
                        </div>
                      </div>
                    )}

                    {lvl.status === "LATE" && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                        <div className="flex items-center gap-3">
                          <Label className="text-sm text-white/70 whitespace-nowrap">
                            Days Late:
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            step="1"
                            value={lvl.daysLate || ""}
                            onChange={(e) =>
                              handleDaysLateChange(
                                idx,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20 bg-white/5 border-white/10 text-white"
                            data-testid={`input-days-late-${idx}`}
                          />
                        </div>
                        {lvl.daysLate > 0 && lvl.adjustedStartDate && (
                          <div className="rounded-xl bg-red-500/10 p-3 text-xs space-y-1">
                            <p className="font-medium text-red-400">
                              Adjusted Dates:
                            </p>
                            <p className="text-white/60">
                              New Start: {formatDate(lvl.adjustedStartDate)}
                            </p>
                            <p className="text-white/60">
                              New End: {formatDate(lvl.adjustedEndDate)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <p className="text-sm text-white/50">
              Document any concerns or issues raised during the call.
            </p>
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Drafting Concerns</Label>
              <Textarea
                value={draftingConcerns}
                onChange={(e) => setDraftingConcerns(e.target.value)}
                placeholder="Any concerns about drawings..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                data-testid="input-drafting-concerns"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">
                Client Design Changes
              </Label>
              <Textarea
                value={clientDesignChanges}
                onChange={(e) => setClientDesignChanges(e.target.value)}
                placeholder="Design changes requested..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                data-testid="input-client-design-changes"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Issues Reported</Label>
              <Textarea
                value={issuesReported}
                onChange={(e) => setIssuesReported(e.target.value)}
                placeholder="Any issues the client has raised..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                data-testid="input-issues-reported"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">
                Installation Problems
              </Label>
              <Textarea
                value={installationProblems}
                onChange={(e) => setInstallationProblems(e.target.value)}
                placeholder="On-site installation issues..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                data-testid="input-installation-problems"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Additional Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any other notes..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                data-testid="input-notes"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <p className="text-sm text-white/50">
              Choose who to notify and what schedules to update.
            </p>

            {hasLateItems && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Calendar className="h-4 w-4 text-white/60" />
                  Schedule Updates
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="m-updateProduction"
                    checked={updateProductionSchedule}
                    onCheckedChange={(v) => setUpdateProductionSchedule(!!v)}
                    className="border-white/30"
                    data-testid="checkbox-update-production"
                  />
                  <div>
                    <Label
                      htmlFor="m-updateProduction"
                      className="text-sm text-white cursor-pointer"
                    >
                      Update Production Schedule
                    </Label>
                    <p className="text-xs text-white/40 mt-0.5">
                      Adjusts dates based on delays
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="m-updateDrafting"
                    checked={updateDraftingSchedule}
                    onCheckedChange={(v) => setUpdateDraftingSchedule(!!v)}
                    className="border-white/30"
                    data-testid="checkbox-update-drafting"
                  />
                  <div>
                    <Label
                      htmlFor="m-updateDrafting"
                      className="text-sm text-white cursor-pointer"
                    >
                      Update Drafting Schedule
                    </Label>
                    <p className="text-xs text-white/40 mt-0.5">
                      Adjusts drawing due dates
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <MessageSquare className="h-4 w-4 text-white/60" />
                Notifications
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="m-notifyManager"
                  checked={notifyManager}
                  onCheckedChange={(v) => setNotifyManager(!!v)}
                  className="border-white/30"
                  data-testid="checkbox-notify-manager"
                />
                <Label
                  htmlFor="m-notifyManager"
                  className="text-sm text-white cursor-pointer"
                >
                  Notify Manager
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="m-notifyClient"
                  checked={notifyClient}
                  onCheckedChange={(v) => setNotifyClient(!!v)}
                  className="border-white/30"
                  data-testid="checkbox-notify-client"
                />
                <Label
                  htmlFor="m-notifyClient"
                  className="text-sm text-white cursor-pointer"
                >
                  Email Client
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="m-notifyProduction"
                  checked={notifyProduction}
                  onCheckedChange={(v) => setNotifyProduction(!!v)}
                  className="border-white/30"
                  data-testid="checkbox-notify-production"
                />
                <Label
                  htmlFor="m-notifyProduction"
                  className="text-sm text-white cursor-pointer"
                >
                  Notify Production
                </Label>
              </div>
            </div>

            {(notifyManager || notifyClient || notifyProduction) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Send className="h-4 w-4 text-white/60" />
                  Recipients
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">
                    Email Addresses
                  </Label>
                  <Input
                    value={notificationEmails}
                    onChange={(e) => setNotificationEmails(e.target.value)}
                    placeholder="email@example.com"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-notification-emails"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">
                    SMS Phone Number
                  </Label>
                  <Input
                    value={notificationPhone}
                    onChange={(e) => setNotificationPhone(e.target.value)}
                    placeholder="0412 345 678"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-notification-phone"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">
                  Job
                </p>
                <p className="text-sm font-medium text-white" data-testid="text-review-job">
                  {selectedJob?.name}
                </p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">
                    Contact
                  </p>
                  <p className="text-sm text-white" data-testid="text-review-contact">
                    {contactName}
                  </p>
                </div>
                {contactPhone && (
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">
                      Phone
                    </p>
                    <p className="text-sm text-white">{contactPhone}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">
                  Call Date/Time
                </p>
                <p className="text-sm text-white">
                  {new Date(callDateTime).toLocaleString("en-AU")}
                </p>
              </div>
            </div>

            {levelStatuses.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-medium text-white/60 mb-3">
                  Schedule Status
                </p>
                <div className="space-y-2">
                  {levelStatuses.map((lvl, idx) => (
                    <div key={idx} className="flex flex-wrap items-center justify-between gap-2 py-1">
                      <span className="text-sm text-white">
                        {formatLevelDisplay(
                          lvl.level,
                          lvl.pourLabel,
                          lvl.buildingNumber
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {(lvl.confirmedTime || lvl.confirmedDeliveryDate) && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                            <Truck className="h-2.5 w-2.5 mr-0.5" />
                            {lvl.confirmedTime}
                            {lvl.confirmedTime && lvl.confirmedDeliveryDate
                              ? " / "
                              : ""}
                            {lvl.confirmedDeliveryDate
                              ? formatDate(lvl.confirmedDeliveryDate)
                              : ""}
                          </Badge>
                        )}
                        {lvl.status === "PENDING" ? (
                          <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                            Pending
                          </Badge>
                        ) : lvl.status === "ON_TIME" ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                            On Time
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            {lvl.daysLate}d late
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(draftingConcerns ||
              clientDesignChanges ||
              issuesReported ||
              installationProblems ||
              notes) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <p className="text-xs font-medium text-white/60">
                  Concerns & Notes
                </p>
                {draftingConcerns && (
                  <div>
                    <p className="text-[10px] text-white/40">
                      Drafting Concerns
                    </p>
                    <p className="text-sm text-white/80">{draftingConcerns}</p>
                  </div>
                )}
                {clientDesignChanges && (
                  <div>
                    <p className="text-[10px] text-white/40">
                      Client Design Changes
                    </p>
                    <p className="text-sm text-white/80">
                      {clientDesignChanges}
                    </p>
                  </div>
                )}
                {issuesReported && (
                  <div>
                    <p className="text-[10px] text-white/40">Issues Reported</p>
                    <p className="text-sm text-white/80">{issuesReported}</p>
                  </div>
                )}
                {installationProblems && (
                  <div>
                    <p className="text-[10px] text-white/40">
                      Installation Problems
                    </p>
                    <p className="text-sm text-white/80">
                      {installationProblems}
                    </p>
                  </div>
                )}
                {notes && (
                  <div>
                    <p className="text-[10px] text-white/40">Notes</p>
                    <p className="text-sm text-white/80">{notes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium text-white/60 mb-3">Actions</p>
              <div className="flex flex-wrap gap-2">
                {updateProductionSchedule && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                    Production Update
                  </Badge>
                )}
                {updateDraftingSchedule && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                    Drafting Update
                  </Badge>
                )}
                {notifyManager && (
                  <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                    Manager
                  </Badge>
                )}
                {notifyClient && (
                  <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                    Client
                  </Badge>
                )}
                {notifyProduction && (
                  <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                    Production
                  </Badge>
                )}
                {!updateProductionSchedule &&
                  !updateDraftingSchedule &&
                  !notifyManager &&
                  !notifyClient &&
                  !notifyProduction && (
                    <span className="text-xs text-white/40">
                      No actions selected
                    </span>
                  )}
              </div>
              {(notificationEmails || notificationPhone) && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  {notificationEmails && (
                    <div>
                      <p className="text-[10px] text-white/40">Emails</p>
                      <p className="text-xs text-white/70" data-testid="text-review-emails">
                        {notificationEmails}
                      </p>
                    </div>
                  )}
                  {notificationPhone && (
                    <div>
                      <p className="text-[10px] text-white/40">SMS</p>
                      <p className="text-xs text-white/70" data-testid="text-review-phone">
                        {notificationPhone}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile PM Call Log Form">
      <div
        className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white -ml-2"
            onClick={() => navigate("/mobile/pm-call-logs")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1">
            <div className="text-lg font-bold" data-testid="text-form-title">
              New Call Log
            </div>
            <div className="text-xs text-white/50">
              Step {currentStep + 1} of {STEPS.length}
            </div>
          </div>
        </div>

        <div className="flex px-4 pb-3 gap-1.5" data-testid="stepper">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1 w-full rounded-full transition-colors ${
                  idx <= currentStep ? "bg-blue-500" : "bg-white/10"
                }`}
              />
              <span
                className={`text-[9px] ${
                  idx === currentStep
                    ? "text-blue-400 font-medium"
                    : idx < currentStep
                    ? "text-white/50"
                    : "text-white/20"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-40">
        {renderStepContent()}
      </div>

      <div
        className="flex-shrink-0 border-t border-white/10 bg-[#070B12]/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
      >
        <Button
          variant="outline"
          className="border-white/10 text-white"
          onClick={() => goToStep(currentStep - 1)}
          disabled={currentStep === 0}
          data-testid="button-prev-step"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            className="bg-blue-600 text-white border-blue-600 flex-1"
            onClick={() => goToStep(currentStep + 1)}
            disabled={!canProceedFromStep(currentStep)}
            data-testid="button-next-step"
          >
            Next
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="bg-green-600 text-white border-green-600 flex-1"
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
