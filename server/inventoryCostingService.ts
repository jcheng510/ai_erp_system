/**
 * Inventory Costing Service
 * Implements FIFO, LIFO, and Weighted Average costing methods
 * with COGS calculation and tracking
 */
import * as db from "./db";

export type CostingMethod = "fifo" | "lifo" | "weighted_average";

interface CostLayerConsumption {
  layerId: number;
  quantityConsumed: number;
  unitCost: number;
  totalCost: number;
}

interface CogsCalculationResult {
  totalCogs: number;
  unitCogs: number;
  layerBreakdown: CostLayerConsumption[];
  remainingLayers: { layerId: number; remainingQuantity: number }[];
}

/**
 * Add a new cost layer when inventory is received (from PO, production, adjustment)
 */
export async function addCostLayer(params: {
  companyId?: number;
  productId: number;
  warehouseId?: number;
  purchaseOrderId?: number;
  lotId?: number;
  quantity: number;
  unitCost: number;
  referenceType?: string;
  referenceId?: number;
  layerDate?: Date;
  createdBy?: number;
  notes?: string;
}) {
  const totalCost = params.quantity * params.unitCost;
  return db.createInventoryCostLayer({
    companyId: params.companyId,
    productId: params.productId,
    warehouseId: params.warehouseId,
    purchaseOrderId: params.purchaseOrderId,
    lotId: params.lotId,
    layerDate: params.layerDate || new Date(),
    originalQuantity: params.quantity.toString(),
    remainingQuantity: params.quantity.toString(),
    unitCost: params.unitCost.toFixed(4),
    totalCost: totalCost.toFixed(2),
    currency: "USD",
    status: "active",
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    notes: params.notes,
    createdBy: params.createdBy,
  });
}

/**
 * Calculate COGS using FIFO method
 * Consumes oldest cost layers first
 */
export async function calculateFifoCogs(
  productId: number,
  quantityToSell: number
): Promise<CogsCalculationResult> {
  // Get active layers ordered oldest-first
  const layers = await db.getActiveCostLayers(productId, "asc");
  return consumeLayers(layers, quantityToSell);
}

/**
 * Calculate COGS using LIFO method
 * Consumes newest cost layers first
 */
export async function calculateLifoCogs(
  productId: number,
  quantityToSell: number
): Promise<CogsCalculationResult> {
  // Get active layers ordered newest-first
  const layers = await db.getActiveCostLayers(productId, "desc");
  return consumeLayers(layers, quantityToSell);
}

/**
 * Calculate COGS using Weighted Average method
 * Uses the weighted average cost across all layers
 */
export async function calculateWeightedAverageCogs(
  productId: number,
  quantityToSell: number
): Promise<CogsCalculationResult> {
  const avgData = await db.getWeightedAverageCost(productId);
  if (!avgData || avgData.totalQuantity < quantityToSell) {
    throw new Error(
      `Insufficient inventory. Available: ${avgData?.totalQuantity || 0}, Requested: ${quantityToSell}`
    );
  }

  const unitCogs = avgData.averageCost;
  const totalCogs = unitCogs * quantityToSell;

  // For weighted average, we still consume from actual layers (oldest first) to maintain layer integrity
  const layers = await db.getActiveCostLayers(productId, "asc");
  let remaining = quantityToSell;
  const breakdown: CostLayerConsumption[] = [];
  const remainingLayers: { layerId: number; remainingQuantity: number }[] = [];

  for (const layer of layers) {
    if (remaining <= 0) {
      remainingLayers.push({
        layerId: layer.id,
        remainingQuantity: parseFloat(layer.remainingQuantity),
      });
      continue;
    }

    const layerQty = parseFloat(layer.remainingQuantity);
    const consumed = Math.min(layerQty, remaining);
    const leftover = layerQty - consumed;

    breakdown.push({
      layerId: layer.id,
      quantityConsumed: consumed,
      unitCost: unitCogs, // Use weighted average cost, not layer cost
      totalCost: consumed * unitCogs,
    });

    if (leftover > 0) {
      remainingLayers.push({ layerId: layer.id, remainingQuantity: leftover });
    }

    remaining -= consumed;
  }

  return {
    totalCogs,
    unitCogs,
    layerBreakdown: breakdown,
    remainingLayers,
  };
}

/**
 * Generic layer consumption logic used by FIFO and LIFO
 */
function consumeLayers(
  layers: any[],
  quantityToSell: number
): CogsCalculationResult {
  let remaining = quantityToSell;
  let totalCogs = 0;
  const breakdown: CostLayerConsumption[] = [];
  const remainingLayers: { layerId: number; remainingQuantity: number }[] = [];

  const totalAvailable = layers.reduce(
    (sum, l) => sum + parseFloat(l.remainingQuantity),
    0
  );
  if (totalAvailable < quantityToSell) {
    throw new Error(
      `Insufficient inventory. Available: ${totalAvailable}, Requested: ${quantityToSell}`
    );
  }

  for (const layer of layers) {
    if (remaining <= 0) {
      remainingLayers.push({
        layerId: layer.id,
        remainingQuantity: parseFloat(layer.remainingQuantity),
      });
      continue;
    }

    const layerQty = parseFloat(layer.remainingQuantity);
    const layerCost = parseFloat(layer.unitCost);
    const consumed = Math.min(layerQty, remaining);
    const costForConsumed = consumed * layerCost;
    const leftover = layerQty - consumed;

    totalCogs += costForConsumed;
    breakdown.push({
      layerId: layer.id,
      quantityConsumed: consumed,
      unitCost: layerCost,
      totalCost: costForConsumed,
    });

    if (leftover > 0) {
      remainingLayers.push({ layerId: layer.id, remainingQuantity: leftover });
    }

    remaining -= consumed;
  }

  return {
    totalCogs,
    unitCogs: totalCogs / quantityToSell,
    layerBreakdown: breakdown,
    remainingLayers,
  };
}

