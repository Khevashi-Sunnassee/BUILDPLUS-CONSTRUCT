import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AssetChartProps } from "./types";
import { formatCurrency } from "./types";

export function AssetChart({ chartData, chartMonthFilter, setChartMonthFilter }: AssetChartProps) {
  return (
    <div className="space-y-4">
      {chartMonthFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Filtered: {chartMonthFilter}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setChartMonthFilter(null)} data-testid="button-clear-chart-filter">
            Clear filter
          </Button>
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Spend per Month</CardTitle>
          <span className="text-xs text-muted-foreground">Click a bar to filter assets below</span>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No purchase date data available to display
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: "13px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Total Spend"]}
                    labelFormatter={(label) => label}
                    cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.5 }}
                  />
                  <Bar
                    dataKey="total"
                    name="total"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    cursor="pointer"
                    onClick={(data: { month: string }) => {
                      if (chartMonthFilter === data.month) {
                        setChartMonthFilter(null);
                      } else {
                        setChartMonthFilter(data.month);
                      }
                    }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-spend-${index}`}
                        fill={chartMonthFilter === entry.month ? "hsl(215, 80%, 45%)" : "hsl(215, 70%, 55%)"}
                        stroke={chartMonthFilter === entry.month ? "hsl(215, 90%, 35%)" : "none"}
                        strokeWidth={chartMonthFilter === entry.month ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Asset Value Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: "13px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Cumulative Value"]}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="cumulativeValue" name="cumulativeValue" radius={[4, 4, 0, 0]} maxBarSize={40} fill="hsl(215, 70%, 55%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
