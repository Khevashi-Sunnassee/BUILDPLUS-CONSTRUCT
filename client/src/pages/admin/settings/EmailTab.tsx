import { lazy, Suspense, useState } from "react";
import { Save, Loader2, Mail, FileText, Pencil, RefreshCw, Plus, Trash2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, type UseMutationResult } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CompanyEmailInbox } from "@shared/schema";
const ReactQuill = lazy(() => import("react-quill-new"));

export interface EmailTabProps {
  inboxApEmail: string;
  setInboxApEmail: (v: string) => void;
  inboxTenderEmail: string;
  setInboxTenderEmail: (v: string) => void;
  inboxDraftingEmail: string;
  setInboxDraftingEmail: (v: string) => void;
  inboxEmailsLoading: boolean;
  saveInboxEmailsMutation: UseMutationResult<any, any, { apInboxEmail?: string | null; tenderInboxEmail?: string | null; draftingInboxEmail?: string | null }, any>;
  emailTemplateData: { emailTemplateHtml: string | null; defaultTemplate: string } | undefined;
  emailTemplateLoading: boolean;
  emailTemplatePreviewMutation: UseMutationResult<any, any, void, any>;
  emailTemplatePreviewHtml: string | null;
  showEditTemplateDialog: boolean;
  setShowEditTemplateDialog: (v: boolean) => void;
  editTemplateValue: string;
  setEditTemplateValue: (v: string) => void;
  templateEditMode: "visual" | "source";
  setTemplateEditMode: (v: "visual" | "source") => void;
  saveEmailTemplateMutation: UseMutationResult<any, any, string | null, any>;
  resetEmailTemplateMutation: UseMutationResult<any, any, void, any>;
}

