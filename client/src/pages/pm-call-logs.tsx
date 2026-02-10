import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PM_CALL_LOGS_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  Plus,
  Calendar,
  User,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CallLogSummary {
  id: string;
  jobId: string;
  jobName: string | null;
  contactName: string;
  contactPhone: string | null;
  callDateTime: string;
  draftingConcerns: string | null;
  clientDesignChanges: string | null;
  issuesReported: string | null;
  installationProblems: string | null;
  notes: string | null;
  notifyManager: boolean;
  notifyClient: boolean;
  notifyProduction: boolean;
  updateProductionSchedule: boolean;
  updateDraftingSchedule: boolean;
  createdByName: string | null;
  createdAt: string;
}

export default function PmCallLogsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: jobs } = useQuery<{ id: string; name: string }[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: callLogs, isLoading } = useQuery<CallLogSummary[]>({
    queryKey: [PM_CALL_LOGS_ROUTES.LIST, jobFilter],
    queryFn: async () => {
      const url = jobFilter && jobFilter !== "all"
        ? `${PM_CALL_LOGS_ROUTES.LIST}?jobId=${jobFilter}`
        : PM_CALL_LOGS_ROUTES.LIST;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch call logs");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", PM_CALL_LOGS_ROUTES.BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PM_CALL_LOGS_ROUTES.LIST] });
      toast({ title: "Call log deleted" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete call log", variant: "destructive" });
    },
  });

  const hasIssues = (log: CallLogSummary) =>
    log.draftingConcerns || log.clientDesignChanges || log.issuesReported || log.installationProblems;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">PM Call Logs</h1>
          <p className="text-sm text-muted-foreground">
            Weekly project manager call logs for tracking project status and schedule updates
          </p>
        </div>
        <Button onClick={() => navigate("/pm-call-logs/new")} data-testid="button-new-call-log">
          <Plus className="h-4 w-4 mr-2" />
          New Call Log
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-[250px]" data-testid="select-job-filter">
            <SelectValue placeholder="Filter by job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            {jobs?.map((job) => (
              <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !callLogs?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Call Logs Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start recording weekly project calls to track project status and schedule changes.
            </p>
            <Button onClick={() => navigate("/pm-call-logs/new")} data-testid="button-empty-new-call">
              <Plus className="h-4 w-4 mr-2" />
              Record First Call
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {callLogs.map((log) => (
            <Card key={log.id} className="hover-elevate cursor-pointer" data-testid={`card-call-log-${log.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/pm-call-logs/${log.id}`}>
                        <span className="font-semibold text-base hover:underline" data-testid={`text-job-name-${log.id}`}>
                          {log.jobName || "Unknown Job"}
                        </span>
                      </Link>
                      {hasIssues(log) && (
                        <Badge variant="destructive" data-testid={`badge-issues-${log.id}`}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Issues
                        </Badge>
                      )}
                      {log.updateProductionSchedule && (
                        <Badge variant="secondary" data-testid={`badge-prod-update-${log.id}`}>
                          Production Updated
                        </Badge>
                      )}
                      {log.updateDraftingSchedule && (
                        <Badge variant="secondary" data-testid={`badge-draft-update-${log.id}`}>
                          Drafting Updated
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {log.contactName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(log.callDateTime).toLocaleDateString("en-AU", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        by {log.createdByName || "Unknown"}
                      </span>
                    </div>
                    {log.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{log.notes}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(log.id);
                    }}
                    data-testid={`button-delete-${log.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Call Log</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this call log and all associated level records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
