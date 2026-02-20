import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Loader2, Search, Hash, Link2, Download, Upload, ChevronRight, ChevronDown, FolderOpen, FileText, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { CostCode, ChildCostCode, JobType } from "@shared/schema";
import { PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";

interface CostCodeWithChildren extends CostCode {
  children: ChildCostCode[];
}

export default function AdminCostCodesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("codes");
  const [showDialog, setShowDialog] = useState(false);
  const [showChildDialog, setShowChildDialog] = useState(false);
  const [editingCode, setEditingCode] = useState<CostCode | null>(null);
  const [editingChild, setEditingChild] = useState<ChildCostCode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CostCode | null>(null);
  const [deleteChildConfirm, setDeleteChildConfirm] = useState<ChildCostCode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formParentCostCodeId, setFormParentCostCodeId] = useState("");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string>("");
  const [selectedCostCodeIds, setSelectedCostCodeIds] = useState<Set<string>>(new Set());
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: costCodesWithChildren, isLoading: loadingCostCodes } = useQuery<CostCodeWithChildren[]>({
    queryKey: ["/api/cost-codes-with-children"],
  });

  const { data: costCodesFlat } = useQuery<CostCode[]>({
    queryKey: ["/api/cost-codes"],
  });

  const { data: jobTypesData } = useQuery<JobType[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES],
  });

  const { data: defaultsData, isLoading: loadingDefaults } = useQuery<any[]>({
    queryKey: ["/api/cost-code-defaults", selectedJobTypeId],
    enabled: !!selectedJobTypeId,
    queryFn: async () => {
      const res = await fetch(`/api/cost-code-defaults/${selectedJobTypeId}`);
      if (!res.ok) throw new Error("Failed to fetch defaults");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; description?: string; isActive: boolean; sortOrder: number }) => {
      return apiRequest("POST", "/api/cost-codes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes-with-children"] });
      toast({ title: "Parent code created" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; code: string; name: string; description?: string; isActive: boolean; sortOrder: number }) => {
      return apiRequest("PATCH", `/api/cost-codes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes-with-children"] });
      toast({ title: "Parent code updated" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/cost-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes-with-children"] });
      toast({ title: "Parent code removed" });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createChildMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; description?: string; parentCostCodeId: string; isActive: boolean; sortOrder: number }) => {
      return apiRequest("POST", "/api/child-cost-codes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes-with-children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/child-cost-codes"] });
      toast({ title: "Child code created" });
      closeChildDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateChildMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; code: string; name: string; description?: string; parentCostCodeId: string; isActive: boolean; sortOrder: number }) => {
      return apiRequest("PATCH", `/api/child-cost-codes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes-with-children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/child-cost-codes"] });
      toast({ title: "Child code updated" });
      closeChildDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteChildMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/child-cost-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes-with-children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/child-cost-codes"] });
      toast({ title: "Child code removed" });
      setDeleteChildConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveDefaultsMutation = useMutation({
    mutationFn: async (data: { jobTypeId: string; costCodeIds: string[] }) => {
      return apiRequest("POST", "/api/cost-code-defaults", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-code-defaults", selectedJobTypeId] });
      toast({ title: "Default cost codes saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const csrfToken = getCsrfToken();
      const res = await fetch("/api/cost-codes/import", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Import failed" }));
        throw new Error(err.message || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-codes-with-children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/child-cost-codes"] });
      const totalImported = (data.summary?.parentCodes?.imported || 0) + (data.summary?.childCodes?.imported || 0);
      if (totalImported > 0) {
        toast({ title: `Imported ${totalImported} cost code${totalImported !== 1 ? "s" : ""}` });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleDownloadTemplate = useCallback(async () => {
    setIsDownloading(true);
    try {
      const res = await fetch("/api/cost-codes/template/download", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cost_codes_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }, [toast]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setShowImportDialog(true);
    importMutation.mutate(file);
    e.target.value = "";
  }

  function openCreate() {
    setEditingCode(null);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setFormSortOrder(0);
    setShowDialog(true);
  }

  function openEdit(cc: CostCode) {
    setEditingCode(cc);
    setFormCode(cc.code);
    setFormName(cc.name);
    setFormDescription(cc.description || "");
    setFormIsActive(cc.isActive);
    setFormSortOrder(cc.sortOrder);
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditingCode(null);
  }

  function openCreateChild(parentId: string) {
    setEditingChild(null);
    setFormParentCostCodeId(parentId);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setFormSortOrder(0);
    setShowChildDialog(true);
  }

  function openEditChild(child: ChildCostCode) {
    setEditingChild(child);
    setFormParentCostCodeId(child.parentCostCodeId);
    setFormCode(child.code);
    setFormName(child.name);
    setFormDescription(child.description || "");
    setFormIsActive(child.isActive);
    setFormSortOrder(child.sortOrder);
    setShowChildDialog(true);
  }

  function closeChildDialog() {
    setShowChildDialog(false);
    setEditingChild(null);
  }

  function handleSave() {
    const data = {
      code: formCode.trim(),
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      isActive: formIsActive,
      sortOrder: formSortOrder,
    };
    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleSaveChild() {
    const data = {
      code: formCode.trim(),
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      parentCostCodeId: formParentCostCodeId,
      isActive: formIsActive,
      sortOrder: formSortOrder,
    };
    if (editingChild) {
      updateChildMutation.mutate({ id: editingChild.id, ...data });
    } else {
      createChildMutation.mutate(data);
    }
  }

  function toggleExpanded(parentId: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }

  function expandAll() {
    const ids = (costCodesWithChildren || []).map((cc) => cc.id);
    setExpandedParents(new Set(ids));
  }

  function collapseAll() {
    setExpandedParents(new Set());
  }

  function handleJobTypeSelect(jobTypeId: string) {
    setSelectedJobTypeId(jobTypeId);
    setSelectedCostCodeIds(new Set());
  }

  function toggleCostCodeDefault(costCodeId: string) {
    setSelectedCostCodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(costCodeId)) {
        next.delete(costCodeId);
      } else {
        next.add(costCodeId);
      }
      return next;
    });
  }

  function handleSaveDefaults() {
    if (!selectedJobTypeId) return;
    saveDefaultsMutation.mutate({
      jobTypeId: selectedJobTypeId,
      costCodeIds: Array.from(selectedCostCodeIds),
    });
  }

  function handleSelectAllDefaults() {
    const allIds = activeCostCodes.map((cc) => cc.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => effectiveSelection.has(id));
    if (allSelected) {
      setSelectedCostCodeIds(new Set());
    } else {
      setSelectedCostCodeIds(new Set(allIds));
    }
  }

  const filteredCodes = useMemo(() => (costCodesWithChildren || []).filter((cc) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    const parentMatch = cc.code.toLowerCase().includes(s) || cc.name.toLowerCase().includes(s);
    const childMatch = cc.children.some(
      (child) => child.code.toLowerCase().includes(s) || child.name.toLowerCase().includes(s)
    );
    return parentMatch || childMatch;
  }), [costCodesWithChildren, searchTerm]);

  const activeCostCodes = useMemo(() => (costCodesFlat || []).filter((cc) => cc.isActive), [costCodesFlat]);

  const defaultCostCodeIds = useMemo(() => new Set((defaultsData || []).map((d: any) => d.costCodeId)), [defaultsData]);
  const effectiveSelection = selectedCostCodeIds.size > 0 ? selectedCostCodeIds : defaultCostCodeIds;
  const hasChanges = selectedJobTypeId && selectedCostCodeIds.size > 0;

  const totalParents = costCodesWithChildren?.length || 0;
  const totalChildren = useMemo(() => costCodesWithChildren?.reduce((sum, cc) => sum + cc.children.length, 0) || 0, [costCodesWithChildren]);

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto" role="main" aria-label="Cost Codes Management" data-testid="admin-cost-codes-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Cost Codes</h1>
          <p className="text-sm text-muted-foreground">
            {totalParents} parent codes, {totalChildren} child codes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleDownloadTemplate} disabled={isDownloading} data-testid="button-download-template">
            {isDownloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Download Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending} data-testid="button-import-cost-codes">
            {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-import-file"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-cost-codes">
          <TabsTrigger value="codes" data-testid="tab-codes">
            <Hash className="w-4 h-4 mr-1" />
            Cost Codes
          </TabsTrigger>
          <TabsTrigger value="defaults" data-testid="tab-defaults">
            <Link2 className="w-4 h-4 mr-1" />
            Job Type Defaults
          </TabsTrigger>
        </TabsList>

        <TabsContent value="codes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <CardTitle className="text-lg">Parent & Child Cost Codes</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={expandAll} data-testid="button-expand-all">
                  Expand All
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
                  Collapse All
                </Button>
                <Button onClick={openCreate} data-testid="button-add-cost-code">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Parent Code
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search parent or child codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-cost-codes"
                />
              </div>

              {loadingCostCodes ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredCodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-cost-codes">
                  {searchTerm ? "No cost codes match your search" : "No cost codes yet. Import from a spreadsheet or add manually."}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCodes.map((parent) => {
                    const isExpanded = expandedParents.has(parent.id);
                    const childCount = parent.children.length;
                    return (
                      <Collapsible key={parent.id} open={isExpanded} onOpenChange={() => toggleExpanded(parent.id)}>
                        <div className="border rounded-md" data-testid={`row-parent-code-${parent.id}`}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-2 p-3 cursor-pointer hover-elevate">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                              <span className="font-mono font-medium text-sm w-16 shrink-0" data-testid={`text-parent-code-${parent.id}`}>
                                {parent.code}
                              </span>
                              <span className="font-medium flex-1 min-w-0 truncate" data-testid={`text-parent-name-${parent.id}`}>
                                {parent.name}
                              </span>
                              <Badge variant="secondary" className="shrink-0">
                                {childCount} child{childCount !== 1 ? "ren" : ""}
                              </Badge>
                              <Badge variant={parent.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                                {parent.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" onClick={() => openCreateChild(parent.id)} data-testid={`button-add-child-${parent.id}`}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => openEdit(parent)} data-testid={`button-edit-${parent.id}`}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(parent)} data-testid={`button-delete-${parent.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            {childCount === 0 ? (
                              <div className="px-10 py-3 text-sm text-muted-foreground border-t">
                                No child codes. Click + to add one.
                              </div>
                            ) : (
                              <div className="border-t">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-8"></TableHead>
                                      <TableHead className="w-24">Code</TableHead>
                                      <TableHead>Name</TableHead>
                                      <TableHead className="hidden md:table-cell">Description</TableHead>
                                      <TableHead className="w-20">Status</TableHead>
                                      <TableHead className="w-24 text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {parent.children.map((child) => (
                                      <TableRow key={child.id} data-testid={`row-child-code-${child.id}`}>
                                        <TableCell>
                                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                        </TableCell>
                                        <TableCell className="font-mono text-sm" data-testid={`text-child-code-${child.id}`}>
                                          {child.code}
                                        </TableCell>
                                        <TableCell data-testid={`text-child-name-${child.id}`}>{child.name}</TableCell>
                                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-xs truncate">
                                          {child.description || "—"}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={child.isActive ? "default" : "secondary"} className="text-xs">
                                            {child.isActive ? "Active" : "Inactive"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <Button size="icon" variant="ghost" onClick={() => openEditChild(child)} data-testid={`button-edit-child-${child.id}`}>
                                              <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => setDeleteChildConfirm(child)} data-testid={`button-delete-child-${child.id}`}>
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Job Type Default Cost Codes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a job type, then check the parent cost codes that should be automatically assigned when a new job of that type is created.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-64">
                  <Select value={selectedJobTypeId} onValueChange={handleJobTypeSelect}>
                    <SelectTrigger data-testid="select-job-type">
                      <SelectValue placeholder="Select a job type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(jobTypesData || []).filter((jt) => jt.isActive).map((jt) => (
                        <SelectItem key={jt.id} value={jt.id} data-testid={`option-job-type-${jt.id}`}>
                          {jt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasChanges && (
                  <Button onClick={handleSaveDefaults} disabled={saveDefaultsMutation.isPending} data-testid="button-save-defaults">
                    {saveDefaultsMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Save Defaults
                  </Button>
                )}
              </div>

              {!selectedJobTypeId ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-select-job-type-prompt">
                  Select a job type above to manage its default cost codes
                </div>
              ) : loadingDefaults ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : activeCostCodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active cost codes available. Create some in the Cost Codes tab first.
                </div>
              ) : (
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={activeCostCodes.length > 0 && activeCostCodes.every((cc) => effectiveSelection.has(cc.id))}
                            onCheckedChange={handleSelectAllDefaults}
                            data-testid="checkbox-select-all-defaults"
                          />
                        </TableHead>
                        <TableHead className="w-24">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeCostCodes.map((cc) => {
                        const isChecked = effectiveSelection.has(cc.id);
                        return (
                          <TableRow key={cc.id} className="cursor-pointer" onClick={() => toggleCostCodeDefault(cc.id)} data-testid={`row-default-${cc.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleCostCodeDefault(cc.id)}
                                data-testid={`checkbox-default-${cc.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono font-medium">{cc.code}</TableCell>
                            <TableCell>{cc.name}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-xs truncate">
                              {cc.description || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent data-testid="dialog-cost-code-form">
          <DialogHeader>
            <DialogTitle>{editingCode ? "Edit Parent Code" : "Add Parent Code"}</DialogTitle>
            <DialogDescription>
              {editingCode ? "Update the parent cost code details below." : "Enter the details for the new parent cost code."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cc-code">Code</Label>
              <Input
                id="cc-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. 17"
                data-testid="input-cost-code-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-name">Name</Label>
              <Input
                id="cc-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Concrete Works"
                data-testid="input-cost-code-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-desc">Description</Label>
              <Textarea
                id="cc-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                className="resize-none"
                data-testid="input-cost-code-description"
              />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-2">
                <Label htmlFor="cc-sort">Sort Order</Label>
                <Input
                  id="cc-sort"
                  type="number"
                  min="0"
                  step="1"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                  className="w-24"
                  data-testid="input-cost-code-sort"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                  data-testid="switch-cost-code-active"
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-cost-code">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formCode.trim() || !formName.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-cost-code"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingCode ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showChildDialog} onOpenChange={setShowChildDialog}>
        <DialogContent data-testid="dialog-child-cost-code-form">
          <DialogHeader>
            <DialogTitle>{editingChild ? "Edit Child Code" : "Add Child Code"}</DialogTitle>
            <DialogDescription>
              {editingChild ? "Update the child cost code details below." : "Enter the details for the new child cost code."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="child-parent">Parent Code</Label>
              <Select value={formParentCostCodeId} onValueChange={setFormParentCostCodeId}>
                <SelectTrigger data-testid="select-child-parent">
                  <SelectValue placeholder="Select parent code..." />
                </SelectTrigger>
                <SelectContent>
                  {(costCodesFlat || []).filter((cc) => cc.isActive).map((cc) => (
                    <SelectItem key={cc.id} value={cc.id} data-testid={`option-parent-${cc.id}`}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="child-code">Code</Label>
              <Input
                id="child-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. 17.5"
                data-testid="input-child-code-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="child-name">Name</Label>
              <Input
                id="child-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Concrete Slabs"
                data-testid="input-child-code-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="child-desc">Description</Label>
              <Textarea
                id="child-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                className="resize-none"
                data-testid="input-child-code-description"
              />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-2">
                <Label htmlFor="child-sort">Sort Order</Label>
                <Input
                  id="child-sort"
                  type="number"
                  min="0"
                  step="1"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                  className="w-24"
                  data-testid="input-child-code-sort"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                  data-testid="switch-child-code-active"
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeChildDialog} data-testid="button-cancel-child-code">
              Cancel
            </Button>
            <Button
              onClick={handleSaveChild}
              disabled={!formCode.trim() || !formName.trim() || !formParentCostCodeId || createChildMutation.isPending || updateChildMutation.isPending}
              data-testid="button-save-child-code"
            >
              {(createChildMutation.isPending || updateChildMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingChild ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Parent Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete parent code "{deleteConfirm?.code} - {deleteConfirm?.name}"?
              This will also delete all child codes under it. If it is in use, it will be deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteChildConfirm} onOpenChange={(open) => !open && setDeleteChildConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Child Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete child code "{deleteChildConfirm?.code} - {deleteChildConfirm?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-child">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteChildConfirm && deleteChildMutation.mutate(deleteChildConfirm.id)}
              data-testid="button-confirm-delete-child"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-import-results">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
            <DialogDescription>Summary of the cost codes import</DialogDescription>
          </DialogHeader>
          {importMutation.isPending ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Importing cost codes...</span>
            </div>
          ) : importResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{importResult.summary?.parentCodes?.imported || 0}</div>
                    <div className="text-xs text-muted-foreground">Parent Codes Imported</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{importResult.summary?.childCodes?.imported || 0}</div>
                    <div className="text-xs text-muted-foreground">Child Codes Imported</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{importResult.summary?.parentCodes?.skipped || 0}</div>
                    <div className="text-xs text-muted-foreground">Parent Codes Skipped</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{importResult.summary?.childCodes?.skipped || 0}</div>
                    <div className="text-xs text-muted-foreground">Child Codes Skipped</div>
                  </CardContent>
                </Card>
              </div>

              {(importResult.summary?.errors || 0) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-sm font-medium text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    {importResult.summary.errors} Error{importResult.summary.errors !== 1 ? "s" : ""}
                  </div>
                  <div className="max-h-32 overflow-auto border rounded-md p-2 text-xs space-y-1">
                    {(importResult.errors || []).map((err: any, i: number) => (
                      <div key={i} className="flex items-start gap-1">
                        <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                        <span>{err.sheet && `[${err.sheet}] `}Row {err.row}: {err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(importResult.importedParents?.length > 0 || importResult.importedChildren?.length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Successfully Imported
                  </div>
                  <div className="max-h-40 overflow-auto border rounded-md p-2 text-xs space-y-1">
                    {(importResult.importedParents || []).map((item: any, i: number) => (
                      <div key={`p-${i}`} className="flex items-center gap-1">
                        <FolderOpen className="w-3 h-3 text-primary shrink-0" />
                        <span className="font-mono">{item.code}</span> - {item.name}
                      </div>
                    ))}
                    {(importResult.importedChildren || []).slice(0, 20).map((item: any, i: number) => (
                      <div key={`c-${i}`} className="flex items-center gap-1 pl-4">
                        <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-mono">{item.code}</span> - {item.name}
                      </div>
                    ))}
                    {(importResult.importedChildren || []).length > 20 && (
                      <div className="text-muted-foreground pl-4">
                        ...and {importResult.importedChildren.length - 20} more child codes
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} data-testid="button-close-import">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
