import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { dateInputProps } from "@/lib/validation";
import { PROCUREMENT_ROUTES, JOBS_ROUTES, PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import { useToast } from "@/hooks/use-toast";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { SuburbLookup } from "@/components/suburb-lookup";
import {
  ArrowLeft,
  MapPin,
  Users,
  DollarSign,
  BarChart3,
  Calendar,
  MessageSquare,
  Building2,
  Plus,
  Check,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import { Link } from "wouter";
import {
  SALES_STAGES,
  STAGE_STATUSES,
  STAGE_LABELS,
  OPPORTUNITY_TYPES,
  getDefaultStatus,
  type SalesStage,
} from "@shared/sales-pipeline";

interface Customer {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
}

interface JobType {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

const OPPORTUNITY_STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "NEGOTIATING", label: "Negotiating" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "ON_HOLD", label: "On Hold" },
];

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20">
        {icon}
      </div>
      <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">{title}</span>
    </div>
  );
}

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

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 text-base focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors";

const selectClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors appearance-none";

export default function MobileNewOpportunity() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    customerId: null as string | null,
    customerName: "",
    address: "",
    city: "",
    state: "",
    referrer: "",
    engineerOnJob: "",
    primaryContact: "",
    estimatedValue: "",
    numberOfBuildings: "",
    numberOfLevels: "",
    opportunityStatus: "NEW",
    salesStage: "OPPORTUNITY" as SalesStage,
    salesStatus: getDefaultStatus("OPPORTUNITY"),
    opportunityType: "",
    probability: "",
    estimatedStartDate: "",
    submissionDate: "",
    comments: "",
    jobTypeId: "",
  });

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: customers = [], isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: [PROCUREMENT_ROUTES.CUSTOMERS_ACTIVE],
  });

  const { data: jobTypes = [] } = useQuery<JobType[]>({
    queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_TYPES],
  });

  const createOpportunity = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", JOBS_ROUTES.OPPORTUNITIES, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JOBS_ROUTES.OPPORTUNITIES] });
      navigate("/mobile/jobs");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create opportunity",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createCustomer = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", PROCUREMENT_ROUTES.CUSTOMERS_QUICK, data);
      return res.json();
    },
    onSuccess: (customer: Customer) => {
      queryClient.invalidateQueries({ queryKey: [PROCUREMENT_ROUTES.CUSTOMERS_ACTIVE] });
      setForm((prev) => ({
        ...prev,
        customerId: customer.id,
        customerName: customer.name,
      }));
      setShowAddCustomer(false);
      setNewCustomer({ name: "", contactName: "", phone: "", email: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create customer",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Project name is required";
    if (!form.address.trim()) errs.address = "Address is required";
    if (!form.city.trim()) errs.city = "City / Suburb is required";
    if (!form.state) errs.state = "State is required";
    if (form.probability && (parseInt(form.probability) < 0 || parseInt(form.probability) > 100)) {
      errs.probability = "Must be 0-100";
    }
    if (form.submissionDate) {
      const subDate = new Date(form.submissionDate);
      if (isNaN(subDate.getTime())) {
        errs.submissionDate = "Invalid date/time";
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstErrorKey = Object.keys(errs)[0];
      const el = document.querySelector(`[data-testid="input-${firstErrorKey === "name" ? "project-name" : firstErrorKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast({
        title: "Please fix the errors",
        description: Object.values(errs).join(". "),
        variant: "destructive",
      });
    }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const data: any = {
      name: form.name,
      address: form.address,
      city: form.city,
      opportunityStatus: form.opportunityStatus,
      salesStage: form.salesStage,
      salesStatus: form.salesStatus,
    };

    if (form.customerId) data.customerId = form.customerId;
    if (form.state) data.state = form.state;
    if (form.referrer) data.referrer = form.referrer;
    if (form.engineerOnJob) data.engineerOnJob = form.engineerOnJob;
    if (form.primaryContact) data.primaryContact = form.primaryContact;
    if (form.estimatedValue) data.estimatedValue = form.estimatedValue;
    if (form.numberOfBuildings) data.numberOfBuildings = parseInt(form.numberOfBuildings);
    if (form.numberOfLevels) data.numberOfLevels = parseInt(form.numberOfLevels);
    if (form.opportunityType) data.opportunityType = form.opportunityType;
    if (form.probability) data.probability = parseInt(form.probability);
    if (form.estimatedStartDate) data.estimatedStartDate = form.estimatedStartDate;
    if (form.submissionDate) data.submissionDate = form.submissionDate;
    if (form.comments) data.comments = form.comments;
    if (form.jobTypeId) data.jobTypeId = form.jobTypeId;

    createOpportunity.mutate(data);
  };

  const filteredCustomers = useMemo(() => customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  ), [customers, customerSearch]);

  const activeJobTypes = useMemo(() => jobTypes.filter(jt => jt.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [jobTypes]);

  return (
    <div className="flex flex-col h-screen-safe bg-[#070B12] text-white overflow-hidden" role="main" aria-label="Mobile New Opportunity">
      <div
        className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur z-10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-4 flex items-center gap-3">
          <Link href="/mobile/more">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 active:scale-[0.97]" data-testid="button-back">
              <ArrowLeft className="h-5 w-5 text-white/70" />
            </button>
          </Link>
          <div className="flex-1">
            <div className="text-lg font-bold">New Opportunity</div>
            <div className="text-xs text-white/40">Quick entry for field sales</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-52 pt-4">
        {/* Project Name */}
        <FormField label="Project Name" required error={errors.name}>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Southbank Tower Development"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            aria-required="true"
            data-testid="input-project-name"
          />
        </FormField>

        {/* Customer Selection */}
        <FormField label="Customer / Builder">
          <div className="relative">
            <button
              type="button"
              className={`${selectClass} text-left flex items-center justify-between`}
              onClick={() => setShowCustomerSelect(true)}
              data-testid="button-select-customer"
            >
              <span className={form.customerName ? "text-white" : "text-white/30"}>
                {form.customerName || "Select a customer..."}
              </span>
              <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
            </button>
          </div>
        </FormField>

        {/* Job Type */}
        <FormField label="Job Type">
          <div className="relative">
            <select
              className={selectClass}
              value={form.jobTypeId}
              onChange={(e) => setForm((f) => ({ ...f, jobTypeId: e.target.value }))}
              data-testid="select-job-type"
            >
              <option value="" className="bg-[#0D1117]">Select job type...</option>
              {activeJobTypes.map((jt) => (
                <option key={jt.id} value={jt.id} className="bg-[#0D1117]">
                  {jt.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
          </div>
        </FormField>

        {/* Section 1: Location */}
        <div className="mt-6">
          <SectionHeader
            icon={<MapPin className="h-4 w-4 text-blue-400" />}
            title="Location"
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <FormField label="Job Address" required error={errors.address}>
              <input
                type="text"
                className={inputClass}
                placeholder="Site/project address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                aria-required="true"
                data-testid="input-address"
              />
            </FormField>
            <FormField label="City / Suburb" required error={errors.city}>
              <SuburbLookup
                value={form.city}
                onChange={(val) => setForm((f) => ({ ...f, city: val }))}
                onSelect={(result) => {
                  setForm((f) => ({ ...f, city: result.suburb, state: result.state }));
                }}
                placeholder="Start typing suburb..."
                className={inputClass}
                data-testid="input-city"
              />
            </FormField>
            <FormField label="State" required error={errors.state}>
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  data-testid="input-state"
                >
                  <option value="" className="bg-[#0D1117]">Select state...</option>
                  {STATES.map((s) => (
                    <option key={s} value={s} className="bg-[#0D1117]">
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              </div>
            </FormField>
          </div>
        </div>

        {/* Section 2: People */}
        <div className="mt-6">
          <SectionHeader
            icon={<Users className="h-4 w-4 text-emerald-400" />}
            title="People"
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <FormField label="Referrer">
              <input
                type="text"
                className={inputClass}
                placeholder="Who referred this opportunity"
                value={form.referrer}
                onChange={(e) => setForm((f) => ({ ...f, referrer: e.target.value }))}
                data-testid="input-referrer"
              />
            </FormField>
            <FormField label="Engineer on Job">
              <input
                type="text"
                className={inputClass}
                placeholder="Assigned engineer name"
                value={form.engineerOnJob}
                onChange={(e) => setForm((f) => ({ ...f, engineerOnJob: e.target.value }))}
                data-testid="input-engineer"
              />
            </FormField>
            <FormField label="Primary Contact">
              <input
                type="text"
                className={inputClass}
                placeholder="Main point of contact"
                value={form.primaryContact}
                onChange={(e) => setForm((f) => ({ ...f, primaryContact: e.target.value }))}
                data-testid="input-primary-contact"
              />
            </FormField>
          </div>
        </div>

        {/* Section 3: Financials & Scale */}
        <div className="mt-6">
          <SectionHeader
            icon={<DollarSign className="h-4 w-4 text-amber-400" />}
            title="Financials & Scale"
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <FormField label="Estimated Value (AUD)">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-base">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputClass} pl-8`}
                  placeholder="0.00"
                  value={form.estimatedValue}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))}
                  data-testid="input-estimated-value"
                />
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="No. of Buildings">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="0"
                  value={form.numberOfBuildings}
                  onChange={(e) => setForm((f) => ({ ...f, numberOfBuildings: e.target.value }))}
                  data-testid="input-buildings"
                />
              </FormField>
              <FormField label="No. of Levels">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="0"
                  value={form.numberOfLevels}
                  onChange={(e) => setForm((f) => ({ ...f, numberOfLevels: e.target.value }))}
                  data-testid="input-levels"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Section 4: Sales Pipeline */}
        <div className="mt-6">
          <SectionHeader
            icon={<BarChart3 className="h-4 w-4 text-purple-400" />}
            title="Sales Pipeline"
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <FormField label="Sales Stage">
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.salesStage}
                  onChange={(e) => {
                    const newStage = e.target.value as SalesStage;
                    setForm((f) => ({
                      ...f,
                      salesStage: newStage,
                      salesStatus: getDefaultStatus(newStage),
                    }));
                  }}
                  data-testid="select-sales-stage"
                >
                  {SALES_STAGES.map((stage) => (
                    <option key={stage} value={stage} className="bg-[#0D1117]">
                      {STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              </div>
            </FormField>
            <FormField label="Status">
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.salesStatus}
                  onChange={(e) => setForm((f) => ({ ...f, salesStatus: e.target.value }))}
                  data-testid="select-sales-status"
                >
                  {STAGE_STATUSES[form.salesStage]?.map((s) => (
                    <option key={s.value} value={s.value} className="bg-[#0D1117]">
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              </div>
            </FormField>
            <FormField label="Opportunity Type">
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.opportunityType}
                  onChange={(e) => setForm((f) => ({ ...f, opportunityType: e.target.value }))}
                  data-testid="select-opportunity-type"
                >
                  <option value="" className="bg-[#0D1117]">Select type...</option>
                  {OPPORTUNITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-[#0D1117]">
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              </div>
            </FormField>
            <FormField label="Probability (%)" error={errors.probability}>
              <div className="relative">
                <input
                  type="number"
                  className={inputClass}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.probability}
                  onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
                  data-testid="input-probability"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-base">%</span>
              </div>
              {form.probability && (
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, parseInt(form.probability) || 0))}%`,
                      background:
                        parseInt(form.probability) >= 70
                          ? "#22c55e"
                          : parseInt(form.probability) >= 40
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  />
                </div>
              )}
            </FormField>
          </div>
        </div>

        {/* Section 5: Timeline */}
        <div className="mt-6">
          <SectionHeader
            icon={<Calendar className="h-4 w-4 text-cyan-400" />}
            title="Timeline"
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <FormField label="Submission Date" error={errors.submissionDate}>
              <input
                type="datetime-local"
                className={`${inputClass} [color-scheme:dark]`}
                value={form.submissionDate}
                onChange={(e) => setForm((f) => ({ ...f, submissionDate: e.target.value }))}
                data-testid="input-submissionDate"
              />
              <p className="text-xs text-white/40 mt-1">When is the tender due for submission?</p>
            </FormField>
            <FormField label="Estimated Start Date">
              <input
                type="date"
                {...dateInputProps}
                className={`${inputClass} [color-scheme:dark]`}
                value={form.estimatedStartDate}
                onChange={(e) => setForm((f) => ({ ...f, estimatedStartDate: e.target.value }))}
                data-testid="input-start-date"
              />
            </FormField>
          </div>
        </div>

        {/* Section 6: Notes */}
        <div className="mt-6">
          <SectionHeader
            icon={<MessageSquare className="h-4 w-4 text-rose-400" />}
            title="Notes"
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <FormField label="Comments">
              <textarea
                className={`${inputClass} min-h-[100px] resize-none`}
                placeholder="Any additional notes about this opportunity..."
                value={form.comments}
                onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                data-testid="input-comments"
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* Fixed bottom submit button - positioned above nav with extra spacing */}
      <div className="fixed bottom-[4.5rem] left-0 right-0 z-20 border-t border-white/10 bg-[#0D1117]/95 backdrop-blur px-4 py-4">
        <button
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-base font-semibold text-white active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
          onClick={handleSubmit}
          disabled={createOpportunity.isPending}
          data-testid="button-submit-opportunity"
        >
          {createOpportunity.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Check className="h-5 w-5" />
          )}
          {createOpportunity.isPending ? "Creating..." : "Create Opportunity"}
        </button>
      </div>

      {/* Customer Select Sheet */}
      {showCustomerSelect && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#070B12]">
          <div
            className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="px-4 py-4 flex items-center gap-3">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 active:scale-[0.97]"
                onClick={() => {
                  setShowCustomerSelect(false);
                  setCustomerSearch("");
                }}
                data-testid="button-close-customer-select"
              >
                <X className="h-5 w-5 text-white/70" />
              </button>
              <div className="flex-1 text-lg font-bold">Select Customer</div>
              <button
                className="flex items-center gap-1.5 rounded-xl bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-400 active:scale-[0.97]"
                onClick={() => {
                  setShowCustomerSelect(false);
                  setShowAddCustomer(true);
                }}
                data-testid="button-add-new-customer"
              >
                <Plus className="h-4 w-4" />
                New
              </button>
            </div>
            <div className="px-4 pb-3">
              <input
                type="text"
                className={inputClass}
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                autoFocus
                data-testid="input-customer-search"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-2 pb-8">
            {form.customerId && (
              <button
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 mb-2 text-left active:scale-[0.99]"
                onClick={() => {
                  setForm((f) => ({ ...f, customerId: null, customerName: "" }));
                  setShowCustomerSelect(false);
                  setCustomerSearch("");
                }}
                data-testid="button-clear-customer"
              >
                <X className="h-4 w-4 text-white/40" />
                <span className="text-white/60">Clear selection</span>
              </button>
            )}
            {loadingCustomers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-white/40" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <div className="text-white/40 text-sm">No customers found</div>
                <button
                  className="mt-3 text-blue-400 text-sm font-medium"
                  onClick={() => {
                    setShowCustomerSelect(false);
                    setShowAddCustomer(true);
                  }}
                  data-testid="button-add-customer-empty"
                >
                  Add a new customer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left active:scale-[0.99] transition-colors ${
                      form.customerId === c.id
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        customerId: c.id,
                        customerName: c.name,
                      }));
                      setShowCustomerSelect(false);
                      setCustomerSearch("");
                    }}
                    data-testid={`button-customer-${c.id}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                      <Building2 className="h-5 w-5 text-white/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{c.name}</div>
                      {c.contactName && (
                        <div className="text-xs text-white/40 truncate">{c.contactName}</div>
                      )}
                    </div>
                    {form.customerId === c.id && (
                      <Check className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Customer Sheet */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#070B12]">
          <div
            className="flex-shrink-0 border-b border-white/10 bg-[#070B12]/95 backdrop-blur"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="px-4 py-4 flex items-center gap-3">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 active:scale-[0.97]"
                onClick={() => setShowAddCustomer(false)}
                data-testid="button-close-add-customer"
              >
                <ArrowLeft className="h-5 w-5 text-white/70" />
              </button>
              <div className="flex-1 text-lg font-bold">New Customer</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
            <FormField label="Company Name" required>
              <input
                type="text"
                className={inputClass}
                placeholder="Builder / company name"
                value={newCustomer.name}
                onChange={(e) =>
                  setNewCustomer((c) => ({ ...c, name: e.target.value }))
                }
                autoFocus
                data-testid="input-new-customer-name"
              />
            </FormField>
            <FormField label="Contact Name">
              <input
                type="text"
                className={inputClass}
                placeholder="Primary contact"
                value={newCustomer.contactName}
                onChange={(e) =>
                  setNewCustomer((c) => ({ ...c, contactName: e.target.value }))
                }
                data-testid="input-new-customer-contact"
              />
            </FormField>
            <FormField label="Phone">
              <input
                type="tel"
                className={inputClass}
                placeholder="Phone number"
                value={newCustomer.phone}
                onChange={(e) =>
                  setNewCustomer((c) => ({ ...c, phone: e.target.value }))
                }
                data-testid="input-new-customer-phone"
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                className={inputClass}
                placeholder="Email address"
                value={newCustomer.email}
                onChange={(e) =>
                  setNewCustomer((c) => ({ ...c, email: e.target.value }))
                }
                data-testid="input-new-customer-email"
              />
            </FormField>
            <button
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-base font-semibold text-white active:scale-[0.99] disabled:opacity-50 mt-4"
              onClick={() => {
                if (!newCustomer.name.trim()) {
                  toast({
                    title: "Company name is required",
                    variant: "destructive",
                  });
                  return;
                }
                createCustomer.mutate(newCustomer);
              }}
              disabled={createCustomer.isPending}
              data-testid="button-save-customer"
            >
              {createCustomer.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              {createCustomer.isPending ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
