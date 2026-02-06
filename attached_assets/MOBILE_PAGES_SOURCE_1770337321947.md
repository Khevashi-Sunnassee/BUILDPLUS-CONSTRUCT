# Mobile Pages Source Code (Part 2)

This is a companion to MOBILE_INTEGRATION_GUIDE.md. Create each file at the path indicated.

---

### FILE: client/src/pages/mobile/chat.tsx

```tsx
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CHAT_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { MessageSquare, Users, Hash, Send, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  sender?: User;
}

interface Conversation {
  id: string;
  name: string | null;
  type: "DM" | "GROUP" | "CHANNEL";
  unreadCount: number;
  unreadMentions: number;
  lastMessage?: {
    body: string | null;
    createdAt: string;
    sender?: { name: string | null };
  } | null;
  members?: Array<{ user?: User }>;
}

export default function MobileChatPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: [CHAT_ROUTES.CONVERSATIONS],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: [CHAT_ROUTES.MESSAGES(selectedConversationId || "")],
    enabled: !!selectedConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", CHAT_ROUTES.MESSAGES(selectedConversationId!), { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.MESSAGES(selectedConversationId!)] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
      setMessageContent("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", CHAT_ROUTES.MARK_READ_CONVERSATION(conversationId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.CONVERSATIONS] });
    },
  });

  useEffect(() => {
    if (selectedConversationId) {
      markReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversationId) return;

    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const keyboardOffset = windowHeight - viewportHeight;
        setKeyboardHeight(keyboardOffset > 50 ? keyboardOffset : 0);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, [selectedConversationId]);

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
    const aTime = a.lastMessage?.createdAt || "";
    const bTime = b.lastMessage?.createdAt || "";
    return bTime.localeCompare(aTime);
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const getConversationName = (conv: Conversation): string => {
    if (conv.name) return conv.name;
    const otherMember = conv.members?.find(m => m.user?.id !== currentUser?.id);
    return otherMember?.user?.name || otherMember?.user?.email || "Conversation";
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getConversationIcon = (type: string) => {
    switch (type) {
      case "CHANNEL": return Hash;
      case "GROUP": return Users;
      default: return MessageSquare;
    }
  };

  const handleSendMessage = () => {
    if (messageContent.trim() && selectedConversationId) {
      sendMessageMutation.mutate(messageContent.trim());
    }
  };

  if (selectedConversationId && selectedConversation) {
    const convName = getConversationName(selectedConversation);
    
    return (
      <div 
        className="fixed inset-0 flex flex-col bg-[#070B12]"
        style={{ height: keyboardHeight > 0 ? `calc(100% - ${keyboardHeight}px)` : '100%' }}
      >
        <header className="flex-shrink-0 flex items-center gap-2 px-2 py-3 bg-[#0D1117] border-b border-white/10 safe-area-top">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedConversationId(null)}
            className="text-white"
            data-testid="button-back-chat"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-purple-500/20 text-purple-400 text-sm">
              {selectedConversation.type === "DM" ? getInitials(convName) : <Users className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-white text-lg font-semibold flex-1 truncate">
            {convName}
          </h1>
        </header>

        <main 
          className="flex-1 overflow-y-auto px-4 py-4" 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {messagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-2xl bg-white/10" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-white/30 mb-3" />
              <p className="text-white/60">No messages yet</p>
              <p className="text-sm text-white/40">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isOwn = message.senderId === currentUser?.id;
                const senderName = message.sender?.name || message.sender?.email || "Unknown";

                return (
                  <div
                    key={message.id}
                    className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                  >
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2",
                      isOwn 
                        ? "bg-purple-500 text-white rounded-br-md" 
                        : "bg-white/10 text-white rounded-bl-md"
                    )}>
                      {!isOwn && selectedConversation.type !== "DM" && (
                        <p className="text-xs font-medium text-white/60 mb-1">
                          {senderName}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                      <p className={cn(
                        "text-xs mt-1",
                        isOwn ? "text-white/70" : "text-white/50"
                      )}>
                        {format(new Date(message.createdAt), "HH:mm")}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <footer className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-[#0D1117]">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-full bg-white/10 border-white/20 text-white placeholder:text-white/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              data-testid="input-message"
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!messageContent.trim() || sendMessageMutation.isPending}
              className="rounded-full bg-purple-500 hover:bg-purple-600"
              data-testid="button-send"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="text-2xl font-bold" data-testid="text-chat-title">Messages</div>
          <div className="text-sm text-white/60">
            {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No conversations yet</p>
            <p className="text-sm text-white/40">Start a chat from the desktop app</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedConversations.map((conv) => {
              const name = getConversationName(conv);
              const Icon = getConversationIcon(conv.type);
              
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
                    conv.unreadCount > 0 ? "bg-white/5" : "bg-white/3"
                  )}
                  data-testid={`conversation-${conv.id}`}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-purple-500/20 text-purple-400">
                      {conv.type === "DM" ? getInitials(name) : <Icon className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={cn(
                        "font-medium text-sm truncate text-white",
                        conv.unreadCount > 0 && "font-semibold"
                      )}>
                        {name}
                      </h3>
                      {conv.lastMessage?.createdAt && (
                        <span className="text-xs text-white/50 flex-shrink-0">
                          {format(new Date(conv.lastMessage.createdAt), "HH:mm")}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage?.body && (
                      <p className={cn(
                        "text-sm truncate",
                        conv.unreadCount > 0 ? "text-white/80" : "text-white/50"
                      )}>
                        {conv.lastMessage.body}
                      </p>
                    )}
                  </div>

                  {conv.unreadCount > 0 && (
                    <span className="inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-red-500 px-2 text-[12px] font-semibold text-white flex-shrink-0">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
```

---

