import { useState, useRef } from "react";
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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  byPanel: Record<string, { panelMark: string; minutes: number; projectName: string }>;
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
    byPanel: Array<{ panelMark: string; minutes: number; hours: number; projectName: string }>;
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
  const [periodType, setPeriodType] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [activeTab, setActiveTab] = useState("production");
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const getDateRange = () => {
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
  };

  const { startDate, endDate } = getDateRange();

  const { data: productionData, isLoading: productionLoading } = useQuery<ProductionReportResponse>({
    queryKey: ["/api/reports/production-daily", { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: productionCostsData, isLoading: costsLoading } = useQuery<ProductionCostsReportResponse>({
    queryKey: ["/api/reports/production-with-costs", { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: draftingData, isLoading: draftingLoading } = useQuery<DraftingReportResponse>({
    queryKey: ["/api/reports/drafting-daily", { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const { data: costAnalysisData, isLoading: costAnalysisLoading } = useQuery<CostAnalysisResponse>({
    queryKey: ["/api/reports/cost-analysis", { startDate, endDate }],
    enabled: !!startDate && !!endDate,
  });

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}`;
  };

  const getPeriodLabel = () => {
    if (startDate && endDate) {
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      return `${start} - ${end}`;
    }
    return "";
  };

  const getMonthName = () => {
    if (startDate) {
      const date = new Date(startDate);
      return format(date, "MMMM yyyy");
    }
    return "";
  };

  const panelsDailyChartData = productionData?.dailyData?.map((d) => {
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
  }) || [];

  const cubesDailyChartData = productionData?.dailyData?.map((d) => {
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
  }) || [];

  const financialChartData = productionCostsData?.dailyData?.map((d) => ({
    date: formatDate(d.date),
    cost: d.totalCost,
    revenue: d.revenue,
    profit: d.profit,
  })) || [];

  const draftingChartData = draftingData?.dailyData?.map((d) => ({
    date: formatDate(d.date),
    activeHours: d.activeHours,
    idleHours: Math.round((d.idleMinutes / 60) * 100) / 100,
    totalHours: d.totalHours,
  })) || [];

  const allPanelTypes = productionData?.panelTypes || [];

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1400,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const headerHeight = 25;
      const margin = 5;
      const usableHeight = pdfHeight - headerHeight - margin;
      const usableWidth = pdfWidth - (margin * 2);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const imgRatio = imgWidth / imgHeight;
      let scaledWidth = usableWidth;
      let scaledHeight = scaledWidth / imgRatio;
      
      if (scaledHeight > usableHeight) {
        scaledHeight = usableHeight;
        scaledWidth = scaledHeight * imgRatio;
      }
      
      const totalPages = Math.ceil((scaledHeight * imgHeight / canvas.height) / usableHeight);
      const pageImgHeight = (usableHeight / scaledHeight) * imgHeight;
      
      pdf.setFontSize(14);
      pdf.text("LTE Performance Report", pdfWidth / 2, 8, { align: "center" });
      pdf.setFontSize(9);
      pdf.text(`Period: ${getPeriodLabel()} | Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pdfWidth / 2, 14, { align: "center" });
      
      if (scaledHeight <= usableHeight) {
        const imgX = (pdfWidth - scaledWidth) / 2;
        pdf.addImage(imgData, "PNG", imgX, headerHeight, scaledWidth, scaledHeight);
      } else {
        const fitToPageRatio = usableWidth / imgWidth;
        const fitHeight = imgHeight * fitToPageRatio;
        
        if (fitHeight > usableHeight) {
          const finalRatio = Math.min(usableWidth / imgWidth, usableHeight / imgHeight);
          const finalWidth = imgWidth * finalRatio;
          const finalHeight = imgHeight * finalRatio;
          const imgX = (pdfWidth - finalWidth) / 2;
          pdf.addImage(imgData, "PNG", imgX, headerHeight, finalWidth, finalHeight);
        } else {
          const imgX = (pdfWidth - imgWidth * fitToPageRatio) / 2;
          pdf.addImage(imgData, "PNG", imgX, headerHeight, usableWidth, fitHeight);
        }
      }
      
      pdf.save(`LTE-Performance-Report-${startDate}-${endDate}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = productionLoading || costsLoading || draftingLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-6 w-6" />
            KPI Dashboard
          </h1>
          <p className="text-muted-foreground">
            Performance metrics and daily reporting
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
          <TabsList className="grid w-full grid-cols-4">
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
                  <div className="text-xl font-bold text-gray-500" data-testid="text-unassigned-hours">
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
                            <th className="text-left py-2 font-medium">Project</th>
                            <th className="text-right py-2 font-medium">Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftingData.totals.byPanel.slice(0, 10).map((panel, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2 font-mono">{panel.panelMark}</td>
                              <td className="py-2 text-muted-foreground">{panel.projectName}</td>
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

          <TabsContent value="cost-analysis" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold" data-testid="text-cost-total-revenue">
                      ${costAnalysisData?.totalRevenue?.toLocaleString() ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Expected Costs</CardTitle>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-destructive" data-testid="text-cost-expected-cost">
                      ${costAnalysisData?.totalExpectedCost?.toLocaleString() ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Expected Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className={`text-2xl font-bold ${(costAnalysisData?.expectedProfit ?? 0) >= 0 ? "text-green-600" : "text-destructive"}`} data-testid="text-cost-expected-profit">
                      ${costAnalysisData?.expectedProfit?.toLocaleString() ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  {costAnalysisLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className={`text-2xl font-bold ${(costAnalysisData?.profitMargin ?? 0) >= 0 ? "text-green-600" : "text-destructive"}`} data-testid="text-cost-profit-margin">
                      {costAnalysisData?.profitMargin ?? 0}%
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cost Component Breakdown</CardTitle>
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
                  <CardTitle>Cost Component Table</CardTitle>
                  <CardDescription>
                    Detailed breakdown of expected costs
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
                            <th className="text-left py-2 px-2">Component</th>
                            <th className="text-right py-2 px-2">Expected Cost</th>
                            <th className="text-right py-2 px-2">% of Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costAnalysisData.componentBreakdown.map((comp, idx) => (
                            <tr key={comp.name} className="border-b hover:bg-muted/50" data-testid={`row-cost-component-${idx}`}>
                              <td className="py-2 px-2 flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                />
                                {comp.name}
                              </td>
                              <td className="text-right py-2 px-2 font-mono">
                                ${comp.expectedCost.toLocaleString()}
                              </td>
                              <td className="text-right py-2 px-2 font-mono">
                                {comp.percentageOfRevenue}%
                              </td>
                            </tr>
                          ))}
                          <tr className="font-bold border-t-2">
                            <td className="py-2 px-2">Total</td>
                            <td className="text-right py-2 px-2 font-mono">
                              ${costAnalysisData.totalExpectedCost.toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-2 font-mono">
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
                <CardTitle>Cost Component Bar Chart</CardTitle>
                <CardDescription>
                  Comparison of expected costs by component
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costAnalysisLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : costAnalysisData?.componentBreakdown && costAnalysisData.componentBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart 
                      data={costAnalysisData.componentBreakdown} 
                      layout="vertical"
                      margin={{ left: 100 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                      <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Expected Cost"]} />
                      <Bar dataKey="expectedCost" fill="#4e79a7" name="Expected Cost">
                        {costAnalysisData.componentBreakdown.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No cost component data for this period
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
