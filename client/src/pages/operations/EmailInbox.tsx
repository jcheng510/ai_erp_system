import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Mail, 
  FileText, 
  Plus, 
  RefreshCw, 
  Check, 
  X, 
  Eye,
  Building2,
  Receipt,
  Truck,
  Package,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Archive
} from "lucide-react";

export default function EmailInbox() {
  const [activeTab, setActiveTab] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState<number | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>("all");

  // Form state for manual email submission
  const [emailForm, setEmailForm] = useState({
    fromEmail: "",
    fromName: "",
    subject: "",
    bodyText: "",
  });

  // Approval options
  const [approvalOptions, setApprovalOptions] = useState({
    createVendor: false,
    createTransaction: false,
  });

  const utils = trpc.useUtils();

  // Queries
  const { data: emails, isLoading: emailsLoading } = trpc.emailScanning.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  
  const { data: emailDetail } = trpc.emailScanning.getById.useQuery(
    { id: selectedEmail! },
    { enabled: !!selectedEmail }
  );

  const { data: documents, isLoading: documentsLoading } = trpc.emailScanning.getDocuments.useQuery(
    documentTypeFilter !== "all" ? { documentType: documentTypeFilter } : undefined
  );

  const { data: documentDetail } = trpc.emailScanning.getDocument.useQuery(
    { id: selectedDocument! },
    { enabled: !!selectedDocument }
  );

  const { data: stats } = trpc.emailScanning.getStats.useQuery();

  // Mutations
  const submitEmailMutation = trpc.emailScanning.submitEmail.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Email parsed successfully! Found ${result.documents.length} document(s)`);
        setShowSubmitDialog(false);
        setEmailForm({ fromEmail: "", fromName: "", subject: "", bodyText: "" });
        utils.emailScanning.list.invalidate();
        utils.emailScanning.getStats.invalidate();
      } else {
        toast.error(`Parsing failed: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const approveDocumentMutation = trpc.emailScanning.approveDocument.useMutation({
    onSuccess: () => {
      toast.success("Document approved successfully");
      setShowApproveDialog(false);
      setSelectedDocument(null);
      utils.emailScanning.getDocuments.invalidate();
      utils.emailScanning.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const rejectDocumentMutation = trpc.emailScanning.rejectDocument.useMutation({
    onSuccess: () => {
      toast.success("Document rejected");
      setSelectedDocument(null);
      utils.emailScanning.getDocuments.invalidate();
      utils.emailScanning.getStats.invalidate();
    },
  });

  const reparseEmailMutation = trpc.emailScanning.reparseEmail.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Reparsed successfully! Found ${result.documentsFound} document(s)`);
        utils.emailScanning.list.invalidate();
        utils.emailScanning.getDocuments.invalidate();
      } else {
        toast.error(`Reparse failed: ${result.error}`);
      }
    },
  });

  const archiveEmailMutation = trpc.emailScanning.archiveEmail.useMutation({
    onSuccess: () => {
      toast.success("Email archived");
      setSelectedEmail(null);
      utils.emailScanning.list.invalidate();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "processing":
        return <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case "parsed":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Parsed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case "archived":
        return <Badge variant="outline" className="gap-1"><Archive className="h-3 w-3" /> Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case "receipt":
        return <Receipt className="h-4 w-4" />;
      case "invoice":
        return <FileText className="h-4 w-4" />;
      case "purchase_order":
        return <Package className="h-4 w-4" />;
      case "shipping_notice":
        return <Truck className="h-4 w-4" />;
      case "freight_quote":
        return <Truck className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const handleSubmitEmail = () => {
    if (!emailForm.fromEmail || !emailForm.subject || !emailForm.bodyText) {
      toast.error("Please fill in all required fields");
      return;
    }
    submitEmailMutation.mutate(emailForm);
  };

  const handleApproveDocument = () => {
    if (!selectedDocument) return;
    approveDocumentMutation.mutate({
      id: selectedDocument,
      createVendor: approvalOptions.createVendor,
      createTransaction: approvalOptions.createTransaction,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Email Inbox</h1>
            <p className="text-muted-foreground">
              Scan emails for receipts, invoices, and shipping documents
            </p>
          </div>
          <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Submit Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Submit Email for Parsing</DialogTitle>
                <DialogDescription>
                  Paste or forward an email to extract receipts, invoices, and shipping information
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromEmail">From Email *</Label>
                    <Input
                      id="fromEmail"
                      type="email"
                      placeholder="vendor@example.com"
                      value={emailForm.fromEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromName">From Name</Label>
                    <Input
                      id="fromName"
                      placeholder="Vendor Name"
                      value={emailForm.fromName}
                      onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    placeholder="Invoice #12345 from ABC Supplies"
                    value={emailForm.subject}
                    onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bodyText">Email Body *</Label>
                  <Textarea
                    id="bodyText"
                    placeholder="Paste the email content here..."
                    rows={10}
                    value={emailForm.bodyText}
                    onChange={(e) => setEmailForm({ ...emailForm, bodyText: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitEmail} disabled={submitEmailMutation.isPending}>
                  {submitEmailMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Parse Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Parsed Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.documents || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Parsed</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.parsed || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbox" className="gap-2">
              <Mail className="h-4 w-4" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Parsed Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="parsed">Parsed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => utils.emailScanning.list.invalidate()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Email List */}
              <Card>
                <CardHeader>
                  <CardTitle>Emails</CardTitle>
                  <CardDescription>
                    {emails?.length || 0} email(s) in inbox
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {emailsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : emails?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No emails yet</p>
                      <p className="text-sm">Submit an email to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {emails?.map((email) => (
                        <div
                          key={email.id}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                            selectedEmail === email.id ? "border-primary bg-accent" : ""
                          }`}
                          onClick={() => setSelectedEmail(email.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{email.subject || "(No subject)"}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {email.fromName || email.fromEmail}
                              </p>
                            </div>
                            {getStatusBadge(email.parsingStatus)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(email.receivedAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Detail */}
              <Card>
                <CardHeader>
                  <CardTitle>Email Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedEmail ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select an email to view details</p>
                    </div>
                  ) : !emailDetail ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">From</Label>
                        <p className="font-medium">
                          {emailDetail.fromName && `${emailDetail.fromName} <`}
                          {emailDetail.fromEmail}
                          {emailDetail.fromName && `>`}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Subject</Label>
                        <p className="font-medium">{emailDetail.subject || "(No subject)"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <div className="mt-1">{getStatusBadge(emailDetail.parsingStatus)}</div>
                      </div>
                      {emailDetail.parsingStatus === 'failed' && (
                        <div>
                          <Label className="text-muted-foreground">Status</Label>
                          <p className="text-sm text-destructive">Parsing failed</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground">Body Preview</Label>
                        <div className="mt-1 p-3 bg-muted rounded-md text-sm max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {emailDetail.bodyText?.slice(0, 500)}
                          {(emailDetail.bodyText?.length || 0) > 500 && "..."}
                        </div>
                      </div>

                      {/* Parsed Documents from this email */}
                      {emailDetail.documents && emailDetail.documents.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Parsed Documents</Label>
                          <div className="mt-2 space-y-2">
                            {emailDetail.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 border rounded"
                              >
                                <div className="flex items-center gap-2">
                                  {getDocumentTypeIcon(doc.documentType)}
                                  <span className="capitalize">{doc.documentType.replace("_", " ")}</span>
                                  {doc.documentNumber && (
                                    <span className="text-muted-foreground">#{doc.documentNumber}</span>
                                  )}
                                </div>
                                <Badge variant={doc.isApproved ? "default" : "outline"}>
                                  {doc.isApproved ? "Approved" : "Pending"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reparseEmailMutation.mutate({ id: selectedEmail })}
                          disabled={reparseEmailMutation.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${reparseEmailMutation.isPending ? "animate-spin" : ""}`} />
                          Reparse
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => archiveEmailMutation.mutate({ id: selectedEmail })}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="receipt">Receipts</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                  <SelectItem value="purchase_order">Purchase Orders</SelectItem>
                  <SelectItem value="shipping_notice">Shipping Notices</SelectItem>
                  <SelectItem value="freight_quote">Freight Quotes</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => utils.emailScanning.getDocuments.invalidate()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Parsed Documents</CardTitle>
                <CardDescription>
                  Review and approve extracted documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : documents?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No documents yet</p>
                    <p className="text-sm">Submit emails to extract documents</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Document #</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents?.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getDocumentTypeIcon(doc.documentType)}
                              <span className="capitalize">{doc.documentType.replace("_", " ")}</span>
                            </div>
                          </TableCell>
                          <TableCell>{doc.documentNumber || "-"}</TableCell>
                          <TableCell>
                            <div>
                              <p>{doc.vendorName || "-"}</p>
                              {doc.vendorId && (
                                <Badge variant="outline" className="text-xs">Linked</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {doc.totalAmount ? `$${parseFloat(doc.totalAmount).toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>
                            {doc.documentDate
                              ? new Date(doc.documentDate).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {doc.isApproved ? (
                              <Badge variant="default" className="bg-green-600">Approved</Badge>
                            ) : doc.isReviewed ? (
                              <Badge variant="destructive">Rejected</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDocument(doc.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!doc.isReviewed && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600"
                                    onClick={() => {
                                      setSelectedDocument(doc.id);
                                      setShowApproveDialog(true);
                                    }}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => rejectDocumentMutation.mutate({ id: doc.id })}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Document Detail Dialog */}
            <Dialog open={!!selectedDocument && !showApproveDialog} onOpenChange={(open) => !open && setSelectedDocument(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Document Details</DialogTitle>
                </DialogHeader>
                {documentDetail && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Type</Label>
                        <p className="font-medium capitalize">{documentDetail.documentType.replace("_", " ")}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Document Number</Label>
                        <p className="font-medium">{documentDetail.documentNumber || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Vendor</Label>
                        <p className="font-medium">{documentDetail.vendorName || "-"}</p>
                        {documentDetail.vendorEmail && (
                          <p className="text-sm text-muted-foreground">{documentDetail.vendorEmail}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Total Amount</Label>
                        <p className="font-medium">
                          {documentDetail.totalAmount
                            ? `${documentDetail.currency || "$"}${parseFloat(documentDetail.totalAmount).toFixed(2)}`
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Document Date</Label>
                        <p className="font-medium">
                          {documentDetail.documentDate
                            ? new Date(documentDetail.documentDate).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Confidence</Label>
                        <p className="font-medium">
                          {documentDetail.confidence
                            ? `${(parseFloat(documentDetail.confidence) * 100).toFixed(0)}%`
                            : "-"}
                        </p>
                      </div>
                    </div>

                    {documentDetail.trackingNumber && (
                      <div>
                        <Label className="text-muted-foreground">Tracking</Label>
                        <p className="font-medium">
                          {documentDetail.carrierName && `${documentDetail.carrierName}: `}
                          {documentDetail.trackingNumber}
                        </p>
                      </div>
                    )}

                    {documentDetail.lineItems && documentDetail.lineItems.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Line Items</Label>
                        <Table className="mt-2">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>SKU</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {documentDetail.lineItems.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{item.description || "-"}</TableCell>
                                <TableCell>{item.sku || "-"}</TableCell>
                                <TableCell>{item.quantity || "-"}</TableCell>
                                <TableCell>
                                  {item.unitPrice ? `$${parseFloat(item.unitPrice).toFixed(2)}` : "-"}
                                </TableCell>
                                <TableCell>
                                  {item.totalPrice ? `$${parseFloat(item.totalPrice).toFixed(2)}` : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedDocument(null)}>
                    Close
                  </Button>
                  {documentDetail && !documentDetail.isReviewed && (
                    <Button onClick={() => setShowApproveDialog(true)}>
                      Approve
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Approve Dialog */}
            <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve Document</DialogTitle>
                  <DialogDescription>
                    Select options for approving this document
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {documentDetail && !documentDetail.vendorId && documentDetail.vendorName && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="createVendor"
                        checked={approvalOptions.createVendor}
                        onCheckedChange={(checked) =>
                          setApprovalOptions({ ...approvalOptions, createVendor: !!checked })
                        }
                      />
                      <Label htmlFor="createVendor" className="cursor-pointer">
                        Create new vendor: <strong>{documentDetail.vendorName}</strong>
                      </Label>
                    </div>
                  )}
                  {documentDetail && documentDetail.totalAmount && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="createTransaction"
                        checked={approvalOptions.createTransaction}
                        onCheckedChange={(checked) =>
                          setApprovalOptions({ ...approvalOptions, createTransaction: !!checked })
                        }
                      />
                      <Label htmlFor="createTransaction" className="cursor-pointer">
                        Create expense transaction for{" "}
                        <strong>${parseFloat(documentDetail.totalAmount).toFixed(2)}</strong>
                      </Label>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleApproveDocument} disabled={approveDocumentMutation.isPending}>
                    {approveDocumentMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
