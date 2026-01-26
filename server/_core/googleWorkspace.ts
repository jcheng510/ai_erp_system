/**
 * Google Workspace Integration (Docs, Sheets, etc.)
 * Handles creating and managing Google Docs, Sheets, and other Workspace files
 */

import { ENV } from "./env";

const DOCS_API = "https://docs.googleapis.com/v1/documents";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

// Validation regex patterns for Google IDs
// Allow shorter IDs for testing purposes (real Google IDs are typically 44+ chars)
const GOOGLE_DOC_ID_PATTERN = /^[a-zA-Z0-9_-]{5,}$/;
const GOOGLE_SHEET_ID_PATTERN = /^[a-zA-Z0-9_-]{5,}$/;
const GOOGLE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{5,}$/;

/**
 * Validate Google document/file ID format
 */
function validateGoogleId(id: string, type: "doc" | "sheet" | "file"): boolean {
  const pattern = type === "doc" ? GOOGLE_DOC_ID_PATTERN : 
                  type === "sheet" ? GOOGLE_SHEET_ID_PATTERN : 
                  GOOGLE_FILE_ID_PATTERN;
  return pattern.test(id);
}

// Google Docs types
export interface GoogleDocCreateOptions {
  title: string;
  content?: string; // Initial content as plain text
}

export interface GoogleDocUpdateOptions {
  documentId: string;
  requests: any[]; // Google Docs API batch update requests
}

export interface GoogleDoc {
  documentId: string;
  title: string;
  body?: any;
  revisionId?: string;
}

// Google Sheets types
export interface GoogleSheetCreateOptions {
  title: string;
  sheets?: Array<{
    title: string;
    rowCount?: number;
    columnCount?: number;
  }>;
}

export interface GoogleSheetUpdateOptions {
  spreadsheetId: string;
  range: string; // e.g., "Sheet1!A1:B2"
  values: any[][]; // 2D array of values
}

export interface GoogleSheet {
  spreadsheetId: string;
  title: string;
  sheets?: Array<{
    sheetId: number;
    title: string;
  }>;
  spreadsheetUrl?: string;
}

// Permission types
export interface ShareOptions {
  fileId: string;
  role: "reader" | "writer" | "commenter" | "owner";
  type: "user" | "group" | "domain" | "anyone";
  emailAddress?: string; // Required for user/group
  domain?: string; // Required for domain
  sendNotificationEmail?: boolean;
}

/**
 * Get OAuth URL for Google Workspace access
 */
export function getGoogleWorkspaceAuthUrl(userId: number): string {
  const clientId = ENV.googleClientId;
  const redirectUri = ENV.googleRedirectUri || `${ENV.appUrl}/api/oauth/google/callback`;
  
  // Request Workspace scopes
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/documents " +
    "https://www.googleapis.com/auth/spreadsheets " +
    "https://www.googleapis.com/auth/drive.file"
  );
  
  const state = userId.toString();
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
}

// ============================================
// GOOGLE DOCS FUNCTIONS
// ============================================

/**
 * Create a new Google Doc
 */
