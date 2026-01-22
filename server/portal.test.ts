import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(userOverrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "vendor",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    linkedVendorId: 1,
    ...userOverrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("vendorPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCustomsClearances", () => {
    it("should return customs clearances for vendor's shipments", async () => {
      const ctx = createMockContext({ role: "vendor", linkedVendorId: 1 });
      const caller = appRouter.createCaller(ctx);

      // Mock database calls
      vi.spyOn(db, "getCustomsClearances").mockResolvedValue([
        {
          id: 1,
          clearanceNumber: "CC-2026-00001",
          shipmentId: 1,
          type: "import" as const,
          status: "pending_documents" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        {
          id: 2,
          clearanceNumber: "CC-2026-00002",
          shipmentId: 2,
          type: "import" as const,
          status: "cleared" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      vi.spyOn(db, "getPurchaseOrders").mockResolvedValue([
        { id: 1, vendorId: 1 } as any,
        { id: 2, vendorId: 2 } as any,
      ]);

      vi.spyOn(db, "getShipments").mockResolvedValue([
        { id: 1, purchaseOrderId: 1 } as any,
        { id: 2, purchaseOrderId: 2 } as any,
        { id: 3, purchaseOrderId: 1 } as any,
      ]);

      const result = await caller.vendorPortal.getCustomsClearances();

      // Vendor should only see clearances for shipments related to their POs
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(result[0]?.shipmentId).toBe(1);
    });

    it("should return all customs clearances for admin users", async () => {
      const ctx = createMockContext({ role: "admin", linkedVendorId: undefined });
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getCustomsClearances").mockResolvedValue([
        {
          id: 1,
          clearanceNumber: "CC-2026-00001",
          shipmentId: 1,
          type: "import" as const,
          status: "pending_documents" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        {
          id: 2,
          clearanceNumber: "CC-2026-00002",
          shipmentId: 2,
          type: "export" as const,
          status: "cleared" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const result = await caller.vendorPortal.getCustomsClearances();

      // Admin should see all clearances
      expect(result).toHaveLength(2);
    });
  });

  describe("getCustomsDocuments", () => {
    it("should allow vendor to view documents for their clearances", async () => {
      const ctx = createMockContext({ role: "vendor", linkedVendorId: 1 });
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getCustomsClearanceById").mockResolvedValue({
        id: 1,
        clearanceNumber: "CC-2026-00001",
        shipmentId: 1,
        type: "import" as const,
        status: "pending_documents" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(db, "getShipmentById").mockResolvedValue({
        id: 1,
        purchaseOrderId: 1,
      } as any);

      vi.spyOn(db, "getPurchaseOrderById").mockResolvedValue({
        id: 1,
        vendorId: 1,
      } as any);

      vi.spyOn(db, "getCustomsDocuments").mockResolvedValue([
        {
          id: 1,
          clearanceId: 1,
          documentType: "commercial_invoice" as const,
          name: "invoice.pdf",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const result = await caller.vendorPortal.getCustomsDocuments({ clearanceId: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]?.documentType).toBe("commercial_invoice");
    });

    it("should deny vendor access to other vendors' clearances", async () => {
      const ctx = createMockContext({ role: "vendor", linkedVendorId: 1 });
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getCustomsClearanceById").mockResolvedValue({
        id: 2,
        clearanceNumber: "CC-2026-00002",
        shipmentId: 2,
        type: "import" as const,
        status: "pending_documents" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(db, "getShipmentById").mockResolvedValue({
        id: 2,
        purchaseOrderId: 2,
      } as any);

      vi.spyOn(db, "getPurchaseOrderById").mockResolvedValue({
        id: 2,
        vendorId: 2, // Different vendor
      } as any);

      await expect(
        caller.vendorPortal.getCustomsDocuments({ clearanceId: 2 })
      ).rejects.toThrow("You do not have access to this customs clearance");
    });
  });
});

describe("copackerPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCustomsClearances", () => {
    it("should return customs clearances for copacker's warehouse", async () => {
      const ctx = createMockContext({ role: "copacker", linkedWarehouseId: 1 });
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getCustomsClearances").mockResolvedValue([
        {
          id: 1,
          clearanceNumber: "CC-2026-00001",
          shipmentId: 1,
          type: "import" as const,
          status: "pending_documents" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        {
          id: 2,
          clearanceNumber: "CC-2026-00002",
          shipmentId: 2,
          type: "import" as const,
          status: "cleared" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      vi.spyOn(db, "getShipments").mockResolvedValue([
        { id: 1 } as any,
        { id: 2 } as any,
      ]);

      const result = await caller.copackerPortal.getCustomsClearances();

      // Copacker should see clearances for available shipments
      expect(result).toHaveLength(2);
    });

    it("should return all customs clearances for admin users", async () => {
      const ctx = createMockContext({ role: "admin", linkedWarehouseId: undefined });
      const caller = appRouter.createCaller(ctx);

      vi.spyOn(db, "getCustomsClearances").mockResolvedValue([
        {
          id: 1,
          clearanceNumber: "CC-2026-00001",
          shipmentId: 1,
          type: "import" as const,
          status: "pending_documents" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const result = await caller.copackerPortal.getCustomsClearances();

      expect(result).toHaveLength(1);
    });
  });
});
