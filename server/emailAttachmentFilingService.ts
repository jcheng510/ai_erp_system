/**
 * Email Attachment Filing Service
 * Automatically files email attachments to Google Drive and ERP data rooms
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { storagePut, storageGet } from "./storage";
import { classifyEmailForSpam, shouldProcessEmail, SpamFilterResult } from "./emailSpamFilterService";
import { parseAttachmentContent, ParsedDocumentData } from "./_core/emailParser";

// Document categories for filing
export type DocumentFilingCategory =
  | "invoice"
  | "receipt"
  | "purchase_order"
  | "packing_slip"
  | "bill_of_lading"
  | "customs_document"
  | "certificate_of_origin"
  | "freight_quote"
  | "shipping_label"
  | "contract"
  | "correspondence"
  | "other";

// Filing destination types
export type FilingDestinationType = "data_room" | "google_drive" | "vendor_folder" | "customs" | "pending";

export interface DocumentClassification {
  category: DocumentFilingCategory;
  confidence: number;
  vendorName?: string;
  documentNumber?: string;
  documentDate?: string;
  amount?: number;
  currency?: string;
  relatedPONumber?: string;
  relatedShipmentNumber?: string;
  suggestedFilingPath: string;
}

export interface FilingResult {
  success: boolean;
  filingId?: number;
  destinationType: FilingDestinationType;
  destinationPath?: string;
  documentCategory: DocumentFilingCategory;
  error?: string;

  // Created/linked entities
  dataRoomDocumentId?: number;
  googleDriveFileId?: string;
  vendorId?: number;
  purchaseOrderId?: number;
  shipmentId?: number;
  customsClearanceId?: number;
}

export interface AttachmentFilingInput {
  emailId: number;
  attachmentId: number;
  filename: string;
  mimeType?: string;
  storageUrl?: string;
  storageKey?: string;
  extractedText?: string;
  emailSubject?: string;
  emailFromEmail?: string;
  emailFromName?: string;
  emailCategory?: string;
}

// Document type detection patterns
const DOCUMENT_PATTERNS: Record<DocumentFilingCategory, { patterns: RegExp[]; priority: number }> = {
  invoice: {
    patterns: [
      /invoice\s*#?\s*:?\s*\d/i,
      /bill\s*to\s*:/i,
      /amount\s*due/i,
      /payment\s*terms/i,
      /due\s*date/i,
      /total\s*amount/i,
      /invoice\s*date/i,
    ],
    priority: 10,
  },
  purchase_order: {
    patterns: [
      /purchase\s*order/i,
      /po\s*#?\s*:?\s*\d/i,
      /order\s*confirmation/i,
      /order\s*number/i,
      /vendor\s*#/i,
    ],
    priority: 9,
  },
  packing_slip: {
    patterns: [
      /packing\s*(list|slip)/i,
      /qty\s*shipped/i,
      /items\s*included/i,
      /package\s*contents/i,
      /carton\s*#/i,
    ],
    priority: 8,
  },
  bill_of_lading: {
    patterns: [
      /bill\s*of\s*lading/i,
      /b\/l\s*#/i,
      /bol\s*#/i,
      /shipper/i,
      /consignee/i,
      /notify\s*party/i,
      /ocean\s*freight/i,
      /container\s*#/i,
    ],
    priority: 8,
  },
  customs_document: {
    patterns: [
      /customs/i,
      /import\s*declaration/i,
      /export\s*declaration/i,
      /harmonized\s*code/i,
      /hs\s*code/i,
      /tariff/i,
      /duty/i,
      /clearance/i,
    ],
    priority: 7,
  },
  certificate_of_origin: {
    patterns: [
      /certificate\s*of\s*origin/i,
      /country\s*of\s*origin/i,
      /coo\s*#/i,
      /origin\s*certificate/i,
    ],
    priority: 7,
  },
  freight_quote: {
    patterns: [
      /freight\s*quote/i,
      /shipping\s*quote/i,
      /rate\s*quote/i,
      /quotation/i,
      /freight\s*rate/i,
      /estimated\s*cost/i,
    ],
    priority: 6,
  },
  receipt: {
    patterns: [
      /receipt/i,
      /payment\s*confirmation/i,
      /transaction\s*id/i,
      /payment\s*received/i,
      /thank\s*you\s*for\s*your\s*(payment|purchase)/i,
    ],
    priority: 5,
  },
  shipping_label: {
    patterns: [
      /shipping\s*label/i,
      /tracking\s*#/i,
      /tracking\s*number/i,
      /ship\s*to/i,
      /from\s*address/i,
    ],
    priority: 4,
  },
  contract: {
    patterns: [
      /agreement/i,
      /contract/i,
      /terms\s*and\s*conditions/i,
      /hereby\s*agree/i,
      /signatures?:/i,
      /effective\s*date/i,
    ],
    priority: 3,
  },
  correspondence: {
    patterns: [
      /dear\s+/i,
      /regards,/i,
      /sincerely,/i,
      /best\s*regards/i,
    ],
    priority: 1,
  },
  other: {
    patterns: [],
    priority: 0,
  },
};

/**
 * Classify document type from filename and content
 */
