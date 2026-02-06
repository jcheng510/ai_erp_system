/**
 * Supplier Invoice Automation Service
 *
 * Monitors inbound emails for supplier invoices. When detected:
 * 1. Matches the sender to a known vendor
 * 2. Parses the invoice and any attachments for shipping-related data
 * 3. Creates a supplier portal session for the vendor to submit shipping info
 * 4. Sends an automated email to the supplier requesting shipping details and customs docs
 * 5. Tracks the entire flow from detection through freight quote readiness
 */

import * as db from "./db";
import { nanoid } from "nanoid";
import { sendEmail, isEmailConfigured, formatEmailHtml } from "./_core/email";
import { ENV } from "./_core/env";
import {
  quickCategorize,
  parseEmailContent,
  parseAttachmentContent,
  type EmailParseResult,
  type ParsedDocumentData,
} from "./_core/emailParser";
import {
  scanInbox,
  getImapConfig,
  isImapConfigured,
  type ScannedEmail,
} from "./_core/emailInboxScanner";
import { invokeLLM } from "./_core/llm";

// ============================================
// Types
// ============================================

export interface AutomationProcessResult {
  processed: number;
  invoicesDetected: number;
  emailsSent: number;
  errors: string[];
  details: Array<{
    automationId: number;
    vendorEmail: string;
    invoiceNumber?: string;
    status: string;
    portalUrl?: string;
    error?: string;
  }>;
}

export interface ShippingDataFromAttachments {
  weight?: string;
  dimensions?: string;
  packageCount?: number;
  origin?: string;
  destination?: string;
  hsCodes?: string[];
  carrierName?: string;
  trackingNumber?: string;
  incoterms?: string;
  shippingMethod?: string;
  countryOfOrigin?: string;
  estimatedShipDate?: string;
  dangerousGoods?: boolean;
  specialInstructions?: string;
  confidence: number;
}

// ============================================
// Core Processing Pipeline
// ============================================

/**
 * Main entry point: scan inbox and process any supplier invoices found.
 * Called on a schedule or manually triggered.
 */
export async function processInboundInvoices(): Promise<AutomationProcessResult> {
  const result: AutomationProcessResult = {
    processed: 0,
    invoicesDetected: 0,
    emailsSent: 0,
    errors: [],
    details: [],
  };

  // Check prerequisites
  if (!isImapConfigured()) {
    result.errors.push("IMAP not configured - cannot scan inbox");
    return result;
  }

  if (!isEmailConfigured()) {
    result.errors.push("SendGrid not configured - cannot send request emails");
    return result;
  }

  const imapConfig = getImapConfig();
  if (!imapConfig) {
    result.errors.push("Failed to get IMAP configuration");
    return result;
  }

  try {
    // Scan inbox for unseen emails
    const scanResult = await scanInbox(imapConfig, {
      unseenOnly: true,
      limit: 30,
      markAsSeen: false,
    });

    if (!scanResult.success) {
      result.errors.push(...scanResult.errors);
      return result;
    }

    result.processed = scanResult.processedEmails.length;

    // Filter for likely invoices using quick categorization
    const invoiceEmails = scanResult.processedEmails.filter(
      (email) =>
        email.categorization?.category === "invoice" &&
        (email.categorization?.confidence ?? 0) >= 60
    );

    result.invoicesDetected = invoiceEmails.length;

    // Process each invoice email
    for (const email of invoiceEmails) {
      try {
        const detail = await processInvoiceEmail(email);
        result.details.push(detail);
        if (detail.status === "email_sent") {
          result.emailsSent++;
        }
      } catch (error: any) {
        const errMsg = `Error processing email from ${email.from.address}: ${error.message}`;
        result.errors.push(errMsg);
        result.details.push({
          automationId: 0,
          vendorEmail: email.from.address,
          status: "failed",
          error: errMsg,
        });
      }
    }
  } catch (error: any) {
    result.errors.push(`Inbox scan failed: ${error.message}`);
  }

  return result;
}

/**
 * Process a single invoice email through the automation pipeline
 */
