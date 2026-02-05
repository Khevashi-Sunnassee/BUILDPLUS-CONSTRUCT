import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Save,
  Loader2,
  ArrowLeft,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  Copy,
  Type,
  AlignLeft,
  Hash,
  CheckCircle,
  Circle,
  Square,
  Calendar,
  Clock,
  DollarSign,
  Percent,
  Briefcase,
  Users,
  Building2,
  Star,
  Camera,
  Images,
  FileUp,
  PenTool,
  ListChecks,
  AlertCircle,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type {
  ChecklistTemplate,
  ChecklistSection,
  ChecklistField,
  ChecklistFieldType,
  ChecklistFieldOption,
} from "@shared/schema";
import { CHECKLIST_ROUTES } from "@shared/api-routes";
import { Link } from "wouter";

const FIELD_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; category: string; description: string }
> = {
  text_field: { label: "Text Field", icon: Type, category: "Basic", description: "Single line text input" },
  textarea: { label: "Text Area", icon: AlignLeft, category: "Basic", description: "Multi-line text input" },
  number_field: { label: "Number", icon: Hash, category: "Basic", description: "Numeric input" },
  radio_button: { label: "Radio Button", icon: Circle, category: "Basic", description: "Single choice selection" },
  dropdown: { label: "Dropdown", icon: ChevronDown, category: "Basic", description: "Dropdown selection" },
  checkbox: { label: "Checkbox", icon: Square, category: "Basic", description: "Multiple choice selection" },
  pass_fail_flag: { label: "Pass/Fail", icon: CheckCircle, category: "Quality", description: "Pass or fail indicator" },
  yes_no_na: { label: "Yes/No/NA", icon: ListChecks, category: "Quality", description: "Yes, No, or N/A options" },
  condition_option: { label: "Condition", icon: AlertCircle, category: "Quality", description: "Good/Fair/Poor/NA" },
  inspection_check: { label: "Inspection Check", icon: CheckCircle, category: "Quality", description: "Inspection checkbox" },
  date_field: { label: "Date", icon: Calendar, category: "DateTime", description: "Date picker" },
  time_field: { label: "Time", icon: Clock, category: "DateTime", description: "Time picker" },
  datetime_field: { label: "Date & Time", icon: Calendar, category: "DateTime", description: "Date and time picker" },
  amount_field: { label: "Amount", icon: DollarSign, category: "Financial", description: "Currency amount" },
  percentage_field: { label: "Percentage", icon: Percent, category: "Financial", description: "Percentage value" },
  job_selector: { label: "Job Selector", icon: Briefcase, category: "Selector", description: "Select a job" },
  customer_selector: { label: "Customer Selector", icon: Users, category: "Selector", description: "Select a customer" },
  supplier_selector: { label: "Supplier Selector", icon: Building2, category: "Selector", description: "Select a supplier" },
  staff_assignment: { label: "Staff Assignment", icon: Users, category: "Selector", description: "Assign staff members" },
  priority_level: { label: "Priority Level", icon: AlertCircle, category: "Selection", description: "Priority selection" },
  rating_scale: { label: "Rating Scale", icon: Star, category: "Selection", description: "1-5 star rating" },
  photo_required: { label: "Photo", icon: Camera, category: "Media", description: "Single photo upload" },
  multi_photo: { label: "Multi Photo", icon: Images, category: "Media", description: "Multiple photos" },
  file_upload: { label: "File Upload", icon: FileUp, category: "Media", description: "File attachment" },
  signature_field: { label: "Signature", icon: PenTool, category: "Media", description: "Digital signature" },
};

const FIELD_CATEGORIES = ["Basic", "Quality", "DateTime", "Financial", "Selector", "Selection", "Media"];

const sectionSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  description: z.string().optional(),
  allowRepeats: z.boolean().default(false),
});

const fieldSchema = z.object({
  name: z.string().min(1, "Field name is required"),
  type: z.string().min(1, "Field type is required"),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  photoRequired: z.boolean().default(false),
  instructions: z.string().optional(),
  min: z.coerce.number().optional().nullable(),
  max: z.coerce.number().optional().nullable(),
  step: z.coerce.number().optional().nullable(),
});

