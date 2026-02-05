import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  FileText,
  Copy,
  Settings,
  ChevronRight,
  Layers,
  CheckSquare,
  X,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { 
  EntityType, 
  EntitySubtype, 
  ChecklistTemplate,
  ChecklistSection,
} from "@shared/schema";
import { CHECKLIST_ROUTES } from "@shared/api-routes";

const entityTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").toUpperCase(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

const entitySubtypeSchema = z.object({
  entityTypeId: z.string().min(1, "Entity type is required"),
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").toUpperCase(),
  description: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

const templateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  entityTypeId: z.string().optional(),
  entitySubtypeId: z.string().optional(),
  phase: z.coerce.number().optional(),
  hasScoringSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type EntityTypeFormData = z.infer<typeof entityTypeSchema>;
type EntitySubtypeFormData = z.infer<typeof entitySubtypeSchema>;
type TemplateFormData = z.infer<typeof templateSchema>;

export default function AdminChecklistTemplatesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  
  const [entityTypeDialogOpen, setEntityTypeDialogOpen] = useState(false);
  const [editingEntityType, setEditingEntityType] = useState<EntityType | null>(null);
  const [deleteEntityTypeDialogOpen, setDeleteEntityTypeDialogOpen] = useState(false);
  const [deletingEntityTypeId, setDeletingEntityTypeId] = useState<string | null>(null);

  const [entitySubtypeDialogOpen, setEntitySubtypeDialogOpen] = useState(false);
  const [editingEntitySubtype, setEditingEntitySubtype] = useState<EntitySubtype | null>(null);
  const [deleteSubtypeDialogOpen, setDeleteSubtypeDialogOpen] = useState(false);
  const [deletingSubtypeId, setDeletingSubtypeId] = useState<string | null>(null);

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const { data: entityTypes, isLoading: entityTypesLoading } = useQuery<EntityType[]>({
    queryKey: [CHECKLIST_ROUTES.ENTITY_TYPES],
  });

  const { data: entitySubtypes, isLoading: entitySubtypesLoading } = useQuery<EntitySubtype[]>({
    queryKey: [CHECKLIST_ROUTES.ENTITY_SUBTYPES],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: [CHECKLIST_ROUTES.TEMPLATES],
  });

  const entityTypeForm = useForm<EntityTypeFormData>({
    resolver: zodResolver(entityTypeSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      icon: "",
      color: "#3B82F6",
      sortOrder: 0,
      isActive: true,
    },
  });

  const entitySubtypeForm = useForm<EntitySubtypeFormData>({
    resolver: zodResolver(entitySubtypeSchema),
    defaultValues: {
      entityTypeId: "",
      name: "",
      code: "",
      description: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  const templateForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      entityTypeId: "",
      entitySubtypeId: "",
      phase: undefined,
      hasScoringSystem: false,
      isActive: true,
    },
  });

  const createEntityTypeMutation = useMutation({
    mutationFn: async (data: EntityTypeFormData) => {
      return apiRequest("POST", CHECKLIST_ROUTES.ENTITY_TYPES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.ENTITY_TYPES] });
      setEntityTypeDialogOpen(false);
      entityTypeForm.reset();
      toast({ title: "Success", description: "Module created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create module", variant: "destructive" });
    },
  });

  const updateEntityTypeMutation = useMutation({
    mutationFn: async (data: EntityTypeFormData & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", CHECKLIST_ROUTES.ENTITY_TYPE_BY_ID(id), rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.ENTITY_TYPES] });
      setEntityTypeDialogOpen(false);
      setEditingEntityType(null);
      entityTypeForm.reset();
      toast({ title: "Success", description: "Module updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update module", variant: "destructive" });
    },
  });

  const deleteEntityTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", CHECKLIST_ROUTES.ENTITY_TYPE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.ENTITY_TYPES] });
      setDeleteEntityTypeDialogOpen(false);
      setDeletingEntityTypeId(null);
      toast({ title: "Success", description: "Module deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete module", variant: "destructive" });
    },
  });

  const createEntitySubtypeMutation = useMutation({
    mutationFn: async (data: EntitySubtypeFormData) => {
      return apiRequest("POST", CHECKLIST_ROUTES.ENTITY_SUBTYPES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.ENTITY_SUBTYPES] });
      setEntitySubtypeDialogOpen(false);
      entitySubtypeForm.reset();
      toast({ title: "Success", description: "Subtype created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create subtype", variant: "destructive" });
    },
  });

  const updateEntitySubtypeMutation = useMutation({
    mutationFn: async (data: EntitySubtypeFormData & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", CHECKLIST_ROUTES.ENTITY_SUBTYPE_BY_ID(id), rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.ENTITY_SUBTYPES] });
      setEntitySubtypeDialogOpen(false);
      setEditingEntitySubtype(null);
      entitySubtypeForm.reset();
      toast({ title: "Success", description: "Subtype updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update subtype", variant: "destructive" });
    },
  });

  const deleteEntitySubtypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", CHECKLIST_ROUTES.ENTITY_SUBTYPE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.ENTITY_SUBTYPES] });
      setDeleteSubtypeDialogOpen(false);
      setDeletingSubtypeId(null);
      toast({ title: "Success", description: "Subtype deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete subtype", variant: "destructive" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return apiRequest("POST", CHECKLIST_ROUTES.TEMPLATES, {
        ...data,
        sections: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.TEMPLATES] });
      setTemplateDialogOpen(false);
      templateForm.reset();
      toast({ title: "Success", description: "Template created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormData & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", CHECKLIST_ROUTES.TEMPLATE_BY_ID(id), rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.TEMPLATES] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      templateForm.reset();
      toast({ title: "Success", description: "Template updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", CHECKLIST_ROUTES.TEMPLATE_DUPLICATE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.TEMPLATES] });
      toast({ title: "Success", description: "Template duplicated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", CHECKLIST_ROUTES.TEMPLATE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.TEMPLATES] });
      setDeleteTemplateDialogOpen(false);
      setDeletingTemplateId(null);
      toast({ title: "Success", description: "Template deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    },
  });

  const handleOpenEntityTypeDialog = (entityType?: EntityType) => {
    if (entityType) {
      setEditingEntityType(entityType);
      entityTypeForm.reset({
        name: entityType.name,
        code: entityType.code,
        description: entityType.description || "",
        icon: entityType.icon || "",
        color: entityType.color || "#3B82F6",
        sortOrder: entityType.sortOrder || 0,
        isActive: entityType.isActive,
      });
    } else {
      setEditingEntityType(null);
      entityTypeForm.reset({
        name: "",
        code: "",
        description: "",
        icon: "",
        color: "#3B82F6",
        sortOrder: 0,
        isActive: true,
      });
    }
    setEntityTypeDialogOpen(true);
  };

  const handleOpenSubtypeDialog = (subtype?: EntitySubtype) => {
    if (subtype) {
      setEditingEntitySubtype(subtype);
      entitySubtypeForm.reset({
        entityTypeId: subtype.entityTypeId,
        name: subtype.name,
        code: subtype.code,
        description: subtype.description || "",
        sortOrder: subtype.sortOrder || 0,
        isActive: subtype.isActive,
      });
    } else {
      setEditingEntitySubtype(null);
      entitySubtypeForm.reset({
        entityTypeId: "",
        name: "",
        code: "",
        description: "",
        sortOrder: 0,
        isActive: true,
      });
    }
    setEntitySubtypeDialogOpen(true);
  };

  const handleOpenTemplateDialog = (template?: ChecklistTemplate) => {
    if (template) {
      setEditingTemplate(template);
      templateForm.reset({
        name: template.name,
        description: template.description || "",
        entityTypeId: template.entityTypeId || "",
        entitySubtypeId: template.entitySubtypeId || "",
        phase: template.phase || undefined,
        hasScoringSystem: template.hasScoringSystem || false,
        isActive: template.isActive,
      });
    } else {
      setEditingTemplate(null);
      templateForm.reset({
        name: "",
        description: "",
        entityTypeId: "",
        entitySubtypeId: "",
        phase: undefined,
        hasScoringSystem: false,
        isActive: true,
      });
    }
    setTemplateDialogOpen(true);
  };

  const onSubmitEntityType = (data: EntityTypeFormData) => {
    if (editingEntityType) {
      updateEntityTypeMutation.mutate({ ...data, id: editingEntityType.id });
    } else {
      createEntityTypeMutation.mutate(data);
    }
  };

  const onSubmitSubtype = (data: EntitySubtypeFormData) => {
    if (editingEntitySubtype) {
      updateEntitySubtypeMutation.mutate({ ...data, id: editingEntitySubtype.id });
    } else {
      createEntitySubtypeMutation.mutate(data);
    }
  };

  const onSubmitTemplate = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ ...data, id: editingTemplate.id });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const getEntityTypeName = (entityTypeId: string | null | undefined) => {
    if (!entityTypeId) return "-";
    const type = entityTypes?.find((t) => t.id === entityTypeId);
    return type?.name || "-";
  };

  const getEntitySubtypeName = (subtypeId: string | null | undefined) => {
    if (!subtypeId) return "-";
    const subtype = entitySubtypes?.find((s) => s.id === subtypeId);
    return subtype?.name || "-";
  };

  const getSectionsCount = (template: ChecklistTemplate) => {
    const sections = template.sections as ChecklistSection[] | null;
    return sections?.length || 0;
  };

  const getFieldsCount = (template: ChecklistTemplate) => {
    const sections = template.sections as ChecklistSection[] | null;
    if (!sections) return 0;
    return sections.reduce((acc, section) => acc + (section.items?.length || 0), 0);
  };

  const renderEntityTypesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Modules</h3>
          <p className="text-sm text-muted-foreground">
            Define the main categories where templates can be used (e.g., Panels, Jobs, Quality)
          </p>
        </div>
        <Button onClick={() => handleOpenEntityTypeDialog()} data-testid="button-add-entity-type">
          <Plus className="h-4 w-4 mr-2" />
          Add Module
        </Button>
      </div>

      {entityTypesLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entityTypes?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No modules defined. Add your first module to get started.
                </TableCell>
              </TableRow>
            ) : (
              entityTypes?.map((type) => (
                <TableRow key={type.id} data-testid={`row-entity-type-${type.id}`}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{type.code}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{type.description || "-"}</TableCell>
                  <TableCell>{type.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={type.isActive ? "default" : "secondary"}>
                      {type.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEntityTypeDialog(type)}
                        data-testid={`button-edit-entity-type-${type.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingEntityTypeId(type.id);
                          setDeleteEntityTypeDialogOpen(true);
                        }}
                        data-testid={`button-delete-entity-type-${type.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );

  const renderSubtypesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Subtypes</h3>
          <p className="text-sm text-muted-foreground">
            Define subcategories within each module (e.g., Panel Types, Inspection Types)
          </p>
        </div>
        <Button onClick={() => handleOpenSubtypeDialog()} data-testid="button-add-subtype">
          <Plus className="h-4 w-4 mr-2" />
          Add Subtype
        </Button>
      </div>

      {entitySubtypesLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entitySubtypes?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No subtypes defined. Add a subtype to organize templates within modules.
                </TableCell>
              </TableRow>
            ) : (
              entitySubtypes?.map((subtype) => (
                <TableRow key={subtype.id} data-testid={`row-subtype-${subtype.id}`}>
                  <TableCell>
                    <Badge variant="outline">{getEntityTypeName(subtype.entityTypeId)}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{subtype.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{subtype.code}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{subtype.description || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={subtype.isActive ? "default" : "secondary"}>
                      {subtype.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenSubtypeDialog(subtype)}
                        data-testid={`button-edit-subtype-${subtype.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingSubtypeId(subtype.id);
                          setDeleteSubtypeDialogOpen(true);
                        }}
                        data-testid={`button-delete-subtype-${subtype.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );

  const renderTemplatesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage checklist templates with sections and fields
          </p>
        </div>
        <Button onClick={() => handleOpenTemplateDialog()} data-testid="button-add-template">
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {templatesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : templates?.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Templates Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first checklist template to start building forms
          </p>
          <Button onClick={() => handleOpenTemplateDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((template) => (
            <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    <CardDescription className="text-xs mt-1 line-clamp-2">
                      {template.description || "No description"}
                    </CardDescription>
                  </div>
                  <Badge variant={template.isActive ? "default" : "secondary"} className="shrink-0">
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    <span>Module: {getEntityTypeName(template.entityTypeId)}</span>
                  </div>
                  {template.entitySubtypeId && (
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      <span>Subtype: {getEntitySubtypeName(template.entitySubtypeId)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <span>{getSectionsCount(template)} sections</span>
                    <span>{getFieldsCount(template)} fields</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="default"
                    size="sm"
                    asChild
                    data-testid={`button-build-template-${template.id}`}
                  >
                    <Link href={`/admin/checklist-templates/${template.id}/edit`}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenTemplateDialog(template)}
                    data-testid={`button-settings-template-${template.id}`}
                  >
                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                    Settings
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateTemplateMutation.mutate(template.id)}
                    data-testid={`button-duplicate-template-${template.id}`}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeletingTemplateId(template.id);
                      setDeleteTemplateDialogOpen(true);
                    }}
                    data-testid={`button-delete-template-${template.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckSquare className="h-6 w-6" />
          Checklist Templates
        </h1>
        <p className="text-muted-foreground">
          Create and manage dynamic checklist templates for inspections, quality control, and data collection
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="templates" data-testid="tab-templates">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="modules" data-testid="tab-modules">
            <Layers className="h-4 w-4 mr-2" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="subtypes" data-testid="tab-subtypes">
            <ChevronRight className="h-4 w-4 mr-2" />
            Subtypes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">{renderTemplatesTab()}</TabsContent>
        <TabsContent value="modules">{renderEntityTypesTab()}</TabsContent>
        <TabsContent value="subtypes">{renderSubtypesTab()}</TabsContent>
      </Tabs>

      <Dialog open={entityTypeDialogOpen} onOpenChange={setEntityTypeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntityType ? "Edit Module" : "Add Module"}</DialogTitle>
            <DialogDescription>
              Modules define where templates can be used in the system
            </DialogDescription>
          </DialogHeader>
          <Form {...entityTypeForm}>
            <form onSubmit={entityTypeForm.handleSubmit(onSubmitEntityType)} className="space-y-4">
              <FormField
                control={entityTypeForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Panels" {...field} data-testid="input-entity-type-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entityTypeForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., PANELS" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        data-testid="input-entity-type-code"
                      />
                    </FormControl>
                    <FormDescription>Unique identifier code</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entityTypeForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description..." {...field} data-testid="input-entity-type-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entityTypeForm.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-entity-type-sort-order" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entityTypeForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Enable this module for use</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-entity-type-active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEntityTypeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEntityTypeMutation.isPending || updateEntityTypeMutation.isPending}
                  data-testid="button-save-entity-type"
                >
                  {(createEntityTypeMutation.isPending || updateEntityTypeMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={entitySubtypeDialogOpen} onOpenChange={setEntitySubtypeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntitySubtype ? "Edit Subtype" : "Add Subtype"}</DialogTitle>
            <DialogDescription>
              Subtypes help organize templates within a module
            </DialogDescription>
          </DialogHeader>
          <Form {...entitySubtypeForm}>
            <form onSubmit={entitySubtypeForm.handleSubmit(onSubmitSubtype)} className="space-y-4">
              <FormField
                control={entitySubtypeForm.control}
                name="entityTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Module</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-subtype-module">
                          <SelectValue placeholder="Select a module" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {entityTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entitySubtypeForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Quality Inspection" {...field} data-testid="input-subtype-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entitySubtypeForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., QC" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        data-testid="input-subtype-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entitySubtypeForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description..." {...field} data-testid="input-subtype-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entitySubtypeForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Enable this subtype</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-subtype-active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEntitySubtypeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEntitySubtypeMutation.isPending || updateEntitySubtypeMutation.isPending}
                  data-testid="button-save-subtype"
                >
                  {(createEntitySubtypeMutation.isPending || updateEntitySubtypeMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              Set up the basic information for your checklist template
            </DialogDescription>
          </DialogHeader>
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(onSubmitTemplate)} className="space-y-4">
              <FormField
                control={templateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Panel Pre-Pour Checklist" {...field} data-testid="input-template-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={templateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the purpose of this template..." {...field} data-testid="input-template-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={templateForm.control}
                  name="entityTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} 
                        value={field.value || "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-template-module">
                            <SelectValue placeholder="Select module" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {entityTypes?.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={templateForm.control}
                  name="entitySubtypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtype</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} 
                        value={field.value || "__none__"}
                        disabled={!templateForm.watch("entityTypeId")}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-template-subtype">
                            <SelectValue placeholder="Select subtype" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {entitySubtypes
                            ?.filter((s) => s.entityTypeId === templateForm.watch("entityTypeId"))
                            .map((subtype) => (
                              <SelectItem key={subtype.id} value={subtype.id}>
                                {subtype.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={templateForm.control}
                name="phase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phase (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 1" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-template-phase"
                      />
                    </FormControl>
                    <FormDescription>For ordering templates by production phase</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={templateForm.control}
                name="hasScoringSystem"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Enable Scoring</FormLabel>
                      <FormDescription>Calculate scores based on responses</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-template-scoring" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={templateForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Make this template available for use</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-template-active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                  data-testid="button-save-template"
                >
                  {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteEntityTypeDialogOpen} onOpenChange={setDeleteEntityTypeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Module?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the module. Templates using this module will no longer be categorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEntityTypeId && deleteEntityTypeMutation.mutate(deletingEntityTypeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEntityTypeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSubtypeDialogOpen} onOpenChange={setDeleteSubtypeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subtype?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the subtype. Templates using this subtype will no longer be categorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSubtypeId && deleteEntitySubtypeMutation.mutate(deletingSubtypeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEntitySubtypeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the template. Existing checklist instances will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTemplateId && deleteTemplateMutation.mutate(deletingTemplateId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
