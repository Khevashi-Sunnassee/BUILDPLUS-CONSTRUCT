import { useState } from "react";
import {
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Wrench,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Asset } from "@shared/schema";
import type { AssetTableProps, SortField, SortDir } from "./types";
import { formatCurrency, formatDate, daysSinceDate, calculateBookValue, GROUP_COLORS } from "./types";

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">-</span>;
  const variant =
    status === "active"
      ? "default"
      : status === "awaiting_service" || status === "in_service"
        ? "outline"
        : status === "disposed" || status === "sold"
          ? "secondary"
          : "destructive";
  const label = status === "awaiting_service" ? "Awaiting Service"
    : status === "in_service" ? "In Service"
    : status;
  return (
    <Badge variant={variant} className={`capitalize ${status === "awaiting_service" ? "border-orange-500 text-orange-700 dark:text-orange-400" : status === "in_service" ? "border-blue-500 text-blue-700 dark:text-blue-400" : ""}`} data-testid="badge-status">
      {label}
    </Badge>
  );
}

function SortableHeader({ label, field, currentSort, currentDir, onSort }: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = currentSort === field;
  return (
    <button
      type="button"
      className="flex items-center gap-1 cursor-pointer text-left whitespace-nowrap"
      onClick={() => onSort(field)}
      data-testid={`button-sort-${field}`}
    >
      {label}
      {active ? (
        currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export function AssetTable({
  groupByMode,
  groupedAssets,
  filteredAndSortedAssets,
  assets,
  collapsedGroups,
  toggleGroup,
  sortField,
  sortDir,
  handleSort,
  openEditDialog,
  setDeletingAssetId,
  setDeleteDialogOpen,
  navigate,
  serviceChecklistAssetId,
  setServiceChecklistAssetId,
  serviceChecklistMutation,
}: AssetTableProps) {
  const renderAssetRow = (asset: Asset) => (
    <TableRow
      key={asset.id}
      className="cursor-pointer hover-elevate"
      onClick={() => openEditDialog(asset)}
      data-testid={`row-asset-${asset.id}`}
    >
      <TableCell className="text-sm" data-testid={`text-asset-category-${asset.id}`}>
        {asset.category || "-"}
      </TableCell>
      <TableCell className="font-mono text-xs" data-testid={`text-asset-tag-${asset.id}`}>
        {asset.assetTag}
      </TableCell>
      <TableCell className="font-medium max-w-[240px] truncate" data-testid={`text-asset-name-${asset.id}`}>
        {asset.name}
      </TableCell>
      <TableCell>
        <StatusBadge status={asset.status} />
      </TableCell>
      <TableCell className="text-sm" data-testid={`text-asset-purchase-date-${asset.id}`}>
        {formatDate(asset.purchaseDate)}
      </TableCell>
      <TableCell className="text-sm text-center" data-testid={`text-asset-useful-life-${asset.id}`}>
        {asset.usefulLifeYears ? `${asset.usefulLifeYears}y` : "-"}
      </TableCell>
      <TableCell className="text-sm text-center" data-testid={`text-asset-days-since-${asset.id}`}>
        {daysSinceDate(asset.purchaseDate)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm" data-testid={`text-asset-purchase-price-${asset.id}`}>
        {formatCurrency(asset.purchasePrice)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm" data-testid={`text-asset-current-value-${asset.id}`}>
        {formatCurrency(asset.currentValue)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm" data-testid={`text-asset-book-value-${asset.id}`}>
        {(() => {
          const bv = calculateBookValue(asset);
          return bv !== null ? formatCurrency(bv) : "-";
        })()}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditDialog(asset);
                }}
                data-testid={`button-edit-asset-${asset.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit asset</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  const params = new URLSearchParams({
                    create: "replacement",
                    assetId: asset.id,
                    assetName: asset.name || "",
                    assetTag: asset.assetTag || "",
                    assetCategory: asset.category || "",
                    assetCurrentValue: asset.currentValue || "",
                    assetLocation: asset.location || "",
                  });
                  navigate(`/capex-requests?${params.toString()}`);
                }}
                data-testid={`button-replace-asset-${asset.id}`}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create CAPEX replacement request</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setServiceChecklistAssetId(asset.id);
                  serviceChecklistMutation.mutate(asset);
                }}
                disabled={serviceChecklistMutation.isPending && serviceChecklistAssetId === asset.id}
                data-testid={`button-repair-asset-${asset.id}`}
              >
                {serviceChecklistMutation.isPending && serviceChecklistAssetId === asset.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wrench className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open service/repair checklist</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingAssetId(asset.id);
                  setDeleteDialogOpen(true);
                }}
                data-testid={`button-delete-asset-${asset.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete asset</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );

  const tableHeaders = (
    <TableRow>
      <TableHead>Category</TableHead>
      <TableHead className="w-[90px]">Tag</TableHead>
      <TableHead>
        <SortableHeader label="Name" field="name" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
      </TableHead>
      <TableHead>Status</TableHead>
      <TableHead>
        <SortableHeader label="Purchase Date" field="purchaseDate" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
      </TableHead>
      <TableHead className="text-center">Useful Life</TableHead>
      <TableHead className="text-center">
        <SortableHeader label="Days Since" field="daysSincePurchase" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
      </TableHead>
      <TableHead className="text-right">
        <SortableHeader label="Purchase Price" field="purchasePrice" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
      </TableHead>
      <TableHead className="text-right">Current Value</TableHead>
      <TableHead className="text-right">Book Value</TableHead>
      <TableHead className="text-right w-[160px]">Actions</TableHead>
    </TableRow>
  );

  if (groupByMode !== "none" && groupedAssets) {
    return (
      <div className="space-y-3">
        {groupedAssets.map(([category, categoryAssets], groupIndex) => {
          const colorSet = GROUP_COLORS[groupIndex % GROUP_COLORS.length];
          const isCollapsed = !!collapsedGroups[category];
          return (
            <div key={category} className={`border-l-4 ${colorSet.border} rounded-none overflow-hidden`}>
              <div
                className={`flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer select-none ${colorSet.bg}`}
                onClick={() => toggleGroup(category)}
                data-testid={`button-toggle-group-${category}`}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className={`h-4 w-4 ${colorSet.text}`} />
                  ) : (
                    <ChevronDown className={`h-4 w-4 ${colorSet.text}`} />
                  )}
                  <span className={`text-sm font-semibold ${colorSet.text}`}>{category}</span>
                  <Badge variant="secondary">{categoryAssets.length}</Badge>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatCurrency(categoryAssets.reduce((sum, a) => sum + (a.purchasePrice ? parseFloat(String(a.purchasePrice)) : 0), 0))}
                </span>
              </div>
              {!isCollapsed && (
                <Card className="rounded-none border-0 border-t">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>{tableHeaders}</TableHeader>
                      <TableBody>
                        {categoryAssets.map(renderAssetRow)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>{tableHeaders}</TableHeader>
          <TableBody>
            {filteredAndSortedAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  {assets && assets.length > 0
                    ? "No assets match the current filters"
                    : "No assets found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedAssets.map(renderAssetRow)
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
