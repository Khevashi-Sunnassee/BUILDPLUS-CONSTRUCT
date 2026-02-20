import { UseFormReturn } from "react-hook-form";
import {
  Package,
  Clock,
  MapPin,
  Truck,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { dateInputProps } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Job, PanelRegister, TrailerType } from "@shared/schema";
import type { LoadListWithDetails, LoadListFormData, DeliveryFormData } from "./types";

export interface CreateLoadListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadListForm: UseFormReturn<LoadListFormData>;
  jobs: Job[] | undefined;
  trailerTypes: TrailerType[] | undefined;
  filteredPanels: (PanelRegister & { job: Job })[];
  watchedJobId: string;
  isPending: boolean;
  onSubmit: (data: LoadListFormData) => void;
  onJobChange: (value: string) => void;
  isJobVisibleInDropdowns: (phase: any) => boolean;
}

export function CreateLoadListDialog({
  open,
  onOpenChange,
  loadListForm,
  jobs,
  trailerTypes,
  filteredPanels,
  watchedJobId,
  isPending,
  onSubmit,
  onJobChange,
  isJobVisibleInDropdowns,
}: CreateLoadListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Load List</DialogTitle>
          <DialogDescription>
            Select a job and choose panels to add to this load
          </DialogDescription>
        </DialogHeader>
        <Form {...loadListForm}>
          <form onSubmit={loadListForm.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={loadListForm.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        onJobChange(value);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-job">
                          <SelectValue placeholder="Select job" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...(jobs?.filter(j => j.status === "ACTIVE" && isJobVisibleInDropdowns(String(j.jobPhase ?? "CONTRACTED") as any)) || [])].sort((a, b) => (a.jobNumber || a.name || '').localeCompare(b.jobNumber || b.name || '')).map((job) => (
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
              <FormField
                control={loadListForm.control}
                name="trailerTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trailer Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-trailer-type">
                          <SelectValue placeholder="Select trailer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...(trailerTypes || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((tt) => (
                          <SelectItem key={tt.id} value={tt.id}>
                            {tt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loadListForm.control}
                name="factory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Factory</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "QLD"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-factory">
                          <SelectValue placeholder="Select factory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="VIC">Victoria</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={loadListForm.control}
                name="docketNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Docket Number</FormLabel>
                    <FormControl>
                      <Input placeholder="DOC-001" {...field} data-testid="input-docket-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loadListForm.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...dateInputProps} {...field} data-testid="input-scheduled-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={loadListForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Any special instructions..." {...field} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={loadListForm.control}
              name="panelIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Panels ({field.value?.length || 0} selected)</FormLabel>
                  <ScrollArea className="h-48 border rounded-md p-2">
                    {filteredPanels.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        {watchedJobId ? "No approved panels for this job" : "Select a job to see available panels"}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredPanels.map((panel) => (
                          <div
                            key={panel.id}
                            className="flex items-center space-x-2 p-2 hover-elevate rounded-md"
                            data-testid={`panel-checkbox-${panel.id}`}
                          >
                            <Checkbox
                              id={panel.id}
                              checked={field.value?.includes(panel.id)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, panel.id]);
                                } else {
                                  field.onChange(current.filter(id => id !== panel.id));
                                }
                              }}
                            />
                            <label htmlFor={panel.id} className="flex-1 cursor-pointer flex items-center justify-between">
                              <span className="font-medium">{panel.panelMark}</span>
                              <span className="text-sm text-muted-foreground">
                                {panel.panelType} · {panel.panelMass ? `${parseFloat(panel.panelMass).toLocaleString()} kg` : ""}
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-load-list">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Load List
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export interface DeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryForm: UseFormReturn<DeliveryFormData>;
  selectedLoadList: LoadListWithDetails | null;
  isPending: boolean;
  onSubmit: (data: DeliveryFormData) => void;
}

export function DeliveryDialog({
  open,
  onOpenChange,
  deliveryForm,
  selectedLoadList,
  isPending,
  onSubmit,
}: DeliveryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle>Record Delivery</DialogTitle>
          <DialogDescription>
            {selectedLoadList && (
              <>
                Enter delivery details for {selectedLoadList.job.jobNumber} - {selectedLoadList.job.name}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...deliveryForm}>
          <form onSubmit={deliveryForm.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 h-[65vh] pr-4">
              <div className="space-y-3 pb-4">
                <div className="space-y-3 p-3 rounded-md border bg-muted/30">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Load Information
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    <FormField
                      control={deliveryForm.control}
                      name="loadDocumentNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Load Document #</FormLabel>
                          <FormControl>
                            <Input placeholder="LD-001" {...field} data-testid="input-load-document" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deliveryForm.control}
                      name="loadNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Load Number</FormLabel>
                          <FormControl>
                            <Input placeholder="1" {...field} data-testid="input-load-number" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deliveryForm.control}
                      name="deliveryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...dateInputProps} {...field} data-testid="input-delivery-date" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deliveryForm.control}
                      name="numberPanels"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Panels</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="1" placeholder="0" {...field} value={field.value ?? ""} data-testid="input-number-panels" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={deliveryForm.control}
                      name="truckRego"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Truck Rego</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC-123" {...field} data-testid="input-truck-rego" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deliveryForm.control}
                      name="trailerRego"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trailer Rego</FormLabel>
                          <FormControl>
                            <Input placeholder="XYZ-456" {...field} data-testid="input-trailer-rego" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deliveryForm.control}
                      name="preload"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preload</FormLabel>
                          <FormControl>
                            <Input placeholder="Yes/No" {...field} data-testid="input-preload" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Collapsible defaultOpen className="border rounded-md">
                  <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Depot to Factory
                    </h4>
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-3 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={deliveryForm.control}
                        name="leaveDepotTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leave Depot (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-leave-depot" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="arriveLteTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Arrive Factory (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-arrive-lte" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible defaultOpen className="border rounded-md">
                  <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Pickup Location
                    </h4>
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-3 pt-0">
                    <div className="grid grid-cols-3 gap-3">
                      <FormField
                        control={deliveryForm.control}
                        name="pickupLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input placeholder="Pickup location" {...field} data-testid="input-pickup-location" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="pickupArriveTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Arrive (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-pickup-arrive" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="pickupLeaveTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leave (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-pickup-leave" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible defaultOpen className="border rounded-md">
                  <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Delivery Location (Holding)
                    </h4>
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-3 pt-0">
                    <div className="grid grid-cols-3 gap-3">
                      <FormField
                        control={deliveryForm.control}
                        name="deliveryLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input placeholder="Delivery location" {...field} data-testid="input-delivery-location" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="arriveHoldingTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Arrive Holding (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-arrive-holding" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="leaveHoldingTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leave Holding (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-leave-holding" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible defaultOpen className="border rounded-md">
                  <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Unloading
                    </h4>
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-3 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={deliveryForm.control}
                        name="siteFirstLiftTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Site First Lift (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-site-first-lift" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deliveryForm.control}
                        name="siteLastLiftTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Site Last Lift / Leave (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-site-last-lift" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible defaultOpen className="border rounded-md">
                  <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover-elevate rounded-t-md">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Return Depot / Reload
                    </h4>
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-3 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={deliveryForm.control}
                        name="returnDepotArriveTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Arrive (time)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-return-depot-arrive" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-2 p-3 rounded-md border">
                  <FormField
                    control={deliveryForm.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comment</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any delivery comments..."
                            className="resize-none"
                            rows={2}
                            {...field}
                            data-testid="input-delivery-comment"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4 border-t mt-2 flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-delivery">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Complete Delivery
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnLoadList: LoadListWithDetails | null;
  returnType: "FULL" | "PARTIAL";
  returnReason: string;
  returnDate: string;
  leftFactoryTime: string;
  arrivedFactoryTime: string;
  unloadedAtFactoryTime: string;
  returnNotes: string;
  returnPanelIds: Set<string>;
  isPending: boolean;
  setReturnType: (type: "FULL" | "PARTIAL") => void;
  setReturnReason: (reason: string) => void;
  setReturnDate: (date: string) => void;
  setLeftFactoryTime: (time: string) => void;
  setArrivedFactoryTime: (time: string) => void;
  setUnloadedAtFactoryTime: (time: string) => void;
  setReturnNotes: (notes: string) => void;
  setReturnPanelIds: (ids: Set<string>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ReturnDialog({
  open,
  onOpenChange,
  returnLoadList,
  returnType,
  returnReason,
  returnDate,
  leftFactoryTime,
  arrivedFactoryTime,
  unloadedAtFactoryTime,
  returnNotes,
  returnPanelIds,
  isPending,
  setReturnType,
  setReturnReason,
  setReturnDate,
  setLeftFactoryTime,
  setArrivedFactoryTime,
  setUnloadedAtFactoryTime,
  setReturnNotes,
  setReturnPanelIds,
  onSubmit,
  onClose,
}: ReturnDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Record Return Load</DialogTitle>
          <DialogDescription>
            {returnLoadList && (
              <>Record a return for {returnLoadList.job.jobNumber} - {returnLoadList.job.name}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Return Type</label>
              <RadioGroup value={returnType} onValueChange={(v) => setReturnType(v as "FULL" | "PARTIAL")} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FULL" id="return-full" />
                  <Label htmlFor="return-full">Full Return</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PARTIAL" id="return-partial" />
                  <Label htmlFor="return-partial">Partial Return</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Return Reason *</label>
              <Textarea
                placeholder="Reason for return..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="resize-none"
                rows={2}
                data-testid="input-return-reason"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Return Date</label>
                <Input type="date" {...dateInputProps} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} data-testid="input-return-date" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Left Factory</label>
                <Input type="time" value={leftFactoryTime} onChange={(e) => setLeftFactoryTime(e.target.value)} data-testid="input-left-factory-time" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Arrived Factory</label>
                <Input type="time" value={arrivedFactoryTime} onChange={(e) => setArrivedFactoryTime(e.target.value)} data-testid="input-arrived-factory-time" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Unloaded at Factory</label>
                <Input type="time" value={unloadedAtFactoryTime} onChange={(e) => setUnloadedAtFactoryTime(e.target.value)} data-testid="input-unloaded-factory-time" />
              </div>
            </div>

            {returnType === "PARTIAL" && returnLoadList && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Panels to Return</label>
                <ScrollArea className="h-48 border rounded-md p-2">
                  <div className="space-y-2">
                    {returnLoadList.panels.sort((a, b) => a.sequence - b.sequence).map((lp) => (
                      <div key={lp.id} className="flex items-center space-x-2 p-2 hover-elevate rounded-md">
                        <Checkbox
                          id={`return-${lp.panel.id}`}
                          checked={returnPanelIds.has(lp.panel.id)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(returnPanelIds);
                            if (checked) { newSet.add(lp.panel.id); } else { newSet.delete(lp.panel.id); }
                            setReturnPanelIds(newSet);
                          }}
                        />
                        <label htmlFor={`return-${lp.panel.id}`} className="flex-1 cursor-pointer flex items-center justify-between">
                          <span className="font-medium">{lp.panel.panelMark}</span>
                          <span className="text-sm text-muted-foreground">
                            {lp.panel.panelType} {lp.panel.panelMass ? `· ${parseFloat(lp.panel.panelMass).toLocaleString()} kg` : ""}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Any additional notes..." value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} data-testid="input-return-notes" />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isPending} data-testid="button-submit-return">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteDialog({ open, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Load List</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this load list? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
