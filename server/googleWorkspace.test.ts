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
  createGoogleDoc,
  insertTextInDoc,
  getGoogleDoc,
  updateGoogleDoc,
  createGoogleSheet,
  updateGoogleSheet,
  appendToGoogleSheet,
  getGoogleSheetValues,
  shareGoogleFile,
  getFileShareableLink,
  getGoogleWorkspaceAuthUrl,
} from "./_core/googleWorkspace";

describe("Google Workspace Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGoogleWorkspaceAuthUrl", () => {
    it("should generate OAuth URL with Workspace scopes", () => {
      const url = getGoogleWorkspaceAuthUrl(123);

      expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
      expect(url).toContain("test-client-id");
      expect(url).toContain("documents");
      expect(url).toContain("spreadsheets");
      expect(url).toContain("drive.file");
      expect(url).toContain("state=123");
    });
  });

  describe("Google Docs", () => {
    describe("createGoogleDoc", () => {
      it("should create document successfully", async () => {
        const mockDoc = {
          documentId: "doc-123",
          title: "Test Document",
          body: {},
          revisionId: "rev-1",
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockDoc,
        });

        const result = await createGoogleDoc("test-token", {
          title: "Test Document",
        });

        expect(result.success).toBe(true);
        expect(result.document?.documentId).toBe("doc-123");
        expect(result.document?.title).toBe("Test Document");
        expect(global.fetch).toHaveBeenCalledWith(
          "https://docs.googleapis.com/v1/documents",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer test-token",
            }),
          })
        );
      });

      it("should create document with initial content", async () => {
        const mockDoc = {
          documentId: "doc-123",
          title: "Test Document",
        };

        (global.fetch as any)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockDoc,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          });

        const result = await createGoogleDoc("test-token", {
          title: "Test Document",
          content: "Initial content",
        });

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2); // Create + insert text
      });

      it("should handle creation errors", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => "Forbidden",
        });

        const result = await createGoogleDoc("test-token", {
          title: "Test Document",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to create document");
      });
    });

    describe("insertTextInDoc", () => {
      it("should insert text successfully", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => ({}),
        });

        const result = await insertTextInDoc("test-token", "doc-123", "Hello World");

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          "https://docs.googleapis.com/v1/documents/doc-123:batchUpdate",
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      it("should insert at specific index", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => ({}),
        });

        const result = await insertTextInDoc("test-token", "doc-123", "Text", 10);

        expect(result.success).toBe(true);
      });

      it("should handle insert errors", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 404,
          text: async () => "Document not found",
        });

        const result = await insertTextInDoc("test-token", "invalid-doc", "Text");

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to insert text");
      });
    });

    describe("getGoogleDoc", () => {
      it("should get document successfully", async () => {
        const mockDoc = {
          documentId: "doc-123",
          title: "Test Document",
          body: { content: [] },
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockDoc,
        });

        const result = await getGoogleDoc("test-token", "doc-123");

        expect(result.success).toBe(true);
        expect(result.document?.documentId).toBe("doc-123");
      });
    });

    describe("updateGoogleDoc", () => {
      it("should update document successfully", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => ({}),
        });

        const result = await updateGoogleDoc("test-token", {
          documentId: "doc-123",
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: "Updated text",
              },
            },
          ],
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe("Google Sheets", () => {
    describe("createGoogleSheet", () => {
      it("should create spreadsheet successfully", async () => {
        const mockSheet = {
          spreadsheetId: "sheet-123",
          properties: {
            title: "Test Sheet",
          },
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123",
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: "Sheet1",
              },
            },
          ],
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockSheet,
        });

        const result = await createGoogleSheet("test-token", {
          title: "Test Sheet",
        });

        expect(result.success).toBe(true);
        expect(result.spreadsheet?.spreadsheetId).toBe("sheet-123");
        expect(result.spreadsheet?.title).toBe("Test Sheet");
        expect(global.fetch).toHaveBeenCalledWith(
          "https://sheets.googleapis.com/v4/spreadsheets",
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      it("should create with custom sheets", async () => {
        const mockSheet = {
          spreadsheetId: "sheet-123",
          properties: { title: "Test" },
          sheets: [
            { properties: { sheetId: 0, title: "Data" } },
            { properties: { sheetId: 1, title: "Summary" } },
          ],
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockSheet,
        });

        const result = await createGoogleSheet("test-token", {
          title: "Test Sheet",
          sheets: [
            { title: "Data", rowCount: 500, columnCount: 10 },
            { title: "Summary", rowCount: 100, columnCount: 5 },
          ],
        });

        expect(result.success).toBe(true);
        expect(result.spreadsheet?.sheets).toHaveLength(2);
      });

      it("should handle creation errors", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => "Forbidden",
        });

        const result = await createGoogleSheet("test-token", {
          title: "Test Sheet",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to create spreadsheet");
      });
    });

    describe("updateGoogleSheet", () => {
      it("should update values successfully", async () => {
        const mockResponse = {
          updatedRange: "Sheet1!A1:B2",
          updatedRows: 2,
          updatedColumns: 2,
          updatedCells: 4,
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await updateGoogleSheet("test-token", {
          spreadsheetId: "sheet-123",
          range: "Sheet1!A1:B2",
          values: [
            ["Header 1", "Header 2"],
            ["Value 1", "Value 2"],
          ],
        });

        expect(result.success).toBe(true);
        expect(result.updatedCells).toBe(4);
      });

      it("should handle update errors", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 404,
          text: async () => "Spreadsheet not found",
        });

        const result = await updateGoogleSheet("test-token", {
          spreadsheetId: "invalid-sheet",
          range: "A1:B2",
          values: [["data"]],
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to update spreadsheet");
      });
    });

    describe("appendToGoogleSheet", () => {
      it("should append values successfully", async () => {
        const mockResponse = {
          updates: {
            updatedRange: "Sheet1!A3:B3",
            updatedRows: 1,
            updatedColumns: 2,
            updatedCells: 2,
          },
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await appendToGoogleSheet(
          "test-token",
          "sheet-123",
          "Sheet1!A1:B1",
          [["New", "Data"]]
        );

        expect(result.success).toBe(true);
        expect(result.updatedCells).toBe(2);
      });
    });

    describe("getGoogleSheetValues", () => {
      it("should get values successfully", async () => {
        const mockResponse = {
          range: "Sheet1!A1:B2",
          values: [
            ["Header 1", "Header 2"],
            ["Value 1", "Value 2"],
          ],
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await getGoogleSheetValues("test-token", "sheet-123", "Sheet1!A1:B2");

        expect(result.success).toBe(true);
        expect(result.values).toHaveLength(2);
        expect(result.values?.[0]).toEqual(["Header 1", "Header 2"]);
      });

      it("should handle empty results", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => ({ range: "Sheet1!A1:B2" }),
        });

        const result = await getGoogleSheetValues("test-token", "sheet-123", "Sheet1!A1:B2");

        expect(result.success).toBe(true);
        expect(result.values).toEqual([]);
      });
    });
  });

  describe("Sharing & Permissions", () => {
    describe("shareGoogleFile", () => {
      it("should share file with user successfully", async () => {
        const mockPermission = {
          id: "perm-123",
          type: "user",
          role: "writer",
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockPermission,
        });

        const result = await shareGoogleFile("test-token", {
          fileId: "file-123",
          role: "writer",
          type: "user",
          emailAddress: "user@example.com",
        });

        expect(result.success).toBe(true);
        expect(result.permissionId).toBe("perm-123");
      });

      it("should share with anyone", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => ({ id: "perm-456" }),
        });

        const result = await shareGoogleFile("test-token", {
          fileId: "file-123",
          role: "reader",
          type: "anyone",
        });

        expect(result.success).toBe(true);
      });

      it("should handle share errors", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => "Forbidden",
        });

        const result = await shareGoogleFile("test-token", {
          fileId: "file-123",
          role: "writer",
          type: "user",
          emailAddress: "user@example.com",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to share file");
      });
    });

    describe("getFileShareableLink", () => {
      it("should get shareable link successfully", async () => {
        const mockFile = {
          webViewLink: "https://docs.google.com/document/d/doc-123/view",
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => mockFile,
        });

        const result = await getFileShareableLink("test-token", "doc-123");

        expect(result.success).toBe(true);
        expect(result.webViewLink).toContain("docs.google.com");
      });

      it("should handle link fetch errors", async () => {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 404,
          text: async () => "Not found",
        });

        const result = await getFileShareableLink("test-token", "invalid-file");

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to get file link");
      });
    });
  });
});
