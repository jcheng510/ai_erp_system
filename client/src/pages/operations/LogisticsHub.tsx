import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Truck, ArrowRightLeft, MapPin, Search, ArrowRight,
  Clock, CheckCircle, AlertTriangle, Package
} from "lucide-react";
import { Link } from "wouter";

export default function LogisticsHub() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Logistics Hub</h1>
            <p className="text-muted-foreground">
              Shipments, Transfers, and Tracking in one view
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
          <StatsCard title="In Transit" type="intransit" />
          <StatsCard title="Delivered Today" type="delivered" />
          <StatsCard title="Pending Transfers" type="transfers" />
          <StatsCard title="Active Locations" type="locations" />
        </div>

        {/* Four Column Layout */}
        <div className="grid grid-cols-4 gap-4">
          <InboundColumn searchTerm={searchTerm} />
          <OutboundColumn searchTerm={searchTerm} />
          <TransfersColumn searchTerm={searchTerm} />
          <TrackingColumn searchTerm={searchTerm} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatsCard({ title, type }: { title: string; type: string }) {
  const { data: shipments } = trpc.shipments.list.useQuery();
  const { data: transfers } = trpc.transfers.list.useQuery();
  const { data: locations } = trpc.warehouses.list.useQuery();

  let value = 0;
  let icon = Truck;
  
  if (type === "intransit") {
    value = shipments?.filter((s: any) => s.status === "in_transit").length || 0;
    icon = Truck;
  } else if (type === "delivered") {
    const today = new Date().toDateString();
    value = shipments?.filter((s: any) => 
      s.status === "delivered" && 
      s.actualDelivery && 
      new Date(s.actualDelivery).toDateString() === today
    ).length || 0;
    icon = CheckCircle;
  } else if (type === "transfers") {
    value = transfers?.filter((t: any) => t.status === "pending" || t.status === "in_transit").length || 0;
    icon = ArrowRightLeft;
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

function InboundColumn({ searchTerm }: { searchTerm: string }) {
  const { data: shipments, isLoading } = trpc.shipments.list.useQuery();
  
  // Inbound = receiving shipments
  const inbound = shipments?.filter((s: any) => 
    s.type === "inbound" || s.direction === "inbound" || !s.type
  ).filter((s: any) =>
    s.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.carrier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.origin?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      in_transit: "default",
      delivered: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"} className="text-xs">{status?.replace("_", " ")}</Badge>;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <CardTitle className="text-sm">Inbound Shipments</CardTitle>
          </div>
          <Link href="/operations/shipments?type=inbound">
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
          ) : inbound.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No inbound shipments</div>
          ) : (
            <div className="space-y-2">
              {inbound.slice(0, 15).map((shipment: any) => (
                <div key={shipment.id} className="p-2 rounded border border-border text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{shipment.trackingNumber || "-"}</p>
                      <p className="text-muted-foreground truncate">{shipment.carrier || "-"}</p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(shipment.status)}
                      <p className="text-muted-foreground mt-1">
                        {shipment.estimatedDelivery 
                          ? new Date(shipment.estimatedDelivery).toLocaleDateString()
                          : "-"}
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

function OutboundColumn({ searchTerm }: { searchTerm: string }) {
  const { data: shipments, isLoading } = trpc.shipments.list.useQuery();
  
  // Outbound = customer shipments
  const outbound = shipments?.filter((s: any) => 
    s.type === "outbound" || s.direction === "outbound"
  ).filter((s: any) =>
    s.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.carrier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.destination?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      in_transit: "default",
      delivered: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"} className="text-xs">{status?.replace("_", " ")}</Badge>;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <CardTitle className="text-sm">Outbound Shipments</CardTitle>
          </div>
          <Link href="/operations/shipments?type=outbound">
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
          ) : outbound.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No outbound shipments</div>
          ) : (
            <div className="space-y-2">
              {outbound.slice(0, 15).map((shipment: any) => (
                <div key={shipment.id} className="p-2 rounded border border-border text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{shipment.trackingNumber || "-"}</p>
                      <p className="text-muted-foreground truncate">{shipment.destination || "-"}</p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(shipment.status)}
                      <p className="text-muted-foreground mt-1">
                        {shipment.estimatedDelivery 
                          ? new Date(shipment.estimatedDelivery).toLocaleDateString()
                          : "-"}
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

function TransfersColumn({ searchTerm }: { searchTerm: string }) {
  const { data: transfers, isLoading } = trpc.transfers.list.useQuery();
  const { data: locations } = trpc.warehouses.list.useQuery();
  
  const filtered = transfers?.filter((t: any) => 
    t.transferNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getLocationName = (id: number | null) => {
    if (!id) return "-";
    return locations?.find((l: any) => l.id === id)?.name || "-";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      pending: "outline",
      in_transit: "default",
      received: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"} className="text-xs">{status?.replace("_", " ")}</Badge>;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            <CardTitle className="text-sm">Inventory Transfers</CardTitle>
          </div>
          <Link href="/operations/transfers">
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
            <div className="text-center py-4 text-muted-foreground text-sm">No transfers</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 15).map((transfer: any) => (
                <Link key={transfer.id} href={`/operations/transfers/${transfer.id}`}>
                  <div className="p-2 rounded border border-border hover:bg-accent cursor-pointer text-xs">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{transfer.transferNumber}</p>
                        <p className="text-muted-foreground truncate">
                          {getLocationName(transfer.fromLocationId)} → {getLocationName(transfer.toLocationId)}
                        </p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(transfer.status)}
                        <p className="text-muted-foreground mt-1">
                          {transfer.createdAt 
                            ? new Date(transfer.createdAt).toLocaleDateString()
                            : "-"}
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

function TrackingColumn({ searchTerm }: { searchTerm: string }) {
  const { data: shipments, isLoading } = trpc.shipments.list.useQuery();
  
  // Active tracking = in transit items
  const activeTracking = shipments?.filter((s: any) => 
    s.status === "in_transit" || s.status === "pending"
  ).filter((s: any) =>
    s.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.carrier?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getDaysUntilDelivery = (date: string | null) => {
    if (!date) return null;
    const delivery = new Date(date);
    const today = new Date();
    const diff = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <CardTitle className="text-sm">Active Tracking</CardTitle>
          </div>
        </div>
        {activeTracking.length > 0 && (
          <Badge variant="default" className="w-fit text-xs">
            {activeTracking.length} active
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : activeTracking.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No active tracking</div>
          ) : (
            <div className="space-y-2">
              {activeTracking.slice(0, 15).map((shipment: any) => {
                const daysUntil = getDaysUntilDelivery(shipment.estimatedDelivery);
                const isLate = daysUntil !== null && daysUntil < 0;
                const isUrgent = daysUntil !== null && daysUntil <= 1 && daysUntil >= 0;
                
                return (
                  <div 
                    key={shipment.id} 
                    className={`p-2 rounded border text-xs ${
                      isLate ? 'border-red-200 bg-red-50' : 
                      isUrgent ? 'border-yellow-200 bg-yellow-50' : 
                      'border-border'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {isLate ? (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          ) : isUrgent ? (
                            <Clock className="h-3 w-3 text-yellow-500" />
                          ) : (
                            <Truck className="h-3 w-3 text-blue-500" />
                          )}
                          <p className="font-medium truncate">{shipment.trackingNumber || "-"}</p>
                        </div>
                        <p className="text-muted-foreground truncate">{shipment.carrier || "-"}</p>
                      </div>
                      <div className="text-right">
                        {daysUntil !== null ? (
                          <p className={`font-bold ${isLate ? 'text-red-600' : isUrgent ? 'text-yellow-600' : ''}`}>
                            {isLate ? `${Math.abs(daysUntil)}d late` : 
                             daysUntil === 0 ? 'Today' : 
                             `${daysUntil}d`}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">-</p>
                        )}
                        <p className="text-muted-foreground">
                          {shipment.destination?.substring(0, 15) || "-"}
                        </p>
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
