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
import { Calculator, Plus, TrendingUp, TrendingDown, DollarSign, Percent, Building2, Loader2, ChevronLeft, Play, Trash2, RefreshCw, FileText, Scale, ArrowRight, AlertCircle } from "lucide-react";
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
  return `${((value || 0) * 100).toFixed(2)}%`;
}

function formatPercentRaw(value: number | null | undefined) {
  return `${(value || 0).toFixed(2)}%`;
}

export default function EquityModeling() {
  const [activeTab, setActiveTab] = useState("funding");
  const [isOpen, setIsOpen] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [proRataResults, setProRataResults] = useState<any>(null);
  const [safeConversionResults, setSafeConversionResults] = useState<any>(null);
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
  const { data: safes } = trpc.capTable.safes.outstanding.useQuery();
  const { data: shareholders } = trpc.capTable.shareholders.list.useQuery();

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

  // Calculate Pro Rata
  const calculateProRata = () => {
    const roundSize = parseFloat((document.getElementById("prorata-round-size") as HTMLInputElement)?.value || "0");
    const preMoney = parseFloat((document.getElementById("prorata-premoney") as HTMLInputElement)?.value || "0");

    if (!roundSize || !preMoney) {
      toast.error("Please enter round size and pre-money valuation");
      return;
    }

    const totalShares = summary?.totalOutstandingShares || 0;
    const postMoney = preMoney + roundSize;
    const pricePerShare = preMoney / totalShares;
    const newShares = roundSize / pricePerShare;
    const newTotalShares = totalShares + newShares;

    // Calculate pro rata for each shareholder from summary
    const shareholderData = summary?.shareholderBreakdown || [];
    const results = shareholderData.map((sh: any) => {
      const currentOwnership = sh.shares / totalShares;
      const proRataAmount = currentOwnership * roundSize;
      const newSharesAtProRata = proRataAmount / pricePerShare;
      const ownershipIfNoParticipation = sh.shares / newTotalShares;
      const dilutionWithoutProRata = currentOwnership - ownershipIfNoParticipation;

      return {
        shareholderName: sh.shareholderName,
        currentShares: sh.shares,
        currentOwnership,
        proRataAmount,
        newSharesAtProRata: Math.floor(newSharesAtProRata),
        ownershipIfNoParticipation,
        dilutionWithoutProRata,
        maintainsOwnership: currentOwnership, // If they invest pro rata
      };
    });

    setProRataResults({
      roundSize,
      preMoney,
      postMoney,
      pricePerShare,
      newShares: Math.floor(newShares),
      shareholders: results.sort((a: any, b: any) => b.currentOwnership - a.currentOwnership),
      totalProRataAmount: results.reduce((sum: number, s: any) => sum + s.proRataAmount, 0),
    });

    toast.success("Pro rata calculation complete");
  };

  // Calculate SAFE Conversions
  const calculateSafeConversions = () => {
    const pricePerShare = parseFloat((document.getElementById("safe-price") as HTMLInputElement)?.value || "0");
    const fullyDiluted = parseFloat((document.getElementById("safe-fully-diluted") as HTMLInputElement)?.value || "0") || (summary?.totalFullyDilutedShares || 0);

    if (!pricePerShare) {
      toast.error("Please enter the round price per share");
      return;
    }

    if (!safes || safes.length === 0) {
      toast.error("No outstanding SAFEs to convert");
      return;
    }

    const results = safes.map((safe: any) => {
      const investmentAmount = parseFloat(safe.investmentAmount);
      const valuationCap = safe.valuationCap ? parseFloat(safe.valuationCap) : null;
      const discountRate = safe.discountRate ? parseFloat(safe.discountRate) : null;

      // Calculate shares using cap
      let capPrice = pricePerShare;
      let capShares = 0;
      if (valuationCap) {
        capPrice = valuationCap / fullyDiluted;
        capShares = Math.floor(investmentAmount / capPrice);
      }

      // Calculate shares using discount
      const discountedPrice = discountRate ? pricePerShare * (1 - discountRate) : pricePerShare;
      const discountShares = Math.floor(investmentAmount / discountedPrice);

      // Calculate shares at round price
      const roundPriceShares = Math.floor(investmentAmount / pricePerShare);

      // Find best conversion method (most shares for investor)
      let bestMethod = "round_price";
      let bestShares = roundPriceShares;
      let effectivePrice = pricePerShare;

      if (valuationCap && capShares > bestShares) {
        bestMethod = "cap";
        bestShares = capShares;
        effectivePrice = capPrice;
      }

      if (discountRate && discountShares > bestShares) {
        bestMethod = "discount";
        bestShares = discountShares;
        effectivePrice = discountedPrice;
      }

      const shareholderName = shareholders?.find((s: any) => s.id === safe.shareholderId)?.name || `Investor #${safe.shareholderId}`;

      return {
        safeId: safe.id,
        shareholderName,
        investmentAmount,
        valuationCap,
        discountRate,
        safeType: safe.safeType,
        hasProRataRights: safe.hasProRataRights,
        comparison: {
          roundPrice: { shares: roundPriceShares, price: pricePerShare },
          cap: valuationCap ? { shares: capShares, price: capPrice } : null,
          discount: discountRate ? { shares: discountShares, price: discountedPrice } : null,
        },
        result: {
          method: bestMethod,
          shares: bestShares,
          effectivePrice,
          ownershipPercent: (bestShares / (fullyDiluted + bestShares)) * 100,
        },
      };
    });

    const totalShares = results.reduce((sum: number, r: any) => sum + r.result.shares, 0);
    const totalInvestment = results.reduce((sum: number, r: any) => sum + r.investmentAmount, 0);

    setSafeConversionResults({
      pricePerShare,
      fullyDiluted,
      safes: results,
      totals: {
        totalInvestment,
        totalShares,
        averageEffectivePrice: totalInvestment / totalShares,
        totalOwnership: (totalShares / (fullyDiluted + totalShares)) * 100,
      },
    });

    toast.success("SAFE conversion analysis complete");
  };

  const scenarioTypeColors: Record<string, string> = {
    funding_round: "bg-green-500/10 text-green-600",
    exit: "bg-blue-500/10 text-blue-600",
    option_pool_expansion: "bg-purple-500/10 text-purple-600",
    custom: "bg-gray-500/10 text-gray-600",
  };

  const safeTypeLabels: Record<string, string> = {
    post_money: "Post-Money SAFE",
    pre_money: "Pre-Money SAFE",
    mfn: "MFN SAFE",
    uncapped: "Uncapped SAFE",
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
            Model funding rounds, SAFE conversions, pro rata rights, and exit scenarios.
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

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="funding">Funding Round</TabsTrigger>
          <TabsTrigger value="prorata">Pro Rata Calculator</TabsTrigger>
          <TabsTrigger value="safe">SAFE Conversion</TabsTrigger>
          <TabsTrigger value="exit">Exit Waterfall</TabsTrigger>
          <TabsTrigger value="scenarios">Saved Scenarios</TabsTrigger>
        </TabsList>

        {/* Funding Round Tab */}
        <TabsContent value="funding" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Model Funding Round
                </CardTitle>
                <CardDescription>
                  Enter round parameters to see dilution impact
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Funding Amount ($)</Label>
                    <Input
                      placeholder="5,000,000"
                      id="quick-funding"
                      type="number"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pre-Money Valuation ($)</Label>
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
                    Analyze Dilution
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                  Outstanding SAFEs
                </CardTitle>
                <CardDescription>
                  SAFEs that will convert in next round
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Count</span>
                    <span className="font-mono">{safes?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Investment</span>
                    <span className="font-mono">
                      {formatCurrency(safes?.reduce((sum: number, s: any) => sum + parseFloat(s.investmentAmount), 0) || 0)}
                    </span>
                  </div>
                  {safes && safes.length > 0 && (
                    <div className="pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setActiveTab("safe")}
                      >
                        Model SAFE Conversions
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
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
                          {formatPercentRaw(analysisResults.projectedState.investorOwnership)}
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
                                  {formatPercentRaw(impact.currentOwnership)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatPercentRaw(impact.newOwnership)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-red-600">
                                  <TrendingDown className="h-3 w-3 inline mr-1" />
                                  {formatPercentRaw(impact.dilutionPercent)}
                                </TableCell>
                              </>
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
        </TabsContent>

        {/* Pro Rata Calculator Tab */}
        <TabsContent value="prorata" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600" />
                Pro Rata Rights Calculator
              </CardTitle>
              <CardDescription>
                Calculate how much each investor needs to invest to maintain their ownership percentage in the next round
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="space-y-2">
                  <Label>Round Size ($)</Label>
                  <Input
                    id="prorata-round-size"
                    type="number"
                    placeholder="10,000,000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pre-Money Valuation ($)</Label>
                  <Input
                    id="prorata-premoney"
                    type="number"
                    placeholder="40,000,000"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={calculateProRata} className="w-full">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Pro Rata
                  </Button>
                </div>
              </div>

              {proRataResults && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Round Size</div>
                      <div className="text-xl font-bold">{formatCurrency(proRataResults.roundSize)}</div>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Pre-Money</div>
                      <div className="text-xl font-bold">{formatCurrency(proRataResults.preMoney)}</div>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Post-Money</div>
                      <div className="text-xl font-bold">{formatCurrency(proRataResults.postMoney)}</div>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Price/Share</div>
                      <div className="text-xl font-bold">${proRataResults.pricePerShare.toFixed(4)}</div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 bg-blue-500/5 border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-600">Total Pro Rata Investment Required</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(proRataResults.totalProRataAmount)}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Total amount existing shareholders need to invest to maintain their ownership
                    </p>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shareholder</TableHead>
                        <TableHead className="text-right">Current Shares</TableHead>
                        <TableHead className="text-right">Current %</TableHead>
                        <TableHead className="text-right">Pro Rata Amount</TableHead>
                        <TableHead className="text-right">New Shares</TableHead>
                        <TableHead className="text-right">% If No Participation</TableHead>
                        <TableHead className="text-right">Dilution Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proRataResults.shareholders.map((sh: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{sh.shareholderName}</TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(sh.currentShares)}</TableCell>
                          <TableCell className="text-right font-mono">{formatPercent(sh.currentOwnership)}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-blue-600">
                            {formatCurrency(sh.proRataAmount)}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(sh.newSharesAtProRata)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatPercent(sh.ownershipIfNoParticipation)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            <TrendingDown className="h-3 w-3 inline mr-1" />
                            {formatPercent(sh.dilutionWithoutProRata)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SAFE Conversion Tab */}
        <TabsContent value="safe" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-orange-600" />
                SAFE Conversion Modeling
              </CardTitle>
              <CardDescription>
                Preview how outstanding SAFEs will convert based on round pricing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="space-y-2">
                  <Label>Round Price Per Share ($)</Label>
                  <Input
                    id="safe-price"
                    type="number"
                    placeholder="1.50"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fully Diluted Shares (Pre-SAFE)</Label>
                  <Input
                    id="safe-fully-diluted"
                    type="number"
                    placeholder={String(summary?.totalFullyDilutedShares || 10000000)}
                    defaultValue={summary?.totalFullyDilutedShares || ""}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={calculateSafeConversions} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Preview Conversions
                  </Button>
                </div>
              </div>

              {/* Outstanding SAFEs */}
              {safes && safes.length > 0 ? (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Outstanding SAFEs ({safes.length})</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {safes.map((safe: any) => (
                      <div key={safe.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">
                            {shareholders?.find((s: any) => s.id === safe.shareholderId)?.name || `Investor #${safe.shareholderId}`}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {safeTypeLabels[safe.safeType] || safe.safeType}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Investment</span>
                            <span className="font-mono">{formatCurrency(parseFloat(safe.investmentAmount))}</span>
                          </div>
                          {safe.valuationCap && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Cap</span>
                              <span className="font-mono">{formatCurrency(parseFloat(safe.valuationCap))}</span>
                            </div>
                          )}
                          {safe.discountRate && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Discount</span>
                              <span className="font-mono">{(parseFloat(safe.discountRate) * 100).toFixed(0)}%</span>
                            </div>
                          )}
                          {safe.hasProRataRights && (
                            <div className="mt-2">
                              <Badge className="bg-blue-500/10 text-blue-600 text-xs">Pro Rata Rights</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No outstanding SAFEs</p>
                  <p className="text-sm">Add SAFE notes from the Shareholders page.</p>
                </div>
              )}

              {/* Conversion Results */}
              {safeConversionResults && (
                <div className="space-y-6 border-t pt-6">
                  <h3 className="font-semibold">Conversion Results</h3>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Round Price</div>
                      <div className="text-xl font-bold">${safeConversionResults.pricePerShare.toFixed(4)}</div>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Total SAFE Investment</div>
                      <div className="text-xl font-bold">{formatCurrency(safeConversionResults.totals.totalInvestment)}</div>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="text-sm text-muted-foreground">Total Shares Issued</div>
                      <div className="text-xl font-bold">{formatNumber(safeConversionResults.totals.totalShares)}</div>
                    </div>
                    <div className="p-4 border rounded-lg bg-orange-500/10 border-orange-500/20">
                      <div className="text-sm text-orange-600">SAFE Ownership</div>
                      <div className="text-xl font-bold text-orange-600">{safeConversionResults.totals.totalOwnership.toFixed(2)}%</div>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Investor</TableHead>
                        <TableHead className="text-right">Investment</TableHead>
                        <TableHead className="text-right">Cap</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-center">Best Method</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Effective Price</TableHead>
                        <TableHead className="text-right">Ownership</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {safeConversionResults.safes.map((result: any) => (
                        <TableRow key={result.safeId}>
                          <TableCell className="font-medium">{result.shareholderName}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(result.investmentAmount)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {result.valuationCap ? formatCurrency(result.valuationCap) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {result.discountRate ? `${(result.discountRate * 100).toFixed(0)}%` : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              result.result.method === "cap" ? "bg-green-500/10 text-green-600" :
                              result.result.method === "discount" ? "bg-blue-500/10 text-blue-600" :
                              "bg-gray-500/10 text-gray-600"
                            }>
                              {result.result.method === "cap" ? "Cap" :
                               result.result.method === "discount" ? "Discount" : "Round Price"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatNumber(result.result.shares)}</TableCell>
                          <TableCell className="text-right font-mono">${result.result.effectivePrice.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono">{result.result.ownershipPercent.toFixed(2)}%</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(safeConversionResults.totals.totalInvestment)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(safeConversionResults.totals.totalShares)}</TableCell>
                        <TableCell className="text-right font-mono">${safeConversionResults.totals.averageEffectivePrice.toFixed(4)}</TableCell>
                        <TableCell className="text-right font-mono">{safeConversionResults.totals.totalOwnership.toFixed(2)}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {/* Comparison Detail */}
                  {safeConversionResults.safes.some((s: any) => s.comparison.cap || s.comparison.discount) && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">Conversion Method Comparison</h4>
                      <div className="space-y-4">
                        {safeConversionResults.safes.map((result: any) => (
                          <div key={result.safeId} className="grid gap-3 md:grid-cols-4 text-sm border-b pb-3 last:border-0">
                            <div className="font-medium">{result.shareholderName}</div>
                            <div>
                              <span className="text-muted-foreground">Round Price:</span>{" "}
                              <span className="font-mono">{formatNumber(result.comparison.roundPrice.shares)} shares</span>
                            </div>
                            {result.comparison.cap && (
                              <div className={result.result.method === "cap" ? "text-green-600 font-medium" : ""}>
                                <span className="text-muted-foreground">Cap:</span>{" "}
                                <span className="font-mono">{formatNumber(result.comparison.cap.shares)} shares</span>
                                {result.result.method === "cap" && " ✓"}
                              </div>
                            )}
                            {result.comparison.discount && (
                              <div className={result.result.method === "discount" ? "text-blue-600 font-medium" : ""}>
                                <span className="text-muted-foreground">Discount:</span>{" "}
                                <span className="font-mono">{formatNumber(result.comparison.discount.shares)} shares</span>
                                {result.result.method === "discount" && " ✓"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exit Waterfall Tab */}
        <TabsContent value="exit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                Exit Waterfall Analysis
              </CardTitle>
              <CardDescription>
                Calculate proceeds distribution for an exit event considering liquidation preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 mb-6">
                <div className="space-y-2">
                  <Label>Exit Value ($)</Label>
                  <Input
                    placeholder="100,000,000"
                    id="quick-exit"
                    type="number"
                  />
                </div>
                <div className="flex items-end">
                  <Button
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
                    Calculate Waterfall
                  </Button>
                </div>
              </div>

              {analysisResults?.projectedState?.exitValue && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Exit Value</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(analysisResults.projectedState.exitValue)}
                      </div>
                    </div>
                  </div>

                  {analysisResults.shareholderImpact && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shareholder</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead className="text-right">Ownership %</TableHead>
                          <TableHead className="text-right">Proceeds</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysisResults.shareholderImpact.map((impact: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{impact.shareholderName}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatNumber(impact.shares)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {impact.currentOwnership !== undefined && formatPercentRaw(impact.currentOwnership)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600 font-bold">
                              {impact.proceedsAmount !== undefined && formatCurrency(impact.proceedsAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saved Scenarios Tab */}
        <TabsContent value="scenarios">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
