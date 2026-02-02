import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Package, Plus, Search, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { EditableCell } from "@/components/ui/click-to-edit";

function formatCurrency(value: string | null | undefined) {
  const num = parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

const statusOptions = [
  { value: "active", label: "Active", color: "bg-green-500/10 text-green-600" },
  { value: "inactive", label: "Inactive", color: "bg-gray-500/10 text-gray-600" },
  { value: "discontinued", label: "Discontinued", color: "bg-red-500/10 text-red-600" },
];

const typeOptions = [
  { value: "physical", label: "Physical", color: "bg-blue-500/10 text-blue-600" },
  { value: "digital", label: "Digital", color: "bg-purple-500/10 text-purple-600" },
  { value: "service", label: "Service", color: "bg-amber-500/10 text-amber-600" },
];

export default function Products() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    type: "physical" as "physical" | "digital" | "service",
    unitPrice: "",
    costPrice: "",
    unit: "each",
  });

  const utils = trpc.useUtils();
  const { data: products, isLoading, refetch } = trpc.products.list.useQuery();

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Product created successfully");
      setIsOpen(false);
      setFormData({
        sku: "", name: "", description: "", category: "",
        type: "physical", unitPrice: "", costPrice: "", unit: "each",
      });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Product updated");
      utils.products.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpdate = async (productId: number, field: string, value: string) => {
    await updateProduct.mutateAsync({
      id: productId,
      [field]: value,
    });
  };

  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProduct.mutate({
      sku: formData.sku,
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category || undefined,
      type: formData.type,
      unitPrice: formData.unitPrice,
      costPrice: formData.costPrice || undefined,

    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8" />
            Products
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog. Click on any cell to edit inline.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Product</DialogTitle>
                <DialogDescription>
                  Add a new product to your catalog.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="PROD-001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Physical</SelectItem>
                        <SelectItem value="digital">Digital</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Product name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Electronics, Clothing, etc."
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">Unit Price *</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      step="0.01"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPrice">Cost Price</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="each"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Product description..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProduct.isPending}>
                  {createProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Product
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Pencil className="h-3 w-3" />
              Click any cell to edit
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredProducts || filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No products found</p>
              <p className="text-sm">Add your first product to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className="group">
                    <TableCell className="font-mono">
                      <Link href={`/operations/products/${product.id}`}>
                        <span className="hover:underline text-primary">{product.sku}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        value={product.name}
                        onSave={(value) => handleUpdate(product.id, "name", value)}
                        required
                        displayClassName="font-medium"
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        value={product.category}
                        onSave={(value) => handleUpdate(product.id, "category", value)}
                        emptyText="-"
                        placeholder="Category..."
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        value={product.type}
                        type="badge"
                        options={typeOptions}
                        onSave={(value) => handleUpdate(product.id, "type", value)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <EditableCell
                        value={product.unitPrice}
                        type="currency"
                        onSave={(value) => handleUpdate(product.id, "unitPrice", value)}
                        formatDisplay={(val) => formatCurrency(val?.toString())}
                        displayClassName="font-mono"
                        cellClassName="justify-end"
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        value={product.status}
                        type="badge"
                        options={statusOptions}
                        onSave={(value) => handleUpdate(product.id, "status", value)}
                      />
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
