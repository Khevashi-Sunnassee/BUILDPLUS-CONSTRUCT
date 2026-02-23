import { Edit2, Plus, Trash2, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getExpiryBadgeVariant, statusLabel } from "./types";
import type { LicencesTabProps } from "./types";

function formatDaysLabel(diffDays: number | null): string | null {
  if (diffDays === null) return null;
  if (diffDays < 0) return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} overdue`;
  if (diffDays === 0) return "Expires today";
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} remaining`;
}

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
                  const isExpired = expiry.diffDays !== null && expiry.diffDays < 0;
                  const isExpiringSoon = expiry.diffDays !== null && expiry.diffDays >= 0 && expiry.diffDays <= 30;
                  const daysLabel = formatDaysLabel(expiry.diffDays);
                  return (
                    <TableRow
                      key={lic.id}
                      className={isExpired ? "bg-red-50 dark:bg-red-950/20" : isExpiringSoon ? "bg-orange-50/50 dark:bg-orange-950/10" : ""}
                      data-testid={`row-licence-${lic.id}`}
                    >
                      <TableCell className="font-medium">{lic.licenceType}</TableCell>
                      <TableCell>{lic.licenceNumber || "-"}</TableCell>
                      <TableCell>{lic.issuingAuthority || "-"}</TableCell>
                      <TableCell>{lic.issueDate || "-"}</TableCell>
                      <TableCell>
                        {lic.expiryDate ? (
                          <div className="space-y-0.5">
                            <Badge
                              variant={expiry.variant}
                              className={isExpiringSoon ? "border-orange-500 text-orange-600 dark:text-orange-400" : ""}
                              data-testid={`badge-licence-expiry-${lic.id}`}
                            >
                              {expiry.label}
                            </Badge>
                            {daysLabel && (
                              <p className={`text-xs ${isExpired ? "text-red-600 dark:text-red-400 font-medium" : isExpiringSoon ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`} data-testid={`text-licence-days-${lic.id}`}>
                                {daysLabel}
                              </p>
                            )}
                          </div>
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
