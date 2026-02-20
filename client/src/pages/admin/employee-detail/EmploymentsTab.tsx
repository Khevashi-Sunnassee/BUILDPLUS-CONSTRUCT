import { Edit2, Plus, Trash2, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { statusLabel } from "./types";
import type { EmploymentsTabProps } from "./types";

export function EmploymentsTab({ employments, onAdd, onEdit, onDelete }: EmploymentsTabProps) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">Employment History</h2>
        <Button onClick={onAdd} data-testid="button-add-employment">
          <Plus className="h-4 w-4 mr-2" />
          Add Employment
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {employments && employments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Employment Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Base Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employments.map((emp) => (
                  <TableRow key={emp.id} data-testid={`row-employment-${emp.id}`}>
                    <TableCell>
                      <Badge variant={emp.status === "active" ? "default" : "secondary"} data-testid={`badge-employment-status-${emp.id}`}>
                        {statusLabel(emp.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{emp.positionTitle || emp.jobTitle || "-"}</TableCell>
                    <TableCell>{statusLabel(emp.employmentType)}</TableCell>
                    <TableCell>{emp.startDate}</TableCell>
                    <TableCell>{emp.endDate || "-"}</TableCell>
                    <TableCell>{emp.baseRate ? `$${emp.baseRate}` : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(emp)} data-testid={`button-edit-employment-${emp.id}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(emp.id)} data-testid={`button-delete-employment-${emp.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No employment records yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
