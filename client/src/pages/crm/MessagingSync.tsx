import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users, Search, Loader2, Phone, Mail, MessageSquare,
  MessageCircle, Filter, MoreHorizontal, Clock, ArrowUpDown,
  Plus, Settings2, RefreshCw, Send, ChevronRight, Building2,
  Smartphone, Wifi, WifiOff, X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

type ChannelFilter = "all" | "email" | "whatsapp" | "imessage";
type ContactTypeFilter = "all" | "investor" | "prospect" | "customer" | "lead" | "partner" | "donor" | "vendor" | "other";

const channelIcons: Record<string, any> = {
  email: Mail,
  whatsapp: MessageSquare,
  imessage: MessageCircle,
  sms: Phone,
  phone: Phone,
};

const channelColors: Record<string, string> = {
  email: "bg-blue-100 text-blue-700",
  whatsapp: "bg-green-100 text-green-700",
  imessage: "bg-indigo-100 text-indigo-700",
  sms: "bg-orange-100 text-orange-700",
  phone: "bg-purple-100 text-purple-700",
};

const contactTypeBadgeColors: Record<string, string> = {
  investor: "bg-amber-100 text-amber-800",
  prospect: "bg-blue-100 text-blue-800",
  customer: "bg-green-100 text-green-800",
  lead: "bg-gray-100 text-gray-800",
  partner: "bg-purple-100 text-purple-800",
  donor: "bg-pink-100 text-pink-800",
  vendor: "bg-cyan-100 text-cyan-800",
  other: "bg-slate-100 text-slate-800",
};

