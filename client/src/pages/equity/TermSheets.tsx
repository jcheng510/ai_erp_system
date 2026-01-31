import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  FileText,
  Plus,
  ChevronLeft,
  Loader2,
  Copy,
  Trash2,
  Edit,
  Share2,
  Users,
  Eye,
  ExternalLink,
  Clock,
  Check,
  X,
  MessageSquare,
  History,
  Mail,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0);
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-600",
  sent: "bg-blue-500/10 text-blue-600",
  negotiating: "bg-yellow-500/10 text-yellow-600",
  signed: "bg-green-500/10 text-green-600",
  expired: "bg-red-500/10 text-red-600",
  rejected: "bg-red-500/10 text-red-600",
};

const roundTypeLabels: Record<string, string> = {
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c: "Series C",
  bridge: "Bridge",
  convertible: "Convertible",
};

export default function TermSheets() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTermSheet, setSelectedTermSheet] = useState<any>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareName, setShareName] = useState("");
  const [shareOrg, setShareOrg] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    roundType: "series_a" as string,
    targetRaise: "",
    preMoneyValuation: "",
    leadInvestorName: "",
    leadInvestorCommitment: "",
    shareClassName: "",
    pricePerShare: "",
    liquidationPreference: "1.00",
    participatingPreferred: false,
    antiDilutionType: "broad_weighted_average",
    dividendType: "non_cumulative",
    proRataRights: true,
    boardSeats: 1,
    observerRights: true,
    optionPoolSize: "0.15",
    optionPoolPreMoney: true,
    noShopPeriodDays: 45,
    governingLaw: "Delaware",
    notes: "",
  });

  const { data: termSheets, isLoading, refetch } = trpc.capTable.termSheets.list.useQuery();

  const createTermSheet = trpc.capTable.termSheets.create.useMutation({
    onSuccess: () => {
      toast.success("Term sheet created");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateTermSheet = trpc.capTable.termSheets.update.useMutation({
    onSuccess: () => {
      toast.success("Term sheet updated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteTermSheet = trpc.capTable.termSheets.delete.useMutation({
    onSuccess: () => {
      toast.success("Term sheet deleted");
      setSelectedTermSheet(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const duplicateTermSheet = trpc.capTable.termSheets.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Term sheet duplicated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addRecipient = trpc.capTable.termSheets.addRecipient.useMutation({
    onSuccess: () => {
      toast.success("Recipient added");
      setShareEmail("");
      setShareName("");
      setShareOrg("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      roundType: "series_a",
      targetRaise: "",
      preMoneyValuation: "",
      leadInvestorName: "",
      leadInvestorCommitment: "",
      shareClassName: "",
      pricePerShare: "",
      liquidationPreference: "1.00",
      participatingPreferred: false,
      antiDilutionType: "broad_weighted_average",
      dividendType: "non_cumulative",
      proRataRights: true,
      boardSeats: 1,
      observerRights: true,
      optionPoolSize: "0.15",
      optionPoolPreMoney: true,
      noShopPeriodDays: 45,
      governingLaw: "Delaware",
      notes: "",
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTermSheet.mutate({
      title: formData.title,
      roundType: formData.roundType as any,
      targetRaise: formData.targetRaise,
      preMoneyValuation: formData.preMoneyValuation || undefined,
      leadInvestorName: formData.leadInvestorName || undefined,
      leadInvestorCommitment: formData.leadInvestorCommitment || undefined,
      shareClassName: formData.shareClassName || undefined,
      pricePerShare: formData.pricePerShare || undefined,
      liquidationPreference: formData.liquidationPreference || undefined,
      participatingPreferred: formData.participatingPreferred,
      antiDilutionType: formData.antiDilutionType as any,
      dividendType: formData.dividendType as any,
      proRataRights: formData.proRataRights,
      boardSeats: formData.boardSeats,
      observerRights: formData.observerRights,
      optionPoolSize: formData.optionPoolSize || undefined,
      optionPoolPreMoney: formData.optionPoolPreMoney,
      noShopPeriodDays: formData.noShopPeriodDays,
      governingLaw: formData.governingLaw || undefined,
      notes: formData.notes || undefined,
    });
  };

  const handleAddRecipient = () => {
    if (!shareEmail || !selectedTermSheet) return;
    addRecipient.mutate({
      termSheetId: selectedTermSheet.id,
      email: shareEmail,
      name: shareName || undefined,
      organization: shareOrg || undefined,
      role: "investor",
      canComment: true,
    });
  };

  const copyShareLink = () => {
    if (!selectedTermSheet?.shareToken) return;
    const link = `${window.location.origin}/term-sheet/${selectedTermSheet.shareToken}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
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
            <FileText className="h-8 w-8" />
            Term Sheets
          </h1>
          <p className="text-muted-foreground mt-1">
            Create, share, and manage term sheets for funding rounds.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Term Sheet
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateSubmit}>
              <DialogHeader>
                <DialogTitle>Create Term Sheet</DialogTitle>
                <DialogDescription>
                  Create a new term sheet for a funding round.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Series A Term Sheet"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Round Type *</Label>
                    <Select
                      value={formData.roundType}
                      onValueChange={(value) => setFormData({ ...formData, roundType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seed">Seed</SelectItem>
                        <SelectItem value="series_a">Series A</SelectItem>
                        <SelectItem value="series_b">Series B</SelectItem>
                        <SelectItem value="series_c">Series C</SelectItem>
                        <SelectItem value="bridge">Bridge</SelectItem>
                        <SelectItem value="convertible">Convertible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target Raise ($) *</Label>
                    <Input
                      value={formData.targetRaise}
                      onChange={(e) => setFormData({ ...formData, targetRaise: e.target.value })}
                      placeholder="10000000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pre-Money Valuation ($)</Label>
                    <Input
                      value={formData.preMoneyValuation}
                      onChange={(e) => setFormData({ ...formData, preMoneyValuation: e.target.value })}
                      placeholder="40000000"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Lead Investor</Label>
                    <Input
                      value={formData.leadInvestorName}
                      onChange={(e) => setFormData({ ...formData, leadInvestorName: e.target.value })}
                      placeholder="Acme Ventures"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Commitment ($)</Label>
                    <Input
                      value={formData.leadInvestorCommitment}
                      onChange={(e) => setFormData({ ...formData, leadInvestorCommitment: e.target.value })}
                      placeholder="5000000"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Share Class Terms</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Share Class Name</Label>
                      <Input
                        value={formData.shareClassName}
                        onChange={(e) => setFormData({ ...formData, shareClassName: e.target.value })}
                        placeholder="Series A Preferred"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price Per Share ($)</Label>
                      <Input
                        value={formData.pricePerShare}
                        onChange={(e) => setFormData({ ...formData, pricePerShare: e.target.value })}
                        placeholder="1.50"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Liquidation Preference (x)</Label>
                    <Select
                      value={formData.liquidationPreference}
                      onValueChange={(value) => setFormData({ ...formData, liquidationPreference: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1.00">1x</SelectItem>
                        <SelectItem value="1.50">1.5x</SelectItem>
                        <SelectItem value="2.00">2x</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Anti-Dilution</Label>
                    <Select
                      value={formData.antiDilutionType}
                      onValueChange={(value) => setFormData({ ...formData, antiDilutionType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="broad_weighted_average">Broad-Based Weighted Average</SelectItem>
                        <SelectItem value="narrow_weighted_average">Narrow-Based Weighted Average</SelectItem>
                        <SelectItem value="full_ratchet">Full Ratchet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <Label className="cursor-pointer">Participating Preferred</Label>
                    <Switch
                      checked={formData.participatingPreferred}
                      onCheckedChange={(checked) => setFormData({ ...formData, participatingPreferred: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <Label className="cursor-pointer">Pro Rata Rights</Label>
                    <Switch
                      checked={formData.proRataRights}
                      onCheckedChange={(checked) => setFormData({ ...formData, proRataRights: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <Label className="cursor-pointer">Observer Rights</Label>
                    <Switch
                      checked={formData.observerRights}
                      onCheckedChange={(checked) => setFormData({ ...formData, observerRights: checked })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Board Seats</Label>
                    <Input
                      type="number"
                      value={formData.boardSeats}
                      onChange={(e) => setFormData({ ...formData, boardSeats: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Option Pool (%)</Label>
                    <Input
                      value={(parseFloat(formData.optionPoolSize) * 100).toString()}
                      onChange={(e) => setFormData({ ...formData, optionPoolSize: (parseFloat(e.target.value) / 100).toString() })}
                      placeholder="15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>No-Shop (days)</Label>
                    <Input
                      type="number"
                      value={formData.noShopPeriodDays}
                      onChange={(e) => setFormData({ ...formData, noShopPeriodDays: parseInt(e.target.value) || 45 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional terms or notes..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTermSheet.isPending}>
                  {createTermSheet.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Term Sheet
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Term Sheets List */}
      <Card>
        <CardHeader>
          <CardTitle>All Term Sheets</CardTitle>
          <CardDescription>
            Manage your term sheets and track negotiation progress.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !termSheets || termSheets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No term sheets yet</p>
              <p className="text-sm">Create your first term sheet to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Target Raise</TableHead>
                  <TableHead>Lead Investor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {termSheets.map((ts) => (
                  <TableRow key={ts.id} className="cursor-pointer" onClick={() => setSelectedTermSheet(ts)}>
                    <TableCell className="font-medium">{ts.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {roundTypeLabels[ts.roundType] || ts.roundType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{formatCurrency(ts.targetRaise)}</TableCell>
                    <TableCell>{ts.leadInvestorName || "-"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[ts.status]}>
                        {ts.status}
                      </Badge>
                    </TableCell>
                    <TableCell>v{ts.version}</TableCell>
                    <TableCell>{formatDate(ts.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTermSheet(ts);
                            setIsShareOpen(true);
                          }}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateTermSheet.mutate({ id: ts.id });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this term sheet?")) {
                              deleteTermSheet.mutate({ id: ts.id });
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

      {/* Term Sheet Detail Sheet */}
      <Sheet open={!!selectedTermSheet && !isShareOpen} onOpenChange={(open) => !open && setSelectedTermSheet(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedTermSheet?.title}
            </SheetTitle>
            <SheetDescription>
              {roundTypeLabels[selectedTermSheet?.roundType] || selectedTermSheet?.roundType} - v{selectedTermSheet?.version}
            </SheetDescription>
          </SheetHeader>

          {selectedTermSheet && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge className={statusColors[selectedTermSheet.status]}>
                  {selectedTermSheet.status}
                </Badge>
                <Select
                  value={selectedTermSheet.status}
                  onValueChange={(value) => {
                    updateTermSheet.mutate({
                      id: selectedTermSheet.id,
                      data: { status: value as any },
                    });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="negotiating">Negotiating</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Key Terms */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Target Raise</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="text-2xl font-bold">{formatCurrency(selectedTermSheet.targetRaise)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Pre-Money Valuation</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="text-2xl font-bold">
                      {selectedTermSheet.preMoneyValuation ? formatCurrency(selectedTermSheet.preMoneyValuation) : "TBD"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Lead Investor */}
              {selectedTermSheet.leadInvestorName && (
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Lead Investor</div>
                  <div className="font-medium">{selectedTermSheet.leadInvestorName}</div>
                  {selectedTermSheet.leadInvestorCommitment && (
                    <div className="text-sm text-muted-foreground">
                      Commitment: {formatCurrency(selectedTermSheet.leadInvestorCommitment)}
                    </div>
                  )}
                </div>
              )}

              {/* Terms Grid */}
              <div className="space-y-4">
                <h3 className="font-semibold">Terms</h3>
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Share Class</span>
                    <span className="font-medium">{selectedTermSheet.shareClassName || "TBD"}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Price/Share</span>
                    <span className="font-medium">
                      {selectedTermSheet.pricePerShare ? `$${parseFloat(selectedTermSheet.pricePerShare).toFixed(4)}` : "TBD"}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Liquidation Preference</span>
                    <span className="font-medium">{selectedTermSheet.liquidationPreference}x</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Participating Preferred</span>
                    <span className="font-medium">{selectedTermSheet.participatingPreferred ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Anti-Dilution</span>
                    <span className="font-medium">{selectedTermSheet.antiDilutionType?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Pro Rata Rights</span>
                    <span className="font-medium">{selectedTermSheet.proRataRights ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Board Seats</span>
                    <span className="font-medium">{selectedTermSheet.boardSeats}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Observer Rights</span>
                    <span className="font-medium">{selectedTermSheet.observerRights ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Option Pool</span>
                    <span className="font-medium">
                      {selectedTermSheet.optionPoolSize ? `${(parseFloat(selectedTermSheet.optionPoolSize) * 100).toFixed(0)}%` : "TBD"}
                      {selectedTermSheet.optionPoolPreMoney ? " (Pre-Money)" : " (Post-Money)"}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">No-Shop Period</span>
                    <span className="font-medium">{selectedTermSheet.noShopPeriodDays} days</span>
                  </div>
                  <div className="flex justify-between p-2 border rounded">
                    <span className="text-muted-foreground">Governing Law</span>
                    <span className="font-medium">{selectedTermSheet.governingLaw}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedTermSheet.notes && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedTermSheet.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsShareOpen(true);
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="outline" onClick={() => duplicateTermSheet.mutate({ id: selectedTermSheet.id })}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600"
                  onClick={() => {
                    if (confirm("Delete this term sheet?")) {
                      deleteTermSheet.mutate({ id: selectedTermSheet.id });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Term Sheet</DialogTitle>
            <DialogDescription>
              Share this term sheet with investors or advisors.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Public Link */}
            <div className="space-y-2">
              <Label>Public Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={selectedTermSheet?.shareEnabled ? `${window.location.origin}/term-sheet/${selectedTermSheet?.shareToken}` : "Link sharing disabled"}
                />
                <Button
                  variant="outline"
                  onClick={copyShareLink}
                  disabled={!selectedTermSheet?.shareEnabled}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  checked={selectedTermSheet?.shareEnabled || false}
                  onCheckedChange={(checked) => {
                    updateTermSheet.mutate({
                      id: selectedTermSheet?.id,
                      data: { shareEnabled: checked },
                    });
                  }}
                />
                <Label>Enable public link</Label>
              </div>
            </div>

            {/* Add Recipient */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Add Recipient</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="investor@example.com"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={shareName}
                      onChange={(e) => setShareName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <Input
                      value={shareOrg}
                      onChange={(e) => setShareOrg(e.target.value)}
                      placeholder="Acme Ventures"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddRecipient}
                  disabled={!shareEmail || addRecipient.isPending}
                  className="w-full"
                >
                  {addRecipient.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Add & Send Invitation
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
