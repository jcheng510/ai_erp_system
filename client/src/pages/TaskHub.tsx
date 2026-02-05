import { useState, useMemo } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { trpc } from "../lib/trpc";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus, Search, Filter, LayoutGrid, List, Calendar as CalendarIcon,
  Clock, MoreHorizontal, MessageSquare, User, Tag, CheckCircle2,
  AlertCircle, Circle, ChevronDown, Settings, Bell, Trash2, Edit, Eye,
  ArrowUpDown, ArrowUp, ArrowDown, Send, ExternalLink
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";

type Task = {
  id: number;
  projectId: number;
  name: string;
  title?: string;
  description: string | null;
  assigneeId: number | null;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  completedDate: Date | string | null;
  estimatedHours: string | null;
  actualHours: string | null;
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  projectName: string | null;
};

type ViewType = "table" | "kanban" | "calendar" | "gallery";

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do", color: "bg-gray-500" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { value: "review", label: "Review", color: "bg-yellow-500" },
  { value: "completed", label: "Completed", color: "bg-green-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "text-green-600", icon: ArrowDown },
  { value: "medium", label: "Medium", color: "text-yellow-600", icon: ArrowUpDown },
  { value: "high", label: "High", color: "text-orange-600", icon: ArrowUp },
  { value: "critical", label: "Critical", color: "text-red-600", icon: AlertCircle },
];

const getStatusColor = (status: string) => {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || "bg-gray-500";
};

const getPriorityInfo = (priority: string) => {
  return PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1];
};

const formatDate = (date: Date | string | null) => {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
};

const isOverdue = (dueDate: Date | string | null, status: string) => {
  if (!dueDate || status === "completed" || status === "cancelled") return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return isBefore(d, startOfDay(new Date()));
};

const isDueSoon = (dueDate: Date | string | null, status: string) => {
  if (!dueDate || status === "completed" || status === "cancelled") return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const tomorrow = addDays(startOfDay(new Date()), 1);
  return isAfter(d, startOfDay(new Date())) && isBefore(d, tomorrow);
};