export default function MessagingSync() {
  const [activeTab, setActiveTab] = useState("inbox");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [contactTypeFilter, setContactTypeFilter] = useState<ContactTypeFilter>("all");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSyncAccountDialogOpen, setIsSyncAccountDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const [syncAccountForm, setSyncAccountForm] = useState({
    channel: "imessage" as "imessage" | "whatsapp" | "email" | "sms",
    accountIdentifier: "",
    label: "",
    syncFrequency: "manual" as "realtime" | "hourly" | "daily" | "manual",
  });

  const [importForm, setImportForm] = useState({
    senderIdentifier: "",
    senderName: "",
    direction: "inbound" as "inbound" | "outbound",
    content: "",
    channel: "imessage" as "imessage" | "whatsapp",
  });

  // Queries
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = trpc.crm.messagingSync.overview.useQuery({
    contactType: contactTypeFilter !== "all" ? contactTypeFilter : undefined,
    channel: channelFilter !== "all" ? channelFilter : undefined,
    search: search || undefined,
  });

  const { data: syncAccounts, refetch: refetchAccounts } = trpc.crm.messagingSync.accounts.useQuery();

  const { data: contactHistory, isLoading: historyLoading } = trpc.crm.messagingSync.contactHistory.useQuery(
    { contactId: selectedContactId!, limit: 100 },
    { enabled: !!selectedContactId }
  );

  const { data: selectedContact } = trpc.crm.contacts.get.useQuery(
    { id: selectedContactId! },
    { enabled: !!selectedContactId }
  );

  // Mutations
  const createSyncAccount = trpc.crm.messagingSync.createAccount.useMutation({
    onSuccess: () => {
      toast.success("Sync account added");
      setIsSyncAccountDialogOpen(false);
      refetchAccounts();
      setSyncAccountForm({ channel: "imessage", accountIdentifier: "", label: "", syncFrequency: "manual" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSyncAccount = trpc.crm.messagingSync.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Sync account removed");
      refetchAccounts();
    },
    onError: (err) => toast.error(err.message),
  });

  const logImessage = trpc.crm.imessage.logMessage.useMutation({
    onSuccess: (result) => {
      toast.success(`Message logged${result.contactId ? " and linked to contact" : ""}`);
      setIsImportDialogOpen(false);
      refetchOverview();
      setImportForm({ senderIdentifier: "", senderName: "", direction: "inbound", content: "", channel: "imessage" });
    },
    onError: (err) => toast.error(err.message),
  });

  const logWhatsapp = trpc.crm.whatsapp.logInbound.useMutation({
    onSuccess: () => {
      toast.success("WhatsApp message logged");
      setIsImportDialogOpen(false);
      refetchOverview();
      setImportForm({ senderIdentifier: "", senderName: "", direction: "inbound", content: "", channel: "imessage" });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleLogMessage = () => {
    if (importForm.channel === "imessage") {
      logImessage.mutate({
        senderIdentifier: importForm.senderIdentifier,
        senderName: importForm.senderName || undefined,
        direction: importForm.direction,
        content: importForm.content,
        syncSource: "manual",
      });
    } else if (importForm.channel === "whatsapp") {
      logWhatsapp.mutate({
        whatsappNumber: importForm.senderIdentifier,
        contactName: importForm.senderName || undefined,
        content: importForm.content,
      });
    }
  };

  const openContactDetail = (contactId: number) => {
    setSelectedContactId(contactId);
    setIsDetailOpen(true);
  };

  // Stats
  const totalContacts = overview?.length || 0;
  const investorContacts = overview?.filter((o: any) => o.contact.contactType === "investor").length || 0;
  const withWhatsapp = overview?.filter((o: any) => o.activeChannels.includes("whatsapp")).length || 0;
  const withImessage = overview?.filter((o: any) => o.activeChannels.includes("imessage")).length || 0;
  const withEmail = overview?.filter((o: any) => o.activeChannels.includes("email")).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messaging Sync</h1>
          <p className="text-muted-foreground">
            Unified iMessage, WhatsApp & email tracking per contact and investor
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchOverview()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Message
          </Button>
          <Button onClick={() => setIsSyncAccountDialogOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Add Sync Account
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Contacts</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalContacts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-muted-foreground">Investors</span>
            </div>
            <p className="text-2xl font-bold mt-1">{investorContacts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">WhatsApp</span>
            </div>
            <p className="text-2xl font-bold mt-1">{withWhatsapp}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-indigo-600" />
              <span className="text-sm text-muted-foreground">iMessage</span>
            </div>
            <p className="text-2xl font-bold mt-1">{withImessage}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Email</span>
            </div>
            <p className="text-2xl font-bold mt-1">{withEmail}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inbox">Unified Inbox</TabsTrigger>
          <TabsTrigger value="accounts">Sync Accounts</TabsTrigger>
        </TabsList>

        {/* Unified Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts, organizations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as ChannelFilter)}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="imessage">iMessage</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contactTypeFilter} onValueChange={(v) => setContactTypeFilter(v as ContactTypeFilter)}>
              <SelectTrigger className="w-[160px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Contact Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="investor">Investors</SelectItem>
                <SelectItem value="prospect">Prospects</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="lead">Leads</SelectItem>
                <SelectItem value="partner">Partners</SelectItem>
                <SelectItem value="donor">Donors</SelectItem>
                <SelectItem value="vendor">Vendors</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contacts Messaging Table */}
          {overviewLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !overview || overview.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">No messaging activity found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add contacts with phone/email/WhatsApp to start tracking conversations
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead>Latest Message</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Interactions</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.map((item: any) => {
                    const contact = item.contact;
                    const latest = item.latestMessage;
                    return (
                      <TableRow
                        key={contact.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openContactDetail(contact.id)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{contact.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {contact.organization && <span>{contact.organization}</span>}
                              {contact.organization && contact.jobTitle && <span> - </span>}
                              {contact.jobTitle && <span>{contact.jobTitle}</span>}
                            </p>
                            <div className="flex gap-2 mt-0.5">
                              {contact.email && (
                                <span className="text-xs text-muted-foreground">{contact.email}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={contactTypeBadgeColors[contact.contactType] || "bg-gray-100"} variant="secondary">
                            {contact.contactType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.activeChannels.map((ch: string) => {
                              const Icon = channelIcons[ch] || MessageSquare;
                              return (
                                <span key={ch} className={`inline-flex items-center justify-center h-7 w-7 rounded-full ${channelColors[ch] || "bg-gray-100"}`}>
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {latest ? (
                            <div className="max-w-[250px]">
                              <div className="flex items-center gap-1 mb-0.5">
                                {(() => {
                                  const Icon = channelIcons[latest.type] || MessageSquare;
                                  return <Icon className="h-3 w-3 text-muted-foreground" />;
                                })()}
                                <span className="text-xs text-muted-foreground capitalize">{latest.type}</span>
                                <span className="text-xs text-muted-foreground">
                                  {latest.direction === "inbound" ? "received" : "sent"}
                                </span>
                              </div>
                              <p className="text-sm truncate">{latest.content || "(no content)"}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No messages</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {latest?.timestamp ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(latest.timestamp), { addSuffix: true })}
                            </span>
                          ) : contact.lastContactedAt ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(contact.lastContactedAt), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{item.totalInteractions}</span>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Sync Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Configure accounts to sync messages from external sources into the CRM.
            </p>
            <Button onClick={() => setIsSyncAccountDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>

          {!syncAccounts || syncAccounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">No sync accounts configured</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add an iMessage, WhatsApp, or email sync account to auto-import messages
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {syncAccounts.map((account: any) => {
                const Icon = channelIcons[account.channel] || MessageSquare;
                return (
                  <Card key={account.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${channelColors[account.channel] || "bg-gray-100"}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <CardTitle className="text-base">
                              {account.label || account.accountIdentifier}
                            </CardTitle>
                            <CardDescription className="text-xs capitalize">{account.channel}</CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteSyncAccount.mutate({ id: account.id })}
                            >
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Identifier</span>
                        <span className="font-mono text-xs">{account.accountIdentifier}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sync Frequency</span>
                        <Badge variant="outline" className="capitalize">{account.syncFrequency}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        {account.isActive ? (
                          <Badge className="bg-green-100 text-green-700" variant="secondary">
                            <Wifi className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700" variant="secondary">
                            <WifiOff className="h-3 w-3 mr-1" /> Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Messages Synced</span>
                        <span className="font-medium">{account.totalMessagesSynced || 0}</span>
                      </div>
                      {account.lastSyncAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Last Sync</span>
                          <span className="text-xs">
                            {formatDistanceToNow(new Date(account.lastSyncAt), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                      {account.lastSyncStatus === "failed" && account.lastSyncError && (
                        <p className="text-xs text-destructive mt-1">{account.lastSyncError}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Contact Messaging Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedContact?.fullName || "Contact"} - Message History
              {selectedContact?.contactType && (
                <Badge className={contactTypeBadgeColors[selectedContact.contactType] || ""} variant="secondary">
                  {selectedContact.contactType}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedContact?.organization && <span>{selectedContact.organization}</span>}
              {selectedContact?.organization && selectedContact?.email && <span> | </span>}
              {selectedContact?.email && <span>{selectedContact.email}</span>}
              {selectedContact?.phone && <span> | {selectedContact.phone}</span>}
              {selectedContact?.whatsappNumber && <span> | WA: {selectedContact.whatsappNumber}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-3 py-2">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !contactHistory || contactHistory.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No messages found for this contact</p>
              </div>
            ) : (
              contactHistory.map((msg: any, idx: number) => {
                const Icon = channelIcons[msg.type] || MessageSquare;
                const isOutbound = msg.direction === "outbound";
                return (
                  <div
                    key={`${msg.type}-${msg.id}-${idx}`}
                    className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      isOutbound
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3 w-3 opacity-70" />
                        <span className="text-xs font-medium opacity-70 capitalize">{msg.type}</span>
                        <span className="text-xs opacity-50">
                          {isOutbound ? "Sent" : "Received"}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content || "(no content)"}</p>
                      {msg.timestamp && (
                        <p className="text-xs opacity-50 mt-1.5">
                          {format(new Date(msg.timestamp), "MMM d, yyyy h:mm a")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Sync Account Dialog */}
      <Dialog open={isSyncAccountDialogOpen} onOpenChange={setIsSyncAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sync Account</DialogTitle>
            <DialogDescription>
              Configure a messaging account to sync messages into the CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={syncAccountForm.channel}
                onValueChange={(v) => setSyncAccountForm({ ...syncAccountForm, channel: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imessage">iMessage</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {syncAccountForm.channel === "email" ? "Email Address" :
                 syncAccountForm.channel === "imessage" ? "Phone Number or Apple ID" :
                 syncAccountForm.channel === "whatsapp" ? "WhatsApp Number" :
                 "Phone Number"}
              </Label>
              <Input
                placeholder={
                  syncAccountForm.channel === "email" ? "you@company.com" :
                  syncAccountForm.channel === "imessage" ? "+1 (555) 123-4567 or apple@id.com" :
                  "+1 (555) 123-4567"
                }
                value={syncAccountForm.accountIdentifier}
                onChange={(e) => setSyncAccountForm({ ...syncAccountForm, accountIdentifier: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                placeholder="e.g., CEO Personal, Sales Team"
                value={syncAccountForm.label}
                onChange={(e) => setSyncAccountForm({ ...syncAccountForm, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sync Frequency</Label>
              <Select
                value={syncAccountForm.syncFrequency}
                onValueChange={(v) => setSyncAccountForm({ ...syncAccountForm, syncFrequency: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="realtime">Real-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncAccountDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSyncAccount.mutate(syncAccountForm)}
              disabled={!syncAccountForm.accountIdentifier || createSyncAccount.isPending}
            >
              {createSyncAccount.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Message Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Message</DialogTitle>
            <DialogDescription>
              Manually log an iMessage or WhatsApp message. The system will auto-match it to a CRM contact.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={importForm.channel}
                onValueChange={(v) => setImportForm({ ...importForm, channel: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imessage">iMessage</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone / Identifier</Label>
              <Input
                placeholder="+1 (555) 123-4567"
                value={importForm.senderIdentifier}
                onChange={(e) => setImportForm({ ...importForm, senderIdentifier: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                placeholder="Contact name"
                value={importForm.senderName}
                onChange={(e) => setImportForm({ ...importForm, senderName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={importForm.direction}
                onValueChange={(v) => setImportForm({ ...importForm, direction: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Received (Inbound)</SelectItem>
                  <SelectItem value="outbound">Sent (Outbound)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message Content</Label>
              <Textarea
                placeholder="Paste message content..."
                value={importForm.content}
                onChange={(e) => setImportForm({ ...importForm, content: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleLogMessage}
              disabled={!importForm.senderIdentifier || !importForm.content || logImessage.isPending || logWhatsapp.isPending}
            >
              {(logImessage.isPending || logWhatsapp.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Log Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
