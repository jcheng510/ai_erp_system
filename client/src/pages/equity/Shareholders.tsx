import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Users, Plus, Search, Loader2, Mail, Phone, MapPin, Building, Eye, Edit, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Shareholders() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedShareholder, setSelectedShareholder] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "individual" as "individual" | "entity" | "trust" | "employee" | "founder" | "advisor",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "United States",
    postalCode: "",
    entityType: "",
    accreditationStatus: "unknown" as "accredited" | "non_accredited" | "qualified_purchaser" | "pending_verification" | "unknown",
    isBoardMember: false,
    notes: "",
  });

  const { data: shareholders, isLoading, refetch } = trpc.capTable.shareholders.list.useQuery();
  const { data: holdings } = trpc.capTable.holdings.list.useQuery(
    selectedShareholder ? { shareholderId: selectedShareholder.id } : undefined,
    { enabled: !!selectedShareholder }
  );
  const { data: grants } = trpc.capTable.grants.list.useQuery(
    selectedShareholder ? { shareholderId: selectedShareholder.id } : undefined,
    { enabled: !!selectedShareholder }
  );

  const createShareholder = trpc.capTable.shareholders.create.useMutation({
    onSuccess: () => {
      toast.success("Shareholder created successfully");
      setIsOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateShareholder = trpc.capTable.shareholders.update.useMutation({
    onSuccess: () => {
      toast.success("Shareholder updated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "individual",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "United States",
      postalCode: "",
      entityType: "",
      accreditationStatus: "unknown",
      isBoardMember: false,
      notes: "",
    });
  };

  const filteredShareholders = shareholders?.filter((sh) =>
    sh.name.toLowerCase().includes(search.toLowerCase()) ||
    sh.email?.toLowerCase().includes(search.toLowerCase())
  );

  const typeColors: Record<string, string> = {
    founder: "bg-purple-500/10 text-purple-600",
    employee: "bg-blue-500/10 text-blue-600",
    individual: "bg-green-500/10 text-green-600",
    entity: "bg-amber-500/10 text-amber-600",
    trust: "bg-red-500/10 text-red-600",
    advisor: "bg-cyan-500/10 text-cyan-600",
  };

  const accreditationColors: Record<string, string> = {
    accredited: "bg-green-500/10 text-green-600",
    non_accredited: "bg-yellow-500/10 text-yellow-600",
    qualified_purchaser: "bg-blue-500/10 text-blue-600",
    pending_verification: "bg-orange-500/10 text-orange-600",
    unknown: "bg-gray-500/10 text-gray-600",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createShareholder.mutate({
      ...formData,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      postalCode: formData.postalCode || undefined,
      entityType: formData.entityType || undefined,
      notes: formData.notes || undefined,
    });
  };

  const openDetail = (shareholder: any) => {
    setSelectedShareholder(shareholder);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/equity/cap-table">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Cap Table
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            Shareholders
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage investors, founders, employees, and other equity holders.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Shareholder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Shareholder</DialogTitle>
                <DialogDescription>
                  Add a new shareholder to your cap table.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Smith or Acme Corp"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="founder">Founder</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="individual">Individual Investor</SelectItem>
                        <SelectItem value="entity">Entity/Fund</SelectItem>
                        <SelectItem value="trust">Trust</SelectItem>
                        <SelectItem value="advisor">Advisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                {formData.type === "entity" && (
                  <div className="space-y-2">
                    <Label htmlFor="entityType">Entity Type</Label>
                    <Select
                      value={formData.entityType}
                      onValueChange={(value) => setFormData({ ...formData, entityType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LLC">LLC</SelectItem>
                        <SelectItem value="Corporation">Corporation</SelectItem>
                        <SelectItem value="LP">Limited Partnership</SelectItem>
                        <SelectItem value="LLP">LLP</SelectItem>
                        <SelectItem value="Venture Fund">Venture Fund</SelectItem>
                        <SelectItem value="Family Office">Family Office</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="San Francisco"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="CA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="United States"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="94102"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accreditationStatus">Accreditation Status</Label>
                  <Select
                    value={formData.accreditationStatus}
                    onValueChange={(value: any) => setFormData({ ...formData, accreditationStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accredited">Accredited Investor</SelectItem>
                      <SelectItem value="qualified_purchaser">Qualified Purchaser</SelectItem>
                      <SelectItem value="non_accredited">Non-Accredited</SelectItem>
                      <SelectItem value="pending_verification">Pending Verification</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional information about this shareholder..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createShareholder.isPending}>
                  {createShareholder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Shareholder
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shareholders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredShareholders || filteredShareholders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No shareholders found</p>
              <p className="text-sm">Add your first shareholder to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Accreditation</TableHead>
                  <TableHead>Board Member</TableHead>
                  <TableHead>Portal Access</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShareholders.map((shareholder) => (
                  <TableRow key={shareholder.id}>
                    <TableCell className="font-medium">{shareholder.name}</TableCell>
                    <TableCell>
                      <Badge className={typeColors[shareholder.type]}>
                        {shareholder.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {shareholder.email || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={accreditationColors[shareholder.accreditationStatus || "unknown"]}>
                        {shareholder.accreditationStatus?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={shareholder.isBoardMember ? "default" : "secondary"}>
                        {shareholder.isBoardMember ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={shareholder.portalAccessEnabled ? "default" : "outline"}>
                        {shareholder.portalAccessEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(shareholder)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selectedShareholder && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedShareholder.name}
                  <Badge className={typeColors[selectedShareholder.type]}>
                    {selectedShareholder.type}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  Shareholder details and equity information
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Contact Information
                  </h3>
                  {selectedShareholder.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {selectedShareholder.email}
                    </div>
                  )}
                  {selectedShareholder.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedShareholder.phone}
                    </div>
                  )}
                  {selectedShareholder.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        {selectedShareholder.address}
                        {selectedShareholder.city && `, ${selectedShareholder.city}`}
                        {selectedShareholder.state && `, ${selectedShareholder.state}`}
                        {selectedShareholder.postalCode && ` ${selectedShareholder.postalCode}`}
                        {selectedShareholder.country && <br />}
                        {selectedShareholder.country}
                      </div>
                    </div>
                  )}
                  {selectedShareholder.entityType && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {selectedShareholder.entityType}
                    </div>
                  )}
                </div>

                {/* Holdings */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Equity Holdings
                  </h3>
                  {holdings && holdings.length > 0 ? (
                    <div className="space-y-2">
                      {holdings.map((holding) => (
                        <div key={holding.id} className="p-3 border rounded-lg bg-muted/30">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {new Intl.NumberFormat().format(Number(holding.shares))} shares
                            </span>
                            <Badge variant="outline">
                              {holding.acquisitionType}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Acquired: {new Date(holding.acquisitionDate).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No holdings</p>
                  )}
                </div>

                {/* Grants */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Equity Grants
                  </h3>
                  {grants && grants.length > 0 ? (
                    <div className="space-y-2">
                      {grants.map((grant) => (
                        <div key={grant.id} className="p-3 border rounded-lg bg-muted/30">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {grant.grantNumber || `Grant #${grant.id}`}
                            </span>
                            <Badge variant={grant.status === "active" ? "default" : "secondary"}>
                              {grant.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {new Intl.NumberFormat().format(Number(grant.sharesGranted))} {grant.grantType.toUpperCase()} @ ${grant.exercisePrice}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Grant Date: {new Date(grant.grantDate).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No grants</p>
                  )}
                </div>

                {/* Notes */}
                {selectedShareholder.notes && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Notes
                    </h3>
                    <p className="text-sm">{selectedShareholder.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
