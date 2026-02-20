import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Star,
  Camera,
  Upload,
  X,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { dateInputProps } from "@/lib/validation";
import { ASSET_ROUTES } from "@shared/api-routes";
import type { ChecklistField, ChecklistFieldOption } from "@shared/schema";

type SimpleAsset = {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  registrationNumber: string | null;
};

interface FieldRendererProps {
  field: ChecklistField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  onAssetSelected?: (asset: SimpleAsset, sourceFieldId?: string) => void;
}

export function TextField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <Input
      placeholder={field.placeholder || ""}
      value={(value as string) || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      data-testid={`field-input-${field.id}`}
    />
  );
}

export function TextareaField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <Textarea
      placeholder={field.placeholder || ""}
      value={(value as string) || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={4}
      data-testid={`field-textarea-${field.id}`}
    />
  );
}

export function NumberField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <Input
      type="number"
      placeholder={field.placeholder || ""}
      value={(value as number) ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled}
      min={field.min ?? undefined}
      max={field.max ?? undefined}
      step={field.step ?? undefined}
      data-testid={`field-number-${field.id}`}
    />
  );
}

export function RadioButtonField({ field, value, onChange, disabled }: FieldRendererProps) {
  const options = field.options || [];
  return (
    <RadioGroup
      value={(value as string) || ""}
      onValueChange={onChange}
      disabled={disabled}
      data-testid={`field-radio-${field.id}`}
    >
      {options.map((option: ChecklistFieldOption) => (
        <div key={option.value} className="flex items-center space-x-2">
          <RadioGroupItem value={option.value} id={`${field.id}-${option.value}`} data-testid={`radio-${field.id}-${option.value}`} />
          <Label htmlFor={`${field.id}-${option.value}`}>{option.text}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}

export function DropdownField({ field, value, onChange, disabled }: FieldRendererProps) {
  const options = field.options || [];
  return (
    <Select
      value={(value as string) || ""}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger data-testid={`field-dropdown-${field.id}`}>
        <SelectValue placeholder={field.placeholder || "Select an option"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option: ChecklistFieldOption) => (
          <SelectItem key={option.value} value={option.value} data-testid={`option-${field.id}-${option.value}`}>
            {option.text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CheckboxField({ field, value, onChange, disabled }: FieldRendererProps) {
  const options = field.options || [];
  const selectedValues = (value as string[]) || [];

  const toggleOption = (optionValue: string) => {
    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter((v) => v !== optionValue));
    } else {
      onChange([...selectedValues, optionValue]);
    }
  };

  return (
    <div className="space-y-2" data-testid={`field-checkbox-${field.id}`}>
      {options.map((option: ChecklistFieldOption) => (
        <div key={option.value} className="flex items-center space-x-2">
          <Checkbox
            id={`${field.id}-${option.value}`}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => toggleOption(option.value)}
            disabled={disabled}
            data-testid={`checkbox-${field.id}-${option.value}`}
          />
          <Label htmlFor={`${field.id}-${option.value}`}>{option.text}</Label>
        </div>
      ))}
    </div>
  );
}

export function PassFailField({ field, value, onChange, disabled }: FieldRendererProps) {
  const currentValue = value as string | null;
  return (
    <div className="flex items-center gap-2" data-testid={`field-passfail-${field.id}`}>
      <Button
        type="button"
        variant={currentValue === "pass" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("pass")}
        disabled={disabled}
        className="toggle-elevate"
        data-testid={`button-pass-${field.id}`}
      >
        <CheckCircle className="h-4 w-4 mr-1" />
        Pass
      </Button>
      <Button
        type="button"
        variant={currentValue === "fail" ? "destructive" : "outline"}
        size="sm"
        onClick={() => onChange("fail")}
        disabled={disabled}
        className="toggle-elevate"
        data-testid={`button-fail-${field.id}`}
      >
        <XCircle className="h-4 w-4 mr-1" />
        Fail
      </Button>
    </div>
  );
}

export function YesNoNaField({ field, value, onChange, disabled }: FieldRendererProps) {
  const currentValue = value as string | null;
  return (
    <div className="flex items-center gap-2" data-testid={`field-yesnona-${field.id}`}>
      <Button
        type="button"
        variant={currentValue === "yes" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("yes")}
        disabled={disabled}
        className="toggle-elevate"
        data-testid={`button-yes-${field.id}`}
      >
        Yes
      </Button>
      <Button
        type="button"
        variant={currentValue === "no" ? "destructive" : "outline"}
        size="sm"
        onClick={() => onChange("no")}
        disabled={disabled}
        className="toggle-elevate"
        data-testid={`button-no-${field.id}`}
      >
        No
      </Button>
      <Button
        type="button"
        variant={currentValue === "na" ? "secondary" : "outline"}
        size="sm"
        onClick={() => onChange("na")}
        disabled={disabled}
        className="toggle-elevate"
        data-testid={`button-na-${field.id}`}
      >
        N/A
      </Button>
    </div>
  );
}

export function ConditionField({ field, value, onChange, disabled }: FieldRendererProps) {
  const currentValue = value as string | null;
  const defaultConditions = [
    { value: "good", label: "Good", variant: "default" as const },
    { value: "fair", label: "Fair", variant: "secondary" as const },
    { value: "poor", label: "Poor", variant: "destructive" as const },
    { value: "na", label: "N/A", variant: "outline" as const },
  ];

  const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    good: "default",
    fair: "secondary",
    poor: "destructive",
    na: "outline",
  };

  const conditions = (field.options && field.options.length > 0)
    ? field.options.map((opt, idx) => ({
        value: opt.value,
        label: opt.text || opt.value,
        variant: (variantMap[opt.value] || (idx === 0 ? "default" : idx < field.options!.length - 1 ? "secondary" : "outline")) as "default" | "secondary" | "destructive" | "outline",
      }))
    : defaultConditions;

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid={`field-condition-${field.id}`}>
      {conditions.map((condition) => (
        <Button
          key={condition.value}
          type="button"
          variant={currentValue === condition.value ? condition.variant : "outline"}
          size="sm"
          onClick={() => onChange(condition.value)}
          disabled={disabled}
          className="toggle-elevate"
          data-testid={`button-condition-${condition.value}-${field.id}`}
        >
          {condition.label}
        </Button>
      ))}
    </div>
  );
}

export function InspectionCheckField({ field, value, onChange, disabled }: FieldRendererProps) {
  const isChecked = value === true;
  return (
    <div className="flex items-center space-x-2" data-testid={`field-inspection-${field.id}`}>
      <Checkbox
        id={`${field.id}-check`}
        checked={isChecked}
        onCheckedChange={(checked) => onChange(checked)}
        disabled={disabled}
        data-testid={`checkbox-inspection-${field.id}`}
      />
      <Label htmlFor={`${field.id}-check`}>Checked / Verified</Label>
    </div>
  );
}

export function DateField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <Input
      type="date"
      {...dateInputProps}
      value={(value as string) || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      data-testid={`field-date-${field.id}`}
    />
  );
}

export function TimeField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <Input
      type="time"
      value={(value as string) || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      data-testid={`field-time-${field.id}`}
    />
  );
}

export function DateTimeField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <Input
      type="datetime-local"
      value={(value as string) || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      data-testid={`field-datetime-${field.id}`}
    />
  );
}

