import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_ROUTES } from "@shared/api-routes";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  GripVertical,
  Split,
  Trash2,
  Calculator,
  Save,
  Calendar,
  CalendarDays,
  Loader2,
  Building2,
  Layers,
  ChevronDown,
  ChevronRight,
  BarChart3,
  TableProperties,
  Factory,
} from "lucide-react";
import type { Job, JobLevelCycleTime } from "@shared/schema";
import { PageHelpButton } from "@/components/help/page-help-button";
import { ProgrammeGanttChart } from "@/pages/job-programme-gantt";

interface ProgrammeEntry extends JobLevelCycleTime {
  isEditing?: boolean;
}

const RELATIONSHIP_OPTIONS = [
  { value: "FS", label: "FS", desc: "Finish-to-Start" },
  { value: "SS", label: "SS", desc: "Start-to-Start" },
  { value: "FF", label: "FF", desc: "Finish-to-Finish" },
  { value: "SF", label: "SF", desc: "Start-to-Finish" },
];

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd MMM yyyy");
  } catch {
    return "-";
  }
}

function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd/MM/yy");
  } catch {
    return "-";
  }
}

function formatLevelDisplay(level: string, pourLabel?: string | null): string {
  const numMatch = level.match(/^L?(\d+)$/i);
  const prefix = numMatch ? `Level ${numMatch[1]}` : level;
  if (pourLabel) return `${prefix} - Pour ${pourLabel}`;
  return `${prefix} - Pour Date`;
}

