import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import SpreadsheetTable, { Column } from "@/components/SpreadsheetTable";
import {
  ShoppingCart, FileText, Users, CreditCard, Package, Search,
  Send, Download, RefreshCw, ShoppingBag, Plug, Loader2, Mail, CloudUpload
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

const orderStatuses = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-800" },
  { value: "shipped", label: "Shipped", color: "bg-purple-100 text-purple-800" },
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

const invoiceStatuses = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "sent", label: "Sent", color: "bg-blue-100 text-blue-800" },
  { value: "paid", label: "Paid", color: "bg-green-100 text-green-800" },
  { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-800" },
  { value: "partial", label: "Partial", color: "bg-amber-100 text-amber-800" },
];

function ProductDetailPanel({ product }: { product: any }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{product.name}</span>
          <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>
        </div>
        <span className="text-sm font-bold">${product.price || "0.00"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">In Stock</div>
          <div className="font-medium">{product.stockQuantity || 0}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Category</div>
          <div className="font-medium">{product.category || "N/A"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Status</div>
          <div className="font-medium">{product.isActive ? "Active" : "Inactive"}</div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailPanel({ order, onStatusChange }: { order: any; onStatusChange: (id: number, status: string) => void }) {
  const statusOption = orderStatuses.find(s => s.value === order.status);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Order #{order.orderNumber}</span>
          <span className="text-xs text-muted-foreground">{order.customer?.name || "No customer"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className={`text-[10px] ${statusOption?.color}`}>{statusOption?.label}</Badge>
          {order.status === "pending" && (
            <Button size="sm" className="h-6 text-xs" onClick={() => onStatusChange(order.id, "confirmed")}>Confirm</Button>
          )}
          {order.status === "confirmed" && (
            <Button size="sm" className="h-6 text-xs" onClick={() => onStatusChange(order.id, "shipped")}>Ship</Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Subtotal</div>
          <div className="font-medium">${order.subtotal || "0.00"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Tax</div>
          <div className="font-medium">${order.tax || "0.00"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Total</div>
          <div className="font-medium">${order.totalAmount || "0.00"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Date</div>
          <div className="font-medium">{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "N/A"}</div>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetailPanel({ invoice, onSendEmail, onDownloadPdf }: { invoice: any; onSendEmail: (inv: any) => void; onDownloadPdf: (inv: any) => void }) {
  const statusOption = invoiceStatuses.find(s => s.value === invoice.status);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Invoice #{invoice.invoiceNumber}</span>
          <span className="text-xs text-muted-foreground">{invoice.customer?.name || "No customer"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className={`text-[10px] ${statusOption?.color}`}>{statusOption?.label}</Badge>
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => onDownloadPdf(invoice)}>
            <Download className="h-3 w-3 mr-1" /> PDF
          </Button>
          {invoice.status !== "paid" && (
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => onSendEmail(invoice)}>
              <Send className="h-3 w-3 mr-1" /> Email
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Subtotal</div>
          <div className="font-medium">${invoice.subtotal || "0.00"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Tax</div>
          <div className="font-medium">${invoice.tax || "0.00"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Total</div>
          <div className="font-medium">${invoice.totalAmount || "0.00"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Due Date</div>
          <div className="font-medium">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A"}</div>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailPanel({ customer }: { customer: any }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{customer.name}</span>
          <span className="text-xs text-muted-foreground">{customer.email}</span>
        </div>
        <Badge variant={customer.isActive ? "default" : "secondary"} className="text-[10px]">{customer.isActive ? "Active" : "Inactive"}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Phone</div>
          <div className="font-medium">{customer.phone || "N/A"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Company</div>
          <div className="font-medium">{customer.company || "N/A"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Address</div>
          <div className="font-medium">{customer.address || "N/A"}</div>
        </div>
      </div>
    </div>
  );
}

function PaymentDetailPanel({ payment }: { payment: any }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Payment #{payment.id}</span>
          <span className="text-xs text-muted-foreground">{payment.invoice?.invoiceNumber ? `Invoice #${payment.invoice.invoiceNumber}` : "No invoice"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-green-600">${payment.amount}</span>
          <span className="text-xs text-muted-foreground capitalize">{payment.method}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Date</div>
          <div className="font-medium">{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "N/A"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Method</div>
          <div className="font-medium capitalize">{payment.method || "N/A"}</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-muted-foreground text-[10px]">Reference</div>
          <div className="font-medium">{payment.reference || "N/A"}</div>
        </div>
      </div>
    </div>
  );
}

export default function SalesHub() {
  const [activeTab, setActiveTab] = useState("products");
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<number | string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | string | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | string | null>(null);
  const [expandedPaymentId, setExpandedPaymentId] = useState<number | string | null>(null);

  const { data: products, isLoading: productsLoading } = trpc.products.list.useQuery();
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = trpc.orders.list.useQuery();
  const { data: invoices, isLoading: invoicesLoading } = trpc.invoices.list.useQuery();
  const { data: customers, isLoading: customersLoading } = trpc.customers.list.useQuery();
  const { data: payments, isLoading: paymentsLoading } = trpc.payments.list.useQuery();

  const updateOrderStatus = trpc.orders.update.useMutation({
    onSuccess: () => { toast.success("Order updated"); refetchOrders(); },
    onError: (err: any) => toast.error(err.message),
  });

  // Integration status
  const { data: integrationStatus } = trpc.integrations.getStatus.useQuery();

  // Shopify sync mutations
  const syncShopifyOrders = trpc.shopify.sync.orders.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.imported} new orders, updated ${data.updated}`);
      refetchOrders();
      setIsSyncing(false);
    },
    onError: (err: any) => { toast.error(err.message); setIsSyncing(false); },
  });

  const syncShopifyProducts = trpc.shopify.sync.products.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.imported} new products, updated ${data.updated}`);
      setIsSyncing(false);
    },
    onError: (err: any) => { toast.error(err.message); setIsSyncing(false); },
  });

  const syncShopifyCustomers = trpc.shopify.sync.customers.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.imported} new customers, updated ${data.updated}`);
      setIsSyncing(false);
    },
    onError: (err: any) => { toast.error(err.message); setIsSyncing(false); },
  });

  const handleSyncOrders = () => {
    setIsSyncing(true);
    syncShopifyOrders.mutate({});
  };

  const handleSyncProducts = () => {
    setIsSyncing(true);
    syncShopifyProducts.mutate({});
  };

  const handleSyncCustomers = () => {
    setIsSyncing(true);
    syncShopifyCustomers.mutate({});
  };

  const handleSyncAll = () => {
    setIsSyncing(true);
    syncShopifyOrders.mutate({});
    syncShopifyProducts.mutate({});
    syncShopifyCustomers.mutate({});
  };

  const sendInvoiceEmail = trpc.invoices.sendEmail.useMutation({
    onSuccess: () => toast.success("Invoice emailed"),
    onError: (err: any) => toast.error(err.message),
  });

  const generatePdf = trpc.invoices.generatePdf.useMutation({
    onSuccess: (data) => { if (data.pdf) window.open(data.pdf, "_blank"); },
    onError: (err: any) => toast.error(err.message),
  });

  const productColumns: Column<any>[] = [
    { key: "sku", header: "SKU", type: "text", sortable: true },
    { key: "name", header: "Name", type: "text", sortable: true },
    { key: "category", header: "Category", type: "text" },
    { key: "price", header: "Price", type: "currency", sortable: true },
    { key: "stockQuantity", header: "Stock", type: "number", sortable: true },
    { key: "isActive", header: "Status", type: "badge", render: (val) => val ? "Active" : "Inactive" },
  ];

  const orderColumns: Column<any>[] = [
    { key: "orderNumber", header: "Order #", type: "text", sortable: true },
    { key: "customer.name", header: "Customer", type: "text", sortable: true },
    { key: "orderDate", header: "Date", type: "date", sortable: true },
    { key: "totalAmount", header: "Total", type: "currency", sortable: true },
    { key: "status", header: "Status", type: "badge", sortable: true, render: (val) => orderStatuses.find(s => s.value === val)?.label || val },
  ];

  const invoiceColumns: Column<any>[] = [
    { key: "invoiceNumber", header: "Invoice #", type: "text", sortable: true },
    { key: "customer.name", header: "Customer", type: "text", sortable: true },
    { key: "issueDate", header: "Issued", type: "date", sortable: true },
    { key: "dueDate", header: "Due", type: "date", sortable: true },
    { key: "totalAmount", header: "Amount", type: "currency", sortable: true },
    { key: "status", header: "Status", type: "badge", sortable: true, render: (val) => invoiceStatuses.find(s => s.value === val)?.label || val },
  ];

  const customerColumns: Column<any>[] = [
    { key: "name", header: "Name", type: "text", sortable: true },
    { key: "email", header: "Email", type: "text", sortable: true },
    { key: "phone", header: "Phone", type: "text" },
    { key: "company", header: "Company", type: "text" },
    { key: "isActive", header: "Status", type: "badge", render: (val) => val ? "Active" : "Inactive" },
  ];

  const paymentColumns: Column<any>[] = [
    { key: "id", header: "ID", type: "text", sortable: true },
    { key: "invoice.invoiceNumber", header: "Invoice", type: "text" },
    { key: "paymentDate", header: "Date", type: "date", sortable: true },
    { key: "amount", header: "Amount", type: "currency", sortable: true },
    { key: "method", header: "Method", type: "text" },
  ];

  const stats = useMemo(() => ({
    totalProducts: products?.length || 0,
    pendingOrders: orders?.filter((o: any) => o.status === "pending").length || 0,
    unpaidInvoices: invoices?.filter((i: any) => i.status !== "paid").length || 0,
    totalCustomers: customers?.length || 0,
    recentPayments: payments?.length || 0,
  }), [products, orders, invoices, customers, payments]);

  return (
    <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Sales Hub</h1>
            <p className="text-xs text-muted-foreground">Products, Orders, Invoices, Customers & Payments</p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Shopify Integration Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isSyncing}>
                  {isSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Shopify
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-green-600" />
                  Shopify Sync
                  {integrationStatus?.shopify?.configured ? (
                    <Badge variant="outline" className="ml-auto text-xs bg-green-50 text-green-700">Connected</Badge>
                  ) : (
                    <Badge variant="outline" className="ml-auto text-xs">Not Set Up</Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {integrationStatus?.shopify?.configured ? (
                  <>
                    <DropdownMenuItem onClick={handleSyncOrders}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Sync Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSyncProducts}>
                      <Package className="h-4 w-4 mr-2" />
                      Sync Products
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSyncCustomers}>
                      <Users className="h-4 w-4 mr-2" />
                      Sync Customers
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSyncAll}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync All Data
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/settings/integrations">
                      <Plug className="h-4 w-4 mr-2" />
                      Configure Shopify
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* More Integrations Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7">
                  <Plug className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>More Integrations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/import">
                    <CloudUpload className="h-4 w-4 mr-2" />
                    Import from Google Sheets
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/integrations">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/integrations">
                    <Plug className="h-4 w-4 mr-2" />
                    All Integrations
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("products")}>
            <CardContent className="pt-2 pb-2">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] text-muted-foreground">Products</p><p className="text-base font-bold">{stats.totalProducts}</p></div>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("orders")}>
            <CardContent className="pt-2 pb-2">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] text-muted-foreground">Pending Orders</p><p className="text-base font-bold text-amber-600">{stats.pendingOrders}</p></div>
                <ShoppingCart className="h-4 w-4 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("invoices")}>
            <CardContent className="pt-2 pb-2">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] text-muted-foreground">Unpaid Invoices</p><p className="text-base font-bold text-red-600">{stats.unpaidInvoices}</p></div>
                <FileText className="h-4 w-4 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("customers")}>
            <CardContent className="pt-2 pb-2">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] text-muted-foreground">Customers</p><p className="text-base font-bold">{stats.totalCustomers}</p></div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveTab("payments")}>
            <CardContent className="pt-2 pb-2">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] text-muted-foreground">Payments</p><p className="text-base font-bold text-green-600">{stats.recentPayments}</p></div>
                <CreditCard className="h-4 w-4 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-2">
            <SpreadsheetTable data={products || []} columns={productColumns} isLoading={productsLoading} showSearch expandedRowId={expandedProductId} onExpandChange={setExpandedProductId} renderExpanded={(product, onClose) => <ProductDetailPanel product={product} />} />
          </TabsContent>

          <TabsContent value="orders" className="mt-2">
            <SpreadsheetTable data={orders || []} columns={orderColumns} isLoading={ordersLoading} showSearch expandedRowId={expandedOrderId} onExpandChange={setExpandedOrderId} renderExpanded={(order, onClose) => <OrderDetailPanel order={order} onStatusChange={(id, status) => updateOrderStatus.mutate({ id, status } as any)} />} />
          </TabsContent>

          <TabsContent value="invoices" className="mt-2">
            <SpreadsheetTable data={invoices || []} columns={invoiceColumns} isLoading={invoicesLoading} showSearch expandedRowId={expandedInvoiceId} onExpandChange={setExpandedInvoiceId} renderExpanded={(invoice, onClose) => <InvoiceDetailPanel invoice={invoice} onSendEmail={(inv) => sendInvoiceEmail.mutate({ invoiceId: inv.id })} onDownloadPdf={(inv) => generatePdf.mutate({ invoiceId: inv.id })} />} />
          </TabsContent>

          <TabsContent value="customers" className="mt-2">
            <SpreadsheetTable data={customers || []} columns={customerColumns} isLoading={customersLoading} showSearch expandedRowId={expandedCustomerId} onExpandChange={setExpandedCustomerId} renderExpanded={(customer, onClose) => <CustomerDetailPanel customer={customer} />} />
          </TabsContent>

          <TabsContent value="payments" className="mt-2">
            <SpreadsheetTable data={payments || []} columns={paymentColumns} isLoading={paymentsLoading} showSearch expandedRowId={expandedPaymentId} onExpandChange={setExpandedPaymentId} renderExpanded={(payment, onClose) => <PaymentDetailPanel payment={payment} />} />
          </TabsContent>
        </Tabs>
      </div>
  );
}
