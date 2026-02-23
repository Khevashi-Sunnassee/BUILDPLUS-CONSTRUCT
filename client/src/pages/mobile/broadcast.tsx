import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BROADCAST_ROUTES } from "@shared/api-routes";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import type { BroadcastTemplate, BroadcastMessageWithDetails } from "@shared/schema";
import { Send, FileText, History, Mail, Phone, MessageCircle, Users, Plus, X, Loader2, Search, Check, UserCheck, ChevronLeft } from "lucide-react";

type ActiveTab = "send" | "templates" | "history";
type ChannelStatus = { sms: boolean; whatsapp: boolean; email: boolean };
type CustomContact = { name: string; phone: string; email: string };

function getStatusColor(status: string): { text: string; bg: string } {
  switch (status) {
    case "PENDING": return { text: "text-yellow-400", bg: "bg-yellow-500/20" };
    case "SENDING": return { text: "text-blue-400", bg: "bg-blue-500/20" };
    case "COMPLETED": return { text: "text-green-400", bg: "bg-green-500/20" };
    case "FAILED": return { text: "text-red-400", bg: "bg-red-500/20" };
    default: return { text: "text-white/60", bg: "bg-white/10" };
  }
}

function getChannelColor(channel: string): { text: string; bg: string } {
  switch (channel) {
    case "SMS": return { text: "text-emerald-400", bg: "bg-emerald-500/20" };
    case "WHATSAPP": return { text: "text-green-400", bg: "bg-green-500/20" };
    case "EMAIL": return { text: "text-blue-400", bg: "bg-blue-500/20" };
    default: return { text: "text-white/60", bg: "bg-white/10" };
  }
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case "SMS": return <Phone className="h-3 w-3" />;
    case "WHATSAPP": return <MessageCircle className="h-3 w-3" />;
    case "EMAIL": return <Mail className="h-3 w-3" />;
    default: return null;
  }
}

