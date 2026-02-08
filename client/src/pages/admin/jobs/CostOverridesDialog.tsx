import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UseMutationResult } from "@tanstack/react-query";
import type { JobWithPanels, CostOverride } from "./types";

interface CostOverridesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costOverridesJob: JobWithPanels | null;
  groupedOverrides: Record<string, CostOverride[]>;
  getPanelTypeName: (panelTypeId: string) => string;
  handleUpdateOverride: (id: string, field: "revisedPercentage" | "notes", value: string | null) => void;
  handleSaveOverride: (override: CostOverride) => void;
  initializeCostOverridesMutation: UseMutationResult<any, any, string, any>;
  updateCostOverrideMutation: UseMutationResult<any, any, any, any>;
}

export function CostOverridesDialog({
  open,
  onOpenChange,
  costOverridesJob,
  groupedOverrides,
  getPanelTypeName,
  handleUpdateOverride,
  handleSaveOverride,
  initializeCostOverridesMutation,
  updateCostOverrideMutation,
}: CostOverridesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Cost Overrides - {costOverridesJob?.name}
          </DialogTitle>
          <DialogDescription>
            Modify cost ratios for this job. Default values come from panel type settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {Object.keys(groupedOverrides).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No cost overrides initialized for this job yet.
              </p>
              <Button
                onClick={() => costOverridesJob && initializeCostOverridesMutation.mutate(costOverridesJob.id)}
                disabled={initializeCostOverridesMutation.isPending}
                data-testid="button-initialize-overrides"
              >
                {initializeCostOverridesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Initialize from Panel Type Defaults
              </Button>
            </div>
          ) : (
            Object.entries(groupedOverrides).map(([panelTypeId, overrides]) => (
              <Card key={panelTypeId}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">{getPanelTypeName(panelTypeId)}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead className="text-right w-24">Default %</TableHead>
                        <TableHead className="text-right w-32">Revised %</TableHead>
                        <TableHead className="w-48">Notes</TableHead>
                        <TableHead className="w-20">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overrides.map((override) => (
                        <TableRow key={override.id}>
                          <TableCell className="font-medium">{override.componentName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {parseFloat(override.defaultPercentage).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                placeholder={override.defaultPercentage}
                                value={override.revisedPercentage || ""}
                                onChange={(e) => handleUpdateOverride(override.id, "revisedPercentage", e.target.value || null)}
                                className="w-20 text-right pr-5"
                                data-testid={`input-revised-${override.id}`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Reason for change..."
                              value={override.notes || ""}
                              onChange={(e) => handleUpdateOverride(override.id, "notes", e.target.value || null)}
                              className="text-sm"
                              data-testid={`input-notes-${override.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveOverride(override)}
                              disabled={updateCostOverrideMutation.isPending}
                              data-testid={`button-save-override-${override.id}`}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