async function processInvoiceEmail(email: ScannedEmail): Promise<{
  automationId: number;
  vendorEmail: string;
  invoiceNumber?: string;
  status: string;
  portalUrl?: string;
  error?: string;
}> {
  const vendorEmail = email.from.address;
  const vendorName = email.from.name || vendorEmail;

  // Step 1: Check for duplicate processing
  const existingByEmail = await db.getInboundEmails({ limit: 1 });
  // We'll check by messageId to avoid reprocessing
  const existingAutomations = await db.getSupplierInvoiceAutomations({
    limit: 100,
  });
  const alreadyProcessed = existingAutomations.some(
    (a) =>
      a.fromEmail === vendorEmail &&
      a.invoiceSubject === email.subject &&
      a.status !== "failed"
  );
  if (alreadyProcessed) {
    return {
      automationId: 0,
      vendorEmail,
      status: "skipped",
      error: "Already processed this invoice email",
    };
  }

  // Step 2: Create automation record
  const automation = await db.createSupplierInvoiceAutomation({
    fromEmail: vendorEmail,
    fromName: vendorName,
    invoiceSubject: email.subject,
    status: "detected" as any,
  });
  const automationId = automation.id;

  // Step 3: Parse the email with AI for structured invoice data
  let parseResult: EmailParseResult | null = null;
  try {
    parseResult = await parseEmailContent(
      email.subject,
      email.bodyText,
      vendorEmail,
      email.from.name
    );
  } catch (error: any) {
    console.error(
      `[InvoiceAutomation] AI parsing failed for automation ${automationId}:`,
      error.message
    );
  }

  // Extract invoice details from parsed data
  const invoiceDoc = parseResult?.documents?.find(
    (d) => d.documentType === "invoice"
  );
  if (invoiceDoc) {
    await db.updateSupplierInvoiceAutomation(automationId, {
      invoiceNumber: invoiceDoc.documentNumber,
      invoiceDate: invoiceDoc.documentDate,
      invoiceTotal: invoiceDoc.totalAmount?.toString(),
      currency: invoiceDoc.currency || "USD",
      lineItemsSummary: invoiceDoc.lineItems
        ? JSON.stringify(invoiceDoc.lineItems)
        : undefined,
      aiConfidence: parseResult?.categorization?.confidence?.toString(),
    });
  }

  // Step 4: Match to known vendor
  const vendors = await db.getVendors();
  const matchedVendor = vendors.find(
    (v) =>
      v.email?.toLowerCase() === vendorEmail.toLowerCase() ||
      (invoiceDoc?.vendorName &&
        v.name.toLowerCase().includes(invoiceDoc.vendorName.toLowerCase()))
  );

  if (matchedVendor) {
    await db.updateSupplierInvoiceAutomation(automationId, {
      vendorId: matchedVendor.id,
      vendorName: matchedVendor.name,
      status: "vendor_matched" as any,
    });
  } else {
    await db.updateSupplierInvoiceAutomation(automationId, {
      vendorName: invoiceDoc?.vendorName || vendorName,
      status: "vendor_matched" as any,
    });
  }

  // Step 5: Try to match a purchase order
  let matchedPo: any = null;
  if (invoiceDoc?.documentNumber) {
    const pos = await db.getPurchaseOrders();
    matchedPo = pos.find(
      (po) =>
        (matchedVendor && po.vendorId === matchedVendor.id) ||
        po.poNumber === invoiceDoc.documentNumber
    );
    if (matchedPo) {
      await db.updateSupplierInvoiceAutomation(automationId, {
        purchaseOrderId: matchedPo.id,
        poNumber: matchedPo.poNumber,
      });
    }
  }

  // Step 6: Parse attachments for shipping data
  let shippingData: ShippingDataFromAttachments | null = null;
  if (email.attachments.length > 0) {
    shippingData = await extractShippingDataFromAttachments(email);
    if (shippingData && shippingData.confidence > 30) {
      await db.updateSupplierInvoiceAutomation(automationId, {
        attachmentsParsed: true,
        parsedShippingData: JSON.stringify(shippingData),
      });
    }
  }

  // Step 7: Create supplier portal session
  const portalToken = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14); // 14-day expiry

  // Use matched PO or create a placeholder reference
  const purchaseOrderId = matchedPo?.id || 0;

  let portalSessionId: number | undefined;
  if (purchaseOrderId > 0) {
    const session = await db.createSupplierPortalSession({
      token: portalToken,
      purchaseOrderId,
      vendorId: matchedVendor?.id || 0,
      vendorEmail: vendorEmail,
      expiresAt,
    });
    portalSessionId = session.id;
  }

  await db.updateSupplierInvoiceAutomation(automationId, {
    portalSessionId: portalSessionId,
    portalToken,
    status: "portal_created" as any,
  });

  // Step 8: Build and send the request email
  const portalUrl = `${ENV.publicAppUrl}/supplier-shipping/${portalToken}`;
  const emailBody = buildShippingRequestEmail({
    vendorName: matchedVendor?.name || invoiceDoc?.vendorName || vendorName,
    invoiceNumber: invoiceDoc?.documentNumber || "your recent invoice",
    poNumber: matchedPo?.poNumber,
    portalUrl,
    hasPartialShippingData: shippingData !== null && shippingData.confidence > 30,
    parsedShippingData: shippingData,
  });

  const emailResult = await sendEmail({
    to: vendorEmail,
    subject: `Shipping Information Required - ${invoiceDoc?.documentNumber || email.subject}`,
    html: emailBody,
  });

  if (emailResult.success) {
    // Record the sent email
    const sentRecord = await db.createSentEmail({
      toEmail: vendorEmail,
      toName: matchedVendor?.name || vendorName,
      fromEmail: ENV.sendgridFromEmail,
      fromName: "ERP Shipping Automation",
      subject: `Shipping Information Required - ${invoiceDoc?.documentNumber || email.subject}`,
      bodyHtml: emailBody,
      status: "sent",
      relatedEntityType: "supplier_invoice_automation",
      relatedEntityId: automationId,
      aiGenerated: true,
    });

    await db.updateSupplierInvoiceAutomation(automationId, {
      sentEmailId: sentRecord.id,
      status: "email_sent" as any,
    });

    return {
      automationId,
      vendorEmail,
      invoiceNumber: invoiceDoc?.documentNumber,
      status: "email_sent",
      portalUrl,
    };
  } else {
    await db.updateSupplierInvoiceAutomation(automationId, {
      status: "failed" as any,
      errorMessage: `Failed to send email: ${emailResult.error}`,
    });

    return {
      automationId,
      vendorEmail,
      invoiceNumber: invoiceDoc?.documentNumber,
      status: "failed",
      error: emailResult.error,
    };
  }
}

