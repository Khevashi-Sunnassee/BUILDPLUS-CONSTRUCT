import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { dateInputProps } from "@/lib/validation";
import { format, parseISO, isBefore, startOfDay, eachDayOfInterval, addDays, eachMonthOfInterval, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Eye, Edit, Truck, X, Check, Package, ArrowRight, Lock, RotateCcw, BarChart3, AlertTriangle, DollarSign, Printer, Mail, Clock, FileText, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HireBooking, Employee, Job, Supplier, User } from "@shared/schema";
import { ASSET_CATEGORIES } from "@shared/schema";
import { HIRE_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface HireBookingWithDetails extends HireBooking {
  assetCategoryName: string;
  requestedBy: { id: string; firstName: string; lastName: string; employeeNumber: string } | null;
  job: { id: string; name: string; jobNumber: string } | null;
  supplier: { id: string; name: string } | null;
  approvedBy: { id: string; name: string } | null;
}

type StatusFilter = "ALL" | "DRAFT" | "REQUESTED" | "APPROVED" | "BOOKED" | "PICKED_UP" | "ON_HIRE" | "RETURNED" | "CANCELLED" | "CLOSED";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  REQUESTED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  BOOKED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  PICKED_UP: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  ON_HIRE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  RETURNED: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  CLOSED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REQUESTED: "Requested",
  APPROVED: "Approved",
  BOOKED: "Booked",
  PICKED_UP: "Picked Up",
  ON_HIRE: "On Hire",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
};

function isOverdue(booking: HireBookingWithDetails): boolean {
  const now = startOfDay(new Date());
  const returnDate = booking.expectedReturnDate || booking.hireEndDate;
  if (!returnDate) return false;
  const dateToCheck = new Date(returnDate);
  return isBefore(dateToCheck, now) && ["ON_HIRE", "PICKED_UP", "BOOKED"].includes(booking.status);
}

