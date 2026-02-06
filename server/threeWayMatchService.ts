import { eq, and, sql, desc, sum } from "drizzle-orm";
import { getDb } from "./db";
import {
  threeWayMatches, threeWayMatchLines,
  purchaseOrders, purchaseOrderItems,
  poReceivingRecords, poReceivingItems,
  invoices, parsedDocuments, parsedDocumentLineItems,
} from "../drizzle/schema";

// ============================================
// THREE-WAY MATCH AUTOMATION
// PO ↔ Goods Receipt ↔ Vendor Invoice
// ============================================

const DEFAULT_TOLERANCE_PERCENT = 2.0; // 2% variance tolerance

/**
 * Create a three-way match for a purchase order.
 * Pulls data from PO, receiving records, and any parsed vendor invoice linked to that PO.
 */
export async function createThreeWayMatch(params: {
  purchaseOrderId: number;
  receivingRecordId?: number;
  vendorInvoiceId?: number; // parsedDocuments id
  tolerancePercent?: number;
  createdBy?: number;
}): Promise<{ id: number; status: string; discrepancies: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tolerance = params.tolerancePercent ?? DEFAULT_TOLERANCE_PERCENT;
  const discrepancies: string[] = [];

  // 1. Get PO data
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.purchaseOrderId)).limit(1);
  if (!po) throw new Error("Purchase order not found");

  const poItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));

  const poTotalQty = poItems.reduce((s, i) => s + parseFloat(i.quantity || "0"), 0);
  const poTotalAmt = parseFloat(po.totalAmount || "0");

  // 2. Get receipt data
  let receiptTotalQty = 0;
  let receiptRecordId = params.receivingRecordId;
  let receiptItems: Array<typeof poReceivingItems.$inferSelect> = [];

  if (receiptRecordId) {
    receiptItems = await db.select().from(poReceivingItems).where(eq(poReceivingItems.receivingRecordId, receiptRecordId));
    receiptTotalQty = receiptItems.reduce((s, i) => s + parseFloat(i.receivedQuantity || "0"), 0);
  } else {
    // Find receiving records for this PO
    const records = await db.select().from(poReceivingRecords).where(eq(poReceivingRecords.purchaseOrderId, po.id));
    if (records.length > 0) {
      receiptRecordId = records[0].id;
      for (const rec of records) {
        const items = await db.select().from(poReceivingItems).where(eq(poReceivingItems.receivingRecordId, rec.id));
        receiptItems.push(...items);
        receiptTotalQty += items.reduce((s, i) => s + parseFloat(i.receivedQuantity || "0"), 0);
      }
    }
  }

  // 3. Get vendor invoice data
  let invoiceAmt = 0;
  let vendorInvoiceId = params.vendorInvoiceId;

  if (vendorInvoiceId) {
    const [doc] = await db.select().from(parsedDocuments).where(eq(parsedDocuments.id, vendorInvoiceId)).limit(1);
    if (doc) {
      invoiceAmt = parseFloat(doc.totalAmount || "0");
    }
  }

  // 4. Calculate variances
  const quantityVariance = receiptTotalQty - poTotalQty;
  const amountVariance = invoiceAmt > 0 ? invoiceAmt - poTotalAmt : 0;
  const variancePercent = poTotalAmt > 0 && invoiceAmt > 0
    ? Math.abs(amountVariance / poTotalAmt) * 100
    : 0;

  // 5. Check discrepancies
  if (Math.abs(quantityVariance) > 0 && poTotalQty > 0) {
    const qtyVariancePct = Math.abs(quantityVariance / poTotalQty) * 100;
    if (qtyVariancePct > tolerance) {
      discrepancies.push(`Quantity variance: PO ${poTotalQty} vs Received ${receiptTotalQty} (${qtyVariancePct.toFixed(1)}%)`);
    }
  }

  if (invoiceAmt > 0 && Math.abs(amountVariance) > 0.01) {
    if (variancePercent > tolerance) {
      discrepancies.push(`Amount variance: PO $${poTotalAmt.toFixed(2)} vs Invoice $${invoiceAmt.toFixed(2)} (${variancePercent.toFixed(1)}%)`);
    }
  }

  // Missing components
  if (!receiptRecordId && !receiptTotalQty) {
    discrepancies.push("No goods receipt recorded for this PO");
  }
  if (!vendorInvoiceId && invoiceAmt === 0) {
    discrepancies.push("No vendor invoice linked to this PO");
  }

  const autoApproved = discrepancies.length === 0 && receiptTotalQty > 0 && invoiceAmt > 0;
  const status = autoApproved ? "matched" : discrepancies.length > 0 ? "discrepancy" : "pending";

  const matchNumber = `TWM-${Date.now().toString(36).toUpperCase()}`;

  const [match] = await db.insert(threeWayMatches).values({
    matchNumber,
    purchaseOrderId: po.id,
    receivingRecordId: receiptRecordId,
    vendorInvoiceId,
    vendorId: po.vendorId,
    status,
    poQuantity: poTotalQty.toFixed(4),
    poAmount: poTotalAmt.toFixed(2),
    receiptQuantity: receiptTotalQty.toFixed(4),
    invoiceAmount: invoiceAmt > 0 ? invoiceAmt.toFixed(2) : null,
    quantityVariance: quantityVariance.toFixed(4),
    amountVariance: amountVariance.toFixed(2),
    variancePercent: variancePercent.toFixed(2),
    tolerancePercent: tolerance.toFixed(2),
    autoApproved,
  }).$returningId();

  // Create line-level details
  for (const poItem of poItems) {
    // Find matching receipt item
    const matchingReceipt = receiptItems.find(ri =>
      ri.purchaseOrderItemId === poItem.id || ri.productId === poItem.productId
    );

    await db.insert(threeWayMatchLines).values({
      matchId: match.id,
      poItemId: poItem.id,
      receivingItemId: matchingReceipt?.id,
      description: poItem.description ?? undefined,
      poQuantity: poItem.quantity,
      poUnitPrice: poItem.unitPrice,
      poLineTotal: poItem.totalAmount,
      receiptQuantity: matchingReceipt?.receivedQuantity,
      quantityMatch: matchingReceipt
        ? Math.abs(parseFloat(poItem.quantity) - parseFloat(matchingReceipt.receivedQuantity)) < 0.01
        : false,
      priceMatch: true, // Price match checked at header level for now
    });
  }

  return { id: match.id, status, discrepancies };
}

