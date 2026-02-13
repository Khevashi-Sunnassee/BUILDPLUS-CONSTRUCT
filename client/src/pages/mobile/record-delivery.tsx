import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LOGISTICS_ROUTES, FACTORIES_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronDown,
  Loader2,
  Truck,
  Package,
  MapPin,
  Clock,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import type { Job, TrailerType } from "@shared/schema";

interface Factory {
  id: string;
  name: string;
  address: string | null;
  state: string | null;
}

interface LoadListWithDetails {
  id: string;
  jobId: string;
  trailerTypeId?: string | null;
  docketNumber?: string | null;
  scheduledDate?: string | null;
  loadDate?: string | null;
  notes?: string | null;
  status: string;
  factory: string;
  job: Job;
  trailerType?: TrailerType | null;
  panels: { id: string; panelId: string; sequence: number; panel: { id: string; panelMark: string; panelMass: string | null } }[];
  deliveryRecord?: any;
}

interface CollapsibleSectionProps {
  title: string;
  icon: any;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 active:scale-[0.99]"
        data-testid={`section-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Icon className="h-4 w-4 text-blue-400" />
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="text-xs text-white/60 mb-1.5 block truncate">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20";

export default function MobileRecordDeliveryPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const preselectedLoadListId = params.get("loadListId");

  const [selectedLoadListId, setSelectedLoadListId] = useState(preselectedLoadListId || "");

  const [loadDocumentNumber, setLoadDocumentNumber] = useState("");
  const [loadNumber, setLoadNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [numberPanels, setNumberPanels] = useState<string>("");
  const [truckRego, setTruckRego] = useState("");
  const [trailerRego, setTrailerRego] = useState("");
  const [preload, setPreload] = useState("");
  const [comment, setComment] = useState("");

  const [leaveDepotTime, setLeaveDepotTime] = useState("");
  const [arriveLteTime, setArriveLteTime] = useState("");

  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupArriveTime, setPickupArriveTime] = useState("");
  const [pickupLeaveTime, setPickupLeaveTime] = useState("");

  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [arriveHoldingTime, setArriveHoldingTime] = useState("");
  const [leaveHoldingTime, setLeaveHoldingTime] = useState("");

  const [siteFirstLiftTime, setSiteFirstLiftTime] = useState("");
  const [siteLastLiftTime, setSiteLastLiftTime] = useState("");

  const [returnDepotArriveTime, setReturnDepotArriveTime] = useState("");

  const { data: loadLists = [], isLoading } = useQuery<LoadListWithDetails[]>({
    queryKey: [LOGISTICS_ROUTES.LOAD_LISTS],
  });

  const { data: factories = [] } = useQuery<Factory[]>({
    queryKey: [FACTORIES_ROUTES.LIST],
  });

  const pendingLoadLists = loadLists.filter(l => l.status === "PENDING");
  const selectedLoadList = loadLists.find(l => l.id === selectedLoadListId);

  useEffect(() => {
    if (selectedLoadList) {
      setNumberPanels(String(selectedLoadList.panels?.length || ""));

      const factoryName = selectedLoadList.factory;
      const factory = factories.find(f => f.name === factoryName);
      if (factory?.address) {
        setPickupLocation(factory.address);
      } else if (factoryName === "VIC" || factoryName === "MELB COOLAROO") {
        setPickupLocation("185 ESSPLANADE WEST, VIC");
      }

      if (selectedLoadList.job?.address) {
        setDeliveryLocation(selectedLoadList.job.address);
      }

      if (selectedLoadList.deliveryRecord) {
        const dr = selectedLoadList.deliveryRecord;
        setLoadDocumentNumber(dr.loadDocumentNumber || "");
        setLoadNumber(dr.loadNumber || "");
        setDeliveryDate(dr.deliveryDate || format(new Date(), "yyyy-MM-dd"));
        setNumberPanels(dr.numberPanels ? String(dr.numberPanels) : String(selectedLoadList.panels?.length || ""));
        setTruckRego(dr.truckRego || "");
        setTrailerRego(dr.trailerRego || "");
        setPreload(dr.preload || "");
        setComment(dr.comment || "");
        setLeaveDepotTime(dr.leaveDepotTime || "");
        setArriveLteTime(dr.arriveLteTime || "");
        setPickupLocation(dr.pickupLocation || "");
        setPickupArriveTime(dr.pickupArriveTime || "");
        setPickupLeaveTime(dr.pickupLeaveTime || "");
        setDeliveryLocation(dr.deliveryLocation || "");
        setArriveHoldingTime(dr.arriveHoldingTime || "");
        setLeaveHoldingTime(dr.leaveHoldingTime || "");
        setSiteFirstLiftTime(dr.siteFirstLiftTime || "");
        setSiteLastLiftTime(dr.siteLastLiftTime || "");
        setReturnDepotArriveTime(dr.returnDepotArriveTime || "");
      }
    }
  }, [selectedLoadList?.id, factories.length]);

  const createDeliveryMutation = useMutation({
    mutationFn: async ({ loadListId, data }: { loadListId: string; data: any }) => {
      return apiRequest("POST", LOGISTICS_ROUTES.LOAD_LIST_DELIVERY(loadListId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOGISTICS_ROUTES.LOAD_LISTS] });
      setLocation("/mobile/logistics");
    },
    onError: (error: any) => {
      toast({ title: "Failed to record delivery", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedLoadListId) {
      toast({ title: "Select a load list", description: "Please select a pending load list", variant: "destructive" });
      return;
    }

    const data = {
      loadDocumentNumber: loadDocumentNumber || undefined,
      loadNumber: loadNumber || undefined,
      deliveryDate: deliveryDate || undefined,
      numberPanels: numberPanels ? parseInt(numberPanels) : undefined,
      truckRego: truckRego || undefined,
      trailerRego: trailerRego || undefined,
      preload: preload || undefined,
      comment: comment || undefined,
      leaveDepotTime: leaveDepotTime || undefined,
      arriveLteTime: arriveLteTime || undefined,
      pickupLocation: pickupLocation || undefined,
      pickupArriveTime: pickupArriveTime || undefined,
      pickupLeaveTime: pickupLeaveTime || undefined,
      deliveryLocation: deliveryLocation || undefined,
      arriveHoldingTime: arriveHoldingTime || undefined,
      leaveHoldingTime: leaveHoldingTime || undefined,
      siteFirstLiftTime: siteFirstLiftTime || undefined,
      siteLastLiftTime: siteLastLiftTime || undefined,
      returnDepotArriveTime: returnDepotArriveTime || undefined,
    };

    createDeliveryMutation.mutate({ loadListId: selectedLoadListId, data });
  };

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Record Delivery">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/logistics">
            <Button variant="ghost" size="icon" className="text-white -ml-2" data-testid="button-back">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-xl font-bold" data-testid="text-record-delivery-title">Record Delivery</div>
            <div className="text-sm text-white/60">
              {selectedLoadList ? `${selectedLoadList.job.jobNumber} - ${selectedLoadList.panels.length} panels` : "Select a load list"}
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={createDeliveryMutation.isPending || !selectedLoadListId}
            className="bg-green-600 text-white"
            data-testid="button-save-delivery"
          >
            {createDeliveryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="text-xs text-white/60 mb-1.5 block">Select Load List</label>
          {isLoading ? (
            <Skeleton className="h-10 rounded-xl bg-white/10" />
          ) : (
            <select
              value={selectedLoadListId}
              onChange={(e) => setSelectedLoadListId(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500/50"
              aria-required="true"
              data-testid="select-load-list"
            >
              <option value="" className="bg-[#0D1117]">Select a pending load list...</option>
              {pendingLoadLists.map((ll) => (
                <option key={ll.id} value={ll.id} className="bg-[#0D1117]">
                  {ll.job.jobNumber} - {ll.docketNumber || `Load #${ll.id.slice(-6)}`} ({ll.panels.length} panels)
                </option>
              ))}
            </select>
          )}

          {selectedLoadList && (
            <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{selectedLoadList.job.jobNumber} - {selectedLoadList.job.name}</span>
                <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                  Pending
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                <span>{selectedLoadList.panels.length} panels</span>
                <span>{selectedLoadList.factory}</span>
                {selectedLoadList.trailerType && <span>{selectedLoadList.trailerType.name}</span>}
              </div>
            </div>
          )}
        </div>

        {selectedLoadListId && (
          <>
            <CollapsibleSection title="Load Information" icon={Package} defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Load Document #">
                  <Input
                    placeholder="LD-001"
                    value={loadDocumentNumber}
                    onChange={(e) => setLoadDocumentNumber(e.target.value)}
                    className={inputClass}
                    data-testid="input-load-document"
                  />
                </FormRow>
                <FormRow label="Load Number">
                  <Input
                    placeholder="1"
                    value={loadNumber}
                    onChange={(e) => setLoadNumber(e.target.value)}
                    className={inputClass}
                    data-testid="input-load-number"
                  />
                </FormRow>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Delivery Date">
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className={inputClass}
                    data-testid="input-delivery-date"
                  />
                </FormRow>
                <FormRow label="Number of Panels">
                  <Input
                    type="number"
                    placeholder="0"
                    value={numberPanels}
                    onChange={(e) => setNumberPanels(e.target.value)}
                    className={inputClass}
                    data-testid="input-number-panels"
                  />
                </FormRow>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Truck Rego">
                  <Input
                    placeholder="ABC-123"
                    value={truckRego}
                    onChange={(e) => setTruckRego(e.target.value)}
                    className={inputClass}
                    data-testid="input-truck-rego"
                  />
                </FormRow>
                <FormRow label="Trailer Rego">
                  <Input
                    placeholder="XYZ-456"
                    value={trailerRego}
                    onChange={(e) => setTrailerRego(e.target.value)}
                    className={inputClass}
                    data-testid="input-trailer-rego"
                  />
                </FormRow>
                <FormRow label="Preload">
                  <Input
                    placeholder="Yes/No"
                    value={preload}
                    onChange={(e) => setPreload(e.target.value)}
                    className={inputClass}
                    data-testid="input-preload"
                  />
                </FormRow>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Depot to Site" icon={Clock}>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Leave Depot">
                  <Input
                    type="time"
                    value={leaveDepotTime}
                    onChange={(e) => setLeaveDepotTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-leave-depot"
                  />
                </FormRow>
                <FormRow label="Arrive Site">
                  <Input
                    type="time"
                    value={arriveLteTime}
                    onChange={(e) => setArriveLteTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-arrive-lte"
                  />
                </FormRow>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Pickup Location" icon={MapPin}>
              <FormRow label="Location">
                <Input
                  placeholder="Pickup location"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className={inputClass}
                  data-testid="input-pickup-location"
                />
              </FormRow>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Arrive">
                  <Input
                    type="time"
                    value={pickupArriveTime}
                    onChange={(e) => setPickupArriveTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-pickup-arrive"
                  />
                </FormRow>
                <FormRow label="Leave">
                  <Input
                    type="time"
                    value={pickupLeaveTime}
                    onChange={(e) => setPickupLeaveTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-pickup-leave"
                  />
                </FormRow>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Delivery Location" icon={Truck}>
              <FormRow label="Location">
                <Input
                  placeholder="Delivery location"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  className={inputClass}
                  data-testid="input-delivery-location"
                />
              </FormRow>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Arrive Holding">
                  <Input
                    type="time"
                    value={arriveHoldingTime}
                    onChange={(e) => setArriveHoldingTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-arrive-holding"
                  />
                </FormRow>
                <FormRow label="Leave Holding">
                  <Input
                    type="time"
                    value={leaveHoldingTime}
                    onChange={(e) => setLeaveHoldingTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-leave-holding"
                  />
                </FormRow>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Unloading" icon={Package}>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Site First Lift">
                  <Input
                    type="time"
                    value={siteFirstLiftTime}
                    onChange={(e) => setSiteFirstLiftTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-site-first-lift"
                  />
                </FormRow>
                <FormRow label="Site Last Lift / Leave">
                  <Input
                    type="time"
                    value={siteLastLiftTime}
                    onChange={(e) => setSiteLastLiftTime(e.target.value)}
                    className={inputClass}
                    data-testid="input-site-last-lift"
                  />
                </FormRow>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Return Depot / Reload" icon={Clock}>
              <FormRow label="Arrive">
                <Input
                  type="time"
                  value={returnDepotArriveTime}
                  onChange={(e) => setReturnDepotArriveTime(e.target.value)}
                  className={inputClass}
                  data-testid="input-return-depot-arrive"
                />
              </FormRow>
            </CollapsibleSection>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <FormRow label="Comment">
                <textarea
                  placeholder="Any delivery comments..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-green-500/50"
                  data-testid="input-delivery-comment"
                />
              </FormRow>
            </div>

            <div className="pt-2 pb-4">
              <Button
                onClick={handleSubmit}
                disabled={createDeliveryMutation.isPending || !selectedLoadListId}
                className="w-full bg-green-600 text-white py-6 rounded-2xl text-base font-semibold"
                data-testid="button-submit-delivery"
              >
                {createDeliveryMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2" />
                )}
                Complete Delivery
              </Button>
            </div>
          </>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
