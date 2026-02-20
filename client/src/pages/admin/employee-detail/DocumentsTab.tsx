import { Edit2, Plus, Trash2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getExpiryBadgeVariant, statusLabel } from "./types";
import type { DocumentsTabProps } from "./types";

export function DocumentsTab({ documents, onAdd, onEdit, onDelete }: DocumentsTabProps) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold">Documents</h2>
        <Button onClick={onAdd} data-testid="button-add-document">
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const expiry = getExpiryBadgeVariant(doc.expiryDate);
                  return (
                    <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" data-testid={`badge-document-category-${doc.id}`}>
                          {statusLabel(doc.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>{doc.fileName || "-"}</TableCell>
                      <TableCell>{doc.issuedDate || "-"}</TableCell>
                      <TableCell>
                        {doc.expiryDate ? (
                          <Badge variant={expiry.variant} data-testid={`badge-document-expiry-${doc.id}`}>
                            {expiry.label}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => onEdit(doc)} data-testid={`button-edit-document-${doc.id}`}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDelete(doc.id)} data-testid={`button-delete-document-${doc.id}`}>
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
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
