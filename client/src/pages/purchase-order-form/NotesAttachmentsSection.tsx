import { UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Paperclip, Upload, FileText, Download, Trash2 } from "lucide-react";
import { PO_ATTACHMENTS_ROUTES } from "@shared/api-routes";
import type { FormValues, PurchaseOrderWithDetails, AttachmentWithUser } from "./types";
import { formatFileSize } from "./types";

export interface NotesAttachmentsSectionProps {
  form: UseFormReturn<FormValues>;
  canEdit: boolean;
  isNew: boolean;
  existingPO: PurchaseOrderWithDetails | undefined;
  attachments: AttachmentWithUser[];
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  uploadingFiles: boolean;
  handleFileDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  deleteAttachmentMutation: { mutate: (id: string) => void; isPending: boolean };
}

export function NotesAttachmentsSection({
  form,
  canEdit,
  isNew,
  existingPO,
  attachments,
  isDragging,
  setIsDragging,
  uploadingFiles,
  handleFileDrop,
  handleFileSelect,
  deleteAttachmentMutation,
}: NotesAttachmentsSectionProps) {
  return (
    <>
      <div>
        <Label className="text-sm font-medium">Notes</Label>
        {canEdit ? (
          <Textarea
            value={form.watch("notes") || ""}
            onChange={(e) => form.setValue("notes", e.target.value)}
            placeholder="Additional notes"
            className="min-h-[60px] mt-1"
            data-testid="textarea-notes"
          />
        ) : (
          <p className="mt-1 whitespace-pre-line">{existingPO?.notes || "-"}</p>
        )}
      </div>

      <div>
        <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Internal Notes
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">Not visible on PO</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <Textarea
                value={form.watch("internalNotes") || ""}
                onChange={(e) => form.setValue("internalNotes", e.target.value, { shouldDirty: true })}
                placeholder="Add internal notes (not visible on printed purchase order or sent to supplier)"
                className="min-h-[80px]"
                data-testid="textarea-internal-notes"
              />
            ) : (
              <p className="whitespace-pre-line text-sm text-muted-foreground">{existingPO?.internalNotes || "No internal notes"}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="print:hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            <h3 className="text-lg font-medium">Attachments</h3>
            {!isNew && attachments.length > 0 && (
              <Badge variant="secondary">{attachments.length}</Badge>
            )}
          </div>
        </div>

        {isNew ? (
          <div className="border-2 border-dashed rounded-lg p-6 text-center border-muted-foreground/25">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Save the purchase order first to upload attachments
            </p>
          </div>
        ) : (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              data-testid="dropzone-attachments"
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                onChange={handleFileSelect}
                data-testid="input-file-upload"
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                {uploadingFiles ? "Uploading files..." : "Drag and drop files here, or"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("file-upload")?.click()}
                disabled={uploadingFiles}
                data-testid="button-browse-files"
              >
                Browse Files
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                PDF, Word, Excel, Images (max 50MB each)
              </p>
            </div>

            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`attachment-${attachment.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{attachment.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.fileSize)} 
                          {attachment.uploadedBy && ` • Uploaded by ${attachment.uploadedBy.name || attachment.uploadedBy.email}`}
                          {attachment.createdAt && ` • ${format(new Date(attachment.createdAt), "dd/MM/yyyy HH:mm")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        data-testid={`button-download-${attachment.id}`}
                      >
                        <a href={`${PO_ATTACHMENTS_ROUTES.BY_ID(attachment.id)}/download`} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                        disabled={deleteAttachmentMutation.isPending}
                        data-testid={`button-delete-attachment-${attachment.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
