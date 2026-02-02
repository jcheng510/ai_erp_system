import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type ClickToEditType = "text" | "number" | "currency" | "textarea" | "select" | "badge";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export interface ClickToEditProps {
  value: string | number | null | undefined;
  onSave: (value: string) => Promise<void> | void;
  type?: ClickToEditType;
  placeholder?: string;
  options?: SelectOption[];
  className?: string;
  displayClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  emptyText?: string;
  formatDisplay?: (value: string | number | null | undefined) => string;
  validate?: (value: string) => string | null; // Returns error message or null if valid
}

export function ClickToEdit({
  value,
  onSave,
  type = "text",
  placeholder,
  options = [],
  className,
  displayClassName,
  inputClassName,
  disabled = false,
  required = false,
  emptyText = "-",
  formatDisplay,
  validate,
}: ClickToEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset edit value when the actual value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value ?? ""));
    }
  }, [value, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const startEdit = useCallback(() => {
    if (disabled) return;
    setEditValue(String(value ?? ""));
    setError(null);
    setIsEditing(true);
  }, [disabled, value]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(String(value ?? ""));
    setError(null);
  }, [value]);

  const saveEdit = useCallback(async () => {
    // Validate
    if (required && !editValue.trim()) {
      setError("This field is required");
      return;
    }

    if (validate) {
      const validationError = validate(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Don't save if value hasn't changed
    if (editValue === String(value ?? "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, required, validate, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === "Enter" && type !== "textarea") {
        e.preventDefault();
        saveEdit();
      } else if (e.key === "Enter" && e.metaKey && type === "textarea") {
        e.preventDefault();
        saveEdit();
      }
    },
    [cancelEdit, saveEdit, type]
  );

  const handleSelectChange = useCallback(
    async (newValue: string) => {
      setEditValue(newValue);
      setIsSaving(true);
      try {
        await onSave(newValue);
        setIsEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setIsSaving(false);
      }
    },
    [onSave]
  );

  // Click outside to cancel
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        cancelEdit();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, cancelEdit]);

  // Display value
  const displayValue = formatDisplay
    ? formatDisplay(value)
    : value?.toString() ?? "";

  // Get badge color for select/badge types
  const getBadgeColor = () => {
    const option = options.find((o) => o.value === String(value));
    return option?.color || "bg-gray-500/10 text-gray-600";
  };

  // Render display mode
  if (!isEditing) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "group relative inline-flex items-center gap-1.5 min-h-[1.5rem]",
          !disabled && "cursor-pointer",
          className
        )}
        onClick={startEdit}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEdit();
          }
        }}
      >
        {type === "badge" || (type === "select" && options.length > 0) ? (
          <Badge className={cn(getBadgeColor(), displayClassName)}>
            {options.find((o) => o.value === String(value))?.label ||
              displayValue ||
              emptyText}
          </Badge>
        ) : (
          <span
            className={cn(
              "transition-colors",
              !displayValue && "text-muted-foreground italic",
              displayClassName
            )}
          >
            {displayValue || emptyText}
          </span>
        )}
        {!disabled && (
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    );
  }

  // Render edit mode
  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-1.5">
        {type === "select" || type === "badge" ? (
          <Select
            value={editValue}
            onValueChange={handleSelectChange}
            disabled={isSaving}
          >
            <SelectTrigger className={cn("h-8 text-sm", inputClassName)}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.color ? (
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          option.color.replace("/10", "")
                        )}
                      />
                      {option.label}
                    </div>
                  ) : (
                    option.label
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : type === "textarea" ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSaving}
            rows={3}
            className={cn("text-sm resize-none", inputClassName)}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === "number" || type === "currency" ? "number" : "text"}
            step={type === "currency" ? "0.01" : undefined}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSaving}
            className={cn("h-8 text-sm", inputClassName)}
          />
        )}

        {type !== "select" && type !== "badge" && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={saveEdit}
              disabled={isSaving}
              className="h-7 w-7"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 text-green-600" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={cancelEdit}
              disabled={isSaving}
              className="h-7 w-7"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// Convenience component for table cells
export interface EditableCellProps extends Omit<ClickToEditProps, "className"> {
  cellClassName?: string;
}

export function EditableCell({
  cellClassName,
  ...props
}: EditableCellProps) {
  return (
    <ClickToEdit
      className={cn(
        "w-full min-w-[60px] py-1 px-1 -mx-1 rounded hover:bg-muted/50 transition-colors",
        cellClassName
      )}
      {...props}
    />
  );
}

// Labeled field component for detail pages
export interface EditableFieldProps extends ClickToEditProps {
  label: string;
  icon?: React.ReactNode;
}

export function EditableField({
  label,
  icon,
  className,
  ...props
}: EditableFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-sm text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </label>
      <ClickToEdit
        className="w-full"
        displayClassName="font-medium"
        {...props}
      />
    </div>
  );
}
