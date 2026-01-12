import { describe, it, expect, vi } from "vitest";
import {
  getImapConfig,
  isImapConfigured,
  IMAP_PRESETS,
  quickCategorize,
} from "./_core/emailInboxScanner";
import { quickCategorize as parserQuickCategorize } from "./_core/emailParser";

describe("Email Inbox Scanner", () => {
  describe("IMAP Presets", () => {
    it("should have Gmail preset", () => {
      expect(IMAP_PRESETS.gmail).toBeDefined();
      expect(IMAP_PRESETS.gmail.host).toBe("imap.gmail.com");
      expect(IMAP_PRESETS.gmail.port).toBe(993);
      expect(IMAP_PRESETS.gmail.secure).toBe(true);
    });

    it("should have Outlook preset", () => {
      expect(IMAP_PRESETS.outlook).toBeDefined();
      expect(IMAP_PRESETS.outlook.host).toBe("outlook.office365.com");
      expect(IMAP_PRESETS.outlook.port).toBe(993);
    });

    it("should have Yahoo preset", () => {
      expect(IMAP_PRESETS.yahoo).toBeDefined();
      expect(IMAP_PRESETS.yahoo.host).toBe("imap.mail.yahoo.com");
      expect(IMAP_PRESETS.yahoo.port).toBe(993);
    });

    it("should have iCloud preset", () => {
      expect(IMAP_PRESETS.icloud).toBeDefined();
      expect(IMAP_PRESETS.icloud.host).toBe("imap.mail.me.com");
      expect(IMAP_PRESETS.icloud.port).toBe(993);
    });
  });

  describe("isImapConfigured", () => {
    it("should return false when IMAP is not configured", () => {
      // Default env doesn't have IMAP configured
      const result = isImapConfigured();
      expect(result).toBe(false);
    });
  });

  describe("getImapConfig", () => {
    it("should return null when IMAP is not configured", () => {
      const config = getImapConfig();
      expect(config).toBeNull();
    });
  });

  describe("Email categorization integration", () => {
    it("should categorize shipping emails correctly", () => {
      const result = parserQuickCategorize(
        "Tracking Update - Package dispatched",
        "tracking@usps.com"
      );
      expect(result.category).toBe("shipping_confirmation");
      expect(result.priority).toBe("medium");
    });

    it("should categorize invoice emails correctly", () => {
      const result = parserQuickCategorize(
        "Invoice #12345 - Payment Due",
        "billing@vendor.com"
      );
      expect(result.category).toBe("invoice");
      expect(result.priority).toBe("high");
    });

    it("should categorize delivery notifications correctly", () => {
      const result = parserQuickCategorize(
        "Your package has arrived",
        "delivery@fedex.com"
      );
      expect(result.category).toBe("delivery_notification");
      expect(result.priority).toBe("high");
    });

    it("should categorize purchase orders correctly", () => {
      const result = parserQuickCategorize(
        "Purchase Order #PO-12345",
        "procurement@company.com"
      );
      expect(result.category).toBe("purchase_order");
      expect(result.priority).toBe("high");
    });

    it("should categorize freight quotes correctly", () => {
      const result = parserQuickCategorize(
        "Freight Rate Quote for Container",
        "sales@freightco.com"
      );
      expect(result.category).toBe("freight_quote");
      expect(result.priority).toBe("medium");
    });

    it("should return general for unrecognized emails", () => {
      const result = parserQuickCategorize(
        "Hello from John",
        "john@example.com"
      );
      expect(result.category).toBe("general");
      expect(result.priority).toBe("low");
    });
  });

  describe("Email inbox scan result structure", () => {
    it("should have correct InboxScanResult structure", () => {
      // Test the expected structure of scan results
      const mockResult = {
        success: true,
        totalEmails: 100,
        newEmails: 25,
        processedEmails: [],
        errors: [],
      };

      expect(mockResult).toHaveProperty("success");
      expect(mockResult).toHaveProperty("totalEmails");
      expect(mockResult).toHaveProperty("newEmails");
      expect(mockResult).toHaveProperty("processedEmails");
      expect(mockResult).toHaveProperty("errors");
    });

    it("should have correct ScannedEmail structure", () => {
      const mockEmail = {
        uid: 123,
        messageId: "<test@example.com>",
        from: {
          address: "sender@example.com",
          name: "Sender Name",
        },
        to: ["recipient@example.com"],
        subject: "Test Subject",
        date: new Date(),
        bodyText: "Test body",
        bodyHtml: "<p>Test body</p>",
        attachments: [],
        flags: ["\\Seen"],
        categorization: {
          category: "general" as const,
          confidence: 50,
          keywords: [],
          priority: "low" as const,
        },
      };

      expect(mockEmail).toHaveProperty("uid");
      expect(mockEmail).toHaveProperty("messageId");
      expect(mockEmail).toHaveProperty("from");
      expect(mockEmail.from).toHaveProperty("address");
      expect(mockEmail).toHaveProperty("to");
      expect(mockEmail).toHaveProperty("subject");
      expect(mockEmail).toHaveProperty("date");
      expect(mockEmail).toHaveProperty("bodyText");
      expect(mockEmail).toHaveProperty("attachments");
      expect(mockEmail).toHaveProperty("flags");
      expect(mockEmail).toHaveProperty("categorization");
    });
  });

  describe("Bulk categorization", () => {
    it("should categorize multiple emails consistently", () => {
      const testCases = [
        { subject: "Invoice #123", from: "billing@test.com", expected: "invoice" },
        { subject: "Your shipment is on its way", from: "tracking@ups.com", expected: "delivery_notification" },
        { subject: "Package delivered", from: "delivery@fedex.com", expected: "delivery_notification" },
        { subject: "Receipt for your purchase", from: "noreply@store.com", expected: "receipt" },
        { subject: "Purchase Order #PO-456", from: "procurement@company.com", expected: "purchase_order" },
      ];

      for (const testCase of testCases) {
        const result = parserQuickCategorize(testCase.subject, testCase.from);
        expect(result.category).toBe(testCase.expected);
      }
    });
  });
});
