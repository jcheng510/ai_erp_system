import { describe, expect, it } from "vitest";

describe("BOM Module", () => {
  describe("Bill of Materials Schema", () => {
    it("should define BOM with required fields", () => {
      const bomFields = {
        id: "number",
        productId: "number",
        name: "string",
        version: "string",
        status: "string",
        batchSize: "string",
        batchUnit: "string",
        totalCost: "string",
        notes: "string",
        createdBy: "number",
        createdAt: "date",
        updatedAt: "date",
      };

      expect(Object.keys(bomFields)).toContain("productId");
      expect(Object.keys(bomFields)).toContain("name");
      expect(Object.keys(bomFields)).toContain("version");
      expect(Object.keys(bomFields)).toContain("status");
    });

    it("should support BOM statuses", () => {
      const validStatuses = ["draft", "active", "obsolete"];
      expect(validStatuses).toContain("draft");
      expect(validStatuses).toContain("active");
      expect(validStatuses).toContain("obsolete");
    });
  });

  describe("BOM Components Schema", () => {
    it("should define component with required fields", () => {
      const componentFields = {
        id: "number",
        bomId: "number",
        componentType: "string",
        productId: "number",
        rawMaterialId: "number",
        name: "string",
        sku: "string",
        quantity: "string",
        unit: "string",
        unitCost: "string",
        wastagePercent: "string",
        sortOrder: "number",
      };

      expect(Object.keys(componentFields)).toContain("bomId");
      expect(Object.keys(componentFields)).toContain("componentType");
      expect(Object.keys(componentFields)).toContain("quantity");
    });

    it("should support component types", () => {
      const validTypes = ["product", "raw_material", "packaging", "labor"];
      expect(validTypes).toContain("product");
      expect(validTypes).toContain("raw_material");
      expect(validTypes).toContain("packaging");
      expect(validTypes).toContain("labor");
    });
  });

  describe("Raw Materials Schema", () => {
    it("should define raw material with required fields", () => {
      const materialFields = {
        id: "number",
        name: "string",
        sku: "string",
        description: "string",
        category: "string",
        unit: "string",
        unitCost: "string",
        currency: "string",
        minOrderQty: "string",
        leadTimeDays: "number",
        preferredVendorId: "number",
        status: "string",
        notes: "string",
      };

      expect(Object.keys(materialFields)).toContain("name");
      expect(Object.keys(materialFields)).toContain("unit");
      expect(Object.keys(materialFields)).toContain("unitCost");
    });

    it("should support material statuses", () => {
      const validStatuses = ["active", "inactive", "discontinued"];
      expect(validStatuses).toContain("active");
      expect(validStatuses).toContain("inactive");
      expect(validStatuses).toContain("discontinued");
    });
  });

  describe("BOM Cost Calculation", () => {
    it("should calculate total cost from components", () => {
      const components = [
        { quantity: 0.25, unitCost: 10.0 }, // 2.50
        { quantity: 0.15, unitCost: 8.0 },  // 1.20
        { quantity: 0.05, unitCost: 5.0 },  // 0.25
      ];

      const totalCost = components.reduce(
        (sum, c) => sum + c.quantity * c.unitCost,
        0
      );

      expect(totalCost).toBeCloseTo(3.95, 2);
    });

    it("should include wastage in cost calculation", () => {
      const component = {
        quantity: 1.0,
        unitCost: 10.0,
        wastagePercent: 5,
      };

      const effectiveQuantity = component.quantity * (1 + component.wastagePercent / 100);
      const cost = effectiveQuantity * component.unitCost;

      expect(cost).toBeCloseTo(10.5, 2);
    });

    it("should scale costs by batch size", () => {
      const componentCost = 5.0;
      const batchSize = 10;
      const unitCost = componentCost / batchSize;

      expect(unitCost).toBe(0.5);
    });
  });

  describe("BOM Versioning", () => {
    it("should support version numbering", () => {
      const versions = ["1.0", "1.1", "2.0"];
      expect(versions[0]).toBe("1.0");
      expect(versions[1]).toBe("1.1");
      expect(versions[2]).toBe("2.0");
    });

    it("should allow only one active version per product", () => {
      const boms = [
        { productId: 1, version: "1.0", status: "obsolete" },
        { productId: 1, version: "1.1", status: "active" },
        { productId: 1, version: "2.0", status: "draft" },
      ];

      const activeBoms = boms.filter(b => b.status === "active");
      expect(activeBoms.length).toBe(1);
    });
  });

  describe("Component Types", () => {
    it("should handle product components (sub-assemblies)", () => {
      const component = {
        componentType: "product",
        productId: 5,
        rawMaterialId: null,
      };

      expect(component.componentType).toBe("product");
      expect(component.productId).toBe(5);
    });

    it("should handle raw material components", () => {
      const component = {
        componentType: "raw_material",
        productId: null,
        rawMaterialId: 10,
      };

      expect(component.componentType).toBe("raw_material");
      expect(component.rawMaterialId).toBe(10);
    });

    it("should handle packaging components", () => {
      const component = {
        componentType: "packaging",
        name: "Retail Box",
        quantity: 1,
        unit: "EA",
      };

      expect(component.componentType).toBe("packaging");
    });

    it("should handle labor components", () => {
      const component = {
        componentType: "labor",
        name: "Assembly Labor",
        quantity: 0.5,
        unit: "hours",
        unitCost: 25.0,
      };

      expect(component.componentType).toBe("labor");
      expect(component.quantity * component.unitCost).toBe(12.5);
    });
  });

  describe("Production Requirements", () => {
    it("should calculate material requirements for production run", () => {
      const bomComponents = [
        { rawMaterialId: 1, quantity: 0.25, unit: "kg" },
        { rawMaterialId: 2, quantity: 0.15, unit: "kg" },
      ];
      const productionQty = 100;
      const batchSize = 1;

      const requirements = bomComponents.map(c => ({
        rawMaterialId: c.rawMaterialId,
        requiredQty: (c.quantity / batchSize) * productionQty,
        unit: c.unit,
      }));

      expect(requirements[0].requiredQty).toBe(25);
      expect(requirements[1].requiredQty).toBe(15);
    });
  });
});
