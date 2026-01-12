import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Building, Package, FileText, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type EntityType = "vendor" | "material" | "bom" | "workOrder" | "rfq";

// Product select field component
function ProductSelectField({ value, onChange }: { value?: number; onChange: (value: number) => void }) {
  const { data: products } = trpc.products.list.useQuery();
  return (
    <Select
      value={value?.toString() || ""}
      onValueChange={(v) => onChange(parseInt(v))}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a product..." />
      </SelectTrigger>
      <SelectContent>
        {products?.map((product: any) => (
          <SelectItem key={product.id} value={product.id.toString()}>
            {product.name} {product.sku && `(${product.sku})`}
          </SelectItem>
        ))}
        {(!products || products.length === 0) && (
          <div className="p-2 text-sm text-muted-foreground text-center">No products found</div>
        )}
      </SelectContent>
    </Select>
  );
}

// BOM select field component
function BomSelectField({ value, productId, onChange }: { value?: number; productId?: number; onChange: (value: number) => void }) {
  const { data: boms } = trpc.bom.list.useQuery({ productId });
  return (
    <Select
      value={value?.toString() || ""}
      onValueChange={(v) => onChange(parseInt(v))}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a BOM..." />
      </SelectTrigger>
      <SelectContent>
        {boms?.map((bom: any) => (
          <SelectItem key={bom.id} value={bom.id.toString()}>
            {bom.name} (v{bom.version || "1.0"})
          </SelectItem>
        ))}
        {(!boms || boms.length === 0) && (
          <div className="p-2 text-sm text-muted-foreground text-center">
            {productId ? "No BOMs for this product" : "Select a product first"}
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

interface QuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  onCreated?: (entity: any) => void;
  defaultValues?: Record<string, any>;
}

const entityConfig: Record<EntityType, {
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "email" | "number" | "textarea" | "select" | "productSelect" | "bomSelect";
    placeholder?: string;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
}> = {
  vendor: {
    title: "Create New Vendor",
    description: "Add a new vendor to your supplier list",
    icon: <Building className="h-5 w-5" />,
    fields: [
      { name: "name", label: "Vendor Name", type: "text", placeholder: "e.g., Acme Supplies", required: true },
      { name: "email", label: "Email", type: "email", placeholder: "contact@vendor.com" },
      { name: "phone", label: "Phone", type: "text", placeholder: "+1 (555) 123-4567" },
      { name: "address", label: "Address", type: "textarea", placeholder: "123 Main St, City, State" },
      { name: "defaultLeadTimeDays", label: "Default Lead Time (days)", type: "number", placeholder: "7" },
    ],
  },
  material: {
    title: "Create New Raw Material",
    description: "Add a new raw material to your inventory",
    icon: <Package className="h-5 w-5" />,
    fields: [
      { name: "name", label: "Material Name", type: "text", placeholder: "e.g., Organic Coconut Oil", required: true },
      { name: "sku", label: "SKU", type: "text", placeholder: "MAT-001" },
      { name: "unit", label: "Unit of Measure", type: "select", options: [
        { value: "kg", label: "Kilograms (kg)" },
        { value: "lbs", label: "Pounds (lbs)" },
        { value: "g", label: "Grams (g)" },
        { value: "oz", label: "Ounces (oz)" },
        { value: "L", label: "Liters (L)" },
        { value: "gal", label: "Gallons (gal)" },
        { value: "units", label: "Units" },
        { value: "cases", label: "Cases" },
        { value: "pallets", label: "Pallets" },
      ]},
      { name: "category", label: "Category", type: "text", placeholder: "e.g., Proteins, Oils, Packaging" },
      { name: "unitCost", label: "Unit Cost", type: "text", placeholder: "5.00" },
      { name: "description", label: "Description", type: "textarea", placeholder: "Material description..." },
    ],
  },
  bom: {
    title: "Create New Bill of Materials",
    description: "Define a new product recipe",
    icon: <FileText className="h-5 w-5" />,
    fields: [
      { name: "productId", label: "Product", type: "productSelect", required: true },
      { name: "name", label: "BOM Name", type: "text", placeholder: "e.g., Chocolate Bar Recipe", required: true },
      { name: "batchSize", label: "Batch Size", type: "text", placeholder: "100" },
      { name: "batchUnit", label: "Batch Unit", type: "text", placeholder: "kg" },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Recipe notes..." },
    ],
  },
  workOrder: {
    title: "Create New Work Order",
    description: "Schedule a new production run",
    icon: <Wrench className="h-5 w-5" />,
    fields: [
      { name: "productId", label: "Product", type: "productSelect", required: true },
      { name: "bomId", label: "Bill of Materials", type: "bomSelect", required: true },
      { name: "quantity", label: "Quantity to Produce", type: "text", placeholder: "100", required: true },
      { name: "priority", label: "Priority", type: "select", options: [
        { value: "low", label: "Low" },
        { value: "normal", label: "Normal" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" },
      ]},
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Production notes..." },
    ],
  },
  rfq: {
    title: "Create New RFQ",
    description: "Request quotes from vendors",
    icon: <FileText className="h-5 w-5" />,
    fields: [
      { name: "title", label: "RFQ Title", type: "text", placeholder: "e.g., Q1 Raw Materials", required: true },
      { name: "quantity", label: "Quantity Needed", type: "text", placeholder: "1000" },
      { name: "notes", label: "Notes for Vendors", type: "textarea", placeholder: "Special requirements..." },
    ],
  },
};

export function QuickCreateDialog({
  open,
  onOpenChange,
  entityType,
  onCreated,
  defaultValues = {},
}: QuickCreateDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>(defaultValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const config = entityConfig[entityType];

  // Mutations for different entity types
  const createVendor = trpc.vendors.create.useMutation({
    onSuccess: (data) => {
      toast.success("Vendor created successfully");
      utils.vendors.list.invalidate();
      onCreated?.(data);
      onOpenChange(false);
      setFormData({});
    },
    onError: (error) => {
      toast.error(`Failed to create vendor: ${error.message}`);
    },
  });

  const createMaterial = trpc.rawMaterials.create.useMutation({
    onSuccess: (data) => {
      toast.success("Material created successfully");
      utils.rawMaterials.list.invalidate();
      onCreated?.(data);
      onOpenChange(false);
      setFormData({});
    },
    onError: (error) => {
      toast.error(`Failed to create material: ${error.message}`);
    },
  });

  const createBom = trpc.bom.create.useMutation({
    onSuccess: (data) => {
      toast.success("BOM created successfully");
      utils.bom.list.invalidate();
      onCreated?.(data);
      onOpenChange(false);
      setFormData({});
    },
    onError: (error) => {
      toast.error(`Failed to create BOM: ${error.message}`);
    },
  });

  const createWorkOrder = trpc.workOrders.create.useMutation({
    onSuccess: (data) => {
      toast.success("Work order created successfully");
      utils.workOrders.list.invalidate();
      // Only pass id to avoid React rendering issues with full object
      onCreated?.({ id: data.id });
      onOpenChange(false);
      setFormData({});
    },
    onError: (error) => {
      toast.error(`Failed to create work order: ${error.message}`);
    },
  });

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      switch (entityType) {
        case "vendor":
          await createVendor.mutateAsync({
            name: formData.name,
            email: formData.email || undefined,
            phone: formData.phone || undefined,
            address: formData.address || undefined,
            defaultLeadTimeDays: formData.defaultLeadTimeDays ? parseInt(formData.defaultLeadTimeDays) : undefined,
          });
          break;
        case "material":
          await createMaterial.mutateAsync({
            name: formData.name,
            sku: formData.sku || undefined,
            unit: formData.unit || "units",
            category: formData.category || undefined,
            unitCost: formData.unitCost || undefined,
            description: formData.description || undefined,
          });
          break;
        case "bom":
          if (!formData.productId) {
            toast.error("Please select a product first");
            return;
          }
          await createBom.mutateAsync({
            productId: formData.productId,
            name: formData.name,
            batchSize: formData.batchSize || undefined,
            batchUnit: formData.batchUnit || undefined,
            notes: formData.notes || undefined,
          });
          break;
        case "workOrder":
          if (!formData.bomId || !formData.productId) {
            toast.error("Please select a BOM and product first");
            return;
          }
          await createWorkOrder.mutateAsync({
            bomId: formData.bomId,
            productId: formData.productId,
            quantity: formData.quantity || "1",
            priority: formData.priority || "normal",
            notes: formData.notes || undefined,
          });
          break;
        case "rfq":
          // RFQ creation handled separately in vendor quotes
          toast.info("RFQ creation coming soon");
          break;
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [entityType, formData, createVendor, createMaterial, createBom, createWorkOrder]);

  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isValid = config.fields
    .filter((f) => f.required)
    .every((f) => {
      const value = formData[f.name];
      // For select fields (productSelect, bomSelect), check for truthy value
      if (f.type === 'productSelect' || f.type === 'bomSelect' || f.type === 'select') {
        return value !== undefined && value !== null && value !== '';
      }
      // For text fields, check for non-empty string
      return value?.toString().trim();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {config.fields.map((field) => (
            <div key={field.name} className="grid gap-2">
              <Label htmlFor={field.name} className="flex items-center gap-1">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.name}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  rows={3}
                />
              ) : field.type === "select" ? (
                <Select
                  value={formData[field.name] || ""}
                  onValueChange={(value) => handleFieldChange(field.name, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "productSelect" ? (
                <ProductSelectField
                  value={formData[field.name]}
                  onChange={(value) => handleFieldChange(field.name, value)}
                />
              ) : field.type === "bomSelect" ? (
                <BomSelectField
                  value={formData[field.name]}
                  productId={formData.productId}
                  onChange={(value) => handleFieldChange(field.name, value)}
                />
              ) : (
                <Input
                  id={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ""}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline quick create button for dropdowns
interface QuickCreateButtonProps {
  entityType: EntityType;
  onCreated?: (entity: any) => void;
  label?: string;
  variant?: "default" | "ghost" | "outline" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function QuickCreateButton({
  entityType,
  onCreated,
  label,
  variant = "ghost",
  size = "sm",
  className = "",
}: QuickCreateButtonProps) {
  const [open, setOpen] = useState(false);
  const config = entityConfig[entityType];

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 mr-1" />
        {label || `New ${config.title.replace("Create New ", "")}`}
      </Button>
      <QuickCreateDialog
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        onCreated={onCreated}
      />
    </>
  );
}

// Empty state component with quick create
interface EmptyStateWithCreateProps {
  entityType: EntityType;
  title?: string;
  description?: string;
  onCreated?: (entity: any) => void;
}

export function EmptyStateWithCreate({
  entityType,
  title,
  description,
  onCreated,
}: EmptyStateWithCreateProps) {
  const [open, setOpen] = useState(false);
  const config = entityConfig[entityType];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-slate-100 p-4 mb-4">
        {config.icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {title || `No ${config.title.replace("Create New ", "")}s Yet`}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {description || config.description}
      </p>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {config.title}
      </Button>
      <QuickCreateDialog
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        onCreated={onCreated}
      />
    </div>
  );
}
