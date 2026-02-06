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
import { BookOpen, Loader2, TrendingUp, TrendingDown, DollarSign, Calendar, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "this_month":
      return { startDate: new Date(year, month, 1), endDate: now };
    case "last_month":
      return { startDate: new Date(year, month - 1, 1), endDate: new Date(year, month, 0) };
    case "this_quarter": {
      const qStart = Math.floor(month / 3) * 3;
      return { startDate: new Date(year, qStart, 1), endDate: now };
    }
    case "this_year":
      return { startDate: new Date(year, 0, 1), endDate: now };
    case "last_year":
      return { startDate: new Date(year - 1, 0, 1), endDate: new Date(year - 1, 11, 31) };
    default:
      return { startDate: new Date(year, month, 1), endDate: now };
  }
}

export default function FinancialStatements() {
  const [period, setPeriod] = useState("this_month");
  const { startDate, endDate } = getDateRange(period);

  const { data: trialBalance, isLoading: tbLoading } = trpc.generalLedger.trialBalance.useQuery();
  const { data: pnl, isLoading: pnlLoading } = trpc.generalLedger.profitAndLoss.useQuery({ startDate, endDate });
  const { data: bs, isLoading: bsLoading } = trpc.generalLedger.balanceSheet.useQuery();
  const { data: cf, isLoading: cfLoading } = trpc.generalLedger.cashFlow.useQuery({ startDate, endDate });
  const { data: arAging, isLoading: arLoading } = trpc.generalLedger.agedReceivables.useQuery();
  const { data: apAging, isLoading: apLoading } = trpc.generalLedger.agedPayables.useQuery();
  const { data: periods, isLoading: periodsLoading, refetch: refetchPeriods } = trpc.generalLedger.fiscalPeriods.useQuery();

  const closePeriod = trpc.generalLedger.closePeriod.useMutation({
    onSuccess: () => { toast.success("Period closed successfully"); refetchPeriods(); },
    onError: (err) => toast.error(err.message),
  });
  const reopenPeriod = trpc.generalLedger.reopenPeriod.useMutation({
    onSuccess: () => { toast.success("Period reopened"); refetchPeriods(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Financial Statements
          </h1>
          <p className="text-muted-foreground mt-1">
            General ledger, P&L, balance sheet, cash flow, and aging reports.
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="last_year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pnl" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="pnl">P&L</TabsTrigger>
          <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash_flow">Cash Flow</TabsTrigger>
          <TabsTrigger value="trial_balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="periods">Period Close</TabsTrigger>
        </TabsList>

        {/* Profit & Loss */}
        <TabsContent value="pnl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Profit & Loss Statement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : pnl ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-green-500/5 border-green-500/20">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(pnl.totalRevenue)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-500/5 border-red-500/20">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total Expenses</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(pnl.totalExpenses)}</p>
                      </CardContent>
                    </Card>
                    <Card className={pnl.netIncome >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Net Income</p>
                        <p className={`text-2xl font-bold ${pnl.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(pnl.netIncome)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {pnl.revenue.length > 0 && (
                    <>
                      <h3 className="font-semibold text-lg">Revenue</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pnl.revenue.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{r.code}</TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell className="text-right font-mono text-green-600">{formatCurrency(r.balance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}

                  {pnl.expenses.length > 0 && (
                    <>
                      <h3 className="font-semibold text-lg">Expenses</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pnl.expenses.map((e, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{e.code}</TableCell>
                              <TableCell>{e.name}</TableCell>
                              <TableCell className="text-right font-mono text-red-600">{formatCurrency(e.balance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}

                  {pnl.revenue.length === 0 && pnl.expenses.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No posted transactions in this period. Post journal entries to see P&L data.</p>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance_sheet">
          <Card>
            <CardHeader><CardTitle>Balance Sheet</CardTitle></CardHeader>
            <CardContent>
              {bsLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : bs ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-blue-500/5 border-blue-500/20">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total Assets</p>
                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(bs.totalAssets)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-500/5 border-red-500/20">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total Liabilities</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(bs.totalLiabilities)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-500/5 border-purple-500/20">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total Equity</p>
                        <p className="text-2xl font-bold text-purple-600">{formatCurrency(bs.totalEquity)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {[
                    { title: "Assets", items: bs.assets, color: "text-blue-600" },
                    { title: "Liabilities", items: bs.liabilities, color: "text-red-600" },
                    { title: "Equity", items: bs.equity, color: "text-purple-600" },
                  ].map(section => section.items.length > 0 && (
                    <div key={section.title}>
                      <h3 className="font-semibold text-lg">{section.title}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.items.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{item.code}</TableCell>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className={`text-right font-mono ${section.color}`}>{formatCurrency(item.balance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow */}
        <TabsContent value="cash_flow">
          <Card>
            <CardHeader><CardTitle>Cash Flow Statement</CardTitle></CardHeader>
            <CardContent>
              {cfLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : cf ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Operating</p><p className="text-xl font-bold">{formatCurrency(cf.totalOperating)}</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Investing</p><p className="text-xl font-bold">{formatCurrency(cf.totalInvesting)}</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Financing</p><p className="text-xl font-bold">{formatCurrency(cf.totalFinancing)}</p></CardContent></Card>
                    <Card className={cf.netCashChange >= 0 ? "bg-green-500/5" : "bg-red-500/5"}>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Net Cash Change</p>
                        <p className={`text-xl font-bold ${cf.netCashChange >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(cf.netCashChange)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {[
                    { title: "Operating Activities", items: cf.operating },
                    { title: "Investing Activities", items: cf.investing },
                    { title: "Financing Activities", items: cf.financing },
                  ].map(section => section.items.length > 0 && (
                    <div key={section.title}>
                      <h3 className="font-semibold">{section.title}</h3>
                      <Table>
                        <TableBody>
                          {section.items.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className={`text-right font-mono ${item.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatCurrency(item.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}

                  {cf.operating.length === 0 && cf.investing.length === 0 && cf.financing.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No cash flow data for this period.</p>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial_balance">
          <Card>
            <CardHeader><CardTitle>Trial Balance</CardTitle></CardHeader>
            <CardContent>
              {tbLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : trialBalance && trialBalance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.map((acct) => {
                      const bal = parseFloat(acct.balance || "0");
                      const isDebitNormal = acct.type === "asset" || acct.type === "expense";
                      return (
                        <TableRow key={acct.id}>
                          <TableCell className="font-mono">{acct.code}</TableCell>
                          <TableCell>{acct.name}</TableCell>
                          <TableCell><Badge variant="outline">{acct.type}</Badge></TableCell>
                          <TableCell className="text-right font-mono">
                            {isDebitNormal && bal !== 0 ? formatCurrency(Math.abs(bal)) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {!isDebitNormal && bal !== 0 ? formatCurrency(Math.abs(bal)) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(trialBalance.filter(a => a.type === "asset" || a.type === "expense").reduce((s, a) => s + Math.abs(parseFloat(a.balance || "0")), 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(trialBalance.filter(a => a.type === "liability" || a.type === "equity" || a.type === "revenue").reduce((s, a) => s + Math.abs(parseFloat(a.balance || "0")), 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No accounts in the chart of accounts yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aging Reports */}
        <TabsContent value="aging">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Aged Receivables</CardTitle></CardHeader>
              <CardContent>
                {arLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : arAging ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div className="p-2 rounded bg-green-500/10"><p className="text-muted-foreground">Current</p><p className="font-bold">{formatCurrency(arAging.totalCurrent)}</p></div>
                      <div className="p-2 rounded bg-yellow-500/10"><p className="text-muted-foreground">1-30 days</p><p className="font-bold">{formatCurrency(arAging.totalThirty)}</p></div>
                      <div className="p-2 rounded bg-orange-500/10"><p className="text-muted-foreground">31-60 days</p><p className="font-bold">{formatCurrency(arAging.totalSixty)}</p></div>
                      <div className="p-2 rounded bg-red-500/10"><p className="text-muted-foreground">90+ days</p><p className="font-bold text-red-600">{formatCurrency(arAging.totalNinetyPlus)}</p></div>
                    </div>
                    {arAging.ninetyPlus.length > 0 && (
                      <Table>
                        <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {arAging.ninetyPlus.map((item, i) => (
                            <TableRow key={i}><TableCell>{item.invoiceNumber}</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(item.amount)}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5" /> Aged Payables</CardTitle></CardHeader>
              <CardContent>
                {apLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : apAging ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div className="p-2 rounded bg-green-500/10"><p className="text-muted-foreground">Current</p><p className="font-bold">{formatCurrency(apAging.totalCurrent)}</p></div>
                      <div className="p-2 rounded bg-yellow-500/10"><p className="text-muted-foreground">1-30 days</p><p className="font-bold">{formatCurrency(apAging.totalThirty)}</p></div>
                      <div className="p-2 rounded bg-orange-500/10"><p className="text-muted-foreground">31-60 days</p><p className="font-bold">{formatCurrency(apAging.totalSixty)}</p></div>
                      <div className="p-2 rounded bg-red-500/10"><p className="text-muted-foreground">90+ days</p><p className="font-bold text-red-600">{formatCurrency(apAging.totalNinetyPlus)}</p></div>
                    </div>
                    {apAging.ninetyPlus.length > 0 && (
                      <Table>
                        <TableHeader><TableRow><TableHead>PO</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {apAging.ninetyPlus.map((item, i) => (
                            <TableRow key={i}><TableCell>{item.poNumber}</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(item.amount)}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Period Close */}
        <TabsContent value="periods">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Fiscal Periods</CardTitle></CardHeader>
            <CardContent>
              {periodsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : periods && periods.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell><Badge variant="outline">{p.periodType}</Badge></TableCell>
                        <TableCell>{new Date(p.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(p.endDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={
                            p.status === "open" ? "bg-green-500/10 text-green-600" :
                            p.status === "closed" ? "bg-amber-500/10 text-amber-600" :
                            "bg-red-500/10 text-red-600"
                          }>{p.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {p.status === "open" && (
                            <Button size="sm" variant="outline" onClick={() => closePeriod.mutate({ periodId: p.id })} disabled={closePeriod.isPending}>
                              <Lock className="h-3 w-3 mr-1" /> Close
                            </Button>
                          )}
                          {p.status === "closed" && (
                            <Button size="sm" variant="ghost" onClick={() => reopenPeriod.mutate({ periodId: p.id })} disabled={reopenPeriod.isPending}>
                              <Unlock className="h-3 w-3 mr-1" /> Reopen
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No fiscal periods defined. Create periods to enable period close.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
