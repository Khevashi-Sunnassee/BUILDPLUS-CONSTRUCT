import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Plus, Pencil, Trash2, Loader2, Search, Hash, Settings2, Link2 } from "lucide-react";
import type { CostCode, JobType } from "@shared/schema";
import { PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";

export default function AdminCostCodesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("codes");
  const [showDialog, setShowDialog] = useState(false);
  const [editingCode, setEditingCode] = useState<CostCode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CostCode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState(0);

  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string>("");
  const [selectedCostCodeIds, setSelectedCostCodeIds] = useState<Set<string>>(new Set());

  const { data: costCodesData, isLoading: loadingCostCodes } = useQuery<CostCode[]>({
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
      toast({ title: "Cost code created" });
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
      toast({ title: "Cost code updated" });
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
      toast({ title: "Cost code removed" });
      setDeleteConfirm(null);
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

  const filteredCodes = (costCodesData || []).filter((cc) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return cc.code.toLowerCase().includes(s) || cc.name.toLowerCase().includes(s);
  });

  const activeCostCodes = (costCodesData || []).filter((cc) => cc.isActive);

  const defaultCostCodeIds = new Set((defaultsData || []).map((d: any) => d.costCodeId));
  const effectiveSelection = selectedCostCodeIds.size > 0 ? selectedCostCodeIds : defaultCostCodeIds;
  const hasChanges = selectedJobTypeId && selectedCostCodeIds.size > 0;

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto" data-testid="admin-cost-codes-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Cost Codes</h1>
          <p className="text-sm text-muted-foreground">Manage cost codes and assign defaults to job types</p>
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
              <CardTitle className="text-lg">All Cost Codes</CardTitle>
              <Button onClick={openCreate} data-testid="button-add-cost-code">
                <Plus className="w-4 h-4 mr-1" />
                Add Cost Code
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search cost codes..."
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
                  {searchTerm ? "No cost codes match your search" : "No cost codes yet. Add your first one."}
                </div>
              ) : (
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Description</TableHead>
                        <TableHead className="w-20">Order</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead className="w-24 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCodes.map((cc) => (
                        <TableRow key={cc.id} data-testid={`row-cost-code-${cc.id}`}>
                          <TableCell className="font-mono font-medium" data-testid={`text-code-${cc.id}`}>{cc.code}</TableCell>
                          <TableCell data-testid={`text-name-${cc.id}`}>{cc.name}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-xs truncate">
                            {cc.description || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{cc.sortOrder}</TableCell>
                          <TableCell>
                            <Badge variant={cc.isActive ? "default" : "secondary"} className="text-xs">
                              {cc.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(cc)} data-testid={`button-edit-${cc.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(cc)} data-testid={`button-delete-${cc.id}`}>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Job Type Default Cost Codes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a job type, then check the cost codes that should be automatically assigned when a new job of that type is created.
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
                          <span className="sr-only">Select</span>
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
            <DialogTitle>{editingCode ? "Edit Cost Code" : "Add Cost Code"}</DialogTitle>
            <DialogDescription>
              {editingCode ? "Update the cost code details below." : "Enter the details for the new cost code."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cc-code">Code</Label>
              <Input
                id="cc-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. 1010"
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

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cost Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete cost code "{deleteConfirm?.code} - {deleteConfirm?.name}"?
              If it is in use, it will be deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
