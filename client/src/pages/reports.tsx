import { useState } from "react";
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
  projectName: string;
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

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", { period }],
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
    project: s.projectName,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-reports-title">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive time tracking analysis across users, projects, and sheets
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
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
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
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">By Resource</TabsTrigger>
          <TabsTrigger value="sheets" data-testid="tab-sheets">By Sheet</TabsTrigger>
          <TabsTrigger value="daily" data-testid="tab-daily">Daily Trend</TabsTrigger>
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
                  Hours by Project
                </CardTitle>
                <CardDescription>Time distribution across projects</CardDescription>
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
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.bySheet.map((sheet, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{sheet.sheetNumber}</TableCell>
                        <TableCell>{sheet.sheetName || "—"}</TableCell>
                        <TableCell>{sheet.projectName}</TableCell>
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
      </Tabs>
    </div>
  );
}
