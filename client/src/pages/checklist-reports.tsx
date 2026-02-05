import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Calendar,
  Filter,
  Download,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CHECKLIST_ROUTES } from "@shared/api-routes";

interface ReportSummary {
  total: number;
  byStatus: {
    draft: number;
    in_progress: number;
    completed: number;
    signed_off: number;
    cancelled: number;
  };
  completedThisMonth: number;
}

interface ChecklistInstance {
  id: string;
  templateId: string;
  jobId: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  completionRate: number;
}

interface ChecklistTemplate {
  id: string;
  name: string;
}

interface Job {
  id: string;
  name: string;
}

export default function ChecklistReportsPage() {
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  const { data: summary, isLoading: summaryLoading } = useQuery<ReportSummary>({
    queryKey: [CHECKLIST_ROUTES.REPORT_SUMMARY],
  });

  const { data: instances, isLoading: instancesLoading } = useQuery<ChecklistInstance[]>({
    queryKey: [CHECKLIST_ROUTES.INSTANCES],
  });

  const { data: templates } = useQuery<ChecklistTemplate[]>({
    queryKey: [CHECKLIST_ROUTES.TEMPLATES],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const filteredInstances = instances?.filter((instance) => {
    if (templateFilter !== "all" && instance.templateId !== templateFilter) {
      return false;
    }
    if (statusFilter !== "all" && instance.status !== statusFilter) {
      return false;
    }
    if (jobFilter !== "all" && instance.jobId !== jobFilter) {
      return false;
    }
    if (dateRange !== "all") {
      const startDate = new Date(instance.startedAt);
      const now = new Date();
      if (dateRange === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (startDate < weekAgo) return false;
      } else if (dateRange === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (startDate < monthAgo) return false;
      } else if (dateRange === "quarter") {
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (startDate < quarterAgo) return false;
      }
    }
    return true;
  }) || [];

  const getTemplateName = (templateId: string) => {
    return templates?.find((t) => t.id === templateId)?.name || "Unknown Template";
  };

  const getJobName = (jobId: string | null) => {
    if (!jobId) return "No Job";
    return jobs?.find((j) => j.id === jobId)?.name || "Unknown Job";
  };

  const exportToCSV = () => {
    if (!filteredInstances.length) return;
    
    const headers = ["Template", "Job", "Status", "Started", "Completed", "Progress"];
    const rows = filteredInstances.map((instance) => [
      getTemplateName(instance.templateId),
      getJobName(instance.jobId),
      instance.status.replace("_", " "),
      new Date(instance.startedAt).toLocaleDateString(),
      instance.completedAt ? new Date(instance.completedAt).toLocaleDateString() : "",
      `${Number(instance.completionRate || 0).toFixed(0)}%`,
    ]);
    
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklist-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = templateFilter !== "all" || statusFilter !== "all" || jobFilter !== "all" || dateRange !== "all";

  const clearFilters = () => {
    setTemplateFilter("all");
    setStatusFilter("all");
    setJobFilter("all");
    setDateRange("all");
  };

  const completionStats = {
    total: filteredInstances.length,
    completed: filteredInstances.filter((i) => i.status === "completed" || i.status === "signed_off").length,
    inProgress: filteredInstances.filter((i) => i.status === "in_progress").length,
    draft: filteredInstances.filter((i) => i.status === "draft").length,
  };

  const completionRate = completionStats.total > 0
    ? Math.round((completionStats.completed / completionStats.total) * 100)
    : 0;

  const avgProgress = filteredInstances.length > 0
    ? Math.round(filteredInstances.reduce((sum, i) => sum + Number(i.completionRate || 0), 0) / filteredInstances.length)
    : 0;

  if (summaryLoading || instancesLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl" data-testid="page-checklist-reports">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Checklist Reports
          </h1>
          <p className="text-muted-foreground">
            Analytics and insights for checklist completion
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportToCSV}
          disabled={!filteredInstances.length}
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-template-filter">
                <SelectValue placeholder="All Templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-template-all">All Templates</SelectItem>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id} data-testid={`option-template-${template.id}`}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-status-all">All Statuses</SelectItem>
                <SelectItem value="draft" data-testid="option-status-draft">Draft</SelectItem>
                <SelectItem value="in_progress" data-testid="option-status-in-progress">In Progress</SelectItem>
                <SelectItem value="completed" data-testid="option-status-completed">Completed</SelectItem>
                <SelectItem value="signed_off" data-testid="option-status-signed-off">Signed Off</SelectItem>
              </SelectContent>
            </Select>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-job-filter">
                <Briefcase className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Jobs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-job-all">All Jobs</SelectItem>
                {jobs?.map((job) => (
                  <SelectItem key={job.id} value={job.id} data-testid={`option-job-${job.id}`}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]" data-testid="select-date-range">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-date-all">All Time</SelectItem>
                <SelectItem value="week" data-testid="option-date-week">Last 7 Days</SelectItem>
                <SelectItem value="month" data-testid="option-date-month">Last 30 Days</SelectItem>
                <SelectItem value="quarter" data-testid="option-date-quarter">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Checklists</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total">{completionStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total || 0} total (unfiltered)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-completed">{completionStats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-in-progress">{completionStats.inProgress}</div>
            <p className="text-xs text-muted-foreground">
              {avgProgress}% avg. progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-this-month">{summary?.completedThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">
              Completed this month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gray-400" />
                  <span className="text-sm">Draft</span>
                </div>
                <span className="text-sm font-medium">{summary?.byStatus.draft || 0}</span>
              </div>
              <Progress value={(summary?.byStatus.draft || 0) / (summary?.total || 1) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="text-sm">In Progress</span>
                </div>
                <span className="text-sm font-medium">{summary?.byStatus.in_progress || 0}</span>
              </div>
              <Progress value={(summary?.byStatus.in_progress || 0) / (summary?.total || 1) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="text-sm">Completed</span>
                </div>
                <span className="text-sm font-medium">{summary?.byStatus.completed || 0}</span>
              </div>
              <Progress value={(summary?.byStatus.completed || 0) / (summary?.total || 1) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-400" />
                  <span className="text-sm">Signed Off</span>
                </div>
                <span className="text-sm font-medium">{summary?.byStatus.signed_off || 0}</span>
              </div>
              <Progress value={(summary?.byStatus.signed_off || 0) / (summary?.total || 1) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredInstances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No checklists found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {filteredInstances.slice(0, 10).map((instance) => (
                  <div
                    key={instance.id}
                    className="flex items-center justify-between p-2 rounded-md border"
                    data-testid={`activity-item-${instance.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getTemplateName(instance.templateId)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Started {new Date(instance.startedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        instance.status === "completed" || instance.status === "signed_off"
                          ? "default"
                          : instance.status === "in_progress"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {instance.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
