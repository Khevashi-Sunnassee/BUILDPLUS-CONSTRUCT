import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { dateInputProps } from "@/lib/validation";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { PRODUCTION_ROUTES, ADMIN_ROUTES, SETTINGS_ROUTES, USER_ROUTES } from "@shared/api-routes";
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
  FileDown,
  Loader2,
  MapPin,
  Trash2,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { QueryErrorState } from "@/components/query-error-state";
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
import { PageHelpButton } from "@/components/help/page-help-button";

interface ProductionReportSummary {
  date: string;
  factory: string;
  factoryId?: string;
  entryCount: number;
  panelCount: number;
  totalVolumeM3: number;
  totalAreaM2: number;
  jobCount: number;
  draftCount: number;
  completedCount: number;
}

interface Factory {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export default function ProductionReportPage() {
  const [dateRange, setDateRange] = useState<string>("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [factoryFilterInitialized, setFactoryFilterInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isNewDayDialogOpen, setIsNewDayDialogOpen] = useState(false);
  const [newDayDate, setNewDayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newDayFactory, setNewDayFactory] = useState("QLD");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDay, setDeletingDay] = useState<{ date: string; factory: string } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: userSettings } = useQuery<{ selectedFactoryIds: string[]; defaultFactoryId: string | null }>({
    queryKey: [USER_ROUTES.SETTINGS],
  });

