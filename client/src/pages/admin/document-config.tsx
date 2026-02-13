import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  FolderTree,
  Tag,
  Palette,
  X,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { DocumentTypeConfig, DocumentDiscipline, DocumentCategory, DocumentTypeStatus } from "@shared/schema";
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

const typeSchema = z.object({
  typeName: z.string().min(1, "Name is required"),
  prefix: z.string().min(1, "Prefix is required"),
  shortForm: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const disciplineSchema = z.object({
  disciplineName: z.string().min(1, "Name is required"),
  shortForm: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().default(true),
});

const categorySchema = z.object({
  categoryName: z.string().min(1, "Name is required"),
  shortForm: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().default(true),
});

type TypeFormData = z.infer<typeof typeSchema>;
type DisciplineFormData = z.infer<typeof disciplineSchema>;
type CategoryFormData = z.infer<typeof categorySchema>;

export default function AdminDocumentConfigPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("disciplines");

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<DocumentTypeConfig | null>(null);
  const [typeDeleteDialogOpen, setTypeDeleteDialogOpen] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);

  const [disciplineDialogOpen, setDisciplineDialogOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<DocumentDiscipline | null>(null);
  const [disciplineDeleteDialogOpen, setDisciplineDeleteDialogOpen] = useState(false);
  const [deletingDisciplineId, setDeletingDisciplineId] = useState<string | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DocumentCategory | null>(null);
  const [categoryDeleteDialogOpen, setCategoryDeleteDialogOpen] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTypeId, setStatusTypeId] = useState<string | null>(null);
  const [statusTypeName, setStatusTypeName] = useState<string>("");
  const [editingStatus, setEditingStatus] = useState<DocumentTypeStatus | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#6b7280");
  const [editStatusName, setEditStatusName] = useState("");
  const [editStatusColor, setEditStatusColor] = useState("#6b7280");

  const { data: types = [], isLoading: typesLoading } = useQuery<DocumentTypeConfig[]>({
    queryKey: [DOCUMENT_ROUTES.TYPES],
  });

  const { data: disciplines = [], isLoading: disciplinesLoading } = useQuery<DocumentDiscipline[]>({
    queryKey: [DOCUMENT_ROUTES.DISCIPLINES],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<DocumentCategory[]>({
    queryKey: [DOCUMENT_ROUTES.CATEGORIES],
  });

  const typeForm = useForm<TypeFormData>({
    resolver: zodResolver(typeSchema),
    defaultValues: {
      typeName: "",
      prefix: "",
      shortForm: "",
      description: "",
      isActive: true,
    },
  });

  const disciplineForm = useForm<DisciplineFormData>({
    resolver: zodResolver(disciplineSchema),
    defaultValues: {
      disciplineName: "",
      shortForm: "",
      color: "",
      isActive: true,
    },
  });

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      categoryName: "",
      shortForm: "",
      description: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  const typeMutation = useMutation({
    mutationFn: async (data: TypeFormData) => {
      if (editingType) {
        return apiRequest("PATCH", DOCUMENT_ROUTES.TYPE_BY_ID(editingType.id), data);
      }
      return apiRequest("POST", DOCUMENT_ROUTES.TYPES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.TYPES] });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.TYPES_ACTIVE] });
      toast({
        title: editingType ? "Type Updated" : "Type Created",
        description: `Document type has been ${editingType ? "updated" : "created"} successfully.`,
      });
      setTypeDialogOpen(false);
      setEditingType(null);
      typeForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const typeDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", DOCUMENT_ROUTES.TYPE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.TYPES] });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.TYPES_ACTIVE] });
      toast({
        title: "Type Deleted",
        description: "Document type has been deleted successfully.",
      });
      setTypeDeleteDialogOpen(false);
      setDeletingTypeId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disciplineMutation = useMutation({
    mutationFn: async (data: DisciplineFormData) => {
      if (editingDiscipline) {
        return apiRequest("PATCH", DOCUMENT_ROUTES.DISCIPLINE_BY_ID(editingDiscipline.id), data);
      }
      return apiRequest("POST", DOCUMENT_ROUTES.DISCIPLINES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.DISCIPLINES] });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.DISCIPLINES_ACTIVE] });
      toast({
        title: editingDiscipline ? "Discipline Updated" : "Discipline Created",
        description: `Discipline has been ${editingDiscipline ? "updated" : "created"} successfully.`,
      });
      setDisciplineDialogOpen(false);
      setEditingDiscipline(null);
      disciplineForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disciplineDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", DOCUMENT_ROUTES.DISCIPLINE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.DISCIPLINES] });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.DISCIPLINES_ACTIVE] });
      toast({
        title: "Discipline Deleted",
        description: "Discipline has been deleted successfully.",
      });
      setDisciplineDeleteDialogOpen(false);
      setDeletingDisciplineId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const categoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (editingCategory) {
        return apiRequest("PATCH", DOCUMENT_ROUTES.CATEGORY_BY_ID(editingCategory.id), data);
      }
      return apiRequest("POST", DOCUMENT_ROUTES.CATEGORIES, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.CATEGORIES_ACTIVE] });
      toast({
        title: editingCategory ? "Category Updated" : "Category Created",
        description: `Category has been ${editingCategory ? "updated" : "created"} successfully.`,
      });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const categoryDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", DOCUMENT_ROUTES.CATEGORY_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.CATEGORIES_ACTIVE] });
      toast({
        title: "Category Deleted",
        description: "Category has been deleted successfully.",
      });
      setCategoryDeleteDialogOpen(false);
      setDeletingCategoryId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: typeStatuses = [], isLoading: statusesLoading } = useQuery<DocumentTypeStatus[]>({
    queryKey: [DOCUMENT_ROUTES.TYPE_STATUSES(statusTypeId || ""), statusTypeId],
    enabled: !!statusTypeId,
  });

  const statusCreateMutation = useMutation({
    mutationFn: async (data: { statusName: string; color: string }) => {
      if (!statusTypeId) throw new Error("No type selected");
      return apiRequest("POST", DOCUMENT_ROUTES.TYPE_STATUSES(statusTypeId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.TYPE_STATUSES(statusTypeId || ""), statusTypeId] });
      toast({ title: "Status Created", description: "Status has been added successfully." });
      setNewStatusName("");
      setNewStatusColor("#6b7280");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { statusName: string; color: string } }) => {
      if (!statusTypeId) throw new Error("No type selected");
      return apiRequest("PATCH", DOCUMENT_ROUTES.TYPE_STATUS_BY_ID(statusTypeId, id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.TYPE_STATUSES(statusTypeId || ""), statusTypeId] });
      toast({ title: "Status Updated", description: "Status has been updated successfully." });
      setEditingStatus(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusDeleteMutation = useMutation({
    mutationFn: async (statusId: string) => {
      if (!statusTypeId) throw new Error("No type selected");
      return apiRequest("DELETE", DOCUMENT_ROUTES.TYPE_STATUS_BY_ID(statusTypeId, statusId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.TYPE_STATUSES(statusTypeId || ""), statusTypeId] });
      toast({ title: "Status Deleted", description: "Status has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleManageStatuses = (type: DocumentTypeConfig) => {
    setStatusTypeId(type.id);
    setStatusTypeName(type.typeName);
    setEditingStatus(null);
    setNewStatusName("");
    setNewStatusColor("#6b7280");
    setStatusDialogOpen(true);
  };

  const handleEditType = (type: DocumentTypeConfig) => {
    setEditingType(type);
    typeForm.reset({
      typeName: type.typeName,
      prefix: type.prefix,
      shortForm: type.shortForm || "",
      description: type.description || "",
      isActive: type.isActive,
    });
    setTypeDialogOpen(true);
  };

  const handleEditDiscipline = (discipline: DocumentDiscipline) => {
    setEditingDiscipline(discipline);
    disciplineForm.reset({
      disciplineName: discipline.disciplineName,
      shortForm: discipline.shortForm || "",
      color: discipline.color || "",
      isActive: discipline.isActive,
    });
    setDisciplineDialogOpen(true);
  };

  const handleEditCategory = (category: DocumentCategory) => {
    setEditingCategory(category);
    categoryForm.reset({
      categoryName: category.categoryName,
      shortForm: category.shortForm || "",
      description: category.description || "",
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive,
    });
    setCategoryDialogOpen(true);
  };

  const handleNewType = () => {
    setEditingType(null);
    typeForm.reset({
      typeName: "",
      prefix: "",
      shortForm: "",
      description: "",
      isActive: true,
    });
    setTypeDialogOpen(true);
  };

  const handleNewDiscipline = () => {
    setEditingDiscipline(null);
    disciplineForm.reset({
      disciplineName: "",
      shortForm: "",
      color: "",
      isActive: true,
    });
    setDisciplineDialogOpen(true);
  };

  const handleNewCategory = () => {
    setEditingCategory(null);
    categoryForm.reset({
      categoryName: "",
      shortForm: "",
      description: "",
      sortOrder: 0,
      isActive: true,
    });
    setCategoryDialogOpen(true);
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6" role="main" aria-label="Document Configuration">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Document Configuration</h1>
            <PageHelpButton pageHelpKey="page.admin.document-config" />
          </div>
          <p className="text-muted-foreground">
            Manage document types, disciplines, and categories
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="disciplines" className="flex items-center gap-2" data-testid="tab-disciplines">
            <FolderTree className="h-4 w-4" />
            Disciplines
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2" data-testid="tab-categories">
            <Tag className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2" data-testid="tab-types">
            <FileText className="h-4 w-4" />
            Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Document Types</CardTitle>
                <CardDescription>Configure document types like Shop Drawings, Reports, etc.</CardDescription>
              </div>
              <Button onClick={handleNewType} data-testid="button-add-type">
                <Plus className="h-4 w-4 mr-2" />
                Add Type
              </Button>
            </CardHeader>
            <CardContent>
              {typesLoading ? (
                renderLoadingSkeleton()
              ) : types.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No document types configured. Add your first one.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Short Form</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {types.map((type) => (
                      <TableRow key={type.id} data-testid={`row-type-${type.id}`}>
                        <TableCell className="font-mono font-medium">{type.prefix}</TableCell>
                        <TableCell>{type.typeName}</TableCell>
                        <TableCell>{type.shortForm || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{type.description || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={type.isActive ? "default" : "secondary"}>
                            {type.isActive ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Inactive</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleManageStatuses(type)}
                              title="Manage Statuses"
                              data-testid={`button-manage-statuses-${type.id}`}
                            >
                              <Palette className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditType(type)}
                              data-testid={`button-edit-type-${type.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setDeletingTypeId(type.id);
                                setTypeDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-type-${type.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disciplines" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Disciplines</CardTitle>
                <CardDescription>Configure disciplines like Structural, Architectural, etc.</CardDescription>
              </div>
              <Button onClick={handleNewDiscipline} data-testid="button-add-discipline">
                <Plus className="h-4 w-4 mr-2" />
                Add Discipline
              </Button>
            </CardHeader>
            <CardContent>
              {disciplinesLoading ? (
                renderLoadingSkeleton()
              ) : disciplines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No disciplines configured. Add your first one.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Short Form</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disciplines.map((discipline) => (
                      <TableRow key={discipline.id} data-testid={`row-discipline-${discipline.id}`}>
                        <TableCell className="font-mono font-medium">{discipline.shortForm || "-"}</TableCell>
                        <TableCell>{discipline.disciplineName}</TableCell>
                        <TableCell>
                          {discipline.color ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: discipline.color }}
                              />
                              <span className="text-sm text-muted-foreground">{discipline.color}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={discipline.isActive ? "default" : "secondary"}>
                            {discipline.isActive ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Inactive</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditDiscipline(discipline)}
                              data-testid={`button-edit-discipline-${discipline.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setDeletingDisciplineId(discipline.id);
                                setDisciplineDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-discipline-${discipline.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Categories</CardTitle>
                <CardDescription>Configure categories like Design, Construction, etc.</CardDescription>
              </div>
              <Button onClick={handleNewCategory} data-testid="button-add-category">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                renderLoadingSkeleton()
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No categories configured. Add your first one.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Short Form</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Sort Order</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                        <TableCell className="font-mono font-medium">{category.shortForm || "-"}</TableCell>
                        <TableCell>{category.categoryName}</TableCell>
                        <TableCell>{category.sortOrder || 0}</TableCell>
                        <TableCell className="max-w-xs truncate">{category.description || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={category.isActive ? "default" : "secondary"}>
                            {category.isActive ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Inactive</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditCategory(category)}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setDeletingCategoryId(category.id);
                                setCategoryDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Document Type" : "Add Document Type"}</DialogTitle>
            <DialogDescription>
              {editingType ? "Update the document type details" : "Create a new document type"}
            </DialogDescription>
          </DialogHeader>
          <Form {...typeForm}>
            <form onSubmit={typeForm.handleSubmit((data) => typeMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={typeForm.control}
                  name="prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prefix</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="SD" data-testid="input-type-prefix" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={typeForm.control}
                  name="shortForm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short Form</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="SD" data-testid="input-type-short-form" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={typeForm.control}
                name="typeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Shop Drawings" data-testid="input-type-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={typeForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Description" data-testid="input-type-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={typeForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-type-active" />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTypeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={typeMutation.isPending} data-testid="button-save-type">
                  {typeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingType ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={disciplineDialogOpen} onOpenChange={setDisciplineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDiscipline ? "Edit Discipline" : "Add Discipline"}</DialogTitle>
            <DialogDescription>
              {editingDiscipline ? "Update the discipline details" : "Create a new discipline"}
            </DialogDescription>
          </DialogHeader>
          <Form {...disciplineForm}>
            <form onSubmit={disciplineForm.handleSubmit((data) => disciplineMutation.mutate(data))} className="space-y-4">
              <FormField
                control={disciplineForm.control}
                name="shortForm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Form</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="STR" data-testid="input-discipline-short-form" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={disciplineForm.control}
                name="disciplineName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Structural" data-testid="input-discipline-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={disciplineForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={field.value || "#3B82F6"}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-12 h-10 rounded border cursor-pointer"
                          data-testid="input-discipline-color"
                        />
                        <span className="text-sm text-muted-foreground">{field.value || "#3B82F6"}</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={disciplineForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-discipline-active" />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDisciplineDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={disciplineMutation.isPending} data-testid="button-save-discipline">
                  {disciplineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingDiscipline ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the category details" : "Create a new category"}
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit((data) => categoryMutation.mutate(data))} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="shortForm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Form</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="DES" data-testid="input-category-short-form" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="categoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Design" data-testid="input-category-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-category-sort-order"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Description" data-testid="input-category-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-category-active" />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={categoryMutation.isPending} data-testid="button-save-category">
                  {categoryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingCategory ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={typeDeleteDialogOpen} onOpenChange={setTypeDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document type? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTypeId && typeDeleteMutation.mutate(deletingTypeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-type"
            >
              {typeDeleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={disciplineDeleteDialogOpen} onOpenChange={setDisciplineDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Discipline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this discipline? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDisciplineId && disciplineDeleteMutation.mutate(deletingDisciplineId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-discipline"
            >
              {disciplineDeleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={categoryDeleteDialogOpen} onOpenChange={setCategoryDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCategoryId && categoryDeleteMutation.mutate(deletingCategoryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-category"
            >
              {categoryDeleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Statuses - {statusTypeName}</DialogTitle>
            <DialogDescription>
              Add, edit, or remove statuses for this document type. Each status has a name and color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Status Name</label>
                <Input
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  placeholder="e.g. IFC, APPROVED"
                  data-testid="input-new-status-name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Color</label>
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="w-10 h-9 rounded border cursor-pointer"
                  data-testid="input-new-status-color"
                />
              </div>
              <Button
                onClick={() => {
                  if (newStatusName.trim()) {
                    statusCreateMutation.mutate({ statusName: newStatusName.trim().toUpperCase(), color: newStatusColor });
                  }
                }}
                disabled={!newStatusName.trim() || statusCreateMutation.isPending}
                data-testid="button-add-status"
              >
                {statusCreateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            <div className="border rounded-md">
              {statusesLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : typeStatuses.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No statuses configured for this type.
                </div>
              ) : (
                <div className="divide-y">
                  {typeStatuses.map((status) => (
                    <div key={status.id} className="flex items-center gap-3 px-3 py-2" data-testid={`row-status-${status.id}`}>
                      {editingStatus?.id === status.id ? (
                        <>
                          <input
                            type="color"
                            value={editStatusColor}
                            onChange={(e) => setEditStatusColor(e.target.value)}
                            className="w-8 h-8 rounded border cursor-pointer flex-shrink-0"
                            data-testid="input-edit-status-color"
                          />
                          <Input
                            value={editStatusName}
                            onChange={(e) => setEditStatusName(e.target.value)}
                            className="flex-1"
                            data-testid="input-edit-status-name"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (editStatusName.trim()) {
                                statusUpdateMutation.mutate({
                                  id: status.id,
                                  data: { statusName: editStatusName.trim().toUpperCase(), color: editStatusColor },
                                });
                              }
                            }}
                            disabled={statusUpdateMutation.isPending}
                            data-testid="button-save-status-edit"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingStatus(null)}
                            data-testid="button-cancel-status-edit"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0 border"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="flex-1 font-medium text-sm">{status.statusName}</span>
                          <span className="text-xs text-muted-foreground">{status.color}</span>
                          {status.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingStatus(status);
                              setEditStatusName(status.statusName);
                              setEditStatusColor(status.color);
                            }}
                            data-testid={`button-edit-status-${status.id}`}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => statusDeleteMutation.mutate(status.id)}
                            disabled={statusDeleteMutation.isPending}
                            data-testid={`button-delete-status-${status.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
