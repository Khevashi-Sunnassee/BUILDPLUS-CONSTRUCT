import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useCallback, useState } from "react";

interface SortableTableHeaderProps {
  column: string;
  label: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
  "data-testid"?: string;
}

export function SortableTableHeader({
  column,
  label,
  sortBy,
  sortOrder,
  onSort,
  "data-testid": testId,
}: SortableTableHeaderProps) {
  const isActive = sortBy === column;

  return (
    <button
      type="button"
      className="flex items-center hover-elevate active-elevate-2 rounded-md px-1 -mx-1"
      onClick={() => onSort(column)}
      data-testid={testId}
    >
      {label}
      {isActive ? (
        sortOrder === "asc" ? (
          <ArrowUp className="h-3 w-3 ml-1" />
        ) : (
          <ArrowDown className="h-3 w-3 ml-1" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />
      )}
    </button>
  );
}

export function useTableSort(defaultSort: string = "", defaultOrder: "asc" | "desc" = "asc") {
  const [sortBy, setSortBy] = useState(defaultSort);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(defaultOrder);

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  }, [sortBy]);

  return { sortBy, sortOrder, handleSort };
}
