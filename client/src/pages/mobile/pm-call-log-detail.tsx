import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { PM_CALL_LOGS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  Send,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface CallLogDetail {
  id: string;
  jobId: string;
  jobName: string | null;
  contactName: string;
  contactPhone: string | null;
  callDateTime: string;
  deliveryTime: string | null;
  nextDeliveryDate: string | null;
  draftingConcerns: string | null;
  clientDesignChanges: string | null;
  issuesReported: string | null;
  installationProblems: string | null;
  notes: string | null;
  notifyManager: boolean;
  notifyClient: boolean;
  notifyProduction: boolean;
  updateProductionSchedule: boolean;
  updateDraftingSchedule: boolean;
  notificationEmails: string | null;
  notificationPhone: string | null;
  notificationResults: Array<{
    channel: string;
    to: string;
    success: boolean;
    error?: string;
    messageId?: string;
  }> | null;
  createdByName: string | null;
  createdAt: string;
  levels: {
    id: string;
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
  }[];
}

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

export default function MobilePmCallLogDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();

  const { data: log, isLoading } = useQuery<CallLogDetail>({
    queryKey: [PM_CALL_LOGS_ROUTES.LIST, params.id],
    queryFn: async () => {
      const res = await fetch(PM_CALL_LOGS_ROUTES.BY_ID(params.id!), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!params.id,
  });

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-[#070B12] text-white">
        <div className="px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-48 bg-white/5" />
          <Skeleton className="h-32 w-full bg-white/5" />
          <Skeleton className="h-48 w-full bg-white/5" />
        </div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="flex flex-col h-screen bg-[#070B12] text-white items-center justify-center">
        <p className="text-white/50">Call log not found.</p>
        <Button
          variant="outline"
          className="mt-4 border-white/10 text-white"
          onClick={() => navigate("/mobile/pm-call-logs")}
          data-testid="button-back-not-found"
        >
          Back to Call Logs
        </Button>
      </div>
    );
  }

  const lateCount = log.levels.filter((l) => l.status === "LATE").length;
  const onTimeCount = log.levels.filter((l) => l.status === "ON_TIME").length;

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
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
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold truncate" data-testid="text-detail-title">
              {log.jobName || "Call Log"}
            </div>
            <div className="text-xs text-white/50">
              {new Date(log.callDateTime).toLocaleString("en-AU", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/50">
            <User className="h-3.5 w-3.5" />
            Call Details
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">
                Contact
              </p>
              <p className="text-sm font-medium text-white" data-testid="text-contact-name">
                {log.contactName}
              </p>
            </div>
            {log.contactPhone && (
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">
                  Phone
                </p>
                <p className="text-sm text-white">{log.contactPhone}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">
                Recorded By
              </p>
              <p className="text-sm text-white">
                {log.createdByName || "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">
                Created
              </p>
              <p className="text-sm text-white">{formatDate(log.createdAt)}</p>
            </div>
          </div>
        </div>

        {log.levels.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-medium text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                Pour Schedule
              </div>
              <div className="flex gap-1.5">
                {onTimeCount > 0 && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                    {onTimeCount} On Time
                  </Badge>
                )}
                {lateCount > 0 && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                    {lateCount} Late
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {log.levels.map((lvl, idx) => (
                <div
                  key={lvl.id}
                  className="py-2 border-b border-white/5 last:border-0"
                  data-testid={`row-level-${idx}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">
                      {formatLevelDisplay(
                        lvl.level,
                        lvl.pourLabel,
                        lvl.buildingNumber
                      )}
                    </span>
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
                  <div className="text-[10px] text-white/30 mt-1 flex flex-wrap gap-2">
                    <span>
                      {formatDate(lvl.originalStartDate)} —{" "}
                      {formatDate(lvl.originalEndDate)}
                    </span>
                    {lvl.status === "LATE" && lvl.adjustedStartDate && (
                      <span className="text-red-400">
                        New: {formatDate(lvl.adjustedStartDate)} —{" "}
                        {formatDate(lvl.adjustedEndDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(log.deliveryTime || log.nextDeliveryDate) && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-white/50">
              <Truck className="h-3.5 w-3.5" />
              Logistics
            </div>
            {log.deliveryTime && (
              <div>
                <p className="text-[10px] text-white/40">Delivery Time</p>
                <p className="text-sm text-white">{log.deliveryTime}</p>
              </div>
            )}
            {log.nextDeliveryDate && (
              <div>
                <p className="text-[10px] text-white/40">Next Delivery Date</p>
                <p className="text-sm text-white">
                  {formatDate(log.nextDeliveryDate)}
                </p>
              </div>
            )}
          </div>
        )}

        {(log.draftingConcerns ||
          log.clientDesignChanges ||
          log.issuesReported ||
          log.installationProblems ||
          log.notes) && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-white/50">
              <AlertTriangle className="h-3.5 w-3.5" />
              Concerns & Issues
            </div>
            {log.draftingConcerns && (
              <div>
                <p className="text-[10px] text-white/40">Drafting Concerns</p>
                <p className="text-sm text-white/80">{log.draftingConcerns}</p>
              </div>
            )}
            {log.clientDesignChanges && (
              <div>
                <p className="text-[10px] text-white/40">
                  Client Design Changes
                </p>
                <p className="text-sm text-white/80">
                  {log.clientDesignChanges}
                </p>
              </div>
            )}
            {log.issuesReported && (
              <div>
                <p className="text-[10px] text-white/40">Issues Reported</p>
                <p className="text-sm text-white/80">{log.issuesReported}</p>
              </div>
            )}
            {log.installationProblems && (
              <div>
                <p className="text-[10px] text-white/40">
                  Installation Problems
                </p>
                <p className="text-sm text-white/80">
                  {log.installationProblems}
                </p>
              </div>
            )}
            {log.notes && (
              <div>
                <p className="text-[10px] text-white/40">Notes</p>
                <p className="text-sm text-white/80">{log.notes}</p>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/50">
            <Send className="h-3.5 w-3.5" />
            Actions Taken
          </div>
          <div className="flex flex-wrap gap-2">
            {log.updateProductionSchedule && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                Production Updated
              </Badge>
            )}
            {log.updateDraftingSchedule && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                Drafting Updated
              </Badge>
            )}
            {log.notifyManager && (
              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                Manager
              </Badge>
            )}
            {log.notifyClient && (
              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                Client
              </Badge>
            )}
            {log.notifyProduction && (
              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                Production
              </Badge>
            )}
            {!log.updateProductionSchedule &&
              !log.updateDraftingSchedule &&
              !log.notifyManager &&
              !log.notifyClient &&
              !log.notifyProduction && (
                <span className="text-xs text-white/40">
                  No actions triggered
                </span>
              )}
          </div>

          {log.notificationResults && log.notificationResults.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <p className="text-[10px] text-white/40">Delivery Results</p>
              {log.notificationResults.map((nr, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Badge
                    className={
                      nr.success
                        ? "bg-green-500/20 text-green-400 border-green-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate"
                        : "bg-red-500/20 text-red-400 border-red-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate"
                    }
                  >
                    {nr.channel === "email" ? "Email" : "SMS"}
                  </Badge>
                  <span className="text-xs text-white/50 truncate flex-1">
                    {nr.to}
                  </span>
                  {nr.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  ) : (
                    <span className="text-[10px] text-red-400 shrink-0">
                      {nr.error || "Failed"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