/**
 * List all three-way matches
 */
export async function getThreeWayMatches(filters?: { status?: string; vendorId?: number; companyId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) conditions.push(eq(threeWayMatches.status, filters.status as any));
  if (filters?.vendorId) conditions.push(eq(threeWayMatches.vendorId, filters.vendorId));
  if (filters?.companyId) conditions.push(eq(threeWayMatches.companyId, filters.companyId));

  if (conditions.length > 0) {
    return db.select().from(threeWayMatches).where(and(...conditions)).orderBy(desc(threeWayMatches.createdAt));
  }
  return db.select().from(threeWayMatches).orderBy(desc(threeWayMatches.createdAt));
}

/**
 * Get a single match with line details
 */
export async function getThreeWayMatchDetail(matchId: number) {
  const db = await getDb();
  if (!db) return null;

  const [match] = await db.select().from(threeWayMatches).where(eq(threeWayMatches.id, matchId)).limit(1);
  if (!match) return null;

  const lines = await db.select().from(threeWayMatchLines).where(eq(threeWayMatchLines.matchId, matchId));

  return { ...match, lines };
}

/**
 * Resolve a discrepancy (approve or reject)
 */
export async function resolveThreeWayMatch(matchId: number, params: {
  action: "approve" | "reject";
  resolvedBy: number;
  notes?: string;
}): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };

  await db.update(threeWayMatches).set({
    status: params.action === "approve" ? "approved" : "rejected",
    resolvedBy: params.resolvedBy,
    resolvedAt: new Date(),
    resolutionNotes: params.notes,
  }).where(eq(threeWayMatches.id, matchId));

  return { success: true };
}

/**
 * Auto-run three-way match for all POs that have receiving records.
 * Called by the scheduler.
 */
export async function runAutoThreeWayMatch(): Promise<{ matched: number; discrepancies: number; errors: string[] }> {
  const db = await getDb();
  if (!db) return { matched: 0, discrepancies: 0, errors: ["Database not available"] };

  let matched = 0;
  let discrepancyCount = 0;
  const errors: string[] = [];

  // Find POs with receiving records that don't already have a match
  const receivedPOs = await db.select({ purchaseOrderId: poReceivingRecords.purchaseOrderId })
    .from(poReceivingRecords)
    .groupBy(poReceivingRecords.purchaseOrderId);

  for (const row of receivedPOs) {
    // Check if match already exists
    const [existing] = await db.select({ id: threeWayMatches.id }).from(threeWayMatches)
      .where(eq(threeWayMatches.purchaseOrderId, row.purchaseOrderId)).limit(1);

    if (existing) continue;

    try {
      const result = await createThreeWayMatch({ purchaseOrderId: row.purchaseOrderId });
      if (result.status === "matched") matched++;
      else if (result.status === "discrepancy") discrepancyCount++;
    } catch (err) {
      errors.push(`PO ${row.purchaseOrderId}: ${err}`);
    }
  }

  return { matched, discrepancies: discrepancyCount, errors };
}
