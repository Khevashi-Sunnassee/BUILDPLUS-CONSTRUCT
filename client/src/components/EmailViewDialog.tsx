import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, User, Users, Calendar } from "lucide-react";

interface EmailData {
  emailSubject?: string | null;
  emailFrom?: string | null;
  emailTo?: string | null;
  emailDate?: string | null;
  emailBody?: string | null;
  content?: string;
}

interface EmailViewDialogProps {
  email: EmailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailViewDialog({ email, open, onOpenChange }: EmailViewDialogProps) {
  if (!email) return null;

  const body = email.emailBody || email.content || "";

  let formattedDate = email.emailDate || "";
  if (email.emailDate) {
    try {
      formattedDate = format(new Date(email.emailDate), "EEEE, dd MMMM yyyy 'at' HH:mm");
    } catch {
      formattedDate = email.emailDate;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-email-view">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2" data-testid="text-email-subject">
            <Mail className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <span className="truncate">{email.emailSubject || "(No Subject)"}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Full email content view</DialogDescription>
        </DialogHeader>

        <div className="border rounded-md overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="p-4 bg-muted/20 space-y-2 flex-shrink-0 border-b">
            {email.emailFrom && (
              <div className="flex items-center gap-3 text-sm" data-testid="text-email-from">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-muted-foreground w-12 flex-shrink-0">From</span>
                <span>{email.emailFrom}</span>
              </div>
            )}
            {email.emailTo && (
              <div className="flex items-center gap-3 text-sm" data-testid="text-email-to">
                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-muted-foreground w-12 flex-shrink-0">To</span>
                <span>{email.emailTo}</span>
              </div>
            )}
            {email.emailDate && (
              <div className="flex items-center gap-3 text-sm" data-testid="text-email-date">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-muted-foreground w-12 flex-shrink-0">Date</span>
                <span>{formattedDate}</span>
              </div>
            )}
          </div>

          <div className="p-4 overflow-y-auto flex-1" data-testid="text-email-body">
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{body}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
