import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PM_CALL_LOGS_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  User,
  Calendar,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface CallLogSummary {
  id: string;
  jobId: string;
  jobName: string | null;
  contactName: string;
  contactPhone: string | null;
  callDateTime: string;
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
  createdByName: string | null;
  createdAt: string;
}

export default function MobilePmCallLogsPage() {
  const [, navigate] = useLocation();
  const [jobFilter, setJobFilter] = useState<string>("all");

  const { data: jobs } = useQuery<{ id: string; name: string }[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: callLogs, isLoading } = useQuery<CallLogSummary[]>({
    queryKey: [PM_CALL_LOGS_ROUTES.LIST, jobFilter],
    queryFn: async () => {
      const url =
        jobFilter && jobFilter !== "all"
          ? `${PM_CALL_LOGS_ROUTES.LIST}?jobId=${jobFilter}`
          : PM_CALL_LOGS_ROUTES.LIST;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const hasIssues = (log: CallLogSummary) =>
    log.draftingConcerns ||
    log.clientDesignChanges ||
    log.issuesReported ||
    log.installationProblems;

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
    });
  };

  const formatTime = (d: string) => {
    return new Date(d).toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div
        className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-call-logs-title">
              PM Call Logs
            </div>
            <div className="text-sm text-white/60">
              {callLogs?.length ?? 0}{" "}
              {(callLogs?.length ?? 0) === 1 ? "log" : "logs"}
            </div>
          </div>
          <Button
            size="icon"
            className="rounded-full bg-blue-600 text-white border-blue-600"
            onClick={() => navigate("/mobile/pm-call-logs/new")}
            data-testid="button-new-call-log"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-white/10">
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger
            className="bg-white/5 border-white/10 text-white"
            data-testid="select-job-filter"
          >
            <SelectValue placeholder="Filter by job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs?.map((job) => (
              <SelectItem key={job.id} value={job.id}>
                {job.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-white/5" />
            ))}
          </div>
        ) : !callLogs?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-4">
              <Phone className="h-8 w-8 text-white/30" />
            </div>
            <p className="text-lg font-semibold text-white/80">
              No Call Logs Yet
            </p>
            <p className="text-sm text-white/40 mt-1 max-w-[260px]">
              Start recording weekly project calls to track status and schedules.
            </p>
            <Button
              className="mt-6 bg-blue-600 text-white border-blue-600"
              onClick={() => navigate("/mobile/pm-call-logs/new")}
              data-testid="button-empty-new-call"
            >
              <Plus className="h-4 w-4 mr-2" />
              Record First Call
            </Button>
          </div>
        ) : (
          callLogs.map((log) => (
            <button
              key={log.id}
              className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99]"
              onClick={() => navigate(`/mobile/pm-call-logs/${log.id}`)}
              data-testid={`card-call-log-${log.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {log.jobName || "Unknown Job"}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                    <User className="h-3 w-3" />
                    <span className="truncate">{log.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDate(log.callDateTime)} at{" "}
                      {formatTime(log.callDateTime)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {hasIssues(log) && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      Issues
                    </Badge>
                  )}
                  {(log.notifyManager || log.notifyClient || log.notifyProduction) && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] no-default-hover-elevate no-default-active-elevate">
                      Notified
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-white/30 mt-1" />
                </div>
              </div>
              {log.createdByName && (
                <div className="text-[10px] text-white/30 mt-2">
                  by {log.createdByName}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
