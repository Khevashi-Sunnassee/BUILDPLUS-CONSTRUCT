import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Send,
  FileText,
  History,
  Plus,
  Trash2,
  Edit2,
  Mail,
  Phone,
  MessageCircle,
  Users,
  Radio,
  Loader2,
  X,
  Eye,
  Building2,
  Truck,
  HardHat,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import type { BroadcastTemplate, BroadcastMessage, BroadcastMessageWithDetails, BroadcastDelivery } from "@shared/schema";
import type { User } from "@shared/schema";
import { BROADCAST_ROUTES, USER_ROUTES } from "@shared/api-routes";
import { PageHelpButton } from "@/components/help/page-help-button";

type ChannelStatus = { sms: boolean; whatsapp: boolean; email: boolean };
type CustomContact = { name: string; phone: string; email: string };
type BroadcastRecipient = { id: string; name: string; email: string | null; phone: string | null; type: string };
type BroadcastRecipientsData = { customers: BroadcastRecipient[]; suppliers: BroadcastRecipient[]; employees: BroadcastRecipient[] };

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "PENDING":
      return "outline";
    case "SENDING":
      return "secondary";
    case "COMPLETED":
      return "default";
    case "FAILED":
      return "destructive";
    default:
      return "outline";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
    case "SENDING":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "COMPLETED":
      return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
    case "FAILED":
      return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    case "SENT":
      return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
    default:
      return "";
  }
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case "SMS":
      return <Phone className="h-3 w-3" />;
    case "WHATSAPP":
      return <MessageCircle className="h-3 w-3" />;
    case "EMAIL":
      return <Mail className="h-3 w-3" />;
    default:
      return null;
  }
}

function formatRecipientType(type: string) {
  switch (type) {
    case "ALL_USERS":
      return "All Users";
    case "SPECIFIC_USERS":
      return "Specific Users";
    case "SPECIFIC_CUSTOMERS":
      return "Customers";
    case "SPECIFIC_SUPPLIERS":
      return "Suppliers";
    case "SPECIFIC_EMPLOYEES":
      return "Employees";
    case "CUSTOM_CONTACTS":
      return "Custom Contacts";
    default:
      return type;
  }
}

