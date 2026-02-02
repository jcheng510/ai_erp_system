import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Ship, Send, Eye, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_review: "bg-yellow-100 text-yellow-800",
  submitted: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  amended: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-300 text-gray-600",
};

export default function ISFManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIsf, setSelectedIsf] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newIsf, setNewIsf] = useState({
    isfType: "isf_10_plus_2" as const,
    importerName: "",
    importerAddress: "",
    importerEin: "",
    consigneeName: "",
    consigneeAddress: "",
    sellerName: "",
    sellerAddress: "",
    buyerName: "",
    buyerAddress: "",
    manufacturerName: "",
    manufacturerAddress: "",
    countryOfOrigin: "",
    vesselName: "",
    voyageNumber: "",
    carrierScac: "",
    billOfLadingNumber: "",
    foreignPortOfLading: "",
    usPortOfUnlading: "",
    estimatedArrivalDate: "",
    notes: "",
  });

  const { data: isfForms, isLoading } = useQuery({
    queryKey: ["isfForms", statusFilter],
    queryFn: () => trpc.isf.list.query({
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
  });

  const { data: selectedIsfDetail } = useQuery({
    queryKey: ["isfForm", selectedIsf],
    queryFn: () => selectedIsf ? trpc.isf.get.query({ id: selectedIsf }) : null,
    enabled: !!selectedIsf,
  });

  const createIsfMutation = useMutation({
    mutationFn: (input: any) => trpc.isf.create.mutate(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["isfForms"] });
      setShowCreate(false);
      toast({ title: "ISF Created", description: `ISF ${data.isfNumber} has been created.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create ISF form", variant: "destructive" });
    },
  });

  const submitIsfMutation = useMutation({
    mutationFn: (id: number) => trpc.isf.submit.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isfForms"] });
      queryClient.invalidateQueries({ queryKey: ["isfForm", selectedIsf] });
      toast({ title: "ISF Submitted", description: "ISF has been submitted to CBP." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit ISF", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      trpc.isf.update.mutate({ id, status: status as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isfForms"] });
      queryClient.invalidateQueries({ queryKey: ["isfForm", selectedIsf] });
      toast({ title: "Status Updated" });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "rejected": return <XCircle className="w-4 h-4 text-red-500" />;
      case "submitted": return <Send className="w-4 h-4 text-blue-500" />;
      case "pending_review": return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const pendingCount = isfForms?.filter(f => f.status === "draft" || f.status === "pending_review").length || 0;
  const submittedCount = isfForms?.filter(f => f.status === "submitted").length || 0;
  const acceptedCount = isfForms?.filter(f => f.status === "accepted").length || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ISF Management</h1>
          <p className="text-muted-foreground">Manage Importer Security Filing (10+2) forms for customs</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New ISF
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create ISF Form</DialogTitle>
              <DialogDescription>
                Create a new Importer Security Filing for ocean shipments
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="parties" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="parties">Parties (1-6)</TabsTrigger>
                <TabsTrigger value="shipping">Shipping Info</TabsTrigger>
                <TabsTrigger value="cargo">Cargo Details</TabsTrigger>
              </TabsList>

              <TabsContent value="parties" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">1. Importer of Record</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        value={newIsf.importerName}
                        onChange={(e) => setNewIsf({ ...newIsf, importerName: e.target.value })}
                        placeholder="Company Name"
                      />
                      <Textarea
                        value={newIsf.importerAddress}
                        onChange={(e) => setNewIsf({ ...newIsf, importerAddress: e.target.value })}
                        placeholder="Full Address"
                        rows={2}
                      />
                      <Input
                        value={newIsf.importerEin}
                        onChange={(e) => setNewIsf({ ...newIsf, importerEin: e.target.value })}
                        placeholder="EIN/IRS Number"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">2. Consignee</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        value={newIsf.consigneeName}
                        onChange={(e) => setNewIsf({ ...newIsf, consigneeName: e.target.value })}
                        placeholder="Company Name"
                      />
                      <Textarea
                        value={newIsf.consigneeAddress}
                        onChange={(e) => setNewIsf({ ...newIsf, consigneeAddress: e.target.value })}
                        placeholder="Full Address"
                        rows={2}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">3. Seller</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        value={newIsf.sellerName}
                        onChange={(e) => setNewIsf({ ...newIsf, sellerName: e.target.value })}
                        placeholder="Company Name"
                      />
                      <Textarea
                        value={newIsf.sellerAddress}
                        onChange={(e) => setNewIsf({ ...newIsf, sellerAddress: e.target.value })}
                        placeholder="Full Address"
                        rows={2}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">4. Buyer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        value={newIsf.buyerName}
                        onChange={(e) => setNewIsf({ ...newIsf, buyerName: e.target.value })}
                        placeholder="Company Name"
                      />
                      <Textarea
                        value={newIsf.buyerAddress}
                        onChange={(e) => setNewIsf({ ...newIsf, buyerAddress: e.target.value })}
                        placeholder="Full Address"
                        rows={2}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">6. Manufacturer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        value={newIsf.manufacturerName}
                        onChange={(e) => setNewIsf({ ...newIsf, manufacturerName: e.target.value })}
                        placeholder="Manufacturer Name"
                      />
                      <Textarea
                        value={newIsf.manufacturerAddress}
                        onChange={(e) => setNewIsf({ ...newIsf, manufacturerAddress: e.target.value })}
                        placeholder="Full Address"
                        rows={2}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">7. Country of Origin</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        value={newIsf.countryOfOrigin}
                        onChange={(e) => setNewIsf({ ...newIsf, countryOfOrigin: e.target.value })}
                        placeholder="e.g., CN, VN, MX"
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="shipping" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vessel Name</Label>
                    <Input
                      value={newIsf.vesselName}
                      onChange={(e) => setNewIsf({ ...newIsf, vesselName: e.target.value })}
                      placeholder="e.g., MSC OSCAR"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Voyage Number</Label>
                    <Input
                      value={newIsf.voyageNumber}
                      onChange={(e) => setNewIsf({ ...newIsf, voyageNumber: e.target.value })}
                      placeholder="e.g., 123E"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Carrier SCAC</Label>
                    <Input
                      value={newIsf.carrierScac}
                      onChange={(e) => setNewIsf({ ...newIsf, carrierScac: e.target.value })}
                      placeholder="e.g., MSCU"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bill of Lading Number</Label>
                    <Input
                      value={newIsf.billOfLadingNumber}
                      onChange={(e) => setNewIsf({ ...newIsf, billOfLadingNumber: e.target.value })}
                      placeholder="B/L Number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Foreign Port of Lading</Label>
                    <Input
                      value={newIsf.foreignPortOfLading}
                      onChange={(e) => setNewIsf({ ...newIsf, foreignPortOfLading: e.target.value })}
                      placeholder="e.g., Shanghai, China"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>US Port of Unlading</Label>
                    <Input
                      value={newIsf.usPortOfUnlading}
                      onChange={(e) => setNewIsf({ ...newIsf, usPortOfUnlading: e.target.value })}
                      placeholder="e.g., Los Angeles, CA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Arrival Date</Label>
                    <Input
                      type="date"
                      value={newIsf.estimatedArrivalDate}
                      onChange={(e) => setNewIsf({ ...newIsf, estimatedArrivalDate: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cargo" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newIsf.notes}
                    onChange={(e) => setNewIsf({ ...newIsf, notes: e.target.value })}
                    placeholder="Additional notes about the shipment..."
                    rows={4}
                  />
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                  <p className="font-medium">ISF Filing Deadline</p>
                  <p>ISF must be filed at least 24 hours before cargo is laden aboard a vessel at a foreign port.</p>
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createIsfMutation.mutate({
                  ...newIsf,
                  estimatedArrivalDate: newIsf.estimatedArrivalDate ? new Date(newIsf.estimatedArrivalDate) : undefined,
                })}
                disabled={createIsfMutation.isPending}
              >
                Create ISF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{isfForms?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total ISF Forms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{submittedCount}</div>
            <p className="text-sm text-muted-foreground">Submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{acceptedCount}</div>
            <p className="text-sm text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ISF List */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>ISF Forms</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ISF Number</TableHead>
                    <TableHead>Vessel</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : isfForms?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No ISF forms found
                      </TableCell>
                    </TableRow>
                  ) : (
                    isfForms?.map((isf) => (
                      <TableRow
                        key={isf.id}
                        className={selectedIsf === isf.id ? "bg-muted" : "cursor-pointer hover:bg-muted/50"}
                        onClick={() => setSelectedIsf(isf.id)}
                      >
                        <TableCell className="font-medium">{isf.isfNumber}</TableCell>
                        <TableCell>{isf.vesselName || "-"}</TableCell>
                        <TableCell>{isf.usPortOfUnlading || "-"}</TableCell>
                        <TableCell>
                          {isf.estimatedArrivalDate
                            ? new Date(isf.estimatedArrivalDate).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[isf.status]}>
                            {isf.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIsf(isf.id);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* ISF Detail Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              ISF Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedIsfDetail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold">{selectedIsfDetail.isfNumber}</span>
                  <Badge className={STATUS_COLORS[selectedIsfDetail.status]}>
                    {selectedIsfDetail.status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span>{selectedIsfDetail.isfType?.replace("_", " ").toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Importer</span>
                    <span>{selectedIsfDetail.importerName || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vessel</span>
                    <span>{selectedIsfDetail.vesselName || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Voyage</span>
                    <span>{selectedIsfDetail.voyageNumber || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Origin</span>
                    <span>{selectedIsfDetail.countryOfOrigin || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">B/L Number</span>
                    <span>{selectedIsfDetail.billOfLadingNumber || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ETA</span>
                    <span>
                      {selectedIsfDetail.estimatedArrivalDate
                        ? new Date(selectedIsfDetail.estimatedArrivalDate).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                </div>

                {selectedIsfDetail.lineItems && selectedIsfDetail.lineItems.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Line Items</Label>
                    <div className="mt-1 space-y-1">
                      {selectedIsfDetail.lineItems.map((item: any) => (
                        <div key={item.id} className="text-sm p-2 bg-muted rounded">
                          <span className="font-mono">{item.hsCode}</span> - {item.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-4 border-t">
                  {selectedIsfDetail.status === "draft" && (
                    <>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: selectedIsfDetail.id, status: "pending_review" })}
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Mark Ready for Review
                      </Button>
                      <Button
                        className="w-full"
                        onClick={() => submitIsfMutation.mutate(selectedIsfDetail.id)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Submit to CBP
                      </Button>
                    </>
                  )}
                  {selectedIsfDetail.status === "pending_review" && (
                    <Button
                      className="w-full"
                      onClick={() => submitIsfMutation.mutate(selectedIsfDetail.id)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit to CBP
                    </Button>
                  )}
                  {selectedIsfDetail.status === "submitted" && (
                    <div className="p-3 bg-blue-50 rounded text-sm text-blue-800 flex items-start gap-2">
                      <Ship className="w-4 h-4 mt-0.5" />
                      <span>ISF has been submitted. Awaiting CBP response.</span>
                    </div>
                  )}
                  {selectedIsfDetail.status === "rejected" && (
                    <div className="p-3 bg-red-50 rounded text-sm text-red-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5" />
                      <span>ISF was rejected. Please review and amend.</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select an ISF form to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
