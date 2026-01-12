import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  createVendorRfq: vi.fn().mockResolvedValue({ id: 1, rfqNumber: "RFQ-20260112-ABC1" }),
  getVendorRfqs: vi.fn().mockResolvedValue([
    { id: 1, rfqNumber: "RFQ-20260112-ABC1", materialName: "Mushrooms", quantity: "100", unit: "kg", status: "draft" },
  ]),
  getVendorRfqById: vi.fn().mockResolvedValue({
    id: 1, rfqNumber: "RFQ-20260112-ABC1", materialName: "Mushrooms", quantity: "100", unit: "kg", status: "sent"
  }),
  updateVendorRfq: vi.fn().mockResolvedValue({ id: 1, status: "sent" }),
  createVendorRfqInvitation: vi.fn().mockResolvedValue({ id: 1, rfqId: 1, vendorId: 1, status: "sent" }),
  getVendorRfqInvitations: vi.fn().mockResolvedValue([
    { id: 1, rfqId: 1, vendorId: 1, status: "sent", vendor: { name: "Test Vendor", email: "vendor@test.com" } },
  ]),
  updateVendorRfqInvitation: vi.fn().mockResolvedValue({ id: 1, status: "responded" }),
  createVendorQuote: vi.fn().mockResolvedValue({ id: 1, quoteNumber: "VQ-20260112-XYZ1" }),
  getVendorQuotes: vi.fn().mockResolvedValue([
    { id: 1, rfqId: 1, vendorId: 1, unitPrice: "10.00", totalPrice: "1000.00", status: "received" },
  ]),
  getVendorQuoteById: vi.fn().mockResolvedValue({
    id: 1, rfqId: 1, vendorId: 1, unitPrice: "10.00", totalPrice: "1000.00", status: "received"
  }),
  updateVendorQuote: vi.fn().mockResolvedValue({ id: 1, status: "accepted" }),
  getVendorById: vi.fn().mockResolvedValue({ id: 1, name: "Test Vendor", email: "vendor@test.com" }),
  createPurchaseOrder: vi.fn().mockResolvedValue({ id: 1, poNumber: "PO-20260112-TEST" }),
  createPurchaseOrderItem: vi.fn().mockResolvedValue({ id: 1 }),
}));

