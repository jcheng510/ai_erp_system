import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { QuickCreateDialog } from "@/components/QuickCreateDialog";

type EntityType = "vendor" | "material" | "bom" | "workOrder" | "rfq" | "product" | "customer" | "inventory" | "location";

interface SelectWithCreateProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  items: Array<{ id: number | string; label: string; value?: string }>;
  entityType: EntityType;
  onEntityCreated?: (entity: any) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

export function SelectWithCreate({
  value,
  onValueChange,
  placeholder = "Select an item...",
  items,
  entityType,
  onEntityCreated,
  disabled = false,
  emptyMessage = "No items found",
}: SelectWithCreateProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleCreated = (entity: any) => {
    if (entity?.id) {
      // Select the newly created item
      onValueChange(entity.id.toString());
    }
    onEntityCreated?.(entity);
  };

  return (
    <>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {/* Create new button at the top */}
          <div className="p-1 border-b">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
          </div>
          
          {/* Existing items */}
          {items && items.length > 0 ? (
            items.map((item) => (
              <SelectItem key={item.id} value={(item.value || item.id).toString()}>
                {item.label}
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-sm text-muted-foreground text-center">
              {emptyMessage}
            </div>
          )}
        </SelectContent>
      </Select>

      <QuickCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        entityType={entityType}
        onCreated={handleCreated}
      />
    </>
  );
}
