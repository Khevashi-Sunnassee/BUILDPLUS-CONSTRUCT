import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { JOBS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Briefcase, MapPin, User, ChevronRight, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
  siteContact: string | null;
  siteContactPhone: string | null;
  productionStartDate: string | null;
  numberOfBuildings: number | null;
  levels: string | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  ON_HOLD: { label: "On Hold", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  COMPLETED: { label: "Completed", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function MobileJobsPage() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const activeJobs = jobs.filter(j => j.status === "ACTIVE");
  const otherJobs = jobs.filter(j => j.status !== "ACTIVE");

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
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
                    <JobCard key={job.id} job={job} onSelect={() => setSelectedJob(job)} />
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
                    <JobCard key={job.id} job={job} onSelect={() => setSelectedJob(job)} muted />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedJob && (
            <JobDetailSheet job={selectedJob} onClose={() => setSelectedJob(null)} />
          )}
        </SheetContent>
      </Sheet>

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
  const status = statusConfig[job.status] || statusConfig.ACTIVE;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/[0.03]" : "bg-white/5"
      )}
      data-testid={`job-${job.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-white">
            {job.jobNumber} - {job.name}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
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

function JobDetailSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const status = statusConfig[job.status] || statusConfig.ACTIVE;

  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-left flex-1 text-white">{job.jobNumber} - {job.name}</SheetTitle>
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        {job.client && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Client</label>
            <p className="text-sm text-white">{job.client}</p>
          </div>
        )}

        {job.address && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Address</label>
            <p className="text-sm text-white">
              {job.address}
              {(job.city || job.state) && (
                <><br />{[job.city, job.state].filter(Boolean).join(", ")}</>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {job.siteContact && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Site Contact</label>
              <p className="text-sm text-white">{job.siteContact}</p>
            </div>
          )}
          {job.siteContactPhone && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Phone</label>
              <a href={`tel:${job.siteContactPhone}`} className="text-sm text-blue-400 underline">
                {job.siteContactPhone}
              </a>
            </div>
          )}
          {job.productionStartDate && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Production Start</label>
              <p className="text-sm text-white">{format(new Date(job.productionStartDate), "dd MMM yyyy")}</p>
            </div>
          )}
          {job.numberOfBuildings && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Buildings</label>
              <p className="text-sm text-white">{job.numberOfBuildings}</p>
            </div>
          )}
          {job.levels && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Levels</label>
              <p className="text-sm text-white">{job.levels}</p>
            </div>
          )}
        </div>

        {job.siteContactPhone && (
          <Button 
            variant="outline" 
            className="w-full mt-4 border-white/20 text-white"
            onClick={() => window.location.href = `tel:${job.siteContactPhone}`}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call Site Contact
          </Button>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 mt-4">
        <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