  const deleteProductionDayMutation = useMutation({
    mutationFn: async ({ date, factory }: { date: string; factory: string }) => {
      return await apiRequest("DELETE", `${PRODUCTION_ROUTES.DAY_BY_ID(date)}?factory=${factory}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.REPORTS] });
      setDeleteDialogOpen(false);
      setDeletingDay(null);
      toast({ title: "Production day deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete production day", variant: "destructive" });
    },
  });

  const createProductionDayMutation = useMutation({
    mutationFn: async (data: { productionDate: string; factory: string; factoryId?: string }) => {
      return await apiRequest("POST", PRODUCTION_ROUTES.DAYS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTION_ROUTES.REPORTS] });
      setIsNewDayDialogOpen(false);
      const factoryName = activeFactories.find(f => f.id === newDayFactory)?.name || newDayFactory;
      toast({
        title: "Production day created",
        description: `Created ${format(new Date(newDayDate + "T00:00:00"), "dd/MM/yyyy")} - ${factoryName}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create production day",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Calculate date range based on selection
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (dateRange) {
      case "week":
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "month":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "quarter":
        start = startOfQuarter(today);
        end = endOfQuarter(today);
        break;
      case "all":
        start = subDays(today, 365);
        break;
      default:
        start = startOfMonth(today);
        end = endOfMonth(today);
    }

    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    };
  }, [dateRange]);

  const { data: reports, isLoading, isError, error, refetch } = useQuery<ProductionReportSummary[]>({
    queryKey: [PRODUCTION_ROUTES.REPORTS, { startDate, endDate }],
    queryFn: async () => {
      const res = await fetch(`${PRODUCTION_ROUTES.REPORTS}?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const { data: factories } = useQuery<Factory[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
    queryFn: async () => {
      const res = await fetch(ADMIN_ROUTES.FACTORIES);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeFactories = useMemo(() => 
    factories?.filter(f => f.isActive) || [], 
    [factories]
  );

  useEffect(() => {
    if (!factoryFilterInitialized && userSettings && factories) {
      if (userSettings.defaultFactoryId && factories.some(f => f.id === userSettings.defaultFactoryId)) {
        setFactoryFilter(userSettings.defaultFactoryId);
      }
      setFactoryFilterInitialized(true);
    }
  }, [userSettings, factoryFilterInitialized, factories]);

  // Set default factory when factories load
  useEffect(() => {
    if (activeFactories.length > 0 && newDayFactory === "QLD") {
      setNewDayFactory(activeFactories[0].id);
    }
  }, [activeFactories, newDayFactory]);

  const getFactoryDisplayName = (report: ProductionReportSummary) => {
    if (report.factoryId && factories) {
      const factory = factories.find(f => f.id === report.factoryId);
      if (factory) return factory.name;
    }
    return report.factory;
  };

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.logoBase64 || null;
  const companyName = brandingSettings?.companyName || "BuildPlus Ai";

  const filteredReports = useMemo(() => reports?.filter((report) => {
    if (factoryFilter !== "all") {
      const matchesFactoryId = report.factoryId === factoryFilter;
      const matchesFactoryText = report.factory === factoryFilter;
      if (!matchesFactoryId && !matchesFactoryText) {
        return false;
      }
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return report.date.includes(query);
    }
    return true;
  }), [reports, factoryFilter, searchQuery]);

  const getNextAvailableDate = () => {
    if (!reports || reports.length === 0) {
      return format(new Date(), "yyyy-MM-dd");
    }
    const sortedDates = reports
      .map(report => new Date(report.date + "T00:00:00"))
      .sort((a, b) => b.getTime() - a.getTime());
    const latestDate = sortedDates[0];
    const nextDate = new Date(latestDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return format(nextDate, "yyyy-MM-dd");
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (report: ProductionReportSummary) => {
    const { draftCount = 0, completedCount = 0, entryCount } = report;
    if (entryCount === 0) {
      return <Badge variant="secondary">Scheduled</Badge>;
    } else if (draftCount > 0 && completedCount === 0) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Circle className="h-3 w-3" />
          All Draft
        </Badge>
      );
    } else if (draftCount === 0 && completedCount > 0) {
      return (
        <Badge className="gap-1 bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    } else {
      return (
        <div className="flex gap-1">
          <Badge variant="secondary" className="gap-1 text-xs">
            <Circle className="h-2.5 w-2.5" />
            {draftCount}
          </Badge>
          <Badge className="gap-1 text-xs bg-green-600">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {completedCount}
          </Badge>
        </div>
      );
    }
  };

  const getPeriodLabel = () => {
    switch (dateRange) {
      case "week": return "This Week";
      case "month": return "This Month";
      case "quarter": return "This Quarter";
      case "all": return "All Time";
      default: return dateRange;
    }
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
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
      
      // Clean header with logo - proper aspect ratio
      const logoHeight = 12;
      const logoWidth = 24; // 2:1 aspect ratio for typical logo
      try {
        if (reportLogo) pdf.addImage(reportLogo, "PNG", margin, 6, logoWidth, logoHeight);
      } catch (e) {}
      
      // Report title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Production Booking", margin + logoWidth + 6, 12);
      
      // Subtitle info
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(getPeriodLabel(), margin + logoWidth + 6, 19);
      
      // Generated date on the right
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pdfWidth - margin, 19, { align: "right" });
      
      // Draw a simple line under header
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, 24, pdfWidth - margin, 24);
      
      // Reset text color for content
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
      
      // Center the content
      const imgX = (pdfWidth - scaledWidth) / 2;
      pdf.addImage(imgData, "PNG", imgX, headerHeight, scaledWidth, scaledHeight);
      
      // Footer
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, pdfHeight - footerHeight, pdfWidth, footerHeight, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.line(0, pdfHeight - footerHeight, pdfWidth, pdfHeight - footerHeight);
      
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${companyName} - Confidential`, margin, pdfHeight - 5);
      pdf.text("Page 1 of 1", pdfWidth - margin, pdfHeight - 5, { align: "right" });
      
      pdf.save(`BuildPlus-Production-Reports-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  if (isError) {
    return (
      <div className="space-y-6" role="main" aria-label="Production Booking">
        <QueryErrorState error={error} onRetry={refetch} message="Failed to load production reports" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Production Booking">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-production-reports-title">
            Production Booking
          </h1>
            <PageHelpButton pageHelpKey="page.production-report" />
          </div>
          <p className="text-muted-foreground">
            Track production work and costs for panels by date
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
                <DialogTitle>Start New Production Day</DialogTitle>
                <DialogDescription>
                  Create a new production day record for a specific factory. You can add entries afterwards.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="productionDate">Date</Label>
                  <Input
                    id="productionDate"
                    type="date"
                    {...dateInputProps}
                    value={newDayDate}
                    onChange={(e) => setNewDayDate(e.target.value)}
                    data-testid="input-new-day-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="factory">Factory</Label>
                  <Select value={newDayFactory} onValueChange={setNewDayFactory}>
                    <SelectTrigger id="factory" data-testid="select-new-day-factory">
                      <SelectValue placeholder="Select factory" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeFactories.length > 0 ? (
                        [...activeFactories].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="QLD">QLD</SelectItem>
                          <SelectItem value="VIC">Victoria</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
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
                  onClick={() => {
                    const factoryObj = activeFactories.find(f => f.id === newDayFactory);
                    createProductionDayMutation.mutate({
                      productionDate: newDayDate,
                      factory: factoryObj?.code || newDayFactory,
                      factoryId: activeFactories.length > 0 ? newDayFactory : undefined,
                    });
                  }}
                  disabled={createProductionDayMutation.isPending}
                  data-testid="button-create-new-day"
                >
                  {createProductionDayMutation.isPending && (
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
          <div className="flex flex-col sm:flex-row gap-4 justify-between print:hidden">
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
              <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                <SelectTrigger className="w-36" data-testid="select-factory-filter">
                  <SelectValue placeholder="Factory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Factories</SelectItem>
                  {activeFactories.length > 0 ? (
                    [...activeFactories].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="QLD">QLD</SelectItem>
                      <SelectItem value="VIC">Victoria</SelectItem>
                    </>
                  )}
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
                    <TableHead className="w-28">Factory</TableHead>
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
                      key={`${report.date}-${report.factory}`} 
                      className="cursor-pointer hover-elevate" 
                      data-testid={`row-report-${report.date}-${report.factory}`}
                    >
                      <TableCell>
                        <Link href={`/production-report/${report.date}?factory=${report.factoryId || report.factory}`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatDate(report.date)}
                            </span>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="secondary">
                            {getFactoryDisplayName(report)}
                          </Badge>
                        </div>
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
                        {getStatusBadge(report)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link href={`/production-report/${report.date}?factory=${report.factoryId || report.factory}`}>
                            <Button variant="ghost" size="icon" data-testid={`button-view-${report.date}-${report.factory}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingDay({ date: report.date, factory: report.factoryId || report.factory });
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-${report.date}-${report.factory}`}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Production Day?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this production day and all its entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDay && deleteProductionDayMutation.mutate(deletingDay)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteProductionDayMutation.isPending ? (
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
