import { useState, useRef, useEffect, Fragment, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  Hash,
  ArrowLeft,
  Filter,
  CheckCircle,
  Clock as ClockIcon,
  AlertCircle,
  Pause,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Hammer,
  FileText,
  CheckCircle2,
  XCircle,
  Sparkles,
  Search,
  BarChart3,
  QrCode,
  ExternalLink,
  Printer,
  History,
  Combine,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getCsrfToken } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, FileIcon, Send, UserPlus, Image, X, FileText as FileTextIcon, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { Job, PanelRegister, PanelTypeConfig, Factory } from "@shared/schema";
import { PANEL_LIFECYCLE_LABELS, PANEL_LIFECYCLE_COLORS } from "@shared/schema";
import { ADMIN_ROUTES, CHAT_ROUTES, PANEL_TYPES_ROUTES, FACTORIES_ROUTES, USER_ROUTES, SETTINGS_ROUTES, DOCUMENT_ROUTES, PANELS_ROUTES } from "@shared/api-routes";
import { isJobVisibleInDropdowns } from "@shared/job-phases";
import defaultLogo from "@/assets/lte-logo.png";

const panelSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  panelMark: z.string().min(1, "Panel mark is required"),
  panelType: z.string().min(1, "Panel type is required"),
  description: z.string().optional(),
  drawingCode: z.string().optional(),
  sheetNumber: z.string().optional(),
  building: z.string().optional(),
  level: z.string().optional(),
  structuralElevation: z.string().optional(),
  reckliDetail: z.string().optional(),
  estimatedHours: z.number().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "PENDING"]),
  loadWidth: z.string().optional(),
  loadHeight: z.string().optional(),
  panelThickness: z.string().optional(),
  panelVolume: z.string().optional(),
  panelMass: z.string().optional(),
  qty: z.number().optional(),
  concreteStrengthMpa: z.string().optional(),
  workTypeId: z.number().optional(),
});

type PanelFormData = z.infer<typeof panelSchema>;

const formatNumber = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return num.toLocaleString("en-AU");
};

interface PanelWithJob extends PanelRegister {
  job: Job;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: User | null;
}

interface PanelConversation {
  id: string;
  name: string | null;
  type: string;
  panelId: string | null;
  jobId: string | null;
  members: ConversationMember[];
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: User | null;
  attachments: Array<{ id: string; fileName: string; url: string; mimeType: string }>;
  mentions: Array<{ id: string; mentionedUserId: string; user: User | null }>;
}

const COMMON_EMOJIS = [
  "😀", "😂", "😊", "🙂", "😍", "🤔", "😮", "😢", "😡", "👍",
  "👎", "👏", "🙌", "💪", "🎉", "🔥", "⭐", "❤️", "💯", "✅",
  "❌", "⚠️", "📌", "📎", "🔧", "🔨", "📐", "📏", "🏗️", "🧱",
];

