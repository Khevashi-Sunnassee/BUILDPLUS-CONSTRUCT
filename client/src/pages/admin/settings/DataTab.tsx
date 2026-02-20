import { Loader2, Trash2, AlertTriangle, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UseMutationResult } from "@tanstack/react-query";

export interface DataTabProps {
  showDeletePanel: boolean;
  setShowDeletePanel: (v: boolean) => void;
  refetchCounts: () => void;
  deletionCategories: Array<{ key: string; label: string; description: string }>;
  dataCounts: Record<string, number> | undefined;
  selectedCategories: Set<string>;
  handleCategoryToggle: (key: string, checked: boolean) => void;
  validationResult: { valid: boolean; errors: string[]; warnings: string[] } | null;
  setValidationResult: (v: { valid: boolean; errors: string[]; warnings: string[] } | null) => void;
  handleValidateAndDelete: () => void;
  validateDeletionMutation: UseMutationResult<any, any, string[], any>;
  setSelectedCategories: (v: Set<string>) => void;
  showConfirmDialog: boolean;
  setShowConfirmDialog: (v: boolean) => void;
  handleConfirmDelete: () => void;
  performDeletionMutation: UseMutationResult<any, any, string[], any>;
}

export function DataTab({
  showDeletePanel,
  setShowDeletePanel,
  refetchCounts,
  deletionCategories,
  dataCounts,
  selectedCategories,
  handleCategoryToggle,
  validationResult,
  setValidationResult,
  handleValidateAndDelete,
  validateDeletionMutation,
  setSelectedCategories,
  showConfirmDialog,
  setShowConfirmDialog,
  handleConfirmDelete,
  performDeletionMutation,
}: DataTabProps) {
  return (
    <>
      <TabsContent value="data" className="space-y-6">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Database className="h-5 w-5" />
              Data Management
            </CardTitle>
            <CardDescription>
              Delete data from the system. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showDeletePanel ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setShowDeletePanel(true);
                  setTimeout(() => refetchCounts(), 100);
                }}
                data-testid="button-show-delete-panel"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Data
              </Button>
            ) : (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    Deleting data is permanent and cannot be undone. Please review your selections carefully.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {deletionCategories.map((category) => {
                    const count = dataCounts?.[category.key] ?? 0;
                    return (
                      <div
                        key={category.key}
                        className="flex items-start space-x-3 rounded-lg border p-3"
                      >
                        <Checkbox
                          id={`delete-${category.key}`}
                          checked={selectedCategories.has(category.key)}
                          onCheckedChange={(checked) =>
                            handleCategoryToggle(category.key, checked === true)
                          }
                          disabled={count === 0}
                          data-testid={`checkbox-delete-${category.key}`}
                        />
                        <div className="flex-1 space-y-1">
                          <Label
                            htmlFor={`delete-${category.key}`}
                            className={`font-medium ${count === 0 ? "text-muted-foreground" : ""}`}
                          >
                            {category.label}
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                              ({count} records)
                            </span>
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {category.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {validationResult && !validationResult.valid && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Validation Errors</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        {validationResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validationResult && validationResult.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        {validationResult.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeletePanel(false);
                      setSelectedCategories(new Set());
                      setValidationResult(null);
                    }}
                    data-testid="button-cancel-delete"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleValidateAndDelete}
                    disabled={selectedCategories.size === 0 || validateDeletionMutation.isPending}
                    data-testid="button-validate-delete"
                  >
                    {validateDeletionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete Selected Data
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the selected data? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium mb-2">You are about to delete:</p>
            <ul className="list-disc pl-6 space-y-1">
              {Array.from(selectedCategories).map((key) => {
                const category = deletionCategories.find((c) => c.key === key);
                const count = dataCounts?.[key] ?? 0;
                return (
                  <li key={key}>
                    {category?.label} ({count} records)
                  </li>
                );
              })}
            </ul>
            {validationResult && validationResult.warnings.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-amber-600 mb-1">Warnings:</p>
                <ul className="list-disc pl-6 text-sm text-muted-foreground">
                  {validationResult.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              data-testid="button-cancel-confirm"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={performDeletionMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {performDeletionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Yes, Delete Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
