import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, Minus, Bell, DollarSign, Clock, AlertTriangle,
  Plus, Settings, BarChart3, LineChart
} from "lucide-react";

export default function VendorMonitoring() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [showAddPrice, setShowAddPrice] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const [newPrice, setNewPrice] = useState({
    vendorId: 0,
    newPrice: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    currency: "USD",
    unit: "",
    changeSource: "manual" as const,
    notes: "",
  });
  const [alertConfig, setAlertConfig] = useState({
    vendorId: undefined as number | undefined,
    leadTimeVarianceThresholdDays: 3,
    priceIncreaseThresholdPercent: "5",
    priceDecreaseThresholdPercent: "10",
    alertOnPriceIncrease: true,
    alertOnPriceDecrease: false,
    alertOnLateDelivery: true,
    alertOnQualityIssue: true,
    performanceScoreThreshold: "70",
    alertOnLowPerformance: true,
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => trpc.vendors.list.query(),
  });

  const { data: performanceRecords } = useQuery({
    queryKey: ["vendorPerformance", selectedVendorId],
    queryFn: () => trpc.vendorMonitoring.performance.list.query({
      vendorId: selectedVendorId || undefined,
    }),
  });

  const { data: priceHistory } = useQuery({
    queryKey: ["vendorPriceHistory", selectedVendorId],
    queryFn: () => trpc.vendorMonitoring.priceHistory.list.query({
      vendorId: selectedVendorId || undefined,
    }),
  });

  const { data: alertConfigs } = useQuery({
    queryKey: ["vendorAlertConfigs"],
    queryFn: () => trpc.vendorMonitoring.alertConfigs.list.query({}),
  });

  const { data: globalAlertConfig } = useQuery({
    queryKey: ["globalAlertConfig"],
    queryFn: () => trpc.vendorMonitoring.alertConfigs.getGlobal.query(),
  });

  const createPriceHistoryMutation = useMutation({
    mutationFn: (input: any) => trpc.vendorMonitoring.priceHistory.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorPriceHistory"] });
      setShowAddPrice(false);
      toast({ title: "Price Recorded", description: "Vendor price history has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record price", variant: "destructive" });
    },
  });

  const createAlertConfigMutation = useMutation({
    mutationFn: (input: any) => trpc.vendorMonitoring.alertConfigs.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorAlertConfigs"] });
      setShowAlertConfig(false);
      toast({ title: "Alert Config Saved", description: "Vendor alert configuration has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save alert config", variant: "destructive" });
    },
  });

  const getTrendIcon = (trend?: string | null) => {
    switch (trend) {
      case "improving": return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "declining": return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendor Monitoring</h1>
          <p className="text-muted-foreground">Track vendor performance, lead times, and price changes</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAlertConfig} onOpenChange={setShowAlertConfig}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Alert Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alert Configuration</DialogTitle>
                <DialogDescription>
                  Configure thresholds for vendor alerts
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Vendor (leave empty for global default)</Label>
                  <Select
                    value={alertConfig.vendorId?.toString() || "global"}
                    onValueChange={(v) => setAlertConfig({
                      ...alertConfig,
                      vendorId: v === "global" ? undefined : parseInt(v),
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global Default</SelectItem>
                      {vendors?.map((v) => (
                        <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="font-semibold">Lead Time Alerts</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Alert on late delivery</span>
                    <Switch
                      checked={alertConfig.alertOnLateDelivery}
                      onCheckedChange={(v) => setAlertConfig({ ...alertConfig, alertOnLateDelivery: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Variance threshold (days)</Label>
                    <Input
                      type="number"
                      value={alertConfig.leadTimeVarianceThresholdDays}
                      onChange={(e) => setAlertConfig({
                        ...alertConfig,
                        leadTimeVarianceThresholdDays: parseInt(e.target.value),
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="font-semibold">Price Alerts</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Alert on price increase</span>
                    <Switch
                      checked={alertConfig.alertOnPriceIncrease}
                      onCheckedChange={(v) => setAlertConfig({ ...alertConfig, alertOnPriceIncrease: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Increase threshold (%)</Label>
                    <Input
                      value={alertConfig.priceIncreaseThresholdPercent}
                      onChange={(e) => setAlertConfig({
                        ...alertConfig,
                        priceIncreaseThresholdPercent: e.target.value,
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Alert on price decrease</span>
                    <Switch
                      checked={alertConfig.alertOnPriceDecrease}
                      onCheckedChange={(v) => setAlertConfig({ ...alertConfig, alertOnPriceDecrease: v })}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="font-semibold">Performance Alerts</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Alert on low performance</span>
                    <Switch
                      checked={alertConfig.alertOnLowPerformance}
                      onCheckedChange={(v) => setAlertConfig({ ...alertConfig, alertOnLowPerformance: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Performance score threshold</Label>
                    <Input
                      value={alertConfig.performanceScoreThreshold}
                      onChange={(e) => setAlertConfig({
                        ...alertConfig,
                        performanceScoreThreshold: e.target.value,
                      })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAlertConfig(false)}>Cancel</Button>
                <Button onClick={() => createAlertConfigMutation.mutate(alertConfig)}>
                  Save Configuration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddPrice} onOpenChange={setShowAddPrice}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Record Price
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Vendor Price</DialogTitle>
                <DialogDescription>
                  Add a new price record to track vendor pricing changes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Vendor *</Label>
                  <Select
                    value={newPrice.vendorId?.toString() || ""}
                    onValueChange={(v) => setNewPrice({ ...newPrice, vendorId: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors?.map((v) => (
                        <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>New Price *</Label>
                    <Input
                      value={newPrice.newPrice}
                      onChange={(e) => setNewPrice({ ...newPrice, newPrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={newPrice.currency}
                      onValueChange={(v) => setNewPrice({ ...newPrice, currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Effective Date</Label>
                    <Input
                      type="date"
                      value={newPrice.effectiveDate}
                      onChange={(e) => setNewPrice({ ...newPrice, effectiveDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input
                      value={newPrice.unit}
                      onChange={(e) => setNewPrice({ ...newPrice, unit: e.target.value })}
                      placeholder="e.g., per unit, per kg"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select
                    value={newPrice.changeSource}
                    onValueChange={(v: any) => setNewPrice({ ...newPrice, changeSource: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual Entry</SelectItem>
                      <SelectItem value="quote">Quote</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={newPrice.notes}
                    onChange={(e) => setNewPrice({ ...newPrice, notes: e.target.value })}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddPrice(false)}>Cancel</Button>
                <Button
                  onClick={() => createPriceHistoryMutation.mutate({
                    ...newPrice,
                    effectiveDate: new Date(newPrice.effectiveDate),
                  })}
                  disabled={!newPrice.vendorId || !newPrice.newPrice}
                >
                  Save Price
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{performanceRecords?.length || 0}</div>
                <p className="text-sm text-muted-foreground">Performance Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{priceHistory?.length || 0}</div>
                <p className="text-sm text-muted-foreground">Price Changes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{alertConfigs?.length || 0}</div>
                <p className="text-sm text-muted-foreground">Alert Configs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">
                  {performanceRecords?.filter(r => parseFloat(r.leadTimeVarianceDays || '0') > 0).length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Late Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label>Filter by Vendor:</Label>
            <Select
              value={selectedVendorId?.toString() || "all"}
              onValueChange={(v) => setSelectedVendorId(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors?.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <LineChart className="w-4 h-4 mr-2" />
            Price History
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="w-4 h-4 mr-2" />
            Alert Configurations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Performance Records</CardTitle>
              <CardDescription>Track delivery times, quality scores, and overall performance</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>On-Time %</TableHead>
                    <TableHead>Lead Time Var.</TableHead>
                    <TableHead>Quality Score</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceRecords?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No performance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    performanceRecords?.map((record) => {
                      const vendor = vendors?.find(v => v.id === record.vendorId);
                      const onTimePercent = record.totalOrders && record.totalOrders > 0
                        ? ((record.onTimeDeliveries || 0) / record.totalOrders * 100).toFixed(0)
                        : "-";
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{vendor?.name || `Vendor #${record.vendorId}`}</TableCell>
                          <TableCell>
                            {new Date(record.periodStart).toLocaleDateString()} - {new Date(record.periodEnd).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{record.totalOrders || 0}</TableCell>
                          <TableCell>{onTimePercent}%</TableCell>
                          <TableCell>
                            <span className={parseFloat(record.leadTimeVarianceDays || '0') > 0 ? "text-red-600" : "text-green-600"}>
                              {record.leadTimeVarianceDays ? `${parseFloat(record.leadTimeVarianceDays) > 0 ? '+' : ''}${record.leadTimeVarianceDays} days` : "-"}
                            </span>
                          </TableCell>
                          <TableCell>{record.qualityScore || "-"}</TableCell>
                          <TableCell>
                            <span className={getScoreColor(parseFloat(record.overallScore || '0'))}>
                              {record.overallScore || "-"}
                            </span>
                          </TableCell>
                          <TableCell>{getTrendIcon(record.scoreTrend)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Price History</CardTitle>
              <CardDescription>Track vendor pricing changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Previous Price</TableHead>
                    <TableHead>New Price</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Alert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceHistory?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No price history found
                      </TableCell>
                    </TableRow>
                  ) : (
                    priceHistory?.map((price) => {
                      const vendor = vendors?.find(v => v.id === price.vendorId);
                      const changePercent = parseFloat(price.priceChangePercent || '0');
                      return (
                        <TableRow key={price.id}>
                          <TableCell className="font-medium">{vendor?.name || `Vendor #${price.vendorId}`}</TableCell>
                          <TableCell>{new Date(price.effectiveDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {price.previousPrice ? `$${parseFloat(price.previousPrice).toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell className="font-medium">
                            ${parseFloat(price.newPrice).toFixed(2)} {price.currency}
                          </TableCell>
                          <TableCell>
                            {price.priceChangePercent ? (
                              <span className={changePercent > 0 ? "text-red-600" : "text-green-600"}>
                                {changePercent > 0 ? "+" : ""}{price.priceChangePercent}%
                              </span>
                            ) : (
                              <Badge variant="outline">New</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{price.changeSource}</Badge>
                          </TableCell>
                          <TableCell>
                            {price.alertGenerated ? (
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Configurations</CardTitle>
              <CardDescription>Manage alert thresholds for vendor monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              {globalAlertConfig && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Global Default Configuration
                  </h4>
                  <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Price Increase Alert:</span>{" "}
                      {globalAlertConfig.alertOnPriceIncrease ? `>${globalAlertConfig.priceIncreaseThresholdPercent}%` : "Off"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Late Delivery Alert:</span>{" "}
                      {globalAlertConfig.alertOnLateDelivery ? `>${globalAlertConfig.leadTimeVarianceThresholdDays} days` : "Off"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Performance Alert:</span>{" "}
                      {globalAlertConfig.alertOnLowPerformance ? `<${globalAlertConfig.performanceScoreThreshold}` : "Off"}
                    </div>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Price Increase</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertConfigs?.filter(c => c.vendorId).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No vendor-specific alert configurations. Using global defaults.
                      </TableCell>
                    </TableRow>
                  ) : (
                    alertConfigs?.filter(c => c.vendorId).map((config) => {
                      const vendor = vendors?.find(v => v.id === config.vendorId);
                      return (
                        <TableRow key={config.id}>
                          <TableCell className="font-medium">{vendor?.name || `Vendor #${config.vendorId}`}</TableCell>
                          <TableCell>
                            {config.alertOnPriceIncrease ? `>${config.priceIncreaseThresholdPercent}%` : "Off"}
                          </TableCell>
                          <TableCell>
                            {config.alertOnLateDelivery ? `>${config.leadTimeVarianceThresholdDays} days` : "Off"}
                          </TableCell>
                          <TableCell>
                            {config.alertOnLowPerformance ? `<${config.performanceScoreThreshold}` : "Off"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.isActive ? "default" : "secondary"}>
                              {config.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
