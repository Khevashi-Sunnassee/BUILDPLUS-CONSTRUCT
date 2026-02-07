import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PANELS_ROUTES, DOCUMENT_ROUTES } from "@shared/api-routes";
import { PANEL_LIFECYCLE_LABELS } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  Clock,
  User,
  ArrowDown,
  Layers,
  Building2,
  Weight,
  Ruler,
  FileImage,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface PanelDetail {
  id: string;
  panelMark: string;
  panelType: string | null;
  description: string | null;
  status: string;
  building: string | null;
  level: string | null;
  panelThickness: string | null;
  panelArea: string | null;
  panelMass: string | null;
  lifecycleStatus: number;
  job?: {
    id: string;
    jobNumber: string;
    name: string;
  };
}

interface AuditLog {
  id: string;
  panelId: string;
  action: string;
  changedFields: Record<string, any> | null;
  previousLifecycleStatus: number | null;
  newLifecycleStatus: number | null;
  changedById: string | null;
  changedByName: string | null;
  createdAt: string;
}

interface PanelDocument {
  id: string;
  title: string;
  documentNumber: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  status: string;
}

const LIFECYCLE_COLORS: Record<number, { dot: string; line: string; badge: string; text: string }> = {
  0: { dot: "bg-slate-400", line: "bg-slate-400/30", badge: "bg-slate-500/20 text-slate-300 border-slate-500/40", text: "text-slate-300" },
  1: { dot: "bg-sky-400", line: "bg-sky-400/30", badge: "bg-sky-500/20 text-sky-300 border-sky-500/40", text: "text-sky-300" },
  2: { dot: "bg-blue-400", line: "bg-blue-400/30", badge: "bg-blue-500/20 text-blue-300 border-blue-500/40", text: "text-blue-300" },
  3: { dot: "bg-violet-400", line: "bg-violet-400/30", badge: "bg-violet-500/20 text-violet-300 border-violet-500/40", text: "text-violet-300" },
  4: { dot: "bg-purple-400", line: "bg-purple-400/30", badge: "bg-purple-500/20 text-purple-300 border-purple-500/40", text: "text-purple-300" },
  5: { dot: "bg-amber-400", line: "bg-amber-400/30", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40", text: "text-amber-300" },
  6: { dot: "bg-orange-400", line: "bg-orange-400/30", badge: "bg-orange-500/20 text-orange-300 border-orange-500/40", text: "text-orange-300" },
  7: { dot: "bg-yellow-400", line: "bg-yellow-400/30", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40", text: "text-yellow-300" },
  8: { dot: "bg-lime-400", line: "bg-lime-400/30", badge: "bg-lime-500/20 text-lime-300 border-lime-500/40", text: "text-lime-300" },
  9: { dot: "bg-green-400", line: "bg-green-400/30", badge: "bg-green-500/20 text-green-300 border-green-500/40", text: "text-green-300" },
  10: { dot: "bg-teal-400", line: "bg-teal-400/30", badge: "bg-teal-500/20 text-teal-300 border-teal-500/40", text: "text-teal-300" },
  11: { dot: "bg-cyan-400", line: "bg-cyan-400/30", badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40", text: "text-cyan-300" },
  12: { dot: "bg-rose-400", line: "bg-rose-400/30", badge: "bg-rose-500/20 text-rose-300 border-rose-500/40", text: "text-rose-300" },
  13: { dot: "bg-emerald-400", line: "bg-emerald-400/30", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", text: "text-emerald-300" },
  14: { dot: "bg-red-400", line: "bg-red-400/30", badge: "bg-red-500/20 text-red-300 border-red-500/40", text: "text-red-300" },
};

function getLifecycleColor(status: number | null) {
  if (status === null || status === undefined) return LIFECYCLE_COLORS[0];
  return LIFECYCLE_COLORS[status] || LIFECYCLE_COLORS[0];
}

function getActionColor(action: string): string {
  if (action.toLowerCase().includes("created") || action.toLowerCase().includes("registered")) return "text-green-400";
  if (action.toLowerCase().includes("updated") || action.toLowerCase().includes("changed")) return "text-blue-400";
  if (action.toLowerCase().includes("approved")) return "text-emerald-400";
  if (action.toLowerCase().includes("rejected") || action.toLowerCase().includes("defect")) return "text-red-400";
  if (action.toLowerCase().includes("shipped") || action.toLowerCase().includes("delivered")) return "text-cyan-400";
  if (action.toLowerCase().includes("consolidated") || action.toLowerCase().includes("merged")) return "text-purple-400";
  if (action.toLowerCase().includes("production")) return "text-yellow-400";
  if (action.toLowerCase().includes("lifecycle")) return "text-orange-400";
  return "text-white/70";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function describeChangedFields(fields: Record<string, any> | null): string | null {
  if (!fields || Object.keys(fields).length === 0) return null;
  const descriptions: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const readableKey = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
    if (typeof value === "object" && value !== null && "from" in value && "to" in value) {
      descriptions.push(`${readableKey}: ${value.from ?? "—"} \u2192 ${value.to ?? "—"}`);
    } else {
      descriptions.push(`${readableKey}: ${value}`);
    }
  }
  return descriptions.join(", ");
}

export default function MobilePanelDetailPage() {
  const [, params] = useRoute("/mobile/panels/:id");
  const [, setLocation] = useLocation();
  const panelId = params?.id;

  const { data: panel, isLoading: panelLoading } = useQuery<PanelDetail>({
    queryKey: [PANELS_ROUTES.DETAILS(panelId!), panelId],
    enabled: !!panelId,
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery<AuditLog[]>({
    queryKey: [PANELS_ROUTES.AUDIT_LOGS(panelId!), panelId],
    queryFn: async () => {
      const res = await fetch(PANELS_ROUTES.AUDIT_LOGS(panelId!), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: !!panelId,
  });

  const { data: panelDocs = [] } = useQuery<PanelDocument[]>({
    queryKey: [DOCUMENT_ROUTES.PANEL_DOCUMENTS(panelId!), panelId],
    queryFn: async () => {
      const res = await fetch(DOCUMENT_ROUTES.PANEL_DOCUMENTS(panelId!), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch panel documents");
      return res.json();
    },
    enabled: !!panelId,
  });

  const drawingDocs = panelDocs.filter(d =>
    d.mimeType.includes("pdf") || d.mimeType.startsWith("image/")
  );

  const lifecycleColor = getLifecycleColor(panel?.lifecycleStatus ?? 0);
  const lifecycleLabel = PANEL_LIFECYCLE_LABELS[panel?.lifecycleStatus ?? 0] || "Unknown";

  const chronologicalLogs = [...auditLogs].reverse();

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div
        className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/panels">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            {panelLoading ? (
              <Skeleton className="h-7 w-32 bg-white/10" />
            ) : (
              <>
                <h1 className="text-xl font-bold truncate" data-testid="text-panel-mark">
                  {panel?.panelMark || "Panel"}
                </h1>
                {panel?.job && (
                  <p className="text-xs text-white/60 truncate" data-testid="text-panel-job">
                    {panel.job.jobNumber} - {panel.job.name}
                  </p>
                )}
              </>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn("text-xs border flex-shrink-0", lifecycleColor.badge)}
            data-testid="badge-lifecycle-status"
          >
            {lifecycleLabel}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {panelLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : panel ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="section-panel-info">
              <div className="grid grid-cols-2 gap-3">
                {panel.panelType && (
                  <InfoItem icon={Layers} label="Type" value={panel.panelType} />
                )}
                {panel.building && (
                  <InfoItem icon={Building2} label="Building" value={panel.building} />
                )}
                {panel.level && (
                  <InfoItem icon={Layers} label="Level" value={panel.level} />
                )}
                {panel.panelThickness && (
                  <InfoItem icon={Ruler} label="Thickness" value={`${panel.panelThickness}mm`} />
                )}
                {panel.panelArea && (
                  <InfoItem icon={Ruler} label="Area" value={`${panel.panelArea}m\u00B2`} />
                )}
                {panel.panelMass && (
                  <InfoItem icon={Weight} label="Mass" value={`${panel.panelMass}kg`} />
                )}
              </div>
              {panel.description && (
                <p className="text-sm text-white/60 mt-3 pt-3 border-t border-white/10">
                  {panel.description}
                </p>
              )}
            </div>

            {drawingDocs.length > 0 && (
              <button
                onClick={() => setLocation(`/mobile/documents?panelId=${panelId}`)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99]"
                data-testid="button-view-drawings"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <FileImage className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Drawings & Documents</p>
                      <p className="text-xs text-white/50">{drawingDocs.length} document{drawingDocs.length !== 1 ? "s" : ""} attached</p>
                    </div>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-white/40 rotate-180" />
                </div>
              </button>
            )}

            <div data-testid="section-audit-log">
              <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                Panel History
              </h2>

              {logsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-14 rounded-xl bg-white/10" />
                  ))}
                </div>
              ) : chronologicalLogs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                  <Clock className="h-8 w-8 mx-auto text-white/20 mb-2" />
                  <p className="text-sm text-white/40">No history recorded yet</p>
                </div>
              ) : (
                <div className="relative">
                  {chronologicalLogs.map((log, index) => {
                    const isFirst = index === 0;
                    const isLast = index === chronologicalLogs.length - 1;
                    const color = getLifecycleColor(log.newLifecycleStatus);
                    const actionColor = getActionColor(log.action);
                    const changedDesc = describeChangedFields(log.changedFields as Record<string, any> | null);
                    const hasLifecycleChange = log.previousLifecycleStatus !== null && log.newLifecycleStatus !== null && log.previousLifecycleStatus !== log.newLifecycleStatus;

                    return (
                      <div
                        key={log.id}
                        className="flex gap-3 relative"
                        data-testid={`audit-log-${log.id}`}
                      >
                        <div className="flex flex-col items-center flex-shrink-0 w-6">
                          <div className={cn("w-3 h-3 rounded-full mt-1.5 flex-shrink-0 z-10 ring-2 ring-[#070B12]", color.dot)} />
                          {!isLast && (
                            <div className={cn("w-0.5 flex-1 min-h-[20px]", color.line)} />
                          )}
                        </div>

                        <div className={cn("flex-1 pb-4", isLast ? "pb-0" : "")}>
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <p className={cn("text-sm font-medium", actionColor)} data-testid={`audit-action-${log.id}`}>
                              {log.action}
                            </p>

                            {hasLifecycleChange && (
                              <div className="flex items-center gap-2 mt-1.5" data-testid={`audit-lifecycle-${log.id}`}>
                                <LifecycleBadge status={log.previousLifecycleStatus!} size="sm" />
                                <ArrowDown className="h-3 w-3 text-white/30 rotate-[-90deg]" />
                                <LifecycleBadge status={log.newLifecycleStatus!} size="sm" />
                              </div>
                            )}

                            {changedDesc && (
                              <p className="text-xs text-white/40 mt-1.5 break-words" data-testid={`audit-changes-${log.id}`}>
                                {changedDesc}
                              </p>
                            )}

                            <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                              {log.changedByName && (
                                <span className="flex items-center gap-1" data-testid={`audit-user-${log.id}`}>
                                  <User className="h-3 w-3" />
                                  {log.changedByName}
                                </span>
                              )}
                              <span className="flex items-center gap-1" data-testid={`audit-time-${log.id}`}>
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(log.createdAt)}
                              </span>
                              <span className="text-white/25" title={`${formatDate(log.createdAt)} ${formatTime(log.createdAt)}`}>
                                {formatDate(log.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-white/60">Panel not found</p>
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-white/30 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-white truncate">{value}</p>
      </div>
    </div>
  );
}

function LifecycleBadge({ status, size = "default" }: { status: number; size?: "sm" | "default" }) {
  const color = getLifecycleColor(status);
  const label = PANEL_LIFECYCLE_LABELS[status] || "Unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        color.badge,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      )}
    >
      {label}
    </span>
  );
}