export default function HireBookingsPage() {
  useDocumentTitle("Hire Bookings");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ON_HIRE");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showGraphs, setShowGraphs] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ type: string; booking: HireBookingWithDetails } | null>(null);
  const [emailDialog, setEmailDialog] = useState<HireBookingWithDetails | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");

  const { data: bookings = [], isLoading } = useQuery<HireBookingWithDetails[]>({
    queryKey: [HIRE_ROUTES.LIST],
    queryFn: async () => {
      const res = await fetch(HIRE_ROUTES.LIST, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hire bookings");
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const routeMap: Record<string, (id: string) => string> = {
        submit: HIRE_ROUTES.SUBMIT,
        approve: HIRE_ROUTES.APPROVE,
        reject: HIRE_ROUTES.REJECT,
        book: HIRE_ROUTES.BOOK,
        pickup: HIRE_ROUTES.PICKUP,
        "on-hire": HIRE_ROUTES.ON_HIRE,
        return: HIRE_ROUTES.RETURN,
        cancel: HIRE_ROUTES.CANCEL,
        close: HIRE_ROUTES.CLOSE,
      };
      const routeFn = routeMap[action];
      if (!routeFn) throw new Error("Invalid action");
      await apiRequest("POST", routeFn(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIRE_ROUTES.LIST] });
      toast({ title: "Status updated successfully" });
      setActionDialog(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!emailDialog) throw new Error("No booking selected");
      await apiRequest("POST", HIRE_ROUTES.SEND_EMAIL(emailDialog.id), {
        to: emailTo,
        cc: emailCc || undefined,
        subject: emailSubject || undefined,
        message: emailMessage || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      setEmailDialog(null);
      setEmailTo(""); setEmailCc(""); setEmailSubject(""); setEmailMessage("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send email", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenEmail = (booking: HireBookingWithDetails) => {
    setEmailTo(booking.supplier?.name ? "" : "");
    setEmailSubject(`Equipment Hire Booking ${booking.bookingNumber}`);
    setEmailMessage("");
    setEmailCc("");
    setEmailDialog(booking);
  };

  const handlePrint = (booking: HireBookingWithDetails) => {
    window.open(`/hire-bookings/${booking.id}?print=true`, "_blank");
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set(bookings.map(b => b.assetCategoryName).filter(Boolean));
    return Array.from(cats).sort();
  }, [bookings]);

  const uniqueEquipment = useMemo(() => {
    const equip = new Set(bookings.map(b => b.equipmentDescription).filter(Boolean));
    return Array.from(equip).sort();
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && b.assetCategoryName !== categoryFilter) return false;
      if (equipmentFilter !== "ALL" && b.equipmentDescription !== equipmentFilter) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        const bEnd = new Date(b.expectedReturnDate || b.hireEndDate);
        if (bEnd < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        const bStart = new Date(b.hireStartDate);
        if (bStart > to) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          b.bookingNumber.toLowerCase().includes(q) ||
          b.equipmentDescription.toLowerCase().includes(q) ||
          (b.assetCategoryName || "").toLowerCase().includes(q) ||
          (b.supplier?.name || "").toLowerCase().includes(q) ||
          (b.job?.jobNumber || "").toLowerCase().includes(q) ||
          (b.job?.name || "").toLowerCase().includes(q) ||
          (b.requestedBy ? `${b.requestedBy.firstName} ${b.requestedBy.lastName}`.toLowerCase().includes(q) : false);
        if (!match) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, searchQuery, categoryFilter, equipmentFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: bookings.length };
    bookings.forEach((b) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return counts;
  }, [bookings]);

  const getDailyRate = (booking: HireBookingWithDetails): number => {
    const rate = parseFloat(booking.rateAmount || "0");
    const qty = booking.quantity || 1;
    switch (booking.rateType) {
      case "week": return (rate / 7) * qty;
      case "month": return (rate / 30) * qty;
      default: return rate * qty;
    }
  };

  const activeStatuses = ["APPROVED", "BOOKED", "PICKED_UP", "ON_HIRE", "RETURNED", "CLOSED"];

  const { dailyChartData, monthlyChartData } = useMemo(() => {
    const activeBookings = bookings.filter(b => activeStatuses.includes(b.status));
    if (activeBookings.length === 0) return { dailyChartData: [], monthlyChartData: [] };

    const today = startOfDay(new Date());
    const chartStart = addDays(today, -30);
    const chartEnd = addDays(today, 60);

    const days = eachDayOfInterval({ start: chartStart, end: chartEnd });
    const dailyData = days.map(day => {
      let totalCost = 0;
      activeBookings.forEach(b => {
        const bStart = startOfDay(new Date(b.hireStartDate));
        const bEnd = startOfDay(new Date(b.expectedReturnDate || b.hireEndDate));
        if (day >= bStart && day <= bEnd) {
          totalCost += getDailyRate(b);
        }
      });
      return {
        date: format(day, "dd MMM"),
        fullDate: format(day, "dd/MM/yyyy"),
        cost: Math.round(totalCost * 100) / 100,
      };
    });

    const allStartDates = activeBookings.map(b => new Date(b.hireStartDate));
    const allEndDates = activeBookings.map(b => new Date(b.expectedReturnDate || b.hireEndDate));
    const minDate = new Date(Math.min(...allStartDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allEndDates.map(d => d.getTime())));

    const monthStart = startOfMonth(minDate);
    const monthEnd = endOfMonth(maxDate);
    const months = eachMonthOfInterval({ start: monthStart, end: monthEnd });
    const monthlyData = months.map(month => {
      const mStart = startOfMonth(month);
      const mEnd = endOfMonth(month);
      let totalCost = 0;
      activeBookings.forEach(b => {
        const bStart = startOfDay(new Date(b.hireStartDate));
        const bEnd = startOfDay(new Date(b.expectedReturnDate || b.hireEndDate));
        const overlapStart = new Date(Math.max(bStart.getTime(), mStart.getTime()));
        const overlapEnd = new Date(Math.min(bEnd.getTime(), mEnd.getTime()));
        if (overlapStart <= overlapEnd) {
          const daysInMonth = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          totalCost += getDailyRate(b) * daysInMonth;
        }
      });
      return {
        month: format(month, "MMM yyyy"),
        cost: Math.round(totalCost * 100) / 100,
      };
    });

    return { dailyChartData: dailyData, monthlyChartData: monthlyData };
  }, [bookings]);

  const dashboardStats = useMemo(() => {
    const activeStatuses = ["ON_HIRE", "PICKED_UP", "BOOKED"];
    const activeItems = bookings.filter(b => activeStatuses.includes(b.status));
    const totalDailyCost = activeItems.reduce((sum, b) => sum + getDailyRate(b), 0);
    const overdueItems = bookings.filter(b => isOverdue(b));
    const pendingApproval = bookings.filter(b => b.status === "REQUESTED").length;
    const draftCount = bookings.filter(b => b.status === "DRAFT").length;
    return {
      totalBookings: bookings.length,
      activeCount: activeItems.length,
      pendingApproval,
      draftCount,
      totalDailyCost: Math.round(totalDailyCost * 100) / 100,
      overdueCount: overdueItems.length,
    };
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" role="main" aria-label="Hire Bookings">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" data-testid="text-hire-bookings-title">Hire Bookings</h1>
            <PageHelpButton pageHelpKey="page.hire-bookings" />
          </div>
          <p className="text-sm text-muted-foreground">Manage equipment hire requests and bookings</p>
        </div>
        <Button onClick={() => navigate("/hire-bookings/new")} data-testid="button-new-hire-booking">
          <Plus className="h-4 w-4 mr-2" />
          New Hire Booking
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search hire bookings"
              data-testid="input-search-hire"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-category-filter" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {uniqueCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-equipment-filter" aria-label="Filter by equipment">
              <SelectValue placeholder="Equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Equipment</SelectItem>
              {uniqueEquipment.map(eq => (
                <SelectItem key={eq} value={eq}>{eq}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              {...dateInputProps}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
              placeholder="From"
              data-testid="input-date-from"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              {...dateInputProps}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
              placeholder="To"
              data-testid="input-date-to"
            />
          </div>
          {(categoryFilter !== "ALL" || equipmentFilter !== "ALL" || dateFrom || dateTo || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCategoryFilter("ALL"); setEquipmentFilter("ALL"); setDateFrom(""); setDateTo(""); setSearchQuery(""); }}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="ON_HIRE" data-testid="tab-status-on-hire">
              On Hire ({statusCounts.ON_HIRE || 0})
            </TabsTrigger>
            <TabsTrigger value="ALL" data-testid="tab-status-all">
              All ({statusCounts.ALL || 0})
            </TabsTrigger>
            <TabsTrigger value="DRAFT" data-testid="tab-status-draft">
              Draft ({statusCounts.DRAFT || 0})
            </TabsTrigger>
            <TabsTrigger value="REQUESTED" data-testid="tab-status-requested">
              Requested ({statusCounts.REQUESTED || 0})
            </TabsTrigger>
            <TabsTrigger value="APPROVED" data-testid="tab-status-approved">
              Approved ({statusCounts.APPROVED || 0})
            </TabsTrigger>
            <TabsTrigger value="BOOKED" data-testid="tab-status-booked">
              Booked ({statusCounts.BOOKED || 0})
            </TabsTrigger>
            <TabsTrigger value="RETURNED" data-testid="tab-status-returned">
              Returned ({statusCounts.RETURNED || 0})
            </TabsTrigger>
            <TabsTrigger value="CLOSED" data-testid="tab-status-closed">
              Closed ({statusCounts.CLOSED || 0})
            </TabsTrigger>
            <TabsTrigger value="CANCELLED" data-testid="tab-status-cancelled">
              Cancelled ({statusCounts.CANCELLED || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card data-testid="stat-total-bookings">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-bookings-count">{dashboardStats.totalBookings}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-drafts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-draft-count">{dashboardStats.draftCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-pending-approval">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dashboardStats.pendingApproval > 0 ? "text-amber-600 dark:text-amber-400" : ""}`} data-testid="text-pending-count">
              {dashboardStats.pendingApproval}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active / On Hire</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-count">{dashboardStats.activeCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-daily-cost">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cost / Day</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-daily-cost">
              ${dashboardStats.totalDailyCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-overdue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dashboardStats.overdueCount > 0 ? "text-destructive" : ""}`} data-testid="text-overdue-count">
              {dashboardStats.overdueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {(dailyChartData.length > 0 || monthlyChartData.length > 0) && (
        <div className="space-y-4">
          <Button
            variant={showGraphs ? "default" : "outline"}
            size="sm"
            onClick={() => setShowGraphs(!showGraphs)}
            data-testid="button-toggle-graphs"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showGraphs ? "Hide Graphs" : "View Graphs"}
          </Button>

          {showGraphs && (
          <div className="grid grid-cols-1 gap-4">
          {dailyChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Daily Hire Charges
                </CardTitle>
                <p className="text-xs text-muted-foreground">Cost per day based on equipment on hire (last 30 days to next 60 days)</p>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]" data-testid="chart-daily-hire">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        interval={Math.max(0, Math.floor(dailyChartData.length / 15))}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `$${v.toLocaleString()}`}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Daily Cost"]}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) return (payload[0].payload as any).fullDate;
                          return label;
                        }}
                      />
                      <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {monthlyChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Monthly Hire Cost
                </CardTitle>
                <p className="text-xs text-muted-foreground">Total hire cost per month across all bookings</p>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]" data-testid="chart-monthly-hire">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `$${v.toLocaleString()}`}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Monthly Cost"]}
                      />
                      <Bar dataKey="cost" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking #</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Supplier / Asset</TableHead>
                <TableHead>Hire Period</TableHead>
                <TableHead>Return Due</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No bookings match your search" : "No hire bookings found. Create your first booking."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBookings.map((booking) => {
                  const overdue = isOverdue(booking);
                  const returnDate = booking.expectedReturnDate || booking.hireEndDate;
                  return (
                    <TableRow key={booking.id} className={`hover-elevate ${overdue ? "bg-red-500/15 dark:bg-red-500/20" : ""}`} data-testid={`row-hire-${booking.id}`}>
                      <TableCell className="font-mono font-medium" data-testid={`text-booking-number-${booking.id}`}>
                        {booking.bookingNumber}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" data-testid={`text-equipment-${booking.id}`}>
                        {booking.equipmentDescription}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-category-${booking.id}`}>
                        {booking.assetCategoryName}
                      </TableCell>
                      <TableCell data-testid={`text-job-${booking.id}`}>
                        {booking.job ? (
                          <span className="text-sm">{booking.job.jobNumber}</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell data-testid={`text-supplier-${booking.id}`}>
                        {booking.hireSource === "internal" ? (
                          <span className="text-sm italic">Internal Asset</span>
                        ) : (
                          booking.supplier?.name || "-"
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(booking.hireStartDate), "dd/MM/yy")} - {format(new Date(booking.hireEndDate), "dd/MM/yy")}
                      </TableCell>
                      <TableCell>
                        {returnDate ? (
                          <span className={`text-sm whitespace-nowrap font-medium ${overdue ? "text-destructive" : ""}`} data-testid={`text-return-date-${booking.id}`}>
                            {format(new Date(returnDate), "dd/MM/yy")}
                            {overdue && <span className="ml-1 text-xs">(OVERDUE)</span>}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        ${parseFloat(booking.rateAmount || "0").toFixed(2)} / {booking.rateType}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[booking.status] || ""} data-testid={`badge-status-${booking.id}`}>
                          {STATUS_LABELS[booking.status] || booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-requested-by-${booking.id}`}>
                        {booking.requestedBy ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default font-medium">
                                {booking.requestedBy.firstName.charAt(0)}{booking.requestedBy.lastName.charAt(0)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{booking.requestedBy.firstName} {booking.requestedBy.lastName}</TooltipContent>
                          </Tooltip>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => navigate(`/hire-bookings/${booking.id}`)}
                                data-testid={`button-view-hire-${booking.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View / Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handlePrint(booking)}
                                data-testid={`button-print-hire-${booking.id}`}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Print</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenEmail(booking)}
                                data-testid={`button-email-hire-${booking.id}`}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Email</TooltipContent>
                          </Tooltip>
                          {booking.status === "DRAFT" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setActionDialog({ type: "submit", booking })}
                                  data-testid={`button-submit-hire-${booking.id}`}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Submit for Approval</TooltipContent>
                            </Tooltip>
                          )}
                          {booking.status === "REQUESTED" && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setActionDialog({ type: "approve", booking })}
                                    data-testid={`button-approve-hire-${booking.id}`}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Approve</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setActionDialog({ type: "reject", booking })}
                                    data-testid={`button-reject-hire-${booking.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reject</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {booking.status === "APPROVED" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setActionDialog({ type: "book", booking })}
                                  data-testid={`button-book-hire-${booking.id}`}
                                >
                                  <Package className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark as Booked</TooltipContent>
                            </Tooltip>
                          )}
                          {booking.status === "BOOKED" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setActionDialog({ type: "on-hire", booking })}
                                  data-testid={`button-onhire-hire-${booking.id}`}
                                >
                                  <Truck className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark as On Hire</TooltipContent>
                            </Tooltip>
                          )}
                          {["ON_HIRE", "PICKED_UP"].includes(booking.status) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setActionDialog({ type: "return", booking })}
                                  data-testid={`button-return-hire-${booking.id}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark as Returned</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.type === "submit" && "Submit for Approval"}
              {actionDialog?.type === "approve" && "Approve Booking"}
              {actionDialog?.type === "reject" && "Reject Booking"}
              {actionDialog?.type === "book" && "Confirm Booking"}
              {actionDialog?.type === "on-hire" && "Mark as On Hire"}
              {actionDialog?.type === "return" && "Mark as Returned"}
              {actionDialog?.type === "cancel" && "Cancel Booking"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionDialog?.type === "reject" ? "reject" : `change the status of`} booking{" "}
              <strong>{actionDialog?.booking.bookingNumber}</strong>?
              {actionDialog?.type === "reject" && " This will cancel the booking."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-action">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionDialog) {
                  statusMutation.mutate({
                    id: actionDialog.booking.id,
                    action: actionDialog.type,
                  });
                }
              }}
              disabled={statusMutation.isPending}
              data-testid="button-confirm-action"
            >
              {statusMutation.isPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!emailDialog} onOpenChange={(open) => { if (!open) setEmailDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Hire Booking {emailDialog?.bookingNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="recipient@example.com"
                data-testid="input-list-email-to"
              />
            </div>
            <div className="space-y-2">
              <Label>CC</Label>
              <Input
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                placeholder="cc@example.com (optional)"
                data-testid="input-list-email-cc"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                data-testid="input-list-email-subject"
              />
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Add a message to include in the email..."
                rows={3}
                data-testid="input-list-email-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialog(null)} data-testid="button-cancel-list-email">
              Cancel
            </Button>
            <Button
              onClick={() => sendEmailMutation.mutate()}
              disabled={!emailTo || sendEmailMutation.isPending}
              data-testid="button-send-list-email"
            >
              {sendEmailMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Mail className="h-4 w-4 mr-2" /> Send Email</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
