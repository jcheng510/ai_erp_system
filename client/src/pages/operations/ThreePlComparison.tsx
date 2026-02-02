import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Building2, DollarSign, Star, Truck, Package, Calculator,
  Play, CheckCircle, Award, BarChart3
} from "lucide-react";

export default function ThreePlComparison() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddComparison, setShowAddComparison] = useState(false);
  const [selectedComparison, setSelectedComparison] = useState<number | null>(null);
  const [newProvider, setNewProvider] = useState({
    name: "",
    code: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    headquarters: "",
    pricingModel: "per_order" as const,
    minimumMonthlyFee: "",
    temperatureControlled: false,
    hazmatCertified: false,
    fdaRegistered: false,
    customsBonded: false,
    averageAccuracyRate: "99",
    rating: "4",
    notes: "",
  });
  const [newComparison, setNewComparison] = useState({
    comparisonName: "",
    monthlyOrderVolume: 1000,
    averageUnitsPerOrder: "2",
    averageSkuCount: 100,
    palletStorageNeeded: 50,
    binStorageNeeded: 0,
    requiresTemperatureControl: false,
    requiresHazmat: false,
    requiresFda: false,
    requiresKitting: false,
    requiresReturnsProcessing: false,
    notes: "",
  });

  const { data: providers } = useQuery({
    queryKey: ["3plProviders"],
    queryFn: () => trpc.threePl.providers.list.query({}),
  });

  const { data: comparisons } = useQuery({
    queryKey: ["3plComparisons"],
    queryFn: () => trpc.threePl.comparisons.list.query({}),
  });

  const { data: comparisonDetail } = useQuery({
    queryKey: ["3plComparison", selectedComparison],
    queryFn: () => selectedComparison ? trpc.threePl.comparisons.get.query({ id: selectedComparison }) : null,
    enabled: !!selectedComparison,
  });

  const createProviderMutation = useMutation({
    mutationFn: (input: any) => trpc.threePl.providers.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["3plProviders"] });
      setShowAddProvider(false);
      toast({ title: "Provider Added", description: "3PL provider has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add provider", variant: "destructive" });
    },
  });

  const createComparisonMutation = useMutation({
    mutationFn: (input: any) => trpc.threePl.comparisons.create.mutate(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["3plComparisons"] });
      setShowAddComparison(false);
      setSelectedComparison(data.id);
      toast({ title: "Comparison Created", description: "Now run the comparison to see results." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create comparison", variant: "destructive" });
    },
  });

  const runComparisonMutation = useMutation({
    mutationFn: (id: number) => trpc.threePl.comparisons.runComparison.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["3plComparisons"] });
      queryClient.invalidateQueries({ queryKey: ["3plComparison", selectedComparison] });
      toast({ title: "Comparison Complete", description: "Results are now available." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run comparison", variant: "destructive" });
    },
  });

  const activeProviders = providers?.filter(p => p.status === "active").length || 0;
  const completedComparisons = comparisons?.filter(c => c.status === "completed").length || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">3PL Comparison Tool</h1>
          <p className="text-muted-foreground">Compare third-party logistics providers and costs</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAddProvider} onOpenChange={setShowAddProvider}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add 3PL Provider</DialogTitle>
                <DialogDescription>
                  Add a new third-party logistics provider to compare
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider Name *</Label>
                    <Input
                      value={newProvider.name}
                      onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                      placeholder="e.g., ShipBob, Deliverr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input
                      value={newProvider.code}
                      onChange={(e) => setNewProvider({ ...newProvider, code: e.target.value })}
                      placeholder="e.g., SHIPBOB"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input
                      value={newProvider.contactName}
                      onChange={(e) => setNewProvider({ ...newProvider, contactName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input
                      type="email"
                      value={newProvider.contactEmail}
                      onChange={(e) => setNewProvider({ ...newProvider, contactEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input
                      value={newProvider.contactPhone}
                      onChange={(e) => setNewProvider({ ...newProvider, contactPhone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={newProvider.website}
                      onChange={(e) => setNewProvider({ ...newProvider, website: e.target.value })}
                      placeholder="https://"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Headquarters</Label>
                    <Input
                      value={newProvider.headquarters}
                      onChange={(e) => setNewProvider({ ...newProvider, headquarters: e.target.value })}
                      placeholder="City, State"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pricing Model</Label>
                    <Select
                      value={newProvider.pricingModel}
                      onValueChange={(v: any) => setNewProvider({ ...newProvider, pricingModel: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_order">Per Order</SelectItem>
                        <SelectItem value="per_unit">Per Unit</SelectItem>
                        <SelectItem value="per_pallet">Per Pallet</SelectItem>
                        <SelectItem value="monthly_fixed">Monthly Fixed</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Monthly Fee</Label>
                    <Input
                      value={newProvider.minimumMonthlyFee}
                      onChange={(e) => setNewProvider({ ...newProvider, minimumMonthlyFee: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="font-semibold">Capabilities</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Temperature Controlled</span>
                      <Switch
                        checked={newProvider.temperatureControlled}
                        onCheckedChange={(v) => setNewProvider({ ...newProvider, temperatureControlled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Hazmat Certified</span>
                      <Switch
                        checked={newProvider.hazmatCertified}
                        onCheckedChange={(v) => setNewProvider({ ...newProvider, hazmatCertified: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">FDA Registered</span>
                      <Switch
                        checked={newProvider.fdaRegistered}
                        onCheckedChange={(v) => setNewProvider({ ...newProvider, fdaRegistered: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Customs Bonded</span>
                      <Switch
                        checked={newProvider.customsBonded}
                        onCheckedChange={(v) => setNewProvider({ ...newProvider, customsBonded: v })}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Accuracy Rate (%)</Label>
                    <Input
                      value={newProvider.averageAccuracyRate}
                      onChange={(e) => setNewProvider({ ...newProvider, averageAccuracyRate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rating (1-5)</Label>
                    <Input
                      value={newProvider.rating}
                      onChange={(e) => setNewProvider({ ...newProvider, rating: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newProvider.notes}
                    onChange={(e) => setNewProvider({ ...newProvider, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddProvider(false)}>Cancel</Button>
                <Button
                  onClick={() => createProviderMutation.mutate(newProvider)}
                  disabled={!newProvider.name}
                >
                  Add Provider
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddComparison} onOpenChange={setShowAddComparison}>
            <DialogTrigger asChild>
              <Button>
                <Calculator className="w-4 h-4 mr-2" />
                New Comparison
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Comparison Scenario</DialogTitle>
                <DialogDescription>
                  Define your requirements to compare 3PL providers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Comparison Name *</Label>
                  <Input
                    value={newComparison.comparisonName}
                    onChange={(e) => setNewComparison({ ...newComparison, comparisonName: e.target.value })}
                    placeholder="e.g., Q1 2024 3PL Evaluation"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Order Volume</Label>
                    <Input
                      type="number"
                      value={newComparison.monthlyOrderVolume}
                      onChange={(e) => setNewComparison({ ...newComparison, monthlyOrderVolume: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Avg Units per Order</Label>
                    <Input
                      value={newComparison.averageUnitsPerOrder}
                      onChange={(e) => setNewComparison({ ...newComparison, averageUnitsPerOrder: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SKU Count</Label>
                    <Input
                      type="number"
                      value={newComparison.averageSkuCount}
                      onChange={(e) => setNewComparison({ ...newComparison, averageSkuCount: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pallet Storage Needed</Label>
                    <Input
                      type="number"
                      value={newComparison.palletStorageNeeded}
                      onChange={(e) => setNewComparison({ ...newComparison, palletStorageNeeded: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="font-semibold">Special Requirements</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Temperature Control</span>
                      <Switch
                        checked={newComparison.requiresTemperatureControl}
                        onCheckedChange={(v) => setNewComparison({ ...newComparison, requiresTemperatureControl: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Hazmat Handling</span>
                      <Switch
                        checked={newComparison.requiresHazmat}
                        onCheckedChange={(v) => setNewComparison({ ...newComparison, requiresHazmat: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">FDA Compliance</span>
                      <Switch
                        checked={newComparison.requiresFda}
                        onCheckedChange={(v) => setNewComparison({ ...newComparison, requiresFda: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Kitting Services</span>
                      <Switch
                        checked={newComparison.requiresKitting}
                        onCheckedChange={(v) => setNewComparison({ ...newComparison, requiresKitting: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Returns Processing</span>
                      <Switch
                        checked={newComparison.requiresReturnsProcessing}
                        onCheckedChange={(v) => setNewComparison({ ...newComparison, requiresReturnsProcessing: v })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newComparison.notes}
                    onChange={(e) => setNewComparison({ ...newComparison, notes: e.target.value })}
                    placeholder="Additional requirements or notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddComparison(false)}>Cancel</Button>
                <Button
                  onClick={() => createComparisonMutation.mutate(newComparison)}
                  disabled={!newComparison.comparisonName}
                >
                  Create Comparison
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{providers?.length || 0}</div>
                <p className="text-sm text-muted-foreground">Total Providers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{activeProviders}</div>
                <p className="text-sm text-muted-foreground">Active Providers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{comparisons?.length || 0}</div>
                <p className="text-sm text-muted-foreground">Comparisons</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{completedComparisons}</div>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">
            <Building2 className="w-4 h-4 mr-2" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="comparisons">
            <Calculator className="w-4 h-4 mr-2" />
            Comparisons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>3PL Providers</CardTitle>
              <CardDescription>Manage your list of third-party logistics providers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Pricing Model</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No providers added yet. Click "Add Provider" to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    providers?.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>
                          <div className="font-medium">{provider.name}</div>
                          {provider.code && <div className="text-sm text-muted-foreground">{provider.code}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{provider.contactName || "-"}</div>
                          <div className="text-sm text-muted-foreground">{provider.contactEmail}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{provider.pricingModel?.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {provider.temperatureControlled && <Badge variant="secondary" className="text-xs">Temp</Badge>}
                            {provider.hazmatCertified && <Badge variant="secondary" className="text-xs">Hazmat</Badge>}
                            {provider.fdaRegistered && <Badge variant="secondary" className="text-xs">FDA</Badge>}
                            {provider.customsBonded && <Badge variant="secondary" className="text-xs">Bonded</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{provider.averageAccuracyRate}%</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            {provider.rating}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={provider.status === "active" ? "default" : "secondary"}>
                            {provider.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparisons" className="space-y-4">
          <div className="grid grid-cols-3 gap-6">
            {/* Comparisons List */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Comparison Scenarios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {comparisons?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No comparisons yet. Create one to compare providers.
                  </p>
                ) : (
                  comparisons?.map((comparison) => (
                    <div
                      key={comparison.id}
                      className={`p-3 rounded-lg cursor-pointer border ${
                        selectedComparison === comparison.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedComparison(comparison.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{comparison.comparisonName}</div>
                          <div className="text-sm text-muted-foreground">
                            {comparison.monthlyOrderVolume?.toLocaleString()} orders/mo
                          </div>
                        </div>
                        <Badge variant={comparison.status === "completed" ? "default" : "secondary"}>
                          {comparison.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Comparison Results */}
            <Card className="col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Comparison Results</CardTitle>
                  {comparisonDetail && comparisonDetail.status !== "completed" && (
                    <Button
                      onClick={() => runComparisonMutation.mutate(selectedComparison!)}
                      disabled={runComparisonMutation.isPending}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Run Comparison
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedComparison ? (
                  <div className="text-center text-muted-foreground py-8">
                    Select a comparison scenario to view results
                  </div>
                ) : !comparisonDetail ? (
                  <div className="text-center py-8">Loading...</div>
                ) : comparisonDetail.status !== "completed" ? (
                  <div className="text-center py-8">
                    <Calculator className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Click "Run Comparison" to analyze providers against your requirements.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm max-w-md mx-auto">
                      <div className="p-2 bg-muted rounded">
                        <span className="text-muted-foreground">Orders/month:</span>{" "}
                        {comparisonDetail.monthlyOrderVolume?.toLocaleString()}
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <span className="text-muted-foreground">Pallets:</span>{" "}
                        {comparisonDetail.palletStorageNeeded}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comparisonDetail.recommendedProviderId && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 font-medium text-green-800">
                          <Award className="w-5 h-5" />
                          Recommended: {providers?.find(p => p.id === comparisonDetail.recommendedProviderId)?.name}
                        </div>
                        <p className="text-sm text-green-700 mt-1">{comparisonDetail.recommendationReason}</p>
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Monthly Cost</TableHead>
                          <TableHead>Cost/Order</TableHead>
                          <TableHead>Capability</TableHead>
                          <TableHead>Overall Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonDetail.results?.map((result: any) => (
                          <TableRow key={result.result.id}>
                            <TableCell>
                              <Badge variant={result.result.rank === 1 ? "default" : "outline"}>
                                #{result.result.rank}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {result.provider?.name || `Provider #${result.result.providerId}`}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold">${parseFloat(result.result.totalMonthlyCost).toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">
                                Storage: ${parseFloat(result.result.monthlyStorageCost).toLocaleString()} |
                                Pick/Pack: ${parseFloat(result.result.monthlyPickPackCost).toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell>${parseFloat(result.result.costPerOrder).toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {result.result.meetsRequirements ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Badge variant="outline" className="text-xs">Partial</Badge>
                                )}
                                <span>{parseFloat(result.result.capabilityScore).toFixed(0)}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`font-bold ${
                                parseFloat(result.result.overallScore) >= 80 ? "text-green-600" :
                                parseFloat(result.result.overallScore) >= 60 ? "text-yellow-600" : "text-red-600"
                              }`}>
                                {parseFloat(result.result.overallScore).toFixed(1)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
