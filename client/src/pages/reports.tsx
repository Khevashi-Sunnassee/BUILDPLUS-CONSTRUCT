import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart3,
  Calendar,
  Clock,
  Download,
  Users,
  FolderOpen,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Truck,
  Package,
  Timer,
  FileDown,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import defaultLogo from "@/assets/lte-logo.png";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

interface SheetData {
  sheetNumber: string;
  sheetName: string;
  totalMinutes: number;
  jobName: string;
}

interface DailyTrend {
  date: string;
  totalMinutes: number;
  userCount: number;
}

interface ResourceDaily {
  userId: string;
  name: string;
  email: string;
  totalMinutes: number;
  activeDays: number;
  dailyBreakdown: Array<{ date: string; minutes: number }>;
}

interface ReportData {
  byUser: Array<{ name: string; email: string; totalMinutes: number; activeDays: number }>;
  byProject: Array<{ name: string; code: string; totalMinutes: number }>;
  byApp: Array<{ app: string; totalMinutes: number }>;
  bySheet: SheetData[];
  dailyTrend: DailyTrend[];
  resourceDaily: ResourceDaily[];
  summary: {
    totalMinutes: number;
    totalUsers: number;
    totalProjects: number;
    totalSheets: number;
    avgMinutesPerDay: number;
  };
}

interface PhaseAverage {
  avgMinutes: number | null;
  formatted: string;
  count: number;
}

interface LogisticsData {
  period: { startDate: string; endDate: string };
  dailyData: Array<{ date: string; panelCount: number; loadListCount: number }>;
  totals: {
    totalPanels: number;
    totalLoadLists: number;
    avgPanelsPerDay: number;
  };
  phaseAverages: {
    depotToLte: PhaseAverage;
    pickupTime: PhaseAverage;
    holdingTime: PhaseAverage;
    unloadTime: PhaseAverage;
  };
}

const COLORS = [
  "hsl(217, 91%, 50%)",
  "hsl(142, 76%, 40%)",
  "hsl(280, 65%, 50%)",
  "hsl(25, 95%, 52%)",
  "hsl(340, 82%, 48%)",
  "hsl(180, 70%, 40%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 72%, 51%)",
];

