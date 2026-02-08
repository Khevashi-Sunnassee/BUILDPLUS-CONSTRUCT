import { Loader2, AlertCircle, Save, Plus } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UseFormReturn } from "react-hook-form";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import type { JobFormData, ProductionSlotStatus } from "./types";

interface DeleteJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deletingJobPanelCount: number;
  deletingJobId: string | null;
  deleteJobMutation: UseMutationResult<any, any, string, any>;
}

export function DeleteJobDialog({
  open,
  onOpenChange,
  deletingJobPanelCount,
  deletingJobId,
  deleteJobMutation,
}: DeleteJobDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Job?</AlertDialogTitle>
          {deletingJobPanelCount > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-md">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  This job has <strong>{deletingJobPanelCount} panel(s)</strong> registered and cannot be deleted.
                  Please delete or reassign the panels first.
                </p>
              </div>
            </div>
          ) : (
            <AlertDialogDescription>
              This will permanently delete this job. This action cannot be undone.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {deletingJobPanelCount === 0 && (
            <AlertDialogAction
              onClick={() => deletingJobId && deleteJobMutation.mutate(deletingJobId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteJobMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CycleTimesConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionSlotStatus: ProductionSlotStatus | null;
  pendingJobId: string | null;
  editingJob: Job | null;
  jobForm: UseFormReturn<JobFormData>;
  setPendingJobId: (id: string | null) => void;
  setJobDialogOpen: (open: boolean) => void;
  setEditingJob: (job: Job | null) => void;
  updateProductionSlotsMutation: UseMutationResult<any, any, { jobId: string; action: "create" | "update" }, any>;
}

export function CycleTimesConfirmDialog({
  open,
  onOpenChange,
  productionSlotStatus,
  pendingJobId,
  editingJob,
  jobForm,
  setPendingJobId,
  setJobDialogOpen,
  setEditingJob,
  updateProductionSlotsMutation,
}: CycleTimesConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Production Slots?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {productionSlotStatus && !productionSlotStatus.hasSlots ? (
                <p>No production slots exist for this job. Would you like to create them now using the new cycle times?</p>
              ) : productionSlotStatus?.hasNonStartedSlots ? (
                <p>
                  This job has {productionSlotStatus.nonStartedCount} production slot(s) that haven't started yet. 
                  Would you like to update their dates based on the new cycle times?
                </p>
              ) : (
                <p>All production slots for this job have already started or been completed. No updates needed.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => {
              setPendingJobId(null);
              setJobDialogOpen(false);
              setEditingJob(null);
              jobForm.reset();
            }}
            data-testid="button-skip-production-update"
          >
            {productionSlotStatus?.hasSlots && !productionSlotStatus?.hasNonStartedSlots ? "Close" : "Skip"}
          </AlertDialogCancel>
          {productionSlotStatus && (!productionSlotStatus.hasSlots || productionSlotStatus.hasNonStartedSlots) && (
            <AlertDialogAction
              onClick={() => {
                const jobId = pendingJobId || editingJob?.id;
                if (!jobId) return;
                const action = productionSlotStatus.hasSlots ? "update" : "create";
                updateProductionSlotsMutation.mutate({ jobId, action });
              }}
              disabled={updateProductionSlotsMutation.isPending}
              data-testid="button-confirm-production-update"
            >
              {updateProductionSlotsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {productionSlotStatus.hasSlots ? "Update Slots" : "Create Slots"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface LevelChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingJobId: string | null;
  productionSlotStatus: ProductionSlotStatus | null;
  jobForm: UseFormReturn<JobFormData>;
  setPendingJobId: (id: string | null) => void;
  setJobDialogOpen: (open: boolean) => void;
  setEditingJob: (job: Job | null) => void;
  setCycleTimesConfirmOpen: (open: boolean) => void;
  regenerateLevelsMutation: UseMutationResult<any, any, string, any>;
}

export function LevelChangeConfirmDialog({
  open,
  onOpenChange,
  pendingJobId,
  productionSlotStatus,
  jobForm,
  setPendingJobId,
  setJobDialogOpen,
  setEditingJob,
  setCycleTimesConfirmOpen,
  regenerateLevelsMutation,
}: LevelChangeConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Level Cycle Times?</AlertDialogTitle>
          <AlertDialogDescription>
            You've changed the level settings. Would you like to regenerate the level cycle times table to match the new Lowest Level and Highest Level values?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => {
              if (productionSlotStatus?.hasSlots) {
                setCycleTimesConfirmOpen(true);
              } else {
                setPendingJobId(null);
                setJobDialogOpen(false);
                setEditingJob(null);
                jobForm.reset();
              }
            }}
            data-testid="button-skip-level-regenerate"
          >
            Keep Existing
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!pendingJobId) return;
              regenerateLevelsMutation.mutate(pendingJobId);
            }}
            disabled={regenerateLevelsMutation.isPending}
            data-testid="button-confirm-level-regenerate"
          >
            {regenerateLevelsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Regenerate Levels
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DaysInAdvanceConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingJobId: string | null;
  jobForm: UseFormReturn<JobFormData>;
  setPendingJobId: (id: string | null) => void;
  setJobDialogOpen: (open: boolean) => void;
  setEditingJob: (job: Job | null) => void;
  regenerateSlotsAndDraftingMutation: UseMutationResult<any, any, string, any>;
}

export function DaysInAdvanceConfirmDialog({
  open,
  onOpenChange,
  pendingJobId,
  jobForm,
  setPendingJobId,
  setJobDialogOpen,
  setEditingJob,
  regenerateSlotsAndDraftingMutation,
}: DaysInAdvanceConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Production Slots and Drafting Program?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Changing production settings (Required Delivery Start or IFC Days in Advance) will affect all production and drafting dates.
              </p>
              <p>
                This will regenerate the production slots and update the drafting program dates accordingly.
              </p>
              <p className="font-medium">Do you want to continue?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => {
              setPendingJobId(null);
              setJobDialogOpen(false);
              setEditingJob(null);
              jobForm.reset();
            }}
            data-testid="button-skip-days-in-advance-update"
          >
            Skip Update
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!pendingJobId) return;
              regenerateSlotsAndDraftingMutation.mutate(pendingJobId);
            }}
            disabled={regenerateSlotsAndDraftingMutation.isPending}
            data-testid="button-confirm-days-in-advance-update"
          >
            {regenerateSlotsAndDraftingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update Both
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface QuickAddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickAddCustomerName: string;
  setQuickAddCustomerName: (name: string) => void;
  quickAddCustomerMutation: UseMutationResult<any, any, string, any>;
}

export function QuickAddCustomerDialog({
  open,
  onOpenChange,
  quickAddCustomerName,
  setQuickAddCustomerName,
  quickAddCustomerMutation,
}: QuickAddCustomerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Add Customer</DialogTitle>
          <DialogDescription>
            Create a new customer to link to this job. You can add full details later in the Customers admin page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Company Name *</label>
            <Input
              placeholder="Enter customer company name"
              value={quickAddCustomerName}
              onChange={(e) => setQuickAddCustomerName(e.target.value)}
              data-testid="input-quick-add-customer-name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && quickAddCustomerName.trim()) {
                  e.preventDefault();
                  quickAddCustomerMutation.mutate(quickAddCustomerName.trim());
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-quick-add-customer">
            Cancel
          </Button>
          <Button
            onClick={() => quickAddCustomerName.trim() && quickAddCustomerMutation.mutate(quickAddCustomerName.trim())}
            disabled={!quickAddCustomerName.trim() || quickAddCustomerMutation.isPending}
            data-testid="button-save-quick-add-customer"
          >
            {quickAddCustomerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Create & Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
