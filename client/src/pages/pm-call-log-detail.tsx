import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { PM_CALL_LOGS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Calendar,
  User,
  Phone as PhoneIcon,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  Send,
  MessageSquare,
} from "lucide-react";

interface CallLogDetail {
  id: string;
  jobId: string;
  jobName: string | null;
  contactName: string;
  contactPhone: string | null;
  callDateTime: string;
  deliveryTime: string | null;
  nextDeliveryDate: string | null;
  draftingConcerns: string | null;
  clientDesignChanges: string | null;
  issuesReported: string | null;
  installationProblems: string | null;
  notes: string | null;
  notifyManager: boolean;
  notifyClient: boolean;
  notifyProduction: boolean;
  updateProductionSchedule: boolean;
  updateDraftingSchedule: boolean;
  createdByName: string | null;
  createdAt: string;
  levels: {
    id: string;
    level: string;
    buildingNumber: number;
    pourLabel: string | null;
    sequenceOrder: number;
    status: "ON_TIME" | "LATE";
    daysLate: number;
    originalStartDate: string | null;
    originalEndDate: string | null;
    adjustedStartDate: string | null;
    adjustedEndDate: string | null;
  }[];
}

export default function PmCallLogDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();

  const { data: log, isLoading } = useQuery<CallLogDetail>({
    queryKey: [PM_CALL_LOGS_ROUTES.LIST, params.id],
    queryFn: async () => {
      const res = await fetch(PM_CALL_LOGS_ROUTES.BY_ID(params.id!), { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!params.id,
  });

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Call log not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/pm-call-logs")}>
          Back to Call Logs
        </Button>
      </div>
    );
  }

  const lateCount = log.levels.filter((l) => l.status === "LATE").length;
  const onTimeCount = log.levels.filter((l) => l.status === "ON_TIME").length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pm-call-logs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-detail-title">
            {log.jobName || "Call Log"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(log.callDateTime).toLocaleString("en-AU", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Call Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Contact</p>
            <p className="font-medium" data-testid="text-contact-name">{log.contactName}</p>
          </div>
          {log.contactPhone && (
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium">{log.contactPhone}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Recorded By</p>
            <p className="font-medium">{log.createdByName || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">{formatDate(log.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      {log.levels.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Pour Schedule Status
              </span>
              <div className="flex items-center gap-2">
                {onTimeCount > 0 && (
                  <Badge variant="secondary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {onTimeCount} On Time
                  </Badge>
                )}
                {lateCount > 0 && (
                  <Badge variant="destructive">
                    <Clock className="h-3 w-3 mr-1" />
                    {lateCount} Late
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {log.levels.map((lvl, idx) => (
                <div
                  key={lvl.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 border-b last:border-0"
                  data-testid={`row-level-${idx}`}
                >
                  <div className="min-w-0">
                    <span className="font-medium text-sm">
                      {lvl.pourLabel ? `${lvl.level} (${lvl.pourLabel})` : lvl.level}
                    </span>
                    {lvl.buildingNumber > 1 && (
                      <Badge variant="outline" className="ml-2">Bldg {lvl.buildingNumber}</Badge>
                    )}
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span>Original: {formatDate(lvl.originalStartDate)} — {formatDate(lvl.originalEndDate)}</span>
                      {lvl.status === "LATE" && lvl.adjustedStartDate && (
                        <span className="text-destructive">
                          Adjusted: {formatDate(lvl.adjustedStartDate)} — {formatDate(lvl.adjustedEndDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {lvl.status === "ON_TIME" ? (
                    <Badge variant="secondary">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      On Time
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <Clock className="h-3 w-3 mr-1" />
                      {lvl.daysLate} days late
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(log.deliveryTime || log.nextDeliveryDate) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Logistics
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {log.deliveryTime && (
              <div>
                <p className="text-xs text-muted-foreground">Delivery Time</p>
                <p className="font-medium">{log.deliveryTime}</p>
              </div>
            )}
            {log.nextDeliveryDate && (
              <div>
                <p className="text-xs text-muted-foreground">Next Delivery Date</p>
                <p className="font-medium">{formatDate(log.nextDeliveryDate)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(log.draftingConcerns || log.clientDesignChanges || log.issuesReported || log.installationProblems || log.notes) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Concerns & Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {log.draftingConcerns && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Drafting Concerns</p>
                <p className="text-sm mt-1">{log.draftingConcerns}</p>
              </div>
            )}
            {log.clientDesignChanges && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Client Design Changes</p>
                <p className="text-sm mt-1">{log.clientDesignChanges}</p>
              </div>
            )}
            {log.issuesReported && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Issues Reported by Client</p>
                <p className="text-sm mt-1">{log.issuesReported}</p>
              </div>
            )}
            {log.installationProblems && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Installation Problems</p>
                <p className="text-sm mt-1">{log.installationProblems}</p>
              </div>
            )}
            {log.notes && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Additional Notes</p>
                <p className="text-sm mt-1">{log.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Actions Taken
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {log.updateProductionSchedule && <Badge>Production Schedule Updated</Badge>}
            {log.updateDraftingSchedule && <Badge>Drafting Schedule Updated</Badge>}
            {log.notifyManager && <Badge variant="secondary">Manager Notified</Badge>}
            {log.notifyClient && <Badge variant="secondary">Client Emailed</Badge>}
            {log.notifyProduction && <Badge variant="secondary">Production Notified</Badge>}
            {!log.updateProductionSchedule && !log.updateDraftingSchedule && !log.notifyManager && !log.notifyClient && !log.notifyProduction && (
              <span className="text-sm text-muted-foreground">No actions were triggered</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
