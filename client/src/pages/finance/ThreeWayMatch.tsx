import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, AlertTriangle, Search, Loader2, ArrowRightLeft, Play } from "lucide-react";
import { toast } from "sonner";

function formatCurrency(value: string | number | null | undefined) {
  const num = typeof value === "number" ? value : parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  matched: { color: "bg-green-500/10 text-green-600", icon: CheckCircle },
  pending: { color: "bg-blue-500/10 text-blue-600", icon: ArrowRightLeft },
  discrepancy: { color: "bg-amber-500/10 text-amber-600", icon: AlertTriangle },
  approved: { color: "bg-green-500/10 text-green-600", icon: CheckCircle },
  rejected: { color: "bg-red-500/10 text-red-600", icon: XCircle },
};

export default function ThreeWayMatch() {
  const [search, setSearch] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");

  const { data: matches, isLoading, refetch } = trpc.threeWayMatch.list.useQuery();
  const { data: detail, isLoading: detailLoading } = trpc.threeWayMatch.get.useQuery(
    { id: selectedMatch || 0 },
    { enabled: !!selectedMatch }
  );

  const runAutoMatch = trpc.threeWayMatch.runAutoMatch.useMutation({
    onSuccess: (result) => {
      toast.success(`Auto-match complete: ${result.matched} matched, ${result.discrepancies} discrepancies`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const resolveMatch = trpc.threeWayMatch.resolve.useMutation({
    onSuccess: () => {
      toast.success("Match resolved");
      setResolveOpen(false);
      setResolveNotes("");
      setSelectedMatch(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredMatches = matches?.filter(m =>
    m.matchNumber.toLowerCase().includes(search.toLowerCase()) ||
    m.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="h-8 w-8" />
            Three-Way Match
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated PO vs Goods Receipt vs Vendor Invoice matching.
          </p>
        </div>
        <Button onClick={() => runAutoMatch.mutate()} disabled={runAutoMatch.isPending}>
          {runAutoMatch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Run Auto-Match
        </Button>
      </div>

      {/* Summary Cards */}
      {matches && (
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Matches</p><p className="text-2xl font-bold">{matches.length}</p></CardContent></Card>
          <Card className="bg-green-500/5"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Matched</p><p className="text-2xl font-bold text-green-600">{matches.filter(m => m.status === "matched" || m.status === "approved").length}</p></CardContent></Card>
          <Card className="bg-amber-500/5"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Discrepancies</p><p className="text-2xl font-bold text-amber-600">{matches.filter(m => m.status === "discrepancy").length}</p></CardContent></Card>
          <Card className="bg-blue-500/5"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold text-blue-600">{matches.filter(m => m.status === "pending").length}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search matches..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !filteredMatches || filteredMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No three-way matches found</p>
              <p className="text-sm">Click "Run Auto-Match" to match received POs with invoices.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match #</TableHead>
                  <TableHead>PO ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PO Amount</TableHead>
                  <TableHead className="text-right">Invoice Amount</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.map((match) => {
                  const config = statusConfig[match.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={match.id} className="cursor-pointer" onClick={() => setSelectedMatch(match.id)}>
                      <TableCell className="font-mono">{match.matchNumber}</TableCell>
                      <TableCell>PO #{match.purchaseOrderId}</TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {match.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(match.poAmount)}</TableCell>
                      <TableCell className="text-right font-mono">{match.invoiceAmount ? formatCurrency(match.invoiceAmount) : "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {parseFloat(match.variancePercent || "0") > 0 ? (
                          <span className="text-amber-600">{parseFloat(match.variancePercent || "0").toFixed(1)}%</span>
                        ) : (
                          <span className="text-green-600">0%</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {match.status === "discrepancy" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-green-600" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMatch(match.id);
                              setResolveOpen(true);
                            }}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Panel */}
      {selectedMatch && detail && !resolveOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Match Detail: {detail.matchNumber}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><p className="text-sm text-muted-foreground">PO Quantity</p><p className="font-mono">{detail.poQuantity}</p></div>
              <div><p className="text-sm text-muted-foreground">Receipt Quantity</p><p className="font-mono">{detail.receiptQuantity}</p></div>
              <div><p className="text-sm text-muted-foreground">Quantity Variance</p><p className="font-mono">{detail.quantityVariance}</p></div>
            </div>
            {detail.lines && detail.lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">PO Qty</TableHead>
                    <TableHead className="text-right">PO Price</TableHead>
                    <TableHead className="text-right">Receipt Qty</TableHead>
                    <TableHead>Qty Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description || `Item #${line.poItemId}`}</TableCell>
                      <TableCell className="text-right font-mono">{line.poQuantity}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(line.poUnitPrice)}</TableCell>
                      <TableCell className="text-right font-mono">{line.receiptQuantity || "-"}</TableCell>
                      <TableCell>
                        {line.quantityMatch ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Discrepancy</DialogTitle>
            <DialogDescription>Approve or reject this three-way match with notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Resolution notes..." value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolveOpen(false); setResolveNotes(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedMatch && resolveMatch.mutate({ matchId: selectedMatch, action: "reject", notes: resolveNotes })} disabled={resolveMatch.isPending}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button onClick={() => selectedMatch && resolveMatch.mutate({ matchId: selectedMatch, action: "approve", notes: resolveNotes })} disabled={resolveMatch.isPending}>
              {resolveMatch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
