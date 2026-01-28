import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

// PDF.js will be imported dynamically in the function to avoid worker issues

// Types for document import
export interface ImportedLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
  sku?: string;
  rawMaterialId?: number;
}

export interface ImportedPurchaseOrder {
  poNumber: string;
  vendorName: string;
  vendorEmail?: string;
  orderDate: string;
  deliveryDate?: string;
  status: "draft" | "sent" | "confirmed" | "shipped" | "received" | "completed";
  lineItems: ImportedLineItem[];
  subtotal: number;
  taxAmount?: number;
  shippingAmount?: number;
  totalAmount: number;
  currency?: string;
  notes?: string;
  confidence: number;
}

export interface ImportedFreightInvoice {
  invoiceNumber: string;
  carrierName: string;
  carrierEmail?: string;
  invoiceDate: string;
  shipmentDate?: string;
  deliveryDate?: string;
  origin?: string;
  destination?: string;
  trackingNumber?: string;
  weight?: string;
  dimensions?: string;
  freightCharges: number;
  fuelSurcharge?: number;
  accessorialCharges?: number;
  totalAmount: number;
  currency?: string;
  relatedPoNumber?: string;
  notes?: string;
  confidence: number;
}

export interface DocumentParseResult {
  success: boolean;
  documentType: "purchase_order" | "freight_invoice" | "unknown";
  purchaseOrder?: ImportedPurchaseOrder;
  freightInvoice?: ImportedFreightInvoice;
  rawText?: string;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  documentType: string;
  createdRecords: {
    type: string;
    id: number;
    name: string;
  }[];
  updatedRecords: {
    type: string;
    id: number;
    name: string;
    changes: string;
  }[];
  warnings: string[];
  error?: string;
}

/**
 * Parse uploaded document content (text extracted from PDF/Excel/CSV)
 */
