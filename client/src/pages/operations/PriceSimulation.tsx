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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  Plus,
  Play,
  Eye,
  AlertTriangle,
  Target,
  Calculator,
  BarChart3,
  Percent,
  Package,
  Brain,
  Lightbulb
} from "lucide-react";

export default function PriceSimulation() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddInputDialog, setShowAddInputDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedSimulation, setSelectedSimulation] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [newSimulation, setNewSimulation] = useState({
    name: "",
    description: "",
    simulationType: "single_material" as const,
  });

  const [newInput, setNewInput] = useState({
    inputType: "raw_material" as const,
    rawMaterialId: "",
    changeType: "percentage" as const,
    changeValue: "",
    changeDirection: "increase" as const,
    currentPrice: "",
  });

  // Queries
  const { data: simulations, refetch: refetchSimulations } = trpc.priceSimulation.list.useQuery({});
  const { data: rawMaterials } = trpc.rawMaterials.list.useQuery({});
  const { data: simulationDetail, refetch: refetchDetail } = trpc.priceSimulation.get.useQuery(
    { id: selectedSimulation?.id },
    { enabled: !!selectedSimulation?.id }
  );

  // Mutations
  const createMutation = trpc.priceSimulation.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Simulation ${data.simulationNumber} created`);
      refetchSimulations();
      setShowCreateDialog(false);
      setSelectedSimulation({ id: data.id, simulationNumber: data.simulationNumber });
    },
    onError: (error) => toast.error(error.message),
  });

  const addInputMutation = trpc.priceSimulation.addInput.useMutation({
    onSuccess: () => {
      toast.success("Price change added to simulation");
      refetchDetail();
      setShowAddInputDialog(false);
      setNewInput({
        inputType: "raw_material",
        rawMaterialId: "",
        changeType: "percentage",
        changeValue: "",
        changeDirection: "increase",
        currentPrice: "",
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const runSimulationMutation = trpc.priceSimulation.runSimulation.useMutation({
    onSuccess: (data) => {
      toast.success(`Simulation completed. ${data.totalProductsImpacted} products impacted.`);
      refetchSimulations();
      refetchDetail();
      setIsRunning(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsRunning(false);
    },
  });

  const deleteMutation = trpc.priceSimulation.delete.useMutation({
    onSuccess: () => {
      toast.success("Simulation deleted");
      refetchSimulations();
      setShowDetailDialog(false);
      setSelectedSimulation(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCreate = () => {
    if (!newSimulation.name) {
      toast.error("Please provide a simulation name");
      return;
    }
    createMutation.mutate(newSimulation);
  };

  const handleAddInput = () => {
    if (!selectedSimulation || !newInput.rawMaterialId || !newInput.changeValue) {
      toast.error("Please fill in all required fields");
      return;
    }
    addInputMutation.mutate({
      simulationId: selectedSimulation.id,
      inputType: newInput.inputType,
      rawMaterialId: parseInt(newInput.rawMaterialId),
      changeType: newInput.changeType,
      changeValue: newInput.changeValue,
      changeDirection: newInput.changeDirection,
      currentPrice: newInput.currentPrice || undefined,
    });
  };

  const handleRunSimulation = () => {
    if (!selectedSimulation) return;
    setIsRunning(true);
    runSimulationMutation.mutate({ id: selectedSimulation.id });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      running: "secondary",
      completed: "default",
      archived: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getImpactColor = (value: number) => {
    if (value < -5) return "text-red-600";
    if (value < 0) return "text-orange-600";
    if (value > 5) return "text-green-600";
    if (value > 0) return "text-green-500";
    return "text-gray-600";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Price Impact Simulation</h1>
          <p className="text-muted-foreground">Model how raw material price changes affect product margins</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Simulation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Price Simulation</DialogTitle>
              <DialogDescription>Set up a new price impact scenario</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Simulation Name *</Label>
                <Input
                  value={newSimulation.name}
                  onChange={(e) => setNewSimulation({ ...newSimulation, name: e.target.value })}
                  placeholder="e.g., Q2 Steel Price Increase"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newSimulation.description}
                  onChange={(e) => setNewSimulation({ ...newSimulation, description: e.target.value })}
                  placeholder="Describe the simulation scenario..."
                />
              </div>
              <div className="space-y-2">
                <Label>Simulation Type</Label>
                <Select
                  value={newSimulation.simulationType}
                  onValueChange={(v: any) => setNewSimulation({ ...newSimulation, simulationType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_material">Single Material</SelectItem>
                    <SelectItem value="multi_material">Multiple Materials</SelectItem>
                    <SelectItem value="category">By Category</SelectItem>
                    <SelectItem value="scenario">What-If Scenario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full">
                <Calculator className="h-4 w-4 mr-2" />Create Simulation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Simulations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{simulations?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {simulations?.filter(s => s.status === 'completed').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Margin Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {simulations?.filter(s => s.averageMarginImpact).length ? (
                <>
                  {parseFloat(simulations.find(s => s.status === 'completed')?.averageMarginImpact || '0').toFixed(1)}%
                  {parseFloat(simulations.find(s => s.status === 'completed')?.averageMarginImpact || '0') < 0 ? (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  )}
                </>
              ) : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Products at Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {simulations?.reduce((acc, s) => acc + (s.totalProductsImpacted || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simulations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Simulations</CardTitle>
          <CardDescription>Price impact scenarios and their results</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Products Impacted</TableHead>
                <TableHead>Avg Margin Impact</TableHead>
                <TableHead>COGS Impact</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simulations?.map((sim) => (
                <TableRow key={sim.id}>
                  <TableCell className="font-mono">{sim.simulationNumber}</TableCell>
                  <TableCell>{sim.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sim.simulationType?.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(sim.status)}</TableCell>
                  <TableCell>{sim.totalProductsImpacted || "-"}</TableCell>
                  <TableCell>
                    {sim.averageMarginImpact ? (
                      <span className={getImpactColor(parseFloat(sim.averageMarginImpact))}>
                        {parseFloat(sim.averageMarginImpact) > 0 ? "+" : ""}
                        {parseFloat(sim.averageMarginImpact).toFixed(2)}%
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {sim.totalCogsImpact ? (
                      <span className={getImpactColor(-parseFloat(sim.totalCogsImpact))}>
                        ${parseFloat(sim.totalCogsImpact).toLocaleString()}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSimulation(sim);
                        setShowDetailDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!simulations || simulations.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No simulations created yet. Create one to model price impacts.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Simulation Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {selectedSimulation?.name || "Simulation Details"}
            </DialogTitle>
            <DialogDescription>
              {selectedSimulation?.simulationNumber} - {selectedSimulation?.status}
            </DialogDescription>
          </DialogHeader>

          {simulationDetail && (
            <div className="space-y-6">
              {/* Summary */}
              {simulationDetail.status === 'completed' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Products Impacted</div>
                      <div className="text-2xl font-bold">{simulationDetail.totalProductsImpacted}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Avg Margin Impact</div>
                      <div className={`text-2xl font-bold ${getImpactColor(parseFloat(simulationDetail.averageMarginImpact || '0'))}`}>
                        {parseFloat(simulationDetail.averageMarginImpact || '0').toFixed(2)}%
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Worst Case</div>
                      <div className="text-2xl font-bold text-red-600">
                        {parseFloat(simulationDetail.worstCaseMarginImpact || '0').toFixed(2)}%
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total COGS Impact</div>
                      <div className="text-2xl font-bold">
                        ${parseFloat(simulationDetail.totalCogsImpact || '0').toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* AI Analysis */}
              {simulationDetail.aiAnalysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4" />AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{simulationDetail.aiAnalysis}</p>
                    {simulationDetail.aiRecommendations && (
                      <div className="mt-4">
                        <Label className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" />Recommendations
                        </Label>
                        <ul className="mt-2 text-sm list-disc list-inside space-y-1">
                          {JSON.parse(simulationDetail.aiRecommendations).map((rec: string, i: number) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Price Inputs */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Price Changes</CardTitle>
                  {simulationDetail.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => setShowAddInputDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />Add Change
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {simulationDetail.inputs?.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Change</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead>Current Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {simulationDetail.inputs.map((inp: any) => (
                          <TableRow key={inp.id}>
                            <TableCell>{inp.inputType?.replace(/_/g, " ")}</TableCell>
                            <TableCell>
                              {rawMaterials?.find(m => m.id === inp.rawMaterialId)?.name || inp.rawMaterialId}
                            </TableCell>
                            <TableCell>
                              {inp.changeType === 'percentage' ? `${inp.changeValue}%` : `$${inp.changeValue}`}
                            </TableCell>
                            <TableCell>
                              {inp.changeDirection === 'increase' ? (
                                <Badge variant="destructive"><TrendingUp className="h-3 w-3 mr-1" />Increase</Badge>
                              ) : (
                                <Badge variant="secondary"><TrendingDown className="h-3 w-3 mr-1" />Decrease</Badge>
                              )}
                            </TableCell>
                            <TableCell>${parseFloat(inp.currentPrice || '0').toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">
                      No price changes added. Add changes to run the simulation.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Results */}
              {simulationDetail.results?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Impact by Product</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Current COGS</TableHead>
                          <TableHead>Simulated COGS</TableHead>
                          <TableHead>COGS Change</TableHead>
                          <TableHead>Margin Impact</TableHead>
                          <TableHead>Suggested Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {simulationDetail.results.slice(0, 10).map((result: any) => (
                          <TableRow key={result.result.id}>
                            <TableCell>{result.product?.name || `Product ${result.result.productId}`}</TableCell>
                            <TableCell>${parseFloat(result.result.currentCogs).toFixed(2)}</TableCell>
                            <TableCell>${parseFloat(result.result.simulatedCogs).toFixed(2)}</TableCell>
                            <TableCell className={getImpactColor(-parseFloat(result.result.cogsChangePercent))}>
                              {parseFloat(result.result.cogsChangePercent) > 0 ? "+" : ""}
                              {parseFloat(result.result.cogsChangePercent).toFixed(2)}%
                            </TableCell>
                            <TableCell className={getImpactColor(parseFloat(result.result.marginChangePercent))}>
                              {parseFloat(result.result.marginChangePercent) > 0 ? "+" : ""}
                              {parseFloat(result.result.marginChangePercent).toFixed(2)}%
                            </TableCell>
                            <TableCell>${parseFloat(result.result.suggestedNewPrice).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {simulationDetail.results.length > 10 && (
                      <p className="text-sm text-muted-foreground text-center mt-4">
                        Showing 10 of {simulationDetail.results.length} impacted products
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                {simulationDetail.status === 'draft' && simulationDetail.inputs?.length > 0 && (
                  <Button onClick={handleRunSimulation} disabled={isRunning}>
                    {isRunning ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
                    ) : (
                      <><Play className="h-4 w-4 mr-2" />Run Simulation</>
                    )}
                  </Button>
                )}
                <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: selectedSimulation.id })}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Input Dialog */}
      <Dialog open={showAddInputDialog} onOpenChange={setShowAddInputDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Price Change</DialogTitle>
            <DialogDescription>Define a raw material price change to simulate</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Raw Material *</Label>
              <Select value={newInput.rawMaterialId} onValueChange={(v) => {
                const material = rawMaterials?.find(m => m.id === parseInt(v));
                setNewInput({
                  ...newInput,
                  rawMaterialId: v,
                  currentPrice: material?.unitCost?.toString() || '',
                });
              }}>
                <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                <SelectContent>
                  {rawMaterials?.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Change Type</Label>
                <Select value={newInput.changeType} onValueChange={(v: any) => setNewInput({ ...newInput, changeType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="absolute">Absolute ($)</SelectItem>
                    <SelectItem value="new_price">New Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={newInput.changeDirection} onValueChange={(v: any) => setNewInput({ ...newInput, changeDirection: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase</SelectItem>
                    <SelectItem value="decrease">Decrease</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Change Value *</Label>
                <Input
                  type="number"
                  value={newInput.changeValue}
                  onChange={(e) => setNewInput({ ...newInput, changeValue: e.target.value })}
                  placeholder={newInput.changeType === 'percentage' ? "e.g., 10" : "e.g., 5.00"}
                />
              </div>
              <div className="space-y-2">
                <Label>Current Price</Label>
                <Input
                  type="number"
                  value={newInput.currentPrice}
                  onChange={(e) => setNewInput({ ...newInput, currentPrice: e.target.value })}
                  placeholder="Current unit cost"
                />
              </div>
            </div>
            <Button onClick={handleAddInput} className="w-full">
              <Plus className="h-4 w-4 mr-2" />Add Price Change
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
