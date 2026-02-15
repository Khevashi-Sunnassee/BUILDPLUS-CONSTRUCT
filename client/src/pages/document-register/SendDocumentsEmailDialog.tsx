import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Mail,
  Send,
  Loader2,
  Paperclip,
  Archive,
  FileStack,
  Link2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import type { DocumentWithDetails } from "./types";
import { formatFileSize } from "./types";

const ATTACHMENT_SIZE_LIMIT = 20 * 1024 * 1024;

interface SendDocumentsEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocuments: DocumentWithDetails[];
  onSuccess: () => void;
}

export function SendDocumentsEmailDialog({ open, onOpenChange, selectedDocuments, onSuccess }: SendDocumentsEmailDialogProps) {
  const { toast } = useToast();
  const [toEmail, setToEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sendCopy, setSendCopy] = useState(false);
  const [combinePdf, setCombinePdf] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"attach" | "links">("attach");

  const multipleSelected = selectedDocuments.length > 1;
  const pdfCount = selectedDocuments.filter(d =>
    d.mimeType === "application/pdf" || d.originalName?.toLowerCase().endsWith(".pdf")
  ).length;
  const canCombine = pdfCount >= 2;

  const totalBytes = useMemo(() =>
    selectedDocuments.reduce((sum, d) => sum + (d.fileSize || 0), 0),
    [selectedDocuments]
  );

  const exceedsAttachmentLimit = totalBytes > ATTACHMENT_SIZE_LIMIT;

  const buildDocumentList = useCallback((docs: DocumentWithDetails[]) => {
    return docs.map((d) => `- ${d.title} (${d.originalName})`).join("\n");
  }, []);

  const resetForm = useCallback(() => {
    setToEmail("");
    setCcEmail("");
    setSubject("");
    setMessage("");
    setSendCopy(false);
    setCombinePdf(false);
    setDeliveryMethod("attach");
  }, []);

  useEffect(() => {
    if (open && selectedDocuments.length > 0) {
      setToEmail("");
      setCcEmail("");
      setSendCopy(false);
      setCombinePdf(false);

      const total = selectedDocuments.reduce((sum, d) => sum + (d.fileSize || 0), 0);
      const forceLinks = total > ATTACHMENT_SIZE_LIMIT;
      setDeliveryMethod(forceLinks ? "links" : "attach");

      const methodLabel = forceLinks ? "download links included" : "attached";
      setSubject(`Documents - ${selectedDocuments.length} file${selectedDocuments.length > 1 ? "s" : ""} ${methodLabel}`);
      setMessage(
        forceLinks
          ? `Hi,\n\nPlease find download links for the documents you requested below.\n\n${buildDocumentList(selectedDocuments)}\n\nLinks are valid for 7 days.\n\nKind regards`
          : `Hi,\n\nPlease find attached the documents you requested.\n\n${buildDocumentList(selectedDocuments)}\n\nKind regards`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || selectedDocuments.length === 0) return;
    const methodLabel = deliveryMethod === "links" ? "download links included" : "attached";
    setSubject(`Documents - ${selectedDocuments.length} file${selectedDocuments.length > 1 ? "s" : ""} ${methodLabel}`);
    setMessage(
      deliveryMethod === "links"
        ? `Hi,\n\nPlease find download links for the documents you requested below.\n\n${buildDocumentList(selectedDocuments)}\n\nLinks are valid for 7 days.\n\nKind regards`
        : `Hi,\n\nPlease find attached the documents you requested.\n\n${buildDocumentList(selectedDocuments)}\n\nKind regards`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryMethod]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", DOCUMENT_ROUTES.SEND_DOCUMENTS_EMAIL, {
        to: toEmail,
        cc: ccEmail || undefined,
        subject,
        message,
        documentIds: selectedDocuments.map((d) => d.id),
        sendCopy,
        combinePdf: deliveryMethod === "attach" && combinePdf && canCombine,
        sendAsLinks: deliveryMethod === "links",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.sentAsLinks) {
        toast({ title: "Email sent", description: `Download links emailed to ${toEmail} (${data.attachedCount} document${data.attachedCount !== 1 ? "s" : ""})` });
      } else {
        const zippedNote = data.zipped ? " (sent as zip)" : "";
        const combinedNote = data.combined ? " (combined into single PDF)" : "";
        toast({ title: "Email sent", description: `Documents emailed to ${toEmail} (${data.attachedCount} file${data.attachedCount !== 1 ? "s" : ""} attached${combinedNote}${zippedNote})` });
      }
      onOpenChange(false);
      resetForm();
      onSuccess();
    },
    onError: (err: any) => {
      let errorMsg = err.message || "An error occurred";
      try {
        const jsonMatch = errorMsg.match(/\d+:\s*(\{.*\})/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          errorMsg = parsed.error || errorMsg;
        }
      } catch (error) { console.error("Failed to send document email:", error); }
      toast({ title: "Failed to send email", description: errorMsg, variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!toEmail.trim()) {
      toast({ title: "Email required", description: "Please enter a recipient email address", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] h-[85vh] p-0 gap-0 flex flex-col" data-testid="dialog-send-documents-email">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2" data-testid="text-email-dialog-title">
            <Mail className="h-5 w-5" />
            Email Documents
          </DialogTitle>
          <DialogDescription>
            Send {selectedDocuments.length} document{selectedDocuments.length !== 1 ? "s" : ""} via email
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <div className="w-[420px] flex-shrink-0 border-r overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-email-to">To</Label>
              <Input
                id="doc-email-to"
                type="email"
                placeholder="recipient@example.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                data-testid="input-doc-email-to"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-email-cc">Cc</Label>
              <Input
                id="doc-email-cc"
                type="email"
                placeholder="cc@example.com"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                data-testid="input-doc-email-cc"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-email-subject">Subject</Label>
              <Input
                id="doc-email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="input-doc-email-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-email-message">Message</Label>
              <Textarea
                id="doc-email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="resize-none text-sm"
                data-testid="input-doc-email-message"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Delivery method</Label>
                <Select
                  value={deliveryMethod}
                  onValueChange={(v) => setDeliveryMethod(v as "attach" | "links")}
                  data-testid="select-delivery-method"
                >
                  <SelectTrigger data-testid="select-trigger-delivery-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attach" disabled={exceedsAttachmentLimit} data-testid="select-item-attach">
                      <span className="flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" />
                        Attach files directly
                        {exceedsAttachmentLimit && <span className="text-xs text-muted-foreground">(exceeds 20MB)</span>}
                      </span>
                    </SelectItem>
                    <SelectItem value="links" data-testid="select-item-links">
                      <span className="flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5" />
                        Send download links
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {exceedsAttachmentLimit && deliveryMethod === "links" && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Total size ({formatFileSize(totalBytes)}) exceeds 20MB attachment limit. Download links will be sent instead.</span>
                  </div>
                )}
                {deliveryMethod === "links" && (
                  <p className="text-xs text-muted-foreground">Links expire after 7 days. Recipients can download files without logging in.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="doc-send-copy"
                  checked={sendCopy}
                  onCheckedChange={(v) => setSendCopy(!!v)}
                  data-testid="checkbox-doc-send-copy"
                />
                <Label htmlFor="doc-send-copy" className="text-sm cursor-pointer">Send myself a copy</Label>
              </div>
              {deliveryMethod === "attach" && canCombine && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="doc-combine-pdf"
                    checked={combinePdf}
                    onCheckedChange={(v) => setCombinePdf(!!v)}
                    data-testid="checkbox-doc-combine-pdf"
                  />
                  <Label htmlFor="doc-combine-pdf" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <FileStack className="h-3.5 w-3.5" />
                    Combine PDFs into a single file
                  </Label>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-doc-email">
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sendMutation.isPending} data-testid="button-send-doc-email">
                {sendMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send email
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
            <div className="flex border-b px-4">
              <div className="px-4 py-2.5 text-sm font-medium border-b-2 border-primary text-foreground">
                Email Preview
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <Card className="max-w-md mx-auto" data-testid="card-doc-email-preview">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center space-y-1">
                    <p className="text-lg font-semibold">Document Delivery</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDocuments.length} document{selectedDocuments.length !== 1 ? "s" : ""}
                      {deliveryMethod === "links" ? " — download links" : " attached"}
                    </p>
                  </div>
                  <Separator />
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {message}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {deliveryMethod === "links" ? "Download Links" : "Attachments"}
                      </p>
                      {deliveryMethod === "attach" && (() => {
                        const willZip = !combinePdf && totalBytes > 5 * 1024 * 1024;
                        return (
                          <div className="flex items-center gap-1.5" data-testid="text-total-attachment-size">
                            {combinePdf && canCombine && <FileStack className="h-3.5 w-3.5 text-muted-foreground" />}
                            {willZip && <Archive className="h-3.5 w-3.5 text-muted-foreground" />}
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(totalBytes)}
                              {combinePdf && canCombine ? " — PDFs will be combined into single file" : willZip ? " — will be zipped" : ""}
                            </p>
                          </div>
                        );
                      })()}
                      {deliveryMethod === "links" && (
                        <p className="text-xs text-muted-foreground" data-testid="text-links-expiry">
                          Expires in 7 days
                        </p>
                      )}
                    </div>
                    {deliveryMethod === "attach" && combinePdf && canCombine ? (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border text-sm" data-testid="email-attachment-combined">
                        <FileStack className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">Combined Documents.pdf</p>
                          <p className="text-xs text-muted-foreground">{pdfCount} PDFs combined into one file{pdfCount < selectedDocuments.length ? ` + ${selectedDocuments.length - pdfCount} other attachment(s)` : ""}</p>
                        </div>
                      </div>
                    ) : (
                      selectedDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border text-sm" data-testid={`email-attachment-${doc.id}`}>
                          {deliveryMethod === "links" ? (
                            <Link2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{doc.originalName} ({formatFileSize(doc.fileSize)})</p>
                          </div>
                          {deliveryMethod === "links" && (
                            <span className="text-xs text-blue-500 flex-shrink-0">Download</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
