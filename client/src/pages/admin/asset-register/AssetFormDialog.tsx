import { useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateInputProps } from "@/lib/validation";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_CONDITIONS,
  ASSET_FUNDING_METHODS,
  ASSET_TRANSPORT_TYPES,
} from "@shared/schema";
import type { AssetFormDialogProps } from "./types";

function FormSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border rounded-md">
      <button
        type="button"
        className="flex items-center gap-2 w-full p-3 cursor-pointer font-medium text-sm text-left"
        onClick={() => setOpen(!open)}
        data-testid={`section-toggle-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        {title}
      </button>
      {open && (
        <div className="p-4 pt-0 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function AssetFormDialog({
  dialogOpen,
  setDialogOpen,
  editingAsset,
  form,
  onSubmit,
  createMutation,
  updateMutation,
  suppliersList,
  activeDepartments,
  watchedFundingMethod,
}: AssetFormDialogProps) {
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
          <DialogDescription>
            {editingAsset ? "Update the asset details below." : "Fill in the details to create a new asset."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormSection title="General Information" defaultOpen>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-asset-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-asset-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSET_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-asset-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-quantity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSET_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSET_CONDITIONS.map((c) => (
                            <SelectItem key={c} value={c} className="capitalize">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fundingMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funding Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-funding-method">
                            <SelectValue placeholder="Select funding method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSET_FUNDING_METHODS.map((f) => (
                            <SelectItem key={f} value={f} className="capitalize">
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-asset-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={(v) => field.onChange(v === "none" ? null : v)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No department</SelectItem>
                          {activeDepartments.slice().sort((a, b) => a.name.localeCompare(b.name)).map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-assigned-to" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-asset-remarks" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection title="Purchase & Supplier">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(val) => {
                          if (val === "none") {
                            field.onChange("");
                            form.setValue("supplier", "");
                          } else {
                            field.onChange(val);
                            const selected = suppliersList.find(s => s.id === val);
                            if (selected) form.setValue("supplier", selected.name);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-supplier">
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Supplier</SelectItem>
                          {suppliersList.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} data-testid="input-asset-purchase-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...dateInputProps} {...field} data-testid="input-asset-purchase-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="warrantyExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warranty Expiry</FormLabel>
                      <FormControl>
                        <Input type="date" {...dateInputProps} {...field} data-testid="input-asset-warranty-expiry" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            <FormSection title="Depreciation & Valuation">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Value</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} data-testid="input-asset-current-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="usefulLifeYears"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Useful Life (Years)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-useful-life" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="depreciationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={(() => {
                          const v = field.value;
                          if (!v) return v;
                          const lower = v.toLowerCase().replace(/\s+/g, "_");
                          if (lower === "straight_line") return "straight_line";
                          if (lower === "diminishing_value") return "diminishing_value";
                          if (lower === "units_of_production") return "units_of_production";
                          return v;
                        })()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-depreciation-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="straight_line">Straight Line</SelectItem>
                          <SelectItem value="diminishing_value">Diminishing Value</SelectItem>
                          <SelectItem value="units_of_production">Units of Production</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="depreciationRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Rate</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} data-testid="input-asset-depreciation-rate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="accumulatedDepreciation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accumulated Depreciation</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} data-testid="input-asset-accumulated-depreciation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="depreciationThisPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation This Period</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} data-testid="input-asset-depreciation-this-period" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bookValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Book Value</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} data-testid="input-asset-book-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="yearsDepreciated"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years Depreciated</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-years-depreciated" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            <FormSection title="Identification & Specifications">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manufacturer</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-manufacturer" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-model" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-serial-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-registration-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="engineNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Engine Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-engine-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vinNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VIN Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-vin-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="yearOfManufacture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year of Manufacture</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-year-of-manufacture" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="countryOfOrigin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country of Origin</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-country-of-origin" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="specifications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specifications</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-asset-specifications" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="operatingHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operating Hours</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-operating-hours" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-asset-barcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            {(watchedFundingMethod === "leased" || watchedFundingMethod === "financed") && (
              <FormSection title={watchedFundingMethod === "leased" ? "Lease Details" : "Finance Details"}>
                {watchedFundingMethod === "leased" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="lessor" render={({ field }) => (<FormItem><FormLabel>Lessor</FormLabel><FormControl><Input {...field} data-testid="input-asset-lessor" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="leaseTerm" render={({ field }) => (<FormItem><FormLabel>Lease Term (Months)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-lease-term" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="leaseStartDate" render={({ field }) => (<FormItem><FormLabel>Lease Start</FormLabel><FormControl><Input type="date" {...field} data-testid="input-asset-lease-start" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="leaseEndDate" render={({ field }) => (<FormItem><FormLabel>Lease End</FormLabel><FormControl><Input type="date" {...field} data-testid="input-asset-lease-end" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="leaseMonthlyPayment" render={({ field }) => (<FormItem><FormLabel>Monthly Payment</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-lease-payment" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="balloonPayment" render={({ field }) => (<FormItem><FormLabel>Balloon Payment</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-balloon-payment" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </>
                )}
                {watchedFundingMethod === "financed" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="lender" render={({ field }) => (<FormItem><FormLabel>Lender</FormLabel><FormControl><Input {...field} data-testid="input-asset-lender" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="loanTerm" render={({ field }) => (<FormItem><FormLabel>Loan Term (Months)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid="input-asset-loan-term" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="loanAmount" render={({ field }) => (<FormItem><FormLabel>Loan Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-loan-amount" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Interest Rate (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-interest-rate" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </>
                )}
              </FormSection>
            )}

            <FormSection title="Insurance">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="insuranceProvider" render={({ field }) => (<FormItem><FormLabel>Provider</FormLabel><FormControl><Input {...field} data-testid="input-asset-insurance-provider" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="insurancePolicyNumber" render={({ field }) => (<FormItem><FormLabel>Policy Number</FormLabel><FormControl><Input {...field} data-testid="input-asset-insurance-policy-number" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="insurancePremium" render={({ field }) => (<FormItem><FormLabel>Premium</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-insurance-premium" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="insuranceExcess" render={({ field }) => (<FormItem><FormLabel>Excess</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-asset-insurance-excess" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="insuranceStartDate" render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-asset-insurance-start-date" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="insuranceExpiryDate" render={({ field }) => (<FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-asset-insurance-expiry-date" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField
                control={form.control}
                name="insuranceStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-asset-insurance-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="insuranceNotes" render={({ field }) => (<FormItem><FormLabel>Insurance Notes</FormLabel><FormControl><Textarea {...field} data-testid="input-asset-insurance-notes" /></FormControl><FormMessage /></FormItem>)} />
            </FormSection>

            <FormSection title="Booking & Transport">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isBookable"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Bookable Asset</FormLabel>
                        <p className="text-sm text-muted-foreground">This asset can be booked for use</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-asset-bookable"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requiresTransport"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Requires Transport</FormLabel>
                        <p className="text-sm text-muted-foreground">Needs transport when moved</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-asset-requires-transport"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              {form.watch("requiresTransport") && (
                <FormField
                  control={form.control}
                  name="transportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transport Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-transport-type">
                            <SelectValue placeholder="Select transport type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSET_TRANSPORT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </FormSection>

            <FormSection title="CAPEX">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="capexRequestId" render={({ field }) => (<FormItem><FormLabel>CAPEX Request ID</FormLabel><FormControl><Input {...field} data-testid="input-asset-capex-request-id" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="capexDescription" render={({ field }) => (<FormItem><FormLabel>CAPEX Description</FormLabel><FormControl><Textarea {...field} data-testid="input-asset-capex-description" /></FormControl><FormMessage /></FormItem>)} />
            </FormSection>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel-asset"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-asset"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingAsset ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
