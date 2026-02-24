import { Pencil, Wrench, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServiceCallsTabProps } from "./types";
import { formatCurrency } from "./types";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function ServiceCallsTab({
  serviceStatusFilter,
  setServiceStatusFilter,
  filteredRepairRequests,
  repairStatusCounts,
  repairsLoading,
  serviceStatusMutation,
  navigate,
}: ServiceCallsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={serviceStatusFilter} onValueChange={setServiceStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-service-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({repairStatusCounts.all || 0})</SelectItem>
            <SelectItem value="open">Open ({repairStatusCounts.open || 0})</SelectItem>
            <SelectItem value="in_progress">In Progress ({repairStatusCounts.in_progress || 0})</SelectItem>
            <SelectItem value="resolved">Resolved ({repairStatusCounts.resolved || 0})</SelectItem>
            <SelectItem value="closed">Closed ({repairStatusCounts.closed || 0})</SelectItem>
            <SelectItem value="cancelled">Cancelled ({repairStatusCounts.cancelled || 0})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Work Orders / Service Requests</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/work-orders")}
            data-testid="button-view-all-work-orders"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View All Work Orders
          </Button>
        </CardHeader>
        <CardContent>
          {repairsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filteredRepairRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Wrench className="h-12 w-12 mb-2" />
              <p>No service requests found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO #</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Requested Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Est. Cost</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepairRequests.map((r: any) => (
                  <TableRow key={r.id} data-testid={`row-service-${r.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-service-number-${r.id}`}>
                      {r.workOrderNumber || r.repairNumber || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-service-asset-${r.id}`}>
                      <div>
                        <span className="font-medium">{r.asset?.name || r.assetName || "-"}</span>
                        {(r.asset?.assetTag || r.assetTag) && (
                          <span className="text-xs text-muted-foreground ml-1">({r.asset?.assetTag || r.assetTag})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-service-title-${r.id}`}>{r.title || r.fieldName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {(r.workOrderType || "general").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.priority === "critical" ? "border-red-500 text-red-700 dark:text-red-400" :
                          r.priority === "high" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                          r.priority === "medium" ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" :
                          "border-muted-foreground"
                        }
                        data-testid={`badge-service-priority-${r.id}`}
                      >
                        {PRIORITY_LABELS[r.priority] || r.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "resolved" || r.status === "closed" ? "default" : r.status === "cancelled" ? "secondary" : "outline"}
                        className={
                          r.status === "in_progress" ? "border-blue-500 text-blue-700 dark:text-blue-400" :
                          r.status === "open" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                          ""
                        }
                        data-testid={`badge-service-status-${r.id}`}
                      >
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.requestedBy?.name || r.requestedByName || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.requestedDate ? new Date(r.requestedDate).toLocaleDateString() : r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.vendor?.name || r.supplierName || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.estimatedCost
                        ? formatCurrency(r.estimatedCost)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {r.status === "open" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "in_progress" })}
                            disabled={serviceStatusMutation.isPending}
                            data-testid={`button-start-service-${r.id}`}
                          >
                            Start
                          </Button>
                        )}
                        {(r.status === "open" || r.status === "in_progress") && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "resolved" })}
                            disabled={serviceStatusMutation.isPending}
                            data-testid={`button-complete-service-${r.id}`}
                          >
                            Resolve
                          </Button>
                        )}
                        {r.status !== "resolved" && r.status !== "closed" && r.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "cancelled" })}
                            disabled={serviceStatusMutation.isPending}
                            data-testid={`button-cancel-service-${r.id}`}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/work-orders?selected=${r.id}`)}
                          data-testid={`button-view-wo-${r.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
