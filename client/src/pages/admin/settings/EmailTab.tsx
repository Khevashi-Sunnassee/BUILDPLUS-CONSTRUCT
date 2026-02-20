import { lazy, Suspense } from "react";
import { Save, Loader2, Mail, FileText, Pencil, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UseMutationResult } from "@tanstack/react-query";
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
