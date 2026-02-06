import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Ship,
  Plane,
  Truck,
  Train,
  Layers,
  Plus,
  Star,
  Search,
  Loader2,
  Mail,
  Phone,
  Globe,
  MapPin,
  ArrowRight,
  Database,
  Route,
  Building2,
  Package,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";

const vendorTypeLabels: Record<string, string> = {
  ocean: "Ocean Freight",
  air: "Air Freight",
  ground: "Ground/Trucking",
  rail: "Rail",
  multimodal: "Multimodal",
  freight_forwarder: "Freight Forwarder",
  customs_broker: "Customs Broker",
  "3pl": "3PL Provider",
};

const vendorTypeIcons: Record<string, React.ReactNode> = {
  ocean: <Ship className="h-4 w-4" />,
  air: <Plane className="h-4 w-4" />,
  ground: <Truck className="h-4 w-4" />,
  rail: <Train className="h-4 w-4" />,
  multimodal: <Layers className="h-4 w-4" />,
  freight_forwarder: <Building2 className="h-4 w-4" />,
  customs_broker: <Package className="h-4 w-4" />,
  "3pl": <Building2 className="h-4 w-4" />,
};

const modeLabels: Record<string, string> = {
  ocean_fcl: "Ocean FCL",
  ocean_lcl: "Ocean LCL",
  air: "Air",
  express: "Express",
  ground: "Ground",
  rail: "Rail",
  multimodal: "Multimodal",
};

const emptyVendorForm = {
  name: "",
  type: "ocean" as const,
  contactName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  website: "",
  notes: "",
  isPreferred: false,
  handlesHazmat: false,
  handlesRefrigerated: false,
  handlesOversized: false,
  offersDoorToDoor: false,
  offersCustomsClearance: false,
  offersInsurance: false,
  offersWarehouse: false,
  paymentTermsDays: 30,
  source: "manual" as const,
};

const emptyRouteForm = {
  freightVendorId: 0,
  originCountry: "",
  originCity: "",
  originPort: "",
  destinationCountry: "",
  destinationCity: "",
  destinationPort: "",
  mode: "ocean_fcl" as const,
  transitDaysMin: undefined as number | undefined,
  transitDaysMax: undefined as number | undefined,
  frequency: "",
  estimatedCostMin: "",
  estimatedCostMax: "",
  costCurrency: "USD",
  costUnit: "",
  notes: "",
};

