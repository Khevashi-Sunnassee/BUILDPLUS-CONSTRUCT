import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit2, Briefcase, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Customer, Job } from "@shared/schema";
import { PROCUREMENT_ROUTES } from "@shared/api-routes";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

function formatCurrency(val: string | null | undefined) {
  if (!val) return "-";
  const num = parseFloat(val);
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(num);
}

export default function CustomerDetailPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/customers/:id");
  const id = params?.id || "";

  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [PROCUREMENT_ROUTES.CUSTOMER_BY_ID(id)],
    enabled: !!id,
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    enabled: !!id,
  });

  const jobs = allJobs.filter((j: any) => j.customerId === id);
  const jobCount = jobs.length;

  if (customerLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Customer Detail">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-6" role="main" aria-label="Customer Detail">
        <Button variant="ghost" onClick={() => setLocation("/admin/customers")} data-testid="button-back-customers">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Customer not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Customer Detail">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/customers")} data-testid="button-back-customers">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-customer-detail-name">
              {customer.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={customer.isActive ? "default" : "secondary"} data-testid="badge-customer-status">
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={() => setLocation("/admin/customers")} data-testid="button-edit-customer">
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Customer
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList data-testid="tabs-customer-detail">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <User className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Briefcase className="h-4 w-4 mr-2" />
            Jobs
            <Badge variant={jobCount > 0 ? "default" : "secondary"} className="ml-1.5 h-5 min-w-[20px] px-1.5 text-xs" data-testid="badge-job-count">
              {jobCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-company-info">
              <CardHeader>
                <CardTitle className="text-lg">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Name" value={customer.name} />
                <InfoRow label="Key Contact" value={customer.keyContact} />
                <InfoRow label="ABN" value={customer.abn} />
                <InfoRow label="ACN" value={customer.acn} />
              </CardContent>
            </Card>
            <Card data-testid="card-contact-details">
              <CardHeader>
                <CardTitle className="text-lg">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Email" value={customer.email} />
                <InfoRow label="Phone" value={customer.phone} />
                <InfoRow label="Payment Terms" value={customer.paymentTerms} />
              </CardContent>
            </Card>
            <Card data-testid="card-address">
              <CardHeader>
                <CardTitle className="text-lg">Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Address Line 1" value={customer.addressLine1} />
                <InfoRow label="Address Line 2" value={customer.addressLine2} />
                <InfoRow label="City / Suburb" value={customer.city} />
                <InfoRow label="State" value={customer.state} />
                <InfoRow label="Postcode" value={customer.postcode} />
                <InfoRow label="Country" value={customer.country} />
              </CardContent>
            </Card>
            <Card data-testid="card-status-notes">
              <CardHeader>
                <CardTitle className="text-lg">Status & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={customer.isActive ? "default" : "secondary"} data-testid="badge-overview-status">
                    {customer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {customer.notes && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <p className="font-medium whitespace-pre-wrap" data-testid="text-customer-notes">{customer.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {jobs.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Est. Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer"
                        onClick={() => setLocation("/admin/jobs")}
                        data-testid={`row-customer-job-${job.id}`}
                      >
                        <TableCell className="font-mono text-sm" data-testid={`text-job-number-${job.id}`}>{job.jobNumber}</TableCell>
                        <TableCell className="font-medium" data-testid={`text-job-name-${job.id}`}>{job.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs" data-testid={`badge-job-status-${job.id}`}>{job.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm" data-testid={`text-job-value-${job.id}`}>
                          {formatCurrency(job.estimatedValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm" data-testid="text-no-jobs">No jobs linked to this customer</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
