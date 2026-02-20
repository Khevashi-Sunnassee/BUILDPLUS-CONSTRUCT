import { Loader2, CheckCircle, Save, Send, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ChecklistWorkOrder } from "@shared/schema";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChecklistForm } from "@/components/checklist/checklist-form";
import type { AssetImportDialogProps, AssetDeleteDialogProps, ServiceChecklistDialogProps } from "./types";

export function AssetImportDialog({
  importDialogOpen,
  setImportDialogOpen,
  importing,
  importResult,
  handleImportFile,
  fileInputRef,
}: AssetImportDialogProps) {
  return (
    <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Assets</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx/.xls) to import assets. AI will automatically categorize assets based on their name and description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
            }}
            disabled={importing}
            data-testid="input-import-file"
          />
          {importing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing and categorizing with AI...
            </div>
          )}
          {importResult && (
            <div className="space-y-2">
              {importResult.imported !== undefined && importResult.imported > 0 && (
                <p className="text-sm text-green-600" data-testid="text-import-success">
                  Successfully imported {importResult.imported} assets.
                </p>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Errors:</p>
                  <ul className="text-sm text-destructive list-disc pl-4 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i} data-testid={`text-import-error-${i}`}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-close-import">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssetDeleteDialog({
  deleteDialogOpen,
  setDeleteDialogOpen,
  deletingAssetId,
  deleteMutation,
}: AssetDeleteDialogProps) {
  return (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Asset</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this asset? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deletingAssetId) {
                deleteMutation.mutate(deletingAssetId);
              }
            }}
            data-testid="button-confirm-delete"
          >
            {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ServiceChecklistDialog({
  serviceDialogOpen,
  setServiceDialogOpen,
  serviceInstanceId,
  setServiceInstanceId,
  serviceHasChanges,
  serviceResponses,
  setServiceResponses,
  setServiceHasChanges,
  serviceInstance,
  serviceTemplate,
  serviceWorkOrders,
  saveServiceMutation,
  handleServiceComplete,
  serviceCompleteDialogOpen,
  setServiceCompleteDialogOpen,
  completeServiceMutation,
}: ServiceChecklistDialogProps) {
  return (
    <>
      <Dialog open={serviceDialogOpen} onOpenChange={(open) => {
        if (!open && serviceHasChanges) {
          if (confirm("You have unsaved changes. Close anyway?")) {
            setServiceDialogOpen(false);
            setServiceInstanceId(null);
          }
        } else {
          setServiceDialogOpen(open);
          if (!open) setServiceInstanceId(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" data-testid="dialog-service-checklist">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <DialogTitle>{serviceTemplate?.name || "Service Checklist"}</DialogTitle>
                <DialogDescription>{serviceTemplate?.description || "Complete the equipment maintenance checklist"}</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {serviceHasChanges && (
                  <Badge variant="outline">Unsaved Changes</Badge>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {serviceInstance?.status === "completed" || serviceInstance?.status === "signed_off" ? (
              <Alert className="mb-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  This checklist has been completed and can no longer be edited.
                  {serviceInstance.completedAt && (
                    <span className="ml-1">
                      Completed on {new Date(serviceInstance.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
            {serviceTemplate ? (
              <ChecklistForm
                template={serviceTemplate}
                responses={serviceResponses}
                onChange={(newResponses) => {
                  setServiceResponses(newResponses);
                  setServiceHasChanges(true);
                }}
                disabled={serviceInstance?.status === "completed" || serviceInstance?.status === "signed_off"}
                showProgress={serviceInstance?.status !== "completed" && serviceInstance?.status !== "signed_off"}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {serviceWorkOrders.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-base">Generated Work Orders</CardTitle>
                    <Badge variant="secondary">{serviceWorkOrders.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {serviceWorkOrders.map((wo: ChecklistWorkOrder) => (
                      <div
                        key={wo.id}
                        className="flex items-start justify-between gap-3 rounded-md border p-3"
                        data-testid={`work-order-${wo.id}`}
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-medium">{wo.fieldName}</p>
                          <p className="text-xs text-muted-foreground">{wo.sectionName}</p>
                          {wo.details && (
                            <p className="text-xs text-muted-foreground">{wo.details}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            variant={wo.status === "open" ? "destructive" : wo.status === "resolved" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {wo.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs"
                          >
                            {wo.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          {serviceInstance?.status !== "completed" && serviceInstance?.status !== "signed_off" && serviceTemplate && (
            <DialogFooter className="flex-shrink-0 gap-2">
              <Button
                variant="outline"
                onClick={() => saveServiceMutation.mutate()}
                disabled={!serviceHasChanges || saveServiceMutation.isPending}
                data-testid="button-save-service-checklist"
              >
                {saveServiceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Progress
              </Button>
              <Button
                onClick={handleServiceComplete}
                disabled={completeServiceMutation.isPending}
                data-testid="button-complete-service-checklist"
              >
                {completeServiceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Complete
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={serviceCompleteDialogOpen} onOpenChange={setServiceCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Service Checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Once completed, this checklist cannot be edited. Make sure all fields are filled correctly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-service-complete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => completeServiceMutation.mutate()}
              data-testid="button-confirm-service-complete"
            >
              {completeServiceMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Complete Checklist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
