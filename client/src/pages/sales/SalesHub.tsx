import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ShoppingCart, FileText, Users, CreditCard, Search, ArrowRight,
  Clock, CheckCircle, AlertTriangle, DollarSign
} from "lucide-react";
import { Link } from "wouter";

export default function SalesHub() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sales Hub</h1>
            <p className="text-muted-foreground">
              Orders, Invoices, Customers, and Payments in one view
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
          <StatsCard title="Open Orders" type="orders" />
          <StatsCard title="Pending Invoices" type="invoices" />
          <StatsCard title="Total Customers" type="customers" />
          <StatsCard title="Revenue MTD" type="revenue" />
        </div>

        {/* Four Column Layout */}
        <div className="grid grid-cols-4 gap-4">
          <OrdersColumn searchTerm={searchTerm} />
          <InvoicesColumn searchTerm={searchTerm} />
          <CustomersColumn searchTerm={searchTerm} />
          <PaymentsColumn searchTerm={searchTerm} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatsCard({ title, type }: { title: string; type: string }) {
  const { data: orders } = trpc.orders.list.useQuery();
  const { data: invoices } = trpc.invoices.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: payments } = trpc.payments.list.useQuery();

  let value: string | number = 0;
  let icon = ShoppingCart;
  
  if (type === "orders") {
    value = orders?.filter((o: any) => o.status !== "completed" && o.status !== "cancelled").length || 0;
    icon = ShoppingCart;
  } else if (type === "invoices") {
    value = invoices?.filter((i: any) => i.status === "pending" || i.status === "sent").length || 0;
    icon = FileText;
  } else if (type === "customers") {
    value = customers?.length || 0;
    icon = Users;
  } else if (type === "revenue") {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const mtdPayments = payments?.filter((p: any) => 
      p.status === "completed" && new Date(p.paymentDate) >= thisMonth
    ) || [];
    const total = mtdPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    value = `$${total.toLocaleString()}`;
    icon = DollarSign;
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

function OrdersColumn({ searchTerm }: { searchTerm: string }) {
  const { data: orders, isLoading } = trpc.orders.list.useQuery();
  
  const filtered = orders?.filter((order: any) => 
    order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "processing": return <Clock className="h-3 w-3 text-blue-500" />;
      case "pending": return <Clock className="h-3 w-3 text-yellow-500" />;
      case "cancelled": return <AlertTriangle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <CardTitle className="text-sm">Orders</CardTitle>
          </div>
          <Link href="/sales/orders">
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
            <div className="text-center py-4 text-muted-foreground text-sm">No orders</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((order: any) => (
                <div key={order.id} className="p-2 rounded border border-border text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(order.status)}
                        <p className="font-medium truncate">{order.orderNumber}</p>
                      </div>
                      <p className="text-muted-foreground truncate">{order.customer?.name || "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${Number(order.totalAmount || 0).toLocaleString()}</p>
                      <p className="text-muted-foreground">
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-"}
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

function InvoicesColumn({ searchTerm }: { searchTerm: string }) {
  const { data: invoices, isLoading } = trpc.invoices.list.useQuery();
  
  const filtered = invoices?.filter((inv: any) => 
    inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const overdueCount = filtered.filter((i: any) => 
    i.status === "pending" && i.dueDate && new Date(i.dueDate) < new Date()
  ).length;

  const getStatusBadge = (status: string, dueDate: string | null) => {
    const isOverdue = status === "pending" && dueDate && new Date(dueDate) < new Date();
    if (isOverdue) return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "secondary",
      pending: "outline",
      sent: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"} className="text-xs">{status}</Badge>;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <CardTitle className="text-sm">Invoices</CardTitle>
          </div>
          <Link href="/finance/invoices">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        {overdueCount > 0 && (
          <Badge variant="destructive" className="w-fit text-xs">
            {overdueCount} overdue
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No invoices</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((inv: any) => {
                const isOverdue = inv.status === "pending" && inv.dueDate && new Date(inv.dueDate) < new Date();
                return (
                  <div 
                    key={inv.id} 
                    className={`p-2 rounded border text-xs ${isOverdue ? 'border-red-200 bg-red-50' : 'border-border'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{inv.invoiceNumber}</p>
                        <p className="text-muted-foreground truncate">{inv.customer?.name || "-"}</p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(inv.status, inv.dueDate)}
                        <p className="font-bold mt-1">${Number(inv.amount || 0).toLocaleString()}</p>
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

function CustomersColumn({ searchTerm }: { searchTerm: string }) {
  const { data: customers, isLoading } = trpc.customers.list.useQuery();
  const { data: orders } = trpc.orders.list.useQuery();
  
  const filtered = customers?.filter((c: any) => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getCustomerOrderCount = (customerId: number) => {
    return orders?.filter((o: any) => o.customerId === customerId).length || 0;
  };

  const getSourceBadge = (source: string | null) => {
    if (!source) return null;
    const colors: Record<string, string> = {
      shopify: "bg-green-100 text-green-800",
      hubspot: "bg-orange-100 text-orange-800",
      manual: "bg-gray-100 text-gray-800",
    };
    return <Badge className={`text-xs ${colors[source] || ""}`}>{source}</Badge>;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <CardTitle className="text-sm">Customers</CardTitle>
          </div>
          <Link href="/sales/customers">
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
            <div className="text-center py-4 text-muted-foreground text-sm">No customers</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((customer: any) => (
                <div key={customer.id} className="p-2 rounded border border-border text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{customer.name}</p>
                      <p className="text-muted-foreground truncate">{customer.email || "-"}</p>
                    </div>
                    <div className="text-right">
                      {getSourceBadge(customer.source)}
                      <p className="text-muted-foreground mt-1">
                        {getCustomerOrderCount(customer.id)} orders
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

function PaymentsColumn({ searchTerm }: { searchTerm: string }) {
  const { data: payments, isLoading } = trpc.payments.list.useQuery();
  
  const filtered = payments?.filter((p: any) => 
    p.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.invoice?.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const pendingCount = filtered.filter((p: any) => p.status === "pending").length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "pending": return <Clock className="h-3 w-3 text-yellow-500" />;
      case "failed": return <AlertTriangle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <CardTitle className="text-sm">Payments</CardTitle>
          </div>
          <Link href="/finance/payments">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        {pendingCount > 0 && (
          <Badge variant="default" className="w-fit text-xs">
            {pendingCount} pending
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No payments</div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 20).map((payment: any) => (
                <div key={payment.id} className="p-2 rounded border border-border text-xs">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(payment.status)}
                        <p className="font-medium truncate">
                          {payment.referenceNumber || payment.invoice?.invoiceNumber || "-"}
                        </p>
                      </div>
                      <p className="text-muted-foreground truncate">{payment.method || "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        +${Number(payment.amount || 0).toLocaleString()}
                      </p>
                      <p className="text-muted-foreground">
                        {payment.paymentDate 
                          ? new Date(payment.paymentDate).toLocaleDateString()
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
