import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ENV module
vi.mock("./_core/env", () => ({
  ENV: {
    googleClientId: "test-client-id",
    googleClientSecret: "test-client-secret",
    googleRedirectUri: "http://localhost:3000/api/oauth/google/callback",
    appUrl: "http://localhost:3000",
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

import { 
  sendGmailMessage, 
  createGmailDraft, 
  listGmailMessages, 
  getGmailMessage,
  replyToGmailMessage,
  getGmailProfile,
  getGmailAuthUrl 
} from "./_core/gmail";

describe("Gmail Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGmailAuthUrl", () => {
    it("should generate OAuth URL with Gmail scopes", () => {
      const url = getGmailAuthUrl(123);
      
      expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
      expect(url).toContain("test-client-id");
      expect(url).toContain("gmail.send");
      expect(url).toContain("gmail.compose");
      expect(url).toContain("gmail.readonly");
      expect(url).toContain("state=123");
    });
  });

  describe("sendGmailMessage", () => {
    it("should send email successfully", async () => {
      const mockResponse = {
        id: "test-message-id",
        threadId: "test-thread-id",
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await sendGmailMessage("test-token", {
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test body content",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("test-message-id");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should handle multiple recipients", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "msg-id" }),
      });

      const result = await sendGmailMessage("test-token", {
        to: ["user1@example.com", "user2@example.com"],
        subject: "Test",
        body: "Body",
      });

      expect(result.success).toBe(true);
    });

    it("should include CC and BCC", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "msg-id" }),
      });

      const result = await sendGmailMessage("test-token", {
        to: "to@example.com",
        cc: "cc@example.com",
        bcc: "bcc@example.com",
        subject: "Test",
        body: "Body",
      });

      expect(result.success).toBe(true);
    });

    it("should handle HTML emails", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "msg-id" }),
      });

      const result = await sendGmailMessage("test-token", {
        to: "recipient@example.com",
        subject: "Test",
        body: "<h1>HTML Content</h1>",
        html: true,
      });

      expect(result.success).toBe(true);
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const result = await sendGmailMessage("invalid-token", {
        to: "recipient@example.com",
        subject: "Test",
        body: "Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to send email");
    });

    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      const result = await sendGmailMessage("test-token", {
        to: "recipient@example.com",
        subject: "Test",
        body: "Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("createGmailDraft", () => {
    it("should create draft successfully", async () => {
      const mockResponse = {
        id: "draft-id",
        message: { id: "msg-id" },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createGmailDraft("test-token", {
        to: "recipient@example.com",
        subject: "Draft Subject",
        body: "Draft body",
      });

      expect(result.success).toBe(true);
      expect(result.draftId).toBe("draft-id");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should handle draft creation errors", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
      });

      const result = await createGmailDraft("test-token", {
        to: "recipient@example.com",
        subject: "Test",
        body: "Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to create draft");
    });
  });

  describe("listGmailMessages", () => {
    it("should list messages successfully", async () => {
      const mockResponse = {
        messages: [
          { id: "msg-1", threadId: "thread-1" },
          { id: "msg-2", threadId: "thread-2" },
        ],
        nextPageToken: "next-token",
        resultSizeEstimate: 2,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await listGmailMessages("test-token", {
        maxResults: 10,
      });

      expect(result.success).toBe(true);
      expect(result.result?.messages).toHaveLength(2);
      expect(result.result?.nextPageToken).toBe("next-token");
    });

    it("should support search query", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [] }),
      });

      await listGmailMessages("test-token", {
        q: "from:user@example.com",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("q=from%3Auser%40example.com"),
        expect.any(Object)
      );
    });

    it("should support label filtering", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [] }),
      });

      await listGmailMessages("test-token", {
        labelIds: ["INBOX", "UNREAD"],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("labelIds=INBOX%2CUNREAD"),
        expect.any(Object)
      );
    });

    it("should handle empty results", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ resultSizeEstimate: 0 }),
      });

      const result = await listGmailMessages("test-token");

      expect(result.success).toBe(true);
      expect(result.result?.messages).toEqual([]);
    });
  });

  describe("getGmailMessage", () => {
    it("should get message successfully", async () => {
      const mockMessage = {
        id: "msg-id",
        threadId: "thread-id",
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "Subject", value: "Test Subject" },
          ],
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockMessage,
      });

      const result = await getGmailMessage("test-token", "msg-id");

      expect(result.success).toBe(true);
      expect(result.message?.id).toBe("msg-id");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg-id",
        expect.any(Object)
      );
    });

    it("should handle not found error", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not found",
      });

      const result = await getGmailMessage("test-token", "invalid-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to get message");
    });
  });

  describe("replyToGmailMessage", () => {
    it("should send reply successfully", async () => {
      // Mock getting the original message
      const originalMessage = {
        id: "original-msg-id",
        threadId: "thread-id",
        payload: {
          headers: [
            { name: "Message-ID", value: "<original@example.com>" },
          ],
        },
      };

      // Mock sending the reply
      const replyResponse = {
        id: "reply-msg-id",
        threadId: "thread-id",
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => originalMessage,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => replyResponse,
        });

      const result = await replyToGmailMessage(
        "test-token",
        "thread-id",
        "original-msg-id",
        {
          to: "recipient@example.com",
          subject: "Re: Test",
          body: "Reply body",
        }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("reply-msg-id");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle reply errors", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Server error",
      });

      const result = await replyToGmailMessage(
        "test-token",
        "thread-id",
        "msg-id",
        {
          to: "recipient@example.com",
          subject: "Re: Test",
          body: "Reply",
        }
      );

      expect(result.success).toBe(false);
    });
  });

  describe("getGmailProfile", () => {
    it("should get profile successfully", async () => {
      const mockProfile = {
        emailAddress: "user@example.com",
        messagesTotal: 1500,
        threadsTotal: 800,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockProfile,
      });

      const result = await getGmailProfile("test-token");

      expect(result.success).toBe(true);
      expect(result.profile?.emailAddress).toBe("user@example.com");
      expect(result.profile?.messagesTotal).toBe(1500);
    });

    it("should handle profile fetch errors", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const result = await getGmailProfile("invalid-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to get profile");
    });
  });
});
