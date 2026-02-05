import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { REO_SCHEDULE_ROUTES, JOBS_ROUTES, PROCUREMENT_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronDown, ChevronRight, Briefcase, Search, FileText, 
  Cpu, CheckCircle2, XCircle, Clock, ShoppingCart, Loader2, Plus
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Job, PanelRegister, ReoSchedule, ReoScheduleItem, ReoScheduleWithDetails, Supplier } from "@shared/schema";

interface IfcPanelWithSchedule extends PanelRegister {
  job: Job;
  reoSchedule?: ReoSchedule | null;
}

export default function ProcurementReoSchedulingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";

  const [jobFilter, setJobFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set());
  
  const [showScheduleBuilderDialog, setShowScheduleBuilderDialog] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<IfcPanelWithSchedule | null>(null);
  const [scheduleNotes, setScheduleNotes] = useState("");
  
  const [showScheduleViewDialog, setShowScheduleViewDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ReoScheduleWithDetails | null>(null);
  
  const [showPoDialog, setShowPoDialog] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [poNotes, setPoNotes] = useState("");

  const { data: ifcPanels = [], isLoading } = useQuery<IfcPanelWithSchedule[]>({
    queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS, { jobId: jobFilter !== "all" ? jobFilter : undefined }],
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
    select: (data: any) => data.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name })),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_ACTIVE],
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: { panelId: string; notes?: string }) => {
      const response = await apiRequest("POST", REO_SCHEDULE_ROUTES.LIST, data);
      return response as unknown as ReoSchedule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS] });
      setShowScheduleBuilderDialog(false);
      setSelectedPanel(null);
      setScheduleNotes("");
      toast({ title: "Success", description: "Reo schedule created successfully" });
      openScheduleView(data.id);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create reo schedule", variant: "destructive" });
    },
  });

  const processScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      return apiRequest("POST", REO_SCHEDULE_ROUTES.PROCESS(scheduleId), {});
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS] });
      toast({ title: "Success", description: `AI processing completed - ${data.itemsCreated || 0} items extracted` });
      if (data.scheduleId) {
        await openScheduleView(data.scheduleId);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to process with AI", variant: "destructive" });
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ scheduleId, itemId, status }: { scheduleId: string; itemId: string; status: string }) => {
      return apiRequest("PATCH", REO_SCHEDULE_ROUTES.ITEM_BY_ID(scheduleId, itemId), { status });
    },
    onSuccess: () => {
      if (selectedSchedule) {
        openScheduleView(selectedSchedule.id);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update item status", variant: "destructive" });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ scheduleId, itemIds, status }: { scheduleId: string; itemIds: string[]; status: string }) => {
      return apiRequest("PATCH", REO_SCHEDULE_ROUTES.ITEMS_BULK_STATUS(scheduleId), { itemIds, status });
    },
    onSuccess: () => {
      if (selectedSchedule) {
        openScheduleView(selectedSchedule.id);
      }
      toast({ title: "Success", description: "Item statuses updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update item statuses", variant: "destructive" });
    },
  });

  const createPoMutation = useMutation({
    mutationFn: async ({ scheduleId, supplierId, itemIds, notes }: { scheduleId: string; supplierId: string; itemIds: string[]; notes?: string }) => {
      return apiRequest("POST", REO_SCHEDULE_ROUTES.CREATE_PO(scheduleId), { supplierId, itemIds, notes });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [REO_SCHEDULE_ROUTES.IFC_PANELS] });
      setShowPoDialog(false);
      setSelectedSupplierId("");
      setPoNotes("");
      if (selectedSchedule) {
        openScheduleView(selectedSchedule.id);
      }
      toast({ 
        title: "Purchase Order Created", 
        description: `PO ${data.purchaseOrder?.poNumber || ""} has been created` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create purchase order", variant: "destructive" });
    },
  });

  const openScheduleView = async (scheduleId: string) => {
    try {
      const schedule = await apiRequest("GET", REO_SCHEDULE_ROUTES.BY_ID(scheduleId)) as unknown as ReoScheduleWithDetails;
      setSelectedSchedule(schedule);
      setShowScheduleViewDialog(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load schedule", variant: "destructive" });
    }
  };

  const filteredPanels = ifcPanels.filter(panel => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!panel.panelMark?.toLowerCase().includes(query) && 
          !panel.job?.name?.toLowerCase().includes(query) &&
          !panel.job?.jobNumber?.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  const groupedPanels = filteredPanels.reduce<Record<string, IfcPanelWithSchedule[]>>((acc, panel) => {
    const jobKey = panel.job?.id || "unknown";
    if (!acc[jobKey]) acc[jobKey] = [];
    acc[jobKey].push(panel);
    return acc;
  }, {});

  const toggleGroupExpansion = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const togglePanelSelection = (panelId: string) => {
    const newSelected = new Set(selectedPanels);
    if (newSelected.has(panelId)) {
      newSelected.delete(panelId);
    } else {
      newSelected.add(panelId);
    }
    setSelectedPanels(newSelected);
  };

  const handleCreateSchedule = (panel: IfcPanelWithSchedule) => {
    setSelectedPanel(panel);
    setScheduleNotes("");
    setShowScheduleBuilderDialog(true);
  };

  const handleSubmitSchedule = () => {
    if (!selectedPanel) return;
    createScheduleMutation.mutate({
      panelId: selectedPanel.id,
      notes: scheduleNotes || undefined,
    });
  };

  const getScheduleStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
      case "PROCESSING":
        return <Badge variant="outline" className="gap-1 text-blue-600"><Loader2 className="w-3 h-3 animate-spin" /> Processing</Badge>;
      case "COMPLETED":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>;
      case "FAILED":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="procurement-reo-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="procurement-reo-scheduling-page">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Procurement Manager - Reo Scheduling
          </CardTitle>
          <CardDescription>
            View IFC-approved panels, extract reinforcement schedules using AI, and create purchase orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search panels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-panels"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Job:</Label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-job-filter">
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {allJobs.map((job: any) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredPanels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="no-panels-message">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No IFC-approved panels found</p>
              <p className="text-sm mt-2">Panels must have production approval (IFC status) to appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedPanels).map(([jobId, panels]) => {
                const job = panels[0]?.job;
                const isExpanded = expandedGroups.has(jobId);
                const panelsWithSchedule = panels.filter(p => p.reoSchedule);
                const completedSchedules = panels.filter(p => p.reoSchedule?.status === "COMPLETED");

                return (
                  <Collapsible key={jobId} open={isExpanded} onOpenChange={() => toggleGroupExpansion(jobId)}>
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate"
                        data-testid={`job-group-${jobId}`}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Briefcase className="w-4 h-4" />
                          <span className="font-medium">{job?.jobNumber || "Unknown"}</span>
                          <span className="text-muted-foreground">- {job?.name || "Unknown Job"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{panels.length} panels</Badge>
                          <Badge variant="secondary">{panelsWithSchedule.length} scheduled</Badge>
                          <Badge variant="default" className="bg-green-600">{completedSchedules.length} completed</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border rounded-lg mt-2 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">Select</TableHead>
                              <TableHead>Panel Mark</TableHead>
                              <TableHead>Level</TableHead>
                              <TableHead>Dimensions</TableHead>
                              <TableHead>IFC Approved</TableHead>
                              <TableHead>Reo Schedule</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {panels.map(panel => (
                              <TableRow key={panel.id} data-testid={`panel-row-${panel.id}`}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedPanels.has(panel.id)}
                                    onCheckedChange={() => togglePanelSelection(panel.id)}
                                    data-testid={`checkbox-panel-${panel.id}`}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{panel.panelMark || "-"}</TableCell>
                                <TableCell>{panel.level || "-"}</TableCell>
                                <TableCell>
                                  {panel.loadWidth && panel.loadHeight 
                                    ? `${panel.loadWidth} × ${panel.loadHeight}`
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {panel.approvedAt 
                                    ? format(parseISO(String(panel.approvedAt)), "dd/MM/yyyy")
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {getScheduleStatusBadge(panel.reoSchedule?.status)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {panel.reoSchedule ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => openScheduleView(panel.reoSchedule!.id)}
                                        data-testid={`button-view-schedule-${panel.id}`}
                                      >
                                        <FileText className="w-4 h-4 mr-1" />
                                        View
                                      </Button>
                                      {panel.reoSchedule.status === "PENDING" && (
                                        <Button 
                                          size="sm" 
                                          variant="default"
                                          onClick={() => processScheduleMutation.mutate(panel.reoSchedule!.id)}
                                          disabled={processScheduleMutation.isPending}
                                          data-testid={`button-process-${panel.id}`}
                                        >
                                          <Cpu className="w-4 h-4 mr-1" />
                                          Process
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      variant="default"
                                      onClick={() => handleCreateSchedule(panel)}
                                      data-testid={`button-create-schedule-${panel.id}`}
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Create Schedule
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showScheduleBuilderDialog} onOpenChange={setShowScheduleBuilderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Reo Schedule</DialogTitle>
            <DialogDescription>
              Create a reinforcement schedule for panel {selectedPanel?.panelMark}. 
              You can then process it with AI to extract reo items from the IFC drawing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Panel</Label>
              <Input value={selectedPanel?.panelMark || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Job</Label>
              <Input 
                value={selectedPanel?.job ? `${selectedPanel.job.jobNumber} - ${selectedPanel.job.name}` : ""} 
                disabled 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-notes">Notes (optional)</Label>
              <Textarea
                id="schedule-notes"
                placeholder="Any notes for this schedule..."
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                data-testid="textarea-schedule-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowScheduleBuilderDialog(false)}
              data-testid="button-cancel-schedule"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitSchedule}
              disabled={createScheduleMutation.isPending}
              data-testid="button-submit-schedule"
            >
              {createScheduleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Schedule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScheduleViewDialog} onOpenChange={setShowScheduleViewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Reo Schedule - {selectedSchedule?.panel?.panelMark}
              {getScheduleStatusBadge(selectedSchedule?.status)}
            </DialogTitle>
            <DialogDescription>
              View and manage reinforcement schedule items
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedSchedule?.status === "PENDING" && (
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <p className="text-muted-foreground mb-3">Schedule has not been processed yet</p>
                <Button 
                  onClick={() => {
                    processScheduleMutation.mutate(selectedSchedule.id);
                    setShowScheduleViewDialog(false);
                  }}
                  disabled={processScheduleMutation.isPending}
                  data-testid="button-process-schedule"
                >
                  <Cpu className="w-4 h-4 mr-2" />
                  Process with AI
                </Button>
              </div>
            )}
            {selectedSchedule?.status === "PROCESSING" && (
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                <p className="text-blue-600">Processing with AI... This may take a moment.</p>
              </div>
            )}
            {selectedSchedule?.status === "FAILED" && (
              <div className="bg-destructive/10 p-4 rounded-lg">
                <p className="text-destructive font-medium">Processing failed</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedSchedule.notes}</p>
                <Button 
                  variant="outline" 
                  className="mt-3"
                  onClick={() => {
                    processScheduleMutation.mutate(selectedSchedule.id);
                    setShowScheduleViewDialog(false);
                  }}
                  data-testid="button-retry-process"
                >
                  Retry Processing
                </Button>
              </div>
            )}
            {selectedSchedule?.status === "COMPLETED" && selectedSchedule.items && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      {selectedSchedule.items.length} items extracted
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        {selectedSchedule.items.filter(i => i.status === "APPROVED").length} approved
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="w-3 h-3" />
                        {selectedSchedule.items.filter(i => i.status === "PENDING").length} pending
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const pendingItems = selectedSchedule.items?.filter(i => i.status === "PENDING") || [];
                        if (pendingItems.length > 0) {
                          bulkUpdateStatusMutation.mutate({
                            scheduleId: selectedSchedule.id,
                            itemIds: pendingItems.map(i => i.id),
                            status: "APPROVED"
                          });
                        }
                      }}
                      disabled={bulkUpdateStatusMutation.isPending || !selectedSchedule.items?.some(i => i.status === "PENDING")}
                      data-testid="button-approve-all"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve All Pending
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      disabled={!selectedSchedule.items?.some(i => i.status === "APPROVED")}
                      onClick={() => setShowPoDialog(true)}
                      data-testid="button-create-po"
                    >
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      Create PO
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Bar Size</TableHead>
                        <TableHead>Shape</TableHead>
                        <TableHead>Length (mm)</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Weight (kg)</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSchedule.items.map((item: ReoScheduleItem) => (
                        <TableRow key={item.id} data-testid={`item-row-${item.id}`}>
                          <TableCell>
                            {item.status === "APPROVED" ? (
                              <Badge variant="default" className="gap-1 bg-green-600">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </Badge>
                            ) : item.status === "REJECTED" ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="w-3 h-3" /> Rejected
                              </Badge>
                            ) : item.status === "ORDERED" ? (
                              <Badge variant="default" className="gap-1 bg-blue-600">
                                <ShoppingCart className="w-3 h-3" /> Ordered
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <Clock className="w-3 h-3" /> Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.reoType}</TableCell>
                          <TableCell>{item.barSize || "-"}</TableCell>
                          <TableCell>{item.barShape || "-"}</TableCell>
                          <TableCell>{item.length || "-"}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.weight || "-"}</TableCell>
                          <TableCell>{item.zone || "-"}</TableCell>
                          <TableCell className="text-right">
                            {item.status === "PENDING" && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-green-600 hover:text-green-700"
                                  onClick={() => updateItemStatusMutation.mutate({
                                    scheduleId: selectedSchedule.id,
                                    itemId: item.id,
                                    status: "APPROVED"
                                  })}
                                  disabled={updateItemStatusMutation.isPending}
                                  data-testid={`button-approve-${item.id}`}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => updateItemStatusMutation.mutate({
                                    scheduleId: selectedSchedule.id,
                                    itemId: item.id,
                                    status: "REJECTED"
                                  })}
                                  disabled={updateItemStatusMutation.isPending}
                                  data-testid={`button-reject-${item.id}`}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Purchase Order Dialog */}
      <Dialog open={showPoDialog} onOpenChange={setShowPoDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Create a purchase order for approved reo items from {selectedSchedule?.panel?.panelMark || "selected panel"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select 
                value={selectedSupplierId} 
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger data-testid="select-supplier">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-notes">Notes (optional)</Label>
              <Textarea
                id="po-notes"
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                placeholder="Add any notes for this purchase order..."
                rows={3}
                data-testid="input-po-notes"
              />
            </div>
            {selectedSchedule && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>{selectedSchedule.items?.filter(i => i.status === "APPROVED").length || 0}</strong> approved items will be added to this PO
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPoDialog(false);
                setSelectedSupplierId("");
                setPoNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedSchedule || !selectedSupplierId) return;
                const approvedItemIds = selectedSchedule.items
                  ?.filter(i => i.status === "APPROVED")
                  .map(i => i.id) || [];
                createPoMutation.mutate({
                  scheduleId: selectedSchedule.id,
                  supplierId: selectedSupplierId,
                  itemIds: approvedItemIds,
                  notes: poNotes || undefined
                });
              }}
              disabled={!selectedSupplierId || createPoMutation.isPending}
              data-testid="button-confirm-create-po"
            >
              {createPoMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Create Purchase Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
