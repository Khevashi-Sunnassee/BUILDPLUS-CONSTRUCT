import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BUDGET_LINE_ROUTES } from "@shared/api-routes";
import { EntitySidebar } from "@/components/EntitySidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Trash2, Send, X, Plus, Lock, Unlock, ClipboardList,
} from "lucide-react";

interface BudgetLineInfo {
  id: string;
  costCode: { code: string; name: string };
  childCostCode: { code: string; name: string } | null;
  estimateLocked: boolean;
  estimatedBudget: string;
}

interface DetailItem {
  id: string;
  budgetLineId: string;
  item: string;
  quantity: string;
  unit: string;
  price: string;
  lineTotal: string;
  notes: string | null;
  sortOrder: number;
}

const UNIT_OPTIONS = ["EA", "SQM", "M3", "LM", "M2", "M", "HR", "DAY", "TONNE", "KG", "LOT"];

function formatCurrency(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 });
}

export function BudgetLineSidebar({
  line,
  jobId,
  onClose,
  onBudgetUpdated,
  initialTab,
}: {
  line: BudgetLineInfo | null;
  jobId: string;
  onClose: () => void;
  onBudgetUpdated?: () => void;
  initialTab?: "updates" | "files" | "items";
}) {
  const { toast } = useToast();

  const { data: detailItems = [], isLoading: detailItemsLoading } = useQuery<DetailItem[]>({
    queryKey: [`/api/budget-lines/${line?.id}/detail-items`],
    enabled: !!line,
  });

  const createDetailItemMutation = useMutation({
    mutationFn: async (data: { item: string; quantity?: string; unit?: string; price?: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/budget-lines/${line?.id}/detail-items`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/detail-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      onBudgetUpdated?.();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const updateDetailItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; item?: string; quantity?: string; unit?: string; price?: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/budget-line-detail-items/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/detail-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      onBudgetUpdated?.();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteDetailItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/budget-line-detail-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/budget-lines/${line?.id}/detail-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      onBudgetUpdated?.();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      const res = await apiRequest("PATCH", `/api/budget-lines/${line?.id}/toggle-lock`, { locked });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "budget", "summary"] });
      onBudgetUpdated?.();
      toast({ title: "Budget lock updated" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  if (!line) return null;

  const lineLabel = line.childCostCode
    ? `${line.childCostCode.code} - ${line.childCostCode.name}`
    : `${line.costCode.code} - ${line.costCode.name}`;

  const detailItemsTotal = detailItems.reduce((sum, item) => sum + parseFloat(item.lineTotal || "0"), 0);

  return (
    <EntitySidebar
      entityId={line.id}
      entityName={lineLabel}
      routes={BUDGET_LINE_ROUTES}
      invalidationKeys={[["/api/jobs", jobId, "budget", "lines"], ["/api/jobs", jobId, "budget", "summary"]]}
      onClose={onClose}
      initialTab={initialTab || "updates"}
      testIdPrefix="budget"
      sheetWidth="w-[600px] sm:w-[750px]"
      hideActivityTab
      extraTabs={[{ id: "items", label: "Items", icon: <ClipboardList className="h-4 w-4 mr-1" /> }]}
      renderExtraTab={(tabId) => {
        if (tabId === "items") {
          return (
            <DetailItemsTab
              lineId={line.id}
              jobId={jobId}
              detailItems={detailItems}
              detailItemsLoading={detailItemsLoading}
              detailItemsTotal={detailItemsTotal}
              estimateLocked={line.estimateLocked}
              estimatedBudget={line.estimatedBudget}
              onCreateItem={(data) => createDetailItemMutation.mutateAsync(data)}
              onUpdateItem={(data) => updateDetailItemMutation.mutateAsync(data)}
              onDeleteItem={(id) => deleteDetailItemMutation.mutateAsync(id)}
              onToggleLock={(locked) => toggleLockMutation.mutate(locked)}
              isCreating={createDetailItemMutation.isPending}
            />
          );
        }
        return null;
      }}
      emptyUpdatesMessage="Write a note, drop an email, or share files about this budget line"
    />
  );
}

function DetailItemsTab({
  lineId,
  jobId,
  detailItems,
  detailItemsLoading,
  detailItemsTotal,
  estimateLocked,
  estimatedBudget,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onToggleLock,
  isCreating,
}: {
  lineId: string;
  jobId: string;
  detailItems: DetailItem[];
  detailItemsLoading: boolean;
  detailItemsTotal: number;
  estimateLocked: boolean;
  estimatedBudget: string;
  onCreateItem: (data: { item: string; quantity?: string; unit?: string; price?: string; notes?: string }) => Promise<any>;
  onUpdateItem: (data: { id: string; item?: string; quantity?: string; unit?: string; price?: string; notes?: string }) => Promise<any>;
  onDeleteItem: (id: string) => Promise<any>;
  onToggleLock: (locked: boolean) => void;
  isCreating: boolean;
}) {
  const [newItem, setNewItem] = useState({ item: "", quantity: "1", unit: "EA", price: "0", notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleAddItem = async () => {
    if (!newItem.item.trim()) return;
    await onCreateItem({
      item: newItem.item.trim(),
      quantity: newItem.quantity || "1",
      unit: newItem.unit || "EA",
      price: newItem.price || "0",
      notes: newItem.notes || undefined,
    });
    setNewItem({ item: "", quantity: "1", unit: "EA", price: "0", notes: "" });
  };

  const startEdit = (item: DetailItem) => {
    setEditingId(item.id);
    setEditValues({
      item: item.item,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      notes: item.notes || "",
    });
  };

  const saveEdit = async (id: string) => {
    await onUpdateItem({
      id,
      item: editValues.item,
      quantity: editValues.quantity,
      unit: editValues.unit,
      price: editValues.price,
      notes: editValues.notes,
    });
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit(id);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const newLineTotal = (parseFloat(newItem.quantity || "0") * parseFloat(newItem.price || "0"));
  const editLineTotal = editingId ? (parseFloat(editValues.quantity || "0") * parseFloat(editValues.price || "0")) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Line items that make up the estimated budget
        </div>
        <Button
          variant={estimateLocked ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleLock(!estimateLocked)}
          data-testid="btn-toggle-budget-lock"
        >
          {estimateLocked ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
          {estimateLocked ? "Locked" : "Unlocked"}
        </Button>
      </div>

      {estimateLocked && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estimated budget is locked to items total</span>
            <span className="font-mono font-medium">{formatCurrency(detailItemsTotal)}</span>
          </div>
          {parseFloat(estimatedBudget || "0") !== detailItemsTotal && (
            <div className="text-xs text-muted-foreground mt-1">
              Syncing budget to {formatCurrency(detailItemsTotal)}...
            </div>
          )}
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[30%]">Item</TableHead>
              <TableHead className="text-xs text-right w-[12%]">Qty</TableHead>
              <TableHead className="text-xs w-[12%]">Unit</TableHead>
              <TableHead className="text-xs text-right w-[15%]">Price</TableHead>
              <TableHead className="text-xs text-right w-[15%]">Total</TableHead>
              <TableHead className="text-xs w-[16%]">Notes</TableHead>
              <TableHead className="text-xs w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detailItemsLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : detailItems.length === 0 && !isCreating ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  No line items yet. Add items below to break down this budget.
                </TableCell>
              </TableRow>
            ) : (
              detailItems.map((item) => (
                <TableRow key={item.id} className="group" data-testid={`detail-item-row-${item.id}`}>
                  {editingId === item.id ? (
                    <>
                      <TableCell className="p-1">
                        <Input
                          value={editValues.item}
                          onChange={(e) => setEditValues({ ...editValues, item: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="h-8 text-xs"
                          autoFocus
                          data-testid={`input-edit-item-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={editValues.quantity}
                          onChange={(e) => setEditValues({ ...editValues, quantity: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="h-8 text-xs text-right"
                          data-testid={`input-edit-qty-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select value={editValues.unit} onValueChange={(v) => setEditValues({ ...editValues, unit: v })}>
                          <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-unit-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editValues.price}
                          onChange={(e) => setEditValues({ ...editValues, price: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="h-8 text-xs text-right"
                          data-testid={`input-edit-price-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1 text-right">
                        <span className="text-xs font-mono">{formatCurrency(editLineTotal)}</span>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={editValues.notes}
                          onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="h-8 text-xs"
                          placeholder="Notes"
                          data-testid={`input-edit-notes-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveEdit(item.id)} data-testid={`btn-save-item-${item.id}`}>
                            <Send className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onMouseDown={(e) => e.preventDefault()} onClick={cancelEdit} data-testid={`btn-cancel-item-${item.id}`}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell
                        className="text-xs cursor-pointer"
                        onClick={() => startEdit(item)}
                        data-testid={`text-item-desc-${item.id}`}
                      >
                        {item.item}
                      </TableCell>
                      <TableCell
                        className="text-xs text-right font-mono cursor-pointer"
                        onClick={() => startEdit(item)}
                      >
                        {parseFloat(item.quantity).toLocaleString()}
                      </TableCell>
                      <TableCell
                        className="text-xs cursor-pointer"
                        onClick={() => startEdit(item)}
                      >
                        {item.unit}
                      </TableCell>
                      <TableCell
                        className="text-xs text-right font-mono cursor-pointer"
                        onClick={() => startEdit(item)}
                      >
                        {formatCurrency(item.price)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {formatCurrency(item.lineTotal)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]" title={item.notes || ""}>
                        {item.notes || "-"}
                      </TableCell>
                      <TableCell className="p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 invisible group-hover:visible"
                          onClick={() => onDeleteItem(item.id)}
                          data-testid={`btn-delete-item-${item.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}

            <TableRow className="bg-muted/30" data-testid="row-new-detail-item">
              <TableCell className="p-1">
                <Input
                  value={newItem.item}
                  onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                  placeholder="Add item..."
                  className="h-8 text-xs"
                  data-testid="input-new-item"
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                  className="h-8 text-xs text-right"
                  data-testid="input-new-qty"
                />
              </TableCell>
              <TableCell className="p-1">
                <Select value={newItem.unit} onValueChange={(v) => setNewItem({ ...newItem, unit: v })}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-new-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                  className="h-8 text-xs text-right"
                  data-testid="input-new-price"
                />
              </TableCell>
              <TableCell className="p-1 text-right">
                <span className="text-xs font-mono text-muted-foreground">{formatCurrency(newLineTotal)}</span>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                  placeholder="Notes"
                  className="h-8 text-xs"
                  data-testid="input-new-notes"
                />
              </TableCell>
              <TableCell className="p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleAddItem}
                  disabled={!newItem.item.trim() || isCreating}
                  data-testid="btn-add-detail-item"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm font-medium">Total</span>
        <span className="text-sm font-mono font-bold" data-testid="text-detail-items-total">
          {formatCurrency(detailItemsTotal)}
        </span>
      </div>
    </div>
  );
}
