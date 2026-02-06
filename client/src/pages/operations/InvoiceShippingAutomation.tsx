import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Truck,
  FileText,
  ExternalLink,
  SkipForward,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  detected: { label: "Detected", color: "bg-blue-100 text-blue-700", icon: Eye },
  vendor_matched: { label: "Vendor Matched", color: "bg-indigo-100 text-indigo-700", icon: CheckCircle },
  portal_created: { label: "Portal Created", color: "bg-purple-100 text-purple-700", icon: FileText },
  email_sent: { label: "Email Sent", color: "bg-yellow-100 text-yellow-700", icon: Mail },
  supplier_responded: { label: "Supplier Responded", color: "bg-orange-100 text-orange-700", icon: RefreshCw },
  info_complete: { label: "Info Complete", color: "bg-green-100 text-green-700", icon: CheckCircle },
  freight_quoted: { label: "Freight Quoted", color: "bg-emerald-100 text-emerald-700", icon: Truck },
  failed: { label: "Failed", color: "bg-red-100 text-red-700", icon: AlertCircle },
  skipped: { label: "Skipped", color: "bg-gray-100 text-gray-600", icon: SkipForward },
};

export default function InvoiceShippingAutomation() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Queries
  const { data: automations, isLoading, refetch } = trpc.supplierInvoiceAutomation.list.useQuery(
    statusFilter === "all" ? {} : { status: statusFilter }
  );

  const { data: selectedDetail } = trpc.supplierInvoiceAutomation.getById.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );

  // Mutations
  const scanAndProcess = trpc.supplierInvoiceAutomation.scanAndProcess.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Scan complete: ${result.invoicesDetected} invoices detected, ${result.emailsSent} emails sent`
      );
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} error(s) occurred`);
      }
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Scan failed");
    },
  });

  const updateStatus = trpc.supplierInvoiceAutomation.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
  });

  // Stats
  const stats = {
    total: automations?.length || 0,
    pending: automations?.filter(a => a.status === "email_sent").length || 0,
    responded: automations?.filter(a => a.status === "supplier_responded").length || 0,
    complete: automations?.filter(a => a.status === "info_complete" || a.status === "freight_quoted").length || 0,
    failed: automations?.filter(a => a.status === "failed").length || 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Shipping Automation</h1>
          <p className="text-gray-500 mt-1">
            Automatically request shipping info and customs documents from suppliers when invoices arrive
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => scanAndProcess.mutate()}
            disabled={scanAndProcess.isPending}
          >
            {scanAndProcess.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Scan Inbox Now
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-gray-500">Awaiting Supplier</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.responded}</p>
            <p className="text-xs text-gray-500">Responded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.complete}</p>
            <p className="text-xs text-gray-500">Complete</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-gray-500">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Automation Log</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : !automations?.length ? (
            <div className="text-center py-8 text-gray-400">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No automations yet. Click "Scan Inbox Now" to start.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {automations.map((auto) => {
                  const cfg = statusConfig[auto.status] || statusConfig.detected;
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow key={auto.id}>
                      <TableCell>
                        <Badge className={`${cfg.color} border-0`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{auto.vendorName || auto.fromName || "-"}</p>
                          <p className="text-xs text-gray-400">{auto.fromEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{auto.invoiceNumber || "-"}</TableCell>
                      <TableCell className="text-sm">{auto.poNumber || "-"}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(auto.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {auto.aiConfidence ? (
                          <span className="text-sm">{parseFloat(auto.aiConfidence)}%</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {auto.portalToken && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const url = `/supplier-shipping/${auto.portalToken}`;
                                window.open(url, "_blank");
                              }}
                              title="Open supplier portal"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {auto.status === "email_sent" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateStatus.mutate({
                                  id: auto.id,
                                  status: "skipped",
                                  notes: "Manually skipped by user",
                                })
                              }
                              title="Skip"
                            >
                              <SkipForward className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedId(auto.id === selectedId ? null : auto.id)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
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
      {selectedDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Automation #{selectedDetail.id} Details
            </CardTitle>
            <CardDescription>
              {selectedDetail.invoiceSubject}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-700">Invoice Details</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">From:</span> {selectedDetail.fromName} ({selectedDetail.fromEmail})</p>
                  <p><span className="text-gray-500">Invoice #:</span> {selectedDetail.invoiceNumber || "N/A"}</p>
                  <p><span className="text-gray-500">Date:</span> {selectedDetail.invoiceDate || "N/A"}</p>
                  <p><span className="text-gray-500">Total:</span> {selectedDetail.invoiceTotal ? `${selectedDetail.currency || "USD"} ${selectedDetail.invoiceTotal}` : "N/A"}</p>
                  <p><span className="text-gray-500">PO:</span> {selectedDetail.poNumber || "N/A"}</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-700">Processing Info</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">Status:</span> {selectedDetail.status}</p>
                  <p><span className="text-gray-500">AI Confidence:</span> {selectedDetail.aiConfidence ? `${selectedDetail.aiConfidence}%` : "N/A"}</p>
                  <p><span className="text-gray-500">Attachments Parsed:</span> {selectedDetail.attachmentsParsed ? "Yes" : "No"}</p>
                  <p><span className="text-gray-500">Notes:</span> {selectedDetail.processingNotes || "None"}</p>
                  {selectedDetail.errorMessage && (
                    <p className="text-red-600"><span className="text-gray-500">Error:</span> {selectedDetail.errorMessage}</p>
                  )}
                </div>
              </div>
              {selectedDetail.parsedShippingData && (
                <div className="md:col-span-2 space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Parsed Shipping Data</h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-48">
                    {JSON.stringify(JSON.parse(selectedDetail.parsedShippingData), null, 2)}
                  </pre>
                </div>
              )}
              {selectedDetail.lineItemsSummary && (
                <div className="md:col-span-2 space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Invoice Line Items</h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-48">
                    {JSON.stringify(JSON.parse(selectedDetail.lineItemsSummary), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