function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return mins <= 1 ? "Just now" : `${mins}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  if (diffHours < 48) {
    return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString([], { day: "numeric", month: "short" }) +
    ` ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MobileBroadcastPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("send");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [recipientType, setRecipientType] = useState<string>("ALL_USERS");
  const [customContacts, setCustomContacts] = useState<CustomContact[]>([
    { name: "", phone: "", email: "" },
  ]);
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const { data: channelStatus } = useQuery<ChannelStatus>({
    queryKey: [BROADCAST_ROUTES.CHANNELS_STATUS],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<BroadcastTemplate[]>({
    queryKey: [BROADCAST_ROUTES.TEMPLATES],
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  const { data: broadcasts = [], isLoading: historyLoading } = useQuery<BroadcastMessageWithDetails[]>({
    queryKey: [BROADCAST_ROUTES.MESSAGES],
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
  });

  interface BroadcastRecipient {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: string;
  }

  const { data: recipientData } = useQuery<{ employees: BroadcastRecipient[] }>({
    queryKey: [BROADCAST_ROUTES.RECIPIENTS],
  });

  const users = useMemo(() => {
    if (!recipientData?.employees) return [];
    return recipientData.employees;
  }, [recipientData]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [users, userSearch]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const activeTemplates = templates.filter((t) => t.isActive);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        subject,
        message,
        channels: selectedChannels,
        recipientType,
      };
      if (selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      }
      if (recipientType === "CUSTOM_CONTACTS") {
        payload.customRecipients = customContacts.filter(
          (c) => c.name || c.phone || c.email
        );
      }
      if (recipientType === "SPECIFIC_USERS") {
        payload.recipientIds = selectedUserIds;
      }
      return apiRequest("POST", BROADCAST_ROUTES.SEND, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BROADCAST_ROUTES.MESSAGES] });
      setSubject("");
      setMessage("");
      setSelectedTemplateId("");
      setSelectedChannels([]);
      setRecipientType("ALL_USERS");
      setCustomContacts([{ name: "", phone: "", email: "" }]);
      setSelectedUserIds([]);
      setActiveTab("history");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send broadcast",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const addCustomContact = () => {
    setCustomContacts((prev) => [...prev, { name: "", phone: "", email: "" }]);
  };

  const removeCustomContact = (index: number) => {
    setCustomContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCustomContact = (
    index: number,
    field: keyof CustomContact,
    value: string
  ) => {
    setCustomContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const applyTemplate = (template: BroadcastTemplate) => {
    setSelectedTemplateId(template.id);
    setSubject(template.subject || "");
    setMessage(template.message || "");
    if (template.defaultChannels && template.defaultChannels.length > 0) {
      setSelectedChannels(template.defaultChannels);
    }
    setActiveTab("send");
    setShowTemplateSheet(false);
  };

  const canSend =
    message.trim() &&
    selectedChannels.length > 0 &&
    (recipientType === "ALL_USERS" ||
      (recipientType === "SPECIFIC_USERS" && selectedUserIds.length > 0) ||
      (recipientType === "CUSTOM_CONTACTS" &&
        customContacts.some((c) => c.name || c.phone || c.email)));

  const tabs: { key: ActiveTab; label: string; icon: typeof Send }[] = [
    { key: "send", label: "Send", icon: Send },
    { key: "templates", label: "Templates", icon: FileText },
    { key: "history", label: "History", icon: History },
  ];

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Broadcast">
      <div
        className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-4">
          <div className="text-2xl font-bold" data-testid="text-page-title">Broadcast</div>
          <div className="flex gap-2 mt-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors active:scale-[0.99] ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                  data-testid={`tab-${tab.key}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
        {activeTab === "send" && (
          <div className="space-y-4">
            <button
              onClick={() => setShowTemplateSheet(true)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-left active:scale-[0.99]"
              data-testid="button-select-template"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/40 mb-0.5">Template</div>
                  <div className="text-sm text-white/60">
                    {selectedTemplateId
                      ? activeTemplates.find((t) => t.id === selectedTemplateId)?.name || "Selected"
                      : "None selected (optional)"}
                  </div>
                </div>
                <FileText className="h-5 w-5 text-white/40" />
              </div>
            </button>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <label className="text-xs text-white/40 mb-1 block" htmlFor="mobile-subject">Subject</label>
              <input
                id="mobile-subject"
                data-testid="input-broadcast-subject"
                type="text"
                placeholder="Message subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-transparent text-white text-sm placeholder:text-white/30 outline-none"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <label className="text-xs text-white/40 mb-1 block" htmlFor="mobile-message">Message</label>
              <textarea
                id="mobile-message"
                data-testid="input-broadcast-message"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full bg-transparent text-white text-sm placeholder:text-white/30 outline-none resize-none"
              />
            </div>

            <div>
              <div className="text-xs text-white/40 mb-2">Channels</div>
              <div className="flex flex-wrap gap-2">
                {(["SMS", "EMAIL"] as const).map((channel) => {
                  const selected = selectedChannels.includes(channel);
                  const available = channelStatus
                    ? channelStatus[channel.toLowerCase() as keyof ChannelStatus]
                    : false;
                  const color = getChannelColor(channel);
                  return (
                    <button
                      key={channel}
                      onClick={() => available && toggleChannel(channel)}
                      disabled={!available}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors active:scale-[0.99] ${
                        !available
                          ? "bg-white/5 text-white/20 opacity-50"
                          : selected
                          ? `${color.bg} ${color.text}`
                          : "bg-white/10 text-white/60"
                      }`}
                      data-testid={`toggle-channel-${channel.toLowerCase()}`}
                    >
                      {getChannelIcon(channel)}
                      {channel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs text-white/40 mb-2">Recipients</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRecipientType("ALL_USERS")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium active:scale-[0.99] ${
                    recipientType === "ALL_USERS"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-white/10 text-white/60"
                  }`}
                  data-testid="button-recipient-all"
                >
                  <Users className="h-4 w-4" />
                  All Users
                </button>
                <button
                  onClick={() => setRecipientType("SPECIFIC_USERS")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium active:scale-[0.99] ${
                    recipientType === "SPECIFIC_USERS"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-white/10 text-white/60"
                  }`}
                  data-testid="button-recipient-specific"
                >
                  <UserCheck className="h-4 w-4" />
                  Select Users
                </button>
                <button
                  onClick={() => setRecipientType("CUSTOM_CONTACTS")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium active:scale-[0.99] ${
                    recipientType === "CUSTOM_CONTACTS"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-white/10 text-white/60"
                  }`}
                  data-testid="button-recipient-custom"
                >
                  Custom Contacts
                </button>
              </div>
            </div>

            {recipientType === "SPECIFIC_USERS" && (
              <div className="space-y-2">
                <button
                  onClick={() => { setShowUserPicker(true); setUserSearch(""); }}
                  className="w-full rounded-2xl border border-dashed border-white/20 px-4 py-3 text-left active:scale-[0.99]"
                  data-testid="button-open-user-picker"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-white/60">
                      {selectedUserIds.length > 0
                        ? `${selectedUserIds.length} user${selectedUserIds.length !== 1 ? "s" : ""} selected`
                        : "Tap to select users"}
                    </div>
                    <Users className="h-4 w-4 text-white/40" />
                  </div>
                </button>

                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUserIds.map((uid) => {
                      const u = users.find((usr) => usr.id === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400"
                          data-testid={`badge-selected-user-${uid}`}
                        >
                          {u?.name || u?.email || uid}
                          <button
                            onClick={() => toggleUserSelection(uid)}
                            className="ml-0.5 active:scale-[0.9]"
                            data-testid={`button-remove-user-${uid}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {recipientType === "CUSTOM_CONTACTS" && (
              <div className="space-y-3">
                {customContacts.map((contact, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 space-y-2"
                    data-testid={`card-contact-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">Contact {index + 1}</span>
                      {customContacts.length > 1 && (
                        <button
                          onClick={() => removeCustomContact(index)}
                          className="text-white/40 active:scale-[0.99]"
                          data-testid={`button-remove-contact-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <input
                      data-testid={`input-contact-name-${index}`}
                      type="text"
                      placeholder="Name"
                      value={contact.name}
                      onChange={(e) => updateCustomContact(index, "name", e.target.value)}
                      className="w-full bg-transparent text-white text-sm placeholder:text-white/30 outline-none border-b border-white/10 pb-2"
                    />
                    <input
                      data-testid={`input-contact-phone-${index}`}
                      type="tel"
                      placeholder="Phone"
                      value={contact.phone}
                      onChange={(e) => updateCustomContact(index, "phone", e.target.value)}
                      className="w-full bg-transparent text-white text-sm placeholder:text-white/30 outline-none border-b border-white/10 pb-2"
                    />
                    <input
                      data-testid={`input-contact-email-${index}`}
                      type="email"
                      placeholder="Email"
                      value={contact.email}
                      onChange={(e) => updateCustomContact(index, "email", e.target.value)}
                      className="w-full bg-transparent text-white text-sm placeholder:text-white/30 outline-none"
                    />
                  </div>
                ))}
                <button
                  onClick={addCustomContact}
                  className="flex items-center gap-2 w-full justify-center py-3 rounded-2xl border border-dashed border-white/20 text-white/60 text-sm font-medium active:scale-[0.99]"
                  data-testid="button-add-contact"
                >
                  <Plus className="h-4 w-4" />
                  Add Contact
                </button>
              </div>
            )}

            <button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend || sendMutation.isPending}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-base font-semibold active:scale-[0.99] transition-colors ${
                canSend && !sendMutation.isPending
                  ? "bg-blue-500 text-white"
                  : "bg-white/10 text-white/30"
              }`}
              data-testid="button-send-broadcast"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              {sendMutation.isPending ? "Sending..." : "Send Broadcast"}
            </button>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="space-y-3">
            {templatesLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-white/40" />
              </div>
            )}
            {!templatesLoading && activeTemplates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-white/20 mb-3" />
                <p className="text-white/40 text-sm" data-testid="text-no-templates">No templates available</p>
              </div>
            )}
            {activeTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left active:scale-[0.99]"
                data-testid={`card-template-${template.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-white truncate" data-testid={`text-template-name-${template.id}`}>
                      {template.name}
                    </div>
                    {template.category && (
                      <div className="text-xs text-white/40 mt-0.5">{template.category}</div>
                    )}
                    {template.subject && (
                      <div className="text-sm text-white/60 mt-1 truncate">{template.subject}</div>
                    )}
                    <div className="text-sm text-white/40 mt-1 line-clamp-2">{template.message}</div>
                    {template.defaultChannels && template.defaultChannels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {template.defaultChannels.map((ch) => {
                          const color = getChannelColor(ch);
                          return (
                            <span
                              key={ch}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}
                              data-testid={`badge-template-channel-${template.id}-${ch.toLowerCase()}`}
                            >
                              {getChannelIcon(ch)}
                              {ch}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <Send className="h-4 w-4 text-blue-400 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {historyLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-white/40" />
              </div>
            )}
            {!historyLoading && broadcasts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <History className="h-12 w-12 text-white/20 mb-3" />
                <p className="text-white/40 text-sm" data-testid="text-no-history">No broadcasts sent yet</p>
              </div>
            )}
            {broadcasts.map((broadcast) => {
              const statusStyle = getStatusColor(broadcast.status);
              return (
                <div
                  key={broadcast.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  data-testid={`card-broadcast-${broadcast.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/40" data-testid={`text-broadcast-date-${broadcast.id}`}>
                        {formatDate(broadcast.createdAt)}
                      </div>
                      <div className="text-base font-semibold text-white mt-0.5 truncate" data-testid={`text-broadcast-subject-${broadcast.id}`}>
                        {broadcast.subject || "(No subject)"}
                      </div>
                      <div className="text-sm text-white/40 mt-0.5 line-clamp-2" data-testid={`text-broadcast-message-${broadcast.id}`}>
                        {broadcast.message}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}
                      data-testid={`badge-status-${broadcast.id}`}
                    >
                      {broadcast.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                    <div className="flex flex-wrap gap-1.5">
                      {broadcast.channels.map((ch) => {
                        const color = getChannelColor(ch);
                        return (
                          <span
                            key={ch}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}
                            data-testid={`badge-channel-${broadcast.id}-${ch.toLowerCase()}`}
                          >
                            {getChannelIcon(ch)}
                            {ch}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      <span className="text-green-400" data-testid={`text-sent-count-${broadcast.id}`}>
                        {broadcast.sentCount} sent
                      </span>
                      {broadcast.failedCount > 0 && (
                        <span className="text-red-400" data-testid={`text-failed-count-${broadcast.id}`}>
                          {broadcast.failedCount} failed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showTemplateSheet && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowTemplateSheet(false)}
            data-testid="overlay-template-sheet"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-[#0D1117] rounded-t-3xl max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <span className="text-base font-semibold text-white">Select Template</span>
              <button
                onClick={() => setShowTemplateSheet(false)}
                className="text-white/60 active:scale-[0.99]"
                data-testid="button-close-template-sheet"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>
              <button
                onClick={() => {
                  setSelectedTemplateId("");
                  setShowTemplateSheet(false);
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/60 active:scale-[0.99]"
                data-testid="button-template-none"
              >
                No template
              </button>
              {activeTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left active:scale-[0.99]"
                  data-testid={`button-template-select-${template.id}`}
                >
                  <div className="text-sm font-semibold text-white">{template.name}</div>
                  {template.subject && (
                    <div className="text-xs text-white/40 mt-0.5 truncate">{template.subject}</div>
                  )}
                  {template.defaultChannels && template.defaultChannels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {template.defaultChannels.map((ch) => {
                        const color = getChannelColor(ch);
                        return (
                          <span
                            key={ch}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${color.bg} ${color.text}`}
                          >
                            {getChannelIcon(ch)}
                            {ch}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showUserPicker && (
        <div className="fixed inset-0 z-50 bg-[#070B12] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="flex-shrink-0 border-b border-white/10 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setShowUserPicker(false)}
              className="text-white -ml-1 active:scale-[0.95]"
              data-testid="button-close-user-picker"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex-1">
              <div className="text-lg font-bold text-white">Select Users</div>
              <div className="text-xs text-white/50">
                {selectedUserIds.length > 0
                  ? `${selectedUserIds.length} selected`
                  : `${users.length} users available`}
              </div>
            </div>
            <button
              onClick={() => setShowUserPicker(false)}
              className="px-3 py-1.5 rounded-full bg-blue-500 text-white text-sm font-medium active:scale-[0.97]"
              data-testid="button-done-user-picker"
            >
              Done
            </button>
          </div>

          <div className="flex-shrink-0 px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-blue-500/50"
                autoFocus
                data-testid="input-user-search"
              />
            </div>
          </div>

          {selectedUserIds.length > 0 && (
            <div className="flex-shrink-0 px-4 pb-2">
              <button
                onClick={() => setSelectedUserIds([])}
                className="text-xs text-red-400 active:scale-[0.97]"
                data-testid="button-clear-all-users"
              >
                Clear all ({selectedUserIds.length})
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 pb-8">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-white/20 mb-2" />
                <p className="text-sm text-white/40">
                  {userSearch ? "No users match your search" : "No users available"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUserSelection(user.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.99] transition-colors ${
                        isSelected ? "bg-blue-500/15 border border-blue-500/30" : "border border-transparent"
                      }`}
                      data-testid={`button-user-${user.id}`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                        isSelected ? "bg-blue-500 text-white" : "bg-white/10 text-white/50"
                      }`}>
                        {isSelected ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-medium">
                            {(user.name || user.email || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {user.name || user.email || "Unknown"}
                        </div>
                        {user.email && (
                          <div className="text-xs text-white/40 truncate">{user.email}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
