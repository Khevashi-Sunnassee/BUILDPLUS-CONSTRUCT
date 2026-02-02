import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Calendar,
  ChevronRight,
  Factory,
  Filter,
  Search,
  Box,
  Square,
  Plus,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ProductionReportSummary {
  date: string;
  entryCount: number;
  panelCount: number;
  totalVolumeM3: number;
  totalAreaM2: number;
  jobCount: number;
}

export default function ProductionReportPage() {
  const [dateRange, setDateRange] = useState<string>("month");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: reports, isLoading } = useQuery<ProductionReportSummary[]>({
    queryKey: ["/api/production-reports", { dateRange }],
  });

  const filteredReports = reports?.filter((report) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return report.date.includes(query);
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T00:00:00"), "EEE, MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (entryCount: number) => {
    if (entryCount === 0) {
      return <Badge variant="secondary">No Entries</Badge>;
    } else if (entryCount < 5) {
      return <Badge variant="outline">In Progress</Badge>;
    } else {
      return <Badge variant="default">Active</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-production-reports-title">
            Production Reports
          </h1>
          <p className="text-muted-foreground">
            Track production work and costs for panels by date
          </p>
        </div>
        <Link href={`/production-report/${format(new Date(), "yyyy-MM-dd")}`}>
          <Button data-testid="button-add-production-entry">
            <Plus className="h-4 w-4 mr-2" />
            Add Production Entry
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="input-search"
                />
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36" data-testid="select-date-range">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 flex-1" />
                </div>
              ))}
            </div>
          ) : filteredReports && filteredReports.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Date</TableHead>
                    <TableHead className="text-right">Panels</TableHead>
                    <TableHead className="text-right">Volume (m³)</TableHead>
                    <TableHead className="text-right">Area (m²)</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow 
                      key={report.date} 
                      className="cursor-pointer hover-elevate" 
                      data-testid={`row-report-${report.date}`}
                    >
                      <TableCell>
                        <Link href={`/production-report/${report.date}`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatDate(report.date)}
                            </span>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                          {report.panelCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <div className="flex items-center justify-end gap-1">
                          <Box className="h-3.5 w-3.5 text-blue-500" />
                          {report.totalVolumeM3.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <div className="flex items-center justify-end gap-1">
                          <Square className="h-3.5 w-3.5 text-purple-500" />
                          {report.totalAreaM2.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {report.jobCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(report.entryCount)}
                      </TableCell>
                      <TableCell>
                        <Link href={`/production-report/${report.date}`}>
                          <Button variant="ghost" size="icon" data-testid={`button-view-${report.date}`}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Factory className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No production reports found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Click "Add Production Entry" to start recording production work
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
