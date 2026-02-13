import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ChevronLeft,
  Save,
  Loader2,
  CheckCircle,
  Send,
  AlertCircle,
  Camera,
  X,
  Star,
  Upload,
  ChevronDown,
  ChevronUp,
  Search,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CHECKLIST_ROUTES, ASSET_ROUTES } from "@shared/api-routes";
import { normalizeSections } from "@/components/checklist/normalize-sections";
import { calculateCompletionRate, getMissingRequiredFields, isFieldVisible } from "@/components/checklist/checklist-form";
import type { ChecklistInstance, ChecklistTemplate, ChecklistSection, ChecklistField, ChecklistFieldOption } from "@shared/schema";

type SimpleAsset = {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  registrationNumber: string | null;
};

function compressImage(file: File, maxDimension = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(e.target?.result as string); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function MobileChecklistFillPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const { data: instance, isLoading: instanceLoading } = useQuery<ChecklistInstance>({
    queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(id!)],
    enabled: !!id,
  });

  const backPath = instance?.panelId
    ? `/mobile/panels/${instance.panelId}`
    : "/mobile/checklists";

  const { data: template, isLoading: templateLoading } = useQuery<ChecklistTemplate>({
    queryKey: [CHECKLIST_ROUTES.TEMPLATE_BY_ID(instance?.templateId || "")],
    enabled: !!instance?.templateId,
  });

  useEffect(() => {
    if (instance?.responses) {
      setResponses(instance.responses as Record<string, unknown>);
    }
  }, [instance]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const completionRate = template ? calculateCompletionRate(template, responses) : 0;
      return apiRequest("PUT", CHECKLIST_ROUTES.INSTANCE_BY_ID(id!), {
        responses,
        completionRate: completionRate.toFixed(2),
        status: instance?.status === "draft" ? "in_progress" : instance?.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(id!)] });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      const msg = error.message?.includes("413")
        ? "Data too large. Try removing some photos."
        : "Failed to save progress";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", CHECKLIST_ROUTES.INSTANCE_BY_ID(id!), {
        responses,
        completionRate: "100",
      });
      return apiRequest("PATCH", CHECKLIST_ROUTES.INSTANCE_COMPLETE(id!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(id!)] });
      if (instance?.panelId) {
        queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES_BY_PANEL(instance.panelId)] });
      }
      setHasChanges(false);
      setShowCompleteConfirm(false);
      navigate(backPath);
    },
    onError: (error: Error) => {
      const msg = error.message?.includes("413")
        ? "Data too large. Try removing some photos."
        : "Failed to complete checklist";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
    setHasChanges(true);
  };

  const sections: ChecklistSection[] = template ? normalizeSections(template.sections) : [];

  const handleAssetSelected = useCallback((asset: SimpleAsset, sourceFieldId?: string) => {
    const updates: Record<string, unknown> = {};
    sections.forEach((section) => {
      section.items?.forEach((field) => {
        if (field.autoPopulateFrom === "asset_register" && field.autoPopulateField) {
          const matchesSource = !field.autoPopulateSourceFieldId || !sourceFieldId || field.autoPopulateSourceFieldId === sourceFieldId;
          if (matchesSource) {
            const assetKey = field.autoPopulateField as keyof SimpleAsset;
            if (asset[assetKey] !== undefined) {
              updates[field.id] = asset[assetKey] || "";
            }
          }
        }
      });
    });
    if (Object.keys(updates).length > 0) {
      setResponses(prev => ({ ...prev, ...updates }));
      setHasChanges(true);
    }
  }, [sections]);

  const handleComplete = () => {
    if (!template) return;
    const missing = getMissingRequiredFields(template, responses);
    if (missing.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Complete: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}`,
        variant: "destructive",
      });
      return;
    }
    setShowCompleteConfirm(true);
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const isLoading = instanceLoading || templateLoading;
  const isCompleted = instance?.status === "completed" || instance?.status === "signed_off";

  const { completedCount, totalRequired, progress } = (() => {
    let completed = 0;
    let total = 0;
    sections.forEach(section => {
      section.items?.forEach((field: ChecklistField) => {
        const extField = field as typeof field & { dependsOn?: string; dependsOnValue?: string };
        if (!isFieldVisible(extField, responses)) return;
        if (field.required) {
          total++;
          const v = responses[field.id];
          if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) completed++;
        }
      });
    });
    return { completedCount: completed, totalRequired: total, progress: total > 0 ? (completed / total) * 100 : 100 };
  })();

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-[#070B12] text-white items-center justify-center" role="main" aria-label="Mobile Checklist" aria-busy="true">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!instance || !template) {
    return (
      <div className="flex flex-col h-screen bg-[#070B12] text-white items-center justify-center px-4" role="main" aria-label="Mobile Checklist">
        <AlertCircle className="h-12 w-12 text-white/20 mb-3" />
        <p className="text-white/40 text-sm mb-4">Checklist not found</p>
        <button
          onClick={() => navigate(backPath)}
          className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm active:scale-[0.99]"
          data-testid="button-back-not-found"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Checklist">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(backPath)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:scale-[0.99]"
              data-testid="button-back-from-fill"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold truncate">{template.name}</div>
              <div className="text-xs text-white/40">
                {instance.instanceNumber}
                {isCompleted && " · Completed"}
              </div>
            </div>
          </div>
          {!isCompleted && totalRequired > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-white/40 flex-shrink-0">
                {completedCount}/{totalRequired}
              </span>
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-4">
        {isCompleted && (
          <div className="flex items-center gap-3 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-green-400">Checklist Completed</div>
              {instance.completedAt && (
                <div className="text-xs text-green-400/60">
                  {new Date(instance.completedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

        {sections.map((section, sectionIndex) => {
          const isCollapsed = collapsedSections.has(section.id);
          const sectionFields = section.items || [];
          const visibleFields = sectionFields.filter(f => {
            const ext = f as typeof f & { dependsOn?: string; dependsOnValue?: string };
            return isFieldVisible(ext, responses);
          });
          const sectionCompleted = visibleFields.filter(f => {
            if (!f.required) return false;
            const v = responses[f.id];
            return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
          }).length;
          const sectionRequired = visibleFields.filter(f => f.required).length;

          return (
            <div key={section.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden" data-testid={`mobile-section-${section.id}`}>
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center gap-3 px-4 py-3 active:scale-[0.99]"
                data-testid={`button-toggle-section-${section.id}`}
              >
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-white">
                    {sectionIndex + 1}. {section.name}
                  </div>
                  {section.description && (
                    <div className="text-xs text-white/40 mt-0.5">{section.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {sectionRequired > 0 && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      sectionCompleted === sectionRequired
                        ? "text-green-400 bg-green-500/20"
                        : "text-white/40 bg-white/10"
                    }`}>
                      {sectionCompleted}/{sectionRequired}
                    </span>
                  )}
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4 text-white/40" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-white/40" />
                  )}
                </div>
              </button>

              {!isCollapsed && (
                <div className="px-4 pb-4 space-y-5">
                  {sectionFields.map((field, fieldIndex) => {
                    const extField = field as typeof field & { dependsOn?: string; dependsOnValue?: string };
                    if (!isFieldVisible(extField, responses)) return null;
                    return (
                    <div key={field.id} data-testid={`mobile-field-${field.id}`}>
                      {fieldIndex > 0 && <div className="border-t border-white/5 mb-5" />}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-sm font-medium text-white">
                            {field.name}
                            {field.required && <span className="text-red-400 ml-1">*</span>}
                          </label>
                          {field.photoRequired && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-amber-400 bg-amber-500/20">
                              Photo Required
                            </span>
                          )}
                        </div>
                        {field.description && (
                          <p className="text-xs text-white/40">{field.description}</p>
                        )}
                        {field.instructions && (
                          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                            <p className="text-xs text-blue-300">{field.instructions}</p>
                          </div>
                        )}
                        <div className="pt-1">
                          <MobileFieldRenderer
                            field={field}
                            value={responses[field.id]}
                            onChange={(v) => handleFieldChange(field.id, v)}
                            disabled={isCompleted}
                            onAssetSelected={field.type === "asset_selector" ? handleAssetSelected : undefined}
                          />
                        </div>
                      </div>
                    </div>
                    );
                  })}
                  {sectionFields.length === 0 && (
                    <p className="text-sm text-white/30 text-center py-4">No fields in this section</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isCompleted && (
        <div className="flex-shrink-0 border-t border-white/10 bg-[#0D1117] px-4 py-3 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
          <div className="flex gap-3">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white/10 text-white font-medium active:scale-[0.99] disabled:opacity-40"
              data-testid="button-save-checklist"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Save
            </button>
            <button
              onClick={handleComplete}
              disabled={completeMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-blue-500 text-white font-medium active:scale-[0.99] disabled:opacity-50"
              data-testid="button-complete-checklist"
            >
              {completeMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              Complete
            </button>
          </div>
        </div>
      )}

      {showCompleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCompleteConfirm(false)} />
          <div className="relative w-full rounded-t-3xl bg-[#0D1117] border-t border-white/10 p-6" style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-bold text-white mb-2">Complete Checklist?</h3>
            <p className="text-sm text-white/60 mb-6">
              Once completed, this checklist cannot be edited. Make sure all fields are filled correctly.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCompleteConfirm(false)}
                className="flex-1 h-12 rounded-xl bg-white/10 text-white font-medium active:scale-[0.99]"
                data-testid="button-cancel-complete"
              >
                Cancel
              </button>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="flex-1 h-12 rounded-xl bg-blue-500 text-white font-medium active:scale-[0.99] disabled:opacity-50"
                data-testid="button-confirm-complete"
              >
                {completeMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  "Complete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileAssetSelectorField({ field, value, onChange, disabled, onAssetSelected }: {
  field: ChecklistField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  onAssetSelected?: (asset: SimpleAsset, sourceFieldId?: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { data: assets = [], isLoading } = useQuery<SimpleAsset[]>({
    queryKey: [ASSET_ROUTES.LIST_SIMPLE],
  });

  const selectedAsset = assets.find(a => a.id === value);
  const q = searchQuery.toLowerCase().trim();
  const filteredAssets = q
    ? assets.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.assetTag.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.serialNumber || "").toLowerCase().includes(q) ||
        (a.manufacturer || "").toLowerCase().includes(q) ||
        (a.model || "").toLowerCase().includes(q)
      )
    : assets;

  if (selectedAsset && !showSearch) {
    return (
      <div data-testid={`mobile-field-asset-${field.id}`}>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <Package className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-white truncate">{selectedAsset.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs border-white/20 text-white/70">{selectedAsset.assetTag}</Badge>
              <Badge variant="secondary" className="text-xs bg-white/10 text-white/70">{selectedAsset.category}</Badge>
            </div>
            {selectedAsset.serialNumber && (
              <p className="text-xs text-white/40 mt-1">S/N: {selectedAsset.serialNumber}</p>
            )}
            {selectedAsset.manufacturer && (
              <p className="text-xs text-white/40">
                {selectedAsset.manufacturer}{selectedAsset.model ? ` ${selectedAsset.model}` : ""}
              </p>
            )}
          </div>
          {!disabled && (
            <button
              onClick={() => { onChange(""); setShowSearch(true); }}
              className="p-1.5 rounded-lg bg-white/10 text-white/60"
              data-testid={`clear-asset-${field.id}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid={`mobile-field-asset-${field.id}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          type="text"
          placeholder="Search equipment by name, tag, serial..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className="w-full h-11 pl-9 pr-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
          data-testid={`search-asset-${field.id}`}
          autoFocus={showSearch}
        />
      </div>
      <div className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
        {isLoading ? (
          <div className="p-4 text-sm text-white/40 text-center">Loading equipment...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-4 text-sm text-white/40 text-center">
            {q ? "No matching equipment" : "No equipment available"}
          </div>
        ) : (
          filteredAssets.map(asset => (
            <button
              key={asset.id}
              onClick={() => {
                onChange(asset.id);
                onAssetSelected?.(asset, field.id);
                setSearchQuery("");
                setShowSearch(false);
              }}
              disabled={disabled}
              className="w-full text-left px-3 py-2.5 border-b border-white/5 last:border-b-0 active:bg-white/10"
              data-testid={`asset-option-${asset.id}`}
            >
              <p className="text-sm font-medium text-white truncate">{asset.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-white/50">{asset.assetTag}</span>
                <span className="text-xs text-white/40">{asset.category}</span>
                {asset.serialNumber && (
                  <span className="text-xs text-white/30">S/N: {asset.serialNumber}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface MobileFieldProps {
  field: ChecklistField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  onAssetSelected?: (asset: SimpleAsset, sourceFieldId?: string) => void;
}

function MobileFieldRenderer({ field, value, onChange, disabled, onAssetSelected }: MobileFieldProps) {
  switch (field.type) {
    case "asset_selector":
      return <MobileAssetSelectorField field={field} value={value} onChange={onChange} disabled={disabled} onAssetSelected={onAssetSelected} />;

    case "text_field":
      return (
        <input
          type="text"
          placeholder={field.placeholder || "Enter text..."}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
          data-testid={`mobile-field-input-${field.id}`}
        />
      );

    case "textarea":
      return (
        <textarea
          placeholder={field.placeholder || "Enter details..."}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-400/50 resize-none disabled:opacity-50"
          data-testid={`mobile-field-textarea-${field.id}`}
        />
      );

    case "number_field":
      return (
        <input
          type="number"
          placeholder={field.placeholder || "0"}
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          step={field.step ?? undefined}
          className="w-full h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
          data-testid={`mobile-field-number-${field.id}`}
        />
      );

    case "radio_button":
      return <MobileRadioField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "dropdown":
      return (
        <select
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-400/50 appearance-none disabled:opacity-50"
          data-testid={`mobile-field-dropdown-${field.id}`}
        >
          <option value="">{field.placeholder || "Select..."}</option>
          {(field.options || []).map((opt: ChecklistFieldOption) => (
            <option key={opt.value} value={opt.value}>{opt.text}</option>
          ))}
        </select>
      );

    case "checkbox":
      return <MobileCheckboxField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "pass_fail_flag":
      return <MobilePassFailField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "yes_no_na":
      return <MobileYesNoNaField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "condition_option":
      return <MobileConditionField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "inspection_check":
      return <MobileInspectionField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "date_field":
      return (
        <input
          type="date"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
          data-testid={`mobile-field-date-${field.id}`}
        />
      );

    case "time_field":
      return (
        <input
          type="time"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
          data-testid={`mobile-field-time-${field.id}`}
        />
      );

    case "datetime_field":
      return (
        <input
          type="datetime-local"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
          data-testid={`mobile-field-datetime-${field.id}`}
        />
      );

    case "amount_field":
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
          <input
            type="number"
            placeholder="0.00"
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            disabled={disabled}
            step="0.01"
            min="0"
            className="w-full h-11 pl-7 pr-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
            data-testid={`mobile-field-amount-${field.id}`}
          />
        </div>
      );

    case "percentage_field":
      return (
        <div className="relative">
          <input
            type="number"
            placeholder="0"
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            disabled={disabled}
            min={field.min ?? 0}
            max={field.max ?? 100}
            className="w-full h-11 px-3 pr-8 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
            data-testid={`mobile-field-percentage-${field.id}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">%</span>
        </div>
      );

    case "priority_level":
      return <MobilePriorityField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "rating_scale":
      return <MobileRatingField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "photo_required":
      return <MobilePhotoField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "multi_photo":
      return <MobileMultiPhotoField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "file_upload":
      return <MobileFileUploadField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "signature_field":
      return <MobileSignatureField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "progress_bar":
      return <MobileProgressField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case "measurement_field":
      return <MobileMeasurementField field={field} value={value} onChange={onChange} disabled={disabled} />;

    default:
      return (
        <input
          type="text"
          placeholder="Enter value..."
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
          data-testid={`mobile-field-default-${field.id}`}
        />
      );
  }
}

function MobileRadioField({ field, value, onChange, disabled }: MobileFieldProps) {
  const selected = value as string | null;
  return (
    <div className="space-y-2" data-testid={`mobile-field-radio-${field.id}`}>
      {(field.options || []).map((opt: ChecklistFieldOption) => (
        <button
          key={opt.value}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm active:scale-[0.99] disabled:opacity-50 ${
            selected === opt.value
              ? "border-blue-400/50 bg-blue-500/10 text-blue-400"
              : "border-white/10 bg-white/5 text-white"
          }`}
          data-testid={`mobile-radio-${field.id}-${opt.value}`}
        >
          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected === opt.value ? "border-blue-400" : "border-white/30"
          }`}>
            {selected === opt.value && <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />}
          </div>
          {opt.text}
        </button>
      ))}
    </div>
  );
}

function MobileCheckboxField({ field, value, onChange, disabled }: MobileFieldProps) {
  const selected = (value as string[]) || [];
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter(s => s !== v));
    else onChange([...selected, v]);
  };
  return (
    <div className="space-y-2" data-testid={`mobile-field-checkbox-${field.id}`}>
      {(field.options || []).map((opt: ChecklistFieldOption) => (
        <button
          key={opt.value}
          onClick={() => !disabled && toggle(opt.value)}
          disabled={disabled}
          className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm active:scale-[0.99] disabled:opacity-50 ${
            selected.includes(opt.value)
              ? "border-blue-400/50 bg-blue-500/10 text-blue-400"
              : "border-white/10 bg-white/5 text-white"
          }`}
          data-testid={`mobile-checkbox-${field.id}-${opt.value}`}
        >
          <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
            selected.includes(opt.value) ? "border-blue-400 bg-blue-400" : "border-white/30"
          }`}>
            {selected.includes(opt.value) && <CheckCircle className="h-3 w-3 text-white" />}
          </div>
          {opt.text}
        </button>
      ))}
    </div>
  );
}

function MobilePassFailField({ field, value, onChange, disabled }: MobileFieldProps) {
  const current = value as string | null;
  return (
    <div className="flex gap-2" data-testid={`mobile-field-passfail-${field.id}`}>
      <button
        onClick={() => !disabled && onChange("pass")}
        disabled={disabled}
        className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium active:scale-[0.99] disabled:opacity-50 ${
          current === "pass" ? "border-green-400/50 bg-green-500/20 text-green-400" : "border-white/10 bg-white/5 text-white/60"
        }`}
        data-testid={`mobile-pass-${field.id}`}
      >
        <CheckCircle className="h-4 w-4" /> Pass
      </button>
      <button
        onClick={() => !disabled && onChange("fail")}
        disabled={disabled}
        className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium active:scale-[0.99] disabled:opacity-50 ${
          current === "fail" ? "border-red-400/50 bg-red-500/20 text-red-400" : "border-white/10 bg-white/5 text-white/60"
        }`}
        data-testid={`mobile-fail-${field.id}`}
      >
        <X className="h-4 w-4" /> Fail
      </button>
    </div>
  );
}

function MobileYesNoNaField({ field, value, onChange, disabled }: MobileFieldProps) {
  const current = value as string | null;
  return (
    <div className="flex gap-2" data-testid={`mobile-field-yesnona-${field.id}`}>
      {[
        { val: "yes", label: "Yes", active: "border-green-400/50 bg-green-500/20 text-green-400" },
        { val: "no", label: "No", active: "border-red-400/50 bg-red-500/20 text-red-400" },
        { val: "na", label: "N/A", active: "border-white/30 bg-white/10 text-white" },
      ].map(opt => (
        <button
          key={opt.val}
          onClick={() => !disabled && onChange(opt.val)}
          disabled={disabled}
          className={`flex-1 h-11 rounded-xl border text-sm font-medium active:scale-[0.99] disabled:opacity-50 ${
            current === opt.val ? opt.active : "border-white/10 bg-white/5 text-white/60"
          }`}
          data-testid={`mobile-${opt.val}-${field.id}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MobileConditionField({ field, value, onChange, disabled }: MobileFieldProps) {
  const current = value as string | null;
  const conditions = (field.options && field.options.length > 0)
    ? field.options.map(opt => ({ value: opt.value, label: opt.text || opt.value }))
    : [
        { value: "good", label: "Good" },
        { value: "fair", label: "Fair" },
        { value: "poor", label: "Poor" },
        { value: "na", label: "N/A" },
      ];

  const activeStyles: Record<string, string> = {
    good: "border-green-400/50 bg-green-500/20 text-green-400",
    fair: "border-yellow-400/50 bg-yellow-500/20 text-yellow-400",
    poor: "border-red-400/50 bg-red-500/20 text-red-400",
    na: "border-white/30 bg-white/10 text-white",
  };

  return (
    <div className="flex gap-2 flex-wrap" data-testid={`mobile-field-condition-${field.id}`}>
      {conditions.map(c => (
        <button
          key={c.value}
          onClick={() => !disabled && onChange(c.value)}
          disabled={disabled}
          className={`flex-1 min-w-[70px] h-11 rounded-xl border text-sm font-medium active:scale-[0.99] disabled:opacity-50 ${
            current === c.value ? (activeStyles[c.value] || "border-blue-400/50 bg-blue-500/20 text-blue-400") : "border-white/10 bg-white/5 text-white/60"
          }`}
          data-testid={`mobile-condition-${c.value}-${field.id}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function MobileInspectionField({ field, value, onChange, disabled }: MobileFieldProps) {
  const checked = value === true;
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl border text-sm active:scale-[0.99] disabled:opacity-50 ${
        checked ? "border-green-400/50 bg-green-500/10 text-green-400" : "border-white/10 bg-white/5 text-white/60"
      }`}
      data-testid={`mobile-field-inspection-${field.id}`}
    >
      <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center ${
        checked ? "border-green-400 bg-green-400" : "border-white/30"
      }`}>
        {checked && <CheckCircle className="h-3 w-3 text-white" />}
      </div>
      Checked / Verified
    </button>
  );
}

function MobilePriorityField({ field, value, onChange, disabled }: MobileFieldProps) {
  const current = value as string | null;
  const priorities = [
    { value: "low", label: "Low", active: "border-blue-400/50 bg-blue-500/20 text-blue-400" },
    { value: "medium", label: "Medium", active: "border-yellow-400/50 bg-yellow-500/20 text-yellow-400" },
    { value: "high", label: "High", active: "border-red-400/50 bg-red-500/20 text-red-400" },
  ];
  return (
    <div className="flex gap-2" data-testid={`mobile-field-priority-${field.id}`}>
      {priorities.map(p => (
        <button
          key={p.value}
          onClick={() => !disabled && onChange(p.value)}
          disabled={disabled}
          className={`flex-1 h-11 rounded-xl border text-sm font-medium active:scale-[0.99] disabled:opacity-50 ${
            current === p.value ? p.active : "border-white/10 bg-white/5 text-white/60"
          }`}
          data-testid={`mobile-priority-${p.value}-${field.id}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function MobileRatingField({ field, value, onChange, disabled }: MobileFieldProps) {
  const max = field.max ?? 5;
  const current = (value as number) || 0;
  return (
    <div className="flex items-center gap-2" data-testid={`mobile-field-rating-${field.id}`}>
      {Array.from({ length: max }, (_, i) => i + 1).map(rating => (
        <button
          key={rating}
          onClick={() => !disabled && onChange(rating)}
          disabled={disabled}
          className="p-1 active:scale-[0.9]"
          data-testid={`mobile-rating-${rating}-${field.id}`}
        >
          <Star className={`h-8 w-8 transition-colors ${
            rating <= current ? "fill-yellow-400 text-yellow-400" : "text-white/20"
          }`} />
        </button>
      ))}
    </div>
  );
}

function MobilePhotoField({ field, value, onChange, disabled }: MobileFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const photoData = value as { base64: string; filename: string } | null;

  useEffect(() => {
    if (photoData?.base64) setPreview(photoData.base64);
  }, [photoData]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const base64 = await compressImage(file);
      setPreview(base64);
      onChange({ filename: file.name, base64, type: "image/jpeg" });
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setPreview(base64);
        onChange({ filename: file.name, base64, type: file.type });
      };
      reader.readAsDataURL(file);
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div data-testid={`mobile-field-photo-${field.id}`}>
      {compressing ? (
        <div className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/20 bg-white/5">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-2" />
          <span className="text-sm text-white/40">Compressing photo...</span>
        </div>
      ) : preview ? (
        <div className="relative rounded-xl overflow-hidden">
          <img src={preview} alt="Captured" className="w-full max-h-48 object-cover rounded-xl" />
          {!disabled && (
            <button
              onClick={() => { setPreview(null); onChange(null); }}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center active:scale-[0.99]"
              data-testid={`mobile-remove-photo-${field.id}`}
            >
              <X className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer active:scale-[0.99] ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
          <Camera className="h-8 w-8 text-white/40 mb-2" />
          <span className="text-sm text-white/40">Tap to take photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapture}
            disabled={disabled}
            data-testid={`mobile-input-photo-${field.id}`}
          />
        </label>
      )}
    </div>
  );
}

function MobileMultiPhotoField({ field, value, onChange, disabled }: MobileFieldProps) {
  const photos = (value as Array<{ filename: string; base64: string; type: string }>) || [];
  const [compressing, setCompressing] = useState(false);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setCompressing(true);
    try {
      const newPhotos = [...photos];
      for (const file of Array.from(files)) {
        try {
          const base64 = await compressImage(file);
          newPhotos.push({ filename: file.name, base64, type: "image/jpeg" });
        } catch {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.readAsDataURL(file);
          });
          newPhotos.push({ filename: file.name, base64, type: file.type });
        }
      }
      onChange(newPhotos);
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div data-testid={`mobile-field-multiphoto-${field.id}`}>
      <div className="flex flex-wrap gap-2 mb-2">
        {photos.map((photo, idx) => (
          <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden">
            <img src={photo.base64} alt={photo.filename} className="w-full h-full object-cover" />
            {!disabled && (
              <button
                onClick={() => onChange(photos.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center"
                data-testid={`mobile-remove-multiphoto-${field.id}-${idx}`}
              >
                <X className="h-3 w-3 text-white" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          compressing ? (
            <div className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-white/20 bg-white/5">
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer active:scale-[0.99]">
              <Camera className="h-5 w-5 text-white/40 mb-1" />
              <span className="text-[10px] text-white/40">Add</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handleCapture}
                data-testid={`mobile-input-multiphoto-${field.id}`}
              />
            </label>
          )
        )}
      </div>
      {photos.length > 0 && (
        <p className="text-xs text-white/40">{photos.length} photo{photos.length !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

function MobileFileUploadField({ field, value, onChange, disabled }: MobileFieldProps) {
  const fileInfo = value as { filename: string } | null;
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (file.type.startsWith("image/")) {
        const base64 = await compressImage(file);
        onChange({ filename: file.name, base64, type: "image/jpeg", size: file.size });
      } else {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
        onChange({ filename: file.name, base64, type: file.type, size: file.size });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid={`mobile-field-file-${field.id}`}>
      {fileInfo ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5">
          <span className="text-sm text-white truncate flex-1">{fileInfo.filename}</span>
          {!disabled && (
            <button onClick={() => onChange(null)} className="text-xs text-red-400 active:scale-[0.99]" data-testid={`mobile-remove-file-${field.id}`}>
              Remove
            </button>
          )}
        </div>
      ) : uploading ? (
        <div className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-white/20 bg-white/5">
          <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
          <span className="text-sm text-white/40">Processing...</span>
        </div>
      ) : (
        <label className={`flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer active:scale-[0.99] ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="h-5 w-5 text-white/40" />
          <span className="text-sm text-white/40">Upload File</span>
          <input type="file" className="hidden" onChange={handleFile} disabled={disabled} data-testid={`mobile-input-file-${field.id}`} />
        </label>
      )}
    </div>
  );
}

function MobileSignatureField({ field, value, onChange, disabled }: MobileFieldProps) {
  const sig = value as { name: string; date: string } | null;

  if (sig) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3" data-testid={`mobile-field-signature-${field.id}`}>
        <div className="text-sm font-medium text-white">Signed: {sig.name}</div>
        <div className="text-xs text-white/40">{new Date(sig.date).toLocaleDateString()}</div>
        {!disabled && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-red-400 mt-2 active:scale-[0.99]"
            data-testid={`mobile-clear-signature-${field.id}`}
          >
            Clear Signature
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const name = prompt("Enter your name to sign:");
        if (name) onChange({ name, date: new Date().toISOString() });
      }}
      disabled={disabled}
      className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border-2 border-dashed border-white/20 bg-white/5 text-sm text-white/60 active:scale-[0.99] disabled:opacity-50"
      data-testid={`mobile-sign-${field.id}`}
    >
      Tap to Sign
    </button>
  );
}

function MobileProgressField({ field, value, onChange, disabled }: MobileFieldProps) {
  const current = (value as number) ?? 0;
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  return (
    <div data-testid={`mobile-field-progress-${field.id}`}>
      <div className="flex items-center gap-3 mb-2">
        <input
          type="range"
          min={min}
          max={max}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 accent-blue-400"
        />
        <span className="text-sm font-medium text-white w-12 text-right">{current}%</span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full transition-all"
          style={{ width: `${max === min ? 0 : Math.min(100, ((current - min) / (max - min)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function MobileMeasurementField({ field, value, onChange, disabled }: MobileFieldProps) {
  const mv = (value as { amount: number | null; unit: string }) || { amount: null, unit: "" };
  return (
    <div className="flex gap-2" data-testid={`mobile-field-measurement-${field.id}`}>
      <input
        type="number"
        placeholder="Value"
        value={mv.amount ?? ""}
        onChange={(e) => onChange({ ...mv, amount: e.target.value ? Number(e.target.value) : null })}
        disabled={disabled}
        className="flex-1 h-11 px-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-400/50 disabled:opacity-50"
      />
      <select
        value={mv.unit || ""}
        onChange={(e) => onChange({ ...mv, unit: e.target.value })}
        disabled={disabled}
        className="w-20 h-11 px-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-400/50 appearance-none disabled:opacity-50"
      >
        <option value="">Unit</option>
        <option value="mm">mm</option>
        <option value="cm">cm</option>
        <option value="m">m</option>
        <option value="in">in</option>
        <option value="ft">ft</option>
        <option value="kg">kg</option>
        <option value="t">t</option>
        <option value="L">L</option>
        <option value="m3">m3</option>
      </select>
    </div>
  );
}
