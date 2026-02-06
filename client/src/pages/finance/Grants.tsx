import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileCheck,
  Plus,
  Search,
  Loader2,
  Calendar,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Trash2,
  DollarSign,
  Clock,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function formatCurrency(value: string | null | undefined) {
  const num = parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

const statusColors: Record<string, string> = {
  researching: "bg-slate-500/10 text-slate-600",
  drafting: "bg-blue-500/10 text-blue-600",
  internal_review: "bg-amber-500/10 text-amber-600",
  submitted: "bg-indigo-500/10 text-indigo-600",
  under_review: "bg-purple-500/10 text-purple-600",
  awarded: "bg-green-500/10 text-green-600",
  declined: "bg-red-500/10 text-red-600",
  withdrawn: "bg-gray-500/10 text-gray-600",
  completed: "bg-emerald-500/10 text-emerald-600",
};

const categoryColors: Record<string, string> = {
  federal: "bg-blue-500/10 text-blue-600",
  state: "bg-indigo-500/10 text-indigo-600",
  local: "bg-cyan-500/10 text-cyan-600",
  foundation: "bg-purple-500/10 text-purple-600",
  corporate: "bg-amber-500/10 text-amber-600",
  nonprofit: "bg-green-500/10 text-green-600",
  research: "bg-rose-500/10 text-rose-600",
  other: "bg-gray-500/10 text-gray-600",
};

const checklistCategoryColors: Record<string, string> = {
  documentation: "bg-blue-500/10 text-blue-600",
  financial: "bg-green-500/10 text-green-600",
  narrative: "bg-purple-500/10 text-purple-600",
  review: "bg-amber-500/10 text-amber-600",
  submission: "bg-indigo-500/10 text-indigo-600",
  reporting: "bg-rose-500/10 text-rose-600",
  other: "bg-gray-500/10 text-gray-600",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-600",
  medium: "bg-blue-500/10 text-blue-600",
  high: "bg-amber-500/10 text-amber-600",
  urgent: "bg-red-500/10 text-red-600",
};

const defaultForm = {
  title: "",
  funderName: "",
  funderContactEmail: "",
  programName: "",
  category: "other" as const,
  requestedAmount: "",
  deadlineDate: "",
  description: "",
  priority: "medium" as const,
  status: "researching" as const,
  applicationUrl: "",
};

const defaultChecklistForm = {
  title: "",
  description: "",
  category: "other" as const,
  dueDate: "",
};

export default function Grants() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<number | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [checklistForm, setChecklistForm] = useState(defaultChecklistForm);

  const utils = trpc.useUtils();

  const { data: grants, isLoading } = trpc.grants.list.useQuery();
  const { data: selectedGrant, isLoading: isGrantLoading } = trpc.grants.get.useQuery(
    { id: selectedGrantId! },
    { enabled: !!selectedGrantId }
  );

  const createGrant = trpc.grants.create.useMutation({
    onSuccess: () => {
      toast.success("Grant application created");
      setIsOpen(false);
      setFormData(defaultForm);
      utils.grants.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateGrant = trpc.grants.update.useMutation({
    onSuccess: () => {
      toast.success("Grant updated");
      utils.grants.list.invalidate();
      utils.grants.get.invalidate({ id: selectedGrantId! });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteGrant = trpc.grants.delete.useMutation({
    onSuccess: () => {
      toast.success("Grant deleted");
      setSelectedGrantId(null);
      utils.grants.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const createChecklistItem = trpc.grants.checklist.create.useMutation({
    onSuccess: () => {
      toast.success("Checklist item added");
      setIsChecklistOpen(false);
      setChecklistForm(defaultChecklistForm);
      utils.grants.get.invalidate({ id: selectedGrantId! });
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleChecklistItem = trpc.grants.checklist.toggle.useMutation({
    onSuccess: () => {
      utils.grants.get.invalidate({ id: selectedGrantId! });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteChecklistItem = trpc.grants.checklist.delete.useMutation({
    onSuccess: () => {
      utils.grants.get.invalidate({ id: selectedGrantId! });
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredGrants = grants?.filter((grant) => {
    const matchesSearch =
      grant.title.toLowerCase().includes(search.toLowerCase()) ||
      grant.funderName.toLowerCase().includes(search.toLowerCase()) ||
      grant.grantNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || grant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGrant.mutate({
      title: formData.title,
      funderName: formData.funderName,
      funderContactEmail: formData.funderContactEmail || undefined,
      programName: formData.programName || undefined,
      category: formData.category,
      requestedAmount: formData.requestedAmount || undefined,
      deadlineDate: formData.deadlineDate ? new Date(formData.deadlineDate) : undefined,
      description: formData.description || undefined,
      priority: formData.priority,
      status: formData.status,
      applicationUrl: formData.applicationUrl || undefined,
    });
  };

  const handleChecklistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrantId) return;
    createChecklistItem.mutate({
      grantId: selectedGrantId,
      title: checklistForm.title,
      description: checklistForm.description || undefined,
      category: checklistForm.category,
      dueDate: checklistForm.dueDate ? new Date(checklistForm.dueDate) : undefined,
      sortOrder: (selectedGrant?.checklist?.length ?? 0) + 1,
    });
  };

  // Summary stats
  const stats = {
    total: grants?.length ?? 0,
    active: grants?.filter((g) => ["drafting", "internal_review", "submitted", "under_review"].includes(g.status)).length ?? 0,
    awarded: grants?.filter((g) => g.status === "awarded").length ?? 0,
    totalRequested: grants?.reduce((sum, g) => sum + parseFloat(g.requestedAmount || "0"), 0) ?? 0,
    totalAwarded: grants?.filter((g) => g.status === "awarded").reduce((sum, g) => sum + parseFloat(g.awardedAmount || g.requestedAmount || "0"), 0) ?? 0,
  };

  // Detail view
  if (selectedGrantId) {
    const grant = selectedGrant;
    const checklist = grant?.checklist ?? [];
    const completedCount = checklist.filter((c: any) => c.isCompleted).length;
    const totalCount = checklist.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedGrantId(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Grants
          </Button>
        </div>

        {isGrantLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !grant ? (
          <div className="text-center py-12 text-muted-foreground">Grant not found</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{grant.title}</h1>
                  <Badge className={statusColors[grant.status]}>{grant.status.replace(/_/g, " ")}</Badge>
                  {grant.priority && (
                    <Badge className={priorityColors[grant.priority]}>{grant.priority}</Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1">
                  {grant.grantNumber} &middot; {grant.funderName}
                  {grant.programName && ` — ${grant.programName}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={grant.status}
                  onValueChange={(value: any) => updateGrant.mutate({ id: grant.id, status: value })}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="researching">Researching</SelectItem>
                    <SelectItem value="drafting">Drafting</SelectItem>
                    <SelectItem value="internal_review">Internal Review</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="awarded">Awarded</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Delete this grant application?")) {
                      deleteGrant.mutate({ id: grant.id });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Grant details cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    Requested Amount
                  </div>
                  <div className="text-2xl font-bold">
                    {grant.requestedAmount ? formatCurrency(grant.requestedAmount) : "—"}
                  </div>
                  {grant.awardedAmount && (
                    <div className="text-sm text-green-600 mt-1">
                      Awarded: {formatCurrency(grant.awardedAmount)}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    Deadline
                  </div>
                  <div className="text-2xl font-bold">
                    {grant.deadlineDate
                      ? format(new Date(grant.deadlineDate), "MMM d, yyyy")
                      : "—"}
                  </div>
                  {grant.submittedDate && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Submitted: {format(new Date(grant.submittedDate), "MMM d, yyyy")}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Checklist Progress
                  </div>
                  <div className="text-2xl font-bold">
                    {completedCount}/{totalCount}
                  </div>
                  {totalCount > 0 && (
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            {grant.description && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{grant.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Details grid */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Category</div>
                    <Badge className={categoryColors[grant.category]}>{grant.category}</Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Funder Contact</div>
                    <div>{grant.funderContactEmail || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Match Required</div>
                    <div>{grant.matchRequired ? `Yes — ${formatCurrency(grant.matchAmount)}` : "No"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Application URL</div>
                    {grant.applicationUrl ? (
                      <a href={grant.applicationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">
                        Link
                      </a>
                    ) : (
                      <div>—</div>
                    )}
                  </div>
                  {grant.startDate && (
                    <div>
                      <div className="text-muted-foreground">Grant Start</div>
                      <div>{format(new Date(grant.startDate), "MMM d, yyyy")}</div>
                    </div>
                  )}
                  {grant.endDate && (
                    <div>
                      <div className="text-muted-foreground">Grant End</div>
                      <div>{format(new Date(grant.endDate), "MMM d, yyyy")}</div>
                    </div>
                  )}
                  {grant.reportingDeadline && (
                    <div>
                      <div className="text-muted-foreground">Reporting Deadline</div>
                      <div>{format(new Date(grant.reportingDeadline), "MMM d, yyyy")}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-4 w-4" />
                    Application Checklist
                    {totalCount > 0 && (
                      <span className="text-muted-foreground font-normal text-sm">
                        ({completedCount}/{totalCount})
                      </span>
                    )}
                  </CardTitle>
                  <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handleChecklistSubmit}>
                        <DialogHeader>
                          <DialogTitle>Add Checklist Item</DialogTitle>
                          <DialogDescription>Add a task to the grant application checklist.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="checkTitle">Title *</Label>
                            <Input
                              id="checkTitle"
                              value={checklistForm.title}
                              onChange={(e) => setChecklistForm({ ...checklistForm, title: e.target.value })}
                              placeholder="e.g., Draft project narrative"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Category</Label>
                              <Select
                                value={checklistForm.category}
                                onValueChange={(v: any) => setChecklistForm({ ...checklistForm, category: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="documentation">Documentation</SelectItem>
                                  <SelectItem value="financial">Financial</SelectItem>
                                  <SelectItem value="narrative">Narrative</SelectItem>
                                  <SelectItem value="review">Review</SelectItem>
                                  <SelectItem value="submission">Submission</SelectItem>
                                  <SelectItem value="reporting">Reporting</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="checkDue">Due Date</Label>
                              <Input
                                id="checkDue"
                                type="date"
                                value={checklistForm.dueDate}
                                onChange={(e) => setChecklistForm({ ...checklistForm, dueDate: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="checkDesc">Description</Label>
                            <Textarea
                              id="checkDesc"
                              value={checklistForm.description}
                              onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                              placeholder="Additional details..."
                              rows={2}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsChecklistOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createChecklistItem.isPending}>
                            {createChecklistItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add Item
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {checklist.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>No checklist items yet</p>
                    <p className="text-sm">Add items to track your grant application progress.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {checklist.map((item: any) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                          item.isCompleted ? "bg-muted/50" : "hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={item.isCompleted}
                          onCheckedChange={() => toggleChecklistItem.mutate({ id: item.id })}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                            {item.title}
                          </div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${checklistCategoryColors[item.category]}`}>
                              {item.category}
                            </Badge>
                            {item.dueDate && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(item.dueDate), "MMM d, yyyy")}
                              </span>
                            )}
                            {item.isCompleted && item.completedAt && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Done {format(new Date(item.completedAt), "MMM d")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteChecklistItem.mutate({ id: item.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {grant.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{grant.notes}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-8 w-8" />
            Grant Applications
          </h1>
          <p className="text-muted-foreground mt-1">
            Track grant applications, deadlines, and checklists.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Grant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>New Grant Application</DialogTitle>
                <DialogDescription>
                  Create a new grant application to track.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Grant title or program name"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="funderName">Funder / Grantor *</Label>
                    <Input
                      id="funderName"
                      value={formData.funderName}
                      onChange={(e) => setFormData({ ...formData, funderName: e.target.value })}
                      placeholder="Organization name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="programName">Program Name</Label>
                    <Input
                      id="programName"
                      value={formData.programName}
                      onChange={(e) => setFormData({ ...formData, programName: e.target.value })}
                      placeholder="Specific program"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v: any) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="federal">Federal</SelectItem>
                        <SelectItem value="state">State</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="foundation">Foundation</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="nonprofit">Nonprofit</SelectItem>
                        <SelectItem value="research">Research</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(v: any) => setFormData({ ...formData, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="researching">Researching</SelectItem>
                        <SelectItem value="drafting">Drafting</SelectItem>
                        <SelectItem value="internal_review">Internal Review</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="requestedAmount">Requested Amount</Label>
                    <Input
                      id="requestedAmount"
                      type="number"
                      step="0.01"
                      value={formData.requestedAmount}
                      onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadlineDate">Deadline</Label>
                    <Input
                      id="deadlineDate"
                      type="date"
                      value={formData.deadlineDate}
                      onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="funderContactEmail">Funder Contact Email</Label>
                  <Input
                    id="funderContactEmail"
                    type="email"
                    value={formData.funderContactEmail}
                    onChange={(e) => setFormData({ ...formData, funderContactEmail: e.target.value })}
                    placeholder="contact@funder.org"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicationUrl">Application URL</Label>
                  <Input
                    id="applicationUrl"
                    value={formData.applicationUrl}
                    onChange={(e) => setFormData({ ...formData, applicationUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Grant description and goals..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createGrant.isPending}>
                  {createGrant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Grant
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Total Applications</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Active / In Progress</div>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Total Requested</div>
            <div className="text-2xl font-bold">{formatCurrency(String(stats.totalRequested))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Award className="h-3.5 w-3.5" /> Awarded
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(String(stats.totalAwarded))}</div>
          </CardContent>
        </Card>
      </div>

      {/* Grant list table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search grants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="researching">Researching</SelectItem>
                <SelectItem value="drafting">Drafting</SelectItem>
                <SelectItem value="internal_review">Internal Review</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="awarded">Awarded</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredGrants || filteredGrants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No grant applications found</p>
              <p className="text-sm">Create your first grant application to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grant #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Funder</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrants.map((grant) => (
                  <TableRow
                    key={grant.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedGrantId(grant.id)}
                  >
                    <TableCell className="font-mono text-sm">{grant.grantNumber}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{grant.title}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{grant.funderName}</TableCell>
                    <TableCell>
                      <Badge className={categoryColors[grant.category]}>{grant.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {grant.deadlineDate ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(grant.deadlineDate), "MMM d, yyyy")}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {grant.requestedAmount ? formatCurrency(grant.requestedAmount) : "—"}
                    </TableCell>
                    <TableCell>
                      {grant.priority && (
                        <Badge className={priorityColors[grant.priority]}>{grant.priority}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[grant.status]}>{grant.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
