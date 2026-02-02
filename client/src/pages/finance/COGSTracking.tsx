import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Loader2,
  Plus,
  Eye,
  CheckCircle,
  Calculator,
  Package,
  BarChart3,
  FileText,
  Target,
  AlertTriangle,
  Calendar
} from "lucide-react";

export default function COGSTracking() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCalculateDialog, setShowCalculateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showStandardCostDialog, setShowStandardCostDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const [newRecord, setNewRecord] = useState({
    productId: "",
    periodType: "monthly" as const,
    periodStart: "",
    periodEnd: "",
    unitsProduced: "",
    unitsSold: "",
    directMaterialsCost: "",
    directLaborCost: "",
    packagingCost: "",
    manufacturingOverhead: "",
    freightInbound: "",
    dutiesAndTariffs: "",
    revenue: "",
    notes: "",
  });

  const [bomCalc, setBomCalc] = useState({
    productId: "",
    periodStart: "",
    periodEnd: "",
    unitsProduced: "",
  });

  const [newStandardCost, setNewStandardCost] = useState({
    productId: "",
    effectiveDate: "",
    standardMaterialCost: "",
    standardLaborCost: "",
    standardOverheadCost: "",
    standardTotalCost: "",
    standardSellingPrice: "",
    targetMarginPercent: "",
  });

  // Queries
  const { data: dashboardSummary } = trpc.cogs.getDashboardSummary.useQuery();
  const { data: cogsRecords, refetch: refetchRecords } = trpc.cogs.records.list.useQuery({});
  const { data: standardCosts, refetch: refetchStandardCosts } = trpc.cogs.standardCosts.list.useQuery({});
  const { data: products } = trpc.products.list.useQuery({});
  const { data: recordDetail } = trpc.cogs.records.get.useQuery(
    { id: selectedRecord?.cogs?.id },
    { enabled: !!selectedRecord?.cogs?.id }
  );

  // Mutations
  const createRecordMutation = trpc.cogs.records.create.useMutation({
    onSuccess: (data) => {
      toast.success(`COGS record ${data.recordNumber} created. Total: $${data.totalCogs.toFixed(2)}`);
      refetchRecords();
      setShowCreateDialog(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const calculateFromBOMMutation = trpc.cogs.records.calculateFromBOM.useMutation({
    onSuccess: (data) => {
      toast.success(`COGS calculated from BOM: $${data.totalCogs.toFixed(2)} total, $${data.cogsPerUnit.toFixed(2)} per unit`);
      refetchRecords();
      setShowCalculateDialog(false);
      setIsCalculating(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsCalculating(false);
    },
  });

  const verifyRecordMutation = trpc.cogs.records.verify.useMutation({
    onSuccess: () => {
      toast.success("COGS record verified");
      refetchRecords();
    },
    onError: (error) => toast.error(error.message),
  });

  const createStandardCostMutation = trpc.cogs.standardCosts.create.useMutation({
    onSuccess: () => {
      toast.success("Standard cost created");
      refetchStandardCosts();
      setShowStandardCostDialog(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCreateRecord = () => {
    if (!newRecord.productId || !newRecord.periodStart || !newRecord.periodEnd) {
      toast.error("Please fill in required fields");
      return;
    }
    createRecordMutation.mutate({
      productId: parseInt(newRecord.productId),
      periodType: newRecord.periodType,
      periodStart: new Date(newRecord.periodStart),
      periodEnd: new Date(newRecord.periodEnd),
      unitsProduced: newRecord.unitsProduced || undefined,
      unitsSold: newRecord.unitsSold || undefined,
      directMaterialsCost: newRecord.directMaterialsCost || undefined,
      directLaborCost: newRecord.directLaborCost || undefined,
      packagingCost: newRecord.packagingCost || undefined,
      manufacturingOverhead: newRecord.manufacturingOverhead || undefined,
      freightInbound: newRecord.freightInbound || undefined,
      dutiesAndTariffs: newRecord.dutiesAndTariffs || undefined,
      revenue: newRecord.revenue || undefined,
      notes: newRecord.notes || undefined,
    });
  };

  const handleCalculateFromBOM = () => {
    if (!bomCalc.productId || !bomCalc.periodStart || !bomCalc.periodEnd || !bomCalc.unitsProduced) {
      toast.error("Please fill in all fields");
      return;
    }
    setIsCalculating(true);
    calculateFromBOMMutation.mutate({
      productId: parseInt(bomCalc.productId),
      periodStart: new Date(bomCalc.periodStart),
      periodEnd: new Date(bomCalc.periodEnd),
      unitsProduced: bomCalc.unitsProduced,
    });
  };

  const handleCreateStandardCost = () => {
    if (!newStandardCost.productId || !newStandardCost.effectiveDate || !newStandardCost.standardTotalCost) {
      toast.error("Please fill in required fields");
      return;
    }
    createStandardCostMutation.mutate({
      productId: parseInt(newStandardCost.productId),
      effectiveDate: new Date(newStandardCost.effectiveDate),
      standardMaterialCost: newStandardCost.standardMaterialCost || undefined,
      standardLaborCost: newStandardCost.standardLaborCost || undefined,
      standardOverheadCost: newStandardCost.standardOverheadCost || undefined,
      standardTotalCost: newStandardCost.standardTotalCost,
      standardSellingPrice: newStandardCost.standardSellingPrice || undefined,
      targetMarginPercent: newStandardCost.targetMarginPercent || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      calculated: "secondary",
      verified: "default",
      locked: "default",
    };
    const icons: Record<string, any> = {
      verified: <CheckCircle className="h-3 w-3 mr-1" />,
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {icons[status]}{status}
      </Badge>
    );
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "-";
    return `$${parseFloat(value.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: string | number | null | undefined) => {
    if (!value) return "-";
    return `${parseFloat(value.toString()).toFixed(2)}%`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">COGS Tracking</h1>
          <p className="text-muted-foreground">Track and analyze cost of goods sold by product</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCalculateDialog} onOpenChange={setShowCalculateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline"><Calculator className="h-4 w-4 mr-2" />Calculate from BOM</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Calculate COGS from BOM</DialogTitle>
                <DialogDescription>Auto-calculate costs using Bill of Materials</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Select value={bomCalc.productId} onValueChange={(v) => setBomCalc({ ...bomCalc, productId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products?.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period Start *</Label>
                    <Input
                      type="date"
                      value={bomCalc.periodStart}
                      onChange={(e) => setBomCalc({ ...bomCalc, periodStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period End *</Label>
                    <Input
                      type="date"
                      value={bomCalc.periodEnd}
                      onChange={(e) => setBomCalc({ ...bomCalc, periodEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Units Produced *</Label>
                  <Input
                    type="number"
                    value={bomCalc.unitsProduced}
                    onChange={(e) => setBomCalc({ ...bomCalc, unitsProduced: e.target.value })}
                    placeholder="Enter units produced"
                  />
                </div>
                <Button onClick={handleCalculateFromBOM} disabled={isCalculating} className="w-full">
                  {isCalculating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculating...</>
                  ) : (
                    <><Calculator className="h-4 w-4 mr-2" />Calculate COGS</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Manual Entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create COGS Record</DialogTitle>
                <DialogDescription>Manually enter cost of goods sold data</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product *</Label>
                    <Select value={newRecord.productId} onValueChange={(v) => setNewRecord({ ...newRecord, productId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products?.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Period Type</Label>
                    <Select value={newRecord.periodType} onValueChange={(v: any) => setNewRecord({ ...newRecord, periodType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="per_batch">Per Batch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period Start *</Label>
                    <Input
                      type="date"
                      value={newRecord.periodStart}
                      onChange={(e) => setNewRecord({ ...newRecord, periodStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period End *</Label>
                    <Input
                      type="date"
                      value={newRecord.periodEnd}
                      onChange={(e) => setNewRecord({ ...newRecord, periodEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Units Produced</Label>
                    <Input
                      type="number"
                      value={newRecord.unitsProduced}
                      onChange={(e) => setNewRecord({ ...newRecord, unitsProduced: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Units Sold</Label>
                    <Input
                      type="number"
                      value={newRecord.unitsSold}
                      onChange={(e) => setNewRecord({ ...newRecord, unitsSold: e.target.value })}
                    />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">Direct Costs</Label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Materials Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRecord.directMaterialsCost}
                      onChange={(e) => setNewRecord({ ...newRecord, directMaterialsCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Labor Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRecord.directLaborCost}
                      onChange={(e) => setNewRecord({ ...newRecord, directLaborCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Packaging Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRecord.packagingCost}
                      onChange={(e) => setNewRecord({ ...newRecord, packagingCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">Indirect Costs</Label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Manufacturing Overhead</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRecord.manufacturingOverhead}
                      onChange={(e) => setNewRecord({ ...newRecord, manufacturingOverhead: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inbound Freight</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRecord.freightInbound}
                      onChange={(e) => setNewRecord({ ...newRecord, freightInbound: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duties & Tariffs</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRecord.dutiesAndTariffs}
                      onChange={(e) => setNewRecord({ ...newRecord, dutiesAndTariffs: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">Revenue</Label>
                </div>
                <div className="space-y-2">
                  <Label>Total Revenue</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newRecord.revenue}
                    onChange={(e) => setNewRecord({ ...newRecord, revenue: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newRecord.notes}
                    onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>
                <Button onClick={handleCreateRecord} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />Create COGS Record
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Month COGS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardSummary?.currentMonthTotalCogs)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Month Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardSummary?.currentMonthRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Month COGS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardSummary?.lastMonthTotalCogs)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Month Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardSummary?.lastMonthRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />Missing Standard Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dashboardSummary?.productsWithoutStandardCosts || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">COGS Records</TabsTrigger>
          <TabsTrigger value="standard">Standard Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>COGS Records</CardTitle>
              <CardDescription>Cost of goods sold by product and period</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Units Sold</TableHead>
                    <TableHead>Total COGS</TableHead>
                    <TableHead>COGS/Unit</TableHead>
                    <TableHead>Gross Margin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cogsRecords?.map((record) => (
                    <TableRow key={record.cogs.id}>
                      <TableCell className="font-mono">{record.cogs.recordNumber}</TableCell>
                      <TableCell>{record.product?.name || "-"}</TableCell>
                      <TableCell>
                        {new Date(record.cogs.periodStart).toLocaleDateString()} -
                        {new Date(record.cogs.periodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{record.cogs.unitsSold || "-"}</TableCell>
                      <TableCell>{formatCurrency(record.cogs.totalCogs)}</TableCell>
                      <TableCell>{formatCurrency(record.cogs.cogsPerUnit)}</TableCell>
                      <TableCell>
                        <span className={parseFloat(record.cogs.grossMarginPercent as string || '0') > 0 ? "text-green-600" : "text-red-600"}>
                          {formatPercent(record.cogs.grossMarginPercent)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(record.cogs.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(record);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {record.cogs.status === 'calculated' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => verifyRecordMutation.mutate({ id: record.cogs.id })}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!cogsRecords || cogsRecords.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No COGS records yet. Create one to start tracking costs.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standard" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Standard Costs</CardTitle>
                <CardDescription>Baseline costs for variance analysis</CardDescription>
              </div>
              <Dialog open={showStandardCostDialog} onOpenChange={setShowStandardCostDialog}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Standard Cost</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Standard Cost</DialogTitle>
                    <DialogDescription>Set standard cost benchmarks for a product</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Product *</Label>
                      <Select value={newStandardCost.productId} onValueChange={(v) => setNewStandardCost({ ...newStandardCost, productId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>
                          {products?.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Effective Date *</Label>
                      <Input
                        type="date"
                        value={newStandardCost.effectiveDate}
                        onChange={(e) => setNewStandardCost({ ...newStandardCost, effectiveDate: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Material Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newStandardCost.standardMaterialCost}
                          onChange={(e) => setNewStandardCost({ ...newStandardCost, standardMaterialCost: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Labor Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newStandardCost.standardLaborCost}
                          onChange={(e) => setNewStandardCost({ ...newStandardCost, standardLaborCost: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Overhead Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newStandardCost.standardOverheadCost}
                          onChange={(e) => setNewStandardCost({ ...newStandardCost, standardOverheadCost: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Standard Cost *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newStandardCost.standardTotalCost}
                        onChange={(e) => setNewStandardCost({ ...newStandardCost, standardTotalCost: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Selling Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newStandardCost.standardSellingPrice}
                          onChange={(e) => setNewStandardCost({ ...newStandardCost, standardSellingPrice: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Target Margin %</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={newStandardCost.targetMarginPercent}
                          onChange={(e) => setNewStandardCost({ ...newStandardCost, targetMarginPercent: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleCreateStandardCost} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />Create Standard Cost
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Labor</TableHead>
                    <TableHead>Overhead</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead>Target Margin</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standardCosts?.map((cost: any) => (
                    <TableRow key={cost.standardCost?.id || cost.id}>
                      <TableCell>{cost.product?.name || "-"}</TableCell>
                      <TableCell>
                        {new Date(cost.standardCost?.effectiveDate || cost.effectiveDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{formatCurrency(cost.standardCost?.standardMaterialCost || cost.standardMaterialCost)}</TableCell>
                      <TableCell>{formatCurrency(cost.standardCost?.standardLaborCost || cost.standardLaborCost)}</TableCell>
                      <TableCell>{formatCurrency(cost.standardCost?.standardOverheadCost || cost.standardOverheadCost)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(cost.standardCost?.standardTotalCost || cost.standardTotalCost)}</TableCell>
                      <TableCell>{formatCurrency(cost.standardCost?.standardSellingPrice || cost.standardSellingPrice)}</TableCell>
                      <TableCell>{formatPercent(cost.standardCost?.targetMarginPercent || cost.targetMarginPercent)}</TableCell>
                      <TableCell>
                        {(cost.standardCost?.isActive ?? cost.isActive) ? (
                          <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!standardCosts || standardCosts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No standard costs defined. Add them for variance analysis.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* COGS Record Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>COGS Record Details</DialogTitle>
            <DialogDescription>
              {selectedRecord?.cogs?.recordNumber} - {selectedRecord?.product?.name}
            </DialogDescription>
          </DialogHeader>
          {recordDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Period</Label>
                  <p className="font-medium">
                    {new Date(recordDetail.cogs.periodStart).toLocaleDateString()} -
                    {new Date(recordDetail.cogs.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(recordDetail.cogs.status)}</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2">
                <h4 className="font-semibold">Cost Breakdown</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Direct Materials:</span>
                    <span>{formatCurrency(recordDetail.cogs.directMaterialsCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Direct Labor:</span>
                    <span>{formatCurrency(recordDetail.cogs.directLaborCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Packaging:</span>
                    <span>{formatCurrency(recordDetail.cogs.packagingCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Manufacturing Overhead:</span>
                    <span>{formatCurrency(recordDetail.cogs.manufacturingOverhead)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Inbound Freight:</span>
                    <span>{formatCurrency(recordDetail.cogs.freightInbound)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duties & Tariffs:</span>
                    <span>{formatCurrency(recordDetail.cogs.dutiesAndTariffs)}</span>
                  </div>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total COGS:</span>
                  <span>{formatCurrency(recordDetail.cogs.totalCogs)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-sm text-muted-foreground">Units Sold</div>
                  <div className="text-2xl font-bold">{recordDetail.cogs.unitsSold || "-"}</div>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-sm text-muted-foreground">COGS per Unit</div>
                  <div className="text-2xl font-bold">{formatCurrency(recordDetail.cogs.cogsPerUnit)}</div>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-sm text-muted-foreground">Gross Margin</div>
                  <div className={`text-2xl font-bold ${parseFloat(recordDetail.cogs.grossMarginPercent as string || '0') > 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatPercent(recordDetail.cogs.grossMarginPercent)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
