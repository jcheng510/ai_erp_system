import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  Package,
  DollarSign,
  FileText,
  FolderKanban,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  UserCog,
} from "lucide-react";
import { useLocation } from "wouter";

function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function KPICard({
  title,
  value,
  icon: Icon,
  description,
  onClick,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <Card
      className={`${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <>
            <div className="text-lg font-bold">{value}</div>
            {description && (
              <p className="text-[11px] text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery();

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Business overview and key metrics
          </p>
        </div>
      </div>

      {/* Consolidated KPI Grid - all metrics in one dense row */}
      <div className="grid gap-2 grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
        <KPICard
          title="Revenue"
          value={formatCurrency(metrics?.revenueThisMonth)}
          icon={DollarSign}
          onClick={() => setLocation('/sales/orders')}
          loading={isLoading}
        />
        <KPICard
          title="Collected"
          value={formatCurrency(metrics?.invoicesPaid)}
          icon={TrendingUp}
          onClick={() => setLocation('/finance/invoices')}
          loading={isLoading}
        />
        <KPICard
          title="Pending Inv."
          value={metrics?.pendingInvoices || 0}
          icon={FileText}
          onClick={() => setLocation('/finance/invoices')}
          loading={isLoading}
        />
        <KPICard
          title="Disputes"
          value={metrics?.openDisputes || 0}
          icon={AlertTriangle}
          onClick={() => setLocation('/legal/disputes')}
          loading={isLoading}
        />
        <KPICard
          title="Customers"
          value={metrics?.customers || 0}
          icon={Users}
          onClick={() => setLocation('/sales/customers')}
          loading={isLoading}
        />
        <KPICard
          title="Vendors"
          value={metrics?.vendors || 0}
          icon={Building2}
          onClick={() => setLocation('/operations/vendors')}
          loading={isLoading}
        />
        <KPICard
          title="Products"
          value={metrics?.products || 0}
          icon={Package}
          onClick={() => setLocation('/operations/products')}
          loading={isLoading}
        />
        <KPICard
          title="Employees"
          value={metrics?.activeEmployees || 0}
          icon={UserCog}
          onClick={() => setLocation('/hr/employees')}
          loading={isLoading}
        />
        <KPICard
          title="Projects"
          value={metrics?.activeProjects || 0}
          icon={FolderKanban}
          onClick={() => setLocation('/projects')}
          loading={isLoading}
        />
      </div>

      {/* Consolidated summaries and actions in a single row */}
      <div className="grid gap-2 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-0 pt-0">
            <CardTitle className="text-sm">Finance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pending Invoices</span>
              <span className="font-medium">{metrics?.pendingInvoices || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pending POs</span>
              <span className="font-medium">{metrics?.pendingPurchaseOrders || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Active Contracts</span>
              <span className="font-medium">{metrics?.activeContracts || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0 pt-0">
            <CardTitle className="text-sm">Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Products</span>
              <span className="font-medium">{metrics?.products || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Active Vendors</span>
              <span className="font-medium">{metrics?.vendors || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pending POs</span>
              <span className="font-medium">{metrics?.pendingPurchaseOrders || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0 pt-0">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <button
              onClick={() => setLocation('/finance/invoices')}
              className="w-full text-left text-xs p-1.5 rounded hover:bg-muted transition-colors flex items-center gap-2"
            >
              <FileText className="h-3.5 w-3.5" />
              Create Invoice
            </button>
            <button
              onClick={() => setLocation('/operations/purchase-orders')}
              className="w-full text-left text-xs p-1.5 rounded hover:bg-muted transition-colors flex items-center gap-2"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              New Purchase Order
            </button>
            <button
              onClick={() => setLocation('/ai')}
              className="w-full text-left text-xs p-1.5 rounded hover:bg-muted transition-colors flex items-center gap-2"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Ask AI Assistant
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
