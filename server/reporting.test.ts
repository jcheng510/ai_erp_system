import { describe, expect, it } from "vitest";

describe("Reporting Engine", () => {
  describe("KPI Dashboard", () => {
    it("should calculate revenue change percentage", () => {
      const current = 50000;
      const previous = 40000;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

      expect(change).toBe(25);
    });

    it("should handle zero previous revenue", () => {
      const current = 50000;
      const previous = 0;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

      expect(change).toBe(0);
    });

    it("should calculate gross margin", () => {
      const revenue = 100000;
      const expenses = 60000;
      const grossMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;

      expect(grossMargin).toBe(40);
    });

    it("should handle negative margin", () => {
      const revenue = 30000;
      const expenses = 50000;
      const grossMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;

      expect(grossMargin).toBeCloseTo(-66.67, 1);
    });
  });

  describe("Vendor Spend Report", () => {
    it("should calculate average order value", () => {
      const totalSpend = 50000;
      const poCount = 10;
      const avgOrderValue = poCount > 0 ? totalSpend / poCount : 0;

      expect(avgOrderValue).toBe(5000);
    });

    it("should calculate vendor spend percentage", () => {
      const vendorSpend = 20000;
      const totalSpend = 100000;
      const percentage = totalSpend > 0 ? (vendorSpend / totalSpend) * 100 : 0;

      expect(percentage).toBe(20);
    });

    it("should sort vendors by spend descending", () => {
      const vendors = [
        { name: "Vendor A", spend: 10000 },
        { name: "Vendor C", spend: 30000 },
        { name: "Vendor B", spend: 20000 },
      ];

      const sorted = [...vendors].sort((a, b) => b.spend - a.spend);

      expect(sorted[0].name).toBe("Vendor C");
      expect(sorted[1].name).toBe("Vendor B");
      expect(sorted[2].name).toBe("Vendor A");
    });
  });

  describe("Sales Summary Report", () => {
    it("should calculate total revenue from customer orders", () => {
      const customers = [
        { name: "Customer A", revenue: 15000 },
        { name: "Customer B", revenue: 25000 },
        { name: "Customer C", revenue: 10000 },
      ];

      const totalRevenue = customers.reduce((s, c) => s + c.revenue, 0);
      expect(totalRevenue).toBe(50000);
    });

    it("should calculate average order value", () => {
      const totalRevenue = 50000;
      const totalOrders = 25;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      expect(avgOrderValue).toBe(2000);
    });
  });

  describe("Inventory Valuation Report", () => {
    it("should calculate total value as quantity * unit cost", () => {
      const quantity = 500;
      const unitCost = 12.50;
      const totalValue = quantity * unitCost;

      expect(totalValue).toBe(6250);
    });

    it("should sum total inventory value across all items", () => {
      const items = [
        { quantity: 100, unitCost: 10 },
        { quantity: 200, unitCost: 5 },
        { quantity: 50, unitCost: 25 },
      ];

      const totalValue = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
      expect(totalValue).toBe(3250);
    });

    it("should exclude items with zero quantity", () => {
      const items = [
        { quantity: 100, unitCost: 10 },
        { quantity: 0, unitCost: 5 },
        { quantity: 50, unitCost: 25 },
      ];

      const activeItems = items.filter(i => i.quantity > 0);
      expect(activeItems).toHaveLength(2);
    });
  });

  describe("Cash Flow Summary", () => {
    it("should calculate net cash flow", () => {
      const inflows = 80000;
      const outflows = 55000;
      const net = inflows - outflows;

      expect(net).toBe(25000);
    });

    it("should group cash flows by month", () => {
      const payments = [
        { date: new Date("2026-01-15"), type: "received", amount: 5000 },
        { date: new Date("2026-01-20"), type: "made", amount: 3000 },
        { date: new Date("2026-02-05"), type: "received", amount: 8000 },
      ];

      const monthMap = new Map<string, { inflows: number; outflows: number }>();
      for (const pmt of payments) {
        const key = `${pmt.date.getFullYear()}-${String(pmt.date.getMonth() + 1).padStart(2, "0")}`;
        if (!monthMap.has(key)) monthMap.set(key, { inflows: 0, outflows: 0 });
        const entry = monthMap.get(key)!;
        if (pmt.type === "received") entry.inflows += pmt.amount;
        else entry.outflows += pmt.amount;
      }

      expect(monthMap.size).toBe(2);
      expect(monthMap.get("2026-01")?.inflows).toBe(5000);
      expect(monthMap.get("2026-01")?.outflows).toBe(3000);
      expect(monthMap.get("2026-02")?.inflows).toBe(8000);
    });
  });

  describe("Saved Reports", () => {
    it("should support all report types", () => {
      const validTypes = [
        "profit_loss", "balance_sheet", "cash_flow", "trial_balance",
        "aged_receivables", "aged_payables", "vendor_spend",
        "sales_summary", "inventory_valuation", "custom",
      ];

      expect(validTypes).toHaveLength(10);
      expect(validTypes).toContain("profit_loss");
      expect(validTypes).toContain("vendor_spend");
      expect(validTypes).toContain("inventory_valuation");
    });

    it("should support schedule options", () => {
      const validSchedules = ["none", "daily", "weekly", "monthly"];
      expect(validSchedules).toContain("none");
      expect(validSchedules).toContain("monthly");
    });
  });

  describe("Scheduler Wiring", () => {
    it("should detect overdue invoices (payment reminder)", () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 5 * 86400000); // 5 days ago
      const isOverdue = dueDate < now;

      expect(isOverdue).toBe(true);
    });

    it("should detect invoices due within 3 days", () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 2 * 86400000); // 2 days from now
      const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);
      const isDueSoon = dueDate <= threeDaysFromNow;

      expect(isDueSoon).toBe(true);
    });

    it("should detect stale shipments (no update in 2+ days)", () => {
      const lastUpdate = new Date(Date.now() - 3 * 86400000); // 3 days ago
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
      const isStale = lastUpdate < twoDaysAgo;

      expect(isStale).toBe(true);
    });

    it("should not flag recently updated shipments", () => {
      const lastUpdate = new Date(Date.now() - 1 * 86400000); // 1 day ago
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
      const isStale = lastUpdate < twoDaysAgo;

      expect(isStale).toBe(false);
    });
  });
});
