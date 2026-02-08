import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPhaseLabel, getStatusLabel } from "@shared/job-phases";
import type { JobAuditLog } from "@shared/schema";

export function AuditLogPanel({ jobId }: { jobId: string }) {
  const { data: logs, isLoading } = useQuery<JobAuditLog[]>({
    queryKey: ["/api/admin/jobs", jobId, "audit-log"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/jobs/${jobId}/audit-log`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No audit log entries yet.
      </div>
    );
  }

  function formatAction(action: string): string {
    switch (action) {
      case "JOB_CREATED": return "Job Created";
      case "JOB_UPDATED": return "Job Updated";
      case "PHASE_CHANGED": return "Phase Changed";
      case "STATUS_CHANGED": return "Status Changed";
      default: return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  function renderChangedFields(fields: Record<string, { from: any; to: any }> | null) {
    if (!fields || Object.keys(fields).length === 0) return null;
    const entries = Object.entries(fields).filter(
      ([key]) => !["updatedAt", "jobPhase"].includes(key)
    );
    if (entries.length === 0) return null;
    return (
      <div className="mt-1 space-y-0.5">
        {entries.map(([key, { from, to }]) => (
          <div key={key} className="text-xs text-muted-foreground">
            <span className="font-medium">{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()}</span>
            {": "}
            <span className="line-through opacity-60">{String(from ?? "—")}</span>
            {" → "}
            <span>{String(to ?? "—")}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      {logs.map((log) => (
        <div key={log.id} className="border rounded-md p-3 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {formatAction(log.action)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
          {(log.previousPhase || log.newPhase) && (log.action === "PHASE_CHANGED" || log.action === "STATUS_CHANGED") && (
            <div className="text-xs">
              {log.action === "PHASE_CHANGED" && (
                <span>
                  Phase: <span className="font-medium">{getPhaseLabel(log.previousPhase || "")}</span>
                  {" → "}
                  <span className="font-medium">{getPhaseLabel(log.newPhase || "")}</span>
                </span>
              )}
              {log.action === "STATUS_CHANGED" && log.previousStatus && log.newStatus && (
                <span>
                  Status: <span className="font-medium">{getStatusLabel(log.previousStatus)}</span>
                  {" → "}
                  <span className="font-medium">{getStatusLabel(log.newStatus)}</span>
                </span>
              )}
            </div>
          )}
          {log.changedFields && renderChangedFields(log.changedFields as Record<string, { from: any; to: any }>)}
          {log.changedByName && (
            <div className="text-xs text-muted-foreground">
              by {log.changedByName}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
