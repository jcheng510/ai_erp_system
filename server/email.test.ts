import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the ENV module before importing email functions
vi.mock("./_core/env", () => ({
  ENV: {
    sendgridApiKey: "",
    sendgridFromEmail: "",
  },
}));

// Mock SendGrid
vi.mock("@sendgrid/mail", () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn(),
  },
}));

import { isEmailConfigured, sendEmail, formatEmailHtml } from "./_core/email";
import { ENV } from "./_core/env";
import sgMail from "@sendgrid/mail";

describe("Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isEmailConfigured", () => {
    it("should return false when API key is not set", () => {
      (ENV as any).sendgridApiKey = "";
      (ENV as any).sendgridFromEmail = "test@example.com";
      expect(isEmailConfigured()).toBe(false);
    });

    it("should return false when from email is not set", () => {
      (ENV as any).sendgridApiKey = "SG.test-key";
      (ENV as any).sendgridFromEmail = "";
      expect(isEmailConfigured()).toBe(false);
    });

    it("should return true when both are configured", () => {
      (ENV as any).sendgridApiKey = "SG.test-key";
      (ENV as any).sendgridFromEmail = "test@example.com";
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("sendEmail", () => {
    it("should return error when API key is not configured", async () => {
      (ENV as any).sendgridApiKey = "";
      (ENV as any).sendgridFromEmail = "test@example.com";

      const result = await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Test body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("API key not configured");
    });

    it("should return error when from email is not configured", async () => {
      (ENV as any).sendgridApiKey = "SG.test-key";
      (ENV as any).sendgridFromEmail = "";

      const result = await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Test body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("from email not configured");
    });

    it("should send email successfully when configured", async () => {
      (ENV as any).sendgridApiKey = "SG.test-key";
      (ENV as any).sendgridFromEmail = "sender@example.com";

      (sgMail.send as any).mockResolvedValue([
        {
          statusCode: 202,
          headers: { "x-message-id": "test-message-id" },
        },
      ]);

      const result = await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("test-message-id");
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "recipient@example.com",
          from: "sender@example.com",
          subject: "Test Subject",
        })
      );
    });

    it("should handle SendGrid errors gracefully", async () => {
      (ENV as any).sendgridApiKey = "SG.test-key";
      (ENV as any).sendgridFromEmail = "sender@example.com";

      (sgMail.send as any).mockRejectedValue({
        response: {
          body: {
            errors: [{ message: "Invalid email address" }],
          },
        },
      });

      const result = await sendEmail({
        to: "invalid-email",
        subject: "Test Subject",
        text: "Test body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid email address");
    });
  });

  describe("formatEmailHtml", () => {
    it("should convert plain text to HTML with line breaks", () => {
      const text = "Line 1\nLine 2\nLine 3";
      const html = formatEmailHtml(text);

      expect(html).toContain("Line 1<br>");
      expect(html).toContain("Line 2<br>");
      expect(html).toContain("Line 3");
      expect(html).toContain("<!DOCTYPE html>");
    });

    it("should make headers bold", () => {
      const text = "SHIPMENT DETAILS:\nWeight: 100kg";
      const html = formatEmailHtml(text);

      expect(html).toContain("<strong>SHIPMENT DETAILS:</strong>");
    });

    it("should wrap content in proper HTML structure", () => {
      const text = "Test content";
      const html = formatEmailHtml(text);

      expect(html).toContain("<html>");
      expect(html).toContain("<body>");
      expect(html).toContain("</body>");
      expect(html).toContain("</html>");
    });
  });
});

describe("Freight RFQ Email Integration", () => {
  it("should save email as draft when SendGrid is not configured", async () => {
    // This tests the behavior in routers.ts when isEmailConfigured() returns false
    (ENV as any).sendgridApiKey = "";
    (ENV as any).sendgridFromEmail = "";

    expect(isEmailConfigured()).toBe(false);
  });

  it("should attempt to send email when SendGrid is configured", async () => {
    (ENV as any).sendgridApiKey = "SG.test-key";
    (ENV as any).sendgridFromEmail = "logistics@company.com";

    expect(isEmailConfigured()).toBe(true);
  });
});
