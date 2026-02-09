import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_ROUTES } from "@shared/api-routes";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  RefreshCw,
  Calendar,
  CalendarDays,
  Loader2,
  Building2,
  Layers,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { Job, JobLevelCycleTime } from "@shared/schema";
import { PageHelpButton } from "@/components/help/page-help-button";

interface ProgrammeEntry extends JobLevelCycleTime {
  isEditing?: boolean;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd MMM yyyy");
  } catch {
    return "-";
  }
}

function SortableRow({
  entry,
  index,
  onUpdate,
  onSplit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isSaving,
}: {
  entry: ProgrammeEntry;
  index: number;
  onUpdate: (id: string, field: string, value: any) => void;
  onSplit: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
  isSaving: boolean;
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

  const displayLabel = entry.pourLabel
    ? `${entry.level} Pour ${entry.pourLabel}`
    : entry.level;

  const effectiveStart = entry.manualStartDate || entry.estimatedStartDate;
  const effectiveEnd = entry.manualEndDate || entry.estimatedEndDate;
  const hasManualOverride = !!(entry.manualStartDate || entry.manualEndDate);

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-muted/50" : ""}
      data-testid={`row-programme-${entry.id}`}
    >
      <TableCell className="w-10">
        <div className="flex items-center gap-1">
          <button
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            data-testid={`drag-handle-${entry.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <button
              onClick={() => onMoveUp(index)}
              disabled={isFirst || isSaving}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              data-testid={`btn-move-up-${entry.id}`}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onMoveDown(index)}
              disabled={isLast || isSaving}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              data-testid={`btn-move-down-${entry.id}`}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center font-mono text-sm text-muted-foreground">
        {index + 1}
      </TableCell>
      <TableCell>
        <Badge variant="outline" data-testid={`badge-building-${entry.id}`}>
          B{entry.buildingNumber}
        </Badge>
      </TableCell>
      <TableCell className="font-medium" data-testid={`text-level-${entry.id}`}>
        {displayLabel}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          value={entry.cycleDays}
          onChange={(e) => onUpdate(entry.id, "cycleDays", parseInt(e.target.value) || 1)}
          className="w-20"
          disabled={isSaving}
          data-testid={`input-cycle-days-${entry.id}`}
        />
      </TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={entry.manualStartDate ? format(new Date(entry.manualStartDate), "yyyy-MM-dd") : ""}
                onChange={(e) => onUpdate(entry.id, "manualStartDate", e.target.value || null)}
                className="w-36"
                placeholder="Auto"
                disabled={isSaving}
                data-testid={`input-start-date-${entry.id}`}
              />
              {!entry.manualStartDate && entry.estimatedStartDate && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(entry.estimatedStartDate)}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {hasManualOverride ? "Manual date override active" : "Auto-calculated from programme sequence"}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={entry.manualEndDate ? format(new Date(entry.manualEndDate), "yyyy-MM-dd") : ""}
                onChange={(e) => onUpdate(entry.id, "manualEndDate", e.target.value || null)}
                className="w-36"
                placeholder="Auto"
                disabled={isSaving}
                data-testid={`input-end-date-${entry.id}`}
              />
              {!entry.manualEndDate && entry.estimatedEndDate && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(entry.estimatedEndDate)}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {hasManualOverride ? "Manual date override active" : "Auto-calculated from cycle days"}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <span className={`text-sm ${hasManualOverride ? "text-blue-500 dark:text-blue-400 font-medium" : "text-muted-foreground"}`}
          data-testid={`text-effective-dates-${entry.id}`}
        >
          {effectiveStart ? formatDate(effectiveStart) : "-"}
          {" — "}
          {effectiveEnd ? formatDate(effectiveEnd) : "-"}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onSplit(entry.id)}
                disabled={isSaving}
                data-testid={`btn-split-${entry.id}`}
              >
                <Split className="h-4 w-4" />
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
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove entry</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function JobProgrammePage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const { toast } = useToast();
  const [localEntries, setLocalEntries] = useState<ProgrammeEntry[]>([]);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const entries = hasLocalChanges ? localEntries : (programme || []);

  const saveMutation = useMutation({
    mutationFn: async (data: ProgrammeEntry[]) => {
      return apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME(jobId!), {
        entries: data.map((e, idx) => ({
          buildingNumber: e.buildingNumber,
          level: e.level,
          levelOrder: e.levelOrder,
          pourLabel: e.pourLabel || null,
          sequenceOrder: idx,
          cycleDays: e.cycleDays,
          estimatedStartDate: e.estimatedStartDate,
          estimatedEndDate: e.estimatedEndDate,
          manualStartDate: e.manualStartDate,
          manualEndDate: e.manualEndDate,
          notes: e.notes || null,
        })),
      });
    },
    onSuccess: () => {
      setHasLocalChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Programme saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save programme", variant: "destructive" });
    },
  });

  const splitMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.JOB_PROGRAMME_SPLIT(jobId!), { entryId });
      return res.json();
    },
    onSuccess: () => {
      setHasLocalChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Level split into pours" });
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
      setHasLocalChanges(false);
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
      setHasLocalChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Dates recalculated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to recalculate dates", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("DELETE", `${ADMIN_ROUTES.JOB_PROGRAMME(jobId!)}/${entryId}`);
      return res.json();
    },
    onSuccess: () => {
      setHasLocalChanges(false);
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jobs', jobId, 'programme'] });
      toast({ title: "Entry removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove entry", variant: "destructive" });
    },
  });

  const handleUpdate = useCallback((id: string, field: string, value: any) => {
    const current = hasLocalChanges ? localEntries : (programme || []);
    const updated = current.map(e => {
      if (e.id !== id) return e;
      return { ...e, [field]: value };
    });
    setLocalEntries(updated);
    setHasLocalChanges(true);
  }, [hasLocalChanges, localEntries, programme]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = hasLocalChanges ? localEntries : (programme || []);
    const oldIndex = current.findIndex(e => e.id === active.id);
    const newIndex = current.findIndex(e => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(current, oldIndex, newIndex);
    setLocalEntries(reordered);
    setHasLocalChanges(true);

    reorderMutation.mutate(reordered.map(e => e.id));
  }, [hasLocalChanges, localEntries, programme, reorderMutation]);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    const current = hasLocalChanges ? localEntries : (programme || []);
    const reordered = arrayMove([...current], index, index - 1);
    setLocalEntries(reordered);
    setHasLocalChanges(true);
    reorderMutation.mutate(reordered.map(e => e.id));
  }, [hasLocalChanges, localEntries, programme, reorderMutation]);

  const handleMoveDown = useCallback((index: number) => {
    const current = hasLocalChanges ? localEntries : (programme || []);
    if (index >= current.length - 1) return;
    const reordered = arrayMove([...current], index, index + 1);
    setLocalEntries(reordered);
    setHasLocalChanges(true);
    reorderMutation.mutate(reordered.map(e => e.id));
  }, [hasLocalChanges, localEntries, programme, reorderMutation]);

  const handleSplit = useCallback((id: string) => {
    if (hasLocalChanges) {
      toast({ title: "Please save changes before splitting", variant: "destructive" });
      return;
    }
    splitMutation.mutate(id);
  }, [hasLocalChanges, splitMutation, toast]);

  const handleDelete = useCallback((id: string) => {
    setDeleteConfirm(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm);
    }
  }, [deleteConfirm, deleteMutation]);

  const isSaving = saveMutation.isPending || splitMutation.isPending || reorderMutation.isPending || recalcMutation.isPending || deleteMutation.isPending;
  const isLoading = jobLoading || programmeLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
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
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
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
          <Button
            variant="outline"
            onClick={() => recalcMutation.mutate()}
            disabled={isSaving || !job.productionStartDate}
            data-testid="btn-recalculate-dates"
          >
            {recalcMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
            Recalculate Dates
          </Button>
          {hasLocalChanges && (
            <Button
              onClick={() => saveMutation.mutate(localEntries)}
              disabled={isSaving}
              data-testid="btn-save-programme"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Production Sequence
            </CardTitle>
            <CardDescription>
              Drag rows to reorder, split levels into pours, and edit dates inline.
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
              <p className="text-sm text-muted-foreground mt-1">
                Go to the job settings and use "Generate from Job Settings" or "Refresh from Panels" 
                in the Job Programme tab to create entries.
              </p>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14"></TableHead>
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead className="w-20">Bldg</TableHead>
                        <TableHead>Level / Pour</TableHead>
                        <TableHead className="w-24">Cycle Days</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Effective Dates</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, index) => (
                        <SortableRow
                          key={entry.id}
                          entry={entry}
                          index={index}
                          onUpdate={handleUpdate}
                          onSplit={handleSplit}
                          onDelete={handleDelete}
                          onMoveUp={handleMoveUp}
                          onMoveDown={handleMoveDown}
                          isFirst={index === 0}
                          isLast={index === entries.length - 1}
                          isSaving={isSaving}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Programme Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteLabel}</strong> from the programme?
              This will renumber the remaining entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="btn-confirm-delete"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
