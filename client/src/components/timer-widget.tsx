import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Play, Pause, Square, X, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TIMER_ROUTES, JOBS_ROUTES, DRAFTING_ROUTES, SETTINGS_ROUTES, DAILY_LOGS_ROUTES } from "@shared/api-routes";
import { isJobVisibleInDropdowns } from "@shared/job-phases";

interface TimerSession {
  id: string;
  userId: string;
  dailyLogId: string | null;
  jobId: string | null;
  panelRegisterId: string | null;
  workTypeId: string | null;
  app: string | null;
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  totalElapsedMs: number;
  pauseCount: number;
  notes: string | null;
  logRowId: string | null;
  createdAt: string;
  jobNumber?: string | null;
  jobName?: string | null;
  panelMark?: string | null;
  workTypeName?: string | null;
}

interface Job {
  id: string;
  jobNumber: string;
  name: string;
}

interface WorkType {
  id: string;
  name: string;
}

interface Panel {
  id: string;
  panelMark: string;
  jobId: string;
}

export function TimerWidget() {
  const { toast } = useToast();
  const [displayTime, setDisplayTime] = useState("00:00:00");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedPanelId, setSelectedPanelId] = useState<string>("");
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: activeSession, isLoading: isLoadingSession } = useQuery<TimerSession | null>({
    queryKey: [TIMER_ROUTES.ACTIVE],
    refetchInterval: 1000,
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: workTypes } = useQuery<WorkType[]>({
    queryKey: [SETTINGS_ROUTES.WORK_TYPES],
  });

  const { data: allocatedData } = useQuery<{
    programs: { panels: Panel[] }[];
  }>({
    queryKey: [DRAFTING_ROUTES.MY_ALLOCATED],
  });

  const allPanels = allocatedData?.programs.flatMap(p => p.panels || []).filter(Boolean) || [];
  const filteredPanels = selectedJobId 
    ? allPanels.filter(p => p && p.jobId === selectedJobId)
    : allPanels.filter(Boolean);

  useEffect(() => {
    if (!activeSession) {
      setDisplayTime("00:00:00");
      return;
    }

    const updateTimer = () => {
      let elapsed = activeSession.totalElapsedMs;
      
      if (activeSession.status === "RUNNING") {
        const startTime = new Date(activeSession.startedAt).getTime();
        const now = Date.now();
        elapsed += now - startTime;
      }

      const totalSeconds = Math.floor(elapsed / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setDisplayTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Update current time for end time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const startMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", TIMER_ROUTES.START, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIMER_ROUTES.ACTIVE] });
      toast({ title: "Timer started" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to start timer", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", TIMER_ROUTES.PAUSE(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIMER_ROUTES.ACTIVE] });
      toast({ title: "Timer paused" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to pause timer", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", TIMER_ROUTES.RESUME(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIMER_ROUTES.ACTIVE] });
      toast({ title: "Timer resumed" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to resume timer", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (data: { id: string; jobId?: string; panelRegisterId?: string; workTypeId?: string; notes?: string }) => {
      return await apiRequest("POST", TIMER_ROUTES.STOP(data.id), {
        jobId: data.jobId || null,
        panelRegisterId: data.panelRegisterId || null,
        workTypeId: data.workTypeId || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIMER_ROUTES.ACTIVE] });
      queryClient.invalidateQueries({ queryKey: [DAILY_LOGS_ROUTES.LIST] });
      setIsStopDialogOpen(false);
      setSelectedJobId("");
      setSelectedPanelId("");
      setSelectedWorkTypeId("");
      setNotes("");
      toast({ 
        title: "Timer stopped", 
        description: "Time entry has been added to your daily log"
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to stop timer", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", TIMER_ROUTES.CANCEL(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIMER_ROUTES.ACTIVE] });
      toast({ title: "Timer cancelled" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to cancel timer", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleStart = () => {
    startMutation.mutate();
  };

  const handlePause = () => {
    if (activeSession) {
      pauseMutation.mutate(activeSession.id);
    }
  };

  const handleResume = () => {
    if (activeSession) {
      resumeMutation.mutate(activeSession.id);
    }
  };

  const handleStop = () => {
    setIsStopDialogOpen(true);
  };

  const handleConfirmStop = () => {
    if (activeSession) {
      stopMutation.mutate({
        id: activeSession.id,
        jobId: selectedJobId || undefined,
        panelRegisterId: selectedPanelId || undefined,
        workTypeId: selectedWorkTypeId || undefined,
        notes: notes || undefined,
      });
    }
  };

  const handleCancel = () => {
    if (activeSession) {
      cancelMutation.mutate(activeSession.id);
    }
  };

  const isRunning = activeSession?.status === "RUNNING";
  const isPaused = activeSession?.status === "PAUSED";
  const hasActiveSession = isRunning || isPaused;
  const isProcessing = startMutation.isPending || pauseMutation.isPending || resumeMutation.isPending || stopMutation.isPending || cancelMutation.isPending;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 border rounded-lg bg-card">
        <Clock className="h-4 w-4 text-muted-foreground" />
        
        <div className="flex items-center gap-2">
          <span 
            className={`font-mono text-lg font-semibold tabular-nums ${isRunning ? "text-green-600" : isPaused ? "text-amber-600" : "text-muted-foreground"}`}
            data-testid="text-timer-display"
          >
            {displayTime}
          </span>
          
          {isRunning && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200" data-testid="badge-timer-running">
              Running
            </Badge>
          )}
          {isPaused && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200" data-testid="badge-timer-paused">
              Paused
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!hasActiveSession && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleStart}
              disabled={isProcessing || isLoadingSession}
              className="text-green-600"
              data-testid="button-timer-start"
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          )}

          {isRunning && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handlePause}
              disabled={isProcessing}
              className="text-amber-600"
              data-testid="button-timer-pause"
            >
              {pauseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>
          )}

          {isPaused && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleResume}
              disabled={isProcessing}
              className="text-green-600"
              data-testid="button-timer-resume"
            >
              {resumeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          )}

          {hasActiveSession && (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleStop}
                disabled={isProcessing}
                className="text-red-600"
                data-testid="button-timer-stop"
              >
                <Square className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                disabled={isProcessing}
                className="text-muted-foreground"
                data-testid="button-timer-cancel"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={isStopDialogOpen} onOpenChange={setIsStopDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Time Entry</DialogTitle>
            <DialogDescription>
              Assign this time entry to a job and panel before saving.
              Time recorded: <span className="font-mono font-semibold">{displayTime}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <div className="p-2 bg-muted rounded-md font-mono text-sm" data-testid="text-timer-start-time">
                  {activeSession?.startedAt 
                    ? format(new Date(activeSession.startedAt), "hh:mm a")
                    : "--:-- --"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <div className="p-2 bg-muted rounded-md font-mono text-sm" data-testid="text-timer-end-time">
                  {format(currentTime, "hh:mm a")}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job">Job</Label>
              <Select value={selectedJobId} onValueChange={(value) => {
                setSelectedJobId(value);
                setSelectedPanelId("");
              }}>
                <SelectTrigger data-testid="select-timer-job">
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.filter(j => isJobVisibleInDropdowns((j as any).jobPhase || "CONTRACTED")).map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="panel">Panel</Label>
              <Select value={selectedPanelId} onValueChange={setSelectedPanelId}>
                <SelectTrigger data-testid="select-timer-panel">
                  <SelectValue placeholder="Select a panel" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPanels.map((panel) => (
                    <SelectItem key={panel.id} value={panel.id}>
                      {panel.panelMark}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workType">Work Type</Label>
              <Select value={selectedWorkTypeId} onValueChange={setSelectedWorkTypeId}>
                <SelectTrigger data-testid="select-timer-work-type">
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  {workTypes?.map((wt) => (
                    <SelectItem key={wt.id} value={wt.id}>
                      {wt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this time entry..."
                className="resize-none"
                rows={2}
                data-testid="textarea-timer-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStopDialogOpen(false)}
              data-testid="button-timer-stop-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmStop}
              disabled={stopMutation.isPending}
              data-testid="button-timer-stop-confirm"
            >
              {stopMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