export function EmailTab({
  inboxApEmail,
  setInboxApEmail,
  inboxTenderEmail,
  setInboxTenderEmail,
  inboxDraftingEmail,
  setInboxDraftingEmail,
  inboxEmailsLoading,
  saveInboxEmailsMutation,
  emailTemplateData,
  emailTemplateLoading,
  emailTemplatePreviewMutation,
  emailTemplatePreviewHtml,
  showEditTemplateDialog,
  setShowEditTemplateDialog,
  editTemplateValue,
  setEditTemplateValue,
  templateEditMode,
  setTemplateEditMode,
  saveEmailTemplateMutation,
  resetEmailTemplateMutation,
}: EmailTabProps) {
  return (
    <>
      <TabsContent value="email" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Inbox Addresses
            </CardTitle>
            <CardDescription>
              Configure unique email addresses for each inbox type. These addresses determine which company receives incoming emails. Each address must be unique across all companies and inbox types.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inboxEmailsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="ap-inbox-email" data-testid="label-ap-inbox-email">AP Invoice Inbox</Label>
                    <Input
                      id="ap-inbox-email"
                      type="email"
                      placeholder="e.g. invoices@yourcompany.resend.app"
                      value={inboxApEmail}
                      onChange={(e) => setInboxApEmail(e.target.value)}
                      data-testid="input-ap-inbox-email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tender-inbox-email" data-testid="label-tender-inbox-email">Tender Inbox</Label>
                    <Input
                      id="tender-inbox-email"
                      type="email"
                      placeholder="e.g. tenders@yourcompany.resend.app"
                      value={inboxTenderEmail}
                      onChange={(e) => setInboxTenderEmail(e.target.value)}
                      data-testid="input-tender-inbox-email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="drafting-inbox-email" data-testid="label-drafting-inbox-email">Drafting Inbox</Label>
                    <Input
                      id="drafting-inbox-email"
                      type="email"
                      placeholder="e.g. drafting@yourcompany.resend.app"
                      value={inboxDraftingEmail}
                      onChange={(e) => setInboxDraftingEmail(e.target.value)}
                      data-testid="input-drafting-inbox-email"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => saveInboxEmailsMutation.mutate({
                    apInboxEmail: inboxApEmail.trim() || null,
                    tenderInboxEmail: inboxTenderEmail.trim() || null,
                    draftingInboxEmail: inboxDraftingEmail.trim() || null,
                  })}
                  disabled={saveInboxEmailsMutation.isPending}
                  data-testid="button-save-inbox-emails"
                >
                  {saveInboxEmailsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Inbox Emails
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Notification Template
            </CardTitle>
            <CardDescription>
              Configure the email template used for all system notifications. Available placeholders: {"{{TITLE}}"}, {"{{SUBTITLE}}"}, {"{{LOGO}}"}, {"{{GREETING}}"}, {"{{BODY}}"}, {"{{ATTACHMENT_SUMMARY}}"}, {"{{COMPANY_NAME}}"}, {"{{FOOTER_NOTE}}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailTemplateLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => emailTemplatePreviewMutation.mutate()}
                    disabled={emailTemplatePreviewMutation.isPending}
                    data-testid="button-preview-email-template"
                  >
                    {emailTemplatePreviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditTemplateValue(emailTemplateData?.emailTemplateHtml || emailTemplateData?.defaultTemplate || "");
                      setShowEditTemplateDialog(true);
                    }}
                    data-testid="button-edit-email-template"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Template
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => resetEmailTemplateMutation.mutate()}
                    disabled={resetEmailTemplateMutation.isPending}
                    data-testid="button-reset-email-template"
                  >
                    {resetEmailTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reset to Default
                  </Button>
                </div>

                {emailTemplateData?.emailTemplateHtml && (
                  <Badge variant="secondary" data-testid="badge-custom-template">Custom template active</Badge>
                )}

                {emailTemplatePreviewHtml && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <iframe
                      srcDoc={emailTemplatePreviewHtml}
                      className="w-full border rounded-md"
                      style={{ height: "500px" }}
                      title="Email Template Preview"
                      data-testid="iframe-email-template-preview"
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <OutgoingInboxesCard />
      </TabsContent>

      <Dialog open={showEditTemplateDialog} onOpenChange={setShowEditTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>
              Edit the email notification template. Use placeholders like {"{{TITLE}}"}, {"{{BODY}}"}, {"{{GREETING}}"}, {"{{COMPANY_NAME}}"} for dynamic content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-2">
            <Button
              variant={templateEditMode === "visual" ? "default" : "outline"}
              size="sm"
              onClick={() => setTemplateEditMode("visual")}
              data-testid="button-template-mode-visual"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Visual Editor
            </Button>
            <Button
              variant={templateEditMode === "source" ? "default" : "outline"}
              size="sm"
              onClick={() => setTemplateEditMode("source")}
              data-testid="button-template-mode-source"
            >
              <FileText className="h-3 w-3 mr-1" />
              HTML Source
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {templateEditMode === "visual" ? (
              <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <div className="border rounded-md" data-testid="editor-email-template-visual">
                  <ReactQuill
                    theme="snow"
                    value={editTemplateValue}
                    onChange={setEditTemplateValue}
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'align': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link'],
                        ['clean'],
                      ],
                    }}
                    style={{ minHeight: '400px' }}
                  />
                </div>
              </Suspense>
            ) : (
              <Textarea
                value={editTemplateValue}
                onChange={(e) => setEditTemplateValue(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
                data-testid="textarea-email-template"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditTemplateDialog(false)}
              data-testid="button-cancel-email-template"
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveEmailTemplateMutation.mutate(editTemplateValue)}
              disabled={saveEmailTemplateMutation.isPending}
              data-testid="button-save-email-template"
            >
              {saveEmailTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const INBOX_TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "DRAFTING", label: "Drafting" },
  { value: "TENDER", label: "Tender" },
  { value: "AP_INVOICES", label: "AP Invoices" },
];

function OutgoingInboxesCard() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingInbox, setEditingInbox] = useState<CompanyEmailInbox | null>(null);
  const [formEmail, setFormEmail] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formReplyTo, setFormReplyTo] = useState("");
  const [formType, setFormType] = useState("GENERAL");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  const { data: inboxes = [], isLoading } = useQuery<CompanyEmailInbox[]>({
    queryKey: ["/api/company-email-inboxes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/company-email-inboxes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-email-inboxes"] });
      toast({ title: "Inbox created" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/company-email-inboxes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-email-inboxes"] });
      toast({ title: "Inbox updated" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/company-email-inboxes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-email-inboxes"] });
      toast({ title: "Inbox deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function closeDialog() {
    setShowAddDialog(false);
    setEditingInbox(null);
    setFormEmail("");
    setFormDisplayName("");
    setFormReplyTo("");
    setFormType("GENERAL");
    setFormIsDefault(false);
    setFormIsActive(true);
  }

  function openEditDialog(inbox: CompanyEmailInbox) {
    setEditingInbox(inbox);
    setFormEmail(inbox.emailAddress);
    setFormDisplayName(inbox.displayName || "");
    setFormReplyTo(inbox.replyToAddress || "");
    setFormType(inbox.inboxType);
    setFormIsDefault(inbox.isDefault);
    setFormIsActive(inbox.isActive);
    setShowAddDialog(true);
  }

  function handleSubmit() {
    const payload = {
      emailAddress: formEmail.trim().toLowerCase(),
      displayName: formDisplayName.trim() || null,
      replyToAddress: formReplyTo.trim() || null,
      inboxType: formType,
      isDefault: formIsDefault,
      isActive: formIsActive,
    };
    if (editingInbox) {
      updateMutation.mutate({ id: editingInbox.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Outgoing Email Inboxes
              </CardTitle>
              <CardDescription>
                Configure company email addresses used as the &quot;From&quot; address when sending mail register correspondence. Recipients can reply directly to these addresses.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => { closeDialog(); setShowAddDialog(true); }}
              data-testid="button-add-outgoing-inbox"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Inbox
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : inboxes.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-outgoing-inboxes">
              No outgoing inboxes configured. System emails will use the default no-reply address.
            </p>
          ) : (
            <div className="space-y-3">
              {inboxes.map((inbox) => (
                <div
                  key={inbox.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                  data-testid={`outgoing-inbox-${inbox.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" data-testid={`text-inbox-email-${inbox.id}`}>
                        {inbox.displayName ? `${inbox.displayName} <${inbox.emailAddress}>` : inbox.emailAddress}
                      </span>
                      <Badge variant="outline" data-testid={`badge-inbox-type-${inbox.id}`}>
                        {INBOX_TYPES.find((t) => t.value === inbox.inboxType)?.label || inbox.inboxType}
                      </Badge>
                      {inbox.isDefault && (
                        <Badge variant="secondary" data-testid={`badge-inbox-default-${inbox.id}`}>Default</Badge>
                      )}
                      {!inbox.isActive && (
                        <Badge variant="destructive" data-testid={`badge-inbox-inactive-${inbox.id}`}>Inactive</Badge>
                      )}
                    </div>
                    {inbox.replyToAddress && (
                      <p className="text-xs text-muted-foreground">Reply-to: {inbox.replyToAddress}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(inbox)}
                      data-testid={`button-edit-inbox-${inbox.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(inbox.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-inbox-${inbox.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) closeDialog(); else setShowAddDialog(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInbox ? "Edit" : "Add"} Outgoing Inbox</DialogTitle>
            <DialogDescription>
              {editingInbox ? "Update the outgoing email inbox settings." : "Add a new company email address for outgoing correspondence."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="inbox-email">Email Address</Label>
              <Input
                id="inbox-email"
                type="email"
                placeholder="e.g. projects@yourcompany.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={!!editingInbox}
                data-testid="input-inbox-email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inbox-display-name">Display Name (optional)</Label>
              <Input
                id="inbox-display-name"
                placeholder="e.g. ACME Projects"
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                data-testid="input-inbox-display-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inbox-reply-to">Reply-To Address (optional)</Label>
              <Input
                id="inbox-reply-to"
                type="email"
                placeholder="Leave empty to use the email address above"
                value={formReplyTo}
                onChange={(e) => setFormReplyTo(e.target.value)}
                data-testid="input-inbox-reply-to"
              />
            </div>
            <div className="space-y-1">
              <Label>Inbox Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger data-testid="select-inbox-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INBOX_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} data-testid={`option-inbox-type-${t.value}`}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formIsDefault}
                onCheckedChange={setFormIsDefault}
                data-testid="switch-inbox-default"
              />
              <Label>Set as default for this type</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
                data-testid="switch-inbox-active"
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-inbox">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !formEmail.trim()}
              data-testid="button-save-inbox"
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingInbox ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
