import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Package, ChevronRight, PenLine } from "lucide-react";
import { PROCUREMENT_ROUTES } from "@shared/api-routes";
import type { Item, ItemCategory } from "@shared/schema";

interface ItemPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (itemId: string) => void;
  items: Item[];
  selectedItemId?: string | null;
  manualEntryId: string;
}

export function ItemPickerDialog({
  open,
  onOpenChange,
  onSelect,
  items,
  selectedItemId,
  manualEntryId,
}: ItemPickerDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: categories = [], isLoading: loadingCategories } = useQuery<ItemCategory[]>({
    queryKey: [PROCUREMENT_ROUTES.ITEM_CATEGORIES_ACTIVE],
    enabled: open,
  });

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedCategory) {
      result = result.filter((item) => item.categoryId === selectedCategory);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          (item.code?.toLowerCase() || "").includes(term) ||
          item.name.toLowerCase().includes(term) ||
          (item.description?.toLowerCase() || "").includes(term)
      );
    }

    return result;
  }, [items, searchTerm, selectedCategory]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, Item[]>();
    const uncategorized: Item[] = [];

    filteredItems.forEach((item) => {
      if (item.categoryId) {
        const catName = categoryMap.get(item.categoryId) || "Other";
        if (!groups.has(catName)) groups.set(catName, []);
        groups.get(catName)!.push(item);
      } else {
        uncategorized.push(item);
      }
    });

    const sorted = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

    if (uncategorized.length > 0) {
      sorted.push(["Uncategorized", uncategorized]);
    }

    return sorted;
  }, [filteredItems, categoryMap]);

  const handleSelect = (itemId: string) => {
    onSelect(itemId);
    onOpenChange(false);
    setSearchTerm("");
    setSelectedCategory(null);
  };

  const handleManualEntry = () => {
    onSelect(manualEntryId);
    onOpenChange(false);
    setSearchTerm("");
    setSelectedCategory(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchTerm("");
      setSelectedCategory(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Select Item</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-item-search"
              autoFocus
            />
          </div>

          {loadingCategories ? (
            <div className="flex flex-wrap gap-1.5" data-testid="skeleton-categories">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
          ) : categories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
              <Button
                type="button"
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                data-testid="badge-category-all"
              >
                All ({items.length})
              </Button>
              {categories.map((cat) => {
                const count = items.filter((i) => i.categoryId === cat.id).length;
                if (count === 0) return null;
                return (
                  <Button
                    key={cat.id}
                    type="button"
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    data-testid={`badge-category-${cat.id}`}
                  >
                    {cat.name} ({count})
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>

        <ScrollArea className="flex-1 min-h-0 px-6 pb-6 pt-3">
          <div className="space-y-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md border border-dashed border-muted-foreground/30 p-3 text-left hover-elevate"
              onClick={handleManualEntry}
              data-testid="button-manual-entry"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <PenLine className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Manual Entry</div>
                <div className="text-xs text-muted-foreground">Enter item details manually</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {items.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground" data-testid="text-no-items">
                No items available. Add items in the Procurement Items settings.
              </div>
            )}

            {groupedItems.length === 0 && items.length > 0 && (searchTerm.trim() || selectedCategory) && (
              <div className="py-8 text-center text-sm text-muted-foreground" data-testid="text-no-results">
                No items match your search
              </div>
            )}

            {groupedItems.map(([categoryName, categoryItems]) => (
              <div key={categoryName} data-testid={`group-${categoryName.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {categoryName}
                  </span>
                  <span className="text-xs text-muted-foreground">({categoryItems.length})</span>
                </div>
                <div className="space-y-1">
                  {categoryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-md p-2.5 text-left hover-elevate ${
                        selectedItemId === item.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : ""
                      }`}
                      onClick={() => handleSelect(item.id)}
                      data-testid={`button-item-${item.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.code && (
                            <span className="text-xs font-mono font-semibold text-muted-foreground shrink-0">
                              {item.code}
                            </span>
                          )}
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.unitOfMeasure && (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.unitOfMeasure}
                          </Badge>
                        )}
                        {item.unitPrice && (
                          <span className="text-xs font-mono text-muted-foreground">
                            ${parseFloat(item.unitPrice).toFixed(2)}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
