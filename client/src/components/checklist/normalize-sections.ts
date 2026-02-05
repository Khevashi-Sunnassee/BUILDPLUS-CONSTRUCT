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
  options?: Array<{ text?: string; label?: string; value: string; color?: string }>;
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

const LEGACY_TYPE_MAP: Record<string, ChecklistFieldType> = {
  text: "text_field",
  number: "number_field",
  radio: "radio_button",
  date: "date_field",
  time: "time_field",
  amount: "amount_field",
  percentage: "percentage_field",
  priority: "priority_level",
  rating: "rating_scale",
  photo: "photo_required",
  signature: "signature_field",
  condition: "condition_option",
  inspection: "inspection_check",
};

function normalizeFieldType(rawType: string | undefined): ChecklistFieldType {
  if (!rawType) return "text_field";
  return LEGACY_TYPE_MAP[rawType] || rawType as ChecklistFieldType;
}

function normalizeOptions(raw: LegacyField["options"]): ChecklistField["options"] {
  if (!raw || !Array.isArray(raw)) return undefined;
  return raw.map((opt) => ({
    text: opt.text || opt.label || "",
    value: opt.value,
    color: opt.color,
  }));
}

function normalizeField(raw: LegacyField): ChecklistField {
  return {
    id: raw.id,
    name: raw.name || raw.label || "Unnamed Field",
    type: normalizeFieldType(raw.type || raw.fieldType),
    required: raw.required || false,
    description: raw.description,
    placeholder: raw.placeholder,
    photoRequired: raw.photoRequired,
    instructions: raw.instructions,
    options: normalizeOptions(raw.options),
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
