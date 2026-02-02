import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Mic,
  Video,
  FileText,
  Brain,
  Upload,
  Loader2,
  Plus,
  Eye,
  CheckCircle,
  Clock,
  Users,
  Calendar,
  ListTodo,
  Send,
  Settings,
  Link2,
  Unlink,
  ExternalLink
} from "lucide-react";

export default function MeetingNotes() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showNotionDialog, setShowNotionDialog] = useState(false);
  const [showTranscriptDialog, setShowTranscriptDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [newMeeting, setNewMeeting] = useState({
    title: "",
    platform: "manual_upload" as const,
    meetingUrl: "",
    scheduledStart: "",
    scheduledEnd: "",
    participants: "",
    projectId: "",
    notes: "",
  });

  const [transcriptInput, setTranscriptInput] = useState("");

  const [notionSettings, setNotionSettings] = useState({
    accessToken: "",
    workspaceName: "",
    defaultDatabaseId: "",
    tasksDatabaseId: "",
    syncMeetingNotes: true,
    syncActionItems: true,
  });

  // Queries
  const { data: meetings, refetch: refetchMeetings } = trpc.meetings.recordings.list.useQuery({});
  const { data: actionItems, refetch: refetchActionItems } = trpc.meetings.actionItems.list.useQuery({});
  const { data: notionIntegration, refetch: refetchNotion } = trpc.meetings.notion.getIntegration.useQuery();
  const { data: notionDatabases } = trpc.meetings.notion.listDatabases.useQuery(undefined, {
    enabled: !!notionIntegration,
  });
  const { data: projects } = trpc.projects.list.useQuery({});
  const { data: meetingDetail, refetch: refetchDetail } = trpc.meetings.recordings.get.useQuery(
    { id: selectedMeeting?.id },
    { enabled: !!selectedMeeting?.id }
  );

  // Mutations
  const createMeetingMutation = trpc.meetings.recordings.create.useMutation({
    onSuccess: (data) => {
      toast.success("Meeting recording created");
      refetchMeetings();
      setShowCreateDialog(false);
      setSelectedMeeting({ id: data.id });
    },
    onError: (error) => toast.error(error.message),
  });

  const transcribeAnalyzeMutation = trpc.meetings.recordings.transcribeAndAnalyze.useMutation({
    onSuccess: () => {
      toast.success("Meeting analyzed successfully");
      refetchMeetings();
      refetchDetail();
      refetchActionItems();
      setIsAnalyzing(false);
      setShowTranscriptDialog(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsAnalyzing(false);
    },
  });

  const syncToNotionMutation = trpc.meetings.recordings.syncToNotion.useMutation({
    onSuccess: (data) => {
      toast.success("Meeting synced to Notion");
      refetchMeetings();
      refetchDetail();
      setIsSyncing(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSyncing(false);
    },
  });

  const connectNotionMutation = trpc.meetings.notion.connect.useMutation({
    onSuccess: () => {
      toast.success("Notion connected successfully");
      refetchNotion();
      setShowNotionDialog(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateNotionSettingsMutation = trpc.meetings.notion.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Notion settings updated");
      refetchNotion();
    },
    onError: (error) => toast.error(error.message),
  });

  const disconnectNotionMutation = trpc.meetings.notion.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Notion disconnected");
      refetchNotion();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateActionItemMutation = trpc.meetings.actionItems.update.useMutation({
    onSuccess: () => {
      toast.success("Action item updated");
      refetchActionItems();
      refetchDetail();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCreateMeeting = () => {
    if (!newMeeting.title) {
      toast.error("Please provide a meeting title");
      return;
    }
    createMeetingMutation.mutate({
      title: newMeeting.title,
      platform: newMeeting.platform,
      meetingUrl: newMeeting.meetingUrl || undefined,
      scheduledStart: newMeeting.scheduledStart ? new Date(newMeeting.scheduledStart) : undefined,
      scheduledEnd: newMeeting.scheduledEnd ? new Date(newMeeting.scheduledEnd) : undefined,
      participants: newMeeting.participants || undefined,
      projectId: newMeeting.projectId ? parseInt(newMeeting.projectId) : undefined,
      notes: newMeeting.notes || undefined,
    });
  };

  const handleAnalyze = () => {
    if (!selectedMeeting || !transcriptInput.trim()) {
      toast.error("Please provide transcript text");
      return;
    }
    setIsAnalyzing(true);
    transcribeAnalyzeMutation.mutate({
      id: selectedMeeting.id,
      transcriptText: transcriptInput,
    });
  };

  const handleSyncToNotion = () => {
    if (!selectedMeeting) return;
    setIsSyncing(true);
    syncToNotionMutation.mutate({ id: selectedMeeting.id });
  };

  const handleConnectNotion = () => {
    if (!notionSettings.accessToken) {
      toast.error("Please provide Notion access token");
      return;
    }
    connectNotionMutation.mutate({
      accessToken: notionSettings.accessToken,
      workspaceName: notionSettings.workspaceName || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      scheduled: "outline",
      recording: "secondary",
      processing: "secondary",
      transcribed: "default",
      analyzed: "default",
      synced: "default",
      failed: "destructive",
    };
    const icons: Record<string, any> = {
      analyzed: <Brain className="h-3 w-3 mr-1" />,
      synced: <CheckCircle className="h-3 w-3 mr-1" />,
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {icons[status]}{status}
      </Badge>
    );
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'zoom': return <Video className="h-4 w-4" />;
      case 'google_meet': return <Video className="h-4 w-4" />;
      case 'teams': return <Video className="h-4 w-4" />;
      default: return <Mic className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Meeting Notes</h1>
          <p className="text-muted-foreground">AI-powered meeting transcription and Notion integration</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNotionDialog} onOpenChange={setShowNotionDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                {notionIntegration ? (
                  <><Settings className="h-4 w-4 mr-2" />Notion Settings</>
                ) : (
                  <><Link2 className="h-4 w-4 mr-2" />Connect Notion</>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {notionIntegration ? "Notion Integration Settings" : "Connect to Notion"}
                </DialogTitle>
                <DialogDescription>
                  {notionIntegration
                    ? `Connected to ${notionIntegration.workspaceName || 'Notion workspace'}`
                    : "Enter your Notion integration token to sync meeting notes"}
                </DialogDescription>
              </DialogHeader>

              {notionIntegration ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Meeting Notes Database</Label>
                    <Select
                      value={notionIntegration.defaultDatabaseId || ""}
                      onValueChange={(v) => updateNotionSettingsMutation.mutate({ defaultDatabaseId: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select database" /></SelectTrigger>
                      <SelectContent>
                        {notionDatabases?.map((db: any) => (
                          <SelectItem key={db.id} value={db.id}>{db.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tasks Database</Label>
                    <Select
                      value={notionIntegration.tasksDatabaseId || ""}
                      onValueChange={(v) => updateNotionSettingsMutation.mutate({ tasksDatabaseId: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select database for tasks" /></SelectTrigger>
                      <SelectContent>
                        {notionDatabases?.map((db: any) => (
                          <SelectItem key={db.id} value={db.id}>{db.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="syncNotes"
                      checked={notionIntegration.syncMeetingNotes}
                      onCheckedChange={(checked) =>
                        updateNotionSettingsMutation.mutate({ syncMeetingNotes: !!checked })
                      }
                    />
                    <label htmlFor="syncNotes" className="text-sm">Sync meeting notes</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="syncTasks"
                      checked={notionIntegration.syncActionItems}
                      onCheckedChange={(checked) =>
                        updateNotionSettingsMutation.mutate({ syncActionItems: !!checked })
                      }
                    />
                    <label htmlFor="syncTasks" className="text-sm">Sync action items as tasks</label>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => disconnectNotionMutation.mutate()}
                    className="w-full"
                  >
                    <Unlink className="h-4 w-4 mr-2" />Disconnect Notion
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Notion Integration Token *</Label>
                    <Input
                      type="password"
                      value={notionSettings.accessToken}
                      onChange={(e) => setNotionSettings({ ...notionSettings, accessToken: e.target.value })}
                      placeholder="secret_..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Create an integration at notion.so/my-integrations
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Workspace Name</Label>
                    <Input
                      value={notionSettings.workspaceName}
                      onChange={(e) => setNotionSettings({ ...notionSettings, workspaceName: e.target.value })}
                      placeholder="My Workspace"
                    />
                  </div>
                  <Button onClick={handleConnectNotion} className="w-full">
                    <Link2 className="h-4 w-4 mr-2" />Connect to Notion
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Meeting</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Meeting Recording</DialogTitle>
                <DialogDescription>Add a new meeting to transcribe and analyze</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Meeting Title *</Label>
                  <Input
                    value={newMeeting.title}
                    onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                    placeholder="e.g., Weekly Team Standup"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select
                      value={newMeeting.platform}
                      onValueChange={(v: any) => setNewMeeting({ ...newMeeting, platform: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zoom">Zoom</SelectItem>
                        <SelectItem value="google_meet">Google Meet</SelectItem>
                        <SelectItem value="teams">Microsoft Teams</SelectItem>
                        <SelectItem value="webex">Webex</SelectItem>
                        <SelectItem value="manual_upload">Manual Upload</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={newMeeting.projectId}
                      onValueChange={(v) => setNewMeeting({ ...newMeeting, projectId: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Link to project" /></SelectTrigger>
                      <SelectContent>
                        {projects?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="datetime-local"
                      value={newMeeting.scheduledStart}
                      onChange={(e) => setNewMeeting({ ...newMeeting, scheduledStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="datetime-local"
                      value={newMeeting.scheduledEnd}
                      onChange={(e) => setNewMeeting({ ...newMeeting, scheduledEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Participants</Label>
                  <Input
                    value={newMeeting.participants}
                    onChange={(e) => setNewMeeting({ ...newMeeting, participants: e.target.value })}
                    placeholder="John, Jane, Bob"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newMeeting.notes}
                    onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                    placeholder="Meeting agenda or notes..."
                  />
                </div>
                <Button onClick={handleCreateMeeting} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />Create Meeting
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meetings?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings?.filter(m => m.status === 'analyzed' || m.status === 'synced').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Action Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {actionItems?.filter((a: any) => a.actionItem?.status === 'pending').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notion Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {notionIntegration ? (
                <><CheckCircle className="h-5 w-5 text-green-500" />Connected</>
              ) : (
                <><Unlink className="h-5 w-5 text-gray-400" />Not Connected</>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="meetings">
        <TabsList>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="actions">Action Items</TabsTrigger>
        </TabsList>

        <TabsContent value="meetings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Recordings</CardTitle>
              <CardDescription>Transcribe and analyze your meetings with AI</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notion</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings?.map((meeting) => (
                    <TableRow key={meeting.id}>
                      <TableCell className="font-medium">{meeting.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(meeting.platform)}
                          {meeting.platform?.replace(/_/g, " ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {meeting.scheduledStart
                          ? new Date(meeting.scheduledStart).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {meeting.duration ? `${Math.round(meeting.duration / 60)} min` : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                      <TableCell>
                        {meeting.notionPageId ? (
                          <Badge variant="secondary">
                            <CheckCircle className="h-3 w-3 mr-1" />Synced
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not synced</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMeeting(meeting);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!meeting.aiSummary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedMeeting(meeting);
                                setShowTranscriptDialog(true);
                              }}
                            >
                              <Brain className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!meetings || meetings.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No meetings yet. Create one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
              <CardDescription>Tasks extracted from meeting transcripts</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Meeting</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notion</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionItems?.map((item: any) => (
                    <TableRow key={item.actionItem?.id || item.id}>
                      <TableCell className="max-w-xs truncate">
                        {item.actionItem?.description || item.description}
                      </TableCell>
                      <TableCell>{item.meeting?.title || "-"}</TableCell>
                      <TableCell>{item.actionItem?.assignee || item.assignee || "-"}</TableCell>
                      <TableCell>
                        {(item.actionItem?.dueDate || item.dueDate)
                          ? new Date(item.actionItem?.dueDate || item.dueDate).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          (item.actionItem?.priority || item.priority) === 'urgent' ? 'destructive' :
                          (item.actionItem?.priority || item.priority) === 'high' ? 'default' : 'outline'
                        }>
                          {item.actionItem?.priority || item.priority || "medium"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          (item.actionItem?.status || item.status) === 'completed' ? 'default' : 'secondary'
                        }>
                          {item.actionItem?.status || item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(item.actionItem?.notionSynced || item.notionSynced) ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(item.actionItem?.status || item.status) !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateActionItemMutation.mutate({
                                id: item.actionItem?.id || item.id,
                                status: 'completed',
                              })}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!actionItems || actionItems.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No action items yet. Analyze a meeting to extract tasks.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Meeting Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{meetingDetail?.title}</DialogTitle>
            <DialogDescription>
              {meetingDetail?.platform?.replace(/_/g, " ")} -
              {meetingDetail?.scheduledStart
                ? new Date(meetingDetail.scheduledStart).toLocaleString()
                : ""}
            </DialogDescription>
          </DialogHeader>

          {meetingDetail && (
            <div className="space-y-6">
              {/* Status and Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusBadge(meetingDetail.status)}
                  {meetingDetail.notionPageId && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://notion.so/${meetingDetail.notionPageId.replace(/-/g, '')}`} target="_blank">
                        <ExternalLink className="h-4 w-4 mr-1" />View in Notion
                      </a>
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {!meetingDetail.aiSummary && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTranscriptDialog(true)}
                    >
                      <Brain className="h-4 w-4 mr-2" />Analyze
                    </Button>
                  )}
                  {meetingDetail.aiSummary && !meetingDetail.notionPageId && notionIntegration && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncToNotion}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Sync to Notion
                    </Button>
                  )}
                </div>
              </div>

              {/* AI Summary */}
              {meetingDetail.aiSummary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4" />AI Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{meetingDetail.aiSummary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Key Points */}
              {meetingDetail.aiKeyPoints && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Key Points</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      {JSON.parse(meetingDetail.aiKeyPoints).map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Action Items */}
              {meetingDetail.actionItems?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ListTodo className="h-4 w-4" />Action Items ({meetingDetail.actionItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {meetingDetail.actionItems.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={item.status === 'completed'}
                              onCheckedChange={(checked) =>
                                updateActionItemMutation.mutate({
                                  id: item.id,
                                  status: checked ? 'completed' : 'pending',
                                })
                              }
                            />
                            <span className={item.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                              {item.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.assignee && (
                              <Badge variant="outline">{item.assignee}</Badge>
                            )}
                            <Badge variant={item.priority === 'urgent' ? 'destructive' : 'secondary'}>
                              {item.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Decisions */}
              {meetingDetail.aiDecisions && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Decisions Made</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      {JSON.parse(meetingDetail.aiDecisions).map((decision: string, i: number) => (
                        <li key={i}>{decision}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Transcript */}
              {meetingDetail.transcriptText && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm whitespace-pre-wrap max-h-60 overflow-y-auto bg-muted p-4 rounded">
                      {meetingDetail.transcriptText}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transcript Input Dialog */}
      <Dialog open={showTranscriptDialog} onOpenChange={setShowTranscriptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Analyze Meeting</DialogTitle>
            <DialogDescription>
              Paste the meeting transcript to extract insights and action items
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meeting Transcript *</Label>
              <Textarea
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                placeholder="Paste your meeting transcript here..."
                className="min-h-[300px]"
              />
            </div>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing with AI...</>
              ) : (
                <><Brain className="h-4 w-4 mr-2" />Analyze Transcript</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
