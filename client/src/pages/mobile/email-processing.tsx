import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AP_INBOX_ROUTES, TENDER_INBOX_ROUTES, DRAFTING_INBOX_ROUTES } from "@shared/api-routes";
import {
  ArrowLeft,
  FileText,
  Pencil,
  Receipt,
  Mail,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type InboxCategory = "ap" | "drafting" | "tender";

interface InboxCounts {
  received: number;
  processing: number;
  processed: number;
  matched: number;
  archived: number;
  failed: number;
  all: number;
}

interface InboxEmail {
  id: string;
  fromAddress: string;
  subject: string | null;
  status: string;
  attachmentCount: number | null;
  createdAt: string;
  jobId?: string | null;
  requestType?: string | null;
  impactArea?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  supplierName?: string | null;
}

function getUnprocessedCount(counts: InboxCounts | undefined): number {
  if (!counts) return 0;
  return (counts.received || 0) + (counts.processing || 0) + (counts.processed || 0) + (counts.failed || 0);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-gray-500 text-white",
  PROCESSING: "bg-amber-500 text-white",
  PROCESSED: "bg-indigo-500 text-white",
  MATCHED: "bg-green-600 text-white",
  FAILED: "bg-red-500 text-white",
  ARCHIVED: "bg-gray-400 text-white",
  NO_ATTACHMENTS: "bg-gray-400 text-white",
  NO_PDF_ATTACHMENTS: "bg-gray-400 text-white",
};

function isUnprocessed(status: string): boolean {
  const s = status.toUpperCase();
  return s !== "MATCHED" && s !== "ARCHIVED";
}

function CategoryButton({
  icon,
  label,
  count,
  active,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-colors ${
        active
          ? `border-white/30 bg-white/10`
          : "border-white/10 bg-white/5"
      }`}
      data-testid={`button-category-${label.toLowerCase()}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <span className="text-xs font-semibold text-white">{label}</span>
      {count > 0 && (
        <span className="inline-flex min-w-[20px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function EmailListItem({ email, category }: { email: InboxEmail; category: InboxCategory }) {
  const [, navigate] = useLocation();
  const statusLabel = email.status.replace(/_/g, " ");

  const handleClick = () => {
    if (category === "drafting") {
      navigate(`/mobile/drafting-emails/${email.id}`);
    } else if (category === "tender") {
      navigate(`/mobile/tender-emails/${email.id}`);
    } else if (category === "ap") {
      if (email.invoiceId) {
        navigate(`/mobile/ap-invoices/${email.invoiceId}`);
      } else {
        navigate(`/mobile/ap-invoices/${email.id}`);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/5 text-left active:scale-[0.99]"
      data-testid={`email-item-${email.id}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 shrink-0 mt-0.5">
        <Mail className="h-4 w-4 text-white/60" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-white truncate" data-testid={`text-subject-${email.id}`}>
          {email.subject || "No subject"}
        </p>
        <p className="text-xs text-white/60 truncate" data-testid={`text-from-${email.id}`}>
          {email.fromAddress}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[email.status.toUpperCase()] || "bg-gray-500 text-white"}`}>
            {statusLabel}
          </Badge>
          {email.attachmentCount && email.attachmentCount > 0 && (
            <span className="text-[10px] text-white/50 flex items-center gap-0.5">
              <FileText className="h-3 w-3" />
              {email.attachmentCount}
            </span>
          )}
          <span className="text-[10px] text-white/40">{formatDate(email.createdAt)}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-white/30 mt-1 shrink-0" />
    </button>
  );
}

export default function MobileEmailProcessing() {
  const [category, setCategory] = useState<InboxCategory>("drafting");

  const { data: apCounts } = useQuery<InboxCounts>({
    queryKey: [AP_INBOX_ROUTES.COUNTS],
  });

  const { data: tenderCounts } = useQuery<InboxCounts>({
    queryKey: [TENDER_INBOX_ROUTES.COUNTS],
  });

  const { data: draftingCounts } = useQuery<InboxCounts>({
    queryKey: [DRAFTING_INBOX_ROUTES.COUNTS],
  });

  const { data: apData, isLoading: loadingAp } = useQuery<any>({
    queryKey: [AP_INBOX_ROUTES.EMAILS],
    enabled: category === "ap",
  });

  const { data: tenderData, isLoading: loadingTender } = useQuery<any>({
    queryKey: [TENDER_INBOX_ROUTES.LIST],
    enabled: category === "tender",
  });

  const { data: draftingData, isLoading: loadingDrafting } = useQuery<any>({
    queryKey: [DRAFTING_INBOX_ROUTES.LIST],
    enabled: category === "drafting",
  });

  const extractEmails = (data: any): InboxEmail[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.emails)) return data.emails;
    return [];
  };

  const emailsMap: Record<InboxCategory, InboxEmail[]> = {
    ap: extractEmails(apData),
    tender: extractEmails(tenderData),
    drafting: extractEmails(draftingData),
  };

  const loadingMap: Record<InboxCategory, boolean> = {
    ap: loadingAp,
    tender: loadingTender,
    drafting: loadingDrafting,
  };

  const currentEmails = emailsMap[category].filter(e => isUnprocessed(e.status));
  const isLoading = loadingMap[category];

  const categoryLabels: Record<InboxCategory, string> = {
    ap: "AP Invoices",
    tender: "Tenders",
    drafting: "Drafting",
  };

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden">
      <header className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/mobile/dashboard">
            <button className="text-white/80" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <h1 className="text-lg font-bold" data-testid="text-page-title">Email Processing</h1>
        </div>
      </header>

      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex gap-2">
          <CategoryButton
            icon={<Receipt className="h-5 w-5 text-rose-300" />}
            label="AP Invoices"
            count={getUnprocessedCount(apCounts)}
            active={category === "ap"}
            color="bg-rose-500/20"
            onClick={() => setCategory("ap")}
          />
          <CategoryButton
            icon={<Pencil className="h-5 w-5 text-indigo-300" />}
            label="Drafting"
            count={getUnprocessedCount(draftingCounts)}
            active={category === "drafting"}
            color="bg-indigo-500/20"
            onClick={() => setCategory("drafting")}
          />
          <CategoryButton
            icon={<FileText className="h-5 w-5 text-emerald-300" />}
            label="Tenders"
            count={getUnprocessedCount(tenderCounts)}
            active={category === "tender"}
            color="bg-emerald-500/20"
            onClick={() => setCategory("tender")}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/80" data-testid="text-category-label">
            {categoryLabels[category]} - To Process
          </h2>
          <span className="text-xs text-white/50">{currentEmails.length} email{currentEmails.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? (
          <div className="space-y-3" data-testid="skeleton-emails">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-white/10" />
                <Skeleton className="h-3 w-1/2 bg-white/10" />
                <Skeleton className="h-3 w-1/3 bg-white/10" />
              </div>
            ))}
          </div>
        ) : currentEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
            <AlertCircle className="h-12 w-12 text-white/20 mb-3" />
            <p className="text-sm text-white/60">No unprocessed {categoryLabels[category].toLowerCase()} emails</p>
            <p className="text-xs text-white/40 mt-1">All emails have been matched or archived</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentEmails.map(email => (
              <EmailListItem key={email.id} email={email} category={category} />
            ))}
          </div>
        )}

      </div>

      <MobileBottomNav />
    </div>
  );
}
