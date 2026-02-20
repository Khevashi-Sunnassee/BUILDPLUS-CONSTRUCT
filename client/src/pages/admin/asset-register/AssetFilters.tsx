import { Search, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_FUNDING_METHODS,
} from "@shared/schema";
import type { AssetFiltersProps } from "./types";

export function AssetFilters({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  fundingFilter,
  setFundingFilter,
  bookableFilter,
  setBookableFilter,
  transportFilter,
  setTransportFilter,
  groupByMode,
  setGroupByMode,
  setCollapsedGroups,
  showGraph,
  setShowGraph,
  setChartMonthFilter,
}: AssetFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, tag, manufacturer, model, serial..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {ASSET_CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {ASSET_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={fundingFilter} onValueChange={setFundingFilter}>
        <SelectTrigger className="w-[140px]" data-testid="select-funding-filter">
          <SelectValue placeholder="Funding" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Funding</SelectItem>
          {ASSET_FUNDING_METHODS.map((f) => (
            <SelectItem key={f} value={f} className="capitalize">
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={bookableFilter} onValueChange={setBookableFilter}>
        <SelectTrigger className="w-[140px]" data-testid="select-bookable-filter">
          <SelectValue placeholder="Bookable" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Bookable</SelectItem>
          <SelectItem value="yes">Bookable</SelectItem>
          <SelectItem value="no">Not Bookable</SelectItem>
        </SelectContent>
      </Select>
      <Select value={transportFilter} onValueChange={setTransportFilter}>
        <SelectTrigger className="w-[160px]" data-testid="select-transport-filter">
          <SelectValue placeholder="Transport" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Transport</SelectItem>
          <SelectItem value="yes">Requires Transport</SelectItem>
          <SelectItem value="no">No Transport Needed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={groupByMode} onValueChange={(v) => { setGroupByMode(v as "category" | "month" | "none"); setCollapsedGroups({}); }}>
        <SelectTrigger className="w-[160px]" data-testid="select-group-by">
          <SelectValue placeholder="Group By" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="category">Group by Category</SelectItem>
          <SelectItem value="month">Group by Month</SelectItem>
          <SelectItem value="none">No Grouping</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant={showGraph ? "default" : "outline"}
        onClick={() => { setShowGraph(!showGraph); if (showGraph) setChartMonthFilter(null); }}
        data-testid="button-view-graph"
        className="whitespace-nowrap"
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        {showGraph ? "Hide Graph" : "View Graph"}
      </Button>
    </div>
  );
}
