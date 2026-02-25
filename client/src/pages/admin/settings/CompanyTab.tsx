import { useState, useEffect } from "react";
import { Save, Loader2, Upload, Trash2, Building2, FileText, Plus, Pencil, Users, Hash, MapPin, Phone, AlertTriangle } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UseMutationResult } from "@tanstack/react-query";
import type { GlobalSettings, Department } from "@shared/schema";

export interface CompanyTabProps {
  settings: GlobalSettings | undefined;
  companyName: string;
  setCompanyName: (v: string) => void;
  saveCompanyNameMutation: UseMutationResult<any, any, string, any>;
  logoPreview: string | null;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadLogoMutation: UseMutationResult<any, any, string, any>;
  removeLogoMutation: UseMutationResult<any, any, void, any>;
  departments: Department[];
  deptsLoading: boolean;
  openDeptDialog: (dept?: Department) => void;
  setDeletingDept: (dept: Department | null) => void;
  setShowDeleteDeptDialog: (v: boolean) => void;
  jobNumberPrefix: string;
  setJobNumberPrefix: (v: string) => void;
  jobNumberMinDigits: number;
  setJobNumberMinDigits: (v: number) => void;
  jobNumberNextSequence: number;
  setJobNumberNextSequence: (v: number) => void;
  saveJobNumberSettingsMutation: UseMutationResult<any, any, { jobNumberPrefix: string; jobNumberMinDigits: number; jobNumberNextSequence: number }, any>;
  includePOTerms: boolean;
  setIncludePOTerms: (v: boolean) => void;
  saveIncludePOTermsMutation: UseMutationResult<any, any, boolean, any>;
}

