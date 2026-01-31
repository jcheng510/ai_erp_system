import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Calculator, Plus, TrendingUp, TrendingDown, DollarSign, Percent, Building2, Loader2, ChevronLeft, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  return `${(value || 0).toFixed(2)}%`;
}

export default function EquityModeling() {
  const [isOpen, setIsOpen] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    scenarioType: "funding_round" as "funding_round" | "exit" | "option_pool_expansion" | "custom",
    exitType: "acquisition" as "acquisition" | "ipo" | "liquidation",
    exitValue: "",
    fundingAmount: "",
    preMoneyValuation: "",
    newOptionPoolPercentage: "",
    description: "",
  });

  const { data: scenarios, isLoading, refetch } = trpc.capTable.scenarios.list.useQuery();
  const { data: summary } = trpc.capTable.summary.useQuery();

  const createScenario = trpc.capTable.scenarios.create.useMutation({
    onSuccess: () => {
      toast.success("Scenario created successfully");
      setIsOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteScenario = trpc.capTable.scenarios.delete.useMutation({
    onSuccess: () => {
      toast.success("Scenario deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const analyzeScenario = trpc.capTable.scenarios.analyze.useMutation({
    onSuccess: (data) => {
      setAnalysisResults(data);
      toast.success("Analysis complete");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      scenarioType: "funding_round",
      exitType: "acquisition",
      exitValue: "",
      fundingAmount: "",
      preMoneyValuation: "",
      newOptionPoolPercentage: "",
      description: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createScenario.mutate({
      name: formData.name,
      scenarioType: formData.scenarioType,
      exitType: formData.scenarioType === "exit" ? formData.exitType : undefined,
      exitValue: formData.exitValue || undefined,
      fundingAmount: formData.fundingAmount || undefined,
      preMoneyValuation: formData.preMoneyValuation || undefined,
      optionPoolPercentage: formData.newOptionPoolPercentage || undefined,
      description: formData.description || undefined,
    });
  };

  const runAnalysis = (scenarioType: "funding_round" | "exit" | "option_pool_expansion" | "custom", params: any) => {
    analyzeScenario.mutate({
      scenarioType,
      ...params,
    });
  };

  const scenarioTypeColors: Record<string, string> = {
    funding_round: "bg-green-500/10 text-green-600",
    exit: "bg-blue-500/10 text-blue-600",
    option_pool_expansion: "bg-purple-500/10 text-purple-600",
    custom: "bg-gray-500/10 text-gray-600",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/equity/cap-table">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Cap Table
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-8 w-8" />
            Equity Modeling
          </h1>
          <p className="text-muted-foreground mt-1">
            Model funding rounds, exits, and dilution scenarios.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Scenario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create Scenario</DialogTitle>
                <DialogDescription>
                  Create a new equity modeling scenario.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Scenario Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Series A Round"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Scenario Type *</Label>
                  <Select
                    value={formData.scenarioType}
                    onValueChange={(value: any) => setFormData({ ...formData, scenarioType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="funding_round">Funding Round</SelectItem>
                      <SelectItem value="exit">Exit Event</SelectItem>
                      <SelectItem value="option_pool_expansion">Option Pool Expansion</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.scenarioType === "exit" && (
                  <>
                    <div className="space-y-2">
                      <Label>Exit Type</Label>
                      <Select
                        value={formData.exitType}
                        onValueChange={(value: any) => setFormData({ ...formData, exitType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="acquisition">Acquisition</SelectItem>
                          <SelectItem value="ipo">IPO</SelectItem>
                          <SelectItem value="liquidation">Liquidation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Exit Value ($)</Label>
                      <Input
                        value={formData.exitValue}
                        onChange={(e) => setFormData({ ...formData, exitValue: e.target.value })}
                        placeholder="100000000"
                      />
                    </div>
                  </>
                )}

                {formData.scenarioType === "funding_round" && (
                  <>
                    <div className="space-y-2">
                      <Label>Funding Amount ($)</Label>
                      <Input
                        value={formData.fundingAmount}
                        onChange={(e) => setFormData({ ...formData, fundingAmount: e.target.value })}
                        placeholder="5000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pre-Money Valuation ($)</Label>
                      <Input
                        value={formData.preMoneyValuation}
                        onChange={(e) => setFormData({ ...formData, preMoneyValuation: e.target.value })}
                        placeholder="20000000"
                      />
                    </div>
                  </>
                )}

                {formData.scenarioType === "option_pool_expansion" && (
                  <div className="space-y-2">
                    <Label>New Option Pool Percentage (%)</Label>
                    <Input
                      value={formData.newOptionPoolPercentage}
                      onChange={(e) => setFormData({ ...formData, newOptionPoolPercentage: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createScenario.isPending}>
                  {createScenario.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Scenario
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Analysis Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Funding Round
            </CardTitle>
            <CardDescription>
              Model a new funding round and see dilution impact
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Funding Amount</Label>
                <Input
                  placeholder="5,000,000"
                  id="quick-funding"
                  type="number"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pre-Money Valuation</Label>
                <Input
                  placeholder="20,000,000"
                  id="quick-premoney"
                  type="number"
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                onClick={() => {
                  const funding = parseFloat((document.getElementById("quick-funding") as HTMLInputElement)?.value || "0");
                  const preMoney = parseFloat((document.getElementById("quick-premoney") as HTMLInputElement)?.value || "0");
                  if (funding && preMoney) {
                    runAnalysis("funding_round", { fundingAmount: funding, preMoneyValuation: preMoney });
                  } else {
                    toast.error("Please enter funding amount and pre-money valuation");
                  }
                }}
                disabled={analyzeScenario.isPending}
              >
                {analyzeScenario.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Analyze
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Exit Waterfall
            </CardTitle>
            <CardDescription>
              Calculate proceeds distribution for an exit event
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Exit Value</Label>
                <Input
                  placeholder="100,000,000"
                  id="quick-exit"
                  type="number"
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                onClick={() => {
                  const exitValue = parseFloat((document.getElementById("quick-exit") as HTMLInputElement)?.value || "0");
                  if (exitValue) {
                    runAnalysis("exit", { exitValue });
                  } else {
                    toast.error("Please enter exit value");
                  }
                }}
                disabled={analyzeScenario.isPending}
              >
                {analyzeScenario.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Analyze
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Current State
            </CardTitle>
            <CardDescription>
              Your company's current cap table metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding Shares</span>
                <span className="font-mono">{formatNumber(summary?.totalOutstandingShares)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fully Diluted</span>
                <span className="font-mono">{formatNumber(summary?.totalFullyDilutedShares)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price/Share</span>
                <span className="font-mono">{summary?.pricePerShare ? `$${Number(summary.pricePerShare).toFixed(4)}` : "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Option Pool Available</span>
                <span className="font-mono">{formatNumber(summary?.totalOptionPoolAvailable)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Results */}
      {analysisResults && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Projected impact on ownership and value
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Projected State */}
            {analysisResults.projectedState && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {analysisResults.projectedState.fundingAmount && (
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Funding Amount</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(analysisResults.projectedState.fundingAmount)}
                    </div>
                  </div>
                )}
                {analysisResults.projectedState.postMoneyValuation && (
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Post-Money Valuation</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(analysisResults.projectedState.postMoneyValuation)}
                    </div>
                  </div>
                )}
                {analysisResults.projectedState.pricePerShare && (
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Price Per Share</div>
                    <div className="text-xl font-bold">
                      ${analysisResults.projectedState.pricePerShare.toFixed(4)}
                    </div>
                  </div>
                )}
                {analysisResults.projectedState.investorOwnership && (
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">New Investor Ownership</div>
                    <div className="text-xl font-bold">
                      {formatPercent(analysisResults.projectedState.investorOwnership)}
                    </div>
                  </div>
                )}
                {analysisResults.projectedState.exitValue && (
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Exit Value</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(analysisResults.projectedState.exitValue)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Shareholder Impact */}
            {analysisResults.shareholderImpact && analysisResults.shareholderImpact.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Shareholder Impact</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shareholder</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      {analysisResults.shareholderImpact[0].currentOwnership !== undefined && (
                        <>
                          <TableHead className="text-right">Current %</TableHead>
                          <TableHead className="text-right">New %</TableHead>
                          <TableHead className="text-right">Dilution</TableHead>
                        </>
                      )}
                      {analysisResults.shareholderImpact[0].proceedsAmount !== undefined && (
                        <TableHead className="text-right">Proceeds</TableHead>
                      )}
                      {analysisResults.shareholderImpact[0].valueAtPostMoney !== undefined && (
                        <TableHead className="text-right">Value (Post)</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysisResults.shareholderImpact.map((impact: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{impact.shareholderName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(impact.shares)}
                        </TableCell>
                        {impact.currentOwnership !== undefined && (
                          <>
                            <TableCell className="text-right font-mono">
                              {formatPercent(impact.currentOwnership)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatPercent(impact.newOwnership)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              <TrendingDown className="h-3 w-3 inline mr-1" />
                              {formatPercent(impact.dilutionPercent)}
                            </TableCell>
                          </>
                        )}
                        {impact.proceedsAmount !== undefined && (
                          <TableCell className="text-right font-mono text-green-600">
                            {formatCurrency(impact.proceedsAmount)}
                          </TableCell>
                        )}
                        {impact.valueAtPostMoney !== undefined && (
                          <TableCell className="text-right font-mono">
                            {formatCurrency(impact.valueAtPostMoney)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saved Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Scenarios</CardTitle>
          <CardDescription>
            Your saved equity modeling scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !scenarios || scenarios.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No saved scenarios</p>
              <p className="text-sm">Create a scenario to save and reuse later.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((scenario) => (
                  <TableRow key={scenario.id}>
                    <TableCell className="font-medium">{scenario.name}</TableCell>
                    <TableCell>
                      <Badge className={scenarioTypeColors[scenario.scenarioType]}>
                        {scenario.scenarioType.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {scenario.description || "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(scenario.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            runAnalysis(scenario.scenarioType, {
                              scenarioId: scenario.id,
                              exitValue: scenario.exitValue ? parseFloat(scenario.exitValue) : undefined,
                              fundingAmount: scenario.fundingAmount ? parseFloat(scenario.fundingAmount) : undefined,
                              preMoneyValuation: scenario.preMoneyValuation ? parseFloat(scenario.preMoneyValuation) : undefined,
                            });
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Delete this scenario?")) {
                              deleteScenario.mutate({ id: scenario.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
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
