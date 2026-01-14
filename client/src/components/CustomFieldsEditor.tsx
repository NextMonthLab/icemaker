import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Crown, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type CustomFieldType = "text" | "number" | "single_select" | "multi_select" | "date" | "boolean" | "email" | "phone";

export interface CustomField {
  id?: number;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  placeholder?: string;
  required: boolean;
  sortOrder: number;
  options?: { label: string; value: string }[];
  description?: string;
}

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  canEdit: boolean;
  onUpgradeClick?: () => void;
}

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "single_select", label: "Dropdown" },
  { value: "multi_select", label: "Multi-select" },
  { value: "boolean", label: "Yes/No" },
  { value: "date", label: "Date" },
];

function generateFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50);
}

export function CustomFieldsEditor({
  fields,
  onChange,
  canEdit,
  onUpgradeClick,
}: CustomFieldsEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const addField = () => {
    const newField: CustomField = {
      fieldKey: `field_${Date.now()}`,
      label: "",
      fieldType: "text",
      required: false,
      sortOrder: fields.length,
    };
    onChange([...fields, newField]);
    setExpandedIndex(fields.length);
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    
    if (updates.label && !newFields[index].id) {
      newFields[index].fieldKey = generateFieldKey(updates.label);
    }
    
    onChange(newFields);
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    newFields.forEach((f, i) => (f.sortOrder = i));
    onChange(newFields);
    setExpandedIndex(null);
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const newFields = [...fields];
    const [moved] = newFields.splice(from, 1);
    newFields.splice(to, 0, moved);
    newFields.forEach((f, i) => (f.sortOrder = i));
    onChange(newFields);
    setExpandedIndex(to);
  };

  const addOption = (fieldIndex: number) => {
    const field = fields[fieldIndex];
    const options = field.options || [];
    updateField(fieldIndex, {
      options: [...options, { label: "", value: "" }],
    });
  };

  const updateOption = (fieldIndex: number, optionIndex: number, label: string) => {
    const field = fields[fieldIndex];
    const options = [...(field.options || [])];
    options[optionIndex] = { label, value: label.toLowerCase().replace(/\s+/g, "_") };
    updateField(fieldIndex, { options });
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const field = fields[fieldIndex];
    const options = (field.options || []).filter((_, i) => i !== optionIndex);
    updateField(fieldIndex, { options });
  };

  if (!canEdit) {
    return (
      <div className="border border-dashed border-cyan-500/30 rounded-lg p-4 text-center">
        <Crown className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
        <h4 className="text-sm font-medium text-white mb-1">Structured Data Capture</h4>
        <p className="text-xs text-slate-400 mb-3">
          Collect specific information from viewers during conversations with custom form fields.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={onUpgradeClick}
          className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
          data-testid="button-upgrade-custom-fields"
        >
          <Crown className="w-3.5 h-3.5 mr-1.5" />
          Upgrade to Business
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-slate-300">Custom Data Fields</Label>
          <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400">
            Business
          </Badge>
        </div>
        {fields.length > 0 && (
          <span className="text-[10px] text-slate-500">{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <p className="text-[10px] text-slate-500">
        Add fields to capture information from viewers during conversations (e.g., email, company name, role).
      </p>

      <AnimatePresence mode="popLayout">
        {fields.map((field, index) => (
          <motion.div
            key={field.fieldKey}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border border-slate-700 rounded-lg overflow-hidden"
          >
            <div
              className="flex items-center gap-2 p-2 bg-slate-800/50 cursor-pointer"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <button
                type="button"
                className="p-1 text-slate-500 hover:text-slate-300 cursor-grab"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white truncate">
                    {field.label || "Untitled Field"}
                  </span>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {FIELD_TYPES.find(t => t.value === field.fieldType)?.label || field.fieldType}
                  </Badge>
                  {field.required && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-500/30 text-red-400">
                      Required
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveField(index, index - 1);
                  }}
                  disabled={index === 0}
                  data-testid={`button-move-field-up-${index}`}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveField(index, index + 1);
                  }}
                  disabled={index === fields.length - 1}
                  data-testid={`button-move-field-down-${index}`}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeField(index);
                  }}
                  data-testid={`button-remove-field-${index}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {expandedIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-700"
                >
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-400">Label *</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                          placeholder="e.g., Company Name"
                          className="h-8 text-sm bg-slate-800 border-slate-700 text-white"
                          data-testid={`input-field-label-${index}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-400">Type</Label>
                        <Select
                          value={field.fieldType}
                          onValueChange={(v) => updateField(index, { fieldType: v as CustomFieldType })}
                        >
                          <SelectTrigger className="h-8 text-sm bg-slate-800 border-slate-700 text-white" data-testid={`select-field-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {FIELD_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value} className="text-white">
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">Placeholder text</Label>
                      <Input
                        value={field.placeholder || ""}
                        onChange={(e) => updateField(index, { placeholder: e.target.value })}
                        placeholder="Optional hint text"
                        className="h-8 text-sm bg-slate-800 border-slate-700 text-white"
                        data-testid={`input-field-placeholder-${index}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">Help text</Label>
                      <Textarea
                        value={field.description || ""}
                        onChange={(e) => updateField(index, { description: e.target.value })}
                        placeholder="Optional description shown to viewers"
                        className="min-h-[50px] text-sm bg-slate-800 border-slate-700 text-white"
                        data-testid={`input-field-description-${index}`}
                      />
                    </div>

                    {(field.fieldType === "single_select" || field.fieldType === "multi_select") && (
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Options</Label>
                        {(field.options || []).map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <Input
                              value={opt.label}
                              onChange={(e) => updateOption(index, optIndex, e.target.value)}
                              placeholder={`Option ${optIndex + 1}`}
                              className="h-7 text-sm bg-slate-800 border-slate-700 text-white flex-1"
                              data-testid={`input-option-${index}-${optIndex}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                              onClick={() => removeOption(index, optIndex)}
                              data-testid={`button-remove-option-${index}-${optIndex}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(index)}
                          className="h-7 text-xs border-slate-700 text-slate-300"
                          data-testid={`button-add-option-${index}`}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Option
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                      <Label className="text-xs text-slate-400">Required field</Label>
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) => updateField(index, { required: checked })}
                        data-testid={`switch-field-required-${index}`}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addField}
        className="w-full h-8 text-xs border-dashed border-slate-600 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 hover:bg-cyan-500/5"
        data-testid="button-add-custom-field"
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Custom Field
      </Button>
    </div>
  );
}