export default function ReportsPage() {
  const [period, setPeriod] = useState("week");
  const [activeTab, setActiveTab] = useState("overview");
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", { period }],
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: ["/api/settings/logo"],
  });
  const reportLogo = brandingSettings?.logoBase64 || defaultLogo;
  const companyName = brandingSettings?.companyName || "LTE Precast Concrete Structures";

  // Calculate date range for logistics based on period
  const getDateRange = () => {
    const now = new Date();
    const endDate = format(now, "yyyy-MM-dd");
    let startDate: string;
    
    switch (period) {
      case "week":
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = format(weekAgo, "yyyy-MM-dd");
        break;
      case "month":
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = format(monthAgo, "yyyy-MM-dd");
        break;
      case "quarter":
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        startDate = format(quarterAgo, "yyyy-MM-dd");
        break;
      case "year":
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        startDate = format(yearAgo, "yyyy-MM-dd");
        break;
      default:
        const defaultWeekAgo = new Date(now);
        defaultWeekAgo.setDate(defaultWeekAgo.getDate() - 7);
        startDate = format(defaultWeekAgo, "yyyy-MM-dd");
    }
    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  const { data: logistics, isLoading: logisticsLoading } = useQuery<LogisticsData>({
    queryKey: ["/api/reports/logistics", { startDate, endDate }],
  });

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatHours = (minutes: number) => {
    return (minutes / 60).toFixed(1);
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "week": return "Last 7 Days";
      case "month": return "Last 30 Days";
      case "quarter": return "Last 90 Days";
      default: return period;
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
      
      // Draw header background
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pdfWidth, 28, "F");
      
      // Add logo
      const logoSize = 18;
      try {
        pdf.addImage(reportLogo, "PNG", margin, 5, logoSize, logoSize);
      } catch (e) {
        // Logo load failed, continue without it
      }
      
      // Header text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      const reportTitle = activeTab === "logistics" ? `${companyName} Logistics Report` : `${companyName} Analytics Report`;
      pdf.text(reportTitle, margin + logoSize + 8, 14);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${getPeriodLabel()}`, margin + logoSize + 8, 21);
      
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
      pdf.text(`${companyName} - Confidential`, margin, pdfHeight - 5);
      pdf.text("Page 1 of 1", pdfWidth - margin, pdfHeight - 5, { align: "right" });
      
      const fileName = activeTab === "logistics" 
        ? `LTE-Logistics-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`
        : `LTE-Analytics-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}`;
  };

  const userChartData = report?.byUser?.map(u => ({
    name: u.name || u.email.split("@")[0],
    hours: Number(formatHours(u.totalMinutes)),
    days: u.activeDays,
  })) || [];

  const projectChartData = report?.byProject?.map(p => ({
    name: p.code || p.name,
    hours: Number(formatHours(p.totalMinutes)),
  })) || [];

  const appChartData = report?.byApp?.map(a => ({
    name: a.app === "revit" ? "Revit" : "AutoCAD",
    value: a.totalMinutes,
    hours: Number(formatHours(a.totalMinutes)),
  })) || [];

  const dailyChartData = report?.dailyTrend?.map(d => ({
    date: formatDate(d.date),
    hours: Number(formatHours(d.totalMinutes)),
    users: d.userCount,
  })) || [];

  const sheetChartData = report?.bySheet?.slice(0, 10).map(s => ({
    name: s.sheetNumber,
    hours: Number(formatHours(s.totalMinutes)),
    job: s.jobName,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-reports-title">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive time tracking analysis across users, jobs, and sheets
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36" data-testid="select-period">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
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

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatHours(report?.summary?.totalMinutes || 0)}h
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatMinutes(report?.summary?.totalMinutes || 0)} total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{report?.summary?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">With time entries</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Jobs</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{report?.summary?.totalProjects || 0}</div>
                <p className="text-xs text-muted-foreground">With billable time</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Sheets</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{report?.summary?.totalSheets || 0}</div>
                <p className="text-xs text-muted-foreground">Unique sheets</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg. per Day</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatHours(report?.summary?.avgMinutesPerDay || 0)}h
                </div>
                <p className="text-xs text-muted-foreground">Per user per day</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div ref={reportRef}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex print:hidden">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">By Resource</TabsTrigger>
          <TabsTrigger value="sheets" data-testid="tab-sheets">By Sheet</TabsTrigger>
          <TabsTrigger value="daily" data-testid="tab-daily">Daily Trend</TabsTrigger>
          <TabsTrigger value="logistics" data-testid="tab-logistics">Logistics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Hours by User
                </CardTitle>
                <CardDescription>Time tracked per team member</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : userChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={userChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value}h`, "Hours"]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      />
                      <Bar dataKey="hours" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Hours by Job
                </CardTitle>
                <CardDescription>Time distribution across jobs</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : projectChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value}h`, "Hours"]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      />
                      <Bar dataKey="hours" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Application Distribution
                </CardTitle>
                <CardDescription>Time split between Revit and AutoCAD</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : appChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={appChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, hours }) => `${name}: ${hours}h`}
                      >
                        {appChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip 
                        formatter={(value: number) => [formatMinutes(value), "Time"]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Summary</CardTitle>
                <CardDescription>Time and active days per user</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report?.byUser?.slice(0, 5).map((user, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{user.name || user.email}</TableCell>
                          <TableCell className="text-right">{formatHours(user.totalMinutes)}h</TableCell>
                          <TableCell className="text-right">{user.activeDays}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Time by Resource (Daily Breakdown)
              </CardTitle>
              <CardDescription>Daily hours tracked per team member</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : report?.resourceDaily && report.resourceDaily.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value}h`, "Hours"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Area type="monotone" dataKey="hours" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resource Details</CardTitle>
              <CardDescription>Complete breakdown by team member</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead className="text-right">Active Days</TableHead>
                      <TableHead className="text-right">Avg/Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report?.resourceDaily?.map((resource, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{resource.name || "—"}</TableCell>
                        <TableCell>{resource.email}</TableCell>
                        <TableCell className="text-right">{formatHours(resource.totalMinutes)}h</TableCell>
                        <TableCell className="text-right">{resource.activeDays}</TableCell>
                        <TableCell className="text-right">
                          {formatHours(resource.activeDays > 0 ? resource.totalMinutes / resource.activeDays : 0)}h
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sheets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Time per Sheet (Top 10)
              </CardTitle>
              <CardDescription>Hours spent on individual Revit sheets</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : sheetChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={sheetChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number, name: any, props: any) => [`${value}h (${props.payload.project})`, "Hours"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Bar dataKey="hours" fill={COLORS[2]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  No sheet data available (requires Revit tracking with sheet info)
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Sheets</CardTitle>
              <CardDescription>Complete sheet time breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : report?.bySheet && report.bySheet.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sheet Number</TableHead>
                      <TableHead>Sheet Name</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.bySheet.map((sheet, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{sheet.sheetNumber}</TableCell>
                        <TableCell>{sheet.sheetName || "—"}</TableCell>
                        <TableCell>{sheet.jobName}</TableCell>
                        <TableCell className="text-right">{formatHours(sheet.totalMinutes)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-[100px] text-muted-foreground">
                  No sheet data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Hours Trend
              </CardTitle>
              <CardDescription>Total hours tracked per day</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : dailyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === "hours" ? `${value}h` : value,
                        name === "hours" ? "Hours" : "Users"
                      ]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="hours" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="users" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>Hours and users per day</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Active Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report?.dailyTrend?.map((day, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{day.date}</TableCell>
                        <TableCell className="text-right">{formatHours(day.totalMinutes)}h</TableCell>
                        <TableCell className="text-right">{day.userCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-2">
                <CardTitle className="text-sm font-medium">Panels Shipped</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {logisticsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-total-panels">
                      {logistics?.totals.totalPanels || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Across {logistics?.totals.totalLoadLists || 0} deliveries
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-2">
                <CardTitle className="text-sm font-medium">Avg Panels/Day</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {logisticsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-avg-panels">
                      {logistics?.totals.avgPanelsPerDay || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Per delivery day</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 gap-2">
                <CardTitle className="text-sm font-medium">Deliveries</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {logisticsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-total-deliveries">
                      {logistics?.totals.totalLoadLists || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Completed load lists</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Panels Shipped per Day
                </CardTitle>
                <CardDescription>Daily panel delivery counts</CardDescription>
              </CardHeader>
              <CardContent>
                {logisticsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : logistics?.dailyData && logistics.dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={logistics.dailyData.map(d => ({
                      date: formatDate(d.date),
                      panels: d.panelCount,
                      loads: d.loadListCount,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          value, 
                          name === "panels" ? "Panels" : "Load Lists"
                        ]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      />
                      <Legend />
                      <Bar dataKey="panels" name="Panels" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="loads" name="Load Lists" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No delivery data available for this period
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Delivery Phase Timings
                </CardTitle>
                <CardDescription>Average time spent in each delivery phase</CardDescription>
              </CardHeader>
              <CardContent>
                {logisticsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : logistics?.phaseAverages ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[0] }} />
                          <div>
                            <p className="font-medium">Depot to LTE</p>
                            <p className="text-xs text-muted-foreground">Leave depot → Arrive LTE</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" data-testid="text-depot-to-lte">{logistics.phaseAverages.depotToLte.formatted}</p>
                          <p className="text-xs text-muted-foreground">{logistics.phaseAverages.depotToLte.count} records</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[1] }} />
                          <div>
                            <p className="font-medium">Pickup Time</p>
                            <p className="text-xs text-muted-foreground">Arrive pickup → Leave pickup</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" data-testid="text-pickup-time">{logistics.phaseAverages.pickupTime.formatted}</p>
                          <p className="text-xs text-muted-foreground">{logistics.phaseAverages.pickupTime.count} records</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[2] }} />
                          <div>
                            <p className="font-medium">Holding Time</p>
                            <p className="text-xs text-muted-foreground">Arrive holding → Leave holding</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" data-testid="text-holding-time">{logistics.phaseAverages.holdingTime.formatted}</p>
                          <p className="text-xs text-muted-foreground">{logistics.phaseAverages.holdingTime.count} records</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[3] }} />
                          <div>
                            <p className="font-medium">Unload Time</p>
                            <p className="text-xs text-muted-foreground">First lift → Last lift</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" data-testid="text-unload-time">{logistics.phaseAverages.unloadTime.formatted}</p>
                          <p className="text-xs text-muted-foreground">{logistics.phaseAverages.unloadTime.count} records</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No timing data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily Delivery Breakdown</CardTitle>
              <CardDescription>Panels and load lists delivered each day</CardDescription>
            </CardHeader>
            <CardContent>
              {logisticsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : logistics?.dailyData && logistics.dailyData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Panels</TableHead>
                      <TableHead className="text-right">Load Lists</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logistics.dailyData.map((day, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{day.date}</TableCell>
                        <TableCell className="text-right">{day.panelCount}</TableCell>
                        <TableCell className="text-right">{day.loadListCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-[100px] text-muted-foreground">
                  No delivery data for this period
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
