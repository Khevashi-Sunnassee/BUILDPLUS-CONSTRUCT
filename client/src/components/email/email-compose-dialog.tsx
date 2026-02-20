import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Send, ChevronDown, ChevronUp, Mail, Loader2 } from "lucide-react";

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string;
  jobId?: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  templateType?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  templateType: string;
}

export function EmailComposeDialog({
  open,
  onOpenChange,
  taskId,
  jobId,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  templateType,
}: EmailComposeDialogProps) {
  const { toast } = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [htmlBody, setHtmlBody] = useState(defaultBody);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const resetForm = useCallback(() => {
    setSelectedTemplateId("none");
    setTo(defaultTo);
    setCc("");
    setBcc("");
    setSubject(defaultSubject);
    setHtmlBody(defaultBody);
    setShowCcBcc(false);
  }, [defaultTo, defaultSubject, defaultBody]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const templateQueryKey = templateType
    ? ["/api/email-templates", { type: templateType }]
    : ["/api/email-templates"];

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: templateQueryKey,
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: {
      templateId: string | null;
      taskId: string | null;
      jobId: string | null;
      to: string;
      cc: string | null;
      bcc: string | null;
      subject: string;
      htmlBody: string;
    }) => {
      const res = await apiRequest("POST", "/api/emails/send", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Email sent",
        description: "Your email has been sent successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message || "An error occurred while sending the email.",
        variant: "destructive",
      });
    },
  });

  const handleTemplateChange = (value: string) => {
    setSelectedTemplateId(value);
    if (value === "none") {
      setSubject(defaultSubject);
      setHtmlBody(defaultBody);
      return;
    }
    const template = templates.find((t) => t.id === value);
    if (template) {
      setSubject(template.subject || "");
      setHtmlBody(template.htmlBody || "");
    }
  };

  const validateEmailList = (emailStr: string): boolean => {
    if (!emailStr || !emailStr.trim()) return false;
    const emails = emailStr.split(",").map(e => e.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.length > 0 && emails.every(e => emailRegex.test(e));
  };

  const handleSend = () => {
    if (!to.trim()) {
      toast({
        title: "Recipient required",
        description: "Please enter at least one recipient email address.",
        variant: "destructive",
      });
      return;
    }
    if (!validateEmailList(to)) {
      toast({
        title: "Invalid email address",
        description: "Please enter valid email addresses in the To field.",
        variant: "destructive",
      });
      return;
    }
    if (cc.trim() && !validateEmailList(cc)) {
      toast({
        title: "Invalid CC address",
        description: "Please enter valid email addresses in the CC field.",
        variant: "destructive",
      });
      return;
    }
    if (bcc.trim() && !validateEmailList(bcc)) {
      toast({
        title: "Invalid BCC address",
        description: "Please enter valid email addresses in the BCC field.",
        variant: "destructive",
      });
      return;
    }
    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please enter a subject for your email.",
        variant: "destructive",
      });
      return;
    }

    sendMutation.mutate({
      templateId: selectedTemplateId !== "none" ? selectedTemplateId : null,
      taskId: taskId || null,
      jobId: jobId || null,
      to: to.trim(),
      cc: cc.trim() || null,
      bcc: bcc.trim() || null,
      subject: subject.trim(),
      htmlBody,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] flex flex-col"
        data-testid="email-compose-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Email
          </DialogTitle>
          <DialogDescription>
            Compose and send an email. Select a template or write from scratch.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="email-template" className="text-sm font-medium">
              Template
            </Label>
            <Select
              value={selectedTemplateId}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger
                id="email-template"
                data-testid="select-email-template"
              >
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" data-testid="select-template-none">
                  None - Blank Email
                </SelectItem>
                {templates.map((template) => (
                  <SelectItem
                    key={template.id}
                    value={template.id}
                    data-testid={`select-template-${template.id}`}
                  >
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-to" className="text-sm font-medium">
                To
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCcBcc(!showCcBcc)}
                data-testid="button-toggle-cc-bcc"
                className="text-xs text-muted-foreground"
              >
                CC / BCC
                {showCcBcc ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                )}
              </Button>
            </div>
            <Input
              id="email-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com, another@example.com"
              data-testid="input-email-to"
            />
          </div>

          {showCcBcc && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email-cc" className="text-sm font-medium">
                  CC
                </Label>
                <Input
                  id="email-cc"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  data-testid="input-email-cc"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-bcc" className="text-sm font-medium">
                  BCC
                </Label>
                <Input
                  id="email-bcc"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  data-testid="input-email-bcc"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email-subject" className="text-sm font-medium">
              Subject
            </Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              data-testid="input-email-subject"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Body</Label>
            <RichTextEditor
              content={htmlBody}
              onChange={setHtmlBody}
              placeholder="Compose your email..."
              minHeight="250px"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sendMutation.isPending}
            data-testid="button-cancel-email"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending}
            data-testid="button-send-email"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
