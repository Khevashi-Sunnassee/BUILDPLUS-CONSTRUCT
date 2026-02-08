import { Loader2, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { UseMutationResult } from "@tanstack/react-query";

interface JobImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importData: any[];
  importJobsMutation: UseMutationResult<any, any, any[], any>;
}

export function JobImportDialog({
  open,
  onOpenChange,
  importData,
  importJobsMutation,
}: JobImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Jobs from Excel
          </DialogTitle>
          <DialogDescription>
            Review the data before importing. {importData.length} rows found.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[300px] overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importData.slice(0, 10).map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono">{row.jobNumber || row["Job Number"] || row.job_number || "-"}</TableCell>
                  <TableCell>{row.name || row["Name"] || row["Job Name"] || "-"}</TableCell>
                  <TableCell>{row.client || row["Client"] || "-"}</TableCell>
                  <TableCell>{row.address || row["Address"] || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {importData.length > 10 && (
            <div className="p-2 text-center text-sm text-muted-foreground">
              ... and {importData.length - 10} more rows
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => importJobsMutation.mutate(importData)}
            disabled={importJobsMutation.isPending}
            data-testid="button-confirm-import"
          >
            {importJobsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Upload className="h-4 w-4 mr-2" />
            Import {importData.length} Jobs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
