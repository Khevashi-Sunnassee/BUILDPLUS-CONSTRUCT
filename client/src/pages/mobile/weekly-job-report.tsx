import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WEEKLY_REPORTS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { FileText, Calendar, ChevronRight, ChevronLeft, Send, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface WeeklyJobReport {
  id: string;
  weekEnding: string;
  status: string;
  notes: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  job?: {
    id: string;
    jobNumber: string;
    name: string;
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  SUBMITTED: { label: "Submitted", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  APPROVED: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  REJECTED: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function MobileWeeklyJobReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<WeeklyJobReport | null>(null);

  const { data: myReports = [], isLoading: myLoading } = useQuery<WeeklyJobReport[]>({
    queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY],
  });

  const isManager = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { data: pendingReports = [], isLoading: pendingLoading } = useQuery<WeeklyJobReport[]>({
    queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING],
    enabled: isManager,
  });

  const submitMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_SUBMIT(reportId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      setSelectedReport(null);
    },
    onError: () => {
      toast({ title: "Failed to submit", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_APPROVE(reportId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      setSelectedReport(null);
    },
    onError: () => {
      toast({ title: "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_REJECT(reportId), { reason: "Rejected via mobile" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      setSelectedReport(null);
    },
    onError: () => {
      toast({ title: "Failed to reject", variant: "destructive" });
    },
  });

  const isLoading = myLoading || pendingLoading;
  const draftReports = myReports.filter(r => r.status === "DRAFT");
  const submittedReports = myReports.filter(r => r.status === "SUBMITTED");
  const approvedReports = myReports.filter(r => r.status === "APPROVED").slice(0, 5);

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Weekly Job Report">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-weekly-report-title">Weekly Reports</div>
            <div className="text-sm text-white/60">
              {myReports.length} {myReports.length === 1 ? 'report' : 'reports'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : myReports.length === 0 && pendingReports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No weekly reports yet</p>
            <p className="text-sm text-white/40">Reports will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {isManager && pendingReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Pending Approval ({pendingReports.length})
                </h2>
                <div className="space-y-3">
                  {pendingReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onSelect={() => setSelectedReport(report)}
                      showAuthor
                    />
                  ))}
                </div>
              </div>
            )}

            {draftReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Drafts ({draftReports.length})
                </h2>
                <div className="space-y-3">
                  {draftReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onSelect={() => setSelectedReport(report)}
                    />
                  ))}
                </div>
              </div>
            )}

            {submittedReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Submitted ({submittedReports.length})
                </h2>
                <div className="space-y-3">
                  {submittedReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onSelect={() => setSelectedReport(report)}
                    />
                  ))}
                </div>
              </div>
            )}

            {approvedReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Approved
                </h2>
                <div className="space-y-3">
                  {approvedReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onSelect={() => setSelectedReport(report)}
                      muted
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedReport && (
            <ReportDetailSheet
              report={selectedReport}
              isManager={isManager}
              onSubmit={() => submitMutation.mutate(selectedReport.id)}
              onApprove={() => approveMutation.mutate(selectedReport.id)}
              onReject={() => rejectMutation.mutate(selectedReport.id)}
              isSubmitting={submitMutation.isPending}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
              onClose={() => setSelectedReport(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function ReportCard({
  report,
  onSelect,
  muted = false,
  showAuthor = false,
}: {
  report: WeeklyJobReport;
  onSelect: () => void;
  muted?: boolean;
  showAuthor?: boolean;
}) {
  const status = statusConfig[report.status] || statusConfig.DRAFT;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/[0.03]" : "bg-white/5"
      )}
      data-testid={`report-${report.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-white">
            Week Ending {format(new Date(report.weekEnding), "dd MMM yyyy")}
          </h3>
          {report.job && (
            <p className="text-xs text-white/50 truncate">
              {report.job.jobNumber} - {report.job.name}
            </p>
          )}
          {showAuthor && report.createdBy && (
            <p className="text-xs text-white/50">
              By {report.createdBy.name || report.createdBy.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          Created {format(new Date(report.createdAt), "dd MMM")}
        </span>
      </div>
    </button>
  );
}

function ReportDetailSheet({
  report,
  isManager,
  onSubmit,
  onApprove,
  onReject,
  isSubmitting,
  isApproving,
  isRejecting,
  onClose,
}: {
  report: WeeklyJobReport;
  isManager: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  isSubmitting: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  onClose: () => void;
}) {
  const status = statusConfig[report.status] || statusConfig.DRAFT;

  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-left flex-1 text-white">
            Week Ending {format(new Date(report.weekEnding), "dd MMM yyyy")}
          </SheetTitle>
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
        </div>
        {report.job && (
          <p className="text-sm text-white/60 text-left">
            {report.job.jobNumber} - {report.job.name}
          </p>
        )}
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Created</label>
            <p className="text-sm text-white">{format(new Date(report.createdAt), "dd MMM yyyy")}</p>
          </div>
          {report.submittedAt && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Submitted</label>
              <p className="text-sm text-white">{format(new Date(report.submittedAt), "dd MMM yyyy")}</p>
            </div>
          )}
          {report.approvedAt && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Approved</label>
              <p className="text-sm text-white">{format(new Date(report.approvedAt), "dd MMM yyyy")}</p>
            </div>
          )}
          {report.createdBy && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Author</label>
              <p className="text-sm text-white">{report.createdBy.name || report.createdBy.email}</p>
            </div>
          )}
        </div>

        {report.notes && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Notes</label>
            <p className="text-sm text-white whitespace-pre-wrap">{report.notes}</p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 mt-4 space-y-2">
        {report.status === "DRAFT" && (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        )}

        {isManager && report.status === "SUBMITTED" && (
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={onApprove}
              disabled={isApproving || isRejecting}
            >
              <Check className="h-4 w-4 mr-2" />
              {isApproving ? "Approving..." : "Approve"}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={onReject}
              disabled={isApproving || isRejecting}
            >
              <X className="h-4 w-4 mr-2" />
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        )}

        <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
