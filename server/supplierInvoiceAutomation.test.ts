import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("./db", () => ({
  getVendors: vi.fn(),
  getVendorById: vi.fn(),
  getPurchaseOrders: vi.fn(),
  getInboundEmails: vi.fn(),
  getInboundEmailById: vi.fn(),
  getEmailAttachments: vi.fn(),
  getSupplierInvoiceAutomations: vi.fn(),
  getSupplierInvoiceAutomationById: vi.fn(),
  getSupplierInvoiceAutomationByEmailId: vi.fn(),
  getSupplierInvoiceAutomationByToken: vi.fn(),
  createSupplierInvoiceAutomation: vi.fn(),
  updateSupplierInvoiceAutomation: vi.fn(),
  createSupplierPortalSession: vi.fn(),
  getSupplierPortalSession: vi.fn(),
  getSupplierFreightInfo: vi.fn(),
  createSupplierFreightInfo: vi.fn(),
  updateSupplierFreightInfo: vi.fn(),
  getSupplierDocuments: vi.fn(),
  createSupplierDocument: vi.fn(),
  createSentEmail: vi.fn(),
}));

vi.mock("./_core/email", () => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(),
  formatEmailHtml: vi.fn((t: string) => `<html>${t}</html>`),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    sendgridApiKey: "SG.test-key",
    sendgridFromEmail: "erp@example.com",
    publicAppUrl: "https://erp.example.com",
    imapHost: "imap.example.com",
    imapPort: "993",
    imapUser: "user@example.com",
    imapPassword: "password",
  },
}));

vi.mock("./_core/emailInboxScanner", () => ({
  scanInbox: vi.fn(),
  getImapConfig: vi.fn(),
  isImapConfigured: vi.fn(),
}));

vi.mock("./_core/emailParser", () => ({
  quickCategorize: vi.fn(),
  parseEmailContent: vi.fn(),
  parseAttachmentContent: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-token-abc123"),
}));

import * as db from "./db";
import { sendEmail, isEmailConfigured } from "./_core/email";
import { scanInbox, getImapConfig, isImapConfigured } from "./_core/emailInboxScanner";
import { parseEmailContent } from "./_core/emailParser";
import { invokeLLM } from "./_core/llm";
import {
  processInboundInvoices,
  processStoredInboundEmail,
  handleSupplierPortalSubmission,
  processSupplierReplyWithAttachments,
} from "./supplierInvoiceAutomationService";

