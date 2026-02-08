import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHelpButton } from "@/components/help/page-help-button";
import { format } from "date-fns";
import { PANELS_ROUTES } from "@shared/api-routes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  MapPin,
  Calendar,
  Ruler,
  Factory,
  Truck,
  CheckCircle,
  Clock,
  FileText,
  ArrowRight,
} from "lucide-react";

interface PanelDetails {
  id: string;
  panelMark: string;
  panelType: string | null;
  panelTypeName: string | null;
  status: string;
  documentStatus: string | null;
  currentZone: string | null;
  zoneName: string | null;
  level: string | null;
  loadWidth: number | null;
  loadHeight: number | null;
  panelThickness: number | null;
  estimatedVolume: number | null;
  estimatedWeight: number | null;
  jobNumber: string | null;
  jobName: string | null;
  productionDate: string | null;
  deliveryDate: string | null;
  factory: string | null;
  createdAt: string;
  history: {
    id: string;
    action: string;
    description: string;
    createdAt: string;
    createdBy: string | null;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  NOT_STARTED: "bg-gray-500",
  BOOKED: "bg-blue-500",
  IN_PROGRESS: "bg-orange-500",
  COMPLETED: "bg-green-500",
  DELIVERED: "bg-purple-500",
};

export default function PanelDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: panel, isLoading, error } = useQuery<PanelDetails>({
    queryKey: [PANELS_ROUTES.DETAILS(id!)],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !panel) {
    return (
      <div className="text-center py-12" data-testid="panel-not-found">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2" data-testid="text-error-title">Panel Not Found</h1>
        <p className="text-muted-foreground" data-testid="text-error-message">The panel you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="panel-details-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-panel-mark">
            <Package className="h-8 w-8" />
            {panel.panelMark}
            <PageHelpButton pageHelpKey="page.panel-details" />
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-job-info">
            {panel.jobNumber} - {panel.jobName}
          </p>
        </div>
        <Badge 
          className={`${STATUS_COLORS[panel.status] || "bg-gray-500"} text-white text-sm px-3 py-1`}
          data-testid="badge-status"
        >
          {panel.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium" data-testid="text-panel-type">{panel.panelTypeName || panel.panelType || "-"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Level</span>
              <span className="font-medium" data-testid="text-level">{panel.level || "-"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dimensions (W x H)</span>
              <span className="font-medium" data-testid="text-dimensions">
                {panel.loadWidth || "-"} x {panel.loadHeight || "-"} mm
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thickness</span>
              <span className="font-medium" data-testid="text-thickness">{panel.panelThickness || "-"} mm</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span className="font-medium" data-testid="text-volume">{panel.estimatedVolume?.toFixed(2) || "-"} m³</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weight</span>
              <span className="font-medium" data-testid="text-weight">{panel.estimatedWeight?.toFixed(0) || "-"} kg</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Zone</span>
              <Badge variant="outline" className="font-medium" data-testid="badge-zone">
                {panel.zoneName || panel.currentZone || "Not assigned"}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Factory</span>
              <span className="font-medium flex items-center gap-1" data-testid="text-factory">
                <Factory className="h-4 w-4" />
                {panel.factory || "-"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Document Status</span>
              <Badge variant="secondary" data-testid="badge-document-status">{panel.documentStatus || "PENDING"}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Production Date</span>
              <span className="font-medium flex items-center gap-1" data-testid="text-production-date">
                <Calendar className="h-4 w-4" />
                {panel.productionDate ? format(new Date(panel.productionDate), "dd/MM/yyyy") : "-"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Date</span>
              <span className="font-medium flex items-center gap-1" data-testid="text-delivery-date">
                <Truck className="h-4 w-4" />
                {panel.deliveryDate ? format(new Date(panel.deliveryDate), "dd/MM/yyyy") : "-"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Panel History
          </CardTitle>
          <CardDescription>Timeline of all events for this panel</CardDescription>
        </CardHeader>
        <CardContent>
          {panel.history.length === 0 ? (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-history">No history recorded yet</p>
          ) : (
            <div className="space-y-4">
              {panel.history.map((event, index) => (
                <div key={event.id} className="flex gap-4" data-testid={`history-item-${index}`}>
                  <div className="flex flex-col items-center">
                    <div className="rounded-full p-2 bg-primary/10">
                      {event.action === "CREATED" && <FileText className="h-4 w-4 text-primary" />}
                      {event.action === "STATUS_CHANGED" && <ArrowRight className="h-4 w-4 text-primary" />}
                      {event.action === "ZONE_CHANGED" && <MapPin className="h-4 w-4 text-primary" />}
                      {event.action === "PRODUCTION" && <Factory className="h-4 w-4 text-primary" />}
                      {event.action === "DELIVERY" && <Truck className="h-4 w-4 text-primary" />}
                      {!["CREATED", "STATUS_CHANGED", "ZONE_CHANGED", "PRODUCTION", "DELIVERY"].includes(event.action) && (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    {index < panel.history.length - 1 && (
                      <div className="w-0.5 h-full bg-border min-h-[24px]" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{event.action.replace(/_/g, " ")}</p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.createdAt), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid={`text-history-description-${index}`}>{event.description}</p>
                    {event.createdBy && (
                      <p className="text-xs text-muted-foreground mt-1">by {event.createdBy}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
