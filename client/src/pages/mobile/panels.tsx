import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PANELS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Layers, Building2, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type PanelStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";

interface Panel {
  id: string;
  panelMark: string;
  panelType: string | null;
  description: string | null;
  status: PanelStatus;
  building: string | null;
  level: string | null;
  panelThickness: string | null;
  panelArea: string | null;
  panelMass: string | null;
  job?: {
    id: string;
    jobNumber: string;
    name: string;
  };
}

const statusConfig: Record<PanelStatus, { label: string; color: string; bgColor: string }> = {
  NOT_STARTED: { label: "Not Started", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", bgColor: "bg-slate-500" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", bgColor: "bg-blue-500" },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-400 border-green-500/30", bgColor: "bg-green-500" },
  ON_HOLD: { label: "On Hold", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", bgColor: "bg-yellow-500" },
};

export default function MobilePanelsPage() {
  const [, setLocation] = useLocation();

  const { data: panels = [], isLoading } = useQuery<Panel[]>({
    queryKey: [PANELS_ROUTES.LIST],
  });

  const inProgressPanels = panels.filter(p => p.status === "IN_PROGRESS");
  const notStartedPanels = panels.filter(p => p.status === "NOT_STARTED").slice(0, 10);
  const otherPanels = panels.filter(p => !["IN_PROGRESS", "NOT_STARTED"].includes(p.status)).slice(0, 5);

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-panels-title">Panel Register</div>
            <div className="text-sm text-white/60">
              {panels.length} total panels
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : panels.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No panels yet</p>
            <p className="text-sm text-white/40">Panels will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {inProgressPanels.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  In Progress ({inProgressPanels.length})
                </h2>
                <div className="space-y-3">
                  {inProgressPanels.map((panel) => (
                    <PanelCard 
                      key={panel.id} 
                      panel={panel} 
                      onSelect={() => setLocation(`/mobile/panels/${panel.id}`)} 
                    />
                  ))}
                </div>
              </div>
            )}

            {notStartedPanels.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Not Started ({panels.filter(p => p.status === "NOT_STARTED").length})
                </h2>
                <div className="space-y-3">
                  {notStartedPanels.map((panel) => (
                    <PanelCard 
                      key={panel.id} 
                      panel={panel} 
                      onSelect={() => setLocation(`/mobile/panels/${panel.id}`)} 
                    />
                  ))}
                </div>
              </div>
            )}

            {otherPanels.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Other
                </h2>
                <div className="space-y-3">
                  {otherPanels.map((panel) => (
                    <PanelCard 
                      key={panel.id} 
                      panel={panel} 
                      onSelect={() => setLocation(`/mobile/panels/${panel.id}`)}
                      muted 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}

function PanelCard({ 
  panel, 
  onSelect, 
  muted = false 
}: { 
  panel: Panel; 
  onSelect: () => void; 
  muted?: boolean;
}) {
  const status = statusConfig[panel.status] || statusConfig.NOT_STARTED;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/[0.03]" : "bg-white/5"
      )}
      data-testid={`panel-${panel.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-white">
            {panel.panelMark}
          </h3>
          {panel.job && (
            <p className="text-xs text-white/50 truncate">
              {panel.job.jobNumber} - {panel.job.name}
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
        {panel.panelType && (
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {panel.panelType}
          </span>
        )}
        {(panel.building || panel.level) && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {[panel.building && `B${panel.building}`, panel.level && `L${panel.level}`].filter(Boolean).join(" ")}
          </span>
        )}
      </div>
    </button>
  );
}

