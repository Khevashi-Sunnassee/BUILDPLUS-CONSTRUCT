import { useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CONTRACT_ROUTES, DOCUMENT_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  Save,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Scale,
  Brain,
  Loader2,
  Download,
  Eye,
  Building2,
  DollarSign,
  Hammer,
  Calendar,
  ClipboardList,
  Truck,
  RefreshCw,
  Gavel,
  Award,
  FolderOpen,
  Plus,
  FileUp,
} from "lucide-react";

interface Contract {
  id: string;
  companyId: string;
  jobId: string;
  contractNumber: string | null;
  projectName: string | null;
  projectAddress: string | null;
  ownerClientName: string | null;
  generalContractor: string | null;
  architectEngineer: string | null;
  contractStatus: string;
  contractType: string | null;
  originalContractDate: string | null;
  noticeToProceedDate: string | null;
  originalContractValue: string | null;
  revisedContractValue: string | null;
  unitPrices: string | null;
  retentionPercentage: string | null;
  retentionCap: string | null;
  paymentTerms: string | null;
  billingMethod: string | null;
  taxResponsibility: string | null;
  escalationClause: boolean | null;
  escalationClauseDetails: string | null;
  liquidatedDamagesRate: string | null;
  liquidatedDamagesStartDate: string | null;
  precastScopeDescription: string | null;
  precastElementsIncluded: any;
  estimatedPieceCount: number | null;
  estimatedTotalWeight: string | null;
  estimatedTotalVolume: string | null;
  finishRequirements: string | null;
  connectionTypeResponsibility: string | null;
  requiredDeliveryStartDate: string | null;
  requiredDeliveryEndDate: string | null;
  productionStartDate: string | null;
  productionFinishDate: string | null;
  erectionStartDate: string | null;
  erectionFinishDate: string | null;
  criticalMilestones: string | null;
  weekendNightWorkAllowed: boolean | null;
  weatherAllowances: string | null;
  designResponsibility: string | null;
  shopDrawingRequired: boolean | null;
  submittalDueDate: string | null;
  submittalApprovalDate: string | null;
  revisionCount: number | null;
  connectionDesignIncluded: boolean | null;
  stampedCalculationsRequired: boolean | null;
  deliveryRestrictions: string | null;
  siteAccessConstraints: string | null;
  craneTypeCapacity: string | null;
  unloadingResponsibility: string | null;
  laydownAreaAvailable: boolean | null;
  returnLoadsAllowed: boolean | null;
  approvedChangeOrderValue: string | null;
  pendingChangeOrderValue: string | null;
  changeOrderCount: number | null;
  changeOrderReferenceNumbers: string | null;
  changeReasonCodes: string | null;
  timeImpactDays: number | null;
  performanceBondRequired: boolean | null;
  paymentBondRequired: boolean | null;
  insuranceRequirements: string | null;
  warrantyPeriod: string | null;
  indemnificationClauseNotes: string | null;
  disputeResolutionMethod: string | null;
  governingLaw: string | null;
  forceMajeureClause: boolean | null;
  qualityStandardReference: string | null;
  mockupsRequired: boolean | null;
  acceptanceCriteria: string | null;
  punchListResponsibility: string | null;
  finalAcceptanceDate: string | null;
  substantialCompletionDate: string | null;
  finalCompletionDate: string | null;
  finalRetentionReleaseDate: string | null;
  asBuiltsRequired: boolean | null;
  omManualsRequired: boolean | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  riskRating: number | null;
  riskOverview: string | null;
  riskHighlights: any;
  aiAnalyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Job {
  id: string;
  jobNumber: string;
  name: string;
  client: string | null;
  address: string | null;
}

interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  originalName: string;
  status: string;
  version: string;
  revision: string;
  createdAt: string;
  mimeType: string;
}

function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

