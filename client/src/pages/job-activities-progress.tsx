import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle, Pause, SkipForward, ArrowRight, CircleDot } from "lucide-react";
import { startOfDay, isBefore, format } from "date-fns";
import type { ActivityStage, JobActivity } from "@shared/schema";

type ActivityWithAssignees = JobActivity & {
  assignees?: Array<{ id: string; activityId: string; userId: string }>;
};

const STAGE_COLORS = [
  { bg: "bg-blue-500", border: "border-blue-500", light: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-emerald-500", border: "border-emerald-500", light: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-violet-500", border: "border-violet-500", light: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-amber-500", border: "border-amber-500", light: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-rose-500", border: "border-rose-500", light: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-cyan-500", border: "border-cyan-500", light: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-orange-500", border: "border-orange-500", light: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-teal-500", border: "border-teal-500", light: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-pink-500", border: "border-pink-500", light: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-indigo-500", border: "border-indigo-500", light: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-300" },
];

function isOverdue(activity: ActivityWithAssignees): boolean {
  if (activity.status === "DONE" || activity.status === "SKIPPED") return false;
  if (!activity.endDate) return false;
  const today = startOfDay(new Date());
  const endDate = startOfDay(new Date(activity.endDate));
  return isBefore(endDate, today);
}

function getActivityColor(activity: ActivityWithAssignees) {
  if (activity.status === "DONE") return {
    bg: "bg-green-500 dark:bg-green-600",
    border: "border-green-600 dark:border-green-500",
    text: "text-white",
    glow: "shadow-green-500/20",
    icon: CheckCircle,
    label: "Done",
  };
  if (activity.status === "SKIPPED") return {
    bg: "bg-gray-400 dark:bg-gray-600",
    border: "border-gray-500 dark:border-gray-500",
    text: "text-white",
    glow: "",
    icon: SkipForward,
    label: "Skipped",
  };
  if (isOverdue(activity)) return {
    bg: "bg-red-500 dark:bg-red-600",
    border: "border-red-600 dark:border-red-500",
    text: "text-white",
    glow: "shadow-red-500/30",
    icon: AlertTriangle,
    label: "Overdue",
  };
  if (activity.status === "STUCK") return {
    bg: "bg-red-400 dark:bg-red-500",
    border: "border-red-500 dark:border-red-400",
    text: "text-white",
    glow: "shadow-red-400/20",
    icon: AlertTriangle,
    label: "Stuck",
  };
  if (activity.status === "ON_HOLD") return {
    bg: "bg-yellow-500 dark:bg-yellow-600",
    border: "border-yellow-600 dark:border-yellow-500",
    text: "text-white",
    glow: "shadow-yellow-500/20",
    icon: Pause,
    label: "On Hold",
  };
  if (activity.status === "IN_PROGRESS") return {
    bg: "bg-blue-500 dark:bg-blue-600",
    border: "border-blue-600 dark:border-blue-500",
    text: "text-white",
    glow: "shadow-blue-500/30",
    icon: Clock,
    label: "In Progress",
  };
  return {
    bg: "bg-muted",
    border: "border-border",
    text: "text-muted-foreground",
    glow: "",
    icon: CircleDot,
    label: "Not Started",
  };
}

function getStageProgress(activities: ActivityWithAssignees[]) {
  if (activities.length === 0) return { done: 0, total: 0, pct: 0, hasOverdue: false, allDone: false };
  const done = activities.filter(a => a.status === "DONE" || a.status === "SKIPPED").length;
  const hasOverdue = activities.some(a => isOverdue(a));
  return { done, total: activities.length, pct: Math.round((done / activities.length) * 100), hasOverdue, allDone: done === activities.length };
}

interface ProgressFlowChartProps {
  activities: ActivityWithAssignees[];
  stages: ActivityStage[];
  stageColorMap: Map<string, number>;
  onSelectActivity: (activity: ActivityWithAssignees) => void;
}