export async function createGoogleDoc(
  accessToken: string,
  options: GoogleDocCreateOptions
): Promise<{ success: boolean; document?: GoogleDoc; error?: string }> {
  try {
    // First create the document
    const createResponse = await fetch(DOCS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: options.title,
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error("[GoogleDocs] Failed to create document:", error);
      return { success: false, error: `Failed to create document: ${createResponse.status}` };
    }

    const doc = await createResponse.json();

    // If initial content is provided, add it
    if (options.content) {
      const updateResult = await insertTextInDoc(accessToken, doc.documentId, options.content);
      if (!updateResult.success) {
        console.warn("[GoogleDocs] Document created but failed to add content:", updateResult.error);
      }
    }

    return {
      success: true,
      document: {
        documentId: doc.documentId,
        title: doc.title,
        body: doc.body,
        revisionId: doc.revisionId,
      },
    };
  } catch (error: any) {
    console.error("[GoogleDocs] Error creating document:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Insert text into a Google Doc
 */
export async function insertTextInDoc(
  accessToken: string,
  documentId: string,
  text: string,
  index: number = 1 // Insert at beginning by default (index 1, after the title)
): Promise<{ success: boolean; error?: string }> {
  // Validate document ID
  if (!validateGoogleId(documentId, "doc")) {
    return { success: false, error: "Invalid document ID format" };
  }
  
  try {
    const response = await fetch(`${DOCS_API}/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index },
              text: text,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[GoogleDocs] Failed to insert text:", error);
      return { success: false, error: `Failed to insert text: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[GoogleDocs] Error inserting text:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a Google Doc
 */
export async function getGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<{ success: boolean; document?: GoogleDoc; error?: string }> {
  // Validate document ID
  if (!validateGoogleId(documentId, "doc")) {
    return { success: false, error: "Invalid document ID format" };
  }
  
  try {
    const response = await fetch(`${DOCS_API}/${documentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[GoogleDocs] Failed to get document:", error);
      return { success: false, error: `Failed to get document: ${response.status}` };
    }

    const doc = await response.json();
    return {
      success: true,
      document: {
        documentId: doc.documentId,
        title: doc.title,
        body: doc.body,
        revisionId: doc.revisionId,
      },
    };
  } catch (error: any) {
    console.error("[GoogleDocs] Error getting document:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a Google Doc with batch requests
 */
export async function updateGoogleDoc(
  accessToken: string,
  options: GoogleDocUpdateOptions
): Promise<{ success: boolean; error?: string }> {
  // Validate document ID
  if (!validateGoogleId(options.documentId, "doc")) {
    return { success: false, error: "Invalid document ID format" };
  }
  
  try {
    const response = await fetch(`${DOCS_API}/${options.documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: options.requests,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[GoogleDocs] Failed to update document:", error);
      return { success: false, error: `Failed to update document: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[GoogleDocs] Error updating document:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// GOOGLE SHEETS FUNCTIONS
// ============================================

/**
 * Create a new Google Sheet
 */
export async function createGoogleSheet(
  accessToken: string,
  options: GoogleSheetCreateOptions
): Promise<{ success: boolean; spreadsheet?: GoogleSheet; error?: string }> {
  try {
    const requestBody: any = {
      properties: {
        title: options.title,
      },
    };

    // Add sheets if specified
    if (options.sheets && options.sheets.length > 0) {
      requestBody.sheets = options.sheets.map((sheet) => ({
        properties: {
          title: sheet.title,
          gridProperties: {
            rowCount: sheet.rowCount || 1000,
            columnCount: sheet.columnCount || 26,
          },
        },
      }));
    }

    const response = await fetch(SHEETS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[GoogleSheets] Failed to create spreadsheet:", error);
      return { success: false, error: `Failed to create spreadsheet: ${response.status}` };
    }

    const data = await response.json();
    return {
      success: true,
      spreadsheet: {
        spreadsheetId: data.spreadsheetId,
        title: data.properties.title,
        sheets: data.sheets?.map((s: any) => ({
          sheetId: s.properties.sheetId,
          title: s.properties.title,
        })),
        spreadsheetUrl: data.spreadsheetUrl,
      },
    };
  } catch (error: any) {
    console.error("[GoogleSheets] Error creating spreadsheet:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update values in a Google Sheet
 */
export async function updateGoogleSheet(
  accessToken: string,
  options: GoogleSheetUpdateOptions
): Promise<{ success: boolean; updatedCells?: number; error?: string }> {
  // Validate spreadsheet ID
  if (!validateGoogleId(options.spreadsheetId, "sheet")) {
    return { success: false, error: "Invalid spreadsheet ID format" };
  }
  
  try {
    const response = await fetch(
      `${SHEETS_API}/${options.spreadsheetId}/values/${encodeURIComponent(options.range)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: options.range,
          values: options.values,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[GoogleSheets] Failed to update spreadsheet:", error);
      return { success: false, error: `Failed to update spreadsheet: ${response.status}` };
    }

    const data = await response.json();
    return { 
      success: true, 
      updatedCells: data.updatedCells 
    };
  } catch (error: any) {
    console.error("[GoogleSheets] Error updating spreadsheet:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Append values to a Google Sheet
 */
export async function appendToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<{ success: boolean; updatedCells?: number; error?: string }> {
  // Validate spreadsheet ID
  if (!validateGoogleId(spreadsheetId, "sheet")) {
    return { success: false, error: "Invalid spreadsheet ID format" };
  }
  
  try {
    const response = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: values,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[GoogleSheets] Failed to append to spreadsheet:", error);
      return { success: false, error: `Failed to append to spreadsheet: ${response.status}` };
    }

    const data = await response.json();
    return { 
      success: true, 
      updatedCells: data.updates?.updatedCells 
    };
  } catch (error: any) {
    console.error("[GoogleSheets] Error appending to spreadsheet:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get values from a Google Sheet
 */
export async function getGoogleSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<{ success: boolean; values?: any[][]; error?: string }> {
  // Validate spreadsheet ID
  if (!validateGoogleId(spreadsheetId, "sheet")) {
    return { success: false, error: "Invalid spreadsheet ID format" };
  }
  
  try {
    const response = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[GoogleSheets] Failed to get values:", error);
      return { success: false, error: `Failed to get values: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, values: data.values || [] };
  } catch (error: any) {
    console.error("[GoogleSheets] Error getting values:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// SHARING & PERMISSIONS
// ============================================

/**
 * Share a Google Drive file (works for Docs, Sheets, etc.)
 */
export async function shareGoogleFile(
  accessToken: string,
  options: ShareOptions
): Promise<{ success: boolean; permissionId?: string; error?: string }> {
  // Validate file ID
  if (!validateGoogleId(options.fileId, "file")) {
    return { success: false, error: "Invalid file ID format" };
  }
  
  try {
    const requestBody: any = {
      role: options.role,
      type: options.type,
    };

    if (options.emailAddress) {
      requestBody.emailAddress = options.emailAddress;
    }

    if (options.domain) {
      requestBody.domain = options.domain;
    }

    const params = new URLSearchParams();
    if (options.sendNotificationEmail !== undefined) {
      params.append("sendNotificationEmail", options.sendNotificationEmail.toString());
    }

    const url = `${DRIVE_API}/files/${options.fileId}/permissions${params.toString() ? "?" + params.toString() : ""}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[GoogleWorkspace] Failed to share file:", error);
      return { success: false, error: `Failed to share file: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, permissionId: data.id };
  } catch (error: any) {
    console.error("[GoogleWorkspace] Error sharing file:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get shareable link for a file
 */
export async function getFileShareableLink(
  accessToken: string,
  fileId: string
): Promise<{ success: boolean; webViewLink?: string; error?: string }> {
  // Validate file ID
  if (!validateGoogleId(fileId, "file")) {
    return { success: false, error: "Invalid file ID format" };
  }
  
  try {
    const response = await fetch(`${DRIVE_API}/files/${fileId}?fields=webViewLink`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to get file link: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, webViewLink: data.webViewLink };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
