import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import lteLogo from "@/assets/lte-logo.png";
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
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const { data: reports, isLoading } = useQuery<ProductionReportSummary[]>({
    queryKey: ["/api/production-reports", { startDate, endDate }],
    queryFn: async () => {
      const res = await fetch(`/api/production-reports?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
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
      return format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy");
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
      
      // Draw header background
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pdfWidth, 28, "F");
      
      // Add logo
      const logoSize = 18;
      try {
        pdf.addImage(lteLogo, "PNG", margin, 5, logoSize, logoSize);
      } catch (e) {
        // Logo load failed, continue without it
      }
      
      // Header text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("LTE Production Reports", margin + logoSize + 8, 14);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(getPeriodLabel(), margin + logoSize + 8, 21);
      
      // Generated date on right
      pdf.setFontSize(9);
      pdf.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pdfWidth - margin, 14, { align: "right" });
      
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
      pdf.text("LTE Precast Concrete - Confidential", margin, pdfHeight - 5);
      pdf.text("Page 1 of 1", pdfWidth - margin, pdfHeight - 5, { align: "right" });
      
      pdf.save(`LTE-Production-Reports-${format(new Date(), "yyyy-MM-dd")}.pdf`);
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
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-production-reports-title">
            Production Reports
          </h1>
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
          <Link href={`/production-report/${format(new Date(), "yyyy-MM-dd")}`}>
            <Button data-testid="button-add-production-entry">
              <Plus className="h-4 w-4 mr-2" />
              Add Production Entry
            </Button>
          </Link>
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
    </div>
  );
}
