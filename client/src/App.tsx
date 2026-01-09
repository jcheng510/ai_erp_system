import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";

// Pages
import Home from "./pages/Home";
import AIAssistant from "./pages/AIAssistant";
import Settings from "./pages/Settings";
import GlobalSearch from "./pages/GlobalSearch";
import Notifications from "./pages/Notifications";

// Finance
import Accounts from "./pages/finance/Accounts";
import Invoices from "./pages/finance/Invoices";
import Payments from "./pages/finance/Payments";
import Transactions from "./pages/finance/Transactions";

// Sales
import Orders from "./pages/sales/Orders";
import Customers from "./pages/sales/Customers";

// Operations
import Products from "./pages/operations/Products";
import Inventory from "./pages/operations/Inventory";
import Vendors from "./pages/operations/Vendors";
import PurchaseOrders from "./pages/operations/PurchaseOrders";
import Shipments from "./pages/operations/Shipments";
import Locations from "./pages/operations/Locations";
import Transfers from "./pages/operations/Transfers";
import TransferDetail from "./pages/operations/TransferDetail";
import BOM from "./pages/operations/BOM";
import BOMDetail from "./pages/operations/BOMDetail";
import RawMaterials from "./pages/operations/RawMaterials";

// Freight
import FreightDashboard from "./pages/freight/FreightDashboard";
import Carriers from "./pages/freight/Carriers";
import RFQs from "./pages/freight/RFQs";
import RFQDetail from "./pages/freight/RFQDetail";
import CustomsClearance from "./pages/freight/CustomsClearance";
import CustomsDetail from "./pages/freight/CustomsDetail";

// HR
import Employees from "./pages/hr/Employees";
import Payroll from "./pages/hr/Payroll";

// Legal
import Contracts from "./pages/legal/Contracts";
import Disputes from "./pages/legal/Disputes";
import Documents from "./pages/legal/Documents";

// Projects
import Projects from "./pages/projects/Projects";

// Import
import Import from "./pages/Import";

// Settings
import Team from "./pages/settings/Team";

// Portals
import CopackerPortal from "./pages/portal/CopackerPortal";
import VendorPortal from "./pages/portal/VendorPortal";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        {/* Overview */}
        <Route path="/" component={Home} />
        <Route path="/ai" component={AIAssistant} />
        <Route path="/search" component={GlobalSearch} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/settings" component={Settings} />

        {/* Finance */}
        <Route path="/finance/accounts" component={Accounts} />
        <Route path="/finance/invoices" component={Invoices} />
        <Route path="/finance/payments" component={Payments} />
        <Route path="/finance/transactions" component={Transactions} />

        {/* Sales */}
        <Route path="/sales/orders" component={Orders} />
        <Route path="/sales/customers" component={Customers} />

        {/* Operations */}
        <Route path="/operations/products" component={Products} />
        <Route path="/operations/inventory" component={Inventory} />
        <Route path="/operations/vendors" component={Vendors} />
        <Route path="/operations/purchase-orders" component={PurchaseOrders} />
        <Route path="/operations/shipments" component={Shipments} />
        <Route path="/operations/locations" component={Locations} />
        <Route path="/operations/transfers" component={Transfers} />
        <Route path="/operations/transfers/:id" component={TransferDetail} />
        <Route path="/operations/bom" component={BOM} />
        <Route path="/operations/bom/:id" component={BOMDetail} />
        <Route path="/operations/raw-materials" component={RawMaterials} />

        {/* Freight */}
        <Route path="/freight" component={FreightDashboard} />
        <Route path="/freight/carriers" component={Carriers} />
        <Route path="/freight/rfqs" component={RFQs} />
        <Route path="/freight/rfqs/:id" component={RFQDetail} />
        <Route path="/freight/customs" component={CustomsClearance} />
        <Route path="/freight/customs/:id" component={CustomsDetail} />

        {/* HR */}
        <Route path="/hr/employees" component={Employees} />
        <Route path="/hr/payroll" component={Payroll} />

        {/* Legal */}
        <Route path="/legal/contracts" component={Contracts} />
        <Route path="/legal/disputes" component={Disputes} />
        <Route path="/legal/documents" component={Documents} />

        {/* Projects */}
        <Route path="/projects" component={Projects} />

        {/* Import */}
        <Route path="/import" component={Import} />

        {/* Settings */}
        <Route path="/settings/team" component={Team} />

        {/* Portals */}
        <Route path="/portal/copacker" component={CopackerPortal} />
        <Route path="/portal/vendor" component={VendorPortal} />

        {/* Fallback */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
