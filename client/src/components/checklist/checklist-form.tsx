import { useMemo, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ChevronsUpDown, ChevronsDownUp, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { renderField } from "./field-renderers";
import type { SimpleAsset } from "./field-renderers";
import { normalizeSections } from "./normalize-sections";
import type { ChecklistTemplate, ChecklistSection, ChecklistField } from "@shared/schema";

interface ChecklistFormProps {
  template: ChecklistTemplate;
  responses: Record<string, unknown>;
  onChange: (responses: Record<string, unknown>) => void;
  disabled?: boolean;
  showProgress?: boolean;
}

export function isFieldVisible(
  field: ChecklistField & { dependsOn?: string; dependsOnValue?: string },
  responses: Record<string, unknown>
): boolean {
  if (!field.dependsOn) return true;
  const depValue = responses[field.dependsOn];
  return depValue === field.dependsOnValue;
}

export function ChecklistForm({
  template,
  responses,
  onChange,
  disabled = false,
  showProgress = true,
}: ChecklistFormProps) {
  const sections: ChecklistSection[] = normalizeSections(template.sections);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedSections(new Set());
  const collapseAll = () => setCollapsedSections(new Set(sections.map(s => s.id)));

  const allExpanded = collapsedSections.size === 0;

  const handleFieldChange = (fieldId: string, value: unknown) => {
    onChange({
      ...responses,
      [fieldId]: value,
    });
  };

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
      onChange({ ...responses, ...updates });
    }
  }, [sections, responses, onChange]);

  const { completedCount, totalRequired, progress, missingRequired } = useMemo(() => {
    let completed = 0;
    let total = 0;
    const missing: string[] = [];

    sections.forEach((section) => {
      section.items?.forEach((field: ChecklistField) => {
        const extField = field as typeof field & { dependsOn?: string; dependsOnValue?: string };
        if (!isFieldVisible(extField, responses)) return;
        if (field.required) {
          total++;
          const value = responses[field.id];
          const hasValue =
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !(Array.isArray(value) && value.length === 0);
          if (hasValue) {
            completed++;
          } else {
            missing.push(field.name);
          }
        }
      });
    });

    return {
      completedCount: completed,
      totalRequired: total,
      progress: total > 0 ? (completed / total) * 100 : 100,
      missingRequired: missing,
    };
  }, [sections, responses]);

  if (sections.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This template has no sections or fields. Please add sections in the template editor.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {showProgress && totalRequired > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Completion Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount} / {totalRequired} required fields
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {sections.length > 1 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={allExpanded ? collapseAll : expandAll}
            data-testid="button-toggle-all-sections"
          >
            {allExpanded ? (
              <>
                <ChevronsDownUp className="h-4 w-4 mr-2" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-4 w-4 mr-2" />
                Expand All
              </>
            )}
          </Button>
        </div>
      )}

      {sections.map((section, sectionIndex) => {
        const isCollapsed = collapsedSections.has(section.id);
        return (
        <Card key={section.id} data-testid={`checklist-section-${section.id}`}>
          <CardHeader
            className="pb-3 cursor-pointer select-none hover-elevate"
            onClick={() => toggleSection(section.id)}
            data-testid={`button-toggle-section-${section.id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div>
                  <CardTitle className="text-lg">
                    {sectionIndex + 1}. {section.name}
                  </CardTitle>
                  {section.description && !isCollapsed && (
                    <CardDescription className="mt-1">{section.description}</CardDescription>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isCollapsed && (
                  <Badge variant="secondary">{section.items?.length || 0} fields</Badge>
                )}
                {section.allowRepeats && (
                  <Badge variant="outline">Repeatable</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          {!isCollapsed && (
            <CardContent>
              <div className="space-y-6">
                {section.items?.map((field: ChecklistField, fieldIndex: number) => {
                  const extField = field as typeof field & { dependsOn?: string; dependsOnValue?: string };
                  if (!isFieldVisible(extField, responses)) return null;
                  return (
                  <div key={field.id} data-testid={`checklist-field-${field.id}`}>
                    {fieldIndex > 0 && <Separator className="mb-6" />}
                    <div className={`space-y-2 ${field.workOrderEnabled ? "rounded-md border border-amber-500/30 bg-amber-500/5 p-3 -mx-1" : ""}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-sm font-medium">
                          {field.name}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {field.workOrderEnabled && (
                          <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                            <ClipboardList className="h-3 w-3 mr-1" />
                            Work Order
                          </Badge>
                        )}
                        {field.photoRequired && (
                          <Badge variant="secondary" className="text-xs">Photo Required</Badge>
                        )}
                      </div>
                      {field.description && (
                        <p className="text-sm text-muted-foreground">{field.description}</p>
                      )}
                      {field.instructions && (
                        <Alert className="py-2">
                          <AlertDescription className="text-xs">{field.instructions}</AlertDescription>
                        </Alert>
                      )}
                      <div className="pt-1">
                        {renderField(
                          field,
                          responses[field.id],
                          (value) => handleFieldChange(field.id, value),
                          disabled,
                          field.type === "asset_selector" ? handleAssetSelected : undefined
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
                {(!section.items || section.items.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No fields in this section
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
        );
      })}
    </div>
  );
}

export function calculateCompletionRate(
  template: ChecklistTemplate,
  responses: Record<string, unknown>
): number {
  const sections: ChecklistSection[] = normalizeSections(template.sections);
  let completed = 0;
  let total = 0;

  sections.forEach((section: ChecklistSection) => {
    section.items?.forEach((field: ChecklistField) => {
      const extField = field as typeof field & { dependsOn?: string; dependsOnValue?: string };
      if (!isFieldVisible(extField, responses)) return;
      if (field.required) {
        total++;
        const value = responses[field.id];
        const hasValue =
          value !== undefined &&
          value !== null &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0);
        if (hasValue) {
          completed++;
        }
      }
    });
  });

  return total > 0 ? (completed / total) * 100 : 100;
}

export function getMissingRequiredFields(
  template: ChecklistTemplate,
  responses: Record<string, unknown>
): string[] {
  const sections: ChecklistSection[] = normalizeSections(template.sections);
  const missing: string[] = [];

  sections.forEach((section: ChecklistSection) => {
    section.items?.forEach((field: ChecklistField) => {
      const extField = field as typeof field & { dependsOn?: string; dependsOnValue?: string };
      if (!isFieldVisible(extField, responses)) return;
      if (field.required) {
        const value = responses[field.id];
        const hasValue =
          value !== undefined &&
          value !== null &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0);
        if (!hasValue) {
          missing.push(`${section.name} - ${field.name}`);
        }
      }
    });
  });

  return missing;
}