export function AmountField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
      <Input
        type="number"
        placeholder="0.00"
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled}
        step="0.01"
        min="0"
        className="pl-7"
        data-testid={`field-amount-${field.id}`}
      />
    </div>
  );
}

export function PercentageField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <div className="relative">
      <Input
        type="number"
        placeholder="0"
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled}
        min={field.min ?? 0}
        max={field.max ?? 100}
        step="0.01"
        className="pr-8"
        data-testid={`field-percentage-${field.id}`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
    </div>
  );
}

export function PriorityField({ field, value, onChange, disabled }: FieldRendererProps) {
  const priorities = [
    { value: "low", label: "Low", variant: "secondary" as const },
    { value: "medium", label: "Medium", variant: "default" as const },
    { value: "high", label: "High", variant: "destructive" as const },
  ];
  const currentValue = value as string | null;

  return (
    <div className="flex items-center gap-2" data-testid={`field-priority-${field.id}`}>
      {priorities.map((priority) => (
        <Badge
          key={priority.value}
          variant={currentValue === priority.value ? priority.variant : "outline"}
          className={cn("cursor-pointer", disabled && "pointer-events-none opacity-50")}
          onClick={() => !disabled && onChange(priority.value)}
          data-testid={`badge-priority-${priority.value}-${field.id}`}
        >
          {priority.label}
        </Badge>
      ))}
    </div>
  );
}

