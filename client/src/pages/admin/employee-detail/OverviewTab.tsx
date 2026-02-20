import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OverviewTabProps } from "./types";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

export function OverviewTab({ employee }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <InfoRow label="First Name" value={employee.firstName} />
          <InfoRow label="Middle Name" value={employee.middleName} />
          <InfoRow label="Last Name" value={employee.lastName} />
          <InfoRow label="Preferred Name" value={employee.preferredName} />
          <InfoRow label="Date of Birth" value={employee.dateOfBirth} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <InfoRow label="Email" value={employee.email} />
          <InfoRow label="Phone" value={employee.phone} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <InfoRow label="Address Line 1" value={employee.addressLine1} />
          <InfoRow label="Address Line 2" value={employee.addressLine2} />
          <InfoRow label="Suburb" value={employee.suburb} />
          <InfoRow label="State" value={employee.state} />
          <InfoRow label="Postcode" value={employee.postcode} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <InfoRow label="Name" value={employee.emergencyContactName} />
          <InfoRow label="Phone" value={employee.emergencyContactPhone} />
          <InfoRow label="Relationship" value={employee.emergencyContactRelationship} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resource Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {employee.isDraftingResource && <Badge variant="secondary">Drafting</Badge>}
            {employee.isProductionResource && <Badge variant="secondary">Production</Badge>}
            {employee.isSiteResource && <Badge variant="secondary">Site</Badge>}
            {employee.receiveEscalatedWorkOrders && <Badge variant="secondary">Escalated Work Orders</Badge>}
            {employee.workRights && <Badge variant="secondary">Work Rights</Badge>}
            {!employee.isDraftingResource && !employee.isProductionResource && !employee.isSiteResource && (
              <span className="text-muted-foreground text-sm">No resource flags set</span>
            )}
          </div>
        </CardContent>
      </Card>
      {employee.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{employee.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
