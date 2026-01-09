import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Scale,
  FolderKanban,
  Bot,
  Settings,
  Building2,
  FileText,
  CreditCard,
  TrendingUp,
  Warehouse,
  Truck,
  UserCog,
  FileSignature,
  AlertTriangle,
  ChevronDown,
  Search,
  Bell,
  FileSpreadsheet,
  Ship,
  FileCheck,
  Send,
  MapPin,
  ArrowRightLeft,
  ClipboardList,
  PackageCheck,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "./ui/input";

const menuGroups = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Bot, label: "AI Assistant", path: "/ai" },
    ],
  },
  {
    label: "Finance",
    items: [
      { icon: DollarSign, label: "Accounts", path: "/finance/accounts" },
      { icon: FileText, label: "Invoices", path: "/finance/invoices" },
      { icon: CreditCard, label: "Payments", path: "/finance/payments" },
      { icon: TrendingUp, label: "Transactions", path: "/finance/transactions" },
    ],
  },
  {
    label: "Sales",
    items: [
      { icon: ShoppingCart, label: "Orders", path: "/sales/orders" },
      { icon: Users, label: "Customers", path: "/sales/customers" },
    ],
  },
  {
    label: "Operations",
    items: [
      { icon: Package, label: "Products", path: "/operations/products" },
      { icon: Warehouse, label: "Inventory", path: "/operations/inventory" },
      { icon: MapPin, label: "Locations", path: "/operations/locations" },
      { icon: ArrowRightLeft, label: "Transfers", path: "/operations/transfers" },
      { icon: Building2, label: "Vendors", path: "/operations/vendors" },
      { icon: FileText, label: "POs", path: "/operations/purchase-orders" },
      { icon: Truck, label: "Shipments", path: "/operations/shipments" },
      { icon: FileText, label: "Bill of Materials", path: "/operations/bom" },
      { icon: Package, label: "Raw Materials", path: "/operations/raw-materials" },
      { icon: ClipboardList, label: "Work Orders", path: "/operations/work-orders" },
      { icon: PackageCheck, label: "Receiving", path: "/operations/receiving" },
    ],
  },
  {
    label: "HR",
    items: [
      { icon: UserCog, label: "Employees", path: "/hr/employees" },
      { icon: CreditCard, label: "Payroll", path: "/hr/payroll" },
    ],
  },
  {
    label: "Legal",
    items: [
      { icon: FileSignature, label: "Contracts", path: "/legal/contracts" },
      { icon: AlertTriangle, label: "Disputes", path: "/legal/disputes" },
      { icon: FileText, label: "Documents", path: "/legal/documents" },
    ],
  },
  {
    label: "Freight",
    items: [
      { icon: Send, label: "Quote Requests", path: "/freight/rfqs" },
      { icon: FileCheck, label: "Customs", path: "/freight/customs" },
    ],
  },
  {
    label: "Projects",
    items: [
      { icon: FolderKanban, label: "All Projects", path: "/projects" },
    ],
  },
  {
    label: "Portals",
    items: [
      { icon: Warehouse, label: "Copacker Portal", path: "/portal/copacker" },
      { icon: Building2, label: "Vendor Portal", path: "/portal/vendor" },
    ],
  },
  {
    label: "Settings",
    items: [
      { icon: Users, label: "Team", path: "/settings/team" },
      { icon: FileSpreadsheet, label: "Import Data", path: "/import" },
      { icon: Settings, label: "Settings", path: "/settings" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

const roleColors: Record<string, string> = {
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  finance: "bg-green-500/10 text-green-500 border-green-500/20",
  ops: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  legal: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  exec: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  user: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              AI-Native ERP System
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Unified enterprise resource planning with AI-powered insights. Sign in to access your dashboard.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [openGroups, setOpenGroups] = useState<string[]>(["Overview", "Finance", "Sales", "Operations"]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev =>
      prev.includes(label)
        ? prev.filter(g => g !== label)
        : [...prev, label]
    );
  };

  // Find active menu item for mobile header
  const activeMenuItem = menuGroups
    .flatMap(g => g.items)
    .find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-border/40"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-border/40">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate text-sm">
                    ERP System
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="overflow-y-auto px-2 py-2">
            <nav className="flex flex-col gap-1">
              {menuGroups.map((group) => (
                <div key={group.label} className="mb-1">
                  {!isCollapsed && (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      <span>{group.label}</span>
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${openGroups.includes(group.label) ? "" : "-rotate-90"}`} />
                    </button>
                  )}
                  {(isCollapsed || openGroups.includes(group.label)) && (
                    <div className="flex flex-col gap-0.5">
                      {group.items.map(item => {
                        const isActive = location === item.path;
                        return (
                          <button
                            key={item.path}
                            onClick={() => setLocation(item.path)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            } ${isCollapsed ? "justify-center" : ""}`}
                            title={isCollapsed ? item.label : undefined}
                          >
                            <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "User"}
                      </p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleColors[user?.role || "user"]}`}>
                        {user?.role?.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="flex flex-col">
        {/* Top header bar */}
        <header className="flex h-14 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg" />}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="w-64 pl-9 h-9 bg-muted/50"
                onClick={() => setLocation("/search")}
                readOnly
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLocation("/notifications")}>
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