type SectionFormData = z.infer<typeof sectionSchema>;
type FieldFormData = z.infer<typeof fieldSchema>;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ChecklistSection | null>(null);
  const [deleteSectionDialogOpen, setDeleteSectionDialogOpen] = useState(false);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);

  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<ChecklistField | null>(null);
  const [editingFieldSectionId, setEditingFieldSectionId] = useState<string | null>(null);
  const [deleteFieldDialogOpen, setDeleteFieldDialogOpen] = useState(false);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);
  const [deletingFieldSectionId, setDeletingFieldSectionId] = useState<string | null>(null);

  const [fieldOptionsDialogOpen, setFieldOptionsDialogOpen] = useState(false);
  const [editingFieldOptions, setEditingFieldOptions] = useState<ChecklistFieldOption[]>([]);

  const { data: template, isLoading } = useQuery<ChecklistTemplate>({
    queryKey: [CHECKLIST_ROUTES.TEMPLATE_BY_ID(id!)],
    enabled: !!id,
  });

  useEffect(() => {
    if (template?.sections && !hasChanges) {
      setSections(template.sections as ChecklistSection[]);
    }
  }, [template, hasChanges]);

  const sectionForm = useForm<SectionFormData>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      name: "",
      description: "",
      allowRepeats: false,
    },
  });

  const fieldForm = useForm<FieldFormData>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name: "",
      type: "text_field",
      description: "",
      placeholder: "",
      required: false,
      photoRequired: false,
      instructions: "",
      min: null,
      max: null,
      step: null,
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", CHECKLIST_ROUTES.TEMPLATE_BY_ID(id!), {
        sections,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.TEMPLATES] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.TEMPLATE_BY_ID(id!)] });
      setHasChanges(false);
      toast({ title: "Success", description: "Template saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    },
  });

  const handleOpenSectionDialog = (section?: ChecklistSection) => {
    if (section) {
      setEditingSection(section);
      sectionForm.reset({
        name: section.name,
        description: section.description || "",
        allowRepeats: section.allowRepeats || false,
      });
    } else {
      setEditingSection(null);
      sectionForm.reset({
        name: "",
        description: "",
        allowRepeats: false,
      });
    }
    setSectionDialogOpen(true);
  };

  const handleOpenFieldDialog = (sectionId: string, field?: ChecklistField) => {
    setEditingFieldSectionId(sectionId);
    if (field) {
      setEditingField(field);
      setEditingFieldOptions(field.options || []);
      fieldForm.reset({
        name: field.name,
        type: field.type,
        description: field.description || "",
        placeholder: field.placeholder || "",
        required: field.required || false,
        photoRequired: field.photoRequired || false,
        instructions: field.instructions || "",
        min: field.min ?? null,
        max: field.max ?? null,
        step: field.step ?? null,
      });
    } else {
      setEditingField(null);
      setEditingFieldOptions([]);
      fieldForm.reset({
        name: "",
        type: "text_field",
        description: "",
        placeholder: "",
        required: false,
        photoRequired: false,
        instructions: "",
        min: null,
        max: null,
        step: null,
      });
    }
    setFieldDialogOpen(true);
  };

  const onSubmitSection = (data: SectionFormData) => {
    if (editingSection) {
      setSections((prev) =>
        prev.map((s) =>
          s.id === editingSection.id
            ? { ...s, name: data.name, description: data.description, allowRepeats: data.allowRepeats }
            : s
        )
      );
    } else {
      const newSection: ChecklistSection = {
        id: generateId(),
        name: data.name,
        description: data.description,
        order: sections.length,
        allowRepeats: data.allowRepeats,
        items: [],
      };
      setSections((prev) => [...prev, newSection]);
      setExpandedSections((prev) => [...prev, newSection.id]);
    }
    setHasChanges(true);
    setSectionDialogOpen(false);
    sectionForm.reset();
  };

  const onSubmitField = (data: FieldFormData) => {
    if (!editingFieldSectionId) return;

    const newField: ChecklistField = {
      id: editingField?.id || generateId(),
      name: data.name,
      type: data.type as ChecklistFieldType,
      description: data.description,
      placeholder: data.placeholder,
      required: data.required,
      photoRequired: data.photoRequired,
      instructions: data.instructions,
      options: editingFieldOptions.length > 0 ? editingFieldOptions : undefined,
      min: data.min,
      max: data.max,
      step: data.step,
    };

    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== editingFieldSectionId) return section;
        if (editingField) {
          return {
            ...section,
            items: section.items.map((f) => (f.id === editingField.id ? newField : f)),
          };
        }
        return {
          ...section,
          items: [...section.items, newField],
        };
      })
    );

    setHasChanges(true);
    setFieldDialogOpen(false);
    fieldForm.reset();
    setEditingFieldOptions([]);
  };

  const handleDeleteSection = () => {
    if (!deletingSectionId) return;
    setSections((prev) => prev.filter((s) => s.id !== deletingSectionId));
    setHasChanges(true);
    setDeleteSectionDialogOpen(false);
    setDeletingSectionId(null);
  };

  const handleDeleteField = () => {
    if (!deletingFieldId || !deletingFieldSectionId) return;
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== deletingFieldSectionId) return section;
        return {
          ...section,
          items: section.items.filter((f) => f.id !== deletingFieldId),
        };
      })
    );
    setHasChanges(true);
    setDeleteFieldDialogOpen(false);
    setDeletingFieldId(null);
    setDeletingFieldSectionId(null);
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    setSections((prev) => {
      const newSections = [...prev];
      [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
      return newSections.map((s, i) => ({ ...s, order: i }));
    });
    setHasChanges(true);
  };

  const moveField = (sectionId: string, fieldIndex: number, direction: "up" | "down") => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const newIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
        if (newIndex < 0 || newIndex >= section.items.length) return section;

        const newItems = [...section.items];
        [newItems[fieldIndex], newItems[newIndex]] = [newItems[newIndex], newItems[fieldIndex]];
        return { ...section, items: newItems };
      })
    );
    setHasChanges(true);
  };

  const duplicateField = (sectionId: string, field: ChecklistField) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const newField: ChecklistField = {
          ...field,
          id: generateId(),
          name: `${field.name} (Copy)`,
        };
        return { ...section, items: [...section.items, newField] };
      })
    );
    setHasChanges(true);
  };

  const addFieldFromPalette = (sectionId: string, fieldType: string) => {
    const config = FIELD_TYPE_CONFIG[fieldType];
    if (!config) return;

    const newField: ChecklistField = {
      id: generateId(),
      name: config.label,
      type: fieldType as ChecklistFieldType,
      required: false,
    };

    if (["radio_button", "dropdown", "checkbox"].includes(fieldType)) {
      newField.options = [
        { text: "Option 1", value: "option_1" },
        { text: "Option 2", value: "option_2" },
      ];
    }

    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return { ...section, items: [...section.items, newField] };
      })
    );
    setHasChanges(true);

    if (!expandedSections.includes(sectionId)) {
      setExpandedSections((prev) => [...prev, sectionId]);
    }
  };

  const addOption = () => {
    setEditingFieldOptions((prev) => [
      ...prev,
      { text: `Option ${prev.length + 1}`, value: `option_${prev.length + 1}` },
    ]);
  };

  const updateOption = (index: number, field: "text" | "value", value: string) => {
    setEditingFieldOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt))
    );
  };

  const removeOption = (index: number) => {
    setEditingFieldOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const fieldTypeRequiresOptions = (type: string) => {
    return ["radio_button", "dropdown", "checkbox"].includes(type);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Template Not Found</h3>
          <p className="text-muted-foreground mb-4">The template you're looking for doesn't exist.</p>
          <Button asChild>
            <Link href="/admin/checklist-templates">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href="/admin/checklist-templates">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            <p className="text-muted-foreground">{template.description || "No description"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="mr-2">
              Unsaved Changes
            </Badge>
          )}
          <Button
            onClick={() => saveTemplateMutation.mutate()}
            disabled={!hasChanges || saveTemplateMutation.isPending}
            data-testid="button-save-template"
          >
            {saveTemplateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Sections</h2>
            <Button onClick={() => handleOpenSectionDialog()} data-testid="button-add-section">
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>

          {sections.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <ListChecks className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Sections Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start building your template by adding a section
              </p>
              <Button onClick={() => handleOpenSectionDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Section
              </Button>
            </Card>
          ) : (
            <Accordion
              type="multiple"
              value={expandedSections}
              onValueChange={setExpandedSections}
              className="space-y-4"
            >
              {sections.map((section, sectionIndex) => (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`section-${section.id}`}
                >
                  <div className="flex items-center bg-muted/50">
                    <div className="p-3 cursor-move">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <AccordionTrigger className="flex-1 px-2 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{section.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {section.items.length} fields
                        </Badge>
                        {section.allowRepeats && (
                          <Badge variant="outline" className="text-xs">
                            Repeatable
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <div className="flex items-center gap-1 pr-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSection(sectionIndex, "up");
                        }}
                        disabled={sectionIndex === 0}
                        data-testid={`button-move-section-up-${section.id}`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSection(sectionIndex, "down");
                        }}
                        disabled={sectionIndex === sections.length - 1}
                        data-testid={`button-move-section-down-${section.id}`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSectionDialog(section);
                        }}
                        data-testid={`button-edit-section-${section.id}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingSectionId(section.id);
                          setDeleteSectionDialogOpen(true);
                        }}
                        data-testid={`button-delete-section-${section.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="p-4 pt-2">
                    {section.description && (
                      <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                    )}
                    <div className="space-y-2">
                      {section.items.map((field, fieldIndex) => {
                        const config = FIELD_TYPE_CONFIG[field.type];
                        const Icon = config?.icon || Type;
                        return (
                          <div
                            key={field.id}
                            className="flex items-center gap-2 p-3 border rounded-md bg-background"
                            data-testid={`field-${field.id}`}
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{field.name}</span>
                                {field.required && (
                                  <Badge variant="destructive" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {config?.label || field.type}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => moveField(section.id, fieldIndex, "up")}
                                disabled={fieldIndex === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => moveField(section.id, fieldIndex, "down")}
                                disabled={fieldIndex === section.items.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => duplicateField(section.id, field)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenFieldDialog(section.id, field)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeletingFieldId(field.id);
                                  setDeletingFieldSectionId(section.id);
                                  setDeleteFieldDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <Button
                        variant="outline"
                        className="w-full border-dashed"
                        onClick={() => handleOpenFieldDialog(section.id)}
                        data-testid={`button-add-field-${section.id}`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Field
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Field Palette</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-4 space-y-4">
                  {FIELD_CATEGORIES.map((category) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">{category}</h4>
                      <div className="space-y-1">
                        {Object.entries(FIELD_TYPE_CONFIG)
                          .filter(([, config]) => config.category === category)
                          .map(([type, config]) => {
                            const Icon = config.icon;
                            return (
                              <Button
                                key={type}
                                variant="ghost"
                                className="w-full justify-start text-left h-auto py-2"
                                onClick={() => {
                                  if (sections.length > 0) {
                                    addFieldFromPalette(sections[sections.length - 1].id, type);
                                  } else {
                                    toast({
                                      title: "No sections",
                                      description: "Add a section first before adding fields",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                data-testid={`palette-field-${type}`}
                              >
                                <Icon className="h-4 w-4 mr-2 shrink-0" />
                                <div className="min-w-0">
                                  <div className="truncate">{config.label}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {config.description}
                                  </div>
                                </div>
                              </Button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
            <DialogDescription>
              Sections help organize fields into logical groups
            </DialogDescription>
          </DialogHeader>
          <Form {...sectionForm}>
            <form onSubmit={sectionForm.handleSubmit(onSubmitSection)} className="space-y-4">
              <FormField
                control={sectionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., General Information" {...field} data-testid="input-section-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={sectionForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description..." {...field} data-testid="input-section-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={sectionForm.control}
                name="allowRepeats"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Allow Repeats</FormLabel>
                      <FormDescription>Users can add multiple entries for this section</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-section-repeats" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSectionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save-section">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingField ? "Edit Field" : "Add Field"}</DialogTitle>
            <DialogDescription>Configure the field properties</DialogDescription>
          </DialogHeader>
          <Form {...fieldForm}>
            <form onSubmit={fieldForm.handleSubmit(onSubmitField)} className="space-y-4">
              <FormField
                control={fieldForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Panel ID" {...field} data-testid="input-field-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fieldForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-field-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FIELD_CATEGORIES.map((category) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {category}
                            </div>
                            {Object.entries(FIELD_TYPE_CONFIG)
                              .filter(([, config]) => config.category === category)
                              .map(([type, config]) => (
                                <SelectItem key={type} value={type}>
                                  {config.label}
                                </SelectItem>
                              ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fieldForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Help text for the user..." {...field} data-testid="input-field-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fieldForm.control}
                name="placeholder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placeholder</FormLabel>
                    <FormControl>
                      <Input placeholder="Placeholder text..." {...field} data-testid="input-field-placeholder" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fieldForm.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detailed instructions..." {...field} data-testid="input-field-instructions" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {fieldTypeRequiresOptions(fieldForm.watch("type")) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel>Options</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={addOption}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editingFieldOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Label"
                          value={option.text}
                          onChange={(e) => updateOption(index, "text", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Value"
                          value={option.value}
                          onChange={(e) => updateOption(index, "value", e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {["number_field", "rating_scale"].includes(fieldForm.watch("type")) && (
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={fieldForm.control}
                    name="min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={fieldForm.control}
                    name="max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={fieldForm.control}
                    name="step"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Step</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={fieldForm.control}
                  name="required"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="font-normal">Required</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-field-required" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={fieldForm.control}
                  name="photoRequired"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="font-normal">Photo Required</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-field-photo-required" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFieldDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save-field">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteSectionDialogOpen} onOpenChange={setDeleteSectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the section and all its fields. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteFieldDialogOpen} onOpenChange={setDeleteFieldDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the field from the section. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteField}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