function PanelChatTab({ panelId, panelMark }: { panelId: string; panelMark: string }) {
  const { toast } = useToast();
  const [messageContent, setMessageContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = (emoji: string) => {
    setMessageContent((prev) => prev + emoji);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const { data: conversation, isLoading: conversationLoading } = useQuery<PanelConversation>({
    queryKey: [CHAT_ROUTES.PANEL_CONVERSATION(panelId), panelId, "conversation"],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: [CHAT_ROUTES.MESSAGES(conversation?.id || ""), conversation?.id, "messages"],
    enabled: !!conversation?.id,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [USER_ROUTES.LIST],
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, files }: { content: string; files: File[] }) => {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("mentionedUserIds", JSON.stringify([]));
      files.forEach((file) => formData.append("files", file));
      
      const csrfToken = getCsrfToken();
      const res = await fetch(CHAT_ROUTES.MESSAGES(conversation?.id || ""), {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.MESSAGES(conversation?.id || ""), conversation?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.PANELS_COUNTS] });
      setMessageContent("");
      setPendingFiles([]);
    },
    onError: (error: any) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const newFile = new File([file], `screenshot-${timestamp}.png`, { type: file.type });
          imageFiles.push(newFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      setPendingFiles((prev) => [...prev, ...imageFiles]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", CHAT_ROUTES.MEMBERS(conversation?.id || ""), { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHAT_ROUTES.PANEL_CONVERSATION(panelId), panelId, "conversation"] });
      setShowAddMembersDialog(false);
      setSelectedMemberIds([]);
      toast({ title: "Members added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add members", description: error.message, variant: "destructive" });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageContent.trim() && pendingFiles.length === 0) || !conversation?.id) return;
    sendMessageMutation.mutate({ content: messageContent, files: pendingFiles });
  };

  const existingMemberIds = conversation?.members?.map(m => m.userId) || [];
  const availableUsersToAdd = allUsers.filter(u => !existingMemberIds.includes(u.id));

  if (conversationLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] border rounded-md">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium text-sm">Panel: {panelMark}</span>
          <Badge variant="secondary" className="text-xs">
            {conversation?.members?.length || 0} members
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddMembersDialog(true)}
          data-testid="button-add-chat-members"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Add Members
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation about this panel</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {msg.sender?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{msg.sender?.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm mt-1">{msg.body}</p>
                  {msg.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.attachments.map((att) => (
                        att.mimeType?.startsWith("image/") ? (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={att.url}
                              alt={att.fileName}
                              className="max-w-[200px] max-h-[150px] rounded border object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <FileIcon className="h-3 w-3" />
                            {att.fileName}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-3 border-t">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-16 h-16 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type a message or paste a screenshot..."
              className="resize-none min-h-[40px] max-h-[80px] pr-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              data-testid="input-chat-message"
            />
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  data-testid="button-emoji-picker"
                >
                  <Smile className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="grid grid-cols-10 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-lg hover:bg-muted rounded p-1 transition-colors"
                      data-testid={`emoji-${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={(!messageContent.trim() && pendingFiles.length === 0) || sendMessageMutation.isPending}
            data-testid="button-send-message"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      <Dialog open={showAddMembersDialog} onOpenChange={setShowAddMembersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Members to Chat</DialogTitle>
            <DialogDescription>
              Select users to add to this panel's conversation
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {availableUsersToAdd.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All users are already members
              </p>
            ) : (
              availableUsersToAdd.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMemberIds([...selectedMemberIds, user.id]);
                      } else {
                        setSelectedMemberIds(selectedMemberIds.filter(id => id !== user.id));
                      }
                    }}
                    className="rounded"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {user.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMembersDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMembersMutation.mutate(selectedMemberIds)}
              disabled={selectedMemberIds.length === 0 || addMembersMutation.isPending}
            >
              {addMembersMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add {selectedMemberIds.length} Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PanelDocument = {
  id: string;
  title: string;
  documentNumber?: string | null;
  status: string;
  version: string;
  revision: string;
  mimeType: string;
  fileSize: number;
  originalName: string;
  isLatestVersion: boolean;
  createdAt: string;
  uploadedBy: string;
  uploadedByName?: string;
};

type DocumentsResponse = {
  documents: PanelDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const DOC_STATUS_COLORS: Record<string, string> = {
  PRELIM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  IFA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  IFC: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  SUPERSEDED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  ARCHIVED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

function PanelAuditLogTab({ panelId }: { panelId: string }) {
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: [PANELS_ROUTES.AUDIT_LOGS(panelId)],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    const user = users.find((u: any) => u.id === userId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : "Unknown";
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <History className="h-8 w-8 mb-2" />
        <p className="text-sm">No audit log entries yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 p-2">
        {logs.map((log: any) => (
          <div key={log.id} className="p-3 rounded-md border bg-muted/20" data-testid={`audit-log-${log.id}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-medium">{log.action}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{getUserName(log.changedById)}</span>
              {log.previousLifecycleStatus !== null && log.newLifecycleStatus !== null && log.previousLifecycleStatus !== log.newLifecycleStatus && (
                <span className="flex items-center gap-1">
                  {PANEL_LIFECYCLE_LABELS[log.previousLifecycleStatus] || "Unknown"}
                  <span>→</span>
                  {PANEL_LIFECYCLE_LABELS[log.newLifecycleStatus] || "Unknown"}
                </span>
              )}
            </div>
            {log.changedFields && Object.keys(log.changedFields).length > 0 && (
              <div className="mt-2 text-xs font-mono bg-muted/40 rounded p-2 space-y-0.5">
                {Object.entries(log.changedFields).map(([key, value]) => (
                  <div key={key} className="flex gap-1">
                    <span className="text-muted-foreground">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function PanelDocumentsTab({ panelId, productionPdfUrl }: { panelId: string; productionPdfUrl?: string | null }) {
  const { toast } = useToast();
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"PRELIM" | "IFA" | "IFC">("PRELIM");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [existingIfcDoc, setExistingIfcDoc] = useState<PanelDocument | null>(null);
  const [supersededDocumentId, setSupersededDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documentsResponse, isLoading } = useQuery<DocumentsResponse>({
    queryKey: [DOCUMENT_ROUTES.PANEL_DOCUMENTS(panelId)],
  });

  const documents = documentsResponse?.documents || [];
  const hasIfcDocument = documents.some(d => d.status === "IFC" && d.isLatestVersion);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const csrfToken = getCsrfToken();
      const response = await fetch(DOCUMENT_ROUTES.PANEL_DOCUMENT_UPLOAD(panelId), {
        method: "POST",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.PANEL_DOCUMENTS(panelId)] });
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadStatus("PRELIM");
      setSupersededDocumentId(null);
      toast({ title: "Success", description: "Document uploaded successfully" });
    },
    onError: (error: any) => {
      if (error.message?.includes("IFC document already exists")) {
        const ifcDoc = documents.find(d => d.status === "IFC" && d.isLatestVersion);
        if (ifcDoc) {
          setExistingIfcDoc(ifcDoc);
        }
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleUpload = () => {
    if (!uploadFile || !uploadTitle) {
      toast({ title: "Error", description: "Please provide a title and file", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("title", uploadTitle);
    formData.append("status", uploadStatus);
    if (supersededDocumentId) {
      formData.append("supersededDocumentId", supersededDocumentId);
    }

    uploadMutation.mutate(formData);
  };

  const handleSupersede = (docId: string) => {
    setSupersededDocumentId(docId);
    setExistingIfcDoc(null);
    toast({ title: "Ready to Supersede", description: "Upload your new IFC document" });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Panel Documents</h3>
          <p className="text-xs text-muted-foreground">{documents.length} document(s) registered</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowUploadDialog(true)}
          data-testid="button-upload-panel-document"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {productionPdfUrl && (
        <div className="border rounded-lg p-3 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-medium">Production IFC Drawing</h4>
                <p className="text-xs text-muted-foreground">Uploaded during production approval</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild data-testid="button-download-ifc-pdf">
              <a href={ADMIN_ROUTES.PANEL_DOWNLOAD_PDF(panelId)} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border rounded-md bg-muted/30">
          <FileIcon className="h-10 w-10 text-muted-foreground mb-2" />
          <h3 className="font-medium text-muted-foreground text-sm">No Documents</h3>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Upload panel documents with PRELIM, IFA, or IFC status
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20">Version</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{doc.title}</div>
                      <div className="text-xs text-muted-foreground">{doc.originalName}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={DOC_STATUS_COLORS[doc.status] || ""} variant="outline">
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">v{doc.version}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatFileSize(doc.fileSize)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild data-testid={`button-view-document-${doc.id}`}>
                        <a href={DOCUMENT_ROUTES.VIEW(doc.id)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" asChild data-testid={`button-download-document-${doc.id}`}>
                        <a href={DOCUMENT_ROUTES.DOWNLOAD(doc.id)} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Panel Document</DialogTitle>
            <DialogDescription>
              Upload a document and select its status (PRELIM, IFA, or IFC)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Document Title</Label>
              <Input
                id="doc-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g., Panel Shop Drawing Rev A"
                data-testid="input-document-title"
              />
            </div>

            <div className="space-y-2">
              <Label>Document Status</Label>
              <div className="flex gap-2">
                {(["PRELIM", "IFA", "IFC"] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={uploadStatus === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setUploadStatus(status);
                      if (status === "IFC" && hasIfcDocument && !supersededDocumentId) {
                        const ifcDoc = documents.find(d => d.status === "IFC" && d.isLatestVersion);
                        if (ifcDoc) setExistingIfcDoc(ifcDoc);
                      } else {
                        setExistingIfcDoc(null);
                      }
                    }}
                    data-testid={`button-status-${status.toLowerCase()}`}
                  >
                    {status}
                  </Button>
                ))}
              </div>
              {existingIfcDoc && (
                <div className="mt-2 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950 text-sm">
                  <p className="text-amber-800 dark:text-amber-200 font-medium mb-2">
                    An IFC document already exists for this panel
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-xs mb-2">
                    "{existingIfcDoc.title}" (v{existingIfcDoc.version})
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSupersede(existingIfcDoc.id)}
                    data-testid="button-supersede-ifc"
                  >
                    Supersede this document
                  </Button>
                </div>
              )}
              {supersededDocumentId && (
                <div className="mt-2 p-2 border rounded bg-green-50 dark:bg-green-950 text-sm">
                  <p className="text-green-800 dark:text-green-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Document will supersede the existing IFC
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>File</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.ifc"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{uploadFile.name}</span>
                    <span className="text-xs text-muted-foreground">({formatFileSize(uploadFile.size)})</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select a file</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, CAD, IFC supported</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !uploadFile || !uploadTitle || (uploadStatus === "IFC" && hasIfcDocument && !supersededDocumentId)}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminPanelsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const filterJobId = urlParams.get("jobId");
  
  const [panelDialogOpen, setPanelDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<PanelRegister | null>(null);
  const [panelDialogTab, setPanelDialogTab] = useState<string>("details");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPanelId, setDeletingPanelId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [selectedJobForImport, setSelectedJobForImport] = useState<string>("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [factoryFilterInitialized, setFactoryFilterInitialized] = useState(false);
  const [panelTypeFilter, setPanelTypeFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [groupByJob, setGroupByJob] = useState<boolean>(false);
  const [groupByPanelType, setGroupByPanelType] = useState<boolean>(true);
  const [groupByLevel, setGroupByLevel] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "summary">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [collapsedJobs, setCollapsedJobs] = useState<Set<string>>(new Set());
  const [collapsedPanelTypes, setCollapsedPanelTypes] = useState<Set<string>>(new Set());
  const [collapsedLevels, setCollapsedLevels] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [consolidationMode, setConsolidationMode] = useState(false);
  const [selectedConsolidationPanels, setSelectedConsolidationPanels] = useState<Set<string>>(new Set());
  const [consolidationData, setConsolidationData] = useState<{
    primaryPanelId: string;
    panels: any[];
    newPanelMark: string;
    newWidth: string;
    newHeight: string;
  } | null>(null);
  const [consolidationDialogOpen, setConsolidationDialogOpen] = useState(false);
  const [consolidationWarnings, setConsolidationWarnings] = useState<Record<string, { panelMark: string; draftingLogs: number; timerSessions: number; loadListEntries: number; lifecycleStatus: number }> | null>(null);
  const [consolidationCheckLoading, setConsolidationCheckLoading] = useState(false);

  // Build dialog state
  const [buildDialogOpen, setBuildDialogOpen] = useState(false);
  const [buildingPanel, setBuildingPanel] = useState<PanelRegister | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [buildFormData, setBuildFormData] = useState({
    loadWidth: "",
    loadHeight: "",
    panelThickness: "",
    panelVolume: "",
    panelMass: "",
    panelArea: "",
    liftFcm: "",
    concreteStrengthMpa: "",
    rotationalLifters: "",
    primaryLifters: "",
    productionPdfUrl: "",
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Auto-calculate area, volume, and mass when dimensions change
  useEffect(() => {
    const width = parseFloat(buildFormData.loadWidth) || 0;
    const height = parseFloat(buildFormData.loadHeight) || 0;
    const thickness = parseFloat(buildFormData.panelThickness) || 0;
    
    // Calculate area (m²) = width(mm) × height(mm) / 1,000,000
    const areaM2 = (width * height) / 1_000_000;
    
    // Calculate volume (m³) = width(mm) × height(mm) × thickness(mm) / 1,000,000,000
    const volumeM3 = (width * height * thickness) / 1_000_000_000;
    
    // Calculate mass (kg) = volume(m³) × density(kg/m³), default 2500 kg/m³
    const density = 2500;
    const massKg = volumeM3 * density;
    
    setBuildFormData(prev => ({
      ...prev,
      panelArea: areaM2 > 0 ? areaM2.toFixed(3) : "",
      panelVolume: volumeM3 > 0 ? volumeM3.toFixed(3) : "",
      panelMass: massKg > 0 ? Math.round(massKg).toString() : "",
    }));
  }, [buildFormData.loadWidth, buildFormData.loadHeight, buildFormData.panelThickness]);

  // Build query params for pagination
  const queryParams = new URLSearchParams({
    page: currentPage.toString(),
    limit: pageSize.toString(),
  });
  if (jobFilter !== "all") queryParams.set("jobId", jobFilter);
  if (factoryFilter !== "all") queryParams.set("factoryId", factoryFilter);
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);

  interface PaginatedResponse {
    panels: PanelWithJob[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }

  const { data: panelData, isLoading: panelsLoading } = useQuery<PaginatedResponse>({
    queryKey: [ADMIN_ROUTES.PANELS, currentPage, pageSize, jobFilter, factoryFilter, debouncedSearch, statusFilter],
    queryFn: async () => {
      const res = await fetch(`${ADMIN_ROUTES.PANELS}?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch panels");
      return res.json();
    },
  });

  const panels = panelData?.panels;
  const totalPages = panelData?.totalPages || 1;
  const totalPanels = panelData?.total || 0;

  const panelIds = panels?.map(p => p.id) || [];
  const { data: panelCounts } = useQuery<Record<string, { messageCount: number; documentCount: number }>>({
    queryKey: [CHAT_ROUTES.PANELS_COUNTS, panelIds],
    queryFn: async () => {
      if (panelIds.length === 0) return {};
      const csrfToken = getCsrfToken();
      const res = await fetch(CHAT_ROUTES.PANELS_COUNTS, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({ panelIds }),
        credentials: "include",
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: panelIds.length > 0,
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: [ADMIN_ROUTES.JOBS],
  });

  const { data: factories } = useQuery<Factory[]>({
    queryKey: [ADMIN_ROUTES.FACTORIES],
  });

  const { data: userSettings } = useQuery<{ selectedFactoryIds: string[]; defaultFactoryId: string | null }>({
    queryKey: [USER_ROUTES.SETTINGS],
  });

  useEffect(() => {
    if (!factoryFilterInitialized && userSettings) {
      if (userSettings.defaultFactoryId) {
        setFactoryFilter(userSettings.defaultFactoryId);
      }
      setFactoryFilterInitialized(true);
    }
  }, [userSettings, factoryFilterInitialized]);

  const { data: panelTypes } = useQuery<PanelTypeConfig[]>({
    queryKey: [PANEL_TYPES_ROUTES.LIST],
  });

  interface WorkType {
    id: number;
    name: string;
    description: string | null;
  }
  
  const { data: workTypes } = useQuery<WorkType[]>({
    queryKey: [SETTINGS_ROUTES.WORK_TYPES],
  });
  
  // Helper function to normalize panel type for dropdown compatibility
  // Handles both old format (normalized name like "WALL_PANEL") and new format (code like "WP")
  const normalizePanelType = useCallback((storedValue: string | null | undefined): string => {
    if (!storedValue || !panelTypes || panelTypes.length === 0) return "";
    
    // First check if it matches a code directly
    const matchByCode = panelTypes.find(pt => pt.code === storedValue);
    if (matchByCode) return matchByCode.code;
    
    // Normalize the stored value for comparison
    const normalizedStored = storedValue.toUpperCase().replace(/ /g, "_");
    
    // Check if it matches a normalized name
    const matchByName = panelTypes.find(pt => 
      pt.name.toUpperCase().replace(/ /g, "_") === normalizedStored
    );
    if (matchByName) return matchByName.code;
    
    // Check if stored value matches a normalized code  
    const matchByNormalizedCode = panelTypes.find(pt => 
      pt.code.toUpperCase().replace(/ /g, "_") === normalizedStored
    );
    if (matchByNormalizedCode) return matchByNormalizedCode.code;
    
    // Fallback - return first panel type code or empty
    return panelTypes[0]?.code || "";
  }, [panelTypes]);

  const { data: sourceCounts } = useQuery<{ source: number; count: number }[]>({
    queryKey: [ADMIN_ROUTES.PANELS_SOURCE_COUNTS],
  });

  const { data: brandingSettings } = useQuery<{ logoBase64: string | null; companyName: string }>({
    queryKey: [SETTINGS_ROUTES.LOGO],
  });
  const reportLogo = brandingSettings?.logoBase64 || defaultLogo;
  const companyName = brandingSettings?.companyName || "LTE Precast Concrete Structures";

  const [deleteSourceDialogOpen, setDeleteSourceDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<number | null>(null);
  
  // QR Code modal state
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [qrCodePanel, setQrCodePanel] = useState<{ id: string; panelMark: string; jobNumber?: string } | null>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const deleteBySourceMutation = useMutation({
    mutationFn: async (source: number) => {
      return apiRequest("DELETE", ADMIN_ROUTES.PANELS_BY_SOURCE(source));
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS_SOURCE_COUNTS] });
      toast({ title: `Deleted ${result.deleted} panels` });
      setDeleteSourceDialogOpen(false);
      setSourceToDelete(null);
    },
    onError: async (error: any) => {
      const errorData = error.response ? await error.response.json().catch(() => ({})) : {};
      toast({ 
        title: "Cannot delete panels", 
        description: errorData.error || "Some panels have production records",
        variant: "destructive" 
      });
    },
  });

  const sourceLabels: Record<number, string> = {
    1: "Manual",
    2: "Excel Template",
    3: "Estimate",
  };

  const getSourceLabel = (source: number) => sourceLabels[source] || "Unknown";

  const getPanelTypeColor = (panelType: string | null | undefined): string | null => {
    if (!panelType || !panelTypes) return null;
    const pt = panelTypes.find(t => t.code === panelType || t.name === panelType || t.code.toUpperCase() === panelType.toUpperCase());
    return pt?.color || null;
  };

  const getFactoryName = (factoryId: string | null | undefined): string => {
    if (!factoryId || !factories) return "-";
    const factory = factories.find(f => f.id === factoryId);
    return factory?.name || "-";
  };

  const filteredPanels = panels?.filter(panel => {
    if (panel.consolidatedIntoPanelId) return false;
    if (filterJobId && panel.jobId !== filterJobId) return false;
    if (jobFilter !== "all" && panel.jobId !== jobFilter) return false;
    if (factoryFilter !== "all" && panel.job.factoryId !== factoryFilter) return false;
    if (statusFilter !== "all" && panel.status !== statusFilter) return false;
    if (panelTypeFilter !== "all" && panel.panelType !== panelTypeFilter) return false;
    if (levelFilter !== "all" && panel.level !== levelFilter) return false;
    if (searchTerm && !panel.panelMark.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  })?.sort((a, b) => {
    // Sort by Building first, then by Level
    const buildingA = a.building || "";
    const buildingB = b.building || "";
    if (buildingA !== buildingB) {
      return buildingA.localeCompare(buildingB, undefined, { numeric: true });
    }
    const levelA = a.level || "";
    const levelB = b.level || "";
    return levelA.localeCompare(levelB, undefined, { numeric: true });
  });

  // Group panels by job for grouped view
  const panelsByJob = filteredPanels?.reduce((acc, panel) => {
    const jobId = panel.jobId;
    if (!acc[jobId]) {
      acc[jobId] = { job: panel.job, panels: [] };
    }
    acc[jobId].panels.push(panel);
    return acc;
  }, {} as Record<string, { job: Job; panels: PanelWithJob[] }>) || {};

  // Group panels by panel type for grouped view
  const panelsByType = filteredPanels?.reduce((acc, panel) => {
    const type = panel.panelType || "UNKNOWN";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(panel);
    return acc;
  }, {} as Record<string, PanelWithJob[]>) || {};

  // Group panels by level for grouped view
  const panelsByLevel = filteredPanels?.reduce((acc, panel) => {
    const level = panel.level || "No Level";
    if (!acc[level]) {
      acc[level] = [];
    }
    acc[level].push(panel);
    return acc;
  }, {} as Record<string, PanelWithJob[]>) || {};

  // Get unique panel types from current data for filter dropdown
  const uniquePanelTypes = Array.from(new Set(panels?.map(p => p.panelType).filter(Boolean) || [])).sort();

  // Get unique levels from current data for filter dropdown
  const uniqueLevels = Array.from(new Set(panels?.map(p => p.level).filter(Boolean) || [])).sort((a, b) => 
    a!.localeCompare(b!, undefined, { numeric: true })
  );

  const toggleJobCollapse = (jobId: string) => {
    setCollapsedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const togglePanelTypeCollapse = (panelType: string) => {
    setCollapsedPanelTypes(prev => {
      const next = new Set(prev);
      if (next.has(panelType)) {
        next.delete(panelType);
      } else {
        next.add(panelType);
      }
      return next;
    });
  };

  const toggleLevelCollapse = (level: string) => {
    setCollapsedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const currentJob = jobs?.find(j => j.id === filterJobId);

  const handlePrintPanelList = useCallback(() => {
    if (!filteredPanels || filteredPanels.length === 0) {
      toast({ title: "No panels to print", variant: "destructive" });
      return;
    }

    const effectiveJobId = filterJobId || (jobFilter !== "all" ? jobFilter : null);
    const effectiveJob = effectiveJobId ? jobs?.find(j => j.id === effectiveJobId) : null;
    const jobName = effectiveJob ? `${effectiveJob.jobNumber} - ${effectiveJob.name}` : "All Jobs";
    const showJobColumn = !effectiveJobId;
    const dateStr = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

    const getStatusLabel = (status: string) => {
      const map: Record<string, string> = {
        NOT_STARTED: "Not Started",
        IN_PROGRESS: "In Progress",
        COMPLETED: "Completed",
        ON_HOLD: "On Hold",
        PENDING: "Pending",
      };
      return map[status] || status;
    };

    const getStatusColor = (status: string) => {
      const map: Record<string, string> = {
        NOT_STARTED: "#6b7280",
        IN_PROGRESS: "#3b82f6",
        COMPLETED: "#22c55e",
        ON_HOLD: "#f59e0b",
        PENDING: "#a855f7",
      };
      return map[status] || "#6b7280";
    };

    const sortedPanels = [...filteredPanels].sort((a, b) => {
      const buildA = a.building || "";
      const buildB = b.building || "";
      if (buildA !== buildB) return buildA.localeCompare(buildB, undefined, { numeric: true });
      const lvlA = a.level || "";
      const lvlB = b.level || "";
      if (lvlA !== lvlB) return lvlA.localeCompare(lvlB, undefined, { numeric: true });
      return a.panelMark.localeCompare(b.panelMark, undefined, { numeric: true });
    });

    const totalQty = sortedPanels.reduce((sum, p) => sum + (p.qty || 1), 0);
    const totalArea = sortedPanels.reduce((sum, p) => sum + (p.panelArea ? parseFloat(p.panelArea) : 0), 0);
    const totalVolume = sortedPanels.reduce((sum, p) => sum + (p.panelVolume ? parseFloat(p.panelVolume) : 0), 0);
    const totalMass = sortedPanels.reduce((sum, p) => sum + (p.panelMass ? parseFloat(p.panelMass) : 0), 0);

    const activeFilters: string[] = [];
    if (statusFilter !== "all") activeFilters.push(`Status: ${getStatusLabel(statusFilter)}`);
    if (panelTypeFilter !== "all") activeFilters.push(`Type: ${panelTypeFilter}`);
    if (levelFilter !== "all") activeFilters.push(`Level: ${levelFilter}`);
    if (factoryFilter !== "all") {
      const fName = factories?.find(f => f.id === factoryFilter)?.name || factoryFilter;
      activeFilters.push(`Factory: ${fName}`);
    }

    const panelRows = sortedPanels.map((panel, idx) => {
      const jobDisplay = showJobColumn ? `<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;white-space:nowrap;">${panel.job?.jobNumber || "-"}</td>` : "";
      return `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f9fafb"};">
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;color:#6b7280;">${idx + 1}</td>
        ${jobDisplay}
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;white-space:nowrap;">${getFactoryName(panel.job?.factoryId)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;font-weight:600;font-family:monospace;">${panel.panelMark}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.panelType || "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.building || "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">${panel.level || "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;">${panel.qty || 1}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${formatNumber(panel.loadWidth)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${formatNumber(panel.loadHeight)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelThickness ? parseFloat(panel.panelThickness).toFixed(0) : "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelArea ? parseFloat(panel.panelArea).toFixed(2) : "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelVolume ? parseFloat(panel.panelVolume).toFixed(3) : "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:right;font-family:monospace;">${panel.panelMass ? parseFloat(panel.panelMass).toLocaleString("en-AU") : "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:center;font-family:monospace;">${panel.concreteStrengthMpa || "-"}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;">
          <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:500;color:#fff;background:${getStatusColor(panel.status)};">${getStatusLabel(panel.status)}</span>
        </td>
      </tr>`;
    }).join("");

    const jobColHeader = showJobColumn ? `<th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Job</th>` : "";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to print the panel list" });
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Panel List - ${jobName}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 12mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1f2937;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:3px solid #1f2937;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="${reportLogo}" alt="Company Logo" style="height:48px;width:auto;object-fit:contain;" />
      <div>
        <div style="font-size:18px;font-weight:700;color:#1f2937;">${companyName}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">Panel Register</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:600;color:#1f2937;">${jobName}</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">Generated: ${dateStr} at ${timeStr}</div>
      ${activeFilters.length > 0 ? `<div style="font-size:9px;color:#9ca3af;margin-top:2px;">Filters: ${activeFilters.join(" | ")}</div>` : ""}
    </div>
  </div>

  <div style="display:flex;gap:16px;margin-bottom:12px;">
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#0369a1;">${sortedPanels.length}</div>
      <div style="font-size:9px;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;">Panels</div>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#15803d;">${totalQty}</div>
      <div style="font-size:9px;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;">Total Qty</div>
    </div>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#a16207;">${totalArea.toFixed(2)}</div>
      <div style="font-size:9px;color:#a16207;text-transform:uppercase;letter-spacing:0.5px;">Total m\u00B2</div>
    </div>
    <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#7e22ce;">${totalVolume.toFixed(3)}</div>
      <div style="font-size:9px;color:#7e22ce;text-transform:uppercase;letter-spacing:0.5px;">Total m\u00B3</div>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 14px;flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#c2410c;">${totalMass.toLocaleString("en-AU")}</div>
      <div style="font-size:9px;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;">Total kg</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #d1d5db;border-radius:4px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;width:30px;">#</th>
        ${jobColHeader}
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Factory</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Panel Mark</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Type</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Building</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Level</th>
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Qty</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Width (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Height (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Thick (mm)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Area (m\u00B2)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Vol (m\u00B3)</th>
        <th style="padding:5px 6px;text-align:right;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Mass (kg)</th>
        <th style="padding:5px 6px;text-align:center;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">MPa</th>
        <th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#374151;border-bottom:2px solid #1f2937;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${panelRows}
    </tbody>
    <tfoot>
      <tr style="background:#f3f4f6;font-weight:700;">
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;" colspan="${showJobColumn ? 7 : 6}">TOTALS</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:center;">${totalQty}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;" colspan="3"></td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalArea.toFixed(2)}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalVolume.toFixed(3)}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;font-size:9px;text-align:right;font-family:monospace;">${totalMass.toLocaleString("en-AU")}</td>
        <td style="padding:5px 6px;border-top:2px solid #1f2937;" colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:8px;border-top:1px solid #e5e7eb;">
    <div style="font-size:8px;color:#9ca3af;">${companyName} - Confidential</div>
    <div style="font-size:8px;color:#9ca3af;">Page 1 of 1</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  }, [filteredPanels, currentJob, filterJobId, jobFilter, jobs, statusFilter, panelTypeFilter, levelFilter, factoryFilter, factories, reportLogo, companyName, toast]);

  const panelForm = useForm<PanelFormData>({
    resolver: zodResolver(panelSchema),
    defaultValues: {
      jobId: filterJobId || "",
      panelMark: "",
      panelType: "WALL",
      description: "",
      drawingCode: "",
      sheetNumber: "",
      building: "",
      level: "",
      structuralElevation: "",
      estimatedHours: undefined,
      status: "NOT_STARTED",
      workTypeId: 1,
    },
  });

  useEffect(() => {
    if (filterJobId) {
      panelForm.setValue("jobId", filterJobId);
    }
  }, [filterJobId, panelForm]);

  const createPanelMutation = useMutation({
    mutationFn: async (data: PanelFormData) => {
      return apiRequest("POST", ADMIN_ROUTES.PANELS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel created successfully" });
      setPanelDialogOpen(false);
      panelForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create panel", description: error.message, variant: "destructive" });
    },
  });

  const updatePanelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PanelFormData }) => {
      return apiRequest("PUT", ADMIN_ROUTES.PANEL_BY_ID(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel updated successfully" });
      setPanelDialogOpen(false);
      setEditingPanel(null);
      panelForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to update panel", variant: "destructive" });
    },
  });

  const validatePanelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", ADMIN_ROUTES.PANEL_VALIDATE(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel validated successfully", description: "Panel is now available for drafting work" });
      setPanelDialogOpen(false);
      setEditingPanel(null);
      panelForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to validate panel", variant: "destructive" });
    },
  });

  const deletePanelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", ADMIN_ROUTES.PANEL_BY_ID(id), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel deleted" });
      setDeleteDialogOpen(false);
      setDeletingPanelId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete panel", variant: "destructive" });
    },
  });

  const importPanelsMutation = useMutation({
    mutationFn: async ({ data, jobId }: { data: any[]; jobId?: string }) => {
      return apiRequest("POST", ADMIN_ROUTES.PANELS_IMPORT, { data, jobId: jobId || undefined });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      
      // Handle errors (job not found, missing fields, etc.)
      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
        const jobErrors = result.errors.filter((e: string) => e.includes("not found"));
        if (jobErrors.length > 0 && result.imported === 0) {
          toast({ 
            title: "Import Failed - Jobs Not Found", 
            description: `No records were imported. ${jobErrors.length} row(s) have invalid job numbers.`,
            variant: "destructive" 
          });
          return; // Don't close dialog so user can see errors
        }
        toast({ 
          title: `Imported ${result.imported} panels`, 
          description: `${result.skipped} skipped, ${result.errors.length} errors`,
          variant: result.imported > 0 ? "default" : "destructive"
        });
      } else {
        toast({ title: `Successfully imported ${result.imported} panels` });
        setImportDialogOpen(false);
        setImportData([]);
        setSelectedJobForImport("");
        setImportErrors([]);
      }
    },
    onError: async (error: any) => {
      const errorData = error.response ? await error.response.json().catch(() => ({})) : {};
      setImportErrors(errorData.details || []);
      toast({ 
        title: "Import failed", 
        description: errorData.error || error.message,
        variant: "destructive" 
      });
    },
  });

  // PDF upload mutation
  const uploadPdfMutation = useMutation({
    mutationFn: async ({ panelId, pdfBase64, fileName }: { panelId: string; pdfBase64: string; fileName: string }) => {
      const res = await apiRequest("POST", ADMIN_ROUTES.PANEL_UPLOAD_PDF(panelId), { pdfBase64, fileName });
      return res.json();
    },
  });

  // PDF analysis mutation
  const analyzePdfMutation = useMutation({
    mutationFn: async ({ panelId, pdfBase64 }: { panelId: string; pdfBase64: string }) => {
      return apiRequest("POST", ADMIN_ROUTES.PANEL_ANALYZE_PDF(panelId), { pdfBase64 });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      if (result.extracted) {
        setBuildFormData((prev) => ({
          ...prev,
          loadWidth: result.extracted.loadWidth || "",
          loadHeight: result.extracted.loadHeight || "",
          panelThickness: result.extracted.panelThickness || "",
          panelVolume: result.extracted.panelVolume || "",
          panelMass: result.extracted.panelMass || "",
          panelArea: result.extracted.panelArea || "",
          liftFcm: result.extracted.liftFcm || "",
          concreteStrengthMpa: result.extracted.concreteStrengthMpa || result.extracted.day28Fc || "",
          rotationalLifters: result.extracted.rotationalLifters || "",
          primaryLifters: result.extracted.primaryLifters || "",
        }));
        toast({ title: "PDF analyzed successfully" });
      }
      setIsAnalyzing(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to analyze PDF", description: error.message, variant: "destructive" });
      setIsAnalyzing(false);
    },
  });

  // Approve for production mutation
  const approveProductionMutation = useMutation({
    mutationFn: async ({ panelId, data }: { panelId: string; data: typeof buildFormData }) => {
      return apiRequest("POST", ADMIN_ROUTES.PANEL_APPROVE_PRODUCTION(panelId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      // Also invalidate jobs cache since Production Report uses it to get panel data
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Panel approved for production" });
      closeBuildDialog();
    },
    onError: (error: any) => {
      toast({ title: "Failed to approve panel", description: error.message, variant: "destructive" });
    },
  });

  // Revoke production approval mutation
  const revokeApprovalMutation = useMutation({
    mutationFn: async (panelId: string) => {
      return apiRequest("POST", ADMIN_ROUTES.PANEL_REVOKE_PRODUCTION(panelId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.PANELS] });
      // Also invalidate jobs cache since Production Report uses it to get panel data
      queryClient.invalidateQueries({ queryKey: [ADMIN_ROUTES.JOBS] });
      toast({ title: "Production approval revoked" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to revoke approval", description: error.message, variant: "destructive" });
    },
  });

  // Build dialog functions
  const openBuildDialog = (panel: PanelRegister) => {
    // Prevent opening production dialog for PENDING panels
    if (panel.status === "PENDING") {
      toast({
        title: "Panel must be validated first",
        description: "This panel is still pending validation. Please validate it before setting up for production.",
        variant: "destructive"
      });
      return;
    }
    
    setBuildingPanel(panel);
    setValidationErrors([]);
    setBuildFormData({
      loadWidth: panel.loadWidth || "",
      loadHeight: panel.loadHeight || "",
      panelThickness: panel.panelThickness || "",
      panelVolume: panel.panelVolume || "",
      panelMass: panel.panelMass || "",
      panelArea: panel.panelArea || "",
      liftFcm: panel.liftFcm || "",
      concreteStrengthMpa: panel.concreteStrengthMpa || panel.day28Fc || "",
      rotationalLifters: panel.rotationalLifters || "",
      primaryLifters: panel.primaryLifters || "",
      productionPdfUrl: panel.productionPdfUrl || "",
    });
    setPdfFile(null);
    setBuildDialogOpen(true);
  };

  const closeBuildDialog = () => {
    setBuildDialogOpen(false);
    setBuildingPanel(null);
    setPdfFile(null);
    setValidationErrors([]);
    setBuildFormData({
      loadWidth: "",
      loadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
      panelArea: "",
      liftFcm: "",
      concreteStrengthMpa: "",
      rotationalLifters: "",
      primaryLifters: "",
      productionPdfUrl: "",
    });
  };

  const handlePdfDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "application/pdf" || file.name.endsWith(".pdf"))) {
      setPdfFile(file);
    } else {
      toast({ title: "Please upload a PDF file", variant: "destructive" });
    }
  }, [toast]);

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const analyzePdf = async () => {
    if (!pdfFile || !buildingPanel) return;
    
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(",")[1];
      if (base64) {
        try {
          const uploadResult = await uploadPdfMutation.mutateAsync({ 
            panelId: buildingPanel.id, 
            pdfBase64: base64,
            fileName: pdfFile.name 
          });
          if (uploadResult.objectPath) {
            setBuildFormData((prev) => ({
              ...prev,
              productionPdfUrl: uploadResult.objectPath,
            }));
          }
          analyzePdfMutation.mutate({ panelId: buildingPanel.id, pdfBase64: base64 });
        } catch (error: any) {
          toast({ title: "Error uploading PDF", description: error.message, variant: "destructive" });
          setIsAnalyzing(false);
        }
      }
    };
    reader.readAsDataURL(pdfFile);
  };

  const handleApproveProduction = () => {
    if (!buildingPanel) return;
    
    // Validation - required fields before approval
    const errors: string[] = [];
    if (!buildFormData.loadWidth) errors.push("Load Width is required");
    if (!buildFormData.loadHeight) errors.push("Load Height is required");
    if (!buildFormData.panelThickness) errors.push("Panel Thickness is required");
    if (!buildFormData.concreteStrengthMpa) errors.push("Concrete Strength f'c (MPa) is required");
    if (!buildFormData.liftFcm) errors.push("Lift f'cm is required");
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Validation Required",
        description: "Please fill in all required fields before approving for production.",
        variant: "destructive",
      });
      return;
    }
    
    setValidationErrors([]);
    approveProductionMutation.mutate({ panelId: buildingPanel.id, data: buildFormData });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setImportData(jsonData);
      setSelectedJobForImport(filterJobId || "");
      setImportErrors([]); // Clear previous errors
      setImportDialogOpen(true);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    // Check if jobs exist
    if (!jobs || jobs.length === 0) {
      toast({
        title: "No Jobs in System",
        description: "Please load jobs into the system before downloading the template. No panels can be added for jobs that don't exist.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if panel types exist
    if (!panelTypes || panelTypes.length === 0) {
      toast({
        title: "No Panel Types Configured",
        description: "Please configure panel types in the system before importing panels.",
        variant: "destructive",
      });
      return;
    }
    
    // Create panels template sheet with one example row for each panel type
    const template = panelTypes.map((pt, index) => ({
      "Job Number": jobs[0]?.jobNumber || "JOB-001", 
      "Panel Mark": `PM-${String(index + 1).padStart(3, '0')}`, 
      "Panel Type": pt.code, 
      "Description": `${pt.name} panel example`, 
      "Drawing Code": `DWG-${String(index + 1).padStart(3, '0')}`, 
      "Sheet Number": `A${String(index + 1).padStart(3, '0')}`, 
      "Building": "1", 
      "Zone": "", 
      "Level": "1", 
      "Structural Elevation": "CCB", 
      "Reckli Detail": "", 
      "Qty": 1,
      "Width (mm)": 3000,
      "Height (mm)": 2800,
      "Thickness (mm)": 200,
      "Area (m²)": 8.4,
      "Volume (m³)": 1.68,
      "Weight (kg)": pt.expectedWeightPerM3 ? Number(pt.expectedWeightPerM3) * 1.68 : 4200,
      "Concrete Strength (MPa)": "40",
      "Takeoff Category": `${pt.name} TakeOff`,
      "Estimated Hours": 8 
    }));
    const panelsSheet = XLSX.utils.json_to_sheet(template);
    
    // Create panel types reference sheet
    const panelTypesData = panelTypes.map(pt => ({
      "Panel Type": pt.name,
      "Code": pt.code,
      "Supply Cost ($/m²)": pt.supplyCostPerM2 || "",
      "Install Cost ($/m²)": pt.installCostPerM2 || "",
      "Sell Rate ($/m²)": pt.sellRatePerM2 || "",
      "Expected Weight (kg/m³)": pt.expectedWeightPerM3 || "",
    }));
    const panelTypesSheet = XLSX.utils.json_to_sheet(panelTypesData);
    
    // Create jobs reference sheet with existing jobs
    const jobsData = jobs.map(j => ({
      "Job Number": j.jobNumber,
      "Job Name": j.name,
      "Client": j.client || "",
      "Crane Capacity": j.craneCapacity || "",
      "Status": j.status,
    }));
    const jobsSheet = XLSX.utils.json_to_sheet(jobsData);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, panelsSheet, "Panels");
    XLSX.utils.book_append_sheet(wb, panelTypesSheet, "Panel Types Reference");
    XLSX.utils.book_append_sheet(wb, jobsSheet, "Jobs Reference");
    XLSX.writeFile(wb, "panels_import_template.xlsx");
    
    setTemplateDialogOpen(false);
  };

  const openCreateDialog = () => {
    setEditingPanel(null);
    panelForm.reset({
      jobId: filterJobId || "",
      panelMark: "",
      panelType: "WALL",
      description: "",
      drawingCode: "",
      sheetNumber: "",
      building: "",
      level: "",
      structuralElevation: "",
      reckliDetail: "",
      estimatedHours: undefined,
      status: "NOT_STARTED",
      loadWidth: "",
      loadHeight: "",
      panelThickness: "",
      panelVolume: "",
      panelMass: "",
      qty: 1,
      concreteStrengthMpa: "",
      workTypeId: 1,
    });
    setPanelDialogOpen(true);
  };

  const openEditDialog = (panel: PanelRegister) => {
    setEditingPanel(panel);
    panelForm.reset({
      jobId: panel.jobId,
      panelMark: panel.panelMark,
      panelType: normalizePanelType(panel.panelType),
      description: panel.description || "",
      drawingCode: panel.drawingCode || "",
      sheetNumber: panel.sheetNumber || "",
      building: panel.building || "",
      level: panel.level || "",
      structuralElevation: panel.structuralElevation || "",
      reckliDetail: panel.reckliDetail || "",
      estimatedHours: panel.estimatedHours || undefined,
      status: panel.status,
      loadWidth: panel.loadWidth || "",
      loadHeight: panel.loadHeight || "",
      panelThickness: panel.panelThickness || "",
      panelVolume: panel.panelVolume || "",
      panelMass: panel.panelMass || "",
      qty: panel.qty || 1,
      concreteStrengthMpa: panel.concreteStrengthMpa || "",
      workTypeId: panel.workTypeId || 1,
    });
    setPanelDialogOpen(true);
  };

  const onSubmit = (data: PanelFormData) => {
    if (editingPanel) {
      updatePanelMutation.mutate({ id: editingPanel.id, data });
    } else {
      createPanelMutation.mutate(data);
    }
  };

  const consolidateMutation = useMutation({
    mutationFn: async (data: { panelIds: string[]; primaryPanelId: string; newPanelMark: string; newLoadWidth: string; newLoadHeight: string }) => {
      const res = await apiRequest("POST", "/api/panels/consolidate", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panels/admin"] });
      toast({ title: "Panels consolidated successfully" });
      setConsolidationMode(false);
      setSelectedConsolidationPanels(new Set());
      setConsolidationDialogOpen(false);
      setConsolidationData(null);
    },
    onError: (error: any) => {
      toast({ title: "Consolidation Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleConsolidationProceed = async () => {
    const selectedPanels = (filteredPanels || []).filter(p => selectedConsolidationPanels.has(p.id));
    if (selectedPanels.length < 2) return;

    const jobIds = new Set(selectedPanels.map(p => p.jobId));
    if (jobIds.size > 1) {
      toast({ title: "Validation Error", description: "All panels must belong to the same job", variant: "destructive" });
      return;
    }

    const panelTypeSet = new Set(selectedPanels.map(p => p.panelType));
    if (panelTypeSet.size > 1) {
      toast({ title: "Validation Error", description: "All panels must be the same panel type", variant: "destructive" });
      return;
    }

    const mpas = new Set(selectedPanels.map(p => p.concreteStrengthMpa || ""));
    if (mpas.size > 1) {
      toast({ title: "Validation Error", description: "Cannot consolidate panels with different concrete strengths (MPa)", variant: "destructive" });
      return;
    }

    const thicknesses = new Set(selectedPanels.map(p => p.panelThickness || ""));
    if (thicknesses.size > 1) {
      toast({ title: "Validation Error", description: "Cannot consolidate panels with different panel thicknesses", variant: "destructive" });
      return;
    }

    const sortedByLevel = [...selectedPanels].sort((a, b) => {
      const levelOrder = ["basement", "ground", "g", "l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l10", "roof"];
      const aLevel = (a.level || "").toLowerCase();
      const bLevel = (b.level || "").toLowerCase();
      const aIdx = levelOrder.findIndex(l => aLevel.includes(l));
      const bIdx = levelOrder.findIndex(l => bLevel.includes(l));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return (a.level || "").localeCompare(b.level || "", undefined, { numeric: true });
    });

    const primaryPanel = sortedByLevel[0];

    const widths = selectedPanels.map(p => parseFloat(p.loadWidth || "0"));
    const heights = selectedPanels.map(p => parseFloat(p.loadHeight || "0"));
    const allWidthsSame = new Set(widths).size === 1;
    const allHeightsSame = new Set(heights).size === 1;

    let newWidth: string;
    let newHeight: string;

    if (allWidthsSame) {
      newWidth = String(widths[0]);
      newHeight = String(heights.reduce((sum, h) => sum + h, 0));
    } else if (allHeightsSame) {
      newWidth = String(widths.reduce((sum, w) => sum + w, 0));
      newHeight = String(heights[0]);
    } else {
      toast({ title: "Validation Error", description: "Cannot consolidate panels: widths or heights must match across all selected panels", variant: "destructive" });
      return;
    }

    const newPanelMark = primaryPanel.panelMark.endsWith("C") 
      ? primaryPanel.panelMark 
      : primaryPanel.panelMark + "C";

    setConsolidationData({
      primaryPanelId: primaryPanel.id,
      panels: selectedPanels,
      newPanelMark,
      newWidth,
      newHeight,
    });
    setConsolidationDialogOpen(true);

    setConsolidationCheckLoading(true);
    setConsolidationWarnings(null);
    try {
      const res = await apiRequest("POST", "/api/panels/consolidation-check", { panelIds: selectedPanels.map(p => p.id) });
      const data = await res.json();
      setConsolidationWarnings(data);
    } catch (err) {
      console.error("Failed to check consolidation records:", err);
    } finally {
      setConsolidationCheckLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; className?: string }> = {
      NOT_STARTED: { variant: "outline", icon: AlertCircle },
      IN_PROGRESS: { variant: "default", icon: ClockIcon },
      COMPLETED: { variant: "secondary", icon: CheckCircle },
      ON_HOLD: { variant: "destructive", icon: Pause },
      PENDING: { variant: "outline", icon: AlertCircle, className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700" },
    };
    const { variant, icon: Icon, className } = config[status] || config.NOT_STARTED;
    return (
      <Badge variant={variant} className={`gap-1 ${className || ""}`}>
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getLifecycleStatusBadge = (lifecycleStatus: number) => {
    const label = PANEL_LIFECYCLE_LABELS[lifecycleStatus] || "Unknown";
    const colors = PANEL_LIFECYCLE_COLORS[lifecycleStatus] || PANEL_LIFECYCLE_COLORS[0];
    return (
      <Badge variant="outline" className={`text-xs ${colors.bg} ${colors.text} ${colors.border}`} data-testid={`badge-lifecycle-${lifecycleStatus}`}>
        {label}
      </Badge>
    );
  };

  const getProgress = (panel: PanelRegister) => {
    if (!panel.estimatedHours || panel.estimatedHours === 0) return null;
    const percent = Math.min(100, ((panel.actualHours || 0) / panel.estimatedHours) * 100);
    return percent;
  };

  const statusCounts = {
    total: filteredPanels?.length || 0,
    notStarted: filteredPanels?.filter(p => p.status === "NOT_STARTED").length || 0,
    inProgress: filteredPanels?.filter(p => p.status === "IN_PROGRESS").length || 0,
    completed: filteredPanels?.filter(p => p.status === "COMPLETED").length || 0,
    onHold: filteredPanels?.filter(p => p.status === "ON_HOLD").length || 0,
    pending: filteredPanels?.filter(p => p.status === "PENDING").length || 0,
  };

  const volumeAreaTotals = {
    totalM2: filteredPanels?.reduce((sum, p) => sum + parseFloat(p.panelArea || "0"), 0) || 0,
    totalM3: filteredPanels?.reduce((sum, p) => sum + parseFloat(p.panelVolume || "0"), 0) || 0,
    completedM2: filteredPanels?.filter(p => p.status === "COMPLETED").reduce((sum, p) => sum + parseFloat(p.panelArea || "0"), 0) || 0,
    completedM3: filteredPanels?.filter(p => p.status === "COMPLETED").reduce((sum, p) => sum + parseFloat(p.panelVolume || "0"), 0) || 0,
  };

  const panelsByBuildingAndLevel = filteredPanels?.reduce((acc, panel) => {
    const building = panel.building || "Unassigned";
    const level = panel.level || "Unassigned";
    
    if (!acc[building]) acc[building] = {};
    if (!acc[building][level]) {
      acc[building][level] = { count: 0, area: 0, volume: 0, completed: 0, panels: [] };
    }
    
    acc[building][level].count++;
    acc[building][level].area += parseFloat(panel.panelArea || "0");
    acc[building][level].volume += parseFloat(panel.panelVolume || "0");
    if (panel.status === "COMPLETED") acc[building][level].completed++;
    acc[building][level].panels.push(panel);
    
    return acc;
  }, {} as Record<string, Record<string, { count: number; area: number; volume: number; completed: number; panels: PanelRegister[] }>>);

  const sortedBuildings = Object.keys(panelsByBuildingAndLevel || {}).sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const sortLevel = (a: string, b: string) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    const levelOrder = ["basement", "ground", "g", "l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l10", "roof"];
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aIdx = levelOrder.findIndex(l => aLower.includes(l));
    const bIdx = levelOrder.findIndex(l => bLower.includes(l));
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  };

  if (panelsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {filterJobId && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/jobs")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-panels-title">
              Panel Register
              {currentJob && <span className="text-muted-foreground ml-2">- {currentJob.jobNumber}</span>}
            </h1>
            <p className="text-muted-foreground">
              {filterJobId ? `Panels for ${currentJob?.name || "job"}` : "Manage panel register for all jobs"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-file-upload"
          />
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          {sourceCounts && sourceCounts.length > 0 && (
            <Select 
              value="" 
              onValueChange={(value) => {
                if (value) {
                  setSourceToDelete(parseInt(value));
                  setDeleteSourceDialogOpen(true);
                }
              }}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-bulk-delete">
                <Trash2 className="h-4 w-4 mr-2" />
                <span>Bulk Delete</span>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3].map(source => {
                  const count = sourceCounts.find(s => s.source === source)?.count || 0;
                  if (count === 0) return null;
                  return (
                    <SelectItem key={source} value={source.toString()} data-testid={`option-delete-source-${source}`}>
                      {getSourceLabel(source)} ({count} panels)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          <Button
            variant={consolidationMode ? "destructive" : "outline"}
            onClick={() => {
              if (consolidationMode && selectedConsolidationPanels.size >= 2) {
                handleConsolidationProceed();
              } else if (consolidationMode) {
                setConsolidationMode(false);
                setSelectedConsolidationPanels(new Set());
              } else {
                setConsolidationMode(true);
                setSelectedConsolidationPanels(new Set());
              }
            }}
            data-testid="button-consolidate-panel"
          >
            <Combine className="h-4 w-4 mr-2" />
            {consolidationMode 
              ? selectedConsolidationPanels.size >= 2 
                ? `Consolidate ${selectedConsolidationPanels.size} Panels`
                : "Cancel Consolidation"
              : "Consolidate Panel"}
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-panel">
            <Plus className="h-4 w-4 mr-2" />
            Add Panel
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintPanelList}
            disabled={!filteredPanels || filteredPanels.length === 0}
            data-testid="button-print-panel-list"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("all")} data-testid="card-filter-all">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.total}</div>
            <div className="text-sm text-muted-foreground">Total Panels</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("NOT_STARTED")} data-testid="card-filter-not-started">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-muted-foreground">{statusCounts.notStarted}</div>
            <div className="text-sm text-muted-foreground">Not Started</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("IN_PROGRESS")} data-testid="card-filter-in-progress">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-500">{statusCounts.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("COMPLETED")} data-testid="card-filter-completed">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{statusCounts.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" onClick={() => setStatusFilter("ON_HOLD")} data-testid="card-filter-on-hold">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-500">{statusCounts.onHold}</div>
            <div className="text-sm text-muted-foreground">On Hold</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card data-testid="card-total-m2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{volumeAreaTotals.totalM2.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total m²</div>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-m2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{volumeAreaTotals.completedM2.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Completed m²</div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-m3">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{volumeAreaTotals.totalM3.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total m³</div>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-m3">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{volumeAreaTotals.completedM3.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Completed m³</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {viewMode === "list" ? "Panel List" : "Building & Level Summary"}
              </CardTitle>
              <CardDescription>
                {filteredPanels?.length || 0} panels {statusFilter !== "all" && `(${statusFilter.replace("_", " ")})`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                >
                  <ClipboardList className="h-4 w-4 mr-1" />
                  List
                </Button>
                <Button
                  variant={viewMode === "summary" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("summary")}
                  data-testid="button-view-summary"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Summary
                </Button>
              </div>
              {viewMode === "list" && (
                <>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search panel mark..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[180px]"
                      data-testid="input-search-panel"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="group-by-job" 
                      checked={groupByJob} 
                      onCheckedChange={(checked) => {
                        setGroupByJob(checked);
                        if (checked) setGroupByPanelType(false);
                      }}
                      data-testid="switch-group-by-job"
                    />
                    <Label htmlFor="group-by-job" className="text-sm cursor-pointer">
                      Group by Job
                    </Label>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-factory-filter">
                    <SelectValue placeholder="All Factories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Factories</SelectItem>
                    {factories?.filter(f => f.isActive).map(factory => (
                      <SelectItem key={factory.id} value={factory.id}>
                        {factory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!filterJobId && (
                  <Select value={jobFilter} onValueChange={setJobFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-job-filter">
                      <SelectValue placeholder="All Jobs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      {jobs?.filter(j => j.status === "ACTIVE" && isJobVisibleInDropdowns((j as any).jobPhase || "CONTRACTED")).map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.jobNumber} - {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending Validation</SelectItem>
                    <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={panelTypeFilter} onValueChange={setPanelTypeFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-panel-type-filter">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniquePanelTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-level-filter">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {uniqueLevels.map(level => (
                      <SelectItem key={level} value={level!}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 ml-2">
                  <Switch
                    id="group-by-type"
                    checked={groupByPanelType}
                    onCheckedChange={(checked) => {
                      setGroupByPanelType(checked);
                      if (checked) { setGroupByJob(false); setGroupByLevel(false); }
                    }}
                    data-testid="switch-group-by-type"
                  />
                  <Label htmlFor="group-by-type" className="text-sm whitespace-nowrap">Group by Type</Label>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Switch
                    id="group-by-level"
                    checked={groupByLevel}
                    onCheckedChange={(checked) => {
                      setGroupByLevel(checked);
                      if (checked) { setGroupByJob(false); setGroupByPanelType(false); }
                    }}
                    data-testid="switch-group-by-level"
                  />
                  <Label htmlFor="group-by-level" className="text-sm whitespace-nowrap">Group by Level</Label>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "summary" ? (
            <div className="space-y-6">
              {sortedBuildings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No panels to display
                </div>
              ) : (
                sortedBuildings.map((building) => {
                  const levels = panelsByBuildingAndLevel?.[building] || {};
                  const sortedLevels = Object.keys(levels).sort(sortLevel);
                  const buildingTotals = {
                    count: Object.values(levels).reduce((sum, l) => sum + l.count, 0),
                    area: Object.values(levels).reduce((sum, l) => sum + l.area, 0),
                    volume: Object.values(levels).reduce((sum, l) => sum + l.volume, 0),
                    completed: Object.values(levels).reduce((sum, l) => sum + l.completed, 0),
                  };
                  
                  return (
                    <Card key={building} className="border" data-testid={`card-building-${building}`}>
                      <CardHeader className="py-3 px-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Layers className="h-5 w-5" />
                            Building: {building}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm">
                            <span><strong>{buildingTotals.count}</strong> panels</span>
                            <span><strong>{buildingTotals.completed}</strong> completed</span>
                            <span><strong>{buildingTotals.area.toFixed(2)}</strong> m²</span>
                            <span><strong>{buildingTotals.volume.toFixed(2)}</strong> m³</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[200px]">Level</TableHead>
                              <TableHead className="text-center">Panels</TableHead>
                              <TableHead className="text-center">Completed</TableHead>
                              <TableHead className="text-right">Area (m²)</TableHead>
                              <TableHead className="text-right">Volume (m³)</TableHead>
                              <TableHead className="text-center">Progress</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedLevels.map((level) => {
                              const data = levels[level];
                              const progress = data.count > 0 ? (data.completed / data.count) * 100 : 0;
                              return (
                                <TableRow key={level} data-testid={`row-level-${building}-${level}`}>
                                  <TableCell className="font-medium">{level}</TableCell>
                                  <TableCell className="text-center">{data.count}</TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-green-600">{data.completed}</span>
                                  </TableCell>
                                  <TableCell className="text-right">{data.area.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">{data.volume.toFixed(3)}</TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center gap-2 justify-center">
                                      <Progress value={progress} className="w-20 h-2" />
                                      <span className="text-xs text-muted-foreground w-10">{progress.toFixed(0)}%</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                {consolidationMode && <TableHead className="w-10"></TableHead>}
                {!filterJobId && !groupByJob && !groupByPanelType && <TableHead>Job</TableHead>}
                <TableHead>Factory</TableHead>
                <TableHead>Panel Mark</TableHead>
                <TableHead>{groupByPanelType ? "Job" : "Type"}</TableHead>
                <TableHead>Building</TableHead>
                                <TableHead>Level</TableHead>
                <TableHead className="text-center w-12">Qty</TableHead>
                <TableHead className="text-right w-20">Width (mm)</TableHead>
                <TableHead className="text-right w-20">Height (mm)</TableHead>
                <TableHead className="text-right w-20">Area (m²)</TableHead>
                <TableHead className="text-right w-20">Vol (m³)</TableHead>
                <TableHead className="text-right w-16">MPa</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Drawing Status</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupByPanelType ? (
                // Grouped by panel type view
                Object.entries(panelsByType).length > 0 ? (
                  Object.entries(panelsByType).sort(([a], [b]) => a.localeCompare(b)).map(([panelType, typePanels]) => {
                    const isCollapsed = collapsedPanelTypes.has(panelType);
                    return (
                      <Fragment key={panelType}>
                        <TableRow 
                          className="bg-muted/50 hover:bg-muted cursor-pointer"
                          onClick={() => togglePanelTypeCollapse(panelType)}
                          data-testid={`row-type-group-${panelType}`}
                        >
                          <TableCell colSpan={consolidationMode ? 17 : 16}>
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <Layers className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{panelType}</span>
                              <Badge variant="secondary" className="ml-2">
                                {typePanels.length} panel{typePanels.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && typePanels.map((panel) => (
                          <TableRow 
                            key={panel.id} 
                            data-testid={`row-panel-${panel.id}`}
                            style={panel.job.productionSlotColor ? { 
                              backgroundColor: `${panel.job.productionSlotColor}15`,
                              borderLeft: `4px solid ${panel.job.productionSlotColor}` 
                            } : undefined}
                          >
                            {consolidationMode && (
                              <TableCell className="w-10">
                                <Checkbox
                                  checked={selectedConsolidationPanels.has(panel.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedConsolidationPanels(prev => {
                                      const newSet = new Set(prev);
                                      if (checked) newSet.add(panel.id);
                                      else newSet.delete(panel.id);
                                      return newSet;
                                    });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`checkbox-consolidate-${panel.id}`}
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-sm">{getFactoryName(panel.job.factoryId)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 pl-6">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-medium">{panel.panelMark}</span>
                                {(panelCounts?.[panel.id]?.messageCount || 0) > 0 && (
                                  <Badge className="text-xs gap-0.5 px-1.5 py-0 bg-blue-500 text-white hover:bg-blue-600">
                                    <MessageCircle className="h-3 w-3" />
                                    {panelCounts?.[panel.id]?.messageCount}
                                  </Badge>
                                )}
                                {(panelCounts?.[panel.id]?.documentCount || 0) > 0 && (
                                  <Badge variant="outline" className="text-xs gap-0.5 px-1.5 py-0">
                                    <FileTextIcon className="h-3 w-3" />
                                    {panelCounts?.[panel.id]?.documentCount}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-mono">{panel.job.jobNumber}</span>
                            </TableCell>
                            <TableCell className="text-sm">{panel.building || "-"}</TableCell>
                            <TableCell className="text-sm">{panel.level || "-"}</TableCell>
                            <TableCell className="text-center">{panel.qty || 1}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadWidth)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadHeight)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.panelArea ? `${parseFloat(panel.panelArea).toFixed(2)}` : "-"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.panelVolume ? `${parseFloat(panel.panelVolume).toFixed(2)}` : "-"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.concreteStrengthMpa || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {getSourceLabel(panel.source)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "default" : "secondary"} 
                                className={`text-xs ${panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "bg-green-600" : ""}`}
                              >
                                {panel.documentStatus || "DRAFT"}
                              </Badge>
                            </TableCell>
                            <TableCell>{getLifecycleStatusBadge(panel.lifecycleStatus ?? 0)}</TableCell>
                            <TableCell>{getStatusBadge(panel.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {panel.approvedForProduction ? (
                                  <Badge variant="secondary" className="gap-1 mr-2">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    Approved
                                  </Badge>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); openBuildDialog(panel); }}
                                  title={panel.approvedForProduction ? "Edit production details" : "Set up for production"}
                                  data-testid={`button-build-panel-${panel.id}`}
                                >
                                  <Hammer className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const job = jobs?.find(j => j.id === panel.jobId);
                                    setQrCodePanel({ id: panel.id, panelMark: panel.panelMark, jobNumber: job?.jobNumber });
                                    setQrCodeDialogOpen(true);
                                  }}
                                  title="View QR Code"
                                  data-testid={`button-qr-panel-${panel.id}`}
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); openEditDialog(panel); }}
                                  data-testid={`button-edit-panel-${panel.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingPanelId(panel.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                  data-testid={`button-delete-panel-${panel.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={consolidationMode ? 17 : 16} className="text-center py-8 text-muted-foreground">
                      No panels found. Add a panel or import from Excel.
                    </TableCell>
                  </TableRow>
                )
              ) : groupByJob && !filterJobId ? (
                // Grouped by job view
                Object.entries(panelsByJob).length > 0 ? (
                  Object.entries(panelsByJob).map(([jobId, { job, panels: jobPanels }]) => {
                    const isCollapsed = collapsedJobs.has(jobId);
                    return (
                      <Fragment key={jobId}>
                        <TableRow 
                          className="bg-muted/50 hover:bg-muted cursor-pointer"
                          onClick={() => toggleJobCollapse(jobId)}
                          data-testid={`row-job-group-${jobId}`}
                        >
                          <TableCell colSpan={consolidationMode ? 17 : 16}>
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <Layers className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{job.jobNumber}</span>
                              <span className="text-muted-foreground">- {job.name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {jobPanels.length} panel{jobPanels.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && jobPanels.map((panel) => (
                          <TableRow 
                            key={panel.id} 
                            data-testid={`row-panel-${panel.id}`}
                            style={panel.job.productionSlotColor ? { 
                              backgroundColor: `${panel.job.productionSlotColor}15`,
                              borderLeft: `4px solid ${panel.job.productionSlotColor}` 
                            } : undefined}
                          >
                            {consolidationMode && (
                              <TableCell className="w-10">
                                <Checkbox
                                  checked={selectedConsolidationPanels.has(panel.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedConsolidationPanels(prev => {
                                      const newSet = new Set(prev);
                                      if (checked) newSet.add(panel.id);
                                      else newSet.delete(panel.id);
                                      return newSet;
                                    });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`checkbox-consolidate-${panel.id}`}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-2 pl-6">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-medium">{panel.panelMark}</span>
                                {(panelCounts?.[panel.id]?.messageCount || 0) > 0 && (
                                  <Badge className="text-xs gap-0.5 px-1.5 py-0 bg-blue-500 text-white hover:bg-blue-600">
                                    <MessageCircle className="h-3 w-3" />
                                    {panelCounts?.[panel.id]?.messageCount}
                                  </Badge>
                                )}
                                {(panelCounts?.[panel.id]?.documentCount || 0) > 0 && (
                                  <Badge variant="outline" className="text-xs gap-0.5 px-1.5 py-0">
                                    <FileTextIcon className="h-3 w-3" />
                                    {panelCounts?.[panel.id]?.documentCount}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const typeColor = getPanelTypeColor(panel.panelType);
                                return (
                                  <Badge 
                                    variant="outline"
                                    style={typeColor ? { 
                                      backgroundColor: `${typeColor}20`,
                                      borderColor: typeColor,
                                      color: typeColor
                                    } : undefined}
                                  >
                                    {panel.panelType?.replace("_", " ") || "WALL"}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-sm">{panel.building || "-"}</TableCell>
                            <TableCell className="text-sm">{panel.level || "-"}</TableCell>
                            <TableCell className="text-center">{panel.qty || 1}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadWidth)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadHeight)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.panelArea ? `${parseFloat(panel.panelArea).toFixed(2)}` : "-"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.panelVolume ? `${parseFloat(panel.panelVolume).toFixed(2)}` : "-"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.concreteStrengthMpa || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {getSourceLabel(panel.source)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "default" : "secondary"} 
                                className={`text-xs ${panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "bg-green-600" : ""}`}
                              >
                                {panel.documentStatus || "DRAFT"}
                              </Badge>
                            </TableCell>
                            <TableCell>{getLifecycleStatusBadge(panel.lifecycleStatus ?? 0)}</TableCell>
                            <TableCell>{getStatusBadge(panel.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {panel.approvedForProduction ? (
                                  <Badge variant="secondary" className="gap-1 mr-2">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    Approved
                                  </Badge>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); openBuildDialog(panel); }}
                                  title={panel.approvedForProduction ? "Edit production details" : "Set up for production"}
                                  data-testid={`button-build-panel-${panel.id}`}
                                >
                                  <Hammer className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const job = jobs?.find(j => j.id === panel.jobId);
                                    setQrCodePanel({ id: panel.id, panelMark: panel.panelMark, jobNumber: job?.jobNumber });
                                    setQrCodeDialogOpen(true);
                                  }}
                                  title="View QR Code"
                                  data-testid={`button-qr-panel-${panel.id}`}
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); openEditDialog(panel); }}
                                  data-testid={`button-edit-panel-${panel.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingPanelId(panel.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                  data-testid={`button-delete-panel-${panel.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={consolidationMode ? 17 : 16} className="text-center py-8 text-muted-foreground">
                      No panels found. Add a panel or import from Excel.
                    </TableCell>
                  </TableRow>
                )
              ) : groupByLevel ? (
                // Grouped by level view
                Object.entries(panelsByLevel).length > 0 ? (
                  Object.entries(panelsByLevel).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([level, levelPanels]) => {
                    const isCollapsed = collapsedLevels.has(level);
                    return (
                      <Fragment key={level}>
                        <TableRow 
                          className="bg-muted/50 hover:bg-muted cursor-pointer"
                          onClick={() => toggleLevelCollapse(level)}
                          data-testid={`row-level-group-${level}`}
                        >
                          <TableCell colSpan={consolidationMode ? 17 : 16}>
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <Layers className="h-4 w-4 text-primary" />
                              <span className="font-semibold">Level: {level}</span>
                              <Badge variant="secondary" className="ml-2">
                                {levelPanels.length} panel{levelPanels.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && levelPanels.map((panel) => (
                          <TableRow 
                            key={panel.id} 
                            data-testid={`row-panel-${panel.id}`}
                            style={panel.job.productionSlotColor ? { 
                              backgroundColor: `${panel.job.productionSlotColor}15`,
                              borderLeft: `4px solid ${panel.job.productionSlotColor}` 
                            } : undefined}
                          >
                            {consolidationMode && (
                              <TableCell className="w-10">
                                <Checkbox
                                  checked={selectedConsolidationPanels.has(panel.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedConsolidationPanels(prev => {
                                      const newSet = new Set(prev);
                                      if (checked) newSet.add(panel.id);
                                      else newSet.delete(panel.id);
                                      return newSet;
                                    });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`checkbox-consolidate-${panel.id}`}
                                />
                              </TableCell>
                            )}
                            {!filterJobId && (
                              <TableCell>
                                <span className="font-mono text-sm">{panel.job.jobNumber}</span>
                              </TableCell>
                            )}
                            <TableCell className="text-sm">{getFactoryName(panel.job.factoryId)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 pl-6">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-medium">{panel.panelMark}</span>
                                {(panelCounts?.[panel.id]?.messageCount || 0) > 0 && (
                                  <Badge className="text-xs gap-0.5 px-1.5 py-0 bg-blue-500 text-white hover:bg-blue-600">
                                    <MessageCircle className="h-3 w-3" />
                                    {panelCounts?.[panel.id]?.messageCount}
                                  </Badge>
                                )}
                                {(panelCounts?.[panel.id]?.documentCount || 0) > 0 && (
                                  <Badge variant="outline" className="text-xs gap-0.5 px-1.5 py-0">
                                    <FileTextIcon className="h-3 w-3" />
                                    {panelCounts?.[panel.id]?.documentCount}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const typeColor = getPanelTypeColor(panel.panelType);
                                return (
                                  <Badge 
                                    variant="outline"
                                    style={typeColor ? { 
                                      backgroundColor: `${typeColor}20`,
                                      borderColor: typeColor,
                                      color: typeColor
                                    } : undefined}
                                  >
                                    {panel.panelType?.replace("_", " ") || "WALL"}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-sm">{panel.building || "-"}</TableCell>
                            <TableCell className="text-sm">{panel.level || "-"}</TableCell>
                            <TableCell className="text-center">{panel.qty || 1}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadWidth)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadHeight)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.panelArea ? `${parseFloat(panel.panelArea).toFixed(2)}` : "-"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.panelVolume ? `${parseFloat(panel.panelVolume).toFixed(2)}` : "-"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{panel.concreteStrengthMpa || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {getSourceLabel(panel.source)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "default" : "secondary"} 
                                className={`text-xs ${panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "bg-green-600" : ""}`}
                              >
                                {panel.documentStatus || "DRAFT"}
                              </Badge>
                            </TableCell>
                            <TableCell>{getLifecycleStatusBadge(panel.lifecycleStatus ?? 0)}</TableCell>
                            <TableCell>{getStatusBadge(panel.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {panel.approvedForProduction ? (
                                  <Badge variant="secondary" className="gap-1 mr-2">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    Approved
                                  </Badge>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); openBuildDialog(panel); }}
                                  title={panel.approvedForProduction ? "Edit production details" : "Set up for production"}
                                  data-testid={`button-build-panel-${panel.id}`}
                                >
                                  <Hammer className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const job = jobs?.find(j => j.id === panel.jobId);
                                    setQrCodePanel({ id: panel.id, panelMark: panel.panelMark, jobNumber: job?.jobNumber });
                                    setQrCodeDialogOpen(true);
                                  }}
                                  title="View QR Code"
                                  data-testid={`button-qr-panel-${panel.id}`}
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); openEditDialog(panel); }}
                                  data-testid={`button-edit-panel-${panel.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); setDeletingPanelId(panel.id); }}
                                  className="text-red-500 hover:text-red-700"
                                  data-testid={`button-delete-panel-${panel.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={consolidationMode ? 17 : 16} className="text-center py-8 text-muted-foreground">
                      No panels found. Add a panel or import from Excel.
                    </TableCell>
                  </TableRow>
                )
              ) : (
                // Flat list view
                <>
                  {filteredPanels?.map((panel) => (
                    <TableRow 
                      key={panel.id} 
                      data-testid={`row-panel-${panel.id}`}
                      style={panel.job.productionSlotColor ? { 
                        backgroundColor: `${panel.job.productionSlotColor}15`,
                        borderLeft: `4px solid ${panel.job.productionSlotColor}` 
                      } : undefined}
                    >
                      {consolidationMode && (
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selectedConsolidationPanels.has(panel.id)}
                            onCheckedChange={(checked) => {
                              setSelectedConsolidationPanels(prev => {
                                const newSet = new Set(prev);
                                if (checked) newSet.add(panel.id);
                                else newSet.delete(panel.id);
                                return newSet;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-consolidate-${panel.id}`}
                          />
                        </TableCell>
                      )}
                      {!filterJobId && (
                        <TableCell>
                          <span className="font-mono text-sm">{panel.job.jobNumber}</span>
                        </TableCell>
                      )}
                      <TableCell className="text-sm">{getFactoryName(panel.job.factoryId)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono font-medium">{panel.panelMark}</span>
                          {(panelCounts?.[panel.id]?.messageCount || 0) > 0 && (
                            <Badge className="text-xs gap-0.5 px-1.5 py-0 bg-blue-500 text-white hover:bg-blue-600">
                              <MessageCircle className="h-3 w-3" />
                              {panelCounts?.[panel.id]?.messageCount}
                            </Badge>
                          )}
                          {(panelCounts?.[panel.id]?.documentCount || 0) > 0 && (
                            <Badge variant="outline" className="text-xs gap-0.5 px-1.5 py-0">
                              <FileTextIcon className="h-3 w-3" />
                              {panelCounts?.[panel.id]?.documentCount}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                                const typeColor = getPanelTypeColor(panel.panelType);
                                return (
                                  <Badge 
                                    variant="outline"
                                    style={typeColor ? { 
                                      backgroundColor: `${typeColor}20`,
                                      borderColor: typeColor,
                                      color: typeColor
                                    } : undefined}
                                  >
                                    {panel.panelType?.replace("_", " ") || "WALL"}
                                  </Badge>
                                );
                              })()}
                      </TableCell>
                      <TableCell className="text-sm">{panel.building || "-"}</TableCell>
                      <TableCell className="text-sm">{panel.level || "-"}</TableCell>
                      <TableCell className="text-center">{panel.qty || 1}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadWidth)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatNumber(panel.loadHeight)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{panel.panelArea ? `${parseFloat(panel.panelArea).toFixed(2)}` : "-"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{panel.panelVolume ? `${parseFloat(panel.panelVolume).toFixed(2)}` : "-"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{panel.concreteStrengthMpa || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getSourceLabel(panel.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "default" : "secondary"} 
                          className={`text-xs ${panel.documentStatus === "IFC" || panel.documentStatus === "APPROVED" ? "bg-green-600" : ""}`}
                        >
                          {panel.documentStatus || "DRAFT"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getLifecycleStatusBadge(panel.lifecycleStatus ?? 0)}</TableCell>
                      <TableCell>{getStatusBadge(panel.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {panel.approvedForProduction ? (
                            <Badge variant="secondary" className="gap-1 mr-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              Approved
                            </Badge>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openBuildDialog(panel)}
                            title={panel.approvedForProduction ? "Edit production details" : "Set up for production"}
                            data-testid={`button-build-panel-${panel.id}`}
                          >
                            <Hammer className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const job = jobs?.find(j => j.id === panel.jobId);
                              setQrCodePanel({ id: panel.id, panelMark: panel.panelMark, jobNumber: job?.jobNumber });
                              setQrCodeDialogOpen(true);
                            }}
                            title="View QR Code"
                            data-testid={`button-qr-panel-${panel.id}`}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(panel)}
                            data-testid={`button-edit-panel-${panel.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingPanelId(panel.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-panel-${panel.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredPanels || filteredPanels.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={filterJobId ? (consolidationMode ? 16 : 15) : (consolidationMode ? 17 : 16)} className="text-center py-8 text-muted-foreground">
                        No panels found. Add a panel or import from Excel.
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
          
          {/* Pagination Controls */}
          {viewMode === "list" && (
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalPanels)} of {totalPanels} panels</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[80px] h-8" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  data-testid="button-first-page"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  data-testid="button-last-page"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
          </>
        )}
        </CardContent>
      </Card>

      <Dialog open={panelDialogOpen} onOpenChange={(open) => {
        setPanelDialogOpen(open);
        if (!open) setPanelDialogTab("details");
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingPanel ? "Edit Panel" : "Create New Panel"}</DialogTitle>
            <DialogDescription>
              {editingPanel ? "Update panel details" : "Add a new panel to the register"}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={panelDialogTab} onValueChange={setPanelDialogTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="details" className="flex items-center gap-2" data-testid="tab-panel-details">
                <ClipboardList className="h-4 w-4" />
                Details
              </TabsTrigger>
              {editingPanel && (
                <>
                  <TabsTrigger value="chat" className="flex items-center gap-2" data-testid="tab-panel-chat">
                    <MessageCircle className="h-4 w-4" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-2" data-testid="tab-panel-documents">
                    <FileIcon className="h-4 w-4" />
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="audit-log" className="flex items-center gap-2" data-testid="tab-audit-log">
                    <History className="h-4 w-4" />
                    Audit Log
                  </TabsTrigger>
                </>
              )}
            </TabsList>
            
            <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
              {/* Import Info Section - only shown for source=3 (Estimate Import) */}
              {editingPanel && editingPanel.source === 3 && (
                <div className="bg-muted/50 rounded-md p-4 space-y-2 border mb-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Import Details</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tab Name:</span>
                      <p className="font-medium">{editingPanel.sourceSheet || editingPanel.sheetNumber || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">File Name:</span>
                      <p className="font-medium">{editingPanel.sourceFileName || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Imported Date:</span>
                      <p className="font-medium">
                        {editingPanel.createdAt 
                          ? new Date(editingPanel.createdAt).toLocaleDateString('en-AU', {
                              day: '2-digit',
                              month: '2-digit', 
                              year: 'numeric'
                            })
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <Form {...panelForm}>
            <form onSubmit={panelForm.handleSubmit(onSubmit)} className="space-y-4">
              {/* Two-column layout for main content */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Panel Info */}
                <div className="space-y-4">
                  <FormField
                    control={panelForm.control}
                    name="jobId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!!filterJobId}>
                          <FormControl>
                            <SelectTrigger data-testid="select-panel-job">
                              <SelectValue placeholder="Select job" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {jobs?.filter(j => isJobVisibleInDropdowns((j as any).jobPhase || "CONTRACTED")).map((job) => (
                              <SelectItem key={job.id} value={job.id}>
                                {job.jobNumber} - {job.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={panelForm.control}
                      name="panelMark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Panel Mark</FormLabel>
                          <FormControl>
                            <Input placeholder="PM-001" {...field} data-testid="input-panel-mark" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={panelForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-panel-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PENDING">Pending Validation</SelectItem>
                              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                              <SelectItem value="COMPLETED">Completed</SelectItem>
                              <SelectItem value="ON_HOLD">On Hold</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={panelForm.control}
                    name="panelType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Panel Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-panel-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {panelTypes && panelTypes.length > 0 ? (
                              panelTypes.map((pt) => (
                                <SelectItem key={pt.id} value={pt.code}>{pt.name}</SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="WALL">Wall</SelectItem>
                                <SelectItem value="COLUMN">Column</SelectItem>
                                <SelectItem value="CUBE_BASE">Cube Base</SelectItem>
                                <SelectItem value="CUBE_RING">Cube Ring</SelectItem>
                                <SelectItem value="LANDING_WALL">Landing Wall</SelectItem>
                                <SelectItem value="OTHER">Other</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={panelForm.control}
                    name="workTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Type</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(parseInt(val))} 
                          value={field.value?.toString() || "1"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-panel-work-type">
                              <SelectValue placeholder="Select work type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {workTypes && workTypes.length > 0 ? (
                              workTypes.map((wt) => (
                                <SelectItem key={wt.id} value={wt.id.toString()}>{wt.name}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="1">General Drafting</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={panelForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="Panel description" {...field} data-testid="input-panel-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={panelForm.control}
                      name="drawingCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Drawing Code</FormLabel>
                          <FormControl>
                            <Input placeholder="DWG-001" {...field} data-testid="input-panel-drawing" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={panelForm.control}
                      name="sheetNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sheet Number</FormLabel>
                          <FormControl>
                            <Input placeholder="A001" {...field} data-testid="input-panel-sheet" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={panelForm.control}
                      name="building"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Building</FormLabel>
                          <FormControl>
                            <Input placeholder="Building A" {...field} data-testid="input-panel-building" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={panelForm.control}
                      name="level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level</FormLabel>
                          <FormControl>
                            <Input placeholder="Level 1" {...field} data-testid="input-panel-level" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={panelForm.control}
                      name="structuralElevation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Struct. Elev.</FormLabel>
                          <FormControl>
                            <Input placeholder="RL 10.500" {...field} data-testid="input-panel-elevation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Right Column - Additional Info & Dimensions */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={panelForm.control}
                      name="reckliDetail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reckli Detail</FormLabel>
                          <FormControl>
                            <Input placeholder="Reckli detail/pattern" {...field} data-testid="input-panel-reckli" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Crane Capacity</label>
                      <Input 
                        value={jobs?.find(j => j.id === panelForm.watch("jobId"))?.craneCapacity || "Not set"} 
                        disabled 
                        className="bg-muted"
                        data-testid="input-panel-crane-capacity"
                      />
                    </div>
                  </div>
                  <FormField
                    control={panelForm.control}
                    name="estimatedHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Hours</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="8"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            data-testid="input-panel-hours"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3">Dimensions & Weight</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={panelForm.control}
                        name="qty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="1"
                                {...field}
                                value={field.value || 1}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 1)}
                                data-testid="input-panel-qty"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={panelForm.control}
                        name="concreteStrengthMpa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Concrete (MPa)</FormLabel>
                            <FormControl>
                              <Input placeholder="50" {...field} data-testid="input-panel-concrete" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <FormField
                        control={panelForm.control}
                        name="loadWidth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Width (mm)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="3000" 
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(e);
                                  const width = parseFloat(e.target.value) || 0;
                                  const height = parseFloat(panelForm.getValues("loadHeight") || "0") || 0;
                                  const thickness = parseFloat(panelForm.getValues("panelThickness") || "0") || 0;
                                  if (width > 0 && height > 0 && thickness > 0) {
                                    const volumeM3 = (width / 1000) * (height / 1000) * (thickness / 1000);
                                    const massKg = volumeM3 * 2500;
                                    panelForm.setValue("panelVolume", volumeM3.toFixed(3));
                                    panelForm.setValue("panelMass", Math.round(massKg).toString());
                                  }
                                }}
                                data-testid="input-panel-width"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={panelForm.control}
                        name="loadHeight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Height (mm)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="2400" 
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(e);
                                  const width = parseFloat(panelForm.getValues("loadWidth") || "0") || 0;
                                  const height = parseFloat(e.target.value) || 0;
                                  const thickness = parseFloat(panelForm.getValues("panelThickness") || "0") || 0;
                                  if (width > 0 && height > 0 && thickness > 0) {
                                    const volumeM3 = (width / 1000) * (height / 1000) * (thickness / 1000);
                                    const massKg = volumeM3 * 2500;
                                    panelForm.setValue("panelVolume", volumeM3.toFixed(3));
                                    panelForm.setValue("panelMass", Math.round(massKg).toString());
                                  }
                                }}
                                data-testid="input-panel-height"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={panelForm.control}
                        name="panelThickness"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Thick (mm)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="200" 
                                {...field} 
                                onChange={(e) => {
                                  field.onChange(e);
                                  const width = parseFloat(panelForm.getValues("loadWidth") || "0") || 0;
                                  const height = parseFloat(panelForm.getValues("loadHeight") || "0") || 0;
                                  const thickness = parseFloat(e.target.value) || 0;
                                  if (width > 0 && height > 0 && thickness > 0) {
                                    const volumeM3 = (width / 1000) * (height / 1000) * (thickness / 1000);
                                    const massKg = volumeM3 * 2500;
                                    panelForm.setValue("panelVolume", volumeM3.toFixed(3));
                                    panelForm.setValue("panelMass", Math.round(massKg).toString());
                                  }
                                }}
                                data-testid="input-panel-thickness"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <FormField
                        control={panelForm.control}
                        name="panelVolume"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Volume (m³)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-muted" 
                                readOnly
                                data-testid="input-panel-volume"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={panelForm.control}
                        name="panelMass"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mass (kg)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-muted" 
                                readOnly
                                data-testid="input-panel-mass"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {editingPanel?.status === "PENDING" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mt-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    This panel is pending validation. Validate it to make it available for drafting work.
                  </p>
                </div>
              )}
              
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setPanelDialogOpen(false)}>
                  Cancel
                </Button>
                {editingPanel?.status === "PENDING" && (
                  <Button
                    type="button"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={validatePanelMutation.isPending}
                    onClick={() => {
                      if (editingPanel) {
                        validatePanelMutation.mutate(editingPanel.id);
                      }
                    }}
                    data-testid="button-validate-panel"
                  >
                    {validatePanelMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Validate Panel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={createPanelMutation.isPending || updatePanelMutation.isPending}
                  data-testid="button-save-panel"
                >
                  {(createPanelMutation.isPending || updatePanelMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingPanel ? "Update" : "Create"}
                </Button>
              </DialogFooter>
              </form>
            </Form>
            </TabsContent>
            
            {editingPanel && (
              <>
                <TabsContent value="chat" className="flex-1 overflow-hidden mt-4">
                  <PanelChatTab panelId={editingPanel.id} panelMark={editingPanel.panelMark} />
                </TabsContent>
                
                <TabsContent value="documents" className="flex-1 overflow-y-auto mt-4">
                  <PanelDocumentsTab panelId={editingPanel.id} productionPdfUrl={editingPanel.productionPdfUrl} />
                </TabsContent>

                <TabsContent value="audit-log" className="flex-1 overflow-y-auto mt-4">
                  <PanelAuditLogTab panelId={editingPanel.id} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Panels from Excel
            </DialogTitle>
            <DialogDescription>
              Review the data before importing. {importData.length} rows found.
              {importData.some(r => r["Job Number"] || r.jobNumber || r.job_number || r["Job"]) 
                ? " Job numbers detected in Excel."
                : " No job numbers in Excel - select a fallback job below."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Fallback Job (used when Excel row has no Job Number)</label>
              <Select value={selectedJobForImport} onValueChange={setSelectedJobForImport}>
                <SelectTrigger className="mt-1" data-testid="select-import-job">
                  <SelectValue placeholder="Select fallback job (optional if job in Excel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No fallback - require job in Excel</SelectItem>
                  {jobs?.filter(j => isJobVisibleInDropdowns((j as any).jobPhase || "CONTRACTED")).map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber} - {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Import Errors Display */}
            {importErrors.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-md">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Import Validation Errors ({importErrors.length})
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1 mb-2">
                  No records were added for rows with invalid job numbers. Ensure the job exists in the system.
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside max-h-24 overflow-auto">
                  {importErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="max-h-[200px] overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Number</TableHead>
                    <TableHead>Panel Mark</TableHead>
                    <TableHead>Panel Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Est. Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.slice(0, 10).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{row["Job Number"] || row.jobNumber || row.job_number || row["Job"] || "-"}</TableCell>
                      <TableCell className="font-mono">{row.panelMark || row["Panel Mark"] || row["Mark"] || "-"}</TableCell>
                      <TableCell>{row.panelType || row["Panel Type"] || row["Type"] || "WALL"}</TableCell>
                      <TableCell>{row.description || row["Description"] || "-"}</TableCell>
                      <TableCell>{row.estimatedHours || row["Estimated Hours"] || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {importData.length > 10 && (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  ... and {importData.length - 10} more rows
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => importPanelsMutation.mutate({ 
                data: importData, 
                jobId: selectedJobForImport === "none" ? undefined : selectedJobForImport 
              })}
              disabled={importPanelsMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importPanelsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              Import {importData.length} Panels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Panel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this panel from the register.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPanelId && deletePanelMutation.mutate(deletingPanelId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deletePanelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete by Source Confirmation Dialog */}
      <AlertDialog open={deleteSourceDialogOpen} onOpenChange={setDeleteSourceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All {sourceToDelete ? getSourceLabel(sourceToDelete) : ""} Panels?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {sourceCounts?.find(s => s.source === sourceToDelete)?.count || 0} panels 
              that were created via {sourceToDelete ? getSourceLabel(sourceToDelete) : ""}.
              This action cannot be undone.
              <br /><br />
              <strong>Note:</strong> Panels with production records or approved for production cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSourceToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sourceToDelete && deleteBySourceMutation.mutate(sourceToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-source"
            >
              {deleteBySourceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Build/Production Approval Dialog */}
      <Dialog open={buildDialogOpen} onOpenChange={(open) => !open && closeBuildDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="h-5 w-5" />
              {buildingPanel?.approvedForProduction ? "Edit Production Details" : "Set Up for Production"}
            </DialogTitle>
            <DialogDescription>
              {buildingPanel && (
                <span>
                  Panel: <strong className="font-mono">{buildingPanel.panelMark}</strong>
                  {buildingPanel.approvedForProduction && (
                    <Badge variant="secondary" className="ml-2 gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Currently Approved
                    </Badge>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* PDF Upload Section */}
            <div className="space-y-2">
              <Label>Production Drawing PDF</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handlePdfDrop}
              >
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{pdfFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPdfFile(null)}
                      data-testid="button-remove-pdf"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop a PDF here, or click to browse
                    </p>
                    <input
                      type="file"
                      ref={pdfInputRef}
                      accept=".pdf"
                      onChange={handlePdfSelect}
                      className="hidden"
                      data-testid="input-pdf-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pdfInputRef.current?.click()}
                      data-testid="button-browse-pdf"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Browse
                    </Button>
                  </div>
                )}
              </div>
              {pdfFile && (
                <Button
                  onClick={analyzePdf}
                  disabled={isAnalyzing}
                  className="w-full"
                  data-testid="button-analyze-pdf"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isAnalyzing ? "Analyzing PDF..." : "Analyze PDF with AI"}
                </Button>
              )}
              {buildFormData.productionPdfUrl && !pdfFile && buildingPanel && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">IFC Document Attached</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    data-testid="button-view-pdf"
                  >
                    <a href={ADMIN_ROUTES.PANEL_DOWNLOAD_PDF(buildingPanel.id)} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      View PDF
                    </a>
                  </Button>
                </div>
              )}
            </div>

            {/* Panel Specifications Form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loadWidth">Load Width (mm) <span className="text-red-500">*</span></Label>
                <Input
                  id="loadWidth"
                  value={buildFormData.loadWidth}
                  onChange={(e) => setBuildFormData({ ...buildFormData, loadWidth: e.target.value })}
                  placeholder="e.g., 3000"
                  data-testid="input-load-width"
                  className={validationErrors.includes("Load Width is required") ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loadHeight">Load Height (mm) <span className="text-red-500">*</span></Label>
                <Input
                  id="loadHeight"
                  value={buildFormData.loadHeight}
                  onChange={(e) => setBuildFormData({ ...buildFormData, loadHeight: e.target.value })}
                  placeholder="e.g., 2500"
                  data-testid="input-load-height"
                  className={validationErrors.includes("Load Height is required") ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panelThickness">Panel Thickness (mm) <span className="text-red-500">*</span></Label>
                <Input
                  id="panelThickness"
                  value={buildFormData.panelThickness}
                  onChange={(e) => setBuildFormData({ ...buildFormData, panelThickness: e.target.value })}
                  placeholder="e.g., 200"
                  data-testid="input-panel-thickness"
                  className={validationErrors.includes("Panel Thickness is required") ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panelArea">Panel Area (m²)</Label>
                <Input
                  id="panelArea"
                  value={buildFormData.panelArea}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-calculated"
                  data-testid="input-panel-area"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panelVolume">Panel Volume (m³)</Label>
                <Input
                  id="panelVolume"
                  value={buildFormData.panelVolume}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-calculated"
                  data-testid="input-panel-volume"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="panelMass">Panel Mass (kg)</Label>
                <Input
                  id="panelMass"
                  value={buildFormData.panelMass}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-calculated"
                  data-testid="input-panel-mass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="concreteStrengthMpa">Concrete Strength f'c (MPa) <span className="text-red-500">*</span></Label>
                <Input
                  id="concreteStrengthMpa"
                  value={buildFormData.concreteStrengthMpa}
                  onChange={(e) => setBuildFormData({ ...buildFormData, concreteStrengthMpa: e.target.value })}
                  placeholder="e.g., 40, 50, 65"
                  data-testid="input-concrete-strength"
                  className={validationErrors.includes("Concrete Strength f'c (MPa) is required") ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liftFcm">Lift f'cm (MPa) <span className="text-red-500">*</span></Label>
                <Input
                  id="liftFcm"
                  value={buildFormData.liftFcm}
                  onChange={(e) => setBuildFormData({ ...buildFormData, liftFcm: e.target.value })}
                  placeholder="e.g., 25"
                  data-testid="input-lift-fcm"
                  className={validationErrors.includes("Lift f'cm is required") ? "border-red-500" : ""}
                />
              </div>
            </div>

            {/* Validation Errors Display */}
            {validationErrors.length > 0 && (
              <div className="border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                <p className="font-medium text-sm text-red-600 dark:text-red-400 mb-2">Please complete all required fields:</p>
                <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rotationalLifters">Rotational Lifters</Label>
                <Input
                  id="rotationalLifters"
                  value={buildFormData.rotationalLifters}
                  onChange={(e) => setBuildFormData({ ...buildFormData, rotationalLifters: e.target.value })}
                  placeholder="e.g., 2x ERH-2.5T"
                  data-testid="input-rotational-lifters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryLifters">Primary Lifters</Label>
                <Input
                  id="primaryLifters"
                  value={buildFormData.primaryLifters}
                  onChange={(e) => setBuildFormData({ ...buildFormData, primaryLifters: e.target.value })}
                  placeholder="e.g., 4x Anchor Point"
                  data-testid="input-primary-lifters"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {buildingPanel?.approvedForProduction && (
              <Button
                variant="destructive"
                onClick={() => buildingPanel && revokeApprovalMutation.mutate(buildingPanel.id)}
                disabled={revokeApprovalMutation.isPending}
                data-testid="button-revoke-approval"
              >
                {revokeApprovalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <XCircle className="h-4 w-4 mr-2" />
                Revoke Approval
              </Button>
            )}
            <Button variant="outline" onClick={closeBuildDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleApproveProduction}
              disabled={approveProductionMutation.isPending}
              data-testid="button-approve-production"
            >
              {approveProductionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {buildingPanel?.approvedForProduction ? "Update & Keep Approved" : "Approve for Production"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Download Confirmation Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Download Panel Import Template
            </DialogTitle>
            <DialogDescription>
              Before downloading the template, please confirm:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Have you loaded jobs into the system?
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                No panels can be added for jobs that do not exist in the system. The template will include a "Jobs Reference" sheet with all current jobs.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Current Jobs in System:</strong> {jobs?.length || 0}</p>
              {jobs && jobs.length > 0 && (
                <ul className="mt-2 list-disc list-inside max-h-32 overflow-auto">
                  {jobs.slice(0, 10).map(j => (
                    <li key={j.id}>{j.jobNumber} - {j.name}</li>
                  ))}
                  {jobs.length > 10 && <li className="text-muted-foreground">...and {jobs.length - 10} more</li>}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={downloadTemplate} disabled={!jobs || jobs.length === 0} data-testid="button-confirm-download-template">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* QR Code Dialog */}
      <Dialog open={qrCodeDialogOpen} onOpenChange={setQrCodeDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-qr-code">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Panel QR Code
            </DialogTitle>
            <DialogDescription>
              Scan this code to view panel details and history
            </DialogDescription>
          </DialogHeader>
          {qrCodePanel && (
            <div className="flex flex-col items-center space-y-4">
              <div className="text-center">
                <p className="font-mono font-bold text-lg">{qrCodePanel.panelMark}</p>
                {qrCodePanel.jobNumber && (
                  <p className="text-sm text-muted-foreground">Job: {qrCodePanel.jobNumber}</p>
                )}
              </div>
              <div 
                ref={qrCodeRef}
                className="bg-white p-4 rounded-lg shadow-sm"
                data-testid="qr-code-container"
              >
                <QRCodeSVG
                  value={`${window.location.origin}/panel/${qrCodePanel.id}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all max-w-[280px]">
                {window.location.origin}/panel/{qrCodePanel.id}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const svg = qrCodeRef.current?.querySelector('svg');
                    if (svg) {
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      const img = document.createElement('img');
                      img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx?.drawImage(img, 0, 0);
                        const pngUrl = canvas.toDataURL('image/png');
                        const downloadLink = document.createElement('a');
                        downloadLink.download = `panel-${qrCodePanel.panelMark}-qr.png`;
                        downloadLink.href = pngUrl;
                        downloadLink.click();
                      };
                      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                    }
                  }}
                  data-testid="button-download-qr"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!qrCodePanel || !qrCodeRef.current) return;
                    const printWindow = window.open('', '_blank', 'width=400,height=500');
                    if (!printWindow) {
                      toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to print the QR code" });
                      return;
                    }
                    const svg = qrCodeRef.current.querySelector('svg');
                    if (svg) {
                      const svgData = new XMLSerializer().serializeToString(svg);
                      printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>QR Code - ${qrCodePanel.panelMark}</title>
                              <style>
                                body { 
                                  display: flex; 
                                  flex-direction: column; 
                                  align-items: center; 
                                  justify-content: center; 
                                  min-height: 100vh; 
                                  margin: 0; 
                                  font-family: system-ui, sans-serif;
                                }
                                .panel-info { 
                                  text-align: center; 
                                  margin-bottom: 20px;
                                }
                                .panel-mark { 
                                  font-size: 24px; 
                                  font-weight: bold; 
                                  font-family: monospace;
                                }
                                .job-number { 
                                  font-size: 14px; 
                                  color: #666; 
                                  margin-top: 4px;
                                }
                                .qr-container { 
                                  padding: 20px; 
                                  background: white; 
                                  border-radius: 8px;
                                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                }
                                @media print {
                                  body { justify-content: flex-start; padding-top: 50px; }
                                  .qr-container { box-shadow: none; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="panel-info">
                                <div class="panel-mark">${qrCodePanel.panelMark}</div>
                                ${qrCodePanel.jobNumber ? `<div class="job-number">Job: ${qrCodePanel.jobNumber}</div>` : ''}
                              </div>
                              <div class="qr-container">${svgData}</div>
                              <script>
                                window.onload = function() {
                                  window.print();
                                  window.onafterprint = function() { window.close(); };
                                };
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                  }}
                  data-testid="button-print-qr"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/panel/${qrCodePanel.id}`, '_blank')}
                  data-testid="button-open-panel-details"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={consolidationDialogOpen} onOpenChange={(open) => { if (!open) { setConsolidationDialogOpen(false); setConsolidationData(null); setConsolidationWarnings(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Consolidate Panels</DialogTitle>
            <DialogDescription>
              Review the consolidated panel details before processing
            </DialogDescription>
          </DialogHeader>
          {consolidationData && (
            <div className="space-y-4">
              <div className="rounded-md border p-4 bg-muted/20">
                <h4 className="font-medium mb-2">Panels Being Consolidated</h4>
                <div className="space-y-1">
                  {consolidationData.panels.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm" data-testid={`consolidation-panel-${p.id}`}>
                      <span className="font-mono">{p.panelMark}</span>
                      <span className="text-muted-foreground">
                        {p.loadWidth || "?"} x {p.loadHeight || "?"} mm
                        {p.id === consolidationData.primaryPanelId && (
                          <Badge variant="outline" className="ml-2 text-xs">Primary</Badge>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Panel Mark</Label>
                  <Input
                    value={consolidationData.newPanelMark}
                    onChange={(e) => setConsolidationData(prev => prev ? { ...prev, newPanelMark: e.target.value } : null)}
                    data-testid="input-consolidation-panel-mark"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Input
                    value={consolidationData.panels.find(p => p.id === consolidationData.primaryPanelId)?.level || ""}
                    disabled
                    data-testid="input-consolidation-level"
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Width (mm)</Label>
                  <Input
                    value={consolidationData.newWidth}
                    onChange={(e) => setConsolidationData(prev => prev ? { ...prev, newWidth: e.target.value } : null)}
                    data-testid="input-consolidation-width"
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Height (mm)</Label>
                  <Input
                    value={consolidationData.newHeight}
                    onChange={(e) => setConsolidationData(prev => prev ? { ...prev, newHeight: e.target.value } : null)}
                    data-testid="input-consolidation-height"
                  />
                </div>
              </div>

              {consolidationCheckLoading && (
                <div className="rounded-md border p-3 bg-muted/20 text-sm text-muted-foreground">
                  Checking for existing records...
                </div>
              )}

              {consolidationWarnings && (() => {
                const panelsWithRecords = Object.entries(consolidationWarnings).filter(
                  ([, w]) => w.draftingLogs > 0 || w.timerSessions > 0 || w.loadListEntries > 0
                );
                if (panelsWithRecords.length === 0) return null;
                return (
                  <div className="rounded-md border border-red-500/50 p-3 bg-red-500/10 text-sm" data-testid="consolidation-warnings">
                    <p className="font-medium text-red-600 dark:text-red-400">
                      Warning: The following panels have existing records that will be affected:
                    </p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {panelsWithRecords.map(([id, w]) => (
                        <li key={id} className="flex flex-col">
                          <span className="font-mono font-medium">{w.panelMark}</span>
                          <span className="pl-4">
                            {w.draftingLogs > 0 && <span className="mr-3">{w.draftingLogs} drafting log{w.draftingLogs !== 1 ? "s" : ""}</span>}
                            {w.timerSessions > 0 && <span className="mr-3">{w.timerSessions} timer session{w.timerSessions !== 1 ? "s" : ""}</span>}
                            {w.loadListEntries > 0 && <span>{w.loadListEntries} load list entr{w.loadListEntries !== 1 ? "ies" : "y"}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                      Consumed panels will be retired. Their existing records will remain but the panels will be hidden from selection dropdowns.
                    </p>
                  </div>
                );
              })()}

              <div className="rounded-md border border-amber-500/50 p-3 bg-amber-500/10 text-sm">
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  The following panels will be retired from the register:
                </p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {consolidationData.panels
                    .filter(p => p.id !== consolidationData.primaryPanelId)
                    .map(p => (
                      <li key={p.id}>{p.panelMark} ({p.loadWidth} x {p.loadHeight}mm)</li>
                    ))}
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setConsolidationDialogOpen(false); setConsolidationData(null); }} data-testid="button-cancel-consolidation">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!consolidationData) return;
                    consolidateMutation.mutate({
                      panelIds: consolidationData.panels.map(p => p.id),
                      primaryPanelId: consolidationData.primaryPanelId,
                      newPanelMark: consolidationData.newPanelMark,
                      newLoadWidth: consolidationData.newWidth,
                      newLoadHeight: consolidationData.newHeight,
                    });
                  }}
                  disabled={consolidateMutation.isPending || consolidationCheckLoading}
                  data-testid="button-process-consolidation"
                >
                  {consolidateMutation.isPending ? "Processing..." : consolidationCheckLoading ? "Checking Records..." : "Process Consolidation"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
