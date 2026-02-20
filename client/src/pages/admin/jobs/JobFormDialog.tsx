import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Save,
  Loader2,
  AlertCircle,
  ExternalLink,
  UserPlus,
  X,
  Mail,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateInputProps } from "@/lib/validation";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SuburbLookup } from "@/components/suburb-lookup";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job, User as UserType, GlobalSettings, Factory, Customer, JobType } from "@shared/schema";
import { ADMIN_ROUTES } from "@shared/api-routes";
import type { UseFormReturn } from "react-hook-form";
import type { UseMutationResult } from "@tanstack/react-query";
import {
  JOB_PHASES, JOB_STATUSES,
  PHASE_COLORS,
  PHASE_ALLOWED_STATUSES,
  isValidStatusForPhase,
  getDefaultStatusForPhase,
  getPhaseLabel, getStatusLabel,
} from "@shared/job-phases";
import type { JobPhase, JobStatus } from "@shared/job-phases";

import {
  AUSTRALIAN_STATES,
  type JobFormData,
  type LevelCycleTime,
} from "./types";
import { AuditLogPanel } from "./AuditLogPanel";
import { JobMembersPanel } from "./JobMembersPanel";

interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingJob: Job | null;
  jobForm: UseFormReturn<JobFormData>;
  editDialogTab: string;
  setEditDialogTab: (tab: string) => void;
  onSubmit: (data: JobFormData) => void;
  onFormError: (errors: any) => void;
  createJobMutation: UseMutationResult<any, any, JobFormData, any>;
  updateJobMutation: UseMutationResult<any, any, { id: string; data: JobFormData }, any>;
  users: UserType[] | undefined;
  factories: Factory[] | undefined;
  activeCustomers: Customer[] | undefined;
  globalSettings: GlobalSettings | undefined;
  levelCycleTimes: LevelCycleTime[];
  handleLevelCycleTimeChange: (index: number, value: number) => void;
  isLoadingLevelData: boolean;
  setIsLoadingLevelData: (loading: boolean) => void;
  setLevelCycleTimes: (cycleTimes: LevelCycleTime[] | ((prev: LevelCycleTime[]) => LevelCycleTime[])) => void;
  saveLevelCycleTimesMutation: UseMutationResult<any, any, { jobId: string; cycleTimes: LevelCycleTime[] }, any>;
  handleLevelFieldChange: () => void;
  originalDaysInAdvance: number | null;
  originalOnsiteDate: string | null;
  setDaysInAdvanceChanged: (changed: boolean) => void;
  setOnsiteDateChanged: (changed: boolean) => void;
  setSchedulingSettingsChanged: (changed: boolean) => void;
  setQuickAddCustomerName: (name: string) => void;
  setQuickAddCustomerOpen: (open: boolean) => void;
  jobTypes?: JobType[];
}