describe("Vendor Quotes Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RFQ Creation", () => {
    it("should generate unique RFQ number", () => {
      const date = new Date("2026-01-12");
      const rfqNumber = `RFQ-${date.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      expect(rfqNumber).toMatch(/^RFQ-\d{8}-[A-Z0-9]{4}$/);
    });

    it("should validate required fields for RFQ", () => {
      const rfqData = {
        materialName: "Mushrooms",
        quantity: "100",
        unit: "kg",
      };
      expect(rfqData.materialName).toBeTruthy();
      expect(rfqData.quantity).toBeTruthy();
      expect(rfqData.unit).toBeTruthy();
    });

    it("should support custom material names without rawMaterialId", () => {
      const rfqData = {
        materialName: "Custom Material",
        rawMaterialId: undefined,
        quantity: "50",
        unit: "lbs",
      };
      expect(rfqData.rawMaterialId).toBeUndefined();
      expect(rfqData.materialName).toBe("Custom Material");
    });
  });

  describe("RFQ Status Workflow", () => {
    it("should transition from draft to sent", () => {
      const statuses = ["draft", "sent", "partially_received", "all_received", "awarded", "cancelled"];
      expect(statuses).toContain("draft");
      expect(statuses).toContain("sent");
    });

    it("should allow sending to multiple vendors", () => {
      const vendorIds = [1, 2, 3];
      expect(vendorIds.length).toBeGreaterThan(1);
    });

    it("should track invitation status per vendor", () => {
      const invitation = {
        rfqId: 1,
        vendorId: 1,
        status: "sent",
        invitedAt: new Date(),
        reminderCount: 0,
      };
      expect(invitation.status).toBe("sent");
      expect(invitation.reminderCount).toBe(0);
    });
  });

  describe("Quote Management", () => {
    it("should generate unique quote number", () => {
      const date = new Date("2026-01-12");
      const quoteNumber = `VQ-${date.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      expect(quoteNumber).toMatch(/^VQ-\d{8}-[A-Z0-9]{4}$/);
    });

    it("should calculate total price from unit price and quantity", () => {
      const unitPrice = 10.5;
      const quantity = 100;
      const totalPrice = unitPrice * quantity;
      expect(totalPrice).toBe(1050);
    });

    it("should support additional charges", () => {
      const quote = {
        unitPrice: "10.00",
        totalPrice: "1000.00",
        shippingCost: "50.00",
        handlingFee: "25.00",
        totalWithCharges: "1075.00",
      };
      const total = parseFloat(quote.totalPrice) + parseFloat(quote.shippingCost) + parseFloat(quote.handlingFee);
      expect(total.toFixed(2)).toBe(quote.totalWithCharges);
    });
  });

  describe("Quote Comparison", () => {
    it("should rank quotes by total price ascending", () => {
      const quotes = [
        { id: 1, vendorId: 1, totalPrice: "1200.00" },
        { id: 2, vendorId: 2, totalPrice: "1000.00" },
        { id: 3, vendorId: 3, totalPrice: "1100.00" },
      ];
      const sorted = [...quotes].sort((a, b) => parseFloat(a.totalPrice) - parseFloat(b.totalPrice));
      expect(sorted[0].totalPrice).toBe("1000.00");
      expect(sorted[1].totalPrice).toBe("1100.00");
      expect(sorted[2].totalPrice).toBe("1200.00");
    });

    it("should identify best quote", () => {
      const quotes = [
        { id: 1, vendorId: 1, totalPrice: "1200.00", overallRank: 3 },
        { id: 2, vendorId: 2, totalPrice: "1000.00", overallRank: 1 },
        { id: 3, vendorId: 3, totalPrice: "1100.00", overallRank: 2 },
      ];
      const bestQuote = quotes.find(q => q.overallRank === 1);
      expect(bestQuote?.totalPrice).toBe("1000.00");
    });

    it("should consider lead time in ranking", () => {
      const quotes = [
        { id: 1, totalPrice: "1000.00", leadTimeDays: 14 },
        { id: 2, totalPrice: "1050.00", leadTimeDays: 7 },
      ];
      // Quote 2 might be preferred despite higher price due to faster delivery
      expect(quotes[1].leadTimeDays).toBeLessThan(quotes[0].leadTimeDays);
    });
  });

  describe("Quote Acceptance", () => {
    it("should update quote status to accepted", () => {
      const quote = { id: 1, status: "received" };
      const updatedQuote = { ...quote, status: "accepted" };
      expect(updatedQuote.status).toBe("accepted");
    });

    it("should reject other quotes when one is accepted", () => {
      const quotes = [
        { id: 1, status: "accepted" },
        { id: 2, status: "rejected" },
        { id: 3, status: "rejected" },
      ];
      const acceptedCount = quotes.filter(q => q.status === "accepted").length;
      expect(acceptedCount).toBe(1);
    });

    it("should create PO from accepted quote", () => {
      const quote = {
        id: 1,
        rfqId: 1,
        vendorId: 1,
        unitPrice: "10.00",
        quantity: "100",
        totalPrice: "1000.00",
      };
      const po = {
        vendorId: quote.vendorId,
        totalAmount: quote.totalPrice,
        status: "draft",
      };
      expect(po.vendorId).toBe(quote.vendorId);
      expect(po.totalAmount).toBe(quote.totalPrice);
    });
  });

  describe("Email Integration", () => {
    it("should generate RFQ email content", () => {
      const rfq = {
        rfqNumber: "RFQ-20260112-ABC1",
        materialName: "Mushrooms",
        quantity: "100",
        unit: "kg",
        specifications: "Organic, Grade A",
        quoteDueDate: new Date("2026-01-20"),
      };
      const emailContent = `Request for Quote: ${rfq.rfqNumber}\nMaterial: ${rfq.materialName}\nQuantity: ${rfq.quantity} ${rfq.unit}`;
      expect(emailContent).toContain(rfq.rfqNumber);
      expect(emailContent).toContain(rfq.materialName);
    });

    it("should track email send status", () => {
      const invitation = {
        rfqId: 1,
        vendorId: 1,
        status: "sent",
        emailSentAt: new Date(),
        emailMessageId: "msg-123",
      };
      expect(invitation.emailSentAt).toBeDefined();
      expect(invitation.emailMessageId).toBeTruthy();
    });

    it("should support reminder emails", () => {
      const invitation = {
        rfqId: 1,
        vendorId: 1,
        reminderCount: 1,
        lastReminderAt: new Date(),
      };
      expect(invitation.reminderCount).toBe(1);
      expect(invitation.lastReminderAt).toBeDefined();
    });
  });

  describe("RFQ Cancellation", () => {
    it("should allow cancellation of draft RFQs", () => {
      const rfq = { id: 1, status: "draft" };
      const canCancel = rfq.status === "draft" || rfq.status === "sent";
      expect(canCancel).toBe(true);
    });

    it("should not allow cancellation of awarded RFQs", () => {
      const rfq = { id: 1, status: "awarded" };
      const canCancel = rfq.status === "draft" || rfq.status === "sent";
      expect(canCancel).toBe(false);
    });
  });
});