/**
 * Process a single pre-existing inbound email record through the automation.
 * Used when processing emails that were already scanned and stored.
 */
export async function processStoredInboundEmail(emailId: number): Promise<{
  automationId: number;
  status: string;
  portalUrl?: string;
  error?: string;
}> {
  const email = await db.getInboundEmailById(emailId);
  if (!email) {
    return { automationId: 0, status: "failed", error: "Email not found" };
  }

  // Check if already processed
  const existing = await db.getSupplierInvoiceAutomationByEmailId(emailId);
  if (existing) {
    return {
      automationId: existing.id,
      status: "skipped",
      error: "Already processed",
    };
  }

  // Create a ScannedEmail-compatible object
  const scannedEmail: ScannedEmail = {
    uid: emailId,
    messageId: email.messageId || `stored-${emailId}`,
    from: {
      address: email.fromEmail,
      name: email.fromName || undefined,
    },
    to: [email.toEmail],
    subject: email.subject || "(No subject)",
    date: new Date(email.receivedAt),
    bodyText: email.bodyText || "",
    bodyHtml: email.bodyHtml || undefined,
    attachments: [],
    flags: [],
    categorization: {
      category: (email.category as any) || "invoice",
      confidence: parseFloat(email.categoryConfidence?.toString() || "75"),
      keywords: [],
      priority: (email.priority as any) || "high",
    },
  };

  const detail = await processInvoiceEmail(scannedEmail);

  // Update the automation with the inbound email reference
  if (detail.automationId > 0) {
    await db.updateSupplierInvoiceAutomation(detail.automationId, {
      inboundEmailId: emailId,
    });
  }

  return detail;
}

// ============================================
// Attachment Parsing for Shipping Data
// ============================================

/**
 * Extract shipping-related data from email attachments using AI
 */
