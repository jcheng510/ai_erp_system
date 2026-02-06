import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
  Package,
  ArrowRight,
  GitBranch,
  Shield,
  Workflow,
  RotateCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AutonomousDashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");

  // Queries
  const statusQuery = trpc.autonomousWorkflows.orchestrator.status.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const workflowsQuery = trpc.autonomousWorkflows.workflows.list.useQuery();
  const runsQuery = trpc.autonomousWorkflows.runs.list.useQuery({ limit: 20 });
  const statsQuery = trpc.autonomousWorkflows.runs.stats.useQuery({});
  const metricsQuery = trpc.autonomousWorkflows.metrics.overview.useQuery({ days: 7 });
  const pipelinesQuery = trpc.autonomousWorkflows.pipelines.list.useQuery();
  const dlqQuery = trpc.autonomousWorkflows.diagnostics.deadLetterQueue.useQuery({ limit: 10 });

  // Mutations
  const startMutation = trpc.autonomousWorkflows.orchestrator.start.useMutation({
    onSuccess: () => statusQuery.refetch(),
  });
  const stopMutation = trpc.autonomousWorkflows.orchestrator.stop.useMutation({
    onSuccess: () => statusQuery.refetch(),
  });
  const triggerMutation = trpc.autonomousWorkflows.workflows.trigger.useMutation({
    onSuccess: () => runsQuery.refetch(),
  });
  const executePipelineMutation = trpc.autonomousWorkflows.pipelines.execute.useMutation({
    onSuccess: () => runsQuery.refetch(),
  });
  const retryDlqMutation = trpc.autonomousWorkflows.diagnostics.retryDlq.useMutation({
    onSuccess: () => {
      dlqQuery.refetch();
      runsQuery.refetch();
    },
  });

  const isRunning = statusQuery.data?.isRunning ?? false;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-600">Completed</Badge>;
      case "running":
        return <Badge className="bg-blue-500/20 text-blue-600">Running</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-600">Failed</Badge>;
      case "awaiting_approval":
        return <Badge className="bg-amber-500/20 text-amber-600">Awaiting Approval</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-500/20 text-gray-600">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const circuitBreaker = statusQuery.data?.circuitBreaker;
  const cbColor = circuitBreaker?.state === "closed" ? "text-green-600" : circuitBreaker?.state === "open" ? "text-red-600" : "text-amber-600";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Autonomous Supply Chain
          </h1>
          <p className="text-muted-foreground">
            Monitor and control automated supply chain workflows and pipelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              statusQuery.refetch();
              runsQuery.refetch();
              pipelinesQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => (isRunning ? stopMutation.mutate() : startMutation.mutate())}
            variant={isRunning ? "destructive" : "default"}
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop Agent
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Agent
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
            <div className={`h-3 w-3 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isRunning ? "Running" : "Stopped"}</div>
            <p className="text-xs text-muted-foreground">
              {statusQuery.data?.activeWorkflows || 0} active workflows
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Runs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusQuery.data?.todayMetrics?.totalRuns || 0}</div>
            <p className="text-xs text-muted-foreground">
              {statusQuery.data?.todayMetrics?.completed || 0} completed, {statusQuery.data?.todayMetrics?.failed || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusQuery.data?.pendingApprovals || 0}</div>
            <p className="text-xs text-muted-foreground">Waiting for review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Exceptions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusQuery.data?.openExceptions || 0}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Circuit Breaker</CardTitle>
            <Shield className={`h-4 w-4 ${cbColor}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${cbColor}`}>
              {circuitBreaker?.state || "closed"}
            </div>
            <p className="text-xs text-muted-foreground">
              {circuitBreaker?.failureCount || 0} recent failures
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Metrics */}
      {metricsQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">7-Day Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-blue-600">{metricsQuery.data.totalRuns || 0}</div>
                <div className="text-sm text-muted-foreground">Total Runs</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-green-600">{metricsQuery.data.successfulRuns || 0}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-purple-600">{metricsQuery.data.aiDecisions || 0}</div>
                <div className="text-sm text-muted-foreground">AI Decisions</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-amber-600">{metricsQuery.data.itemsProcessed || 0}</div>
                <div className="text-sm text-muted-foreground">Items Processed</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-emerald-600">
                  ${((metricsQuery.data.totalValue || 0) / 1000).toFixed(0)}k
                </div>
                <div className="text-sm text-muted-foreground">Value Processed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Workflows</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="runs">Recent Runs</TabsTrigger>
          <TabsTrigger value="dlq">Dead Letter Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configured Workflows</CardTitle>
              <CardDescription>
                All autonomous workflows and their current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflowsQuery.data?.map((workflow) => {
                    const total = (workflow.successCount || 0) + (workflow.failureCount || 0);
                    const successRate = total > 0 ? ((workflow.successCount || 0) / total) * 100 : 100;

                    return (
                      <TableRow key={workflow.id}>
                        <TableCell className="font-medium">{workflow.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{workflow.workflowType.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{workflow.triggerType}</TableCell>
                        <TableCell>
                          {workflow.isActive ? (
                            <Badge className="bg-green-500/20 text-green-600">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {workflow.lastRunAt
                            ? formatDistanceToNow(new Date(workflow.lastRunAt), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={successRate} className="h-2 w-16" />
                            <span className="text-xs">{successRate.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => triggerMutation.mutate({ id: workflow.id })}
                            disabled={triggerMutation.isPending || !workflow.isActive}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Workflow Pipelines
              </CardTitle>
              <CardDescription>
                Multi-stage automated pipelines that chain workflows together with dependency resolution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pipelinesQuery.data?.map((pipeline) => (
                <Card key={pipeline.id} className="border-dashed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{pipeline.name}</CardTitle>
                        <CardDescription>{pipeline.description}</CardDescription>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => executePipelineMutation.mutate({ pipelineId: pipeline.id })}
                        disabled={executePipelineMutation.isPending}
                      >
                        <Workflow className="h-4 w-4 mr-2" />
                        Execute Pipeline
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center flex-wrap gap-2">
                      {pipeline.stages.map((stage: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="text-xs py-1"
                          >
                            {stage.workflowType.replace(/_/g, " ")}
                          </Badge>
                          {idx < pipeline.stages.length - 1 && (
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {pipeline.stageCount} stages | Dependencies auto-resolved | Parallel where possible
                    </div>
                  </CardContent>
                </Card>
              ))}

              {executePipelineMutation.isSuccess && (
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Pipeline execution completed: {executePipelineMutation.data?.stagesCompleted}/{executePipelineMutation.data?.stagesTotal} stages,{" "}
                      {executePipelineMutation.data?.duration}ms
                      {(executePipelineMutation.data?.awaitingApproval?.length ?? 0) > 0 && (
                        <span className="text-amber-600 ml-2">
                          ({executePipelineMutation.data?.awaitingApproval?.length} awaiting approval)
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Workflow Runs</CardTitle>
              <CardDescription>Latest execution history with retry and duration tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run ID</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Triggered</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsQuery.data?.map(({ run, workflow }) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-xs">{run.runNumber}</TableCell>
                      <TableCell>{workflow.name}</TableCell>
                      <TableCell>{getStatusBadge(run.status)}</TableCell>
                      <TableCell className="capitalize">{run.triggeredBy}</TableCell>
                      <TableCell>
                        {(run.attemptNumber ?? 1) > 1 ? (
                          <Badge variant="outline" className="text-amber-600">
                            #{run.attemptNumber}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">#1</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "-"}
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600">{run.itemsSucceeded}</span>
                        {(run.itemsFailed ?? 0) > 0 && (
                          <span className="text-red-600 ml-1">/ {run.itemsFailed}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.startedAt
                          ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dlq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Dead Letter Queue
              </CardTitle>
              <CardDescription>
                Workflows that failed permanently after exhausting all retry attempts. These require manual review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dlqQuery.data && dlqQuery.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Failed At</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dlqQuery.data.map(({ run, workflow }: any) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-mono text-xs">{run.runNumber}</TableCell>
                        <TableCell>{workflow.name}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-red-600 text-xs">
                          {run.errorMessage?.replace("[DLQ] ", "")}
                        </TableCell>
                        <TableCell>{run.attemptNumber}</TableCell>
                        <TableCell>
                          {run.completedAt
                            ? formatDistanceToNow(new Date(run.completedAt), { addSuffix: true })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryDlqMutation.mutate({ runId: run.id })}
                            disabled={retryDlqMutation.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Retry
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No items in dead letter queue</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
