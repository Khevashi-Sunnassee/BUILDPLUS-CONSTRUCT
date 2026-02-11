import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Mail,
  Send,
  Loader2,
  Paperclip,
  Archive,
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
import { DOCUMENT_ROUTES } from "@shared/api-routes";
import type { DocumentWithDetails } from "./types";
import { formatFileSize } from "./types";

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

  const buildDocumentList = useCallback((docs: DocumentWithDetails[]) => {
    return docs.map((d) => `- ${d.title} (${d.originalName})`).join("\n");
  }, []);

  const resetForm = useCallback(() => {
    setToEmail("");
    setCcEmail("");
    setSubject("");
    setMessage("");
    setSendCopy(false);
  }, []);

  useEffect(() => {
    if (open && selectedDocuments.length > 0) {
      setToEmail("");
      setCcEmail("");
      setSendCopy(false);
      setSubject(`Documents - ${selectedDocuments.length} file${selectedDocuments.length > 1 ? "s" : ""} attached`);
      setMessage(
        `Hi,\n\nPlease find attached the documents you requested.\n\n${buildDocumentList(selectedDocuments)}\n\nKind regards`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", DOCUMENT_ROUTES.SEND_DOCUMENTS_EMAIL, {
        to: toEmail,
        cc: ccEmail || undefined,
        subject,
        message,
        documentIds: selectedDocuments.map((d) => d.id),
        sendCopy,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      const zippedNote = data.zipped ? " (sent as zip)" : "";
      toast({ title: "Email sent", description: `Documents emailed to ${toEmail} (${data.attachedCount} files attached${zippedNote})` });
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
      } catch {}
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
                rows={10}
                className="resize-none text-sm"
                data-testid="input-doc-email-message"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="doc-send-copy"
                  checked={sendCopy}
                  onCheckedChange={(v) => setSendCopy(!!v)}
                  data-testid="checkbox-doc-send-copy"
                />
                <Label htmlFor="doc-send-copy" className="text-sm cursor-pointer">Send myself a copy</Label>
              </div>
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
                      {selectedDocuments.length} document{selectedDocuments.length !== 1 ? "s" : ""} attached
                    </p>
                  </div>
                  <Separator />
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {message}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>
                      {(() => {
                        const totalBytes = selectedDocuments.reduce((sum, d) => sum + (d.fileSize || 0), 0);
                        const willZip = totalBytes > 5 * 1024 * 1024;
                        return (
                          <div className="flex items-center gap-1.5" data-testid="text-total-attachment-size">
                            {willZip && <Archive className="h-3.5 w-3.5 text-muted-foreground" />}
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(totalBytes)}{willZip ? " — will be zipped" : ""}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                    {selectedDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border text-sm" data-testid={`email-attachment-${doc.id}`}>
                        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{doc.originalName} ({formatFileSize(doc.fileSize)})</p>
                        </div>
                      </div>
                    ))}
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