/**
 * Main entry point: Calculate and record COGS for a sale
 */
export async function recordCogs(params: {
  companyId?: number;
  productId: number;
  warehouseId?: number;
  orderId?: number;
  salesOrderLineId?: number;
  quantitySold: number;
  unitRevenue?: number;
  calculatedBy?: number;
}): Promise<{ cogsRecordId: number; totalCogs: number; unitCogs: number; grossMargin: number | null }> {
  // Get costing method for this product
  const config = await db.getInventoryCostingConfigByProduct(params.productId);
  const method: CostingMethod = config?.costingMethod || "weighted_average";

  // Calculate COGS based on method
  let result: CogsCalculationResult;
  switch (method) {
    case "fifo":
      result = await calculateFifoCogs(params.productId, params.quantitySold);
      break;
    case "lifo":
      result = await calculateLifoCogs(params.productId, params.quantitySold);
      break;
    case "weighted_average":
    default:
      result = await calculateWeightedAverageCogs(params.productId, params.quantitySold);
      break;
  }

  // Update consumed cost layers
  for (const consumed of result.layerBreakdown) {
    const layer = result.remainingLayers.find((l) => l.layerId === consumed.layerId);
    const newRemaining = layer?.remainingQuantity ?? 0;
    await db.updateInventoryCostLayer(consumed.layerId, {
      remainingQuantity: newRemaining.toFixed(4),
      status: newRemaining <= 0 ? "depleted" : "active",
    });
  }

  // Calculate margin
  const totalRevenue = params.unitRevenue
    ? params.unitRevenue * params.quantitySold
    : null;
  const grossMargin = totalRevenue !== null ? totalRevenue - result.totalCogs : null;
  const grossMarginPercent =
    totalRevenue !== null && totalRevenue > 0
      ? (grossMargin! / totalRevenue) * 100
      : null;

  // Create COGS record
  const cogsResult = await db.createCogsRecord({
    companyId: params.companyId,
    productId: params.productId,
    warehouseId: params.warehouseId,
    orderId: params.orderId,
    salesOrderLineId: params.salesOrderLineId,
    costingMethod: method,
    quantitySold: params.quantitySold.toString(),
    unitCogs: result.unitCogs.toFixed(4),
    totalCogs: result.totalCogs.toFixed(2),
    unitRevenue: params.unitRevenue?.toFixed(2),
    totalRevenue: totalRevenue?.toFixed(2),
    grossMargin: grossMargin?.toFixed(2),
    grossMarginPercent: grossMarginPercent?.toFixed(4),
    periodDate: new Date(),
    layerBreakdown: JSON.stringify(result.layerBreakdown),
    calculatedBy: params.calculatedBy,
  });

  return {
    cogsRecordId: cogsResult.id,
    totalCogs: result.totalCogs,
    unitCogs: result.unitCogs,
    grossMargin,
  };
}

/**
 * Get current inventory valuation for a product using its configured method
 */
export async function getInventoryValuation(productId: number): Promise<{
  method: CostingMethod;
  totalQuantity: number;
  totalValue: number;
  averageUnitCost: number;
  layerCount: number;
}> {
  const config = await db.getInventoryCostingConfigByProduct(productId);
  const method: CostingMethod = config?.costingMethod || "weighted_average";

  const layers = await db.getActiveCostLayers(productId, "asc");
  const totalQuantity = layers.reduce(
    (sum, l) => sum + parseFloat(l.remainingQuantity),
    0
  );
  const totalValue = layers.reduce(
    (sum, l) =>
      sum + parseFloat(l.remainingQuantity) * parseFloat(l.unitCost),
    0
  );

  return {
    method,
    totalQuantity,
    totalValue,
    averageUnitCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
    layerCount: layers.length,
  };
}

/**
 * Generate COGS period summary for reporting
 */
export async function generateCogsPeriodSummary(params: {
  companyId?: number;
  productId?: number;
  periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  periodStart: Date;
  periodEnd: Date;
}) {
  const records = await db.getCogsRecords({
    companyId: params.companyId,
    productId: params.productId,
    startDate: params.periodStart,
    endDate: params.periodEnd,
  });

  const totalQuantitySold = records.reduce(
    (sum, r) => sum + parseFloat(r.quantitySold),
    0
  );
  const totalCogs = records.reduce(
    (sum, r) => sum + parseFloat(r.totalCogs),
    0
  );
  const totalRevenue = records.reduce(
    (sum, r) => sum + parseFloat(r.totalRevenue || "0"),
    0
  );
  const grossMargin = totalRevenue - totalCogs;
  const grossMarginPercent =
    totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

  return db.createCogsPeriodSummaryRecord({
    companyId: params.companyId,
    productId: params.productId,
    periodType: params.periodType,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    totalQuantitySold: totalQuantitySold.toString(),
    totalCogs: totalCogs.toFixed(2),
    totalRevenue: totalRevenue.toFixed(2),
    averageUnitCogs: totalQuantitySold > 0 ? (totalCogs / totalQuantitySold).toFixed(4) : "0",
    grossMargin: grossMargin.toFixed(2),
    grossMarginPercent: grossMarginPercent.toFixed(4),
  });
}
