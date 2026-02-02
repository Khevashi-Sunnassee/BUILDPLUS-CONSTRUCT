import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, AlertTriangle, Check, RefreshCw, BookOpen, ListPlus, Eye, History, ChevronDown, ChevronRight, Briefcase, Building2 } from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import type { Job, ProductionSlot, ProductionSlotAdjustment, User, PanelRegister } from "@shared/schema";

interface ProductionSlotWithDetails extends ProductionSlot {
  job: Job;
}

interface ProductionSlotAdjustmentWithDetails extends ProductionSlotAdjustment {
  changedBy: User;
}

type StatusFilter = "ALL" | "SCHEDULED" | "PENDING_UPDATE" | "BOOKED" | "COMPLETED";
type GroupBy = "none" | "job" | "client";

export default function ProductionSlotsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showPanelBreakdownDialog, setShowPanelBreakdownDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ProductionSlotWithDetails | null>(null);
  const [selectedJobsForGeneration, setSelectedJobsForGeneration] = useState<string[]>([]);
  
  const [adjustNewDate, setAdjustNewDate] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjustClientConfirmed, setAdjustClientConfirmed] = useState<boolean>(false);
  const [adjustCascade, setAdjustCascade] = useState<boolean>(false);

  const { data: slots = [], isLoading: loadingSlots } = useQuery<ProductionSlotWithDetails[]>({
    queryKey: ["/api/production-slots", { status: statusFilter !== "ALL" ? statusFilter : undefined, jobId: jobFilter !== "all" ? jobFilter : undefined, dateFrom: dateFromFilter || undefined, dateTo: dateToFilter || undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (jobFilter !== "all") params.append("jobId", jobFilter);
      if (dateFromFilter) params.append("dateFrom", dateFromFilter);
      if (dateToFilter) params.append("dateTo", dateToFilter);
      const response = await fetch(`/api/production-slots?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch production slots");
      return response.json();
    },
  });

  const { data: jobsWithoutSlots = [], isLoading: loadingJobsWithoutSlots } = useQuery<Job[]>({
    queryKey: ["/api/production-slots/jobs-without-slots"],
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    select: (data: any) => data.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name, client: j.client })),
  });

  const { data: slotAdjustments = [] } = useQuery<ProductionSlotAdjustmentWithDetails[]>({
    queryKey: ["/api/production-slots", selectedSlot?.id, "adjustments"],
    queryFn: async () => {
      if (!selectedSlot) return [];
      const response = await fetch(`/api/production-slots/${selectedSlot.id}/adjustments`);
      if (!response.ok) throw new Error("Failed to fetch adjustments");
      return response.json();
    },
    enabled: !!selectedSlot && showHistoryDialog,
  });

  const { data: panelsForSlot = [] } = useQuery<PanelRegister[]>({
    queryKey: ["/api/panels", { jobId: selectedSlot?.jobId, level: selectedSlot?.level }],
    queryFn: async () => {
      if (!selectedSlot) return [];
      const response = await fetch(`/api/panels?jobId=${selectedSlot.jobId}&level=${encodeURIComponent(selectedSlot.level)}`);
      if (!response.ok) throw new Error("Failed to fetch panels");
      return response.json();
    },
    enabled: !!selectedSlot && showPanelBreakdownDialog,
  });

  const generateSlotsMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/production-slots/generate/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots/jobs-without-slots"] });
      toast({ title: "Success", description: "Production slots generated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate slots", variant: "destructive" });
    },
  });

  const adjustSlotMutation = useMutation({
    mutationFn: async (data: { id: string; newDate: string; reason: string; clientConfirmed: boolean; cascadeToLater: boolean }) => {
      return apiRequest("POST", `/api/production-slots/${data.id}/adjust`, {
        newDate: data.newDate,
        reason: data.reason,
        clientConfirmed: data.clientConfirmed,
        cascadeToLater: data.cascadeToLater,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots"] });
      setShowAdjustDialog(false);
      resetAdjustForm();
      toast({ title: "Success", description: "Production slot adjusted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to adjust slot", variant: "destructive" });
    },
  });

  const bookSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/production-slots/${id}/book`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots"] });
      toast({ title: "Success", description: "Production slot booked successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to book slot", variant: "destructive" });
    },
  });

  const completeSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/production-slots/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-slots"] });
      toast({ title: "Success", description: "Production slot marked as completed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to complete slot", variant: "destructive" });
    },
  });

  const resetAdjustForm = () => {
    setAdjustNewDate("");
    setAdjustReason("");
    setAdjustClientConfirmed(false);
    setAdjustCascade(false);
    setSelectedSlot(null);
  };

  const openAdjustDialog = (slot: ProductionSlotWithDetails) => {
    setSelectedSlot(slot);
    setAdjustNewDate(format(new Date(slot.productionSlotDate), "yyyy-MM-dd"));
    setShowAdjustDialog(true);
  };

  const openPanelBreakdown = (slot: ProductionSlotWithDetails) => {
    setSelectedSlot(slot);
    setShowPanelBreakdownDialog(true);
  };

  const openHistory = (slot: ProductionSlotWithDetails) => {
    setSelectedSlot(slot);
    setShowHistoryDialog(true);
  };

  const handleGenerateSlots = async () => {
    for (const jobId of selectedJobsForGeneration) {
      await generateSlotsMutation.mutateAsync(jobId);
    }
    setShowGenerateDialog(false);
    setSelectedJobsForGeneration([]);
  };

  const handleAdjustSubmit = () => {
    if (!selectedSlot || !adjustNewDate || !adjustReason) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    adjustSlotMutation.mutate({
      id: selectedSlot.id,
      newDate: adjustNewDate,
      reason: adjustReason,
      clientConfirmed: adjustClientConfirmed,
      cascadeToLater: adjustCascade,
    });
  };

  const getSlotStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SCHEDULED: "secondary",
      PENDING_UPDATE: "outline",
      BOOKED: "default",
      COMPLETED: "outline",
    };
    const colors: Record<string, string> = {
      SCHEDULED: "",
      PENDING_UPDATE: "text-yellow-600",
      BOOKED: "bg-blue-600",
      COMPLETED: "text-green-600",
    };
    return <Badge variant={variants[status]} className={colors[status]}>{status.replace("_", " ")}</Badge>;
  };

  const getDateColorClass = (slot: ProductionSlotWithDetails): string => {
    if (slot.status === "COMPLETED") return "";
    const today = new Date();
    const slotDate = new Date(slot.productionSlotDate);
    const daysUntil = differenceInDays(slotDate, today);
    
    if (daysUntil < 0) return "text-red-600 font-semibold";
    if (daysUntil <= 5) return "text-orange-500 font-medium";
    return "";
  };

  const groupedByPanelType = (panels: PanelRegister[]) => {
    const groups: Record<string, number> = {};
    for (const panel of panels) {
      const type = panel.panelType || "Unknown";
      groups[type] = (groups[type] || 0) + 1;
    }
    return groups;
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const groupedSlots = (() => {
    if (groupBy === "none") return null;
    
    const groups: Record<string, { label: string; slots: ProductionSlotWithDetails[] }> = {};
    
    for (const slot of slots) {
      let key: string;
      let label: string;
      
      if (groupBy === "job") {
        key = slot.jobId;
        label = `${slot.job.jobNumber} - ${slot.job.name || ""}`;
      } else {
        key = slot.job.client || "No Client";
        label = slot.job.client || "No Client";
      }
      
      if (!groups[key]) {
        groups[key] = { label, slots: [] };
      }
      groups[key].slots.push(slot);
    }
    
    return groups;
  })();

  // Expand all groups by default when grouping changes
  useEffect(() => {
    if (groupedSlots) {
      setExpandedGroups(new Set(Object.keys(groupedSlots)));
    }
  }, [groupBy, slots.length]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Production Slots</h1>
          <p className="text-muted-foreground">Manage and schedule panel production by level</p>
        </div>
        {isManagerOrAdmin && jobsWithoutSlots.length > 0 && (
          <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-slots">
            <ListPlus className="h-4 w-4 mr-2" />
            Generate Slots ({jobsWithoutSlots.length} jobs ready)
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="PENDING_UPDATE">Pending Update</SelectItem>
                  <SelectItem value="BOOKED">Booked</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Job</Label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger data-testid="select-job-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {allJobs.map((job: any) => (
                    <SelectItem key={job.id} value={job.id}>{job.jobNumber} - {job.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger data-testid="select-group-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="job">Group by Job</SelectItem>
                  <SelectItem value="client">Group by Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date From</Label>
              <Input 
                type="date" 
                value={dateFromFilter} 
                onChange={(e) => setDateFromFilter(e.target.value)} 
                data-testid="input-date-from-filter"
              />
            </div>
            <div>
              <Label>Date To</Label>
              <Input 
                type="date" 
                value={dateToFilter} 
                onChange={(e) => setDateToFilter(e.target.value)} 
                data-testid="input-date-to-filter"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production Slots</CardTitle>
          <CardDescription>View and manage production slots ordered by date</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSlots ? (
            <div className="text-center py-8">Loading...</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No production slots found. {jobsWithoutSlots.length > 0 && "Click 'Generate Slots' to create slots for available jobs."}
            </div>
          ) : groupBy !== "none" && groupedSlots ? (
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
                      {groupBy === "job" ? <Briefcase className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                      <span className="font-medium">{label}</span>
                      <Badge variant="secondary" className="ml-auto">{groupSlots.length} slot{groupSlots.length !== 1 ? "s" : ""}</Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-2 border-l-2 pl-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Production Date</TableHead>
                            {groupBy !== "job" && <TableHead>Job</TableHead>}
                            {groupBy !== "client" && <TableHead>Client</TableHead>}
                            <TableHead>Building</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Panels</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupSlots.map((slot) => (
                            <TableRow key={slot.id} data-testid={`row-slot-${slot.id}`}>
                              <TableCell className={getDateColorClass(slot)}>
                                {format(new Date(slot.productionSlotDate), "dd/MM/yyyy")}
                                {differenceInDays(new Date(slot.productionSlotDate), new Date()) < 0 && slot.status !== "COMPLETED" && (
                                  <AlertTriangle className="h-4 w-4 inline ml-1 text-red-600" />
                                )}
                              </TableCell>
                              {groupBy !== "job" && <TableCell>{slot.job.jobNumber}</TableCell>}
                              {groupBy !== "client" && <TableCell>{slot.job.client || "-"}</TableCell>}
                              <TableCell>{slot.buildingNumber}</TableCell>
                              <TableCell>{slot.level}</TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  className="p-0 h-auto text-blue-600 underline hover:text-blue-800" 
                                  onClick={() => openPanelBreakdown(slot)}
                                  data-testid={`button-panel-count-${slot.id}`}
                                >
                                  {slot.panelCount} panels
                                </Button>
                              </TableCell>
                              <TableCell>{getSlotStatusBadge(slot.status)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {isManagerOrAdmin && slot.status !== "COMPLETED" && (
                                    <>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => openAdjustDialog(slot)}
                                        data-testid={`button-adjust-${slot.id}`}
                                      >
                                        <Calendar className="h-4 w-4" />
                                      </Button>
                                      {slot.status !== "BOOKED" && (
                                        <Button 
                                          size="sm" 
                                          variant="default"
                                          onClick={() => bookSlotMutation.mutate(slot.id)}
                                          disabled={bookSlotMutation.isPending}
                                          data-testid={`button-book-${slot.id}`}
                                        >
                                          <BookOpen className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => completeSlotMutation.mutate(slot.id)}
                                        disabled={completeSlotMutation.isPending}
                                        data-testid={`button-complete-${slot.id}`}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => openHistory(slot)}
                                    data-testid={`button-history-${slot.id}`}
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Production Date</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Panels</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((slot) => (
                  <TableRow key={slot.id} data-testid={`row-slot-${slot.id}`}>
                    <TableCell className={getDateColorClass(slot)}>
                      {format(new Date(slot.productionSlotDate), "dd/MM/yyyy")}
                      {differenceInDays(new Date(slot.productionSlotDate), new Date()) < 0 && slot.status !== "COMPLETED" && (
                        <AlertTriangle className="h-4 w-4 inline ml-1 text-red-600" />
                      )}
                    </TableCell>
                    <TableCell>{slot.job.jobNumber}</TableCell>
                    <TableCell>{slot.job.client || "-"}</TableCell>
                    <TableCell>{slot.buildingNumber}</TableCell>
                    <TableCell>{slot.level}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto text-blue-600 underline hover:text-blue-800" 
                        onClick={() => openPanelBreakdown(slot)}
                        data-testid={`button-panel-count-${slot.id}`}
                      >
                        {slot.panelCount} panels
                      </Button>
                    </TableCell>
                    <TableCell>{getSlotStatusBadge(slot.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isManagerOrAdmin && slot.status !== "COMPLETED" && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openAdjustDialog(slot)}
                              data-testid={`button-adjust-${slot.id}`}
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                            {slot.status !== "BOOKED" && (
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => bookSlotMutation.mutate(slot.id)}
                                disabled={bookSlotMutation.isPending}
                                data-testid={`button-book-${slot.id}`}
                              >
                                <BookOpen className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => completeSlotMutation.mutate(slot.id)}
                              disabled={completeSlotMutation.isPending}
                              data-testid={`button-complete-${slot.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => openHistory(slot)}
                          data-testid={`button-history-${slot.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
              onClick={handleGenerateSlots} 
              disabled={selectedJobsForGeneration.length === 0 || generateSlotsMutation.isPending}
              data-testid="button-confirm-generate"
            >
              Generate for {selectedJobsForGeneration.length} Job(s)
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
              <Label>New Production Date</Label>
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

      <Dialog open={showPanelBreakdownDialog} onOpenChange={setShowPanelBreakdownDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Panel Breakdown</DialogTitle>
            <DialogDescription>
              {selectedSlot && `${selectedSlot.job.jobNumber} - Level ${selectedSlot.level} (${selectedSlot.panelCount} panels)`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {panelsForSlot.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No panels found for this level</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Panel Mark</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Load Width</TableHead>
                    <TableHead>Load Height</TableHead>
                    <TableHead>Thickness</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panelsForSlot.map((panel) => (
                    <TableRow key={panel.id} data-testid={`row-panel-${panel.id}`}>
                      <TableCell className="font-medium">{panel.panelMark || "-"}</TableCell>
                      <TableCell>{panel.panelType || "-"}</TableCell>
                      <TableCell>{panel.loadWidth || "-"}</TableCell>
                      <TableCell>{panel.loadHeight || "-"}</TableCell>
                      <TableCell>{panel.panelThickness || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={panel.status === "COMPLETED" ? "default" : "secondary"}>
                          {panel.status || "NOT_STARTED"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center gap-2">
            <div className="text-sm text-muted-foreground">
              Summary: {Object.entries(groupedByPanelType(panelsForSlot)).map(([type, count]) => `${type}: ${count}`).join(", ")}
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
    </div>
  );
}
