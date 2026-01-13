import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileText, Truck, Package, AlertCircle, CheckCircle, Clock, Edit2, X, ChevronRight, History, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";

interface ParsedLineItem {
  description: string;
  sku?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
  matchedMaterialId?: number;
  matchedMaterialName?: string;
  confidence?: number;
}

interface ParsedPO {
  poNumber: string;
  vendorName: string;
  vendorEmail?: string;
  orderDate: string;
  deliveryDate?: string;
  subtotal: number;
  totalAmount: number;
  notes?: string;
  status?: string;
  lineItems: ParsedLineItem[];
  confidence: number;
}

interface ParsedFreightInvoice {
  invoiceNumber: string;
  carrierName: string;
  carrierEmail?: string;
  invoiceDate: string;
  shipmentDate?: string;
  deliveryDate?: string;
  origin?: string;
  destination?: string;
  trackingNumber?: string;
  weight?: string;
  dimensions?: string;
  freightCharges: number;
  fuelSurcharge?: number;
  accessorialCharges?: number;
  totalAmount: number;
  currency?: string;
  relatedPoNumber?: string;
  notes?: string;
  confidence: number;
}

export default function DocumentImport() {
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadType, setUploadType] = useState<"po" | "freight">("po");
  const [isUploading, setIsUploading] = useState(false);
  const [parsedPO, setParsedPO] = useState<ParsedPO | null>(null);
  const [parsedFreight, setParsedFreight] = useState<ParsedFreightInvoice | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [markAsReceived, setMarkAsReceived] = useState(true);
  const [updateInventory, setUpdateInventory] = useState(true);
  const [linkToPO, setLinkToPO] = useState(true);
  const [editingLineItem, setEditingLineItem] = useState<number | null>(null);

  const parseMutation = trpc.documentImport.parse.useMutation();
  const importPOMutation = trpc.documentImport.importPO.useMutation();
  const importFreightMutation = trpc.documentImport.importFreightInvoice.useMutation();
  const matchMaterialsMutation = trpc.documentImport.matchMaterials.useMutation();
  const historyQuery = trpc.documentImport.getHistory.useQuery({ limit: 50 });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setIsUploading(true);
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        const result = await parseMutation.mutateAsync({
          fileData: base64,
          fileName: file.name,
          mimeType: file.type,
        });
        
        if (result.documentType === "purchase_order" && result.purchaseOrder) {
          // Match line items to materials
          const matchedItems = await matchMaterialsMutation.mutateAsync({
            lineItems: result.purchaseOrder.lineItems,
          });
          
          setParsedPO({
            ...result.purchaseOrder,
            lineItems: matchedItems.map((item: any) => ({
              ...item,
              matchedMaterialId: item.rawMaterialId,
              matchedMaterialName: item.rawMaterialId ? item.description : undefined,
            })),
          });
          setUploadType("po");
        } else if (result.documentType === "freight_invoice" && result.freightInvoice) {
          setParsedFreight(result.freightInvoice);
          setUploadType("freight");
        } else {
          toast.error("Could not determine document type. Please try again or manually enter the data.");
        }
        
        setShowPreview(true);
        setIsUploading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to parse document. Please try again.");
      setIsUploading(false);
    }
  }, [parseMutation, matchMaterialsMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const handleImportPO = async () => {
    if (!parsedPO) return;
    
    try {
      const result = await importPOMutation.mutateAsync({
        poData: parsedPO,
        markAsReceived,
        updateInventory,
      });
      
      toast.success(`Purchase order ${parsedPO.poNumber} imported successfully!`);
      setParsedPO(null);
      setShowPreview(false);
      historyQuery.refetch();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import purchase order. Please try again.");
    }
  };

  const handleImportFreight = async () => {
    if (!parsedFreight) return;
    
    try {
      const result = await importFreightMutation.mutateAsync({
        invoiceData: parsedFreight,
        linkToPO,
      });
      
      toast.success(`Freight invoice ${parsedFreight.invoiceNumber} imported successfully!`);
      setParsedFreight(null);
      setShowPreview(false);
      historyQuery.refetch();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import freight invoice. Please try again.");
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    if (!parsedPO) return;
    
    const newLineItems = [...parsedPO.lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };
    setParsedPO({ ...parsedPO, lineItems: newLineItems });
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Import</h1>
          <p className="text-muted-foreground">
            Upload purchase orders and freight invoices to import into inventory and history
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Import History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Upload Area */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>
                  Drag and drop or click to upload a purchase order or freight invoice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Processing document...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {isDragActive ? "Drop the file here" : "Drag & drop a file here, or click to select"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supports PDF, images, Excel, and CSV files
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Purchase Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {historyQuery.data?.filter(h => h.documentType === "purchase_order").length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Documents imported</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Freight Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {historyQuery.data?.filter(h => h.documentType === "freight_invoice").length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Documents imported</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Supported Document Types */}
          <Card>
            <CardHeader>
              <CardTitle>Supported Document Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3 p-4 rounded-lg border">
                  <Package className="h-8 w-8 text-blue-500" />
                  <div>
                    <h3 className="font-medium">Purchase Orders</h3>
                    <p className="text-sm text-muted-foreground">
                      Import POs to create vendor records, track orders, and update inventory when received
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">Auto-create vendors</Badge>
                      <Badge variant="secondary">Match materials</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg border">
                  <Truck className="h-8 w-8 text-green-500" />
                  <div>
                    <h3 className="font-medium">Freight Invoices</h3>
                    <p className="text-sm text-muted-foreground">
                      Import freight invoices to track shipping costs and link to related purchase orders
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">Auto-link to PO</Badge>
                      <Badge variant="secondary">Cost tracking</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                Recent document imports and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : historyQuery.data?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents imported yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records Created</TableHead>
                      <TableHead>Imported</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyQuery.data?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.fileName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.documentType === "purchase_order" ? "default" : "secondary"}>
                            {log.documentType === "purchase_order" ? "Purchase Order" : "Freight Invoice"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === "completed" ? "default" : log.status === "failed" ? "destructive" : "secondary"}>
                            {log.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {log.status === "failed" && <AlertCircle className="h-3 w-3 mr-1" />}
                            {log.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.recordsCreated || 0} created, {log.recordsUpdated || 0} updated
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString()}
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

      {/* PO Preview Dialog */}
      <Dialog open={showPreview && uploadType === "po" && !!parsedPO} onOpenChange={(open) => !open && setShowPreview(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Purchase Order</DialogTitle>
            <DialogDescription>
              Review and edit the extracted data before importing
            </DialogDescription>
          </DialogHeader>
          
          {parsedPO && (
            <div className="space-y-6">
              {/* Confidence Score */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Extraction Confidence:</span>
                <Badge variant={parsedPO.confidence > 0.8 ? "default" : parsedPO.confidence > 0.6 ? "secondary" : "destructive"}>
                  {Math.round(parsedPO.confidence * 100)}%
                </Badge>
              </div>

              {/* PO Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>PO Number</Label>
                  <Input 
                    value={parsedPO.poNumber} 
                    onChange={(e) => setParsedPO({ ...parsedPO, poNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Vendor Name</Label>
                  <Input 
                    value={parsedPO.vendorName} 
                    onChange={(e) => setParsedPO({ ...parsedPO, vendorName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Order Date</Label>
                  <Input 
                    type="date" 
                    value={parsedPO.orderDate} 
                    onChange={(e) => setParsedPO({ ...parsedPO, orderDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Delivery Date</Label>
                  <Input 
                    type="date" 
                    value={parsedPO.deliveryDate || ""} 
                    onChange={(e) => setParsedPO({ ...parsedPO, deliveryDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <Label className="mb-2 block">Line Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Matched Material</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedPO.lineItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {editingLineItem === index ? (
                            <Input 
                              value={item.description} 
                              onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              className="h-8"
                            />
                          ) : (
                            item.description
                          )}
                        </TableCell>
                        <TableCell>
                          {editingLineItem === index ? (
                            <Input 
                              value={item.sku || ""} 
                              onChange={(e) => updateLineItem(index, "sku", e.target.value)}
                              className="h-8 w-24"
                            />
                          ) : (
                            item.sku || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {editingLineItem === index ? (
                            <Input 
                              type="number"
                              value={item.quantity} 
                              onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value))}
                              className="h-8 w-20"
                            />
                          ) : (
                            item.quantity
                          )}
                        </TableCell>
                        <TableCell>
                          {editingLineItem === index ? (
                            <Input 
                              type="number"
                              value={item.unitPrice} 
                              onChange={(e) => updateLineItem(index, "unitPrice", parseFloat(e.target.value))}
                              className="h-8 w-24"
                            />
                          ) : (
                            `$${item.unitPrice.toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell>${item.totalPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          {item.matchedMaterialName ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {item.matchedMaterialName}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              No match
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingLineItem(editingLineItem === index ? null : index)}
                          >
                            {editingLineItem === index ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="space-y-1 text-right">
                  <div className="text-sm">
                    Subtotal: <span className="font-medium">${parsedPO.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="text-lg font-bold">
                    Total: ${parsedPO.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Import Options */}
              <div className="space-y-3 border-t pt-4">
                <Label>Import Options</Label>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="markReceived" 
                    checked={markAsReceived} 
                    onCheckedChange={(checked) => setMarkAsReceived(!!checked)}
                  />
                  <label htmlFor="markReceived" className="text-sm">
                    Mark as received (historical import)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="updateInventory" 
                    checked={updateInventory} 
                    onCheckedChange={(checked) => setUpdateInventory(!!checked)}
                  />
                  <label htmlFor="updateInventory" className="text-sm">
                    Update inventory quantities
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportPO} disabled={importPOMutation.isPending}>
              {importPOMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Freight Invoice Preview Dialog */}
      <Dialog open={showPreview && uploadType === "freight" && !!parsedFreight} onOpenChange={(open) => !open && setShowPreview(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Freight Invoice</DialogTitle>
            <DialogDescription>
              Review and edit the extracted data before importing
            </DialogDescription>
          </DialogHeader>
          
          {parsedFreight && (
            <div className="space-y-6">
              {/* Confidence Score */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Extraction Confidence:</span>
                <Badge variant={parsedFreight.confidence > 0.8 ? "default" : parsedFreight.confidence > 0.6 ? "secondary" : "destructive"}>
                  {Math.round(parsedFreight.confidence * 100)}%
                </Badge>
              </div>

              {/* Invoice Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Invoice Number</Label>
                  <Input 
                    value={parsedFreight.invoiceNumber} 
                    onChange={(e) => setParsedFreight({ ...parsedFreight, invoiceNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Carrier Name</Label>
                  <Input 
                    value={parsedFreight.carrierName} 
                    onChange={(e) => setParsedFreight({ ...parsedFreight, carrierName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Invoice Date</Label>
                  <Input 
                    type="date" 
                    value={parsedFreight.invoiceDate} 
                    onChange={(e) => setParsedFreight({ ...parsedFreight, invoiceDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Shipment Date</Label>
                  <Input 
                    type="date" 
                    value={parsedFreight.shipmentDate || ""} 
                    onChange={(e) => setParsedFreight({ ...parsedFreight, shipmentDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Origin</Label>
                  <Input 
                    value={parsedFreight.origin || ""} 
                    onChange={(e) => setParsedFreight({ ...parsedFreight, origin: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Destination</Label>
                  <Input 
                    value={parsedFreight.destination || ""} 
                    onChange={(e) => setParsedFreight({ ...parsedFreight, destination: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tracking Number</Label>
                  <Input 
                    value={parsedFreight.trackingNumber || ""} 
                    onChange={(e) => setParsedFreight({ ...parsedFreight, trackingNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Related PO Number</Label>
                  <Input 
                    value={parsedFreight.relatedPoNumber || ""} 
                    onChange={(e) => setParsedFreight({ ...parsedFreight, relatedPoNumber: e.target.value })}
                  />
                </div>
              </div>

              {/* Charges */}
              <div className="space-y-3">
                <Label>Charges</Label>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Freight Charges</Label>
                    <Input 
                      type="number"
                      value={parsedFreight.freightCharges} 
                      onChange={(e) => setParsedFreight({ ...parsedFreight, freightCharges: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fuel Surcharge</Label>
                    <Input 
                      type="number"
                      value={parsedFreight.fuelSurcharge || 0} 
                      onChange={(e) => setParsedFreight({ ...parsedFreight, fuelSurcharge: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Accessorial</Label>
                    <Input 
                      type="number"
                      value={parsedFreight.accessorialCharges || 0} 
                      onChange={(e) => setParsedFreight({ ...parsedFreight, accessorialCharges: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="text-right text-lg font-bold">
                  Total: ${parsedFreight.totalAmount.toFixed(2)}
                </div>
              </div>

              {/* Import Options */}
              <div className="space-y-3 border-t pt-4">
                <Label>Import Options</Label>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="linkToPO" 
                    checked={linkToPO} 
                    onCheckedChange={(checked) => setLinkToPO(!!checked)}
                  />
                  <label htmlFor="linkToPO" className="text-sm">
                    Link to related purchase order (if found)
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportFreight} disabled={importFreightMutation.isPending}>
              {importFreightMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import Freight Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