function BooleanField({ label, value, onChange, testId }: { label: string; value: boolean | null; onChange: (v: boolean) => void; testId: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={value ?? false} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}

function TextField({ label, value, onChange, testId, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; testId: string; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} placeholder={placeholder} />
    </div>
  );
}

function TextAreaField({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} rows={3} />
    </div>
  );
}

export default function ContractDetailPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/contracts/:jobId");
  const jobId = params?.jobId;
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Contract>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const { data: job, isLoading: jobLoading } = useQuery<Job>({
    queryKey: [JOBS_ROUTES.BY_ID(jobId!), jobId],
    enabled: !!jobId,
  });

  const { data: contract, isLoading: contractLoading } = useQuery<Contract | null>({
    queryKey: [CONTRACT_ROUTES.BY_JOB(jobId!), jobId],
    enabled: !!jobId,
  });

  const { data: documents = [] } = useQuery<DocumentItem[]>({
    queryKey: [DOCUMENT_ROUTES.LIST, "contract-docs", jobId],
    queryFn: async () => {
      const res = await fetch(`${DOCUMENT_ROUTES.LIST}?jobId=${jobId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      return Array.isArray(data) ? data : data.documents || [];
    },
    enabled: !!jobId,
  });

  const isLoaded = !jobLoading && !contractLoading;
  const currentData = { ...contract, ...formData };

  const updateField = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Contract>) => {
      if (contract?.id) {
        return apiRequest("PATCH", CONTRACT_ROUTES.BY_ID(contract.id), data);
      } else {
        return apiRequest("POST", CONTRACT_ROUTES.LIST, { ...data, jobId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTRACT_ROUTES.BY_JOB(jobId!)] });
      queryClient.invalidateQueries({ queryKey: [CONTRACT_ROUTES.HUB] });
      setHasChanges(false);
      toast({ title: "Contract saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save contract", description: error.message, variant: "destructive" });
    },
  });

  const aiAnalyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(CONTRACT_ROUTES.AI_ANALYZE, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "AI analysis failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setAiResult(data);
    },
    onError: (error: any) => {
      toast({ title: "AI Analysis Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const saveData = { ...formData };
    if (!contract?.id) {
      saveData.contractStatus = saveData.contractStatus || "AWAITING_CONTRACT";
    }
    saveMutation.mutate(saveData);
  };

  const handleAiUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      aiAnalyzeMutation.mutate(file);
    }
  };

  const applyAiFields = () => {
    if (!aiResult?.extractedFields) return;

    const fields = aiResult.extractedFields;
    const updates: Partial<Contract> = {};

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        (updates as any)[key] = value;
      }
    });

    if (aiResult.riskRating) updates.riskRating = aiResult.riskRating;
    if (aiResult.riskOverview) updates.riskOverview = aiResult.riskOverview;
    if (aiResult.riskHighlights) updates.riskHighlights = aiResult.riskHighlights;
    updates.aiAnalyzedAt = new Date().toISOString();

    setFormData(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
    setAiDialogOpen(false);
    toast({ title: "AI analysis applied to contract fields" });
  };

  const handleProjectDocUpload = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("title", file.name.replace(/\.[^/.]+$/, ""));
      formDataUpload.append("jobId", jobId!);
      formDataUpload.append("status", "DRAFT");

      try {
        await fetch(DOCUMENT_ROUTES.UPLOAD, {
          method: "POST",
          body: formDataUpload,
          credentials: "include",
        });
      } catch (err: any) {
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }
    queryClient.invalidateQueries({ queryKey: [DOCUMENT_ROUTES.LIST, "contract-docs", jobId] });
    setDocUploadOpen(false);
    toast({ title: "Documents uploaded successfully" });
  };

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const riskRating = currentData.riskRating;
  const riskHighlights = currentData.riskHighlights as any[] || [];

  return (
    <div className="space-y-6" data-testid="contract-detail-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contracts")} data-testid="button-back-to-hub">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-contract-title">
              {job?.jobNumber} - {job?.name}
            </h1>
            <p className="text-muted-foreground">{job?.client}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setDocUploadOpen(true)}
            data-testid="button-add-project-documents"
          >
            <FileUp className="h-4 w-4 mr-2" />
            Add Project Documents
          </Button>
          <Button
            variant="outline"
            onClick={() => setAiDialogOpen(true)}
            data-testid="button-add-contract-documents"
          >
            <Brain className="h-4 w-4 mr-2" />
            Add Contract Document
          </Button>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-contract">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {riskRating && (
        <Card className={riskRating >= 7 ? "border-red-500/30 bg-red-500/5" : riskRating >= 4 ? "border-amber-500/30 bg-amber-500/5" : "border-green-500/30 bg-green-500/5"} data-testid="card-risk-assessment">
          <CardContent className="py-4">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-md ${riskRating >= 7 ? "bg-red-500/20" : riskRating >= 4 ? "bg-amber-500/20" : "bg-green-500/20"}`}>
                  <Shield className={`h-6 w-6 ${riskRating >= 7 ? "text-red-500" : riskRating >= 4 ? "text-amber-500" : "text-green-500"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Risk Rating</p>
                  <p className="text-3xl font-bold" data-testid="text-risk-rating">{riskRating}/10</p>
                </div>
              </div>
              <Separator orientation="vertical" className="h-16 hidden md:block" />
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium mb-1">Risk Overview</p>
                <p className="text-sm text-muted-foreground" data-testid="text-risk-overview">{currentData.riskOverview}</p>
              </div>
              {riskHighlights.length > 0 && (
                <>
                  <Separator orientation="vertical" className="h-16 hidden lg:block" />
                  <div className="min-w-[200px]">
                    <p className="text-sm font-medium mb-2">Key Risks</p>
                    <div className="space-y-1">
                      {riskHighlights.slice(0, 3).map((risk: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <Badge variant={risk.severity === "HIGH" ? "destructive" : risk.severity === "MEDIUM" ? "secondary" : "outline"} className="text-xs">
                            {risk.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate">{risk.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-contract">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details" data-testid="tab-details">
            <FileText className="h-4 w-4 mr-2" />
            Contract Details
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FolderOpen className="h-4 w-4 mr-2" />
            Documents ({documents.length})
          </TabsTrigger>
          {riskHighlights.length > 0 && (
            <TabsTrigger value="risks" data-testid="tab-risks">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Risk Analysis
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-4">
          <Card data-testid="section-core-identification">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Core Contract Identification</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField label="Contract Number" value={currentData.contractNumber || ""} onChange={(v) => updateField("contractNumber", v)} testId="input-contract-number" />
                <TextField label="Project Name" value={currentData.projectName || ""} onChange={(v) => updateField("projectName", v)} testId="input-project-name" />
                <TextField label="Project Address" value={currentData.projectAddress || ""} onChange={(v) => updateField("projectAddress", v)} testId="input-project-address" />
                <TextField label="Owner / Client Name" value={currentData.ownerClientName || ""} onChange={(v) => updateField("ownerClientName", v)} testId="input-owner-client" />
                <TextField label="General Contractor" value={currentData.generalContractor || ""} onChange={(v) => updateField("generalContractor", v)} testId="input-general-contractor" />
                <TextField label="Architect / Engineer (EOR)" value={currentData.architectEngineer || ""} onChange={(v) => updateField("architectEngineer", v)} testId="input-architect-engineer" />
                <div className="space-y-1">
                  <Label className="text-sm">Contract Status</Label>
                  <Select value={currentData.contractStatus || "AWAITING_CONTRACT"} onValueChange={(v) => updateField("contractStatus", v)}>
                    <SelectTrigger data-testid="select-contract-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AWAITING_CONTRACT">Awaiting Contract</SelectItem>
                      <SelectItem value="CONTRACT_REVIEW">Contract Review</SelectItem>
                      <SelectItem value="CONTRACT_EXECUTED">Contract Executed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Contract Type</Label>
                  <Select value={currentData.contractType || ""} onValueChange={(v) => updateField("contractType", v)}>
                    <SelectTrigger data-testid="select-contract-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LUMP_SUM">Lump Sum</SelectItem>
                      <SelectItem value="UNIT_PRICE">Unit Price</SelectItem>
                      <SelectItem value="TIME_AND_MATERIALS">Time & Materials</SelectItem>
                      <SelectItem value="GMP">GMP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TextField label="Original Contract Date" value={formatDate(currentData.originalContractDate)} onChange={(v) => updateField("originalContractDate", v)} testId="input-original-contract-date" type="date" />
                <TextField label="Notice to Proceed Date" value={formatDate(currentData.noticeToProceedDate)} onChange={(v) => updateField("noticeToProceedDate", v)} testId="input-ntp-date" type="date" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-financial-terms">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Financial & Commercial Terms</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField label="Original Contract Value" value={currentData.originalContractValue || ""} onChange={(v) => updateField("originalContractValue", v)} testId="input-original-value" type="number" placeholder="0.00" />
                <TextField label="Revised Contract Value" value={currentData.revisedContractValue || ""} onChange={(v) => updateField("revisedContractValue", v)} testId="input-revised-value" type="number" placeholder="0.00" />
                <TextField label="Unit Prices" value={currentData.unitPrices || ""} onChange={(v) => updateField("unitPrices", v)} testId="input-unit-prices" />
                <TextField label="Retention %" value={currentData.retentionPercentage || ""} onChange={(v) => updateField("retentionPercentage", v)} testId="input-retention-pct" type="number" />
                <TextField label="Retention Cap" value={currentData.retentionCap || ""} onChange={(v) => updateField("retentionCap", v)} testId="input-retention-cap" type="number" />
                <TextField label="Payment Terms" value={currentData.paymentTerms || ""} onChange={(v) => updateField("paymentTerms", v)} testId="input-payment-terms" placeholder="e.g. Net 30" />
                <TextField label="Billing Method" value={currentData.billingMethod || ""} onChange={(v) => updateField("billingMethod", v)} testId="input-billing-method" placeholder="Progress / Milestone / Delivery" />
                <TextField label="Tax Responsibility" value={currentData.taxResponsibility || ""} onChange={(v) => updateField("taxResponsibility", v)} testId="input-tax-responsibility" />
                <BooleanField label="Escalation Clause" value={currentData.escalationClause} onChange={(v) => updateField("escalationClause", v)} testId="switch-escalation" />
              </div>
              {currentData.escalationClause && (
                <TextAreaField label="Escalation Clause Details" value={currentData.escalationClauseDetails || ""} onChange={(v) => updateField("escalationClauseDetails", v)} testId="textarea-escalation-details" />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="Liquidated Damages Rate" value={currentData.liquidatedDamagesRate || ""} onChange={(v) => updateField("liquidatedDamagesRate", v)} testId="input-ld-rate" />
                <TextField label="LD Start Date" value={formatDate(currentData.liquidatedDamagesStartDate)} onChange={(v) => updateField("liquidatedDamagesStartDate", v)} testId="input-ld-start-date" type="date" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-scope">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Hammer className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Scope of Work (Precast-Specific)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <TextAreaField label="Precast Scope Description" value={currentData.precastScopeDescription || ""} onChange={(v) => updateField("precastScopeDescription", v)} testId="textarea-precast-scope" />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Precast Elements Included</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {["panels", "beams", "columns", "doubleTees", "hollowCore", "stairs"].map(el => {
                    const elements = (currentData.precastElementsIncluded || {}) as Record<string, boolean>;
                    return (
                      <div key={el} className="flex items-center gap-2">
                        <Switch
                          checked={elements[el] || false}
                          onCheckedChange={(v) => updateField("precastElementsIncluded", { ...elements, [el]: v })}
                          data-testid={`switch-element-${el}`}
                        />
                        <Label className="text-sm capitalize">{el.replace(/([A-Z])/g, " $1")}</Label>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField label="Estimated Piece Count" value={String(currentData.estimatedPieceCount || "")} onChange={(v) => updateField("estimatedPieceCount", parseInt(v) || null)} testId="input-piece-count" type="number" />
                <TextField label="Estimated Total Weight" value={currentData.estimatedTotalWeight || ""} onChange={(v) => updateField("estimatedTotalWeight", v)} testId="input-total-weight" />
                <TextField label="Estimated Total Volume" value={currentData.estimatedTotalVolume || ""} onChange={(v) => updateField("estimatedTotalVolume", v)} testId="input-total-volume" />
                <TextField label="Finish Requirements" value={currentData.finishRequirements || ""} onChange={(v) => updateField("finishRequirements", v)} testId="input-finish-req" />
                <TextField label="Connection Type Responsibility" value={currentData.connectionTypeResponsibility || ""} onChange={(v) => updateField("connectionTypeResponsibility", v)} testId="input-connection-resp" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-schedule">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Schedule & Milestones</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField label="Required Delivery Start" value={formatDate(currentData.requiredDeliveryStartDate)} onChange={(v) => updateField("requiredDeliveryStartDate", v)} testId="input-delivery-start" type="date" />
                <TextField label="Required Delivery End" value={formatDate(currentData.requiredDeliveryEndDate)} onChange={(v) => updateField("requiredDeliveryEndDate", v)} testId="input-delivery-end" type="date" />
                <TextField label="Production Start" value={formatDate(currentData.productionStartDate)} onChange={(v) => updateField("productionStartDate", v)} testId="input-production-start" type="date" />
                <TextField label="Production Finish" value={formatDate(currentData.productionFinishDate)} onChange={(v) => updateField("productionFinishDate", v)} testId="input-production-finish" type="date" />
                <TextField label="Erection Start" value={formatDate(currentData.erectionStartDate)} onChange={(v) => updateField("erectionStartDate", v)} testId="input-erection-start" type="date" />
                <TextField label="Erection Finish" value={formatDate(currentData.erectionFinishDate)} onChange={(v) => updateField("erectionFinishDate", v)} testId="input-erection-finish" type="date" />
              </div>
              <TextAreaField label="Critical Milestones" value={currentData.criticalMilestones || ""} onChange={(v) => updateField("criticalMilestones", v)} testId="textarea-milestones" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BooleanField label="Weekend / Night Work Allowed" value={currentData.weekendNightWorkAllowed} onChange={(v) => updateField("weekendNightWorkAllowed", v)} testId="switch-weekend-work" />
                <TextField label="Weather Allowances" value={currentData.weatherAllowances || ""} onChange={(v) => updateField("weatherAllowances", v)} testId="input-weather" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-engineering">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Engineering & Submittals</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField label="Design Responsibility" value={currentData.designResponsibility || ""} onChange={(v) => updateField("designResponsibility", v)} testId="input-design-resp" placeholder="EOR / Precaster / Delegated" />
                <BooleanField label="Shop Drawing Required" value={currentData.shopDrawingRequired} onChange={(v) => updateField("shopDrawingRequired", v)} testId="switch-shop-drawing" />
                <TextField label="Submittal Due Date" value={formatDate(currentData.submittalDueDate)} onChange={(v) => updateField("submittalDueDate", v)} testId="input-submittal-due" type="date" />
                <TextField label="Submittal Approval Date" value={formatDate(currentData.submittalApprovalDate)} onChange={(v) => updateField("submittalApprovalDate", v)} testId="input-submittal-approval" type="date" />
                <TextField label="Revision Count" value={String(currentData.revisionCount || "")} onChange={(v) => updateField("revisionCount", parseInt(v) || null)} testId="input-revision-count" type="number" />
                <BooleanField label="Connection Design Included" value={currentData.connectionDesignIncluded} onChange={(v) => updateField("connectionDesignIncluded", v)} testId="switch-connection-design" />
                <BooleanField label="Stamped Calculations Required" value={currentData.stampedCalculationsRequired} onChange={(v) => updateField("stampedCalculationsRequired", v)} testId="switch-stamped-calcs" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-logistics">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Logistics & Site Constraints</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextAreaField label="Delivery Restrictions" value={currentData.deliveryRestrictions || ""} onChange={(v) => updateField("deliveryRestrictions", v)} testId="textarea-delivery-restrictions" />
                <TextAreaField label="Site Access Constraints" value={currentData.siteAccessConstraints || ""} onChange={(v) => updateField("siteAccessConstraints", v)} testId="textarea-site-access" />
                <TextField label="Crane Type / Capacity" value={currentData.craneTypeCapacity || ""} onChange={(v) => updateField("craneTypeCapacity", v)} testId="input-crane-capacity" />
                <TextField label="Unloading Responsibility" value={currentData.unloadingResponsibility || ""} onChange={(v) => updateField("unloadingResponsibility", v)} testId="input-unloading-resp" />
                <BooleanField label="Laydown Area Available" value={currentData.laydownAreaAvailable} onChange={(v) => updateField("laydownAreaAvailable", v)} testId="switch-laydown" />
                <BooleanField label="Return Loads Allowed" value={currentData.returnLoadsAllowed} onChange={(v) => updateField("returnLoadsAllowed", v)} testId="switch-return-loads" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-change-management">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Change Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField label="Approved CO Value" value={currentData.approvedChangeOrderValue || ""} onChange={(v) => updateField("approvedChangeOrderValue", v)} testId="input-approved-co-value" type="number" />
                <TextField label="Pending CO Value" value={currentData.pendingChangeOrderValue || ""} onChange={(v) => updateField("pendingChangeOrderValue", v)} testId="input-pending-co-value" type="number" />
                <TextField label="CO Count" value={String(currentData.changeOrderCount || "")} onChange={(v) => updateField("changeOrderCount", parseInt(v) || null)} testId="input-co-count" type="number" />
                <TextField label="CO Reference Numbers" value={currentData.changeOrderReferenceNumbers || ""} onChange={(v) => updateField("changeOrderReferenceNumbers", v)} testId="input-co-refs" />
                <TextField label="Change Reason Codes" value={currentData.changeReasonCodes || ""} onChange={(v) => updateField("changeReasonCodes", v)} testId="input-change-reasons" />
                <TextField label="Time Impact (Days)" value={String(currentData.timeImpactDays || "")} onChange={(v) => updateField("timeImpactDays", parseInt(v) || null)} testId="input-time-impact" type="number" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-risk-legal">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Gavel className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Risk, Legal & Compliance</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <BooleanField label="Performance Bond Required" value={currentData.performanceBondRequired} onChange={(v) => updateField("performanceBondRequired", v)} testId="switch-perf-bond" />
                <BooleanField label="Payment Bond Required" value={currentData.paymentBondRequired} onChange={(v) => updateField("paymentBondRequired", v)} testId="switch-payment-bond" />
                <TextAreaField label="Insurance Requirements" value={currentData.insuranceRequirements || ""} onChange={(v) => updateField("insuranceRequirements", v)} testId="textarea-insurance" />
                <TextField label="Warranty Period" value={currentData.warrantyPeriod || ""} onChange={(v) => updateField("warrantyPeriod", v)} testId="input-warranty-period" />
                <TextAreaField label="Indemnification Notes" value={currentData.indemnificationClauseNotes || ""} onChange={(v) => updateField("indemnificationClauseNotes", v)} testId="textarea-indemnification" />
                <TextField label="Dispute Resolution" value={currentData.disputeResolutionMethod || ""} onChange={(v) => updateField("disputeResolutionMethod", v)} testId="input-dispute-resolution" />
                <TextField label="Governing Law" value={currentData.governingLaw || ""} onChange={(v) => updateField("governingLaw", v)} testId="input-governing-law" />
                <BooleanField label="Force Majeure Clause" value={currentData.forceMajeureClause} onChange={(v) => updateField("forceMajeureClause", v)} testId="switch-force-majeure" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-quality">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Quality & Acceptance</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField label="Quality Standard Reference" value={currentData.qualityStandardReference || ""} onChange={(v) => updateField("qualityStandardReference", v)} testId="input-quality-standard" />
                <BooleanField label="Mockups Required" value={currentData.mockupsRequired} onChange={(v) => updateField("mockupsRequired", v)} testId="switch-mockups" />
                <TextAreaField label="Acceptance Criteria" value={currentData.acceptanceCriteria || ""} onChange={(v) => updateField("acceptanceCriteria", v)} testId="textarea-acceptance-criteria" />
                <TextField label="Punch List Responsibility" value={currentData.punchListResponsibility || ""} onChange={(v) => updateField("punchListResponsibility", v)} testId="input-punch-list-resp" />
                <TextField label="Final Acceptance Date" value={formatDate(currentData.finalAcceptanceDate)} onChange={(v) => updateField("finalAcceptanceDate", v)} testId="input-final-acceptance" type="date" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-closeout">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Closeout & Completion</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField label="Substantial Completion Date" value={formatDate(currentData.substantialCompletionDate)} onChange={(v) => updateField("substantialCompletionDate", v)} testId="input-substantial-completion" type="date" />
                <TextField label="Final Completion Date" value={formatDate(currentData.finalCompletionDate)} onChange={(v) => updateField("finalCompletionDate", v)} testId="input-final-completion" type="date" />
                <TextField label="Final Retention Release" value={formatDate(currentData.finalRetentionReleaseDate)} onChange={(v) => updateField("finalRetentionReleaseDate", v)} testId="input-retention-release" type="date" />
                <BooleanField label="As-Builts Required" value={currentData.asBuiltsRequired} onChange={(v) => updateField("asBuiltsRequired", v)} testId="switch-as-builts" />
                <BooleanField label="O&M Manuals Required" value={currentData.omManualsRequired} onChange={(v) => updateField("omManualsRequired", v)} testId="switch-om-manuals" />
                <TextField label="Warranty Start Date" value={formatDate(currentData.warrantyStartDate)} onChange={(v) => updateField("warrantyStartDate", v)} testId="input-warranty-start" type="date" />
                <TextField label="Warranty End Date" value={formatDate(currentData.warrantyEndDate)} onChange={(v) => updateField("warrantyEndDate", v)} testId="input-warranty-end" type="date" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Project Documents</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDocUploadOpen(true)} data-testid="button-upload-docs-tab">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Documents
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(true)} data-testid="button-ai-contract-tab">
                    <Brain className="h-4 w-4 mr-1" />
                    AI Contract Analysis
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No documents yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Upload contracts and project documents</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDocUploadOpen(true)}>
                      <FileUp className="h-4 w-4 mr-2" />
                      Add Project Documents
                    </Button>
                    <Button onClick={() => setAiDialogOpen(true)}>
                      <Brain className="h-4 w-4 mr-2" />
                      Add Contract Document
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 p-3 rounded-md border hover-elevate" data-testid={`doc-row-${doc.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{doc.title || doc.originalName}</p>
                          <p className="text-xs text-muted-foreground">v{doc.version} Rev {doc.revision} | {new Date(doc.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">{doc.status}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => window.open(DOCUMENT_ROUTES.VIEW(doc.id), "_blank")} data-testid={`button-view-doc-${doc.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => window.open(DOCUMENT_ROUTES.DOWNLOAD(doc.id), "_blank")} data-testid={`button-download-doc-${doc.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {riskHighlights.length > 0 && (
          <TabsContent value="risks" className="mt-4">
            <Card data-testid="card-full-risk-analysis">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Full Risk Analysis</CardTitle>
                </div>
                <CardDescription>AI-powered legal risk assessment of your contract</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentData.riskOverview && (
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-sm font-medium mb-2">Overview</p>
                    <p className="text-sm text-muted-foreground">{currentData.riskOverview}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {riskHighlights.map((risk: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-md border">
                      <Badge variant={risk.severity === "HIGH" ? "destructive" : risk.severity === "MEDIUM" ? "secondary" : "outline"}>
                        {risk.severity}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{risk.category}</p>
                        <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Contract Analysis
            </DialogTitle>
            <DialogDescription>
              Upload a contract document for AI-powered field extraction and risk assessment. Our legal adviser will analyze the contract, auto-populate fields, and highlight risks.
            </DialogDescription>
          </DialogHeader>

          {!aiResult ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-md p-8 text-center">
                {aiAnalyzeMutation.isPending ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="font-medium">Analyzing contract...</p>
                    <p className="text-sm text-muted-foreground">Our AI legal adviser is reviewing your contract document</p>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-3">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Upload Contract Document</p>
                    <p className="text-sm text-muted-foreground">PDF, Word, or image files supported</p>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleAiUpload} data-testid="input-ai-file-upload" />
                    <Button variant="outline" type="button">
                      <FileUp className="h-4 w-4 mr-2" />
                      Select File
                    </Button>
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-md ${aiResult.riskRating >= 7 ? "bg-red-500/10 border border-red-500/30" : aiResult.riskRating >= 4 ? "bg-amber-500/10 border border-amber-500/30" : "bg-green-500/10 border border-green-500/30"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Shield className={`h-6 w-6 ${aiResult.riskRating >= 7 ? "text-red-500" : aiResult.riskRating >= 4 ? "text-amber-500" : "text-green-500"}`} />
                  <span className="text-2xl font-bold">Risk Rating: {aiResult.riskRating}/10</span>
                </div>
                <p className="text-sm text-muted-foreground">{aiResult.riskOverview}</p>
              </div>

              {aiResult.riskHighlights?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Key Risks Identified:</p>
                  {aiResult.riskHighlights.map((risk: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant={risk.severity === "HIGH" ? "destructive" : risk.severity === "MEDIUM" ? "secondary" : "outline"} className="text-xs flex-shrink-0">
                        {risk.severity}
                      </Badge>
                      <span className="text-muted-foreground">{risk.description}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-sm font-medium mb-1">Fields Extracted</p>
                <p className="text-sm text-muted-foreground">
                  {Object.values(aiResult.extractedFields || {}).filter(v => v !== null && v !== undefined && v !== "").length} fields auto-populated from the contract
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setAiResult(null); setAiDialogOpen(false); }}>
                  Cancel
                </Button>
                <Button onClick={applyAiFields} data-testid="button-apply-ai-fields">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply to Contract
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={docUploadOpen} onOpenChange={setDocUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project Documents</DialogTitle>
            <DialogDescription>Upload multiple documents to the project register</DialogDescription>
          </DialogHeader>
          <div className="border-2 border-dashed rounded-md p-8 text-center">
            <label className="cursor-pointer flex flex-col items-center gap-3">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Select Files</p>
              <p className="text-sm text-muted-foreground">PDF, Word, Excel, images, and other file types</p>
              <input
                type="file"
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleProjectDocUpload(e.target.files);
                  }
                }}
                data-testid="input-project-doc-upload"
              />
              <Button variant="outline" type="button">
                <FileUp className="h-4 w-4 mr-2" />
                Browse Files
              </Button>
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
