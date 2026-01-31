import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FolderOpen,
  RefreshCw,
  FileText,
  Upload,
  Settings,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Inbox,
  Filter,
  Play,
  Eye,
  HardDrive,
  Cloud,
  Building2,
  Truck,
  FileCheck,
  Ban,
  UserCheck,
  Plus,
  Trash2,
  Mail,
  Paperclip
} from "lucide-react";

// Filing status configuration
const filingStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: <Clock className="h-3 w-3" /> },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
  filed: { label: "Filed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: <CheckCircle className="h-3 w-3" /> },
  failed: { label: "Failed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: <XCircle className="h-3 w-3" /> },
  skipped: { label: "Skipped", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: <AlertCircle className="h-3 w-3" /> },
};

// Document category configuration
const categoryConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  invoice: { label: "Invoice", icon: <FileText className="h-4 w-4" /> },
  receipt: { label: "Receipt", icon: <FileCheck className="h-4 w-4" /> },
  purchase_order: { label: "Purchase Order", icon: <FileText className="h-4 w-4" /> },
  packing_slip: { label: "Packing Slip", icon: <FileText className="h-4 w-4" /> },
  bill_of_lading: { label: "Bill of Lading", icon: <Truck className="h-4 w-4" /> },
  customs_document: { label: "Customs Document", icon: <Building2 className="h-4 w-4" /> },
  certificate_of_origin: { label: "Certificate of Origin", icon: <FileCheck className="h-4 w-4" /> },
  freight_quote: { label: "Freight Quote", icon: <Truck className="h-4 w-4" /> },
  shipping_label: { label: "Shipping Label", icon: <Truck className="h-4 w-4" /> },
  contract: { label: "Contract", icon: <FileText className="h-4 w-4" /> },
  correspondence: { label: "Correspondence", icon: <Mail className="h-4 w-4" /> },
  other: { label: "Other", icon: <FileText className="h-4 w-4" /> },
};

// Destination type configuration
const destinationConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  data_room: { label: "Data Room", icon: <HardDrive className="h-4 w-4" /> },
  google_drive: { label: "Google Drive", icon: <Cloud className="h-4 w-4" /> },
  vendor_folder: { label: "Vendor Folder", icon: <Building2 className="h-4 w-4" /> },
  customs: { label: "Customs", icon: <FileCheck className="h-4 w-4" /> },
  pending: { label: "Pending", icon: <Clock className="h-4 w-4" /> },
};

// Classification type configuration
const classificationConfig: Record<string, { label: string; color: string }> = {
  legitimate: { label: "Legitimate", color: "bg-green-100 text-green-800" },
  spam: { label: "Spam", color: "bg-red-100 text-red-800" },
  solicitation: { label: "Solicitation", color: "bg-orange-100 text-orange-800" },
  newsletter: { label: "Newsletter", color: "bg-blue-100 text-blue-800" },
  automated: { label: "Automated", color: "bg-purple-100 text-purple-800" },
  unknown: { label: "Unknown", color: "bg-gray-100 text-gray-800" },
};

