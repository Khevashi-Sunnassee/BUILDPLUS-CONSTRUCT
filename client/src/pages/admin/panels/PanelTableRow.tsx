import {
  Hash,
  Edit2,
  Trash2,
  Hammer,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import { MessageCircle, FileText as FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import type { Job, PanelRegister, PanelTypeConfig } from "@shared/schema";
import { PANEL_LIFECYCLE_LABELS, PANEL_LIFECYCLE_COLORS } from "@shared/schema";
import type { PanelWithJob } from "./types";
import { formatNumber, getSourceLabel } from "./types";

interface PanelTableRowProps {
  panel: PanelWithJob;
  consolidationMode: boolean;
  selectedConsolidationPanels: Set<string>;
  onToggleConsolidation: (panelId: string, checked: boolean) => void;
  panelCounts: Record<string, { messageCount: number; documentCount: number }> | undefined;
  showJobColumn: boolean;
  showFactoryColumn: boolean;
  indented: boolean;
  fourthColumnContent: "type" | "job";
  getPanelTypeColor: (panelType: string | null | undefined) => string | null;
  getFactoryName: (factoryId: string | null | undefined) => string;
  getStatusBadge: (status: string) => JSX.Element;
  onOpenBuildDialog: (panel: PanelRegister) => void;
  onOpenQrCode: (panel: PanelWithJob) => void;
  onOpenEditDialog: (panel: PanelRegister) => void;
  onDeletePanel: (panelId: string) => void;
  jobs: Job[] | undefined;
}

export function PanelTableRow({
  panel,
  consolidationMode,
  selectedConsolidationPanels,
  onToggleConsolidation,
  panelCounts,
  showJobColumn,
  showFactoryColumn,
  indented,
  fourthColumnContent,
  getPanelTypeColor,
  getFactoryName,
  getStatusBadge,
  onOpenBuildDialog,
  onOpenQrCode,
  onOpenEditDialog,
  onDeletePanel,
  jobs,
}: PanelTableRowProps) {
  const getLifecycleStatusBadge = (lifecycleStatus: number) => {
    const label = PANEL_LIFECYCLE_LABELS[lifecycleStatus] || "Unknown";
    const colors = PANEL_LIFECYCLE_COLORS[lifecycleStatus] || PANEL_LIFECYCLE_COLORS[0];
    return (
      <Badge variant="outline" className={`text-xs ${colors.bg} ${colors.text} ${colors.border}`} data-testid={`badge-lifecycle-${lifecycleStatus}`}>
        {label}
      </Badge>
    );
  };

  return (
    <TableRow
      key={panel.id}
      data-testid={`row-panel-${panel.id}`}
      style={panel.job.productionSlotColor ? {
        backgroundColor: `${panel.job.productionSlotColor}15`,
        borderLeft: `4px solid ${panel.job.productionSlotColor}`
      } : undefined}
    >
      {consolidationMode && (
        <TableCell className="w-10">
          <Checkbox
            checked={selectedConsolidationPanels.has(panel.id)}
            onCheckedChange={(checked) => {
              onToggleConsolidation(panel.id, !!checked);
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid={`checkbox-consolidate-${panel.id}`}
          />
        </TableCell>
      )}
      {showJobColumn && (
        <TableCell>
          <span className="font-mono text-sm">{panel.job.jobNumber}</span>
        </TableCell>
      )}
      {showFactoryColumn && (
        <TableCell className="text-sm">{getFactoryName(panel.job.factoryId)}</TableCell>
      )}
      <TableCell>
        <div className={`flex items-center gap-2 ${indented ? "pl-6" : ""}`}>
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-medium">{panel.panelMark}</span>
          {(panelCounts?.[panel.id]?.messageCount || 0) > 0 && (
            <Badge className="text-xs gap-0.5 px-1.5 py-0 bg-blue-500 text-white hover:bg-blue-600">
              <MessageCircle className="h-3 w-3" />
              {panelCounts?.[panel.id]?.messageCount}
            </Badge>
          )}
          {(panelCounts?.[panel.id]?.documentCount || 0) > 0 && (
            <Badge variant="outline" className="text-xs gap-0.5 px-1.5 py-0">
              <FileTextIcon className="h-3 w-3" />
              {panelCounts?.[panel.id]?.documentCount}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {fourthColumnContent === "job" ? (
          <span className="text-sm font-mono">{panel.job.jobNumber}</span>
        ) : (
          (() => {
            const typeColor = getPanelTypeColor(panel.panelType);
            return (
              <Badge
                variant="outline"
                style={typeColor ? {
                  backgroundColor: `${typeColor}20`,
                  borderColor: typeColor,
                  color: typeColor
                } : undefined}
              >
                {panel.panelType?.replace("_", " ") || "WALL"}
              </Badge>
            );
          })()
        )}
      </TableCell>
      <TableCell className="text-sm">{panel.building || "-"}</TableCell>
      <TableCell className="text-sm">{panel.level || "-"}</TableCell>
      <TableCell className="text-center">{panel.qty || 1}</TableCell>
      <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadWidth)}</TableCell>
      <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadHeight)}</TableCell>
      <TableCell className="text-right font-mono text-xs">{panel.panelArea ? `${parseFloat(panel.panelArea).toFixed(2)}` : "-"}</TableCell>
      <TableCell className="text-right font-mono text-xs">{panel.panelVolume ? `${parseFloat(panel.panelVolume).toFixed(2)}` : "-"}</TableCell>
      <TableCell className="text-right font-mono text-xs">{panel.concreteStrengthMpa || "-"}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {getSourceLabel(panel.source)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant={panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "default" : "secondary"}
          className={`text-xs ${panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "bg-green-600" : ""}`}
        >
          {panel.documentStatus || "DRAFT"}
        </Badge>
      </TableCell>
      <TableCell>{getLifecycleStatusBadge(panel.lifecycleStatus ?? 0)}</TableCell>
      <TableCell>{getStatusBadge(panel.status)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {panel.approvedForProduction ? (
            <Badge variant="secondary" className="gap-1 mr-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Approved
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onOpenBuildDialog(panel); }}
            title={panel.approvedForProduction ? "Edit production details" : "Set up for production"}
            data-testid={`button-build-panel-${panel.id}`}
          >
            <Hammer className="h-4 w-4 text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onOpenQrCode(panel);
            }}
            title="View QR Code"
            data-testid={`button-qr-panel-${panel.id}`}
          >
            <QrCode className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onOpenEditDialog(panel); }}
            data-testid={`button-edit-panel-${panel.id}`}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDeletePanel(panel.id);
            }}
            data-testid={`button-delete-panel-${panel.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