async function extractShippingDataFromAttachments(
  email: ScannedEmail
): Promise<ShippingDataFromAttachments | null> {
  if (!email.attachments || email.attachments.length === 0) {
    return null;
  }

  // Build a description of attachments for AI analysis
  const attachmentInfo = email.attachments
    .map(
      (a) =>
        `- ${a.filename} (${a.contentType}, ${Math.round(a.size / 1024)}KB)`
    )
    .join("\n");

  try {
    const prompt = `Analyze this invoice email and its attachments to extract any shipping/freight information that would be needed to obtain a freight quote.

EMAIL SUBJECT: ${email.subject}
FROM: ${email.from.name || email.from.address}

EMAIL BODY (first 4000 chars):
${email.bodyText?.substring(0, 4000) || "(empty)"}

ATTACHMENTS:
${attachmentInfo}

Extract any of the following shipping data that is mentioned or implied:
- Package weight (gross and net)
- Package dimensions (L x W x H)
- Number of packages/pallets
- Origin address/country
- Destination address/country
- HS codes for customs
- Preferred carrier or shipping method
- Tracking numbers
- Incoterms (FOB, CIF, DDP, etc.)
- Country of origin for customs
- Estimated ship date
- Dangerous goods indicators
- Special handling instructions

Return JSON with this structure:
{
  "weight": "weight with unit e.g. 500 kg",
  "dimensions": "dimensions e.g. 120x80x100 cm",
  "packageCount": 5,
  "origin": "city, country",
  "destination": "city, country",
  "hsCodes": ["8471.30", "8473.30"],
  "carrierName": "carrier if mentioned",
  "trackingNumber": "tracking if mentioned",
  "incoterms": "FOB/CIF/DDP etc",
  "shippingMethod": "air/sea/ground",
  "countryOfOrigin": "country",
  "estimatedShipDate": "YYYY-MM-DD",
  "dangerousGoods": false,
  "specialInstructions": "any special notes",
  "confidence": 65
}

Only include fields that have actual values found in the email. Set confidence based on how much shipping data you were able to extract (0-100).`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a shipping document analysis AI. Extract freight/shipping data from email content. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "shipping_data_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              weight: { type: "string" },
              dimensions: { type: "string" },
              packageCount: { type: "number" },
              origin: { type: "string" },
              destination: { type: "string" },
              hsCodes: { type: "array", items: { type: "string" } },
              carrierName: { type: "string" },
              trackingNumber: { type: "string" },
              incoterms: { type: "string" },
              shippingMethod: { type: "string" },
              countryOfOrigin: { type: "string" },
              estimatedShipDate: { type: "string" },
              dangerousGoods: { type: "boolean" },
              specialInstructions: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed =
      typeof content === "string" ? JSON.parse(content) : content;
    return parsed as ShippingDataFromAttachments;
  } catch (error) {
    console.error(
      "[InvoiceAutomation] Failed to extract shipping data from attachments:",
      error
    );
    return null;
  }
}

// ============================================
// Email Template Builder
// ============================================

/**
 * Build the HTML email requesting shipping info from the supplier
 */
