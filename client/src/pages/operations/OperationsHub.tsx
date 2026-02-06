import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import SpreadsheetTable, { Column } from "@/components/SpreadsheetTable";
import { QuickCreateButton, QuickCreateDialog } from "@/components/QuickCreateDialog";
import { 
  Package, ClipboardList, MapPin, Search, 
  AlertTriangle, CheckCircle, Clock, Play, Pause, X,
  ShoppingCart, Users, FileText, Send, TruckIcon, Factory, Layers
} from "lucide-react";

// Status options
const workOrderStatuses = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "scheduled", label: "Scheduled", color: "bg-yellow-100 text-yellow-800" },
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-800" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

const poStatusOptions = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "sent", label: "Sent", color: "bg-blue-100 text-blue-800" },
  { value: "confirmed", label: "Confirmed", color: "bg-green-100 text-green-800" },
  { value: "shipped", label: "Shipped", color: "bg-purple-100 text-purple-800" },
  { value: "received", label: "Received", color: "bg-emerald-100 text-emerald-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

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

// Detail Panel Components
function WorkOrderDetailPanel({ workOrder, onStatusChange, onStartProduction, onCompleteProduction }: {
  workOrder: any;
  onStatusChange: (id: number, status: string) => void;
  onStartProduction?: (id: number) => void;
  onCompleteProduction?: (id: number, completedQuantity: string) => void;
}) {
  const statusOption = workOrderStatuses.find(s => s.value === workOrder.status);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">WO-{workOrder.id}</span>
          <span className="text-xs text-muted-foreground">{workOrder.product?.name || workOrder.bom?.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className={`text-[10px] ${statusOption?.color}`}>{statusOption?.label}</Badge>
          {(workOrder.status === "pending" || workOrder.status === "draft" || workOrder.status === "scheduled") && (
            <Button size="sm" className="h-6 text-xs" onClick={() => onStartProduction?.(workOrder.id)}>
              <Play className="h-3 w-3 mr-1" /> Start
            </Button>
          )}
          {workOrder.status === "in_progress" && (
            <>
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => onStatusChange(workOrder.id, "scheduled")}>
                <Pause className="h-3 w-3 mr-1" /> Pause
              </Button>
              <Button size="sm" className="h-6 text-xs" onClick={() => onCompleteProduction?.(workOrder.id, workOrder.quantity)}>
                <CheckCircle className="h-3 w-3 mr-1" /> Complete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Quantity</div>
          <div className="font-medium">{workOrder.quantity}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Completed</div>
          <div className="font-medium">{workOrder.completedQuantity || 0}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Start</div>
          <div className="font-medium">{workOrder.startDate ? formatDate(workOrder.startDate) : "-"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Due</div>
          <div className="font-medium">{workOrder.dueDate ? formatDate(workOrder.dueDate) : "-"}</div>
        </div>
      </div>

      {workOrder.notes && (
        <p className="text-xs text-muted-foreground">{workOrder.notes}</p>
      )}
    </div>
  );
}

function BomDetailPanel({ bom }: { bom: any }) {
  const { data: bomDetails } = trpc.bom.get.useQuery({ id: bom.id });
  const components = bomDetails?.components || [];
  
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{bom.name}</h3>
          <p className="text-sm text-muted-foreground">{bomDetails?.product?.name || "No product"}</p>
        </div>
        <Badge variant={bom.status === 'active' ? "default" : "secondary"}>
          {bom.status || "Draft"}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-muted-foreground">Version</div>
          <div className="font-medium">{bom.version || "1.0"}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-muted-foreground">Components</div>
          <div className="font-medium">{components.length}</div>
        </div>
      </div>
      
      {components.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Bill of Materials</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Component</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Unit</th>
                </tr>
              </thead>
              <tbody>
                {components.map((c: any) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.name}</td>
                    <td className="text-right p-2">{c.quantity}</td>
                    <td className="text-right p-2">{c.unit || "ea"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationDetailPanel({ location }: { location: any }) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{location.name}</h3>
          <p className="text-sm text-muted-foreground">{location.code}</p>
        </div>
        <Badge variant={location.isActive ? "default" : "secondary"}>
          {location.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-muted-foreground">Type</div>
          <div className="font-medium capitalize">{location.type || "Warehouse"}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-muted-foreground">Capacity</div>
          <div className="font-medium">{location.capacity || "Unlimited"}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-muted-foreground">Items</div>
          <div className="font-medium">{location.itemCount || 0}</div>
        </div>
      </div>
      
      {location.address && (
        <div>
          <h4 className="font-medium mb-1">Address</h4>
          <p className="text-sm text-muted-foreground">{location.address}</p>
        </div>
      )}
    </div>
  );
}

function InventoryItemDetailPanel({ item }: { item: any }) {
  const locations = item.locations || [];
  const inTransit = item.inTransit || [];
  
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{item.product?.name || item.rawMaterial?.name}</h3>
          <p className="text-sm text-muted-foreground">SKU: {item.product?.sku || item.rawMaterial?.sku}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{item.totalQuantity || 0}</div>
          <p className="text-sm text-muted-foreground">{item.unit || "units"}</p>
        </div>
      </div>
      
      {locations.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">By Location</h4>
          <div className="space-y-2">
            {locations.map((loc: any, idx: number) => (
              <div key={idx} className="border rounded p-2 text-sm">
                <div className="font-medium">{loc.warehouseName}</div>
                <div className="grid grid-cols-4 gap-2 mt-1 text-xs">
                  <div><span className="text-muted-foreground">Available:</span> {loc.available}</div>
                  <div><span className="text-muted-foreground">Reserved:</span> {loc.reserved}</div>
                  <div><span className="text-muted-foreground">On Hold:</span> {loc.onHold}</div>
                  <div><span className="text-muted-foreground">Allocated:</span> {loc.allocated}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {inTransit.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">In Transit</h4>
          <div className="space-y-2">
            {inTransit.map((transit: any, idx: number) => (
              <div key={idx} className="border rounded p-2 text-sm">
                <div className="flex justify-between">
                  <span>{transit.from} → {transit.to}</span>
                  <span className="font-medium">{transit.quantity} units</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ETA: {transit.eta ? formatDate(transit.eta) : "TBD"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OperationsHub() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("purchase-orders");
  
  // Expanded row states
  const [expandedPoId, setExpandedPoId] = useState<number | string | null>(null);
  const [expandedVendorId, setExpandedVendorId] = useState<number | string | null>(null);
  const [expandedMaterialId, setExpandedMaterialId] = useState<number | string | null>(null);
  const [expandedWorkOrderId, setExpandedWorkOrderId] = useState<number | string | null>(null);
  const [expandedBomId, setExpandedBomId] = useState<number | string | null>(null);
  const [expandedLocationId, setExpandedLocationId] = useState<number | string | null>(null);
  const [expandedInventoryId, setExpandedInventoryId] = useState<number | string | null>(null);
  
  // Dialog states
  const [showPoDialog, setShowPoDialog] = useState(false);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [showWorkOrderDialog, setShowWorkOrderDialog] = useState(false);
  const [showBomDialog, setShowBomDialog] = useState(false);

  // Queries - load all data
  const { data: purchaseOrders, isLoading: posLoading, refetch: refetchPos } = trpc.purchaseOrders.list.useQuery();
  const { data: vendors, isLoading: vendorsLoading, refetch: refetchVendors } = trpc.vendors.list.useQuery();
  const { data: rawMaterials, isLoading: materialsLoading, refetch: refetchMaterials } = trpc.rawMaterials.list.useQuery();
  const { data: workOrders, isLoading: workOrdersLoading, refetch: refetchWorkOrders } = trpc.workOrders.list.useQuery();
  const { data: boms, isLoading: bomsLoading, refetch: refetchBoms } = trpc.bom.list.useQuery();
  const { data: locations, isLoading: locationsLoading, refetch: refetchLocations } = trpc.warehouses.list.useQuery();
  const { data: inventory, isLoading: inventoryLoading, refetch: refetchInventory } = trpc.inventory.list.useQuery();
  const { data: alerts, isLoading: alertsLoading } = trpc.alerts.list.useQuery({ status: "open" });

  // Mutations
  const updatePoStatus = trpc.purchaseOrders.update.useMutation({
    onSuccess: () => {
      toast.success("PO updated");
      refetchPos();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateWorkOrderStatus = trpc.workOrders.update.useMutation({
    onSuccess: () => {
      toast.success("Work order updated");
      refetchWorkOrders();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startProduction = trpc.workOrders.startProduction.useMutation({
    onSuccess: () => {
      toast.success("Production started");
      refetchWorkOrders();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const completeProduction = trpc.workOrders.completeProduction.useMutation({
    onSuccess: () => {
      toast.success("Production completed");
      refetchWorkOrders();
      refetchInventory();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Stats calculation
  const stats = useMemo(() => ({
    totalPos: purchaseOrders?.length || 0,
    pendingPos: purchaseOrders?.filter((po: any) => po.status === "draft" || po.status === "sent").length || 0,
    totalVendors: vendors?.length || 0,
    activeVendors: vendors?.filter((v: any) => v.isActive).length || 0,
    totalMaterials: rawMaterials?.length || 0,
    lowStockMaterials: rawMaterials?.filter((m: any) => (m.currentStock || 0) <= (m.reorderPoint || 0)).length || 0,
    openWorkOrders: workOrders?.filter((w: any) => w.status !== "completed" && w.status !== "cancelled").length || 0,
    activeBoms: boms?.filter((b: any) => b.isActive).length || 0,
    totalLocations: locations?.length || 0,
    exceptions: alerts?.length || 0,
  }), [purchaseOrders, vendors, rawMaterials, workOrders, boms, locations, alerts]);

  // Column definitions
  const poColumns: Column<any>[] = [
    { key: "id", header: "PO #", type: "text", sortable: true, render: (row, val) => `PO-${val}` },
    { key: "vendor.name", header: "Vendor", type: "text", sortable: true, render: (row) => row.vendor?.name || "-" },
    { key: "totalAmount", header: "Amount", type: "currency", sortable: true, render: (row, val) => formatCurrency(val) },
    { key: "status", header: "Status", type: "badge", sortable: true,
      render: (row, val) => poStatusOptions.find(s => s.value === val)?.label || val },
    { key: "expectedDate", header: "Expected", type: "date", sortable: true, render: (row, val) => formatDate(val) },
  ];

  const vendorColumns: Column<any>[] = [
    { key: "name", header: "Name", type: "text", sortable: true },
    { key: "email", header: "Email", type: "text" },
    { key: "phone", header: "Phone", type: "text" },
    { key: "leadTimeDays", header: "Lead Time", type: "number", render: (row, val) => `${val || 0} days` },
    { key: "isActive", header: "Status", type: "badge",
      render: (row, val) => val ? "Active" : "Inactive" },
  ];

  const materialColumns: Column<any>[] = [
    { key: "sku", header: "SKU", type: "text", sortable: true },
    { key: "name", header: "Name", type: "text", sortable: true },
    { key: "currentStock", header: "Stock", type: "number", sortable: true },
    { key: "reorderPoint", header: "Reorder", type: "number" },
    { key: "unitCost", header: "Cost", type: "currency", render: (row, val) => formatCurrency(val) },
    { key: "preferredVendor.name", header: "Vendor", type: "text", render: (row) => row.preferredVendor?.name || "-" },
  ];

  const workOrderColumns: Column<any>[] = [
    { key: "id", header: "WO #", type: "text", sortable: true, render: (row, val) => `WO-${val}` },
    { key: "productName", header: "Product", type: "text", sortable: true, render: (row) => row.product?.name || row.bom?.name || "-" },
    { key: "quantity", header: "Qty", type: "number", sortable: true },
    { key: "completedQuantity", header: "Done", type: "number" },
    { key: "status", header: "Status", type: "badge", sortable: true,
      render: (row, val) => workOrderStatuses.find(s => s.value === val)?.label || val },
    { key: "dueDate", header: "Due", type: "date", sortable: true, render: (row, val) => formatDate(val) },
  ];

  const bomColumns: Column<any>[] = [
    { key: "name", header: "BOM Name", type: "text", sortable: true },
    { key: "product.name", header: "Product", type: "text", sortable: true, render: (row) => row.product?.name || "-" },
    { key: "version", header: "Version", type: "text" },
    { key: "componentCount", header: "Components", type: "number" },
    { key: "isActive", header: "Status", type: "badge", 
      render: (row, val) => val ? "Active" : "Inactive" },
  ];

  const locationColumns: Column<any>[] = [
    { key: "code", header: "Code", type: "text", sortable: true },
    { key: "name", header: "Name", type: "text", sortable: true },
    { key: "type", header: "Type", type: "text" },
    { key: "capacity", header: "Capacity", type: "number" },
    { key: "isActive", header: "Status", type: "badge",
      render: (row, val) => val ? "Active" : "Inactive" },
  ];

  const inventoryColumns: Column<any>[] = [
    { key: "product.sku", header: "SKU", type: "text", sortable: true, render: (row) => row.product?.sku || row.rawMaterial?.sku || "-" },
    { key: "product.name", header: "Name", type: "text", sortable: true, render: (row) => row.product?.name || row.rawMaterial?.name || "-" },
    { key: "totalQuantity", header: "Qty", type: "number", sortable: true },
    { key: "unit", header: "Unit", type: "text" },
    { key: "productType", header: "Type", type: "badge" },
  ];

  // Prepare exceptions data
  const exceptions = useMemo(() => {
    return (alerts || []).map((alert: any) => ({
      id: alert.id,
      type: alert.type || "general",
      severity: alert.severity || "info",
      title: alert.message || "Alert",
      description: alert.details || "",
      entityType: alert.entityType || "unknown",
      entityId: alert.entityId || 0,
      createdAt: alert.createdAt,
    }));
  }, [alerts]);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Operations Hub</h1>
          <p className="text-xs text-muted-foreground">
            Procurement, Manufacturing, and Inventory
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search all..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-52 h-7 text-xs"
          />
        </div>
      </div>

      {/* Inline Stats Row */}
      <div className="grid grid-cols-5 gap-2">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("purchase-orders")}>
          <CardContent className="pt-2 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Pending POs</p>
                <p className="text-base font-bold">{stats.pendingPos}</p>
              </div>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("vendors")}>
          <CardContent className="pt-2 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Active Vendors</p>
                <p className="text-base font-bold">{stats.activeVendors}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("materials")}>
          <CardContent className="pt-2 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Low Stock</p>
                <p className="text-base font-bold text-amber-600">{stats.lowStockMaterials}</p>
              </div>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("workorders")}>
          <CardContent className="pt-2 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Open WOs</p>
                <p className="text-base font-bold">{stats.openWorkOrders}</p>
              </div>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("exceptions")}>
          <CardContent className="pt-2 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Exceptions</p>
                <p className="text-base font-bold text-red-600">{stats.exceptions}</p>
              </div>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flat single-level tabs - all views accessible in one click */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="purchase-orders">POs</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="workorders">Work Orders</TabsTrigger>
          <TabsTrigger value="boms">BOMs</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="exceptions">
            Exceptions
            {exceptions.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                {exceptions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase-orders" className="mt-2">
          <SpreadsheetTable
            data={purchaseOrders || []}
            columns={poColumns}
            isLoading={posLoading}
            showSearch
            onAdd={() => setShowPoDialog(true)}
            addLabel="New PO"
            expandedRowId={expandedPoId}
            onExpandChange={setExpandedPoId}
          />
        </TabsContent>

        <TabsContent value="vendors" className="mt-2">
          <SpreadsheetTable
            data={vendors || []}
            columns={vendorColumns}
            isLoading={vendorsLoading}
            showSearch
            onAdd={() => setShowVendorDialog(true)}
            addLabel="New Vendor"
            expandedRowId={expandedVendorId}
            onExpandChange={setExpandedVendorId}
          />
        </TabsContent>

        <TabsContent value="materials" className="mt-2">
          <SpreadsheetTable
            data={rawMaterials || []}
            columns={materialColumns}
            isLoading={materialsLoading}
            showSearch
            onAdd={() => setShowMaterialDialog(true)}
            addLabel="New Material"
            expandedRowId={expandedMaterialId}
            onExpandChange={setExpandedMaterialId}
          />
        </TabsContent>

        <TabsContent value="workorders" className="mt-2">
          <SpreadsheetTable
            data={workOrders || []}
            columns={workOrderColumns}
            isLoading={workOrdersLoading}
            showSearch
            onAdd={() => setShowWorkOrderDialog(true)}
            addLabel="New Work Order"
            expandedRowId={expandedWorkOrderId}
            onExpandChange={setExpandedWorkOrderId}
            renderExpanded={(workOrder) => (
              <WorkOrderDetailPanel
                workOrder={workOrder}
                onStatusChange={(id, status) => updateWorkOrderStatus.mutate({ id, status })}
                onStartProduction={(id) => startProduction.mutate({ id })}
                onCompleteProduction={(id, completedQuantity) => completeProduction.mutate({ id, completedQuantity })}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="boms" className="mt-2">
          <SpreadsheetTable
            data={boms || []}
            columns={bomColumns}
            isLoading={bomsLoading}
            showSearch
            onAdd={() => setShowBomDialog(true)}
            addLabel="New BOM"
            expandedRowId={expandedBomId}
            onExpandChange={setExpandedBomId}
            renderExpanded={(bom) => (
              <BomDetailPanel bom={bom} />
            )}
          />
        </TabsContent>

        <TabsContent value="locations" className="mt-2">
          <SpreadsheetTable
            data={locations || []}
            columns={locationColumns}
            isLoading={locationsLoading}
            showSearch
            expandedRowId={expandedLocationId}
            onExpandChange={setExpandedLocationId}
            renderExpanded={(location) => (
              <LocationDetailPanel location={location} />
            )}
          />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-2">
          {exceptions.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No exceptions</p>
              <p className="text-xs text-muted-foreground">All operations running smoothly</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {exceptions.map((exc: any) => (
                <div key={exc.id} className={`border-l-4 p-2.5 rounded text-xs ${
                  exc.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' :
                  exc.severity === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' :
                  'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <Badge variant={exc.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0">
                      {exc.severity}
                    </Badge>
                    <span className="font-medium">{exc.title}</span>
                    <span className="text-muted-foreground ml-auto">{exc.entityType} #{exc.entityId}</span>
                  </div>
                  {exc.description && <p className="text-muted-foreground mt-0.5">{exc.description}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-2">
          <SpreadsheetTable
            data={inventory || []}
            columns={inventoryColumns}
            isLoading={inventoryLoading}
            showSearch
            expandedRowId={expandedInventoryId}
            onExpandChange={setExpandedInventoryId}
            renderExpanded={(item) => (
              <InventoryItemDetailPanel item={item} />
            )}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Create Dialogs */}
      <QuickCreateDialog
        open={showPoDialog}
        onOpenChange={setShowPoDialog}
        entityType="purchaseOrder"
        onCreated={() => refetchPos()}
      />
      <QuickCreateDialog
        open={showVendorDialog}
        onOpenChange={setShowVendorDialog}
        entityType="vendor"
        onCreated={() => refetchVendors()}
      />
      <QuickCreateDialog
        open={showMaterialDialog}
        onOpenChange={setShowMaterialDialog}
        entityType="rawMaterial"
        onCreated={() => refetchMaterials()}
      />
      <QuickCreateDialog
        open={showWorkOrderDialog}
        onOpenChange={setShowWorkOrderDialog}
        entityType="workOrder"
        onCreated={() => refetchWorkOrders()}
      />
      <QuickCreateDialog
        open={showBomDialog}
        onOpenChange={setShowBomDialog}
        entityType="bom"
        onCreated={() => refetchBoms()}
      />
    </div>
  );
}
