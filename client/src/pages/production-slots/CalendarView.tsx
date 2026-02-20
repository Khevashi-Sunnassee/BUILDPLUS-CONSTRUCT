import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { CFMEU_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, FileDown, Factory as FactoryIcon } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, subDays, addDays } from "date-fns";
import type { CfmeuHoliday } from "@shared/schema";
import type { CalendarViewProps } from "./types";
import { stringToColor, HOLIDAY_COLORS, addWorkingDays } from "./utils";

export function CalendarView({
  slots,
  factories,
  getFactory,
  currentDate,
  setCurrentDate,
  calendarViewMode,
  setCalendarViewMode,
  weekStartDay,
  onSlotClick,
  selectedFactoryId,
}: CalendarViewProps) {
  const selectedFactory = useMemo(() => {
    if (!selectedFactoryId) return null;
    return factories.find(f => f.id === selectedFactoryId) || null;
  }, [selectedFactoryId, factories]);

  const cfmeuCalendarType = selectedFactory?.cfmeuCalendar || null;

  const activeFactories = useMemo(() => factories.filter(f => f.isActive), [factories]);
  const needsFactorySelection = !selectedFactoryId && activeFactories.length > 1;

  const filteredSlots = useMemo(() => {
    if (selectedFactoryId) {
      return slots.filter(slot => slot.job.factoryId === selectedFactoryId);
    }
    return slots;
  }, [slots, selectedFactoryId]);

  const { start, end, days } = useMemo(() => {
    let start: Date, end: Date;
    if (calendarViewMode === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
      end = endOfWeek(currentDate, { weekStartsOn: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }
    return { start, end, days: eachDayOfInterval({ start, end }) };
  }, [currentDate, calendarViewMode, weekStartDay]);

  const { data: cfmeuHolidays = [] } = useQuery<CfmeuHoliday[]>({
    queryKey: [CFMEU_ROUTES.HOLIDAYS, cfmeuCalendarType, format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!cfmeuCalendarType) return [];
      const res = await fetch(`${CFMEU_ROUTES.HOLIDAYS}?calendarType=${cfmeuCalendarType}&startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(end, "yyyy-MM-dd")}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!cfmeuCalendarType,
  });

  const holidaysByDate = useMemo(() => {
    const map: Record<string, CfmeuHoliday> = {};
    for (const holiday of cfmeuHolidays) {
      const dateKey = format(new Date(holiday.date), "yyyy-MM-dd");
      map[dateKey] = holiday;
    }
    return map;
  }, [cfmeuHolidays]);

  const colorCache = useMemo(() => {
    const cache: Record<string, string> = {};
    for (const slot of slots) {
      const jobKey = slot.job.jobNumber;
      const levelKey = `${slot.job.jobNumber}-${slot.level}`;
      if (!cache[jobKey]) cache[jobKey] = stringToColor(jobKey);
      if (!cache[levelKey]) cache[levelKey] = stringToColor(levelKey);
    }
    return cache;
  }, [slots]);

  const slotsWithWindows = useMemo(() => {
    const factoryWorkDays = selectedFactory?.workDays || null;
    
    return filteredSlots.map(slot => {
      const productionDate = new Date(slot.productionSlotDate);
      const cycleDays = slot.levelCycleTime ?? slot.job.productionDaysInAdvance ?? 10;
      const onsiteDate = addWorkingDays(productionDate, cycleDays, factoryWorkDays, cfmeuHolidays);
      
      return {
        slot,
        startDate: productionDate,
        endDate: onsiteDate,
        cycleDays,
        jobColor: colorCache[slot.job.jobNumber] || stringToColor(slot.job.jobNumber),
        levelColor: colorCache[`${slot.job.jobNumber}-${slot.level}`] || stringToColor(`${slot.job.jobNumber}-${slot.level}`),
      };
    }).filter(item => {
      return item.endDate >= start && item.startDate <= end;
    }).sort((a, b) => {
      if (a.slot.job.jobNumber !== b.slot.job.jobNumber) {
        return a.slot.job.jobNumber.localeCompare(b.slot.job.jobNumber);
      }
      return a.slot.level.localeCompare(b.slot.level);
    });
  }, [filteredSlots, start, end, colorCache, selectedFactory, cfmeuHolidays]);

  const navigate = useCallback((direction: "prev" | "next") => {
    const amount = calendarViewMode === "week" ? 7 : 30;
    setCurrentDate(direction === "prev" ? subDays(currentDate, amount) : addDays(currentDate, amount));
  }, [calendarViewMode, currentDate, setCurrentDate]);

  const headerLabel = useMemo(() => {
    if (calendarViewMode === "week") {
      return `${format(start, "dd MMM")} - ${format(end, "dd MMM yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }, [calendarViewMode, start, end, currentDate]);

  const today = useMemo(() => new Date(), []);

  const getBarStyle = useCallback((startDate: Date, endDate: Date) => {
    const totalDays = days.length;
    const viewStart = start.getTime();
    const viewEnd = end.getTime();
    const dayWidth = 100 / totalDays;
    
    const barStart = Math.max(startDate.getTime(), viewStart);
    const barEnd = Math.min(endDate.getTime(), viewEnd);
    
    const startDayIndex = Math.floor((barStart - viewStart) / (1000 * 60 * 60 * 24));
    const endDayIndex = Math.ceil((barEnd - viewStart) / (1000 * 60 * 60 * 24));
    
    const left = startDayIndex * dayWidth;
    const width = (endDayIndex - startDayIndex) * dayWidth;
    
    return { left: `${left}%`, width: `${Math.max(width, dayWidth)}%` };
  }, [days.length, start, end]);

  const exportCalendarToPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a3",
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const headerHeight = 20;
    const rowHeight = 8;
    const labelWidth = 50;
    const dayColumnWidth = (pageWidth - margin * 2 - labelWidth) / days.length;
    
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Production Schedule - ${headerLabel}`, margin, margin + 6);
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    const factoryText = selectedFactory ? `Factory: ${selectedFactory.name}` : "All Factories";
    const calendarText = cfmeuCalendarType ? ` | Calendar: ${cfmeuCalendarType.replace("_", " ")}` : "";
    pdf.text(`${factoryText}${calendarText}`, margin, margin + 12);
    
    const gridTop = margin + headerHeight;
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    
    days.forEach((day, index) => {
      const x = margin + labelWidth + (index * dayColumnWidth);
      const dayOfWeek = getDay(day);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const holiday = cfmeuHolidays.find(h => isSameDay(new Date(h.date), day));
      
      if (holiday) {
        pdf.setFillColor(254, 226, 226);
        pdf.rect(x, gridTop, dayColumnWidth, rowHeight, "F");
      } else if (isWeekend) {
        pdf.setFillColor(229, 231, 235);
        pdf.rect(x, gridTop, dayColumnWidth, rowHeight, "F");
      }
      
      pdf.setTextColor(0, 0, 0);
      pdf.text(format(day, "d"), x + dayColumnWidth / 2, gridTop + 5, { align: "center" });
    });
    
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, gridTop, labelWidth, rowHeight, "F");
    pdf.setTextColor(0, 0, 0);
    pdf.text("Job / Level", margin + 2, gridTop + 5);
    
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, gridTop, pageWidth - margin * 2, rowHeight);
    
    let currentY = gridTop + rowHeight;
    
    slotsWithWindows.forEach((item) => {
      if (currentY + rowHeight > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }
      
      pdf.setFillColor(255, 255, 255);
      pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight, "F");
      
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      const label = `${item.slot.job.jobNumber} - L${item.slot.level}`;
      pdf.text(label, margin + 2, currentY + 5);
      
      days.forEach((day, index) => {
        const x = margin + labelWidth + (index * dayColumnWidth);
        const dayOfWeek = getDay(day);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const holiday = cfmeuHolidays.find(h => isSameDay(new Date(h.date), day));
        
        if (holiday) {
          pdf.setFillColor(254, 243, 199);
          pdf.rect(x, currentY, dayColumnWidth, rowHeight, "F");
        } else if (isWeekend) {
          pdf.setFillColor(243, 244, 246);
          pdf.rect(x, currentY, dayColumnWidth, rowHeight, "F");
        }
      });
      
      const startDayIndex = days.findIndex(d => isSameDay(d, item.startDate));
      const endDayIndex = days.findIndex(d => isSameDay(d, item.endDate));
      
      if (startDayIndex >= 0 || endDayIndex >= 0) {
        const barStartIndex = Math.max(0, startDayIndex >= 0 ? startDayIndex : 0);
        const barEndIndex = Math.min(days.length - 1, endDayIndex >= 0 ? endDayIndex : days.length - 1);
        
        const barX = margin + labelWidth + (barStartIndex * dayColumnWidth);
        const barWidth = (barEndIndex - barStartIndex + 1) * dayColumnWidth;
        const barY = currentY + 1;
        const barHeight = rowHeight - 2;
        
        pdf.setFillColor(22, 163, 74);
        pdf.rect(barX, barY, barWidth, barHeight, "F");
        
        pdf.setFillColor(59, 130, 246);
        pdf.rect(barX + 0.5, barY + 0.5, barWidth - 1, barHeight - 1, "F");
        
        if (startDayIndex >= 0) {
          pdf.setFillColor(22, 163, 74);
          pdf.rect(barX + 0.5, barY + 0.5, dayColumnWidth * 0.8, barHeight - 1, "F");
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(6);
          pdf.text(format(item.startDate, "d"), barX + dayColumnWidth * 0.4, currentY + 5, { align: "center" });
        }
        
        if (endDayIndex >= 0 && endDayIndex !== startDayIndex) {
          const endX = margin + labelWidth + (barEndIndex * dayColumnWidth);
          pdf.setFillColor(220, 38, 38);
          pdf.rect(endX + 0.2, barY + 0.5, dayColumnWidth * 0.8, barHeight - 1, "F");
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(6);
          pdf.text(format(item.endDate, "d"), endX + dayColumnWidth * 0.4, currentY + 5, { align: "center" });
        }
        
        if (barWidth > dayColumnWidth * 2.5) {
          const midX = barX + barWidth / 2;
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(6);
          pdf.text(`${item.slot.panelCount}p`, midX, currentY + 5, { align: "center" });
        }
      }
      
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight);
      
      currentY += rowHeight;
    });
    
    pdf.setDrawColor(220, 220, 220);
    for (let i = 0; i <= days.length; i++) {
      const x = margin + labelWidth + (i * dayColumnWidth);
      pdf.line(x, gridTop, x, currentY);
    }
    
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, pageHeight - 5);
    pdf.text("Green = Start Date | Red = End Date | Bars span full production window (working days)", pageWidth - margin, pageHeight - 5, { align: "right" });
    
    pdf.save(`production-schedule-${format(start, "yyyy-MM-dd")}.pdf`);
  }, [days, slotsWithWindows, headerLabel, selectedFactory, cfmeuCalendarType, cfmeuHolidays, start]);

  if (needsFactorySelection) {
    return (
      <div className="p-8 text-center space-y-4">
        <FactoryIcon className="h-12 w-12 mx-auto text-muted-foreground" />
        <div>
          <h3 className="font-semibold text-lg">Select a Factory</h3>
          <p className="text-muted-foreground">
            Please select a specific factory from the filter above to view the production calendar with CFMEU holidays and RDOs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => navigate("prev")} data-testid="button-calendar-prev">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Previous {calendarViewMode === "week" ? "week" : "month"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => navigate("next")} data-testid="button-calendar-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Next {calendarViewMode === "week" ? "week" : "month"}</p>
            </TooltipContent>
          </Tooltip>
          <span className="font-semibold text-lg ml-2">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={calendarViewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setCalendarViewMode("week")}
            data-testid="button-calendar-week"
          >
            Week
          </Button>
          <Button
            variant={calendarViewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setCalendarViewMode("month")}
            data-testid="button-calendar-month"
          >
            Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} data-testid="button-calendar-today">
            Today
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={exportCalendarToPDF} data-testid="button-export-calendar-pdf">
                <FileDown className="h-4 w-4 mr-1" />
                Export PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export calendar as vector PDF</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="flex border-b bg-muted/30">
          <div className="w-48 shrink-0 p-2 border-r font-medium text-sm">
            Job / Level
          </div>
          <div className="flex-1 flex">
            {days.map((day) => {
              const isToday = isSameDay(day, today);
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;
              const dateKey = format(day, "yyyy-MM-dd");
              const holiday = holidaysByDate[dateKey];
              const holidayColors = holiday ? HOLIDAY_COLORS[holiday.holidayType] || HOLIDAY_COLORS.OTHER : null;
              
              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 text-center py-1 text-xs border-r last:border-r-0 ${
                    isToday ? "font-bold" : ""
                  }`}
                  style={{
                    backgroundColor: holiday ? holidayColors?.bg : isToday ? "hsl(var(--primary) / 0.1)" : isWeekend ? "hsl(var(--muted) / 0.5)" : undefined,
                    color: holiday ? holidayColors?.text : isToday ? "hsl(var(--primary))" : undefined,
                    borderBottom: holiday ? `2px solid ${holidayColors?.border}` : undefined,
                  }}
                  title={holiday ? `${holiday.name} (${holiday.holidayType.replace("_", " ")})` : undefined}
                >
                  <div>{format(day, calendarViewMode === "week" ? "EEE" : "d")}</div>
                  {calendarViewMode === "week" && (
                    <div className={holiday ? "" : "text-muted-foreground"}>{format(day, "d")}</div>
                  )}
                  {holiday && calendarViewMode === "week" && (
                    <div className="text-[9px] font-medium truncate px-0.5" title={holiday.name}>
                      {holiday.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {slotsWithWindows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No production slots in this period
            </div>
          ) : (
            slotsWithWindows.map((item) => {
              const factory = getFactory(item.slot.job.factoryId);
              const barStyle = getBarStyle(item.startDate, item.endDate);
              
              return (
                <div
                  key={item.slot.id}
                  className="flex border-b last:border-b-0 hover:bg-muted/10"
                >
                  <div className="w-48 shrink-0 p-2 border-r flex flex-col justify-center">
                    <div className="font-medium text-sm truncate" style={{ color: item.jobColor }}>
                      {item.slot.job.jobNumber}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      Level {item.slot.level}
                      {factory && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 ml-1"
                          style={{
                            backgroundColor: factory.color ? `${factory.color}20` : undefined,
                            borderColor: factory.color || undefined,
                            color: factory.color || undefined,
                          }}
                        >
                          {factory.code}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 relative h-14">
                    <div className="absolute inset-0 flex">
                      {days.map((day) => {
                        const isToday = isSameDay(day, today);
                        const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                        const dateKey = format(day, "yyyy-MM-dd");
                        const holiday = holidaysByDate[dateKey];
                        const holidayColors = holiday ? HOLIDAY_COLORS[holiday.holidayType] || HOLIDAY_COLORS.OTHER : null;
                        
                        return (
                          <div
                            key={day.toISOString()}
                            className="flex-1 border-r last:border-r-0"
                            style={{
                              backgroundColor: holiday ? `${holidayColors?.bg}80` : isToday ? "hsl(var(--primary) / 0.05)" : isWeekend ? "hsl(var(--muted) / 0.3)" : undefined,
                            }}
                          />
                        );
                      })}
                    </div>

                    <div
                      onClick={() => onSlotClick(item.slot)}
                      className="absolute top-2 h-10 rounded cursor-pointer hover-elevate flex items-center text-xs font-medium shadow-md overflow-hidden"
                      style={{
                        left: barStyle.left,
                        width: barStyle.width,
                        backgroundColor: `${item.jobColor}60`,
                        border: `3px solid #16a34a`,
                        color: "white",
                      }}
                      title={`${item.slot.job.jobNumber} - Level ${item.slot.level}\nProduction Start: ${format(item.startDate, "dd MMM")} → End: ${format(item.endDate, "dd MMM")}\n${item.cycleDays} working days\n${item.slot.panelCount} panels`}
                      data-testid={`calendar-slot-${item.slot.id}`}
                    >
                      <div 
                        className="h-full flex items-center justify-center px-2 text-white font-bold shrink-0"
                        style={{
                          backgroundColor: "#16a34a",
                          minWidth: "fit-content",
                          borderRight: "2px solid white",
                        }}
                        title={`Production Start: ${format(item.startDate, "dd MMM yyyy")}`}
                      >
                        {format(item.startDate, "dd")}
                      </div>
                      <div className="flex-1 flex items-center justify-center px-1 min-w-0">
                        <span className="truncate font-semibold">
                          {item.slot.panelCount}p / {item.cycleDays}d
                        </span>
                      </div>
                      <div 
                        className="h-full flex items-center justify-center px-2 text-white font-bold shrink-0"
                        style={{
                          backgroundColor: "#dc2626",
                          minWidth: "fit-content",
                          borderLeft: "2px solid white",
                        }}
                        title={`Production End: ${format(item.endDate, "dd MMM yyyy")}`}
                      >
                        {format(item.endDate, "dd")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#16a34a" }} />
          <span>Start Date</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#dc2626" }} />
          <span>End Date</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary/10 border border-primary rounded" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: HOLIDAY_COLORS.RDO.bg, border: `1px solid ${HOLIDAY_COLORS.RDO.border}` }} />
          <span>RDO</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: HOLIDAY_COLORS.PUBLIC_HOLIDAY.bg, border: `1px solid ${HOLIDAY_COLORS.PUBLIC_HOLIDAY.border}` }} />
          <span>Public Holiday</span>
        </div>
        {cfmeuCalendarType && (
          <span className="text-primary font-medium">Calendar: {cfmeuCalendarType.replace("_", " ")}</span>
        )}
        <span className="ml-auto">Bars span full production window (working days). Click a bar to view panel details.</span>
      </div>
    </div>
  );
}
