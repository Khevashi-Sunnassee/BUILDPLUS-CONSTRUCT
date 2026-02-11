import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ArrowLeft, Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronRight,
  Loader2, Calendar, Clock, User, FileText, Layers, ListPlus, Download, Upload, Link2,
  CheckSquare,
} from "lucide-react";
import { PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import type { JobType, ActivityStage, ActivityConsultant, ActivityTemplate } from "@shared/schema";

import { STAGE_COLORS, getStageColor } from "@/lib/stage-colors";
import { PageHelpButton } from "@/components/help/page-help-button";

type TemplateWithSubtasks = ActivityTemplate & {
  subtasks: Array<{ id: string; name: string; estimatedDays: number | null; sortOrder: number }>;
  checklists: Array<{ id: string; name: string; estimatedDays: number; sortOrder: number }>;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  FS: "Finish to Start",
  SS: "Start to Start",
  FF: "Finish to Finish",
  SF: "Start to Finish",
};

function SortableActivity({
  template,
  stageColorIndex,
  onEdit,
  onDelete,
  onAddSubtask,
  onDeleteSubtask,
  onAddChecklist,
  onDeleteChecklist,
  phaseColor,
}: {
  template: TemplateWithSubtasks;
  stageColorIndex: number;
  onEdit: (t: TemplateWithSubtasks) => void;
  onDelete: (t: TemplateWithSubtasks) => void;
  onAddSubtask: (templateId: string) => void;
  onDeleteSubtask: (id: string) => void;
  onAddChecklist: (templateId: string) => void;
  onDeleteChecklist: (id: string) => void;
  phaseColor: (phase: string | null) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const colors = getStageColor(stageColorIndex);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex rounded-md overflow-hidden border"
      data-testid={`template-row-${template.id}`}
    >
      <div className={`w-1 shrink-0 ${colors.accent}`} />
      <div className="flex-1 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <button
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            {...attributes}
            {...listeners}
            data-testid={`drag-handle-${template.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium" data-testid={`text-template-name-${template.id}`}>{template.name}</span>
              {template.category && (
                <Badge variant="outline" className="text-xs">{template.category}</Badge>
              )}
              {template.jobPhase && (
                <Badge variant={phaseColor(template.jobPhase) as any} className="text-xs">{template.jobPhase}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {template.estimatedDays} days
              </span>
              {template.consultantName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {template.consultantName}
                </span>
              )}
              {template.deliverable && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {template.deliverable}
                </span>
              )}
              {(template as any).predecessorSortOrder != null && (template as any).relationship && (
                <span className="flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Pred: {(template as any).predecessorSortOrder + 1} ({(template as any).relationship})
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onAddSubtask(template.id)}
            title="Add Subtask"
            data-testid={`button-add-subtask-${template.id}`}
          >
            <ListPlus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onAddChecklist(template.id)}
            title="Add Checklist"
            data-testid={`button-add-checklist-${template.id}`}
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onEdit(template)} data-testid={`button-edit-template-${template.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(template)} data-testid={`button-delete-template-${template.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {template.subtasks && template.subtasks.length > 0 && (
        <div className="ml-8 space-y-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Subtasks</span>
          {template.subtasks.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-muted/50 text-sm">
              <span>{sub.name}</span>
              <div className="flex items-center gap-2">
                {sub.estimatedDays && (
                  <span className="text-muted-foreground">{sub.estimatedDays}d</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onDeleteSubtask(sub.id)}
                  data-testid={`button-delete-subtask-${sub.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {template.checklists && template.checklists.length > 0 && (
        <div className="ml-8 space-y-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            Checklist
          </span>
          {template.checklists.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-accent/30 text-sm border border-accent/50">
              <span className="flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                {item.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{item.estimatedDays}d</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onDeleteChecklist(item.id)}
                  data-testid={`button-delete-checklist-${item.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

export default function WorkflowBuilderPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/job-types/:id/workflow");
  const jobTypeId = params?.id || "";

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithSubtasks | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TemplateWithSubtasks | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());

  const [showSubtaskDialog, setShowSubtaskDialog] = useState(false);
  const [subtaskParentId, setSubtaskParentId] = useState<string>("");
  const [subtaskName, setSubtaskName] = useState("");
  const [subtaskDays, setSubtaskDays] = useState<number | undefined>();

  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [checklistParentId, setChecklistParentId] = useState<string>("");
  const [checklistName, setChecklistName] = useState("");
  const [checklistDays, setChecklistDays] = useState<number>(1);

  const [formStageId, setFormStageId] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEstimatedDays, setFormEstimatedDays] = useState(14);
  const [formConsultantId, setFormConsultantId] = useState("");
  const [formConsultantName, setFormConsultantName] = useState("");
  const [formDeliverable, setFormDeliverable] = useState("");
  const [formPredecessor, setFormPredecessor] = useState<number | null>(null);
  const [formRelationship, setFormRelationship] = useState("");
  const [formJobPhase, setFormJobPhase] = useState("");

  const { data: jobType, isLoading: loadingJobType } = useQuery<JobType>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPE_BY_ID(jobTypeId)],
    enabled: !!jobTypeId,
  });

  const { data: templates, isLoading: loadingTemplates } = useQuery<TemplateWithSubtasks[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)],
    enabled: !!jobTypeId,
  });

  const { data: stages } = useQuery<ActivityStage[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.STAGES],
  });

  const { data: consultants } = useQuery<ActivityConsultant[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.CONSULTANTS],
  });

  const JOB_PHASES = ["OPPORTUNITY", "QUOTING", "WON_AWAITING_CONTRACT", "CONTRACTED", "LOST"];

  const templatesByStage = useMemo(() => {
    if (!templates || !stages) return new Map<string, { stage: ActivityStage; templates: TemplateWithSubtasks[] }>();
    const map = new Map<string, { stage: ActivityStage; templates: TemplateWithSubtasks[] }>();
    for (const stage of stages) {
      const stageTemplates = templates
        .filter(t => t.stageId === stage.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      if (stageTemplates.length > 0) {
        map.set(stage.id, { stage, templates: stageTemplates });
      }
    }
    return map;
  }, [templates, stages]);

  const allTemplatesSorted = useMemo(() => {
    if (!templates) return [];
    return [...templates].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [templates]);

  const usedStageIds = useMemo(() => new Set(templates?.map(t => t.stageId) || []), [templates]);

  const stageColorMap = useMemo(() => {
    const map = new Map<string, number>();
    if (stages) {
      stages.forEach((s, i) => map.set(s.id, i));
    }
    return map;
  }, [stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const reorderMutation = useMutation({
    mutationFn: async (templateIds: string[]) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.TEMPLATES_REORDER(jobTypeId), { templateIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
    },
    onError: (error: Error) => {
      toast({ title: "Reorder failed", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
      toast({ title: "Activity added to workflow" });
      closeTemplateDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return apiRequest("PATCH", PROJECT_ACTIVITIES_ROUTES.TEMPLATE_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
      toast({ title: "Activity updated" });
      closeTemplateDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", PROJECT_ACTIVITIES_ROUTES.TEMPLATE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
      toast({ title: "Activity removed from workflow" });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async ({ templateId, ...data }: { templateId: string; name: string; estimatedDays?: number }) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.TEMPLATE_SUBTASKS(templateId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
      toast({ title: "Subtask added" });
      setShowSubtaskDialog(false);
      setSubtaskName("");
      setSubtaskDays(undefined);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", PROJECT_ACTIVITIES_ROUTES.TEMPLATE_SUBTASK_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
      toast({ title: "Subtask removed" });
    },
  });

  const createChecklistMutation = useMutation({
    mutationFn: async ({ templateId, ...data }: { templateId: string; name: string; estimatedDays: number }) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.TEMPLATE_CHECKLISTS(templateId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
      toast({ title: "Checklist item added" });
      setShowChecklistDialog(false);
      setChecklistName("");
      setChecklistDays(1);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", PROJECT_ACTIVITIES_ROUTES.TEMPLATE_CHECKLIST_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
      toast({ title: "Checklist item removed" });
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownloadTemplate() {
    setIsDownloading(true);
    try {
      const res = await fetch(PROJECT_ACTIVITIES_ROUTES.TEMPLATES_DOWNLOAD(jobTypeId), { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow_template_${jobType?.name?.replace(/\s+/g, "_") || jobTypeId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Template downloaded" });
    } catch {
      toast({ title: "Failed to download template", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiUpload(PROJECT_ACTIVITIES_ROUTES.TEMPLATES_IMPORT(jobTypeId), formData);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.TEMPLATES(jobTypeId)] });
      toast({
        title: `Imported ${data.imported} activities`,
        description: data.errors?.length ? `${data.errors.length} rows had warnings` : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeTemplateDialog() {
    setShowTemplateDialog(false);
    setEditingTemplate(null);
    setFormStageId("");
    setFormCategory("");
    setFormName("");
    setFormDescription("");
    setFormEstimatedDays(14);
    setFormConsultantId("");
    setFormConsultantName("");
    setFormDeliverable("");
    setFormJobPhase("");
    setFormPredecessor(null);
    setFormRelationship("");
  }

  function openCreateDialog(stageId?: string) {
    setEditingTemplate(null);
    setFormStageId(stageId || "");
    setFormCategory("");
    setFormName("");
    setFormDescription("");
    setFormEstimatedDays(14);
    setFormConsultantId("");
    setFormConsultantName("");
    setFormDeliverable("");
    setFormJobPhase("");
    setFormPredecessor(null);
    setFormRelationship("");
    setShowTemplateDialog(true);
  }

  function openEditDialog(template: TemplateWithSubtasks) {
    setEditingTemplate(template);
    setFormStageId(template.stageId);
    setFormCategory(template.category || "");
    setFormName(template.name);
    setFormDescription(template.description || "");
    setFormEstimatedDays(template.estimatedDays);
    setFormConsultantId(template.consultantId || "");
    setFormConsultantName(template.consultantName || "");
    setFormDeliverable(template.deliverable || "");
    setFormJobPhase(template.jobPhase || "");
    setFormPredecessor((template as any).predecessorSortOrder ?? null);
    setFormRelationship((template as any).relationship || "");
    setShowTemplateDialog(true);
  }

  function handleTemplateSubmit() {
    if (!formName.trim() || !formStageId) {
      toast({ title: "Name and Stage are required", variant: "destructive" });
      return;
    }
    if (formPredecessor !== null && !formRelationship) {
      toast({ title: "Relationship type is required when a predecessor is set", variant: "destructive" });
      return;
    }

    const selectedConsultant = consultants?.find(c => c.id === formConsultantId);
    const data: any = {
      stageId: formStageId,
      category: formCategory.trim() || null,
      name: formName.trim(),
      description: formDescription.trim() || null,
      estimatedDays: formEstimatedDays,
      consultantId: formConsultantId || null,
      consultantName: selectedConsultant?.name || formConsultantName.trim() || null,
      deliverable: formDeliverable.trim() || null,
      jobPhase: formJobPhase || null,
      predecessorSortOrder: formPredecessor,
      relationship: formRelationship || null,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, ...data });
    } else {
      createTemplateMutation.mutate(data);
    }
  }

  function toggleStageCollapse(stageId: string) {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  const isPending = createTemplateMutation.isPending || updateTemplateMutation.isPending;

  const phaseColor = (phase: string | null) => {
    switch (phase) {
      case "OPPORTUNITY": return "secondary";
      case "CONTRACTED": return "default";
      default: return "outline";
    }
  };

  function handleDragEnd(stageId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const stageData = templatesByStage.get(stageId);
    if (!stageData) return;

    const oldIndex = stageData.templates.findIndex(t => t.id === active.id);
    const newIndex = stageData.templates.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(stageData.templates, oldIndex, newIndex);
    const allTemplateIds = (stages || [])
      .filter(s => usedStageIds.has(s.id))
      .flatMap(s => {
        if (s.id === stageId) {
          return reordered.map(t => t.id);
        }
        return templatesByStage.get(s.id)?.templates.map(t => t.id) || [];
      });

    reorderMutation.mutate(allTemplateIds);
  }

  if (loadingJobType || loadingTemplates) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/job-types")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                Workflow: {jobType?.name}
              </h1>
              <PageHelpButton pageHelpKey="page.admin.workflow-builder" />
            </div>
            <p className="text-muted-foreground">
              {templates?.length || 0} activities across {templatesByStage.size} stages
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleDownloadTemplate} disabled={isDownloading} data-testid="button-download-template">
            {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending} data-testid="button-import-template">
            {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-import-file"
          />
          <Button onClick={() => openCreateDialog()} data-testid="button-add-activity">
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>
        </div>
      </div>

      {(!templates || templates.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Activities in Workflow</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Start building the workflow by adding activities. Each activity belongs to a stage and
              defines the work that needs to be done for this type of project.
            </p>
            <Button onClick={() => openCreateDialog()} data-testid="button-add-first-activity">
              <Plus className="h-4 w-4 mr-2" />
              Add First Activity
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {stages?.filter(s => usedStageIds.has(s.id)).map((stage) => {
            const stageData = templatesByStage.get(stage.id);
            if (!stageData) return null;
            const isCollapsed = collapsedStages.has(stage.id);
            const colorIndex = stageColorMap.get(stage.id) ?? 0;
            const colors = getStageColor(colorIndex);

            return (
              <Card key={stage.id} className="overflow-visible">
                <div
                  className={`flex items-center justify-between gap-4 px-4 py-3 cursor-pointer ${colors.bg} rounded-t-md`}
                  onClick={() => toggleStageCollapse(stage.id)}
                  data-testid={`stage-header-${stage.id}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${colors.badge}`}>{stage.stageNumber}</span>
                    <span className={`font-semibold ${colors.text}`}>{stage.name}</span>
                    <Badge variant="secondary">{stageData.templates.length}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); openCreateDialog(stage.id); }}
                    data-testid={`button-add-to-stage-${stage.id}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {!isCollapsed && (
                  <CardContent className="pt-3 pb-3 px-4 overflow-visible">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(stage.id, event)}
                    >
                      <SortableContext
                        items={stageData.templates.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {stageData.templates.map((template) => (
                            <SortableActivity
                              key={template.id}
                              template={template}
                              stageColorIndex={colorIndex}
                              onEdit={openEditDialog}
                              onDelete={setDeleteConfirm}
                              onAddSubtask={(templateId) => {
                                setSubtaskParentId(templateId);
                                setSubtaskName("");
                                setSubtaskDays(undefined);
                                setShowSubtaskDialog(true);
                              }}
                              onDeleteSubtask={(id) => deleteSubtaskMutation.mutate(id)}
                              onAddChecklist={(templateId) => {
                                setChecklistParentId(templateId);
                                setChecklistName("");
                                setChecklistDays(1);
                                setShowChecklistDialog(true);
                              }}
                              onDeleteChecklist={(id) => deleteChecklistMutation.mutate(id)}
                              phaseColor={phaseColor}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showTemplateDialog} onOpenChange={(open) => { if (!open) closeTemplateDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Activity" : "Add Activity to Workflow"}</DialogTitle>
            <DialogDescription>
              Define an activity that will be part of this job type's workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Stage *</Label>
              <Select value={formStageId} onValueChange={setFormStageId}>
                <SelectTrigger data-testid="select-stage">
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages?.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.stageNumber}. {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Activity Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Prepare DA architectural plans"
                data-testid="input-template-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Architecture"
                  data-testid="input-template-category"
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Days</Label>
                <Input
                  type="number"
                  value={formEstimatedDays}
                  onChange={(e) => setFormEstimatedDays(parseInt(e.target.value) || 14)}
                  data-testid="input-template-days"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Consultant / Responsible Party</Label>
              <Select value={formConsultantId} onValueChange={(val) => {
                setFormConsultantId(val);
                const c = consultants?.find(x => x.id === val);
                if (c) setFormConsultantName(c.name);
              }}>
                <SelectTrigger data-testid="select-consultant">
                  <SelectValue placeholder="Select consultant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {consultants?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Job Phase</Label>
              <Select value={formJobPhase} onValueChange={setFormJobPhase}>
                <SelectTrigger data-testid="select-phase">
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {JOB_PHASES.map(p => (
                    <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Key Deliverable / Output</Label>
              <Input
                value={formDeliverable}
                onChange={(e) => setFormDeliverable(e.target.value)}
                placeholder="e.g. DA drawings"
                data-testid="input-template-deliverable"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Predecessor</Label>
                <Select
                  value={formPredecessor !== null ? String(formPredecessor) : "none"}
                  onValueChange={(val) => {
                    setFormPredecessor(val === "none" ? null : parseInt(val));
                    if (val === "none") setFormRelationship("");
                    else if (!formRelationship) setFormRelationship("FS");
                  }}
                >
                  <SelectTrigger data-testid="select-predecessor">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {allTemplatesSorted
                      .filter(t => {
                        if (editingTemplate && t.id === editingTemplate.id) return false;
                        if (editingTemplate && t.sortOrder >= editingTemplate.sortOrder) return false;
                        return true;
                      })
                      .map((t) => (
                        <SelectItem key={t.id} value={String(t.sortOrder)}>
                          {t.sortOrder + 1}. {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Select
                  value={formRelationship || "none"}
                  onValueChange={(val) => setFormRelationship(val === "none" ? "" : val)}
                  disabled={formPredecessor === null}
                >
                  <SelectTrigger data-testid="select-relationship">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="FS">Finish to Start (FS)</SelectItem>
                    <SelectItem value="SS">Start to Start (SS)</SelectItem>
                    <SelectItem value="FF">Finish to Finish (FF)</SelectItem>
                    <SelectItem value="SF">Start to Finish (SF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional additional details..."
                data-testid="input-template-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTemplateDialog} data-testid="button-cancel-template">Cancel</Button>
            <Button onClick={handleTemplateSubmit} disabled={isPending} data-testid="button-save-template">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? "Save Changes" : "Add Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubtaskDialog} onOpenChange={(open) => { if (!open) setShowSubtaskDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subtask</DialogTitle>
            <DialogDescription>Add a subtask to this activity template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subtask Name</Label>
              <Input
                value={subtaskName}
                onChange={(e) => setSubtaskName(e.target.value)}
                placeholder="Subtask description"
                data-testid="input-subtask-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated Days (optional)</Label>
              <Input
                type="number"
                value={subtaskDays ?? ""}
                onChange={(e) => setSubtaskDays(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Days"
                data-testid="input-subtask-days"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubtaskDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!subtaskName.trim()) {
                  toast({ title: "Subtask name is required", variant: "destructive" });
                  return;
                }
                createSubtaskMutation.mutate({
                  templateId: subtaskParentId,
                  name: subtaskName.trim(),
                  estimatedDays: subtaskDays,
                });
              }}
              disabled={createSubtaskMutation.isPending}
              data-testid="button-save-subtask"
            >
              {createSubtaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Subtask
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showChecklistDialog} onOpenChange={(open) => { if (!open) setShowChecklistDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Checklist Item</DialogTitle>
            <DialogDescription>Add a checklist item that must be completed before this activity stage is done.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Checklist Item</Label>
              <Input
                value={checklistName}
                onChange={(e) => setChecklistName(e.target.value)}
                placeholder="e.g. Client sign-off received"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && checklistName.trim()) {
                    createChecklistMutation.mutate({
                      templateId: checklistParentId,
                      name: checklistName.trim(),
                      estimatedDays: checklistDays,
                    });
                  }
                }}
                data-testid="input-checklist-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated Days</Label>
              <Input
                type="number"
                min={1}
                value={checklistDays}
                onChange={(e) => setChecklistDays(parseInt(e.target.value) || 1)}
                data-testid="input-checklist-days"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChecklistDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!checklistName.trim()) {
                  toast({ title: "Checklist item name is required", variant: "destructive" });
                  return;
                }
                createChecklistMutation.mutate({
                  templateId: checklistParentId,
                  name: checklistName.trim(),
                  estimatedDays: checklistDays,
                });
              }}
              disabled={createChecklistMutation.isPending}
              data-testid="button-save-checklist"
            >
              {createChecklistMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Checklist Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteConfirm?.name}" from this workflow? This will also remove any subtasks and checklists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && deleteTemplateMutation.mutate(deleteConfirm.id)}>
              {deleteTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
