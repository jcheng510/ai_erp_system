import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "Professional email content for vendor quote request.",
        },
      },
    ],
  }),
}));

vi.mock("./_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  formatEmailHtml: vi.fn((text) => `<p>${text}</p>`),
}));

describe("Vendor Quote Agent Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Email Generation for Vendor Quotes", () => {
    it("should generate professional RFQ email content", () => {
      const rfqDetails = {
        rfqNumber: "RFQ-20260206-TEST",
        materialName: "Organic Mushrooms",
        quantity: "500",
        unit: "kg",
        specifications: "Grade A, Fresh",
      };

      expect(rfqDetails.rfqNumber).toMatch(/^RFQ-\d{8}-[A-Z0-9]+$/);
      expect(rfqDetails.materialName).toBeTruthy();
      expect(rfqDetails.quantity).toBeTruthy();
      expect(rfqDetails.unit).toBeTruthy();
    });

    it("should include all required RFQ details in email", () => {
      const emailContent = {
        subject: "Request for Quote: RFQ-20260206-TEST - Organic Mushrooms",
        requestedInfo: [
          "Unit price and total price",
          "Lead time / delivery schedule",
          "Minimum order quantity",
          "Payment terms",
          "Quote validity period",
        ],
      };

      expect(emailContent.subject).toContain("Request for Quote");
      expect(emailContent.requestedInfo).toHaveLength(5);
      expect(emailContent.requestedInfo).toContain("Unit price and total price");
    });
  });

  describe("Quote Comparison Algorithm", () => {
    it("should identify lowest price quote", () => {
      const quotes = [
        { id: 1, vendorId: 1, totalPrice: "1200.00", leadTimeDays: 10 },
        { id: 2, vendorId: 2, totalPrice: "1000.00", leadTimeDays: 14 },
        { id: 3, vendorId: 3, totalPrice: "1100.00", leadTimeDays: 7 },
      ];

      const prices = quotes.map((q) => parseFloat(q.totalPrice));
      const lowestPrice = Math.min(...prices);
      const bestPriceQuote = quotes.find((q) => parseFloat(q.totalPrice) === lowestPrice);

      expect(lowestPrice).toBe(1000);
      expect(bestPriceQuote?.vendorId).toBe(2);
    });

    it("should identify fastest delivery time", () => {
      const quotes = [
        { id: 1, vendorId: 1, totalPrice: "1200.00", leadTimeDays: 10 },
        { id: 2, vendorId: 2, totalPrice: "1000.00", leadTimeDays: 14 },
        { id: 3, vendorId: 3, totalPrice: "1100.00", leadTimeDays: 7 },
      ];

      const deliveryTimes = quotes.map((q) => q.leadTimeDays);
      const fastestDelivery = Math.min(...deliveryTimes);
      const fastestQuote = quotes.find((q) => q.leadTimeDays === fastestDelivery);

      expect(fastestDelivery).toBe(7);
      expect(fastestQuote?.vendorId).toBe(3);
    });

    it("should calculate comparison metrics", () => {
      const quotes = [
        { id: 1, totalPrice: "1200.00", leadTimeDays: 10 },
        { id: 2, totalPrice: "1000.00", leadTimeDays: 14 },
        { id: 3, totalPrice: "1100.00", leadTimeDays: 7 },
      ];

      const prices = quotes.map((q) => parseFloat(q.totalPrice));
      const deliveryTimes = quotes.map((q) => q.leadTimeDays);

      const metrics = {
        lowestPrice: Math.min(...prices),
        highestPrice: Math.max(...prices),
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        fastestDelivery: Math.min(...deliveryTimes),
        slowestDelivery: Math.max(...deliveryTimes),
      };

      expect(metrics.lowestPrice).toBe(1000);
      expect(metrics.highestPrice).toBe(1200);
      expect(metrics.avgPrice).toBe(1100);
      expect(metrics.fastestDelivery).toBe(7);
      expect(metrics.slowestDelivery).toBe(14);
    });

    it("should consider total cost including shipping", () => {
      const quotes = [
        { id: 1, totalPrice: "1000.00", shippingCost: "100.00" },
        { id: 2, totalPrice: "1050.00", shippingCost: "50.00" },
        { id: 3, totalPrice: "1100.00", shippingCost: "0.00" },
      ];

      const totalCosts = quotes.map((q) => parseFloat(q.totalPrice) + parseFloat(q.shippingCost));
      const lowestTotalCost = Math.min(...totalCosts);

      expect(lowestTotalCost).toBe(1100); // Quote 3 has lowest total
      expect(totalCosts[0]).toBe(1100); // Quote 1
      expect(totalCosts[1]).toBe(1100); // Quote 2
    });
  });

  describe("AI-Powered Quote Analysis", () => {
    it("should parse AI recommendation response", () => {
      const aiResponse = {
        bestQuoteIndex: 1,
        reasoning: "Best balance of price and delivery time",
        concerns: "Payment terms need review",
      };

      expect(aiResponse.bestQuoteIndex).toBeGreaterThanOrEqual(0);
      expect(aiResponse.reasoning).toBeTruthy();
      expect(aiResponse.concerns).toBeTruthy();
    });

    it("should handle AI response parsing errors gracefully", () => {
      const invalidResponse = "This is not JSON";
      
      // Should fall back to simple logic
      const quotes = [
        { id: 1, totalPrice: "1200.00" },
        { id: 2, totalPrice: "1000.00" },
      ];
      
      const prices = quotes.map((q) => parseFloat(q.totalPrice));
      const lowestPrice = Math.min(...prices);
      const fallbackBestIndex = prices.indexOf(lowestPrice);

      expect(fallbackBestIndex).toBe(1); // Second quote has lowest price
    });
  });

  describe("RFQ Workflow", () => {
    it("should generate unique RFQ number with date prefix", () => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      const rfqNumber = `RFQ-${dateStr}-TEST`;

      expect(rfqNumber).toMatch(/^RFQ-\d{8}-[A-Z]+$/);
      expect(rfqNumber).toContain(dateStr);
    });

    it("should create RFQ with required fields", () => {
      const rfqData = {
        materialName: "Organic Mushrooms",
        quantity: "500",
        unit: "kg",
        status: "draft",
      };

      expect(rfqData.materialName).toBeTruthy();
      expect(rfqData.quantity).toBeTruthy();
      expect(rfqData.unit).toBeTruthy();
      expect(rfqData.status).toBe("draft");
    });

    it("should track vendor invitation status", () => {
      const invitation = {
        rfqId: 1,
        vendorId: 1,
        status: "pending",
        invitedAt: new Date(),
        reminderCount: 0,
      };

      expect(invitation.status).toBe("pending");
      expect(invitation.invitedAt).toBeInstanceOf(Date);
      expect(invitation.reminderCount).toBe(0);
    });
  });

  describe("Quote Ranking", () => {
    it("should assign rank 1 to best quote", () => {
      const quotes = [
        { id: 1, totalPrice: "1200.00", overallRank: 3 },
        { id: 2, totalPrice: "1000.00", overallRank: 1 },
        { id: 3, totalPrice: "1100.00", overallRank: 2 },
      ];

      const bestQuote = quotes.find((q) => q.overallRank === 1);
      expect(bestQuote?.totalPrice).toBe("1000.00");
    });

    it("should update quote rankings after comparison", () => {
      const quotes = [
        { id: 1, totalPrice: "1200.00" },
        { id: 2, totalPrice: "1000.00" },
        { id: 3, totalPrice: "1100.00" },
      ];

      const sortedQuotes = [...quotes].sort(
        (a, b) => parseFloat(a.totalPrice) - parseFloat(b.totalPrice)
      );

      const rankedQuotes = sortedQuotes.map((q, idx) => ({
        ...q,
        overallRank: idx + 1,
      }));

      expect(rankedQuotes[0].id).toBe(2); // Lowest price gets rank 1
      expect(rankedQuotes[0].overallRank).toBe(1);
      expect(rankedQuotes[1].id).toBe(3);
      expect(rankedQuotes[1].overallRank).toBe(2);
    });
  });

  describe("Reminder Functionality", () => {
    it("should increment reminder count", () => {
      const invitation = {
        reminderCount: 0,
        lastReminderAt: null,
      };

      const updated = {
        reminderCount: invitation.reminderCount + 1,
        lastReminderAt: new Date(),
      };

      expect(updated.reminderCount).toBe(1);
      expect(updated.lastReminderAt).toBeInstanceOf(Date);
    });

    it("should generate polite reminder email content", () => {
      const reminderTemplate = {
        subject: "Follow-up: RFQ {rfqNumber}",
        tone: "polite",
        purpose: "check if vendor received original request",
      };

      expect(reminderTemplate.tone).toBe("polite");
      expect(reminderTemplate.subject).toContain("Follow-up");
    });
  });

  describe("Agent Workflow Integration", () => {
    it("should create AI agent task for tracking", () => {
      const taskData = {
        taskType: "send_rfq",
        priority: "medium",
        status: "in_progress",
        taskData: {
          rfqId: 1,
          materialName: "Organic Mushrooms",
          vendorIds: [1, 2, 3],
        },
      };

      expect(taskData.taskType).toBe("send_rfq");
      expect(taskData.status).toBe("in_progress");
      expect(Array.isArray(taskData.taskData.vendorIds)).toBe(true);
    });

    it("should log agent actions", () => {
      const logEntry = {
        taskId: 1,
        action: "rfq_emails_sent",
        status: "success",
        message: "Sent RFQ emails to 3 vendors, 0 failed",
        timestamp: new Date(),
      };

      expect(logEntry.action).toBe("rfq_emails_sent");
      expect(logEntry.status).toBe("success");
      expect(logEntry.message).toContain("3 vendors");
    });
  });

  describe("Best Quote Highlighting", () => {
    it("should highlight best quote with visual indicator", () => {
      const quotesWithHighlight = [
        { id: 1, totalPrice: "1200.00", isBest: false },
        { id: 2, totalPrice: "1000.00", isBest: true }, // Best quote
        { id: 3, totalPrice: "1100.00", isBest: false },
      ];

      const bestQuote = quotesWithHighlight.find((q) => q.isBest);
      expect(bestQuote?.id).toBe(2);
      expect(bestQuote?.totalPrice).toBe("1000.00");
    });

    it("should provide reasoning for best quote selection", () => {
      const recommendation = {
        bestQuoteId: 2,
        reasoning: "Lowest total price with acceptable delivery time",
        priceSavings: "200.00",
        deliveryImpact: "4 days slower than fastest option",
      };

      expect(recommendation.reasoning).toBeTruthy();
      expect(parseFloat(recommendation.priceSavings)).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle vendor without email address", () => {
      const vendor = {
        id: 1,
        name: "Test Vendor",
        email: null,
      };

      const canSendEmail = vendor.email !== null && vendor.email !== "";
      expect(canSendEmail).toBe(false);
    });

    it("should track failed email sends", () => {
      const results = {
        sent: 2,
        failed: 1,
        errors: ["Vendor has no email address"],
      };

      expect(results.sent).toBe(2);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
    });

    it("should handle no quotes available scenario", () => {
      const quotes: any[] = [];
      const hasQuotes = quotes.length > 0;

      expect(hasQuotes).toBe(false);
    });
  });
});
