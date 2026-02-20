import { Edit2, Plus, Trash2, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getExpiryBadgeVariant, statusLabel } from "./types";
import type { LicencesTabProps } from "./types";

export function LicencesTab({ licences, onAdd, onEdit, onDelete }: LicencesTabProps) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">Licences</h2>
        <Button onClick={onAdd} data-testid="button-add-licence">
          <Plus className="h-4 w-4 mr-2" />
          Add Licence
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {licences && licences.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licences.map((lic) => {
                  const expiry = getExpiryBadgeVariant(lic.expiryDate);
                  return (
                    <TableRow key={lic.id} data-testid={`row-licence-${lic.id}`}>
                      <TableCell className="font-medium">{lic.licenceType}</TableCell>
                      <TableCell>{lic.licenceNumber || "-"}</TableCell>
                      <TableCell>{lic.issuingAuthority || "-"}</TableCell>
                      <TableCell>{lic.issueDate || "-"}</TableCell>
                      <TableCell>
                        {lic.expiryDate ? (
                          <Badge variant={expiry.variant} data-testid={`badge-licence-expiry-${lic.id}`}>
                            {expiry.label}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={lic.status === "active" ? "default" : lic.status === "expired" ? "destructive" : "secondary"} data-testid={`badge-licence-status-${lic.id}`}>
                          {statusLabel(lic.status || "active")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => onEdit(lic)} data-testid={`button-edit-licence-${lic.id}`}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDelete(lic.id)} data-testid={`button-delete-licence-${lic.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No licences yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
