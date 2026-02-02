import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Package, Tag, DollarSign, Barcode, Layers, Pencil } from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { EditableField } from "@/components/ui/click-to-edit";

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

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id || "0");

  const { data: product, isLoading, refetch } = trpc.products.get.useQuery({ id: productId });
  const { data: inventory } = trpc.inventory.list.useQuery({ productId });
  const utils = trpc.useUtils();

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Product updated");
      refetch();
      utils.products.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpdate = async (field: string, value: string) => {
    await updateProduct.mutateAsync({
      id: productId,
      [field]: value,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">Loading...</div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">Product not found</div>
    );
  }

  const totalInventory = inventory?.reduce((sum, inv) =>
    sum + parseFloat(inv.quantity?.toString() || "0"), 0) || 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link href="/operations/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </Link>
        <div className="flex-1">
          <EditableField
            label=""
            value={product.name}
            onSave={(value) => handleUpdate("name", value)}
            displayClassName="text-2xl font-bold"
            required
          />
          <p className="text-muted-foreground font-mono">{product.sku}</p>
        </div>
        <EditableField
          label=""
          value={product.status}
          type="badge"
          options={statusOptions}
          onSave={(value) => handleUpdate("status", value)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Product Information
              <span className="text-xs font-normal text-muted-foreground ml-auto flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Click to edit
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground flex items-center gap-2">
                <Barcode className="w-4 h-4" />
                SKU
              </Label>
              <p className="font-mono">{product.sku}</p>
            </div>
            <EditableField
              label="Name"
              value={product.name}
              onSave={(value) => handleUpdate("name", value)}
              required
            />
            <EditableField
              label="Category"
              icon={<Tag className="w-4 h-4" />}
              value={product.category}
              onSave={(value) => handleUpdate("category", value)}
              emptyText="No category"
              placeholder="Enter category..."
            />
            <EditableField
              label="Type"
              icon={<Layers className="w-4 h-4" />}
              value={product.type}
              type="badge"
              options={typeOptions}
              onSave={(value) => handleUpdate("type", value)}
            />
            <EditableField
              label="Status"
              value={product.status}
              type="badge"
              options={statusOptions}
              onSave={(value) => handleUpdate("status", value)}
            />
          </CardContent>
        </Card>

        {/* Pricing & Inventory */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Pricing & Inventory
              <span className="text-xs font-normal text-muted-foreground ml-auto flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Click to edit
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EditableField
              label="Unit Price"
              value={product.unitPrice}
              type="currency"
              onSave={(value) => handleUpdate("unitPrice", value)}
              formatDisplay={(val) => formatCurrency(val?.toString())}
              displayClassName="text-2xl font-bold font-mono"
              required
            />
            <EditableField
              label="Cost"
              value={product.costPrice}
              type="currency"
              onSave={(value) => handleUpdate("costPrice", value)}
              formatDisplay={(val) => formatCurrency(val?.toString())}
              displayClassName="font-mono"
              emptyText="Not set"
            />
            <div>
              <Label className="text-muted-foreground">Total Inventory</Label>
              <p className="text-xl font-semibold">{totalInventory} {product.unit || 'units'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Unit</Label>
              <p>{product.unit || "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Description
            <span className="text-xs font-normal text-muted-foreground ml-auto flex items-center gap-1">
              <Pencil className="w-3 h-3" /> Click to edit
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditableField
            label=""
            value={product.description}
            type="textarea"
            onSave={(value) => handleUpdate("description", value)}
            emptyText="No description. Click to add one."
            placeholder="Enter product description..."
            displayClassName="text-sm whitespace-pre-wrap"
          />
        </CardContent>
      </Card>

      {/* Inventory by Location */}
      {inventory && inventory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory by Location</CardTitle>
            <CardDescription>
              Available across {inventory.length} location(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inventory.map((inv) => (
                <div key={inv.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div>
                    <p className="font-medium">Warehouse #{inv.warehouseId}</p>
                    <p className="text-sm text-muted-foreground">Location: {inv.location || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold">{inv.quantity} {product.unit || 'units'}</p>
                    {inv.reservedQuantity && parseFloat(inv.reservedQuantity.toString()) > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Reserved: {inv.reservedQuantity}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
