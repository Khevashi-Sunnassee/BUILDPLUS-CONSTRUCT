import {
  Truck,
  Clock,
  Calendar,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileDown,
  QrCode,
  RotateCcw,
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
import type { LoadListWithDetails } from "./types";

export interface CompletedTabProps {
  completedLoadLists: LoadListWithDetails[];
  completedJobOptions: { id: string; jobNumber: string; name: string }[];
  completedJobFilter: string;
  expandedLoadLists: Set<string>;
  isExporting: boolean;
  completedTabRef: React.RefObject<HTMLDivElement | null>;
  setCompletedJobFilter: (value: string) => void;
  toggleExpanded: (id: string) => void;
  printAllQrCodes: (loadList: LoadListWithDetails) => void;
  openReturnDialog: (loadList: LoadListWithDetails) => void;
  onExportPDF: () => void;
  onPrint: () => void;
  onEmail: () => void;
}

export function CompletedTab({
  completedLoadLists,
  completedJobOptions,
  completedJobFilter,
  expandedLoadLists,
  isExporting,
  completedTabRef,
  setCompletedJobFilter,
  toggleExpanded,
  printAllQrCodes,
  openReturnDialog,
  onExportPDF,
  onPrint,
  onEmail,
}: CompletedTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Completed Deliveries ({completedLoadLists.length})
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onExportPDF} disabled={isExporting} data-testid="button-export-completed-pdf">
              {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint} data-testid="button-print-completed">
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={onEmail} data-testid="button-email-completed">
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CardDescription className="flex-1">Load lists that have been delivered</CardDescription>
          <Select value={completedJobFilter} onValueChange={setCompletedJobFilter}>
            <SelectTrigger className="w-[220px]" data-testid="select-completed-job-filter">
              <SelectValue placeholder="Filter by job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {completedJobOptions.map(j => (
                <SelectItem key={j.id} value={j.id}>{j.jobNumber} - {j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent ref={completedTabRef}>
        {completedLoadLists.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No completed deliveries</p>
        ) : (
          <div className="space-y-4">
            {completedLoadLists.map((loadList) => (
              <Card key={loadList.id} className="border bg-muted/30" data-testid={`card-load-list-complete-${loadList.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-6 w-6"
                          onClick={() => toggleExpanded(loadList.id)}
                          data-testid={`button-expand-complete-${loadList.id}`}
                        >
                          {expandedLoadLists.has(loadList.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <h3 className="font-semibold">{loadList.job.jobNumber} - {loadList.job.name}</h3>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Delivered
                        </Badge>
                        <Badge variant="outline">{loadList.panels.length} panels</Badge>
                      </div>
                      {loadList.deliveryRecord && (
                        <div className="mt-2 text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                          {loadList.deliveryRecord.truckRego && (
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {loadList.deliveryRecord.truckRego}
                            </span>
                          )}
                          {loadList.deliveryRecord.loadDocumentNumber && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              Doc# {loadList.deliveryRecord.loadDocumentNumber}
                            </span>
                          )}
                          {loadList.deliveryRecord.deliveryDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {loadList.deliveryRecord.deliveryDate}
                            </span>
                          )}
                          {loadList.deliveryRecord.siteFirstLiftTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              First lift: {loadList.deliveryRecord.siteFirstLiftTime}
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
                        data-testid={`button-print-qr-complete-${loadList.id}`}
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        Print QR
                      </Button>
                      {!loadList.loadReturn && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReturnDialog(loadList)}
                          data-testid={`button-return-load-${loadList.id}`}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Return Load
                        </Button>
                      )}
                      {loadList.loadReturn && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                          {loadList.loadReturn.returnType === "FULL" ? "Full Return" : `Partial Return (${loadList.loadReturn.panels.length} panels)`}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {expandedLoadLists.has(loadList.id) && loadList.panels.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">Panels delivered:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {loadList.panels.sort((a, b) => a.sequence - b.sequence).map((lp) => (
                          <Badge key={lp.id} variant="outline" className="justify-between">
                            <span>{lp.panel.panelMark}</span>
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
