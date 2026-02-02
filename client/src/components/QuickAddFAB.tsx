import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus,
  X,
  Package,
  Building2,
  FileText,
  Users,
  ShoppingCart,
  Loader2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type EntityType = "product" | "vendor" | "document" | "customer" | "order";

interface QuickAddOption {
  type: EntityType;
  label: string;
  icon: React.ElementType;
  color: string;
}

const quickAddOptions: QuickAddOption[] = [
  { type: "product", label: "Product", icon: Package, color: "bg-blue-500 hover:bg-blue-600" },
  { type: "vendor", label: "Vendor", icon: Building2, color: "bg-purple-500 hover:bg-purple-600" },
  { type: "customer", label: "Customer", icon: Users, color: "bg-green-500 hover:bg-green-600" },
  { type: "document", label: "Document", icon: FileText, color: "bg-amber-500 hover:bg-amber-600" },
  { type: "order", label: "Order", icon: ShoppingCart, color: "bg-pink-500 hover:bg-pink-600" },
];

export function QuickAddFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeType, setActiveType] = useState<EntityType | null>(null);

  return (
    <>
      {/* Main FAB Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-center gap-2">
        {/* Quick action buttons - shown when expanded */}
        <div
          className={cn(
            "flex flex-col-reverse gap-2 transition-all duration-300 ease-out",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          {quickAddOptions.map((option, index) => (
            <Tooltip key={option.type}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-full shadow-lg transition-all duration-200",
                    option.color,
                    "text-white"
                  )}
                  style={{
                    transitionDelay: isOpen ? `${index * 50}ms` : "0ms",
                  }}
                  onClick={() => {
                    setActiveType(option.type);
                    setIsOpen(false);
                  }}
                >
                  <option.icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Add {option.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Main toggle button */}
        <Button
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-xl transition-all duration-300",
            isOpen ? "bg-destructive hover:bg-destructive/90 rotate-45" : "bg-primary hover:bg-primary/90"
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Backdrop when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Quick Add Dialogs */}
      <QuickAddProductDialog
        open={activeType === "product"}
        onOpenChange={(open) => !open && setActiveType(null)}
      />
      <QuickAddVendorDialog
        open={activeType === "vendor"}
        onOpenChange={(open) => !open && setActiveType(null)}
      />
      <QuickAddCustomerDialog
        open={activeType === "customer"}
        onOpenChange={(open) => !open && setActiveType(null)}
      />
      <QuickAddDocumentDialog
        open={activeType === "document"}
        onOpenChange={(open) => !open && setActiveType(null)}
      />
      <QuickAddOrderDialog
        open={activeType === "order"}
        onOpenChange={(open) => !open && setActiveType(null)}
      />
    </>
  );
}

// Quick Add Product Dialog
function QuickAddProductDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    type: "physical" as "physical" | "digital" | "service",
    unitPrice: "",
    category: "",
  });

  const utils = trpc.useUtils();
  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Product created successfully");
      utils.products.list.invalidate();
      onOpenChange(false);
      setFormData({ sku: "", name: "", type: "physical", unitPrice: "", category: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProduct.mutate({
      sku: formData.sku,
      name: formData.name,
      type: formData.type,
      unitPrice: formData.unitPrice,
      category: formData.category || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Quick Add Product
            </DialogTitle>
            <DialogDescription>
              Add a new product to your catalog quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="PROD-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product name"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Price *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Electronics"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProduct.isPending}>
              {createProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Quick Add Vendor Dialog
function QuickAddVendorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    type: "supplier" as "supplier" | "contractor" | "service",
    contactName: "",
  });

  const utils = trpc.useUtils();
  const createVendor = trpc.vendors.create.useMutation({
    onSuccess: () => {
      toast.success("Vendor created successfully");
      utils.vendors.list.invalidate();
      onOpenChange(false);
      setFormData({ name: "", email: "", type: "supplier", contactName: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createVendor.mutate({
      name: formData.name,
      email: formData.email || undefined,
      type: formData.type,
      contactName: formData.contactName || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Quick Add Vendor
            </DialogTitle>
            <DialogDescription>
              Add a new vendor or supplier quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendorName">Company Name *</Label>
                <Input
                  id="vendorName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Vendor name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorType">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="Primary contact"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendorEmail">Email</Label>
              <Input
                id="vendorEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="vendor@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createVendor.isPending}>
              {createVendor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Vendor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Quick Add Customer Dialog
function QuickAddCustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  const utils = trpc.useUtils();
  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("Customer created successfully");
      utils.customers.list.invalidate();
      onOpenChange(false);
      setFormData({ name: "", email: "", phone: "", company: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomer.mutate({
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      company: formData.company || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Quick Add Customer
            </DialogTitle>
            <DialogDescription>
              Add a new customer quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Name *</Label>
              <Input
                id="customerName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Customer name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerCompany">Company</Label>
              <Input
                id="customerCompany"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCustomer.isPending}>
              {createCustomer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Quick Add Document Dialog
function QuickAddDocumentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    type: "legal" as "contract" | "invoice" | "receipt" | "report" | "legal" | "hr" | "other",
    description: "",
    file: null as File | null,
  });

  const utils = trpc.useUtils();
  const uploadDocument = trpc.documents.upload.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      utils.documents.list.invalidate();
      onOpenChange(false);
      setFormData({ name: "", type: "legal", description: "", file: null });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file) {
      toast.error("Please select a file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDocument.mutate({
        name: formData.name,
        type: formData.type,
        description: formData.description || undefined,
        fileData: base64,
        mimeType: formData.file!.type,
      });
    };
    reader.readAsDataURL(formData.file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quick Upload Document
            </DialogTitle>
            <DialogDescription>
              Upload a new document quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="docName">Name *</Label>
              <Input
                id="docName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Document name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="docType">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="docFile">File *</Label>
              <Input
                id="docFile"
                type="file"
                onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="docDesc">Description</Label>
              <Textarea
                id="docDesc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploadDocument.isPending}>
              {uploadDocument.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Quick Add Order Dialog
function QuickAddOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    customerId: "",
    notes: "",
  });

  const { data: customers } = trpc.customers.list.useQuery();
  const utils = trpc.useUtils();
  const createOrder = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("Order created successfully");
      utils.orders.list.invalidate();
      onOpenChange(false);
      setFormData({ customerId: "", notes: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrder.mutate({
      customerId: parseInt(formData.customerId),
      notes: formData.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Quick Add Order
            </DialogTitle>
            <DialogDescription>
              Start a new order quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="orderCustomer">Customer *</Label>
              <Select
                value={formData.customerId}
                onValueChange={(value) => setFormData({ ...formData, customerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderNotes">Notes</Label>
              <Textarea
                id="orderNotes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Order notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrder.isPending || !formData.customerId}>
              {createOrder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