describe("Supplier Invoice Automation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // processInboundInvoices
  // ============================================
  describe("processInboundInvoices", () => {
    it("should return error when IMAP is not configured", async () => {
      vi.mocked(isImapConfigured).mockReturnValue(false);

      const result = await processInboundInvoices();

      expect(result.errors).toContain("IMAP not configured - cannot scan inbox");
      expect(result.processed).toBe(0);
    });

    it("should return error when SendGrid is not configured", async () => {
      vi.mocked(isImapConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(false);

      const result = await processInboundInvoices();

      expect(result.errors).toContain("SendGrid not configured - cannot send request emails");
    });

    it("should return error when IMAP config fails", async () => {
      vi.mocked(isImapConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getImapConfig).mockReturnValue(null);

      const result = await processInboundInvoices();

      expect(result.errors).toContain("Failed to get IMAP configuration");
    });

    it("should scan inbox and process invoice emails", async () => {
      vi.mocked(isImapConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getImapConfig).mockReturnValue({
        host: "imap.example.com",
        port: 993,
        secure: true,
        auth: { user: "user@example.com", pass: "password" },
      });

      const mockInvoiceEmail = {
        uid: 1,
        messageId: "msg-001",
        from: { address: "supplier@vendor.com", name: "Acme Supplier" },
        to: ["erp@example.com"],
        subject: "Invoice #INV-2025-001 for Order PO-100",
        date: new Date(),
        bodyText: "Please find attached invoice INV-2025-001 for $5,000.",
        attachments: [],
        flags: [],
        categorization: {
          category: "invoice" as const,
          confidence: 85,
          keywords: ["invoice"],
          priority: "high" as const,
        },
      };

      const mockNonInvoiceEmail = {
        uid: 2,
        messageId: "msg-002",
        from: { address: "info@newsletter.com", name: "Newsletter" },
        to: ["erp@example.com"],
        subject: "Weekly industry update",
        date: new Date(),
        bodyText: "This week in logistics...",
        attachments: [],
        flags: [],
        categorization: {
          category: "general" as const,
          confidence: 90,
          keywords: [],
          priority: "low" as const,
        },
      };

      vi.mocked(scanInbox).mockResolvedValue({
        success: true,
        totalEmails: 10,
        newEmails: 2,
        processedEmails: [mockInvoiceEmail, mockNonInvoiceEmail],
        errors: [],
      });

      // Mock no existing automations (not a duplicate)
      vi.mocked(db.getSupplierInvoiceAutomations).mockResolvedValue([]);
      vi.mocked(db.getInboundEmails).mockResolvedValue([]);

      // Mock automation creation
      vi.mocked(db.createSupplierInvoiceAutomation).mockResolvedValue({
        id: 1,
        fromEmail: "supplier@vendor.com",
        fromName: "Acme Supplier",
        invoiceSubject: "Invoice #INV-2025-001 for Order PO-100",
        status: "detected",
      } as any);

      // Mock AI parsing
      vi.mocked(parseEmailContent).mockResolvedValue({
        success: true,
        documents: [
          {
            documentType: "invoice",
            confidence: 90,
            vendorName: "Acme Supplier",
            vendorEmail: "supplier@vendor.com",
            documentNumber: "INV-2025-001",
            documentDate: "2025-01-15",
            totalAmount: 5000,
            currency: "USD",
            lineItems: [
              { description: "Raw material A", quantity: 100, unitPrice: 50, totalPrice: 5000 },
            ],
          },
        ],
        categorization: { category: "invoice", confidence: 90, keywords: ["invoice"], priority: "high" },
      });

      // Mock vendor lookup
      vi.mocked(db.getVendors).mockResolvedValue([
        {
          id: 10,
          name: "Acme Supplier",
          email: "supplier@vendor.com",
          status: "active",
        } as any,
      ]);

      // Mock PO lookup
      vi.mocked(db.getPurchaseOrders).mockResolvedValue([
        {
          id: 50,
          poNumber: "PO-100",
          vendorId: 10,
          status: "sent",
        } as any,
      ]);

      // Mock portal session creation
      vi.mocked(db.createSupplierPortalSession).mockResolvedValue({
        id: 100,
        token: "test-token-abc123",
        purchaseOrderId: 50,
        vendorId: 10,
        vendorEmail: "supplier@vendor.com",
        expiresAt: new Date(),
      } as any);

      // Mock email send
      vi.mocked(sendEmail).mockResolvedValue({
        success: true,
        messageId: "sg-msg-001",
      });

      vi.mocked(db.createSentEmail).mockResolvedValue({ id: 200 });
      vi.mocked(db.updateSupplierInvoiceAutomation).mockResolvedValue(undefined);

      const result = await processInboundInvoices();

      expect(result.processed).toBe(2);
      expect(result.invoicesDetected).toBe(1);
      expect(result.emailsSent).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].status).toBe("email_sent");
      expect(result.details[0].vendorEmail).toBe("supplier@vendor.com");
      expect(result.details[0].invoiceNumber).toBe("INV-2025-001");

      // Verify automation was created
      expect(db.createSupplierInvoiceAutomation).toHaveBeenCalledWith(
        expect.objectContaining({
          fromEmail: "supplier@vendor.com",
          fromName: "Acme Supplier",
          status: "detected",
        })
      );

      // Verify email was sent to the supplier
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "supplier@vendor.com",
          subject: expect.stringContaining("INV-2025-001"),
        })
      );
    });

    it("should skip duplicate invoice emails", async () => {
      vi.mocked(isImapConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getImapConfig).mockReturnValue({
        host: "imap.example.com",
        port: 993,
        secure: true,
        auth: { user: "u", pass: "p" },
      });

      vi.mocked(scanInbox).mockResolvedValue({
        success: true,
        totalEmails: 1,
        newEmails: 1,
        processedEmails: [
          {
            uid: 1,
            messageId: "msg-dup",
            from: { address: "supplier@vendor.com", name: "Vendor" },
            to: ["erp@example.com"],
            subject: "Invoice #INV-100",
            date: new Date(),
            bodyText: "Invoice",
            attachments: [],
            flags: [],
            categorization: { category: "invoice" as const, confidence: 80, keywords: ["invoice"], priority: "high" as const },
          },
        ],
        errors: [],
      });

      // Return existing automation = duplicate
      vi.mocked(db.getSupplierInvoiceAutomations).mockResolvedValue([
        {
          id: 5,
          fromEmail: "supplier@vendor.com",
          invoiceSubject: "Invoice #INV-100",
          status: "email_sent",
        } as any,
      ]);

      const result = await processInboundInvoices();

      expect(result.invoicesDetected).toBe(1);
      expect(result.details[0].status).toBe("skipped");
      expect(db.createSupplierInvoiceAutomation).not.toHaveBeenCalled();
    });

    it("should filter out low-confidence categorizations", async () => {
      vi.mocked(isImapConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getImapConfig).mockReturnValue({
        host: "imap.example.com",
        port: 993,
        secure: true,
        auth: { user: "u", pass: "p" },
      });

      vi.mocked(scanInbox).mockResolvedValue({
        success: true,
        totalEmails: 1,
        newEmails: 1,
        processedEmails: [
          {
            uid: 1,
            messageId: "msg-low",
            from: { address: "info@vendor.com" },
            to: ["erp@example.com"],
            subject: "Some email about invoices maybe",
            date: new Date(),
            bodyText: "Hello",
            attachments: [],
            flags: [],
            categorization: { category: "invoice" as const, confidence: 40, keywords: [], priority: "low" as const },
          },
        ],
        errors: [],
      });

      const result = await processInboundInvoices();

      // Low confidence (40) should be filtered out (threshold is 60)
      expect(result.invoicesDetected).toBe(0);
      expect(db.createSupplierInvoiceAutomation).not.toHaveBeenCalled();
    });

    it("should handle email send failure gracefully", async () => {
      vi.mocked(isImapConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getImapConfig).mockReturnValue({
        host: "imap.example.com",
        port: 993,
        secure: true,
        auth: { user: "u", pass: "p" },
      });

      vi.mocked(scanInbox).mockResolvedValue({
        success: true,
        totalEmails: 1,
        newEmails: 1,
        processedEmails: [
          {
            uid: 1,
            messageId: "msg-fail",
            from: { address: "supplier@vendor.com", name: "Vendor" },
            to: ["erp@example.com"],
            subject: "Invoice #FAIL-001",
            date: new Date(),
            bodyText: "Invoice",
            attachments: [],
            flags: [],
            categorization: { category: "invoice" as const, confidence: 80, keywords: ["invoice"], priority: "high" as const },
          },
        ],
        errors: [],
      });

      vi.mocked(db.getSupplierInvoiceAutomations).mockResolvedValue([]);
      vi.mocked(db.getInboundEmails).mockResolvedValue([]);
      vi.mocked(db.createSupplierInvoiceAutomation).mockResolvedValue({ id: 2 } as any);
      vi.mocked(parseEmailContent).mockResolvedValue({ success: true, documents: [] });
      vi.mocked(db.getVendors).mockResolvedValue([]);
      vi.mocked(db.getPurchaseOrders).mockResolvedValue([]);
      vi.mocked(db.updateSupplierInvoiceAutomation).mockResolvedValue(undefined);

      // Email send fails
      vi.mocked(sendEmail).mockResolvedValue({
        success: false,
        error: "SendGrid rate limit exceeded",
      });

      const result = await processInboundInvoices();

      expect(result.emailsSent).toBe(0);
      expect(result.details[0].status).toBe("failed");
      expect(result.details[0].error).toContain("SendGrid rate limit");

      // Should mark automation as failed
      expect(db.updateSupplierInvoiceAutomation).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ status: "failed" })
      );
    });
  });

  // ============================================
  // processStoredInboundEmail
  // ============================================
  describe("processStoredInboundEmail", () => {
    it("should return error for non-existent email", async () => {
      vi.mocked(db.getInboundEmailById).mockResolvedValue(null);

      const result = await processStoredInboundEmail(999);

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Email not found");
    });

    it("should skip already-processed emails", async () => {
      vi.mocked(db.getInboundEmailById).mockResolvedValue({
        id: 1,
        fromEmail: "supplier@test.com",
        toEmail: "erp@test.com",
        subject: "Invoice #123",
        receivedAt: new Date(),
      } as any);

      vi.mocked(db.getSupplierInvoiceAutomationByEmailId).mockResolvedValue({
        id: 5,
        status: "email_sent",
      } as any);

      const result = await processStoredInboundEmail(1);

      expect(result.status).toBe("skipped");
      expect(result.automationId).toBe(5);
    });
  });

  // ============================================
  // handleSupplierPortalSubmission
  // ============================================
  describe("handleSupplierPortalSubmission", () => {
    it("should return not found for invalid token", async () => {
      vi.mocked(db.getSupplierInvoiceAutomationByToken).mockResolvedValue(null);

      const result = await handleSupplierPortalSubmission("bad-token");

      expect(result.success).toBe(false);
      expect(result.readyForQuote).toBe(false);
    });

    it("should detect missing fields when freight info is incomplete", async () => {
      vi.mocked(db.getSupplierInvoiceAutomationByToken).mockResolvedValue({
        id: 1,
        purchaseOrderId: 50,
        portalSessionId: 100,
        portalToken: "valid-token",
      } as any);

      // No freight info submitted
      vi.mocked(db.getSupplierFreightInfo).mockResolvedValue(null);
      vi.mocked(db.getSupplierDocuments).mockResolvedValue([]);
      vi.mocked(db.updateSupplierInvoiceAutomation).mockResolvedValue(undefined);

      const result = await handleSupplierPortalSubmission("valid-token");

      expect(result.success).toBe(true);
      expect(result.readyForQuote).toBe(false);
      expect(result.missingFields).toContain("Gross weight");
      expect(result.missingFields).toContain("Package count");
      expect(result.missingFields).toContain("Package dimensions");
      expect(result.missingFields).toContain("HS codes");
      expect(result.missingFields).toContain("Commercial invoice");
      expect(result.missingFields).toContain("Packing list");
    });

    it("should mark as ready when all info is complete", async () => {
      vi.mocked(db.getSupplierInvoiceAutomationByToken).mockResolvedValue({
        id: 1,
        purchaseOrderId: 50,
        portalSessionId: 100,
        portalToken: "valid-token",
      } as any);

      vi.mocked(db.getSupplierFreightInfo).mockResolvedValue({
        id: 1,
        totalGrossWeight: "500",
        totalPackages: 5,
        packageDimensions: '[{"length":"120","width":"80","height":"100"}]',
        hsCodes: '["8471.30"]',
      } as any);

      vi.mocked(db.getSupplierDocuments).mockResolvedValue([
        { id: 1, documentType: "commercial_invoice" } as any,
        { id: 2, documentType: "packing_list" } as any,
      ]);

      vi.mocked(db.updateSupplierInvoiceAutomation).mockResolvedValue(undefined);

      const result = await handleSupplierPortalSubmission("valid-token");

      expect(result.success).toBe(true);
      expect(result.readyForQuote).toBe(true);
      expect(result.missingFields).toHaveLength(0);

      // Should update to info_complete
      expect(db.updateSupplierInvoiceAutomation).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: "info_complete" })
      );
    });
  });

  // ============================================
  // processSupplierReplyWithAttachments
  // ============================================
  describe("processSupplierReplyWithAttachments", () => {
    it("should return error for non-existent email", async () => {
      vi.mocked(db.getInboundEmailById).mockResolvedValue(null);

      const result = await processSupplierReplyWithAttachments(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email not found");
    });

    it("should return error when no matching automation found", async () => {
      vi.mocked(db.getInboundEmailById).mockResolvedValue({
        id: 1,
        fromEmail: "unknown@vendor.com",
      } as any);

      vi.mocked(db.getSupplierInvoiceAutomations).mockResolvedValue([]);

      const result = await processSupplierReplyWithAttachments(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No matching automation found");
    });

    it("should match reply to existing automation by sender email", async () => {
      vi.mocked(db.getInboundEmailById).mockResolvedValue({
        id: 5,
        fromEmail: "supplier@vendor.com",
      } as any);

      vi.mocked(db.getSupplierInvoiceAutomations).mockResolvedValue([
        {
          id: 10,
          fromEmail: "supplier@vendor.com",
          status: "email_sent",
          purchaseOrderId: 50,
          portalSessionId: 100,
          vendorId: 10,
        } as any,
      ]);

      // No attachments
      vi.mocked(db.getEmailAttachments).mockResolvedValue([]);
      vi.mocked(db.updateSupplierInvoiceAutomation).mockResolvedValue(undefined);

      const result = await processSupplierReplyWithAttachments(5);

      expect(result.success).toBe(true);
      expect(result.automationId).toBe(10);

      // Should update status to supplier_responded
      expect(db.updateSupplierInvoiceAutomation).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ status: "supplier_responded" })
      );
    });
  });

  // ============================================
  // Email template verification
  // ============================================
  describe("email template", () => {
    it("should include portal URL and required info in the sent email", async () => {
      vi.mocked(isImapConfigured).mockReturnValue(true);
      vi.mocked(isEmailConfigured).mockReturnValue(true);
      vi.mocked(getImapConfig).mockReturnValue({
        host: "imap.example.com",
        port: 993,
        secure: true,
        auth: { user: "u", pass: "p" },
      });

      vi.mocked(scanInbox).mockResolvedValue({
        success: true,
        totalEmails: 1,
        newEmails: 1,
        processedEmails: [
          {
            uid: 1,
            messageId: "msg-tpl",
            from: { address: "supplier@vendor.com", name: "Test Vendor" },
            to: ["erp@example.com"],
            subject: "Invoice #TPL-001",
            date: new Date(),
            bodyText: "Invoice for raw materials",
            attachments: [],
            flags: [],
            categorization: { category: "invoice" as const, confidence: 90, keywords: ["invoice"], priority: "high" as const },
          },
        ],
        errors: [],
      });

      vi.mocked(db.getSupplierInvoiceAutomations).mockResolvedValue([]);
      vi.mocked(db.getInboundEmails).mockResolvedValue([]);
      vi.mocked(db.createSupplierInvoiceAutomation).mockResolvedValue({ id: 1 } as any);
      vi.mocked(parseEmailContent).mockResolvedValue({
        success: true,
        documents: [{ documentType: "invoice", confidence: 90, documentNumber: "TPL-001" }],
      });
      vi.mocked(db.getVendors).mockResolvedValue([]);
      vi.mocked(db.getPurchaseOrders).mockResolvedValue([]);
      vi.mocked(db.updateSupplierInvoiceAutomation).mockResolvedValue(undefined);
      vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: "msg-1" });
      vi.mocked(db.createSentEmail).mockResolvedValue({ id: 1 });

      await processInboundInvoices();

      // Verify the email HTML content
      const emailCall = vi.mocked(sendEmail).mock.calls[0][0];
      expect(emailCall.html).toContain("supplier-shipping/test-token-abc123");
      expect(emailCall.html).toContain("Shipping Information Request");
      expect(emailCall.html).toContain("Submit Shipping Information");
      expect(emailCall.html).toContain("HS/tariff codes");
      expect(emailCall.html).toContain("Gross and net weight");
      expect(emailCall.html).toContain("Commercial Invoice");
      expect(emailCall.html).toContain("Packing List");
      expect(emailCall.html).toContain("Certificate of Origin");
    });
  });
});