export default function FreightVendorDatabase() {
  const [activeTab, setActiveTab] = useState("vendors");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [isRouteDialogOpen, setIsRouteDialogOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [routeForm, setRouteForm] = useState(emptyRouteForm);

  // Route search state
  const [routeSearchParams, setRouteSearchParams] = useState({
    originCountry: "",
    originCity: "",
    destinationCountry: "",
    destinationCity: "",
    mode: "",
  });
  const [searchTriggered, setSearchTriggered] = useState(false);

  const utils = trpc.useUtils();

  // Queries
  const { data: stats } = trpc.freight.vendorDatabase.stats.useQuery();
  const { data: vendors, isLoading: vendorsLoading } = trpc.freight.vendorDatabase.vendors.list.useQuery(
    typeFilter !== "all" ? { type: typeFilter, search: search || undefined } : { search: search || undefined }
  );
  const { data: selectedVendor } = trpc.freight.vendorDatabase.vendors.get.useQuery(
    { id: selectedVendorId! },
    { enabled: !!selectedVendorId }
  );
  const { data: routeSearchResults, isLoading: searchLoading } = trpc.freight.vendorDatabase.search.useQuery(
    {
      originCountry: routeSearchParams.originCountry || undefined,
      originCity: routeSearchParams.originCity || undefined,
      destinationCountry: routeSearchParams.destinationCountry || undefined,
      destinationCity: routeSearchParams.destinationCity || undefined,
      mode: routeSearchParams.mode || undefined,
    },
    { enabled: searchTriggered && !!routeSearchParams.originCountry && !!routeSearchParams.destinationCountry }
  );

  // Mutations
  const createVendor = trpc.freight.vendorDatabase.vendors.create.useMutation({
    onSuccess: () => {
      toast.success("Freight vendor added");
      utils.freight.vendorDatabase.vendors.list.invalidate();
      utils.freight.vendorDatabase.stats.invalidate();
      setIsVendorDialogOpen(false);
      setVendorForm(emptyVendorForm);
    },
    onError: (e) => toast.error(e.message || "Failed to add vendor"),
  });

  const updateVendor = trpc.freight.vendorDatabase.vendors.update.useMutation({
    onSuccess: () => {
      toast.success("Vendor updated");
      utils.freight.vendorDatabase.vendors.list.invalidate();
      utils.freight.vendorDatabase.vendors.get.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to update vendor"),
  });

  const deleteVendor = trpc.freight.vendorDatabase.vendors.delete.useMutation({
    onSuccess: () => {
      toast.success("Vendor removed");
      utils.freight.vendorDatabase.vendors.list.invalidate();
      utils.freight.vendorDatabase.stats.invalidate();
      setSelectedVendorId(null);
    },
    onError: (e) => toast.error(e.message || "Failed to remove vendor"),
  });

  const createRoute = trpc.freight.vendorDatabase.routes.create.useMutation({
    onSuccess: () => {
      toast.success("Route added");
      utils.freight.vendorDatabase.vendors.get.invalidate();
      utils.freight.vendorDatabase.stats.invalidate();
      setIsRouteDialogOpen(false);
      setRouteForm(emptyRouteForm);
    },
    onError: (e) => toast.error(e.message || "Failed to add route"),
  });

  const deleteRoute = trpc.freight.vendorDatabase.routes.delete.useMutation({
    onSuccess: () => {
      toast.success("Route removed");
      utils.freight.vendorDatabase.vendors.get.invalidate();
      utils.freight.vendorDatabase.stats.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to remove route"),
  });

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createVendor.mutate({
      ...vendorForm,
      paymentTermsDays: vendorForm.paymentTermsDays || undefined,
    });
  };

  const handleRouteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return;
    createRoute.mutate({
      ...routeForm,
      freightVendorId: selectedVendorId,
      transitDaysMin: routeForm.transitDaysMin || undefined,
      transitDaysMax: routeForm.transitDaysMax || undefined,
      estimatedCostMin: routeForm.estimatedCostMin || undefined,
      estimatedCostMax: routeForm.estimatedCostMax || undefined,
    });
  };

  const handleRouteSearch = () => {
    if (!routeSearchParams.originCountry || !routeSearchParams.destinationCountry) {
      toast.error("Please enter at least origin and destination countries");
      return;
    }
    setSearchTriggered(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Freight Vendor Database
          </h1>
          <p className="text-muted-foreground">
            Manage freight vendors and search by route for RFQs
          </p>
        </div>
        <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Freight Vendor</DialogTitle>
              <DialogDescription>
                Register a new freight vendor with their capabilities
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleVendorSubmit}>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor Type *</Label>
                  <Select
                    value={vendorForm.type}
                    onValueChange={(v: any) => setVendorForm({ ...vendorForm, type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(vendorTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={vendorForm.contactName} onChange={(e) => setVendorForm({ ...vendorForm, contactName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={vendorForm.country} onChange={(e) => setVendorForm({ ...vendorForm, country: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={vendorForm.city} onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={vendorForm.website} onChange={(e) => setVendorForm({ ...vendorForm, website: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Address</Label>
                  <Input value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
                </div>

                {/* Capabilities */}
                <div className="col-span-2">
                  <Label className="text-sm font-semibold">Capabilities</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {[
                      { key: "handlesHazmat", label: "Hazmat" },
                      { key: "handlesRefrigerated", label: "Refrigerated" },
                      { key: "handlesOversized", label: "Oversized" },
                      { key: "offersDoorToDoor", label: "Door-to-Door" },
                      { key: "offersCustomsClearance", label: "Customs Clearance" },
                      { key: "offersInsurance", label: "Insurance" },
                      { key: "offersWarehouse", label: "Warehousing" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Switch
                          checked={(vendorForm as any)[key]}
                          onCheckedChange={(c) => setVendorForm({ ...vendorForm, [key]: c })}
                        />
                        <Label className="text-sm">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={vendorForm.isPreferred}
                    onCheckedChange={(c) => setVendorForm({ ...vendorForm, isPreferred: c })}
                  />
                  <Label>Preferred Vendor</Label>
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms (days)</Label>
                  <Input
                    type="number"
                    value={vendorForm.paymentTermsDays}
                    onChange={(e) => setVendorForm({ ...vendorForm, paymentTermsDays: parseInt(e.target.value) || 30 })}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={vendorForm.notes} onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsVendorDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createVendor.isPending}>
                  {createVendor.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Vendor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Vendors", value: stats.totalVendors, icon: Building2 },
            { label: "Active", value: stats.activeVendors, icon: CheckCircle2 },
            { label: "Preferred", value: stats.preferredVendors, icon: Star },
            { label: "Route Lanes", value: stats.totalRoutes, icon: Route },
            { label: "Searches (30d)", value: stats.recentSearches, icon: Search },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="vendors">Vendor List</TabsTrigger>
          <TabsTrigger value="search">Route Search</TabsTrigger>
          {selectedVendorId && <TabsTrigger value="detail">Vendor Detail</TabsTrigger>}
        </TabsList>

        {/* Vendor List Tab */}
        <TabsContent value="vendors" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vendors by name, city, country..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(vendorTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Freight Vendors ({vendors?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {vendorsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : vendors && vendors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((v) => (
                      <TableRow key={v.id} className="cursor-pointer" onClick={() => { setSelectedVendorId(v.id); setActiveTab("detail"); }}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {v.isPreferred && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                            <div>
                              <p className="font-medium">{v.name}</p>
                              {v.source !== "manual" && (
                                <Badge variant="outline" className="text-xs">{v.source}</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            {vendorTypeIcons[v.type]}
                            {vendorTypeLabels[v.type] || v.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {v.city || v.country ? (
                            <span className="text-sm flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {[v.city, v.country].filter(Boolean).join(", ")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {v.email && <p className="text-sm flex items-center gap-1"><Mail className="h-3 w-3" />{v.email}</p>}
                            {v.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {v.rating ? (
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`h-3.5 w-3.5 ${i < v.rating! ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.isActive ? "default" : "secondary"}>
                            {v.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => updateVendor.mutate({ id: v.id, isPreferred: !v.isPreferred })}>
                              <Star className={`h-4 w-4 ${v.isPreferred ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}`} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => updateVendor.mutate({ id: v.id, isActive: !v.isActive })}>
                              {v.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No freight vendors found</p>
                  <Button variant="link" onClick={() => setIsVendorDialogOpen(true)}>
                    Add your first freight vendor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Route Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Search Vendors by Route
              </CardTitle>
              <CardDescription>
                Find freight vendors that service a specific origin-destination lane
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Origin Country *</Label>
                  <Input
                    placeholder="e.g. China"
                    value={routeSearchParams.originCountry}
                    onChange={(e) => { setRouteSearchParams({ ...routeSearchParams, originCountry: e.target.value }); setSearchTriggered(false); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Origin City</Label>
                  <Input
                    placeholder="e.g. Shanghai"
                    value={routeSearchParams.originCity}
                    onChange={(e) => { setRouteSearchParams({ ...routeSearchParams, originCity: e.target.value }); setSearchTriggered(false); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destination Country *</Label>
                  <Input
                    placeholder="e.g. United States"
                    value={routeSearchParams.destinationCountry}
                    onChange={(e) => { setRouteSearchParams({ ...routeSearchParams, destinationCountry: e.target.value }); setSearchTriggered(false); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destination City</Label>
                  <Input
                    placeholder="e.g. Los Angeles"
                    value={routeSearchParams.destinationCity}
                    onChange={(e) => { setRouteSearchParams({ ...routeSearchParams, destinationCity: e.target.value }); setSearchTriggered(false); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select
                    value={routeSearchParams.mode || "any"}
                    onValueChange={(v) => { setRouteSearchParams({ ...routeSearchParams, mode: v === "any" ? "" : v }); setSearchTriggered(false); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Mode</SelectItem>
                      {Object.entries(modeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-4" onClick={handleRouteSearch} disabled={searchLoading}>
                {searchLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Search Routes
              </Button>
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchTriggered && routeSearchResults && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {routeSearchParams.originCountry}
                  {routeSearchParams.originCity && ` (${routeSearchParams.originCity})`}
                  <ArrowRight className="h-4 w-4" />
                  {routeSearchParams.destinationCountry}
                  {routeSearchParams.destinationCity && ` (${routeSearchParams.destinationCity})`}
                </CardTitle>
                <CardDescription>
                  {routeSearchResults.resultCount} vendor(s) found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {routeSearchResults.vendors && routeSearchResults.vendors.length > 0 ? (
                  <div className="space-y-4">
                    {routeSearchResults.vendors.map((item: any) => (
                      <Card key={item.vendor.id} className="border">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                {item.vendor.isPreferred && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                                <h3 className="font-semibold text-lg">{item.vendor.name}</h3>
                                <Badge variant="outline">{vendorTypeLabels[item.vendor.type] || item.vendor.type}</Badge>
                                {item.vendor.rating && (
                                  <div className="flex items-center gap-0.5 ml-2">
                                    {[...Array(5)].map((_, i) => (
                                      <Star key={i} className={`h-3 w-3 ${i < item.vendor.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                                {item.vendor.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{item.vendor.email}</span>}
                                {item.vendor.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.vendor.phone}</span>}
                                {item.vendor.country && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.vendor.country}</span>}
                              </div>
                            </div>
                            <Button size="sm" onClick={() => { setSelectedVendorId(item.vendor.id); setActiveTab("detail"); }}>
                              View Details
                            </Button>
                          </div>

                          {/* Matching routes */}
                          <div className="mt-3 space-y-2">
                            {item.routes.map((route: any) => (
                              <div key={route.id} className="flex items-center gap-4 text-sm bg-muted/50 rounded-md px-3 py-2">
                                <Badge variant="secondary">{modeLabels[route.mode] || route.mode}</Badge>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[route.originCity, route.originCountry].filter(Boolean).join(", ")}
                                  <ArrowRight className="h-3 w-3 mx-1" />
                                  {[route.destinationCity, route.destinationCountry].filter(Boolean).join(", ")}
                                </span>
                                {(route.transitDaysMin || route.transitDaysMax) && (
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {route.transitDaysMin && route.transitDaysMax
                                      ? `${route.transitDaysMin}-${route.transitDaysMax} days`
                                      : `${route.transitDaysMin || route.transitDaysMax} days`}
                                  </span>
                                )}
                                {(route.estimatedCostMin || route.estimatedCostMax) && (
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    <DollarSign className="h-3 w-3" />
                                    {route.estimatedCostMin && route.estimatedCostMax
                                      ? `$${route.estimatedCostMin}-$${route.estimatedCostMax}`
                                      : `$${route.estimatedCostMin || route.estimatedCostMax}`}
                                    {route.costUnit && ` / ${route.costUnit}`}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-2 text-amber-500 opacity-70" />
                    <p className="font-medium">No vendors found for this route</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {routeSearchResults.aiMessage || "Try broadening your search or add new vendors to the database."}
                    </p>
                    <div className="flex gap-2 justify-center mt-4">
                      <Button variant="outline" onClick={() => setIsVendorDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Vendor Manually
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setRouteSearchParams({ ...routeSearchParams, originCity: "", destinationCity: "", mode: "" });
                        setSearchTriggered(false);
                      }}>
                        Broaden Search
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Vendor Detail Tab */}
        {selectedVendorId && (
          <TabsContent value="detail" className="space-y-4">
            {selectedVendor ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {selectedVendor.isPreferred && <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />}
                          {selectedVendor.name}
                          <Badge variant="outline" className="ml-2">
                            {vendorTypeIcons[selectedVendor.type]}
                            <span className="ml-1">{vendorTypeLabels[selectedVendor.type] || selectedVendor.type}</span>
                          </Badge>
                          <Badge variant={selectedVendor.isActive ? "default" : "secondary"} className="ml-1">
                            {selectedVendor.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {[selectedVendor.city, selectedVendor.country].filter(Boolean).join(", ")}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateVendor.mutate({ id: selectedVendor.id, isPreferred: !selectedVendor.isPreferred })}>
                          <Star className={`h-4 w-4 mr-1 ${selectedVendor.isPreferred ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}`} />
                          {selectedVendor.isPreferred ? "Unmark Preferred" : "Mark Preferred"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => {
                          if (confirm("Remove this vendor and all routes?")) deleteVendor.mutate({ id: selectedVendor.id });
                        }}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {selectedVendor.contactName && (
                        <div><p className="text-sm text-muted-foreground">Contact</p><p className="font-medium">{selectedVendor.contactName}</p></div>
                      )}
                      {selectedVendor.email && (
                        <div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{selectedVendor.email}</p></div>
                      )}
                      {selectedVendor.phone && (
                        <div><p className="text-sm text-muted-foreground">Phone</p><p className="font-medium">{selectedVendor.phone}</p></div>
                      )}
                      {selectedVendor.website && (
                        <div><p className="text-sm text-muted-foreground">Website</p><p className="font-medium">{selectedVendor.website}</p></div>
                      )}
                      <div><p className="text-sm text-muted-foreground">Payment Terms</p><p className="font-medium">{selectedVendor.paymentTermsDays || 30} days</p></div>
                      <div><p className="text-sm text-muted-foreground">Source</p><Badge variant="outline">{selectedVendor.source || "manual"}</Badge></div>
                      {selectedVendor.onTimeDeliveryPct && (
                        <div><p className="text-sm text-muted-foreground">On-Time Delivery</p><p className="font-medium">{selectedVendor.onTimeDeliveryPct}%</p></div>
                      )}
                      {selectedVendor.totalShipments !== undefined && selectedVendor.totalShipments > 0 && (
                        <div><p className="text-sm text-muted-foreground">Total Shipments</p><p className="font-medium">{selectedVendor.totalShipments}</p></div>
                      )}
                    </div>

                    {/* Capabilities */}
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-2">Capabilities</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedVendor.handlesHazmat && <Badge>Hazmat</Badge>}
                        {selectedVendor.handlesRefrigerated && <Badge>Refrigerated</Badge>}
                        {selectedVendor.handlesOversized && <Badge>Oversized</Badge>}
                        {selectedVendor.offersDoorToDoor && <Badge>Door-to-Door</Badge>}
                        {selectedVendor.offersCustomsClearance && <Badge>Customs Clearance</Badge>}
                        {selectedVendor.offersInsurance && <Badge>Insurance</Badge>}
                        {selectedVendor.offersWarehouse && <Badge>Warehousing</Badge>}
                        {!selectedVendor.handlesHazmat && !selectedVendor.handlesRefrigerated && !selectedVendor.handlesOversized && !selectedVendor.offersDoorToDoor && !selectedVendor.offersCustomsClearance && !selectedVendor.offersInsurance && !selectedVendor.offersWarehouse && (
                          <span className="text-muted-foreground text-sm">None specified</span>
                        )}
                      </div>
                    </div>

                    {selectedVendor.notes && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm">{selectedVendor.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Routes */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Route className="h-5 w-5" />
                        Route Lanes ({selectedVendor.routes?.length || 0})
                      </CardTitle>
                      <Dialog open={isRouteDialogOpen} onOpenChange={setIsRouteDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Route
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Add Route Lane</DialogTitle>
                            <DialogDescription>Define an origin-destination lane this vendor services</DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleRouteSubmit}>
                            <div className="grid grid-cols-2 gap-4 py-4">
                              <div className="col-span-2">
                                <Label className="text-sm font-semibold">Origin</Label>
                              </div>
                              <div className="space-y-2">
                                <Label>Country *</Label>
                                <Input value={routeForm.originCountry} onChange={(e) => setRouteForm({ ...routeForm, originCountry: e.target.value })} required />
                              </div>
                              <div className="space-y-2">
                                <Label>City</Label>
                                <Input value={routeForm.originCity} onChange={(e) => setRouteForm({ ...routeForm, originCity: e.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <Label>Port</Label>
                                <Input value={routeForm.originPort} onChange={(e) => setRouteForm({ ...routeForm, originPort: e.target.value })} placeholder="e.g. Port of Shanghai" />
                              </div>

                              <div className="col-span-2 border-t pt-4">
                                <Label className="text-sm font-semibold">Destination</Label>
                              </div>
                              <div className="space-y-2">
                                <Label>Country *</Label>
                                <Input value={routeForm.destinationCountry} onChange={(e) => setRouteForm({ ...routeForm, destinationCountry: e.target.value })} required />
                              </div>
                              <div className="space-y-2">
                                <Label>City</Label>
                                <Input value={routeForm.destinationCity} onChange={(e) => setRouteForm({ ...routeForm, destinationCity: e.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <Label>Port</Label>
                                <Input value={routeForm.destinationPort} onChange={(e) => setRouteForm({ ...routeForm, destinationPort: e.target.value })} placeholder="e.g. Port of Los Angeles" />
                              </div>

                              <div className="col-span-2 border-t pt-4">
                                <Label className="text-sm font-semibold">Route Details</Label>
                              </div>
                              <div className="space-y-2">
                                <Label>Transport Mode *</Label>
                                <Select value={routeForm.mode} onValueChange={(v: any) => setRouteForm({ ...routeForm, mode: v })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(modeLabels).map(([k, v]) => (
                                      <SelectItem key={k} value={k}>{v}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Input value={routeForm.frequency} onChange={(e) => setRouteForm({ ...routeForm, frequency: e.target.value })} placeholder="e.g. weekly" />
                              </div>
                              <div className="space-y-2">
                                <Label>Transit Days (Min)</Label>
                                <Input type="number" value={routeForm.transitDaysMin ?? ""} onChange={(e) => setRouteForm({ ...routeForm, transitDaysMin: e.target.value ? parseInt(e.target.value) : undefined })} />
                              </div>
                              <div className="space-y-2">
                                <Label>Transit Days (Max)</Label>
                                <Input type="number" value={routeForm.transitDaysMax ?? ""} onChange={(e) => setRouteForm({ ...routeForm, transitDaysMax: e.target.value ? parseInt(e.target.value) : undefined })} />
                              </div>
                              <div className="space-y-2">
                                <Label>Est. Cost Min ($)</Label>
                                <Input value={routeForm.estimatedCostMin} onChange={(e) => setRouteForm({ ...routeForm, estimatedCostMin: e.target.value })} placeholder="e.g. 2000" />
                              </div>
                              <div className="space-y-2">
                                <Label>Est. Cost Max ($)</Label>
                                <Input value={routeForm.estimatedCostMax} onChange={(e) => setRouteForm({ ...routeForm, estimatedCostMax: e.target.value })} placeholder="e.g. 3500" />
                              </div>
                              <div className="space-y-2">
                                <Label>Cost Unit</Label>
                                <Select value={routeForm.costUnit || "flat_rate"} onValueChange={(v) => setRouteForm({ ...routeForm, costUnit: v })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="flat_rate">Flat Rate</SelectItem>
                                    <SelectItem value="per_container">Per Container</SelectItem>
                                    <SelectItem value="per_kg">Per Kg</SelectItem>
                                    <SelectItem value="per_cbm">Per CBM</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2 space-y-2">
                                <Label>Notes</Label>
                                <Textarea value={routeForm.notes} onChange={(e) => setRouteForm({ ...routeForm, notes: e.target.value })} rows={2} />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setIsRouteDialogOpen(false)}>Cancel</Button>
                              <Button type="submit" disabled={createRoute.isPending}>
                                {createRoute.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Add Route
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedVendor.routes && selectedVendor.routes.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Origin</TableHead>
                            <TableHead></TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Transit</TableHead>
                            <TableHead>Est. Cost</TableHead>
                            <TableHead>Frequency</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedVendor.routes.map((route: any) => (
                            <TableRow key={route.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{route.originCountry}</p>
                                  {route.originCity && <p className="text-sm text-muted-foreground">{route.originCity}</p>}
                                  {route.originPort && <p className="text-xs text-muted-foreground">{route.originPort}</p>}
                                </div>
                              </TableCell>
                              <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{route.destinationCountry}</p>
                                  {route.destinationCity && <p className="text-sm text-muted-foreground">{route.destinationCity}</p>}
                                  {route.destinationPort && <p className="text-xs text-muted-foreground">{route.destinationPort}</p>}
                                </div>
                              </TableCell>
                              <TableCell><Badge variant="secondary">{modeLabels[route.mode] || route.mode}</Badge></TableCell>
                              <TableCell>
                                {route.transitDaysMin || route.transitDaysMax ? (
                                  <span className="text-sm">
                                    {route.transitDaysMin && route.transitDaysMax
                                      ? `${route.transitDaysMin}-${route.transitDaysMax}d`
                                      : `${route.transitDaysMin || route.transitDaysMax}d`}
                                  </span>
                                ) : "-"}
                              </TableCell>
                              <TableCell>
                                {route.estimatedCostMin || route.estimatedCostMax ? (
                                  <span className="text-sm">
                                    ${route.estimatedCostMin || "?"}-${route.estimatedCostMax || "?"}
                                    {route.costUnit && <span className="text-muted-foreground"> /{route.costUnit.replace("per_", "")}</span>}
                                  </span>
                                ) : "-"}
                              </TableCell>
                              <TableCell>{route.frequency || "-"}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => {
                                  if (confirm("Remove this route?")) deleteRoute.mutate({ id: route.id });
                                }}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Route className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No routes defined for this vendor</p>
                        <Button variant="link" onClick={() => setIsRouteDialogOpen(true)}>
                          Add the first route lane
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