export function AttachmentFilingTab() {
  const [activeSubTab, setActiveSubTab] = useState("filings");
  const [selectedFiling, setSelectedFiling] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilterValue, setCategoryFilterValue] = useState<string>("all");
  const [showAddBlockedDialog, setShowAddBlockedDialog] = useState(false);
  const [showAddTrustedDialog, setShowAddTrustedDialog] = useState(false);
  const [showCreateRuleDialog, setShowCreateRuleDialog] = useState(false);

  // Form states
  const [blockedForm, setBlockedForm] = useState({ pattern: "", patternType: "domain", reason: "spam" });
  const [trustedForm, setTrustedForm] = useState({ pattern: "", patternType: "domain", notes: "" });

  const utils = trpc.useUtils();

  // Queries
  const { data: filings, isLoading: filingsLoading } = trpc.emailScanning.getFilings.useQuery(
    statusFilter !== "all" || categoryFilterValue !== "all"
      ? {
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(categoryFilterValue !== "all" && { documentCategory: categoryFilterValue }),
        }
      : undefined
  );

  const { data: pendingFilings } = trpc.emailScanning.getPendingFilings.useQuery({ limit: 50 });
  const { data: filingStats } = trpc.emailScanning.getFilingStats.useQuery();
  const { data: filingRules } = trpc.emailScanning.getFilingRules.useQuery({});
  const { data: filingConfigs } = trpc.emailScanning.getFilingConfigs.useQuery();
  const { data: blockedSenders } = trpc.emailScanning.getBlockedSenders.useQuery();
  const { data: trustedSenders } = trpc.emailScanning.getTrustedSenders.useQuery();

  // Mutations
  const processEmailMutation = trpc.emailScanning.processEmailForFiling.useMutation({
    onSuccess: (result) => {
      toast.success(`Processed ${result.processed} attachments, filed ${result.filed}`);
      utils.emailScanning.getFilings.invalidate();
      utils.emailScanning.getFilingStats.invalidate();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const scanGmailMutation = trpc.emailScanning.scanGmailForAttachments.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Scanned ${result.emailsScanned} emails, processed ${result.emailsProcessed}, filed ${result.attachmentsFiled} attachments`
      );
      utils.emailScanning.getFilings.invalidate();
      utils.emailScanning.getFilingStats.invalidate();
      utils.emailScanning.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const processUnprocessedMutation = trpc.emailScanning.processUnprocessedEmails.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Processed ${result.emailsProcessed} emails, filed ${result.attachmentsFiled} attachments`
      );
      utils.emailScanning.getFilings.invalidate();
      utils.emailScanning.getFilingStats.invalidate();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const addBlockedMutation = trpc.emailScanning.addBlockedSender.useMutation({
    onSuccess: () => {
      toast.success("Sender blocked");
      setShowAddBlockedDialog(false);
      setBlockedForm({ pattern: "", patternType: "domain", reason: "spam" });
      utils.emailScanning.getBlockedSenders.invalidate();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const removeBlockedMutation = trpc.emailScanning.removeBlockedSender.useMutation({
    onSuccess: () => {
      toast.success("Sender unblocked");
      utils.emailScanning.getBlockedSenders.invalidate();
    },
  });

  const addTrustedMutation = trpc.emailScanning.addTrustedSender.useMutation({
    onSuccess: () => {
      toast.success("Trusted sender added");
      setShowAddTrustedDialog(false);
      setTrustedForm({ pattern: "", patternType: "domain", notes: "" });
      utils.emailScanning.getTrustedSenders.invalidate();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const removeTrustedMutation = trpc.emailScanning.removeTrustedSender.useMutation({
    onSuccess: () => {
      toast.success("Trusted sender removed");
      utils.emailScanning.getTrustedSenders.invalidate();
    },
  });

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filingStats?.totalAttachments || 0}</div>
            <p className="text-xs text-muted-foreground">
              {filingStats?.filedAttachments || 0} filed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{filingStats?.pendingFilings || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting filing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emails Filtered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{filingStats?.filteredEmails || 0}</div>
            <p className="text-xs text-muted-foreground">Spam/solicitations blocked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{filingStats?.failedFilings || 0}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => scanGmailMutation.mutate({ maxEmails: 50, filterSpam: true, filterSolicitations: true, autoFile: true })}
          disabled={scanGmailMutation.isPending}
        >
          {scanGmailMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Inbox className="h-4 w-4 mr-2" />
          )}
          Scan Gmail Inbox
        </Button>
        <Button
          variant="outline"
          onClick={() => processUnprocessedMutation.mutate({ maxEmails: 100, useAI: true })}
          disabled={processUnprocessedMutation.isPending}
        >
          {processUnprocessedMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Process Pending Emails
        </Button>
        <Button variant="outline" onClick={() => utils.emailScanning.getFilings.invalidate()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="filings" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Filings
          </TabsTrigger>
          <TabsTrigger value="blocked" className="gap-2">
            <Ban className="h-4 w-4" />
            Blocked Senders
          </TabsTrigger>
          <TabsTrigger value="trusted" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Trusted Senders
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Settings className="h-4 w-4" />
            Filing Rules
          </TabsTrigger>
        </TabsList>

        {/* Filings Tab */}
        <TabsContent value="filings" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="filed">Filed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilterValue} onValueChange={setCategoryFilterValue}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categoryConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filings || filings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Filings Found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Scan your Gmail inbox or process pending emails to start auto-filing attachments.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attachment Filings</CardTitle>
                <CardDescription>{filings.length} attachments</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filings.map((filing: any) => {
                      const status = filingStatusConfig[filing.filingStatus] || filingStatusConfig.pending;
                      const category = categoryConfig[filing.documentCategory] || categoryConfig.other;
                      const destination = destinationConfig[filing.destinationType] || destinationConfig.pending;

                      return (
                        <div
                          key={filing.id}
                          className="p-3 border rounded-lg hover:bg-accent cursor-pointer"
                          onClick={() => setSelectedFiling(filing.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">
                                  {filing.extractedDocumentNumber || `Filing #${filing.id}`}
                                </p>
                                {filing.vendorName && (
                                  <p className="text-xs text-muted-foreground">{filing.vendorName}</p>
                                )}
                              </div>
                            </div>
                            <Badge className={status.color}>
                              {status.icon}
                              <span className="ml-1">{status.label}</span>
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {category.icon}
                              {category.label}
                            </span>
                            <span className="flex items-center gap-1">
                              {destination.icon}
                              {destination.label}
                            </span>
                            {filing.destinationPath && (
                              <span className="truncate max-w-[200px]">{filing.destinationPath}</span>
                            )}
                          </div>
                          {filing.extractedAmount && (
                            <p className="mt-1 text-sm font-medium">
                              {filing.extractedCurrency || "USD"} {parseFloat(filing.extractedAmount).toFixed(2)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Category breakdown */}
          {filingStats?.byCategory && Object.keys(filingStats.byCategory).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By Document Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(filingStats.byCategory).map(([category, count]: [string, any]) => {
                    const cat = categoryConfig[category] || categoryConfig.other;
                    return (
                      <Badge key={category} variant="outline" className="gap-1">
                        {cat.icon}
                        {cat.label}: {count}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Blocked Senders Tab */}
        <TabsContent value="blocked" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Blocked Senders</h3>
              <p className="text-sm text-muted-foreground">
                Emails from these senders will be automatically filtered
              </p>
            </div>
            <Button onClick={() => setShowAddBlockedDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Blocked Sender
            </Button>
          </div>

          {!blockedSenders || blockedSenders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Ban className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Blocked Senders</h3>
                <p className="text-sm text-muted-foreground">
                  Add email addresses or domains to automatically filter
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {blockedSenders.map((sender: any) => (
                    <div
                      key={sender.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{sender.pattern}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{sender.patternType}</Badge>
                          <Badge variant="outline" className="text-xs">{sender.reason}</Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBlockedMutation.mutate({ id: sender.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trusted Senders Tab */}
        <TabsContent value="trusted" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Trusted Senders</h3>
              <p className="text-sm text-muted-foreground">
                Emails from these senders will always be processed
              </p>
            </div>
            <Button onClick={() => setShowAddTrustedDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Trusted Sender
            </Button>
          </div>

          {!trustedSenders || trustedSenders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Trusted Senders</h3>
                <p className="text-sm text-muted-foreground">
                  Add vendor or partner domains to bypass spam filtering
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {trustedSenders.map((sender: any) => (
                    <div
                      key={sender.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{sender.pattern}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{sender.patternType}</Badge>
                          {sender.notes && (
                            <span className="text-xs text-muted-foreground">{sender.notes}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTrustedMutation.mutate({ id: sender.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Filing Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Filing Rules</h3>
              <p className="text-sm text-muted-foreground">
                Configure automatic routing rules for attachments
              </p>
            </div>
            <Button onClick={() => setShowCreateRuleDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>

          {!filingRules || filingRules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Filing Rules</h3>
                <p className="text-sm text-muted-foreground">
                  Create rules to automatically route attachments to the right location
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {filingRules.map((rule: any) => {
                    const destination = destinationConfig[rule.destinationType] || destinationConfig.pending;
                    return (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{rule.name}</p>
                            {!rule.isEnabled && (
                              <Badge variant="outline" className="text-xs">Disabled</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {destination.icon}
                              {destination.label}
                            </span>
                            {rule.pathTemplate && (
                              <span className="truncate max-w-[200px]">{rule.pathTemplate}</span>
                            )}
                          </div>
                          {rule.timesMatched > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Matched {rule.timesMatched} times
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Blocked Sender Dialog */}
      <Dialog open={showAddBlockedDialog} onOpenChange={setShowAddBlockedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Sender</DialogTitle>
            <DialogDescription>
              Add an email address or domain to the block list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pattern</Label>
              <Input
                placeholder="e.g., spam-domain.com or spammer@example.com"
                value={blockedForm.pattern}
                onChange={(e) => setBlockedForm({ ...blockedForm, pattern: e.target.value })}
              />
            </div>
            <div>
              <Label>Pattern Type</Label>
              <Select
                value={blockedForm.patternType}
                onValueChange={(v) => setBlockedForm({ ...blockedForm, patternType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exact Email</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="regex">Regex Pattern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Select
                value={blockedForm.reason}
                onValueChange={(v) => setBlockedForm({ ...blockedForm, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="solicitation">Solicitation</SelectItem>
                  <SelectItem value="phishing">Phishing</SelectItem>
                  <SelectItem value="manual">Manual Block</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBlockedDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addBlockedMutation.mutate(blockedForm as any)}
              disabled={!blockedForm.pattern || addBlockedMutation.isPending}
            >
              Block Sender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Trusted Sender Dialog */}
      <Dialog open={showAddTrustedDialog} onOpenChange={setShowAddTrustedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Trusted Sender</DialogTitle>
            <DialogDescription>
              Add an email address or domain to the trusted list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pattern</Label>
              <Input
                placeholder="e.g., vendor.com or partner@example.com"
                value={trustedForm.pattern}
                onChange={(e) => setTrustedForm({ ...trustedForm, pattern: e.target.value })}
              />
            </div>
            <div>
              <Label>Pattern Type</Label>
              <Select
                value={trustedForm.patternType}
                onValueChange={(v) => setTrustedForm({ ...trustedForm, patternType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exact Email</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="regex">Regex Pattern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g., Primary shipping carrier"
                value={trustedForm.notes}
                onChange={(e) => setTrustedForm({ ...trustedForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTrustedDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addTrustedMutation.mutate(trustedForm as any)}
              disabled={!trustedForm.pattern || addTrustedMutation.isPending}
            >
              Add Trusted Sender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