export async function parseUploadedDocument(
  fileUrl: string,
  filename: string,
  documentHint?: "purchase_order" | "freight_invoice",
  mimeType?: string
): Promise<DocumentParseResult> {
  console.log("[DocumentImport] Starting parse for:", filename, "URL:", fileUrl, "mimeType:", mimeType);
  try {
    const prompt = `You are an expert document parser for a business ERP system. Analyze the attached document and extract structured data.

DOCUMENT FILENAME: ${filename}
DOCUMENT HINT: ${documentHint || "auto-detect"}

INSTRUCTIONS:
1. First, determine if this is a Purchase Order or a Freight Invoice
2. Extract all relevant structured data
3. For Purchase Orders: extract PO number, vendor info, line items with quantities/prices, dates, totals
4. For Freight Invoices: extract invoice number, carrier info, shipment details, charges breakdown
5. Match line item descriptions to common raw materials if possible
6. Assign a confidence score (0-100) based on extraction completeness

Return a JSON object with this structure:
{
  "documentType": "purchase_order" | "freight_invoice" | "unknown",
  "confidence": 85,
  "purchaseOrder": {
    "poNumber": "PO-12345",
    "vendorName": "Supplier Inc",
    "vendorEmail": "supplier@example.com",
    "orderDate": "2025-01-10",
    "deliveryDate": "2025-01-20",
    "status": "received",
    "lineItems": [
      {
        "description": "Coconut Oil",
        "quantity": 1000,
        "unit": "kg",
        "unitPrice": 2.50,
        "totalPrice": 2500.00,
        "sku": "CO-001"
      }
    ],
    "subtotal": 2500.00,
    "taxAmount": 200.00,
    "shippingAmount": 150.00,
    "totalAmount": 2850.00,
    "currency": "USD",
    "notes": "Any special notes"
  },
  "freightInvoice": {
    "invoiceNumber": "FI-98765",
    "carrierName": "FastFreight Logistics",
    "carrierEmail": "billing@fastfreight.com",
    "invoiceDate": "2025-01-15",
    "shipmentDate": "2025-01-10",
    "deliveryDate": "2025-01-14",
    "origin": "Los Angeles, CA",
    "destination": "Chicago, IL",
    "trackingNumber": "FF123456789",
    "weight": "5000 lbs",
    "dimensions": "48x40x48 in",
    "freightCharges": 1200.00,
    "fuelSurcharge": 180.00,
    "accessorialCharges": 75.00,
    "totalAmount": 1455.00,
    "currency": "USD",
    "relatedPoNumber": "PO-12345",
    "notes": "Liftgate delivery"
  }
}

Only include the relevant object (purchaseOrder OR freightInvoice) based on document type.
If document type is unknown, return both as null.`;

    // Determine file type
    const isImage = filename.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/i);
    const isPdf = filename.toLowerCase().endsWith('.pdf');
    const isCsv = filename.toLowerCase().endsWith('.csv');
    
    // Build the message content
    let messageContent: any[];
    
    if (isImage) {
      // For images, download and convert to base64 data URL
      try {
        console.log("[DocumentImport] Downloading image from:", fileUrl);
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const ext = filename.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/i)?.[1] || 'png';
        const mimeTypeMap: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp'
        };
        const imageMimeType = mimeTypeMap[ext] || 'image/png';
        const dataUrl = `data:${imageMimeType};base64,${base64}`;
        console.log("[DocumentImport] Converted image to base64 data URL, length:", dataUrl.length);
        messageContent = [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
        ];
      } catch (fetchError) {
        console.error("[DocumentImport] Failed to fetch/convert image:", fetchError);
        return { success: false, documentType: "unknown", error: "Failed to process image file" };
      }
    } else if (isPdf) {
      // For PDFs, extract text using pdfjs-dist (pure JavaScript, works everywhere including production)
      console.log("[DocumentImport] Extracting text from PDF using pdfjs-dist");
      try {
        // Download the PDF
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log("[DocumentImport] Downloaded PDF, size:", uint8Array.byteLength);
        
        // Use pdfjs-dist to extract text (pure JavaScript, no native dependencies)
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        console.log("[DocumentImport] PDF loaded, pages:", pdf.numPages);
        
        // Extract text from all pages
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        console.log("[DocumentImport] PDF text extracted, length:", fullText.length);
        
        // Use the extracted text for LLM analysis
        const pdfText = fullText.substring(0, 50000); // Limit to 50k chars
        messageContent = [
          { type: "text", text: `${prompt}\n\nEXTRACTED PDF TEXT:\n${pdfText}` }
        ];
        console.log("[DocumentImport] PDF text extracted successfully");
      } catch (pdfError) {
        console.error("[DocumentImport] Failed to extract PDF text:", pdfError);
        return { success: false, documentType: "unknown", error: `Failed to process PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}` };
      }
    } else {
      // For CSV/Excel/text files, download and extract text content
      try {
        console.log("[DocumentImport] Fetching document content from URL:", fileUrl);
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.status}`);
        }
        const textContent = await response.text();
        console.log("[DocumentImport] Extracted text content length:", textContent.length);
        messageContent = [
          { type: "text", text: `${prompt}\n\nDOCUMENT CONTENT:\n${textContent.substring(0, 50000)}` }
        ];
      } catch (fetchError) {
        console.error("[DocumentImport] Failed to fetch document:", fetchError);
        return { success: false, documentType: "unknown", error: "Failed to read document content" };
      }
    }
    
    console.log("[DocumentImport] Sending to LLM with content type:", isImage ? "image_url (base64)" : isPdf ? "text (extracted from PDF)" : "text");
    console.log("[DocumentImport] Message content structure:", JSON.stringify(messageContent.map((m: any) => ({ type: m.type, hasUrl: !!m.image_url?.url || !!m.file_url?.url }))));
    
    // For images only, we need to use a simpler approach without strict JSON schema
    // because some models don't support image_url with response_format
    // PDFs now use text extraction so they can use the full JSON schema
    const useSimpleFormat = isImage;
    console.log("[DocumentImport] Using simple format (no response_format):", useSimpleFormat);
    
    let response;
    response = await invokeLLM({
      messages: [
        { role: "system", content: useSimpleFormat 
          ? "You are a document parsing AI. Analyze the image and extract structured data. IMPORTANT: You MUST respond with ONLY valid JSON, no other text. The JSON must have this structure: {\"documentType\": \"purchase_order\" or \"freight_invoice\" or \"unknown\", \"confidence\": 0.0-1.0, \"purchaseOrder\": {...} or null, \"freightInvoice\": {...} or null}"
          : "You are a document parsing AI that extracts structured data from business documents. Always respond with valid JSON." },
        { 
          role: "user", 
          content: messageContent
        }
      ],
      // Only use response_format for non-image content
      // Some models don't support image_url with strict JSON schema
      ...(useSimpleFormat ? {} : {
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "document_parse_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                documentType: { type: "string", enum: ["purchase_order", "freight_invoice", "unknown"] },
                confidence: { type: "number" },
                purchaseOrder: {
                  type: ["object", "null"],
                  properties: {
                    poNumber: { type: "string" },
                    vendorName: { type: "string" },
                    vendorEmail: { type: "string" },
                    orderDate: { type: "string" },
                    deliveryDate: { type: "string" },
                    status: { type: "string" },
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
                        required: ["description", "quantity", "unitPrice", "totalPrice"],
                        additionalProperties: false
                      }
                    },
                    subtotal: { type: "number" },
                    taxAmount: { type: "number" },
                    shippingAmount: { type: "number" },
                    totalAmount: { type: "number" },
                    currency: { type: "string" },
                    notes: { type: "string" }
                  },
                  required: ["poNumber", "vendorName", "orderDate", "lineItems", "totalAmount"],
                  additionalProperties: false
                },
                freightInvoice: {
                  type: ["object", "null"],
                  properties: {
                    invoiceNumber: { type: "string" },
                    carrierName: { type: "string" },
                    carrierEmail: { type: "string" },
                    invoiceDate: { type: "string" },
                    shipmentDate: { type: "string" },
                    deliveryDate: { type: "string" },
                    origin: { type: "string" },
                    destination: { type: "string" },
                    trackingNumber: { type: "string" },
                    weight: { type: "string" },
                    dimensions: { type: "string" },
                    freightCharges: { type: "number" },
                    fuelSurcharge: { type: "number" },
                    accessorialCharges: { type: "number" },
                    totalAmount: { type: "number" },
                    currency: { type: "string" },
                    relatedPoNumber: { type: "string" },
                    notes: { type: "string" }
                  },
                  required: ["invoiceNumber", "carrierName", "invoiceDate", "totalAmount"],
                  additionalProperties: false
                }
              },
              required: ["documentType", "confidence"],
              additionalProperties: false
            }
          }
        }
      })
    });

    console.log("[DocumentImport] LLM response received:", JSON.stringify(response, null, 2).substring(0, 500));
    
    if (!response || !response.choices || response.choices.length === 0) {
      console.error("[DocumentImport] Invalid LLM response structure:", response);
      return { success: false, documentType: "unknown", error: "Invalid response from AI - no choices returned" };
    }
    
    const content_str = response.choices[0]?.message?.content;
    if (!content_str) {
      console.error("[DocumentImport] No content in LLM response:", response.choices[0]);
      return { success: false, documentType: "unknown", error: "No content in AI response" };
    }
    
    // Handle both string and array content
    let contentText: string;
    if (typeof content_str === 'string') {
      contentText = content_str;
    } else if (Array.isArray(content_str)) {
      // Extract text from content array
      const textPart = content_str.find((p: any) => p.type === 'text') as { type: string; text: string } | undefined;
      contentText = textPart?.text || JSON.stringify(content_str);
    } else {
      contentText = JSON.stringify(content_str);
    }
    
    console.log("[DocumentImport] Raw content:", contentText.substring(0, 300));
    
    // Strip markdown code blocks if present
    let jsonText = contentText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7); // Remove ```json
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3); // Remove ```
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3); // Remove trailing ```
    }
    jsonText = jsonText.trim();
    
    console.log("[DocumentImport] Cleaned JSON:", jsonText.substring(0, 500));
    const parsed = JSON.parse(jsonText);
    console.log("[DocumentImport] Parsed result:", JSON.stringify(parsed, null, 2).substring(0, 1000));
    
    return {
      success: true,
      documentType: parsed.documentType,
      purchaseOrder: parsed.purchaseOrder,
      freightInvoice: parsed.freightInvoice,
      rawText: `Document parsed from: ${fileUrl}`
    };
  } catch (error) {
    console.error("Document parse error:", error);
    return {
      success: false,
      documentType: "unknown",
      error: error instanceof Error ? error.message : "Unknown parsing error"
    };
  }
}

