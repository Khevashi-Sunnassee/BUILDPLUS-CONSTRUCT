import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Save,
  Send,
  Merge,
  FileText,
  Edit2,
  Check,
  X,
  Loader2,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DailyLog, LogRow, Job, WorkType } from "@shared/schema";

interface DailyLogDetail extends DailyLog {
  rows: (LogRow & { job?: Job })[];
  user: { name: string; email: string };
}

export default function DailyReportDetailPage() {
  const [, params] = useRoute("/daily-reports/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});

  const logId = params?.id;

  const { data: log, isLoading } = useQuery<DailyLogDetail>({
    queryKey: ["/api/daily-logs", logId],
    enabled: !!logId,
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: workTypes } = useQuery<WorkType[]>({
    queryKey: ["/api/work-types"],
  });

  const updateRowMutation = useMutation({
    mutationFn: async ({ rowId, updates }: { rowId: string; updates: any }) => {
      return apiRequest("PATCH", `/api/log-rows/${rowId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-logs", logId] });
      toast({ title: "Row updated successfully" });
      setEditingRowId(null);
      setEditValues({});
    },
    onError: () => {
      toast({ title: "Failed to update row", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/daily-logs/${logId}/submit`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-logs", logId] });
      toast({ title: "Daily log submitted for approval" });
    },
    onError: () => {
      toast({ title: "Failed to submit", variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/daily-logs/${logId}/merge`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-logs", logId] });
      toast({ title: "Similar rows merged successfully" });
    },
    onError: () => {
      toast({ title: "Failed to merge rows", variant: "destructive" });
    },
  });

  const formatTime = (date: string | Date) => {
    return format(new Date(date), "HH:mm");
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PENDING: { variant: "secondary", label: "Pending" },
      SUBMITTED: { variant: "default", label: "Submitted" },
      APPROVED: { variant: "outline", label: "Approved" },
      REJECTED: { variant: "destructive", label: "Rejected" },
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const startEditing = (row: LogRow & { job?: any }) => {
    setEditingRowId(row.id);
    setEditValues({
      panelMark: row.panelMark || "",
      drawingCode: row.drawingCode || "",
      jobId: row.jobId || "",
      workTypeId: row.workTypeId ?? null,
      notes: row.notes || "",
    });
  };

  const cancelEditing = () => {
    setEditingRowId(null);
    setEditValues({});
  };

  const saveRow = () => {
    if (editingRowId) {
      updateRowMutation.mutate({ rowId: editingRowId, updates: editValues });
    }
  };

  const totalMinutes = log?.rows?.reduce((sum, row) => sum + row.durationMin, 0) || 0;
  const totalIdle = log?.rows?.reduce((sum, row) => sum + row.idleMin, 0) || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">Daily log not found</h3>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/daily-reports")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reports
        </Button>
      </div>
    );
  }

  const canEdit = log.status === "PENDING" || log.status === "REJECTED";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/daily-reports")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-log-date">
                {format(new Date(log.logDay), "EEEE, MMMM d, yyyy")}
              </h1>
              {getStatusBadge(log.status)}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {log.user?.name || log.user?.email} • Drafting
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => setLocation(`/manual-entry?date=${log.logDay}`)}
                data-testid="button-add-entry"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
              <Button
                variant="outline"
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending}
                data-testid="button-merge"
              >
                {mergeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Merge className="h-4 w-4 mr-2" />
                )}
                Merge Similar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={submitMutation.isPending} data-testid="button-submit-day">
                    {submitMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Day
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit for Approval?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will submit your daily log for manager review. Make sure all entries are correct before submitting.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => submitMutation.mutate()}>
                      Submit
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(totalMinutes)}</div>
            <p className="text-xs text-muted-foreground">{log.rows?.length || 0} entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Idle Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(totalIdle)}</div>
            <p className="text-xs text-muted-foreground">
              {totalMinutes > 0 ? Math.round((totalIdle / totalMinutes) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Active Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(totalMinutes - totalIdle)}</div>
            <p className="text-xs text-muted-foreground">
              {totalMinutes > 0 ? Math.round(((totalMinutes - totalIdle) / totalMinutes) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
          <CardDescription>
            {canEdit ? "Click the edit button to modify entries" : "This log has been submitted and cannot be edited"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Time</TableHead>
                  <TableHead className="w-20">App</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Sheet/Layout</TableHead>
                  <TableHead>Panel Mark</TableHead>
                  <TableHead>Drawing Code</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Work Type</TableHead>
                  <TableHead className="text-right w-20">Minutes</TableHead>
                  <TableHead>Notes</TableHead>
                  {canEdit && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.rows?.map((row) => (
                  <TableRow key={row.id} data-testid={`row-entry-${row.id}`}>
                    <TableCell className="font-mono text-sm">
                      {formatTime(row.startAt)} - {formatTime(row.endAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {row.app}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={row.fileName || ""}>
                      {row.fileName || "-"}
                    </TableCell>
                    <TableCell>
                      {row.app === "revit" ? (
                        row.revitSheetNumber ? `${row.revitSheetNumber}: ${row.revitSheetName || ""}` : row.revitViewName || "-"
                      ) : (
                        row.acadLayoutName || "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRowId === row.id ? (
                        <Input
                          value={editValues.panelMark}
                          onChange={(e) => setEditValues({ ...editValues, panelMark: e.target.value })}
                          className="h-8 w-24"
                          data-testid="input-panel-mark"
                        />
                      ) : (
                        <span className={!row.panelMark ? "text-muted-foreground" : ""}>
                          {row.panelMark || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRowId === row.id ? (
                        <Input
                          value={editValues.drawingCode}
                          onChange={(e) => setEditValues({ ...editValues, drawingCode: e.target.value })}
                          className="h-8 w-24"
                          data-testid="input-drawing-code"
                        />
                      ) : (
                        <span className={!row.drawingCode ? "text-muted-foreground" : ""}>
                          {row.drawingCode || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRowId === row.id ? (
                        <Select
                          value={editValues.jobId || "none"}
                          onValueChange={(v) => setEditValues({ ...editValues, jobId: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="h-8 w-32" data-testid="select-job">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {jobs?.map((j) => (
                              <SelectItem key={j.id} value={j.id}>
                                {j.code || j.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={!row.job ? "text-muted-foreground" : ""}>
                          {row.job?.code || row.job?.name || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRowId === row.id ? (
                        <Select
                          value={editValues.workTypeId !== undefined ? String(editValues.workTypeId) : "none"}
                          onValueChange={(v) => setEditValues({ ...editValues, workTypeId: v === "none" ? null : parseInt(v) })}
                        >
                          <SelectTrigger className="h-8 w-32" data-testid="select-work-type">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {workTypes?.map((wt) => (
                              <SelectItem key={wt.id} value={String(wt.id)}>
                                {wt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={!row.workTypeId ? "text-muted-foreground" : ""}>
                          {row.workTypeId ? workTypes?.find(wt => wt.id === row.workTypeId)?.name || "-" : "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.durationMin}
                      {row.idleMin > 0 && (
                        <span className="text-muted-foreground text-xs ml-1">
                          ({row.idleMin} idle)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRowId === row.id ? (
                        <Input
                          value={editValues.notes}
                          onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                          className="h-8 w-32"
                          placeholder="Add note..."
                          data-testid="input-notes"
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm truncate max-w-[100px] block">
                          {row.notes || "-"}
                        </span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        {editingRowId === row.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={saveRow}
                              disabled={updateRowMutation.isPending}
                              data-testid="button-save-row"
                            >
                              {updateRowMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={cancelEditing}
                              data-testid="button-cancel-edit"
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => startEditing(row)}
                            data-testid={`button-edit-${row.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(!log.rows || log.rows.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 10 : 9} className="text-center py-8 text-muted-foreground">
                      No time entries for this day
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
