import { Pencil, Wrench } from "lucide-react";
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
            <SelectItem value="DRAFT">Draft ({repairStatusCounts.DRAFT || 0})</SelectItem>
            <SelectItem value="SUBMITTED">Submitted ({repairStatusCounts.SUBMITTED || 0})</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress ({repairStatusCounts.IN_PROGRESS || 0})</SelectItem>
            <SelectItem value="COMPLETED">Completed ({repairStatusCounts.COMPLETED || 0})</SelectItem>
            <SelectItem value="CANCELLED">Cancelled ({repairStatusCounts.CANCELLED || 0})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Service / Repair Requests</CardTitle>
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
              <p>No service calls found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repair #</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Title</TableHead>
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
                      {r.repairNumber}
                    </TableCell>
                    <TableCell data-testid={`text-service-asset-${r.id}`}>
                      <div>
                        <span className="font-medium">{r.asset?.name || "-"}</span>
                        {r.asset?.assetTag && (
                          <span className="text-xs text-muted-foreground ml-1">({r.asset.assetTag})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-service-title-${r.id}`}>{r.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.priority === "URGENT" ? "border-red-500 text-red-700 dark:text-red-400" :
                          r.priority === "HIGH" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                          r.priority === "MEDIUM" ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" :
                          "border-muted-foreground"
                        }
                        data-testid={`badge-service-priority-${r.id}`}
                      >
                        {r.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "COMPLETED" ? "default" : r.status === "CANCELLED" ? "secondary" : "outline"}
                        className={
                          r.status === "IN_PROGRESS" ? "border-blue-500 text-blue-700 dark:text-blue-400" :
                          r.status === "SUBMITTED" ? "border-orange-500 text-orange-700 dark:text-orange-400" :
                          ""
                        }
                        data-testid={`badge-service-status-${r.id}`}
                      >
                        {r.status === "IN_PROGRESS" ? "In Progress" : r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.requestedBy?.name || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.requestedDate ? new Date(r.requestedDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.vendor?.name || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.estimatedCost
                        ? formatCurrency(r.estimatedCost)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {r.status === "DRAFT" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "SUBMITTED" })}
                            disabled={serviceStatusMutation.isPending}
                            data-testid={`button-submit-service-${r.id}`}
                          >
                            Submit
                          </Button>
                        )}
                        {r.status === "SUBMITTED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "IN_PROGRESS" })}
                            disabled={serviceStatusMutation.isPending}
                            data-testid={`button-start-service-${r.id}`}
                          >
                            Start
                          </Button>
                        )}
                        {(r.status === "SUBMITTED" || r.status === "IN_PROGRESS") && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "COMPLETED" })}
                            disabled={serviceStatusMutation.isPending}
                            data-testid={`button-complete-service-${r.id}`}
                          >
                            Close
                          </Button>
                        )}
                        {r.status !== "COMPLETED" && r.status !== "CANCELLED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => serviceStatusMutation.mutate({ id: r.id, status: "CANCELLED" })}
                            disabled={serviceStatusMutation.isPending}
                            data-testid={`button-cancel-service-${r.id}`}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/asset-repair/new?assetId=${r.assetId}&editId=${r.id}`)}
                          data-testid={`button-edit-service-${r.id}`}
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
