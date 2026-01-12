import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { SpreadsheetTable, Column } from "@/components/SpreadsheetTable";
import { 
  ShoppingCart, 
  Users, 
  Package, 
  TruckIcon,
  Loader2,
  Send,
  FileText,
  Mail,
  X,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  XCircle,
  Bot,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

function formatCurrency(value: string | number | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!num) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const poStatusOptions = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "sent", label: "Sent", color: "bg-blue-100 text-blue-800" },
  { value: "confirmed", label: "Confirmed", color: "bg-green-100 text-green-800" },
  { value: "shipped", label: "Shipped", color: "bg-purple-100 text-purple-800" },
  { value: "received", label: "Received", color: "bg-emerald-100 text-emerald-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

// PO Detail Panel Component
function PoDetailPanel({ po, onClose, onSendToSupplier, onStatusChange }: { 
  po: any; 
  onClose: () => void;
  onSendToSupplier: (po: any) => void;
  onStatusChange: (poId: number, status: string) => void;
}) {
  const { data: poItems } = trpc.purchaseOrders.getItems.useQuery({ purchaseOrderId: po.id });
  const statusOption = poStatusOptions.find(s => s.value === po.status);

  return (
    <div className="p-6 space-y-4">
      {/* Header with actions */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            PO #{po.poNumber}
            <Badge className={statusOption?.color}>{statusOption?.label}</Badge>
          </h3>
          <p className="text-sm text-muted-foreground">{po.vendor?.name || "No vendor"}</p>
        </div>
        <div className="flex items-center gap-2">
          {po.status === "draft" && (
            <Button size="sm" onClick={() => onSendToSupplier(po)}>
              <Send className="h-4 w-4 mr-1" />
              Send to Supplier
            </Button>
          )}
          {po.status === "sent" && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(po.id, "confirmed")}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Confirmed
            </Button>
          )}
          {po.status === "confirmed" && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(po.id, "shipped")}>
              <Truck className="h-4 w-4 mr-1" />
              Mark Shipped
            </Button>
          )}
          {po.status === "shipped" && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(po.id, "received")}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Received
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-3 w-3" />
            Total Value
          </div>
          <div className="font-semibold">{formatCurrency(po.totalAmount)}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Calendar className="h-3 w-3" />
            Expected Date
          </div>
          <div className="font-semibold">{formatDate(po.expectedDate)}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Package className="h-3 w-3" />
            Line Items
          </div>
          <div className="font-semibold">{poItems?.length || 0}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Clock className="h-3 w-3" />
            Created
          </div>
          <div className="font-semibold">{formatDate(po.createdAt)}</div>
        </div>
      </div>

      {/* Line items table */}
      {poItems && poItems.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Line Items</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Material</th>
                  <th className="text-right p-2 font-medium">Qty</th>
                  <th className="text-right p-2 font-medium">Unit Price</th>
                  <th className="text-right p-2 font-medium">Total</th>
                  <th className="text-right p-2 font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {poItems.map((item: any) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">{item.rawMaterial?.name || item.description || "-"}</td>
                    <td className="p-2 text-right">{item.quantity} {item.rawMaterial?.unitOfMeasure || ""}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(item.totalPrice)}</td>
                    <td className="p-2 text-right">
                      {item.receivedQuantity || 0} / {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {po.notes && (
        <div>
          <h4 className="text-sm font-medium mb-1">Notes</h4>
          <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2">{po.notes}</p>
        </div>
      )}
    </div>
  );
}

