import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  FileDown,
  Loader2,
  Factory,
  Clock,
  DollarSign,
  Layers,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { REPORTS_ROUTES, SETTINGS_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

interface ProductionDailyData {
  date: string;
  panelCount: number;
  volumeM3: number;
  areaM2: number;
  byPanelType: Record<string, { count: number; volumeM3: number; areaM2: number }>;
}

interface ProductionWithCostsData {
  date: string;
  panelCount: number;
  volumeM3: number;
  areaM2: number;
  labourCost: number;
  supplyCost: number;
  totalCost: number;
  revenue: number;
  profit: number;
  byPanelType: Record<string, { count: number; volumeM3: number; areaM2: number; cost: number; revenue: number }>;
}

interface DraftingDailyData {
  date: string;
  totalMinutes: number;
  idleMinutes: number;
  activeMinutes: number;
  totalHours: number;
  activeHours: number;
  byUser: Record<string, { name: string; minutes: number; idle: number }>;
  byApp: Record<string, number>;
  byProject: Record<string, { name: string; minutes: number }>;
  byWorkType: Record<string, { name: string; code: string; minutes: number }>;
  byPanel: Record<string, { panelMark: string; minutes: number; jobName: string }>;
}

interface ProductionReportResponse {
  dailyData: ProductionDailyData[];
  totals: {
    panelCount: number;
    volumeM3: number;
    areaM2: number;
  };
  panelTypes: string[];
  period: { startDate: string; endDate: string };
}

interface ProductionCostsReportResponse {
  dailyData: ProductionWithCostsData[];
  totals: {
    panelCount: number;
    volumeM3: number;
    areaM2: number;
    labourCost: number;
    supplyCost: number;
    totalCost: number;
    revenue: number;
    profit: number;
  };
  panelTypes: string[];
  period: { startDate: string; endDate: string };
}

interface DraftingReportResponse {
  dailyData: DraftingDailyData[];
  totals: {
    totalMinutes: number;
    idleMinutes: number;
    activeMinutes: number;
    totalHours: number;
    activeHours: number;
    reworkHours: number;
    reworkPercentage: number;
    clientChangeHours: number;
    clientChangePercentage: number;
    generalHours: number;
    generalPercentage: number;
    unassignedHours: number;
    byWorkType: Array<{ name: string; code: string; minutes: number; hours: number; percentage: number }>;
    byPanel: Array<{ panelMark: string; minutes: number; hours: number; jobName: string }>;
  };
  period: { startDate: string; endDate: string };
}

interface CostAnalysisResponse {
  period: { startDate: string; endDate: string };
  totalRevenue: number;
  totalExpectedCost: number;
  expectedProfit: number;
  profitMargin: number;
  componentBreakdown: Array<{
    name: string;
    expectedCost: number;
    percentageOfRevenue: number;
  }>;
  entryCount: number;
}

interface CostAnalysisDailyResponse {
  period: { startDate: string; endDate: string };
  dailyData: Array<{
    date: string;
    revenue: number;
    totalCost: number;
    profit: number;
    entryCount: number;
    [key: string]: number | string;
  }>;
  componentNames: string[];
  totals: {
    revenue: number;
    totalCost: number;
    profit: number;
    entryCount: number;
    byComponent: Record<string, number>;
  };
}

interface LabourCostAnalysisResponse {
  period: { startDate: string; endDate: string };
  factory: string;
  dailyData: Array<{
    date: string;
    revenue: number;
    estimatedLabour: number;
    actualLabour: number;
    variance: number;
    variancePercent: number;
    isOverBudget: boolean;
    panelCount: number;
  }>;
  totals: {
    revenue: number;
    estimatedLabour: number;
    actualLabour: number;
    variance: number;
    variancePercent: number;
    isOverBudget: boolean;
    panelCount: number;
  };
  hasWeeklyWageData: boolean;
}

const CHART_COLORS = [
  "hsl(217, 91%, 50%)",
  "hsl(142, 76%, 40%)",
  "hsl(280, 65%, 50%)",
  "hsl(25, 95%, 52%)",
  "hsl(340, 82%, 48%)",
  "hsl(180, 70%, 40%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 72%, 51%)",
];

const PANEL_TYPE_COLORS: Record<string, string> = {
  "CUBE_BASE": "#4e79a7",
  "CUBE_RING": "#f28e2c",
  "LANDING": "#e15759",
  "WALL": "#76b7b2",
  "COLUMN": "#59a14f",
  "OTHER": "#9c755f",
};

const WORK_TYPE_COLORS: Record<string, string> = {
  "GENERAL": "#4e79a7",
  "CLIENT_CHANGE": "#f28e2c",
  "ERROR_REWORK": "#e15759",
  "UNASSIGNED": "#bab0ab",
};

export default function KPIDashboardPage() {
  useDocumentTitle("KPI Dashboard");
  const [periodType, setPeriodType] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [activeTab, setActiveTab] = useState("production");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string>("all");
  const reportRef = useRef<HTMLDivElement>(null);

  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodType) {
      case "week":
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "last-week":
        startDate = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        endDate = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        break;
      case "month":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case "last-month":
        startDate = startOfMonth(subMonths(today, 1));
        endDate = endOfMonth(subMonths(today, 1));
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          return { startDate: customStartDate, endDate: customEndDate };
        }
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      default:
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
    }

    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    };
  }, [periodType, customStartDate, customEndDate]);

  const { data: productionData, isLoading: productionLoading } = useQuery<ProductionReportResponse>({
    queryKey: [REPORTS_ROUTES.PRODUCTION_DAILY, { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: productionCostsData, isLoading: costsLoading } = useQuery<ProductionCostsReportResponse>({
    queryKey: [REPORTS_ROUTES.PRODUCTION_WITH_COSTS, { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: draftingData, isLoading: draftingLoading } = useQuery<DraftingReportResponse>({
    queryKey: [REPORTS_ROUTES.DRAFTING_DAILY, { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: costAnalysisData, isLoading: costAnalysisLoading } = useQuery<CostAnalysisResponse>({
    queryKey: [REPORTS_ROUTES.COST_ANALYSIS, { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: costDailyData, isLoading: costDailyLoading } = useQuery<CostAnalysisDailyResponse>({
    queryKey: [REPORTS_ROUTES.COST_ANALYSIS_DAILY, { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: labourCostData, isLoading: labourCostLoading } = useQuery<LabourCostAnalysisResponse>({
    queryKey: [REPORTS_ROUTES.LABOUR_COST_ANALYSIS, { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.logoBase64 || null;
  const companyName = brandingSettings?.companyName || "LTE Performance";

  // Reset component filter when component names change (e.g., date range changes)
  useEffect(() => {
    if (costDailyData?.componentNames && selectedComponent !== "all") {
      if (!costDailyData.componentNames.includes(selectedComponent)) {
        setSelectedComponent("all");
      }
    }
  }, [costDailyData?.componentNames, selectedComponent]);

  const formatDate = useCallback((dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}`;
  }, []);

  const getPeriodLabel = useCallback(() => {
    if (startDate && endDate) {
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      return `${start} - ${end}`;
    }
    return "";
  }, [startDate, endDate, formatDate]);

  const getMonthName = useCallback(() => {
    if (startDate) {
      const date = new Date(startDate);
      return format(date, "MMMM yyyy");
    }
    return "";
  }, [startDate]);

  const panelsDailyChartData = useMemo(() => productionData?.dailyData?.map((d) => {
    const entry: Record<string, any> = {
      date: formatDate(d.date),
      panelCount: d.panelCount,
      volumeM3: d.volumeM3,
    };
    if (d.byPanelType) {
      Object.entries(d.byPanelType).forEach(([type, data]) => {
        entry[type] = data.count;
        entry[`${type}_vol`] = data.volumeM3;
      });
    }
    return entry;
  }) || [], [productionData, formatDate]);

  const cubesDailyChartData = useMemo(() => productionData?.dailyData?.map((d) => {
    const cubeTypes = ["CUBE_BASE", "CUBE_RING", "LANDING"];
    const entry: Record<string, any> = {
      date: formatDate(d.date),
      totalVolume: 0,
    };
    
    if (d.byPanelType) {
      cubeTypes.forEach((type) => {
        if (d.byPanelType[type]) {
          entry[type] = d.byPanelType[type].count;
          entry[`${type}_vol`] = d.byPanelType[type].volumeM3;
          entry.totalVolume += d.byPanelType[type].volumeM3;
        } else {
          entry[type] = 0;
          entry[`${type}_vol`] = 0;
        }
      });
    }
    
    entry.totalVolume = Math.round(entry.totalVolume * 100) / 100;
    return entry;
  }) || [], [productionData, formatDate]);

  const financialChartData = useMemo(() => productionCostsData?.dailyData?.map((d) => ({
    date: formatDate(d.date),
    cost: d.totalCost,
    revenue: d.revenue,
    profit: d.profit,
  })) || [], [productionCostsData, formatDate]);

  const draftingChartData = useMemo(() => draftingData?.dailyData?.map((d) => ({
    date: formatDate(d.date),
    activeHours: d.activeHours,
    idleHours: Math.round((d.idleMinutes / 60) * 100) / 100,
    totalHours: d.totalHours,
  })) || [], [draftingData, formatDate]);

  const allPanelTypes = useMemo(() => productionData?.panelTypes || [], [productionData]);

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
        windowWidth: 1400,
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
        orientation: "landscape",
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
      } catch (e) { console.error("KPI data processing error:", e); }
      
      // Report title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Performance Report", margin + logoWidth + 6, 12);
      
      // Subtitle info
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${getPeriodLabel()}`, margin + logoWidth + 6, 19);
      
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
      
      pdf.save(`LTE-Performance-Report-${startDate}-${endDate}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = productionLoading || costsLoading || draftingLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-6 w-6" />
            KPI Dashboard
          </h1>
            <PageHelpButton pageHelpKey="page.kpi-dashboard" />
          </div>
          <p className="text-muted-foreground">
            Performance metrics and drafting analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodType} onValueChange={setPeriodType} data-testid="select-period">
            <SelectTrigger className="w-[160px]" data-testid="button-select-period">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {periodType === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-[140px]"
                data-testid="input-start-date"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-[140px]"
                data-testid="input-end-date"
              />
            </div>
          )}

          <Button 
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
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-sm" data-testid="badge-period">
          <Calendar className="h-3 w-3 mr-1" />
          {getPeriodLabel()}
        </Badge>
        <span className="text-lg font-semibold text-muted-foreground">{getMonthName()}</span>
      </div>

      <div ref={reportRef} className="space-y-6 bg-background">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Panels</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-total-panels">
                  {productionData?.totals?.panelCount || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold" data-testid="text-total-volume">
                  {productionData?.totals?.volumeM3?.toFixed(2) || "0.00"} m³
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-green-600" data-testid="text-total-revenue">
                  ${productionCostsData?.totals?.revenue?.toLocaleString() || "0"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className={`text-2xl font-bold ${(productionCostsData?.totals?.profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-total-profit">
                  ${productionCostsData?.totals?.profit?.toLocaleString() || "0"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="production" data-testid="tab-production">
              <Factory className="h-4 w-4 mr-2" />
              Production
            </TabsTrigger>
            <TabsTrigger value="financial" data-testid="tab-financial">
              <DollarSign className="h-4 w-4 mr-2" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="drafting" data-testid="tab-drafting">
              <Clock className="h-4 w-4 mr-2" />
              Drafting
            </TabsTrigger>
            <TabsTrigger value="labour" data-testid="tab-labour">
              <Users className="h-4 w-4 mr-2" />
              Labour
            </TabsTrigger>
            <TabsTrigger value="cost-analysis" data-testid="tab-cost-analysis">
              <Layers className="h-4 w-4 mr-2" />
              Cost Breakup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="production" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  PANELS POURED DAILY - {getMonthName().toUpperCase()}
                </CardTitle>
                <CardDescription>
                  Daily panel count and volume (m³) for the selected period
                </CardDescription>
                {productionData?.totals && (
                  <div className="flex items-center gap-4 pt-2">
                    <Badge variant="secondary" className="text-sm">
                      TOTAL PANELS: {productionData.totals.panelCount}
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : panelsDailyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={panelsDailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis yAxisId="left" label={{ value: "Panels", angle: -90, position: "insideLeft" }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: "Volume (m³)", angle: 90, position: "insideRight" }} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "volumeM3") return [`${value.toFixed(2)} m³`, "Volume"];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="panelCount" fill="#4e79a7" name="Panels" />
                      <Line yAxisId="right" type="monotone" dataKey="volumeM3" stroke="#e15759" strokeWidth={2} name="Volume (m³)" dot={{ fill: "#e15759" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No production data for this period
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  CUBES POURED DAILY - {getMonthName().toUpperCase()}
                </CardTitle>
                <CardDescription>
                  Daily breakdown by cube type (Bases, Rings, Landings) with total volume
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : cubesDailyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={cubesDailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis yAxisId="left" label={{ value: "Count", angle: -90, position: "insideLeft" }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: "Volume (m³)", angle: 90, position: "insideRight" }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="CUBE_BASE" stackId="cubes" fill={PANEL_TYPE_COLORS.CUBE_BASE} name="Bases" />
                      <Bar yAxisId="left" dataKey="CUBE_RING" stackId="cubes" fill={PANEL_TYPE_COLORS.CUBE_RING} name="Rings" />
                      <Bar yAxisId="left" dataKey="LANDING" stackId="cubes" fill={PANEL_TYPE_COLORS.LANDING} name="Landings" />
                      <Line yAxisId="right" type="monotone" dataKey="totalVolume" stroke="#59a14f" strokeWidth={2} name="Total Volume" dot={{ fill: "#59a14f" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No cube data for this period
                  </div>
                )}
              </CardContent>
            </Card>

            {productionCostsData?.totals && (
              <Card>
                <CardHeader>
                  <CardTitle>Period Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">PANELS - VOLUME</div>
                      <div className="text-xl font-bold">{productionCostsData.totals.volumeM3.toFixed(2)}</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">CUBES - VOLUME</div>
                      <div className="text-xl font-bold">
                        {cubesDailyChartData.reduce((sum, d) => sum + (d.totalVolume || 0), 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg bg-primary/5">
                      <div className="text-sm text-muted-foreground">TOTAL VOLUME</div>
                      <div className="text-xl font-bold text-primary">{productionCostsData.totals.volumeM3.toFixed(2)}</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">TOTAL PANELS</div>
                      <div className="text-xl font-bold">{productionCostsData.totals.panelCount}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="financial" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Labour Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold" data-testid="text-labour-cost">
                    ${productionCostsData?.totals?.labourCost?.toLocaleString() || "0"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Supply Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold" data-testid="text-supply-cost">
                    ${productionCostsData?.totals?.supplyCost?.toLocaleString() || "0"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-600" data-testid="text-financial-cost">
                    ${productionCostsData?.totals?.totalCost?.toLocaleString() || "0"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-green-600" data-testid="text-financial-revenue">
                    ${productionCostsData?.totals?.revenue?.toLocaleString() || "0"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${(productionCostsData?.totals?.profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-financial-profit">
                    ${productionCostsData?.totals?.profit?.toLocaleString() || "0"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Daily Financial Performance</CardTitle>
                <CardDescription>Cost, Revenue, and Profit trends for the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : financialChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={financialChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis label={{ value: "Amount ($)", angle: -90, position: "insideLeft" }} />
                      <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, ""]} />
                      <Legend />
                      <Bar dataKey="cost" fill="#e15759" name="Cost" />
                      <Bar dataKey="revenue" fill="#59a14f" name="Revenue" />
                      <Line type="monotone" dataKey="profit" stroke="#4e79a7" strokeWidth={2} name="Profit" dot={{ fill: "#4e79a7" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No financial data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drafting" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold" data-testid="text-drafting-total-hours">
                    {draftingData?.totals?.totalHours?.toFixed(1) || "0"} hrs
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Active Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-green-600" data-testid="text-drafting-active-hours">
                    {draftingData?.totals?.activeHours?.toFixed(1) || "0"} hrs
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Idle Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-orange-500" data-testid="text-drafting-idle-hours">
                    {((draftingData?.totals?.idleMinutes || 0) / 60).toFixed(1)} hrs
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold" data-testid="text-drafting-efficiency">
                    {draftingData?.totals?.totalMinutes 
                      ? ((draftingData.totals.activeMinutes / draftingData.totals.totalMinutes) * 100).toFixed(1)
                      : "0"}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Work Type Analysis Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">General Drafting</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-blue-600" data-testid="text-general-hours">
                    {draftingData?.totals?.generalHours?.toFixed(1) || "0"} hrs
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {draftingData?.totals?.generalPercentage || 0}% of assigned
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Client Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-orange-500" data-testid="text-client-change-hours">
                    {draftingData?.totals?.clientChangeHours?.toFixed(1) || "0"} hrs
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {draftingData?.totals?.clientChangePercentage || 0}% of assigned
                  </p>
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Rework/Errors
                    <Badge variant="destructive" className="text-xs">Track This</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-600" data-testid="text-rework-hours">
                    {draftingData?.totals?.reworkHours?.toFixed(1) || "0"} hrs
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {draftingData?.totals?.reworkPercentage || 0}% of assigned
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Unassigned</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-muted-foreground" data-testid="text-unassigned-hours">
                    {draftingData?.totals?.unassignedHours?.toFixed(1) || "0"} hrs
                  </div>
                  <p className="text-xs text-muted-foreground">Not categorized</p>
                </CardContent>
              </Card>
            </div>

            {/* Work Type Distribution and Panel Time */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Work Type Distribution</CardTitle>
                  <CardDescription>Time breakdown by drafting activity type</CardDescription>
                </CardHeader>
                <CardContent>
                  {draftingData?.totals?.byWorkType && draftingData.totals.byWorkType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={draftingData.totals.byWorkType
                            .filter(wt => wt.code !== 'UNASSIGNED')
                            .map(wt => ({
                              name: wt.name,
                              value: wt.hours,
                              code: wt.code,
                            }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {draftingData.totals.byWorkType
                            .filter(wt => wt.code !== 'UNASSIGNED')
                            .map((wt, index) => (
                              <Cell key={`cell-${index}`} fill={WORK_TYPE_COLORS[wt.code] || CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)} hrs`, "Hours"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No work type data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Time by Panel</CardTitle>
                  <CardDescription>Hours spent on each panel mark (top 10)</CardDescription>
                </CardHeader>
                <CardContent>
                  {draftingData?.totals?.byPanel && draftingData.totals.byPanel.length > 0 ? (
                    <div className="overflow-auto max-h-[300px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Panel Mark</th>
                            <th className="text-left py-2 font-medium">Job</th>
                            <th className="text-right py-2 font-medium">Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftingData.totals.byPanel.slice(0, 10).map((panel, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2 font-mono">{panel.panelMark}</td>
                              <td className="py-2 text-muted-foreground">{panel.jobName}</td>
                              <td className="py-2 text-right font-medium">{panel.hours.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No panel data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Daily Drafting Hours</CardTitle>
                <CardDescription>Active and idle time breakdown for the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : draftingChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={draftingChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft" }} />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(1)} hrs`, ""]} />
                      <Legend />
                      <Bar dataKey="activeHours" stackId="time" fill="#59a14f" name="Active Hours" />
                      <Bar dataKey="idleHours" stackId="time" fill="#f28e2c" name="Idle Hours" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No drafting data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="labour" className="space-y-6 mt-6">
            {/* Labour Cost Analysis Header */}
            <Card className="border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-600" />
                  LABOUR COST ANALYSIS - {getMonthName().toUpperCase()}
                </CardTitle>
                <CardDescription>
                  Compare estimated labour costs (from panel type cost %) against actual production wages
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Labour Summary Badge */}
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-base px-4 py-2" data-testid="badge-labour-panels">
                TOTAL PANELS: {labourCostData?.totals?.panelCount ?? 0}
              </Badge>
              <Badge 
                variant={labourCostData?.totals?.isOverBudget ? "destructive" : "default"}
                className={`text-base px-4 py-2 ${!labourCostData?.totals?.isOverBudget ? "bg-green-600" : ""}`}
                data-testid="badge-labour-status"
              >
                {labourCostData?.totals?.isOverBudget ? 'OVER BUDGET' : 'UNDER BUDGET'}
              </Badge>
            </div>

            {/* Labour Cost Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  {labourCostLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-labour-total-revenue">
                      ${labourCostData?.totals?.revenue?.toLocaleString() ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/30 dark:to-cyan-900/20 border-cyan-200 dark:border-cyan-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Estimated Labour</CardTitle>
                </CardHeader>
                <CardContent>
                  {labourCostLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100" data-testid="text-labour-estimated">
                      ${labourCostData?.totals?.estimatedLabour?.toLocaleString() ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Actual Labour</CardTitle>
                </CardHeader>
                <CardContent>
                  {labourCostLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-orange-900 dark:text-orange-100" data-testid="text-labour-actual">
                      ${labourCostData?.totals?.actualLabour?.toLocaleString() ?? 0}
                      {!labourCostData?.hasWeeklyWageData && (
                        <span className="text-xs font-normal text-muted-foreground ml-2">(No wage data)</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className={`bg-gradient-to-br ${
                labourCostData?.totals?.isOverBudget 
                  ? 'from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-500 border-2' 
                  : 'from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800'
              }`}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm font-medium ${
                    labourCostData?.totals?.isOverBudget 
                      ? 'text-red-700 dark:text-red-300' 
                      : 'text-green-700 dark:text-green-300'
                  }`}>
                    Variance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {labourCostLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${
                        labourCostData?.totals?.isOverBudget 
                          ? 'text-red-700 dark:text-red-300' 
                          : 'text-green-700 dark:text-green-300'
                      }`} data-testid="text-labour-variance">
                        {labourCostData?.totals?.isOverBudget ? '+' : ''}
                        ${labourCostData?.totals?.variance?.toLocaleString() ?? 0}
                      </span>
                      {labourCostData?.totals?.variancePercent !== 0 && (
                        <Badge 
                          variant={labourCostData?.totals?.isOverBudget ? "destructive" : "default"}
                          className={!labourCostData?.totals?.isOverBudget ? "bg-green-600 hover:bg-green-700" : ""}
                          data-testid="badge-labour-variance-percent"
                        >
                          {labourCostData?.totals?.isOverBudget ? '+' : ''}{labourCostData?.totals?.variancePercent}%
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Labour Cost Alert */}
            {labourCostData?.totals?.isOverBudget && (
              <Card className="border-red-500 border-2 bg-red-50 dark:bg-red-950/30">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                      <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-700 dark:text-red-300">Labour Costs Above Target</p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Actual labour is ${Math.abs(labourCostData.totals.variance).toLocaleString()} ({Math.abs(labourCostData.totals.variancePercent)}%) 
                        above the estimated budget based on panel type cost ratios.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Labour Cost Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Daily Labour Cost Comparison
                </CardTitle>
                <CardDescription>
                  Estimated vs actual labour costs per day with variance indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                {labourCostLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : labourCostData?.dailyData && labourCostData.dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={labourCostData.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }} 
                        interval={0} 
                        angle={-45} 
                        textAnchor="end" 
                        height={60} 
                        tickFormatter={(d) => formatDate(d)} 
                      />
                      <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                        labelFormatter={(label) => formatDate(label)}
                      />
                      <Legend />
                      <Bar dataKey="estimatedLabour" fill="#06b6d4" name="Estimated Labour" />
                      <Bar dataKey="actualLabour" fill="#f97316" name="Actual Labour" />
                      <Line 
                        type="monotone" 
                        dataKey="variance" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        name="Variance" 
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (payload.isOverBudget) {
                            return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                          }
                          return <circle cx={cx} cy={cy} r={4} fill="#22c55e" stroke="#fff" strokeWidth={2} />;
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No labour cost data available for this period. Ensure production entries and weekly wage reports exist.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Labour Cost Daily Table */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Labour Cost Breakdown</CardTitle>
                <CardDescription>
                  Detailed view of estimated vs actual labour by day
                </CardDescription>
              </CardHeader>
              <CardContent>
                {labourCostLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : labourCostData?.dailyData && labourCostData.dailyData.length > 0 ? (
                  <div className="overflow-auto max-h-[400px] border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">Date</th>
                          <th className="text-right py-3 px-4 font-semibold">Panels</th>
                          <th className="text-right py-3 px-4 font-semibold">Revenue</th>
                          <th className="text-right py-3 px-4 font-semibold">Estimated</th>
                          <th className="text-right py-3 px-4 font-semibold">Actual</th>
                          <th className="text-right py-3 px-4 font-semibold">Variance</th>
                          <th className="text-center py-3 px-4 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labourCostData.dailyData.map((day, idx) => (
                          <tr key={day.date} className="border-b hover:bg-muted/50" data-testid={`row-labour-daily-${idx}`}>
                            <td className="py-3 px-4 font-medium">{formatDate(day.date)}</td>
                            <td className="text-right py-3 px-4 text-muted-foreground">{day.panelCount}</td>
                            <td className="text-right py-3 px-4 font-mono text-blue-600 dark:text-blue-400">
                              ${day.revenue.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4 font-mono text-cyan-600 dark:text-cyan-400">
                              ${day.estimatedLabour.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4 font-mono text-orange-600 dark:text-orange-400">
                              ${day.actualLabour.toLocaleString()}
                            </td>
                            <td className={`text-right py-3 px-4 font-mono font-semibold ${
                              day.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                            }`}>
                              {day.isOverBudget ? '+' : ''}${day.variance.toLocaleString()}
                              <span className="text-xs ml-1">({day.isOverBudget ? '+' : ''}{day.variancePercent}%)</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Badge 
                                variant={day.isOverBudget ? "destructive" : "default"}
                                className={!day.isOverBudget ? "bg-green-600 hover:bg-green-700" : ""}
                              >
                                {day.isOverBudget ? 'Over' : 'Under'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-muted/50 border-t-2">
                          <td className="py-3 px-4">Total</td>
                          <td className="text-right py-3 px-4">{labourCostData.totals.panelCount}</td>
                          <td className="text-right py-3 px-4 font-mono text-blue-600 dark:text-blue-400">
                            ${labourCostData.totals.revenue.toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 font-mono text-cyan-600 dark:text-cyan-400">
                            ${labourCostData.totals.estimatedLabour.toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 font-mono text-orange-600 dark:text-orange-400">
                            ${labourCostData.totals.actualLabour.toLocaleString()}
                          </td>
                          <td className={`text-right py-3 px-4 font-mono font-semibold ${
                            labourCostData.totals.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                          }`}>
                            {labourCostData.totals.isOverBudget ? '+' : ''}${labourCostData.totals.variance.toLocaleString()}
                            <span className="text-xs ml-1">({labourCostData.totals.isOverBudget ? '+' : ''}{labourCostData.totals.variancePercent}%)</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge 
                              variant={labourCostData.totals.isOverBudget ? "destructive" : "default"}
                              className={!labourCostData.totals.isOverBudget ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                              {labourCostData.totals.isOverBudget ? 'Over Budget' : 'Under Budget'}
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No daily labour cost data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cost-analysis" className="space-y-6 mt-6">
            <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Cost Analysis Report
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Filter by cost component to see detailed daily breakdown
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="component-filter" className="text-sm font-medium whitespace-nowrap">
                      Filter by Component:
                    </Label>
                    <Select value={selectedComponent} onValueChange={setSelectedComponent}>
                      <SelectTrigger className="w-[200px]" id="component-filter" data-testid="select-component-filter">
                        <SelectValue placeholder="All Components" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Components</SelectItem>
                        {costDailyData?.componentNames?.slice().sort((a, b) => a.localeCompare(b)).map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-cost-total-revenue">
                      ${costAnalysisData?.totalRevenue?.toLocaleString() ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {selectedComponent === "all" ? "Total Expected Costs" : `${selectedComponent} Costs`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading || costDailyLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-orange-900 dark:text-orange-100" data-testid="text-cost-expected-cost">
                      ${selectedComponent === "all" 
                        ? (costAnalysisData?.totalExpectedCost?.toLocaleString() ?? 0)
                        : (costDailyData?.totals?.byComponent?.[selectedComponent]?.toLocaleString() ?? 0)}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Expected Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className={`text-2xl font-bold ${(costAnalysisData?.expectedProfit ?? 0) >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`} data-testid="text-cost-expected-profit">
                      ${costAnalysisData?.expectedProfit?.toLocaleString() ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Profit Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className={`text-2xl font-bold ${(costAnalysisData?.profitMargin ?? 0) >= 0 ? "text-purple-700 dark:text-purple-300" : "text-red-700 dark:text-red-300"}`} data-testid="text-cost-profit-margin">
                      {costAnalysisData?.profitMargin ?? 0}%
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Daily Cost Breakdown - {selectedComponent === "all" ? "All Components" : selectedComponent}
                </CardTitle>
                <CardDescription>
                  {selectedComponent === "all" 
                    ? "Daily breakdown of all cost components with revenue and profit"
                    : `Daily ${selectedComponent} costs as a percentage of revenue`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costDailyLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : costDailyData?.dailyData && costDailyData.dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    {selectedComponent === "all" ? (
                      <ComposedChart data={costDailyData.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} tickFormatter={(d) => formatDate(d)} />
                        <YAxis yAxisId="left" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalCost" fill="#e15759" name="Total Cost" />
                        <Bar yAxisId="left" dataKey="revenue" fill="#4e79a7" name="Revenue" />
                        <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#59a14f" strokeWidth={2} name="Profit" dot={false} />
                      </ComposedChart>
                    ) : (
                      <BarChart data={costDailyData.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} tickFormatter={(d) => formatDate(d)} />
                        <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, selectedComponent]} />
                        <Legend />
                        <Bar dataKey={selectedComponent} fill={CHART_COLORS[costDailyData.componentNames.indexOf(selectedComponent) % CHART_COLORS.length]} name={selectedComponent} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No daily cost data available for this period
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cost Component Distribution</CardTitle>
                  <CardDescription>
                    Expected costs by component as percentage of revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : costAnalysisData?.componentBreakdown && costAnalysisData.componentBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={costAnalysisData.componentBreakdown}
                          dataKey="expectedCost"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percentageOfRevenue }) => `${name}: ${percentageOfRevenue}%`}
                        >
                          {costAnalysisData.componentBreakdown.map((entry, index) => (
                            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Expected Cost"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No cost component data available. Add cost components to panel types first.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Component Summary</CardTitle>
                  <CardDescription>
                    Total costs per component for the period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : costAnalysisData?.componentBreakdown && costAnalysisData.componentBreakdown.length > 0 ? (
                    <div className="overflow-auto max-h-[300px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b">
                            <th className="text-left py-3 px-3 font-semibold">Component</th>
                            <th className="text-right py-3 px-3 font-semibold">Expected Cost</th>
                            <th className="text-right py-3 px-3 font-semibold">% of Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costAnalysisData.componentBreakdown.map((comp, idx) => (
                            <tr 
                              key={comp.name} 
                              className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${selectedComponent === comp.name ? 'bg-primary/10' : ''}`}
                              onClick={() => setSelectedComponent(comp.name)}
                              data-testid={`row-cost-component-${idx}`}
                            >
                              <td className="py-3 px-3 flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                />
                                <span className="font-medium">{comp.name}</span>
                                {selectedComponent === comp.name && (
                                  <Badge variant="secondary" className="ml-2 text-xs">Selected</Badge>
                                )}
                              </td>
                              <td className="text-right py-3 px-3 font-mono font-medium">
                                ${comp.expectedCost.toLocaleString()}
                              </td>
                              <td className="text-right py-3 px-3 font-mono">
                                {comp.percentageOfRevenue}%
                              </td>
                            </tr>
                          ))}
                          <tr className="font-bold border-t-2 bg-muted/30">
                            <td className="py-3 px-3">Total</td>
                            <td className="text-right py-3 px-3 font-mono">
                              ${costAnalysisData.totalExpectedCost.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-3 font-mono">
                              {costAnalysisData.totalRevenue > 0 
                                ? Math.round((costAnalysisData.totalExpectedCost / costAnalysisData.totalRevenue) * 100 * 10) / 10 
                                : 0}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No cost component data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Daily Breakdown Table</CardTitle>
                <CardDescription>
                  Detailed daily data for {selectedComponent === "all" ? "all components" : selectedComponent}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costDailyLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : costDailyData?.dailyData && costDailyData.dailyData.length > 0 ? (
                  <div className="overflow-auto max-h-[400px] border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">Date</th>
                          <th className="text-right py-3 px-4 font-semibold">Revenue</th>
                          {selectedComponent === "all" ? (
                            <>
                              {costDailyData.componentNames.map(name => (
                                <th key={name} className="text-right py-3 px-4 font-semibold">{name}</th>
                              ))}
                              <th className="text-right py-3 px-4 font-semibold">Total Cost</th>
                            </>
                          ) : (
                            <th className="text-right py-3 px-4 font-semibold">{selectedComponent}</th>
                          )}
                          <th className="text-right py-3 px-4 font-semibold">Profit</th>
                          <th className="text-right py-3 px-4 font-semibold">Entries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costDailyData.dailyData.map((day, idx) => (
                          <tr key={day.date} className="border-b hover:bg-muted/50" data-testid={`row-daily-cost-${idx}`}>
                            <td className="py-3 px-4 font-medium">{formatDate(day.date)}</td>
                            <td className="text-right py-3 px-4 font-mono text-blue-600 dark:text-blue-400">
                              ${day.revenue.toLocaleString()}
                            </td>
                            {selectedComponent === "all" ? (
                              <>
                                {costDailyData.componentNames.map((name, i) => (
                                  <td key={name} className="text-right py-3 px-4 font-mono" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                                    ${((day[name] as number) || 0).toLocaleString()}
                                  </td>
                                ))}
                                <td className="text-right py-3 px-4 font-mono font-semibold text-orange-600 dark:text-orange-400">
                                  ${day.totalCost.toLocaleString()}
                                </td>
                              </>
                            ) : (
                              <td className="text-right py-3 px-4 font-mono text-orange-600 dark:text-orange-400">
                                ${((day[selectedComponent] as number) || 0).toLocaleString()}
                              </td>
                            )}
                            <td className={`text-right py-3 px-4 font-mono font-semibold ${day.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              ${day.profit.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              {day.entryCount}
                            </td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-muted/50 border-t-2">
                          <td className="py-3 px-4">Total</td>
                          <td className="text-right py-3 px-4 font-mono text-blue-600 dark:text-blue-400">
                            ${costDailyData.totals.revenue.toLocaleString()}
                          </td>
                          {selectedComponent === "all" ? (
                            <>
                              {costDailyData.componentNames.map((name, i) => (
                                <td key={name} className="text-right py-3 px-4 font-mono" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                                  ${(costDailyData.totals.byComponent[name] || 0).toLocaleString()}
                                </td>
                              ))}
                              <td className="text-right py-3 px-4 font-mono text-orange-600 dark:text-orange-400">
                                ${costDailyData.totals.totalCost.toLocaleString()}
                              </td>
                            </>
                          ) : (
                            <td className="text-right py-3 px-4 font-mono text-orange-600 dark:text-orange-400">
                              ${(costDailyData.totals.byComponent[selectedComponent] || 0).toLocaleString()}
                            </td>
                          )}
                          <td className={`text-right py-3 px-4 font-mono ${costDailyData.totals.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${costDailyData.totals.profit.toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4 text-muted-foreground">
                            {costDailyData.totals.entryCount}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No daily cost data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
