import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Plus,
  ArrowLeft,
  Search,
  Mail,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";

type TemplateType =
  | "ACTIVITY"
  | "GENERAL"
  | "TENDER"
  | "PROCUREMENT"
  | "DRAFTING"
  | "INVOICE"
  | "OTHER";

interface EmailTemplate {
  id: string;
  companyId: string;
  name: string;
  templateType: TemplateType;
  subject: string;
  htmlBody: string;
  placeholders: Array<{ key: string; label: string; sample?: string }>;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_TYPES: TemplateType[] = [
  "ACTIVITY",
  "GENERAL",
  "TENDER",
  "PROCUREMENT",
  "DRAFTING",
  "INVOICE",
  "OTHER",
];

const TYPE_LABELS: Record<TemplateType, string> = {
  ACTIVITY: "Activity",
  GENERAL: "General",
  TENDER: "Tender",
  PROCUREMENT: "Procurement",
  DRAFTING: "Drafting",
  INVOICE: "Invoice",
  OTHER: "Other",
};

function typeBadgeVariant(type: TemplateType): "default" | "secondary" | "outline" {
  switch (type) {
    case "ACTIVITY":
    case "TENDER":
      return "default";
    case "PROCUREMENT":
    case "INVOICE":
      return "secondary";
    default:
      return "outline";
  }
}

export default function EmailTemplatesPage() {
  useDocumentTitle("Email Templates");
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "editor">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<TemplateType>("GENERAL");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");

  const queryKeyBase = "/api/email-templates";

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey:
      filterType === "ALL"
        ? [queryKeyBase]
        : [queryKeyBase, { type: filterType }],
  });

  const { data: editTemplate, isLoading: editLoading } =
    useQuery<EmailTemplate>({
      queryKey: [queryKeyBase, editingId],
      enabled: !!editingId && view === "editor",
    });

  useEffect(() => {
    if (editTemplate && editingId) {
      setFormName(editTemplate.name);
      setFormType(editTemplate.templateType);
      setFormSubject(editTemplate.subject);
      setFormBody(editTemplate.htmlBody);
    }
  }, [editTemplate, editingId]);

  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery) return true;
    return t.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", queryKeyBase, {
        name: formName,
        templateType: formType,
        subject: formSubject,
        htmlBody: formBody,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyBase] });
      toast({ title: "Template created successfully" });
      resetAndGoBack();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `${queryKeyBase}/${editingId}`, {
        name: formName,
        templateType: formType,
        subject: formSubject,
        htmlBody: formBody,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyBase] });
      toast({ title: "Template updated successfully" });
      resetAndGoBack();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `${queryKeyBase}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyBase] });
      toast({ title: "Template deleted" });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function resetForm() {
    setFormName("");
    setFormType("GENERAL");
    setFormSubject("");
    setFormBody("");
    setEditingId(null);
  }

  function resetAndGoBack() {
    resetForm();
    setView("list");
  }

  function openNewTemplate() {
    resetForm();
    setView("editor");
  }

  function openEditTemplate(template: EmailTemplate) {
    setEditingId(template.id);
    setFormName(template.name);
    setFormType(template.templateType);
    setFormSubject(template.subject);
    setFormBody(template.htmlBody);
    setView("editor");
  }

  function handleSave() {
    if (!formName.trim()) {
      toast({
        title: "Template name is required",
        variant: "destructive",
      });
      return;
    }
    if (!formSubject.trim()) {
      toast({
        title: "Subject line is required",
        variant: "destructive",
      });
      return;
    }
    if (editingId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (view === "editor") {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={resetAndGoBack}
            data-testid="button-back-to-list"
          >
            <ArrowLeft />
          </Button>
          <h1
            className="text-2xl font-semibold"
            data-testid="text-editor-title"
          >
            {editingId ? "Edit Template" : "New Template"}
          </h1>
        </div>

        {editingId && editLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Template Name
                </label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter template name"
                  data-testid="input-template-name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Template Type
                </label>
                <Select
                  value={formType}
                  onValueChange={(val) => setFormType(val as TemplateType)}
                >
                  <SelectTrigger data-testid="select-template-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Subject Line
                </label>
                <Input
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Enter email subject"
                  data-testid="input-template-subject"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Email Body
                </label>
                <RichTextEditor
                  content={formBody}
                  onChange={setFormBody}
                  placeholder="Compose email body..."
                  minHeight="300px"
                />
              </div>

              <div className="flex items-center gap-2 pt-4 flex-wrap">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  data-testid="button-save-template"
                >
                  {isSaving ? "Saving..." : "Save Template"}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetAndGoBack}
                  disabled={isSaving}
                  data-testid="button-cancel-template"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Email Templates
        </h1>
        <Button onClick={openNewTemplate} data-testid="button-new-template">
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9"
            data-testid="input-search-templates"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger
            className="w-[180px]"
            data-testid="select-filter-type"
          >
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {TEMPLATE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3
              className="text-lg font-medium mb-1"
              data-testid="text-empty-state"
            >
              No email templates found
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? "Try adjusting your search or filter."
                : "Create your first email template to get started."}
            </p>
            {!searchQuery && (
              <Button
                onClick={openNewTemplate}
                data-testid="button-empty-new-template"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="hover-elevate"
              data-testid={`card-template-${template.id}`}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span
                      className="truncate"
                      data-testid={`text-template-name-${template.id}`}
                    >
                      {template.name}
                    </span>
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditTemplate(template)}
                    data-testid={`button-edit-template-${template.id}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteTarget(template)}
                    data-testid={`button-delete-template-${template.id}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={typeBadgeVariant(template.templateType)}
                    data-testid={`badge-type-${template.id}`}
                  >
                    {TYPE_LABELS[template.templateType]}
                  </Badge>
                  <Badge
                    variant={template.isActive ? "default" : "outline"}
                    className="text-xs"
                    data-testid={`badge-status-${template.id}`}
                  >
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p
                  className="text-sm text-muted-foreground truncate"
                  data-testid={`text-subject-${template.id}`}
                >
                  {template.subject || "No subject"}
                </p>
                <p
                  className="text-xs text-muted-foreground"
                  data-testid={`text-updated-${template.id}`}
                >
                  Updated{" "}
                  {new Date(template.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
                }
              }}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
