import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight,
  ClipboardList, Layers, Hash, DollarSign, Package,
} from "lucide-react";
import type { BoqGroup, BoqItem, CostCode, Job } from "@shared/schema";

interface BoqGroupWithCostCode extends BoqGroup {
  costCode: { id: string; code: string; name: string };
  childCostCode: { id: string; code: string; name: string } | null;
}

interface BoqItemWithCostCode extends BoqItem {
  costCode: { id: string; code: string; name: string };
  childCostCode: { id: string; code: string; name: string } | null;
}

interface BoqSummary {
  totalItems: number;
  totalValue: string;
  breakdown: { costCodeId: string; costCode: string; costCodeName: string; itemCount: number; subtotal: string }[];
}

const UNITS = ["EA", "SQM", "M3", "LM", "M2", "M", "HR", "DAY", "TONNE", "KG", "LOT"] as const;

function formatCurrency(val: string | number | null | undefined) {
  const num = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num);
}

export default function JobBoqPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/jobs/:id/boq");
  const jobId = params?.id;

  const [costCodeFilter, setCostCodeFilter] = useState("ALL");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BoqGroupWithCostCode | null>(null);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<BoqGroupWithCostCode | null>(null);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BoqItemWithCostCode | null>(null);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<BoqItemWithCostCode | null>(null);
  const [presetGroupId, setPresetGroupId] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [groupCostCodeId, setGroupCostCodeId] = useState("");
  const [groupChildCostCodeId, setGroupChildCostCodeId] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupSortOrder, setGroupSortOrder] = useState(0);

  const [itemDescription, setItemDescription] = useState("");
  const [itemCostCodeId, setItemCostCodeId] = useState("");
  const [itemChildCostCodeId, setItemChildCostCodeId] = useState("");
  const [itemGroupId, setItemGroupId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemUnit, setItemUnit] = useState("EA");
  const [itemUnitPrice, setItemUnitPrice] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  const itemLineTotal = useMemo(() => {
    const qty = parseFloat(itemQuantity) || 0;
    const price = parseFloat(itemUnitPrice) || 0;
    return (qty * price).toFixed(2);
  }, [itemQuantity, itemUnitPrice]);

  const { data: job, isLoading: loadingJob } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<BoqSummary>({
    queryKey: ["/api/jobs", jobId, "boq", "summary"],
    enabled: !!jobId,
  });

  const groupsQueryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (costCodeFilter !== "ALL") p.set("costCodeId", costCodeFilter);
    return p.toString();
  }, [costCodeFilter]);

  const itemsQueryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (costCodeFilter !== "ALL") p.set("costCodeId", costCodeFilter);
    return p.toString();
  }, [costCodeFilter]);

  const { data: groups = [], isLoading: loadingGroups } = useQuery<BoqGroupWithCostCode[]>({
    queryKey: ["/api/jobs", jobId, "boq", "groups", costCodeFilter],
    queryFn: async () => {
      const url = `/api/jobs/${jobId}/boq/groups${groupsQueryParams ? `?${groupsQueryParams}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
    enabled: !!jobId,
  });

  const { data: allItems = [], isLoading: loadingItems } = useQuery<BoqItemWithCostCode[]>({
    queryKey: ["/api/jobs", jobId, "boq", "items", costCodeFilter],
    queryFn: async () => {
      const url = `/api/jobs/${jobId}/boq/items${itemsQueryParams ? `?${itemsQueryParams}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
    enabled: !!jobId,
  });

  const { data: costCodes = [] } = useQuery<CostCode[]>({
    queryKey: ["/api/cost-codes"],
  });

  const { data: costCodesWithChildren = [] } = useQuery<any[]>({
    queryKey: ["/api/cost-codes-with-children"],
  });

  const activeCostCodes = useMemo(() => costCodes.filter((cc) => cc.isActive), [costCodes]);

  const filteredGroupChildCodes = useMemo(() => {
    if (!groupCostCodeId) return [];
    const parent = costCodesWithChildren.find((cc: any) => cc.id === groupCostCodeId);
    return (parent?.children || []).filter((child: any) => child.isActive);
  }, [groupCostCodeId, costCodesWithChildren]);

  const filteredItemChildCodes = useMemo(() => {
    if (!itemCostCodeId) return [];
    const parent = costCodesWithChildren.find((cc: any) => cc.id === itemCostCodeId);
    return (parent?.children || []).filter((child: any) => child.isActive);
  }, [itemCostCodeId, costCodesWithChildren]);

  const ungroupedItems = useMemo(() => allItems.filter((item) => !item.groupId), [allItems]);
  const groupedItemsMap = useMemo(() => {
    const map = new Map<string, BoqItemWithCostCode[]>();
    allItems.forEach((item) => {
      if (item.groupId) {
        const existing = map.get(item.groupId) || [];
        existing.push(item);
        map.set(item.groupId, existing);
      }
    });
    return map;
  }, [allItems]);

  function invalidateBoqQueries() {
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "boq", "groups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "boq", "items"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "boq", "summary"] });
  }

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; costCodeId: string; childCostCodeId?: string; description?: string; sortOrder?: number }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/boq/groups`, data);
    },
    onSuccess: () => {
      invalidateBoqQueries();
      toast({ title: "Group created" });
      closeGroupDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; costCodeId?: string; childCostCodeId?: string; description?: string; sortOrder?: number }) => {
      return apiRequest("PATCH", `/api/jobs/${jobId}/boq/groups/${id}`, data);
    },
    onSuccess: () => {
      invalidateBoqQueries();
      toast({ title: "Group updated" });
      closeGroupDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/jobs/${jobId}/boq/groups/${id}`);
    },
    onSuccess: () => {
      invalidateBoqQueries();
      toast({ title: "Group deleted" });
      setDeleteGroupConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: { description: string; costCodeId: string; childCostCodeId?: string; groupId?: string | null; quantity?: string; unit?: string; unitPrice?: string; lineTotal?: string; notes?: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/boq/items`, data);
    },
    onSuccess: () => {
      invalidateBoqQueries();
      toast({ title: "Item created" });
      closeItemDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; description?: string; costCodeId?: string; childCostCodeId?: string; groupId?: string | null; quantity?: string; unit?: string; unitPrice?: string; lineTotal?: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/jobs/${jobId}/boq/items/${id}`, data);
    },
    onSuccess: () => {
      invalidateBoqQueries();
      toast({ title: "Item updated" });
      closeItemDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/jobs/${jobId}/boq/items/${id}`);
    },
    onSuccess: () => {
      invalidateBoqQueries();
      toast({ title: "Item deleted" });
      setDeleteItemConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function toggleGroup(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupName("");
    setGroupCostCodeId("");
    setGroupChildCostCodeId("");
    setGroupDescription("");
    setGroupSortOrder(0);
    setGroupDialogOpen(true);
  }

  function openEditGroup(group: BoqGroupWithCostCode) {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupCostCodeId(group.costCodeId);
    setGroupChildCostCodeId(group.childCostCodeId || "");
    setGroupDescription(group.description || "");
    setGroupSortOrder(group.sortOrder);
    setGroupDialogOpen(true);
  }

  function closeGroupDialog() {
    setGroupDialogOpen(false);
    setEditingGroup(null);
  }

  function handleGroupSave() {
    if (!groupName.trim() || !groupCostCodeId) {
      toast({ title: "Name and cost code are required", variant: "destructive" });
      return;
    }
    const data = {
      name: groupName.trim(),
      costCodeId: groupCostCodeId,
      childCostCodeId: groupChildCostCodeId && groupChildCostCodeId !== "__none__" ? groupChildCostCodeId : undefined,
      description: groupDescription.trim() || undefined,
      sortOrder: groupSortOrder,
    };
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, ...data });
    } else {
      createGroupMutation.mutate(data);
    }
  }

  function openCreateItem(forGroupId?: string) {
    setEditingItem(null);
    setPresetGroupId(forGroupId || null);
    setItemDescription("");
    setItemCostCodeId("");
    setItemChildCostCodeId("");
    setItemGroupId(forGroupId || "");
    setItemQuantity("");
    setItemUnit("EA");
    setItemUnitPrice("");
    setItemNotes("");
    setItemDialogOpen(true);
  }

  function openEditItem(item: BoqItemWithCostCode) {
    setEditingItem(item);
    setPresetGroupId(null);
    setItemDescription(item.description);
    setItemCostCodeId(item.costCodeId);
    setItemChildCostCodeId(item.childCostCodeId || "");
    setItemGroupId(item.groupId || "");
    setItemQuantity(item.quantity || "");
    setItemUnit(item.unit);
    setItemUnitPrice(item.unitPrice || "");
    setItemNotes(item.notes || "");
    setItemDialogOpen(true);
  }

  function closeItemDialog() {
    setItemDialogOpen(false);
    setEditingItem(null);
    setPresetGroupId(null);
  }

  function handleItemSave() {
    if (!itemDescription.trim() || !itemCostCodeId) {
      toast({ title: "Description and cost code are required", variant: "destructive" });
      return;
    }
    const data = {
      description: itemDescription.trim(),
      costCodeId: itemCostCodeId,
      childCostCodeId: itemChildCostCodeId && itemChildCostCodeId !== "__none__" ? itemChildCostCodeId : undefined,
      groupId: itemGroupId || null,
      quantity: itemQuantity || "0",
      unit: itemUnit,
      unitPrice: itemUnitPrice || "0",
      lineTotal: itemLineTotal,
      notes: itemNotes.trim() || undefined,
    };
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, ...data });
    } else {
      createItemMutation.mutate(data);
    }
  }

  const isGroupFormPending = createGroupMutation.isPending || updateGroupMutation.isPending;
  const isItemFormPending = createItemMutation.isPending || updateItemMutation.isPending;

  if (!jobId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground" data-testid="text-no-job">No job selected.</p>
      </div>
    );
  }

  if (loadingJob) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" role="main" aria-label="Job BOQ">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Bill of Quantities</h1>
          {job && (
            <p className="text-sm text-muted-foreground" data-testid="text-job-info">
              {job.jobNumber} - {job.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={openCreateGroup} data-testid="button-add-group">
            <Layers className="h-4 w-4 mr-2" />
            Add Group
          </Button>
          <Button onClick={() => openCreateItem()} data-testid="button-add-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={costCodeFilter} onValueChange={setCostCodeFilter}>
          <SelectTrigger className="w-[260px]" data-testid="select-cost-code-filter">
            <SelectValue placeholder="All Cost Codes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Cost Codes</SelectItem>
            {activeCostCodes.map((cc) => (
              <SelectItem key={cc.id} value={cc.id} data-testid={`option-filter-cc-${cc.id}`}>
                {cc.code} - {cc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 gap-4">
          <Card data-testid="card-total-items">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-items">
                {summary.totalItems}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-value">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-value">
                {formatCurrency(summary.totalValue)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loadingGroups ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : groups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-groups-heading">
            <Layers className="h-5 w-5" />
            Groups ({groups.length})
          </h2>
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const groupItems = groupedItemsMap.get(group.id) || [];
            return (
              <Card key={group.id} data-testid={`card-group-${group.id}`}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(group.id)}>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-left flex-1 min-w-0" data-testid={`button-toggle-group-${group.id}`}>
                        {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate" data-testid={`text-group-name-${group.id}`}>
                            {group.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs" data-testid={`badge-group-cc-${group.id}`}>
                              {group.costCode.code} - {group.costCode.name}
                            </Badge>
                            {group.childCostCode && (
                              <Badge variant="outline" className="text-xs" data-testid={`badge-group-child-cc-${group.id}`}>
                                {group.childCostCode.code} - {group.childCostCode.name}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {groupItems.length} item{groupItems.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openCreateItem(group.id); }} data-testid={`button-add-item-to-group-${group.id}`}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditGroup(group); }} data-testid={`button-edit-group-${group.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteGroupConfirm(group); }} data-testid={`button-delete-group-${group.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {group.description && (
                        <p className="text-sm text-muted-foreground mb-3" data-testid={`text-group-desc-${group.id}`}>
                          {group.description}
                        </p>
                      )}
                      {groupItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center" data-testid={`text-group-empty-${group.id}`}>
                          No items in this group yet.
                        </p>
                      ) : (
                        <div className="border rounded-md overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-24">Cost Code</TableHead>
                                <TableHead className="text-right w-20">Qty</TableHead>
                                <TableHead className="w-16">Unit</TableHead>
                                <TableHead className="text-right w-28">Unit Price</TableHead>
                                <TableHead className="text-right w-28">Line Total</TableHead>
                                <TableHead className="hidden lg:table-cell">Notes</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupItems.map((item) => (
                                <TableRow key={item.id} data-testid={`row-group-item-${item.id}`}>
                                  <TableCell data-testid={`text-item-desc-${item.id}`}>{item.description}</TableCell>
                                  <TableCell className="font-mono text-sm" data-testid={`text-item-cc-${item.id}`}>
                                    {item.costCode.code}
                                    {item.childCostCode && (
                                      <span className="text-muted-foreground" data-testid={`text-item-child-cc-${item.id}`}> / {item.childCostCode.code}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-mono" data-testid={`text-item-qty-${item.id}`}>{item.quantity}</TableCell>
                                  <TableCell className="text-muted-foreground" data-testid={`text-item-unit-${item.id}`}>{item.unit}</TableCell>
                                  <TableCell className="text-right font-mono" data-testid={`text-item-price-${item.id}`}>{formatCurrency(item.unitPrice)}</TableCell>
                                  <TableCell className="text-right font-mono font-medium" data-testid={`text-item-total-${item.id}`}>{formatCurrency(item.lineTotal)}</TableCell>
                                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-xs truncate">{item.notes || "-"}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button size="icon" variant="ghost" onClick={() => openEditItem(item)} data-testid={`button-edit-item-${item.id}`}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={() => setDeleteItemConfirm(item)} data-testid={`button-delete-item-${item.id}`}>
                                        <Trash2 className="h-4 w-4" />
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
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {groups.length > 0 ? `Ungrouped Items (${ungroupedItems.length})` : `All Items (${allItems.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingItems ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (groups.length > 0 ? ungroupedItems : allItems).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-items">
              No items found. Add your first BOQ item to get started.
            </div>
          ) : (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24">Cost Code</TableHead>
                    <TableHead className="text-right w-20">Qty</TableHead>
                    <TableHead className="w-16">Unit</TableHead>
                    <TableHead className="text-right w-28">Unit Price</TableHead>
                    <TableHead className="text-right w-28">Line Total</TableHead>
                    <TableHead className="hidden lg:table-cell">Notes</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(groups.length > 0 ? ungroupedItems : allItems).map((item) => (
                    <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                      <TableCell data-testid={`text-item-desc-${item.id}`}>{item.description}</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-item-cc-${item.id}`}>
                        {item.costCode.code}
                        {item.childCostCode && (
                          <span className="text-muted-foreground" data-testid={`text-item-child-cc-${item.id}`}> / {item.childCostCode.code}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-item-qty-${item.id}`}>{item.quantity}</TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-item-unit-${item.id}`}>{item.unit}</TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-item-price-${item.id}`}>{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-mono font-medium" data-testid={`text-item-total-${item.id}`}>{formatCurrency(item.lineTotal)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-xs truncate">{item.notes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditItem(item)} data-testid={`button-edit-item-${item.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteItemConfirm(item)} data-testid={`button-delete-item-${item.id}`}>
                            <Trash2 className="h-4 w-4" />
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

      <Dialog open={groupDialogOpen} onOpenChange={(open) => { if (!open) closeGroupDialog(); }}>
        <DialogContent data-testid="dialog-group-form">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Group" : "Add Group"}</DialogTitle>
            <DialogDescription>
              {editingGroup ? "Update the group details below." : "Create a new BOQ group."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name..."
                data-testid="input-group-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-cost-code">Cost Code</Label>
              <Select value={groupCostCodeId} onValueChange={(v) => { setGroupCostCodeId(v); setGroupChildCostCodeId(""); }}>
                <SelectTrigger data-testid="select-group-cost-code">
                  <SelectValue placeholder="Select cost code..." />
                </SelectTrigger>
                <SelectContent>
                  {activeCostCodes.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id} data-testid={`option-group-cc-${cc.id}`}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredGroupChildCodes.length > 0 && (
              <div className="space-y-2">
                <Label>Child Code (Optional)</Label>
                <Select value={groupChildCostCodeId} onValueChange={setGroupChildCostCodeId}>
                  <SelectTrigger data-testid="select-group-child-cost-code">
                    <SelectValue placeholder="Select a child code..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {filteredGroupChildCodes.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id} data-testid={`option-child-code-${cc.id}`}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Optional description..."
                className="resize-none"
                data-testid="input-group-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-sort-order">Sort Order</Label>
              <Input
                id="group-sort-order"
                type="number"
                value={groupSortOrder}
                onChange={(e) => setGroupSortOrder(parseInt(e.target.value) || 0)}
                className="w-24"
                data-testid="input-group-sort-order"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeGroupDialog} data-testid="button-cancel-group">Cancel</Button>
            <Button onClick={handleGroupSave} disabled={isGroupFormPending} data-testid="button-save-group">
              {isGroupFormPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingGroup ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={(open) => { if (!open) closeItemDialog(); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-item-form">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the BOQ item details below." : "Add a new BOQ item."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-description">Description</Label>
              <Input
                id="item-description"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Item description..."
                data-testid="input-item-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-cost-code">Cost Code</Label>
              <Select value={itemCostCodeId} onValueChange={(v) => { setItemCostCodeId(v); setItemChildCostCodeId(""); }}>
                <SelectTrigger data-testid="select-item-cost-code">
                  <SelectValue placeholder="Select cost code..." />
                </SelectTrigger>
                <SelectContent>
                  {activeCostCodes.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id} data-testid={`option-item-cc-${cc.id}`}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filteredItemChildCodes.length > 0 && (
              <div className="space-y-2">
                <Label>Child Code (Optional)</Label>
                <Select value={itemChildCostCodeId} onValueChange={setItemChildCostCodeId}>
                  <SelectTrigger data-testid="select-item-child-cost-code">
                    <SelectValue placeholder="Select a child code..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {filteredItemChildCodes.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id} data-testid={`option-child-code-${cc.id}`}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="item-group">Group (optional)</Label>
              <Select value={itemGroupId || "NONE"} onValueChange={(v) => setItemGroupId(v === "NONE" ? "" : v)}>
                <SelectTrigger data-testid="select-item-group">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No group</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id} data-testid={`option-item-group-${g.id}`}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-quantity">Quantity</Label>
                <Input
                  id="item-quantity"
                  type="number"
                  step="0.0001"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  placeholder="0"
                  data-testid="input-item-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-unit">Unit</Label>
                <Select value={itemUnit} onValueChange={setItemUnit}>
                  <SelectTrigger data-testid="select-item-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u} data-testid={`option-item-unit-${u}`}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-unit-price">Unit Price</Label>
                <Input
                  id="item-unit-price"
                  type="number"
                  step="0.01"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-item-unit-price"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-muted-foreground">Line Total:</Label>
              <span className="font-mono font-medium" data-testid="text-item-line-total-calc">
                {formatCurrency(itemLineTotal)}
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Textarea
                id="item-notes"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Optional notes..."
                className="resize-none"
                data-testid="input-item-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeItemDialog} data-testid="button-cancel-item">Cancel</Button>
            <Button onClick={handleItemSave} disabled={isItemFormPending} data-testid="button-save-item">
              {isItemFormPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGroupConfirm} onOpenChange={(open) => !open && setDeleteGroupConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete group "{deleteGroupConfirm?.name}"? All items within this group will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-group">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupConfirm && deleteGroupMutation.mutate(deleteGroupConfirm.id)}
              data-testid="button-confirm-delete-group"
            >
              {deleteGroupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteItemConfirm} onOpenChange={(open) => !open && setDeleteItemConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete item "{deleteItemConfirm?.description}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-item">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItemConfirm && deleteItemMutation.mutate(deleteItemConfirm.id)}
              data-testid="button-confirm-delete-item"
            >
              {deleteItemMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
