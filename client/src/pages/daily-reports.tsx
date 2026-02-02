import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import lteLogo from "@/assets/lte-logo.png";
import {
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  Search,
  AlertTriangle,
  FolderOpen,
  Plus,
  FileDown,
  Loader2,
  Trash2,
  Factory,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DailyLogSummary {
  id: string;
  logDay: string;
  factory: string;
  status: string;
  totalMinutes: number;
  idleMinutes: number;
  missingPanelMarkMinutes: number;
  missingProjectMinutes: number;
  rowCount: number;
  userName?: string;
  userEmail?: string;
}

export default function DailyReportsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("week");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isNewDayDialogOpen, setIsNewDayDialogOpen] = useState(false);
  const [newDayDate, setNewDayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newDayFactory, setNewDayFactory] = useState("QLD");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: logs, isLoading } = useQuery<DailyLogSummary[]>({
    queryKey: ["/api/daily-logs", { status: statusFilter, dateRange }],
  });

  const getNextAvailableDate = () => {
    if (!logs || logs.length === 0) {
      return format(new Date(), "yyyy-MM-dd");
    }
    const sortedDates = logs
      .map(log => new Date(log.logDay + "T00:00:00"))
      .sort((a, b) => b.getTime() - a.getTime());
    const latestDate = sortedDates[0];
    const nextDate = new Date(latestDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return format(nextDate, "yyyy-MM-dd");
  };

  const createDailyLogMutation = useMutation({
    mutationFn: async (data: { logDay: string; factory: string }) => {
      return await apiRequest("POST", "/api/daily-logs", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-logs"] });
      setIsNewDayDialogOpen(false);
      toast({
        title: "Daily log created",
        description: `Created log for ${format(new Date(newDayDate + "T00:00:00"), "dd/MM/yyyy")} - ${newDayFactory}`,
      });
      if (data?.id) {
        setLocation(`/daily-report/${data.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create daily log",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteDailyLogMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/daily-logs/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-logs"] });
      setDeleteDialogOpen(false);
      setDeletingLogId(null);
      toast({ title: "Daily log deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete daily log", variant: "destructive" });
    },
  });

  const filteredLogs = logs?.filter((log) => {
    // Filter by factory
    if (factoryFilter !== "all" && log.factory !== factoryFilter) {
      return false;
    }
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.logDay.includes(query) ||
        log.userName?.toLowerCase().includes(query) ||
        log.userEmail?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PENDING: { variant: "secondary", label: "Pending" },
      SUBMITTED: { variant: "default", label: "Submitted" },
      APPROVED: { variant: "outline", label: "Approved" },
      REJECTED: { variant: "destructive", label: "Rejected" },
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPeriodLabel = () => {
    switch (dateRange) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      case "all": return "All Time";
      default: return dateRange;
    }
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove("dark");
          clonedDoc.documentElement.style.colorScheme = "light";
          const clonedElement = clonedDoc.body.querySelector("[data-pdf-content]") || clonedDoc.body;
          if (clonedElement instanceof HTMLElement) {
            clonedElement.style.backgroundColor = "#ffffff";
            clonedElement.style.color = "#000000";
          }
          clonedDoc.querySelectorAll("*").forEach((el) => {
            if (el instanceof HTMLElement) {
              const computed = window.getComputedStyle(el);
              if (computed.backgroundColor.includes("rgb(") && !computed.backgroundColor.includes("255, 255, 255")) {
                const bg = computed.backgroundColor;
                if (bg.includes("rgb(0,") || bg.includes("rgb(10,") || bg.includes("rgb(20,") || bg.includes("rgb(30,") || bg.includes("hsl(")) {
                  el.style.backgroundColor = "#ffffff";
                }
              }
            }
          });
        },
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const headerHeight = 35;
      const margin = 10;
      const footerHeight = 12;
      const usableHeight = pdfHeight - headerHeight - footerHeight - margin;
      const usableWidth = pdfWidth - (margin * 2);
      
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pdfWidth, 28, "F");
      
      const logoSize = 18;
      try {
        pdf.addImage(lteLogo, "PNG", margin, 5, logoSize, logoSize);
      } catch (e) {}
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("LTE Daily Reports", margin + logoSize + 8, 14);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(getPeriodLabel(), margin + logoSize + 8, 21);
      
      pdf.setFontSize(9);
      pdf.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pdfWidth - margin, 14, { align: "right" });
      
      pdf.setTextColor(0, 0, 0);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const imgRatio = imgWidth / imgHeight;
      let scaledWidth = usableWidth;
      let scaledHeight = scaledWidth / imgRatio;
      
      if (scaledHeight > usableHeight) {
        scaledHeight = usableHeight;
        scaledWidth = scaledHeight * imgRatio;
      }
      
      const imgX = (pdfWidth - scaledWidth) / 2;
      pdf.addImage(imgData, "PNG", imgX, headerHeight, scaledWidth, scaledHeight);
      
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, pdfHeight - footerHeight, pdfWidth, footerHeight, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.line(0, pdfHeight - footerHeight, pdfWidth, pdfHeight - footerHeight);
      
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text("LTE Precast Concrete - Confidential", margin, pdfHeight - 5);
      pdf.text("Page 1 of 1", pdfWidth - margin, pdfHeight - 5, { align: "right" });
      
      pdf.save(`LTE-Daily-Reports-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-daily-reports-title">
            Daily Reports
          </h1>
          <p className="text-muted-foreground">
            Review and manage your drafting time entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={exportToPDF} 
            disabled={isExporting || isLoading}
            data-testid="button-export-pdf"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
          <Dialog open={isNewDayDialogOpen} onOpenChange={(open) => {
              setIsNewDayDialogOpen(open);
              if (open) {
                setNewDayDate(getNextAvailableDate());
              }
            }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-start-new-day">
                <Plus className="h-4 w-4 mr-2" />
                Start New Day
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Daily Log</DialogTitle>
                <DialogDescription>
                  Create a new daily log for a specific date. You can add time entries afterwards.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logDay">Date</Label>
                    <Input
                      id="logDay"
                      type="date"
                      value={newDayDate}
                      onChange={(e) => setNewDayDate(e.target.value)}
                      data-testid="input-new-day-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Factory</Label>
                    <Select value={newDayFactory} onValueChange={setNewDayFactory}>
                      <SelectTrigger data-testid="select-new-day-factory">
                        <SelectValue placeholder="Select factory" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="VIC">Victoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsNewDayDialogOpen(false)}
                  data-testid="button-cancel-new-day"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    createDailyLogMutation.mutate({
                      logDay: newDayDate,
                      factory: newDayFactory,
                    })
                  }
                  disabled={createDailyLogMutation.isPending}
                  data-testid="button-create-new-day"
                >
                  {createDailyLogMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div ref={reportRef}>
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
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36" data-testid="select-date-range">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                <SelectTrigger className="w-36" data-testid="select-factory-filter">
                  <SelectValue placeholder="Factory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Factories</SelectItem>
                  <SelectItem value="QLD">QLD</SelectItem>
                  <SelectItem value="VIC">Victoria</SelectItem>
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
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-24">Factory</TableHead>
                    {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
                      <TableHead>User</TableHead>
                    )}
                    <TableHead className="text-right">Total Time</TableHead>
                    <TableHead className="text-right">Idle</TableHead>
                    <TableHead className="text-right">Missing Panel</TableHead>
                    <TableHead className="text-right">Missing Job</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="cursor-pointer hover-elevate" data-testid={`row-log-${log.id}`}>
                      <TableCell>
                        <Link href={`/daily-reports/${log.id}`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(new Date(log.logDay), "dd/MM/yyyy")}
                            </span>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          <Factory className="h-3 w-3 mr-1" />
                          {log.factory}
                        </Badge>
                      </TableCell>
                      {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
                        <TableCell className="text-muted-foreground">
                          {log.userName || log.userEmail}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatMinutes(log.totalMinutes)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatMinutes(log.idleMinutes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.missingPanelMarkMinutes > 0 ? (
                          <div className="flex items-center justify-end gap-1 text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {formatMinutes(log.missingPanelMarkMinutes)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.missingProjectMinutes > 0 ? (
                          <div className="flex items-center justify-end gap-1 text-amber-600">
                            <FolderOpen className="h-3.5 w-3.5" />
                            {formatMinutes(log.missingProjectMinutes)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(log.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link href={`/daily-reports/${log.id}`}>
                            <Button variant="ghost" size="icon" data-testid={`button-view-${log.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingLogId(log.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-${log.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No daily reports found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Time entries from your Windows Agent will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Daily Log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this daily log and all its time entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLogId && deleteDailyLogMutation.mutate(deletingLogId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteDailyLogMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