export function quickClassifyDocument(
  filename: string,
  extractedText?: string
): { category: DocumentFilingCategory; confidence: number; matchedPatterns: string[] } {
  const content = `${filename} ${extractedText || ""}`.toLowerCase();
  const matchedPatterns: string[] = [];
  let bestMatch: DocumentFilingCategory = "other";
  let bestScore = 0;
  let bestPriority = 0;

  for (const [category, config] of Object.entries(DOCUMENT_PATTERNS)) {
    let score = 0;
    for (const pattern of config.patterns) {
      if (pattern.test(content)) {
        score++;
        matchedPatterns.push(`${category}:${pattern.source}`);
      }
    }

    // Weight by priority and match count
    const weightedScore = score * (1 + config.priority / 10);

    if (weightedScore > bestScore || (weightedScore === bestScore && config.priority > bestPriority)) {
      bestScore = weightedScore;
      bestPriority = config.priority;
      bestMatch = category as DocumentFilingCategory;
    }
  }

  // Calculate confidence based on number of matches
  const confidence = Math.min(0.95, 0.3 + (bestScore * 0.15));

  return {
    category: bestMatch,
    confidence,
    matchedPatterns,
  };
}

/**
 * Use AI to classify document type and extract metadata
 */
export async function aiClassifyDocument(
  filename: string,
  extractedText?: string,
  emailSubject?: string,
  emailFrom?: string
): Promise<DocumentClassification> {
  try {
    const prompt = `You are an expert document classifier for a business ERP system. Analyze this document and extract key information.

FILENAME: ${filename}
EMAIL SUBJECT: ${emailSubject || "N/A"}
EMAIL FROM: ${emailFrom || "N/A"}

DOCUMENT CONTENT (first 4000 chars):
${extractedText?.substring(0, 4000) || "(No text extracted)"}

DOCUMENT CATEGORIES:
- invoice: Vendor invoices, bills for payment
- receipt: Payment receipts, transaction confirmations
- purchase_order: POs, order confirmations from suppliers
- packing_slip: Packing lists, shipping manifests
- bill_of_lading: Ocean/air freight documents, B/Ls
- customs_document: Customs declarations, import/export docs
- certificate_of_origin: COO certificates
- freight_quote: Shipping rate quotes, carrier bids
- shipping_label: Shipping labels, tracking documents
- contract: Agreements, legal documents
- correspondence: General business letters
- other: Doesn't fit other categories

INSTRUCTIONS:
1. Determine the document category based on content and filename
2. Extract vendor/company name if visible
3. Extract document number (invoice #, PO #, etc.)
4. Extract document date if present
5. Extract monetary amount if applicable
6. Identify related PO or shipment references
7. Suggest a filing path like: /category/vendor/YYYY-MM/

Return JSON:
{
  "category": "invoice|receipt|purchase_order|packing_slip|bill_of_lading|customs_document|certificate_of_origin|freight_quote|shipping_label|contract|correspondence|other",
  "confidence": 0.85,
  "vendorName": "Vendor Company",
  "documentNumber": "INV-12345",
  "documentDate": "2025-01-15",
  "amount": 1234.56,
  "currency": "USD",
  "relatedPONumber": "PO-2025-001",
  "relatedShipmentNumber": "SHIP-123",
  "suggestedFilingPath": "/invoices/VendorName/2025-01/"
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a document classification AI. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "document_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: { type: "string" },
              confidence: { type: "number" },
              vendorName: { type: "string" },
              documentNumber: { type: "string" },
              documentDate: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" },
              relatedPONumber: { type: "string" },
              relatedShipmentNumber: { type: "string" },
              suggestedFilingPath: { type: "string" }
            },
            required: ["category", "confidence", "suggestedFilingPath"],
            additionalProperties: false
          }
        }
      }
    });

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error("No AI response");
    }

    const content = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
    const parsed = JSON.parse(content);

    const validCategories: DocumentFilingCategory[] = [
      "invoice", "receipt", "purchase_order", "packing_slip", "bill_of_lading",
      "customs_document", "certificate_of_origin", "freight_quote", "shipping_label",
      "contract", "correspondence", "other"
    ];

    return {
      category: validCategories.includes(parsed.category) ? parsed.category : "other",
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      vendorName: parsed.vendorName,
      documentNumber: parsed.documentNumber,
      documentDate: parsed.documentDate,
      amount: parsed.amount,
      currency: parsed.currency || "USD",
      relatedPONumber: parsed.relatedPONumber,
      relatedShipmentNumber: parsed.relatedShipmentNumber,
      suggestedFilingPath: parsed.suggestedFilingPath || `/other/${new Date().toISOString().slice(0, 7)}/`,
    };
  } catch (error) {
    console.error("[FilingService] AI classification error:", error);

    // Fall back to quick classification
    const quick = quickClassifyDocument(filename, extractedText);
    return {
      category: quick.category,
      confidence: quick.confidence * 0.8, // Reduce confidence for fallback
      suggestedFilingPath: `/${quick.category}/${new Date().toISOString().slice(0, 7)}/`,
    };
  }
}

/**
 * Find matching filing rule for an attachment
 */
export async function findMatchingFilingRule(
  classification: DocumentClassification,
  emailCategory?: string,
  senderEmail?: string,
  vendorId?: number
): Promise<{
  rule: any | null;
  destinationType: FilingDestinationType;
  destinationPath: string;
  dataRoomId?: number;
  dataRoomFolderId?: number;
  googleDriveFolderId?: string;
}> {
  // Get all enabled filing rules, ordered by priority
  const rules = await db.getEmailFilingRules({ isEnabled: true });

  for (const rule of rules) {
    let matches = true;

    // Check document category match
    if (rule.documentCategories && Array.isArray(rule.documentCategories)) {
      if (!rule.documentCategories.includes(classification.category)) {
        matches = false;
      }
    }

    // Check email category match
    if (matches && rule.emailCategories && Array.isArray(rule.emailCategories)) {
      if (!emailCategory || !rule.emailCategories.includes(emailCategory)) {
        matches = false;
      }
    }

    // Check vendor match
    if (matches && rule.vendorIds && Array.isArray(rule.vendorIds)) {
      if (!vendorId || !rule.vendorIds.includes(vendorId)) {
        matches = false;
      }
    }

    // Check sender pattern
    if (matches && rule.senderPattern && senderEmail) {
      try {
        const regex = new RegExp(rule.senderPattern, "i");
        if (!regex.test(senderEmail)) {
          matches = false;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Check confidence threshold
    if (matches && rule.minConfidence) {
      const minConf = parseFloat(rule.minConfidence);
      if (classification.confidence < minConf) {
        matches = false;
      }
    }

    if (matches) {
      // Build destination path from template
      let path = rule.pathTemplate || `/${classification.category}/`;

      // Replace placeholders
      path = path.replace(/{vendorName}/g, classification.vendorName || "Unknown");
      path = path.replace(/{documentType}/g, classification.category);
      path = path.replace(/{date}/g, new Date().toISOString().slice(0, 10));
      path = path.replace(/{month}/g, new Date().toISOString().slice(0, 7));
      path = path.replace(/{year}/g, new Date().getFullYear().toString());

      // Update rule stats
      await db.incrementFilingRuleStats(rule.id);

      return {
        rule,
        destinationType: rule.destinationType as FilingDestinationType,
        destinationPath: path,
        dataRoomId: rule.destinationDataRoomId,
        dataRoomFolderId: rule.destinationFolderId,
        googleDriveFolderId: rule.destinationGoogleDriveFolderId,
      };
    }
  }

  // No matching rule found - use default filing location
  return {
    rule: null,
    destinationType: "pending",
    destinationPath: classification.suggestedFilingPath,
  };
}

/**
 * File attachment to ERP data room
 */
export async function fileToDataRoom(
  attachmentId: number,
  filename: string,
  storageUrl: string,
  storageKey: string,
  mimeType: string,
  fileSize: number,
  dataRoomId: number,
  folderId: number | null,
  classification: DocumentClassification,
  userId?: number
): Promise<{ success: boolean; documentId?: number; error?: string }> {
  try {
    // Get file type from mime type
    let fileType = "other";
    if (mimeType.includes("pdf")) fileType = "pdf";
    else if (mimeType.includes("image")) fileType = "image";
    else if (mimeType.includes("word") || mimeType.includes("document")) fileType = "doc";
    else if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) fileType = "xls";
    else if (mimeType.includes("text")) fileType = "text";

    // Create data room document
    const result = await db.createDataRoomDocument({
      dataRoomId,
      folderId,
      name: filename,
      description: `Filed from email attachment - ${classification.category}`,
      fileType,
      mimeType,
      fileSize,
      storageType: "s3",
      storageUrl,
      storageKey,
      uploadedBy: userId,
    });

    return { success: true, documentId: result.id };
  } catch (error) {
    console.error("[FilingService] Failed to file to data room:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * File attachment to Google Drive
 */
export async function fileToGoogleDrive(
  attachmentId: number,
  filename: string,
  storageKey: string,
  mimeType: string,
  googleDriveFolderId: string,
  accessToken: string
): Promise<{ success: boolean; fileId?: string; webLink?: string; error?: string }> {
  try {
    // Get file content from storage
    const fileContent = await storageGet(storageKey);
    if (!fileContent) {
      return { success: false, error: "Could not retrieve file from storage" };
    }

    // Create file in Google Drive
    const metadata = {
      name: filename,
      mimeType: mimeType,
      parents: [googleDriveFolderId],
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    formData.append(
      "file",
      new Blob([fileContent], { type: mimeType }),
      filename
    );

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[FilingService] Google Drive upload failed:", error);
      return { success: false, error: `Upload failed: ${response.status}` };
    }

    const data = await response.json();
    return {
      success: true,
      fileId: data.id,
      webLink: data.webViewLink,
    };
  } catch (error) {
    console.error("[FilingService] Google Drive filing error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Create or find folder path in data room
 */
export async function ensureDataRoomFolderPath(
  dataRoomId: number,
  path: string
): Promise<number | null> {
  const parts = path.split("/").filter(p => p.trim());
  if (parts.length === 0) return null;

  let currentParentId: number | null = null;

  for (const folderName of parts) {
    // Look for existing folder
    const existingFolders = await db.getDataRoomFolders(dataRoomId);
    const existing = existingFolders.find(
      f => f.name.toLowerCase() === folderName.toLowerCase() && f.parentId === currentParentId
    );

    if (existing) {
      currentParentId = existing.id;
    } else {
      // Create the folder
      const result = await db.createDataRoomFolder({
        dataRoomId,
        parentId: currentParentId,
        name: folderName,
      });
      currentParentId = result;
    }
  }

  return currentParentId;
}

/**
 * Main function to file an email attachment
 */
export async function fileEmailAttachment(
  input: AttachmentFilingInput,
  options?: {
    useAI?: boolean;
    autoFile?: boolean;
    userId?: number;
    googleAccessToken?: string;
  }
): Promise<FilingResult> {
  const useAI = options?.useAI ?? true;
  const autoFile = options?.autoFile ?? true;
  const userId = options?.userId;

  try {
    // Step 1: Classify the document
    let classification: DocumentClassification;

    if (useAI && input.extractedText) {
      classification = await aiClassifyDocument(
        input.filename,
        input.extractedText,
        input.emailSubject,
        input.emailFromEmail
      );
    } else {
      const quick = quickClassifyDocument(input.filename, input.extractedText);
      classification = {
        category: quick.category,
        confidence: quick.confidence,
        suggestedFilingPath: `/${quick.category}/${new Date().toISOString().slice(0, 7)}/`,
      };
    }

    // Step 2: Try to match vendor
    let vendorId: number | undefined;
    let vendorName = classification.vendorName;

    if (input.emailFromEmail) {
      const vendorMatch = await db.getVendorByEmailDomain(input.emailFromEmail);
      if (vendorMatch) {
        vendorId = vendorMatch.id;
        vendorName = vendorName || vendorMatch.name;
      }
    }

    // Step 3: Find matching filing rule
    const ruleMatch = await findMatchingFilingRule(
      classification,
      input.emailCategory,
      input.emailFromEmail,
      vendorId
    );

    // Step 4: Create filing record
    const filingResult = await db.createEmailAttachmentFiling({
      emailId: input.emailId,
      attachmentId: input.attachmentId,
      destinationType: ruleMatch.destinationType as any,
      destinationPath: ruleMatch.destinationPath,
      documentCategory: classification.category as any,
      documentCategoryConfidence: classification.confidence.toFixed(2),
      vendorId,
      vendorName,
      filingStatus: autoFile ? "processing" : "pending",
      autoFiled: autoFile,
      filedBy: userId,
      aiAnalysis: classification as any,
      extractedDocumentNumber: classification.documentNumber,
      extractedAmount: classification.amount?.toFixed(2),
      extractedCurrency: classification.currency,
    });

    if (!autoFile) {
      // Return pending result for manual filing
      return {
        success: true,
        filingId: filingResult.id,
        destinationType: "pending",
        destinationPath: ruleMatch.destinationPath,
        documentCategory: classification.category,
        vendorId,
      };
    }

    // Step 5: Perform the filing based on destination type
    let fileSuccess = false;
    let dataRoomDocumentId: number | undefined;
    let googleDriveFileId: string | undefined;
    let error: string | undefined;

    if (ruleMatch.destinationType === "data_room" && ruleMatch.dataRoomId && input.storageUrl && input.storageKey) {
      // Create folder path if needed
      const folderId = await ensureDataRoomFolderPath(
        ruleMatch.dataRoomId,
        ruleMatch.destinationPath
      );

      const drResult = await fileToDataRoom(
        input.attachmentId,
        input.filename,
        input.storageUrl,
        input.storageKey,
        input.mimeType || "application/octet-stream",
        0, // File size - would need to get from storage
        ruleMatch.dataRoomId,
        folderId,
        classification,
        userId
      );

      fileSuccess = drResult.success;
      dataRoomDocumentId = drResult.documentId;
      error = drResult.error;

      // Update filing record with data room info
      if (fileSuccess) {
        await db.updateEmailAttachmentFiling(filingResult.id, {
          dataRoomId: ruleMatch.dataRoomId,
          dataRoomFolderId: folderId,
          dataRoomDocumentId,
          filingStatus: "filed",
          filedAt: new Date(),
        });
      }
    } else if (ruleMatch.destinationType === "google_drive" && ruleMatch.googleDriveFolderId && options?.googleAccessToken) {
      const gdResult = await fileToGoogleDrive(
        input.attachmentId,
        input.filename,
        input.storageKey || "",
        input.mimeType || "application/octet-stream",
        ruleMatch.googleDriveFolderId,
        options.googleAccessToken
      );

      fileSuccess = gdResult.success;
      googleDriveFileId = gdResult.fileId;
      error = gdResult.error;

      // Update filing record with Google Drive info
      if (fileSuccess) {
        await db.updateEmailAttachmentFiling(filingResult.id, {
          googleDriveFileId,
          googleDriveFolderId: ruleMatch.googleDriveFolderId,
          googleDriveWebLink: gdResult.webLink,
          filingStatus: "filed",
          filedAt: new Date(),
        });
      }
    } else {
      // No valid destination - mark as pending
      await db.updateEmailAttachmentFiling(filingResult.id, {
        filingStatus: "pending",
        filingError: "No valid filing destination configured",
      });

      return {
        success: true,
        filingId: filingResult.id,
        destinationType: "pending",
        destinationPath: ruleMatch.destinationPath,
        documentCategory: classification.category,
        vendorId,
      };
    }

    // Update filing status on failure
    if (!fileSuccess) {
      await db.updateEmailAttachmentFiling(filingResult.id, {
        filingStatus: "failed",
        filingError: error,
      });
    }

    return {
      success: fileSuccess,
      filingId: filingResult.id,
      destinationType: ruleMatch.destinationType,
      destinationPath: ruleMatch.destinationPath,
      documentCategory: classification.category,
      error,
      dataRoomDocumentId,
      googleDriveFileId,
      vendorId,
    };
  } catch (error) {
    console.error("[FilingService] Filing error:", error);
    return {
      success: false,
      destinationType: "pending",
      documentCategory: "other",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process all attachments for an email
 */
export async function processEmailAttachments(
  emailId: number,
  options?: {
    useAI?: boolean;
    autoFile?: boolean;
    userId?: number;
    googleAccessToken?: string;
    filterSpam?: boolean;
    filterSolicitations?: boolean;
  }
): Promise<{
  processed: number;
  filed: number;
  skipped: number;
  failed: number;
  spamFiltered: boolean;
  results: FilingResult[];
}> {
  const results: FilingResult[] = [];
  let processed = 0;
  let filed = 0;
  let skipped = 0;
  let failed = 0;
  let spamFiltered = false;

  try {
    // Get the email
    const email = await db.getInboundEmailById(emailId);
    if (!email) {
      return { processed: 0, filed: 0, skipped: 0, failed: 0, spamFiltered: false, results: [] };
    }

    // Check spam filtering
    if (options?.filterSpam !== false || options?.filterSolicitations !== false) {
      const spamCheck = await shouldProcessEmail(
        emailId,
        email.subject || "",
        email.bodyText || "",
        email.fromEmail,
        email.fromName || undefined,
        {
          filterSpam: options?.filterSpam,
          filterSolicitations: options?.filterSolicitations,
        }
      );

      if (!spamCheck.shouldProcess) {
        console.log(`[FilingService] Email ${emailId} filtered: ${spamCheck.reason}`);
        spamFiltered = true;
        return { processed: 0, filed: 0, skipped: 0, failed: 0, spamFiltered: true, results: [] };
      }
    }

    // Get attachments
    const attachments = await db.getEmailAttachments(emailId);
    if (attachments.length === 0) {
      return { processed: 0, filed: 0, skipped: 0, failed: 0, spamFiltered: false, results: [] };
    }

    // Process each attachment
    for (const attachment of attachments) {
      processed++;

      // Skip non-document attachments
      const isDocument = isDocumentMimeType(attachment.mimeType || "");
      if (!isDocument) {
        skipped++;
        continue;
      }

      const input: AttachmentFilingInput = {
        emailId,
        attachmentId: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType || undefined,
        storageUrl: attachment.storageUrl || undefined,
        storageKey: attachment.storageKey || undefined,
        extractedText: attachment.extractedText || undefined,
        emailSubject: email.subject || undefined,
        emailFromEmail: email.fromEmail,
        emailFromName: email.fromName || undefined,
        emailCategory: email.category || undefined,
      };

      const result = await fileEmailAttachment(input, options);
      results.push(result);

      if (result.success) {
        filed++;
      } else {
        failed++;
      }
    }

    return { processed, filed, skipped, failed, spamFiltered, results };
  } catch (error) {
    console.error("[FilingService] Error processing email attachments:", error);
    return { processed, filed, skipped, failed, spamFiltered, results };
  }
}

/**
 * Check if a MIME type is a document type we should process
 */
function isDocumentMimeType(mimeType: string): boolean {
  const documentTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/tiff",
  ];

  return documentTypes.some(type => mimeType.toLowerCase().includes(type.split("/")[1]));
}

/**
 * Manual filing - file attachment to specific destination
 */
export async function manualFileAttachment(
  filingId: number,
  destinationType: FilingDestinationType,
  destinationId: number,
  destinationPath: string,
  userId: number,
  options?: {
    googleAccessToken?: string;
  }
): Promise<FilingResult> {
  const filing = await db.getEmailAttachmentFilingById(filingId);
  if (!filing) {
    return {
      success: false,
      destinationType: "pending",
      documentCategory: "other",
      error: "Filing record not found",
    };
  }

  // Get attachment info
  const attachments = await db.getEmailAttachments(filing.emailId);
  const attachment = attachments.find(a => a.id === filing.attachmentId);
  if (!attachment) {
    return {
      success: false,
      destinationType: "pending",
      documentCategory: "other",
      error: "Attachment not found",
    };
  }

  // Update filing record
  await db.updateEmailAttachmentFiling(filingId, {
    destinationType: destinationType as any,
    destinationId,
    destinationPath,
    filingStatus: "processing",
    filedBy: userId,
    autoFiled: false,
  });

  // Perform the filing
  const classification: DocumentClassification = {
    category: filing.documentCategory as DocumentFilingCategory,
    confidence: parseFloat(filing.documentCategoryConfidence || "0.5"),
    suggestedFilingPath: destinationPath,
  };

  if (destinationType === "data_room") {
    const folderId = await ensureDataRoomFolderPath(destinationId, destinationPath);

    const result = await fileToDataRoom(
      filing.attachmentId,
      attachment.filename,
      attachment.storageUrl || "",
      attachment.storageKey || "",
      attachment.mimeType || "application/octet-stream",
      attachment.size || 0,
      destinationId,
      folderId,
      classification,
      userId
    );

    if (result.success) {
      await db.updateEmailAttachmentFiling(filingId, {
        dataRoomId: destinationId,
        dataRoomFolderId: folderId,
        dataRoomDocumentId: result.documentId,
        filingStatus: "filed",
        filedAt: new Date(),
      });
    } else {
      await db.updateEmailAttachmentFiling(filingId, {
        filingStatus: "failed",
        filingError: result.error,
      });
    }

    return {
      success: result.success,
      filingId,
      destinationType,
      destinationPath,
      documentCategory: filing.documentCategory as DocumentFilingCategory,
      dataRoomDocumentId: result.documentId,
      error: result.error,
    };
  } else if (destinationType === "google_drive" && options?.googleAccessToken) {
    const result = await fileToGoogleDrive(
      filing.attachmentId,
      attachment.filename,
      attachment.storageKey || "",
      attachment.mimeType || "application/octet-stream",
      destinationId.toString(), // Google Drive folder ID
      options.googleAccessToken
    );

    if (result.success) {
      await db.updateEmailAttachmentFiling(filingId, {
        googleDriveFileId: result.fileId,
        googleDriveFolderId: destinationId.toString(),
        googleDriveWebLink: result.webLink,
        filingStatus: "filed",
        filedAt: new Date(),
      });
    } else {
      await db.updateEmailAttachmentFiling(filingId, {
        filingStatus: "failed",
        filingError: result.error,
      });
    }

    return {
      success: result.success,
      filingId,
      destinationType,
      destinationPath,
      documentCategory: filing.documentCategory as DocumentFilingCategory,
      googleDriveFileId: result.fileId,
      error: result.error,
    };
  }

  return {
    success: false,
    filingId,
    destinationType,
    documentCategory: filing.documentCategory as DocumentFilingCategory,
    error: "Unsupported destination type",
  };
}
