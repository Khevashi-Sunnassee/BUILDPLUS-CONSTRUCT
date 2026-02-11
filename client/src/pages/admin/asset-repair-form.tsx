import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ASSET_ROUTES } from "@shared/api-routes";
import type { Asset, Supplier } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Wrench } from "lucide-react";

const REPAIR_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const ASSET_CONDITIONS = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Non-Functional",
];

export default function AssetRepairFormPage() {
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const { toast } = useToast();

  const params = new URLSearchParams(searchParams);
  const assetId = params.get("assetId") || "";
  const editId = params.get("editId") || "";

  const { data: asset, isLoading: assetLoading } = useQuery<Asset>({
    queryKey: [ASSET_ROUTES.BY_ID(assetId), assetId],
    enabled: !!assetId,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: repairNumber } = useQuery<{ repairNumber: string }>({
    queryKey: [ASSET_ROUTES.NEXT_REPAIR_NUMBER],
    enabled: !editId,
  });

  const { data: existingRepair, isLoading: editLoading } = useQuery<any>({
    queryKey: [ASSET_ROUTES.REPAIR_REQUEST_BY_ID(editId), editId],
    enabled: !!editId,
  });

  const [formData, setFormData] = useState({
    title: "",
    issueDescription: "",
    repairDetails: "",
    priority: "MEDIUM",
    desiredServiceDate: "",
    vendorId: "",
    vendorNotes: "",
    estimatedCost: "",
    assetLocation: "",
    assetConditionBefore: "",
    notes: "",
  });

  useEffect(() => {
    if (existingRepair) {
      setFormData({
        title: existingRepair.title || "",
        issueDescription: existingRepair.issueDescription || "",
        repairDetails: existingRepair.repairDetails || "",
        priority: existingRepair.priority || "MEDIUM",
        desiredServiceDate: existingRepair.desiredServiceDate || "",
        vendorId: existingRepair.vendorId || "",
        vendorNotes: existingRepair.vendorNotes || "",
        estimatedCost: existingRepair.estimatedCost || "",
        assetLocation: existingRepair.assetLocation || "",
        assetConditionBefore: existingRepair.assetConditionBefore || "",
        notes: existingRepair.notes || "",
      });
    } else if (asset) {
      setFormData((prev) => ({
        ...prev,
        assetLocation: prev.assetLocation || asset.location || "",
        assetConditionBefore: prev.assetConditionBefore || asset.condition || "",
      }));
    }
  }, [existingRepair, asset]);

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        assetId,
        vendorId: formData.vendorId || null,
        estimatedCost: formData.estimatedCost || null,
        desiredServiceDate: formData.desiredServiceDate || null,
      };
      if (editId) {
        await apiRequest("PUT", ASSET_ROUTES.REPAIR_REQUEST_BY_ID(editId), payload);
      } else {
        await apiRequest("POST", ASSET_ROUTES.REPAIR_REQUESTS, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.REPAIR_REQUESTS] });
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.REPAIR_REQUESTS_BY_ASSET(assetId)] });
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.LIST] });
      queryClient.invalidateQueries({ queryKey: [ASSET_ROUTES.BY_ID(assetId)] });
      toast({ title: editId ? "Repair request updated" : "Repair request created" });
      navigate("/admin/asset-register");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!formData.issueDescription.trim()) {
      toast({ title: "Issue description is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  if (assetLoading || editLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/asset-register")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {editId ? "Edit Repair Request" : "New Service / Repair Request"}
          </h1>
          {asset && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-asset-subtitle">
              {asset.name} {asset.assetTag ? `(${asset.assetTag})` : ""}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {!editId && repairNumber && (
              <Badge variant="outline" data-testid="badge-repair-number">
                {repairNumber.repairNumber}
              </Badge>
            )}
            {editId && existingRepair?.repairNumber && (
              <Badge variant="outline" data-testid="badge-repair-number">
                {existingRepair.repairNumber}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {asset && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Asset Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Asset</Label>
                <p data-testid="text-asset-name">{asset.name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Asset Tag</Label>
                <p data-testid="text-asset-tag">{asset.assetTag}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <p data-testid="text-asset-category">{asset.category || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Location</Label>
                <p data-testid="text-asset-location">{asset.location || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Condition</Label>
                <p data-testid="text-asset-condition">{asset.condition || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Current Value</Label>
                <p data-testid="text-asset-value">
                  {asset.currentValue
                    ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(asset.currentValue))
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Engine oil leak repair"
                data-testid="input-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => update("priority", v)}>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {REPAIR_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issueDescription">Issue Description *</Label>
            <Textarea
              id="issueDescription"
              value={formData.issueDescription}
              onChange={(e) => update("issueDescription", e.target.value)}
              placeholder="Describe the issue or reason for service..."
              rows={4}
              data-testid="input-issue-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repairDetails">Repair / Service Details</Label>
            <Textarea
              id="repairDetails"
              value={formData.repairDetails}
              onChange={(e) => update("repairDetails", e.target.value)}
              placeholder="Specific repairs or service required..."
              rows={3}
              data-testid="input-repair-details"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="desiredServiceDate">Desired Service Date</Label>
              <Input
                id="desiredServiceDate"
                type="date"
                value={formData.desiredServiceDate}
                onChange={(e) => update("desiredServiceDate", e.target.value)}
                data-testid="input-desired-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Estimated Cost ($)</Label>
              <Input
                id="estimatedCost"
                type="number"
                step="0.01"
                value={formData.estimatedCost}
                onChange={(e) => update("estimatedCost", e.target.value)}
                placeholder="0.00"
                data-testid="input-estimated-cost"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor & Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendorId">Vendor / Service Provider</Label>
              <Select value={formData.vendorId || "none"} onValueChange={(v) => update("vendorId", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-vendor">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vendor selected</SelectItem>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetLocation">Asset Location</Label>
              <Input
                id="assetLocation"
                value={formData.assetLocation}
                onChange={(e) => update("assetLocation", e.target.value)}
                placeholder="Current asset location"
                data-testid="input-asset-location"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendorNotes">Vendor Notes</Label>
            <Textarea
              id="vendorNotes"
              value={formData.vendorNotes}
              onChange={(e) => update("vendorNotes", e.target.value)}
              placeholder="Notes for the vendor..."
              rows={2}
              data-testid="input-vendor-notes"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assetConditionBefore">Asset Condition (Before Service)</Label>
            <Select value={formData.assetConditionBefore} onValueChange={(v) => update("assetConditionBefore", v)}>
              <SelectTrigger data-testid="select-condition-before">
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              data-testid="input-notes"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => navigate("/admin/asset-register")}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saveMutation.isPending}
          data-testid="button-save-repair"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {editId ? "Update Request" : "Create Request"}
        </Button>
      </div>
    </div>
  );
}
