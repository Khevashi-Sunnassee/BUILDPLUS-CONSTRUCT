import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { JOBS_ROUTES, PROCUREMENT_ROUTES } from "@shared/api-routes";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  Target,
  Clock,
  Search,
  Filter,
  MapPin,
  Building2,
  Calendar,
  BarChart3,
  ChevronRight,
  ArrowUpDown,
  Users,
  Percent,
} from "lucide-react";

interface Opportunity {
  id: string;
  jobNumber: string;
  name: string;
  client: string | null;
  customerId: string | null;
  customerName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  referrer: string | null;
  engineerOnJob: string | null;
  estimatedValue: string | null;
  numberOfBuildings: number | null;
  numberOfLevels: number | null;
  opportunityStatus: string | null;
  probability: number | null;
  estimatedStartDate: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

const JOB_STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "OPPORTUNITY", label: "Opportunity" },
  { value: "QUOTING", label: "Quoting" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "CONTRACTED", label: "Contracted" },
  { value: "IN_PROGRESS", label: "In Progress" },
];

const OPPORTUNITY_STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "NEGOTIATING", label: "Negotiating" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "ON_HOLD", label: "On Hold" },
];

function getStatusColor(status: string) {
  switch (status) {
    case "OPPORTUNITY": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "QUOTING": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "WON": return "bg-green-500/10 text-green-500 border-green-500/20";
    case "LOST": return "bg-red-500/10 text-red-500 border-red-500/20";
    case "CANCELLED": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    case "CONTRACTED": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case "IN_PROGRESS": return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
    default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}

function getOppStatusColor(status: string) {
  switch (status) {
    case "NEW": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "CONTACTED": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "PROPOSAL_SENT": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "NEGOTIATING": return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "WON": return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "LOST": return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "ON_HOLD": return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
    default: return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
  }
}

function formatCurrency(value: string | null) {
  if (!value) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SalesPipelinePage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [oppStatusFilter, setOppStatusFilter] = useState("ALL");
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  const { data: opportunities = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: [JOBS_ROUTES.OPPORTUNITIES],
  });

  const updateOpportunity = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", JOBS_ROUTES.OPPORTUNITY_BY_ID(id), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JOBS_ROUTES.OPPORTUNITIES] });
      toast({ title: "Opportunity updated" });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const filtered = opportunities.filter((opp) => {
    const matchSearch =
      !searchTerm ||
      opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opp.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opp.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opp.jobNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "ALL" || opp.status === statusFilter;
    const matchOppStatus =
      oppStatusFilter === "ALL" || opp.opportunityStatus === oppStatusFilter;
    return matchSearch && matchStatus && matchOppStatus;
  });

  const totalValue = opportunities.reduce(
    (sum, o) => sum + (o.estimatedValue ? parseFloat(o.estimatedValue) : 0),
    0
  );
  const weightedValue = opportunities.reduce(
    (sum, o) =>
      sum +
      (o.estimatedValue ? parseFloat(o.estimatedValue) : 0) *
        ((o.probability || 0) / 100),
    0
  );
  const activeCount = opportunities.filter(
    (o) => !["LOST", "CANCELLED"].includes(o.status)
  ).length;
  const avgProbability =
    opportunities.length > 0
      ? Math.round(
          opportunities.reduce((sum, o) => sum + (o.probability || 0), 0) /
            opportunities.length
        )
      : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="page-sales-pipeline">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Sales Pipeline</h1>
        <p className="text-muted-foreground mt-1">Manage pre-sales opportunities and track conversions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card data-testid="card-total-pipeline">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-pipeline">
              {formatCurrency(totalValue.toString())}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{opportunities.length} opportunities</p>
          </CardContent>
        </Card>
        <Card data-testid="card-weighted-value">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weighted Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-weighted-value">
              {formatCurrency(weightedValue.toString())}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Adjusted by probability</p>
          </CardContent>
        </Card>
        <Card data-testid="card-active-opps">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-count">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Excluding lost & cancelled</p>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-probability">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Probability</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-probability">{avgProbability}%</div>
            <p className="text-xs text-muted-foreground mt-1">Across all opportunities</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, customer, city..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-pipeline"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JOB_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={oppStatusFilter} onValueChange={setOppStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-opp-status-filter">
            <BarChart3 className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPPORTUNITY_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-pulse text-muted-foreground">Loading opportunities...</div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="font-semibold text-lg">No opportunities found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {searchTerm || statusFilter !== "ALL" || oppStatusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Opportunities created from mobile will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Project</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Customer</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Location</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Job Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Opp Status</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Est. Value</th>
                  <th className="text-center p-3 text-sm font-medium text-muted-foreground">Prob.</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Start Date</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Created</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((opp) => (
                  <tr
                    key={opp.id}
                    className="border-b last:border-b-0 hover-elevate cursor-pointer"
                    onClick={() => setSelectedOpp(opp)}
                    data-testid={`row-opportunity-${opp.id}`}
                  >
                    <td className="p-3">
                      <div className="font-medium">{opp.name}</div>
                      <div className="text-xs text-muted-foreground">{opp.jobNumber}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">{opp.customerName || opp.client || "-"}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        {opp.city || "-"}{opp.state ? `, ${opp.state}` : ""}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${getStatusColor(opp.status)}`}>
                        {formatStatusLabel(opp.status)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {opp.opportunityStatus ? (
                        <Badge variant="secondary" className={`text-xs ${getOppStatusColor(opp.opportunityStatus)}`}>
                          {formatStatusLabel(opp.opportunityStatus)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-medium text-sm">{formatCurrency(opp.estimatedValue)}</span>
                    </td>
                    <td className="p-3 text-center">
                      {opp.probability != null ? (
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${opp.probability}%`,
                                background:
                                  opp.probability >= 70
                                    ? "#22c55e"
                                    : opp.probability >= 40
                                    ? "#eab308"
                                    : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">{opp.probability}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>
                    <td className="p-3 text-sm">{formatDate(opp.estimatedStartDate)}</td>
                    <td className="p-3 text-sm text-muted-foreground">{formatDate(opp.createdAt)}</td>
                    <td className="p-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedOpp} onOpenChange={(open) => !open && setSelectedOpp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedOpp?.name}</DialogTitle>
          </DialogHeader>
          {selectedOpp && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={getStatusColor(selectedOpp.status)}>
                  {formatStatusLabel(selectedOpp.status)}
                </Badge>
                {selectedOpp.opportunityStatus && (
                  <Badge variant="secondary" className={getOppStatusColor(selectedOpp.opportunityStatus)}>
                    {formatStatusLabel(selectedOpp.opportunityStatus)}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{selectedOpp.jobNumber}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Customer</div>
                  <div className="text-sm font-medium">{selectedOpp.customerName || selectedOpp.client || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Location</div>
                  <div className="text-sm font-medium">
                    {selectedOpp.city || "-"}{selectedOpp.state ? `, ${selectedOpp.state}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Address</div>
                  <div className="text-sm">{selectedOpp.address || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Estimated Value</div>
                  <div className="text-sm font-medium">{formatCurrency(selectedOpp.estimatedValue)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Probability</div>
                  <div className="text-sm font-medium">{selectedOpp.probability != null ? `${selectedOpp.probability}%` : "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Est. Start Date</div>
                  <div className="text-sm">{formatDate(selectedOpp.estimatedStartDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Referrer</div>
                  <div className="text-sm">{selectedOpp.referrer || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Engineer</div>
                  <div className="text-sm">{selectedOpp.engineerOnJob || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Buildings</div>
                  <div className="text-sm">{selectedOpp.numberOfBuildings ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Levels</div>
                  <div className="text-sm">{selectedOpp.numberOfLevels ?? "-"}</div>
                </div>
              </div>

              {selectedOpp.comments && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Comments</div>
                  <div className="text-sm bg-muted/50 rounded-md p-3">{selectedOpp.comments}</div>
                </div>
              )}

              {/* Status Change */}
              <div className="border-t pt-4">
                <div className="text-xs text-muted-foreground mb-2">Update Job Status</div>
                <div className="flex flex-wrap gap-2">
                  {["OPPORTUNITY", "QUOTING", "WON", "LOST", "CANCELLED", "CONTRACTED", "IN_PROGRESS"].map((s) => (
                    <Button
                      key={s}
                      variant={selectedOpp.status === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        updateOpportunity.mutate({ id: selectedOpp.id, data: { status: s } });
                        setSelectedOpp({ ...selectedOpp, status: s });
                      }}
                      disabled={updateOpportunity.isPending}
                      data-testid={`button-status-${s.toLowerCase()}`}
                    >
                      {formatStatusLabel(s)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2">Update Opportunity Status</div>
                <div className="flex flex-wrap gap-2">
                  {["NEW", "CONTACTED", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST", "ON_HOLD"].map((s) => (
                    <Button
                      key={s}
                      variant={selectedOpp.opportunityStatus === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        updateOpportunity.mutate({ id: selectedOpp.id, data: { opportunityStatus: s } });
                        setSelectedOpp({ ...selectedOpp, opportunityStatus: s });
                      }}
                      disabled={updateOpportunity.isPending}
                      data-testid={`button-opp-status-${s.toLowerCase()}`}
                    >
                      {formatStatusLabel(s)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