// Vendor Detail Panel
function VendorDetailPanel({ vendor, onClose }: { vendor: any; onClose: () => void }) {
  const { data: vendorPos } = trpc.purchaseOrders.list.useQuery();
  const relatedPos = vendorPos?.filter((po: any) => po.vendorId === vendor.id) || [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{vendor.name}</h3>
          <p className="text-sm text-muted-foreground">{vendor.email}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Contact</div>
          <div className="font-semibold text-sm">{vendor.contactPerson || "-"}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Phone</div>
          <div className="font-semibold text-sm">{vendor.phone || "-"}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Lead Time</div>
          <div className="font-semibold text-sm">{vendor.leadTimeDays || 14} days</div>
        </div>
      </div>

      {vendor.address && (
        <div>
          <h4 className="text-sm font-medium mb-1">Address</h4>
          <p className="text-sm text-muted-foreground">{vendor.address}</p>
        </div>
      )}

      {relatedPos.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Purchase Orders ({relatedPos.length})</h4>
          <div className="space-y-1">
            {relatedPos.slice(0, 5).map((po: any) => (
              <div key={po.id} className="flex items-center justify-between text-sm bg-muted/30 rounded p-2">
                <span>PO #{po.poNumber}</span>
                <span className="font-mono">{formatCurrency(po.totalAmount)}</span>
                <Badge variant="outline" className="text-xs">{po.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Material Detail Panel
function MaterialDetailPanel({ material, onClose }: { material: any; onClose: () => void }) {
  const stockLevel = material.quantityOnHand || 0;
  const reorderPoint = material.reorderPoint || 0;
  const isLowStock = stockLevel < reorderPoint;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {material.name}
            {isLowStock && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Low Stock
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">SKU: {material.sku || "-"}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">On Hand</div>
          <div className="font-semibold">{stockLevel} {material.unitOfMeasure}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Reorder Point</div>
          <div className="font-semibold">{reorderPoint} {material.unitOfMeasure}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Unit Cost</div>
          <div className="font-semibold">{formatCurrency(material.unitCost)}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Lead Time</div>
          <div className="font-semibold">{material.leadTimeDays || 14} days</div>
        </div>
      </div>

      {material.preferredVendor && (
        <div>
          <h4 className="text-sm font-medium mb-1">Preferred Vendor</h4>
          <p className="text-sm">{material.preferredVendor.name}</p>
        </div>
      )}
    </div>
  );
}

export default function ProcurementHub() {
  const [activeTab, setActiveTab] = useState("purchase-orders");
  const [isPoDialogOpen, setIsPoDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
  const [isSendPoDialogOpen, setIsSendPoDialogOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [emailMessage, setEmailMessage] = useState("");
  const [expandedPoId, setExpandedPoId] = useState<number | string | null>(null);
  const [expandedVendorId, setExpandedVendorId] = useState<number | string | null>(null);
  const [expandedMaterialId, setExpandedMaterialId] = useState<number | string | null>(null);
  
  // Bulk selection state
  const [selectedPos, setSelectedPos] = useState<Set<number | string>>(new Set());
  const [selectedVendors, setSelectedVendors] = useState<Set<number | string>>(new Set());
  const [selectedMaterials, setSelectedMaterials] = useState<Set<number | string>>(new Set());
  
  const [poForm, setPoForm] = useState({
    vendorId: "",
    expectedDate: "",
    notes: "",
  });
  const [vendorForm, setVendorForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    contactPerson: "",
    leadTimeDays: "14",
  });
  const [materialForm, setMaterialForm] = useState({
    name: "",
    sku: "",
    unitOfMeasure: "kg",
    unitCost: "",
    preferredVendorId: "",
    reorderPoint: "100",
    leadTimeDays: "14",
  });

  // Queries
  const { data: purchaseOrders, isLoading: posLoading, refetch: refetchPos } = trpc.purchaseOrders.list.useQuery();
  const { data: vendors, isLoading: vendorsLoading, refetch: refetchVendors } = trpc.vendors.list.useQuery();
  const { data: rawMaterials, isLoading: materialsLoading, refetch: refetchMaterials } = trpc.rawMaterials.list.useQuery();

  // Mutations
  const createPo = trpc.purchaseOrders.create.useMutation({
    onSuccess: () => {
      toast.success("Purchase order created");
      setIsPoDialogOpen(false);
      setPoForm({ vendorId: "", expectedDate: "", notes: "" });
      refetchPos();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePoStatus = trpc.purchaseOrders.update.useMutation({
    onSuccess: () => {
      toast.success("PO status updated");
      refetchPos();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendPoToSupplier = trpc.purchaseOrders.sendToSupplier.useMutation({
    onSuccess: () => {
      toast.success("PO sent to supplier");
      setIsSendPoDialogOpen(false);
      setSelectedPo(null);
      refetchPos();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createVendor = trpc.vendors.create.useMutation({
    onSuccess: () => {
      toast.success("Vendor created");
      setIsVendorDialogOpen(false);
      setVendorForm({ name: "", email: "", phone: "", address: "", contactPerson: "", leadTimeDays: "14" });
      refetchVendors();
    },
    onError: (err) => toast.error(err.message),
  });

  const createMaterial = trpc.rawMaterials.create.useMutation({
    onSuccess: () => {
      toast.success("Raw material created");
      setIsMaterialDialogOpen(false);
      setMaterialForm({ name: "", sku: "", unitOfMeasure: "kg", unitCost: "", preferredVendorId: "", reorderPoint: "100", leadTimeDays: "14" });
      refetchMaterials();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMaterial = trpc.rawMaterials.update.useMutation({
    onSuccess: () => {
      toast.success("Material updated");
      refetchMaterials();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateVendor = trpc.vendors.update.useMutation({
    onSuccess: () => {
      toast.success("Vendor updated");
      refetchVendors();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // AI Agent mutations
  const generatePoSuggestion = trpc.aiAgent.generatePoSuggestion.useMutation({
    onSuccess: (task) => {
      toast.success("PO suggestion created! Check Approval Queue to review.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generateRfqSuggestion = trpc.aiAgent.generateRfqSuggestion.useMutation({
    onSuccess: (task) => {
      toast.success("RFQ suggestion created! Check Approval Queue to review.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Inline edit handlers
  const handleMaterialCellEdit = (rowId: number | string, key: string, value: any) => {
    updateMaterial.mutate({ id: rowId as number, [key]: value });
  };

  const handleVendorCellEdit = (rowId: number | string, key: string, value: any) => {
    updateVendor.mutate({ id: rowId as number, [key]: value });
  };

  const handlePoCellEdit = (rowId: number | string, key: string, value: any) => {
    updatePoStatus.mutate({ id: rowId as number, [key]: value } as any);
  };

  // Bulk action handlers
  const handlePoBulkAction = (action: string, selectedIds: Set<number | string>) => {
    const ids = Array.from(selectedIds) as number[];
    if (action === "send") {
      // Update PO status to sent
      ids.forEach(id => {
        updatePoStatus.mutate({ id, status: "sent" });
      });
      toast.success(`${ids.length} POs marked as sent to suppliers`);
      setSelectedPos(new Set());
    } else if (action === "approve") {
      ids.forEach(id => updatePoStatus.mutate({ id, status: "confirmed" }));
      setSelectedPos(new Set());
    } else if (action === "cancel") {
      ids.forEach(id => updatePoStatus.mutate({ id, status: "cancelled" }));
      setSelectedPos(new Set());
    } else if (action === "export") {
      toast.info(`Exporting ${ids.length} POs...`);
    }
  };

  const handleVendorBulkAction = (action: string, selectedIds: Set<number | string>) => {
    const ids = Array.from(selectedIds) as number[];
    if (action === "activate") {
      ids.forEach(id => updateVendor.mutate({ id, status: "active" }));
      setSelectedVendors(new Set());
    } else if (action === "deactivate") {
      ids.forEach(id => updateVendor.mutate({ id, status: "inactive" }));
      setSelectedVendors(new Set());
    } else if (action === "request_quotes") {
      // Create AI tasks to request quotes from vendors
      // For now, show info that user needs to select materials first
      toast.info(`Select materials first, then use 'AI: Create Reorder PO' to generate RFQs`);
    }
  };

  const handleMaterialBulkAction = (action: string, selectedIds: Set<number | string>) => {
    const ids = Array.from(selectedIds) as number[];
    if (action === "reorder") {
      // Create AI-driven PO suggestions for each material
      ids.forEach(id => {
        const material = rawMaterials?.find((m: any) => m.id === id);
        if (material && material.preferredVendorId) {
          generatePoSuggestion.mutate({
            rawMaterialId: id,
            quantity: material.minOrderQty?.toString() || "100",
            vendorId: material.preferredVendorId,
            reason: `Low stock reorder for ${material.name}`,
          });
        } else {
          toast.warning(`Material ${material?.name || id} has no preferred vendor`);
        }
      });
      setSelectedMaterials(new Set());
    } else if (action === "mark_received") {
      ids.forEach(id => updateMaterial.mutate({ id, receivingStatus: "received" }));
      setSelectedMaterials(new Set());
    } else if (action === "mark_inspected") {
      ids.forEach(id => updateMaterial.mutate({ id, receivingStatus: "inspected" }));
      setSelectedMaterials(new Set());
    }
  };

  // Bulk action definitions
  const poBulkActions = [
    { key: "send", label: "Send to Suppliers", icon: <Send className="h-3 w-3 mr-1" /> },
    { key: "approve", label: "Approve", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    { key: "cancel", label: "Cancel", variant: "destructive" as const, icon: <XCircle className="h-3 w-3 mr-1" /> },
  ];

  const vendorBulkActions = [
    { key: "activate", label: "Activate" },
    { key: "deactivate", label: "Deactivate" },
    { key: "request_quotes", label: "Request Quotes" },
  ];

  const materialBulkActions = [
    { key: "reorder", label: "AI: Create Reorder PO", icon: <Sparkles className="h-3 w-3 mr-1" /> },
    { key: "mark_received", label: "Mark Received" },
    { key: "mark_inspected", label: "Mark Inspected" },
  ];

  // Column definitions
  const poColumns: Column<any>[] = [
    { key: "poNumber", header: "PO #", type: "text", sortable: true, width: "100px" },
    { key: "vendor", header: "Vendor", type: "text", sortable: true, render: (row) => row.vendor?.name || "-" },
    { key: "totalAmount", header: "Total", type: "currency", sortable: true, width: "120px" },
    { key: "status", header: "Status", type: "status", options: poStatusOptions, editable: true, filterable: true, width: "120px" },
    { key: "expectedDate", header: "Expected", type: "date", sortable: true, width: "120px" },
    { key: "createdAt", header: "Created", type: "date", sortable: true, width: "120px" },
  ];

  const vendorColumns: Column<any>[] = [
    { key: "name", header: "Name", type: "text", sortable: true, editable: true },
    { key: "email", header: "Email", type: "text", sortable: true, editable: true },
    { key: "contactName", header: "Contact", type: "text", editable: true },
    { key: "phone", header: "Phone", type: "text", editable: true },
    { key: "leadTimeDays", header: "Lead Time", type: "number", editable: true, render: (row) => `${row.leadTimeDays || 14} days` },
    { key: "status", header: "Status", type: "status", editable: true, options: [
      { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
      { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-800" },
    ]},
  ];

  const receivingStatusOptions = [
    { value: "none", label: "None", color: "bg-gray-100 text-gray-800" },
    { value: "ordered", label: "Ordered", color: "bg-blue-100 text-blue-800" },
    { value: "in_transit", label: "In Transit", color: "bg-purple-100 text-purple-800" },
    { value: "received", label: "Received", color: "bg-green-100 text-green-800" },
    { value: "inspected", label: "Inspected", color: "bg-emerald-100 text-emerald-800" },
  ];

  const materialColumns: Column<any>[] = [
    { key: "name", header: "Material", type: "text", sortable: true, editable: true },
    { key: "sku", header: "SKU", type: "text", sortable: true, width: "80px", editable: true },
    { key: "quantityOnHand", header: "On Hand", type: "number", sortable: true, width: "80px", render: (row) => (
      <span className={row.quantityOnHand < (row.reorderPoint || 0) ? "text-red-600 font-medium" : ""}>
        {row.quantityOnHand || 0}
      </span>
    )},
    { key: "quantityOnOrder", header: "On Order", type: "number", sortable: true, width: "80px", render: (row) => (
      <span className={parseFloat(row.quantityOnOrder || "0") > 0 ? "text-blue-600" : "text-muted-foreground"}>
        {parseFloat(row.quantityOnOrder || "0")}
      </span>
    )},
    { key: "receivingStatus", header: "Receiving", type: "status", options: receivingStatusOptions, filterable: true, width: "100px", editable: true },
    { key: "expectedDeliveryDate", header: "Expected", type: "date", sortable: true, width: "100px" },
    { key: "unitCost", header: "Cost", type: "currency", sortable: true, width: "80px", editable: true },
    { key: "preferredVendor", header: "Vendor", type: "text", render: (row) => row.preferredVendor?.name || "-", width: "120px" },
  ];

  // Handlers
  const handleCreatePo = () => {
    if (!poForm.vendorId) {
      toast.error("Please select a vendor");
      return;
    }
    createPo.mutate({
      vendorId: parseInt(poForm.vendorId),
      orderDate: new Date(),
      expectedDate: poForm.expectedDate ? new Date(poForm.expectedDate) : undefined,
      notes: poForm.notes || undefined,
      subtotal: "0",
      totalAmount: "0",
    });
  };

  const handleCreateVendor = () => {
    if (!vendorForm.name || !vendorForm.email) {
      toast.error("Name and email are required");
      return;
    }
    createVendor.mutate({
      name: vendorForm.name,
      email: vendorForm.email,
      phone: vendorForm.phone || undefined,
      address: vendorForm.address || undefined,
      contactName: vendorForm.contactPerson || undefined,
      
    });
  };

  const handleCreateMaterial = () => {
    if (!materialForm.name) {
      toast.error("Name is required");
      return;
    }
    createMaterial.mutate({
      name: materialForm.name,
      sku: materialForm.sku || undefined,
      unit: materialForm.unitOfMeasure,
      unitCost: materialForm.unitCost || "0",
      preferredVendorId: materialForm.preferredVendorId ? parseInt(materialForm.preferredVendorId) : undefined,
      leadTimeDays: parseInt(materialForm.leadTimeDays) || 14,
    });
  };

  const handleUpdatePoStatus = (poId: number, status: string) => {
    updatePoStatus.mutate({ id: poId, status } as any);
  };

  const handleSendPoToSupplier = () => {
    if (!selectedPo) return;
    sendPoToSupplier.mutate({
      poId: selectedPo.id,
      message: emailMessage || undefined,
    });
  };

  const openSendDialog = (po: any) => {
    setSelectedPo(po);
    setEmailMessage("");
    setIsSendPoDialogOpen(true);
  };

  // Stats
  const stats = {
    totalPos: purchaseOrders?.length || 0,
    pendingPos: purchaseOrders?.filter((p: any) => p.status === "sent" || p.status === "confirmed").length || 0,
    totalVendors: vendors?.length || 0,
    activeVendors: vendors?.filter((v: any) => v.status === "active").length || 0,
    totalMaterials: rawMaterials?.length || 0,
    lowStock: rawMaterials?.filter((m: any) => (m.quantityOnHand || 0) < (m.reorderPoint || 0)).length || 0,
    inTransit: rawMaterials?.filter((m: any) => m.receivingStatus === "ordered" || m.receivingStatus === "in_transit").length || 0,
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShoppingCart className="h-8 w-8" />
              Procurement Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Click any row to expand details and take actions
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("purchase-orders")}>
            <div className="text-2xl font-bold">{stats.totalPos}</div>
            <div className="text-xs text-muted-foreground">Total POs</div>
          </Card>
          <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("purchase-orders")}>
            <div className="text-2xl font-bold text-blue-600">{stats.pendingPos}</div>
            <div className="text-xs text-muted-foreground">Pending POs</div>
          </Card>
          <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("vendors")}>
            <div className="text-2xl font-bold">{stats.totalVendors}</div>
            <div className="text-xs text-muted-foreground">Vendors</div>
          </Card>
          <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("vendors")}>
            <div className="text-2xl font-bold text-green-600">{stats.activeVendors}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </Card>
          <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("materials")}>
            <div className="text-2xl font-bold">{stats.totalMaterials}</div>
            <div className="text-xs text-muted-foreground">Materials</div>
          </Card>
          <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("materials")}>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStock}</div>
            <div className="text-xs text-muted-foreground">Low Stock</div>
          </Card>
          <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("materials")}>
            <div className="text-2xl font-bold text-purple-600">{stats.inTransit}</div>
            <div className="text-xs text-muted-foreground">In Transit</div>
          </Card>
        </div>

        {/* Tabs with Expandable Spreadsheet Views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="purchase-orders" className="gap-2">
              <FileText className="h-4 w-4" />
              Purchase Orders
            </TabsTrigger>
            <TabsTrigger value="vendors" className="gap-2">
              <Users className="h-4 w-4" />
              Vendors
            </TabsTrigger>
            <TabsTrigger value="materials" className="gap-2">
              <Package className="h-4 w-4" />
              Raw Materials
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase-orders" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <SpreadsheetTable
                  data={purchaseOrders || []}
                  columns={poColumns}
                  isLoading={posLoading}
                  emptyMessage="No purchase orders found"
                  showSearch
                  showFilters
                  showExport
                  onAdd={() => setIsPoDialogOpen(true)}
                  addLabel="New PO"
                  expandable
                  expandedRowId={expandedPoId}
                  onExpandChange={setExpandedPoId}
                  renderExpanded={(po, onClose) => (
                    <PoDetailPanel 
                      po={po} 
                      onClose={onClose}
                      onSendToSupplier={openSendDialog}
                      onStatusChange={handleUpdatePoStatus}
                    />
                  )}
                  onCellEdit={handlePoCellEdit}
                  selectedRows={selectedPos}
                  onSelectionChange={setSelectedPos}
                  bulkActions={poBulkActions}
                  onBulkAction={handlePoBulkAction}
                  compact
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <SpreadsheetTable
                  data={vendors || []}
                  columns={vendorColumns}
                  isLoading={vendorsLoading}
                  emptyMessage="No vendors found"
                  showSearch
                  showExport
                  onAdd={() => setIsVendorDialogOpen(true)}
                  addLabel="New Vendor"
                  expandable
                  expandedRowId={expandedVendorId}
                  onExpandChange={setExpandedVendorId}
                  renderExpanded={(vendor, onClose) => (
                    <VendorDetailPanel vendor={vendor} onClose={onClose} />
                  )}
                  onCellEdit={handleVendorCellEdit}
                  selectedRows={selectedVendors}
                  onSelectionChange={setSelectedVendors}
                  bulkActions={vendorBulkActions}
                  onBulkAction={handleVendorBulkAction}
                  compact
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <SpreadsheetTable
                  data={rawMaterials || []}
                  columns={materialColumns}
                  isLoading={materialsLoading}
                  emptyMessage="No raw materials found"
                  showSearch
                  showExport
                  onAdd={() => setIsMaterialDialogOpen(true)}
                  addLabel="New Material"
                  expandable
                  expandedRowId={expandedMaterialId}
                  onExpandChange={setExpandedMaterialId}
                  renderExpanded={(material, onClose) => (
                    <MaterialDetailPanel material={material} onClose={onClose} />
                  )}
                  onCellEdit={handleMaterialCellEdit}
                  selectedRows={selectedMaterials}
                  onSelectionChange={setSelectedMaterials}
                  bulkActions={materialBulkActions}
                  onBulkAction={handleMaterialBulkAction}
                  compact
                />
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>

        {/* Create PO Dialog */}
        <Dialog open={isPoDialogOpen} onOpenChange={setIsPoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
              <DialogDescription>Create a new purchase order for a vendor</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vendor *</Label>
                <Select value={poForm.vendorId} onValueChange={(v) => setPoForm({ ...poForm, vendorId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((v: any) => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected Date</Label>
                <Input 
                  type="date" 
                  value={poForm.expectedDate} 
                  onChange={(e) => setPoForm({ ...poForm, expectedDate: e.target.value })} 
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea 
                  value={poForm.notes} 
                  onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPoDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreatePo} disabled={createPo.isPending}>
                {createPo.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create PO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Vendor Dialog */}
        <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Vendor</DialogTitle>
              <DialogDescription>Add a new vendor to your system</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Contact Person</Label>
                  <Input value={vendorForm.contactPerson} onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Textarea value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
              </div>
              <div>
                <Label>Lead Time (days)</Label>
                <Input type="number" value={vendorForm.leadTimeDays} onChange={(e) => setVendorForm({ ...vendorForm, leadTimeDays: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsVendorDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateVendor} disabled={createVendor.isPending}>
                {createVendor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Vendor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Material Dialog */}
        <Dialog open={isMaterialDialogOpen} onOpenChange={setIsMaterialDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Raw Material</DialogTitle>
              <DialogDescription>Add a new raw material to inventory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={materialForm.sku} onChange={(e) => setMaterialForm({ ...materialForm, sku: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Unit of Measure</Label>
                  <Select value={materialForm.unitOfMeasure} onValueChange={(v) => setMaterialForm({ ...materialForm, unitOfMeasure: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lb">lb</SelectItem>
                      <SelectItem value="unit">unit</SelectItem>
                      <SelectItem value="liter">liter</SelectItem>
                      <SelectItem value="gallon">gallon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unit Cost</Label>
                  <Input type="number" step="0.01" value={materialForm.unitCost} onChange={(e) => setMaterialForm({ ...materialForm, unitCost: e.target.value })} />
                </div>
                <div>
                  <Label>Reorder Point</Label>
                  <Input type="number" value={materialForm.reorderPoint} onChange={(e) => setMaterialForm({ ...materialForm, reorderPoint: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preferred Vendor</Label>
                  <Select value={materialForm.preferredVendorId} onValueChange={(v) => setMaterialForm({ ...materialForm, preferredVendorId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors?.map((v: any) => (
                        <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lead Time (days)</Label>
                  <Input type="number" value={materialForm.leadTimeDays} onChange={(e) => setMaterialForm({ ...materialForm, leadTimeDays: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMaterialDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateMaterial} disabled={createMaterial.isPending}>
                {createMaterial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Material
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send PO to Supplier Dialog */}
        <Dialog open={isSendPoDialogOpen} onOpenChange={setIsSendPoDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send PO to Supplier</DialogTitle>
              <DialogDescription>
                Send PO #{selectedPo?.poNumber} to {selectedPo?.vendor?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Custom Message (optional)</Label>
                <Textarea 
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Add a custom message to include in the email..."
                  rows={4}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This will email the PO details to the vendor and automatically create a shipment order and freight quote request.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSendPoDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendPoToSupplier} disabled={sendPoToSupplier.isPending}>
                {sendPoToSupplier.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Mail className="h-4 w-4 mr-2" />
                Send to Supplier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