function SortableRow({
  entry,
  index,
  entries,
  onPatchEntry,
  onSplit,
  onDelete,
  isSaving,
  isExpanded,
  onToggle,
}: {
  entry: ProgrammeEntry;
  index: number;
  entries: ProgrammeEntry[];
  onPatchEntry: (id: string, field: string, value: any) => void;
  onSplit: (id: string) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const displayLabel = formatLevelDisplay(entry.level, entry.pourLabel);

  const effectiveStart = entry.manualStartDate || entry.estimatedStartDate;
  const effectiveEnd = entry.manualEndDate || entry.estimatedEndDate;
  const hasManualOverride = !!(entry.manualStartDate || entry.manualEndDate);

  const predecessorOptions = entries
    .filter(e => e.sequenceOrder < entry.sequenceOrder)
    .map(e => ({
      value: String(e.sequenceOrder),
      label: `Row ${e.sequenceOrder + 1} - ${formatLevelDisplay(e.level, e.pourLabel)}`,
    }));

  const predValue = entry.predecessorSequenceOrder != null ? String(entry.predecessorSequenceOrder) : "";
  const relValue = entry.relationship || "FS";

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className={`border-b border-border/50 text-sm ${isDragging ? "bg-muted/50" : "hover-elevate"}`}
        data-testid={`row-programme-${entry.id}`}
      >
        <td className="px-2 py-1.5 w-8">
          <button
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            data-testid={`drag-handle-${entry.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </td>
        <td className="px-2 py-1.5 w-8 text-center font-mono text-xs text-muted-foreground">
          {entry.sequenceOrder + 1}
        </td>
        <td className="px-2 py-1.5 min-w-[80px]">
          <Badge variant="outline" className="text-xs whitespace-nowrap" data-testid={`badge-building-${entry.id}`}>
            Building {entry.buildingNumber}
          </Badge>
        </td>
        <td className="px-2 py-1.5 min-w-[120px]">
          <button
            onClick={onToggle}
            className="flex items-center gap-1 font-medium text-left"
            data-testid={`text-level-${entry.id}`}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            {displayLabel}
          </button>
        </td>
        <td className="px-2 py-1.5 w-16">
          <Input
            type="number"
            min={1}
            defaultValue={entry.cycleDays}
            onBlur={(e) => {
              const val = parseInt(e.target.value) || 1;
              if (val !== entry.cycleDays) onPatchEntry(entry.id, "cycleDays", val);
            }}
            className="w-16 h-8 text-sm"
            disabled={isSaving}
            data-testid={`input-cycle-days-${entry.id}`}
          />
        </td>
        <td className="px-2 py-1.5 w-28">
          <Select
            value={predValue}
            onValueChange={(v) => {
              if (v === "__none__") {
                onPatchEntry(entry.id, "predecessorSequenceOrder", null);
              } else {
                onPatchEntry(entry.id, "predecessorSequenceOrder", parseInt(v));
              }
            }}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 text-xs w-28" data-testid={`select-pred-${entry.id}`}>
              <SelectValue placeholder="None">
                {predValue ? `Row ${parseInt(predValue) + 1}` : "None"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {predecessorOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-1.5 w-16">
          <Select
            value={relValue}
            onValueChange={(v) => onPatchEntry(entry.id, "relationship", v)}
            disabled={isSaving || entry.predecessorSequenceOrder == null}
          >
            <SelectTrigger className="h-8 text-xs w-16" data-testid={`select-rel-${entry.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{opt.label}</span>
                    </TooltipTrigger>
                    <TooltipContent>{opt.desc}</TooltipContent>
                  </Tooltip>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-1.5 w-28">
          <span className={`text-xs ${hasManualOverride ? "text-blue-500 dark:text-blue-400 font-medium" : "text-muted-foreground"}`}>
            {effectiveStart ? formatShortDate(effectiveStart) : "-"}
          </span>
        </td>
        <td className="px-2 py-1.5 w-28">
          <span className={`text-xs ${hasManualOverride ? "text-blue-500 dark:text-blue-400 font-medium" : "text-muted-foreground"}`}>
            {effectiveEnd ? formatShortDate(effectiveEnd) : "-"}
          </span>
        </td>
        <td className="px-2 py-1.5 w-20">
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onSplit(entry.id)}
                  disabled={isSaving}
                  data-testid={`btn-split-${entry.id}`}
                >
                  <Split className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split into pours</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(entry.id)}
                  disabled={isSaving}
                  data-testid={`btn-delete-${entry.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove entry</TooltipContent>
            </Tooltip>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border/30 bg-muted/20">
          <td colSpan={10} className="px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Manual Start Date</label>
                <Input
                  type="date"
                  value={entry.manualStartDate ? format(new Date(entry.manualStartDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => onPatchEntry(entry.id, "manualStartDate", e.target.value || null)}
                  className="h-8 text-xs"
                  disabled={isSaving}
                  data-testid={`input-manual-start-${entry.id}`}
                />
                {!entry.manualStartDate && entry.estimatedStartDate && (
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    Auto: {formatDate(entry.estimatedStartDate)}
                  </span>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Manual End Date</label>
                <Input
                  type="date"
                  value={entry.manualEndDate ? format(new Date(entry.manualEndDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => onPatchEntry(entry.id, "manualEndDate", e.target.value || null)}
                  className="h-8 text-xs"
                  disabled={isSaving}
                  data-testid={`input-manual-end-${entry.id}`}
                />
                {!entry.manualEndDate && entry.estimatedEndDate && (
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    Auto: {formatDate(entry.estimatedEndDate)}
                  </span>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estimated Start</label>
                <span className="text-xs">{formatDate(entry.estimatedStartDate)}</span>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estimated End</label>
                <span className="text-xs">{formatDate(entry.estimatedEndDate)}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function JobProgrammePage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "gantt">("table");
  const [updateSlotsConfirmOpen, setUpdateSlotsConfirmOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const { data: job, isLoading: jobLoading } = useQuery<Job>({
    queryKey: ['/api/admin/jobs', jobId],
    queryFn: async () => {
      const res = await fetch(ADMIN_ROUTES.JOB_BY_ID(jobId!));
      if (!res.ok) throw new Error("Failed to load job");
      return res.json();
    },
    enabled: !!jobId,
  });

  const { data: programme, isLoading: programmeLoading } = useQuery<ProgrammeEntry[]>({
    queryKey: ['/api/admin/jobs', jobId, 'programme'],
    queryFn: async () => {
      const res = await fetch(ADMIN_ROUTES.JOB_PROGRAMME(jobId!));
      if (!res.ok) throw new Error("Failed to load programme");
      return res.json();
    },
    enabled: !!jobId,
  });

  const entries = useMemo(() => {
    return (programme || []).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [programme]);

  const patchEntryMutation = useMutation({
    mutationFn: async ({ entryId, data }: { entryId: string; data: Record<string, any> }) => {
      return apiRequest("PATCH", ADMIN_ROUTES.JOB_PROGRAMME_ENTRY(jobId!, entryId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update entry", variant: "destructive" });
    },
  });

  const splitMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME_SPLIT(jobId!), { entryId });
      const splitResult = await res.json();
      if (job?.productionStartDate) {
        await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME_RECALC(jobId!), {});
      }
      return splitResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Level split into pours", description: job?.productionStartDate ? "Dates recalculated automatically." : undefined });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to split level", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME_REORDER(jobId!), { orderedIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reorder programme", variant: "destructive" });
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME_RECALC(jobId!), {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Dates recalculated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to recalculate dates", variant: "destructive" });
    },
  });

  const generateFromSettingsMutation = useMutation({
    mutationFn: async () => {
      const levelsRes = await fetch(ADMIN_ROUTES.JOB_GENERATE_LEVELS(jobId!));
      if (!levelsRes.ok) {
        const err = await levelsRes.json();
        throw new Error(err.error || "Failed to generate levels from job settings");
      }
      const levels: { buildingNumber: number; level: string; levelOrder: number; cycleDays: number }[] = await levelsRes.json();
      if (levels.length === 0) throw new Error("No levels generated. Check the job has lowest/highest level configured.");

      const entries = levels.map((l, idx) => ({
        buildingNumber: l.buildingNumber,
        level: l.level,
        levelOrder: l.levelOrder,
        sequenceOrder: idx,
        cycleDays: l.cycleDays,
        predecessorSequenceOrder: idx > 0 ? idx - 1 : null,
        relationship: idx > 0 ? "FS" : null,
      }));

      await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME(jobId!), { entries });
      await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME_RECALC(jobId!), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Programme generated and dates calculated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to generate programme", variant: "destructive" });
    },
  });

  const generateFromPanelsMutation = useMutation({
    mutationFn: async () => {
      const levelsRes = await fetch(ADMIN_ROUTES.JOB_BUILD_LEVELS(jobId!));
      if (!levelsRes.ok) {
        const err = await levelsRes.json();
        throw new Error(err.error || "Failed to build levels from panels");
      }
      const levels: { buildingNumber: number; level: string; levelOrder: number; cycleDays: number }[] = await levelsRes.json();
      if (levels.length === 0) throw new Error("No panels found for this job. Register panels first.");

      const entries = levels.map((l, idx) => ({
        buildingNumber: l.buildingNumber,
        level: l.level,
        levelOrder: l.levelOrder,
        sequenceOrder: idx,
        cycleDays: l.cycleDays,
        predecessorSequenceOrder: idx > 0 ? idx - 1 : null,
        relationship: idx > 0 ? "FS" : null,
      }));

      await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME(jobId!), { entries });
      await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME_RECALC(jobId!), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Programme generated and dates calculated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to generate programme from panels", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("DELETE", `${ADMIN_ROUTES.JOB_PROGRAMME(jobId!)}/${entryId}`);
      return res.json();
    },
    onSuccess: () => {
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Entry removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove entry", variant: "destructive" });
    },
  });

  const updateProductionSlotsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/production-slots/generate/${jobId}`, { skipEmptyLevels: false });
      return res.json();
    },
    onSuccess: (data: any) => {
      setUpdateSlotsConfirmOpen(false);
      const count = Array.isArray(data) ? data.length : 0;
      toast({ title: "Production slots updated", description: `${count} production slot${count !== 1 ? 's' : ''} generated from programme.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to update production slots", variant: "destructive" });
    },
  });

  const handlePatchEntry = useCallback((id: string, field: string, value: any) => {
    patchEntryMutation.mutate({ entryId: id, data: { [field]: value } });
  }, [patchEntryMutation]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = entries.findIndex(e => e.id === active.id);
    const newIndex = entries.findIndex(e => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(entries, oldIndex, newIndex);
    reorderMutation.mutate(reordered.map(e => e.id));
  }, [entries, reorderMutation]);

  const handleSplit = useCallback((id: string) => {
    splitMutation.mutate(id);
  }, [splitMutation]);

  const handleDelete = useCallback((id: string) => {
    setDeleteConfirm(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm);
    }
  }, [deleteConfirm, deleteMutation]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSaving = patchEntryMutation.isPending || splitMutation.isPending || reorderMutation.isPending || recalcMutation.isPending || deleteMutation.isPending || generateFromSettingsMutation.isPending || generateFromPanelsMutation.isPending || updateProductionSlotsMutation.isPending;
  const isLoading = jobLoading || programmeLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Job not found</p>
            <Link href="/admin/jobs">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Jobs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deleteEntry = entries.find(e => e.id === deleteConfirm);
  const deleteLabel = deleteEntry ? (deleteEntry.pourLabel ? `${deleteEntry.level} Pour ${deleteEntry.pourLabel}` : deleteEntry.level) : "";

  return (
    <div className="p-4 md:p-6 space-y-4" role="main" aria-label="Job Programme">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/jobs">
            <Button variant="ghost" size="icon" data-testid="btn-back-to-jobs">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold" data-testid="text-page-title">
                Job Programme
              </h1>
              <PageHelpButton pageHelpKey="page.job-programme" />
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-job-info">
              {job.jobNumber} - {job.name}
              {job.client && ` | ${job.client}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {job.productionStartDate && (
            <Badge variant="outline" className="gap-1" data-testid="badge-production-start">
              <CalendarDays className="h-3 w-3" />
              Production Start: {formatDate(job.productionStartDate)}
            </Badge>
          )}
          <div className="flex items-center border rounded-md overflow-visible">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              data-testid="btn-view-table"
            >
              <TableProperties className="h-4 w-4 mr-1" />
              Table
            </Button>
            <Button
              variant={viewMode === "gantt" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("gantt")}
              data-testid="btn-view-gantt"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Gantt
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => recalcMutation.mutate()}
            disabled={isSaving || !job.productionStartDate}
            data-testid="btn-recalculate-dates"
          >
            {recalcMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
            Recalculate Dates
          </Button>
          {entries.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setUpdateSlotsConfirmOpen(true)}
              disabled={isSaving}
              data-testid="btn-update-production-slots"
            >
              {updateProductionSlotsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Factory className="h-4 w-4 mr-2" />}
              Update Production Slots
            </Button>
          )}
        </div>
      </div>

      {!job.productionStartDate && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                Set a production start date on the job to enable automatic date calculation.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === "gantt" && entries.length > 0 ? (
        <ProgrammeGanttChart
          entries={entries}
          jobTitle={`${job.jobNumber} - ${job.name}`}
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Production Sequence
              </CardTitle>
              <CardDescription>
                Drag rows to reorder, set predecessors and relationships, edit dates inline.
                {entries.length > 0 && ` ${entries.length} entries`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/jobs`}>
                <Button variant="outline" size="sm" data-testid="btn-manage-job">
                  <Building2 className="h-4 w-4 mr-1" />
                  Manage Job
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="py-12 text-center border rounded-md bg-muted/30">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-muted-foreground">No programme entries yet.</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Generate production levels to build your programme with editable cycle times, predecessors, and Gantt chart.
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Button
                    onClick={() => generateFromSettingsMutation.mutate()}
                    disabled={isSaving}
                    data-testid="btn-generate-from-settings"
                  >
                    {generateFromSettingsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
                    Generate from Job Settings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateFromPanelsMutation.mutate()}
                    disabled={isSaving}
                    data-testid="btn-generate-from-panels"
                  >
                    {generateFromPanelsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Layers className="h-4 w-4 mr-2" />}
                    Generate from Panels
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={entries.map(e => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <table className="w-full text-left" data-testid="table-programme">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="px-2 py-2 w-8"></th>
                          <th className="px-2 py-2 w-8 text-center">Row</th>
                          <th className="px-2 py-2 min-w-[80px]">Building</th>
                          <th className="px-2 py-2 min-w-[120px]">Level / Pour</th>
                          <th className="px-2 py-2 w-16">Days</th>
                          <th className="px-2 py-2 w-28">Predecessor</th>
                          <th className="px-2 py-2 w-16">Rel</th>
                          <th className="px-2 py-2 w-28">Start</th>
                          <th className="px-2 py-2 w-28">End</th>
                          <th className="px-2 py-2 w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, index) => (
                          <SortableRow
                            key={entry.id}
                            entry={entry}
                            index={index}
                            entries={entries}
                            onPatchEntry={handlePatchEntry}
                            onSplit={handleSplit}
                            onDelete={handleDelete}
                            isSaving={isSaving}
                            isExpanded={expandedRows.has(entry.id)}
                            onToggle={() => toggleRow(entry.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Programme Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteLabel}" from the programme?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={updateSlotsConfirmOpen} onOpenChange={setUpdateSlotsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Production Slots</AlertDialogTitle>
            <AlertDialogDescription>
              This will regenerate all production slots for this job based on the current programme.
              Any existing production slots and their manual adjustments will be replaced.
              Do you want to update the production slots and design program?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateProductionSlotsMutation.mutate()} data-testid="btn-confirm-update-slots">
              {updateProductionSlotsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Update Production Slots
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
