import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Check, Sparkles } from "lucide-react";

export interface CaptureField {
  id: number;
  characterId: number;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  options?: string[];
  placeholder?: string;
  sortOrder: number;
}

interface FieldCaptureFormProps {
  fields: CaptureField[];
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onDismiss: () => void;
  isSubmitting?: boolean;
}

export function FieldCaptureForm({
  fields,
  onSubmit,
  onDismiss,
  isSubmitting = false,
}: FieldCaptureFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [multiSelectValues, setMultiSelectValues] = useState<Record<string, string[]>>({});

  const handleChange = (fieldKey: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const toggleMultiSelect = (fieldKey: string, option: string) => {
    setMultiSelectValues((prev) => {
      const current = prev[fieldKey] || [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [fieldKey]: updated };
    });
  };

  const handleSubmit = async () => {
    const allValues = { ...values };
    Object.entries(multiSelectValues).forEach(([key, val]) => {
      allValues[key] = val;
    });
    await onSubmit(allValues);
  };

  const isComplete = fields.every((field) => {
    if (!field.isRequired) return true;
    if (field.fieldType === "multi_select") {
      return (multiSelectValues[field.fieldKey] || []).length > 0;
    }
    const val = values[field.fieldKey];
    return val !== undefined && val !== "" && val !== null;
  });

  const renderField = (field: CaptureField) => {
    switch (field.fieldType) {
      case "text":
      case "email":
      case "phone":
        return (
          <Input
            type={field.fieldType === "email" ? "email" : field.fieldType === "phone" ? "tel" : "text"}
            placeholder={field.placeholder || `Enter ${field.fieldLabel.toLowerCase()}`}
            value={(values[field.fieldKey] as string) || ""}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
            className="h-8 text-sm bg-slate-800 border-slate-700 text-white"
            data-testid={`input-capture-${field.fieldKey}`}
          />
        );
      
      case "number":
        return (
          <Input
            type="number"
            placeholder={field.placeholder || "0"}
            value={(values[field.fieldKey] as number) ?? ""}
            onChange={(e) => handleChange(field.fieldKey, e.target.value ? parseFloat(e.target.value) : null)}
            className="h-8 text-sm bg-slate-800 border-slate-700 text-white"
            data-testid={`input-capture-${field.fieldKey}`}
          />
        );

      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!values[field.fieldKey]}
              onCheckedChange={(checked) => handleChange(field.fieldKey, checked)}
              className="border-slate-600 data-[state=checked]:bg-cyan-600"
              data-testid={`checkbox-capture-${field.fieldKey}`}
            />
            <span className="text-sm text-slate-300">Yes</span>
          </div>
        );

      case "single_select":
        return (
          <Select
            value={(values[field.fieldKey] as string) || ""}
            onValueChange={(val) => handleChange(field.fieldKey, val)}
          >
            <SelectTrigger
              className="h-8 text-sm bg-slate-800 border-slate-700 text-white"
              data-testid={`select-capture-${field.fieldKey}`}
            >
              <SelectValue placeholder={`Select ${field.fieldLabel.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {(field.options || []).map((opt) => (
                <SelectItem key={opt} value={opt} className="text-white">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multi_select":
        return (
          <div className="flex flex-wrap gap-1.5">
            {(field.options || []).map((opt) => {
              const selected = (multiSelectValues[field.fieldKey] || []).includes(opt);
              return (
                <Badge
                  key={opt}
                  variant={selected ? "default" : "outline"}
                  className={`cursor-pointer text-xs ${
                    selected
                      ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                      : "border-slate-600 text-slate-300 hover:bg-slate-800"
                  }`}
                  onClick={() => toggleMultiSelect(field.fieldKey, opt)}
                  data-testid={`badge-capture-${field.fieldKey}-${opt}`}
                >
                  {opt}
                  {selected && <Check className="w-3 h-3 ml-1" />}
                </Badge>
              );
            })}
          </div>
        );

      case "date":
        return (
          <Input
            type="date"
            value={(values[field.fieldKey] as string) || ""}
            onChange={(e) => handleChange(field.fieldKey, e.target.value)}
            className="h-8 text-sm bg-slate-800 border-slate-700 text-white"
            data-testid={`input-capture-${field.fieldKey}`}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-lg p-3 my-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-cyan-200">Quick Info</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
          data-testid="button-dismiss-capture"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-slate-300 flex items-center gap-1">
              {field.fieldLabel}
              {field.isRequired && <span className="text-red-400">*</span>}
            </Label>
            {renderField(field)}
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-4">
        <Button
          onClick={handleSubmit}
          disabled={!isComplete || isSubmitting}
          className="h-8 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm"
          data-testid="button-submit-capture"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
