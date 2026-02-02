import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DailyLog, LogRow, Job, User as UserType } from "@shared/schema";

interface SubmittedLog extends DailyLog {
  rows: (LogRow & { job?: Job })[];
  user: UserType;
}

export default function ManagerReviewPage() {
  const { toast } = useToast();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const { data: logs, isLoading } = useQuery<SubmittedLog[]>({
    queryKey: ["/api/daily-logs/submitted"],
  });

  const approveMutation = useMutation({
    mutationFn: async (logId: string) => {
      return apiRequest("POST", `/api/daily-logs/${logId}/approve`, { approve: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-logs/submitted"] });
      toast({ title: "Log approved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ logId, comment }: { logId: string; comment: string }) => {
      return apiRequest("POST", `/api/daily-logs/${logId}/approve`, { approve: false, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-logs/submitted"] });
      toast({ title: "Log rejected" });
      setRejectDialogOpen(false);
      setRejectComment("");
    },
    onError: () => {
      toast({ title: "Failed to reject", variant: "destructive" });
    },
  });

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (date: string | Date) => {
    return format(new Date(date), "HH:mm");
  };

  const openRejectDialog = (logId: string) => {
    setSelectedLogId(logId);
    setRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (selectedLogId) {
      rejectMutation.mutate({ logId: selectedLogId, comment: rejectComment });
    }
  };

  const calculateStats = (log: SubmittedLog) => {
    const totalMinutes = log.rows.reduce((sum, row) => sum + row.durationMin, 0);
    const idleMinutes = log.rows.reduce((sum, row) => sum + row.idleMin, 0);
    const editedRows = log.rows.filter((row) => row.isUserEdited).length;
    const missingJob = log.rows.filter((row) => !row.jobId).length;
    return { totalMinutes, idleMinutes, editedRows, missingJob };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-manager-review-title">
          Manager Review
        </h1>
        <p className="text-muted-foreground">
          Review and approve submitted daily logs
        </p>
      </div>

      {logs && logs.length > 0 ? (
        <div className="space-y-4">
          {logs.map((log) => {
            const stats = calculateStats(log);
            const isExpanded = expandedLogId === log.id;

            return (
              <Card key={log.id} data-testid={`card-log-${log.id}`}>
                <Collapsible open={isExpanded} onOpenChange={() => setExpandedLogId(isExpanded ? null : log.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <CardTitle className="text-lg">
                            {format(new Date(log.logDay), "EEEE, MMMM d, yyyy")}
                          </CardTitle>
                          <Badge variant="default">Submitted</Badge>
                        </div>
                        <CardDescription className="mt-1.5 flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {log.user.name || log.user.email}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {formatMinutes(stats.totalMinutes)} total
                          </span>
                          <span className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            {log.rows.length} entries
                          </span>
                          {stats.editedRows > 0 && (
                            <span className="flex items-center gap-1.5 text-amber-600">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {stats.editedRows} edited
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRejectDialog(log.id)}
                          disabled={rejectMutation.isPending}
                          data-testid={`button-reject-${log.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1.5 text-destructive" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(log.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${log.id}`}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          )}
                          Approve
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-expand-${log.id}`}>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
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
                              <TableHead>Project</TableHead>
                              <TableHead className="text-right w-20">Minutes</TableHead>
                              <TableHead className="w-16">Edited</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {log.rows.map((row) => (
                              <TableRow 
                                key={row.id} 
                                className={row.isUserEdited ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                              >
                                <TableCell className="font-mono text-sm">
                                  {formatTime(row.startAt)} - {formatTime(row.endAt)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">
                                    {row.app}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {row.fileName || "-"}
                                </TableCell>
                                <TableCell>
                                  {row.app === "revit"
                                    ? row.revitSheetNumber || row.revitViewName || "-"
                                    : row.acadLayoutName || "-"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-0.5">
                                    <span>{row.panelMark || "-"}</span>
                                    {row.isUserEdited && row.rawPanelMark !== row.panelMark && (
                                      <span className="text-xs text-muted-foreground line-through">
                                        {row.rawPanelMark}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-0.5">
                                    <span>{row.drawingCode || "-"}</span>
                                    {row.isUserEdited && row.rawDrawingCode !== row.drawingCode && (
                                      <span className="text-xs text-muted-foreground line-through">
                                        {row.rawDrawingCode}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {row.job?.code || row.job?.name || "-"}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {row.durationMin}
                                </TableCell>
                                <TableCell>
                                  {row.isUserEdited && (
                                    <Badge variant="secondary" className="text-xs">
                                      Edited
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">All caught up!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No logs pending review
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Daily Log</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. This will be visible to the user.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-reject-comment"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
