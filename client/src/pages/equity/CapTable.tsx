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
import { PieChart, Plus, Search, Loader2, Users, TrendingUp, DollarSign, Percent, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

function formatCurrency(value: string | number | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value || "0") : (value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  return `${(value || 0).toFixed(2)}%`;
}

export default function CapTable() {
  const [search, setSearch] = useState("");
  const [isShareClassOpen, setIsShareClassOpen] = useState(false);
  const [shareClassForm, setShareClassForm] = useState({
    name: "",
    type: "common" as "common" | "preferred" | "convertible",
    authorizedShares: 0,
    pricePerShare: "",
    liquidationPreference: "",
    votingRights: true,
  });

  const { data: summary, isLoading, refetch } = trpc.capTable.summary.useQuery();
  const { data: shareholders } = trpc.capTable.shareholders.list.useQuery();
  const { data: shareClasses } = trpc.capTable.shareClasses.list.useQuery();

  const createShareClass = trpc.capTable.shareClasses.create.useMutation({
    onSuccess: () => {
      toast.success("Share class created successfully");
      setIsShareClassOpen(false);
      setShareClassForm({
        name: "",
        type: "common",
        authorizedShares: 0,
        pricePerShare: "",
        liquidationPreference: "",
        votingRights: true,
      });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleShareClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createShareClass.mutate(shareClassForm);
  };

  const shareholderTypeColors: Record<string, string> = {
    founder: "bg-purple-500/10 text-purple-600",
    employee: "bg-blue-500/10 text-blue-600",
    individual: "bg-green-500/10 text-green-600",
    entity: "bg-amber-500/10 text-amber-600",
    trust: "bg-red-500/10 text-red-600",
    advisor: "bg-cyan-500/10 text-cyan-600",
  };

  const shareClassTypeColors: Record<string, string> = {
    common: "bg-blue-500/10 text-blue-600",
    preferred: "bg-purple-500/10 text-purple-600",
    convertible: "bg-amber-500/10 text-amber-600",
  };

  // Calculate ownership percentages
  const ownershipData = summary?.shareholderHoldings.map(holder => ({
    ...holder,
    ownership: summary.totalOutstandingShares > 0
      ? (holder.totalShares / summary.totalOutstandingShares) * 100
      : 0,
    fullyDilutedOwnership: summary.totalFullyDilutedShares > 0
      ? (holder.totalShares / summary.totalFullyDilutedShares) * 100
      : 0,
  })).sort((a, b) => b.ownership - a.ownership) || [];

  const filteredOwnership = ownershipData.filter(holder =>
    holder.shareholder?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <PieChart className="h-8 w-8" />
            Cap Table
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage company ownership structure.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/equity/shareholders">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Shareholders
            </Button>
          </Link>
          <Link href="/equity/grants">
            <Button variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              Equity Grants
            </Button>
          </Link>
          <Dialog open={isShareClassOpen} onOpenChange={setIsShareClassOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Share Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleShareClassSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Share Class</DialogTitle>
                  <DialogDescription>
                    Add a new share class (e.g., Common Stock, Series A Preferred).
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Class Name</Label>
                    <Input
                      id="name"
                      value={shareClassForm.name}
                      onChange={(e) => setShareClassForm({ ...shareClassForm, name: e.target.value })}
                      placeholder="Common Stock"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={shareClassForm.type}
                        onValueChange={(value: any) => setShareClassForm({ ...shareClassForm, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="common">Common</SelectItem>
                          <SelectItem value="preferred">Preferred</SelectItem>
                          <SelectItem value="convertible">Convertible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="authorizedShares">Authorized Shares</Label>
                      <Input
                        id="authorizedShares"
                        type="number"
                        value={shareClassForm.authorizedShares || ""}
                        onChange={(e) => setShareClassForm({ ...shareClassForm, authorizedShares: parseInt(e.target.value) || 0 })}
                        placeholder="10,000,000"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pricePerShare">Price Per Share</Label>
                      <Input
                        id="pricePerShare"
                        value={shareClassForm.pricePerShare}
                        onChange={(e) => setShareClassForm({ ...shareClassForm, pricePerShare: e.target.value })}
                        placeholder="0.0001"
                      />
                    </div>
                    {shareClassForm.type === "preferred" && (
                      <div className="space-y-2">
                        <Label htmlFor="liquidationPreference">Liquidation Preference (x)</Label>
                        <Input
                          id="liquidationPreference"
                          value={shareClassForm.liquidationPreference}
                          onChange={(e) => setShareClassForm({ ...shareClassForm, liquidationPreference: e.target.value })}
                          placeholder="1.00"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsShareClassOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createShareClass.isPending}>
                    {createShareClass.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Class
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Shares</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(summary?.totalOutstandingShares)}
            </div>
            <p className="text-xs text-muted-foreground">Issued and outstanding</p>
          </CardContent>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Diluted</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(summary?.totalFullyDilutedShares)}
            </div>
            <p className="text-xs text-muted-foreground">Including all options</p>
          </CardContent>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Price Per Share</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.pricePerShare ? `$${Number(summary.pricePerShare).toFixed(4)}` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Based on 409A valuation</p>
          </CardContent>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Option Pool Available</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(summary?.totalOptionPoolAvailable)}
            </div>
            <p className="text-xs text-muted-foreground">Shares available for grants</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="ownership" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ownership">Ownership</TabsTrigger>
          <TabsTrigger value="share-classes">Share Classes</TabsTrigger>
          <TabsTrigger value="option-pools">Option Pools</TabsTrigger>
        </TabsList>

        {/* Ownership Tab */}
        <TabsContent value="ownership" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search shareholders..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !filteredOwnership || filteredOwnership.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No shareholders found</p>
                  <p className="text-sm">Add shareholders to see ownership data.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shareholder</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Ownership %</TableHead>
                      <TableHead className="text-right">Fully Diluted %</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOwnership.map((holder) => (
                      <TableRow key={holder.shareholder?.id}>
                        <TableCell className="font-medium">{holder.shareholder?.name}</TableCell>
                        <TableCell>
                          <Badge className={shareholderTypeColors[holder.shareholder?.type || "individual"]}>
                            {holder.shareholder?.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(holder.totalShares)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPercent(holder.ownership)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPercent(holder.fullyDilutedOwnership)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {summary?.pricePerShare
                            ? formatCurrency(holder.totalShares * Number(summary.pricePerShare))
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(summary?.totalOutstandingShares)}
                      </TableCell>
                      <TableCell className="text-right font-mono">100.00%</TableCell>
                      <TableCell className="text-right font-mono">-</TableCell>
                      <TableCell className="text-right font-mono">
                        {summary?.pricePerShare
                          ? formatCurrency((summary?.totalOutstandingShares || 0) * Number(summary.pricePerShare))
                          : "-"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Share Classes Tab */}
        <TabsContent value="share-classes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Share Classes</CardTitle>
              <CardDescription>
                All authorized share classes and their characteristics.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!shareClasses || shareClasses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <PieChart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No share classes defined</p>
                  <p className="text-sm">Create share classes to track equity.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Authorized</TableHead>
                      <TableHead className="text-right">Issued</TableHead>
                      <TableHead className="text-right">Price/Share</TableHead>
                      <TableHead className="text-right">Liq. Pref.</TableHead>
                      <TableHead>Voting</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareClasses.map((sc) => (
                      <TableRow key={sc.id}>
                        <TableCell className="font-medium">{sc.name}</TableCell>
                        <TableCell>
                          <Badge className={shareClassTypeColors[sc.type]}>
                            {sc.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(Number(sc.authorizedShares))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(Number(sc.issuedShares))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {sc.pricePerShare ? `$${Number(sc.pricePerShare).toFixed(4)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {sc.liquidationPreference ? `${sc.liquidationPreference}x` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sc.votingRights ? "default" : "secondary"}>
                            {sc.votingRights ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Option Pools Tab */}
        <TabsContent value="option-pools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Option Pools</CardTitle>
              <CardDescription>
                Employee stock option pool allocations and availability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!summary?.optionPools || summary.optionPools.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No option pools created</p>
                  <p className="text-sm">Create an option pool to grant equity to employees.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pool Name</TableHead>
                      <TableHead className="text-right">Authorized</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Exercised</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.optionPools.map((pool) => {
                      const available = Number(pool.authorizedShares) - Number(pool.allocatedShares) - Number(pool.exercisedShares) + Number(pool.cancelledShares);
                      const percentOfTotal = summary.totalFullyDilutedShares > 0
                        ? (Number(pool.authorizedShares) / summary.totalFullyDilutedShares) * 100
                        : 0;
                      return (
                        <TableRow key={pool.id}>
                          <TableCell className="font-medium">{pool.name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(Number(pool.authorizedShares))}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(Number(pool.allocatedShares))}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(Number(pool.exercisedShares))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatNumber(available)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatPercent(percentOfTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
