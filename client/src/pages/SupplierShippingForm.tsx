import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Package,
  CheckCircle,
  AlertCircle,
  Loader2,
  Truck,
  Scale,
  Box,
  FileCheck,
  Globe,
  Calendar,
  AlertTriangle,
  Ship,
} from "lucide-react";
import { toast } from "sonner";

const requiredDocuments = [
  { value: "commercial_invoice", label: "Commercial Invoice", required: true, icon: FileText },
  { value: "packing_list", label: "Packing List", required: true, icon: Package },
  { value: "certificate_of_origin", label: "Certificate of Origin", required: false, icon: Globe },
  { value: "msds_sds", label: "MSDS/SDS", required: false, icon: AlertTriangle },
  { value: "bill_of_lading", label: "Bill of Lading", required: false, icon: Ship },
  { value: "customs_declaration", label: "Customs Declaration", required: false, icon: FileCheck },
  { value: "other", label: "Other Document", required: false, icon: FileText },
];

const incotermOptions = [
  "EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP",
];

export default function SupplierShippingForm() {
  const { token } = useParams<{ token: string }>();
  const [activeTab, setActiveTab] = useState("shipping");
  const [submitted, setSubmitted] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});

  // Shipping form state
  const [shippingInfo, setShippingInfo] = useState({
    totalPackages: "",
    totalGrossWeight: "",
    totalNetWeight: "",
    weightUnit: "kg",
    totalVolume: "",
    volumeUnit: "cbm",
    preferredShipDate: "",
    preferredCarrier: "",
    incoterms: "",
    countryOfOrigin: "",
    specialInstructions: "",
    hasDangerousGoods: false,
    dangerousGoodsClass: "",
    unNumber: "",
  });

  const [packageDimensions, setPackageDimensions] = useState<Array<{
    length: string;
    width: string;
    height: string;
    weight: string;
    quantity: string;
  }>>([{ length: "", width: "", height: "", weight: "", quantity: "1" }]);

  const [hsCodes, setHsCodes] = useState<Array<{
    code: string;
    description: string;
  }>>([{ code: "", description: "" }]);

  // Query automation data
  const { data: automation, isLoading, error } = trpc.supplierInvoiceAutomation.getByToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  // Mutations
  const submitInfo = trpc.supplierInvoiceAutomation.submitShippingInfo.useMutation({
    onSuccess: (result) => {
      if (result.readyForQuote) {
        toast.success("All shipping information submitted successfully! We will arrange freight shortly.");
      } else {
        toast.success("Shipping information saved. Some items are still needed: " + result.missingFields.join(", "));
      }
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit shipping info");
    },
  });

  const uploadDocument = trpc.supplierInvoiceAutomation.uploadDocument.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Document uploaded successfully");
      setUploadedDocs(prev => ({ ...prev, [variables.documentType]: variables.fileName }));
      setUploadingType(null);
    },
    onError: (err) => {
      toast.error(err.message || "Upload failed");
      setUploadingType(null);
    },
  });

  // Pre-fill from parsed shipping data
  useEffect(() => {
    if (automation?.parsedShippingData) {
      const parsed = automation.parsedShippingData;
      setShippingInfo(prev => ({
        ...prev,
        totalGrossWeight: parsed.weight || prev.totalGrossWeight,
        totalPackages: parsed.packageCount?.toString() || prev.totalPackages,
        incoterms: parsed.incoterms || prev.incoterms,
        countryOfOrigin: parsed.countryOfOrigin || prev.countryOfOrigin,
        preferredShipDate: parsed.estimatedShipDate || prev.preferredShipDate,
        hasDangerousGoods: parsed.dangerousGoods ?? prev.hasDangerousGoods,
        specialInstructions: parsed.specialInstructions || prev.specialInstructions,
      }));
      if (parsed.hsCodes?.length) {
        setHsCodes(parsed.hsCodes.map((code: string) => ({ code, description: "" })));
      }
    }
  }, [automation?.parsedShippingData]);

  const handleFileUpload = useCallback(async (docType: string, file: File) => {
    if (!token) return;
    setUploadingType(docType);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDocument.mutate({
        token,
        documentType: docType,
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  }, [token, uploadDocument]);

  const handleSubmit = () => {
    if (!token) return;

    const dims = packageDimensions.filter(d => d.length && d.width && d.height);
    const codes = hsCodes.filter(c => c.code);

    submitInfo.mutate({
      token,
      totalPackages: shippingInfo.totalPackages ? parseInt(shippingInfo.totalPackages) : undefined,
      totalGrossWeight: shippingInfo.totalGrossWeight || undefined,
      totalNetWeight: shippingInfo.totalNetWeight || undefined,
      weightUnit: shippingInfo.weightUnit || undefined,
      totalVolume: shippingInfo.totalVolume || undefined,
      volumeUnit: shippingInfo.volumeUnit || undefined,
      packageDimensions: dims.length > 0 ? JSON.stringify(dims) : undefined,
      hsCodes: codes.length > 0 ? JSON.stringify(codes.map(c => c.code)) : undefined,
      preferredShipDate: shippingInfo.preferredShipDate || undefined,
      preferredCarrier: shippingInfo.preferredCarrier || undefined,
      incoterms: shippingInfo.incoterms || undefined,
      countryOfOrigin: shippingInfo.countryOfOrigin || undefined,
      specialInstructions: shippingInfo.specialInstructions || undefined,
      hasDangerousGoods: shippingInfo.hasDangerousGoods || undefined,
      dangerousGoodsClass: shippingInfo.hasDangerousGoods ? shippingInfo.dangerousGoodsClass || undefined : undefined,
      unNumber: shippingInfo.hasDangerousGoods ? shippingInfo.unNumber || undefined : undefined,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-500">Loading shipping form...</p>
        </div>
      </div>
    );
  }

  // Invalid/expired token
  if (error || !automation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Link Invalid or Expired</h2>
            <p className="text-gray-500 text-sm">
              This shipping information request link is no longer valid.
              Please contact your buyer for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already submitted
  if (submitted || automation.status === "info_complete" || automation.status === "freight_quoted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Thank You!</h2>
            <p className="text-gray-500 text-sm">
              Your shipping information has been received. We will proceed with arranging freight
              and will notify you with the shipping details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Truck className="h-10 w-10 text-blue-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">
            Shipping Information Request
          </h1>
          <p className="text-gray-500 mt-2">
            Please provide shipping details and customs documents for your shipment
          </p>
        </div>

        {/* Invoice Reference */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center justify-center">
              {automation.vendorName && (
                <Badge variant="outline" className="text-sm py-1 px-3">
                  Supplier: {automation.vendorName}
                </Badge>
              )}
              {automation.invoiceNumber && (
                <Badge variant="outline" className="text-sm py-1 px-3">
                  Invoice: {automation.invoiceNumber}
                </Badge>
              )}
              {automation.poNumber && (
                <Badge variant="outline" className="text-sm py-1 px-3">
                  PO: {automation.poNumber}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Form */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="shipping">
              <Package className="h-4 w-4 mr-2" />
              Shipping Details
            </TabsTrigger>
            <TabsTrigger value="customs">
              <Globe className="h-4 w-4 mr-2" />
              Customs Info
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Shipping Details */}
          <TabsContent value="shipping">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Shipment Details</CardTitle>
                <CardDescription>
                  Provide package quantities, weights, and dimensions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Packages and weight */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="totalPackages">Total Packages *</Label>
                    <Input
                      id="totalPackages"
                      type="number"
                      placeholder="e.g., 5"
                      value={shippingInfo.totalPackages}
                      onChange={e => setShippingInfo(p => ({ ...p, totalPackages: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferredShipDate">Preferred Ship Date</Label>
                    <Input
                      id="preferredShipDate"
                      type="date"
                      value={shippingInfo.preferredShipDate}
                      onChange={e => setShippingInfo(p => ({ ...p, preferredShipDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="grossWeight">Gross Weight *</Label>
                    <Input
                      id="grossWeight"
                      placeholder="e.g., 500"
                      value={shippingInfo.totalGrossWeight}
                      onChange={e => setShippingInfo(p => ({ ...p, totalGrossWeight: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="netWeight">Net Weight</Label>
                    <Input
                      id="netWeight"
                      placeholder="e.g., 450"
                      value={shippingInfo.totalNetWeight}
                      onChange={e => setShippingInfo(p => ({ ...p, totalNetWeight: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Weight Unit</Label>
                    <Select
                      value={shippingInfo.weightUnit}
                      onValueChange={v => setShippingInfo(p => ({ ...p, weightUnit: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="volume">Total Volume</Label>
                    <Input
                      id="volume"
                      placeholder="e.g., 2.5"
                      value={shippingInfo.totalVolume}
                      onChange={e => setShippingInfo(p => ({ ...p, totalVolume: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Volume Unit</Label>
                    <Select
                      value={shippingInfo.volumeUnit}
                      onValueChange={v => setShippingInfo(p => ({ ...p, volumeUnit: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cbm">CBM</SelectItem>
                        <SelectItem value="cft">CFT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Package Dimensions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-medium">Package Dimensions (cm)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPackageDimensions(p => [...p, { length: "", width: "", height: "", weight: "", quantity: "1" }])
                      }
                    >
                      + Add Package
                    </Button>
                  </div>
                  {packageDimensions.map((dim, idx) => (
                    <div key={idx} className="grid grid-cols-6 gap-2 mb-2 items-end">
                      <div>
                        <Label className="text-xs">L</Label>
                        <Input
                          placeholder="L"
                          value={dim.length}
                          onChange={e => {
                            const updated = [...packageDimensions];
                            updated[idx].length = e.target.value;
                            setPackageDimensions(updated);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">W</Label>
                        <Input
                          placeholder="W"
                          value={dim.width}
                          onChange={e => {
                            const updated = [...packageDimensions];
                            updated[idx].width = e.target.value;
                            setPackageDimensions(updated);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">H</Label>
                        <Input
                          placeholder="H"
                          value={dim.height}
                          onChange={e => {
                            const updated = [...packageDimensions];
                            updated[idx].height = e.target.value;
                            setPackageDimensions(updated);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Wt</Label>
                        <Input
                          placeholder="kg"
                          value={dim.weight}
                          onChange={e => {
                            const updated = [...packageDimensions];
                            updated[idx].weight = e.target.value;
                            setPackageDimensions(updated);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          placeholder="1"
                          value={dim.quantity}
                          onChange={e => {
                            const updated = [...packageDimensions];
                            updated[idx].quantity = e.target.value;
                            setPackageDimensions(updated);
                          }}
                        />
                      </div>
                      <div>
                        {idx > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setPackageDimensions(p => p.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="carrier">Preferred Carrier</Label>
                    <Input
                      id="carrier"
                      placeholder="e.g., DHL, Maersk"
                      value={shippingInfo.preferredCarrier}
                      onChange={e => setShippingInfo(p => ({ ...p, preferredCarrier: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Incoterms</Label>
                    <Select
                      value={shippingInfo.incoterms}
                      onValueChange={v => setShippingInfo(p => ({ ...p, incoterms: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {incotermOptions.map(term => (
                          <SelectItem key={term} value={term}>{term}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Customs Info */}
          <TabsContent value="customs">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customs Information</CardTitle>
                <CardDescription>
                  HS codes, country of origin, and regulatory details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="countryOfOrigin">Country of Origin *</Label>
                  <Input
                    id="countryOfOrigin"
                    placeholder="e.g., China, Germany, Vietnam"
                    value={shippingInfo.countryOfOrigin}
                    onChange={e => setShippingInfo(p => ({ ...p, countryOfOrigin: e.target.value }))}
                  />
                </div>

                {/* HS Codes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-medium">HS / Tariff Codes *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setHsCodes(p => [...p, { code: "", description: "" }])}
                    >
                      + Add Code
                    </Button>
                  </div>
                  {hsCodes.map((hs, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 mb-2 items-end">
                      <div className="col-span-2">
                        <Label className="text-xs">HS Code</Label>
                        <Input
                          placeholder="e.g., 8471.30.0100"
                          value={hs.code}
                          onChange={e => {
                            const updated = [...hsCodes];
                            updated[idx].code = e.target.value;
                            setHsCodes(updated);
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Description</Label>
                        <Input
                          placeholder="Product description"
                          value={hs.description}
                          onChange={e => {
                            const updated = [...hsCodes];
                            updated[idx].description = e.target.value;
                            setHsCodes(updated);
                          }}
                        />
                      </div>
                      <div>
                        {idx > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setHsCodes(p => p.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dangerous goods */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="dangerousGoods"
                      checked={shippingInfo.hasDangerousGoods}
                      onChange={e => setShippingInfo(p => ({ ...p, hasDangerousGoods: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="dangerousGoods" className="font-medium">
                      Shipment contains dangerous goods
                    </Label>
                  </div>
                  {shippingInfo.hasDangerousGoods && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                      <div>
                        <Label htmlFor="dgClass">DG Class</Label>
                        <Input
                          id="dgClass"
                          placeholder="e.g., Class 3"
                          value={shippingInfo.dangerousGoodsClass}
                          onChange={e => setShippingInfo(p => ({ ...p, dangerousGoodsClass: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="unNumber">UN Number</Label>
                        <Input
                          id="unNumber"
                          placeholder="e.g., UN1203"
                          value={shippingInfo.unNumber}
                          onChange={e => setShippingInfo(p => ({ ...p, unNumber: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Special instructions */}
                <div>
                  <Label htmlFor="instructions">Special Instructions</Label>
                  <Textarea
                    id="instructions"
                    placeholder="Any special handling, temperature requirements, stacking limits, etc."
                    rows={3}
                    value={shippingInfo.specialInstructions}
                    onChange={e => setShippingInfo(p => ({ ...p, specialInstructions: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Documents */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customs Documents</CardTitle>
                <CardDescription>
                  Upload required documents for customs clearance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {requiredDocuments.map(doc => {
                    const Icon = doc.icon;
                    const isUploaded = !!uploadedDocs[doc.value];
                    const isUploading = uploadingType === doc.value;

                    return (
                      <div
                        key={doc.value}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          isUploaded ? "bg-green-50 border-green-200" : "bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${isUploaded ? "text-green-600" : "text-gray-400"}`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {doc.label}
                              {doc.required && <span className="text-red-500 ml-1">*</span>}
                            </p>
                            {isUploaded && (
                              <p className="text-xs text-green-600">{uploadedDocs[doc.value]}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          {isUploaded ? (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Uploaded
                            </Badge>
                          ) : (
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(doc.value, file);
                                }}
                                disabled={isUploading}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isUploading}
                                asChild
                              >
                                <span>
                                  {isUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Upload className="h-4 w-4 mr-1" />
                                      Upload
                                    </>
                                  )}
                                </span>
                              </Button>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Submit Button */}
        <div className="mt-6 text-center">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitInfo.isPending}
            className="min-w-[200px]"
          >
            {submitInfo.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Shipping Information
              </>
            )}
          </Button>
          <p className="text-xs text-gray-400 mt-2">
            You can submit partial information and come back later to complete it.
          </p>
        </div>
      </div>
    </div>
  );
}
