import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search } from "lucide-react";
import type { Job } from "@shared/schema";

export interface PODialogsProps {
  showRejectDialog: boolean;
  setShowRejectDialog: (val: boolean) => void;
  rejectReason: string;
  setRejectReason: (val: string) => void;
  rejectMutation: { mutate: (reason: string) => void; isPending: boolean };
  showDeleteDialog: boolean;
  setShowDeleteDialog: (val: boolean) => void;
  deleteMutation: { mutate: () => void; isPending: boolean };
  showJobDialog: boolean;
  setShowJobDialog: (val: boolean) => void;
  jobSearchTerm: string;
  setJobSearchTerm: (val: string) => void;
  filteredJobs: Job[];
  handleJobSelect: (job: Job) => void;
}

export function PODialogs({
  showRejectDialog,
  setShowRejectDialog,
  rejectReason,
  setRejectReason,
  rejectMutation,
  showDeleteDialog,
  setShowDeleteDialog,
  deleteMutation,
  showJobDialog,
  setShowJobDialog,
  jobSearchTerm,
  setJobSearchTerm,
  filteredJobs,
  handleJobSelect,
}: PODialogsProps) {
  return (
    <>
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this purchase order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="min-h-[100px]"
              data-testid="textarea-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showJobDialog} onOpenChange={setShowJobDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Job</DialogTitle>
            <DialogDescription>
              Search and select a job to assign to this line item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job number, name, or client..."
                value={jobSearchTerm}
                onChange={(e) => setJobSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-job-search"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto border rounded-lg">
              {filteredJobs.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No jobs found
                </div>
              ) : (
                <div className="divide-y">
                  {filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-3 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleJobSelect(job)}
                      data-testid={`job-option-${job.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-medium">{job.jobNumber}</span>
                          <span className="text-muted-foreground mx-2">-</span>
                          <span>{job.name}</span>
                        </div>
                        {job.productionSlotColor && (
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: job.productionSlotColor }}
                          />
                        )}
                      </div>
                      {job.client && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {job.client}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJobDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
