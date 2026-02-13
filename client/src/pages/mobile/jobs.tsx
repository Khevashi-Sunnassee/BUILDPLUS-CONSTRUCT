import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { JOBS_ROUTES } from "@shared/api-routes";
import { getPhaseLabel, getStatusLabel } from "@shared/job-phases";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, MapPin, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface Job {
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
}

const phaseColors: Record<string, string> = {
  OPPORTUNITY: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  QUOTING: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  WON_AWAITING_CONTRACT: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  CONTRACTED: "bg-green-500/20 text-green-300 border-green-500/30",
  LOST: "bg-red-500/20 text-red-300 border-red-500/30",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-500/20 text-green-300 border-green-500/30",
  ON_HOLD: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  PENDING_START: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  STARTED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  COMPLETED: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  ARCHIVED: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

export default function MobileJobsPage() {
  const [, setLocation] = useLocation();

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const activeJobs = jobs.filter(j => j.status === "ACTIVE" || j.status === "STARTED" || j.status === "PENDING_START");
  const otherJobs = jobs.filter(j => !["ACTIVE", "STARTED", "PENDING_START"].includes(j.status));

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Jobs">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="text-2xl font-bold" data-testid="text-jobs-title">Jobs</div>
          <div className="text-sm text-white/60">
            {activeJobs.length} active {activeJobs.length === 1 ? 'job' : 'jobs'}
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
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No jobs yet</p>
            <p className="text-sm text-white/40">Jobs will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Active Jobs
                </h2>
                <div className="space-y-3">
                  {activeJobs.map((job) => (
                    <JobCard key={job.id} job={job} onSelect={() => setLocation(`/mobile/jobs/${job.id}`)} />
                  ))}
                </div>
              </div>
            )}

            {otherJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Other Jobs
                </h2>
                <div className="space-y-3">
                  {otherJobs.map((job) => (
                    <JobCard key={job.id} job={job} onSelect={() => setLocation(`/mobile/jobs/${job.id}`)} muted />
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

function JobCard({
  job,
  onSelect,
  muted = false
}: {
  job: Job;
  onSelect: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/[0.03]" : "bg-white/5"
      )}
      data-testid={`job-card-${job.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-white">
            {job.jobNumber} - {job.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant="outline" className={cn("text-xs border", phaseColors[job.jobPhase] || "")}>
            {getPhaseLabel(job.jobPhase)}
          </Badge>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-white/50">
        {job.client && (
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {job.client}
          </span>
        )}
        {(job.city || job.state) && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {[job.city, job.state].filter(Boolean).join(", ")}
          </span>
        )}
      </div>
    </button>
  );
}
