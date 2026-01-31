import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TrendingUp, Plus, Search, Loader2, Calendar, DollarSign, ChevronLeft, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatCurrency(value: string | number | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value || "0") : (value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function EquityGrants() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formData, setFormData] = useState({
    shareholderId: 0,
    shareClassId: 0,
    vestingScheduleId: undefined as number | undefined,
    grantType: "iso" as "iso" | "nso" | "rsu" | "rsa" | "warrant" | "phantom",
    grantDate: new Date().toISOString().split("T")[0],
    sharesGranted: 0,
    exercisePrice: "",
    vestingStartDate: new Date().toISOString().split("T")[0],
    expirationDate: "",
    notes: "",
  });

  const { data: grants, isLoading, refetch } = trpc.capTable.grants.list.useQuery();
  const { data: shareholders } = trpc.capTable.shareholders.list.useQuery();
  const { data: shareClasses } = trpc.capTable.shareClasses.list.useQuery();
  const { data: vestingSchedules } = trpc.capTable.vestingSchedules.list.useQuery();
  const { data: grantDetail } = trpc.capTable.grants.get.useQuery(
    { id: selectedGrant?.id },
    { enabled: !!selectedGrant }
  );

  const createGrant = trpc.capTable.grants.create.useMutation({
    onSuccess: () => {
      toast.success("Equity grant created successfully");
      setIsOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelGrant = trpc.capTable.grants.cancel.useMutation({
    onSuccess: () => {
      toast.success("Grant cancelled");
      setIsDetailOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      shareholderId: 0,
      shareClassId: 0,
      vestingScheduleId: undefined,
      grantType: "iso",
      grantDate: new Date().toISOString().split("T")[0],
      sharesGranted: 0,
      exercisePrice: "",
      vestingStartDate: new Date().toISOString().split("T")[0],
      expirationDate: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGrant.mutate({
      shareholderId: formData.shareholderId,
      shareClassId: formData.shareClassId,
      vestingScheduleId: formData.vestingScheduleId,
      grantType: formData.grantType,
      grantDate: new Date(formData.grantDate),
      sharesGranted: formData.sharesGranted,
      exercisePrice: formData.exercisePrice,
      vestingStartDate: new Date(formData.vestingStartDate),
      expirationDate: formData.expirationDate ? new Date(formData.expirationDate) : undefined,
      notes: formData.notes || undefined,
    });
  };

  const filteredGrants = grants?.filter((grant) => {
    const matchesSearch =
      shareholders?.find((s) => s.id === grant.shareholderId)?.name?.toLowerCase().includes(search.toLowerCase()) ||
      grant.grantNumber?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || grant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const grantTypeColors: Record<string, string> = {
    iso: "bg-green-500/10 text-green-600",
    nso: "bg-blue-500/10 text-blue-600",
    rsu: "bg-purple-500/10 text-purple-600",
    rsa: "bg-amber-500/10 text-amber-600",
    warrant: "bg-red-500/10 text-red-600",
    phantom: "bg-gray-500/10 text-gray-600",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600",
    fully_vested: "bg-blue-500/10 text-blue-600",
    partially_exercised: "bg-purple-500/10 text-purple-600",
    fully_exercised: "bg-cyan-500/10 text-cyan-600",
    cancelled: "bg-red-500/10 text-red-600",
    expired: "bg-gray-500/10 text-gray-600",
    forfeited: "bg-orange-500/10 text-orange-600",
  };

  const getShareholderName = (id: number) => {
    return shareholders?.find((s) => s.id === id)?.name || "Unknown";
  };

  const openDetail = (grant: any) => {
    setSelectedGrant(grant);
    setIsDetailOpen(true);
  };

  // Calculate vesting progress for display
  const calculateVestingProgress = (grant: any) => {
    const totalShares = Number(grant.sharesGranted) - Number(grant.sharesCancelled || 0);
    const vestedShares = Number(grant.sharesVested || 0);
    return totalShares > 0 ? (vestedShares / totalShares) * 100 : 0;
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
            <TrendingUp className="h-8 w-8" />
            Equity Grants
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage stock options, RSUs, and other equity grants.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Grant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create Equity Grant</DialogTitle>
                <DialogDescription>
                  Issue a new equity grant to a shareholder.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recipient *</Label>
                    <Select
                      value={formData.shareholderId ? String(formData.shareholderId) : ""}
                      onValueChange={(value) => setFormData({ ...formData, shareholderId: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shareholder" />
                      </SelectTrigger>
                      <SelectContent>
                        {shareholders?.map((sh) => (
                          <SelectItem key={sh.id} value={String(sh.id)}>
                            {sh.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Grant Type *</Label>
                    <Select
                      value={formData.grantType}
                      onValueChange={(value: any) => setFormData({ ...formData, grantType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iso">ISO (Incentive Stock Option)</SelectItem>
                        <SelectItem value="nso">NSO (Non-Qualified Stock Option)</SelectItem>
                        <SelectItem value="rsu">RSU (Restricted Stock Unit)</SelectItem>
                        <SelectItem value="rsa">RSA (Restricted Stock Award)</SelectItem>
                        <SelectItem value="warrant">Warrant</SelectItem>
                        <SelectItem value="phantom">Phantom Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Share Class *</Label>
                    <Select
                      value={formData.shareClassId ? String(formData.shareClassId) : ""}
                      onValueChange={(value) => setFormData({ ...formData, shareClassId: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select share class" />
                      </SelectTrigger>
                      <SelectContent>
                        {shareClasses?.map((sc) => (
                          <SelectItem key={sc.id} value={String(sc.id)}>
                            {sc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vesting Schedule</Label>
                    <Select
                      value={formData.vestingScheduleId ? String(formData.vestingScheduleId) : "none"}
                      onValueChange={(value) => setFormData({ ...formData, vestingScheduleId: value === "none" ? undefined : parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vesting schedule" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Vesting (Immediate)</SelectItem>
                        {vestingSchedules?.map((vs) => (
                          <SelectItem key={vs.id} value={String(vs.id)}>
                            {vs.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shares Granted *</Label>
                    <Input
                      type="number"
                      value={formData.sharesGranted || ""}
                      onChange={(e) => setFormData({ ...formData, sharesGranted: parseInt(e.target.value) || 0 })}
                      placeholder="10,000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exercise Price *</Label>
                    <Input
                      value={formData.exercisePrice}
                      onChange={(e) => setFormData({ ...formData, exercisePrice: e.target.value })}
                      placeholder="0.50"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Grant Date *</Label>
                    <Input
                      type="date"
                      value={formData.grantDate}
                      onChange={(e) => setFormData({ ...formData, grantDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vesting Start Date *</Label>
                    <Input
                      type="date"
                      value={formData.vestingStartDate}
                      onChange={(e) => setFormData({ ...formData, vestingStartDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Typically 10 years from grant date for options
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createGrant.isPending}>
                  {createGrant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Grant
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search grants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="fully_vested">Fully Vested</SelectItem>
                <SelectItem value="partially_exercised">Partially Exercised</SelectItem>
                <SelectItem value="fully_exercised">Fully Exercised</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredGrants || filteredGrants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No equity grants found</p>
              <p className="text-sm">Create your first grant to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grant #</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Exercise Price</TableHead>
                  <TableHead>Grant Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vesting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrants.map((grant) => (
                  <TableRow
                    key={grant.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(grant)}
                  >
                    <TableCell className="font-mono">
                      {grant.grantNumber || `#${grant.id}`}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getShareholderName(grant.shareholderId)}
                    </TableCell>
                    <TableCell>
                      <Badge className={grantTypeColors[grant.grantType]}>
                        {grant.grantType.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(Number(grant.sharesGranted))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(grant.exercisePrice)}
                    </TableCell>
                    <TableCell>{formatDate(grant.grantDate)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[grant.status]}>
                        {grant.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[150px]">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={calculateVestingProgress(grant)}
                          className="h-2 flex-1"
                        />
                        <span className="text-xs text-muted-foreground w-10">
                          {Math.round(calculateVestingProgress(grant))}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {grantDetail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {grantDetail.grantNumber || `Grant #${grantDetail.id}`}
                  <Badge className={grantTypeColors[grantDetail.grantType]}>
                    {grantDetail.grantType.toUpperCase()}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  Grant details and vesting information
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Shares Granted</div>
                    <div className="text-2xl font-bold">
                      {formatNumber(Number(grantDetail.sharesGranted))}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Exercise Price</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(grantDetail.exercisePrice)}
                    </div>
                  </div>
                </div>

                {/* Vesting Progress */}
                {grantDetail.vestingInfo && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Vesting Progress
                    </h3>
                    <div className="p-4 border rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Vested</span>
                        <span className="font-mono font-semibold text-green-600">
                          {formatNumber(grantDetail.vestingInfo.vestedShares)} shares
                        </span>
                      </div>
                      <Progress value={grantDetail.vestingInfo.percentVested} className="h-3" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{grantDetail.vestingInfo.percentVested}% vested</span>
                        <span>{formatNumber(grantDetail.vestingInfo.unvestedShares)} unvested</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Dates */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Key Dates
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 border rounded">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Grant Date</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(grantDetail.grantDate)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 border rounded">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Vesting Start</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(grantDetail.vestingStartDate)}
                        </div>
                      </div>
                    </div>
                    {grantDetail.cliffDate && (
                      <div className="flex items-center gap-3 p-2 border rounded">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">Cliff Date</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(grantDetail.cliffDate)}
                          </div>
                        </div>
                      </div>
                    )}
                    {grantDetail.fullyVestedDate && (
                      <div className="flex items-center gap-3 p-2 border rounded">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">Fully Vested Date</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(grantDetail.fullyVestedDate)}
                          </div>
                        </div>
                      </div>
                    )}
                    {grantDetail.expirationDate && (
                      <div className="flex items-center gap-3 p-2 border rounded">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">Expiration Date</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(grantDetail.expirationDate)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Exercise Activity */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Exercise Activity
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Exercised</div>
                      <div className="text-lg font-semibold">
                        {formatNumber(Number(grantDetail.sharesExercised))}
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Cancelled</div>
                      <div className="text-lg font-semibold">
                        {formatNumber(Number(grantDetail.sharesCancelled))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Status
                  </h3>
                  <Badge className={`${statusColors[grantDetail.status]} text-sm px-3 py-1`}>
                    {grantDetail.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Actions */}
                {grantDetail.status === "active" && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel this grant?")) {
                          cancelGrant.mutate({ id: grantDetail.id });
                        }
                      }}
                      disabled={cancelGrant.isPending}
                    >
                      {cancelGrant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Cancel Grant
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
