import { invokeLLM } from "./llm";

// Types for parsed document data
export interface ParsedLineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  sku?: string;
}

export interface ParsedDocumentData {
  documentType: "receipt" | "invoice" | "purchase_order" | "bill_of_lading" | "packing_list" | "customs_document" | "freight_quote" | "shipping_label" | "other";
  confidence: number;
  
  // Vendor info
  vendorName?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorAddress?: string;
  
  // Document identifiers
  documentNumber?: string;
  documentDate?: string;
  dueDate?: string;
  
  // Financial data
  subtotal?: number;
  taxAmount?: number;
  shippingAmount?: number;
  totalAmount?: number;
  currency?: string;
  paymentMethod?: string;
  
  // Freight-specific
  trackingNumber?: string;
  carrierName?: string;
  shipmentDate?: string;
  deliveryDate?: string;
  origin?: string;
  destination?: string;
  weight?: string;
  dimensions?: string;
  
  // Line items
  lineItems?: ParsedLineItem[];
  
  // Raw extraction
  summary?: string;
  rawText?: string;
}

export interface EmailParseResult {
  success: boolean;
  documents: ParsedDocumentData[];
  error?: string;
}

/**
 * Parse email content using AI to extract structured document data
 */
export async function parseEmailContent(
  subject: string,
  bodyText: string,
  fromEmail: string,
  fromName?: string
): Promise<EmailParseResult> {
  try {
    const prompt = `You are an expert document parser for a business ERP system. Analyze the following email and extract any business documents (receipts, invoices, purchase orders, freight documents, etc.).

EMAIL DETAILS:
From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}
Subject: ${subject}

BODY:
${bodyText?.substring(0, 8000) || "(empty)"}

INSTRUCTIONS:
1. Identify ALL documents present in this email (there may be multiple)
2. For each document, extract as much structured data as possible
3. Determine the document type based on content
4. Extract vendor information, amounts, dates, line items, and tracking numbers
5. For freight documents, extract carrier, tracking, origin/destination
6. Assign a confidence score (0-100) based on how complete the extraction is

Return a JSON object with this exact structure:
{
  "documents": [
    {
      "documentType": "receipt|invoice|purchase_order|bill_of_lading|packing_list|customs_document|freight_quote|shipping_label|other",
      "confidence": 85,
      "vendorName": "Company Name",
      "vendorEmail": "email@vendor.com",
      "documentNumber": "INV-12345",
      "documentDate": "2025-01-10",
      "dueDate": "2025-02-10",
      "subtotal": 100.00,
      "taxAmount": 8.25,
      "shippingAmount": 15.00,
      "totalAmount": 123.25,
      "currency": "USD",
      "trackingNumber": "1Z999AA10123456784",
      "carrierName": "UPS",
      "lineItems": [
        {
          "description": "Product Name",
          "quantity": 2,
          "unit": "each",
          "unitPrice": 50.00,
          "totalPrice": 100.00,
          "sku": "SKU-123"
        }
      ],
      "summary": "Brief description of what this document is"
    }
  ]
}

If no business documents are found, return: {"documents": []}
Only include fields that have actual values - omit null/empty fields.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a document parsing AI that extracts structured data from business emails. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_parse_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              documents: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    documentType: { type: "string" },
                    confidence: { type: "number" },
                    vendorName: { type: "string" },
                    vendorEmail: { type: "string" },
                    vendorPhone: { type: "string" },
                    vendorAddress: { type: "string" },
                    documentNumber: { type: "string" },
                    documentDate: { type: "string" },
                    dueDate: { type: "string" },
                    subtotal: { type: "number" },
                    taxAmount: { type: "number" },
                    shippingAmount: { type: "number" },
                    totalAmount: { type: "number" },
                    currency: { type: "string" },
                    paymentMethod: { type: "string" },
                    trackingNumber: { type: "string" },
                    carrierName: { type: "string" },
                    shipmentDate: { type: "string" },
                    deliveryDate: { type: "string" },
                    origin: { type: "string" },
                    destination: { type: "string" },
                    weight: { type: "string" },
                    dimensions: { type: "string" },
                    lineItems: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          description: { type: "string" },
                          quantity: { type: "number" },
                          unit: { type: "string" },
                          unitPrice: { type: "number" },
                          totalPrice: { type: "number" },
                          sku: { type: "string" }
                        },
                        required: ["description"],
                        additionalProperties: false
                      }
                    },
                    summary: { type: "string" }
                  },
                  required: ["documentType", "confidence"],
                  additionalProperties: false
                }
              }
            },
            required: ["documents"],
            additionalProperties: false
          }
        }
      }
    });

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      return { success: false, documents: [], error: "No response from AI" };
    }

    const content = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
    const parsed = JSON.parse(content);
    return {
      success: true,
      documents: parsed.documents || []
    };
  } catch (error) {
    console.error("[EmailParser] Error parsing email:", error);
    return {
      success: false,
      documents: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Parse attachment content (extracted text from PDF/image)
 */
export async function parseAttachmentContent(
  filename: string,
  extractedText: string,
  mimeType?: string
): Promise<EmailParseResult> {
  try {
    const prompt = `You are an expert document parser for a business ERP system. Analyze the following document content extracted from an attachment.

FILENAME: ${filename}
TYPE: ${mimeType || "unknown"}

EXTRACTED TEXT:
${extractedText?.substring(0, 10000) || "(empty)"}

INSTRUCTIONS:
1. Identify the document type (receipt, invoice, PO, freight document, etc.)
2. Extract all structured data including vendor info, amounts, dates, line items
3. For receipts/invoices: focus on vendor, amounts, tax, items purchased
4. For freight docs: focus on tracking, carrier, origin/destination, weight
5. Assign a confidence score (0-100) based on extraction completeness

Return a JSON object with this exact structure:
{
  "documents": [
    {
      "documentType": "receipt|invoice|purchase_order|bill_of_lading|packing_list|customs_document|freight_quote|shipping_label|other",
      "confidence": 85,
      "vendorName": "Company Name",
      "vendorEmail": "email@vendor.com",
      "documentNumber": "INV-12345",
      "documentDate": "2025-01-10",
      "totalAmount": 123.25,
      "lineItems": [...],
      "summary": "Brief description"
    }
  ]
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a document parsing AI. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "attachment_parse_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              documents: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    documentType: { type: "string" },
                    confidence: { type: "number" },
                    vendorName: { type: "string" },
                    vendorEmail: { type: "string" },
                    documentNumber: { type: "string" },
                    documentDate: { type: "string" },
                    dueDate: { type: "string" },
                    subtotal: { type: "number" },
                    taxAmount: { type: "number" },
                    shippingAmount: { type: "number" },
                    totalAmount: { type: "number" },
                    currency: { type: "string" },
                    trackingNumber: { type: "string" },
                    carrierName: { type: "string" },
                    lineItems: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          description: { type: "string" },
                          quantity: { type: "number" },
                          unit: { type: "string" },
                          unitPrice: { type: "number" },
                          totalPrice: { type: "number" },
                          sku: { type: "string" }
                        },
                        required: ["description"],
                        additionalProperties: false
                      }
                    },
                    summary: { type: "string" }
                  },
                  required: ["documentType", "confidence"],
                  additionalProperties: false
                }
              }
            },
            required: ["documents"],
            additionalProperties: false
          }
        }
      }
    });

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      return { success: false, documents: [], error: "No response from AI" };
    }

    const content = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
    const parsed = JSON.parse(content);
    return {
      success: true,
      documents: parsed.documents || []
    };
  } catch (error) {
    console.error("[EmailParser] Error parsing attachment:", error);
    return {
      success: false,
      documents: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Match vendor name/email to existing vendors in the system
 */
export function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract email domain for vendor matching
 */
export function extractEmailDomain(email: string): string {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : "";
}
