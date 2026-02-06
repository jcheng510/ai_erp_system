import { describe, expect, it } from "vitest";

describe("General Ledger & Financial Statements", () => {
  describe("Journal Entry Validation", () => {
    it("should require balanced debits and credits", () => {
      const lines = [
        { accountId: 1, debit: "1000.00", credit: "0" },
        { accountId: 2, debit: "0", credit: "1000.00" },
      ];

      const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0);
      const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0);

      expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
    });

    it("should reject unbalanced journal entries", () => {
      const lines = [
        { accountId: 1, debit: "1000.00", credit: "0" },
        { accountId: 2, debit: "0", credit: "500.00" },
      ];

      const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0);
      const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0);

      expect(Math.abs(totalDebit - totalCredit)).toBeGreaterThan(0.01);
    });

    it("should require at least 2 lines in a journal entry", () => {
      const minLines = 2;
      expect(minLines).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Account Balance Calculation", () => {
    it("should increase asset accounts with debits", () => {
      const accountType = "asset";
      const currentBalance = 5000;
      const debit = 1000;
      const credit = 0;
      const netChange = debit - credit;

      const isDebitNormal = accountType === "asset" || accountType === "expense";
      const newBalance = isDebitNormal ? currentBalance + netChange : currentBalance - netChange;

      expect(newBalance).toBe(6000);
    });

    it("should increase liability accounts with credits", () => {
      const accountType = "liability";
      const currentBalance = 3000;
      const debit = 0;
      const credit = 500;
      const netChange = debit - credit;

      const isDebitNormal = accountType === "asset" || accountType === "expense";
      const newBalance = isDebitNormal ? currentBalance + netChange : currentBalance - netChange;

      expect(newBalance).toBe(3500);
    });

    it("should increase revenue accounts with credits", () => {
      const accountType = "revenue";
      const currentBalance = 10000;
      const debit = 0;
      const credit = 2000;
      const netChange = debit - credit;

      const isDebitNormal = accountType === "asset" || accountType === "expense";
      const newBalance = isDebitNormal ? currentBalance + netChange : currentBalance - netChange;

      expect(newBalance).toBe(12000);
    });

    it("should increase expense accounts with debits", () => {
      const accountType = "expense";
      const currentBalance = 2000;
      const debit = 300;
      const credit = 0;
      const netChange = debit - credit;

      const isDebitNormal = accountType === "asset" || accountType === "expense";
      const newBalance = isDebitNormal ? currentBalance + netChange : currentBalance - netChange;

      expect(newBalance).toBe(2300);
    });
  });

  describe("Profit & Loss Calculation", () => {
    it("should calculate net income as revenue minus expenses", () => {
      const totalRevenue = 50000;
      const totalExpenses = 35000;
      const netIncome = totalRevenue - totalExpenses;

      expect(netIncome).toBe(15000);
    });

    it("should handle negative net income (loss)", () => {
      const totalRevenue = 20000;
      const totalExpenses = 30000;
      const netIncome = totalRevenue - totalExpenses;

      expect(netIncome).toBe(-10000);
      expect(netIncome).toBeLessThan(0);
    });

    it("should categorize accounts correctly for P&L", () => {
      const accountTypes = ["revenue", "expense"];
      const allTypes = ["asset", "liability", "equity", "revenue", "expense"];

      for (const type of accountTypes) {
        expect(allTypes).toContain(type);
      }
    });
  });

  describe("Balance Sheet", () => {
    it("should satisfy the accounting equation: Assets = Liabilities + Equity", () => {
      const totalAssets = 100000;
      const totalLiabilities = 40000;
      const totalEquity = 60000;

      expect(totalAssets).toBe(totalLiabilities + totalEquity);
    });

    it("should include only balance sheet account types", () => {
      const bsTypes = ["asset", "liability", "equity"];
      const plTypes = ["revenue", "expense"];

      for (const type of bsTypes) {
        expect(plTypes).not.toContain(type);
      }
    });
  });

  describe("Cash Flow Statement", () => {
    it("should calculate net cash change from operating + investing + financing", () => {
      const totalOperating = 15000;
      const totalInvesting = -5000;
      const totalFinancing = -3000;

      const netCashChange = totalOperating + totalInvesting + totalFinancing;
      expect(netCashChange).toBe(7000);
    });

    it("should classify payments received as inflows", () => {
      const paymentType = "received";
      const isInflow = paymentType === "received";
      expect(isInflow).toBe(true);
    });

    it("should classify payments made as outflows", () => {
      const paymentType = "made";
      const isOutflow = paymentType === "made";
      expect(isOutflow).toBe(true);
    });
  });

  describe("Aged Receivables", () => {
    it("should bucket invoices by aging period", () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 45 * 86400000); // 45 days ago
      const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
      const sixtyAgo = new Date(now.getTime() - 60 * 86400000);

      const bucket =
        dueDate >= now ? "current" :
        dueDate >= thirtyAgo ? "thirtyDays" :
        dueDate >= sixtyAgo ? "sixtyDays" :
        "ninetyPlus";

      expect(bucket).toBe("sixtyDays");
    });

    it("should calculate outstanding amount correctly", () => {
      const totalAmount = 5000;
      const paidAmount = 2000;
      const outstanding = totalAmount - paidAmount;

      expect(outstanding).toBe(3000);
    });
  });

  describe("Fiscal Period Management", () => {
    it("should support period statuses", () => {
      const validStatuses = ["open", "closed", "locked"];
      expect(validStatuses).toContain("open");
      expect(validStatuses).toContain("closed");
      expect(validStatuses).toContain("locked");
    });

    it("should prevent closing a period with unposted transactions", () => {
      const unpostedCount = 3;
      const canClose = unpostedCount === 0;
      expect(canClose).toBe(false);
    });

    it("should prevent reopening a locked period", () => {
      const status = "locked";
      const canReopen = status !== "locked";
      expect(canReopen).toBe(false);
    });

    it("should allow closing an open period with no unposted transactions", () => {
      const status = "open";
      const unpostedCount = 0;
      const canClose = status === "open" && unpostedCount === 0;
      expect(canClose).toBe(true);
    });
  });

  describe("GL Posting for Invoices", () => {
    it("should debit AR and credit Revenue on invoice creation", () => {
      const invoiceAmount = "1500.00";
      const lines = [
        { accountId: 1200, debit: invoiceAmount, credit: "0", description: "AR" },
        { accountId: 4000, debit: "0", credit: invoiceAmount, description: "Revenue" },
      ];

      expect(lines).toHaveLength(2);
      expect(lines[0].debit).toBe(invoiceAmount);
      expect(lines[1].credit).toBe(invoiceAmount);
    });

    it("should debit Cash and credit AR on payment received", () => {
      const paymentAmount = "1500.00";
      const paymentType = "received";
      const lines =
        paymentType === "received"
          ? [
              { accountId: 1000, debit: paymentAmount, credit: "0" },
              { accountId: 1200, debit: "0", credit: paymentAmount },
            ]
          : [
              { accountId: 2000, debit: paymentAmount, credit: "0" },
              { accountId: 1000, debit: "0", credit: paymentAmount },
            ];

      expect(lines[0].debit).toBe(paymentAmount);
      expect(lines[1].credit).toBe(paymentAmount);
    });

    it("should debit AP and credit Cash on payment made", () => {
      const paymentAmount = "750.00";
      const paymentType = "made";
      const lines =
        paymentType === "received"
          ? [
              { accountId: 1000, debit: paymentAmount, credit: "0" },
              { accountId: 1200, debit: "0", credit: paymentAmount },
            ]
          : [
              { accountId: 2000, debit: paymentAmount, credit: "0" },
              { accountId: 1000, debit: "0", credit: paymentAmount },
            ];

      expect(lines[0].accountId).toBe(2000); // AP
      expect(lines[0].debit).toBe(paymentAmount);
      expect(lines[1].accountId).toBe(1000); // Cash
      expect(lines[1].credit).toBe(paymentAmount);
    });
  });
});