/**
 * Match line items to existing raw materials
 */
export async function matchLineItemsToMaterials(
  lineItems: ImportedLineItem[]
): Promise<ImportedLineItem[]> {
  const rawMaterials = await db.getRawMaterials();
  
  return lineItems.map(item => {
    // Try to match by description or SKU
    const match = rawMaterials.find(rm => {
      const descMatch = rm.name.toLowerCase().includes(item.description.toLowerCase()) ||
                       item.description.toLowerCase().includes(rm.name.toLowerCase());
      const skuMatch = item.sku && rm.sku && rm.sku.toLowerCase() === item.sku.toLowerCase();
      return descMatch || skuMatch;
    });
    
    return {
      ...item,
      rawMaterialId: match?.id
    };
  });
}

/**
 * Import a parsed purchase order into the system
 */
export async function importPurchaseOrder(
  po: ImportedPurchaseOrder,
  userId: number,
  markAsReceived: boolean = true
): Promise<ImportResult> {
  const createdRecords: ImportResult["createdRecords"] = [];
  const updatedRecords: ImportResult["updatedRecords"] = [];
  const warnings: string[] = [];

  try {
    // 1. Find or create vendor
    let vendor = await db.getVendorByName(po.vendorName);
    if (!vendor) {
      const vendorResult = await db.createVendor({
        name: po.vendorName,
        email: po.vendorEmail || "",
        type: "supplier",
        status: "active"
      });
      vendor = await db.getVendorById(vendorResult.id) || null;
      createdRecords.push({ type: "vendor", id: vendorResult.id, name: po.vendorName });
    }

    // 2. Match line items to raw materials
    const matchedItems = await matchLineItemsToMaterials(po.lineItems);
    
    // 3. Create raw materials for unmatched items
    for (const item of matchedItems) {
      if (!item.rawMaterialId) {
        const materialResult = await db.createRawMaterial({
          name: item.description,
          sku: item.sku || `RM-${Date.now()}`,
          unit: item.unit || "EA",
          unitCost: item.unitPrice.toString(),
          preferredVendorId: vendor!.id
        });
        item.rawMaterialId = materialResult.id;
        createdRecords.push({ type: "raw_material", id: materialResult.id, name: item.description });
      }
    }

    // 4. Create the purchase order
    const poResult = await db.createPurchaseOrder({
      poNumber: po.poNumber,
      vendorId: vendor!.id,
      status: markAsReceived ? "received" : "confirmed",
      orderDate: new Date(po.orderDate),
      expectedDate: po.deliveryDate ? new Date(po.deliveryDate) : undefined,
      subtotal: po.subtotal.toString(),
      totalAmount: po.totalAmount.toString(),
      notes: po.notes,
      createdBy: userId
    });
    createdRecords.push({ type: "purchase_order", id: poResult.id, name: po.poNumber });

    // 5. Create PO line items
    for (const item of matchedItems) {
      await db.createPurchaseOrderItem({
        purchaseOrderId: poResult.id,
        productId: null, // Raw material items don't have product IDs
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        totalAmount: item.totalPrice.toString()
      });
    }

    // 6. If marking as received, update inventory
    if (markAsReceived) {
      for (const item of matchedItems) {
        if (item.rawMaterialId) {
          // Get current stock and add received quantity
          const material = await db.getRawMaterialById(item.rawMaterialId);
          if (material) {
            const currentReceived = parseFloat(material.quantityReceived || '0');
            const newReceived = currentReceived + item.quantity;
            await db.updateRawMaterial(item.rawMaterialId, {
              quantityReceived: newReceived.toString(),
              lastReceivedDate: new Date(),
              lastReceivedQty: item.quantity.toString(),
              receivingStatus: 'received'
            } as any);
            updatedRecords.push({
              type: "raw_material",
              id: item.rawMaterialId,
              name: material.name,
              changes: `Received: +${item.quantity} (total received: ${newReceived})`
            });
          }
        }
      }
    }

    return {
      success: true,
      documentType: "purchase_order",
      createdRecords,
      updatedRecords,
      warnings
    };
  } catch (error) {
    return {
      success: false,
      documentType: "purchase_order",
      createdRecords,
      updatedRecords,
      warnings,
      error: error instanceof Error ? error.message : "Import failed"
    };
  }
}