export function JobFormDialog({
  open,
  onOpenChange,
  editingJob,
  jobForm,
  editDialogTab,
  setEditDialogTab,
  onSubmit,
  onFormError,
  createJobMutation,
  updateJobMutation,
  users,
  factories,
  activeCustomers,
  globalSettings,
  levelCycleTimes,
  handleLevelCycleTimeChange,
  isLoadingLevelData,
  setIsLoadingLevelData,
  setLevelCycleTimes,
  saveLevelCycleTimesMutation,
  handleLevelFieldChange,
  originalDaysInAdvance,
  originalOnsiteDate,
  setDaysInAdvanceChanged,
  setOnsiteDateChanged,
  setSchedulingSettingsChanged,
  setQuickAddCustomerName,
  setQuickAddCustomerOpen,
  jobTypes,
}: JobFormDialogProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingJob ? "Edit Job" : "Create New Job"}</DialogTitle>
          <DialogDescription>
            {editingJob ? "Update job details" : "Add a new job to the system"}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...jobForm}>
          <form onSubmit={jobForm.handleSubmit(onSubmit, onFormError)} className="space-y-4">
        <Tabs value={editDialogTab} onValueChange={setEditDialogTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details" data-testid="tab-job-details">Job Details</TabsTrigger>
            <TabsTrigger value="production" data-testid="tab-production">Production</TabsTrigger>
            <TabsTrigger value="levelCycleTimes" disabled={!editingJob} data-testid="tab-level-cycle-times">
              Level Cycle Times
            </TabsTrigger>
            <TabsTrigger value="members" disabled={!editingJob} data-testid="tab-job-members">
              Members
            </TabsTrigger>
            <TabsTrigger value="auditLog" disabled={!editingJob} data-testid="tab-audit-log">
              Audit Log
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="mt-4">
            <div className="space-y-4">
              <FormField
                control={jobForm.control}
                name="jobPhase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Phase</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {JOB_PHASES.map((phase) => {
                        const isSelected = (field.value || "OPPORTUNITY") === phase;
                        const colorClasses = PHASE_COLORS[phase];
                        return (
                          <Badge
                            key={phase}
                            data-testid={`badge-phase-${phase.toLowerCase()}`}
                            className={`cursor-pointer text-xs px-3 transition-all border ${
                              isSelected
                                ? `${colorClasses} ring-2 ring-offset-1 ring-current font-semibold`
                                : "bg-muted/50 text-muted-foreground border-transparent opacity-60"
                            }`}
                            onClick={() => {
                              field.onChange(phase);
                              const currentStatus = (jobForm.getValues("status") ?? '') as JobStatus;
                              if (!isValidStatusForPhase(phase as JobPhase, currentStatus)) {
                                jobForm.setValue("status", getDefaultStatusForPhase(phase as JobPhase) ?? "");
                              }
                            }}
                          >
                            {getPhaseLabel(phase)}
                          </Badge>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={jobForm.control}
                name="status"
                render={({ field }) => {
                  const currentPhase = (jobForm.watch("jobPhase") || "CONTRACTED") as JobPhase;
                  const allowedStatuses = PHASE_ALLOWED_STATUSES[currentPhase] || JOB_STATUSES;
                  return (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-job-status" className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allowedStatuses.map((status) => (
                            <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={jobForm.control}
                name="jobTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Type</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-job-type">
                          <SelectValue placeholder="Select job type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No job type</SelectItem>
                        {jobTypes?.filter(jt => jt.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((jt) => (
                          <SelectItem key={jt.id} value={jt.id}>
                            {jt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <h3 className="font-medium text-sm text-muted-foreground pt-2 border-t">Basic Information</h3>
                <FormField
                  control={jobForm.control}
                  name="jobNumber"
                  render={({ field }) => {
                    const hasAutoNumbering = !!globalSettings?.jobNumberPrefix;
                    return (
                      <FormItem>
                        <FormLabel>Job Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={hasAutoNumbering ? "Auto-generated" : "JOB001"}
                            {...field}
                            readOnly={hasAutoNumbering && !editingJob}
                            className={hasAutoNumbering && !editingJob ? "bg-muted font-mono" : ""}
                            data-testid="input-job-number"
                          />
                        </FormControl>
                        {hasAutoNumbering && !editingJob && (
                          <p className="text-xs text-muted-foreground">
                            Auto-generated from company settings
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={jobForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Job name" {...field} data-testid="input-job-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            if (value === "__quick_add__") {
                              setQuickAddCustomerName("");
                              setQuickAddCustomerOpen(true);
                              return;
                            }
                            if (value === "__none__") {
                              field.onChange(null);
                              jobForm.setValue("client", "");
                              return;
                            }
                            field.onChange(value);
                            const selected = activeCustomers?.find(c => c.id === value);
                            if (selected) {
                              jobForm.setValue("client", selected.name);
                            }
                          }}
                          value={field.value || "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-job-customer">
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No customer</SelectItem>
                            {activeCustomers?.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="__quick_add__">
                              <span className="flex items-center gap-1 text-primary">
                                <Plus className="h-3 w-3" /> Add new customer
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={jobForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} data-testid="input-job-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City / Suburb</FormLabel>
                        <FormControl>
                          <SuburbLookup
                            value={field.value || ""}
                            onChange={field.onChange}
                            onSelect={(result) => {
                              field.onChange(result.suburb);
                              jobForm.setValue("state", result.state as "VIC" | "NSW" | "QLD" | "SA" | "WA" | "TAS" | "NT" | "ACT");
                            }}
                            placeholder="Start typing suburb..."
                            data-testid="input-job-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "none" ? null : val)} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-job-state">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">-</SelectItem>
                            {AUSTRALIAN_STATES.map((state) => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="siteContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site Contact</FormLabel>
                        <FormControl>
                          <Input placeholder="Contact name" {...field} data-testid="input-job-site-contact" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="siteContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Phone number" {...field} data-testid="input-job-site-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="numberOfBuildings"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Buildings</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={0}
                            step="1"
                            placeholder="e.g. 3" 
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                            data-testid="input-job-number-of-buildings" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="levels"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Levels</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Ground,L1,L2,L3,Roof" 
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              const levelsValue = e.target.value;
                              const levelsCount = parseInt(levelsValue, 10);
                              const lowestLevel = parseInt(jobForm.getValues("lowestLevel") || "0", 10);
                              if (!isNaN(levelsCount) && levelsCount > 0 && !isNaN(lowestLevel)) {
                                const calculatedHighest = lowestLevel + levelsCount - 1;
                                jobForm.setValue("highestLevel", String(calculatedHighest));
                              }
                              handleLevelFieldChange();
                            }}
                            data-testid="input-job-levels" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Comma-separated list of level names</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="projectManagerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Manager</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "none" ? null : val)} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-job-project-manager">
                              <SelectValue placeholder="Select project manager" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Project Manager</SelectItem>
                            {users?.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((user) => (
                              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="factoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production Factory</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "none" ? null : val)} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-job-factory">
                              <SelectValue placeholder="Select factory" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Factory Assigned</SelectItem>
                            {factories?.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((factory) => (
                              <SelectItem key={factory.id} value={factory.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: factory.color || '#3B82F6' }}
                                  />
                                  {factory.name} ({factory.code})
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={jobForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Job description" {...field} data-testid="input-job-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
          </TabsContent>
          
          <TabsContent value="production" className="mt-4">
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Production Configuration</h3>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm">
                <p className="text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> All day values (cycle times, days in advance, etc.) are calculated as <strong>working days</strong>. 
                  Working days are determined by the assigned factory's work schedule (Mon-Fri by default) and CFMEU calendar (if configured). 
                  Non-work days and public holidays/RDOs are automatically excluded from calculations.
                </p>
              </div>
                <FormField
                  control={jobForm.control}
                  name="craneCapacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Crane Capacity</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 50T" {...field} data-testid="input-job-crane-capacity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="lowestLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lowest Level</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Ground" 
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              const lowestLevel = parseInt(e.target.value, 10);
                              const levelsValue = jobForm.getValues("levels");
                              const levelsCount = parseInt(levelsValue || "0", 10);
                              if (!isNaN(lowestLevel) && !isNaN(levelsCount) && levelsCount > 0) {
                                const calculatedHighest = lowestLevel + levelsCount - 1;
                                jobForm.setValue("highestLevel", String(calculatedHighest));
                              }
                              handleLevelFieldChange();
                            }}
                            data-testid="input-job-lowest-level" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Starting level</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="highestLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Highest Level</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Roof" 
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              const highestLevel = parseInt(e.target.value, 10);
                              const lowestLevel = parseInt(jobForm.getValues("lowestLevel") || "0", 10);
                              if (!isNaN(highestLevel) && !isNaN(lowestLevel) && highestLevel >= lowestLevel) {
                                const calculatedLevels = highestLevel - lowestLevel + 1;
                                jobForm.setValue("levels", String(calculatedLevels));
                              }
                              handleLevelFieldChange();
                            }}
                            data-testid="input-job-highest-level" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Final level</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={jobForm.control}
                  name="productionStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required Delivery Start</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...dateInputProps}
                          {...field} 
                          onBlur={(e) => {
                            field.onBlur();
                            if (editingJob) {
                              const newValue = e.target.value || null;
                              if (newValue !== originalOnsiteDate) {
                                setOnsiteDateChanged(true);
                              }
                            }
                          }}
                          data-testid="input-job-production-start-date" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="expectedCycleTimePerFloor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cycle Time (days)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            step="1"
                            placeholder="e.g., 5"
                            value={field.value ?? ""} 
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-job-cycle-time-per-floor" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Days per floor</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="daysInAdvance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IFC Days in Advance</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            step="1"
                            placeholder="e.g., 14"
                            value={field.value ?? ""} 
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            onBlur={(e) => {
                              field.onBlur();
                              if (editingJob) {
                                const newValue = e.target.value ? parseInt(e.target.value) : null;
                                if (newValue !== originalDaysInAdvance) {
                                  setDaysInAdvanceChanged(true);
                                }
                              }
                            }}
                            data-testid="input-job-days-in-advance" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Days before production for IFC</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="daysToAchieveIfc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days to Achieve IFC</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            step="1"
                            placeholder="e.g., 21"
                            value={field.value ?? ""} 
                            onChange={(e) => {
                              field.onChange(e.target.value ? parseInt(e.target.value) : null);
                              if (editingJob) {
                                setSchedulingSettingsChanged(true);
                              }
                            }}
                            data-testid="input-job-days-to-achieve-ifc" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Days to complete drafting</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={jobForm.control}
                    name="productionWindowDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production Window Days</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            step="1"
                            placeholder="e.g., 10"
                            value={field.value ?? ""} 
                            onChange={(e) => {
                              field.onChange(e.target.value ? parseInt(e.target.value) : null);
                              if (editingJob) {
                                setSchedulingSettingsChanged(true);
                              }
                            }}
                            data-testid="input-job-production-window-days" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Days before due date for production start</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="productionDaysInAdvance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production Days in Advance</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            step="1"
                            placeholder="e.g., 10"
                            value={field.value ?? ""} 
                            onChange={(e) => {
                              field.onChange(e.target.value ? parseInt(e.target.value) : null);
                              if (editingJob) {
                                setSchedulingSettingsChanged(true);
                              }
                            }}
                            data-testid="input-job-production-days-in-advance" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Days before site delivery</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={jobForm.control}
                    name="procurementDaysInAdvance"
                    render={({ field }) => {
                      const daysInAdvance = jobForm.watch("daysInAdvance") ?? globalSettings?.ifcDaysInAdvance ?? 14;
                      const isInvalid = field.value !== null && field.value !== undefined && field.value >= daysInAdvance;
                      return (
                        <FormItem>
                          <FormLabel>Procurement Days in Advance</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1"
                              max={daysInAdvance - 1}
                              step="1"
                              placeholder="e.g., 7"
                              value={field.value ?? ""} 
                              onChange={(e) => {
                                field.onChange(e.target.value ? parseInt(e.target.value) : null);
                                if (editingJob) {
                                  setSchedulingSettingsChanged(true);
                                }
                              }}
                              data-testid="input-job-procurement-days-in-advance" 
                            />
                          </FormControl>
                          {isInvalid && (
                            <p className="text-xs text-destructive">Must be less than IFC Days ({daysInAdvance})</p>
                          )}
                          <p className="text-xs text-muted-foreground">Days before production</p>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={jobForm.control}
                    name="procurementTimeDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Procurement Time (Days)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            step="1"
                            placeholder="e.g., 14"
                            value={field.value ?? ""} 
                            onChange={(e) => {
                              field.onChange(e.target.value ? parseInt(e.target.value) : null);
                              if (editingJob) {
                                setSchedulingSettingsChanged(true);
                              }
                            }}
                            data-testid="input-job-procurement-time-days" 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Days for procurement</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={jobForm.control}
                  name="productionSlotColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Slot Color</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <input
                            type="color"
                            value={field.value || "#3b82f6"}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="h-9 w-14 cursor-pointer rounded border border-input"
                            data-testid="input-job-production-slot-color"
                          />
                        </FormControl>
                        <Input
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="#3b82f6"
                          className="flex-1 font-mono text-sm"
                          data-testid="input-job-production-slot-color-text"
                        />
                        {field.value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => field.onChange(null)}
                            data-testid="button-clear-job-color"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
          </TabsContent>
          
          <TabsContent value="levelCycleTimes" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Job Programme</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage production levels, cycle times, predecessors, and scheduling via the Job Programme page
                  </p>
                </div>
              </div>

              <div className="py-8 text-center border rounded-md bg-muted/30">
                <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-muted-foreground mb-1">The Job Programme page provides full control over production scheduling.</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate levels, set cycle times, configure predecessor relationships, split into pours, and view the Gantt chart.
                </p>
                <Button
                  onClick={() => {
                    if (!editingJob) return;
                    onOpenChange(false);
                    setLocation(`/admin/jobs/${editingJob.id}/programme`);
                  }}
                  disabled={!editingJob}
                  data-testid="button-open-job-programme"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Job Programme
                </Button>
              </div>

              {levelCycleTimes.length > 0 && (
                <>
                  <div>
                    <h4 className="font-medium text-sm">Current Levels</h4>
                    <p className="text-xs text-muted-foreground">
                      {levelCycleTimes.length} level{levelCycleTimes.length !== 1 ? "s" : ""} configured
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Building</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead className="w-32">Cycle Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levelCycleTimes.map((item, index) => (
                        <TableRow key={`${item.buildingNumber}-${item.level}`}>
                          <TableCell>
                            <Badge variant="outline">B{item.buildingNumber}</Badge>
                          </TableCell>
                          <TableCell>{item.level}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              step="1"
                              value={item.cycleDays}
                              onChange={(e) => handleLevelCycleTimeChange(index, parseInt(e.target.value) || 1)}
                              className="w-20"
                              data-testid={`input-cycle-days-${item.buildingNumber}-${item.level}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        if (!editingJob) return;
                        saveLevelCycleTimesMutation.mutate({
                          jobId: editingJob.id,
                          cycleTimes: levelCycleTimes,
                        });
                      }}
                      disabled={saveLevelCycleTimesMutation.isPending || levelCycleTimes.length === 0}
                      data-testid="button-save-level-cycle-times"
                    >
                      {saveLevelCycleTimesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Cycle Times
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Job Members</h3>
                <p className="text-sm text-muted-foreground">Manage which users have access to this job's documents and files</p>
              </div>
              {editingJob ? (
                <JobMembersPanel jobId={editingJob.id} users={users} />
              ) : (
                <p className="text-sm text-muted-foreground">Save the job first to manage members.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="auditLog" className="mt-4">
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Job Audit Log</h3>
                <p className="text-sm text-muted-foreground">History of all changes made to this job</p>
              </div>
              {editingJob ? (
                <AuditLogPanel jobId={editingJob.id} />
              ) : (
                <p className="text-sm text-muted-foreground">Save the job first to view audit logs.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {editDialogTab !== "levelCycleTimes" && editDialogTab !== "auditLog" && editDialogTab !== "members" && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              onOpenChange(false);
              setSchedulingSettingsChanged(false);
            }}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createJobMutation.isPending || updateJobMutation.isPending}
              data-testid="button-save-job"
            >
              {(createJobMutation.isPending || updateJobMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Save className="h-4 w-4 mr-2" />
              {editingJob ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
