import { UseFormReturn } from "react-hook-form";
import { format, addDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ExternalLink } from "lucide-react";
import type { Supplier } from "@shared/schema";
import type { FormValues, PurchaseOrderWithDetails } from "./types";

export interface SupplierDeliverySectionProps {
  form: UseFormReturn<FormValues>;
  canEdit: boolean;
  isNew: boolean;
  existingPO: PurchaseOrderWithDetails | undefined;
  suppliers: Supplier[];
  loadingSuppliers: boolean;
  handleSupplierChange: (supplierId: string) => void;
  effectiveCapexId: string | null;
  allCapexRequests: any[];
  setSelectedCapexId: (val: string | undefined) => void;
  setCapexManuallyCleared: (val: boolean) => void;
  navigate: (path: string) => void;
}

export function SupplierDeliverySection({
  form,
  canEdit,
  isNew,
  existingPO,
  suppliers,
  loadingSuppliers,
  handleSupplierChange,
  effectiveCapexId,
  allCapexRequests,
  setSelectedCapexId,
  setCapexManuallyCleared,
  navigate,
}: SupplierDeliverySectionProps) {
  return (
    <Form {...form} aria-label="Purchase order form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Supplier</Label>
            {canEdit ? (
              <Select
                value={form.watch("supplierId") || ""}
                onValueChange={handleSupplierChange}
                disabled={loadingSuppliers}
              >
                <SelectTrigger data-testid="select-supplier">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {[...suppliers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1" data-testid="text-supplier-name">
                {existingPO?.supplierName || "-"}
              </p>
            )}
          </div>

          <div className="pl-4 border-l-2 border-muted space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Contact</Label>
              {canEdit ? (
                <Input
                  value={form.watch("supplierContact") || ""}
                  onChange={(e) => form.setValue("supplierContact", e.target.value)}
                  placeholder="Contact name"
                  data-testid="input-supplier-contact"
                />
              ) : (
                <p className="text-sm">{existingPO?.supplierContact || "-"}</p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              {canEdit ? (
                <Input
                  type="email"
                  value={form.watch("supplierEmail") || ""}
                  onChange={(e) => form.setValue("supplierEmail", e.target.value)}
                  placeholder="Email address"
                  data-testid="input-supplier-email"
                />
              ) : (
                <p className="text-sm">{existingPO?.supplierEmail || "-"}</p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Phone</Label>
              {canEdit ? (
                <Input
                  value={form.watch("supplierPhone") || ""}
                  onChange={(e) => form.setValue("supplierPhone", e.target.value)}
                  placeholder="Phone number"
                  data-testid="input-supplier-phone"
                />
              ) : (
                <p className="text-sm">{existingPO?.supplierPhone || "-"}</p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Address</Label>
              {canEdit ? (
                <Textarea
                  value={form.watch("supplierAddress") || ""}
                  onChange={(e) => form.setValue("supplierAddress", e.target.value)}
                  placeholder="Supplier address"
                  className="min-h-[60px]"
                  data-testid="textarea-supplier-address"
                />
              ) : (
                <p className="text-sm whitespace-pre-line">{existingPO?.supplierAddress || "-"}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isNew && (
            <div>
              <Label className="text-sm font-medium">Link CAPEX Request</Label>
              <Select
                value={effectiveCapexId || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setSelectedCapexId(undefined);
                    setCapexManuallyCleared(true);
                  } else {
                    setSelectedCapexId(val);
                    setCapexManuallyCleared(false);
                  }
                }}
              >
                <SelectTrigger data-testid="select-capex-request">
                  <SelectValue placeholder="None (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {allCapexRequests
                    .filter((c: any) => c.status === "APPROVED" || c.status === "SUBMITTED")
                    .sort((a: any, b: any) => (b.capexNumber || "").localeCompare(a.capexNumber || ""))
                    .map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.capexNumber} — {c.equipmentTitle}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!isNew && (existingPO as any)?.capexRequestId && (
            <div>
              <Label className="text-sm font-medium">Linked CAPEX Request</Label>
              <div className="mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/capex-requests?open=${(existingPO as any).capexRequestId}`)}
                  data-testid="button-view-capex"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View CAPEX Request
                </Button>
              </div>
            </div>
          )}
          <div>
            <Label className="text-sm font-medium">Project Name</Label>
            {canEdit ? (
              <Input
                value={form.watch("projectName") || ""}
                onChange={(e) => form.setValue("projectName", e.target.value)}
                placeholder="Enter project name"
                aria-required="true"
                data-testid="input-project-name"
              />
            ) : (
              <p className="mt-1">{(existingPO as any)?.projectName || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-sm font-medium">Required By Date</Label>
            {canEdit ? (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-required-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("requiredByDate") 
                        ? format(form.watch("requiredByDate")!, "dd/MM/yyyy")
                        : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch("requiredByDate") || undefined}
                      onSelect={(date) => form.setValue("requiredByDate", date || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[7, 14, 30, 45].map((days) => {
                    const targetDate = addDays(new Date(), days);
                    const currentDate = form.watch("requiredByDate");
                    const isSelected = currentDate && 
                      format(currentDate, "yyyy-MM-dd") === format(targetDate, "yyyy-MM-dd");
                    return (
                      <Button
                        key={days}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => form.setValue("requiredByDate", targetDate)}
                        data-testid={`button-quick-date-${days}`}
                      >
                        {days} days
                      </Button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-1">
                {existingPO?.requiredByDate 
                  ? format(new Date(existingPO.requiredByDate), "dd/MM/yyyy")
                  : "-"}
              </p>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">Delivery Address</Label>
            {canEdit ? (
              <Textarea
                value={form.watch("deliveryAddress") || ""}
                onChange={(e) => form.setValue("deliveryAddress", e.target.value)}
                placeholder="Enter delivery address"
                className="min-h-[80px]"
                aria-required="true"
                data-testid="textarea-delivery-address"
              />
            ) : (
              <p className="mt-1 whitespace-pre-line">{existingPO?.deliveryAddress || "-"}</p>
            )}
          </div>

        </div>
      </div>
    </Form>
  );
}
