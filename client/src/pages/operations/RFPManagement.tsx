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
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Brain,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Eye,
  Sparkles,
  Calendar,
  Building,
  DollarSign,
  Clock,
  Target,
  FileCheck
} from "lucide-react";

export default function RFPManagement() {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedRfp, setSelectedRfp] = useState<any>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form states
  const [newRfp, setNewRfp] = useState({
    title: "",
    issuingOrganization: "",
    contactEmail: "",
    documentContent: "",
    priority: "normal" as const,
  });

  const [generateForm, setGenerateForm] = useState({
    title: "",
    projectDescription: "",
    requirements: "",
    budget: "",
    timeline: "",
  });

  // Queries
  const { data: incomingRfps, refetch: refetchIncoming } = trpc.rfp.documents.list.useQuery({});
  const { data: generatedRfps, refetch: refetchGenerated } = trpc.rfp.generated.list.useQuery({});
  const { data: templates } = trpc.rfp.templates.list.useQuery();

  // Mutations
  const createRfpMutation = trpc.rfp.documents.create.useMutation({
    onSuccess: (data) => {
      toast.success("RFP uploaded successfully");
      refetchIncoming();
      setShowUploadDialog(false);
      return data;
    },
    onError: (error) => toast.error(error.message),
  });

  const parseRfpMutation = trpc.rfp.documents.parseWithAI.useMutation({
    onSuccess: () => {
      toast.success("RFP parsed successfully with AI");
      refetchIncoming();
      setIsParsing(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsParsing(false);
    },
  });

  const generateRfpMutation = trpc.rfp.generated.generateWithAI.useMutation({
    onSuccess: (data) => {
      toast.success(`RFP ${data.rfpNumber} generated successfully`);
      refetchGenerated();
      setShowGenerateDialog(false);
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsGenerating(false);
    },
  });

  const handleUploadAndParse = async () => {
    if (!newRfp.title || !newRfp.documentContent) {
      toast.error("Please provide a title and document content");
      return;
    }

    setIsParsing(true);
    const rfpNumber = `RFP-${Date.now().toString().slice(-8)}`;

    try {
      const result = await createRfpMutation.mutateAsync({
        rfpNumber,
        title: newRfp.title,
        issuingOrganization: newRfp.issuingOrganization,
        contactEmail: newRfp.contactEmail,
        priority: newRfp.priority,
      });

      await parseRfpMutation.mutateAsync({
        id: result.id,
        documentContent: newRfp.documentContent,
      });
    } catch (e) {
      setIsParsing(false);
    }
  };

  const handleGenerateRfp = () => {
    if (!generateForm.title || !generateForm.projectDescription) {
      toast.error("Please provide a title and project description");
      return;
    }

    setIsGenerating(true);
    generateRfpMutation.mutate({
      title: generateForm.title,
      projectDescription: generateForm.projectDescription,
      requirements: generateForm.requirements ? generateForm.requirements.split("\n").filter(r => r.trim()) : undefined,
      budget: generateForm.budget || undefined,
      timeline: generateForm.timeline || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      uploaded: "outline",
      parsing: "secondary",
      parsed: "default",
      ready: "default",
      responded: "default",
      won: "default",
      lost: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">RFP Management</h1>
          <p className="text-muted-foreground">Parse incoming RFPs and generate new proposals with AI</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button><Upload className="h-4 w-4 mr-2" />Upload RFP</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload & Parse RFP</DialogTitle>
                <DialogDescription>Upload an RFP document to parse with AI</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={newRfp.title}
                      onChange={(e) => setNewRfp({ ...newRfp, title: e.target.value })}
                      placeholder="RFP Title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Issuing Organization</Label>
                    <Input
                      value={newRfp.issuingOrganization}
                      onChange={(e) => setNewRfp({ ...newRfp, issuingOrganization: e.target.value })}
                      placeholder="Organization name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input
                      value={newRfp.contactEmail}
                      onChange={(e) => setNewRfp({ ...newRfp, contactEmail: e.target.value })}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newRfp.priority} onValueChange={(v: any) => setNewRfp({ ...newRfp, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Document Content *</Label>
                  <Textarea
                    value={newRfp.documentContent}
                    onChange={(e) => setNewRfp({ ...newRfp, documentContent: e.target.value })}
                    placeholder="Paste the RFP document content here..."
                    className="min-h-[200px]"
                  />
                </div>
                <Button onClick={handleUploadAndParse} disabled={isParsing} className="w-full">
                  {isParsing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Parsing with AI...</>
                  ) : (
                    <><Brain className="h-4 w-4 mr-2" />Upload & Parse with AI</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline"><Sparkles className="h-4 w-4 mr-2" />Generate RFP</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Generate RFP with AI</DialogTitle>
                <DialogDescription>Create a professional RFP document using AI</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Project Title *</Label>
                  <Input
                    value={generateForm.title}
                    onChange={(e) => setGenerateForm({ ...generateForm, title: e.target.value })}
                    placeholder="e.g., Website Redesign Project"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Description *</Label>
                  <Textarea
                    value={generateForm.projectDescription}
                    onChange={(e) => setGenerateForm({ ...generateForm, projectDescription: e.target.value })}
                    placeholder="Describe the project scope, goals, and requirements..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Key Requirements (one per line)</Label>
                  <Textarea
                    value={generateForm.requirements}
                    onChange={(e) => setGenerateForm({ ...generateForm, requirements: e.target.value })}
                    placeholder="Responsive design\nSEO optimization\nCMS integration"
                    className="min-h-[80px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Budget Range</Label>
                    <Input
                      value={generateForm.budget}
                      onChange={(e) => setGenerateForm({ ...generateForm, budget: e.target.value })}
                      placeholder="e.g., $50,000 - $75,000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeline</Label>
                    <Input
                      value={generateForm.timeline}
                      onChange={(e) => setGenerateForm({ ...generateForm, timeline: e.target.value })}
                      placeholder="e.g., 3-4 months"
                    />
                  </div>
                </div>
                <Button onClick={handleGenerateRfp} disabled={isGenerating} className="w-full">
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating RFP...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" />Generate RFP with AI</>
                  )}
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
            <CardTitle className="text-sm font-medium">Incoming RFPs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incomingRfps?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total uploaded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {incomingRfps?.filter(r => r.responseStatus === 'not_started').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Generated RFPs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{generatedRfps?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Created with AI</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="incoming">
        <TabsList>
          <TabsTrigger value="incoming">Incoming RFPs</TabsTrigger>
          <TabsTrigger value="generated">Generated RFPs</TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incoming RFPs</CardTitle>
              <CardDescription>RFPs received from customers for bidding</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RFP Number</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomingRfps?.map((rfp) => (
                    <TableRow key={rfp.id}>
                      <TableCell className="font-mono">{rfp.rfpNumber}</TableCell>
                      <TableCell>{rfp.title}</TableCell>
                      <TableCell>{rfp.issuingOrganization || "-"}</TableCell>
                      <TableCell>
                        {rfp.proposalDueDate ? new Date(rfp.proposalDueDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(rfp.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rfp.responseStatus || "not_started"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRfp(rfp);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!incomingRfps || incomingRfps.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No incoming RFPs. Upload one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generated" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated RFPs</CardTitle>
              <CardDescription>RFPs created to send to vendors</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RFP Number</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>AI Generated</TableHead>
                    <TableHead>Proposals</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedRfps?.map((rfp) => (
                    <TableRow key={rfp.id}>
                      <TableCell className="font-mono">{rfp.rfpNumber}</TableCell>
                      <TableCell>{rfp.title}</TableCell>
                      <TableCell>{getStatusBadge(rfp.status)}</TableCell>
                      <TableCell>
                        {rfp.proposalDueDate ? new Date(rfp.proposalDueDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        {rfp.aiGenerated ? (
                          <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{rfp.receivedProposalCount || 0}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!generatedRfps || generatedRfps.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No generated RFPs. Create one to send to vendors.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* RFP Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRfp?.title}</DialogTitle>
            <DialogDescription>RFP Details and AI Analysis</DialogDescription>
          </DialogHeader>
          {selectedRfp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Organization</Label>
                  <p className="font-medium">{selectedRfp.issuingOrganization || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p className="font-medium">
                    {selectedRfp.proposalDueDate ? new Date(selectedRfp.proposalDueDate).toLocaleDateString() : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estimated Budget</Label>
                  <p className="font-medium">
                    {selectedRfp.estimatedBudget ? `$${parseFloat(selectedRfp.estimatedBudget).toLocaleString()}` : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contract Duration</Label>
                  <p className="font-medium">{selectedRfp.contractDuration ? `${selectedRfp.contractDuration} months` : "-"}</p>
                </div>
              </div>

              {selectedRfp.executiveSummary && (
                <div>
                  <Label className="text-muted-foreground">Executive Summary</Label>
                  <p className="mt-1 text-sm">{selectedRfp.executiveSummary}</p>
                </div>
              )}

              {selectedRfp.scopeOfWork && (
                <div>
                  <Label className="text-muted-foreground">Scope of Work</Label>
                  <p className="mt-1 text-sm">{selectedRfp.scopeOfWork}</p>
                </div>
              )}

              {selectedRfp.aiKeyInsights && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Brain className="h-4 w-4" />AI Key Insights
                  </Label>
                  <ul className="mt-1 text-sm list-disc list-inside space-y-1">
                    {JSON.parse(selectedRfp.aiKeyInsights).map((insight: string, i: number) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRfp.aiRecommendedActions && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />Recommended Actions
                  </Label>
                  <ul className="mt-1 text-sm list-disc list-inside space-y-1">
                    {JSON.parse(selectedRfp.aiRecommendedActions).map((action: string, i: number) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
