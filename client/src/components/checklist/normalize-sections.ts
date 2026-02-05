import type { ChecklistSection, ChecklistField, ChecklistFieldType } from "@shared/schema";

interface LegacyField {
  id: string;
  label?: string;
  name?: string;
  fieldType?: string;
  type?: string;
  order?: number;
  required?: boolean;
  description?: string;
  placeholder?: string;
  photoRequired?: boolean;
  instructions?: string;
  options?: Array<{ text: string; value: string; color?: string }>;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  [key: string]: unknown;
}

interface LegacySection {
  id: string;
  title?: string;
  name?: string;
  fields?: LegacyField[];
  items?: LegacyField[];
  order?: number;
  description?: string;
  allowRepeats?: boolean;
  [key: string]: unknown;
}

function normalizeField(raw: LegacyField): ChecklistField {
  return {
    id: raw.id,
    name: raw.name || raw.label || "Unnamed Field",
    type: (raw.type || raw.fieldType || "text_field") as ChecklistFieldType,
    required: raw.required || false,
    description: raw.description,
    placeholder: raw.placeholder,
    photoRequired: raw.photoRequired,
    instructions: raw.instructions,
    options: raw.options,
    min: raw.min,
    max: raw.max,
    step: raw.step,
  };
}

export function normalizeSections(rawSections: unknown): ChecklistSection[] {
  if (!rawSections || !Array.isArray(rawSections)) return [];

  return rawSections.map((raw: LegacySection, index: number) => ({
    id: raw.id || `section-${index}`,
    name: raw.name || raw.title || "Unnamed Section",
    description: raw.description,
    order: raw.order ?? index,
    allowRepeats: raw.allowRepeats || false,
    items: (raw.items || raw.fields || []).map(normalizeField),
  }));
}
