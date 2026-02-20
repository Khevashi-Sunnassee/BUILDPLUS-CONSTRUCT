import { Loader2, ClipboardList, MessageCircle, History, Save, AlertCircle, CheckCircle } from "lucide-react";
import { FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Job, PanelRegister, PanelTypeConfig } from "@shared/schema";
import { isJobVisibleInDropdowns } from "@shared/job-phases";
import type { PanelFormData, WorkType } from "./types";
import { PanelChatTab } from "./PanelChatTab";
import { PanelDocumentsTab } from "./PanelDocumentsTab";
import { PanelAuditLogTab } from "./PanelAuditLogTab";
import type { UseFormReturn } from "react-hook-form";

interface PanelEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPanel: PanelRegister | null;
  panelDialogTab: string;
  setPanelDialogTab: (tab: string) => void;
  panelForm: UseFormReturn<PanelFormData>;
  onSubmit: (data: PanelFormData) => void;
  createPending: boolean;
  updatePending: boolean;
  validatePending: boolean;
  onValidate: (id: string) => void;
  jobs: Job[] | undefined;
  panelTypes: PanelTypeConfig[] | undefined;
  workTypes: WorkType[] | undefined;
  filterJobId: string | null;
}

export function PanelEditDialog({
  open,
  onOpenChange,
  editingPanel,
  panelDialogTab,
  setPanelDialogTab,
  panelForm,
  onSubmit,
  createPending,
  updatePending,
  validatePending,
  onValidate,
  jobs,
  panelTypes,
  workTypes,
  filterJobId,
}: PanelEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => {
      onOpenChange(o);
      if (!o) setPanelDialogTab("details");
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingPanel ? "Edit Panel" : "Create New Panel"}</DialogTitle>
          <DialogDescription>
            {editingPanel ? "Update panel details" : "Add a new panel to the register"}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={panelDialogTab} onValueChange={setPanelDialogTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details" className="flex items-center gap-2" data-testid="tab-panel-details">
              <ClipboardList className="h-4 w-4" />
              Details
            </TabsTrigger>
            {editingPanel && (
              <>
                <TabsTrigger value="chat" className="flex items-center gap-2" data-testid="tab-panel-chat">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2" data-testid="tab-panel-documents">
                  <FileIcon className="h-4 w-4" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="audit-log" className="flex items-center gap-2" data-testid="tab-audit-log">
                  <History className="h-4 w-4" />
                  Audit Log
                </TabsTrigger>
              </>
            )}
          </TabsList>
          
          <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
            {editingPanel && editingPanel.source === 3 && (
              <div className="bg-muted/50 rounded-md p-4 space-y-2 border mb-4">
                <h4 className="font-medium text-sm text-muted-foreground">Import Details</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tab Name:</span>
                    <p className="font-medium">{editingPanel.sourceSheet || editingPanel.sheetNumber || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">File Name:</span>
                    <p className="font-medium">{editingPanel.sourceFileName || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Imported Date:</span>
                    <p className="font-medium">
                      {editingPanel.createdAt 
                        ? new Date(editingPanel.createdAt).toLocaleDateString('en-AU', {
                            day: '2-digit',
                            month: '2-digit', 
                            year: 'numeric'
                          })
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <Form {...panelForm}>
          <form onSubmit={panelForm.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <FormField
                  control={panelForm.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!filterJobId}>
                        <FormControl>
                          <SelectTrigger data-testid="select-panel-job">
                            <SelectValue placeholder="Select job" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobs?.filter(j => isJobVisibleInDropdowns(String(j.jobPhase ?? "CONTRACTED") as any)).slice().sort((a, b) => (a.jobNumber || '').localeCompare(b.jobNumber || '') || (a.name || '').localeCompare(b.name || '')).map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.jobNumber} - {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={panelForm.control}
                    name="panelMark"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Panel Mark</FormLabel>
                        <FormControl>
                          <Input placeholder="PM-001" {...field} data-testid="input-panel-mark" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={panelForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-panel-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending Validation</SelectItem>
                            <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                            <SelectItem value="ON_HOLD">On Hold</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={panelForm.control}
                  name="panelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Panel Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-panel-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {panelTypes && panelTypes.length > 0 ? (
                            panelTypes.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((pt) => (
                              <SelectItem key={pt.id} value={pt.code}>{pt.name}</SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="WALL">Wall</SelectItem>
                              <SelectItem value="COLUMN">Column</SelectItem>
                              <SelectItem value="CUBE_BASE">Cube Base</SelectItem>
                              <SelectItem value="CUBE_RING">Cube Ring</SelectItem>
                              <SelectItem value="LANDING_WALL">Landing Wall</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={panelForm.control}
                  name="workTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Type</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(parseInt(val))} 
                        value={field.value?.toString() || "1"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-panel-work-type">
                            <SelectValue placeholder="Select work type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {workTypes && workTypes.length > 0 ? (
                            workTypes.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((wt) => (
                              <SelectItem key={wt.id} value={wt.id.toString()}>{wt.name}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="1">General Drafting</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={panelForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Panel description" {...field} data-testid="input-panel-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={panelForm.control}
                    name="drawingCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drawing Code</FormLabel>
                        <FormControl>
                          <Input placeholder="DWG-001" {...field} data-testid="input-panel-drawing" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={panelForm.control}
                    name="sheetNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sheet Number</FormLabel>
                        <FormControl>
                          <Input placeholder="A001" {...field} data-testid="input-panel-sheet" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={panelForm.control}
                    name="building"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Building</FormLabel>
                        <FormControl>
                          <Input placeholder="Building A" {...field} data-testid="input-panel-building" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={panelForm.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Level</FormLabel>
                        <FormControl>
                          <Input placeholder="Level 1" {...field} data-testid="input-panel-level" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={panelForm.control}
                    name="structuralElevation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Struct. Elev.</FormLabel>
                        <FormControl>
                          <Input placeholder="RL 10.500" {...field} data-testid="input-panel-elevation" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={panelForm.control}
                    name="reckliDetail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reckli Detail</FormLabel>
                        <FormControl>
                          <Input placeholder="Reckli detail/pattern" {...field} data-testid="input-panel-reckli" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Crane Capacity</label>
                    <Input 
                      value={jobs?.find(j => j.id === panelForm.watch("jobId"))?.craneCapacity || "Not set"} 
                      disabled 
                      className="bg-muted"
                      data-testid="input-panel-crane-capacity"
                    />
                  </div>
                </div>
                <FormField
                  control={panelForm.control}
                  name="estimatedHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="8"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-panel-hours"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">Dimensions & Weight</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={panelForm.control}
                      name="qty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="1"
                              {...field}
                              value={field.value || 1}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 1)}
                              data-testid="input-panel-qty"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={panelForm.control}
                      name="concreteStrengthMpa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Concrete (MPa)</FormLabel>
                          <FormControl>
                            <Input placeholder="50" {...field} data-testid="input-panel-concrete" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <FormField
                      control={panelForm.control}
                      name="loadWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Width (mm)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="3000" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                const width = parseFloat(e.target.value) || 0;
                                const height = parseFloat(panelForm.getValues("loadHeight") || "0") || 0;
                                const thickness = parseFloat(panelForm.getValues("panelThickness") || "0") || 0;
                                if (width > 0 && height > 0 && thickness > 0) {
                                  const volumeM3 = (width / 1000) * (height / 1000) * (thickness / 1000);
                                  const massKg = volumeM3 * 2500;
                                  panelForm.setValue("panelVolume", volumeM3.toFixed(3));
                                  panelForm.setValue("panelMass", Math.round(massKg).toString());
                                }
                              }}
                              data-testid="input-panel-width"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={panelForm.control}
                      name="loadHeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Height (mm)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="2400" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                const width = parseFloat(panelForm.getValues("loadWidth") || "0") || 0;
                                const height = parseFloat(e.target.value) || 0;
                                const thickness = parseFloat(panelForm.getValues("panelThickness") || "0") || 0;
                                if (width > 0 && height > 0 && thickness > 0) {
                                  const volumeM3 = (width / 1000) * (height / 1000) * (thickness / 1000);
                                  const massKg = volumeM3 * 2500;
                                  panelForm.setValue("panelVolume", volumeM3.toFixed(3));
                                  panelForm.setValue("panelMass", Math.round(massKg).toString());
                                }
                              }}
                              data-testid="input-panel-height"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={panelForm.control}
                      name="panelThickness"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Thick (mm)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="200" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                const width = parseFloat(panelForm.getValues("loadWidth") || "0") || 0;
                                const height = parseFloat(panelForm.getValues("loadHeight") || "0") || 0;
                                const thickness = parseFloat(e.target.value) || 0;
                                if (width > 0 && height > 0 && thickness > 0) {
                                  const volumeM3 = (width / 1000) * (height / 1000) * (thickness / 1000);
                                  const massKg = volumeM3 * 2500;
                                  panelForm.setValue("panelVolume", volumeM3.toFixed(3));
                                  panelForm.setValue("panelMass", Math.round(massKg).toString());
                                }
                              }}
                              data-testid="input-panel-thickness"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <FormField
                      control={panelForm.control}
                      name="panelVolume"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Volume (m³)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="bg-muted" 
                              readOnly
                              data-testid="input-panel-volume"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={panelForm.control}
                      name="panelMass"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mass (kg)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="bg-muted" 
                              readOnly
                              data-testid="input-panel-mass"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {editingPanel?.status === "PENDING" && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  This panel is pending validation. Validate it to make it available for drafting work.
                </p>
              </div>
            )}
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {editingPanel?.status === "PENDING" && (
                <Button
                  type="button"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={validatePending}
                  onClick={() => {
                    if (editingPanel) {
                      onValidate(editingPanel.id);
                    }
                  }}
                  data-testid="button-validate-panel"
                >
                  {validatePending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Validate Panel
                </Button>
              )}
              <Button
                type="submit"
                disabled={createPending || updatePending}
                data-testid="button-save-panel"
              >
                {(createPending || updatePending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Save className="h-4 w-4 mr-2" />
                {editingPanel ? "Update" : "Create"}
              </Button>
            </DialogFooter>
            </form>
          </Form>
          </TabsContent>
          
          {editingPanel && (
            <>
              <TabsContent value="chat" className="flex-1 overflow-hidden mt-4">
                <PanelChatTab panelId={editingPanel.id} panelMark={editingPanel.panelMark} />
              </TabsContent>
              
              <TabsContent value="documents" className="flex-1 overflow-y-auto mt-4">
                <PanelDocumentsTab panelId={editingPanel.id} productionPdfUrl={editingPanel.productionPdfUrl} />
              </TabsContent>

              <TabsContent value="audit-log" className="flex-1 overflow-y-auto mt-4">
                <PanelAuditLogTab panelId={editingPanel.id} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
