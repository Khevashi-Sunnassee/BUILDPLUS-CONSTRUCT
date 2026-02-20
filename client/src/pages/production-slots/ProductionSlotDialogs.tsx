import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, RefreshCw, Search, Layers, CalendarPlus, CalendarX, ChevronDown, ChevronRight } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import type { ProductionSlotDialogsProps } from "./types";

export function ProductionSlotDialogs({
  showGenerateDialog,
  setShowGenerateDialog,
  showLevelMismatchDialog,
  setShowLevelMismatchDialog,
  showDraftingUpdateDialog,
  setShowDraftingUpdateDialog,
  showDraftingWarningDialog,
  setShowDraftingWarningDialog,
  showAdjustDialog,
  setShowAdjustDialog,
  showPanelBreakdownDialog,
  setShowPanelBreakdownDialog,
  showHistoryDialog,
  setShowHistoryDialog,
  selectedSlot,
  jobsWithoutSlots,
  selectedJobsForGeneration,
  setSelectedJobsForGeneration,
  generateSlotsMutation,
  handleGenerateSlots,
  levelMismatchInfo,
  setPendingJobsForGeneration,
  setLevelMismatchInfo,
  handleLevelMismatchConfirm,
  handleDraftingUpdateConfirm,
  handleDraftingWarningConfirm,
  updateDraftingProgramMutation,
  adjustNewDate,
  setAdjustNewDate,
  adjustReason,
  setAdjustReason,
  adjustClientConfirmed,
  setAdjustClientConfirmed,
  adjustCascade,
  setAdjustCascade,
  handleAdjustSubmit,
  adjustSlotMutation,
  resetAdjustForm,
  panelsForSlot,
  panelEntries,
  panelSearchQuery,
  setPanelSearchQuery,
  panelStatusFilter,
  setPanelStatusFilter,
  panelTypeFilter,
  setPanelTypeFilter,
  expandedPanelTypes,
  togglePanelTypeGroup,
  filteredPanels,
  panelsByType,
  uniquePanelTypes,
  uniquePanelStatuses,
  isManagerOrAdmin,
  productionWindowDays,
  bookingPanelId,
  setBookingPanelId,
  bookingDate,
  setBookingDate,
  bookPanelMutation,
  unbookPanelMutation,
  slotAdjustments,
}: ProductionSlotDialogsProps) {
  return (
    <>
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Production Slots</DialogTitle>
            <DialogDescription>Select jobs to generate production slots for</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {jobsWithoutSlots.map((job) => (
              <div key={job.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`job-${job.id}`}
                  checked={selectedJobsForGeneration.includes(job.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedJobsForGeneration([...selectedJobsForGeneration, job.id]);
                    } else {
                      setSelectedJobsForGeneration(selectedJobsForGeneration.filter(id => id !== job.id));
                    }
                  }}
                />
                <Label htmlFor={`job-${job.id}`} className="flex-1 cursor-pointer">
                  {job.jobNumber} - {job.name}
                  <span className="text-muted-foreground text-sm block">
                    {job.client} | Start: {job.productionStartDate ? format(new Date(job.productionStartDate), "dd/MM/yyyy") : "-"}
                  </span>
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => handleGenerateSlots()} 
              disabled={selectedJobsForGeneration.length === 0 || generateSlotsMutation.isPending}
              data-testid="button-confirm-generate"
            >
              Generate for {selectedJobsForGeneration.length} Job(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLevelMismatchDialog} onOpenChange={(open) => { 
        if (!open) { 
          setPendingJobsForGeneration([]); 
          setLevelMismatchInfo(null); 
        }
        setShowLevelMismatchDialog(open); 
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Panel Level Mismatch Detected
            </DialogTitle>
            <DialogDescription>
              The job has more levels configured than panels registered
            </DialogDescription>
          </DialogHeader>
          {levelMismatchInfo && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-medium">{levelMismatchInfo.jobName}</p>
                <p className="text-sm">
                  The job contains <span className="font-semibold text-primary">{levelMismatchInfo.jobLevels} levels</span> (up to Level {levelMismatchInfo.highestJobLevel}) 
                  but you have only added panels to <span className="font-semibold text-primary">{levelMismatchInfo.panelLevels} levels</span> (up to Level {levelMismatchInfo.highestPanelLevel}).
                </p>
                <p className="text-sm text-muted-foreground">
                  Empty levels: {levelMismatchInfo.emptyLevels.join(", ")}
                </p>
              </div>
              <p className="text-sm">
                Do you wish to create production slots for only the panel levels (skip empty levels)?
              </p>
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowLevelMismatchDialog(false);
                setPendingJobsForGeneration([]);
                setLevelMismatchInfo(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="secondary"
              onClick={() => handleLevelMismatchConfirm(false)}
              disabled={generateSlotsMutation.isPending}
            >
              Create All Slots
            </Button>
            <Button 
              onClick={() => handleLevelMismatchConfirm(true)}
              disabled={generateSlotsMutation.isPending}
            >
              Skip Empty Levels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDraftingUpdateDialog} onOpenChange={setShowDraftingUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Update Drafting Program
            </DialogTitle>
            <DialogDescription>
              Production slots have been created/updated
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Would you like to update the drafting program to reflect the new production schedule?
            </p>
            <p className="text-sm text-muted-foreground">
              This will update all panels with "Not Scheduled" status to match the new production dates.
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleDraftingUpdateConfirm(false)}
            >
              No, Skip Update
            </Button>
            <Button 
              onClick={() => handleDraftingUpdateConfirm(true)}
              disabled={updateDraftingProgramMutation.isPending}
            >
              {updateDraftingProgramMutation.isPending ? "Updating..." : "Yes, Update Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDraftingWarningDialog} onOpenChange={setShowDraftingWarningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Drafting Program Out of Date
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              The drafting program will not be updated and may show outdated information.
            </p>
            <p className="text-sm font-medium">
              Are you sure you don't want to update the drafting program?
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleDraftingWarningConfirm(false)}
            >
              Yes, Leave Outdated
            </Button>
            <Button 
              onClick={() => handleDraftingWarningConfirm(true)}
              disabled={updateDraftingProgramMutation.isPending}
            >
              {updateDraftingProgramMutation.isPending ? "Updating..." : "Update Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdjustDialog} onOpenChange={(open) => { if (!open) resetAdjustForm(); setShowAdjustDialog(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Production Slot</DialogTitle>
            <DialogDescription>
              {selectedSlot && `${selectedSlot.job.jobNumber} - ${selectedSlot.level}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Production Due Date</Label>
              <Input 
                type="date" 
                value={adjustNewDate} 
                onChange={(e) => setAdjustNewDate(e.target.value)}
                data-testid="input-adjust-new-date"
              />
            </div>
            <div>
              <Label>Reason for Adjustment</Label>
              <Textarea 
                value={adjustReason} 
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Enter the reason for this date adjustment..."
                data-testid="input-adjust-reason"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="clientConfirmed"
                checked={adjustClientConfirmed}
                onCheckedChange={(checked) => setAdjustClientConfirmed(checked === true)}
              />
              <Label htmlFor="clientConfirmed">Client Confirmed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cascadeToLater"
                checked={adjustCascade}
                onCheckedChange={(checked) => setAdjustCascade(checked === true)}
              />
              <Label htmlFor="cascadeToLater">Cascade adjustment to later levels</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetAdjustForm(); setShowAdjustDialog(false); }}>Cancel</Button>
            <Button 
              onClick={handleAdjustSubmit} 
              disabled={adjustSlotMutation.isPending}
              data-testid="button-confirm-adjust"
            >
              Adjust Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPanelBreakdownDialog} onOpenChange={(open) => {
        setShowPanelBreakdownDialog(open);
        if (!open) {
          setPanelSearchQuery("");
          setPanelStatusFilter("all");
          setPanelTypeFilter("all");
          setBookingPanelId(null);
          setBookingDate("");
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Panel Breakdown & Assignment</DialogTitle>
            <DialogDescription>
              {selectedSlot && (
                <span>
                  {selectedSlot.job.jobNumber} - Level {selectedSlot.level} ({selectedSlot.panelCount} panels)
                  <br />
                  <span className="text-xs">
                    Panel Production Due: {format(new Date(selectedSlot.productionSlotDate), "dd/MM/yyyy")}
                    {" → "}
                    Required Delivery Start: {format(addDays(new Date(selectedSlot.productionSlotDate), selectedSlot.job.productionDaysInAdvance ?? 10), "dd/MM/yyyy")}
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by panel mark or type..."
                value={panelSearchQuery}
                onChange={(e) => setPanelSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-panel-search"
              />
            </div>
            <div>
              <Select value={panelTypeFilter} onValueChange={setPanelTypeFilter}>
                <SelectTrigger data-testid="select-panel-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniquePanelTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={panelStatusFilter} onValueChange={setPanelStatusFilter}>
                <SelectTrigger data-testid="select-panel-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniquePanelStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          
          <div className="max-h-[50vh] overflow-y-auto">
            {panelsForSlot.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No panels found for this level</p>
            ) : filteredPanels.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No panels match your search criteria</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(panelsByType).sort(([a], [b]) => a.localeCompare(b)).map(([type, panels]) => (
                  <Collapsible 
                    key={type}
                    open={expandedPanelTypes.has(type)}
                    onOpenChange={() => togglePanelTypeGroup(type)}
                  >
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate"
                        data-testid={`trigger-panel-type-${type}`}
                      >
                        {expandedPanelTypes.has(type) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Layers className="h-4 w-4" />
                        <span className="font-medium">{type}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {panels.length} panel{panels.length !== 1 ? "s" : ""}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {panels.filter(p => panelEntries[p.id]).length} booked
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-1 border-l-2 pl-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Panel Mark</TableHead>
                              <TableHead>Production Date</TableHead>
                              <TableHead>Load Width</TableHead>
                              <TableHead>Load Height</TableHead>
                              <TableHead>Thickness</TableHead>
                              <TableHead>Status</TableHead>
                              {selectedSlot?.status === "BOOKED" && isManagerOrAdmin && (
                                <TableHead className="w-20 text-center">Action</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {panels.map((panel) => {
                              const entry = panelEntries[panel.id];
                              const isBooked = !!entry;
                              return (
                                <TableRow key={panel.id} data-testid={`row-panel-${panel.id}`}>
                                  <TableCell className="font-medium">{panel.panelMark || "-"}</TableCell>
                                  <TableCell>
                                    {isBooked ? (
                                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {format(new Date(entry.productionDate), "dd/MM/yyyy")}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{panel.loadWidth || "-"}</TableCell>
                                  <TableCell>{panel.loadHeight || "-"}</TableCell>
                                  <TableCell>{panel.panelThickness || "-"}</TableCell>
                                  <TableCell>
                                    <Badge variant={isBooked ? "default" : "secondary"} className={isBooked ? "bg-blue-600" : ""}>
                                      {isBooked ? "BOOKED" : (panel.status || "NOT_STARTED")}
                                    </Badge>
                                  </TableCell>
                                  {selectedSlot?.status === "BOOKED" && isManagerOrAdmin && (
                                    <TableCell className="text-center">
                                      {isBooked ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => unbookPanelMutation.mutate(entry.entryId)}
                                              disabled={unbookPanelMutation.isPending}
                                              data-testid={`button-unbook-${panel.id}`}
                                            >
                                              <CalendarX className="h-4 w-4 text-red-500" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Remove panel from production schedule</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Popover open={bookingPanelId === panel.id} onOpenChange={(open) => {
                                          if (open) {
                                            setBookingPanelId(panel.id);
                                            setBookingDate("");
                                          } else {
                                            setBookingPanelId(null);
                                            setBookingDate("");
                                          }
                                        }}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <PopoverTrigger asChild>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  data-testid={`button-book-${panel.id}`}
                                                >
                                                  <CalendarPlus className="h-4 w-4 text-green-600" />
                                                </Button>
                                              </PopoverTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Book panel for production</p>
                                            </TooltipContent>
                                          </Tooltip>
                                          <PopoverContent className="w-auto p-3" align="end">
                                            <div className="space-y-2">
                                              <Label className="text-sm font-medium">Select Production Date</Label>
                                              <Input
                                                type="date"
                                                value={bookingDate}
                                                onChange={(e) => setBookingDate(e.target.value)}
                                                min={format(subDays(new Date(selectedSlot!.productionSlotDate), productionWindowDays), "yyyy-MM-dd")}
                                                max={format(new Date(selectedSlot!.productionSlotDate), "yyyy-MM-dd")}
                                                data-testid={`input-booking-date-${panel.id}`}
                                              />
                                              <p className="text-xs text-muted-foreground">
                                                {format(subDays(new Date(selectedSlot!.productionSlotDate), productionWindowDays), "dd/MM")} - {format(new Date(selectedSlot!.productionSlotDate), "dd/MM/yyyy")}
                                              </p>
                                              <Button
                                                size="sm"
                                                className="w-full"
                                                onClick={() => {
                                                  if (bookingDate) {
                                                    bookPanelMutation.mutate({
                                                      slotId: selectedSlot!.id,
                                                      panelId: panel.id,
                                                      productionDate: bookingDate,
                                                    });
                                                  }
                                                }}
                                                disabled={!bookingDate || bookPanelMutation.isPending}
                                                data-testid={`button-confirm-book-${panel.id}`}
                                              >
                                                {bookPanelMutation.isPending ? "Booking..." : "Book Panel"}
                                              </Button>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center gap-2">
            <div className="text-sm text-muted-foreground">
              Total: {panelsForSlot.length} panels | Showing: {filteredPanels.length} | Booked: {Object.keys(panelEntries).length}
            </div>
            <Button variant="outline" onClick={() => setShowPanelBreakdownDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjustment History</DialogTitle>
            <DialogDescription>
              {selectedSlot && `${selectedSlot.job.jobNumber} - ${selectedSlot.level}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {slotAdjustments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No adjustments recorded</p>
            ) : (
              slotAdjustments.map((adj) => (
                <div key={adj.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">
                      {format(new Date(adj.previousDate), "dd/MM/yyyy")} → {format(new Date(adj.newDate), "dd/MM/yyyy")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(adj.createdAt), "dd/MM/yyyy HH:mm")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{adj.reason}</p>
                  <div className="text-xs text-muted-foreground">
                    By: {adj.changedBy.email}
                    {adj.clientConfirmed && " | Client Confirmed"}
                    {adj.cascadedToOtherSlots && " | Cascaded"}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
