import { Button } from "@/components/ui/button";
import { Save, Send, Check, X, Printer, Trash2 } from "lucide-react";

export interface ActionButtonsProps {
  canEdit: boolean;
  canApprove: boolean;
  isNew: boolean;
  isApproved: boolean;
  existingPOStatus: string | undefined;
  lineItemsCount: number;
  createIsPending: boolean;
  updateIsPending: boolean;
  submitIsPending: boolean;
  approveIsPending: boolean;
  handleSave: () => void;
  handleSubmit: () => void;
  handleApprove: () => void;
  handlePrint: () => void;
  setShowRejectDialog: (val: boolean) => void;
  setShowDeleteDialog: (val: boolean) => void;
}

export function ActionButtons({
  canEdit,
  canApprove,
  isNew,
  isApproved,
  existingPOStatus,
  lineItemsCount,
  createIsPending,
  updateIsPending,
  submitIsPending,
  approveIsPending,
  handleSave,
  handleSubmit,
  handleApprove,
  handlePrint,
  setShowRejectDialog,
  setShowDeleteDialog,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      {canEdit && (
        <>
          <Button
            onClick={handleSave}
            disabled={createIsPending || updateIsPending}
            data-testid="button-save-draft"
          >
            <Save className="h-4 w-4 mr-2" />
            {createIsPending || updateIsPending ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              createIsPending || 
              updateIsPending || 
              submitIsPending ||
              lineItemsCount === 0
            }
            variant="default"
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-submit"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitIsPending ? "Submitting..." : "Submit for Approval"}
          </Button>
        </>
      )}

      {canApprove && (
        <>
          <Button
            onClick={handleApprove}
            disabled={approveIsPending}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-approve"
          >
            <Check className="h-4 w-4 mr-2" />
            {approveIsPending ? "Approving..." : "Approve"}
          </Button>
          <Button
            onClick={() => setShowRejectDialog(true)}
            variant="destructive"
            data-testid="button-reject"
          >
            <X className="h-4 w-4 mr-2" />
            Reject
          </Button>
        </>
      )}

      {(isApproved || existingPOStatus === "RECEIVED" || existingPOStatus === "RECEIVED_IN_PART") && (
        <Button onClick={handlePrint} variant="outline" data-testid="button-print">
          <Printer className="h-4 w-4 mr-2" />
          Print / PDF
        </Button>
      )}

      {(canEdit && !isNew) && (
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          data-testid="button-delete"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      )}
    </div>
  );
}