/**
 * Import a parsed freight invoice into the system
 */
export async function importFreightInvoice(
  invoice: ImportedFreightInvoice,
  userId: number
): Promise<ImportResult> {
  const createdRecords: ImportResult["createdRecords"] = [];
  const updatedRecords: ImportResult["updatedRecords"] = [];
  const warnings: string[] = [];

  try {
    // 1. Find or create carrier as vendor
    let carrier = await db.getVendorByName(invoice.carrierName);
    if (!carrier) {
      const carrierResult = await db.createVendor({
        name: invoice.carrierName,
        email: invoice.carrierEmail || "",
        type: "service", // Use 'service' for carriers since 'carrier' is not a valid type
        status: "active"
      });
      carrier = await db.getVendorById(carrierResult.id) || null;
      createdRecords.push({ type: "vendor", id: carrierResult.id, name: invoice.carrierName });
    }

    // 2. Try to find related PO if specified
    let relatedPoId: number | undefined;
    if (invoice.relatedPoNumber) {
      const po = await db.findPurchaseOrderByNumber(invoice.relatedPoNumber);
      if (po) {
        relatedPoId = po.id;
      } else {
        warnings.push(`Related PO ${invoice.relatedPoNumber} not found`);
      }
    }

    // 3. Create freight history record
    const freightId = await db.createFreightHistory({
      invoiceNumber: invoice.invoiceNumber,
      carrierId: carrier!.id,
      invoiceDate: new Date(invoice.invoiceDate).getTime(),
      shipmentDate: invoice.shipmentDate ? new Date(invoice.shipmentDate).getTime() : undefined,
      deliveryDate: invoice.deliveryDate ? new Date(invoice.deliveryDate).getTime() : undefined,
      origin: invoice.origin,
      destination: invoice.destination,
      trackingNumber: invoice.trackingNumber,
      weight: invoice.weight,
      dimensions: invoice.dimensions,
      freightCharges: invoice.freightCharges.toString(),
      fuelSurcharge: invoice.fuelSurcharge?.toString(),
      accessorialCharges: invoice.accessorialCharges?.toString(),
      totalAmount: invoice.totalAmount.toString(),
      currency: invoice.currency || "USD",
      relatedPoId,
      notes: invoice.notes,
      createdBy: userId
    });
    createdRecords.push({ type: "freight_history", id: freightId, name: invoice.invoiceNumber });

    // 4. If related to a PO, update the PO with freight cost
    if (relatedPoId) {
      await db.updatePurchaseOrder(relatedPoId, { freightCost: invoice.totalAmount.toString() } as any);
      updatedRecords.push({
        type: "purchase_order",
        id: relatedPoId,
        name: invoice.relatedPoNumber!,
        changes: `Freight cost added: $${invoice.totalAmount}`
      });
    }

    return {
      success: true,
      documentType: "freight_invoice",
      createdRecords,
      updatedRecords,
      warnings
    };
  } catch (error) {
    return {
      success: false,
      documentType: "freight_invoice",
      createdRecords,
      updatedRecords,
      warnings,
      error: error instanceof Error ? error.message : "Import failed"
    };
  }
}