function buildShippingRequestEmail(params: {
  vendorName: string;
  invoiceNumber: string;
  poNumber?: string;
  portalUrl: string;
  hasPartialShippingData: boolean;
  parsedShippingData?: ShippingDataFromAttachments | null;
}): string {
  const {
    vendorName,
    invoiceNumber,
    poNumber,
    portalUrl,
    hasPartialShippingData,
    parsedShippingData,
  } = params;

  let parsedDataSection = "";
  if (hasPartialShippingData && parsedShippingData) {
    const items: string[] = [];
    if (parsedShippingData.weight)
      items.push(`<li>Weight: ${parsedShippingData.weight}</li>`);
    if (parsedShippingData.dimensions)
      items.push(`<li>Dimensions: ${parsedShippingData.dimensions}</li>`);
    if (parsedShippingData.packageCount)
      items.push(`<li>Packages: ${parsedShippingData.packageCount}</li>`);
    if (parsedShippingData.origin)
      items.push(`<li>Origin: ${parsedShippingData.origin}</li>`);
    if (parsedShippingData.hsCodes?.length)
      items.push(
        `<li>HS Codes: ${parsedShippingData.hsCodes.join(", ")}</li>`
      );
    if (parsedShippingData.incoterms)
      items.push(`<li>Incoterms: ${parsedShippingData.incoterms}</li>`);

    if (items.length > 0) {
      parsedDataSection = `
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #0369a1;">
            We extracted the following from your invoice:
          </p>
          <ul style="margin: 0; padding-left: 20px; color: #334155;">
            ${items.join("\n            ")}
          </ul>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;">
            Please verify and complete the remaining fields using the link below.
          </p>
        </div>`;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Shipping Information Request</h2>
    </div>

    <p>Dear ${vendorName},</p>

    <p>
      Thank you for sending invoice <strong>${invoiceNumber}</strong>${poNumber ? ` (PO: ${poNumber})` : ""}.
      To arrange freight and customs clearance, we need the following shipping details for this order:
    </p>

    <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">Required Information:</p>
      <ul style="margin: 0; padding-left: 20px; color: #78350f;">
        <li>Total number of packages and pallet configuration</li>
        <li>Gross and net weight of shipment</li>
        <li>Package dimensions (L x W x H per package)</li>
        <li>HS/tariff codes for each product</li>
        <li>Country of origin</li>
        <li>Preferred ship date</li>
        <li>Dangerous goods classification (if applicable)</li>
      </ul>
    </div>

    <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">Required Documents:</p>
      <ul style="margin: 0; padding-left: 20px; color: #78350f;">
        <li>Commercial Invoice</li>
        <li>Packing List</li>
        <li>Certificate of Origin</li>
        <li>MSDS/SDS (if applicable)</li>
        <li>Any export permits or licenses</li>
      </ul>
    </div>

    ${parsedDataSection}

    <div style="text-align: center; margin: 28px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
        Submit Shipping Information
      </a>
    </div>

    <p style="font-size: 13px; color: #64748b; text-align: center;">
      You can also reply to this email with the documents attached, and we will process them automatically.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

    <p style="font-size: 13px; color: #94a3b8;">
      This is an automated message from our procurement system. The portal link expires in 14 days.
      If you have questions, please reply to this email.
    </p>
  </div>
</body>
</html>`.trim();
}

// ============================================
// Supplier Response Processing
// ============================================

/**
 * Called when a supplier submits shipping info via the portal.
 * Updates the automation status and checks if we have enough data for a freight quote.
 */
export async function handleSupplierPortalSubmission(
  portalToken: string
): Promise<{
  success: boolean;
  automationId?: number;
  readyForQuote: boolean;
  missingFields: string[];
}> {
  const automation =
    await db.getSupplierInvoiceAutomationByToken(portalToken);
  if (!automation) {
    return {
      success: false,
      readyForQuote: false,
      missingFields: [],
    };
  }

  // Check what freight info has been submitted
  let freightInfo: any = null;
  if (automation.purchaseOrderId) {
    freightInfo = await db.getSupplierFreightInfo(automation.purchaseOrderId);
  }

  // Check what documents have been uploaded
  const documents = automation.portalSessionId
    ? await db.getSupplierDocuments({
        portalSessionId: automation.portalSessionId,
      })
    : [];

  // Determine what's missing for a freight quote
  const missingFields: string[] = [];

  if (!freightInfo?.totalGrossWeight) missingFields.push("Gross weight");
  if (!freightInfo?.totalPackages) missingFields.push("Package count");
  if (!freightInfo?.packageDimensions) missingFields.push("Package dimensions");
  if (!freightInfo?.hsCodes) missingFields.push("HS codes");

  const hasCommercialInvoice = documents.some(
    (d) => d.documentType === "commercial_invoice"
  );
  const hasPackingList = documents.some(
    (d) => d.documentType === "packing_list"
  );

  if (!hasCommercialInvoice) missingFields.push("Commercial invoice");
  if (!hasPackingList) missingFields.push("Packing list");

  const readyForQuote = missingFields.length === 0;
  const newStatus = readyForQuote ? "info_complete" : "supplier_responded";

  await db.updateSupplierInvoiceAutomation(automation.id, {
    status: newStatus as any,
    processingNotes: readyForQuote
      ? "All required shipping info received"
      : `Missing: ${missingFields.join(", ")}`,
  });

  return {
    success: true,
    automationId: automation.id,
    readyForQuote,
    missingFields,
  };
}

/**
 * Process a supplier reply email that contains shipping docs/info as attachments.
 * Called when an inbound email is detected as a reply to a shipping info request.
 */
export async function processSupplierReplyWithAttachments(
  inboundEmailId: number
): Promise<{
  success: boolean;
  automationId?: number;
  extractedData?: ShippingDataFromAttachments;
  error?: string;
}> {
  const email = await db.getInboundEmailById(inboundEmailId);
  if (!email) {
    return { success: false, error: "Email not found" };
  }

  // Find the related automation by sender email
  const automations = await db.getSupplierInvoiceAutomations({
    status: "email_sent",
    limit: 100,
  });
  const relatedAutomation = automations.find(
    (a) => a.fromEmail.toLowerCase() === email.fromEmail.toLowerCase()
  );

  if (!relatedAutomation) {
    return {
      success: false,
      error: "No matching automation found for this sender",
    };
  }

  // Get attachments for this email
  const attachments = await db.getEmailAttachments(inboundEmailId);

  // Parse attachment content for shipping data
  let extractedData: ShippingDataFromAttachments | null = null;
  for (const attachment of attachments) {
    if (attachment.extractedText) {
      try {
        const parsed = await parseAttachmentContent(
          attachment.filename,
          attachment.extractedText,
          attachment.mimeType || undefined
        );

        // Look for shipping-relevant documents
        for (const doc of parsed.documents) {
          if (
            doc.documentType === "packing_list" ||
            doc.documentType === "bill_of_lading" ||
            doc.documentType === "customs_document"
          ) {
            extractedData = {
              weight: doc.weight || extractedData?.weight,
              dimensions: doc.dimensions || extractedData?.dimensions,
              origin: doc.origin || extractedData?.origin,
              destination: doc.destination || extractedData?.destination,
              carrierName: doc.carrierName || extractedData?.carrierName,
              trackingNumber:
                doc.trackingNumber || extractedData?.trackingNumber,
              confidence: Math.max(
                doc.confidence,
                extractedData?.confidence || 0
              ),
            };
          }
        }
      } catch (error) {
        console.error(
          `[InvoiceAutomation] Failed to parse attachment ${attachment.filename}:`,
          error
        );
      }
    }
  }

  // Update automation with extracted data
  if (extractedData) {
    await db.updateSupplierInvoiceAutomation(relatedAutomation.id, {
      attachmentsParsed: true,
      parsedShippingData: JSON.stringify(extractedData),
      status: "supplier_responded" as any,
      processingNotes: `Extracted shipping data from reply attachments (confidence: ${extractedData.confidence}%)`,
    });

    // If we have a portal session, also save as freight info
    if (
      relatedAutomation.purchaseOrderId &&
      relatedAutomation.purchaseOrderId > 0
    ) {
      const existingFreight = await db.getSupplierFreightInfo(
        relatedAutomation.purchaseOrderId
      );
      const freightData: any = {};
      if (extractedData.weight)
        freightData.totalGrossWeight = extractedData.weight;
      if (extractedData.packageCount)
        freightData.totalPackages = extractedData.packageCount;
      if (extractedData.dimensions)
        freightData.packageDimensions = JSON.stringify([
          { dimensions: extractedData.dimensions },
        ]);
      if (extractedData.hsCodes)
        freightData.hsCodes = JSON.stringify(extractedData.hsCodes);
      if (extractedData.incoterms)
        freightData.incoterms = extractedData.incoterms;
      if (extractedData.dangerousGoods !== undefined)
        freightData.hasDangerousGoods = extractedData.dangerousGoods;
      if (extractedData.specialInstructions)
        freightData.specialInstructions = extractedData.specialInstructions;

      if (existingFreight) {
        await db.updateSupplierFreightInfo(existingFreight.id, freightData);
      } else if (relatedAutomation.portalSessionId) {
        await db.createSupplierFreightInfo({
          portalSessionId: relatedAutomation.portalSessionId,
          purchaseOrderId: relatedAutomation.purchaseOrderId,
          vendorId: relatedAutomation.vendorId || 0,
          ...freightData,
        });
      }
    }
  } else {
    await db.updateSupplierInvoiceAutomation(relatedAutomation.id, {
      status: "supplier_responded" as any,
      processingNotes:
        "Reply received but no shipping data could be extracted from attachments",
    });
  }

  return {
    success: true,
    automationId: relatedAutomation.id,
    extractedData: extractedData || undefined,
  };
}
