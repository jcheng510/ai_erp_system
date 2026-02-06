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
  Linkedin, Search, Loader2, Users, Building2, MapPin,
  MessageSquare, RefreshCw, UserPlus, Link2, Filter,
  Send, Inbox, ArrowUpDown, Briefcase, Globe, Tag,
  CheckCircle2, XCircle, Clock, Settings, Unplug
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function LinkedInSync() {
  const [activeTab, setActiveTab] = useState("connections");

  // Connection search/filter state
  const [connSearch, setConnSearch] = useState("");
  const [connCompany, setConnCompany] = useState("");
  const [connTitle, setConnTitle] = useState("");
  const [connLocation, setConnLocation] = useState("");
  const [connIndustry, setConnIndustry] = useState("");
  const [connHasContact, setConnHasContact] = useState<string>("all");
  const [selectedConnections, setSelectedConnections] = useState<Set<number>>(new Set());

  // Advanced CRM search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [searchCompany, setSearchCompany] = useState("");
  const [searchTags, setSearchTags] = useState("");
  const [searchContactType, setSearchContactType] = useState<string>("all");
  const [searchSource, setSearchSource] = useState<string>("all");
  const [searchHasLinkedin, setSearchHasLinkedin] = useState<string>("all");

  // Message state
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messageContent, setMessageContent] = useState("");

  // Dialog state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isConnectionDetailOpen, setIsConnectionDetailOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);

  // Queries
  const { data: syncConfig, refetch: refetchConfig } = trpc.crm.linkedin.getConfig.useQuery();

  const { data: connections, isLoading: connectionsLoading, refetch: refetchConnections } = trpc.crm.linkedin.connections.list.useQuery({
    search: connSearch || undefined,
    company: connCompany || undefined,
    jobTitle: connTitle || undefined,
    location: connLocation || undefined,
    industry: connIndustry || undefined,
    hasContact: connHasContact === "all" ? undefined : connHasContact === "yes",
  });

  const { data: connectionStats } = trpc.crm.linkedin.connections.stats.useQuery();
  const { data: messageStats } = trpc.crm.linkedin.messages.stats.useQuery();
  const { data: conversations, refetch: refetchConversations } = trpc.crm.linkedin.messages.conversations.useQuery();

  const { data: conversationMessages, refetch: refetchMessages } = trpc.crm.linkedin.messages.list.useQuery(
    selectedConversation ? { conversationId: selectedConversation.linkedinConversationId, limit: 50 } : { limit: 0 },
    { enabled: !!selectedConversation }
  );

  // Advanced search query
  const { data: searchResults, isLoading: searchLoading } = trpc.crm.advancedSearch.useQuery({
    search: searchQuery || undefined,
    location: searchLocation || undefined,
    jobTitle: searchTitle || undefined,
    company: searchCompany || undefined,
    tags: searchTags ? searchTags.split(",").map(t => t.trim()) : undefined,
    contactType: searchContactType !== "all" ? searchContactType : undefined,
    source: searchSource !== "all" ? searchSource : undefined,
    hasLinkedin: searchHasLinkedin === "all" ? undefined : searchHasLinkedin === "yes",
  });

  // Mutations
  const updateConfig = trpc.crm.linkedin.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("LinkedIn sync settings updated");
      refetchConfig();
      setIsConfigOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const disconnect = trpc.crm.linkedin.disconnect.useMutation({
    onSuccess: () => {
      toast.success("LinkedIn disconnected");
      refetchConfig();
    },
    onError: (error) => toast.error(error.message),
  });

  const createContactFromConnection = trpc.crm.linkedin.connections.createContact.useMutation({
    onSuccess: (result) => {
      toast.success(result.isNew ? "New CRM contact created from LinkedIn" : "Linked to existing CRM contact");
      refetchConnections();
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkCreateContacts = trpc.crm.linkedin.connections.bulkCreateContacts.useMutation({
    onSuccess: (result) => {
      toast.success(`Created ${result.created} new contacts, linked ${result.linked} existing`);
      setSelectedConnections(new Set());
      refetchConnections();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendMessage = trpc.crm.linkedin.messages.send.useMutation({
    onSuccess: () => {
      toast.success("Message sent");
      setMessageContent("");
      refetchMessages();
      refetchConversations();
    },
    onError: (error) => toast.error(error.message),
  });

  const syncBatch = trpc.crm.linkedin.connections.syncBatch.useMutation({
    onSuccess: (result) => {
      toast.success(`Synced: ${result.created} new, ${result.updated} updated connections`);
      refetchConnections();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleConnectionSelection = (id: number) => {
    const next = new Set(selectedConnections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedConnections(next);
  };

  const selectAllVisible = () => {
    if (!connections) return;
    const unlinked = connections.filter(c => !c.contactId);
    if (selectedConnections.size === unlinked.length) {
      setSelectedConnections(new Set());
    } else {
      setSelectedConnections(new Set(unlinked.map(c => c.id)));
    }
  };

  const statusColor = (status?: string | null) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-600";
      case "paused": return "bg-yellow-500/10 text-yellow-600";
      case "error": return "bg-red-500/10 text-red-600";
      default: return "bg-gray-500/10 text-gray-600";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Linkedin className="h-8 w-8 text-blue-600" />
            LinkedIn Sync
          </h1>
          <p className="text-muted-foreground mt-1">
            Sync connections and messages from LinkedIn into your CRM. Search contacts by location, title, company, and tags.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsConfigOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          {syncConfig?.status === "active" ? (
            <Badge className={statusColor(syncConfig.status)}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge className={statusColor(syncConfig?.status)}>
              <XCircle className="h-3 w-3 mr-1" />
              {syncConfig?.status || "Disconnected"}
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectionStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {connectionStats?.linked || 0} linked to CRM
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unlinked</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectionStats?.unlinked || 0}</div>
            <p className="text-xs text-muted-foreground">
              Not yet in CRM
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messageStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {messageStats?.inbound || 0} received, {messageStats?.outbound || 0} sent
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sm">
              {syncConfig?.lastConnectionSyncAt
                ? format(new Date(syncConfig.lastConnectionSyncAt), "MMM d, h:mm a")
                : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              Frequency: {syncConfig?.syncFrequency || "manual"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Advanced Search
          </TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>LinkedIn Connections</CardTitle>
                  <CardDescription>Browse, filter, and sync your LinkedIn network to CRM</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedConnections.size > 0 && (
                    <Button
                      onClick={() => bulkCreateContacts.mutate({ connectionIds: Array.from(selectedConnections) })}
                      disabled={bulkCreateContacts.isPending}
                    >
                      {bulkCreateContacts.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add {selectedConnections.size} to CRM
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => refetchConnections()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, company..."
                    value={connSearch}
                    onChange={(e) => setConnSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Company"
                    value={connCompany}
                    onChange={(e) => setConnCompany(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <Briefcase className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Job title"
                    value={connTitle}
                    onChange={(e) => setConnTitle(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Location"
                    value={connLocation}
                    onChange={(e) => setConnLocation(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Industry"
                    value={connIndustry}
                    onChange={(e) => setConnIndustry(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={connHasContact} onValueChange={setConnHasContact}>
                  <SelectTrigger>
                    <SelectValue placeholder="CRM Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">In CRM</SelectItem>
                    <SelectItem value="no">Not in CRM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Connections Table */}
              {connectionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !connections || connections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Linkedin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No connections synced yet. Connect your LinkedIn account and sync your network.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <input
                          type="checkbox"
                          onChange={selectAllVisible}
                          checked={connections.filter(c => !c.contactId).length > 0 && selectedConnections.size === connections.filter(c => !c.contactId).length}
                          className="rounded"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>CRM Status</TableHead>
                      <TableHead>Connected</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.map((conn) => (
                      <TableRow key={conn.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          {!conn.contactId && (
                            <input
                              type="checkbox"
                              checked={selectedConnections.has(conn.id)}
                              onChange={() => toggleConnectionSelection(conn.id)}
                              className="rounded"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                              <Linkedin className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium">{conn.fullName}</div>
                              {conn.headline && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {conn.headline}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{conn.company || "-"}</TableCell>
                        <TableCell>{conn.jobTitle || "-"}</TableCell>
                        <TableCell>
                          {conn.location ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {conn.location}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {conn.contactId ? (
                            <Badge className="bg-green-500/10 text-green-600">
                              <Link2 className="h-3 w-3 mr-1" />
                              Linked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Not in CRM
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {conn.connectedAt ? (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(conn.connectedAt), "MMM d, yyyy")}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {!conn.contactId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => createContactFromConnection.mutate({ connectionId: conn.id })}
                                disabled={createContactFromConnection.isPending}
                                title="Add to CRM"
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedConnection(conn);
                                setIsConnectionDetailOpen(true);
                              }}
                              title="View details"
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 h-[600px]">
            {/* Conversations List */}
            <Card className="md:col-span-1 overflow-auto">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  Conversations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2">
                {!conversations || conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No LinkedIn messages synced yet.</p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedConversation?.linkedinConversationId === conv.linkedinConversationId
                          ? "bg-muted"
                          : ""
                      }`}
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {conv.direction === "inbound" ? conv.senderName : conv.recipientName}
                        </span>
                        {conv.sentAt && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(conv.sentAt), "MMM d")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {conv.direction === "outbound" ? "You: " : ""}
                        {conv.content || "(no content)"}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Message Thread */}
            <Card className="md:col-span-2 flex flex-col">
              {selectedConversation ? (
                <>
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {selectedConversation.direction === "inbound"
                            ? selectedConversation.senderName
                            : selectedConversation.recipientName}
                        </CardTitle>
                        <CardDescription>LinkedIn conversation</CardDescription>
                      </div>
                      <Badge variant="outline">
                        <Linkedin className="h-3 w-3 mr-1" />
                        LinkedIn
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto p-4 space-y-3">
                    {conversationMessages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg p-3 text-sm ${
                            msg.direction === "outbound"
                              ? "bg-blue-600 text-white"
                              : "bg-muted"
                          }`}
                        >
                          <p>{msg.content}</p>
                          {msg.sentAt && (
                            <p className={`text-xs mt-1 ${
                              msg.direction === "outbound" ? "text-blue-200" : "text-muted-foreground"
                            }`}>
                              {format(new Date(msg.sentAt), "MMM d, h:mm a")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && messageContent.trim()) {
                            sendMessage.mutate({
                              content: messageContent,
                              connectionId: selectedConversation.connectionId || undefined,
                              contactId: selectedConversation.contactId || undefined,
                              recipientLinkedinId: selectedConversation.direction === "inbound"
                                ? selectedConversation.senderLinkedinId || undefined
                                : selectedConversation.recipientLinkedinId || undefined,
                              recipientName: selectedConversation.direction === "inbound"
                                ? selectedConversation.senderName || undefined
                                : selectedConversation.recipientName || undefined,
                              linkedinConversationId: selectedConversation.linkedinConversationId || undefined,
                            });
                          }
                        }}
                      />
                      <Button
                        onClick={() => {
                          if (messageContent.trim()) {
                            sendMessage.mutate({
                              content: messageContent,
                              connectionId: selectedConversation.connectionId || undefined,
                              contactId: selectedConversation.contactId || undefined,
                              recipientLinkedinId: selectedConversation.direction === "inbound"
                                ? selectedConversation.senderLinkedinId || undefined
                                : selectedConversation.recipientLinkedinId || undefined,
                              recipientName: selectedConversation.direction === "inbound"
                                ? selectedConversation.senderName || undefined
                                : selectedConversation.recipientName || undefined,
                              linkedinConversationId: selectedConversation.linkedinConversationId || undefined,
                            });
                          }
                        }}
                        disabled={sendMessage.isPending || !messageContent.trim()}
                      >
                        {sendMessage.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to view messages</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Advanced Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Advanced Contact Search
              </CardTitle>
              <CardDescription>
                Search CRM contacts by location, job title, company, tags, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Filters */}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, email, org..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Location (city, state, country)"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <Briefcase className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Job title"
                    value={searchTitle}
                    onChange={(e) => setSearchTitle(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Company / organization"
                    value={searchCompany}
                    onChange={(e) => setSearchCompany(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="relative">
                  <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tags (comma-separated)"
                    value={searchTags}
                    onChange={(e) => setSearchTags(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={searchContactType} onValueChange={setSearchContactType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Contact Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="investor">Investor</SelectItem>
                    <SelectItem value="donor">Donor</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={searchSource} onValueChange={setSearchSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="linkedin_scan">LinkedIn</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="iphone_bump">iPhone Bump</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={searchHasLinkedin} onValueChange={setSearchHasLinkedin}>
                  <SelectTrigger>
                    <SelectValue placeholder="LinkedIn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Has LinkedIn</SelectItem>
                    <SelectItem value="no">No LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Results count */}
              {searchResults && (
                <div className="text-sm text-muted-foreground">
                  Found {searchResults.total} contact{searchResults.total !== 1 ? "s" : ""}
                </div>
              )}

              {/* Results Table */}
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !searchResults || searchResults.contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No contacts match your search criteria.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Channels</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.contacts.map((contact) => (
                      <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">{contact.fullName}</div>
                            {contact.email && (
                              <div className="text-xs text-muted-foreground">{contact.email}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{contact.organization || "-"}</TableCell>
                        <TableCell>{contact.jobTitle || "-"}</TableCell>
                        <TableCell>
                          {[contact.city, contact.state, contact.country].filter(Boolean).join(", ") || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {contact.contactType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs capitalize">{contact.source.replace(/_/g, " ")}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {contact.linkedinUrl && <Linkedin className="h-3 w-3 text-blue-600" />}
                            {contact.email && <span className="text-xs">@</span>}
                            {contact.phone && <span className="text-xs">T</span>}
                            {contact.whatsappNumber && <MessageSquare className="h-3 w-3 text-green-600" />}
                          </div>
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

      {/* Connection Detail Dialog */}
      <Dialog open={isConnectionDetailOpen} onOpenChange={setIsConnectionDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Linkedin className="h-5 w-5 text-blue-600" />
              {selectedConnection?.fullName}
            </DialogTitle>
            <DialogDescription>
              {selectedConnection?.headline || "LinkedIn Connection"}
            </DialogDescription>
          </DialogHeader>
          {selectedConnection && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Company</Label>
                  <div className="text-sm">{selectedConnection.company || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Job Title</Label>
                  <div className="text-sm">{selectedConnection.jobTitle || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Location</Label>
                  <div className="text-sm">{selectedConnection.location || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Industry</Label>
                  <div className="text-sm">{selectedConnection.industry || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <div className="text-sm">{selectedConnection.email || "-"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <div className="text-sm">{selectedConnection.phone || "-"}</div>
                </div>
              </div>
              {selectedConnection.summary && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Summary</Label>
                  <div className="text-sm">{selectedConnection.summary}</div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsConnectionDetailOpen(false)}>
                  Close
                </Button>
                {!selectedConnection.contactId && (
                  <Button
                    onClick={() => {
                      createContactFromConnection.mutate({ connectionId: selectedConnection.id });
                      setIsConnectionDetailOpen(false);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add to CRM
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>LinkedIn Sync Settings</DialogTitle>
            <DialogDescription>
              Configure how LinkedIn data syncs with your CRM
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sync Frequency</Label>
              <Select
                defaultValue={syncConfig?.syncFrequency || "daily"}
                onValueChange={(v) => updateConfig.mutate({ syncFrequency: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Only</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Sync Connections</Label>
                <input
                  type="checkbox"
                  defaultChecked={syncConfig?.syncConnections ?? true}
                  onChange={(e) => updateConfig.mutate({ syncConnections: e.target.checked })}
                  className="rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Sync Messages</Label>
                <input
                  type="checkbox"
                  defaultChecked={syncConfig?.syncMessages ?? true}
                  onChange={(e) => updateConfig.mutate({ syncMessages: e.target.checked })}
                  className="rounded"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-Create CRM Contacts</Label>
                <input
                  type="checkbox"
                  defaultChecked={syncConfig?.autoCreateContacts ?? true}
                  onChange={(e) => updateConfig.mutate({ autoCreateContacts: e.target.checked })}
                  className="rounded"
                />
              </div>
            </div>
            {syncConfig?.status === "active" && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  disconnect.mutate();
                  setIsConfigOpen(false);
                }}
              >
                <Unplug className="h-4 w-4 mr-2" />
                Disconnect LinkedIn
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
