import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Eye, Edit, Truck, X, Check, Package, ArrowRight, Lock, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HireBooking, Employee, Job, Supplier, User } from "@shared/schema";
import { ASSET_CATEGORIES } from "@shared/schema";
import { HIRE_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

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
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionDialog, setActionDialog] = useState<{ type: string; booking: HireBookingWithDetails } | null>(null);

  const { data: bookings = [], isLoading } = useQuery<HireBookingWithDetails[]>({
    queryKey: [HIRE_ROUTES.LIST, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`${HIRE_ROUTES.LIST}?${params.toString()}`, { credentials: "include" });
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

  const filteredBookings = useMemo(() => {
    if (!searchQuery) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter((b) =>
      b.bookingNumber.toLowerCase().includes(q) ||
      b.equipmentDescription.toLowerCase().includes(q) ||
      (b.assetCategoryName || "").toLowerCase().includes(q) ||
      (b.supplier?.name || "").toLowerCase().includes(q) ||
      (b.job?.jobNumber || "").toLowerCase().includes(q) ||
      (b.job?.name || "").toLowerCase().includes(q) ||
      (b.requestedBy ? `${b.requestedBy.firstName} ${b.requestedBy.lastName}`.toLowerCase().includes(q) : false)
    );
  }, [bookings, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: bookings.length };
    bookings.forEach((b) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return counts;
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
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

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-hire"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="ALL" data-testid="tab-status-all">
              All ({statusCounts.ALL || 0})
            </TabsTrigger>
            <TabsTrigger value="ON_HIRE" data-testid="tab-status-on-hire">
              On Hire ({statusCounts.ON_HIRE || 0})
            </TabsTrigger>
            <TabsTrigger value="REQUESTED" data-testid="tab-status-requested">
              Requested ({statusCounts.REQUESTED || 0})
            </TabsTrigger>
            <TabsTrigger value="APPROVED" data-testid="tab-status-approved">
              Approved ({statusCounts.APPROVED || 0})
            </TabsTrigger>
            <TabsTrigger value="DRAFT" data-testid="tab-status-draft">
              Draft ({statusCounts.DRAFT || 0})
            </TabsTrigger>
            <TabsTrigger value="RETURNED" data-testid="tab-status-returned">
              Returned ({statusCounts.RETURNED || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking #</TableHead>
                <TableHead>Source</TableHead>
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
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No bookings match your search" : "No hire bookings found. Create your first booking."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBookings.map((booking) => {
                  const overdue = isOverdue(booking);
                  const returnDate = booking.expectedReturnDate || booking.hireEndDate;
                  return (
                    <TableRow key={booking.id} className="hover-elevate" data-testid={`row-hire-${booking.id}`}>
                      <TableCell className="font-mono font-medium" data-testid={`text-booking-number-${booking.id}`}>
                        {booking.bookingNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant={booking.hireSource === "internal" ? "default" : "secondary"} data-testid={`badge-source-${booking.id}`}>
                          {booking.hireSource === "internal" ? "Internal" : "External"}
                        </Badge>
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
                        {booking.requestedBy
                          ? `${booking.requestedBy.firstName} ${booking.requestedBy.lastName}`
                          : "-"}
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
    </div>
  );
}
