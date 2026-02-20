import {
  Layers,
  Plus,
  Loader2,
  FileDown,
  Printer,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job, PanelRegister } from "@shared/schema";

export interface ReadyTabProps {
  filteredReadyPanels: (PanelRegister & { job: Job })[];
  readyPanelsLoading: boolean;
  readyPanelsError: boolean;
  selectedReadyPanels: Set<string>;
  readyPanelJobFilter: string;
  readyPanelJobs: { id: string; jobNumber: string; name: string }[];
  isExporting: boolean;
  createFromReadyPending: boolean;
  readyTabRef: React.RefObject<HTMLDivElement | null>;
  getPanelTypeColor: (panelType: string | null | undefined) => string | null;
  toggleReadyPanel: (panelId: string) => void;
  toggleAllReadyPanels: () => void;
  handleCreateFromReady: () => void;
  onJobFilterChange: (value: string) => void;
  onExportPDF: () => void;
  onPrint: () => void;
  onEmail: () => void;
}

export function ReadyTab({
  filteredReadyPanels,
  readyPanelsLoading,
  readyPanelsError,
  selectedReadyPanels,
  readyPanelJobFilter,
  readyPanelJobs,
  isExporting,
  createFromReadyPending,
  readyTabRef,
  getPanelTypeColor,
  toggleReadyPanel,
  toggleAllReadyPanels,
  handleCreateFromReady,
  onJobFilterChange,
  onExportPDF,
  onPrint,
  onEmail,
}: ReadyTabProps) {
  return (
    <Card data-testid="card-ready-to-load">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Panels Ready to Load ({filteredReadyPanels.length})
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedReadyPanels.size > 0 && (
              <>
                <Badge variant="secondary" data-testid="badge-selected-count">{selectedReadyPanels.size} selected</Badge>
                <Button
                  onClick={handleCreateFromReady}
                  disabled={createFromReadyPending}
                  data-testid="button-create-from-ready"
                >
                  {createFromReadyPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Loading List
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={onExportPDF} disabled={isExporting} data-testid="button-export-ready-pdf">
              {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint} data-testid="button-print-ready">
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={onEmail} data-testid="button-email-ready">
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CardDescription className="flex-1">Produced panels not yet on a load list</CardDescription>
          <Select value={readyPanelJobFilter} onValueChange={onJobFilterChange}>
            <SelectTrigger className="w-[220px]" data-testid="select-ready-panel-job-filter">
              <SelectValue placeholder="Filter by job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {readyPanelJobs.map(j => (
                <SelectItem key={j.id} value={j.id}>{j.jobNumber} - {j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent ref={readyTabRef}>
        {readyPanelsError ? (
          <p className="text-destructive text-center py-8" data-testid="text-ready-panels-error">Failed to load panels. Please try refreshing the page.</p>
        ) : readyPanelsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filteredReadyPanels.length === 0 ? (
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-ready-panels">No panels ready to load</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredReadyPanels.length > 0 && selectedReadyPanels.size === filteredReadyPanels.length}
                      onCheckedChange={toggleAllReadyPanels}
                      data-testid="checkbox-select-all-ready"
                    />
                  </TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Panel Mark</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-center w-12">Qty</TableHead>
                  <TableHead className="text-right w-24">Width (mm)</TableHead>
                  <TableHead className="text-right w-24">Height (mm)</TableHead>
                  <TableHead className="text-right w-20">Area (m²)</TableHead>
                  <TableHead className="text-right w-20">Vol (m³)</TableHead>
                  <TableHead className="text-right w-24">Weight (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReadyPanels.map(panel => {
                  const typeColor = getPanelTypeColor(panel.panelType);
                  return (
                    <TableRow
                      key={panel.id}
                      data-testid={`row-ready-panel-${panel.id}`}
                      className="cursor-pointer"
                      style={typeColor ? {
                        borderLeft: `3px solid ${typeColor}`,
                      } : undefined}
                      onClick={() => toggleReadyPanel(panel.id)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedReadyPanels.has(panel.id)}
                          onCheckedChange={() => toggleReadyPanel(panel.id)}
                          data-testid={`checkbox-ready-${panel.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-sm font-mono" data-testid={`cell-job-${panel.id}`}>
                        {panel.job.jobNumber}
                      </TableCell>
                      <TableCell data-testid={`cell-mark-${panel.id}`}>
                        <div className="flex items-center gap-2">
                          {typeColor && (
                            <span className="w-2 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: typeColor }} />
                          )}
                          <span className="font-mono font-medium">{panel.panelMark}</span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`cell-type-${panel.id}`}>
                        {typeColor ? (
                          <Badge variant="outline" className="text-xs" style={{ borderColor: typeColor, color: typeColor }}>
                            {panel.panelType}
                          </Badge>
                        ) : (
                          <span className="text-sm">{panel.panelType}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`cell-building-${panel.id}`}>{panel.building || "-"}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-level-${panel.id}`}>{panel.level || "-"}</TableCell>
                      <TableCell className="text-center" data-testid={`cell-qty-${panel.id}`}>{panel.qty || 1}</TableCell>
                      <TableCell className="text-right font-mono text-xs" data-testid={`cell-width-${panel.id}`}>
                        {panel.loadWidth ? parseFloat(panel.loadWidth).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" data-testid={`cell-height-${panel.id}`}>
                        {panel.loadHeight ? parseFloat(panel.loadHeight).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" data-testid={`cell-area-${panel.id}`}>
                        {panel.panelArea ? parseFloat(panel.panelArea).toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" data-testid={`cell-volume-${panel.id}`}>
                        {panel.panelVolume ? parseFloat(panel.panelVolume).toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold" data-testid={`cell-weight-${panel.id}`}>
                        {panel.panelMass ? `${parseFloat(panel.panelMass).toLocaleString()}` : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
