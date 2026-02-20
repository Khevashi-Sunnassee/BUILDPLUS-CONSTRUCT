import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MAIL_REGISTER_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Plus,
  X,
  Send,
  Mail,
  Loader2,
  CalendarIcon,
  Hash,
} from "lucide-react";

interface MailType {
  id: string;
  name: string;
  abbreviation: string;
  category: "MAIL" | "TRANSMITTAL";
  sortOrder: number;
}

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultSubject?: string;
  defaultTo?: string[];
  defaultMessage?: string;
  taskId?: string;
  jobId?: string;
  parentMailId?: string;
  teamUsers?: Array<{ id: string; name: string | null; email: string | null }>;
}

export function EmailComposeDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultSubject = "",
  defaultTo = [],
  defaultMessage = "",
  taskId,
  jobId,
  parentMailId,
  teamUsers = [],
}: EmailComposeDialogProps) {
  const { toast } = useToast();
  const [mailTypeId, setMailTypeId] = useState("");
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [additionalEmail, setAdditionalEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [responseRequired, setResponseRequired] = useState<string>("");
  const [responseDueDate, setResponseDueDate] = useState<Date | undefined>();
  const [sendCopy, setSendCopy] = useState(false);
  const [generatedMailNumber, setGeneratedMailNumber] = useState("");

  const { data: mailTypes = [] } = useQuery<MailType[]>({
    queryKey: [MAIL_REGISTER_ROUTES.TYPES],
    enabled: open,
  });

  const mailCategories = mailTypes.reduce((acc, mt) => {
    if (!acc[mt.category]) acc[mt.category] = [];
    acc[mt.category].push(mt);
    return acc;
  }, {} as Record<string, MailType[]>);

  useEffect(() => {
    if (open) {
      setToEmails(defaultTo);
      setAdditionalEmail("");
      setCcEmail("");
      setSubject(defaultSubject);
      setMessage(defaultMessage);
      setMailTypeId("");
      setResponseRequired("");
      setResponseDueDate(undefined);
      setSendCopy(false);
      setGeneratedMailNumber("");
    }
  }, [open, defaultSubject, defaultTo, defaultMessage]);

  useEffect(() => {
    if (mailTypeId && open) {
      fetchNextNumber(mailTypeId);
    }
  }, [mailTypeId, open]);

  const fetchNextNumber = async (typeId: string) => {
    try {
      const res = await fetch(`${MAIL_REGISTER_ROUTES.NEXT_NUMBER}?mailTypeId=${typeId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setGeneratedMailNumber(data.mailNumber);
      }
    } catch {}
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", MAIL_REGISTER_ROUTES.CREATE, {
        mailTypeId,
        toAddresses: toEmails.join(", "),
        ccAddresses: ccEmail || undefined,
        subject,
        htmlBody: `<div style="font-family: Arial, sans-serif; font-size: 14px;">${message.replace(/\n/g, "<br/>")}</div>`,
        responseRequired: responseRequired || null,
        responseDueDate: responseDueDate?.toISOString() || null,
        jobId: jobId || null,
        taskId: taskId || null,
        parentMailId: parentMailId || null,
        sendCopy,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email sent",
        description: `Mail ${data.mailNumber} sent to ${toEmails.length} recipient${toEmails.length !== 1 ? "s" : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: [MAIL_REGISTER_ROUTES.LIST] });
      onOpenChange(false);
      onSuccess?.();
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

  const handleAddEmail = () => {
    const email = additionalEmail.trim();
    if (email && !toEmails.includes(email)) {
      setToEmails([...toEmails, email]);
      setAdditionalEmail("");
    }
  };

  const handleRemoveEmail = (email: string) => {
    setToEmails(toEmails.filter((e) => e !== email));
  };

  const handleSend = () => {
    if (!mailTypeId) {
      toast({ title: "Type required", description: "Please select a mail type", variant: "destructive" });
      return;
    }
    if (toEmails.length === 0) {
      toast({ title: "Recipients required", description: "Please add at least one recipient email address", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Subject required", description: "Please enter a subject", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[950px] max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden" data-testid="dialog-email-compose">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2" data-testid="text-email-compose-title">
            <Mail className="h-5 w-5" />
            {parentMailId ? "Reply to Mail" : "Create Mail"}
          </DialogTitle>
          <DialogDescription>
            {generatedMailNumber ? (
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {generatedMailNumber}
              </span>
            ) : "Compose and send registered mail"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-[460px] flex-shrink-0 border-r flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <Label>Mail Type</Label>
                <Select value={mailTypeId} onValueChange={setMailTypeId} data-testid="select-mail-type">
                  <SelectTrigger data-testid="trigger-mail-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(mailCategories).map(([category, types]) => (
                      <SelectGroup key={category}>
                        <SelectLabel>{category === "MAIL" ? "Mail Types" : "Transmittal Types"}</SelectLabel>
                        {types.map((mt) => (
                          <SelectItem key={mt.id} value={mt.id} data-testid={`option-mail-type-${mt.abbreviation}`}>
                            {mt.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>To</Label>
                <div className="flex flex-wrap gap-1 p-2 min-h-[38px] border rounded-md bg-background">
                  {toEmails.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1" data-testid={`badge-to-email-${email}`}>
                      {email}
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`btn-remove-email-${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    type="email"
                    placeholder="Add email..."
                    value={additionalEmail}
                    onChange={(e) => setAdditionalEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                    onBlur={handleAddEmail}
                    className="flex-1 min-w-[150px] h-7 border-0 shadow-none focus-visible:ring-0 text-sm"
                    data-testid="input-mail-email-add"
                  />
                </div>
                {teamUsers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Quick add from team:</p>
                    <div className="flex flex-wrap gap-1">
                      {teamUsers
                        .filter((u) => u.email && !toEmails.includes(u.email))
                        .slice(0, 6)
                        .map((u) => (
                          <Badge
                            key={u.id}
                            variant="outline"
                            className="cursor-pointer text-xs"
                            onClick={() => u.email && setToEmails([...toEmails, u.email])}
                            data-testid={`btn-quick-add-${u.id}`}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {u.name || u.email}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mail-cc">Cc</Label>
                <Input
                  id="mail-cc"
                  type="email"
                  placeholder="cc@example.com"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  data-testid="input-mail-cc"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Response Required</Label>
                  <Select value={responseRequired} onValueChange={setResponseRequired}>
                    <SelectTrigger data-testid="trigger-response-required">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">Yes</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                      <SelectItem value="FOR_INFORMATION">For Information</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Response Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !responseDueDate && "text-muted-foreground")}
                        data-testid="btn-response-due-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {responseDueDate ? format(responseDueDate, "dd/MM/yyyy") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={responseDueDate}
                        onSelect={setResponseDueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mail-subject">Subject</Label>
                <Input
                  id="mail-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject..."
                  data-testid="input-mail-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mail-message">Message</Label>
                <Textarea
                  id="mail-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="resize-none text-sm"
                  placeholder="Type your message..."
                  data-testid="input-mail-message"
                />
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="mail-send-copy"
                  checked={sendCopy}
                  onCheckedChange={(v) => setSendCopy(!!v)}
                  data-testid="checkbox-mail-send-copy"
                />
                <Label htmlFor="mail-send-copy" className="text-sm cursor-pointer">Send myself a copy</Label>
              </div>
            </div>

            <div className="flex-shrink-0 border-t p-4 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-mail">
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sendMutation.isPending} data-testid="button-send-mail">
                {sendMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
            <div className="flex border-b px-4">
              <div className="px-4 py-2.5 text-sm font-medium border-b-2 border-primary text-foreground">
                Preview
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="max-w-md mx-auto space-y-3">
                {generatedMailNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-mono" data-testid="badge-mail-number">{generatedMailNumber}</Badge>
                    {mailTypes.find(mt => mt.id === mailTypeId) && (
                      <Badge variant="secondary">{mailTypes.find(mt => mt.id === mailTypeId)?.name}</Badge>
                    )}
                  </div>
                )}
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="text-sm">{toEmails.join(", ") || "—"}</p>
                  </div>
                  {ccEmail && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Cc</p>
                      <p className="text-sm">{ccEmail}</p>
                    </div>
                  )}
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="text-sm font-medium">{generatedMailNumber ? `[${generatedMailNumber}] ` : ""}{subject || "—"}</p>
                  </div>
                  <Separator />
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground min-h-[60px]">
                    {message || "No message content"}
                  </div>
                  {(responseRequired || responseDueDate) && (
                    <>
                      <Separator />
                      <div className="flex gap-4 text-xs">
                        {responseRequired && (
                          <div>
                            <span className="text-muted-foreground">Response: </span>
                            <Badge variant={responseRequired === "YES" ? "default" : "secondary"} className="text-[10px]">
                              {responseRequired === "YES" ? "Required" : responseRequired === "NO" ? "Not Required" : "For Info"}
                            </Badge>
                          </div>
                        )}
                        {responseDueDate && (
                          <div>
                            <span className="text-muted-foreground">Due: </span>
                            <span className="font-medium">{format(responseDueDate, "dd/MM/yyyy")}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
