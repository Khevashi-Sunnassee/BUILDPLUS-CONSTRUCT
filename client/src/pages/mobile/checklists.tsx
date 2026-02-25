import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ClipboardCheck,
  FolderOpen,
  FileCheck,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Shield,
  Wrench,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useOfflineQuery, useOfflineMutation } from "@/lib/offline/hooks";
import { ACTION_TYPES, ENTITY_TYPES } from "@/lib/offline/action-types";
import { CHECKLIST_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import type { EntityType, ChecklistTemplate, ChecklistInstance } from "@shared/schema";

type ViewState = "modules" | "templates" | "instances";

interface Job {
  id: string;
  name: string;
  jobNumber: string;
}

function getStatusStyle(status: string): { text: string; bg: string; label: string } {
  switch (status) {
    case "draft": return { text: "text-yellow-400", bg: "bg-yellow-500/20", label: "Draft" };
    case "in_progress": return { text: "text-blue-400", bg: "bg-blue-500/20", label: "In Progress" };
    case "completed": return { text: "text-green-400", bg: "bg-green-500/20", label: "Completed" };
    case "signed_off": return { text: "text-emerald-400", bg: "bg-emerald-500/20", label: "Signed Off" };
    case "cancelled": return { text: "text-red-400", bg: "bg-red-500/20", label: "Cancelled" };
    default: return { text: "text-white/60", bg: "bg-white/10", label: status };
  }
}

const moduleColors: Array<{ text: string; bg: string; icon: LucideIcon }> = [
  { text: "text-blue-400", bg: "bg-blue-500/20", icon: FileText },
  { text: "text-amber-400", bg: "bg-amber-500/20", icon: Wrench },
  { text: "text-red-400", bg: "bg-red-500/20", icon: Shield },
  { text: "text-purple-400", bg: "bg-purple-500/20", icon: LayoutGrid },
  { text: "text-emerald-400", bg: "bg-emerald-500/20", icon: ClipboardCheck },
  { text: "text-cyan-400", bg: "bg-cyan-500/20", icon: FolderOpen },
  { text: "text-pink-400", bg: "bg-pink-500/20", icon: FileCheck },
  { text: "text-orange-400", bg: "bg-orange-500/20", icon: FolderOpen },
];

function getModuleStyle(name: string, index: number): { text: string; bg: string; icon: LucideIcon } {
  const lower = name.toLowerCase();
  if (lower.includes("document")) return { text: "text-blue-400", bg: "bg-blue-500/20", icon: FileText };
  if (lower.includes("equipment")) return { text: "text-amber-400", bg: "bg-amber-500/20", icon: Wrench };
  if (lower.includes("safety")) return { text: "text-red-400", bg: "bg-red-500/20", icon: Shield };
  if (lower.includes("panel")) return { text: "text-purple-400", bg: "bg-purple-500/20", icon: LayoutGrid };
  return moduleColors[index % moduleColors.length];
}

export default function MobileChecklistsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [viewState, setViewState] = useState<ViewState>("modules");
  const [selectedModule, setSelectedModule] = useState<EntityType | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [showNewInstanceSheet, setShowNewInstanceSheet] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const { data: entityTypes = [], isLoading: typesLoading } = useOfflineQuery<EntityType[]>(
    [CHECKLIST_ROUTES.ENTITY_TYPES],
    { select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []) },
  );

  const { data: templates = [], isLoading: templatesLoading } = useOfflineQuery<ChecklistTemplate[]>(
    [CHECKLIST_ROUTES.TEMPLATES],
    { enabled: viewState !== "modules", select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []) },
  );

  const { data: instances = [], isLoading: instancesLoading } = useOfflineQuery<ChecklistInstance[]>(
    [CHECKLIST_ROUTES.INSTANCES],
    { enabled: viewState === "instances", select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []) },
  );

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
    enabled: showNewInstanceSheet,
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const createInstanceMutation = useOfflineMutation<void, any>({
    actionType: ACTION_TYPES.CHECKLIST_CREATE,
    entityType: ENTITY_TYPES.CHECKLIST_INSTANCE,
    buildPayload: () => ({
      templateId: selectedTemplate?.id,
      entityTypeId: selectedTemplate?.entityTypeId,
      entitySubtypeId: selectedTemplate?.entitySubtypeId,
      jobId: selectedJobId || undefined,
      status: "in_progress",
      responses: {},
    }),
    onlineMutationFn: async () => {
      if (!selectedTemplate) throw new Error("No template selected");
      return apiRequest("POST", CHECKLIST_ROUTES.INSTANCES, {
        templateId: selectedTemplate.id,
        entityTypeId: selectedTemplate.entityTypeId,
        entitySubtypeId: selectedTemplate.entitySubtypeId,
        jobId: selectedJobId || undefined,
        status: "in_progress",
        responses: {},
      });
    },
    invalidateKeys: [[CHECKLIST_ROUTES.INSTANCES]],
    onSyncSuccess: async (response: any) => {
      setShowNewInstanceSheet(false);
      const data = await response.json();
      setLocation(`/mobile/checklists/${data.id}`);
    },
  });

  const filteredTemplates = selectedModule
    ? templates.filter(t => t.entityTypeId === selectedModule.id)
    : templates;

  const filteredInstances = selectedTemplate
    ? instances.filter(i => i.templateId === selectedTemplate.id)
    : [];

  const activeInstances = filteredInstances.filter(i => i.status === "in_progress" || i.status === "draft");
  const completedInstances = filteredInstances.filter(i => i.status === "completed" || i.status === "signed_off");

  const handleModuleSelect = (module: EntityType) => {
    setSelectedModule(module);
    setViewState("templates");
  };

  const handleTemplateSelect = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setViewState("instances");
  };

  const handleBack = () => {
    if (viewState === "instances") {
      setSelectedTemplate(null);
      setViewState("templates");
    } else if (viewState === "templates") {
      setSelectedModule(null);
      setViewState("modules");
    } else {
      setLocation("/mobile/more");
    }
  };

  const headerTitle = viewState === "modules"
    ? "Checklists"
    : viewState === "templates"
    ? selectedModule?.name || "Templates"
    : selectedTemplate?.name || "Instances";

  const isLoading = typesLoading || (viewState === "templates" && templatesLoading) || (viewState === "instances" && instancesLoading);

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Checklists">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
              data-testid="button-back-checklists"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold truncate">{headerTitle}</div>
              {viewState === "templates" && (
                <div className="text-xs text-white/40">Select a checklist template</div>
              )}
              {viewState === "instances" && (
                <div className="text-xs text-white/40">Active and completed checklists</div>
              )}
            </div>
            {viewState === "instances" && selectedTemplate && (
              <button
                onClick={() => setShowNewInstanceSheet(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 active:scale-[0.99]"
                data-testid="button-new-checklist"
              >
                <Plus className="h-5 w-5 text-blue-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
        ) : viewState === "modules" ? (
          entityTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FolderOpen className="h-12 w-12 text-white/20 mb-3" />
              <p className="text-white/40 text-sm">No checklist modules available</p>
            </div>
          ) : (
            entityTypes.map((type, idx) => {
              const style = getModuleStyle(type.name, idx);
              const Icon = style.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => handleModuleSelect(type)}
                  className="flex h-[66px] w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 text-left active:scale-[0.99]"
                  data-testid={`module-${type.id}`}
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${style.bg}`}>
                    <Icon className={`h-5 w-5 ${style.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-white truncate">{type.name}</div>
                    {type.description && (
                      <div className="text-xs text-white/40 truncate">{type.description}</div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/40 flex-shrink-0" />
                </button>
              );
            })
          )
        ) : viewState === "templates" ? (
          filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardCheck className="h-12 w-12 text-white/20 mb-3" />
              <p className="text-white/40 text-sm">No templates in this module</p>
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left active:scale-[0.99]"
                data-testid={`template-${template.id}`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/20">
                  <FileCheck className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{template.name}</div>
                  {template.description && (
                    <div className="text-xs text-white/40 truncate mt-0.5">{template.description}</div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-white/40 flex-shrink-0" />
              </button>
            ))
          )
        ) : (
          <>
            {activeInstances.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2 px-1">In Progress</div>
                <div className="space-y-2">
                  {activeInstances.map((instance) => {
                    const style = getStatusStyle(instance.status);
                    return (
                      <button
                        key={instance.id}
                        onClick={() => setLocation(`/mobile/checklists/${instance.id}`)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left active:scale-[0.99]"
                        data-testid={`instance-${instance.id}`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                          <Clock className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {instance.instanceNumber || "Checklist"}
                          </div>
                          <div className="text-xs text-white/40">
                            {instance.startedAt ? new Date(instance.startedAt).toLocaleDateString() : ""}
                            {instance.completionRate ? ` · ${parseFloat(String(instance.completionRate)).toFixed(0)}%` : ""}
                          </div>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style.text} ${style.bg}`}>
                          {style.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {completedInstances.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2 px-1 mt-4">Completed</div>
                <div className="space-y-2">
                  {completedInstances.map((instance) => {
                    const style = getStatusStyle(instance.status);
                    return (
                      <button
                        key={instance.id}
                        onClick={() => setLocation(`/mobile/checklists/${instance.id}`)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left active:scale-[0.99]"
                        data-testid={`instance-completed-${instance.id}`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/20">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {instance.instanceNumber || "Checklist"}
                          </div>
                          <div className="text-xs text-white/40">
                            {instance.completedAt ? new Date(instance.completedAt).toLocaleDateString() : ""}
                          </div>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style.text} ${style.bg}`}>
                          {style.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeInstances.length === 0 && completedInstances.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-white/20 mb-3" />
                <p className="text-white/40 text-sm mb-4">No checklists started yet</p>
                <button
                  onClick={() => setShowNewInstanceSheet(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 font-medium active:scale-[0.99]"
                  data-testid="button-start-first-checklist"
                >
                  <Plus className="h-4 w-4" />
                  Start New Checklist
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showNewInstanceSheet && (
        <div className="fixed inset-0 z-[60] flex items-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowNewInstanceSheet(false)}
          />
          <div className="relative w-full rounded-t-3xl bg-[#0D1117] border-t border-white/10 p-6" style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-bold text-white mb-4">Start New Checklist</h3>
            <p className="text-sm text-white/60 mb-4">
              Template: <span className="text-white font-medium">{selectedTemplate?.name}</span>
            </p>

            <div className="mb-6">
              <label className="text-sm text-white/60 mb-2 block">Link to Job (optional)</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-400/50 appearance-none"
                data-testid="select-job-for-checklist"
              >
                <option value="">No job selected</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.jobNumber} - {job.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowNewInstanceSheet(false)}
                className="flex-1 h-12 rounded-xl bg-white/10 text-white font-medium active:scale-[0.99]"
                data-testid="button-cancel-new-checklist"
              >
                Cancel
              </button>
              <button
                onClick={() => createInstanceMutation.mutate(undefined, {
                  onSuccess: (data) => {
                    if (data && typeof data === 'object' && 'offline' in data) {
                      setShowNewInstanceSheet(false);
                      toast({ title: "Checklist queued for creation offline" });
                    }
                  },
                  onError: () => {
                    toast({ title: "Failed to create checklist", variant: "destructive" });
                  },
                })}
                disabled={createInstanceMutation.isPending}
                className="flex-1 h-12 rounded-xl bg-blue-500 text-white font-medium active:scale-[0.99] disabled:opacity-50"
                data-testid="button-confirm-new-checklist"
              >
                {createInstanceMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  "Start Checklist"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
