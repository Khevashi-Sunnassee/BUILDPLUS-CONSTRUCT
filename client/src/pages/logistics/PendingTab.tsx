import { differenceInDays } from "date-fns";
import {
  Clock,
  Package,
  Calendar,
  MapPin,
  User,
  Phone,
  CheckCircle,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileDown,
  QrCode,
  Printer,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PanelRegister } from "@shared/schema";
import type { LoadListWithDetails } from "./types";

export interface PendingTabProps {
  pendingLoadLists: LoadListWithDetails[];
  pendingJobOptions: { id: string; jobNumber: string; name: string }[];
  pendingJobFilter: string;
  expandedLoadLists: Set<string>;
  isExporting: boolean;
  pendingTabRef: React.RefObject<HTMLDivElement | null>;
  setPendingJobFilter: (value: string) => void;
  toggleExpanded: (id: string) => void;
  calculateTotalMass: (panels: { panel: PanelRegister }[]) => number;
  printAllQrCodes: (loadList: LoadListWithDetails) => void;
  openDeliveryDialog: (loadList: LoadListWithDetails) => void;
  onDelete: (id: string) => void;
  onExportPDF: () => void;
  onPrint: () => void;
  onEmail: () => void;
}

export function PendingTab({
  pendingLoadLists,
  pendingJobOptions,
  pendingJobFilter,
  expandedLoadLists,
  isExporting,
  pendingTabRef,
  setPendingJobFilter,
  toggleExpanded,
  calculateTotalMass,
  printAllQrCodes,
  openDeliveryDialog,
  onDelete,
  onExportPDF,
  onPrint,
  onEmail,
}: PendingTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Load Lists ({pendingLoadLists.length})
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onExportPDF} disabled={isExporting} data-testid="button-export-pending-pdf">
              {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint} data-testid="button-print-pending">
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={onEmail} data-testid="button-email-pending">
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CardDescription className="flex-1">Load lists awaiting delivery</CardDescription>
          <Select value={pendingJobFilter} onValueChange={setPendingJobFilter}>
            <SelectTrigger className="w-[220px]" data-testid="select-pending-job-filter">
              <SelectValue placeholder="Filter by job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {pendingJobOptions.map(j => (
                <SelectItem key={j.id} value={j.id}>{j.jobNumber} - {j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent ref={pendingTabRef}>
        {pendingLoadLists.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No pending load lists</p>
        ) : (
          <div className="space-y-4">
            {pendingLoadLists.map((loadList) => (
              <Card key={loadList.id} className="border" data-testid={`card-load-list-${loadList.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-6 w-6"
                          onClick={() => toggleExpanded(loadList.id)}
                          data-testid={`button-expand-${loadList.id}`}
                        >
                          {expandedLoadLists.has(loadList.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <h3 className="font-semibold">{loadList.job.jobNumber} - {loadList.job.name}</h3>
                        <Badge variant="outline">{loadList.panels.length} panels</Badge>
                        {loadList.trailerType && (
                          <Badge variant="secondary">{loadList.trailerType.name}</Badge>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                        {loadList.docketNumber && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            Docket: {loadList.docketNumber}
                          </span>
                        )}
                        {loadList.scheduledDate && (() => {
                          const daysUntil = differenceInDays(new Date(loadList.scheduledDate), new Date());
                          const isUrgent = daysUntil >= 0 && daysUntil <= 5;
                          const isOverdue = daysUntil < 0;
                          return (
                            <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-semibold" : isUrgent ? "text-destructive font-medium" : ""}`}>
                              <Calendar className={`h-3 w-3 ${isOverdue || isUrgent ? "text-destructive" : ""}`} />
                              {new Date(loadList.scheduledDate).toLocaleDateString()}
                              {isOverdue && <span className="text-xs">(overdue)</span>}
                              {isUrgent && !isOverdue && <span className="text-xs">({daysUntil === 0 ? "today" : `${daysUntil}d`})</span>}
                            </span>
                          );
                        })()}
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Mass: {calculateTotalMass(loadList.panels).toLocaleString()} kg
                        </span>
                        {loadList.job.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {loadList.job.address}
                          </span>
                        )}
                      </div>
                      {loadList.job.siteContact && (
                        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {loadList.job.siteContact}
                          </span>
                          {loadList.job.siteContactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {loadList.job.siteContactPhone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printAllQrCodes(loadList)}
                        disabled={loadList.panels.length === 0}
                        title="Print all QR codes for panels on this load"
                        data-testid={`button-print-qr-${loadList.id}`}
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        Print QR
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openDeliveryDialog(loadList)}
                        data-testid={`button-record-delivery-${loadList.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Record Delivery
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(loadList.id)}
                        data-testid={`button-delete-${loadList.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {expandedLoadLists.has(loadList.id) && loadList.panels.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">Panels on this load:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {loadList.panels.sort((a, b) => a.sequence - b.sequence).map((lp) => (
                          <Badge key={lp.id} variant="outline" className="justify-between">
                            <span>{lp.panel.panelMark}</span>
                            <span className="text-muted-foreground ml-2">
                              {lp.panel.panelMass ? `${parseFloat(lp.panel.panelMass).toLocaleString()} kg` : ""}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
