import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { dateInputProps } from "@/lib/validation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SlotFiltersProps, StatusFilter, GroupBy } from "./types";

export function SlotFilters({
  statusFilter,
  setStatusFilter,
  jobFilter,
  setJobFilter,
  factoryFilter,
  setFactoryFilter,
  groupBy,
  setGroupBy,
  dateFromFilter,
  setDateFromFilter,
  dateToFilter,
  setDateToFilter,
  allJobs,
  factories,
}: SlotFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="PENDING_UPDATE">Pending Update</SelectItem>
                <SelectItem value="BOOKED">Booked</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Job</Label>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger data-testid="select-job-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {[...allJobs].sort((a: any, b: any) => (a.jobNumber || a.name || '').localeCompare(b.jobNumber || b.name || '')).map((job: any) => (
                  <SelectItem key={job.id} value={job.id}>{job.jobNumber} - {job.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Factory</Label>
            <Select value={factoryFilter} onValueChange={setFactoryFilter}>
              <SelectTrigger data-testid="select-factory-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Factories</SelectItem>
                {[...factories.filter(f => f.isActive)].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((factory) => (
                  <SelectItem key={factory.id} value={factory.id}>{factory.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Group By</Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger data-testid="select-group-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Group by Week</SelectItem>
                <SelectItem value="job">Group by Job</SelectItem>
                <SelectItem value="factory">Group by Factory</SelectItem>
                <SelectItem value="client">Group by Client</SelectItem>
                <SelectItem value="none">No Grouping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date From</Label>
            <Input 
              type="date" 
              {...dateInputProps}
              value={dateFromFilter} 
              onChange={(e) => setDateFromFilter(e.target.value)} 
              data-testid="input-date-from-filter"
            />
          </div>
          <div>
            <Label>Date To</Label>
            <Input 
              type="date" 
              {...dateInputProps}
              value={dateToFilter} 
              onChange={(e) => setDateToFilter(e.target.value)} 
              data-testid="input-date-to-filter"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