export function ProgressFlowChart({
  activities,
  stages,
  stageColorMap,
  onSelectActivity,
}: ProgressFlowChartProps) {
  const parentActivities = useMemo(() => activities.filter(a => !a.parentId), [activities]);

  const activitiesByStage = useMemo(() => {
    const m = new Map<string, ActivityWithAssignees[]>();
    parentActivities.forEach(a => {
      const stageId = a.stageId || "ungrouped";
      const list = m.get(stageId) || [];
      list.push(a);
      m.set(stageId, list);
    });
    return m;
  }, [parentActivities]);

  const orderedStageIds = useMemo(() => {
    if (!stages.length) return Array.from(activitiesByStage.keys());
    const stageOrder = stages.map(s => s.id);
    const keys = Array.from(activitiesByStage.keys());
    return keys.sort((a, b) => {
      const ai = stageOrder.indexOf(a);
      const bi = stageOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [stages, activitiesByStage]);

  const stageMap = useMemo(() => {
    const m = new Map<string, ActivityStage>();
    stages.forEach(s => m.set(s.id, s));
    return m;
  }, [stages]);

  if (parentActivities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-activities">
        No activities to display
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="progress-flow-chart">
      <div className="flex items-center gap-4 flex-wrap px-1 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-sm bg-green-500" /> Done
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-sm bg-blue-500" /> In Progress
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-sm bg-red-500" /> Overdue / Stuck
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-sm bg-yellow-500" /> On Hold
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-sm bg-muted border border-border" /> Not Started
        </div>
      </div>

      {orderedStageIds.map((stageId, stageIndex) => {
        const stage = stageMap.get(stageId);
        const stageActivities = activitiesByStage.get(stageId) || [];
        const colorIdx = (stageColorMap.get(stageId) ?? stageIndex) % STAGE_COLORS.length;
        const stageColor = STAGE_COLORS[colorIdx];
        const progress = getStageProgress(stageActivities);
        const sortedActivities = [...stageActivities].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        return (
          <div key={stageId} className="relative" data-testid={`stage-flow-${stageId}`}>
            {stageIndex > 0 && (
              <div className="flex justify-center py-1">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-3 bg-border" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
              </div>
            )}

            <Card data-testid={`card-stage-${stageId}`}>
              <div className={cn("px-4 py-3 flex items-center justify-between gap-3 flex-wrap", stageColor.light, "rounded-t-md")}>
                <div className="flex items-center gap-3">
                  <div className={cn("flex items-center justify-center w-8 h-8 rounded-md text-white font-bold text-sm", stageColor.bg)}>
                    {stageIndex + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{stage?.name || "Ungrouped"}</h3>
                    <p className="text-xs text-muted-foreground">{progress.done}/{progress.total} complete</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {progress.hasOverdue && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Overdue
                    </Badge>
                  )}
                  {progress.allDone && (
                    <Badge className="bg-green-500 text-white text-xs no-default-hover-elevate">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                  <div className="w-24 bg-muted rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all",
                        progress.hasOverdue ? "bg-red-500" : progress.allDone ? "bg-green-500" : "bg-blue-500"
                      )}
                      style={{ width: `${progress.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground w-8">{progress.pct}%</span>
                </div>
              </div>

              <CardContent className="p-3">
                <div className="flex items-stretch gap-2 flex-wrap">
                  {sortedActivities.map((activity, actIdx) => {
                    const color = getActivityColor(activity);
                    const Icon = color.icon;
                    return (
                      <div key={activity.id} className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectActivity(activity)}
                          className={cn(
                            "flex flex-col items-start gap-1 rounded-md px-3 py-2 min-w-[140px] max-w-[200px] transition-colors cursor-pointer",
                            color.bg, color.text,
                            color.glow && `shadow-md ${color.glow}`,
                            "hover-elevate active-elevate-2"
                          )}
                          data-testid={`activity-node-${activity.id}`}
                        >
                          <div className="flex items-center gap-1.5 w-full">
                            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-xs font-semibold truncate flex-1 text-left">{activity.name}</span>
                          </div>
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="text-[10px] opacity-80">{color.label}</span>
                            {activity.estimatedDays && (
                              <span className="text-[10px] opacity-70">{activity.estimatedDays}d</span>
                            )}
                          </div>
                          {activity.endDate && (
                            <span className="text-[10px] opacity-70">
                              {format(new Date(activity.endDate), "dd MMM yyyy")}
                            </span>
                          )}
                        </button>
                        {actIdx < sortedActivities.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}