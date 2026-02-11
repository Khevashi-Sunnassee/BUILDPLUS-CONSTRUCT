import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertTriangle, Pause, SkipForward, ArrowDown, CircleDot, Printer, ClipboardCheck } from "lucide-react";
import { startOfDay, isBefore, format } from "date-fns";
import type { ActivityStage, JobActivity } from "@shared/schema";

type ActivityWithAssignees = JobActivity & {
  assignees?: Array<{ id: string; activityId: string; userId: string }>;
  checklistTotal?: number;
  checklistCompleted?: number;
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

const STATUS_COLORS: Record<string, string> = {
  done: "#22c55e",
  skipped: "#9ca3af",
  overdue: "#ef4444",
  stuck: "#f87171",
  on_hold: "#eab308",
  in_progress: "#3b82f6",
  not_started: "#71717a",
  checklist: "#2563eb",
};

function isOverdue(activity: ActivityWithAssignees): boolean {
  if (activity.status === "DONE" || activity.status === "SKIPPED") return false;
  if (!activity.endDate) return false;
  const today = startOfDay(new Date());
  const endDate = startOfDay(new Date(activity.endDate));
  return isBefore(endDate, today);
}

function hasChecklist(activity: ActivityWithAssignees): boolean {
  return (activity.checklistTotal || 0) > 0;
}

function isChecklistComplete(activity: ActivityWithAssignees): boolean {
  return hasChecklist(activity) && activity.checklistCompleted === activity.checklistTotal;
}

function getActivityColorKey(activity: ActivityWithAssignees): string {
  if (activity.status === "DONE") return "done";
  if (activity.status === "SKIPPED") return "skipped";
  if (isOverdue(activity)) return "overdue";
  if (activity.status === "STUCK") return "stuck";
  if (activity.status === "ON_HOLD") return "on_hold";
  if (hasChecklist(activity) && !isChecklistComplete(activity)) return "checklist";
  if (activity.status === "IN_PROGRESS") return "in_progress";
  return "not_started";
}

function getActivityMeta(activity: ActivityWithAssignees) {
  const key = getActivityColorKey(activity);
  const fill = STATUS_COLORS[key];
  const iconMap: Record<string, typeof CheckCircle> = {
    done: CheckCircle,
    skipped: SkipForward,
    overdue: AlertTriangle,
    stuck: AlertTriangle,
    on_hold: Pause,
    in_progress: Clock,
    not_started: CircleDot,
    checklist: ClipboardCheck,
  };
  const labelMap: Record<string, string> = {
    done: "Done",
    skipped: "Skipped",
    overdue: "Overdue",
    stuck: "Stuck",
    on_hold: "On Hold",
    in_progress: "In Progress",
    not_started: "Not Started",
    checklist: "Checklist",
  };
  return {
    fill,
    isLight: key === "not_started",
    Icon: iconMap[key],
    label: labelMap[key],
  };
}

function getStageProgress(activities: ActivityWithAssignees[]) {
  if (activities.length === 0) return { done: 0, total: 0, pct: 0, hasOverdue: false, allDone: false };
  const done = activities.filter(a => a.status === "DONE" || a.status === "SKIPPED").length;
  const hasOverdue = activities.some(a => isOverdue(a));
  return { done, total: activities.length, pct: Math.round((done / activities.length) * 100), hasOverdue, allDone: done === activities.length };
}

const CHEVRON_W = 160;
const CHEVRON_H = 72;
const CHECKLIST_CHEVRON_W = 130;
const POINT_W = 14;

function ChevronNode({
  activity,
  onClick,
}: {
  activity: ActivityWithAssignees;
  onClick: () => void;
}) {
  const { fill, isLight, label } = getActivityMeta(activity);
  const textColor = isLight ? "currentColor" : "#fff";
  const strokeColor = isLight ? "hsl(var(--border))" : fill;
  const truncatedName = activity.name.length > 16 ? activity.name.slice(0, 15) + "\u2026" : activity.name;

  const points = `0,0 ${CHEVRON_W - POINT_W},0 ${CHEVRON_W},${CHEVRON_H / 2} ${CHEVRON_W - POINT_W},${CHEVRON_H} 0,${CHEVRON_H} ${POINT_W},${CHEVRON_H / 2}`;

  return (
    <svg
      width={CHEVRON_W}
      height={CHEVRON_H}
      viewBox={`0 0 ${CHEVRON_W} ${CHEVRON_H}`}
      className="cursor-pointer flex-shrink-0 chevron-node focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
      onClick={onClick}
      data-testid={`activity-node-${activity.id}`}
      role="button"
      tabIndex={0}
      aria-label={`${activity.name} - ${label}${activity.estimatedDays ? `, ${activity.estimatedDays} days` : ""}${activity.endDate ? `, due ${format(new Date(activity.endDate), "dd MMM yyyy")}` : ""}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <title>{activity.name} - {label}</title>
      <polygon
        points={points}
        fill={isLight ? "hsl(var(--muted))" : fill}
        stroke={strokeColor}
        strokeWidth="1.5"
      />
      <g fill={textColor}>
        <text x={POINT_W + 6} y={18} fontSize="11" fontWeight="600" className="select-none">
          {truncatedName}
        </text>
        <text x={POINT_W + 6} y={34} fontSize="9" opacity="0.85" className="select-none">
          {hasChecklist(activity)
            ? `${activity.checklistCompleted}/${activity.checklistTotal} checked`
            : label}
          {activity.estimatedDays ? `  ${activity.estimatedDays}d` : ""}
        </text>
        {activity.endDate && (
          <text x={POINT_W + 6} y={50} fontSize="9" opacity="0.7" className="select-none">
            {format(new Date(activity.endDate), "dd MMM yyyy")}
          </text>
        )}
      </g>
    </svg>
  );
}

function ChecklistChevronNode({
  activity,
  onClick,
}: {
  activity: ActivityWithAssignees;
  onClick: () => void;
}) {
  const completed = activity.checklistCompleted || 0;
  const total = activity.checklistTotal || 0;
  const allDone = completed === total && total > 0;
  const fill = allDone ? STATUS_COLORS.done : STATUS_COLORS.checklist;
  const label = `${completed}/${total} Complete`;
  const truncatedName = activity.name.length > 12 ? activity.name.slice(0, 11) + "\u2026" : activity.name;

  const points = `0,0 ${CHECKLIST_CHEVRON_W - POINT_W},0 ${CHECKLIST_CHEVRON_W},${CHEVRON_H / 2} ${CHECKLIST_CHEVRON_W - POINT_W},${CHEVRON_H} 0,${CHEVRON_H} ${POINT_W},${CHEVRON_H / 2}`;

  return (
    <svg
      width={CHECKLIST_CHEVRON_W}
      height={CHEVRON_H}
      viewBox={`0 0 ${CHECKLIST_CHEVRON_W} ${CHEVRON_H}`}
      className="cursor-pointer flex-shrink-0 chevron-node focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
      onClick={onClick}
      data-testid={`checklist-node-${activity.id}`}
      role="button"
      tabIndex={0}
      aria-label={`Checklist for ${activity.name} - ${label}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <title>Checklist: {activity.name} - {label}</title>
      <defs>
        <pattern id={`diag-${activity.id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2" height="6" fill="rgba(255,255,255,0.15)" />
        </pattern>
      </defs>
      <polygon
        points={points}
        fill={fill}
        stroke={fill}
        strokeWidth="1.5"
      />
      <polygon
        points={points}
        fill={`url(#diag-${activity.id})`}
      />
      <g fill="#fff">
        <text x={POINT_W + 4} y={17} fontSize="9" opacity="0.85" className="select-none">
          {truncatedName}
        </text>
        <text x={POINT_W + 4} y={33} fontSize="11" fontWeight="600" className="select-none">
          Checklist
        </text>
        <text x={POINT_W + 4} y={49} fontSize="10" opacity="0.85" className="select-none">
          {label}
        </text>
      </g>
    </svg>
  );
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
  const printRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = () => {
    window.print();
  };

  if (parentActivities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="text-no-activities">
        No activities to display
      </div>
    );
  }

  return (
    <div data-testid="progress-flow-chart">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 no-print">
        <div className="flex items-center gap-4 flex-wrap px-1">
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
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS.checklist }} /> Checklist
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded-sm bg-muted border border-border" /> Not Started
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-progress">
          <Printer className="h-4 w-4 mr-1" />
          Print Landscape
        </Button>
      </div>

      <div ref={printRef} className="space-y-2 progress-print-area">
        <div className="hidden print-only-flex items-center gap-4 flex-wrap px-1 mb-3">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS.done }} /> Done
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS.in_progress }} /> In Progress
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS.overdue }} /> Overdue / Stuck
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS.on_hold }} /> On Hold
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS.checklist }} /> Checklist
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm border" style={{ background: "#e5e7eb" }} /> Not Started
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
                  <ArrowDown className="h-4 w-4 text-muted-foreground print:text-gray-500" />
                </div>
              )}

              <Card data-testid={`card-stage-${stageId}`} className="print:border print:border-gray-300 print:shadow-none">
                <div className={cn("px-4 py-3 flex items-center justify-between gap-3 flex-wrap", stageColor.light, "rounded-t-md print:bg-gray-50")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center w-8 h-8 rounded-md text-white font-bold text-sm print:text-black print:bg-gray-300", stageColor.bg)}>
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
                    <div className="w-24 bg-muted rounded-full h-2 print:bg-gray-200">
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
                  <div className="flex items-center gap-0 flex-wrap">
                    {sortedActivities.map((activity) => (
                      <ChevronNode
                        key={activity.id}
                        activity={activity}
                        onClick={() => onSelectActivity(activity)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
