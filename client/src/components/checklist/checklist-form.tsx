import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { renderField } from "./field-renderers";
import { normalizeSections } from "./normalize-sections";
import type { ChecklistTemplate, ChecklistSection, ChecklistField } from "@shared/schema";

interface ChecklistFormProps {
  template: ChecklistTemplate;
  responses: Record<string, unknown>;
  onChange: (responses: Record<string, unknown>) => void;
  disabled?: boolean;
  showProgress?: boolean;
}

export function ChecklistForm({
  template,
  responses,
  onChange,
  disabled = false,
  showProgress = true,
}: ChecklistFormProps) {
  const sections = normalizeSections(template.sections);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    onChange({
      ...responses,
      [fieldId]: value,
    });
  };

  const { completedCount, totalRequired, progress, missingRequired } = useMemo(() => {
    let completed = 0;
    let total = 0;
    const missing: string[] = [];

    sections.forEach((section) => {
      section.items?.forEach((field: ChecklistField) => {
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

      {sections.map((section, sectionIndex) => (
        <Card key={section.id} data-testid={`checklist-section-${section.id}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">
                  {sectionIndex + 1}. {section.name}
                </CardTitle>
                {section.description && (
                  <CardDescription className="mt-1">{section.description}</CardDescription>
                )}
              </div>
              {section.allowRepeats && (
                <Badge variant="outline">Repeatable</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {section.items?.map((field: ChecklistField, fieldIndex: number) => (
                <div key={field.id} data-testid={`checklist-field-${field.id}`}>
                  {fieldIndex > 0 && <Separator className="mb-6" />}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">
                        {field.name}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
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
                        disabled
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!section.items || section.items.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No fields in this section
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function calculateCompletionRate(
  template: ChecklistTemplate,
  responses: Record<string, unknown>
): number {
  const sections = normalizeSections(template.sections);
  let completed = 0;
  let total = 0;

  sections.forEach((section) => {
    section.items?.forEach((field: ChecklistField) => {
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
  const sections = normalizeSections(template.sections);
  const missing: string[] = [];

  sections.forEach((section) => {
    section.items?.forEach((field: ChecklistField) => {
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
