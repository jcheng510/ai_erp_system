import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Loader2,
  MapPin,
  Package,
  Calendar,
  DollarSign,
  Clock,
  Star,
  Sparkles,
  CheckCircle,
  XCircle,
  Mail,
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { Streamdown } from "streamdown";

export default function RFQDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const rfqId = parseInt(id || "0");
  
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedCarriers, setSelectedCarriers] = useState<number[]>([]);
  const [manualQuoteOpen, setManualQuoteOpen] = useState(false);
  const [emailParseOpen, setEmailParseOpen] = useState(false);
  const [emailContent, setEmailContent] = useState({ fromEmail: "", subject: "", body: "" });
  const [selectedCarrierForEmail, setSelectedCarrierForEmail] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: rfq, isLoading: rfqLoading } = trpc.freight.rfqs.get.useQuery({ id: rfqId });
  const { data: quotes, isLoading: quotesLoading } = trpc.freight.quotes.list.useQuery({ rfqId });
  const { data: carriers } = trpc.freight.carriers.list.useQuery({ isActive: true });
  const { data: emails } = trpc.freight.emails.list.useQuery({ rfqId });

  const sendToCarriersMutation = trpc.freight.rfqs.sendToCarriers.useMutation({
    onSuccess: (result) => {
      toast.success(`RFQ sent to ${result.sent} carriers`);
      utils.freight.rfqs.get.invalidate({ id: rfqId });
      utils.freight.emails.list.invalidate({ rfqId });
      setSendDialogOpen(false);
      setSelectedCarriers([]);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send RFQ");
    },
  });

  const analyzeQuotesMutation = trpc.freight.quotes.analyzeQuotes.useMutation({
    onSuccess: (analysis) => {
      toast.success("AI analysis complete");
      utils.freight.quotes.list.invalidate({ rfqId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to analyze quotes");
    },
  });

  const acceptQuoteMutation = trpc.freight.quotes.accept.useMutation({
    onSuccess: (result) => {
      toast.success(`Quote accepted! Booking ${result.booking.bookingNumber} created`);
      utils.freight.quotes.list.invalidate({ rfqId });
      utils.freight.rfqs.get.invalidate({ id: rfqId });
      setLocation(`/freight/bookings/${result.booking.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to accept quote");
    },
  });

  const parseEmailMutation = trpc.freight.emails.parseIncoming.useMutation({
    onSuccess: (result) => {
      if (result.quote) {
        toast.success("Quote extracted from email");
      } else {
        toast.info("Email saved but no quote data could be extracted");
      }
      utils.freight.quotes.list.invalidate({ rfqId });
      utils.freight.emails.list.invalidate({ rfqId });
      setEmailParseOpen(false);
      setEmailContent({ fromEmail: "", subject: "", body: "" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to parse email");
    },
  });

  const handleSendToCarriers = () => {
    if (selectedCarriers.length === 0) {
      toast.error("Please select at least one carrier");
      return;
    }
    sendToCarriersMutation.mutate({ rfqId, carrierIds: selectedCarriers });
  };

  const handleParseEmail = () => {
    if (!selectedCarrierForEmail) {
      toast.error("Please select a carrier");
      return;
    }
    parseEmailMutation.mutate({
      rfqId,
      carrierId: selectedCarrierForEmail,
      ...emailContent,
    });
  };

  if (rfqLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="p-6">
        <p>RFQ not found</p>
        <Link href="/freight/rfqs">
          <Button variant="link">Back to RFQs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/freight/rfqs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{rfq.rfqNumber}</h1>
              <Badge variant={
                rfq.status === 'quotes_received' ? 'default' :
                rfq.status === 'awarded' ? 'secondary' :
                'outline'
              }>
                {rfq.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-muted-foreground">{rfq.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {rfq.status === 'draft' && (
            <Button onClick={() => setSendDialogOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send to Carriers
            </Button>
          )}
          {(rfq.status === 'sent' || rfq.status === 'awaiting_quotes') && (
            <Button variant="outline" onClick={() => setEmailParseOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Add Quote from Email
            </Button>
          )}
          {quotes && quotes.length > 1 && (
            <Button
              variant="outline"
              onClick={() => analyzeQuotesMutation.mutate({ rfqId })}
              disabled={analyzeQuotesMutation.isPending}
            >
              {analyzeQuotesMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              AI Compare Quotes
            </Button>
          )}
        </div>
      </div>

      {/* Shipment Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Route
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Origin</p>
              <p className="font-medium">
                {[rfq.originCity, rfq.originCountry].filter(Boolean).join(', ') || 'TBD'}
              </p>
              {rfq.originAddress && (
                <p className="text-sm text-muted-foreground">{rfq.originAddress}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Destination</p>
              <p className="font-medium">
                {[rfq.destinationCity, rfq.destinationCountry].filter(Boolean).join(', ') || 'TBD'}
              </p>
              {rfq.destinationAddress && (
                <p className="text-sm text-muted-foreground">{rfq.destinationAddress}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Cargo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{rfq.cargoType || 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weight</span>
              <span>{rfq.totalWeight ? `${rfq.totalWeight} kg` : 'TBD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span>{rfq.totalVolume ? `${rfq.totalVolume} CBM` : 'TBD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Packages</span>
              <span>{rfq.numberOfPackages || 'TBD'}</span>
            </div>
            {rfq.hsCode && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">HS Code</span>
                <span>{rfq.hsCode}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode</span>
              <span>{rfq.preferredMode?.replace(/_/g, ' ') || 'Any'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Incoterms</span>
              <span>{rfq.incoterms || 'TBD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Insurance</span>
              <span>{rfq.insuranceRequired ? 'Required' : 'Optional'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customs</span>
              <span>{rfq.customsClearanceRequired ? 'Required' : 'Not needed'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotes */}
      <Card>
        <CardHeader>
          <CardTitle>Quotes Received ({quotes?.length || 0})</CardTitle>
          <CardDescription>Compare quotes from carriers</CardDescription>
        </CardHeader>
        <CardContent>
          {quotesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : quotes && quotes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Transit Time</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>AI Score</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => {
                  const carrier = carriers?.find(c => c.id === quote.carrierId);
                  let aiAnalysis: { pros?: string[]; cons?: string[] } = {};
                  try {
                    if (quote.aiAnalysis) {
                      aiAnalysis = JSON.parse(quote.aiAnalysis);
                    }
                  } catch {}
                  
                  return (
                    <TableRow key={quote.id} className={quote.aiRecommendation === 'Recommended' ? 'bg-green-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {quote.aiRecommendation === 'Recommended' && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                          <div>
                            <p className="font-medium">{carrier?.name || `Carrier #${quote.carrierId}`}</p>
                            {quote.quoteNumber && (
                              <p className="text-sm text-muted-foreground">{quote.quoteNumber}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {quote.currency || 'USD'} {quote.totalCost || 'TBD'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{quote.transitDays ? `${quote.transitDays} days` : 'TBD'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{quote.shippingMode || 'N/A'}</TableCell>
                      <TableCell>
                        {quote.aiScore ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${quote.aiScore}%` }}
                              />
                            </div>
                            <span className="text-sm">{quote.aiScore}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not analyzed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {quote.validUntil
                          ? new Date(quote.validUntil).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          quote.status === 'accepted' ? 'default' :
                          quote.status === 'rejected' ? 'destructive' :
                          'secondary'
                        }>
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {quote.status === 'received' && rfq.status !== 'awarded' && (
                          <Button
                            size="sm"
                            onClick={() => acceptQuoteMutation.mutate({ quoteId: quote.id })}
                            disabled={acceptQuoteMutation.isPending}
                          >
                            {acceptQuoteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Accept
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No quotes received yet</p>
              {rfq.status === 'draft' && (
                <Button variant="link" onClick={() => setSendDialogOpen(true)}>
                  Send RFQ to carriers
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email History */}
      {emails && emails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Email History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {emails.map((email) => (
                <div key={email.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Mail className={`h-5 w-5 mt-0.5 ${email.direction === 'outbound' ? 'text-blue-500' : 'text-green-500'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{email.subject}</span>
                      <Badge variant="outline" className="text-xs">
                        {email.direction === 'outbound' ? 'Sent' : 'Received'}
                      </Badge>
                      {email.aiGenerated && (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI Generated
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {email.direction === 'outbound' ? `To: ${email.toEmail}` : `From: ${email.fromEmail}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(email.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send to Carriers Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send RFQ to Carriers</DialogTitle>
            <DialogDescription>
              Select carriers to send this quote request to. AI will generate personalized emails.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {carriers?.map((carrier) => (
                <div
                  key={carrier.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted cursor-pointer"
                  onClick={() => {
                    if (selectedCarriers.includes(carrier.id)) {
                      setSelectedCarriers(selectedCarriers.filter(id => id !== carrier.id));
                    } else {
                      setSelectedCarriers([...selectedCarriers, carrier.id]);
                    }
                  }}
                >
                  <Checkbox
                    checked={selectedCarriers.includes(carrier.id)}
                    disabled={!carrier.email}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{carrier.name}</span>
                      {carrier.isPreferred && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {carrier.email || 'No email address'}
                    </p>
                  </div>
                  <Badge variant="outline">{carrier.type}</Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendToCarriers}
              disabled={selectedCarriers.length === 0 || sendToCarriersMutation.isPending}
            >
              {sendToCarriersMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send to {selectedCarriers.length} Carrier{selectedCarriers.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parse Email Dialog */}
      <Dialog open={emailParseOpen} onOpenChange={setEmailParseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Quote from Email</DialogTitle>
            <DialogDescription>
              Paste the carrier's email response and AI will extract the quote details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Carrier</label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedCarrierForEmail || ""}
                onChange={(e) => setSelectedCarrierForEmail(parseInt(e.target.value))}
              >
                <option value="">Select carrier...</option>
                {carriers?.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From Email</label>
              <input
                type="email"
                className="w-full p-2 border rounded-md"
                placeholder="sender@carrier.com"
                value={emailContent.fromEmail}
                onChange={(e) => setEmailContent({ ...emailContent, fromEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <input
                type="text"
                className="w-full p-2 border rounded-md"
                placeholder="RE: Quote Request..."
                value={emailContent.subject}
                onChange={(e) => setEmailContent({ ...emailContent, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Body</label>
              <Textarea
                placeholder="Paste the full email content here..."
                value={emailContent.body}
                onChange={(e) => setEmailContent({ ...emailContent, body: e.target.value })}
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailParseOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleParseEmail}
              disabled={!selectedCarrierForEmail || !emailContent.body || parseEmailMutation.isPending}
            >
              {parseEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Extract Quote with AI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
