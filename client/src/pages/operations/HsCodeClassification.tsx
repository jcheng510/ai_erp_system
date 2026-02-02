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
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Sparkles, CheckCircle, AlertTriangle, FileText, Calculator } from "lucide-react";

export default function HsCodeClassification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAiClassify, setShowAiClassify] = useState(false);
  const [showAddClassification, setShowAddClassification] = useState(false);
  const [aiInput, setAiInput] = useState({
    productName: "",
    productDescription: "",
    material: "",
    countryOfOrigin: "",
    intendedUse: "",
  });
  const [aiResult, setAiResult] = useState<any>(null);
  const [newClassification, setNewClassification] = useState({
    productId: undefined as number | undefined,
    rawMaterialId: undefined as number | undefined,
    hsCode: "",
    description: "",
    countryOfOrigin: "",
    classificationMethod: "manual" as const,
    notes: "",
  });

  const { data: hsCodes, isLoading: loadingCodes } = useQuery({
    queryKey: ["hsCodes", searchTerm],
    queryFn: () => trpc.hsCodes.list.query({ search: searchTerm || undefined }),
  });

  const { data: classifications } = useQuery({
    queryKey: ["hsClassifications"],
    queryFn: () => trpc.hsCodes.classifications.list.query({}),
  });

  const { data: tariffCalculations } = useQuery({
    queryKey: ["tariffCalculations"],
    queryFn: () => trpc.hsCodes.calculations.list.query({}),
  });

  const aiClassifyMutation = useMutation({
    mutationFn: (input: typeof aiInput) => trpc.hsCodes.classifications.aiClassify.mutate(input),
    onSuccess: (data) => {
      setAiResult(data);
      toast({ title: "AI Classification Complete", description: "Review the suggested HS code below." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to get AI classification", variant: "destructive" });
    },
  });

  const createClassificationMutation = useMutation({
    mutationFn: (input: any) => trpc.hsCodes.classifications.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hsClassifications"] });
      setShowAddClassification(false);
      setNewClassification({
        productId: undefined,
        rawMaterialId: undefined,
        hsCode: "",
        description: "",
        countryOfOrigin: "",
        classificationMethod: "manual",
        notes: "",
      });
      toast({ title: "Classification Added", description: "Product HS classification created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create classification", variant: "destructive" });
    },
  });

  const verifyClassificationMutation = useMutation({
    mutationFn: (id: number) => trpc.hsCodes.classifications.verify.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hsClassifications"] });
      toast({ title: "Verified", description: "Classification has been verified." });
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">HS Code Classification</h1>
          <p className="text-muted-foreground">Manage HS codes and product classifications for customs compliance</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAiClassify} onOpenChange={setShowAiClassify}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Classify
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>AI HS Code Classification</DialogTitle>
                <DialogDescription>
                  Enter product details to get AI-suggested HS code classification
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Name *</Label>
                    <Input
                      value={aiInput.productName}
                      onChange={(e) => setAiInput({ ...aiInput, productName: e.target.value })}
                      placeholder="e.g., Cotton T-Shirt"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country of Origin</Label>
                    <Input
                      value={aiInput.countryOfOrigin}
                      onChange={(e) => setAiInput({ ...aiInput, countryOfOrigin: e.target.value })}
                      placeholder="e.g., CN, VN, MX"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Product Description *</Label>
                  <Textarea
                    value={aiInput.productDescription}
                    onChange={(e) => setAiInput({ ...aiInput, productDescription: e.target.value })}
                    placeholder="Detailed product description..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Material/Composition</Label>
                    <Input
                      value={aiInput.material}
                      onChange={(e) => setAiInput({ ...aiInput, material: e.target.value })}
                      placeholder="e.g., 100% Cotton"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intended Use</Label>
                    <Input
                      value={aiInput.intendedUse}
                      onChange={(e) => setAiInput({ ...aiInput, intendedUse: e.target.value })}
                      placeholder="e.g., Apparel, Industrial"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => aiClassifyMutation.mutate(aiInput)}
                  disabled={!aiInput.productName || !aiInput.productDescription || aiClassifyMutation.isPending}
                  className="w-full"
                >
                  {aiClassifyMutation.isPending ? "Analyzing..." : "Get AI Classification"}
                </Button>

                {aiResult && !aiResult.error && (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Suggested Classification
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm text-muted-foreground">HS Code</Label>
                          <p className="font-mono text-lg font-bold">{aiResult.hsCode}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Confidence</Label>
                          <p className="font-semibold">{aiResult.confidence}%</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Description</Label>
                        <p className="text-sm">{aiResult.description}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Estimated Duty Rate</Label>
                        <p>{aiResult.estimatedDutyRate}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Reasoning</Label>
                        <p className="text-sm text-muted-foreground">{aiResult.reasoning}</p>
                      </div>
                      {aiResult.warnings?.length > 0 && (
                        <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                          <div className="text-sm text-yellow-800">
                            {aiResult.warnings.map((w: string, i: number) => (
                              <p key={i}>{w}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setNewClassification({
                            ...newClassification,
                            hsCode: aiResult.hsCode,
                            description: aiResult.description,
                            classificationMethod: "ai_suggested",
                          });
                          setShowAiClassify(false);
                          setShowAddClassification(true);
                        }}
                      >
                        Use This Classification
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddClassification} onOpenChange={setShowAddClassification}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Classification
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Product Classification</DialogTitle>
                <DialogDescription>
                  Assign an HS code to a product or raw material
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>HS Code *</Label>
                  <Input
                    value={newClassification.hsCode}
                    onChange={(e) => setNewClassification({ ...newClassification, hsCode: e.target.value })}
                    placeholder="e.g., 6109.10.0040"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newClassification.description}
                    onChange={(e) => setNewClassification({ ...newClassification, description: e.target.value })}
                    placeholder="HS code description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country of Origin</Label>
                    <Input
                      value={newClassification.countryOfOrigin}
                      onChange={(e) => setNewClassification({ ...newClassification, countryOfOrigin: e.target.value })}
                      placeholder="e.g., CN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Classification Method</Label>
                    <Select
                      value={newClassification.classificationMethod}
                      onValueChange={(v: any) => setNewClassification({ ...newClassification, classificationMethod: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="ai_suggested">AI Suggested</SelectItem>
                        <SelectItem value="customs_ruling">Customs Ruling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newClassification.notes}
                    onChange={(e) => setNewClassification({ ...newClassification, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddClassification(false)}>Cancel</Button>
                <Button
                  onClick={() => createClassificationMutation.mutate(newClassification)}
                  disabled={!newClassification.hsCode || createClassificationMutation.isPending}
                >
                  Save Classification
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="lookup">
        <TabsList>
          <TabsTrigger value="lookup">
            <Search className="w-4 h-4 mr-2" />
            HS Code Lookup
          </TabsTrigger>
          <TabsTrigger value="classifications">
            <FileText className="w-4 h-4 mr-2" />
            Product Classifications
          </TabsTrigger>
          <TabsTrigger value="calculations">
            <Calculator className="w-4 h-4 mr-2" />
            Tariff Calculations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lookup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search HS Codes</CardTitle>
              <CardDescription>Search the harmonized system code database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by code or description..."
                  />
                </div>
                <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["hsCodes"] })}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>HS Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Duty Rate</TableHead>
                    <TableHead>Special Rate</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCodes ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : hsCodes?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {searchTerm ? "No HS codes found" : "Enter a search term to find HS codes"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    hsCodes?.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono font-medium">{code.hsCode}</TableCell>
                        <TableCell className="max-w-md truncate">{code.description}</TableCell>
                        <TableCell>{code.generalDutyRate || "-"}</TableCell>
                        <TableCell>{code.specialDutyRate || "-"}</TableCell>
                        <TableCell>{code.unitOfQuantity || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product HS Classifications</CardTitle>
              <CardDescription>View and manage product HS code assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product/Material</TableHead>
                    <TableHead>HS Code</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classifications?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No classifications yet. Add one above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    classifications?.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          {c.productId ? `Product #${c.productId}` : c.rawMaterialId ? `Material #${c.rawMaterialId}` : "-"}
                        </TableCell>
                        <TableCell className="font-mono">{c.hsCode}</TableCell>
                        <TableCell>{c.countryOfOrigin || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={c.classificationMethod === "ai_suggested" ? "secondary" : "outline"}>
                            {c.classificationMethod?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.isVerified ? (
                            <Badge variant="default" className="bg-green-500">Verified</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!c.isVerified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verifyClassificationMutation.mutate(c.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verify
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tariff Calculations</CardTitle>
              <CardDescription>View duty and tariff calculation history</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shipment/PO</TableHead>
                    <TableHead>Declared Value</TableHead>
                    <TableHead>Duty Amount</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tariffCalculations?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No tariff calculations yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    tariffCalculations?.map((calc) => (
                      <TableRow key={calc.id}>
                        <TableCell>{new Date(calc.calculationDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {calc.shipmentId ? `Shipment #${calc.shipmentId}` : calc.purchaseOrderId ? `PO #${calc.purchaseOrderId}` : "-"}
                        </TableCell>
                        <TableCell>${Number(calc.totalDeclaredValue || 0).toLocaleString()}</TableCell>
                        <TableCell>${Number(calc.totalDutyAmount || 0).toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">${Number(calc.grandTotal || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={calc.status === "paid" ? "default" : "secondary"}>
                            {calc.status}
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
      </Tabs>
    </div>
  );
}