function SendMessageTab({
  onSent,
}: {
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [recipientType, setRecipientType] = useState<string>("ALL_USERS");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [customContacts, setCustomContacts] = useState<CustomContact[]>([
    { name: "", phone: "", email: "" },
  ]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { data: channelStatus } = useQuery<ChannelStatus>({
    queryKey: [BROADCAST_ROUTES.CHANNELS_STATUS],
  });

  const { data: templates = [] } = useQuery<BroadcastTemplate[]>({
    queryKey: [BROADCAST_ROUTES.TEMPLATES],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: [USER_ROUTES.LIST],
  });

  const { data: recipientsData } = useQuery<BroadcastRecipientsData>({
    queryKey: [BROADCAST_ROUTES.RECIPIENTS],
  });

  const activeTemplates = templates.filter((t) => t.isActive);
  const activeUsers = users.filter((u: User) => u.isActive);

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
      if (recipientType === "SPECIFIC_USERS") {
        payload.recipientIds = selectedUserIds;
      }
      if (recipientType === "SPECIFIC_CUSTOMERS") {
        payload.recipientIds = selectedCustomerIds;
      }
      if (recipientType === "SPECIFIC_SUPPLIERS") {
        payload.recipientIds = selectedSupplierIds;
      }
      if (recipientType === "SPECIFIC_EMPLOYEES") {
        payload.recipientIds = selectedEmployeeIds;
      }
      if (recipientType === "CUSTOM_CONTACTS") {
        payload.customRecipients = customContacts.filter(
          (c) => c.name || c.phone || c.email
        );
      }
      return apiRequest("POST", BROADCAST_ROUTES.SEND, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BROADCAST_ROUTES.MESSAGES] });
      toast({
        title: "Broadcast Sent",
        description: "Your broadcast message has been queued for delivery.",
      });
      setSubject("");
      setMessage("");
      setSelectedTemplateId("");
      setSelectedChannels([]);
      setRecipientType("ALL_USERS");
      setSelectedUserIds([]);
      setSelectedCustomerIds([]);
      setSelectedSupplierIds([]);
      setSelectedEmployeeIds([]);
      setCustomContacts([{ name: "", phone: "", email: "" }]);
      onSent();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "none") {
      setSelectedTemplateId("");
      return;
    }
    const template = activeTemplates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject || "");
      setMessage(template.message || "");
      if (template.defaultChannels && template.defaultChannels.length > 0) {
        setSelectedChannels(template.defaultChannels);
      }
    }
  };

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
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

  const canSend =
    message.trim() &&
    selectedChannels.length > 0 &&
    (recipientType === "ALL_USERS" ||
      (recipientType === "SPECIFIC_USERS" && selectedUserIds.length > 0) ||
      (recipientType === "SPECIFIC_CUSTOMERS" && selectedCustomerIds.length > 0) ||
      (recipientType === "SPECIFIC_SUPPLIERS" && selectedSupplierIds.length > 0) ||
      (recipientType === "SPECIFIC_EMPLOYEES" && selectedEmployeeIds.length > 0) ||
      (recipientType === "CUSTOM_CONTACTS" &&
        customContacts.some((c) => c.name || c.phone || c.email)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Compose Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Template (optional)</Label>
            <Select
              value={selectedTemplateId || "none"}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger data-testid="select-template">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template</SelectItem>
                {activeTemplates.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="broadcast-subject">Subject</Label>
            <Input
              id="broadcast-subject"
              data-testid="input-broadcast-subject"
              placeholder="Message subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="broadcast-message">Message</Label>
            <Textarea
              id="broadcast-message"
              data-testid="input-broadcast-message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-4">
              {(["SMS", "EMAIL"] as const).map((channel) => {
                const available = channelStatus
                  ? channelStatus[channel.toLowerCase() as keyof ChannelStatus]
                  : false;
                return (
                  <div key={channel} className="flex items-center gap-2">
                    <Checkbox
                      id={`channel-${channel}`}
                      data-testid={`checkbox-channel-${channel.toLowerCase()}`}
                      checked={selectedChannels.includes(channel)}
                      onCheckedChange={() => toggleChannel(channel)}
                      disabled={!available}
                    />
                    <Label
                      htmlFor={`channel-${channel}`}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      {getChannelIcon(channel)}
                      {channel}
                    </Label>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        available
                          ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
                          : "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                      }`}
                    >
                      {available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Recipients</Label>
            <RadioGroup
              value={recipientType}
              onValueChange={(val) => {
                setRecipientType(val);
                setSelectedUserIds([]);
                setSelectedCustomerIds([]);
                setSelectedSupplierIds([]);
                setSelectedEmployeeIds([]);
              }}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="ALL_USERS"
                  id="recipient-all"
                  data-testid="radio-recipient-all"
                />
                <Label htmlFor="recipient-all" className="cursor-pointer flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  All Users
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="SPECIFIC_USERS"
                  id="recipient-specific"
                  data-testid="radio-recipient-specific"
                />
                <Label htmlFor="recipient-specific" className="cursor-pointer">
                  Specific Users
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="SPECIFIC_CUSTOMERS"
                  id="recipient-customers"
                  data-testid="radio-recipient-customers"
                />
                <Label htmlFor="recipient-customers" className="cursor-pointer flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Customers
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="SPECIFIC_SUPPLIERS"
                  id="recipient-suppliers"
                  data-testid="radio-recipient-suppliers"
                />
                <Label htmlFor="recipient-suppliers" className="cursor-pointer flex items-center gap-1.5">
                  <Truck className="h-4 w-4" />
                  Suppliers
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="SPECIFIC_EMPLOYEES"
                  id="recipient-employees"
                  data-testid="radio-recipient-employees"
                />
                <Label htmlFor="recipient-employees" className="cursor-pointer flex items-center gap-1.5">
                  <HardHat className="h-4 w-4" />
                  Employees
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="CUSTOM_CONTACTS"
                  id="recipient-custom"
                  data-testid="radio-recipient-custom"
                />
                <Label htmlFor="recipient-custom" className="cursor-pointer">
                  Custom Contacts
                </Label>
              </div>
            </RadioGroup>

            {recipientType === "SPECIFIC_USERS" && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {activeUsers.length === 0 && (
                      <p className="text-muted-foreground text-sm">No users found.</p>
                    )}
                    {activeUsers.map((user: User) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={`user-${user.id}`}
                          data-testid={`checkbox-user-${user.id}`}
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        />
                        <Label
                          htmlFor={`user-${user.id}`}
                          className="cursor-pointer text-sm"
                        >
                          {user.name || user.email}
                          {user.name && (
                            <span className="text-muted-foreground ml-1">
                              ({user.email})
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedUserIds.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedUserIds.length} user(s) selected
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {recipientType === "SPECIFIC_CUSTOMERS" && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {(!recipientsData?.customers || recipientsData.customers.length === 0) && (
                      <p className="text-muted-foreground text-sm">No customers with contact details found.</p>
                    )}
                    {recipientsData?.customers?.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`customer-${c.id}`}
                          data-testid={`checkbox-customer-${c.id}`}
                          checked={selectedCustomerIds.includes(c.id)}
                          onCheckedChange={() =>
                            setSelectedCustomerIds((prev) =>
                              prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }
                        />
                        <Label htmlFor={`customer-${c.id}`} className="cursor-pointer text-sm">
                          {c.name}
                          <span className="text-muted-foreground ml-1">
                            {c.email && c.phone ? `(${c.email}, ${c.phone})` : c.email ? `(${c.email})` : `(${c.phone})`}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedCustomerIds.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedCustomerIds.length} customer(s) selected
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {recipientType === "SPECIFIC_SUPPLIERS" && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {(!recipientsData?.suppliers || recipientsData.suppliers.length === 0) && (
                      <p className="text-muted-foreground text-sm">No suppliers with contact details found.</p>
                    )}
                    {recipientsData?.suppliers?.map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`supplier-${s.id}`}
                          data-testid={`checkbox-supplier-${s.id}`}
                          checked={selectedSupplierIds.includes(s.id)}
                          onCheckedChange={() =>
                            setSelectedSupplierIds((prev) =>
                              prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                            )
                          }
                        />
                        <Label htmlFor={`supplier-${s.id}`} className="cursor-pointer text-sm">
                          {s.name}
                          <span className="text-muted-foreground ml-1">
                            {s.email && s.phone ? `(${s.email}, ${s.phone})` : s.email ? `(${s.email})` : `(${s.phone})`}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedSupplierIds.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedSupplierIds.length} supplier(s) selected
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {recipientType === "SPECIFIC_EMPLOYEES" && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {(!recipientsData?.employees || recipientsData.employees.length === 0) && (
                      <p className="text-muted-foreground text-sm">No employees with contact details found.</p>
                    )}
                    {recipientsData?.employees?.map((e) => (
                      <div key={e.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`employee-${e.id}`}
                          data-testid={`checkbox-employee-${e.id}`}
                          checked={selectedEmployeeIds.includes(e.id)}
                          onCheckedChange={() =>
                            setSelectedEmployeeIds((prev) =>
                              prev.includes(e.id) ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                            )
                          }
                        />
                        <Label htmlFor={`employee-${e.id}`} className="cursor-pointer text-sm">
                          {e.name}
                          <span className="text-muted-foreground ml-1">
                            {e.email && e.phone ? `(${e.email}, ${e.phone})` : e.email ? `(${e.email})` : `(${e.phone})`}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedEmployeeIds.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedEmployeeIds.length} employee(s) selected
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {recipientType === "CUSTOM_CONTACTS" && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  {customContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <div className="flex-1 min-w-[120px] space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          data-testid={`input-contact-name-${index}`}
                          placeholder="Name"
                          value={contact.name}
                          onChange={(e) =>
                            updateCustomContact(index, "name", e.target.value)
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-[120px] space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input
                          data-testid={`input-contact-phone-${index}`}
                          placeholder="Phone"
                          value={contact.phone}
                          onChange={(e) =>
                            updateCustomContact(index, "phone", e.target.value)
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-[120px] space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input
                          data-testid={`input-contact-email-${index}`}
                          placeholder="Email"
                          value={contact.email}
                          onChange={(e) =>
                            updateCustomContact(index, "email", e.target.value)
                          }
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-remove-contact-${index}`}
                        onClick={() => removeCustomContact(index)}
                        disabled={customContacts.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-add-contact"
                    onClick={addCustomContact}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Contact
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              data-testid="button-send-broadcast"
              disabled={!canSend || sendMutation.isPending}
              onClick={() => setConfirmDialogOpen(true)}
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Broadcast
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Broadcast</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send this broadcast message? This action
              cannot be undone. The message will be sent via{" "}
              {selectedChannels.join(", ")} to{" "}
              {recipientType === "ALL_USERS"
                ? "all users"
                : recipientType === "SPECIFIC_USERS"
                ? `${selectedUserIds.length} selected user(s)`
                : recipientType === "SPECIFIC_CUSTOMERS"
                ? `${selectedCustomerIds.length} selected customer(s)`
                : recipientType === "SPECIFIC_SUPPLIERS"
                ? `${selectedSupplierIds.length} selected supplier(s)`
                : recipientType === "SPECIFIC_EMPLOYEES"
                ? `${selectedEmployeeIds.length} selected employee(s)`
                : `${customContacts.filter((c) => c.name || c.phone || c.email).length} custom contact(s)`}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-send">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-send"
              onClick={() => {
                setConfirmDialogOpen(false);
                sendMutation.mutate();
              }}
            >
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplatesTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BroadcastTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formChannels, setFormChannels] = useState<string[]>([]);

  const { data: templates = [], isLoading } = useQuery<BroadcastTemplate[]>({
    queryKey: [BROADCAST_ROUTES.TEMPLATES],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formName,
        category: formCategory || undefined,
        subject: formSubject || undefined,
        message: formMessage,
        defaultChannels: formChannels.length > 0 ? formChannels : undefined,
      };
      if (editingTemplate) {
        return apiRequest(
          "PATCH",
          BROADCAST_ROUTES.TEMPLATE_BY_ID(editingTemplate.id),
          payload
        );
      }
      return apiRequest("POST", BROADCAST_ROUTES.TEMPLATES, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BROADCAST_ROUTES.TEMPLATES] });
      toast({
        title: editingTemplate ? "Template Updated" : "Template Created",
        description: `Template has been ${editingTemplate ? "updated" : "created"} successfully.`,
      });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", BROADCAST_ROUTES.TEMPLATE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BROADCAST_ROUTES.TEMPLATES] });
      toast({
        title: "Template Deleted",
        description: "Template has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormCategory("");
    setFormSubject("");
    setFormMessage("");
    setFormChannels([]);
    setDialogOpen(true);
  };

  const openEditDialog = (template: BroadcastTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormCategory(template.category || "");
    setFormSubject(template.subject || "");
    setFormMessage(template.message);
    setFormChannels(template.defaultChannels || []);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const toggleFormChannel = (channel: string) => {
    setFormChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button data-testid="button-create-template" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg font-medium">
              No templates yet
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              Create your first broadcast template to get started.
            </p>
            <Button
              className="mt-4"
              data-testid="button-create-first-template"
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} data-testid={`card-template-${template.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">
                    {template.name}
                  </CardTitle>
                  {template.category && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {template.category}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid={`button-edit-template-${template.id}`}
                    onClick={() => openEditDialog(template)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid={`button-delete-template-${template.id}`}
                    onClick={() => {
                      setDeletingId(template.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {template.subject && (
                  <p className="text-sm font-medium mb-1 truncate">
                    {template.subject}
                  </p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.message}
                </p>
                {template.defaultChannels &&
                  template.defaultChannels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {template.defaultChannels.map((ch) => (
                        <Badge
                          key={ch}
                          variant="secondary"
                          className="text-xs"
                        >
                          {getChannelIcon(ch)}
                          <span className="ml-1">{ch}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                {!template.isActive && (
                  <Badge variant="outline" className="mt-2 text-xs bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                    Inactive
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the template details below."
                : "Fill in the details to create a new broadcast template."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                data-testid="input-template-name"
                placeholder="Template name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-category">Category (optional)</Label>
              <Input
                id="template-category"
                data-testid="input-template-category"
                placeholder="e.g. Announcements, Reminders"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                data-testid="input-template-subject"
                placeholder="Message subject"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-message">Message</Label>
              <Textarea
                id="template-message"
                data-testid="input-template-message"
                placeholder="Type your template message..."
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Default Channels</Label>
              <div className="flex flex-wrap gap-4">
                {(["SMS", "EMAIL"] as const).map((channel) => (
                  <div key={channel} className="flex items-center gap-2">
                    <Checkbox
                      id={`tpl-channel-${channel}`}
                      data-testid={`checkbox-template-channel-${channel.toLowerCase()}`}
                      checked={formChannels.includes(channel)}
                      onCheckedChange={() => toggleFormChannel(channel)}
                    />
                    <Label
                      htmlFor={`tpl-channel-${channel}`}
                      className="cursor-pointer flex items-center gap-1.5"
                    >
                      {getChannelIcon(channel)}
                      {channel}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              data-testid="button-cancel-template"
              onClick={closeDialog}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-save-template"
              disabled={!formName.trim() || !formMessage.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-template">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-template"
              onClick={() => {
                if (deletingId) {
                  deleteMutation.mutate(deletingId);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HistoryTab() {
  const { toast } = useToast();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [resendingDeliveryId, setResendingDeliveryId] = useState<string | null>(null);

  const { data: broadcasts = [], isLoading } = useQuery<BroadcastMessageWithDetails[]>({
    queryKey: [BROADCAST_ROUTES.MESSAGES],
  });

  const { data: deliveries = [] } = useQuery<BroadcastDelivery[]>({
    queryKey: [BROADCAST_ROUTES.MESSAGES, selectedBroadcastId, "deliveries"],
    queryFn: async () => {
      if (!selectedBroadcastId) return [];
      const res = await fetch(BROADCAST_ROUTES.DELIVERIES(selectedBroadcastId), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load deliveries");
      return res.json();
    },
    enabled: !!selectedBroadcastId,
  });

  const resendMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      setResendingDeliveryId(deliveryId);
      return apiRequest("POST", BROADCAST_ROUTES.RESEND_DELIVERY(deliveryId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BROADCAST_ROUTES.MESSAGES, selectedBroadcastId, "deliveries"] });
      queryClient.invalidateQueries({ queryKey: [BROADCAST_ROUTES.MESSAGES] });
      toast({
        title: "Resent Successfully",
        description: "The message has been resent.",
      });
      setResendingDeliveryId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Resend Failed",
        description: error.message,
        variant: "destructive",
      });
      setResendingDeliveryId(null);
    },
  });

  const selectedBroadcast = broadcasts.find((b) => b.id === selectedBroadcastId);

  const openDetail = (broadcastId: string) => {
    setSelectedBroadcastId(broadcastId);
    setDetailDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Radio className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg font-medium">
            No broadcasts sent yet
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Send your first broadcast message to see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent / Failed</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((broadcast) => (
                <TableRow
                  key={broadcast.id}
                  data-testid={`row-broadcast-${broadcast.id}`}
                >
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(broadcast.createdAt).toLocaleDateString()}{" "}
                    <span className="text-muted-foreground">
                      {new Date(broadcast.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {broadcast.subject || "(No subject)"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {broadcast.channels.map((ch) => (
                        <Badge
                          key={ch}
                          variant="secondary"
                          className="text-xs"
                        >
                          {getChannelIcon(ch)}
                          <span className="ml-1">{ch}</span>
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatRecipientType(broadcast.recipientType)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getStatusColor(broadcast.status)}`}
                      data-testid={`badge-status-${broadcast.id}`}
                    >
                      {broadcast.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    <span className="text-green-600 dark:text-green-400">
                      {broadcast.sentCount}
                    </span>
                    {" / "}
                    <span className="text-red-600 dark:text-red-400">
                      {broadcast.failedCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-view-broadcast-${broadcast.id}`}
                      onClick={() => openDetail(broadcast.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Broadcast Details</DialogTitle>
            <DialogDescription>
              {selectedBroadcast?.subject || "Broadcast message"} -{" "}
              {selectedBroadcast &&
                new Date(selectedBroadcast.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedBroadcast && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${getStatusColor(selectedBroadcast.status)}`}
                  >
                    {selectedBroadcast.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipients: </span>
                  {formatRecipientType(selectedBroadcast.recipientType)} (
                  {selectedBroadcast.totalRecipients})
                </div>
                <div>
                  <span className="text-muted-foreground">Sent: </span>
                  <span className="text-green-600 dark:text-green-400">
                    {selectedBroadcast.sentCount}
                  </span>
                  {" / "}
                  <span className="text-muted-foreground">Failed: </span>
                  <span className="text-red-600 dark:text-red-400">
                    {selectedBroadcast.failedCount}
                  </span>
                </div>
              </div>
              <div className="rounded-md border p-3 text-sm">
                <p className="text-muted-foreground text-xs mb-1">Message</p>
                <p className="whitespace-pre-wrap">{selectedBroadcast.message}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">
                  Deliveries ({deliveries.length})
                </p>
                {deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No delivery records found.
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveries.map((delivery) => (
                          <TableRow
                            key={delivery.id}
                            data-testid={`row-delivery-${delivery.id}`}
                          >
                            <TableCell className="text-sm">
                              <div>
                                {delivery.recipientName || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {delivery.recipientPhone || delivery.recipientEmail}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {getChannelIcon(delivery.channel)}
                                <span className="ml-1">{delivery.channel}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${getStatusColor(delivery.status)}`}
                              >
                                {delivery.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {delivery.errorMessage || "-"}
                            </TableCell>
                            <TableCell>
                              {delivery.status === "FAILED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid={`button-resend-${delivery.id}`}
                                  disabled={resendMutation.isPending && resendingDeliveryId === delivery.id}
                                  onClick={() => resendMutation.mutate(delivery.id)}
                                >
                                  {resendMutation.isPending && resendingDeliveryId === delivery.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Send className="h-3 w-3 mr-1" />
                                  )}
                                  Resend
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              data-testid="button-close-detail"
              onClick={() => setDetailDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BroadcastPage() {
  const [activeTab, setActiveTab] = useState("send");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Broadcast Messaging</h1>
            <PageHelpButton pageHelpKey="page.broadcast" />
          </div>
          <p className="text-muted-foreground text-sm">Send messages to users via SMS and Email</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="broadcast-tabs">
          <TabsTrigger value="send" data-testid="tab-send">
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>
        <TabsContent value="send" className="mt-4">
          <SendMessageTab onSent={() => setActiveTab("history")} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}