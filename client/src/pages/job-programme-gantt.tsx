import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { format, differenceInCalendarDays, addDays, startOfDay, isWeekend, endOfMonth, eachMonthOfInterval, eachWeekOfInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Minus, Plus, Printer } from "lucide-react";
import type { JobLevelCycleTime } from "@shared/schema";

function formatLevelDisplay(level: string, pourLabel?: string | null): string {
  const numMatch = level.match(/^L?(\d+)$/i);
  const prefix = numMatch ? `Level ${numMatch[1]}` : level;
  if (pourLabel) return `${prefix} - Pour ${pourLabel}`;
  return `${prefix} - Pour Date`;
}

const BUILDING_HEX_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#f43f5e",
  "#06b6d4", "#f97316", "#14b8a6", "#ec4899", "#6366f1",
];

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 220;
const DAY_WIDTH_DEFAULT = 28;
const MIN_DAY_WIDTH = 8;
const MAX_DAY_WIDTH = 80;

interface ProgrammeGanttChartProps {
  entries: JobLevelCycleTime[];
  jobTitle?: string;
}

export function ProgrammeGanttChart({
  entries,
  jobTitle,
}: ProgrammeGanttChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const labelScrollRef = useRef<HTMLDivElement>(null);
  const [dayWidth, setDayWidth] = useState(DAY_WIDTH_DEFAULT);

  const sortedEntries = useMemo(() =>
    [...entries].sort((a, b) => a.sequenceOrder - b.sequenceOrder),
    [entries]
  );

  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const datesWithValues = sortedEntries.filter(e => {
      const s = e.manualStartDate || e.estimatedStartDate;
      const end = e.manualEndDate || e.estimatedEndDate;
      return s || end;
    });

    if (datesWithValues.length === 0) {
      const today = startOfDay(new Date());
      return { timelineStart: addDays(today, -7), timelineEnd: addDays(today, 90), totalDays: 97 };
    }

    let minDate = new Date();
    let maxDate = new Date();
    let first = true;

    for (const e of datesWithValues) {
      const sd = e.manualStartDate || e.estimatedStartDate;
      const ed = e.manualEndDate || e.estimatedEndDate;
      const d = sd ? startOfDay(new Date(sd)) : startOfDay(new Date(ed!));
      const end = ed ? startOfDay(new Date(ed)) : d;
      if (first) { minDate = d; maxDate = end; first = false; }
      else {
        if (d < minDate) minDate = d;
        if (end > maxDate) maxDate = end;
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
  }, [sortedEntries]);

  const months = useMemo(() =>
    eachMonthOfInterval({ start: timelineStart, end: timelineEnd }),
    [timelineStart, timelineEnd]
  );

  const weeks = useMemo(() =>
    eachWeekOfInterval({ start: timelineStart, end: timelineEnd }, { weekStartsOn: 1 }),
    [timelineStart, timelineEnd]
  );

  const chartWidth = totalDays * dayWidth;
  const chartHeight = sortedEntries.length * ROW_HEIGHT;
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

    const syncFromChart = () => { labelEl.scrollTop = chartEl.scrollTop; };
    const syncFromLabels = () => { chartEl.scrollTop = labelEl.scrollTop; };

    chartEl.addEventListener("scroll", syncFromChart);
    labelEl.addEventListener("scroll", syncFromLabels);
    return () => {
      chartEl.removeEventListener("scroll", syncFromChart);
      labelEl.removeEventListener("scroll", syncFromLabels);
    };
  }, []);

  const handlePrint = useCallback(() => {
    const PRINT_DAY_WIDTH = 18;
    const PRINT_ROW_HEIGHT = 24;
    const PRINT_LABEL_WIDTH = 180;
    const PRINT_HEADER_HEIGHT = 40;
    const printChartWidth = totalDays * PRINT_DAY_WIDTH;
    const printChartHeight = sortedEntries.length * PRINT_ROW_HEIGHT;
    const printToday = startOfDay(new Date());
    const printTodayOffset = differenceInCalendarDays(printToday, timelineStart) * PRINT_DAY_WIDTH;

    let svgBars = "";
    let svgWeekends = "";
    let svgRows = "";
    let svgWeeks = "";

    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      const date = addDays(timelineStart, dayIdx);
      if (isWeekend(date)) {
        svgWeekends += `<rect x="${dayIdx * PRINT_DAY_WIDTH}" y="0" width="${PRINT_DAY_WIDTH}" height="${printChartHeight}" fill="rgba(128,128,128,0.08)" />`;
      }
    }

    sortedEntries.forEach((_, i) => {
      svgRows += `<line x1="0" y1="${(i + 1) * PRINT_ROW_HEIGHT}" x2="${printChartWidth}" y2="${(i + 1) * PRINT_ROW_HEIGHT}" stroke="#ddd" stroke-width="0.5" />`;
    });

    weeks.forEach((weekDate) => {
      const offset = differenceInCalendarDays(weekDate, timelineStart) * PRINT_DAY_WIDTH;
      if (offset >= 0) {
        svgWeeks += `<line x1="${offset}" y1="0" x2="${offset}" y2="${printChartHeight}" stroke="#ddd" stroke-width="0.5" stroke-dasharray="2,4" />`;
      }
    });

    const seqToRowIdx = new Map<number, number>();
    sortedEntries.forEach((e, idx) => { seqToRowIdx.set(e.sequenceOrder, idx); });

    let svgArrows = "";
    sortedEntries.forEach((entry, i) => {
      if (entry.predecessorSequenceOrder == null) return;
      const predRowIdx = seqToRowIdx.get(entry.predecessorSequenceOrder);
      if (predRowIdx == null) return;
      const pred = sortedEntries[predRowIdx];
      const predEnd = pred?.manualEndDate || pred?.estimatedEndDate;
      const currStart = entry.manualStartDate || entry.estimatedStartDate;
      if (!predEnd || !currStart) return;
      const x1 = (differenceInCalendarDays(startOfDay(new Date(predEnd)), timelineStart) + 1) * PRINT_DAY_WIDTH;
      const y1 = predRowIdx * PRINT_ROW_HEIGHT + PRINT_ROW_HEIGHT / 2;
      const x2 = differenceInCalendarDays(startOfDay(new Date(currStart)), timelineStart) * PRINT_DAY_WIDTH;
      const y2 = i * PRINT_ROW_HEIGHT + PRINT_ROW_HEIGHT / 2;
      const midX = x1 + 6;
      svgArrows += `<path d="M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}" fill="none" stroke="#999" stroke-width="0.8" />`;
      svgArrows += `<polygon points="${x2},${y2} ${x2 - 3},${y2 - 2} ${x2 - 3},${y2 + 2}" fill="#999" />`;
    });

    sortedEntries.forEach((entry, rowIdx) => {
      const sd = entry.manualStartDate || entry.estimatedStartDate;
      const ed = entry.manualEndDate || entry.estimatedEndDate;
      if (!sd && !ed) return;
      const startDate = sd ? startOfDay(new Date(sd)) : startOfDay(new Date(ed!));
      const endDate = ed ? startOfDay(new Date(ed)) : startDate;
      const startOffset = differenceInCalendarDays(startDate, timelineStart) * PRINT_DAY_WIDTH;
      const duration = differenceInCalendarDays(endDate, startDate) + 1;
      const barWidth = Math.max(duration * PRINT_DAY_WIDTH - 2, PRINT_DAY_WIDTH * 0.5);
      const barY = rowIdx * PRINT_ROW_HEIGHT + (PRINT_ROW_HEIGHT - 14) / 2;
      const colorIdx = (entry.buildingNumber - 1) % BUILDING_HEX_COLORS.length;
      const color = BUILDING_HEX_COLORS[colorIdx];
      svgBars += `<rect x="${startOffset + 1}" y="${barY}" width="${barWidth}" height="14" rx="2" fill="${color}" opacity="0.85" />`;
      if (barWidth > 40) {
        const label = formatLevelDisplay(entry.level, entry.pourLabel);
        const truncLabel = label.length > barWidth / 5 ? label.slice(0, Math.floor(barWidth / 5)) + "..." : label;
        svgBars += `<text x="${startOffset + barWidth / 2 + 1}" y="${barY + 10}" text-anchor="middle" fill="white" font-size="7" font-weight="500">${truncLabel}</text>`;
      }
    });

    const todayLine = `<line x1="${printTodayOffset}" y1="0" x2="${printTodayOffset}" y2="${printChartHeight}" stroke="#ef4444" stroke-width="1" stroke-dasharray="3,2" />`;

    let monthHeaders = "";
    months.forEach((monthDate) => {
      const monthStart = monthDate < timelineStart ? timelineStart : monthDate;
      const monthEnd = endOfMonth(monthDate);
      const effectiveEnd = monthEnd > addDays(timelineStart, totalDays) ? addDays(timelineStart, totalDays) : monthEnd;
      const startOffset = differenceInCalendarDays(monthStart, timelineStart) * PRINT_DAY_WIDTH;
      const mDays = differenceInCalendarDays(effectiveEnd, monthStart) + 1;
      const width = mDays * PRINT_DAY_WIDTH;
      if (width > 0) {
        monthHeaders += `<div style="position:absolute;left:${startOffset}px;width:${width}px;height:${PRINT_HEADER_HEIGHT}px;display:flex;align-items:center;justify-content:center;border-right:1px solid #ddd;font-size:9px;font-weight:600;color:#666;">${format(monthDate, "MMM yyyy")}</div>`;
      }
    });

    let labelRows = "";
    sortedEntries.forEach((entry) => {
      const colorIdx = (entry.buildingNumber - 1) % BUILDING_HEX_COLORS.length;
      const color = BUILDING_HEX_COLORS[colorIdx];
      const displayLabel = formatLevelDisplay(entry.level, entry.pourLabel);
      labelRows += `<div style="height:${PRINT_ROW_HEIGHT}px;display:flex;align-items:center;gap:4px;padding:0 6px;border-bottom:1px solid #eee;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">`;
      labelRows += `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};flex-shrink:0;"></span>`;
      labelRows += `<span style="color:#555;font-weight:500;">${displayLabel}</span>`;
      labelRows += `</div>`;
    });

    const printContent = `
      <html>
      <head><title>Job Programme - ${jobTitle || "Programme"}</title>
      <style>body{font-family:Arial,sans-serif;margin:0;padding:20px;}@media print{body{padding:10px;}}</style>
      </head><body>
      <div style="margin-bottom:12px;">
        <h2 style="margin:0;font-size:16px;color:#333;">${jobTitle || "Job Programme"}</h2>
        <p style="margin:4px 0;color:#777;font-size:10px;">Printed ${format(new Date(), "dd MMM yyyy HH:mm")}</p>
      </div>
      <div style="display:flex;border:1px solid #ddd;overflow:hidden;">
        <div style="width:${PRINT_LABEL_WIDTH}px;flex-shrink:0;border-right:1px solid #ddd;">
          <div style="height:${PRINT_HEADER_HEIGHT}px;background:#f9fafb;border-bottom:1px solid #ddd;display:flex;align-items:center;padding:0 8px;font-weight:600;font-size:9px;color:#555;">Level / Pour</div>
          ${labelRows}
        </div>
        <div style="flex:1;overflow:hidden;">
          <div style="position:relative;height:${PRINT_HEADER_HEIGHT}px;background:#f9fafb;border-bottom:1px solid #ddd;">${monthHeaders}</div>
          <div style="position:relative;">
            <svg width="${printChartWidth}" height="${printChartHeight}" xmlns="http://www.w3.org/2000/svg">
              ${svgWeekends}${svgRows}${svgWeeks}${svgArrows}${svgBars}${todayLine}
            </svg>
          </div>
        </div>
      </div>
      <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
      </body></html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  }, [sortedEntries, totalDays, timelineStart, weeks, months, jobTitle]);

  const seqToRowIdx = useMemo(() => {
    const m = new Map<number, number>();
    sortedEntries.forEach((e, idx) => { m.set(e.sequenceOrder, idx); });
    return m;
  }, [sortedEntries]);

  return (
    <div className="border rounded-md bg-card" data-testid="programme-gantt-chart" role="main" aria-label="Job Programme Gantt">
      <div className="flex items-center justify-between px-3 py-2 border-b gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Programme Gantt Chart
        </span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => handleZoom("out")} data-testid="btn-zoom-out">
            <Minus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={scrollToToday} data-testid="btn-scroll-today">
            Today
          </Button>
          <Button size="icon" variant="ghost" onClick={() => handleZoom("in")} data-testid="btn-zoom-in">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handlePrint} data-testid="btn-print-gantt">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex" style={{ height: Math.min(chartHeight + HEADER_HEIGHT + 2, 600) }}>
        <div className="flex flex-col border-r" style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
          <div className="flex items-center px-3 border-b text-xs font-medium text-muted-foreground" style={{ height: HEADER_HEIGHT, flexShrink: 0 }}>
            Level / Pour
          </div>
          <div ref={labelScrollRef} className="overflow-y-auto overflow-x-hidden" style={{ flex: 1 }}>
            {sortedEntries.map((entry) => {
              const colorIdx = (entry.buildingNumber - 1) % BUILDING_HEX_COLORS.length;
              const displayLabel = formatLevelDisplay(entry.level, entry.pourLabel);
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 px-3 text-xs border-b border-border/30 whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ height: ROW_HEIGHT }}
                  data-testid={`gantt-label-${entry.id}`}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: BUILDING_HEX_COLORS[colorIdx] }}
                  />
                  <span className="truncate font-medium">{displayLabel}</span>
                  <span className="text-muted-foreground ml-auto text-xs">Bldg {entry.buildingNumber}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="relative border-b" style={{ height: HEADER_HEIGHT, flexShrink: 0 }}>
            <div className="absolute inset-0 overflow-hidden">
              <div className="relative" style={{ width: chartWidth }}>
                {months.map((monthDate, i) => {
                  const monthStart = monthDate < timelineStart ? timelineStart : monthDate;
                  const monthEnd = endOfMonth(monthDate);
                  const effectiveEnd = monthEnd > addDays(timelineStart, totalDays) ? addDays(timelineStart, totalDays) : monthEnd;
                  const startOffset = differenceInCalendarDays(monthStart, timelineStart) * dayWidth;
                  const mDays = differenceInCalendarDays(effectiveEnd, monthStart) + 1;
                  const width = mDays * dayWidth;
                  if (width <= 0) return null;
                  return (
                    <div
                      key={i}
                      className="absolute flex items-center justify-center text-xs font-medium text-muted-foreground border-r border-border/50"
                      style={{ left: startOffset, width, height: HEADER_HEIGHT }}
                    >
                      {format(monthDate, "MMM yyyy")}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className="overflow-auto"
            style={{ flex: 1 }}
          >
            <div className="relative" style={{ width: chartWidth, height: chartHeight }}>
              {Array.from({ length: totalDays }, (_, dayIdx) => {
                const date = addDays(timelineStart, dayIdx);
                if (!isWeekend(date)) return null;
                return (
                  <div
                    key={`we-${dayIdx}`}
                    className="absolute top-0 bottom-0 bg-muted/20"
                    style={{ left: dayIdx * dayWidth, width: dayWidth }}
                  />
                );
              })}

              {weeks.map((weekDate, i) => {
                const offset = differenceInCalendarDays(weekDate, timelineStart) * dayWidth;
                if (offset < 0) return null;
                return (
                  <div
                    key={`wk-${i}`}
                    className="absolute top-0 bottom-0 border-l border-border/30 border-dashed"
                    style={{ left: offset }}
                  />
                );
              })}

              {sortedEntries.map((_, i) => (
                <div
                  key={`row-${i}`}
                  className="absolute border-b border-border/20"
                  style={{ top: (i + 1) * ROW_HEIGHT, left: 0, right: 0, height: 0 }}
                />
              ))}

              {sortedEntries.map((entry, rowIdx) => {
                if (entry.predecessorSequenceOrder == null) return null;
                const predRowIdx = seqToRowIdx.get(entry.predecessorSequenceOrder);
                if (predRowIdx == null) return null;
                const pred = sortedEntries[predRowIdx];
                const predEnd = pred?.manualEndDate || pred?.estimatedEndDate;
                const currStart = entry.manualStartDate || entry.estimatedStartDate;
                if (!predEnd || !currStart) return null;

                const x1 = (differenceInCalendarDays(startOfDay(new Date(predEnd)), timelineStart) + 1) * dayWidth;
                const y1 = predRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = differenceInCalendarDays(startOfDay(new Date(currStart)), timelineStart) * dayWidth;
                const y2 = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const midX = x1 + 8;

                return (
                  <svg
                    key={`arrow-${entry.id}`}
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{ width: chartWidth, height: chartHeight }}
                  >
                    <path
                      d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
                      fill="none"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.2}
                      opacity={0.4}
                    />
                    <polygon
                      points={`${x2},${y2} ${x2 - 4},${y2 - 2.5} ${x2 - 4},${y2 + 2.5}`}
                      fill="hsl(var(--muted-foreground))"
                      opacity={0.4}
                    />
                  </svg>
                );
              })}

              {sortedEntries.map((entry, rowIdx) => {
                const sd = entry.manualStartDate || entry.estimatedStartDate;
                const ed = entry.manualEndDate || entry.estimatedEndDate;
                if (!sd && !ed) return null;

                const startDate = sd ? startOfDay(new Date(sd)) : startOfDay(new Date(ed!));
                const endDate = ed ? startOfDay(new Date(ed)) : startDate;
                const startOffset = differenceInCalendarDays(startDate, timelineStart) * dayWidth;
                const duration = differenceInCalendarDays(endDate, startDate) + 1;
                const barWidth = Math.max(duration * dayWidth - 2, dayWidth * 0.5);
                const barY = rowIdx * ROW_HEIGHT + (ROW_HEIGHT - 20) / 2;
                const colorIdx = (entry.buildingNumber - 1) % BUILDING_HEX_COLORS.length;
                const hasManual = !!(entry.manualStartDate || entry.manualEndDate);

                return (
                  <div
                    key={`bar-${entry.id}`}
                    className={cn(
                      "absolute rounded-sm flex items-center justify-center text-white text-[10px] font-medium overflow-hidden",
                      hasManual && "ring-1 ring-blue-400 ring-offset-1 ring-offset-background"
                    )}
                    style={{
                      left: startOffset + 1,
                      top: barY,
                      width: barWidth,
                      height: 20,
                      backgroundColor: BUILDING_HEX_COLORS[colorIdx],
                      opacity: 0.85,
                    }}
                    title={`${formatLevelDisplay(entry.level, entry.pourLabel)}: ${format(startDate, "dd/MM")} - ${format(endDate, "dd/MM")} (${entry.cycleDays}d)`}
                    data-testid={`gantt-bar-${entry.id}`}
                  >
                    {barWidth > 50 && (
                      <span className="truncate px-1">
                        {formatLevelDisplay(entry.level, entry.pourLabel)}
                      </span>
                    )}
                  </div>
                );
              })}

              {todayOffset >= 0 && todayOffset <= chartWidth && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-red-500 border-dashed z-10"
                  style={{ left: todayOffset }}
                >
                  <span className="absolute -top-0 -left-[14px] text-[9px] font-medium text-red-500 bg-background px-0.5">
                    Today
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
