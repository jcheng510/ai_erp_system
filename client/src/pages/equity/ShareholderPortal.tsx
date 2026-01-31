import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  TrendingUp,
  FileText,
  Bell,
  Clock,
  DollarSign,
  Percent,
  Download,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ShareholderPortal() {
  const { data: summary, isLoading: loadingSummary } = trpc.capTable.portal.mySummary.useQuery();
  const { data: holdings, isLoading: loadingHoldings } = trpc.capTable.portal.myHoldings.useQuery();
  const { data: grants, isLoading: loadingGrants } = trpc.capTable.portal.myGrants.useQuery();
  const { data: documents, isLoading: loadingDocs } = trpc.capTable.portal.myDocuments.useQuery();
  const { data: notifications } = trpc.capTable.portal.myNotifications.useQuery({ unreadOnly: false });

  const markRead = trpc.capTable.portal.markNotificationRead.useMutation({
    onSuccess: () => {
      toast.success("Notification marked as read");
    },
  });

  const isLoading = loadingSummary || loadingHoldings || loadingGrants;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-24">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h2 className="text-2xl font-semibold mb-2">No Equity Information</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You don't have any equity holdings or grants associated with your account yet.
            Contact your company administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  const grantTypeColors: Record<string, string> = {
    iso: "bg-green-500/10 text-green-600",
    nso: "bg-blue-500/10 text-blue-600",
    rsu: "bg-purple-500/10 text-purple-600",
    rsa: "bg-amber-500/10 text-amber-600",
    warrant: "bg-red-500/10 text-red-600",
    phantom: "bg-gray-500/10 text-gray-600",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600",
    fully_vested: "bg-blue-500/10 text-blue-600",
    partially_exercised: "bg-purple-500/10 text-purple-600",
    fully_exercised: "bg-cyan-500/10 text-cyan-600",
    cancelled: "bg-red-500/10 text-red-600",
    expired: "bg-gray-500/10 text-gray-600",
  };

  const unreadCount = notifications?.filter(n => !n.readAt).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-8 w-8" />
          My Equity
        </h1>
        <p className="text-muted-foreground mt-1">
          View your equity holdings, grants, and documents.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shares Owned</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(summary.totalShares)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {summary.holdingsCount} holding(s)
            </p>
          </CardContent>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vested Options</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(summary.totalVestedOptions)}
            </div>
            <p className="text-xs text-muted-foreground">
              Exercisable now
            </p>
          </CardContent>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unvested Options</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatNumber(summary.totalUnvestedOptions)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending vesting
            </p>
          </CardContent>
        </Card>
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.estimatedValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              @ ${summary.pricePerShare?.toFixed(4) || "0.00"}/share
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="grants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grants">
            <TrendingUp className="h-4 w-4 mr-2" />
            Grants ({summary.grantsCount})
          </TabsTrigger>
          <TabsTrigger value="holdings">
            <Wallet className="h-4 w-4 mr-2" />
            Holdings ({summary.holdingsCount})
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Grants Tab */}
        <TabsContent value="grants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equity Grants</CardTitle>
              <CardDescription>
                Your stock options, RSUs, and other equity grants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!grants || grants.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No grants found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {grants.map((grant) => (
                    <div key={grant.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">
                            {grant.grantNumber || `Grant #${grant.id}`}
                          </h3>
                          <Badge className={grantTypeColors[grant.grantType]}>
                            {grant.grantType.toUpperCase()}
                          </Badge>
                          <Badge className={statusColors[grant.status]}>
                            {grant.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatNumber(Number(grant.sharesGranted))} shares
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @ ${grant.exercisePrice}/share
                          </div>
                        </div>
                      </div>

                      {/* Vesting Progress */}
                      {grant.vestingInfo && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Vesting Progress</span>
                            <span className="font-medium">
                              {grant.vestingInfo.percentVested}% vested
                            </span>
                          </div>
                          <Progress value={grant.vestingInfo.percentVested} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatNumber(grant.vestingInfo.vestedShares)} vested</span>
                            <span>{formatNumber(grant.vestingInfo.unvestedShares)} unvested</span>
                          </div>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Grant Date</div>
                          <div className="font-medium">{formatDate(grant.grantDate)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Vesting Start</div>
                          <div className="font-medium">{formatDate(grant.vestingStartDate)}</div>
                        </div>
                        {grant.expirationDate && (
                          <div>
                            <div className="text-muted-foreground">Expiration</div>
                            <div className="font-medium">{formatDate(grant.expirationDate)}</div>
                          </div>
                        )}
                      </div>

                      {/* Exercise Summary */}
                      {(Number(grant.sharesExercised) > 0 || Number(grant.sharesCancelled) > 0) && (
                        <div className="flex gap-4 pt-2 border-t text-sm">
                          {Number(grant.sharesExercised) > 0 && (
                            <div>
                              <span className="text-muted-foreground">Exercised: </span>
                              <span className="font-medium text-green-600">
                                {formatNumber(Number(grant.sharesExercised))}
                              </span>
                            </div>
                          )}
                          {Number(grant.sharesCancelled) > 0 && (
                            <div>
                              <span className="text-muted-foreground">Cancelled: </span>
                              <span className="font-medium text-red-600">
                                {formatNumber(Number(grant.sharesCancelled))}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holdings Tab */}
        <TabsContent value="holdings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Share Holdings</CardTitle>
              <CardDescription>
                Shares you currently own
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!holdings || holdings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No holdings found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate #</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead>Acquisition Type</TableHead>
                      <TableHead>Acquisition Date</TableHead>
                      <TableHead className="text-right">Cost Basis</TableHead>
                      <TableHead className="text-right">Current Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((holding) => (
                      <TableRow key={holding.id}>
                        <TableCell className="font-mono">
                          {holding.certificateNumber || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatNumber(Number(holding.shares))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {holding.acquisitionType}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(holding.acquisitionDate)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {holding.totalCostBasis ? formatCurrency(parseFloat(holding.totalCostBasis)) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {summary.pricePerShare
                            ? formatCurrency(Number(holding.shares) * summary.pricePerShare)
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Grant letters, agreements, and other equity documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDocs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !documents || documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No documents available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {doc.documentType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(doc.createdAt)}</TableCell>
                        <TableCell>
                          {doc.requiresSignature && (
                            <Badge
                              variant={doc.signatureStatus === "fully_signed" ? "default" : "secondary"}
                            >
                              {doc.signatureStatus?.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(doc.fileUrl, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Updates about your equity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!notifications || notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border rounded-lg ${!notification.readAt ? "bg-muted/50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{notification.title}</h4>
                            {!notification.readAt && (
                              <Badge variant="default" className="text-xs">New</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.readAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markRead.mutate({ id: notification.id })}
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
