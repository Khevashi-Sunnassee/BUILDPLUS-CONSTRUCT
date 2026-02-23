import { useState } from "react";
import DOMPurify from 'dompurify';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MAIL_REGISTER_ROUTES } from "@shared/api-routes";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  Plus,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Clock,
  Hash,
} from "lucide-react";
import { EmailComposeDialog } from "./EmailComposeDialog";

interface MailType {
  id: string;
  name: string;
  abbreviation: string;
  category: "MAIL" | "TRANSMITTAL";
}

interface MailEntry {
  id: string;
  mailNumber: string;
  mailTypeId: string;
  mailTypeName: string;
  mailTypeCategory: string;
  mailTypeAbbreviation: string;
  toAddresses: string;
  ccAddresses: string | null;
  subject: string;
  htmlBody?: string;
  responseRequired: string | null;
  responseDueDate: string | null;
  status: string;
  sentById: string;
  sentByName: string | null;
  messageId: string | null;
  threadId: string | null;
  parentMailId: string | null;
  sentAt: string;
  thread?: MailEntry[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500",
  QUEUED: "bg-yellow-500",
  SENT: "bg-blue-500",
  DELIVERED: "bg-green-500",
  REPLIED: "bg-purple-500",
  CLOSED: "bg-gray-700",
  FAILED: "bg-red-500",
};

const PAGE_SIZE = 25;

export default function MailRegisterPage() {
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(0);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const { toast } = useToast();

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/mail-register/${id}/retry`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email queued for retry" });
      queryClient.invalidateQueries({ queryKey: [MAIL_REGISTER_ROUTES.LIST] });
      if (selectedMailId) {
        queryClient.invalidateQueries({ queryKey: ["/api/mail-register", selectedMailId] });
      }
    },
    onError: () => {
      toast({ title: "Failed to retry email", variant: "destructive" });
    },
  });

  const { data: mailTypes = [] } = useQuery<MailType[]>({
    queryKey: [MAIL_REGISTER_ROUTES.TYPES],
  });

  const { data: listData, isLoading } = useQuery<{ items: MailEntry[]; total: number }>({
    queryKey: [MAIL_REGISTER_ROUTES.LIST, { search, mailTypeId: filterType, status: filterStatus, offset: page * PAGE_SIZE, limit: PAGE_SIZE }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterType) params.set("mailTypeId", filterType);
      if (filterStatus) params.set("status", filterStatus);
      params.set("offset", String(page * PAGE_SIZE));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`${MAIL_REGISTER_ROUTES.LIST}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: selectedMail } = useQuery<MailEntry>({
    queryKey: [MAIL_REGISTER_ROUTES.LIST, selectedMailId],
    queryFn: async () => {
      const res = await fetch(MAIL_REGISTER_ROUTES.BY_ID(selectedMailId!), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedMailId,
  });

  const items = listData?.items || [];
  const total = listData?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full" role="main" aria-label="Mail Register" data-testid="page-mail-register">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2" data-testid="text-mail-register-title">
            <Mail className="h-5 w-5" />
            Mail Register
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage all formal correspondence
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} data-testid="button-create-mail">
          <Plus className="mr-2 h-4 w-4" />
          Create Mail
        </Button>
      </div>

      <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by number, subject, recipient..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
            data-testid="input-mail-search"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[180px]" data-testid="trigger-filter-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {mailTypes.map((mt) => (
              <SelectItem key={mt.id} value={mt.id}>{mt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[140px]" data-testid="trigger-filter-status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="QUEUED">Queued</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="REPLIED">Replied</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <Mail className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No mail entries found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Create your first mail to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Mail Number</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-[200px]">To</TableHead>
                <TableHead className="w-[100px]">Response</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[120px]">Sent By</TableHead>
                <TableHead className="w-[130px]">Sent At</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={`cursor-pointer ${entry.responseRequired === "YES" ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50" : "hover:bg-muted/50"}`}
                  onClick={() => setSelectedMailId(entry.id)}
                  data-testid={`row-mail-${entry.id}`}
                >
                  <TableCell>
                    <span className="font-mono text-xs font-medium" data-testid={`text-mail-number-${entry.id}`}>
                      {entry.mailNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {entry.mailTypeName}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate" data-testid={`text-mail-subject-${entry.id}`}>
                    {entry.subject}
                  </TableCell>
                  <TableCell className="text-sm truncate max-w-[200px]">{entry.toAddresses}</TableCell>
                  <TableCell>
                    {entry.responseRequired && (
                      <div className="flex items-center gap-1">
                        {entry.responseRequired === "YES" && <Clock className="h-3.5 w-3.5 text-orange-500" />}
                        <span className="text-xs">
                          {entry.responseRequired === "YES" ? "Required" : entry.responseRequired === "NO" ? "No" : "Info"}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-white text-[10px] ${STATUS_COLORS[entry.status] || "bg-gray-500"}`}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{entry.sentByName || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(entry.sentAt), "dd/MM/yy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setSelectedMailId(entry.id); }}
                      data-testid={`btn-view-mail-${entry.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t text-sm">
          <span className="text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="btn-prev-page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="btn-next-page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Sheet open={!!selectedMailId} onOpenChange={(open) => !open && setSelectedMailId(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto" data-testid="sheet-mail-detail">
          {selectedMail && (
            <div className="space-y-4">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  {selectedMail.mailNumber}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedMail.mailTypeName}</Badge>
                  <Badge className={`text-white text-[10px] ${STATUS_COLORS[selectedMail.status] || "bg-gray-500"}`}>
                    {selectedMail.status}
                  </Badge>
                  {selectedMail.status === "FAILED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryMutation.mutate(selectedMail.id)}
                      disabled={retryMutation.isPending}
                      data-testid="button-retry-email"
                    >
                      {retryMutation.isPending ? "Retrying..." : "Retry"}
                    </Button>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">To: </span>
                    <span>{selectedMail.toAddresses}</span>
                  </div>
                  {selectedMail.ccAddresses && (
                    <div>
                      <span className="text-muted-foreground">Cc: </span>
                      <span>{selectedMail.ccAddresses}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Sent by: </span>
                    <span>{selectedMail.sentByName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sent: </span>
                    <span>{format(new Date(selectedMail.sentAt), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                </div>

                {(selectedMail.responseRequired || selectedMail.responseDueDate) && (
                  <div className="rounded-md border p-3 space-y-1">
                    {selectedMail.responseRequired && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Response: </span>
                        <Badge variant={selectedMail.responseRequired === "YES" ? "default" : "secondary"} className="text-[10px]">
                          {selectedMail.responseRequired === "YES" ? "Required" : selectedMail.responseRequired === "NO" ? "Not Required" : "For Info"}
                        </Badge>
                      </div>
                    )}
                    {selectedMail.responseDueDate && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Due: </span>
                        <span>{format(new Date(selectedMail.responseDueDate), "dd/MM/yyyy")}</span>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Subject</p>
                  <p className="text-sm">{selectedMail.subject}</p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Message</p>
                  {selectedMail.htmlBody ? (
                    <div
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedMail.htmlBody || '') }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No message content</p>
                  )}
                </div>

                {selectedMail.thread && selectedMail.thread.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        Thread ({selectedMail.thread.length})
                      </p>
                      <div className="space-y-2">
                        {selectedMail.thread.map((t) => (
                          <div
                            key={t.id}
                            className="rounded-md border p-2 text-xs space-y-1 cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedMailId(t.id)}
                            data-testid={`thread-entry-${t.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-medium">{t.mailNumber}</span>
                              <Badge className={`text-white text-[9px] ${STATUS_COLORS[t.status] || "bg-gray-500"}`}>
                                {t.status}
                              </Badge>
                            </div>
                            <p className="truncate">{t.subject}</p>
                            <p className="text-muted-foreground">
                              {t.sentByName} · {format(new Date(t.sentAt), "dd/MM/yy HH:mm")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <EmailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSuccess={() => setComposeOpen(false)}
      />
    </div>
  );
}
