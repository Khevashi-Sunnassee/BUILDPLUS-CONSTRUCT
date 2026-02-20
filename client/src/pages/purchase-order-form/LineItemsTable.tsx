import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Building2, X } from "lucide-react";
import type { Item } from "@shared/schema";
import type { LineItem } from "./types";
import { formatCurrency, MANUAL_ENTRY_ID } from "./types";

export interface LineItemsTableProps {
  lineItems: LineItem[];
  canEdit: boolean;
  receivingMode: boolean;
  receivedItemIds: Set<string>;
  toggleReceiveItem: (itemId: string) => void;
  addLineItem: () => void;
  removeLineItem: (id: string) => void;
  updateLineItem: (id: string, field: keyof LineItem, value: string | null) => void;
  openItemPicker: (lineId: string) => void;
  openJobSelector: (lineId: string) => void;
  clearJobFromLine: (lineId: string) => void;
  items: Item[];
  costCodes: { id: string; code: string; name: string; isActive: boolean }[];
  costCodeMap: Map<string, { code: string; name: string }>;
  subtotal: number;
  tax: number;
  total: number;
}

export function LineItemsTable({
  lineItems,
  canEdit,
  receivingMode,
  receivedItemIds,
  toggleReceiveItem,
  addLineItem,
  removeLineItem,
  updateLineItem,
  openItemPicker,
  openJobSelector,
  clearJobFromLine,
  items,
  costCodes,
  costCodeMap,
  subtotal,
  tax,
  total,
}: LineItemsTableProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Line Items</h3>
        {canEdit && (
          <Button onClick={addLineItem} size="sm" data-testid="button-add-line">
            <Plus className="h-4 w-4 mr-1" />
            Add Line
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table className="w-full min-w-[800px]" data-testid="table-line-items">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {receivingMode && <TableHead className="w-[50px]">Received</TableHead>}
              <TableHead>Item</TableHead>
              <TableHead className="w-[100px]">Job</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[140px]">Cost Code</TableHead>
              <TableHead className="w-[70px] text-right">Qty</TableHead>
              <TableHead className="w-[70px]">Unit</TableHead>
              <TableHead className="w-[100px] text-right">Unit Price</TableHead>
              <TableHead className="w-[100px] text-right">Line Total</TableHead>
              {canEdit && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={(canEdit ? 9 : 8) + (receivingMode ? 1 : 0)} 
                  className="text-center py-8 text-muted-foreground"
                  data-testid="text-no-items"
                >
                  No line items. {canEdit && "Click \"Add Line\" to add items."}
                </TableCell>
              </TableRow>
            ) : (
              lineItems.map((line, index) => (
                <TableRow key={line.id} data-testid={`row-line-item-${index}`}>
                  {receivingMode && (
                    <TableCell className="p-1 text-center">
                      <Checkbox
                        checked={receivedItemIds.has(line.id)}
                        onCheckedChange={() => toggleReceiveItem(line.id)}
                        data-testid={`checkbox-receive-${index}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="p-1">
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-9 w-full justify-start text-left font-normal whitespace-normal break-words"
                        onClick={() => openItemPicker(line.id)}
                        data-testid={`select-item-${index}`}
                      >
                        {line.itemId && line.itemId !== MANUAL_ENTRY_ID ? (
                          <span className="break-words">
                            {line.itemCode ? `${line.itemCode} - ` : ""}
                            {items.find(i => i.id === line.itemId)?.name || line.description || "Selected"}
                          </span>
                        ) : line.itemId === MANUAL_ENTRY_ID ? (
                          <span className="text-muted-foreground">Manual Entry</span>
                        ) : (
                          <span className="text-muted-foreground">Select item...</span>
                        )}
                      </Button>
                    ) : (
                      <span className="text-sm break-words">{line.itemCode || "-"}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        {line.jobId ? (
                          <>
                            <Badge 
                              variant="secondary" 
                              className="font-mono cursor-pointer"
                              onClick={() => openJobSelector(line.id)}
                            >
                              {line.jobNumber}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => clearJobFromLine(line.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => openJobSelector(line.id)}
                            data-testid={`button-select-job-${index}`}
                          >
                            <Building2 className="h-3 w-3 mr-1" />
                            Select
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-mono">{line.jobNumber || "-"}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    {canEdit ? (
                      <Input
                        value={line.description}
                        onChange={(e) => updateLineItem(line.id, "description", e.target.value)}
                        placeholder="Description"
                        className="h-9"
                        data-testid={`input-description-${index}`}
                      />
                    ) : (
                      <span className="text-sm break-words">{line.description}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    {canEdit ? (
                      <Select
                        value={line.costCodeId || "_none"}
                        onValueChange={(val) => updateLineItem(line.id, "costCodeId", val === "_none" ? null : val)}
                      >
                        <SelectTrigger className="h-9" data-testid={`select-cost-code-${index}`}>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {costCodes.filter(cc => cc.isActive).map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.code} - {cc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">
                        {line.costCodeId ? (() => {
                          const cc = costCodeMap.get(line.costCodeId);
                          return cc ? `${cc.code} - ${cc.name}` : "-";
                        })() : "-"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    {canEdit ? (
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLineItem(line.id, "quantity", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="h-9 text-right"
                        min="0"
                        step="any"
                        data-testid={`input-qty-${index}`}
                      />
                    ) : (
                      <span className="text-sm text-right block">{line.quantity}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    {canEdit ? (
                      <Input
                        value={line.unitOfMeasure}
                        onChange={(e) => updateLineItem(line.id, "unitOfMeasure", e.target.value)}
                        className="h-9"
                        data-testid={`input-unit-${index}`}
                      />
                    ) : (
                      <span className="text-sm">{line.unitOfMeasure}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    {canEdit ? (
                      <Input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) => updateLineItem(line.id, "unitPrice", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="h-9 text-right"
                        min="0"
                        step="0.01"
                        data-testid={`input-price-${index}`}
                      />
                    ) : (
                      <span className="text-sm text-right block">
                        {formatCurrency(parseFloat(line.unitPrice) || 0)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="p-1 text-right font-medium" data-testid={`text-line-total-${index}`}>
                    {formatCurrency(parseFloat(line.lineTotal) || 0)}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(line.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        data-testid={`button-delete-line-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end mt-4">
        <div className="w-[300px] space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>GST (10%):</span>
            <span data-testid="text-tax">{formatCurrency(tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-semibold">
            <span>Total:</span>
            <span data-testid="text-total">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
