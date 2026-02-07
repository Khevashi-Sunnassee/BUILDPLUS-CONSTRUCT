import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CONTRACT_ROUTES } from "@shared/api-routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Shield,
  Scale,
  Building2,
  Filter,
} from "lucide-react";

interface ContractHubItem {
  jobId: string;
  jobNumber: string;
  jobName: string;
  jobStatus: string;
  client: string | null;
  contractId: string | null;
  contractStatus: string;
  contractNumber: string | null;
  originalContractValue: string | null;
  revisedContractValue: string | null;
  contractType: string | null;
  riskRating: number | null;
  contractUpdatedAt: string | null;
  panelCount: number;
  maxLifecycleStatus: number;
  workStatus: string;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof Clock }> = {
  AWAITING_CONTRACT: { label: "Awaiting Contract", variant: "outline", icon: Clock },
  CONTRACT_REVIEW: { label: "Contract Review", variant: "secondary", icon: FileText },
  CONTRACT_EXECUTED: { label: "Contract Executed", variant: "default", icon: CheckCircle },
};

function formatCurrency(value: string | null): string {
  if (!value) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function getRiskColor(rating: number | null): string {
  if (!rating) return "text-muted-foreground";
  if (rating <= 3) return "text-green-600 dark:text-green-400";
  if (rating <= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getRiskBadgeVariant(rating: number | null): "default" | "secondary" | "outline" | "destructive" {
  if (!rating) return "outline";
  if (rating <= 3) return "default";
  if (rating <= 6) return "secondary";
  return "destructive";
}

export default function ContractHubPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workStatusFilter, setWorkStatusFilter] = useState<string>("all");

  const { data: hubItems = [], isLoading } = useQuery<ContractHubItem[]>({
    queryKey: [CONTRACT_ROUTES.HUB],
  });

  const filteredItems = hubItems.filter(item => {
    const matchesSearch = !searchQuery || 
      item.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.client?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || item.contractStatus === statusFilter;
    const matchesWorkStatus = workStatusFilter === "all" || item.workStatus === workStatusFilter;

    return matchesSearch && matchesStatus && matchesWorkStatus;
  });

  const stats = {
    total: hubItems.length,
    awaiting: hubItems.filter(i => i.contractStatus === "AWAITING_CONTRACT").length,
    review: hubItems.filter(i => i.contractStatus === "CONTRACT_REVIEW").length,
    executed: hubItems.filter(i => i.contractStatus === "CONTRACT_EXECUTED").length,
    atRisk: hubItems.filter(i => i.riskRating && i.riskRating >= 7).length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="contract-hub-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Contract Hub</h1>
          <p className="text-muted-foreground">Manage contracts and legal documentation for all projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Legal Adviser</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="stat-total-jobs">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-awaiting">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/10">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.awaiting}</p>
                <p className="text-xs text-muted-foreground">Awaiting Contract</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-review">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.review}</p>
                <p className="text-xs text-muted-foreground">Under Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-executed">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.executed}</p>
                <p className="text-xs text-muted-foreground">Executed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-at-risk">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.atRisk}</p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-contracts"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-contract-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Contract Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="AWAITING_CONTRACT">Awaiting Contract</SelectItem>
            <SelectItem value="CONTRACT_REVIEW">Contract Review</SelectItem>
            <SelectItem value="CONTRACT_EXECUTED">Contract Executed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={workStatusFilter} onValueChange={setWorkStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-work-status-filter">
            <SelectValue placeholder="Work Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Work Status</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Not Started">Not Started</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No jobs found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map(item => {
            const statusConfig = CONTRACT_STATUS_CONFIG[item.contractStatus] || CONTRACT_STATUS_CONFIG.AWAITING_CONTRACT;
            const StatusIcon = statusConfig.icon;

            return (
              <Card
                key={item.jobId}
                className="hover-elevate cursor-pointer transition-colors"
                onClick={() => navigate(`/contracts/${item.jobId}`)}
                data-testid={`card-contract-job-${item.jobId}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold" data-testid={`text-job-number-${item.jobId}`}>{item.jobNumber}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="font-medium truncate" data-testid={`text-job-name-${item.jobId}`}>{item.jobName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                          {item.client && <span>{item.client}</span>}
                          {item.contractNumber && (
                            <>
                              <span className="hidden sm:inline">|</span>
                              <span>Contract: {item.contractNumber}</span>
                            </>
                          )}
                          <span className="hidden sm:inline">|</span>
                          <span>{item.panelCount} panels</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
                      {item.originalContractValue && (
                        <div className="text-right hidden lg:block">
                          <p className="text-sm font-medium">{formatCurrency(item.revisedContractValue || item.originalContractValue)}</p>
                          <p className="text-xs text-muted-foreground">Contract Value</p>
                        </div>
                      )}

                      {item.riskRating && (
                        <Badge variant={getRiskBadgeVariant(item.riskRating)} data-testid={`badge-risk-${item.jobId}`}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Risk: {item.riskRating}/10
                        </Badge>
                      )}

                      <Badge
                        variant={item.workStatus === "In Progress" ? "default" : "outline"}
                        data-testid={`badge-work-status-${item.jobId}`}
                      >
                        {item.workStatus}
                      </Badge>

                      <Badge variant={statusConfig.variant} data-testid={`badge-contract-status-${item.jobId}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>

                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
