import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { format, differenceInCalendarDays, addDays, startOfDay, isWeekend, endOfMonth, eachMonthOfInterval, eachWeekOfInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import type { ActivityStage, JobActivity } from "@shared/schema";

type ActivityWithAssignees = JobActivity & {
  assignees?: Array<{ id: string; activityId: string; userId: string }>;
};

const STAGE_HEX_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#f43f5e",
  "#06b6d4", "#f97316", "#14b8a6", "#ec4899", "#6366f1",
  "#84cc16", "#d946ef",
];

const STATUS_BAR_PATTERNS: Record<string, { opacity: number; pattern?: string }> = {
  NOT_STARTED: { opacity: 0.4 },
  IN_PROGRESS: { opacity: 0.85 },
  STUCK: { opacity: 0.85, pattern: "stuck" },
  DONE: { opacity: 1.0 },
  ON_HOLD: { opacity: 0.5 },
  SKIPPED: { opacity: 0.25 },
};

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 260;
const DAY_WIDTH_DEFAULT = 28;
const MIN_DAY_WIDTH = 8;
const MAX_DAY_WIDTH = 80;

interface GanttChartProps {
  activities: ActivityWithAssignees[];
  stages: ActivityStage[];
  stageColorMap: Map<string, number>;
  onSelectActivity: (activity: ActivityWithAssignees) => void;
}

