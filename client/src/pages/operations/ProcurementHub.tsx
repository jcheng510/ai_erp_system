import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, Building2, Package, PackageCheck, Search, ArrowRight,
  Clock, CheckCircle, AlertTriangle, Truck
} from "lucide-react";
import { Link } from "wouter";

export default function ProcurementHub() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Procurement Hub</h1>
            <p className="text-muted-foreground">
              Purchase Orders, Vendors, Raw Materials, and Receiving in one view
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
          <StatsCard title="Open POs" type="pos" />
          <StatsCard title="Active Vendors" type="vendors" />
          <StatsCard title="Raw Materials" type="materials" />
          <StatsCard title="Pending Receiving" type="receiving" />
        </div>

        {/* Four Column Layout */}
        <div className="grid grid-cols-4 gap-4">
          <POsColumn searchTerm={searchTerm} />
          <VendorsColumn searchTerm={searchTerm} />
          <MaterialsColumn searchTerm={searchTerm} />
          <ReceivingColumn searchTerm={searchTerm} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatsCard({ title, type }: { title: string; type: string }) {
  const { data: pos } = trpc.purchaseOrders.list.useQuery();
  const { data: vendors } = trpc.vendors.list.useQuery();
  const { data: materials } = trpc.rawMaterials.list.useQuery();

  let value = 0;
  let icon = FileText;
  
  if (type === "pos") {
    value = pos?.filter((p: any) => p.status !== "received" && p.status !== "cancelled").length || 0;
    icon = FileText;
  } else if (type === "vendors") {
    value = vendors?.filter((v: any) => v.status === "active").length || 0;
    icon = Building2;
  } else if (type === "materials") {
    value = materials?.length || 0;
    icon = Package;
  } else if (type === "receiving") {
    value = pos?.filter((p: any) => p.status === "shipped" || p.status === "partial").length || 0;
    icon = PackageCheck;
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

function POsColumn({ searchTerm }: { searchTerm: string }) {
  const { data: pos, isLoading } = trpc.purchaseOrders.list.useQuery();
  
  const filtered = pos?.filter((po: any) => 
    po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "received": return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "shipped": return <Truck className="h-3 w-3 text-blue-500" />;
      case "approved": return <Clock className="h-3 w-3 text-yellow-500" />;
      case "draft": return <Clock className="h-3 w-3 text-gray-400" />;
      default: return <AlertTriangle className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <CardTitle className="text-sm">Purchase Orders</CardTitle>
          </div>
          <Link href="/operations/purchase-orders">
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
            <div className="text-center py-4 text-muted-foreground text-sm">No POs</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((po: any) => (
                <Link key={po.id} href={`/operations/purchase-orders/${po.id}`}>
                  <div className="p-2 rounded border border-border hover:bg-accent cursor-pointer text-xs">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(po.status)}
                          <p className="font-medium truncate">{po.poNumber}</p>
                        </div>
                        <p className="text-muted-foreground truncate">{po.vendor?.name || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${Number(po.totalAmount || 0).toLocaleString()}</p>
                        <p className="text-muted-foreground">{po.lineItems?.length || 0} items</p>
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

function VendorsColumn({ searchTerm }: { searchTerm: string }) {
  const { data: vendors, isLoading } = trpc.vendors.list.useQuery();
  
  const filtered = vendors?.filter((v: any) => 
    v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.type?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      supplier: "bg-blue-100 text-blue-800",
      manufacturer: "bg-green-100 text-green-800",
      distributor: "bg-purple-100 text-purple-800",
      freight: "bg-orange-100 text-orange-800",
    };
    return <Badge className={`text-xs ${colors[type] || ""}`}>{type}</Badge>;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <CardTitle className="text-sm">Vendors</CardTitle>
          </div>
          <Link href="/operations/vendors">
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
            <div className="text-center py-4 text-muted-foreground text-sm">No vendors</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((vendor: any) => (
                <div key={vendor.id} className="p-2 rounded border border-border text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{vendor.name}</p>
                      <p className="text-muted-foreground truncate">{vendor.email || "-"}</p>
                    </div>
                    <div className="text-right">
                      {getTypeBadge(vendor.type || "supplier")}
                      <p className="text-muted-foreground mt-1">
                        {vendor.defaultLeadTimeDays ? `${vendor.defaultLeadTimeDays}d` : "-"}
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

function MaterialsColumn({ searchTerm }: { searchTerm: string }) {
  const { data: materials, isLoading } = trpc.rawMaterials.list.useQuery();
  
  const filtered = materials?.filter((m: any) => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const lowStock = filtered.filter((m: any) => 
    Number(m.quantityOnHand || 0) < Number(m.reorderPoint || 10)
  );

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <CardTitle className="text-sm">Raw Materials</CardTitle>
          </div>
          <Link href="/operations/raw-materials">
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
            <div className="text-center py-4 text-muted-foreground text-sm">No materials</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((material: any) => {
                const isLow = Number(material.quantityOnHand || 0) < Number(material.reorderPoint || 10);
                return (
                  <div 
                    key={material.id} 
                    className={`p-2 rounded border text-xs ${isLow ? 'border-red-200 bg-red-50' : 'border-border'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{material.name}</p>
                        <p className="text-muted-foreground">{material.sku || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${isLow ? 'text-red-600' : ''}`}>
                          {Number(material.quantityOnHand || 0).toLocaleString()} {material.unit}
                        </p>
                        <p className="text-muted-foreground">${Number(material.unitCost || 0).toFixed(2)}</p>
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

function ReceivingColumn({ searchTerm }: { searchTerm: string }) {
  const { data: pos, isLoading } = trpc.purchaseOrders.list.useQuery();
  
  // Filter POs that need receiving
  const pendingReceiving = pos?.filter((po: any) => 
    (po.status === "shipped" || po.status === "partial" || po.status === "approved") &&
    (po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     po.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4" />
            <CardTitle className="text-sm">Pending Receiving</CardTitle>
          </div>
          <Link href="/operations/receiving">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        {pendingReceiving.length > 0 && (
          <Badge variant="default" className="w-fit text-xs">
            {pendingReceiving.length} awaiting
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : pendingReceiving.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Nothing to receive</div>
          ) : (
            <div className="space-y-2">
              {pendingReceiving.slice(0, 20).map((po: any) => (
                <Link key={po.id} href={`/operations/receiving?po=${po.id}`}>
                  <div className="p-2 rounded border border-border hover:bg-accent cursor-pointer text-xs">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3 text-blue-500" />
                          <p className="font-medium truncate">{po.poNumber}</p>
                        </div>
                        <p className="text-muted-foreground truncate">{po.vendor?.name || "-"}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={po.status === "shipped" ? "default" : "secondary"} className="text-xs">
                          {po.status}
                        </Badge>
                        <p className="text-muted-foreground mt-1">{po.lineItems?.length || 0} items</p>
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
