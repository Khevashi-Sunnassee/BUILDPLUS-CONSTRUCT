import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { HIRE_ROUTES } from "@shared/api-routes";
import { ASSET_CATEGORIES } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Package,
  Calendar,
  MapPin,
  Briefcase,
  User,
  DollarSign,
  Truck,
  Clock,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface HireBookingItem {
  id: string;
  bookingNumber: string;
  hireSource: string;
  equipmentDescription: string;
  assetCategoryIndex: number;
  assetCategoryName: string;
  status: string;
  hireStartDate: string;
  hireEndDate: string;
  rateType: string;
  rateAmount: string;
  quantity: number;
  hireLocation: string | null;
  notes: string | null;
  createdAt: string;
  job?: { id: string; name: string; jobNumber: string } | null;
  supplier?: { id: string; name: string } | null;
  requestedBy?: { id: string; firstName: string; lastName: string } | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  REQUESTED: { label: "Requested", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  APPROVED: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  BOOKED: { label: "Booked", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  PICKED_UP: { label: "Picked Up", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  ON_HIRE: { label: "On Hire", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  RETURNED: { label: "Returned", color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  CLOSED: { label: "Closed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

const rateTypeLabels: Record<string, string> = {
  day: "/ day",
  week: "/ week",
  month: "/ month",
  custom: "",
};

function formatCurrency(amount: string | number | null) {
  if (amount === null || amount === undefined) return "-";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num);
}

export default function MobileHireBookingsPage() {
  const [selectedBooking, setSelectedBooking] = useState<HireBookingItem | null>(null);

  const { data: bookings = [], isLoading } = useQuery<HireBookingItem[]>({
    queryKey: [HIRE_ROUTES.LIST],
  });

  const onHireBookings = bookings.filter(b => ["ON_HIRE", "PICKED_UP", "BOOKED"].includes(b.status));
  const pendingBookings = bookings.filter(b => ["DRAFT", "REQUESTED", "APPROVED"].includes(b.status));
  const recentReturned = bookings.filter(b => ["RETURNED", "CLOSED"].includes(b.status)).slice(0, 5);

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Hire Equipment">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/dashboard">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-hire-title">Hire Equipment</div>
            <div className="text-sm text-white/60">
              {onHireBookings.length > 0 ? `${onHireBookings.length} currently on hire` : "No items on hire"}
            </div>
          </div>
          <Link href="/mobile/hire-bookings/new">
            <Button size="icon" className="bg-blue-600 text-white" data-testid="button-new-hire">
              <Plus className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No hire bookings yet</p>
            <p className="text-sm text-white/40 mb-4">Book equipment for your jobs</p>
            <Link href="/mobile/hire-bookings/new">
              <Button className="bg-blue-600" data-testid="button-new-hire-empty">
                <Plus className="h-4 w-4 mr-2" />
                Book Equipment
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {onHireBookings.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Currently On Hire ({onHireBookings.length})
                </h2>
                <div className="space-y-3">
                  {onHireBookings.map((b) => (
                    <HireCard key={b.id} booking={b} onSelect={() => setSelectedBooking(b)} />
                  ))}
                </div>
              </div>
            )}

            {pendingBookings.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Pending ({pendingBookings.length})
                </h2>
                <div className="space-y-3">
                  {pendingBookings.map((b) => (
                    <HireCard key={b.id} booking={b} onSelect={() => setSelectedBooking(b)} />
                  ))}
                </div>
              </div>
            )}

            {recentReturned.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Recently Returned
                </h2>
                <div className="space-y-3">
                  {recentReturned.map((b) => (
                    <HireCard key={b.id} booking={b} onSelect={() => setSelectedBooking(b)} muted />
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4">
              <Link href="/mobile/hire-bookings/new">
                <Button className="w-full bg-blue-600" data-testid="button-new-hire-bottom">
                  <Plus className="h-4 w-4 mr-2" />
                  Book Equipment
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedBooking && (
            <HireDetailSheet
              booking={selectedBooking}
              onClose={() => setSelectedBooking(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function HireCard({ booking, onSelect, muted = false }: { booking: HireBookingItem; onSelect: () => void; muted?: boolean }) {
  const status = statusConfig[booking.status] || statusConfig.DRAFT;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/[0.03]" : "bg-white/5"
      )}
      data-testid={`hire-${booking.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate text-white">{booking.bookingNumber}</h3>
            <Badge variant="outline" className={cn("text-xs border flex-shrink-0", status.color)}>
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-white/70 truncate mt-0.5">{booking.equipmentDescription}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-white/40 flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <span className="flex items-center gap-1 truncate">
          {booking.job ? (
            <>
              <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{booking.job.jobNumber}</span>
            </>
          ) : (
            <>
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{format(new Date(booking.hireStartDate), "dd MMM")}</span>
            </>
          )}
        </span>
        <span className="font-medium text-white flex-shrink-0">
          {formatCurrency(booking.rateAmount)}{rateTypeLabels[booking.rateType] || ""}
        </span>
      </div>
    </button>
  );
}

function HireDetailSheet({ booking, onClose }: { booking: HireBookingItem; onClose: () => void }) {
  const status = statusConfig[booking.status] || statusConfig.DRAFT;
  const categoryName = ASSET_CATEGORIES[booking.assetCategoryIndex] || booking.assetCategoryName || "Unknown";

  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-left flex-1 text-white">{booking.bookingNumber}</SheetTitle>
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
        </div>
        <p className="text-sm text-white/60 text-left">{booking.equipmentDescription}</p>
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <DetailField icon={<Package className="h-3.5 w-3.5" />} label="Category" value={categoryName} />
          <DetailField icon={<Clock className="h-3.5 w-3.5" />} label="Source" value={booking.hireSource === "internal" ? "Internal" : "External"} />
          {booking.job && (
            <DetailField icon={<Briefcase className="h-3.5 w-3.5" />} label="Job" value={`${booking.job.jobNumber} - ${booking.job.name}`} />
          )}
          {booking.supplier && (
            <DetailField icon={<Truck className="h-3.5 w-3.5" />} label="Supplier" value={booking.supplier.name} />
          )}
          {booking.requestedBy && (
            <DetailField icon={<User className="h-3.5 w-3.5" />} label="Requested By" value={`${booking.requestedBy.firstName} ${booking.requestedBy.lastName}`} />
          )}
          <DetailField icon={<DollarSign className="h-3.5 w-3.5" />} label="Rate" value={`${formatCurrency(booking.rateAmount)} ${rateTypeLabels[booking.rateType] || ""}`} />
        </div>

        <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/60 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Start Date
            </span>
            <span className="text-white">{format(new Date(booking.hireStartDate), "dd MMM yyyy")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> End Date
            </span>
            <span className="text-white">{format(new Date(booking.hireEndDate), "dd MMM yyyy")}</span>
          </div>
          {booking.quantity > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Quantity</span>
              <span className="text-white">{booking.quantity}</span>
            </div>
          )}
        </div>

        {booking.hireLocation && (
          <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-start gap-2">
            <MapPin className="h-4 w-4 text-white/50 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-white/50">Location</p>
              <p className="text-sm text-white">{booking.hireLocation}</p>
            </div>
          </div>
        )}

        {booking.notes && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Notes</label>
            <p className="text-sm text-white bg-white/5 rounded-lg border border-white/10 p-3">{booking.notes}</p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 mt-4">
        <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose} data-testid="button-close-detail">
          Close
        </Button>
      </div>
    </div>
  );
}

function DetailField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-white/40">{icon}</span>
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <p className="text-sm text-white truncate">{value}</p>
    </div>
  );
}
