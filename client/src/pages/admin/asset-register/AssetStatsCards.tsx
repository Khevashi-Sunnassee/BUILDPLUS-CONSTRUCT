import { Package, DollarSign, Activity, Truck, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AssetStatsCardsProps } from "./types";
import { formatCurrency } from "./types";

export function AssetStatsCards({ stats }: AssetStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Total Assets</span>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold mt-1" data-testid="stat-total-assets">
            {stats.total}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Total Purchase Price</span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold mt-1" data-testid="stat-total-purchase-price">
            {formatCurrency(stats.totalPurchasePrice)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Current Value</span>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold mt-1" data-testid="stat-total-current-value">
            {formatCurrency(stats.totalCurrentValue)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Active Assets</span>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold mt-1" data-testid="stat-active-assets">
            {stats.active}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Leased</span>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold mt-1" data-testid="stat-leased-assets">
            {stats.leased}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