/**
 * Process multiple documents in bulk
 */
export async function bulkImportDocuments(
  documents: { content: string; filename: string; hint?: "purchase_order" | "freight_invoice" }[],
  userId: number,
  markPOsAsReceived: boolean = true
): Promise<{
  totalProcessed: number;
  successful: number;
  failed: number;
  results: ImportResult[];
}> {
  const results: ImportResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const doc of documents) {
    const parseResult = await parseUploadedDocument(doc.content, doc.filename, doc.hint);
    
    if (!parseResult.success) {
      results.push({
        success: false,
        documentType: "unknown",
        createdRecords: [],
        updatedRecords: [],
        warnings: [],
        error: parseResult.error || "Failed to parse document"
      });
      failed++;
      continue;
    }

    let importResult: ImportResult;
    
    if (parseResult.documentType === "purchase_order" && parseResult.purchaseOrder) {
      importResult = await importPurchaseOrder(parseResult.purchaseOrder, userId, markPOsAsReceived);
    } else if (parseResult.documentType === "freight_invoice" && parseResult.freightInvoice) {
      importResult = await importFreightInvoice(parseResult.freightInvoice, userId);
    } else {
      importResult = {
        success: false,
        documentType: parseResult.documentType,
        createdRecords: [],
        updatedRecords: [],
        warnings: [],
        error: "Unknown document type"
      };
    }

    results.push(importResult);
    if (importResult.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    totalProcessed: documents.length,
    successful,
    failed,
    results
  };
}
