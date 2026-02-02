import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  TrendingUp, Target, DollarSign, Users, Mail, Zap, Trophy, BarChart3,
  PlayCircle, PauseCircle, Settings, Plus, RefreshCw, Calendar, Clock,
  ArrowUpRight, ArrowDownRight, Activity, Briefcase, Award, Bot, Filter,
  ChevronRight, Star, AlertTriangle, CheckCircle2, XCircle, Timer
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// KPI Card component
function KPICard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  subtitle,
  color = "blue"
}: {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: any;
  subtitle?: string;
  color?: "blue" | "green" | "amber" | "red" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change && (
              <div className="flex items-center gap-1 text-sm">
                {changeType === "positive" && <ArrowUpRight className="h-4 w-4 text-green-600" />}
                {changeType === "negative" && <ArrowDownRight className="h-4 w-4 text-red-600" />}
                <span className={changeType === "positive" ? "text-green-600" : changeType === "negative" ? "text-red-600" : "text-muted-foreground"}>
                  {change}
                </span>
              </div>
            )}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quota Progress Card
function QuotaProgressCard({ quota }: { quota: any }) {
  const attainment = Number(quota.attainmentPercent) || 0;
  const isOnTrack = attainment >= (new Date().getDate() / 30) * 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{quota.periodType} Quota</CardTitle>
          <Badge variant={isOnTrack ? "default" : "destructive"}>
            {isOnTrack ? "On Track" : "Behind"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold">{attainment.toFixed(0)}%</span>
            <span className="text-sm text-muted-foreground">
              ${Number(quota.revenueAchieved || 0).toLocaleString()} / ${Number(quota.revenueQuota || 0).toLocaleString()}
            </span>
          </div>
          <Progress value={Math.min(attainment, 100)} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{quota.dealCountAchieved || 0} deals closed</span>
            <span>Target: {quota.dealCountQuota || '-'} deals</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Automation Rule Card
function AutomationRuleCard({ rule, onToggle, onEdit }: { rule: any; onToggle: () => void; onEdit: () => void }) {
  const triggerLabels: Record<string, string> = {
    deal_created: "Deal Created",
    deal_stage_changed: "Stage Changed",
    deal_won: "Deal Won",
    deal_lost: "Deal Lost",
    deal_stalled: "Deal Stalled",
    contact_created: "Contact Created",
    email_opened: "Email Opened",
    email_clicked: "Email Clicked",
    no_activity: "No Activity",
    follow_up_due: "Follow-up Due",
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${rule.isActive ? "text-amber-500" : "text-muted-foreground"}`} />
              <h4 className="font-medium">{rule.name}</h4>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{rule.description || "No description"}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">{triggerLabels[rule.triggerType] || rule.triggerType}</Badge>
              <span className="text-xs text-muted-foreground">
                {rule.totalExecutions || 0} executions
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={rule.isActive} onCheckedChange={onToggle} />
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Email Sequence Card
function SequenceCard({ sequence, onManage }: { sequence: any; onManage: () => void }) {
  const completionRate = sequence.totalEnrolled > 0
    ? ((sequence.totalCompleted / sequence.totalEnrolled) * 100).toFixed(0)
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Mail className={`h-4 w-4 ${sequence.isActive ? "text-blue-500" : "text-muted-foreground"}`} />
              <h4 className="font-medium">{sequence.name}</h4>
              {sequence.isActive && <Badge variant="default" className="text-xs">Active</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{sequence.description || "No description"}</p>
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div>
                <span className="text-muted-foreground">Enrolled</span>
                <p className="font-medium">{sequence.totalEnrolled || 0}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Completed</span>
                <p className="font-medium">{sequence.totalCompleted || 0}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Converted</span>
                <p className="font-medium">{sequence.totalConverted || 0}</p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onManage}>
            Manage
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Leaderboard Card
function LeaderboardCard({ rankings, title, metric }: { rankings: any[]; title: string; metric: string }) {
  if (!rankings || rankings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rankings.slice(0, 5).map((item: any, index: number) => (
            <div key={item.userId} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? "bg-amber-100 text-amber-700" :
                index === 1 ? "bg-gray-100 text-gray-700" :
                index === 2 ? "bg-orange-100 text-orange-700" :
                "bg-muted text-muted-foreground"
              }`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">User #{item.userId}</p>
              </div>
              <span className="text-sm font-bold">
                {metric === "revenue" ? `$${Number(item.value).toLocaleString()}` : item.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Goal Card
function GoalCard({ goal }: { goal: any }) {
  const progress = Number(goal.progressPercent) || 0;
  const statusColors: Record<string, string> = {
    not_started: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    at_risk: "bg-red-100 text-red-700",
    on_track: "bg-green-100 text-green-700",
    achieved: "bg-emerald-100 text-emerald-700",
    missed: "bg-red-100 text-red-700",
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-medium">{goal.name}</h4>
            <p className="text-sm text-muted-foreground">{goal.description}</p>
          </div>
          <Badge className={statusColors[goal.status] || "bg-gray-100"}>
            {goal.status?.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span className="font-medium">{progress.toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{goal.currentValue} / {goal.targetValue} {goal.targetUnit}</span>
            <span>Due: {goal.endDate ? new Date(goal.endDate).toLocaleDateString() : "N/A"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Pipeline Stage Card
function PipelineStageCard({ stage, deals }: { stage: string; deals: any[] }) {
  const stageDeals = deals.filter(d => d.stage === stage);
  const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  return (
    <div className="bg-muted/50 rounded-lg p-3 min-w-[250px]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm">{stage}</h4>
        <Badge variant="outline">{stageDeals.length}</Badge>
      </div>
      <p className="text-lg font-bold mb-3">${totalValue.toLocaleString()}</p>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {stageDeals.map(deal => (
          <Card key={deal.id} className="cursor-pointer hover:shadow-sm">
            <CardContent className="p-3">
              <h5 className="font-medium text-sm truncate">{deal.name}</h5>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-muted-foreground">${Number(deal.amount || 0).toLocaleString()}</span>
                <Badge variant="outline" className="text-xs">{deal.probability}%</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {stageDeals.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No deals</p>
        )}
      </div>
    </div>
  );
}

export default function SalesAutomationHub() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month" | "quarter" | "year">("month");
  const [showNewRuleDialog, setShowNewRuleDialog] = useState(false);
  const [showNewSequenceDialog, setShowNewSequenceDialog] = useState(false);

  // Fetch dashboard metrics
  const { data: dashboardMetrics } = trpc.salesAutomation.metrics.getDashboard.useQuery({ period: selectedPeriod });
  const { data: pipelineHealth } = trpc.salesAutomation.metrics.getPipelineHealth.useQuery({});
  const { data: salesVelocity } = trpc.salesAutomation.metrics.getSalesVelocity.useQuery({});

  // Fetch quotas
  const { data: quotas } = trpc.salesAutomation.quotas.list.useQuery({ status: "active" });

  // Fetch automation rules
  const { data: automationRules, refetch: refetchRules } = trpc.salesAutomation.rules.list.useQuery({});

  // Fetch sequences
  const { data: sequences, refetch: refetchSequences } = trpc.salesAutomation.sequences.list.useQuery({});

  // Fetch goals
  const { data: goals } = trpc.salesAutomation.goals.list.useQuery({});

  // Fetch leaderboard
  const { data: leaderboard } = trpc.salesAutomation.leaderboard.getCurrent.useQuery({ periodType: "monthly" });

  // Fetch deals for pipeline view
  const { data: deals } = trpc.crm.deals.list.useQuery({ status: "open" });

  // Fetch forecasts
  const { data: forecasts } = trpc.salesAutomation.forecasting.list.useQuery({ limit: 6 });

  // Mutations
  const updateRule = trpc.salesAutomation.rules.update.useMutation({
    onSuccess: () => {
      toast.success("Rule updated");
      refetchRules();
    },
    onError: (err) => toast.error(err.message),
  });

  const generateForecast = trpc.salesAutomation.forecasting.generate.useMutation({
    onSuccess: () => toast.success("Forecast generated"),
    onError: (err) => toast.error(err.message),
  });

  // Parse leaderboard rankings
  const revenueRankings = leaderboard?.revenueRankings ? JSON.parse(leaderboard.revenueRankings as string) : [];
  const activityRankings = leaderboard?.activityRankings ? JSON.parse(leaderboard.activityRankings as string) : [];

  // Calculate pipeline stages
  const pipelineStages = ["new", "contacted", "qualified", "proposal", "negotiation"];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Automation Hub</h1>
          <p className="text-muted-foreground">Million dollar sales system with AI-powered automations</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => generateForecast.mutate({ period: new Date().toISOString().slice(0, 7), useAI: true })}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Forecast
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="pipeline"><Briefcase className="h-4 w-4 mr-2" />Pipeline</TabsTrigger>
          <TabsTrigger value="automations"><Zap className="h-4 w-4 mr-2" />Automations</TabsTrigger>
          <TabsTrigger value="sequences"><Mail className="h-4 w-4 mr-2" />Sequences</TabsTrigger>
          <TabsTrigger value="performance"><Trophy className="h-4 w-4 mr-2" />Performance</TabsTrigger>
          <TabsTrigger value="forecasting"><TrendingUp className="h-4 w-4 mr-2" />Forecasting</TabsTrigger>
        </TabsList>

        {/* DASHBOARD TAB */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-5 gap-4">
            <KPICard
              title="Total Revenue"
              value={`$${Number(dashboardMetrics?.totalRevenue || 0).toLocaleString()}`}
              change="+12% vs last period"
              changeType="positive"
              icon={DollarSign}
              color="green"
            />
            <KPICard
              title="Pipeline Value"
              value={`$${Number(dashboardMetrics?.pipelineValue || 0).toLocaleString()}`}
              subtitle={`Weighted: $${Number(dashboardMetrics?.weightedPipeline || 0).toLocaleString()}`}
              icon={TrendingUp}
              color="blue"
            />
            <KPICard
              title="Win Rate"
              value={`${salesVelocity?.winRatePercent?.toFixed(1) || 0}%`}
              change={Number(salesVelocity?.winRatePercent || 0) >= 25 ? "Above average" : "Below average"}
              changeType={Number(salesVelocity?.winRatePercent || 0) >= 25 ? "positive" : "negative"}
              icon={Target}
              color={Number(salesVelocity?.winRatePercent || 0) >= 25 ? "green" : "amber"}
            />
            <KPICard
              title="Avg Deal Size"
              value={`$${Number(dashboardMetrics?.avgDealSize || 0).toLocaleString()}`}
              icon={Award}
              color="purple"
            />
            <KPICard
              title="Activities"
              value={String(dashboardMetrics?.totalActivities || 0)}
              subtitle={`${dashboardMetrics?.emailsSent || 0} emails, ${dashboardMetrics?.callsMade || 0} calls`}
              icon={Activity}
              color="amber"
            />
          </div>

          {/* Quota and Pipeline Health */}
          <div className="grid grid-cols-3 gap-6">
            {/* Current Quota */}
            <div className="col-span-1">
              {quotas && quotas.length > 0 ? (
                <QuotaProgressCard quota={quotas[0]} />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Quota</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">No active quota</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Pipeline Health */}
            <div className="col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Pipeline Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{pipelineHealth?.totalDeals || 0}</p>
                      <p className="text-xs text-muted-foreground">Open Deals</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">${Number(pipelineHealth?.totalValue || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Value</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{pipelineHealth?.avgDealAge?.toFixed(0) || 0}</p>
                      <p className="text-xs text-muted-foreground">Avg Age (days)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{pipelineHealth?.dealsAtRisk || 0}</p>
                      <p className="text-xs text-muted-foreground">At Risk</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Goals and Leaderboards */}
          <div className="grid grid-cols-3 gap-6">
            {/* Active Goals */}
            <div className="col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                    <Button variant="ghost" size="sm">View All</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {goals?.slice(0, 4).map((goal: any) => (
                      <GoalCard key={goal.id} goal={goal} />
                    ))}
                    {(!goals || goals.length === 0) && (
                      <p className="text-muted-foreground col-span-2 text-center py-8">No active goals</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Leaderboard */}
            <LeaderboardCard rankings={revenueRankings} title="Revenue Leaders" metric="revenue" />
          </div>
        </TabsContent>

        {/* PIPELINE TAB */}
        <TabsContent value="pipeline" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Sales Pipeline</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Deal
              </Button>
            </div>
          </div>

          {/* Pipeline Board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pipelineStages.map(stage => (
              <PipelineStageCard key={stage} stage={stage} deals={deals || []} />
            ))}
          </div>

          {/* Sales Velocity Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sales Velocity</CardTitle>
              <CardDescription>Average time from lead to close</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-3xl font-bold">{salesVelocity?.totalDeals || 0}</p>
                  <p className="text-sm text-muted-foreground">Deals Won</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">${Number(salesVelocity?.avgDealSize || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{salesVelocity?.avgSalesCycle?.toFixed(0) || 0}</p>
                  <p className="text-sm text-muted-foreground">Avg Sales Cycle (days)</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">${salesVelocity?.salesVelocity?.toFixed(0) || 0}</p>
                  <p className="text-sm text-muted-foreground">Daily Velocity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUTOMATIONS TAB */}
        <TabsContent value="automations" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Sales Automations</h2>
              <p className="text-sm text-muted-foreground">Configure automated workflows to accelerate your sales</p>
            </div>
            <Button onClick={() => setShowNewRuleDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Automation
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-6">
                <Bot className="h-8 w-8 text-blue-600 mb-2" />
                <h3 className="font-semibold">Lead Scoring</h3>
                <p className="text-sm text-muted-foreground">Automatically score and prioritize leads</p>
                <Button variant="link" className="p-0 mt-2">Configure Rules</Button>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="pt-6">
                <Zap className="h-8 w-8 text-amber-600 mb-2" />
                <h3 className="font-semibold">Stage Automation</h3>
                <p className="text-sm text-muted-foreground">Auto-trigger actions on stage changes</p>
                <Button variant="link" className="p-0 mt-2">Configure Rules</Button>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="pt-6">
                <Clock className="h-8 w-8 text-green-600 mb-2" />
                <h3 className="font-semibold">Follow-up Reminders</h3>
                <p className="text-sm text-muted-foreground">Never miss a follow-up</p>
                <Button variant="link" className="p-0 mt-2">Configure Rules</Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">Active Automation Rules</h3>
            {automationRules?.map((rule: any) => (
              <AutomationRuleCard
                key={rule.id}
                rule={rule}
                onToggle={() => updateRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                onEdit={() => {}}
              />
            ))}
            {(!automationRules || automationRules.length === 0) && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No automation rules configured</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowNewRuleDialog(true)}>
                    Create Your First Automation
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* SEQUENCES TAB */}
        <TabsContent value="sequences" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Email Sequences</h2>
              <p className="text-sm text-muted-foreground">Automated email drip campaigns to nurture leads</p>
            </div>
            <Button onClick={() => setShowNewSequenceDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Sequence
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <KPICard
              title="Active Sequences"
              value={String(sequences?.filter((s: any) => s.isActive).length || 0)}
              icon={PlayCircle}
              color="green"
            />
            <KPICard
              title="Total Enrolled"
              value={String(sequences?.reduce((sum: number, s: any) => sum + (s.totalEnrolled || 0), 0) || 0)}
              icon={Users}
              color="blue"
            />
            <KPICard
              title="Completed"
              value={String(sequences?.reduce((sum: number, s: any) => sum + (s.totalCompleted || 0), 0) || 0)}
              icon={CheckCircle2}
              color="green"
            />
            <KPICard
              title="Converted"
              value={String(sequences?.reduce((sum: number, s: any) => sum + (s.totalConverted || 0), 0) || 0)}
              icon={Star}
              color="amber"
            />
          </div>

          <div className="space-y-3">
            {sequences?.map((sequence: any) => (
              <SequenceCard key={sequence.id} sequence={sequence} onManage={() => {}} />
            ))}
            {(!sequences || sequences.length === 0) && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No email sequences created</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowNewSequenceDialog(true)}>
                    Create Your First Sequence
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* PERFORMANCE TAB */}
        <TabsContent value="performance" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Sales Performance</h2>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <LeaderboardCard rankings={revenueRankings} title="Revenue Leaderboard" metric="revenue" />
            <LeaderboardCard rankings={activityRankings} title="Activity Leaderboard" metric="count" />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Commission Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-bold text-amber-600">$0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Approved</span>
                    <span className="font-bold text-blue-600">$0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Paid (YTD)</span>
                    <span className="font-bold text-green-600">$0</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quota Attainment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {quotas?.map((quota: any) => (
                  <QuotaProgressCard key={quota.id} quota={quota} />
                ))}
                {(!quotas || quotas.length === 0) && (
                  <p className="text-muted-foreground col-span-3 text-center py-8">No quotas assigned</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FORECASTING TAB */}
        <TabsContent value="forecasting" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Sales Forecasting</h2>
              <p className="text-sm text-muted-foreground">AI-powered revenue predictions</p>
            </div>
            <Button onClick={() => generateForecast.mutate({ period: new Date().toISOString().slice(0, 7), useAI: true })}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Forecast
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {forecasts?.slice(0, 4).map((forecast: any) => (
              <Card key={forecast.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{forecast.forecastPeriod}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Commit</span>
                      <span className="text-sm font-medium">${Number(forecast.commitAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Best Case</span>
                      <span className="text-sm font-medium">${Number(forecast.bestCaseAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Pipeline</span>
                      <span className="text-sm font-medium">${Number(forecast.pipelineAmount || 0).toLocaleString()}</span>
                    </div>
                    {forecast.aiPredictedAmount && (
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-xs text-blue-600">AI Predicted</span>
                        <span className="text-sm font-bold text-blue-600">${Number(forecast.aiPredictedAmount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Forecast Accuracy</CardTitle>
              <CardDescription>Historical accuracy of forecasts vs actuals</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Accuracy data will appear after periods close
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Automation Rule Dialog */}
      <Dialog open={showNewRuleDialog} onOpenChange={setShowNewRuleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Automation Rule</DialogTitle>
            <DialogDescription>Set up automated actions based on triggers</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input placeholder="e.g., Welcome Email on New Lead" />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deal_created">Deal Created</SelectItem>
                  <SelectItem value="deal_stage_changed">Deal Stage Changed</SelectItem>
                  <SelectItem value="deal_won">Deal Won</SelectItem>
                  <SelectItem value="deal_lost">Deal Lost</SelectItem>
                  <SelectItem value="contact_created">Contact Created</SelectItem>
                  <SelectItem value="follow_up_due">Follow-up Due</SelectItem>
                  <SelectItem value="no_activity">No Activity (Stalled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe what this automation does" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRuleDialog(false)}>Cancel</Button>
            <Button>Create Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Sequence Dialog */}
      <Dialog open={showNewSequenceDialog} onOpenChange={setShowNewSequenceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Email Sequence</DialogTitle>
            <DialogDescription>Build an automated email campaign</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sequence Name</Label>
              <Input placeholder="e.g., New Lead Nurture" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nurture">Lead Nurture</SelectItem>
                  <SelectItem value="onboarding">Customer Onboarding</SelectItem>
                  <SelectItem value="re_engagement">Re-engagement</SelectItem>
                  <SelectItem value="upsell">Upsell</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe the purpose of this sequence" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Send on Weekends</Label>
                <p className="text-xs text-muted-foreground">Allow emails to be sent on weekends</p>
              </div>
              <Switch />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSequenceDialog(false)}>Cancel</Button>
            <Button>Create Sequence</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
