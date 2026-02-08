import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PANELS_ROUTES } from "@shared/api-routes";
import { PANEL_LIFECYCLE_LABELS } from "@shared/schema";

export function PanelAuditLogTab({ panelId }: { panelId: string }) {
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: [PANELS_ROUTES.AUDIT_LOGS(panelId)],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    const user = users.find((u: any) => u.id === userId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : "Unknown";
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <History className="h-8 w-8 mb-2" />
        <p className="text-sm">No audit log entries yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 p-2">
        {logs.map((log: any) => (
          <div key={log.id} className="p-3 rounded-md border bg-muted/20" data-testid={`audit-log-${log.id}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-medium">{log.action}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{getUserName(log.changedById)}</span>
              {log.previousLifecycleStatus !== null && log.newLifecycleStatus !== null && log.previousLifecycleStatus !== log.newLifecycleStatus && (
                <span className="flex items-center gap-1">
                  {PANEL_LIFECYCLE_LABELS[log.previousLifecycleStatus] || "Unknown"}
                  <span>{"\u2192"}</span>
                  {PANEL_LIFECYCLE_LABELS[log.newLifecycleStatus] || "Unknown"}
                </span>
              )}
            </div>
            {log.changedFields && Object.keys(log.changedFields).length > 0 && (
              <div className="mt-2 text-xs font-mono bg-muted/40 rounded p-2 space-y-0.5">
                {Object.entries(log.changedFields).map(([key, value]) => (
                  <div key={key} className="flex gap-1">
                    <span className="text-muted-foreground">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
