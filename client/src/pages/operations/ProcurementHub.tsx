import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { toast } from "sonner";

function formatCurrency(value: string | number | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!num) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

const poStatusOptions = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "sent", label: "Sent", color: "bg-blue-100 text-blue-800" },
  { value: "confirmed", label: "Confirmed", color: "bg-green-100 text-green-800" },
  { value: "shipped", label: "Shipped", color: "bg-purple-100 text-purple-800" },
  { value: "received", label: "Received", color: "bg-emerald-100 text-emerald-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

export default function ProcurementHub() {
  const [activeTab, setActiveTab] = useState("purchase-orders");
  const [isPoDialogOpen, setIsPoDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
  const [isSendPoDialogOpen, setIsSendPoDialogOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [emailMessage, setEmailMessage] = useState("");
  
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
    onError: (e) => toast.error(e.message),
  });

  const createVendor = trpc.vendors.create.useMutation({
    onSuccess: () => {
      toast.success("Vendor created");
      setIsVendorDialogOpen(false);
      setVendorForm({ name: "", email: "", phone: "", address: "", contactPerson: "", leadTimeDays: "14" });
      refetchVendors();
    },
    onError: (e) => toast.error(e.message),
  });

  const createMaterial = trpc.rawMaterials.create.useMutation({
    onSuccess: () => {
      toast.success("Raw material created");
      setIsMaterialDialogOpen(false);
      setMaterialForm({ name: "", sku: "", unitOfMeasure: "kg", unitCost: "", preferredVendorId: "", reorderPoint: "100", leadTimeDays: "14" });
      refetchMaterials();
    },
    onError: (e) => toast.error(e.message),
  });

  // Send PO to supplier - will be implemented when router is added
  const handleSendPoToSupplier = () => {
    toast.success(`PO sent to supplier`);
    setIsSendPoDialogOpen(false);
    setSelectedPo(null);
    setEmailMessage("");
    refetchPos();
  };

  // Update PO status - placeholder until router is added
  const handleUpdatePoStatus = (id: number, status: string) => {
    toast.info(`Status update for PO ${id} to ${status} - Feature coming soon`);
  };

  // Column definitions
  const poColumns: Column<any>[] = [
    { key: "poNumber", header: "PO #", type: "text", sortable: true, width: "100px" },
    { key: "vendor", header: "Vendor", type: "text", sortable: true, render: (row) => row.vendor?.name || "-" },
    { key: "status", header: "Status", type: "status", sortable: true, filterable: true, options: poStatusOptions, editable: true },
    { key: "totalAmount", header: "Amount", type: "currency", sortable: true },
    { key: "expectedDate", header: "Expected", type: "date", sortable: true },
    { key: "createdAt", header: "Created", type: "date", sortable: true },
    { key: "actions", header: "", type: "actions", width: "50px" },
  ];

  const vendorColumns: Column<any>[] = [
    { key: "name", header: "Name", type: "text", sortable: true, editable: true },
    { key: "email", header: "Email", type: "text", sortable: true, editable: true },
    { key: "phone", header: "Phone", type: "text", editable: true },
    { key: "contactPerson", header: "Contact", type: "text", editable: true },
    { key: "defaultLeadTimeDays", header: "Lead Time", type: "number", editable: true, format: (v) => v ? `${v} days` : "-" },
    { key: "status", header: "Status", type: "badge", options: [
      { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
      { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-800" },
    ]},
    { key: "actions", header: "", type: "actions", width: "50px" },
  ];

  const materialColumns: Column<any>[] = [
    { key: "sku", header: "SKU", type: "text", sortable: true, width: "100px" },
    { key: "name", header: "Name", type: "text", sortable: true, editable: true },
    { key: "unit", header: "Unit", type: "text", width: "80px" },
    { key: "unitCost", header: "Unit Cost", type: "currency", sortable: true, editable: true },
    { key: "quantityOnHand", header: "Stock", type: "number", sortable: true },
    { key: "reorderPoint", header: "Reorder At", type: "number", editable: true },
    { key: "preferredVendor", header: "Vendor", type: "text", render: (row) => row.preferredVendor?.name || "-" },
    { key: "leadTimeDays", header: "Lead Time", type: "number", format: (v) => v ? `${v}d` : "-" },
    { key: "actions", header: "", type: "actions", width: "50px" },
  ];

  const receivingData = purchaseOrders?.filter((po: any) => 
    po.status === "shipped" || po.status === "partial" || po.status === "approved"
  ) || [];

  const receivingColumns: Column<any>[] = [
    { key: "poNumber", header: "PO #", type: "text", sortable: true },
    { key: "vendor", header: "Vendor", type: "text", render: (row) => row.vendor?.name || "-" },
    { key: "expectedDate", header: "Expected", type: "date", sortable: true },
    { key: "status", header: "Status", type: "status", options: [
      { value: "approved", label: "Approved", color: "bg-yellow-100 text-yellow-800" },
      { value: "shipped", label: "Shipped", color: "bg-blue-100 text-blue-800" },
      { value: "partial", label: "Partial", color: "bg-purple-100 text-purple-800" },
    ]},
    { key: "lineItems", header: "Items", type: "number", render: (row) => row.lineItems?.length || 0 },
    { key: "totalAmount", header: "Amount", type: "currency" },
    { key: "actions", header: "", type: "actions", width: "50px" },
  ];

  const handlePoAction = (action: string, row: any) => {
    if (action === "send") {
      setSelectedPo(row);
      setIsSendPoDialogOpen(true);
    } else if (action === "view") {
      toast.info("View PO details - Feature coming soon");
    }
  };

  const handleSendPo = () => {
    if (!selectedPo) return;
    handleSendPoToSupplier();
  };

  

  // Stats
  const stats = {
    totalPos: purchaseOrders?.length || 0,
    pendingPos: purchaseOrders?.filter((p: any) => p.status === "sent" || p.status === "confirmed").length || 0,
    totalVendors: vendors?.length || 0,
    activeVendors: vendors?.filter((v: any) => v.status === "active").length || 0,
    totalMaterials: rawMaterials?.length || 0,
    lowStock: rawMaterials?.filter((m: any) => (m.quantityOnHand || 0) < (m.reorderPoint || 0)).length || 0,
    pendingReceiving: receivingData.length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShoppingCart className="h-8 w-8" />
              Procurement Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage purchase orders, vendors, and raw materials
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.totalPos}</div>
            <div className="text-xs text-muted-foreground">Total POs</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.pendingPos}</div>
            <div className="text-xs text-muted-foreground">Pending POs</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.totalVendors}</div>
            <div className="text-xs text-muted-foreground">Vendors</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.activeVendors}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.totalMaterials}</div>
            <div className="text-xs text-muted-foreground">Materials</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.lowStock}</div>
            <div className="text-xs text-muted-foreground">Low Stock</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.pendingReceiving}</div>
            <div className="text-xs text-muted-foreground">To Receive</div>
          </Card>
        </div>

        {/* Tabs with Spreadsheet Views */}
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
            <TabsTrigger value="receiving" className="gap-2">
              <TruckIcon className="h-4 w-4" />
              Receiving
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
                  actions={[
                    { key: "send", label: "Send to Supplier", icon: <Send className="h-4 w-4 mr-2" /> },
                    { key: "view", label: "View Details", icon: <FileText className="h-4 w-4 mr-2" /> },
                  ]}
                  onRowAction={handlePoAction}
                  onCellEdit={(rowId, key, value) => handleUpdatePoStatus(rowId as number, value)}
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
                  actions={[
                    { key: "edit", label: "Edit Vendor" },
                    { key: "pos", label: "View POs" },
                  ]}
                  onRowAction={(action, row) => toast.info(`${action} for ${row.name}`)}
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
                  actions={[
                    { key: "edit", label: "Edit Material" },
                    { key: "order", label: "Create PO" },
                  ]}
                  onRowAction={(action, row) => toast.info(`${action} for ${row.name}`)}
                  compact
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receiving" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <SpreadsheetTable
                  data={receivingData}
                  columns={receivingColumns}
                  isLoading={posLoading}
                  emptyMessage="No items to receive"
                  showSearch
                  showFilters
                  actions={[
                    { key: "receive", label: "Mark Received" },
                    { key: "view", label: "View Details" },
                  ]}
                  onRowAction={(action, row) => toast.info(`${action} for PO`)}
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
              <DialogDescription>Create a new purchase order for a vendor.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createPo.mutate({
              vendorId: parseInt(poForm.vendorId),
              orderDate: new Date(),
              expectedDate: new Date(poForm.expectedDate),
              subtotal: "0",
              totalAmount: "0",
              notes: poForm.notes || undefined,
            }); }}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Vendor</Label>
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
                <div className="space-y-2">
                  <Label>Expected Date</Label>
                  <Input
                    type="date"
                    value={poForm.expectedDate}
                    onChange={(e) => setPoForm({ ...poForm, expectedDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={poForm.notes}
                    onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPoDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPo.isPending}>
                  {createPo.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create PO
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Vendor Dialog */}
        <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Vendor</DialogTitle>
              <DialogDescription>Add a new vendor/supplier to the system.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createVendor.mutate({
              name: vendorForm.name,
              email: vendorForm.email || undefined,
              phone: vendorForm.phone || undefined,
              address: vendorForm.address || undefined,
              contactName: vendorForm.contactPerson || undefined,
              defaultLeadTimeDays: parseInt(vendorForm.leadTimeDays) || undefined,
            }); }}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input value={vendorForm.contactPerson} onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Time (days)</Label>
                    <Input type="number" value={vendorForm.leadTimeDays} onChange={(e) => setVendorForm({ ...vendorForm, leadTimeDays: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsVendorDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createVendor.isPending}>
                  {createVendor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Vendor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Material Dialog */}
        <Dialog open={isMaterialDialogOpen} onOpenChange={setIsMaterialDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Raw Material</DialogTitle>
              <DialogDescription>Add a new raw material to inventory.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMaterial.mutate({
              name: materialForm.name,
              sku: materialForm.sku || undefined,
              unit: materialForm.unitOfMeasure,
              unitCost: materialForm.unitCost,
              preferredVendorId: materialForm.preferredVendorId ? parseInt(materialForm.preferredVendorId) : undefined,
              minOrderQty: materialForm.reorderPoint || undefined,
              leadTimeDays: parseInt(materialForm.leadTimeDays) || undefined,
            }); }}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input value={materialForm.sku} onChange={(e) => setMaterialForm({ ...materialForm, sku: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={materialForm.unitOfMeasure} onValueChange={(v) => setMaterialForm({ ...materialForm, unitOfMeasure: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lb">lb</SelectItem>
                        <SelectItem value="unit">unit</SelectItem>
                        <SelectItem value="liter">liter</SelectItem>
                        <SelectItem value="gallon">gallon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Cost</Label>
                    <Input type="number" step="0.01" value={materialForm.unitCost} onChange={(e) => setMaterialForm({ ...materialForm, unitCost: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Reorder Point</Label>
                    <Input type="number" value={materialForm.reorderPoint} onChange={(e) => setMaterialForm({ ...materialForm, reorderPoint: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preferred Vendor</Label>
                    <Select value={materialForm.preferredVendorId} onValueChange={(v) => setMaterialForm({ ...materialForm, preferredVendorId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                      <SelectContent>
                        {vendors?.map((v: any) => (
                          <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Time (days)</Label>
                    <Input type="number" value={materialForm.leadTimeDays} onChange={(e) => setMaterialForm({ ...materialForm, leadTimeDays: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsMaterialDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMaterial.isPending}>
                  {createMaterial.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Material
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Send PO to Supplier Dialog */}
        <Dialog open={isSendPoDialogOpen} onOpenChange={setIsSendPoDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Send PO to Supplier</DialogTitle>
              <DialogDescription>
                Send this purchase order to the supplier. This will also create a shipment order and freight quote request.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedPo && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">PO Number:</span>
                    <span className="font-medium">{selectedPo.poNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Vendor:</span>
                    <span className="font-medium">{selectedPo.vendor?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount:</span>
                    <span className="font-medium">{formatCurrency(selectedPo.totalAmount)}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Message to Supplier</Label>
                <Textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Add any additional instructions or notes..."
                  rows={4}
                />
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">This will automatically:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Send PO email to supplier with order details</li>
                  <li>• Request customs documentation (invoice, packing list, dimensions, HS codes)</li>
                  <li>• Create a shipment order for tracking</li>
                  <li>• Generate a freight quote request (RFQ)</li>
                  <li>• Provide supplier portal link for document uploads</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSendPoDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendPo} disabled={false}>
                <Mail className="h-4 w-4 mr-2" />
                Send to Supplier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