export function RatingField({ field, value, onChange, disabled }: FieldRendererProps) {
  const max = field.max ?? 5;
  const currentValue = (value as number) || 0;

  return (
    <div className="flex items-center gap-1" data-testid={`field-rating-${field.id}`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => !disabled && onChange(rating)}
          disabled={disabled}
          className="focus:outline-none"
          data-testid={`button-rating-${rating}-${field.id}`}
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              rating <= currentValue ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function PhotoField({ field, value, onChange, disabled }: FieldRendererProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPreview(base64);
        onChange({ filename: file.name, base64, type: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2" data-testid={`field-photo-${field.id}`}>
      {preview ? (
        <div className="relative w-32 h-32">
          <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-md" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
            data-testid={`button-remove-photo-${field.id}`}
          >
            ×
          </Button>
        </div>
      ) : (
        <label className={cn(
          "flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}>
          <Camera className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground">Add Photo</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
      )}
    </div>
  );
}

export function MultiPhotoField({ field, value, onChange, disabled }: FieldRendererProps) {
  const photos = (value as Array<{ filename: string; base64: string; type: string }>) || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newPhoto = { filename: file.name, base64, type: file.type };
        onChange([...photos, newPhoto]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2" data-testid={`field-multiphoto-${field.id}`}>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div key={index} className="relative w-24 h-24">
            <img src={photo.base64} alt={photo.filename} className="w-full h-full object-cover rounded-md" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2"
              onClick={() => removePhoto(index)}
              disabled={disabled}
              data-testid={`button-remove-photo-${field.id}-${index}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <label className={cn(
          "flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}>
          <Camera className="h-6 w-6 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Add</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
            data-testid={`input-multiphoto-${field.id}`}
          />
        </label>
      </div>
      {photos.length > 0 && (
        <p className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""} added</p>
      )}
    </div>
  );
}

export function ProgressBarField({ field, value, onChange, disabled }: FieldRendererProps) {
  const currentValue = (value as number) ?? 0;
  const min = field.min ?? 0;
  const max = field.max ?? 100;

  return (
    <div className="space-y-2" data-testid={`field-progress-${field.id}`}>
      <div className="flex items-center gap-3">
        <Input
          type="range"
          min={min}
          max={max}
          value={currentValue}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="flex-1"
        />
        <span className="text-sm font-medium w-12 text-right">{currentValue}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary rounded-full h-2 transition-all"
          style={{ width: `${max === min ? 0 : Math.min(100, Math.max(0, ((currentValue - min) / (max - min)) * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function MeasurementField({ field, value, onChange, disabled }: FieldRendererProps) {
  const measurementValue = (value as { amount: number | null; unit: string }) || { amount: null, unit: "" };

  return (
    <div className="flex items-center gap-2" data-testid={`field-measurement-${field.id}`}>
      <Input
        type="number"
        placeholder="Value"
        value={measurementValue.amount ?? ""}
        onChange={(e) => onChange({
          ...measurementValue,
          amount: e.target.value ? Number(e.target.value) : null,
        })}
        disabled={disabled}
        min={field.min ?? undefined}
        max={field.max ?? undefined}
        step={field.step ?? undefined}
        className="flex-1"
      />
      <Select
        value={measurementValue.unit || ""}
        onValueChange={(unit) => onChange({ ...measurementValue, unit })}
        disabled={disabled}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Unit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mm">mm</SelectItem>
          <SelectItem value="cm">cm</SelectItem>
          <SelectItem value="m">m</SelectItem>
          <SelectItem value="in">in</SelectItem>
          <SelectItem value="ft">ft</SelectItem>
          <SelectItem value="kg">kg</SelectItem>
          <SelectItem value="t">t</SelectItem>
          <SelectItem value="L">L</SelectItem>
          <SelectItem value="m3">m³</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function FileUploadField({ field, value, onChange, disabled }: FieldRendererProps) {
  const fileInfo = value as { filename: string } | null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onChange({ filename: file.name, base64, type: file.type, size: file.size });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2" data-testid={`field-file-${field.id}`}>
      {fileInfo ? (
        <div className="flex items-center gap-2 p-2 border rounded-md">
          <span className="text-sm truncate flex-1">{fileInfo.filename}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            data-testid={`button-remove-file-${field.id}`}
          >
            Remove
          </Button>
        </div>
      ) : (
        <label className={cn(
          "flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}>
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Upload File</span>
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
      )}
    </div>
  );
}

export function SignatureField({ field, value, onChange, disabled }: FieldRendererProps) {
  const signatureData = value as { name: string; date: string } | null;

  if (signatureData) {
    return (
      <div className="p-4 border rounded-md bg-muted/20" data-testid={`field-signature-${field.id}`}>
        <div className="text-sm font-medium">Signed by: {signatureData.name}</div>
        <div className="text-xs text-muted-foreground">Date: {signatureData.date}</div>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => onChange(null)}
            data-testid={`button-clear-signature-${field.id}`}
          >
            Clear Signature
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        const name = prompt("Enter your name to sign:");
        if (name) {
          onChange({ name, date: new Date().toISOString() });
        }
      }}
      disabled={disabled}
      data-testid={`field-signature-${field.id}`}
    >
      Click to Sign
    </Button>
  );
}

export function AssetSelectorField({ field, value, onChange, disabled, onAssetSelected }: FieldRendererProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: assets = [], isLoading } = useQuery<SimpleAsset[]>({
    queryKey: [ASSET_ROUTES.LIST_SIMPLE],
  });

  const selectedAsset = assets.find(a => a.id === value);
  const q = searchQuery.toLowerCase().trim();
  const filteredAssets = q
    ? assets.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.assetTag.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.serialNumber || "").toLowerCase().includes(q) ||
        (a.manufacturer || "").toLowerCase().includes(q) ||
        (a.model || "").toLowerCase().includes(q)
      )
    : assets;

  if (selectedAsset) {
    return (
      <div className="space-y-2" data-testid={`field-asset-${field.id}`}>
        <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{selectedAsset.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">{selectedAsset.assetTag}</Badge>
              <Badge variant="secondary" className="text-xs">{selectedAsset.category}</Badge>
              {selectedAsset.serialNumber && (
                <span className="text-xs text-muted-foreground">S/N: {selectedAsset.serialNumber}</span>
              )}
            </div>
          </div>
          {!disabled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange("")}
              data-testid={`clear-asset-${field.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid={`field-asset-${field.id}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search assets by name, tag, serial..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          disabled={disabled}
          data-testid={`search-asset-${field.id}`}
        />
      </div>
      <div className="max-h-48 overflow-y-auto border rounded-md">
        {isLoading ? (
          <div className="p-3 text-sm text-muted-foreground text-center">Loading assets...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground text-center">
            {q ? "No matching assets" : "No assets available"}
          </div>
        ) : (
          filteredAssets.map(asset => (
            <button
              key={asset.id}
              onClick={() => {
                onChange(asset.id);
                onAssetSelected?.(asset, field.id);
                setSearchQuery("");
              }}
              disabled={disabled}
              className="w-full text-left px-3 py-2 hover-elevate border-b last:border-b-0 flex items-center gap-2"
              data-testid={`asset-option-${asset.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{asset.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{asset.assetTag}</span>
                  <span className="text-xs text-muted-foreground">{asset.category}</span>
                  {asset.serialNumber && (
                    <span className="text-xs text-muted-foreground">S/N: {asset.serialNumber}</span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function SelectorField({ field, value, onChange, disabled }: FieldRendererProps) {
  return (
    <Select
      value={(value as string) || ""}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger data-testid={`field-selector-${field.id}`}>
        <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="placeholder_1" data-testid={`option-selector-${field.id}-1`}>Item 1</SelectItem>
        <SelectItem value="placeholder_2" data-testid={`option-selector-${field.id}-2`}>Item 2</SelectItem>
        <SelectItem value="placeholder_3" data-testid={`option-selector-${field.id}-3`}>Item 3</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function renderField(
  field: ChecklistField,
  value: unknown,
  onChange: (value: unknown) => void,
  disabled?: boolean,
  onAssetSelected?: (asset: SimpleAsset, sourceFieldId?: string) => void
) {
  const props = { field, value, onChange, disabled };

  switch (field.type) {
    case "text_field":
      return <TextField {...props} />;
    case "textarea":
      return <TextareaField {...props} />;
    case "number_field":
      return <NumberField {...props} />;
    case "radio_button":
      return <RadioButtonField {...props} />;
    case "dropdown":
      return <DropdownField {...props} />;
    case "checkbox":
      return <CheckboxField {...props} />;
    case "pass_fail_flag":
      return <PassFailField {...props} />;
    case "yes_no_na":
      return <YesNoNaField {...props} />;
    case "condition_option":
      return <ConditionField {...props} />;
    case "inspection_check":
      return <InspectionCheckField {...props} />;
    case "date_field":
      return <DateField {...props} />;
    case "time_field":
      return <TimeField {...props} />;
    case "datetime_field":
      return <DateTimeField {...props} />;
    case "amount_field":
      return <AmountField {...props} />;
    case "percentage_field":
      return <PercentageField {...props} />;
    case "priority_level":
      return <PriorityField {...props} />;
    case "rating_scale":
      return <RatingField {...props} />;
    case "photo_required":
      return <PhotoField {...props} />;
    case "multi_photo":
      return <MultiPhotoField {...props} />;
    case "file_upload":
      return <FileUploadField {...props} />;
    case "signature_field":
      return <SignatureField {...props} />;
    case "progress_bar":
      return <ProgressBarField {...props} />;
    case "measurement_field":
      return <MeasurementField {...props} />;
    case "asset_selector":
      return <AssetSelectorField {...props} onAssetSelected={onAssetSelected} />;
    case "job_selector":
    case "customer_selector":
    case "supplier_selector":
    case "staff_assignment":
      return <SelectorField {...props} />;
    default:
      return <TextField {...props} />;
  }
}

export type { SimpleAsset };