// Task Card Component for Kanban View
function TaskCard({ task, onClick, onStatusChange }: {
  task: Task;
  onClick: () => void;
  onStatusChange: (status: string) => void;
}) {
  const priorityInfo = getPriorityInfo(task.priority);
  const PriorityIcon = priorityInfo.icon;

  return (
    <div
      className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm line-clamp-2">{task.name}</h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {STATUS_OPTIONS.map(status => (
              <DropdownMenuItem
                key={status.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(status.value);
                }}
              >
                <div className={cn("w-2 h-2 rounded-full mr-2", status.color)} />
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <PriorityIcon className={cn("h-3 w-3", priorityInfo.color)} />
          {task.dueDate && (
            <span className={cn(
              isOverdue(task.dueDate, task.status) && "text-red-600 font-medium",
              isDueSoon(task.dueDate, task.status) && "text-yellow-600"
            )}>
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
        {task.assigneeName && (
          <div className="flex items-center gap-1 text-gray-500">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{task.assigneeName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Kanban Column Component
function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onStatusChange
}: {
  status: typeof STATUS_OPTIONS[0];
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: number, status: string) => void;
}) {
  return (
    <div className="flex-shrink-0 w-72 bg-gray-50 dark:bg-zinc-900 rounded-lg">
      <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", status.color)} />
            <span className="font-medium">{status.label}</span>
            <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
          </div>
        </div>
      </div>
      <div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onStatusChange={(newStatus) => onStatusChange(task.id, newStatus)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

// Task Detail Dialog
function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
  onDelete: (id: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Task>>({});
  const [newComment, setNewComment] = useState("");

  const { data: comments = [], refetch: refetchComments } = trpc.projects.getTaskComments.useQuery(
    { taskId: task?.id ?? 0 },
    { enabled: !!task?.id && open }
  );

  const { data: activity = [] } = trpc.projects.getTaskActivity.useQuery(
    { taskId: task?.id ?? 0, limit: 20 },
    { enabled: !!task?.id && open }
  );

  const addComment = trpc.projects.addTaskComment.useMutation({
    onSuccess: () => {
      setNewComment("");
      refetchComments();
      toast.success("Comment added");
    },
  });

  const sendNotification = trpc.googleChat.sendTaskNotification.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Notification sent to Google Chat");
      } else {
        toast.error(result.error || "Failed to send notification");
      }
    },
  });

  if (!task) return null;

  const handleSave = () => {
    onUpdate(task.id, editData);
    setIsEditing(false);
    setEditData({});
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate({ taskId: task.id, content: newComment });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editData.name ?? task.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="text-lg font-semibold"
                />
              ) : (
                <DialogTitle className="text-lg">{task.name}</DialogTitle>
              )}
              <DialogDescription className="mt-1">
                {task.projectName && `${task.projectName} • `}
                Created {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(!isEditing)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {isEditing ? "Cancel Edit" : "Edit"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => sendNotification.mutate({ taskId: task.id, notificationType: "status_changed" })}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Notify Team
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => {
                      onDelete(task.id);
                      onOpenChange(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select
                value={editData.status ?? task.status}
                onValueChange={(value) => {
                  if (isEditing) {
                    setEditData({ ...editData, status: value });
                  } else {
                    onUpdate(task.id, { status: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", status.color)} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={editData.priority ?? task.priority}
                onValueChange={(value) => {
                  if (isEditing) {
                    setEditData({ ...editData, priority: value });
                  } else {
                    onUpdate(task.id, { priority: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(priority => {
                    const Icon = priority.icon;
                    return (
                      <SelectItem key={priority.value} value={priority.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", priority.color)} />
                          {priority.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editData.dueDate ? format(new Date(editData.dueDate), "yyyy-MM-dd") :
                       task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""}
                onChange={(e) => setEditData({ ...editData, dueDate: e.target.value ? new Date(e.target.value) : null })}
                disabled={!isEditing}
              />
            </div>
            <div>
              <Label>Assignee</Label>
              <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/50">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{task.assigneeName || "Unassigned"}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            {isEditing ? (
              <Textarea
                value={editData.description ?? task.description ?? ""}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={4}
                placeholder="Add a description..."
              />
            ) : (
              <div className="min-h-[80px] p-3 border rounded-md bg-muted/50 text-sm">
                {task.description || <span className="text-muted-foreground">No description</span>}
              </div>
            )}
          </div>

          <Separator />

          {/* Comments Section */}
          <div>
            <Label className="mb-2 block">Comments ({comments.length})</Label>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-3 p-2 bg-muted/30 rounded-md">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">User</span>
                      <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
                      {comment.isEdited && <span>(edited)</span>}
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <Button onClick={handleAddComment} disabled={!newComment.trim() || addComment.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Activity Log */}
          <div>
            <Label className="mb-2 block">Activity</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto text-sm">
              {activity.map((item: any) => (
                <div key={item.id} className="flex items-center gap-2 text-muted-foreground">
                  <Circle className="h-2 w-2" />
                  <span>{item.activityType.replace(/_/g, " ")}</span>
                  {item.newValue && <span className="font-medium text-foreground">{item.newValue}</span>}
                  <span className="text-xs">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isEditing && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditing(false); setEditData({}); }}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Create Task Dialog
function CreateTaskDialog({
  open,
  onOpenChange,
  onCreate,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: any) => void;
  projects: { id: number; name: string }[];
}) {
  const [formData, setFormData] = useState({
    projectId: 0,
    name: "",
    description: "",
    status: "todo",
    priority: "medium",
    dueDate: "",
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Task name is required");
      return;
    }
    onCreate({
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
    });
    setFormData({ projectId: 0, name: "", description: "", status: "todo", priority: "medium", dueDate: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to your project. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Project</Label>
            <Select
              value={formData.projectId.toString()}
              onValueChange={(value) => setFormData({ ...formData, projectId: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No Project</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Task Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter task name"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add a description..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", status.color)} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(priority => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Google Chat Settings Dialog
function GoogleChatSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: spaces = [], refetch: refetchSpaces } = trpc.googleChat.listSpaces.useQuery(undefined, { enabled: open });
  const { data: preferences } = trpc.googleChat.getMyPreferences.useQuery(undefined, { enabled: open });

  const [newSpace, setNewSpace] = useState({ spaceName: "", webhookUrl: "" });
  const [showAddSpace, setShowAddSpace] = useState(false);

  const createSpace = trpc.googleChat.createSpace.useMutation({
    onSuccess: () => {
      toast.success("Chat space added");
      refetchSpaces();
      setNewSpace({ spaceName: "", webhookUrl: "" });
      setShowAddSpace(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const testWebhook = trpc.googleChat.testWebhook.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Webhook test successful!");
      } else {
        toast.error(result.error || "Test failed");
      }
    },
  });

  const deleteSpace = trpc.googleChat.deleteSpace.useMutation({
    onSuccess: () => {
      toast.success("Space removed");
      refetchSpaces();
    },
  });

  const updatePreferences = trpc.googleChat.updateMyPreferences.useMutation({
    onSuccess: () => toast.success("Preferences saved"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Google Chat Integration</DialogTitle>
          <DialogDescription>
            Configure Google Chat spaces for task notifications
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="spaces">
          <TabsList className="w-full">
            <TabsTrigger value="spaces" className="flex-1">Chat Spaces</TabsTrigger>
            <TabsTrigger value="preferences" className="flex-1">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="spaces" className="space-y-4">
            <div className="space-y-2">
              {spaces.map((space: any) => (
                <div key={space.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium">{space.spaceName}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {space.webhookUrl}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testWebhook.mutate({ webhookUrl: space.webhookUrl })}
                    >
                      Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => deleteSpace.mutate({ id: space.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {spaces.length === 0 && !showAddSpace && (
                <div className="text-center py-8 text-muted-foreground">
                  No chat spaces configured
                </div>
              )}
            </div>

            {showAddSpace ? (
              <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                <Input
                  placeholder="Space Name (e.g., Project Team)"
                  value={newSpace.spaceName}
                  onChange={(e) => setNewSpace({ ...newSpace, spaceName: e.target.value })}
                />
                <Input
                  placeholder="Webhook URL"
                  value={newSpace.webhookUrl}
                  onChange={(e) => setNewSpace({ ...newSpace, webhookUrl: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAddSpace(false)}>Cancel</Button>
                  <Button
                    onClick={() => createSpace.mutate(newSpace)}
                    disabled={!newSpace.spaceName || !newSpace.webhookUrl}
                  >
                    Add Space
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setShowAddSpace(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Chat Space
              </Button>
            )}
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Task Assignments</Label>
                  <p className="text-xs text-muted-foreground">Notify when assigned a task</p>
                </div>
                <Switch
                  checked={preferences?.receiveTaskAssignments ?? true}
                  onCheckedChange={(checked) =>
                    updatePreferences.mutate({ receiveTaskAssignments: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Due Date Reminders</Label>
                  <p className="text-xs text-muted-foreground">Remind when tasks are due soon</p>
                </div>
                <Switch
                  checked={preferences?.receiveDueDateReminders ?? true}
                  onCheckedChange={(checked) =>
                    updatePreferences.mutate({ receiveDueDateReminders: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mentions</Label>
                  <p className="text-xs text-muted-foreground">Notify when mentioned in comments</p>
                </div>
                <Switch
                  checked={preferences?.receiveMentions ?? true}
                  onCheckedChange={(checked) =>
                    updatePreferences.mutate({ receiveMentions: checked })
                  }
                />
              </div>
              <Separator />
              <div>
                <Label>Google Chat User ID</Label>
                <Input
                  placeholder="Your Google Chat user ID for mentions"
                  defaultValue={preferences?.googleChatUserId ?? ""}
                  onBlur={(e) => updatePreferences.mutate({ googleChatUserId: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Enable direct mentions in chat
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Main TaskHub Component
export default function TaskHub() {
  const [viewType, setViewType] = useState<ViewType>("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<number>(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Queries
  const { data: tasks = [], isLoading, refetch } = trpc.projects.allTasks.useQuery({
    projectId: projectFilter > 0 ? projectFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
  });

  const { data: projects = [] } = trpc.projects.list.useQuery({});
  const { data: dueSoonTasks = [] } = trpc.projects.getTasksDueSoon.useQuery({ daysAhead: 3 });
  const { data: overdueTasks = [] } = trpc.projects.getOverdueTasks.useQuery();

  // Mutations
  const createTask = trpc.projects.addTask.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateTask = trpc.projects.updateTask.useMutation({
    onSuccess: () => {
      toast.success("Task updated");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteTask = trpc.projects.deleteTask.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  // Filter and search tasks
  const filteredTasks = useMemo(() => {
    return (tasks as Task[]).filter(task => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!task.name.toLowerCase().includes(query) &&
            !(task.description?.toLowerCase().includes(query))) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, searchQuery]);

  // Group tasks by status for Kanban view
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    STATUS_OPTIONS.forEach(status => {
      grouped[status.value] = filteredTasks.filter(task => task.status === status.value);
    });
    return grouped;
  }, [filteredTasks]);

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTask.mutate({ id: taskId, status: newStatus as any });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Task Hub</h1>
            <p className="text-muted-foreground">Manage your tasks across all projects</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowSettingsDialog(true)}>
              <Bell className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Total Tasks</div>
              <List className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mt-1">{tasks.length}</div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">In Progress</div>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-blue-600">
              {(tasks as Task[]).filter(t => t.status === "in_progress").length}
            </div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Due Soon</div>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-yellow-600">{dueSoonTasks.length}</div>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Overdue</div>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-red-600">{overdueTasks.length}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={projectFilter.toString()} onValueChange={(v) => setProjectFilter(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Projects</SelectItem>
                {(projects as any[]).map(project => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", status.color)} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {PRIORITY_OPTIONS.map(priority => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View Switcher */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewType === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewType("table")}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewType === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewType("kanban")}
              className="rounded-none border-x"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewType === "calendar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewType("calendar")}
              className="rounded-none border-r"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewType === "gallery" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewType("gallery")}
              className="rounded-l-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        {isLoading ? (
          <div className="text-center py-12">Loading tasks...</div>
        ) : viewType === "table" ? (
          /* Table View */
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map(task => {
                  const priorityInfo = getPriorityInfo(task.priority);
                  const PriorityIcon = priorityInfo.icon;
                  return (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedTask(task)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{task.name}</div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-white", getStatusColor(task.status))}>
                          {STATUS_OPTIONS.find(s => s.value === task.status)?.label || task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PriorityIcon className={cn("h-4 w-4", priorityInfo.color)} />
                          <span className={priorityInfo.color}>{priorityInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.assigneeName ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-3 w-3" />
                            </div>
                            <span className="text-sm">{task.assigneeName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          isOverdue(task.dueDate, task.status) && "text-red-600 font-medium",
                          isDueSoon(task.dueDate, task.status) && "text-yellow-600"
                        )}>
                          {formatDate(task.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{task.projectName || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {STATUS_OPTIONS.map(status => (
                              <DropdownMenuItem
                                key={status.value}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(task.id, status.value);
                                }}
                              >
                                <div className={cn("w-2 h-2 rounded-full mr-2", status.color)} />
                                {status.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTask.mutate({ id: task.id });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No tasks found. Create your first task to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : viewType === "kanban" ? (
          /* Kanban View */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_OPTIONS.map(status => (
              <KanbanColumn
                key={status.value}
                status={status}
                tasks={tasksByStatus[status.value] || []}
                onTaskClick={setSelectedTask}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        ) : viewType === "gallery" ? (
          /* Gallery View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => setSelectedTask(task)}
                onStatusChange={(status) => handleStatusChange(task.id, status)}
              />
            ))}
            {filteredTasks.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No tasks found
              </div>
            )}
          </div>
        ) : (
          /* Calendar View - Simple placeholder */
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Calendar view coming soon</p>
            <p className="text-sm mt-2">
              {filteredTasks.filter(t => t.dueDate).length} tasks with due dates
            </p>
          </div>
        )}

        {/* Dialogs */}
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          onUpdate={(id, data) => updateTask.mutate({ id, ...data } as any)}
          onDelete={(id) => deleteTask.mutate({ id })}
        />

        <CreateTaskDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreate={(data) => createTask.mutate(data)}
          projects={(projects as any[]).map(p => ({ id: p.id, name: p.name }))}
        />

        <GoogleChatSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
        />
      </div>
    </DashboardLayout>
  );
}