export function CompanyTab({
  settings,
  companyName,
  setCompanyName,
  saveCompanyNameMutation,
  logoPreview,
  logoInputRef,
  handleLogoUpload,
  uploadLogoMutation,
  removeLogoMutation,
  departments,
  deptsLoading,
  openDeptDialog,
  setDeletingDept,
  setShowDeleteDeptDialog,
  jobNumberPrefix,
  setJobNumberPrefix,
  jobNumberMinDigits,
  setJobNumberMinDigits,
  jobNumberNextSequence,
  setJobNumberNextSequence,
  saveJobNumberSettingsMutation,
  includePOTerms,
  setIncludePOTerms,
  saveIncludePOTermsMutation,
}: CompanyTabProps) {
  const [showJobNumberConfirm, setShowJobNumberConfirm] = useState(false);

  return (
    <TabsContent value="company" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            Company Branding
          </CardTitle>
          <CardDescription>
            Configure your company name and logo for the app and reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              data-testid="input-company-name"
            />
            <p className="text-sm text-muted-foreground">
              Displayed on all reports and exports
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => saveCompanyNameMutation.mutate(companyName)}
              disabled={saveCompanyNameMutation.isPending || companyName === settings?.companyName}
              data-testid="button-save-company-name"
            >
              {saveCompanyNameMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Company Name
            </Button>
          </div>

          <div className="space-y-2">
            <Label>User Logo</Label>
            <p className="text-sm text-muted-foreground">
              Used on all printed documents, PDFs, and outbound communications from your company
            </p>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-lg border bg-background flex items-center justify-center overflow-hidden">
                  {(logoPreview || settings?.userLogoBase64) ? (
                    <img 
                      src={logoPreview || settings?.userLogoBase64 || ""} 
                      alt="User Logo" 
                      className="max-w-full max-h-full object-contain"
                      data-testid="img-user-logo-preview"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1" data-testid="img-user-logo-preview">
                      <Building2 className="h-8 w-8 text-primary" />
                      <span className="text-xs font-semibold text-muted-foreground">No Logo</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    data-testid="input-user-logo-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadLogoMutation.isPending}
                    data-testid="button-upload-user-logo"
                  >
                    {uploadLogoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Logo
                  </Button>
                  {settings?.userLogoBase64 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeLogoMutation.mutate()}
                      disabled={removeLogoMutation.isPending}
                      data-testid="button-remove-user-logo"
                    >
                      {removeLogoMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                      )}
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  PNG, JPG or SVG. Max 2MB.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CompanyDetailsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" aria-hidden="true" />
            Departments
          </CardTitle>
          <CardDescription>
            Manage departments that users can be assigned to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDeptDialog()}
              data-testid="button-add-department"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>

          {deptsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : departments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No departments created yet. Add one to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-md border flex-wrap"
                  data-testid={`dept-row-${dept.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" data-testid={`text-dept-name-${dept.id}`}>
                          {dept.name}
                        </span>
                        <Badge variant="outline" className="text-xs">{dept.code}</Badge>
                        {!dept.isActive && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {dept.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {dept.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit department"
                      onClick={() => openDeptDialog(dept)}
                      data-testid={`button-edit-dept-${dept.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete department"
                      onClick={() => { setDeletingDept(dept); setShowDeleteDeptDialog(true); }}
                      data-testid={`button-delete-dept-${dept.id}`}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" aria-hidden="true" />
            Job Number Auto-Generation
          </CardTitle>
          <CardDescription>
            Configure automatic job number formatting when creating new jobs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jobNumberPrefix">Prefix</Label>
              <Input
                id="jobNumberPrefix"
                value={jobNumberPrefix}
                onChange={(e) => setJobNumberPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. LTE-"
                maxLength={20}
                data-testid="input-job-number-prefix"
              />
              <p className="text-xs text-muted-foreground">
                Text prepended to every job number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobNumberMinDigits">Minimum Digits</Label>
              <Input
                id="jobNumberMinDigits"
                type="number"
                min={1}
                max={10}
                step="1"
                value={jobNumberMinDigits}
                onChange={(e) => setJobNumberMinDigits(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                data-testid="input-job-number-min-digits"
              />
              <p className="text-xs text-muted-foreground">
                Zero-padded digit count (e.g. 4 = 0001)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobNumberNextSequence">Next Sequence</Label>
              <Input
                id="jobNumberNextSequence"
                type="number"
                min={1}
                step="1"
                value={jobNumberNextSequence}
                onChange={(e) => setJobNumberNextSequence(Math.max(1, parseInt(e.target.value) || 1))}
                data-testid="input-job-number-next-sequence"
              />
              <p className="text-xs text-muted-foreground">
                The next number in the sequence
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Preview</Label>
              <p className="text-sm text-muted-foreground">
                Next job number: <span className="font-mono font-semibold text-foreground" data-testid="text-job-number-preview">
                  {jobNumberPrefix ? `${jobNumberPrefix}${String(jobNumberNextSequence).padStart(jobNumberMinDigits, "0")}` : "Not configured"}
                </span>
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowJobNumberConfirm(true)}
              disabled={saveJobNumberSettingsMutation.isPending || (
                jobNumberPrefix === (settings?.jobNumberPrefix || "") &&
                jobNumberMinDigits === (settings?.jobNumberMinDigits || 3) &&
                jobNumberNextSequence === (settings?.jobNumberNextSequence || 1)
              )}
              data-testid="button-save-job-number-settings"
            >
              {saveJobNumberSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
            <AlertDialog open={showJobNumberConfirm} onOpenChange={setShowJobNumberConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Confirm Job Number Settings Change
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Changing the job number prefix will affect all future job numbers. Existing jobs will not be updated. This may cause inconsistency in job numbering if changed mid-project.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-job-number-confirm">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => saveJobNumberSettingsMutation.mutate({ jobNumberPrefix, jobNumberMinDigits, jobNumberNextSequence })}
                    data-testid="button-confirm-job-number-save"
                  >
                    Save Changes
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Purchase Order Settings
          </CardTitle>
          <CardDescription>
            Configure how Purchase Orders are printed and distributed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Include PO Terms & Conditions</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, printed Purchase Orders will include a separate page with your Terms & Conditions
              </p>
            </div>
            <Switch
              checked={includePOTerms}
              onCheckedChange={(checked) => {
                setIncludePOTerms(checked);
                saveIncludePOTermsMutation.mutate(checked);
              }}
              disabled={saveIncludePOTermsMutation.isPending}
              data-testid="switch-include-po-terms"
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

interface CompanyDetails {
  abn: string | null;
  acn: string | null;
  address: string | null;
  phone: string | null;
}

function CompanyDetailsCard() {
  const { toast } = useToast();
  const [abn, setAbn] = useState("");
  const [acn, setAcn] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const { data: details, isLoading } = useQuery<CompanyDetails>({
    queryKey: ["/api/admin/settings/company-details"],
  });

  useEffect(() => {
    if (details) {
      setAbn(details.abn || "");
      setAcn(details.acn || "");
      setAddress(details.address || "");
      setPhone(details.phone || "");
    }
  }, [details]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<CompanyDetails>) => {
      const res = await apiRequest("PATCH", "/api/admin/settings/company-details", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/company-details"] });
      toast({ title: "Company details saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const hasChanges = abn !== (details?.abn || "") ||
    acn !== (details?.acn || "") ||
    address !== (details?.address || "") ||
    phone !== (details?.phone || "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" aria-hidden="true" />
          Company Details
        </CardTitle>
        <CardDescription>
          Business registration numbers and head office contact information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyAbn">ABN (Australian Business Number)</Label>
                <Input
                  id="companyAbn"
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="e.g. 12 345 678 901"
                  maxLength={20}
                  data-testid="input-company-abn"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAcn">ACN (Australian Company Number)</Label>
                <Input
                  id="companyAcn"
                  value={acn}
                  onChange={(e) => setAcn(e.target.value)}
                  placeholder="e.g. 123 456 789"
                  maxLength={20}
                  data-testid="input-company-acn"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress" className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Head Office Address
              </Label>
              <Textarea
                id="companyAddress"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Level 1, 123 Collins Street, Melbourne VIC 3000"
                rows={2}
                maxLength={500}
                data-testid="input-company-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyPhone" className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                Telephone Number
              </Label>
              <Input
                id="companyPhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (03) 9123 4567"
                maxLength={50}
                data-testid="input-company-phone"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate({ abn, acn, address, phone })}
              disabled={saveMutation.isPending || !hasChanges}
              data-testid="button-save-company-details"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Company Details
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
