import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { WEEKLY_REPORTS_ROUTES, JOBS_ROUTES, PRODUCTION_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Check, X, Trash2, Edit, Eye, ChevronDown, ChevronRight, User as UserIcon } from "lucide-react";
import { format, parseISO, addDays, getDay } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Job, User, WeeklyJobReport, WeeklyJobReportSchedule, ProductionSlot, GlobalSettings } from "@shared/schema";

interface WeeklyJobReportWithDetails extends WeeklyJobReport {
  projectManager: User;
  approvedBy: User | null;
  schedules: (WeeklyJobReportSchedule & { job: Job })[];
}

interface ScheduleItem {
  jobId: string;
  priority: number;
  levels7Days: string;
  levels14Days: string;
  levels21Days: string;
  levels28Days: string;
  siteProgress: string | null;
  currentLevelOnsite: string | null;
  scheduleStatus: string;
}

export default function WeeklyJobLogsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";
  
  const [showForm, setShowForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyJobReportWithDetails | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weekStartDate, setWeekStartDate] = useState("");
  const [weekEndDate, setWeekEndDate] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  
  const { data: myReports = [], isLoading: loadingMyReports } = useQuery<WeeklyJobReportWithDetails[]>({
    queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY],
  });

  const { data: allReports = [], isLoading: loadingAllReports } = useQuery<WeeklyJobReportWithDetails[]>({
    queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS],
    enabled: isManagerOrAdmin,
  });

  const { data: pendingReports = [], isLoading: loadingPending } = useQuery<WeeklyJobReportWithDetails[]>({
    queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING],
    enabled: isManagerOrAdmin,
  });

  const { data: globalSettings } = useQuery<GlobalSettings>({
    queryKey: [ADMIN_ROUTES.SETTINGS],
  });

  const configuredWeekStartDay = globalSettings?.weekStartDay ?? 1;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const calculateWeekBoundaries = (dateStr: string) => {
    if (!dateStr) return { weekStart: "", weekEnd: "" };
    const date = parseISO(dateStr);
    const currentDay = getDay(date);
    const daysToSubtract = (currentDay - configuredWeekStartDay + 7) % 7;
    const weekStart = addDays(date, -daysToSubtract);
    const weekEnd = addDays(weekStart, 6);
    return {
      weekStart: format(weekStart, "yyyy-MM-dd"),
      weekEnd: format(weekEnd, "yyyy-MM-dd"),
    };
  };

  useEffect(() => {
    if (reportDate && showForm) {
      const { weekStart, weekEnd } = calculateWeekBoundaries(reportDate);
      setWeekStartDate(weekStart);
      setWeekEndDate(weekEnd);
    }
  }, [reportDate, showForm, configuredWeekStartDay]);

  const handleWeekStartChange = (dateStr: string) => {
    if (dateStr) {
      const { weekStart, weekEnd } = calculateWeekBoundaries(dateStr);
      setWeekStartDate(weekStart);
      setWeekEndDate(weekEnd);
    }
  };

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const reportsByUser = isManagerOrAdmin ? allReports.reduce((acc, report) => {
    const pmId = report.projectManagerId;
    if (!acc[pmId]) {
      acc[pmId] = {
        user: report.projectManager,
        reports: []
      };
    }
    acc[pmId].reports.push(report);
    return acc;
  }, {} as Record<string, { user: User; reports: WeeklyJobReportWithDetails[] }>) : {};

  // Expand all user groups by default when data loads
  useEffect(() => {
    if (Object.keys(reportsByUser).length > 0) {
      setExpandedUsers(new Set(Object.keys(reportsByUser)));
    }
  }, [allReports.length]);

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  interface ProductionSlotWithJob extends ProductionSlot {
    job: Job;
  }

  const { data: productionSlots = [] } = useQuery<ProductionSlotWithJob[]>({
    queryKey: [PRODUCTION_ROUTES.SLOTS],
  });

  const getProductionSlotDate = (jobId: string, level: string | null): string | null => {
    if (!level) return null;
    const slot = productionSlots.find(s => s.jobId === jobId && s.level === level);
    return slot ? format(new Date(slot.productionSlotDate), "dd/MM/yyyy") : null;
  };

  const getProductionSlotRawDate = (jobId: string, level: string | null): Date | null => {
    if (!level) return null;
    const slot = productionSlots.find(s => s.jobId === jobId && s.level === level);
    return slot ? new Date(slot.productionSlotDate) : null;
  };

  const isWithinWarningWindow = (targetDate: Date, productionDate: Date | null): boolean => {
    if (!productionDate) return false;
    const diffDays = Math.abs(Math.ceil((productionDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)));
    return diffDays <= 10;
  };

  const getTargetDate = (baseDate: string, daysOffset: number): Date => {
    const base = new Date(baseDate);
    base.setDate(base.getDate() + daysOffset);
    return base;
  };
  
  // Filter to only active jobs
  const activeJobs = allJobs.filter((job) => job.status === "ACTIVE");

  const createReportMutation = useMutation({
    mutationFn: async (data: { reportDate: string; weekStartDate: string; weekEndDate: string; notes: string; schedules: ScheduleItem[] }) => {
      const response = await apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORTS, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      toast({ title: "Report created successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create report", description: error.message, variant: "destructive" });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { reportDate?: string; weekStartDate?: string; weekEndDate?: string; notes?: string; schedules?: ScheduleItem[] } }) => {
      const response = await apiRequest("PUT", WEEKLY_REPORTS_ROUTES.JOB_REPORT_BY_ID(id), data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      toast({ title: "Report updated successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update report", description: error.message, variant: "destructive" });
    },
  });

  const submitReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_SUBMIT(id), {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      toast({ title: "Report submitted for approval" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit report", description: error.message, variant: "destructive" });
    },
  });

  const approveReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_APPROVE(id), {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_APPROVED] });
      toast({ title: "Report approved" });
      setShowApprovalDialog(false);
      setSelectedReport(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to approve report", description: error.message, variant: "destructive" });
    },
  });

  const rejectReportMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_REJECT(id), { rejectionReason: reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      toast({ title: "Report rejected" });
      setShowApprovalDialog(false);
      setSelectedReport(null);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reject report", description: error.message, variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", WEEKLY_REPORTS_ROUTES.JOB_REPORT_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      toast({ title: "Report deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete report", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditMode(false);
    setSelectedReport(null);
    setReportDate(format(new Date(), "yyyy-MM-dd"));
    setWeekStartDate("");
    setWeekEndDate("");
    setGeneralNotes("");
    setSchedules([]);
  };

  const handleAddSchedule = () => {
    setSchedules([...schedules, {
      jobId: "",
      priority: schedules.length + 1,
      levels7Days: "",
      levels14Days: "",
      levels21Days: "",
      levels28Days: "",
      siteProgress: null,
      currentLevelOnsite: null,
      scheduleStatus: "ON_TRACK",
    }]);
  };

  const updateSchedule = (index: number, field: keyof ScheduleItem, value: string | number | null) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  };

  const removeSchedule = (index: number) => {
    const updated = schedules.filter((_, i) => i !== index);
    updated.forEach((s, i) => s.priority = i + 1);
    setSchedules(updated);
  };

  const handleSubmitForm = () => {
    if (!weekStartDate || !weekEndDate) {
      toast({ title: "Please specify week start and end dates", variant: "destructive" });
      return;
    }
    
    const startDateDay = getDay(parseISO(weekStartDate));
    if (startDateDay !== configuredWeekStartDay) {
      const { weekStart, weekEnd } = calculateWeekBoundaries(weekStartDate);
      setWeekStartDate(weekStart);
      setWeekEndDate(weekEnd);
      toast({ 
        title: "Week dates adjusted", 
        description: `Week start aligned to ${dayNames[configuredWeekStartDay]}. Please review and save again.`,
        variant: "default" 
      });
      return;
    }
    
    const data = {
      reportDate,
      weekStartDate,
      weekEndDate,
      notes: generalNotes,
      schedules: schedules.filter(s => s.jobId),
    };
    if (editMode && selectedReport) {
      updateReportMutation.mutate({ id: selectedReport.id, data });
    } else {
      createReportMutation.mutate(data);
    }
  };

  const handleEdit = (report: WeeklyJobReportWithDetails) => {
    setSelectedReport(report);
    setReportDate(report.reportDate);
    const { weekStart, weekEnd } = calculateWeekBoundaries(report.weekStartDate);
    setWeekStartDate(weekStart);
    setWeekEndDate(weekEnd);
    setGeneralNotes(report.notes || "");
    setSchedules(report.schedules.map(s => ({
      jobId: s.jobId,
      priority: s.priority,
      levels7Days: s.levels7Days || "",
      levels14Days: s.levels14Days || "",
      levels21Days: s.levels21Days || "",
      levels28Days: s.levels28Days || "",
      siteProgress: s.siteProgress,
      currentLevelOnsite: s.currentLevelOnsite,
      scheduleStatus: s.scheduleStatus || "ON_TRACK",
    })));
    setEditMode(true);
    setShowForm(true);
  };

  const handleView = (report: WeeklyJobReportWithDetails) => {
    setSelectedReport(report);
    setShowViewDialog(true);
  };

  const handleApprovalView = (report: WeeklyJobReportWithDetails) => {
    setSelectedReport(report);
    setShowApprovalDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary" data-testid="badge-status-draft">Draft</Badge>;
      case "SUBMITTED":
        return <Badge variant="default" className="bg-blue-500" data-testid="badge-status-submitted">Submitted</Badge>;
      case "APPROVED":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-status-approved">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" data-testid="badge-status-rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Weekly Job Logs</h1>
          <p className="text-muted-foreground">Submit weekly progress reports for your assigned jobs</p>
        </div>
        <Button onClick={() => setShowForm(true)} data-testid="button-new-report">
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      {isManagerOrAdmin && pendingReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-pending-approval-title">Pending Approval</CardTitle>
            <CardDescription>Reports awaiting your review</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Date</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Project Manager</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReports.map((report) => (
                  <TableRow key={report.id} data-testid={`row-pending-report-${report.id}`}>
                    <TableCell>{formatDate(report.reportDate)}</TableCell>
                    <TableCell>{formatDate(report.weekStartDate)} - {formatDate(report.weekEndDate)}</TableCell>
                    <TableCell>{report.projectManager?.name || report.projectManager?.email}</TableCell>
                    <TableCell>{report.schedules.length}</TableCell>
                    <TableCell>{report.submittedAt ? formatDate(report.submittedAt.toString().split("T")[0]) : "-"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleApprovalView(report)} data-testid={`button-review-${report.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isManagerOrAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-all-reports-title">All Reports by User</CardTitle>
            <CardDescription>Weekly job reports grouped by team member</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAllReports ? (
              <p>Loading...</p>
            ) : Object.keys(reportsByUser).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No reports yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(reportsByUser).map(([userId, { user: pmUser, reports }]) => (
                  <Collapsible 
                    key={userId} 
                    open={expandedUsers.has(userId)}
                    onOpenChange={() => toggleUserExpanded(userId)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate" data-testid={`trigger-user-${userId}`}>
                        {expandedUsers.has(userId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <UserIcon className="h-4 w-4" />
                        <span className="font-medium">{pmUser?.name || pmUser?.email || "Unknown User"}</span>
                        <Badge variant="secondary" className="ml-auto">{reports.length} report{reports.length !== 1 ? "s" : ""}</Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 border-l-2 pl-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Report Date</TableHead>
                              <TableHead>Week</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Jobs</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reports.map((report) => (
                              <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                                <TableCell>{formatDate(report.reportDate)}</TableCell>
                                <TableCell>{formatDate(report.weekStartDate)} - {formatDate(report.weekEndDate)}</TableCell>
                                <TableCell>{getStatusBadge(report.status)}</TableCell>
                                <TableCell>{report.schedules.length}</TableCell>
                                <TableCell className="space-x-2">
                                  <Button size="sm" variant="ghost" onClick={() => handleView(report)} data-testid={`button-view-${report.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {report.projectManagerId === user?.id && report.status === "DRAFT" && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => handleEdit(report)} data-testid={`button-edit-${report.id}`}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => submitReportMutation.mutate(report.id)} data-testid={`button-submit-${report.id}`}>
                                        <Send className="h-4 w-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReportMutation.mutate(report.id)} data-testid={`button-delete-${report.id}`}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
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
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-my-reports-title">My Reports</CardTitle>
            <CardDescription>Your weekly job report submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMyReports ? (
              <p>Loading...</p>
            ) : myReports.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No reports yet. Create your first weekly report.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Date</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myReports.map((report) => (
                    <TableRow key={report.id} data-testid={`row-my-report-${report.id}`}>
                      <TableCell>{formatDate(report.reportDate)}</TableCell>
                      <TableCell>{formatDate(report.weekStartDate)} - {formatDate(report.weekEndDate)}</TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell>{report.schedules.length}</TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => handleView(report)} data-testid={`button-view-${report.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {report.status === "DRAFT" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(report)} data-testid={`button-edit-${report.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => submitReportMutation.mutate(report.id)} data-testid={`button-submit-${report.id}`}>
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReportMutation.mutate(report.id)} data-testid={`button-delete-${report.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {report.status === "REJECTED" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(report)} data-testid={`button-edit-rejected-${report.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReportMutation.mutate(report.id)} data-testid={`button-delete-rejected-${report.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-form-title">{editMode ? "Edit Weekly Report" : "New Weekly Report"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Report Date</Label>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} data-testid="input-report-date" />
              </div>
              <div>
                <Label>Week Start</Label>
                <Input 
                  type="date" 
                  value={weekStartDate} 
                  onChange={(e) => handleWeekStartChange(e.target.value)} 
                  data-testid="input-week-start"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Aligned to {dayNames[configuredWeekStartDay]}
                </p>
              </div>
              <div>
                <Label>Week End</Label>
                <Input 
                  type="date" 
                  value={weekEndDate} 
                  readOnly 
                  className="bg-muted"
                  data-testid="input-week-end"
                />
                <p className="text-xs text-muted-foreground mt-1">Auto-calculated (7 days)</p>
              </div>
            </div>
            
            <div>
              <Label>General Notes</Label>
              <Textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Overall progress notes..." data-testid="input-general-notes" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-medium">Job Schedules</Label>
                <Button variant="outline" size="sm" onClick={handleAddSchedule} data-testid="button-add-schedule">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Job
                </Button>
              </div>

              {schedules.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No jobs added. Click "Add Job" to include jobs in this report.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1 p-0" />
                      <TableHead className="w-[200px]">Job</TableHead>
                      <TableHead>Current Level Onsite</TableHead>
                      <TableHead>7-Day Level</TableHead>
                      <TableHead>14-Day Level</TableHead>
                      <TableHead>21-Day Level</TableHead>
                      <TableHead>28-Day Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-[200px]">Notes</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule, index) => {
                      const jobId = schedule.jobId;
                      const statusColor = schedule.scheduleStatus === "RUNNING_BEHIND" ? "#ef4444" 
                        : schedule.scheduleStatus === "ON_HOLD" ? "#f97316" 
                        : schedule.scheduleStatus === "ON_TRACK" ? "#22c55e" 
                        : "transparent";
                      const baseDate = reportDate || format(new Date(), "yyyy-MM-dd");
                      
                      const currentProdDate = getProductionSlotRawDate(jobId, schedule.currentLevelOnsite);
                      const day7ProdDate = getProductionSlotRawDate(jobId, schedule.levels7Days);
                      const day14ProdDate = getProductionSlotRawDate(jobId, schedule.levels14Days);
                      const day21ProdDate = getProductionSlotRawDate(jobId, schedule.levels21Days);
                      const day28ProdDate = getProductionSlotRawDate(jobId, schedule.levels28Days);
                      
                      const isCurrentWarning = isWithinWarningWindow(getTargetDate(baseDate, 0), currentProdDate);
                      const is7DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 7), day7ProdDate);
                      const is14DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 14), day14ProdDate);
                      const is21DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 21), day21ProdDate);
                      const is28DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 28), day28ProdDate);
                      
                      return (
                      <TableRow key={index} data-testid={`row-schedule-${index}`}>
                        <TableCell className="w-1 p-0">
                          <div 
                            className="h-full w-1 min-h-[60px] rounded-r-sm"
                            style={{ backgroundColor: statusColor }}
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={schedule.jobId} onValueChange={(v) => updateSchedule(index, "jobId", v)}>
                            <SelectTrigger data-testid={`select-job-${index}`}>
                              <SelectValue placeholder="Select job" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeJobs.map((job) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobNumber} - {job.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={schedule.currentLevelOnsite || ""} onChange={(e) => updateSchedule(index, "currentLevelOnsite", e.target.value || null)} placeholder="e.g. L2" data-testid={`input-current-level-${index}`} className={isCurrentWarning ? "border-red-500" : ""} />
                          {schedule.currentLevelOnsite && getProductionSlotDate(jobId, schedule.currentLevelOnsite) && (
                            <div className={`text-xs mt-1 ${isCurrentWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                              {getProductionSlotDate(jobId, schedule.currentLevelOnsite)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input value={schedule.levels7Days} onChange={(e) => updateSchedule(index, "levels7Days", e.target.value)} placeholder="Level" data-testid={`input-day7-${index}`} className={is7DayWarning ? "border-red-500" : ""} />
                          {schedule.levels7Days && getProductionSlotDate(jobId, schedule.levels7Days) && (
                            <div className={`text-xs mt-1 ${is7DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                              {getProductionSlotDate(jobId, schedule.levels7Days)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input value={schedule.levels14Days} onChange={(e) => updateSchedule(index, "levels14Days", e.target.value)} placeholder="Level" data-testid={`input-day14-${index}`} className={is14DayWarning ? "border-red-500" : ""} />
                          {schedule.levels14Days && getProductionSlotDate(jobId, schedule.levels14Days) && (
                            <div className={`text-xs mt-1 ${is14DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                              {getProductionSlotDate(jobId, schedule.levels14Days)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input value={schedule.levels21Days} onChange={(e) => updateSchedule(index, "levels21Days", e.target.value)} placeholder="Level" data-testid={`input-day21-${index}`} className={is21DayWarning ? "border-red-500" : ""} />
                          {schedule.levels21Days && getProductionSlotDate(jobId, schedule.levels21Days) && (
                            <div className={`text-xs mt-1 ${is21DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                              {getProductionSlotDate(jobId, schedule.levels21Days)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input value={schedule.levels28Days} onChange={(e) => updateSchedule(index, "levels28Days", e.target.value)} placeholder="Level" data-testid={`input-day28-${index}`} className={is28DayWarning ? "border-red-500" : ""} />
                          {schedule.levels28Days && getProductionSlotDate(jobId, schedule.levels28Days) && (
                            <div className={`text-xs mt-1 ${is28DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                              {getProductionSlotDate(jobId, schedule.levels28Days)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select value={schedule.scheduleStatus} onValueChange={(v) => updateSchedule(index, "scheduleStatus", v)}>
                            <SelectTrigger data-testid={`select-status-${index}`} className="min-w-[130px]">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ON_TRACK">On Track</SelectItem>
                              <SelectItem value="RUNNING_BEHIND">Running Behind</SelectItem>
                              <SelectItem value="ON_HOLD">On Hold</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Textarea 
                            value={schedule.siteProgress || ""} 
                            onChange={(e) => updateSchedule(index, "siteProgress", e.target.value || null)} 
                            placeholder="Progress notes..." 
                            className="min-h-[60px] min-w-[180px]"
                            data-testid={`input-progress-${index}`} 
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeSchedule(index)} data-testid={`button-remove-schedule-${index}`}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel">Cancel</Button>
            <Button onClick={handleSubmitForm} disabled={createReportMutation.isPending || updateReportMutation.isPending} data-testid="button-save">
              {editMode ? "Update Report" : "Save Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showViewDialog} onOpenChange={(open) => { if (!open) { setShowViewDialog(false); setSelectedReport(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-view-title">Weekly Job Report</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg border">
                <Label className="text-muted-foreground text-sm">Report By</Label>
                <p className="font-semibold text-lg" data-testid="text-report-author">
                  {selectedReport.projectManager?.name || selectedReport.projectManager?.email || "Unknown User"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Report Date</Label>
                  <p className="font-medium">{formatDate(selectedReport.reportDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Week</Label>
                  <p className="font-medium">{formatDate(selectedReport.weekStartDate)} - {formatDate(selectedReport.weekEndDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedReport.status)}</p>
                </div>
              </div>
              {selectedReport.notes && (
                <div>
                  <Label className="text-muted-foreground">General Notes</Label>
                  <p className="mt-1">{selectedReport.notes}</p>
                </div>
              )}
              {selectedReport.rejectionReason && (
                <div className="p-3 bg-destructive/10 rounded-md">
                  <Label className="text-destructive">Rejection Reason</Label>
                  <p className="mt-1">{selectedReport.rejectionReason}</p>
                </div>
              )}
              {selectedReport.schedules.length > 0 && (
                <div>
                  <Label className="text-lg font-medium">Job Schedules</Label>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Current Level Onsite</TableHead>
                        <TableHead>7-Day</TableHead>
                        <TableHead>14-Day</TableHead>
                        <TableHead>21-Day</TableHead>
                        <TableHead>28-Day</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReport.schedules.map((schedule) => {
                        const jobId = schedule.jobId;
                        const baseDate = selectedReport.reportDate;
                        
                        const currentProdDate = getProductionSlotRawDate(jobId, schedule.currentLevelOnsite);
                        const day7ProdDate = getProductionSlotRawDate(jobId, schedule.levels7Days);
                        const day14ProdDate = getProductionSlotRawDate(jobId, schedule.levels14Days);
                        const day21ProdDate = getProductionSlotRawDate(jobId, schedule.levels21Days);
                        const day28ProdDate = getProductionSlotRawDate(jobId, schedule.levels28Days);
                        
                        const isCurrentWarning = isWithinWarningWindow(getTargetDate(baseDate, 0), currentProdDate);
                        const is7DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 7), day7ProdDate);
                        const is14DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 14), day14ProdDate);
                        const is21DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 21), day21ProdDate);
                        const is28DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 28), day28ProdDate);
                        
                        return (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">{schedule.job?.jobNumber} - {schedule.job?.name}</TableCell>
                          <TableCell className={isCurrentWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={isCurrentWarning ? "text-red-600 font-medium" : ""}>{schedule.currentLevelOnsite || "-"}</div>
                            {schedule.currentLevelOnsite && getProductionSlotDate(jobId, schedule.currentLevelOnsite) && (
                              <div className={`text-xs ${isCurrentWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.currentLevelOnsite)}</div>
                            )}
                          </TableCell>
                          <TableCell className={is7DayWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={is7DayWarning ? "text-red-600 font-medium" : ""}>{schedule.levels7Days || "-"}</div>
                            {schedule.levels7Days && getProductionSlotDate(jobId, schedule.levels7Days) && (
                              <div className={`text-xs ${is7DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.levels7Days)}</div>
                            )}
                          </TableCell>
                          <TableCell className={is14DayWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={is14DayWarning ? "text-red-600 font-medium" : ""}>{schedule.levels14Days || "-"}</div>
                            {schedule.levels14Days && getProductionSlotDate(jobId, schedule.levels14Days) && (
                              <div className={`text-xs ${is14DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.levels14Days)}</div>
                            )}
                          </TableCell>
                          <TableCell className={is21DayWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={is21DayWarning ? "text-red-600 font-medium" : ""}>{schedule.levels21Days || "-"}</div>
                            {schedule.levels21Days && getProductionSlotDate(jobId, schedule.levels21Days) && (
                              <div className={`text-xs ${is21DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.levels21Days)}</div>
                            )}
                          </TableCell>
                          <TableCell className={is28DayWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={is28DayWarning ? "text-red-600 font-medium" : ""}>{schedule.levels28Days || "-"}</div>
                            {schedule.levels28Days && getProductionSlotDate(jobId, schedule.levels28Days) && (
                              <div className={`text-xs ${is28DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.levels28Days)}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {schedule.scheduleStatus === "ON_TRACK" && <Badge variant="default" className="bg-green-600">On Track</Badge>}
                            {schedule.scheduleStatus === "RUNNING_BEHIND" && <Badge variant="default" className="bg-red-600">Running Behind</Badge>}
                            {schedule.scheduleStatus === "ON_HOLD" && <Badge variant="default" className="bg-orange-500">On Hold</Badge>}
                            {!schedule.scheduleStatus && "-"}
                          </TableCell>
                          <TableCell className="max-w-[250px] whitespace-pre-wrap">{schedule.siteProgress || "-"}</TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowViewDialog(false); setSelectedReport(null); }} data-testid="button-close-view">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApprovalDialog} onOpenChange={(open) => { if (!open) { setShowApprovalDialog(false); setSelectedReport(null); setRejectionReason(""); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-approval-title">Review Weekly Job Report</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg border">
                <Label className="text-muted-foreground text-sm">Report By</Label>
                <p className="font-semibold text-lg" data-testid="text-approval-author">
                  {selectedReport.projectManager?.name || selectedReport.projectManager?.email || "Unknown User"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Report Date</Label>
                  <p className="font-medium">{formatDate(selectedReport.reportDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Week</Label>
                  <p className="font-medium">{formatDate(selectedReport.weekStartDate)} - {formatDate(selectedReport.weekEndDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="font-medium">{selectedReport.submittedAt ? formatDate(selectedReport.submittedAt.toString().split("T")[0]) : "-"}</p>
                </div>
              </div>
              {selectedReport.notes && (
                <div>
                  <Label className="text-muted-foreground">General Notes</Label>
                  <p className="mt-1">{selectedReport.notes}</p>
                </div>
              )}
              {selectedReport.schedules.length > 0 && (
                <div>
                  <Label className="text-lg font-medium">Job Schedules</Label>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Current Level Onsite</TableHead>
                        <TableHead>7-Day</TableHead>
                        <TableHead>14-Day</TableHead>
                        <TableHead>21-Day</TableHead>
                        <TableHead>28-Day</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReport.schedules.map((schedule) => {
                        const jobId = schedule.jobId;
                        const baseDate = selectedReport.reportDate;
                        
                        const currentProdDate = getProductionSlotRawDate(jobId, schedule.currentLevelOnsite);
                        const day7ProdDate = getProductionSlotRawDate(jobId, schedule.levels7Days);
                        const day14ProdDate = getProductionSlotRawDate(jobId, schedule.levels14Days);
                        const day21ProdDate = getProductionSlotRawDate(jobId, schedule.levels21Days);
                        const day28ProdDate = getProductionSlotRawDate(jobId, schedule.levels28Days);
                        
                        const isCurrentWarning = isWithinWarningWindow(getTargetDate(baseDate, 0), currentProdDate);
                        const is7DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 7), day7ProdDate);
                        const is14DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 14), day14ProdDate);
                        const is21DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 21), day21ProdDate);
                        const is28DayWarning = isWithinWarningWindow(getTargetDate(baseDate, 28), day28ProdDate);
                        
                        return (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">{schedule.job?.jobNumber} - {schedule.job?.name}</TableCell>
                          <TableCell className={isCurrentWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={isCurrentWarning ? "text-red-600 font-medium" : ""}>{schedule.currentLevelOnsite || "-"}</div>
                            {schedule.currentLevelOnsite && getProductionSlotDate(jobId, schedule.currentLevelOnsite) && (
                              <div className={`text-xs ${isCurrentWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.currentLevelOnsite)}</div>
                            )}
                          </TableCell>
                          <TableCell className={is7DayWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={is7DayWarning ? "text-red-600 font-medium" : ""}>{schedule.levels7Days || "-"}</div>
                            {schedule.levels7Days && getProductionSlotDate(jobId, schedule.levels7Days) && (
                              <div className={`text-xs ${is7DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.levels7Days)}</div>
                            )}
                          </TableCell>
                          <TableCell className={is14DayWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={is14DayWarning ? "text-red-600 font-medium" : ""}>{schedule.levels14Days || "-"}</div>
                            {schedule.levels14Days && getProductionSlotDate(jobId, schedule.levels14Days) && (
                              <div className={`text-xs ${is14DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.levels14Days)}</div>
                            )}
                          </TableCell>
                          <TableCell className={is21DayWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={is21DayWarning ? "text-red-600 font-medium" : ""}>{schedule.levels21Days || "-"}</div>
                            {schedule.levels21Days && getProductionSlotDate(jobId, schedule.levels21Days) && (
                              <div className={`text-xs ${is21DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.levels21Days)}</div>
                            )}
                          </TableCell>
                          <TableCell className={is28DayWarning ? "bg-red-100 dark:bg-red-900/30" : ""}>
                            <div className={is28DayWarning ? "text-red-600 font-medium" : ""}>{schedule.levels28Days || "-"}</div>
                            {schedule.levels28Days && getProductionSlotDate(jobId, schedule.levels28Days) && (
                              <div className={`text-xs ${is28DayWarning ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{getProductionSlotDate(jobId, schedule.levels28Days)}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {schedule.scheduleStatus === "ON_TRACK" && <Badge variant="default" className="bg-green-600">On Track</Badge>}
                            {schedule.scheduleStatus === "RUNNING_BEHIND" && <Badge variant="default" className="bg-red-600">Running Behind</Badge>}
                            {schedule.scheduleStatus === "ON_HOLD" && <Badge variant="default" className="bg-orange-500">On Hold</Badge>}
                            {!schedule.scheduleStatus && "-"}
                          </TableCell>
                          <TableCell className="max-w-[250px] whitespace-pre-wrap">{schedule.siteProgress || "-"}</TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="pt-4 border-t">
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea 
                  value={rejectionReason} 
                  onChange={(e) => setRejectionReason(e.target.value)} 
                  placeholder="Provide a reason if rejecting this report..."
                  data-testid="input-rejection-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowApprovalDialog(false); setSelectedReport(null); setRejectionReason(""); }} data-testid="button-close-approval">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedReport && rejectReportMutation.mutate({ id: selectedReport.id, reason: rejectionReason || "No reason provided" })}
              disabled={rejectReportMutation.isPending}
              data-testid="button-reject"
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button 
              onClick={() => selectedReport && approveReportMutation.mutate(selectedReport.id)}
              disabled={approveReportMutation.isPending}
              data-testid="button-approve"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
