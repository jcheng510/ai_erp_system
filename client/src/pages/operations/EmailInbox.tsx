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
  Archive,
  Ship,
  CreditCard,
  ShoppingCart,
  FileCheck,
  Tag,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle
} from "lucide-react";

// Category display configuration
const categoryConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  receipt: { label: "Receipt", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: <Receipt className="h-3 w-3" /> },
  purchase_order: { label: "Purchase Order", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: <Package className="h-3 w-3" /> },
  invoice: { label: "Invoice", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: <FileText className="h-3 w-3" /> },
  shipping_confirmation: { label: "Shipping", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: <Truck className="h-3 w-3" /> },
  freight_quote: { label: "Freight Quote", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200", icon: <Ship className="h-3 w-3" /> },
  delivery_notification: { label: "Delivery", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  order_confirmation: { label: "Order Confirm", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", icon: <ShoppingCart className="h-3 w-3" /> },
  payment_confirmation: { label: "Payment", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200", icon: <CreditCard className="h-3 w-3" /> },
  general: { label: "General", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: <Mail className="h-3 w-3" /> },
};

// Priority display configuration
const priorityConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  high: { label: "High", color: "text-red-600", icon: <ArrowUpCircle className="h-3 w-3" /> },
  medium: { label: "Medium", color: "text-yellow-600", icon: <MinusCircle className="h-3 w-3" /> },
  low: { label: "Low", color: "text-green-600", icon: <ArrowDownCircle className="h-3 w-3" /> },
};

export default function EmailInbox() {
  const [activeTab, setActiveTab] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState<number | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
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

  // Build query params for email list
  const emailQueryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(categoryFilter !== "all" && { category: categoryFilter }),
    ...(priorityFilter !== "all" && { priority: priorityFilter }),
  };

  // Queries
  const { data: emails, isLoading: emailsLoading } = trpc.emailScanning.list.useQuery(
    Object.keys(emailQueryParams).length > 0 ? emailQueryParams : undefined
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
  const { data: categoryStats } = trpc.emailScanning.getCategoryStats.useQuery();

  // Mutations
  const submitEmailMutation = trpc.emailScanning.submitEmail.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Email parsed successfully! Found ${result.documents.length} document(s)`);
        setShowSubmitDialog(false);
        setEmailForm({ fromEmail: "", fromName: "", subject: "", bodyText: "" });
        utils.emailScanning.list.invalidate();
        utils.emailScanning.getStats.invalidate();
        utils.emailScanning.getCategoryStats.invalidate();
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
        utils.emailScanning.getCategoryStats.invalidate();
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

  const getCategoryBadge = (category: string | null) => {
    const config = categoryConfig[category || "general"] || categoryConfig.general;
    return (
      <Badge variant="outline" className={`gap-1 ${config.color}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getPriorityIndicator = (priority: string | null) => {
    const config = priorityConfig[priority || "medium"] || priorityConfig.medium;
    return (
      <span className={`flex items-center gap-1 text-xs ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
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
        return <Ship className="h-4 w-4" />;
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
              Scan emails for receipts, invoices, and shipping documents with AI auto-categorization
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
                  Paste or forward an email to extract receipts, invoices, and shipping information. 
                  The AI will automatically categorize the email.
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
        <div className="grid gap-4 md:grid-cols-5">
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
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
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
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.parsed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {categoryStats?.priorities?.find(p => p.priority === "high")?.count || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Distribution */}
        {categoryStats && categoryStats.categories && categoryStats.categories.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Email Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categoryStats.categories.map((cat) => {
                  const config = categoryConfig[cat.category] || categoryConfig.general;
                  return (
                    <Badge 
                      key={cat.category} 
                      variant="outline" 
                      className={`gap-1 cursor-pointer hover:opacity-80 ${config.color} ${
                        categoryFilter === cat.category ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setCategoryFilter(categoryFilter === cat.category ? "all" : cat.category)}
                    >
                      {config.icon}
                      {config.label}: {cat.count}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="purchase_order">Purchase Order</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="shipping_confirmation">Shipping</SelectItem>
                  <SelectItem value="freight_quote">Freight Quote</SelectItem>
                  <SelectItem value="delivery_notification">Delivery</SelectItem>
                  <SelectItem value="order_confirmation">Order Confirm</SelectItem>
                  <SelectItem value="payment_confirmation">Payment</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setCategoryFilter("all");
                  setPriorityFilter("all");
                }}
              >
                Clear Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  utils.emailScanning.list.invalidate();
                  utils.emailScanning.getCategoryStats.invalidate();
                }}
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
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {emails?.map((email: any) => (
                        <div
                          key={email.id}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                            selectedEmail === email.id ? "border-primary bg-accent" : ""
                          }`}
                          onClick={() => setSelectedEmail(email.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{email.subject || "(No subject)"}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {email.fromName || email.fromEmail}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {getStatusBadge(email.parsingStatus)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              {getCategoryBadge(email.category)}
                              {getPriorityIndicator(email.priority)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(email.receivedAt).toLocaleString()}
                            </p>
                          </div>
                          {email.categoryConfidence && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                Confidence: {Math.round(Number(email.categoryConfidence))}%
                              </span>
                              {email.categoryKeywords && Array.isArray(email.categoryKeywords) && email.categoryKeywords.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  • Keywords: {email.categoryKeywords.slice(0, 3).join(", ")}
                                </span>
                              )}
                            </div>
                          )}
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
                  <CardDescription>
                    {selectedEmail ? "View email content and parsed documents" : "Select an email to view details"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedEmail ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select an email from the list</p>
                    </div>
                  ) : !emailDetail ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-muted-foreground">From</Label>
                          {getStatusBadge(emailDetail.parsingStatus)}
                        </div>
                        <p className="font-medium">
                          {emailDetail.fromName ? `${emailDetail.fromName} <${emailDetail.fromEmail}>` : emailDetail.fromEmail}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Subject</Label>
                        <p className="font-medium">{emailDetail.subject || "(No subject)"}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Category</Label>
                        <div className="flex items-center gap-2">
                          {getCategoryBadge(emailDetail.category)}
                          {getPriorityIndicator(emailDetail.priority)}
                          {emailDetail.categoryConfidence && (
                            <span className="text-xs text-muted-foreground">
                              ({Math.round(Number(emailDetail.categoryConfidence))}% confidence)
                            </span>
                          )}
                        </div>
                        {emailDetail.suggestedAction && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Suggested: {emailDetail.suggestedAction}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Received</Label>
                        <p>{new Date(emailDetail.receivedAt).toLocaleString()}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Body</Label>
                        <div className="max-h-48 overflow-y-auto p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                          {emailDetail.bodyText || "(No content)"}
                        </div>
                      </div>

                      {/* Parsed Documents */}
                      {emailDetail.documents && emailDetail.documents.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Parsed Documents ({emailDetail.documents.length})</Label>
                          <div className="space-y-2">
                            {emailDetail.documents.map((doc: any) => (
                              <div key={doc.id} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {getDocumentTypeIcon(doc.documentType)}
                                    <span className="font-medium capitalize">{doc.documentType.replace(/_/g, " ")}</span>
                                  </div>
                                  <Badge variant={doc.isApproved ? "default" : "outline"}>
                                    {doc.isApproved ? "Approved" : doc.isReviewed ? "Reviewed" : "Pending Review"}
                                  </Badge>
                                </div>
                                {doc.vendorName && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Vendor: {doc.vendorName}
                                  </p>
                                )}
                                {doc.totalAmount && (
                                  <p className="text-sm text-muted-foreground">
                                    Amount: ${Number(doc.totalAmount).toFixed(2)} {doc.currency || "USD"}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
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
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="purchase_order">Purchase Order</SelectItem>
                  <SelectItem value="freight_quote">Freight Quote</SelectItem>
                  <SelectItem value="bill_of_lading">Bill of Lading</SelectItem>
                  <SelectItem value="packing_list">Packing List</SelectItem>
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

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Document List */}
              <Card>
                <CardHeader>
                  <CardTitle>Parsed Documents</CardTitle>
                  <CardDescription>
                    {documents?.length || 0} document(s) extracted
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
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {documents?.map((doc: any) => (
                        <div
                          key={doc.id}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                            selectedDocument === doc.id ? "border-primary bg-accent" : ""
                          }`}
                          onClick={() => setSelectedDocument(doc.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {getDocumentTypeIcon(doc.documentType)}
                              <div>
                                <p className="font-medium capitalize">{doc.documentType.replace(/_/g, " ")}</p>
                                <p className="text-sm text-muted-foreground">
                                  {doc.vendorName || "Unknown vendor"}
                                </p>
                              </div>
                            </div>
                            <Badge variant={doc.isApproved ? "default" : doc.isReviewed ? "secondary" : "outline"}>
                              {doc.isApproved ? "Approved" : doc.isReviewed ? "Reviewed" : "Pending"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                            <span>{doc.documentNumber || "No ref"}</span>
                            <span>
                              {doc.totalAmount ? `$${Number(doc.totalAmount).toFixed(2)}` : "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Document Detail */}
              <Card>
                <CardHeader>
                  <CardTitle>Document Details</CardTitle>
                  <CardDescription>
                    {selectedDocument ? "Review and approve document" : "Select a document to view details"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedDocument ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a document from the list</p>
                    </div>
                  ) : !documentDetail ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getDocumentTypeIcon(documentDetail.documentType)}
                          <span className="font-medium capitalize text-lg">
                            {documentDetail.documentType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <Badge variant={documentDetail.isApproved ? "default" : "outline"}>
                          {documentDetail.isApproved ? "Approved" : documentDetail.isReviewed ? "Reviewed" : "Pending Review"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Vendor</Label>
                          <p className="font-medium">{documentDetail.vendorName || "-"}</p>
                          {documentDetail.vendorEmail && (
                            <p className="text-sm text-muted-foreground">{documentDetail.vendorEmail}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Document #</Label>
                          <p className="font-medium">{documentDetail.documentNumber || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Date</Label>
                          <p className="font-medium">
                            {documentDetail.documentDate 
                              ? new Date(documentDetail.documentDate).toLocaleDateString() 
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Total Amount</Label>
                          <p className="font-medium text-lg">
                            {documentDetail.totalAmount 
                              ? `$${Number(documentDetail.totalAmount).toFixed(2)} ${documentDetail.currency || "USD"}`
                              : "-"}
                          </p>
                        </div>
                      </div>

                      {documentDetail.trackingNumber && (
                        <div>
                          <Label className="text-muted-foreground">Tracking</Label>
                          <p className="font-medium">{documentDetail.trackingNumber}</p>
                          {documentDetail.carrierName && (
                            <p className="text-sm text-muted-foreground">{documentDetail.carrierName}</p>
                          )}
                        </div>
                      )}

                      {/* Line Items */}
                      {documentDetail.lineItems && documentDetail.lineItems.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Line Items</Label>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="text-left p-2">Description</th>
                                  <th className="text-right p-2">Qty</th>
                                  <th className="text-right p-2">Price</th>
                                  <th className="text-right p-2">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {documentDetail.lineItems.map((item: any, idx: number) => (
                                  <tr key={idx} className="border-t">
                                    <td className="p-2">{item.description}</td>
                                    <td className="text-right p-2">{item.quantity || "-"}</td>
                                    <td className="text-right p-2">
                                      {item.unitPrice ? `$${Number(item.unitPrice).toFixed(2)}` : "-"}
                                    </td>
                                    <td className="text-right p-2">
                                      {item.totalPrice ? `$${Number(item.totalPrice).toFixed(2)}` : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Confidence */}
                      <div>
                        <Label className="text-muted-foreground">Extraction Confidence</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${documentDetail.confidence || 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{Math.round(Number(documentDetail.confidence) || 0)}%</span>
                        </div>
                      </div>

                      {/* Actions */}
                      {!documentDetail.isApproved && (
                        <div className="pt-4 space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="createVendor"
                                checked={approvalOptions.createVendor}
                                onCheckedChange={(checked) => 
                                  setApprovalOptions({ ...approvalOptions, createVendor: !!checked })
                                }
                                disabled={!!documentDetail.vendorId}
                              />
                              <Label htmlFor="createVendor" className="text-sm">
                                Create new vendor from this document
                                {documentDetail.vendorId && " (already linked)"}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="createTransaction"
                                checked={approvalOptions.createTransaction}
                                onCheckedChange={(checked) => 
                                  setApprovalOptions({ ...approvalOptions, createTransaction: !!checked })
                                }
                              />
                              <Label htmlFor="createTransaction" className="text-sm">
                                Create expense transaction
                              </Label>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              onClick={handleApproveDocument}
                              disabled={approveDocumentMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => rejectDocumentMutation.mutate({ id: selectedDocument })}
                              disabled={rejectDocumentMutation.isPending}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