### FILE: client/src/pages/mobile/jobs.tsx

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ADMIN_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Briefcase, MapPin, User, ChevronRight, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface Job {
  id: string;
  jobNumber: string;
  name: string;
  client: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  siteContact: string | null;
  siteContactPhone: string | null;
  productionStartDate: string | null;
  numberOfBuildings: number | null;
  levels: string | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  ON_HOLD: { label: "On Hold", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  COMPLETED: { label: "Completed", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function MobileJobsPage() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: [ADMIN_ROUTES.JOBS],
  });

  const activeJobs = jobs.filter(j => j.status === "ACTIVE");
  const otherJobs = jobs.filter(j => j.status !== "ACTIVE");

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="text-2xl font-bold" data-testid="text-jobs-title">Jobs</div>
          <div className="text-sm text-white/60">
            {activeJobs.length} active {activeJobs.length === 1 ? 'job' : 'jobs'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No jobs yet</p>
            <p className="text-sm text-white/40">Jobs will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Active Jobs
                </h2>
                <div className="space-y-3">
                  {activeJobs.map((job) => (
                    <JobCard key={job.id} job={job} onSelect={() => setSelectedJob(job)} />
                  ))}
                </div>
              </div>
            )}

            {otherJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Other Jobs
                </h2>
                <div className="space-y-3">
                  {otherJobs.map((job) => (
                    <JobCard key={job.id} job={job} onSelect={() => setSelectedJob(job)} muted />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedJob && (
            <JobDetailSheet job={selectedJob} onClose={() => setSelectedJob(null)} />
          )}
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function JobCard({ 
  job, 
  onSelect,
  muted = false 
}: { 
  job: Job; 
  onSelect: () => void;
  muted?: boolean;
}) {
  const status = statusConfig[job.status] || statusConfig.ACTIVE;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/3" : "bg-white/5"
      )}
      data-testid={`job-${job.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-white">
            {job.jobNumber} - {job.name}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-xs text-white/50">
        {job.client && (
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {job.client}
          </span>
        )}
        {(job.city || job.state) && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {[job.city, job.state].filter(Boolean).join(", ")}
          </span>
        )}
      </div>
    </button>
  );
}

function JobDetailSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const status = statusConfig[job.status] || statusConfig.ACTIVE;

  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-left flex-1 text-white">{job.jobNumber} - {job.name}</SheetTitle>
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        {job.client && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Client</label>
            <p className="text-sm text-white">{job.client}</p>
          </div>
        )}

        {job.address && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Address</label>
            <p className="text-sm text-white">
              {job.address}
              {(job.city || job.state) && (
                <><br />{[job.city, job.state].filter(Boolean).join(", ")}</>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {job.siteContact && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Site Contact</label>
              <p className="text-sm text-white">{job.siteContact}</p>
            </div>
          )}
          {job.siteContactPhone && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Phone</label>
              <a href={`tel:${job.siteContactPhone}`} className="text-sm text-blue-400 underline">
                {job.siteContactPhone}
              </a>
            </div>
          )}
          {job.productionStartDate && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Production Start</label>
              <p className="text-sm text-white">{format(new Date(job.productionStartDate), "dd MMM yyyy")}</p>
            </div>
          )}
          {job.numberOfBuildings && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Buildings</label>
              <p className="text-sm text-white">{job.numberOfBuildings}</p>
            </div>
          )}
          {job.levels && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Levels</label>
              <p className="text-sm text-white">{job.levels}</p>
            </div>
          )}
        </div>

        {job.siteContactPhone && (
          <Button 
            variant="outline" 
            className="w-full mt-4 border-white/20 text-white"
            onClick={() => window.location.href = `tel:${job.siteContactPhone}`}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call Site Contact
          </Button>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 mt-4">
        <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
```

---

### FILE: client/src/pages/mobile/panels.tsx

```tsx
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PANELS_ROUTES, ADMIN_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ClipboardList, Layers, Building2, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

type PanelStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";

interface Panel {
  id: string;
  panelMark: string;
  panelType: string | null;
  description: string | null;
  status: PanelStatus;
  building: string | null;
  level: string | null;
  panelThickness: string | null;
  panelArea: string | null;
  panelMass: string | null;
  job?: {
    id: string;
    jobNumber: string;
    name: string;
  };
}

const statusConfig: Record<PanelStatus, { label: string; color: string; bgColor: string }> = {
  NOT_STARTED: { label: "Not Started", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", bgColor: "bg-slate-500" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", bgColor: "bg-blue-500" },
  COMPLETED: { label: "Completed", color: "bg-green-500/20 text-green-400 border-green-500/30", bgColor: "bg-green-500" },
  ON_HOLD: { label: "On Hold", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", bgColor: "bg-yellow-500" },
};

const statusOrder: PanelStatus[] = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"];

export default function MobilePanelsPage() {
  const { toast } = useToast();
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null);

  const { data: panels = [], isLoading } = useQuery<Panel[]>({
    queryKey: [PANELS_ROUTES.LIST],
  });

  const updatePanelMutation = useMutation({
    mutationFn: async ({ panelId, status }: { panelId: string; status: PanelStatus }) => {
      return apiRequest("PATCH", ADMIN_ROUTES.PANEL_BY_ID(panelId), { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PANELS_ROUTES.LIST] });
      toast({ title: "Panel status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update panel", variant: "destructive" });
    },
  });

  const inProgressPanels = panels.filter(p => p.status === "IN_PROGRESS");
  const notStartedPanels = panels.filter(p => p.status === "NOT_STARTED").slice(0, 10);
  const otherPanels = panels.filter(p => !["IN_PROGRESS", "NOT_STARTED"].includes(p.status)).slice(0, 5);

  const handleStatusChange = (panelId: string, status: PanelStatus) => {
    updatePanelMutation.mutate({ panelId, status });
    if (selectedPanel?.id === panelId) {
      setSelectedPanel({ ...selectedPanel, status });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-panels-title">Panel Register</div>
            <div className="text-sm text-white/60">
              {panels.length} total panels
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : panels.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No panels yet</p>
            <p className="text-sm text-white/40">Panels will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {inProgressPanels.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  In Progress ({inProgressPanels.length})
                </h2>
                <div className="space-y-3">
                  {inProgressPanels.map((panel) => (
                    <PanelCard 
                      key={panel.id} 
                      panel={panel} 
                      onSelect={() => setSelectedPanel(panel)} 
                    />
                  ))}
                </div>
              </div>
            )}

            {notStartedPanels.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Not Started ({panels.filter(p => p.status === "NOT_STARTED").length})
                </h2>
                <div className="space-y-3">
                  {notStartedPanels.map((panel) => (
                    <PanelCard 
                      key={panel.id} 
                      panel={panel} 
                      onSelect={() => setSelectedPanel(panel)} 
                    />
                  ))}
                </div>
              </div>
            )}

            {otherPanels.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Other
                </h2>
                <div className="space-y-3">
                  {otherPanels.map((panel) => (
                    <PanelCard 
                      key={panel.id} 
                      panel={panel} 
                      onSelect={() => setSelectedPanel(panel)}
                      muted 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!selectedPanel} onOpenChange={(open) => !open && setSelectedPanel(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedPanel && (
            <PanelDetailSheet 
              panel={selectedPanel}
              onStatusChange={(status) => handleStatusChange(selectedPanel.id, status)}
              onClose={() => setSelectedPanel(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function PanelCard({ 
  panel, 
  onSelect, 
  muted = false 
}: { 
  panel: Panel; 
  onSelect: () => void; 
  muted?: boolean;
}) {
  const status = statusConfig[panel.status] || statusConfig.NOT_STARTED;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/3" : "bg-white/5"
      )}
      data-testid={`panel-${panel.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-white">
            {panel.panelMark}
          </h3>
          {panel.job && (
            <p className="text-xs text-white/50 truncate">
              {panel.job.jobNumber} - {panel.job.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-xs text-white/50">
        {panel.panelType && (
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {panel.panelType}
          </span>
        )}
        {(panel.building || panel.level) && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {[panel.building && `B${panel.building}`, panel.level && `L${panel.level}`].filter(Boolean).join(" ")}
          </span>
        )}
      </div>
    </button>
  );
}

function PanelDetailSheet({ 
  panel, 
  onStatusChange,
  onClose 
}: { 
  panel: Panel;
  onStatusChange: (status: PanelStatus) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <SheetTitle className="text-left text-white">{panel.panelMark}</SheetTitle>
        {panel.job && (
          <p className="text-sm text-white/60 text-left">
            {panel.job.jobNumber} - {panel.job.name}
          </p>
        )}
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {statusOrder.map((status) => {
              const config = statusConfig[status];
              const isActive = panel.status === status;
              
              return (
                <Button
                  key={status}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onStatusChange(status)}
                  className={cn(
                    isActive ? config.bgColor : "border-white/20 text-white/70"
                  )}
                  data-testid={`status-option-${status}`}
                >
                  {config.label}
                </Button>
              );
            })}
          </div>
        </div>

        {panel.description && (
          <div>
            <label className="text-sm font-medium text-white/60 mb-1 block">Description</label>
            <p className="text-sm text-white">{panel.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {panel.panelType && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Type</label>
              <p className="text-sm text-white">{panel.panelType}</p>
            </div>
          )}
          {panel.building && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Building</label>
              <p className="text-sm text-white">{panel.building}</p>
            </div>
          )}
          {panel.level && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Level</label>
              <p className="text-sm text-white">{panel.level}</p>
            </div>
          )}
          {panel.panelThickness && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Thickness</label>
              <p className="text-sm text-white">{panel.panelThickness}mm</p>
            </div>
          )}
          {panel.panelArea && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Area</label>
              <p className="text-sm text-white">{panel.panelArea}m²</p>
            </div>
          )}
          {panel.panelMass && (
            <div>
              <label className="text-sm font-medium text-white/60 mb-1 block">Mass</label>
              <p className="text-sm text-white">{panel.panelMass}kg</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 mt-4">
        <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
```

---

### FILE: client/src/pages/mobile/logistics.tsx

```tsx
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LOGISTICS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Truck, Package, Calendar, MapPin, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface LoadList {
  id: string;
  docketNumber: string | null;
  scheduledDate: string | null;
  status: string;
  factory: string;
  job: {
    id: string;
    jobNumber: string;
    name: string;
  };
  panels: Array<{ id: string }>;
  deliveryRecord?: {
    deliveredAt: string | null;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  IN_TRANSIT: { label: "In Transit", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  DELIVERED: { label: "Delivered", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function MobileLogisticsPage() {
  const { data: loadLists = [], isLoading } = useQuery<LoadList[]>({
    queryKey: [LOGISTICS_ROUTES.LOAD_LISTS],
  });

  const activeLoads = loadLists.filter(l => l.status !== "DELIVERED" && l.status !== "CANCELLED");
  const recentDeliveries = loadLists
    .filter(l => l.status === "DELIVERED")
    .slice(0, 5);

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-logistics-title">Logistics</div>
            <div className="text-sm text-white/60">
              {activeLoads.length} active {activeLoads.length === 1 ? 'load' : 'loads'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : loadLists.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No load lists yet</p>
            <p className="text-sm text-white/40">Create loads from the desktop app</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeLoads.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Active Loads
                </h2>
                <div className="space-y-3">
                  {activeLoads.map((load) => {
                    const status = statusConfig[load.status] || statusConfig.PENDING;
                    
                    return (
                      <div
                        key={load.id}
                        className="p-4 rounded-2xl border border-white/10 bg-white/5"
                        data-testid={`load-${load.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate text-white">
                              {load.docketNumber || `Load #${load.id.slice(-6)}`}
                            </h3>
                            <p className="text-xs text-white/50 truncate">
                              {load.job.jobNumber} - {load.job.name}
                            </p>
                          </div>
                          <Badge variant="outline" className={cn("text-xs flex-shrink-0 border", status.color)}>
                            {status.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-white/50">
                          <span className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            {load.panels.length} panels
                          </span>
                          {load.scheduledDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(load.scheduledDate), "dd MMM")}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {load.factory}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recentDeliveries.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Recent Deliveries
                </h2>
                <div className="space-y-3">
                  {recentDeliveries.map((load) => (
                    <div
                      key={load.id}
                      className="p-4 rounded-2xl border border-white/10 bg-white/3"
                      data-testid={`delivery-${load.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate text-white">
                            {load.docketNumber || `Load #${load.id.slice(-6)}`}
                          </h3>
                          <p className="text-xs text-white/50">
                            {load.panels.length} panels delivered
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                          Delivered
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
```

---

### FILE: client/src/pages/mobile/purchase-orders.tsx

```tsx
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PROCUREMENT_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { ShoppingCart, Calendar, ChevronRight, ChevronLeft, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface POItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  unitOfMeasure: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  total: string | null;
  subtotal: string | null;
  taxAmount: string | null;
  createdAt: string;
  notes: string | null;
  deliveryAddress: string | null;
  requiredByDate: string | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
  requestedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items?: POItem[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  PENDING: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  APPROVED: { label: "Approved", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ORDERED: { label: "Ordered", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  RECEIVED: { label: "Received", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  REJECTED: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function MobilePurchaseOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS],
  });

  const { data: poDetails, isLoading: detailsLoading } = useQuery<PurchaseOrder>({
    queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(selectedPO?.id || "")],
    enabled: !!selectedPO?.id,
  });

  const approveMutation = useMutation({
    mutationFn: async (poId: string) => {
      return apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_APPROVE(poId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDER_BY_ID(selectedPO?.id || "")] });
      toast({ title: "Purchase order approved" });
      setSelectedPO(null);
    },
    onError: () => {
      toast({ title: "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (poId: string) => {
      return apiRequest("POST", PROCUREMENT_ROUTES.PURCHASE_ORDER_REJECT(poId), { reason: "Rejected via mobile" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.PURCHASE_ORDERS] });
      toast({ title: "Purchase order rejected" });
      setSelectedPO(null);
    },
    onError: () => {
      toast({ title: "Failed to reject", variant: "destructive" });
    },
  });

  const pendingPOs = purchaseOrders.filter(po => po.status === "PENDING");
  const activePOs = purchaseOrders.filter(po => ["DRAFT", "APPROVED", "ORDERED"].includes(po.status));
  const completedPOs = purchaseOrders.filter(po => po.status === "RECEIVED").slice(0, 5);

  const formatCurrency = (amount: string | number | null) => {
    if (amount === null) return "-";
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(numAmount);
  };

  const canApprove = user?.role === "ADMIN" || user?.role === "MANAGER";

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="text-2xl font-bold" data-testid="text-po-title">Purchase Orders</div>
            <div className="text-sm text-white/60">
              {pendingPOs.length > 0 ? `${pendingPOs.length} pending approval` : `${activePOs.length} active`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/60">No purchase orders yet</p>
            <p className="text-sm text-white/40">Create POs from the desktop app</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingPOs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Pending Approval ({pendingPOs.length})
                </h2>
                <div className="space-y-3">
                  {pendingPOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setSelectedPO(po)} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}

            {activePOs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Active Orders
                </h2>
                <div className="space-y-3">
                  {activePOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setSelectedPO(po)} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}

            {completedPOs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wide">
                  Recent Received
                </h2>
                <div className="space-y-3">
                  {completedPOs.map((po) => (
                    <POCard key={po.id} po={po} onSelect={() => setSelectedPO(po)} muted formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!selectedPO} onOpenChange={(open) => !open && setSelectedPO(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl bg-[#0D1117] border-white/10">
          {selectedPO && (
            <PODetailSheet 
              po={poDetails || selectedPO}
              isLoading={detailsLoading}
              canApprove={canApprove && selectedPO.status === "PENDING"}
              onApprove={() => approveMutation.mutate(selectedPO.id)}
              onReject={() => rejectMutation.mutate(selectedPO.id)}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
              onClose={() => setSelectedPO(null)}
              formatCurrency={formatCurrency}
            />
          )}
        </SheetContent>
      </Sheet>

      <MobileBottomNav />
    </div>
  );
}

function POCard({ po, onSelect, muted = false, formatCurrency }: { po: PurchaseOrder; onSelect: () => void; muted?: boolean; formatCurrency: (amount: string | number | null) => string }) {
  const status = statusConfig[po.status] || statusConfig.DRAFT;
  const total = po.total ? parseFloat(po.total) : null;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-2xl border border-white/10 text-left active:scale-[0.99]",
        muted ? "bg-white/3" : "bg-white/5"
      )}
      data-testid={`po-${po.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-white">{po.poNumber}</h3>
          {po.supplier && (
            <p className="text-xs text-white/50 truncate">{po.supplier.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-white/40" />
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-white/50">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(po.createdAt), "dd MMM")}
        </span>
        <span className="font-medium text-white">
          {formatCurrency(total)}
        </span>
      </div>
    </button>
  );
}

function PODetailSheet({ 
  po, 
  isLoading,
  canApprove,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  onClose,
  formatCurrency,
}: { 
  po: PurchaseOrder;
  isLoading: boolean;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  onClose: () => void;
  formatCurrency: (amount: string | number | null) => string;
}) {
  const status = statusConfig[po.status] || statusConfig.DRAFT;

  return (
    <div className="flex flex-col h-full text-white">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-left flex-1 text-white">{po.poNumber}</SheetTitle>
          <Badge variant="outline" className={cn("text-xs border", status.color)}>
            {status.label}
          </Badge>
        </div>
        {po.supplier && (
          <p className="text-sm text-white/60 text-left">{po.supplier.name}</p>
        )}
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-lg bg-white/10" />
            <Skeleton className="h-32 rounded-lg bg-white/10" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white/60 mb-1 block">Created</label>
                <p className="text-sm text-white">{format(new Date(po.createdAt), "dd MMM yyyy")}</p>
              </div>
              {po.requiredByDate && (
                <div>
                  <label className="text-sm font-medium text-white/60 mb-1 block">Required By</label>
                  <p className="text-sm text-white">{format(new Date(po.requiredByDate), "dd MMM yyyy")}</p>
                </div>
              )}
              {po.requestedBy && (
                <div>
                  <label className="text-sm font-medium text-white/60 mb-1 block">Requested By</label>
                  <p className="text-sm text-white">{po.requestedBy.name || po.requestedBy.email}</p>
                </div>
              )}
            </div>

            {po.deliveryAddress && (
              <div>
                <label className="text-sm font-medium text-white/60 mb-1 block">Delivery Address</label>
                <p className="text-sm text-white">{po.deliveryAddress}</p>
              </div>
            )}

            {po.items && po.items.length > 0 && (
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">
                  Items ({po.items.length})
                </label>
                <div className="space-y-2">
                  {po.items.map((item) => (
                    <div key={item.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-white">{item.description}</p>
                          <p className="text-xs text-white/50">
                            {item.quantity} x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <span className="text-sm font-medium flex-shrink-0 text-white">
                          {formatCurrency(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Subtotal</span>
                <span className="text-white">{formatCurrency(po.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Tax</span>
                <span className="text-white">{formatCurrency(po.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold border-t border-white/10 pt-2">
                <span className="text-white">Total</span>
                <span className="text-white">{formatCurrency(po.total)}</span>
              </div>
            </div>

            {po.notes && (
              <div>
                <label className="text-sm font-medium text-white/60 mb-1 block">Notes</label>
                <p className="text-sm text-white">{po.notes}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 mt-4 space-y-2">
        {canApprove && (
          <div className="flex gap-2">
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={onApprove}
              disabled={isApproving || isRejecting}
            >
              <Check className="h-4 w-4 mr-2" />
              {isApproving ? "Approving..." : "Approve"}
            </Button>
            <Button 
              variant="destructive"
              className="flex-1"
              onClick={onReject}
              disabled={isApproving || isRejecting}
            >
              <X className="h-4 w-4 mr-2" />
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        )}
        <Button variant="outline" className="w-full border-white/20 text-white" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
```

---

### FILE: client/src/pages/mobile/more.tsx

```tsx
import { Link } from "wouter";
import { 
  ClipboardList, 
  Truck, 
  ShoppingCart, 
  FileText, 
  User, 
  ChevronRight,
  Settings,
  LogOut
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface MenuItemProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  href: string;
}

function MenuItem({ icon, iconBg, label, href }: MenuItemProps) {
  return (
    <Link href={href}>
      <button
        className="flex h-[66px] w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 text-left active:scale-[0.99]"
        data-testid={`menu-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-white">{label}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-white/40" />
      </button>
    </Link>
  );
}

export default function MobileMore() {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="text-2xl font-bold">More</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-3">
        <MenuItem
          icon={<ClipboardList className="h-5 w-5 text-amber-400" />}
          iconBg="bg-amber-500/20"
          label="Panel Register"
          href="/mobile/panels"
        />
        <MenuItem
          icon={<Truck className="h-5 w-5 text-orange-400" />}
          iconBg="bg-orange-500/20"
          label="Logistics"
          href="/mobile/logistics"
        />
        <MenuItem
          icon={<ShoppingCart className="h-5 w-5 text-fuchsia-400" />}
          iconBg="bg-fuchsia-500/20"
          label="Purchase Orders"
          href="/mobile/purchase-orders"
        />
        <MenuItem
          icon={<FileText className="h-5 w-5 text-indigo-400" />}
          iconBg="bg-indigo-500/20"
          label="Weekly Report"
          href="/mobile/weekly-report"
        />
        
        <div className="pt-4 border-t border-white/10 mt-4">
          <MenuItem
            icon={<User className="h-5 w-5 text-slate-400" />}
            iconBg="bg-slate-500/20"
            label="Profile"
            href="/mobile/profile"
          />
        </div>
        
        <button
          onClick={() => logout()}
          className="flex h-[66px] w-full items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 text-left active:scale-[0.99] mt-4"
          data-testid="button-logout"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/20">
            <LogOut className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-red-400">Log Out</div>
          </div>
        </button>
      </div>

      <MobileBottomNav />
    </div>
  );
}
```

---

### FILE: client/src/pages/mobile/profile.tsx

```tsx
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Mail, 
  Shield, 
  LogOut, 
  Moon,
  Sun,
  ChevronLeft,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Link } from "wouter";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

export default function MobileProfilePage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const getInitials = (name: string | null | undefined, email: string | undefined): string => {
    if (name) {
      return name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || "U";
  };

  const themeOptions: Array<{ value: "light" | "dark"; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/mobile/more">
            <Button variant="ghost" size="icon" className="text-white -ml-2">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="text-2xl font-bold">Profile</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-6">
        <div className="flex flex-col items-center mb-8">
          <Avatar className="h-20 w-20 mb-3">
            <AvatarFallback className="bg-purple-500/20 text-purple-400 text-2xl">
              {getInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold text-white" data-testid="text-profile-name">
            {user?.name || "User"}
          </h1>
          <p className="text-sm text-white/60">{user?.email}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden mb-4">
          <div className="divide-y divide-white/10">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <User className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white/60">Name</p>
                <p className="font-medium text-white">{user?.name || "Not set"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white/60">Email</p>
                <p className="font-medium text-white">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white/60">Role</p>
                <p className="font-medium capitalize text-white">{user?.role?.toLowerCase() || "User"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3 text-white">Appearance</h3>
          <div className="flex gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              
              return (
                <Button
                  key={option.value}
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setTheme(option.value)}
                  className={`flex-1 flex flex-col items-center gap-1 h-auto py-3 ${
                    isActive ? "bg-purple-500" : "border-white/20 text-white"
                  }`}
                  data-testid={`theme-${option.value}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <Button 
          variant="destructive" 
          className="w-full"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <MobileBottomNav />
    </div>
  );
}
```

---

### FILE: client/src/pages/mobile/weekly-job-report.tsx

```tsx
import { useState } from "react";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { WEEKLY_REPORTS_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, addDays, getDay } from "date-fns";
import { FileText, Send, Check, X, Plus, ChevronRight, Calendar, Building2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
}

interface ScheduleItem {
  id?: string;
  jobId: string;
  priority: number;
  levels7Days: string;
  levels14Days: string;
  levels21Days: string;
  levels28Days: string;
  siteProgress: string | null;
  currentLevelOnsite: string | null;
  scheduleStatus: string;
  job?: Job;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface WeeklyJobReport {
  id: string;
  reportDate: string;
  weekStartDate: string;
  weekEndDate: string;
  status: string;
  notes: string | null;
  projectManagerId: string;
  projectManager?: User;
  schedules: ScheduleItem[];
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: User;
  rejectionReason?: string | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500/10 text-slate-500" },
  SUBMITTED: { label: "Submitted", color: "bg-blue-500/10 text-blue-500" },
  APPROVED: { label: "Approved", color: "bg-green-500/10 text-green-500" },
  REJECTED: { label: "Rejected", color: "bg-red-500/10 text-red-500" },
};

const scheduleStatusOptions = [
  { value: "ON_TRACK", label: "On Track" },
  { value: "AT_RISK", label: "At Risk" },
  { value: "DELAYED", label: "Delayed" },
  { value: "AHEAD", label: "Ahead" },
];

export default function MobileWeeklyJobReportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";
  
  const [selectedReport, setSelectedReport] = useState<WeeklyJobReport | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showViewSheet, setShowViewSheet] = useState(false);
  const [showApprovalSheet, setShowApprovalSheet] = useState(false);
  
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weekStartDate, setWeekStartDate] = useState("");
  const [weekEndDate, setWeekEndDate] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: myReports = [], isLoading: loadingMy } = useQuery<WeeklyJobReport[]>({
    queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY],
  });

  const { data: pendingReports = [], isLoading: loadingPending } = useQuery<WeeklyJobReport[]>({
    queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING],
    enabled: isManagerOrAdmin,
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const activeJobs = allJobs.filter(j => j.status === "ACTIVE");

  const calculateWeekBoundaries = (dateStr: string) => {
    if (!dateStr) return { weekStart: "", weekEnd: "" };
    const date = parseISO(dateStr);
    const currentDay = getDay(date);
    const weekStartDay = 1;
    const daysToSubtract = (currentDay - weekStartDay + 7) % 7;
    const weekStart = addDays(date, -daysToSubtract);
    const weekEnd = addDays(weekStart, 6);
    return {
      weekStart: format(weekStart, "yyyy-MM-dd"),
      weekEnd: format(weekEnd, "yyyy-MM-dd"),
    };
  };

  const createMutation = useMutation({
    mutationFn: async (data: { reportDate: string; weekStartDate: string; weekEndDate: string; notes: string; schedules: ScheduleItem[] }) => {
      const response = await apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORTS, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      toast({ title: "Report created" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create report", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_SUBMIT(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      toast({ title: "Report submitted for approval" });
      setShowViewSheet(false);
      setSelectedReport(null);
    },
    onError: () => {
      toast({ title: "Failed to submit", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_APPROVE(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      toast({ title: "Report approved" });
      setShowApprovalSheet(false);
      setSelectedReport(null);
    },
    onError: () => {
      toast({ title: "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", WEEKLY_REPORTS_ROUTES.JOB_REPORT_REJECT(id), { rejectionReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_MY] });
      queryClient.invalidateQueries({ queryKey: [WEEKLY_REPORTS_ROUTES.JOB_REPORTS_PENDING] });
      toast({ title: "Report rejected" });
      setShowApprovalSheet(false);
      setSelectedReport(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({ title: "Failed to reject", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowCreateSheet(false);
    setReportDate(format(new Date(), "yyyy-MM-dd"));
    setWeekStartDate("");
    setWeekEndDate("");
    setGeneralNotes("");
    setSchedules([]);
  };

  const openCreateSheet = () => {
    const { weekStart, weekEnd } = calculateWeekBoundaries(reportDate);
    setWeekStartDate(weekStart);
    setWeekEndDate(weekEnd);
    setShowCreateSheet(true);
  };

  const addSchedule = () => {
    setSchedules([...schedules, {
      jobId: "",
      priority: schedules.length + 1,
      levels7Days: "",
      levels14Days: "",
      levels21Days: "",
      levels28Days: "",
      siteProgress: null,
      currentLevelOnsite: null,
      scheduleStatus: "ON_TRACK",
    }]);
  };

  const updateSchedule = (index: number, field: keyof ScheduleItem, value: string | number | null) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  };

  const removeSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    if (!weekStartDate || !weekEndDate) {
      toast({ title: "Please set week dates", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      reportDate,
      weekStartDate,
      weekEndDate,
      notes: generalNotes,
      schedules: schedules.filter(s => s.jobId),
    });
  };

  const formatDateShort = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM");
    } catch {
      return dateStr;
    }
  };

  const formatDateFull = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  const draftReports = myReports.filter(r => r.status === "DRAFT");
  const submittedReports = myReports.filter(r => r.status === "SUBMITTED");
  const completedReports = myReports.filter(r => ["APPROVED", "REJECTED"].includes(r.status)).slice(0, 5);

  return (
    <MobileLayout title="Weekly Report">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-report-title">Weekly Job Reports</h1>
            <p className="text-sm text-muted-foreground">
              {isManagerOrAdmin && pendingReports.length > 0 
                ? `${pendingReports.length} pending approval`
                : `${myReports.length} report${myReports.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          <Button size="sm" onClick={openCreateSheet} data-testid="button-new-report">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {loadingMy || loadingPending ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {isManagerOrAdmin && pendingReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Pending Approval ({pendingReports.length})
                </h2>
                <div className="space-y-3">
                  {pendingReports.map(report => (
                    <ReportCard 
                      key={report.id} 
                      report={report} 
                      onSelect={() => {
                        setSelectedReport(report);
                        setShowApprovalSheet(true);
                      }}
                      showPM
                    />
                  ))}
                </div>
              </div>
            )}

            {draftReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Drafts ({draftReports.length})
                </h2>
                <div className="space-y-3">
                  {draftReports.map(report => (
                    <ReportCard 
                      key={report.id} 
                      report={report} 
                      onSelect={() => {
                        setSelectedReport(report);
                        setShowViewSheet(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {submittedReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Submitted ({submittedReports.length})
                </h2>
                <div className="space-y-3">
                  {submittedReports.map(report => (
                    <ReportCard 
                      key={report.id} 
                      report={report} 
                      onSelect={() => {
                        setSelectedReport(report);
                        setShowViewSheet(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedReports.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Recent History
                </h2>
                <div className="space-y-3">
                  {completedReports.map(report => (
                    <ReportCard 
                      key={report.id} 
                      report={report} 
                      onSelect={() => {
                        setSelectedReport(report);
                        setShowViewSheet(true);
                      }}
                      muted
                    />
                  ))}
                </div>
              </div>
            )}

            {myReports.length === 0 && pendingReports.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No reports yet</p>
                <p className="text-sm text-muted-foreground/70">Create your first weekly report</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-hidden">
          <SheetHeader className="pb-4">
            <SheetTitle>New Weekly Report</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto space-y-4 pb-20">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Report Date</Label>
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => {
                    setReportDate(e.target.value);
                    const { weekStart, weekEnd } = calculateWeekBoundaries(e.target.value);
                    setWeekStartDate(weekStart);
                    setWeekEndDate(weekEnd);
                  }}
                  data-testid="input-report-date"
                />
              </div>
              <div>
                <Label className="text-sm">Week Start</Label>
                <Input
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => {
                    const { weekStart, weekEnd } = calculateWeekBoundaries(e.target.value);
                    setWeekStartDate(weekStart);
                    setWeekEndDate(weekEnd);
                  }}
                  data-testid="input-week-start"
                />
              </div>
            </div>

            {weekStartDate && weekEndDate && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Week: {formatDateFull(weekStartDate)} - {formatDateFull(weekEndDate)}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Job Schedules</Label>
                <Button size="sm" variant="outline" onClick={addSchedule} data-testid="button-add-job">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Job
                </Button>
              </div>
              
              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add jobs to include in this report
                </p>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule, index) => (
                    <div key={index} className="p-3 bg-card border rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={schedule.jobId}
                          onValueChange={(value) => updateSchedule(index, "jobId", value)}
                        >
                          <SelectTrigger className="flex-1" data-testid={`select-job-${index}`}>
                            <SelectValue placeholder="Select job" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeJobs.map(job => (
                              <SelectItem key={job.id} value={job.id}>
                                {job.jobNumber} - {job.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => removeSchedule(index)}
                          data-testid={`button-remove-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">7 Day Levels</Label>
                          <Input
                            placeholder="e.g. L1, L2"
                            value={schedule.levels7Days}
                            onChange={(e) => updateSchedule(index, "levels7Days", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">14 Day Levels</Label>
                          <Input
                            placeholder="e.g. L3, L4"
                            value={schedule.levels14Days}
                            onChange={(e) => updateSchedule(index, "levels14Days", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">21 Day Levels</Label>
                          <Input
                            placeholder="e.g. L5"
                            value={schedule.levels21Days}
                            onChange={(e) => updateSchedule(index, "levels21Days", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">28 Day Levels</Label>
                          <Input
                            placeholder="e.g. L6"
                            value={schedule.levels28Days}
                            onChange={(e) => updateSchedule(index, "levels28Days", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Current Level Onsite</Label>
                          <Input
                            placeholder="e.g. L2"
                            value={schedule.currentLevelOnsite || ""}
                            onChange={(e) => updateSchedule(index, "currentLevelOnsite", e.target.value || null)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Status</Label>
                          <Select
                            value={schedule.scheduleStatus}
                            onValueChange={(value) => updateSchedule(index, "scheduleStatus", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {scheduleStatusOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Site Progress</Label>
                        <Textarea
                          placeholder="Notes on site progress..."
                          value={schedule.siteProgress || ""}
                          onChange={(e) => updateSchedule(index, "siteProgress", e.target.value || null)}
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm">General Notes</Label>
              <Textarea
                placeholder="Overall notes for this week..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="min-h-[80px]"
                data-testid="input-notes"
              />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetForm}>
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Draft"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showViewSheet} onOpenChange={(open) => !open && setShowViewSheet(false)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
          {selectedReport && (
            <ReportViewSheet
              report={selectedReport}
              onClose={() => {
                setShowViewSheet(false);
                setSelectedReport(null);
              }}
              onSubmit={() => submitMutation.mutate(selectedReport.id)}
              isSubmitting={submitMutation.isPending}
              canSubmit={selectedReport.status === "DRAFT" && selectedReport.projectManagerId === user?.id}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showApprovalSheet} onOpenChange={(open) => !open && setShowApprovalSheet(false)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
          {selectedReport && (
            <ReportApprovalSheet
              report={selectedReport}
              onClose={() => {
                setShowApprovalSheet(false);
                setSelectedReport(null);
                setRejectionReason("");
              }}
              onApprove={() => approveMutation.mutate(selectedReport.id)}
              onReject={() => rejectMutation.mutate({ id: selectedReport.id, reason: rejectionReason })}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
              rejectionReason={rejectionReason}
              setRejectionReason={setRejectionReason}
            />
          )}
        </SheetContent>
      </Sheet>
    </MobileLayout>
  );
}

function ReportCard({ 
  report, 
  onSelect, 
  muted = false,
  showPM = false 
}: { 
  report: WeeklyJobReport; 
  onSelect: () => void; 
  muted?: boolean;
  showPM?: boolean;
}) {
  const status = statusConfig[report.status] || statusConfig.DRAFT;

  const formatDateShort = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM");
    } catch {
      return dateStr;
    }
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-xl border border-border hover-elevate active-elevate-2 text-left",
        muted ? "bg-card/50" : "bg-card"
      )}
      data-testid={`report-${report.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">
            Week of {formatDateShort(report.weekStartDate)}
          </h3>
          {showPM && report.projectManager && (
            <p className="text-xs text-muted-foreground truncate">
              {report.projectManager.name || report.projectManager.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="secondary" className={cn("text-xs", status.color)}>
            {status.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" />
          {report.schedules?.length || 0} job{(report.schedules?.length || 0) !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateShort(report.reportDate)}
        </span>
      </div>
    </button>
  );
}

function ReportViewSheet({
  report,
  onClose,
  onSubmit,
  isSubmitting,
  canSubmit,
}: {
  report: WeeklyJobReport;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
}) {
  const status = statusConfig[report.status] || statusConfig.DRAFT;

  const formatDateFull = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-left flex-1">Week of {formatDateFull(report.weekStartDate)}</SheetTitle>
          <Badge variant="secondary" className={cn("text-xs", status.color)}>
            {status.label}
          </Badge>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm">
            <Calendar className="h-4 w-4 inline mr-2" />
            {formatDateFull(report.weekStartDate)} - {formatDateFull(report.weekEndDate)}
          </p>
        </div>

        {report.schedules && report.schedules.length > 0 && (
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Jobs ({report.schedules.length})
            </Label>
            <div className="space-y-2">
              {report.schedules.map((schedule) => (
                <div key={schedule.id} className="p-3 bg-card border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">
                      {schedule.job?.jobNumber} - {schedule.job?.name || "Unknown Job"}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {schedule.scheduleStatus?.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {schedule.levels7Days && (
                      <p>7 Day: {schedule.levels7Days}</p>
                    )}
                    {schedule.levels14Days && (
                      <p>14 Day: {schedule.levels14Days}</p>
                    )}
                    {schedule.levels21Days && (
                      <p>21 Day: {schedule.levels21Days}</p>
                    )}
                    {schedule.levels28Days && (
                      <p>28 Day: {schedule.levels28Days}</p>
                    )}
                  </div>
                  {schedule.currentLevelOnsite && (
                    <p className="text-xs mt-2">
                      Currently onsite: {schedule.currentLevelOnsite}
                    </p>
                  )}
                  {schedule.siteProgress && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {schedule.siteProgress}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.notes && (
          <div>
            <Label className="text-sm font-medium mb-1 block">Notes</Label>
            <p className="text-sm">{report.notes}</p>
          </div>
        )}

        {report.rejectionReason && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900">
            <Label className="text-sm font-medium text-red-600 dark:text-red-400 mb-1 block">Rejection Reason</Label>
            <p className="text-sm text-red-700 dark:text-red-300">{report.rejectionReason}</p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t mt-4 space-y-2">
        {canSubmit && (
          <Button 
            className="w-full"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        )}
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function ReportApprovalSheet({
  report,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  rejectionReason,
  setRejectionReason,
}: {
  report: WeeklyJobReport;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  rejectionReason: string;
  setRejectionReason: (v: string) => void;
}) {
  const formatDateFull = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="pb-4">
        <SheetTitle className="text-left">Review Report</SheetTitle>
        <p className="text-sm text-muted-foreground text-left">
          Submitted by {report.projectManager?.name || report.projectManager?.email}
        </p>
      </SheetHeader>

      <div className="flex-1 overflow-auto space-y-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm">
            <Calendar className="h-4 w-4 inline mr-2" />
            {formatDateFull(report.weekStartDate)} - {formatDateFull(report.weekEndDate)}
          </p>
        </div>

        {report.schedules && report.schedules.length > 0 && (
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Jobs ({report.schedules.length})
            </Label>
            <div className="space-y-2">
              {report.schedules.map((schedule) => (
                <div key={schedule.id} className="p-3 bg-card border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">
                      {schedule.job?.jobNumber} - {schedule.job?.name || "Unknown Job"}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {schedule.scheduleStatus?.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {schedule.levels7Days && <p>7 Day: {schedule.levels7Days}</p>}
                    {schedule.levels14Days && <p>14 Day: {schedule.levels14Days}</p>}
                    {schedule.levels21Days && <p>21 Day: {schedule.levels21Days}</p>}
                    {schedule.levels28Days && <p>28 Day: {schedule.levels28Days}</p>}
                  </div>
                  {schedule.siteProgress && (
                    <p className="text-xs text-muted-foreground mt-2">{schedule.siteProgress}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.notes && (
          <div>
            <Label className="text-sm font-medium mb-1 block">Notes</Label>
            <p className="text-sm">{report.notes}</p>
          </div>
        )}

        <div>
          <Label className="text-sm font-medium mb-1 block">Rejection Reason (if rejecting)</Label>
          <Textarea
            placeholder="Enter reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[60px]"
          />
        </div>
      </div>

      <div className="pt-4 border-t mt-4 space-y-2">
        <div className="flex gap-2">
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={onApprove}
            disabled={isApproving || isRejecting}
          >
            <Check className="h-4 w-4 mr-2" />
            {isApproving ? "Approving..." : "Approve"}
          </Button>
          <Button 
            variant="destructive"
            className="flex-1"
            onClick={onReject}
            disabled={isApproving || isRejecting || !rejectionReason.trim()}
          >
            <X className="h-4 w-4 mr-2" />
            {isRejecting ? "Rejecting..." : "Reject"}
          </Button>
        </div>
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
```
