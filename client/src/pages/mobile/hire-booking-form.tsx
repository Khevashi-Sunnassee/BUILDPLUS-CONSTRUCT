import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { HIRE_ROUTES, PROCUREMENT_ROUTES, JOBS_ROUTES, EMPLOYEE_ROUTES, ASSET_ROUTES } from "@shared/api-routes";
import { ASSET_CATEGORIES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle,
  ChevronDown,
  Loader2,
  Package,
  Search,
  Truck,
  User,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Link } from "wouter";

interface Job {
  id: string;
  name: string;
  jobNumber: string;
  status: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Asset {
  id: string;
  name: string;
  assetTag: string;
  category: string;
  status: string;
  chargeOutRate?: string;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 text-base focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors";

const selectClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors appearance-none";

function FormField({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-white/70 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1" role="alert" aria-live="assertive">{error}</p>}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20">
        {icon}
      </div>
      <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">{title}</span>
    </div>
  );
}

export default function MobileHireBookingForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showRequestedByPicker, setShowRequestedByPicker] = useState(false);
  const [requestedBySearch, setRequestedBySearch] = useState("");
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");

  const [form, setForm] = useState({
    hireSource: "external" as "internal" | "external",
    equipmentDescription: "",
    assetCategoryIndex: 0,
    assetId: "",
    supplierId: "",
    supplierName: "",
    jobId: "",
    jobDisplay: "",
    requestedByUserId: "",
    requestedByDisplay: "",
    responsiblePersonUserId: "",
    hireStartDate: new Date().toISOString().split("T")[0],
    hireEndDate: new Date().toISOString().split("T")[0],
    rateType: "day" as "day" | "week" | "month" | "custom",
    rateAmount: "",
    quantity: "1",
    hireLocation: "",
    notes: "",
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: [JOBS_ROUTES.LIST],
  });

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: [PROCUREMENT_ROUTES.SUPPLIERS_EQUIPMENT_HIRE],
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: [EMPLOYEE_ROUTES.ACTIVE],
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: [ASSET_ROUTES.LIST_SIMPLE],
    enabled: form.hireSource === "internal",
  });

  const activeJobs = useMemo(() => jobs.filter(j => j.status === "ACTIVE" || j.status === "CONTRACTED"), [jobs]);
  const filteredJobs = useMemo(() => activeJobs.filter(j =>
    !jobSearch || j.name.toLowerCase().includes(jobSearch.toLowerCase()) || j.jobNumber.toLowerCase().includes(jobSearch.toLowerCase())
  ), [activeJobs, jobSearch]);

  const filteredSuppliers = useMemo(() => suppliers.filter(s =>
    !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  ), [suppliers, supplierSearch]);

  const filteredEmployees = useMemo(() => employees.filter(e =>
    !requestedBySearch || `${e.firstName} ${e.lastName}`.toLowerCase().includes(requestedBySearch.toLowerCase())
  ), [employees, requestedBySearch]);

  const activeAssets = useMemo(() => assets.filter(a => a.status === "active" || a.status === "ACTIVE"), [assets]);
  const filteredAssets = useMemo(() => activeAssets.filter(a =>
    !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.assetTag.toLowerCase().includes(assetSearch.toLowerCase())
  ), [activeAssets, assetSearch]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        hireSource: form.hireSource,
        equipmentDescription: form.equipmentDescription,
        assetCategoryIndex: form.assetCategoryIndex,
        jobId: form.jobId,
        requestedByUserId: form.requestedByUserId,
        responsiblePersonUserId: form.responsiblePersonUserId || form.requestedByUserId,
        hireStartDate: new Date(form.hireStartDate).toISOString(),
        hireEndDate: new Date(form.hireEndDate).toISOString(),
        rateType: form.rateType,
        rateAmount: form.rateAmount,
        quantity: parseInt(form.quantity) || 1,
        hireLocation: form.hireLocation || null,
        notes: form.notes || null,
      };

      if (form.hireSource === "external" && form.supplierId) {
        payload.supplierId = form.supplierId;
      }
      if (form.hireSource === "internal" && form.assetId) {
        payload.assetId = form.assetId;
      }

      return apiRequest("POST", HIRE_ROUTES.LIST, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIRE_ROUTES.LIST] });
      toast({ title: "Hire booking created" });
      navigate("/mobile/hire-bookings");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create booking", description: error.message, variant: "destructive" });
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.equipmentDescription.trim()) newErrors.equipmentDescription = "Equipment description is required";
    if (!form.jobId) newErrors.jobId = "Job is required";
    if (!form.requestedByUserId) newErrors.requestedByUserId = "Requested by is required";
    if (!form.rateAmount.trim()) newErrors.rateAmount = "Rate amount is required";
    if (!form.hireStartDate) newErrors.hireStartDate = "Start date is required";
    if (!form.hireEndDate) newErrors.hireEndDate = "End date is required";
    if (form.hireSource === "external" && !form.supplierId) newErrors.supplierId = "Supplier is required for external hire";
    if (form.hireSource === "internal" && !form.assetId) newErrors.assetId = "Asset is required for internal hire";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast({ title: "Please fix the errors", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  const handleSelectAsset = (asset: Asset) => {
    const catIndex = ASSET_CATEGORIES.indexOf(asset.category as any);
    setForm(f => ({
      ...f,
      assetId: asset.id,
      assetCategoryIndex: catIndex >= 0 ? catIndex : f.assetCategoryIndex,
      equipmentDescription: f.equipmentDescription || `${asset.name} (${asset.assetTag})`,
      rateAmount: f.rateAmount || asset.chargeOutRate || "",
    }));
    setShowAssetPicker(false);
    setAssetSearch("");
  };

  const selectedAsset = activeAssets.find(a => a.id === form.assetId);

  return (
    <div className="flex flex-col h-screen bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile Hire Booking Form">
      <div
        className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-4 flex items-center gap-3">
          <Link href="/mobile/hire-bookings">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 active:scale-[0.97]" data-testid="button-back">
              <ArrowLeft className="h-5 w-5 text-white/70" />
            </button>
          </Link>
          <div className="flex-1">
            <div className="text-lg font-bold" data-testid="text-form-title">Book Equipment</div>
            <div className="text-xs text-white/40">Create a new hire booking</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
        <SectionHeader icon={<Package className="h-4 w-4 text-blue-400" />} title="Equipment" />

        <div className="mb-4">
          <label className="block text-sm font-medium text-white/70 mb-1.5">Source</label>
          <div className="flex rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, hireSource: "external", assetId: "" }))}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                form.hireSource === "external" ? "bg-blue-500 text-white" : "text-white/50"
              }`}
              data-testid="button-source-external"
            >
              <Truck className="h-4 w-4" />
              External
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, hireSource: "internal", supplierId: "", supplierName: "" }))}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                form.hireSource === "internal" ? "bg-blue-500 text-white" : "text-white/50"
              }`}
              data-testid="button-source-internal"
            >
              <Package className="h-4 w-4" />
              Internal
            </button>
          </div>
        </div>

        {form.hireSource === "internal" && (
          <FormField label="Asset" required error={errors.assetId}>
            {showAssetPicker ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <input
                    type="text"
                    className={`${inputClass} pl-10`}
                    placeholder="Search assets..."
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    autoFocus
                    data-testid="input-asset-search"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                  {filteredAssets.length === 0 ? (
                    <div className="p-3 text-sm text-white/40 text-center">No assets found</div>
                  ) : (
                    filteredAssets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => handleSelectAsset(asset)}
                        className="w-full flex items-center gap-3 p-3 text-left border-b border-white/5 last:border-0 active:bg-white/10"
                        data-testid={`asset-option-${asset.id}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                          <Package className="h-4 w-4 text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">{asset.assetTag}</div>
                          <div className="text-xs text-white/50 truncate">{asset.name}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <button
                  className="text-sm text-white/50 w-full text-center py-1"
                  onClick={() => { setShowAssetPicker(false); setAssetSearch(""); }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${selectClass} text-left flex items-center justify-between`}
                onClick={() => setShowAssetPicker(true)}
                data-testid="button-select-asset"
              >
                <span className={selectedAsset ? "text-white" : "text-white/30"}>
                  {selectedAsset ? `${selectedAsset.assetTag} - ${selectedAsset.name}` : "Select an asset..."}
                </span>
                <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
              </button>
            )}
          </FormField>
        )}

        {form.hireSource === "external" && (
          <FormField label="Supplier" required error={errors.supplierId}>
            {showSupplierPicker ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <input
                    type="text"
                    className={`${inputClass} pl-10`}
                    placeholder="Search suppliers..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    autoFocus
                    data-testid="input-supplier-search"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                  {filteredSuppliers.length === 0 ? (
                    <div className="p-3 text-sm text-white/40 text-center">No suppliers found</div>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setForm(f => ({ ...f, supplierId: s.id, supplierName: s.name }));
                          setShowSupplierPicker(false);
                          setSupplierSearch("");
                        }}
                        className="w-full flex items-center gap-3 p-3 text-left border-b border-white/5 last:border-0 active:bg-white/10"
                        data-testid={`supplier-option-${s.id}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                          <Truck className="h-4 w-4 text-purple-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">{s.name}</div>
                        </div>
                        {form.supplierId === s.id && <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
                <button
                  className="text-sm text-white/50 w-full text-center py-1"
                  onClick={() => { setShowSupplierPicker(false); setSupplierSearch(""); }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${selectClass} text-left flex items-center justify-between`}
                onClick={() => setShowSupplierPicker(true)}
                data-testid="button-select-supplier"
              >
                <span className={form.supplierName ? "text-white" : "text-white/30"}>
                  {form.supplierName || "Select a supplier..."}
                </span>
                <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
              </button>
            )}
          </FormField>
        )}

        <FormField label="Equipment Description" required error={errors.equipmentDescription}>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. 20T Excavator with bucket"
            value={form.equipmentDescription}
            onChange={(e) => setForm(f => ({ ...f, equipmentDescription: e.target.value }))}
            aria-required="true"
            data-testid="input-description"
          />
        </FormField>

        <FormField label="Category">
          <div className="relative">
            <select
              className={selectClass}
              value={form.assetCategoryIndex}
              onChange={(e) => setForm(f => ({ ...f, assetCategoryIndex: parseInt(e.target.value) }))}
              data-testid="select-category"
            >
              {ASSET_CATEGORIES.map((cat, idx) => (
                <option key={idx} value={idx}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
          </div>
        </FormField>

        <SectionHeader icon={<Briefcase className="h-4 w-4 text-blue-400" />} title="Job & People" />

        <FormField label="Job" required error={errors.jobId}>
          {showJobPicker ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="text"
                  className={`${inputClass} pl-10`}
                  placeholder="Search jobs..."
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  autoFocus
                  data-testid="input-job-search"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                {filteredJobs.length === 0 ? (
                  <div className="p-3 text-sm text-white/40 text-center">No jobs found</div>
                ) : (
                  filteredJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => {
                        setForm(f => ({ ...f, jobId: job.id, jobDisplay: `${job.jobNumber} - ${job.name}` }));
                        setShowJobPicker(false);
                        setJobSearch("");
                      }}
                      className="w-full flex items-center gap-3 p-3 text-left border-b border-white/5 last:border-0 active:bg-white/10"
                      data-testid={`job-option-${job.id}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                        <Briefcase className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{job.jobNumber}</div>
                        <div className="text-xs text-white/50 truncate">{job.name}</div>
                      </div>
                      {form.jobId === job.id && <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />}
                    </button>
                  ))
                )}
              </div>
              <button
                className="text-sm text-white/50 w-full text-center py-1"
                onClick={() => { setShowJobPicker(false); setJobSearch(""); }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${selectClass} text-left flex items-center justify-between`}
              onClick={() => setShowJobPicker(true)}
              data-testid="button-select-job"
            >
              <span className={form.jobDisplay ? "text-white" : "text-white/30"}>
                {form.jobDisplay || "Select a job..."}
              </span>
              <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
            </button>
          )}
        </FormField>

        <FormField label="Requested By" required error={errors.requestedByUserId}>
          {showRequestedByPicker ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="text"
                  className={`${inputClass} pl-10`}
                  placeholder="Search employees..."
                  value={requestedBySearch}
                  onChange={(e) => setRequestedBySearch(e.target.value)}
                  autoFocus
                  data-testid="input-requestedby-search"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                {filteredEmployees.length === 0 ? (
                  <div className="p-3 text-sm text-white/40 text-center">No employees found</div>
                ) : (
                  filteredEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setForm(f => ({
                          ...f,
                          requestedByUserId: emp.id,
                          requestedByDisplay: `${emp.firstName} ${emp.lastName}`,
                          responsiblePersonUserId: f.responsiblePersonUserId || emp.id,
                        }));
                        setShowRequestedByPicker(false);
                        setRequestedBySearch("");
                      }}
                      className="w-full flex items-center gap-3 p-3 text-left border-b border-white/5 last:border-0 active:bg-white/10"
                      data-testid={`employee-option-${emp.id}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20">
                        <User className="h-4 w-4 text-green-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{emp.firstName} {emp.lastName}</div>
                      </div>
                      {form.requestedByUserId === emp.id && <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />}
                    </button>
                  ))
                )}
              </div>
              <button
                className="text-sm text-white/50 w-full text-center py-1"
                onClick={() => { setShowRequestedByPicker(false); setRequestedBySearch(""); }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${selectClass} text-left flex items-center justify-between`}
              onClick={() => setShowRequestedByPicker(true)}
              data-testid="button-select-requestedby"
            >
              <span className={form.requestedByDisplay ? "text-white" : "text-white/30"}>
                {form.requestedByDisplay || "Select employee..."}
              </span>
              <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
            </button>
          )}
        </FormField>

        <SectionHeader icon={<CalendarIcon className="h-4 w-4 text-blue-400" />} title="Dates & Rate" />

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start Date" required error={errors.hireStartDate}>
            <input
              type="date"
              className={inputClass}
              value={form.hireStartDate}
              onChange={(e) => setForm(f => ({ ...f, hireStartDate: e.target.value }))}
              aria-required="true"
              data-testid="input-start-date"
            />
          </FormField>
          <FormField label="End Date" required error={errors.hireEndDate}>
            <input
              type="date"
              className={inputClass}
              value={form.hireEndDate}
              onChange={(e) => setForm(f => ({ ...f, hireEndDate: e.target.value }))}
              aria-required="true"
              data-testid="input-end-date"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Rate Type">
            <div className="relative">
              <select
                className={selectClass}
                value={form.rateType}
                onChange={(e) => setForm(f => ({ ...f, rateType: e.target.value as any }))}
                data-testid="select-rate-type"
              >
                <option value="day">Per Day</option>
                <option value="week">Per Week</option>
                <option value="month">Per Month</option>
                <option value="custom">Custom</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
            </div>
          </FormField>
          <FormField label="Rate Amount" required error={errors.rateAmount}>
            <input
              type="number"
              className={inputClass}
              placeholder="0.00"
              value={form.rateAmount}
              onChange={(e) => setForm(f => ({ ...f, rateAmount: e.target.value }))}
              aria-required="true"
              data-testid="input-rate-amount"
              step="0.01"
              min="0"
            />
          </FormField>
        </div>

        <FormField label="Quantity">
          <input
            type="number"
            className={inputClass}
            value={form.quantity}
            onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
            min="1"
            data-testid="input-quantity"
          />
        </FormField>

        <FormField label="Location">
          <input
            type="text"
            className={inputClass}
            placeholder="Site or delivery location"
            value={form.hireLocation}
            onChange={(e) => setForm(f => ({ ...f, hireLocation: e.target.value }))}
            data-testid="input-location"
          />
        </FormField>

        <FormField label="Notes">
          <textarea
            className={`${inputClass} min-h-[80px] resize-none`}
            placeholder="Additional notes..."
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            data-testid="input-notes"
          />
        </FormField>

        <div className="pt-4">
          <Button
            className="w-full bg-blue-600"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            data-testid="button-submit-hire"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Hire Booking
              </>
            )}
          </Button>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
