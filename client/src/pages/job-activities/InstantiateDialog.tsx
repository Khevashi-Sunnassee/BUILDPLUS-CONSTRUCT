import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateInputProps } from "@/lib/validation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { JobType } from "@shared/schema";

interface InstantiateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTypesData: JobType[];
  job: Record<string, unknown> | undefined;
  selectedJobTypeId: string;
  setSelectedJobTypeId: (id: string) => void;
  onConfirm: (jobTypeId: string, startDate: string) => void;
  isPending: boolean;
}

export function InstantiateDialog({
  open,
  onOpenChange,
  jobTypesData,
  job,
  selectedJobTypeId,
  setSelectedJobTypeId,
  onConfirm,
  isPending,
}: InstantiateDialogProps) {
  const [dateSource, setDateSource] = useState<"job" | "custom">("job");
  const [customStartDate, setCustomStartDate] = useState("");

  const jobStartDate = job?.estimatedStartDate
    ? format(new Date(job.estimatedStartDate as string), "yyyy-MM-dd")
    : job?.productionStartDate
      ? format(new Date(job.productionStartDate as string), "yyyy-MM-dd")
      : "";

  const effectiveStartDate = dateSource === "job" ? jobStartDate : customStartDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Load Activities from Workflow</DialogTitle>
          <DialogDescription>
            Select a job type and project start date. Activities will be scheduled sequentially (finish-to-start) based on their estimated durations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Job Type</Label>
            <Select value={selectedJobTypeId} onValueChange={setSelectedJobTypeId}>
              <SelectTrigger data-testid="select-job-type-instantiate">
                <SelectValue placeholder="Select a job type" />
              </SelectTrigger>
              <SelectContent>
                {jobTypesData?.filter(jt => jt.isActive).map(jt => (
                  <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Project Start Date</Label>
            <RadioGroup
              value={dateSource}
              onValueChange={(v) => setDateSource(v as "job" | "custom")}
              className="space-y-2"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="job" id="date-job" data-testid="radio-date-job" />
                <Label htmlFor="date-job" className="font-normal cursor-pointer">
                  Use job start date
                  {jobStartDate ? (
                    <span className="ml-2 text-muted-foreground">({format(new Date(jobStartDate), "dd MMM yyyy")})</span>
                  ) : (
                    <span className="ml-2 text-destructive text-xs">(No start date set on job)</span>
                  )}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="custom" id="date-custom" data-testid="radio-date-custom" />
                <Label htmlFor="date-custom" className="font-normal cursor-pointer">
                  Use a different date
                </Label>
              </div>
            </RadioGroup>

            {dateSource === "custom" && (
              <Input
                type="date"
                {...dateInputProps}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                data-testid="input-custom-start-date"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => selectedJobTypeId && effectiveStartDate && onConfirm(selectedJobTypeId, effectiveStartDate)}
            disabled={!selectedJobTypeId || !effectiveStartDate || isPending}
            data-testid="button-confirm-instantiate"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Load Activities
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
