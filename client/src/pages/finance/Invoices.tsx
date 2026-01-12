import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Plus, Search, Loader2, Trash2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function formatCurrency(value: string | null | undefined) {
  const num = parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

type LineItem = {
  productId?: number;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
};

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [emailMessage, setEmailMessage] = useState("");
  const [formData, setFormData] = useState({
    customerId: 0,
    dueDate: "",
    notes: "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const { data: invoices, isLoading, refetch } = trpc.invoices.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();
  
  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: () => {
      toast.success("Invoice created successfully");
      setIsOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendInvoiceEmail = trpc.invoices.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Invoice sent to customer");
      setIsEmailDialogOpen(false);
      setEmailMessage("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({ customerId: 0, dueDate: "", notes: "" });
    setLineItems([]);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      productId: undefined,
      description: "",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
      taxAmount: "0",
      totalAmount: "0",
    }]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number | undefined) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate totals
    const qty = parseFloat(updated[index].quantity) || 0;
    const price = parseFloat(updated[index].unitPrice) || 0;
    const taxRate = parseFloat(updated[index].taxRate) || 0;
    const subtotal = qty * price;
    const taxAmount = subtotal * (taxRate / 100);
    updated[index].taxAmount = taxAmount.toFixed(2);
    updated[index].totalAmount = (subtotal + taxAmount).toFixed(2);
    
    setLineItems(updated);
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products?.find(p => p.id === parseInt(productId));
    if (product) {
      const updated = [...lineItems];
      updated[index] = {
        ...updated[index],
        productId: product.id,
        description: product.name,
        unitPrice: product.unitPrice || "0",
      };
      // Recalculate
      const qty = parseFloat(updated[index].quantity) || 0;
      const price = parseFloat(updated[index].unitPrice) || 0;
      const taxRate = parseFloat(updated[index].taxRate) || 0;
      const subtotal = qty * price;
      const taxAmount = subtotal * (taxRate / 100);
      updated[index].taxAmount = taxAmount.toFixed(2);
      updated[index].totalAmount = (subtotal + taxAmount).toFixed(2);
      setLineItems(updated);
    }
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
    const tax = lineItems.reduce((sum, item) => sum + (parseFloat(item.taxAmount) || 0), 0);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const filteredInvoices = invoices?.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-600",
    sent: "bg-blue-500/10 text-blue-600",
    paid: "bg-green-500/10 text-green-600",
    overdue: "bg-red-500/10 text-red-600",
    cancelled: "bg-gray-500/10 text-gray-500",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }
    const totals = calculateTotals();
    createInvoice.mutate({
      customerId: formData.customerId,
      issueDate: new Date(),
      subtotal: totals.subtotal.toFixed(2),
      taxAmount: totals.tax.toFixed(2),
      totalAmount: totals.total.toFixed(2),
      dueDate: new Date(formData.dueDate),
      notes: formData.notes || undefined,
      items: lineItems.map(item => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
      })),
    });
  };

  const handleSendEmail = () => {
    if (!selectedInvoiceId) return;
    sendInvoiceEmail.mutate({
      invoiceId: selectedInvoiceId,
      message: emailMessage || undefined,
    });
  };

  const openEmailDialog = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);
    setIsEmailDialogOpen(true);
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Invoices
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage customer invoices and track payments.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create Invoice</DialogTitle>
                <DialogDescription>
                  Select products and create an invoice for a customer.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Select
                      value={formData.customerId.toString()}
                      onValueChange={(value) => setFormData({ ...formData, customerId: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name} {customer.email ? `(${customer.email})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Line Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  </div>
                  
                  {lineItems.length === 0 ? (
                    <div className="border rounded-md p-4 text-center text-muted-foreground">
                      No items added. Click "Add Item" to add products to this invoice.
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Product</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-[80px]">Qty</TableHead>
                            <TableHead className="w-[100px]">Price</TableHead>
                            <TableHead className="w-[80px]">Tax %</TableHead>
                            <TableHead className="w-[100px]">Total</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Select
                                  value={item.productId?.toString() || ""}
                                  onValueChange={(value) => selectProduct(index, value)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products?.map((product) => (
                                      <SelectItem key={product.id} value={product.id.toString()}>
                                        {product.name} - {formatCurrency(product.unitPrice)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="h-8"
                                  value={item.description}
                                  onChange={(e) => updateLineItem(index, "description", e.target.value)}
                                  placeholder="Description"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="h-8"
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="h-8"
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="h-8"
                                  type="number"
                                  step="0.01"
                                  value={item.taxRate}
                                  onChange={(e) => updateLineItem(index, "taxRate", e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(item.totalAmount)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLineItem(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Totals */}
                {lineItems.length > 0 && (
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{formatCurrency(totals.subtotal.toFixed(2))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax:</span>
                        <span>{formatCurrency(totals.tax.toFixed(2))}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(totals.total.toFixed(2))}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Payment terms, special instructions..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createInvoice.isPending || lineItems.length === 0}>
                  {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Invoice
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invoice to Customer</DialogTitle>
            <DialogDescription>
              Send this invoice via email to the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Message (Optional)</Label>
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Add a personal message to include with the invoice..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sendInvoiceEmail.isPending}>
              {sendInvoiceEmail.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.customer?.name || "-"}</TableCell>
                    <TableCell>
                      {invoice.issueDate ? format(new Date(invoice.issueDate), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status] || ""}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEmailDialog(invoice.id)}
                        disabled={invoice.status === "paid" || invoice.status === "cancelled"}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
