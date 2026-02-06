import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LOGISTICS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Truck, Package, Calendar, MapPin, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface LoadList {
  id: string;
  docketNumber: string | null;
  scheduledDate: string | null;
  status: string;
  factory: string;
  job: {
    id: string;
    jobNumber: string;
    name: string;
  };
  panels: Array<{ id: string }>;
  deliveryRecord?: {
    deliveredAt: string | null;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  IN_TRANSIT: { label: "In Transit", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  DELIVERED: { label: "Delivered", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function MobileLogisticsPage() {
  const { data: loadLists = [], isLoading } = useQuery<LoadList[]>({
    queryKey: [LOGISTICS_ROUTES.LOAD_LISTS],
  });

  const activeLoads = loadLists.filter(l => l.status !== "DELIVERED" && l.status !== "CANCELLED");
  const recentDeliveries = loadLists
    .filter(l => l.status === "DELIVERED")
    .slice(0, 5);

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
            <div className="text-2xl font-bold" data-testid="text-logistics-title">Logistics</div>
            <div className="text-sm text-white/60">
              {activeLoads.length} active {activeLoads.length === 1 ? 'load' : 'loads'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : loadLists.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No load lists yet</p>
            <p className="text-sm text-white/40">Create loads from the desktop app</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeLoads.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Active Loads
                </h2>
                <div className="space-y-3">
                  {activeLoads.map((load) => {
                    const status = statusConfig[load.status] || statusConfig.PENDING;
                    
                    return (
                      <div
                        key={load.id}
                        className="p-4 rounded-2xl border border-white/10 bg-white/5"
                        data-testid={`load-${load.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate text-white">
                              {load.docketNumber || `Load #${load.id.slice(-6)}`}
                            </h3>
                            <p className="text-xs text-white/50 truncate">
                              {load.job.jobNumber} - {load.job.name}
                            </p>
                          </div>
                          <Badge variant="outline" className={cn("text-xs flex-shrink-0 border", status.color)}>
                            {status.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-white/50">
                          <span className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            {load.panels.length} panels
                          </span>
                          {load.scheduledDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(load.scheduledDate), "dd MMM")}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {load.factory}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recentDeliveries.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Recent Deliveries
                </h2>
                <div className="space-y-3">
                  {recentDeliveries.map((load) => (
                    <div
                      key={load.id}
                      className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]"
                      data-testid={`delivery-${load.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate text-white">
                            {load.docketNumber || `Load #${load.id.slice(-6)}`}
                          </h3>
                          <p className="text-xs text-white/50">
                            {load.panels.length} panels delivered
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                          Delivered
                        </Badge>
                      </div>
                    </div>
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
