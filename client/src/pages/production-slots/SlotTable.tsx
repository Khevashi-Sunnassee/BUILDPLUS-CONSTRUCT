import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, AlertTriangle, Check, BookOpen, History, ChevronDown, ChevronRight, Briefcase, Building2, CalendarDays, Factory as FactoryIcon } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import type { Factory } from "@shared/schema";
import type { SlotTableProps, ProductionSlotWithDetails } from "./types";

function FactoryBadge({ factoryId, getFactory }: { factoryId: string | null | undefined; getFactory: (id: string | null | undefined) => Factory | undefined }) {
  const factory = getFactory(factoryId);
  if (!factory) return <span>-</span>;
  return (
    <Badge
      variant="outline"
      style={{
        backgroundColor: factory.color ? `${factory.color}20` : undefined,
        borderColor: factory.color || undefined,
        color: factory.color || undefined,
      }}
    >
      {factory.code}
    </Badge>
  );
}

function SlotActionButtons({
  slot,
  isManagerOrAdmin,
  openAdjustDialog,
  openHistory,
  bookSlotMutation,
  completeSlotMutation,
}: {
  slot: ProductionSlotWithDetails;
  isManagerOrAdmin: boolean;
  openAdjustDialog: (slot: ProductionSlotWithDetails) => void;
  openHistory: (slot: ProductionSlotWithDetails) => void;
  bookSlotMutation: { mutate: (id: string) => void; isPending: boolean };
  completeSlotMutation: { mutate: (id: string) => void; isPending: boolean };
}) {
  return (
    <div className="flex gap-1">
      {isManagerOrAdmin && slot.status !== "COMPLETED" && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => openAdjustDialog(slot)}
                data-testid={`button-adjust-${slot.id}`}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Adjust production date</p>
            </TooltipContent>
          </Tooltip>
          {slot.status !== "BOOKED" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => bookSlotMutation.mutate(slot.id)}
                  disabled={bookSlotMutation.isPending}
                  data-testid={`button-book-${slot.id}`}
                >
                  <BookOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Book slot for production</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => completeSlotMutation.mutate(slot.id)}
                disabled={completeSlotMutation.isPending}
                data-testid={`button-complete-${slot.id}`}
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Mark slot as completed</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => openHistory(slot)}
            data-testid={`button-history-${slot.id}`}
          >
            <History className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View change history</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function SlotRow({
  slot,
  allSlots,
  showJob,
  showFactory,
  showClient,
  isUrgent,
  ...actions
}: {
  slot: ProductionSlotWithDetails;
  allSlots: ProductionSlotWithDetails[];
  showJob: boolean;
  showFactory: boolean;
  showClient: boolean;
  isUrgent: boolean;
} & Pick<SlotTableProps, "isManagerOrAdmin" | "getDateColorClass" | "getSlotStatusBadge" | "openAdjustDialog" | "openPanelBreakdown" | "openHistory" | "bookSlotMutation" | "completeSlotMutation" | "getFactory">) {
  return (
    <TableRow 
      key={slot.id} 
      data-testid={`row-slot-${slot.id}`}
      className={isUrgent ? "ring-2 ring-amber-500 ring-inset" : ""}
      style={slot.job.productionSlotColor ? { 
        backgroundColor: isUrgent ? undefined : `${slot.job.productionSlotColor}15`,
        borderLeft: `4px solid ${slot.job.productionSlotColor}` 
      } : undefined}
    >
      <TableCell className={isUrgent ? "bg-amber-100 dark:bg-amber-900/30" : actions.getDateColorClass(slot)}>
        {format(new Date(slot.productionSlotDate), "dd/MM/yyyy")}
        {differenceInDays(new Date(slot.productionSlotDate), new Date()) < 0 && slot.status !== "COMPLETED" && (
          <AlertTriangle className="h-4 w-4 inline ml-1 text-red-600" />
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {format(addDays(new Date(slot.productionSlotDate), slot.job.productionDaysInAdvance ?? 10), "dd/MM/yyyy")}
      </TableCell>
      {showJob && <TableCell>{slot.job.jobNumber}</TableCell>}
      {showFactory && <TableCell><FactoryBadge factoryId={slot.job.factoryId} getFactory={actions.getFactory} /></TableCell>}
      {showClient && <TableCell>{slot.job.client || "-"}</TableCell>}
      <TableCell>{slot.buildingNumber}</TableCell>
      <TableCell>{slot.level}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {slot.predecessorSlotId ? (() => {
          const predSlot = allSlots.find((s: ProductionSlotWithDetails) => s.id === slot.predecessorSlotId);
          return predSlot ? `${predSlot.level} (${slot.relationship || "FS"})` : `- (${slot.relationship || "FS"})`;
        })() : "-"}
      </TableCell>
      <TableCell>
        <Button 
          variant="ghost" 
          className="p-0 h-auto text-blue-600 underline hover:text-blue-800" 
          onClick={() => actions.openPanelBreakdown(slot)}
          data-testid={`button-panel-count-${slot.id}`}
        >
          {slot.panelCount} panels
        </Button>
      </TableCell>
      <TableCell>{actions.getSlotStatusBadge(slot.status)}</TableCell>
      <TableCell>
        <SlotActionButtons
          slot={slot}
          isManagerOrAdmin={actions.isManagerOrAdmin}
          openAdjustDialog={actions.openAdjustDialog}
          openHistory={actions.openHistory}
          bookSlotMutation={actions.bookSlotMutation}
          completeSlotMutation={actions.completeSlotMutation}
        />
      </TableCell>
    </TableRow>
  );
}

export function SlotTable(props: SlotTableProps) {
  const {
    slots,
    groupBy,
    groupedSlots,
    expandedGroups,
    toggleGroup,
    isManagerOrAdmin,
    getDateColorClass,
    getSlotStatusBadge,
    openAdjustDialog,
    openPanelBreakdown,
    openHistory,
    bookSlotMutation,
    completeSlotMutation,
    getFactory,
    getTimelineDates,
    getSlotForDateRange,
    isWithinOnsiteWindow,
  } = props;

  const sharedRowProps = {
    isManagerOrAdmin,
    getDateColorClass,
    getSlotStatusBadge,
    openAdjustDialog,
    openPanelBreakdown,
    openHistory,
    bookSlotMutation,
    completeSlotMutation,
    getFactory,
  };

  if (groupBy !== "none" && groupedSlots) {
    return (
      <div className="space-y-2">
        {Object.entries(groupedSlots).map(([groupKey, { label, slots: groupSlots }]) => (
          <Collapsible 
            key={groupKey} 
            open={expandedGroups.has(groupKey)}
            onOpenChange={() => toggleGroup(groupKey)}
          >
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate" data-testid={`trigger-group-${groupKey}`}>
                {expandedGroups.has(groupKey) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {groupBy === "job" ? <Briefcase className="h-4 w-4" /> : groupBy === "week" ? <CalendarDays className="h-4 w-4" /> : groupBy === "factory" ? <FactoryIcon className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                <span className="font-medium">{label}</span>
                <Badge variant="secondary" className="ml-auto">{groupSlots.length} slot{groupSlots.length !== 1 ? "s" : ""}</Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 mt-2 border-l-2 pl-4">
                {groupBy === "job" && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg border" data-testid={`timeline-summary-${groupKey}`}>
                    <div className="text-sm font-medium mb-2 text-muted-foreground">Production Timeline vs Onsite Requirements</div>
                    <div className="grid grid-cols-5 gap-2">
                      {getTimelineDates().map(({ label, date, days }) => {
                        const nearestSlot = getSlotForDateRange(groupSlots, date);
                        const isUrgent = nearestSlot && isWithinOnsiteWindow(nearestSlot);
                        return (
                          <div 
                            key={days} 
                            className={`p-2 rounded text-center text-sm ${
                              isUrgent 
                                ? "bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500" 
                                : "bg-background border"
                            }`}
                          >
                            <div className="font-medium">{label}</div>
                            <div className="text-xs text-muted-foreground">{format(date, "dd/MM")}</div>
                            {nearestSlot ? (
                              <div className={`mt-1 font-semibold ${isUrgent ? "text-amber-700 dark:text-amber-400" : ""}`}>
                                Level {nearestSlot.level}
                              </div>
                            ) : (
                              <div className="mt-1 text-muted-foreground">-</div>
                            )}
                            {nearestSlot && (
                              <div className="text-xs text-muted-foreground">
                                {nearestSlot.panelCount} panels
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {groupSlots.some(s => isWithinOnsiteWindow(s)) && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Highlighted slots are within 10 days of onsite requirement</span>
                      </div>
                    )}
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Panel Production Due</TableHead>
                      <TableHead>Required Delivery Start</TableHead>
                      {groupBy !== "job" && <TableHead>Job</TableHead>}
                      {groupBy !== "factory" && <TableHead>Factory</TableHead>}
                      {groupBy !== "client" && <TableHead>Client</TableHead>}
                      <TableHead>Building</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Predecessor</TableHead>
                      <TableHead>Panels</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupSlots.map((slot) => (
                      <SlotRow
                        key={slot.id}
                        slot={slot}
                        allSlots={slots}
                        showJob={groupBy !== "job"}
                        showFactory={groupBy !== "factory"}
                        showClient={groupBy !== "client"}
                        isUrgent={isWithinOnsiteWindow(slot)}
                        {...sharedRowProps}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Panel Production Due</TableHead>
          <TableHead>Required Delivery Start</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Factory</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Building</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Predecessor</TableHead>
          <TableHead>Panels</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slots.map((slot) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            allSlots={slots}
            showJob
            showFactory
            showClient
            isUrgent={false}
            {...sharedRowProps}
          />
        ))}
      </TableBody>
    </Table>
  );
}
