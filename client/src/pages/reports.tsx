import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
  BarChart3,
  Calendar,
  Clock,
  Download,
  Filter,
  Users,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "recharts";

interface ReportData {
  byUser: Array<{ name: string; email: string; totalMinutes: number; activeDays: number }>;
  byProject: Array<{ name: string; code: string; totalMinutes: number }>;
  byApp: Array<{ app: string; totalMinutes: number }>;
  weeklyTrend: Array<{ week: string; revit: number; acad: number }>;
  summary: {
    totalMinutes: number;
    totalUsers: number;
    totalProjects: number;
    avgMinutesPerDay: number;
  };
}

const COLORS = ["hsl(217, 91%, 35%)", "hsl(142, 76%, 28%)", "hsl(280, 65%, 38%)", "hsl(25, 95%, 42%)", "hsl(340, 82%, 38%)"];

export default function ReportsPage() {
  const [period, setPeriod] = useState("week");
  const [groupBy, setGroupBy] = useState("user");

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", { period, groupBy }],
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-reports-title">
            Reports
          </h1>
          <p className="text-muted-foreground">
            Analyze time tracking data across users and projects
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

      <div className="grid gap-4 md:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Weekly Trend
            </CardTitle>
            <CardDescription>Hours by application over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report?.weeklyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="revit" name="Revit" fill="hsl(217, 91%, 35%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="acad" name="AutoCAD" fill="hsl(142, 76%, 28%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              By Application
            </CardTitle>
            <CardDescription>Time distribution between apps</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report?.byApp || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="totalMinutes"
                      nameKey="app"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {(report?.byApp || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatMinutes(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Time by User
          </CardTitle>
          <CardDescription>Individual user contribution</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Active Days</TableHead>
                    <TableHead className="text-right">Avg/Day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report?.byUser || []).map((user, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatHours(user.totalMinutes)}h
                      </TableCell>
                      <TableCell className="text-right">{user.activeDays}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {user.activeDays > 0 ? formatHours(user.totalMinutes / user.activeDays) : 0}h
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!report?.byUser || report.byUser.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No data available for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Time by Project
          </CardTitle>
          <CardDescription>Project-level breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report?.byProject || []).map((project, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-muted-foreground">{project.code || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatHours(project.totalMinutes)}h
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {report?.summary?.totalMinutes ? ((project.totalMinutes / report.summary.totalMinutes) * 100).toFixed(1) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!report?.byProject || report.byProject.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No data available for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
