import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QuickCreateDialog } from "@/components/QuickCreateDialog";
import {
  Package, ClipboardList, MapPin, Search,
  AlertTriangle, CheckCircle, Clock, Play, Pause,
  ShoppingCart, Users, FileText, TruckIcon, Factory, Layers,
  Plus, ChevronRight, Eye
} from "lucide-react";
import { Link, useSearch } from "wouter";

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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Compact row component for lists
function CompactRow({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded text-sm cursor-pointer ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export default function OperationsHub() {
  const [searchTerm, setSearchTerm] = useState("");
  const searchString = useSearch();

  // Dialog states
  const [showPoDialog, setShowPoDialog] = useState(false);
  const [showWorkOrderDialog, setShowWorkOrderDialog] = useState(false);
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);

  // Handle URL action parameters
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const action = params.get("action");
    if (action === "new-po") {
      setShowPoDialog(true);
      window.history.replaceState({}, "", "/operations");
    } else if (action === "new-wo") {
      setShowWorkOrderDialog(true);
      window.history.replaceState({}, "", "/operations");
    } else if (action === "new-vendor") {
      setShowVendorDialog(true);
      window.history.replaceState({}, "", "/operations");
    } else if (action === "new-product") {
      setShowProductDialog(true);
      window.history.replaceState({}, "", "/operations");
    } else if (action === "new-transfer") {
      // Navigate to transfers page for now
      window.location.href = "/operations/transfers";
    }
  }, [searchString]);

  // Queries - load all data
  const { data: purchaseOrders, isLoading: posLoading, refetch: refetchPos } = trpc.purchaseOrders.list.useQuery();
  const { data: vendors, refetch: refetchVendors } = trpc.vendors.list.useQuery();
  const { data: rawMaterials, refetch: refetchMaterials } = trpc.rawMaterials.list.useQuery();
  const { data: workOrders, refetch: refetchWorkOrders } = trpc.workOrders.list.useQuery();
  const { data: boms } = trpc.bom.list.useQuery();
  const { data: locations } = trpc.warehouses.list.useQuery();
  const { data: inventory, refetch: refetchInventory } = trpc.inventory.list.useQuery();
  const { data: alerts } = trpc.alerts.list.useQuery({ status: "open" });
  const { data: products, refetch: refetchProducts } = trpc.products.list.useQuery();

  // Mutations
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

  // Filter and compute data
  const activePOs = useMemo(() =>
    (purchaseOrders || []).filter((po: any) =>
      po.status !== "received" && po.status !== "cancelled"
    ).slice(0, 8),
    [purchaseOrders]
  );

  const activeWorkOrders = useMemo(() =>
    (workOrders || []).filter((wo: any) =>
      wo.status !== "completed" && wo.status !== "cancelled"
    ).slice(0, 8),
    [workOrders]
  );

  const lowStockItems = useMemo(() =>
    (rawMaterials || []).filter((m: any) =>
      (m.currentStock || 0) <= (m.reorderPoint || 0)
    ).slice(0, 6),
    [rawMaterials]
  );

  const recentInventory = useMemo(() =>
    (inventory || []).slice(0, 6),
    [inventory]
  );

  const activeAlerts = useMemo(() =>
    (alerts || []).slice(0, 5),
    [alerts]
  );

  // Stats
  const stats = useMemo(() => ({
    pendingPos: (purchaseOrders || []).filter((po: any) => po.status === "draft" || po.status === "sent").length,
    activeWOs: (workOrders || []).filter((w: any) => w.status !== "completed" && w.status !== "cancelled").length,
    lowStock: (rawMaterials || []).filter((m: any) => (m.currentStock || 0) <= (m.reorderPoint || 0)).length,
    exceptions: (alerts || []).length,
    totalInventory: (inventory || []).reduce((sum: number, i: any) => sum + (parseFloat(i.quantity) || 0), 0),
    activeVendors: (vendors || []).filter((v: any) => v.isActive).length,
  }), [purchaseOrders, workOrders, rawMaterials, alerts, inventory, vendors]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations</h1>
          <p className="text-sm text-muted-foreground">Unified view of procurement, manufacturing, and inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-48 h-8"
            />
          </div>
        </div>
      </div>

      {/* Compact Stats Row */}
      <div className="grid grid-cols-6 gap-2">
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-orange-600" />
              <div>
                <div className="text-lg font-bold text-orange-700">{stats.pendingPos}</div>
                <div className="text-xs text-orange-600">Pending POs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-lg font-bold text-blue-700">{stats.activeWOs}</div>
                <div className="text-xs text-blue-600">Active WOs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div>
                <div className="text-lg font-bold text-amber-700">{stats.lowStock}</div>
                <div className="text-xs text-amber-600">Low Stock</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div>
                <div className="text-lg font-bold text-red-700">{stats.exceptions}</div>
                <div className="text-xs text-red-600">Exceptions</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-lg font-bold text-green-700">{stats.totalInventory.toLocaleString()}</div>
                <div className="text-xs text-green-600">Total Units</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-lg font-bold text-purple-700">{stats.activeVendors}</div>
                <div className="text-xs text-purple-600">Vendors</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main 3-Column Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* PROCUREMENT Column */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Purchase Orders
                </CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowPoDialog(true)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Link href="/operations/procurement-hub">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="divide-y">
                {activePOs.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">No active POs</div>
                ) : (
                  activePOs.map((po: any) => (
                    <CompactRow key={po.id}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium text-xs">PO-{po.id}</span>
                        <span className="truncate text-muted-foreground text-xs">{po.vendor?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{formatCurrency(po.totalAmount)}</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${poStatusOptions.find(s => s.value === po.status)?.color}`}>
                          {poStatusOptions.find(s => s.value === po.status)?.label}
                        </Badge>
                      </div>
                    </CompactRow>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Vendors
                </CardTitle>
                <Link href="/operations/vendors">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <Eye className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="divide-y">
                {(vendors || []).slice(0, 5).map((vendor: any) => (
                  <CompactRow key={vendor.id}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium text-xs truncate">{vendor.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{vendor.leadTimeDays || 0}d lead</span>
                      <Badge variant={vendor.isActive ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                        {vendor.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CompactRow>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Low Stock Materials
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowMaterialDialog(true)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="divide-y">
                {lowStockItems.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground flex flex-col items-center">
                    <CheckCircle className="h-6 w-6 text-green-500 mb-1" />
                    <span>Stock levels OK</span>
                  </div>
                ) : (
                  lowStockItems.map((mat: any) => (
                    <CompactRow key={mat.id} className="bg-amber-50/50">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium text-xs truncate">{mat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 font-medium">{mat.currentStock || 0}</span>
                        <span className="text-xs text-muted-foreground">/ {mat.reorderPoint}</span>
                      </div>
                    </CompactRow>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MANUFACTURING Column */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Factory className="h-4 w-4" />
                  Work Orders
                </CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowWorkOrderDialog(true)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Link href="/operations/work-orders">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="divide-y">
                {activeWorkOrders.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">No active work orders</div>
                ) : (
                  activeWorkOrders.map((wo: any) => {
                    const statusOpt = workOrderStatuses.find(s => s.value === wo.status);
                    return (
                      <CompactRow key={wo.id}>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-medium text-xs">WO-{wo.id}</span>
                          <span className="truncate text-muted-foreground text-xs">{wo.product?.name || wo.bom?.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{wo.completedQuantity || 0}/{wo.quantity}</span>
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${statusOpt?.color}`}>
                            {statusOpt?.label}
                          </Badge>
                          {(wo.status === "pending" || wo.status === "draft" || wo.status === "scheduled") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={(e) => { e.stopPropagation(); startProduction.mutate({ id: wo.id }); }}
                            >
                              <Play className="h-3 w-3 text-green-600" />
                            </Button>
                          )}
                          {wo.status === "in_progress" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={(e) => { e.stopPropagation(); completeProduction.mutate({ id: wo.id, completedQuantity: wo.quantity }); }}
                            >
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </CompactRow>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Bills of Materials
                </CardTitle>
                <Link href="/operations/bom">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <Eye className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="divide-y">
                {(boms || []).slice(0, 6).map((bom: any) => (
                  <CompactRow key={bom.id}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium text-xs truncate">{bom.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">v{bom.version || "1.0"}</span>
                      <Badge variant={bom.isActive ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                        {bom.isActive ? "Active" : "Draft"}
                      </Badge>
                    </div>
                  </CompactRow>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Locations
                </CardTitle>
                <Link href="/operations/locations">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <Eye className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="divide-y">
                {(locations || []).slice(0, 5).map((loc: any) => (
                  <CompactRow key={loc.id}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium text-xs">{loc.code}</span>
                      <span className="truncate text-muted-foreground text-xs">{loc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize">{loc.type}</span>
                      <Badge variant={loc.isActive ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                        {loc.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CompactRow>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* INVENTORY Column */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Inventory Levels
                </CardTitle>
                <Link href="/operations/inventory-hub">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <Eye className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="divide-y">
                {recentInventory.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">No inventory</div>
                ) : (
                  recentInventory.map((item: any) => (
                    <CompactRow key={item.id}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium text-xs truncate">{item.product?.name || item.rawMaterial?.name || `Item #${item.id}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{item.quantity}</span>
                        <span className="text-xs text-muted-foreground">{item.warehouse?.name || "Main"}</span>
                      </div>
                    </CompactRow>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Exceptions & Alerts
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="divide-y">
                {activeAlerts.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground flex flex-col items-center">
                    <CheckCircle className="h-6 w-6 text-green-500 mb-1" />
                    <span>All clear</span>
                  </div>
                ) : (
                  activeAlerts.map((alert: any) => (
                    <CompactRow key={alert.id} className={
                      alert.severity === 'critical' ? 'bg-red-50' :
                      alert.severity === 'warning' ? 'bg-amber-50' : ''
                    }>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <AlertTriangle className={`h-3 w-3 flex-shrink-0 ${
                          alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                        }`} />
                        <span className="text-xs truncate">{alert.message}</span>
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0">
                        {alert.severity}
                      </Badge>
                    </CompactRow>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TruckIcon className="h-4 w-4" />
                  Quick Actions
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => setShowPoDialog(true)}>
                  <Plus className="h-3 w-3 mr-1" /> New PO
                </Button>
                <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => setShowWorkOrderDialog(true)}>
                  <Plus className="h-3 w-3 mr-1" /> New WO
                </Button>
                <Link href="/operations/receiving" className="contents">
                  <Button variant="outline" size="sm" className="text-xs justify-start">
                    <Package className="h-3 w-3 mr-1" /> Receive PO
                  </Button>
                </Link>
                <Link href="/operations/transfers" className="contents">
                  <Button variant="outline" size="sm" className="text-xs justify-start">
                    <TruckIcon className="h-3 w-3 mr-1" /> Transfers
                  </Button>
                </Link>
                <Link href="/operations/document-import" className="contents">
                  <Button variant="outline" size="sm" className="text-xs justify-start col-span-2">
                    <FileText className="h-3 w-3 mr-1" /> Import Documents
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Create Dialogs */}
      <QuickCreateDialog
        open={showPoDialog}
        onOpenChange={setShowPoDialog}
        entityType="purchaseOrder"
        onCreated={() => refetchPos()}
      />
      <QuickCreateDialog
        open={showWorkOrderDialog}
        onOpenChange={setShowWorkOrderDialog}
        entityType="workOrder"
        onCreated={() => refetchWorkOrders()}
      />
      <QuickCreateDialog
        open={showMaterialDialog}
        onOpenChange={setShowMaterialDialog}
        entityType="material"
        onCreated={() => refetchMaterials()}
      />
      <QuickCreateDialog
        open={showVendorDialog}
        onOpenChange={setShowVendorDialog}
        entityType="vendor"
        onCreated={() => refetchVendors()}
      />
      <QuickCreateDialog
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        entityType="product"
        onCreated={() => refetchProducts()}
      />
    </div>
  );
}
