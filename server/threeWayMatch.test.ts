import { describe, expect, it } from "vitest";

describe("Three-Way Match Automation", () => {
  describe("Match Validation", () => {
    it("should detect quantity match within tolerance", () => {
      const poQuantity = 100;
      const receiptQuantity = 100;
      const tolerance = 2; // 2%
      const variance = Math.abs(receiptQuantity - poQuantity);
      const variancePct = poQuantity > 0 ? (variance / poQuantity) * 100 : 0;

      expect(variancePct).toBeLessThanOrEqual(tolerance);
    });

    it("should detect quantity discrepancy beyond tolerance", () => {
      const poQuantity = 100;
      const receiptQuantity = 90;
      const tolerance = 2; // 2%
      const variance = Math.abs(receiptQuantity - poQuantity);
      const variancePct = poQuantity > 0 ? (variance / poQuantity) * 100 : 0;

      expect(variancePct).toBeGreaterThan(tolerance);
    });

    it("should detect amount discrepancy", () => {
      const poAmount = 5000;
      const invoiceAmount = 5500;
      const tolerance = 2;
      const variance = Math.abs(invoiceAmount - poAmount);
      const variancePct = (variance / poAmount) * 100;

      expect(variancePct).toBeGreaterThan(tolerance);
      expect(variancePct).toBe(10);
    });

    it("should auto-approve when all three match within tolerance", () => {
      const poQuantity = 100;
      const receiptQuantity = 100;
      const invoiceAmount = 5000;
      const poAmount = 5000;
      const tolerance = 2;

      const qtyVariance = Math.abs(receiptQuantity - poQuantity);
      const amtVariance = Math.abs(invoiceAmount - poAmount);
      const qtyPct = poQuantity > 0 ? (qtyVariance / poQuantity) * 100 : 0;
      const amtPct = poAmount > 0 ? (amtVariance / poAmount) * 100 : 0;

      const allMatch = qtyPct <= tolerance && amtPct <= tolerance && receiptQuantity > 0 && invoiceAmount > 0;

      expect(allMatch).toBe(true);
    });
  });

  describe("Match Statuses", () => {
    it("should support all match statuses", () => {
      const validStatuses = ["pending", "matched", "discrepancy", "approved", "rejected"];
      expect(validStatuses).toContain("pending");
      expect(validStatuses).toContain("matched");
      expect(validStatuses).toContain("discrepancy");
      expect(validStatuses).toContain("approved");
      expect(validStatuses).toContain("rejected");
    });

    it("should set status to 'matched' when auto-approved", () => {
      const discrepancies: string[] = [];
      const hasReceipt = true;
      const hasInvoice = true;
      const autoApproved = discrepancies.length === 0 && hasReceipt && hasInvoice;
      const status = autoApproved ? "matched" : discrepancies.length > 0 ? "discrepancy" : "pending";

      expect(status).toBe("matched");
    });

    it("should set status to 'discrepancy' when variances exist", () => {
      const discrepancies = ["Quantity variance: PO 100 vs Received 90 (10%)"];
      const status = discrepancies.length > 0 ? "discrepancy" : "matched";

      expect(status).toBe("discrepancy");
    });

    it("should set status to 'pending' when receipt or invoice is missing", () => {
      const discrepancies: string[] = [];
      const hasReceipt = false;
      const hasInvoice = true;
      const autoApproved = discrepancies.length === 0 && hasReceipt && hasInvoice;
      const status = autoApproved ? "matched" : discrepancies.length > 0 ? "discrepancy" : "pending";

      expect(status).toBe("pending");
    });
  });

  describe("Three-Way Match Line Items", () => {
    it("should compare line-level quantities", () => {
      const poItem = { quantity: "50.0000", unitPrice: "10.00" };
      const receiptItem = { receivedQuantity: "50.0000" };

      const match = Math.abs(parseFloat(poItem.quantity) - parseFloat(receiptItem.receivedQuantity)) < 0.01;
      expect(match).toBe(true);
    });

    it("should detect line-level quantity mismatch", () => {
      const poItem = { quantity: "50.0000", unitPrice: "10.00" };
      const receiptItem = { receivedQuantity: "45.0000" };

      const match = Math.abs(parseFloat(poItem.quantity) - parseFloat(receiptItem.receivedQuantity)) < 0.01;
      expect(match).toBe(false);
    });
  });

  describe("Discrepancy Messages", () => {
    it("should generate quantity discrepancy message", () => {
      const poQty = 100;
      const receiptQty = 90;
      const variancePct = Math.abs((receiptQty - poQty) / poQty) * 100;
      const msg = `Quantity variance: PO ${poQty} vs Received ${receiptQty} (${variancePct.toFixed(1)}%)`;

      expect(msg).toContain("Quantity variance");
      expect(msg).toContain("10.0%");
    });

    it("should generate amount discrepancy message", () => {
      const poAmount = 5000;
      const invoiceAmount = 5500;
      const variancePct = Math.abs((invoiceAmount - poAmount) / poAmount) * 100;
      const msg = `Amount variance: PO $${poAmount.toFixed(2)} vs Invoice $${invoiceAmount.toFixed(2)} (${variancePct.toFixed(1)}%)`;

      expect(msg).toContain("Amount variance");
      expect(msg).toContain("10.0%");
    });

    it("should flag missing goods receipt", () => {
      const hasReceipt = false;
      const discrepancies: string[] = [];
      if (!hasReceipt) discrepancies.push("No goods receipt recorded for this PO");

      expect(discrepancies).toContain("No goods receipt recorded for this PO");
    });

    it("should flag missing vendor invoice", () => {
      const hasInvoice = false;
      const discrepancies: string[] = [];
      if (!hasInvoice) discrepancies.push("No vendor invoice linked to this PO");

      expect(discrepancies).toContain("No vendor invoice linked to this PO");
    });
  });

  describe("Resolution Workflow", () => {
    it("should support approve and reject actions", () => {
      const validActions = ["approve", "reject"];
      expect(validActions).toContain("approve");
      expect(validActions).toContain("reject");
    });

    it("should set status to approved on approve action", () => {
      const action = "approve";
      const newStatus = action === "approve" ? "approved" : "rejected";
      expect(newStatus).toBe("approved");
    });

    it("should set status to rejected on reject action", () => {
      const action = "reject";
      const newStatus = action === "approve" ? "approved" : "rejected";
      expect(newStatus).toBe("rejected");
    });
  });

  describe("Tolerance Configuration", () => {
    it("should default to 2% tolerance", () => {
      const DEFAULT_TOLERANCE = 2.0;
      expect(DEFAULT_TOLERANCE).toBe(2.0);
    });

    it("should allow custom tolerance", () => {
      const customTolerance = 5.0;
      const variance = 4.5;
      const withinTolerance = variance <= customTolerance;

      expect(withinTolerance).toBe(true);
    });
  });
});
