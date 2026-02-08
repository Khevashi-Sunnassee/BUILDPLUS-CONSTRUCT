import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PANELS_ROUTES } from "@shared/api-routes";
import { PANEL_LIFECYCLE_LABELS } from "@shared/schema";
import { getPhaseLabel, getStatusLabel, PHASE_COLORS, STATUS_COLORS } from "@shared/job-phases";
import type { JobAuditLog } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  MapPin,
  User,
  Phone,
  Building2,
  Layers,
  Calendar,
  ClipboardList,
  History,
  Info,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface JobDetail {
  id: string;
  jobNumber: string;
  name: string;
  client: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  jobPhase: string;
  siteContact: string | null;
  siteContactPhone: string | null;
  productionStartDate: string | null;
  numberOfBuildings: number | null;
  levels: string | null;
  notes: string | null;
  factoryId: string | null;
  customerId: string | null;
  estimatedPanels: number | null;
  contractValue: string | null;
}

interface Panel {
  id: string;
  panelMark: string;
  panelType: string | null;
  building: string | null;
  level: string | null;
  lifecycleStatus: number;
  status: string;
  panelArea: string | null;
  panelMass: string | null;
}

type TabType = "info" | "panels" | "log";

const lifecycleColors: Record<number, string> = {
  0: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  1: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  2: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  3: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  4: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  5: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  6: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  7: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  8: "bg-lime-500/20 text-lime-300 border-lime-500/30",
  9: "bg-green-500/20 text-green-300 border-green-500/30",
  10: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  11: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  12: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  13: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  14: "bg-red-500/20 text-red-300 border-red-500/30",
  15: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

const mobilePhaseColors: Record<string, string> = {
  OPPORTUNITY: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  QUOTING: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  WON_AWAITING_CONTRACT: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  CONTRACTED: "bg-green-500/20 text-green-300 border-green-500/30",
  LOST: "bg-red-500/20 text-red-300 border-red-500/30",
};

const mobileStatusColors: Record<string, string> = {
  ACTIVE: "bg-green-500/20 text-green-300 border-green-500/30",
  ON_HOLD: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  PENDING_START: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  STARTED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  COMPLETED: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  ARCHIVED: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

export default function MobileJobDetailPage() {
  const [, params] = useRoute("/mobile/jobs/:id");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const jobId = params?.id;

  const { data: job, isLoading } = useQuery<JobDetail>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch job");
      return res.json();
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-[#070B12] text-white">
        <div className="flex-shrink-0 border-b border-white/10 px-4 py-4" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <Skeleton className="h-8 w-48 bg-white/10" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-24 rounded-2xl bg-white/10" />
          <Skeleton className="h-24 rounded-2xl bg-white/10" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col h-screen bg-[#070B12] text-white items-center justify-center">
        <p className="text-white/60">Job not found</p>
        <Button variant="outline" className="mt-4 border-white/20 text-white" onClick={() => setLocation("/mobile/jobs")}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: typeof Info }[] = [
    { key: "info", label: "Info", icon: Info },
    { key: "panels", label: "Panels", icon: ClipboardList },
    { key: "log", label: "Log", icon: History },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white -ml-2"
            onClick={() => setLocation("/mobile/jobs")}
            data-testid="button-back-jobs"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate" data-testid="text-job-title">
              {job.jobNumber} - {job.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={cn("text-xs border", mobilePhaseColors[job.jobPhase] || "")}>
                {getPhaseLabel(job.jobPhase)}
              </Badge>
              <Badge variant="outline" className={cn("text-xs border", mobileStatusColors[job.status] || "")}>
                {getStatusLabel(job.status)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex border-t border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "text-white border-b-2 border-blue-400"
                  : "text-white/50"
              )}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {activeTab === "info" && <JobInfoTab job={job} />}
        {activeTab === "panels" && <JobPanelsTab jobId={job.id} onPanelClick={(id) => setLocation(`/mobile/panels/${id}`)} />}
        {activeTab === "log" && <JobAuditLogTab jobId={job.id} />}
      </div>

      <MobileBottomNav />
    </div>
  );
}

function JobInfoTab({ job }: { job: JobDetail }) {
  return (
    <div className="px-4 py-4 space-y-4">
      {job.client && (
        <InfoRow icon={User} label="Client" value={job.client} />
      )}

      {job.address && (
        <InfoRow
          icon={MapPin}
          label="Address"
          value={[job.address, [job.city, job.state].filter(Boolean).join(", ")].filter(Boolean).join("\n")}
        />
      )}

      {job.siteContact && (
        <InfoRow icon={User} label="Site Contact" value={job.siteContact} />
      )}

      {job.siteContactPhone && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <Phone className="h-4 w-4 text-white/40 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50 mb-0.5">Phone</p>
            <a href={`tel:${job.siteContactPhone}`} className="text-sm text-blue-400 underline" data-testid="link-phone">
              {job.siteContactPhone}
            </a>
          </div>
        </div>
      )}

      {job.productionStartDate && (
        <InfoRow icon={Calendar} label="Production Start" value={format(new Date(job.productionStartDate), "dd MMM yyyy")} />
      )}

      <div className="grid grid-cols-2 gap-3">
        {job.numberOfBuildings != null && (
          <InfoBox label="Buildings" value={String(job.numberOfBuildings)} />
        )}
        {job.levels && (
          <InfoBox label="Levels" value={job.levels} />
        )}
        {job.estimatedPanels != null && (
          <InfoBox label="Est. Panels" value={String(job.estimatedPanels)} />
        )}
        {job.contractValue && (
          <InfoBox label="Contract Value" value={`$${Number(job.contractValue).toLocaleString()}`} />
        )}
      </div>

      {job.notes && (
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-white/50 mb-1">Notes</p>
          <p className="text-sm text-white/80 whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {job.siteContactPhone && (
        <Button
          variant="outline"
          className="w-full border-white/20 text-white"
          onClick={() => window.location.href = `tel:${job.siteContactPhone}`}
          data-testid="button-call-contact"
        >
          <Phone className="h-4 w-4 mr-2" />
          Call Site Contact
        </Button>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
      <Icon className="h-4 w-4 text-white/40 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/50 mb-0.5">{label}</p>
        <p className="text-sm text-white whitespace-pre-line">{value}</p>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
      <p className="text-xs text-white/50 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function JobPanelsTab({ jobId, onPanelClick }: { jobId: string; onPanelClick: (id: string) => void }) {
  const { data: panels = [], isLoading } = useQuery<Panel[]>({
    queryKey: ["/api/panels/by-job", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/panels/by-job/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch panels");
      return res.json();
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl bg-white/10" />
        ))}
      </div>
    );
  }

  if (panels.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="h-12 w-12 mx-auto text-white/30 mb-3" />
        <p className="text-white/60">No panels registered</p>
        <p className="text-sm text-white/40">Panels will appear here once added</p>
      </div>
    );
  }

  const sortedPanels = [...panels].sort((a, b) => {
    const levelA = a.level || "";
    const levelB = b.level || "";
    if (levelA !== levelB) return levelA.localeCompare(levelB, undefined, { numeric: true });
    return (a.panelMark || "").localeCompare(b.panelMark || "", undefined, { numeric: true });
  });

  const grouped: Record<string, Panel[]> = {};
  for (const panel of sortedPanels) {
    const key = panel.level || "Unassigned";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(panel);
  }

  const levelKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  return (
    <div className="px-4 py-4 space-y-5">
      <div className="text-sm text-white/50">{panels.length} panel{panels.length !== 1 ? "s" : ""} total</div>
      {levelKeys.map((level) => (
        <div key={level}>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-white/40" />
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
              {level === "Unassigned" ? "Unassigned" : `Level ${level}`}
            </h3>
            <span className="text-xs text-white/40">({grouped[level].length})</span>
          </div>
          <div className="space-y-2">
            {grouped[level].map((panel) => (
              <button
                key={panel.id}
                onClick={() => onPanelClick(panel.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 text-left active:scale-[0.99]"
                data-testid={`panel-card-${panel.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-white truncate">{panel.panelMark}</span>
                    {panel.panelType && (
                      <span className="text-xs text-white/40">{panel.panelType}</span>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-xs border", lifecycleColors[panel.lifecycleStatus] || lifecycleColors[0])}>
                    {PANEL_LIFECYCLE_LABELS[panel.lifecycleStatus] || "Unknown"}
                  </Badge>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function JobAuditLogTab({ jobId }: { jobId: string }) {
  const { data: logs = [], isLoading } = useQuery<JobAuditLog[]>({
    queryKey: ["/api/jobs", jobId, "audit-log"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/audit-log`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl bg-white/10" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-12 w-12 mx-auto text-white/30 mb-3" />
        <p className="text-white/60">No audit log entries yet</p>
        <p className="text-sm text-white/40">Changes to this job will be tracked here</p>
      </div>
    );
  }

  function formatAction(action: string): string {
    switch (action) {
      case "JOB_CREATED": return "Job Created";
      case "JOB_UPDATED": return "Job Updated";
      case "PHASE_CHANGED": return "Phase Changed";
      case "PHASE_CHANGE": return "Phase Changed";
      case "STATUS_CHANGED": return "Status Changed";
      case "STATUS_CHANGE": return "Status Changed";
      default: return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  function getActionColor(action: string): string {
    switch (action) {
      case "JOB_CREATED": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "PHASE_CHANGED":
      case "PHASE_CHANGE": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "STATUS_CHANGED":
      case "STATUS_CHANGE": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default: return "bg-white/10 text-white/70 border-white/20";
    }
  }

  return (
    <div className="px-4 py-4 space-y-3">
      {logs.map((log) => {
        const fields = log.changedFields as Record<string, { from: any; to: any }> | null;
        const filteredEntries = fields
          ? Object.entries(fields).filter(([key]) => !["updatedAt", "jobPhase"].includes(key))
          : [];

        return (
          <div key={log.id} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2" data-testid={`audit-log-${log.id}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-xs border", getActionColor(log.action))}>
                {formatAction(log.action)}
              </Badge>
              <span className="text-xs text-white/40">
                {format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}
              </span>
            </div>

            {(log.action === "PHASE_CHANGED" || log.action === "PHASE_CHANGE") && log.previousPhase && log.newPhase && (
              <div className="text-xs text-white/70">
                Phase: <span className="font-medium">{getPhaseLabel(log.previousPhase)}</span>
                {" \u2192 "}
                <span className="font-medium">{getPhaseLabel(log.newPhase)}</span>
              </div>
            )}

            {(log.action === "STATUS_CHANGED" || log.action === "STATUS_CHANGE") && log.previousStatus && log.newStatus && (
              <div className="text-xs text-white/70">
                Status: <span className="font-medium">{getStatusLabel(log.previousStatus)}</span>
                {" \u2192 "}
                <span className="font-medium">{getStatusLabel(log.newStatus)}</span>
              </div>
            )}

            {filteredEntries.length > 0 && (
              <div className="space-y-0.5">
                {filteredEntries.map(([key, val]) => (
                  <div key={key} className="text-xs text-white/50">
                    <span className="font-medium text-white/60">
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()}
                    </span>
                    {": "}
                    <span className="line-through opacity-60">{String(val?.from ?? "\u2014")}</span>
                    {" \u2192 "}
                    <span className="text-white/70">{String(val?.to ?? "\u2014")}</span>
                  </div>
                ))}
              </div>
            )}

            {log.changedByName && (
              <div className="text-xs text-white/40">
                by {log.changedByName}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
