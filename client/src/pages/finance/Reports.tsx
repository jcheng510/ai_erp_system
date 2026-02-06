import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BarChart3, Loader2, TrendingUp, TrendingDown, DollarSign, Package, Users } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (period) {
    case "this_month": return { startDate: new Date(year, month, 1), endDate: now };
    case "last_month": return { startDate: new Date(year, month - 1, 1), endDate: new Date(year, month, 0) };
    case "this_quarter": { const q = Math.floor(month / 3) * 3; return { startDate: new Date(year, q, 1), endDate: now }; }
    case "this_year": return { startDate: new Date(year, 0, 1), endDate: now };
    case "last_year": return { startDate: new Date(year - 1, 0, 1), endDate: new Date(year - 1, 11, 31) };
    default: return { startDate: new Date(year, month, 1), endDate: now };
  }
}

export default function Reports() {
  const [period, setPeriod] = useState("this_month");
  const { startDate, endDate } = getDateRange(period);

  const { data: kpi, isLoading: kpiLoading } = trpc.reports.kpiDashboard.useQuery();
  const { data: vendorSpend, isLoading: vsLoading } = trpc.reports.vendorSpend.useQuery({ startDate, endDate });
  const { data: sales, isLoading: salesLoading } = trpc.reports.salesSummary.useQuery({ startDate, endDate });
  const { data: invVal, isLoading: invLoading } = trpc.reports.inventoryValuation.useQuery();
  const { data: cashFlow, isLoading: cfLoading } = trpc.reports.cashFlowSummary.useQuery({ startDate, endDate });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            KPI dashboards, vendor spend, sales analysis, and inventory valuation.
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="last_year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Overview */}
      {kpiLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : kpi ? (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Revenue (MTD)</p>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(kpi.revenue.current)}</p>
              <p className={`text-xs ${kpi.revenue.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatPercent(kpi.revenue.change)} vs last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Expenses (MTD)</p>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(kpi.expenses.current)}</p>
              <p className={`text-xs ${kpi.expenses.change <= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatPercent(kpi.expenses.change)} vs last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Cash Balance</p>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(kpi.cashBalance)}</p>
              <p className="text-xs text-muted-foreground">AR: {formatCurrency(kpi.arBalance)} | AP: {formatCurrency(kpi.apBalance)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Gross Margin</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{kpi.grossMargin.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {kpi.openPOs} open POs | {kpi.overdueInvoices} overdue invoices
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs defaultValue="vendor_spend" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vendor_spend">Vendor Spend</TabsTrigger>
          <TabsTrigger value="sales">Sales Summary</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Valuation</TabsTrigger>
          <TabsTrigger value="cash_flow">Cash Flow</TabsTrigger>
        </TabsList>

        {/* Vendor Spend */}
        <TabsContent value="vendor_spend">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Vendor Spend Analysis
                {vendorSpend && <Badge variant="outline" className="ml-2">{formatCurrency(vendorSpend.totalSpend)} total</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vsLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : vendorSpend && vendorSpend.vendors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">PO Count</TableHead>
                      <TableHead className="text-right">Total Spend</TableHead>
                      <TableHead className="text-right">Avg Order Value</TableHead>
                      <TableHead>% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorSpend.vendors.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{v.vendorName}</TableCell>
                        <TableCell className="text-right">{v.poCount}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(v.totalSpend)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(v.avgOrderValue)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2 max-w-[100px]">
                              <div className="bg-primary rounded-full h-2" style={{ width: `${vendorSpend.totalSpend > 0 ? (v.totalSpend / vendorSpend.totalSpend) * 100 : 0}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {vendorSpend.totalSpend > 0 ? ((v.totalSpend / vendorSpend.totalSpend) * 100).toFixed(0) : 0}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No vendor spend data for this period.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Summary */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Sales Summary
                {sales && <Badge variant="outline" className="ml-2">{sales.totalOrders} orders | {formatCurrency(sales.totalRevenue)}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : sales && sales.byCustomer.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-xl font-bold">{formatCurrency(sales.totalRevenue)}</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Orders</p><p className="text-xl font-bold">{sales.totalOrders}</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Avg Order Value</p><p className="text-xl font-bold">{formatCurrency(sales.avgOrderValue)}</p></CardContent></Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.byCustomer.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.customerName}</TableCell>
                          <TableCell className="text-right">{c.orderCount}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(c.totalRevenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">No sales data for this period.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Valuation */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory Valuation
                {invVal && <Badge variant="outline" className="ml-2">{invVal.totalItems} items | {formatCurrency(invVal.totalValue)}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : invVal && invVal.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invVal.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{item.sku || "-"}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(item.unitCost)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(item.totalValue)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={4}>TOTAL INVENTORY VALUE</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(invVal.totalValue)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No inventory items with positive quantities.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow */}
        <TabsContent value="cash_flow">
          <Card>
            <CardHeader><CardTitle>Cash Flow Summary</CardTitle></CardHeader>
            <CardContent>
              {cfLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : cashFlow ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-green-500/5"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Inflows</p><p className="text-xl font-bold text-green-600">{formatCurrency(cashFlow.inflows)}</p></CardContent></Card>
                    <Card className="bg-red-500/5"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Outflows</p><p className="text-xl font-bold text-red-600">{formatCurrency(cashFlow.outflows)}</p></CardContent></Card>
                    <Card className={cashFlow.net >= 0 ? "bg-green-500/5" : "bg-red-500/5"}>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Net Cash Flow</p>
                        <p className={`text-xl font-bold ${cashFlow.net >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(cashFlow.net)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {cashFlow.byMonth.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Inflows</TableHead>
                          <TableHead className="text-right">Outflows</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashFlow.byMonth.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{m.month}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(m.inflows)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{formatCurrency(m.outflows)}</TableCell>
                            <TableCell className={`text-right font-mono font-medium ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(m.net)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
