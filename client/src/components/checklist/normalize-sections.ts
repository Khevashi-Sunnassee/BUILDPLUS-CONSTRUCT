import type { ChecklistSection, ChecklistField, ChecklistFieldType, ChecklistFieldOption } from "@shared/schema";

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
  options?: Array<{ text?: string; label?: string; value: string; color?: string }> | string[];
  min?: number | null;
  max?: number | null;
  step?: number | null;
  dependsOn?: string;
  dependsOnValue?: string;
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
  datetime: "datetime_field",
  amount: "amount_field",
  percentage: "percentage_field",
  priority: "priority_level",
  rating: "rating_scale",
  photo: "photo_required",
  multi_photo: "multi_photo",
  signature: "signature_field",
  condition: "condition_option",
  inspection: "inspection_check",
  file_upload: "file_upload",
  progress: "progress_bar",
  measurement: "measurement_field",
  yes_no: "yes_no_na",
  select: "dropdown",
};

function normalizeFieldType(rawType: string | undefined): ChecklistFieldType {
  if (!rawType) return "text_field";
  return LEGACY_TYPE_MAP[rawType] || rawType as ChecklistFieldType;
}

function normalizeOptions(raw: LegacyField["options"]): ChecklistFieldOption[] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined;
  return raw.map((opt) => {
    if (typeof opt === "string") {
      return { text: opt, value: opt };
    }
    return {
      text: opt.text || opt.label || "",
      value: opt.value,
      color: opt.color,
    };
  });
}

function normalizeField(raw: LegacyField): ChecklistField {
  const type = normalizeFieldType(raw.type || raw.fieldType);
  const base = {
    id: raw.id,
    name: raw.name || raw.label || "Unnamed Field",
    required: raw.required || false,
    description: raw.description,
    placeholder: raw.placeholder,
    photoRequired: raw.photoRequired,
    instructions: raw.instructions,
    dependsOn: raw.dependsOn,
    dependsOnValue: raw.dependsOnValue,
  };

  const options = normalizeOptions(raw.options);
  const numericRange = { min: raw.min, max: raw.max, step: raw.step };

  switch (type) {
    case "number_field":
      return { ...base, type, ...numericRange };
    case "measurement_field":
      return { ...base, type, ...numericRange };
    case "progress_bar":
      return { ...base, type, min: raw.min, max: raw.max };
    case "percentage_field":
      return { ...base, type, min: raw.min, max: raw.max };
    case "rating_scale":
      return { ...base, type, min: raw.min, max: raw.max };
    case "radio_button":
      return { ...base, type, options };
    case "dropdown":
      return { ...base, type, options };
    case "checkbox":
      return { ...base, type, options };
    case "condition_option":
      return { ...base, type, options };
    default:
      return { ...base, type } as ChecklistField;
  }
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