export function GanttChart({
  activities,
  stages,
  stageColorMap,
  onSelectActivity,
}: GanttChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const labelScrollRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const [dayWidth, setDayWidth] = useState(DAY_WIDTH_DEFAULT);

  const parentActivities = useMemo(() =>
    activities.filter(a => !a.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [activities]
  );

  const stageMap = useMemo(() => {
    const m = new Map<string, ActivityStage>();
    stages?.forEach(s => m.set(s.id, s));
    return m;
  }, [stages]);

  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const datesWithValues = parentActivities.filter(a => a.startDate || a.endDate);
    if (datesWithValues.length === 0) {
      const today = startOfDay(new Date());
      return { timelineStart: addDays(today, -7), timelineEnd: addDays(today, 90), totalDays: 97 };
    }

    let minDate = new Date();
    let maxDate = new Date();
    let first = true;

    for (const a of datesWithValues) {
      const sd = a.startDate ? startOfDay(new Date(a.startDate)) : null;
      const ed = a.endDate ? startOfDay(new Date(a.endDate)) : null;
      const d = sd || ed!;
      const e = ed || sd!;
      if (first) { minDate = d; maxDate = e; first = false; }
      else {
        if (d < minDate) minDate = d;
        if (e > maxDate) maxDate = e;
      }
    }

    const padding = 14;
    const start = addDays(startOfDay(minDate), -padding);
    const end = addDays(startOfDay(maxDate), padding);
    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: differenceInCalendarDays(end, start) + 1,
    };
  }, [parentActivities]);

  const months = useMemo(() => {
    return eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
  }, [timelineStart, timelineEnd]);

  const weeks = useMemo(() => {
    return eachWeekOfInterval({ start: timelineStart, end: timelineEnd }, { weekStartsOn: 1 });
  }, [timelineStart, timelineEnd]);

  const orderedActivities = useMemo(() => {
    const result: { activity: ActivityWithAssignees; stageIndex: number; stageName: string }[] = [];
    const stageOrder = stages.map(s => s.id);

    const grouped = new Map<string, ActivityWithAssignees[]>();
    parentActivities.forEach(a => {
      const sid = a.stageId || "ungrouped";
      const list = grouped.get(sid) || [];
      list.push(a);
      grouped.set(sid, list);
    });

    const orderedStageIds = Array.from(grouped.keys()).sort((a, b) => {
      const ai = stageOrder.indexOf(a);
      const bi = stageOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    for (const stageId of orderedStageIds) {
      const stage = stageMap.get(stageId);
      const colorIdx = stageColorMap.get(stageId) ?? 0;
      const acts = grouped.get(stageId) || [];
      for (const a of acts) {
        result.push({ activity: a, stageIndex: colorIdx, stageName: stage?.name || "Other" });
      }
    }

    return result;
  }, [parentActivities, stages, stageMap, stageColorMap]);

  const chartWidth = totalDays * dayWidth;
  const chartHeight = orderedActivities.length * ROW_HEIGHT;
  const today = startOfDay(new Date());
  const todayOffset = differenceInCalendarDays(today, timelineStart) * dayWidth;

  const handleZoom = useCallback((direction: "in" | "out", centerX?: number) => {
    setDayWidth(prev => {
      const step = Math.max(2, Math.round(prev * 0.15));
      let next: number;
      if (direction === "in") next = Math.min(prev + step, MAX_DAY_WIDTH);
      else next = Math.max(prev - step, MIN_DAY_WIDTH);

      if (centerX != null && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const scrollLeft = container.scrollLeft;
        const dayAtCenter = (scrollLeft + centerX) / prev;
        requestAnimationFrame(() => {
          container.scrollLeft = dayAtCenter * next - centerX;
        });
      }

      return next;
    });
  }, []);

  const scrollToToday = useCallback(() => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollLeft = todayOffset - containerWidth / 2;
    }
  }, [todayOffset]);

  useEffect(() => {
    const chartEl = scrollContainerRef.current;
    if (!chartEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = chartEl.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        if (e.deltaY < 0) handleZoom("in", centerX);
        else handleZoom("out", centerX);
      }
    };

    chartEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => chartEl.removeEventListener("wheel", handleWheel);
  }, [handleZoom]);

  useEffect(() => {
    const chartEl = scrollContainerRef.current;
    const labelEl = labelScrollRef.current;
    if (!chartEl || !labelEl) return;

    const syncFromChart = () => {
      labelEl.scrollTop = chartEl.scrollTop;
    };
    const syncFromLabels = () => {
      chartEl.scrollTop = labelEl.scrollTop;
    };

    chartEl.addEventListener("scroll", syncFromChart);
    labelEl.addEventListener("scroll", syncFromLabels);
    return () => {
      chartEl.removeEventListener("scroll", syncFromChart);
      labelEl.removeEventListener("scroll", syncFromLabels);
    };
  }, []);

  return (
    <div className="border rounded-md bg-background overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: 400 }} data-testid="gantt-chart">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">
          {format(timelineStart, "MMM yyyy")} &ndash; {format(timelineEnd, "MMM yyyy")}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleZoom("out")}
            data-testid="button-gantt-zoom-out"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToToday}
            data-testid="button-gantt-today"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleZoom("in")}
            data-testid="button-gantt-zoom-in"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground ml-1 hidden md:inline">
            Ctrl+Scroll to zoom
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" ref={chartWrapperRef}>
        <div
          className="flex-shrink-0 border-r bg-background z-10 flex flex-col"
          style={{ width: LABEL_WIDTH }}
        >
          <div
            className="flex items-end px-3 border-b bg-muted/30 text-[10px] font-medium text-muted-foreground flex-shrink-0"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="pb-1">Activity</span>
          </div>
          <div ref={labelScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
            <div style={{ height: chartHeight }}>
              {orderedActivities.map(({ activity, stageIndex }) => {
                const color = STAGE_HEX_COLORS[stageIndex % STAGE_HEX_COLORS.length];
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-1.5 px-2 border-b cursor-pointer hover-elevate"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onSelectActivity(activity)}
                    data-testid={`gantt-label-${activity.id}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs truncate flex-1" title={activity.name}>
                      {activity.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto"
        >
          <div style={{ width: chartWidth, minWidth: "100%" }}>
            <TimelineHeader
              timelineStart={timelineStart}
              totalDays={totalDays}
              dayWidth={dayWidth}
              months={months}
              headerHeight={HEADER_HEIGHT}
            />

            <svg
              width={chartWidth}
              height={chartHeight}
              className="block"
            >
              <defs>
                <pattern id="stuck-pattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="transparent" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                </pattern>
              </defs>

              {Array.from({ length: totalDays }).map((_, dayIdx) => {
                const date = addDays(timelineStart, dayIdx);
                const weekend = isWeekend(date);
                if (!weekend) return null;
                return (
                  <rect
                    key={dayIdx}
                    x={dayIdx * dayWidth}
                    y={0}
                    width={dayWidth}
                    height={chartHeight}
                    className="fill-muted/40"
                  />
                );
              })}

              {orderedActivities.map((_, i) => (
                <line
                  key={`row-${i}`}
                  x1={0}
                  y1={(i + 1) * ROW_HEIGHT}
                  x2={chartWidth}
                  y2={(i + 1) * ROW_HEIGHT}
                  className="stroke-border"
                  strokeWidth={0.5}
                />
              ))}

              {weeks.map((weekDate, wi) => {
                const offset = differenceInCalendarDays(weekDate, timelineStart) * dayWidth;
                if (offset < 0) return null;
                return (
                  <line
                    key={`week-${wi}`}
                    x1={offset}
                    y1={0}
                    x2={offset}
                    y2={chartHeight}
                    className="stroke-border/50"
                    strokeWidth={0.5}
                    strokeDasharray="2,4"
                  />
                );
              })}

              {renderDependencyArrows(orderedActivities, parentActivities, timelineStart, dayWidth, ROW_HEIGHT)}

              {orderedActivities.map(({ activity, stageIndex }, rowIdx) => {
                if (!activity.startDate && !activity.endDate) return null;
                const sd = activity.startDate ? startOfDay(new Date(activity.startDate)) : startOfDay(new Date(activity.endDate!));
                const ed = activity.endDate ? startOfDay(new Date(activity.endDate)) : sd;

                const startOffset = differenceInCalendarDays(sd, timelineStart) * dayWidth;
                const duration = differenceInCalendarDays(ed, sd) + 1;
                const barWidth = Math.max(duration * dayWidth - 2, dayWidth * 0.5);
                const barY = rowIdx * ROW_HEIGHT + (ROW_HEIGHT - 18) / 2;
                const color = STAGE_HEX_COLORS[stageIndex % STAGE_HEX_COLORS.length];
                const statusConfig = STATUS_BAR_PATTERNS[activity.status] || STATUS_BAR_PATTERNS.NOT_STARTED;
                const isOverdue = activity.endDate && activity.status !== "DONE" && activity.status !== "SKIPPED" &&
                  startOfDay(new Date(activity.endDate)) < today;

                return (
                  <g key={activity.id} data-testid={`gantt-bar-${activity.id}`}>
                    <rect
                      x={startOffset + 1}
                      y={barY}
                      width={barWidth}
                      height={18}
                      rx={3}
                      fill={color}
                      opacity={statusConfig.opacity}
                      className="cursor-pointer"
                      onClick={() => onSelectActivity(activity)}
                    />
                    {statusConfig.pattern === "stuck" && (
                      <rect
                        x={startOffset + 1}
                        y={barY}
                        width={barWidth}
                        height={18}
                        rx={3}
                        fill="url(#stuck-pattern)"
                        className="cursor-pointer pointer-events-none"
                      />
                    )}
                    {activity.status === "DONE" && (
                      <rect
                        x={startOffset + 1}
                        y={barY}
                        width={barWidth}
                        height={18}
                        rx={3}
                        fill="none"
                        stroke="rgba(34,197,94,0.6)"
                        strokeWidth={1.5}
                        className="pointer-events-none"
                      />
                    )}
                    {isOverdue && (
                      <rect
                        x={startOffset + 1}
                        y={barY}
                        width={barWidth}
                        height={18}
                        rx={3}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        strokeDasharray="3,2"
                        className="pointer-events-none"
                      />
                    )}
                    {barWidth > 50 && (
                      <text
                        x={startOffset + barWidth / 2 + 1}
                        y={barY + 12}
                        textAnchor="middle"
                        className="fill-white pointer-events-none"
                        fontSize={9}
                        fontWeight={500}
                      >
                        {activity.name.length > barWidth / 6
                          ? activity.name.slice(0, Math.floor(barWidth / 6)) + "..."
                          : activity.name}
                      </text>
                    )}
                    {barWidth > 30 && barWidth <= 50 && (
                      <text
                        x={startOffset + barWidth / 2 + 1}
                        y={barY + 12}
                        textAnchor="middle"
                        className="fill-white pointer-events-none"
                        fontSize={8}
                      >
                        {duration}d
                      </text>
                    )}
                  </g>
                );
              })}

              <line
                x1={todayOffset}
                y1={0}
                x2={todayOffset}
                y2={chartHeight}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4,3"
              />
              <polygon
                points={`${todayOffset - 4},0 ${todayOffset + 4},0 ${todayOffset},6`}
                fill="#ef4444"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-3 py-1.5 bg-muted/30 border-t text-[10px] text-muted-foreground flex-wrap flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-gray-400 opacity-40 inline-block" /> Not Started
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-blue-500 opacity-85 inline-block" /> In Progress
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-green-500 inline-block border border-green-400" /> Done
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-red-400 opacity-85 inline-block" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 1.5px, rgba(255,255,255,.3) 1.5px, rgba(255,255,255,.3) 3px)" }} /> Stuck
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm bg-yellow-500 opacity-50 inline-block" /> On Hold
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 border-t border-dashed border-red-500" /> Overdue
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-transparent border-t-red-500" />
          <span className="inline-block w-3 border-t border-dashed border-red-500" /> Today
        </span>
      </div>
    </div>
  );
}

function TimelineHeader({
  timelineStart,
  totalDays,
  dayWidth,
  months,
  headerHeight,
}: {
  timelineStart: Date;
  totalDays: number;
  dayWidth: number;
  months: Date[];
  headerHeight: number;
}) {
  const chartWidth = totalDays * dayWidth;

  return (
    <div className="border-b bg-muted/30 sticky top-0 z-10" style={{ height: headerHeight }}>
      <div className="relative" style={{ width: chartWidth, height: headerHeight }}>
        <div className="absolute top-0 left-0 w-full" style={{ height: headerHeight / 2 }}>
          {months.map((monthDate, mi) => {
            const monthStart = monthDate < timelineStart ? timelineStart : monthDate;
            const monthEnd = endOfMonth(monthDate);
            const effectiveEnd = monthEnd > addDays(timelineStart, totalDays) ? addDays(timelineStart, totalDays) : monthEnd;

            const startOffset = differenceInCalendarDays(monthStart, timelineStart) * dayWidth;
            const mDays = differenceInCalendarDays(effectiveEnd, monthStart) + 1;
            const width = mDays * dayWidth;

            if (width <= 0) return null;

            return (
              <div
                key={mi}
                className="absolute top-0 flex items-center justify-center border-r text-[10px] font-semibold text-muted-foreground"
                style={{
                  left: startOffset,
                  width,
                  height: headerHeight / 2,
                }}
              >
                {format(monthDate, "MMMM yyyy")}
              </div>
            );
          })}
        </div>

        {dayWidth >= 20 && (
          <div className="absolute left-0 w-full" style={{ top: headerHeight / 2, height: headerHeight / 2 }}>
            {Array.from({ length: totalDays }).map((_, dayIdx) => {
              const date = addDays(timelineStart, dayIdx);
              const weekend = isWeekend(date);
              const isToday = differenceInCalendarDays(date, startOfDay(new Date())) === 0;

              return (
                <div
                  key={dayIdx}
                  className={cn(
                    "absolute flex items-center justify-center text-[8px] border-r",
                    weekend ? "text-muted-foreground/50 bg-muted/20" : "text-muted-foreground",
                    isToday && "bg-red-100 dark:bg-red-900/30 font-bold text-red-600 dark:text-red-400",
                  )}
                  style={{
                    left: dayIdx * dayWidth,
                    width: dayWidth,
                    height: headerHeight / 2,
                  }}
                >
                  {dayWidth >= 24
                    ? format(date, "d")
                    : (date.getDate() % 2 === 1 ? format(date, "d") : "")}
                </div>
              );
            })}
          </div>
        )}

        {dayWidth < 20 && (
          <div className="absolute left-0 w-full" style={{ top: headerHeight / 2, height: headerHeight / 2 }}>
            {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, weekIdx) => {
              const weekStart = addDays(timelineStart, weekIdx * 7);
              const offset = weekIdx * 7 * dayWidth;
              return (
                <div
                  key={weekIdx}
                  className="absolute flex items-center justify-center text-[8px] text-muted-foreground border-r"
                  style={{
                    left: offset,
                    width: 7 * dayWidth,
                    height: headerHeight / 2,
                  }}
                >
                  W{format(weekStart, "w")}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function renderDependencyArrows(
  orderedActivities: { activity: ActivityWithAssignees; stageIndex: number; stageName: string }[],
  allParentActivities: ActivityWithAssignees[],
  timelineStart: Date,
  dayWidth: number,
  rowHeight: number,
) {
  const arrows: JSX.Element[] = [];

  const sortOrderToRowIdx = new Map<number, number>();
  orderedActivities.forEach(({ activity }, idx) => {
    sortOrderToRowIdx.set(activity.sortOrder, idx);
  });

  for (let i = 0; i < orderedActivities.length; i++) {
    const curr = orderedActivities[i].activity;
    if (curr.predecessorSortOrder == null) continue;

    const predRowIdx = sortOrderToRowIdx.get(curr.predecessorSortOrder);
    if (predRowIdx == null) continue;

    const pred = orderedActivities[predRowIdx]?.activity;
    if (!pred) continue;

    if (!pred.endDate || !curr.startDate) continue;

    const predEnd = startOfDay(new Date(pred.endDate));
    const currStart = startOfDay(new Date(curr.startDate));

    const x1 = (differenceInCalendarDays(predEnd, timelineStart) + 1) * dayWidth;
    const y1 = predRowIdx * rowHeight + rowHeight / 2;
    const x2 = differenceInCalendarDays(currStart, timelineStart) * dayWidth;
    const y2 = i * rowHeight + rowHeight / 2;

    const midX = x1 + 8;
    const pathD = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

    arrows.push(
      <g key={`arrow-${curr.id}`}>
        <path
          d={pathD}
          fill="none"
          className="stroke-muted-foreground/40"
          strokeWidth={1}
        />
        <polygon
          points={`${x2},${y2} ${x2 - 4},${y2 - 3} ${x2 - 4},${y2 + 3}`}
          className="fill-muted-foreground/40"
        />
      </g>
    );
  }

  return <>{arrows}</>;
}
