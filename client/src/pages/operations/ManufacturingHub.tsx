import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Package, Warehouse, ClipboardList, MapPin, Search, Plus, Eye, 
  AlertTriangle, CheckCircle, Clock, ArrowRight, Layers
} from "lucide-react";
import { Link } from "wouter";

export default function ManufacturingHub() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Manufacturing Hub</h1>
            <p className="text-muted-foreground">
              Inventory, BOMs, Work Orders, and Locations in one view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search all..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <StatsCard title="Total SKUs" type="inventory" />
          <StatsCard title="Active BOMs" type="boms" />
          <StatsCard title="Open Work Orders" type="workorders" />
          <StatsCard title="Locations" type="locations" />
        </div>

        {/* Four Column Layout */}
        <div className="grid grid-cols-4 gap-4">
          {/* Inventory Column */}
          <InventoryColumn searchTerm={searchTerm} />
          
          {/* BOM Column */}
          <BOMColumn searchTerm={searchTerm} />
          
          {/* Work Orders Column */}
          <WorkOrdersColumn searchTerm={searchTerm} />
          
          {/* Locations Column */}
          <LocationsColumn searchTerm={searchTerm} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatsCard({ title, type }: { title: string; type: string }) {
  const { data: inventory } = trpc.inventory.list.useQuery({});
  const { data: boms } = trpc.bom.list.useQuery();
  const { data: workOrders } = trpc.workOrders.list.useQuery();
  const { data: locations } = trpc.warehouses.list.useQuery();

  let value = 0;
  let icon = Package;
  
  if (type === "inventory") {
    value = inventory?.length || 0;
    icon = Package;
  } else if (type === "boms") {
    value = boms?.filter((b: any) => b.status === "active").length || 0;
    icon = Layers;
  } else if (type === "workorders") {
    value = workOrders?.filter((w: any) => w.status !== "completed" && w.status !== "cancelled").length || 0;
    icon = ClipboardList;
  } else if (type === "locations") {
    value = locations?.length || 0;
    icon = MapPin;
  }

  const Icon = icon;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className="h-6 w-6 text-muted-foreground/50" />
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryColumn({ searchTerm }: { searchTerm: string }) {
  const { data: inventory, isLoading } = trpc.inventory.list.useQuery();
  
  const filtered = inventory?.filter((item: any) => 
    item.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const lowStock = filtered.filter((i: any) => 
    i.quantityOnHand < (i.product?.reorderPoint || 10)
  );

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <CardTitle className="text-sm">Inventory</CardTitle>
          </div>
          <Link href="/operations/inventory">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        {lowStock.length > 0 && (
          <Badge variant="destructive" className="w-fit text-xs">
            {lowStock.length} low stock
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No inventory</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((item: any) => {
                const isLow = item.quantityOnHand < (item.product?.reorderPoint || 10);
                return (
                  <div 
                    key={item.id} 
                    className={`p-2 rounded border text-xs ${isLow ? 'border-red-200 bg-red-50' : 'border-border'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product?.name || "Unknown"}</p>
                        <p className="text-muted-foreground">{item.product?.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${isLow ? 'text-red-600' : ''}`}>
                          {item.quantityOnHand}
                        </p>
                        <p className="text-muted-foreground">{item.warehouse?.name || "-"}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function BOMColumn({ searchTerm }: { searchTerm: string }) {
  const { data: boms, isLoading } = trpc.bom.list.useQuery();
  
  const filtered = boms?.filter((bom: any) => 
    bom.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bom.product?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <CardTitle className="text-sm">Bill of Materials</CardTitle>
          </div>
          <Link href="/operations/bom">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No BOMs</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((bom: any) => (
                <Link key={bom.id} href={`/operations/bom/${bom.id}`}>
                  <div className="p-2 rounded border border-border hover:bg-accent cursor-pointer text-xs">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{bom.name}</p>
                        <p className="text-muted-foreground truncate">{bom.product?.name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={bom.status === "active" ? "default" : "secondary"} className="text-xs">
                          {bom.status}
                        </Badge>
                        <p className="text-muted-foreground mt-1">
                          {bom.components?.length || 0} items
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function WorkOrdersColumn({ searchTerm }: { searchTerm: string }) {
  const { data: workOrders, isLoading } = trpc.workOrders.list.useQuery();
  
  const filtered = workOrders?.filter((wo: any) => 
    wo.workOrderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wo.bom?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "in_progress": return <Clock className="h-3 w-3 text-blue-500" />;
      case "pending": return <Clock className="h-3 w-3 text-yellow-500" />;
      default: return <AlertTriangle className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <CardTitle className="text-sm">Work Orders</CardTitle>
          </div>
          <Link href="/operations/work-orders">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No work orders</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((wo: any) => (
                <Link key={wo.id} href={`/operations/work-orders/${wo.id}`}>
                  <div className="p-2 rounded border border-border hover:bg-accent cursor-pointer text-xs">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(wo.status)}
                          <p className="font-medium truncate">{wo.workOrderNumber}</p>
                        </div>
                        <p className="text-muted-foreground truncate">{wo.bom?.name || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{wo.quantity}</p>
                        <p className="text-muted-foreground">
                          {wo.scheduledDate ? new Date(wo.scheduledDate).toLocaleDateString() : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function LocationsColumn({ searchTerm }: { searchTerm: string }) {
  const { data: locations, isLoading } = trpc.warehouses.list.useQuery();
  const { data: inventory } = trpc.inventory.list.useQuery({});
  
  const filtered = locations?.filter((loc: any) => 
    loc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.type?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getLocationInventoryCount = (locationId: number) => {
    return inventory?.filter((i: any) => i.warehouseId === locationId).length || 0;
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      warehouse: "bg-blue-100 text-blue-800",
      store: "bg-green-100 text-green-800",
      distribution: "bg-purple-100 text-purple-800",
      copacker: "bg-orange-100 text-orange-800",
      "3pl": "bg-pink-100 text-pink-800",
    };
    return <Badge className={`text-xs ${colors[type] || ""}`}>{type}</Badge>;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <CardTitle className="text-sm">Locations</CardTitle>
          </div>
          <Link href="/operations/locations">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No locations</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((loc: any) => (
                <div key={loc.id} className="p-2 rounded border border-border text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{loc.name}</p>
                      <p className="text-muted-foreground truncate">{loc.address || "-"}</p>
                    </div>
                    <div className="text-right">
                      {getTypeBadge(loc.type)}
                      <p className="text-muted-foreground mt-1">
                        {getLocationInventoryCount(loc.id)} SKUs
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
