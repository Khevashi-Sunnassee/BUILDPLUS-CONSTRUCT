import { Loader2, Save, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SuburbLookup } from "@/components/suburb-lookup";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  AUSTRALIAN_STATES, CONSTRUCTION_TICKET_TYPES, TICKET_CATEGORIES, statusLabel,
} from "./types";
import type {
  EditEmployeeDialogProps, EmploymentDialogProps, DocumentDialogProps,
  LicenceDialogProps, DeleteConfirmDialogProps, CreateOnboardingDialogProps,
} from "./types";

export function EditEmployeeDialog({ open, onOpenChange, form, onSubmit, isPending }: EditEmployeeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>Update employee details</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="employeeNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Employee Number *</FormLabel>
                <FormControl><Input {...field} data-testid="input-edit-employee-number" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-first-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="middleName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Middle Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-middle-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-last-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="preferredName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-preferred-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-edit-dob" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" {...field} data-testid="input-edit-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="addressLine1" render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1</FormLabel>
                <FormControl><Input {...field} data-testid="input-edit-address1" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="addressLine2" render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2</FormLabel>
                <FormControl><Input {...field} data-testid="input-edit-address2" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="suburb" render={({ field }) => (
                <FormItem>
                  <FormLabel>Suburb</FormLabel>
                  <FormControl>
                    <SuburbLookup
                      value={field.value || ""}
                      onChange={field.onChange}
                      onSelect={(result) => {
                        field.onChange(result.suburb);
                        form.setValue("state", result.state);
                        form.setValue("postcode", result.postcode);
                      }}
                      placeholder="Start typing suburb..."
                      data-testid="input-edit-suburb"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-state"><SelectValue placeholder="Select state" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AUSTRALIAN_STATES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="postcode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Postcode</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-postcode" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-emergency-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Phone</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-emergency-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="emergencyContactRelationship" render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-emergency-relationship" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="isDraftingResource" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-drafting" /></FormControl>
                  <FormLabel className="!mt-0">Drafting Resource</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="isProductionResource" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-production" /></FormControl>
                  <FormLabel className="!mt-0">Production Resource</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="isSiteResource" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-site" /></FormControl>
                  <FormLabel className="!mt-0">Site Resource</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="receiveEscalatedWorkOrders" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-escalated" /></FormControl>
                  <FormLabel className="!mt-0">Receive Escalated Work Orders</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="workRights" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-work-rights" /></FormControl>
                  <FormLabel className="!mt-0">Work Rights</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-active" /></FormControl>
                  <FormLabel className="!mt-0">Active</FormLabel>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-edit-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isPending} data-testid="button-save-employee">
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function EmploymentDialog({ open, onOpenChange, form, onSubmit, isPending, isEditing, instruments, activeDepartments }: EmploymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Employment" : "Add Employment"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update employment record" : "Create a new employment record"}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="employmentType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employment Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-employment-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-employment-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["prospect", "offer_sent", "offer_accepted", "pre_start", "active", "on_leave", "inactive", "terminated", "archived"].map((s) => (
                        <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="positionTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>Position Title</FormLabel>
                  <FormControl><Input {...field} data-testid="input-employment-position" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="jobTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl><Input {...field} data-testid="input-employment-job-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "none" ? null : v)} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-employment-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {activeDepartments.slice().sort((a, b) => a.name.localeCompare(b.name)).map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="workLocation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Location</FormLabel>
                  <FormControl><Input {...field} data-testid="input-employment-location" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="workState" render={({ field }) => (
                <FormItem>
                  <FormLabel>Work State</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-employment-work-state"><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {AUSTRALIAN_STATES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="classificationLevel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Classification Level</FormLabel>
                  <FormControl><Input {...field} data-testid="input-employment-classification" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="instrumentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industrial Instrument</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-employment-instrument">
                        <SelectValue placeholder="Select instrument (Award/EBA)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {instruments?.filter((i: any) => i.isActive).map((inst: any) => (
                        <SelectItem key={inst.id} value={inst.id}>{inst.name}{inst.code ? ` (${inst.code})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-employment-start-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="expectedStartDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-employment-expected-start" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-employment-end-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="probationEndDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Probation End Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-employment-probation-end" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <h3 className="text-sm font-semibold pt-2 border-t">Pay Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="baseRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Rate</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-base-rate" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rateBasis" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Basis</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-employment-rate-basis"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="payFrequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Frequency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-employment-pay-frequency"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <FormField control={form.control} name="ordinaryRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordinary Rate</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-ordinary-rate" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="overtime1_5" render={({ field }) => (
                <FormItem>
                  <FormLabel>Overtime 1.5x</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-overtime15" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="overtime2" render={({ field }) => (
                <FormItem>
                  <FormLabel>Overtime 2x</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-overtime2" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="saturdayRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Saturday Rate</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-saturday-rate" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sundayRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sunday Rate</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-sunday-rate" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="publicHolidayRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Public Holiday Rate</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-public-holiday-rate" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nightShiftRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Night Shift Rate</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-night-shift-rate" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <h3 className="text-sm font-semibold pt-2 border-t">Allowances</h3>
            <div className="grid grid-cols-4 gap-4">
              <FormField control={form.control} name="travelAllowance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Travel</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-travel-allowance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="mealAllowance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Meal</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-meal-allowance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="toolAllowance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tool</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-tool-allowance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="uniformAllowance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Uniform</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-uniform-allowance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phoneAllowance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-phone-allowance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="carAllowance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Car</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-car-allowance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shiftAllowance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-shift-allowance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <h3 className="text-sm font-semibold pt-2 border-t">Leave</h3>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="annualLeaveHoursPerWeek" render={({ field }) => (
                <FormItem>
                  <FormLabel>Annual Leave Hrs/Week</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-annual-leave" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sickLeaveHoursPerWeek" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sick Leave Hrs/Week</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-sick-leave" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="longServiceLeaveHours" render={({ field }) => (
                <FormItem>
                  <FormLabel>Long Service Leave Hrs</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-long-service" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rdoCount" render={({ field }) => (
                <FormItem>
                  <FormLabel>RDO Count</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ""} data-testid="input-employment-rdo-count" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rdoAccrual" render={({ field }) => (
                <FormItem>
                  <FormLabel>RDO Accrual</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} data-testid="input-employment-rdo-accrual" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-employment-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="submit" disabled={isPending} data-testid="button-save-employment">
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isEditing ? "Save Changes" : "Create Employment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentDialog({ open, onOpenChange, form, onSubmit, isPending, isEditing }: DocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Document" : "Add Document"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update document details" : "Add a new document"}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl><Input {...field} data-testid="input-document-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger data-testid="select-document-category"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {["contract", "variation", "id", "licence", "induction", "policy_acknowledgement", "performance", "termination", "other"].map((c) => (
                      <SelectItem key={c} value={c}>{statusLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="fileUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>File URL</FormLabel>
                  <FormControl><Input {...field} data-testid="input-document-file-url" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fileName" render={({ field }) => (
                <FormItem>
                  <FormLabel>File Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-document-file-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="fileSize" render={({ field }) => (
              <FormItem>
                <FormLabel>File Size (bytes)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value ?? ""} data-testid="input-document-file-size" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="issuedDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Issued Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-document-issued-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-document-expiry-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="version" render={({ field }) => (
              <FormItem>
                <FormLabel>Version</FormLabel>
                <FormControl><Input type="number" {...field} data-testid="input-document-version" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-document-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isPending} data-testid="button-save-document">
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isEditing ? "Save Changes" : "Create Document"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function LicenceDialog({ open, onOpenChange, form, onSubmit, isPending, isEditing, useCustomLicenceType, setUseCustomLicenceType }: LicenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Licence" : "Add Licence"}</DialogTitle>
          <DialogDescription>{isEditing ? "Update licence details" : "Add a new licence"}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="licenceType" render={({ field }) => (
              <FormItem>
                <FormLabel>Licence / Ticket Type *</FormLabel>
                {useCustomLicenceType ? (
                  <div className="flex items-center gap-2">
                    <FormControl><Input {...field} placeholder="Enter custom licence type" data-testid="input-licence-type" /></FormControl>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setUseCustomLicenceType(false); field.onChange(""); }} data-testid="button-licence-preset">
                      Preset
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-licence-type">
                          <SelectValue placeholder="Select ticket type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {TICKET_CATEGORIES.map((cat) => (
                          <div key={cat}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat}</div>
                            {CONSTRUCTION_TICKET_TYPES.filter(t => t.category === cat).map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setUseCustomLicenceType(true); field.onChange(""); }} data-testid="button-licence-custom">
                      Custom
                    </Button>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="licenceNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Licence Number</FormLabel>
                  <FormControl><Input {...field} data-testid="input-licence-number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="issuingAuthority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Issuing Authority</FormLabel>
                  <FormControl><Input {...field} data-testid="input-licence-authority" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="issueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-licence-issue-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-licence-expiry-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="documentUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Document URL</FormLabel>
                <FormControl><Input {...field} data-testid="input-licence-document-url" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger data-testid="select-licence-status"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-licence-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isPending} data-testid="button-save-licence">
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isEditing ? "Save Changes" : "Create Licence"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteConfirmDialog({ open, onOpenChange, onConfirm, title, description, confirmTestId, cancelTestId }: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={cancelTestId}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid={confirmTestId}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CreateOnboardingDialog({
  open, onOpenChange, employments, templates,
  selectedEmploymentId, setSelectedEmploymentId,
  selectedTemplateId, setSelectedTemplateId,
  onSubmit, isPending,
}: CreateOnboardingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Onboarding</DialogTitle>
          <DialogDescription>Create a new onboarding process for this employee.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employment</label>
            <Select value={selectedEmploymentId} onValueChange={setSelectedEmploymentId}>
              <SelectTrigger data-testid="select-onboarding-employment">
                <SelectValue placeholder="Select employment" />
              </SelectTrigger>
              <SelectContent>
                {employments?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} data-testid={`select-onboarding-employment-${emp.id}`}>
                    {emp.positionTitle || emp.jobTitle || "Employment"} - {emp.startDate || "No start date"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Template (Optional)</label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger data-testid="select-onboarding-template">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template</SelectItem>
                {templates?.map((tmpl: any) => (
                  <SelectItem key={tmpl.id} value={tmpl.id} data-testid={`select-onboarding-template-${tmpl.id}`}>
                    {tmpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={onSubmit}
            disabled={!selectedEmploymentId || isPending}
            data-testid="button-submit-onboarding"
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Start Onboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
