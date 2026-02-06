import { eq, and, sql, gte, lte, desc, sum, count, or } from "drizzle-orm";
import { getDb } from "./db";
import {
  accounts, transactions, transactionLines,
  invoices, payments, purchaseOrders, purchaseOrderItems,
  orders, orderItems, inventory, products, vendors, customers,
  savedReports,
} from "../drizzle/schema";

// ============================================
// REPORTING ENGINE
// ============================================

/**
 * Vendor spend analysis: total paid per vendor in a period.
 */
export async function getVendorSpendReport(params: { startDate: Date; endDate: Date; companyId?: number }): Promise<{
  vendors: Array<{
    vendorId: number;
    vendorName: string;
    poCount: number;
    totalSpend: number;
    avgOrderValue: number;
  }>;
  totalSpend: number;
  period: { start: string; end: string };
}> {
  const db = await getDb();
  if (!db) return { vendors: [], totalSpend: 0, period: { start: "", end: "" } };

  const rows = await db
    .select({
      vendorId: purchaseOrders.vendorId,
      vendorName: vendors.name,
      poCount: count(),
      totalSpend: sum(purchaseOrders.totalAmount),
    })
    .from(purchaseOrders)
    .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .where(
      and(
        gte(purchaseOrders.orderDate, params.startDate),
        lte(purchaseOrders.orderDate, params.endDate),
        ...(params.companyId ? [eq(purchaseOrders.companyId, params.companyId)] : []),
      )
    )
    .groupBy(purchaseOrders.vendorId, vendors.name)
    .orderBy(desc(sum(purchaseOrders.totalAmount)));

  const vendorData = rows.map(r => ({
    vendorId: r.vendorId,
    vendorName: r.vendorName || `Vendor #${r.vendorId}`,
    poCount: r.poCount,
    totalSpend: parseFloat(r.totalSpend || "0"),
    avgOrderValue: r.poCount > 0 ? parseFloat(r.totalSpend || "0") / r.poCount : 0,
  }));

  return {
    vendors: vendorData,
    totalSpend: vendorData.reduce((s, v) => s + v.totalSpend, 0),
    period: { start: params.startDate.toISOString(), end: params.endDate.toISOString() },
  };
}

/**
 * Sales summary report: revenue by customer, product
 */
export async function getSalesSummaryReport(params: { startDate: Date; endDate: Date; companyId?: number }): Promise<{
  byCustomer: Array<{ customerId: number | null; customerName: string; orderCount: number; totalRevenue: number }>;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  period: { start: string; end: string };
}> {
  const db = await getDb();
  if (!db) return { byCustomer: [], totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, period: { start: "", end: "" } };

  const rows = await db
    .select({
      customerId: orders.customerId,
      customerName: customers.name,
      orderCount: count(),
      totalRevenue: sum(orders.totalAmount),
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        gte(orders.orderDate, params.startDate),
        lte(orders.orderDate, params.endDate),
        ...(params.companyId ? [eq(orders.companyId, params.companyId)] : []),
      )
    )
    .groupBy(orders.customerId, customers.name)
    .orderBy(desc(sum(orders.totalAmount)));

  const byCustomer = rows.map(r => ({
    customerId: r.customerId,
    customerName: r.customerName || `Customer #${r.customerId || "N/A"}`,
    orderCount: r.orderCount,
    totalRevenue: parseFloat(r.totalRevenue || "0"),
  }));

  const totalRevenue = byCustomer.reduce((s, c) => s + c.totalRevenue, 0);
  const totalOrders = byCustomer.reduce((s, c) => s + c.orderCount, 0);

  return {
    byCustomer,
    totalRevenue,
    totalOrders,
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    period: { start: params.startDate.toISOString(), end: params.endDate.toISOString() },
  };
}

/**
 * Inventory valuation report
 */
export async function getInventoryValuationReport(companyId?: number): Promise<{
  items: Array<{
    productId: number;
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
    totalValue: number;
  }>;
  totalValue: number;
  totalItems: number;
}> {
  const db = await getDb();
  if (!db) return { items: [], totalValue: 0, totalItems: 0 };

  const rows = await db
    .select({
      productId: inventory.productId,
      productName: products.name,
      sku: products.sku,
      quantity: inventory.quantity,
      unitCost: products.costPrice,
    })
    .from(inventory)
    .leftJoin(products, eq(inventory.productId, products.id))
    .where(
      and(
        sql`CAST(${inventory.quantity} AS DECIMAL) > 0`,
        ...(companyId ? [eq(inventory.companyId, companyId)] : []),
      )
    );

  const items = rows.map(r => {
    const qty = parseFloat(r.quantity || "0");
    const cost = parseFloat(r.unitCost || "0");
    return {
      productId: r.productId || 0,
      productName: r.productName || "Unknown",
      sku: r.sku || "",
      quantity: qty,
      unitCost: cost,
      totalValue: qty * cost,
    };
  });

  return {
    items,
    totalValue: items.reduce((s, i) => s + i.totalValue, 0),
    totalItems: items.length,
  };
}

/**
 * Cash flow summary (simplified)
 */
export async function getCashFlowSummary(params: { startDate: Date; endDate: Date; companyId?: number }): Promise<{
  inflows: number;
  outflows: number;
  net: number;
  byMonth: Array<{ month: string; inflows: number; outflows: number; net: number }>;
}> {
  const db = await getDb();
  if (!db) return { inflows: 0, outflows: 0, net: 0, byMonth: [] };

  const allPayments = await db.select().from(payments)
    .where(
      and(
        eq(payments.status, "completed"),
        gte(payments.paymentDate, params.startDate),
        lte(payments.paymentDate, params.endDate),
        ...(params.companyId ? [eq(payments.companyId, params.companyId)] : []),
      )
    );

  const monthMap = new Map<string, { inflows: number; outflows: number }>();
  let totalInflows = 0;
  let totalOutflows = 0;

  for (const pmt of allPayments) {
    const amount = parseFloat(pmt.amount || "0");
    const monthKey = `${pmt.paymentDate.getFullYear()}-${String(pmt.paymentDate.getMonth() + 1).padStart(2, "0")}`;

    if (!monthMap.has(monthKey)) monthMap.set(monthKey, { inflows: 0, outflows: 0 });
    const entry = monthMap.get(monthKey)!;

    if (pmt.type === "received") {
      entry.inflows += amount;
      totalInflows += amount;
    } else {
      entry.outflows += amount;
      totalOutflows += amount;
    }
  }

  const byMonth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      inflows: data.inflows,
      outflows: data.outflows,
      net: data.inflows - data.outflows,
    }));

  return {
    inflows: totalInflows,
    outflows: totalOutflows,
    net: totalInflows - totalOutflows,
    byMonth,
  };
}

/**
 * KPI Dashboard: key metrics overview
 */
export async function getKPIDashboard(params?: { companyId?: number }): Promise<{
  revenue: { current: number; previous: number; change: number };
  expenses: { current: number; previous: number; change: number };
  cashBalance: number;
  arBalance: number;
  apBalance: number;
  openPOs: number;
  overdueInvoices: number;
  grossMargin: number;
}> {
  const db = await getDb();
  if (!db) return {
    revenue: { current: 0, previous: 0, change: 0 },
    expenses: { current: 0, previous: 0, change: 0 },
    cashBalance: 0, arBalance: 0, apBalance: 0,
    openPOs: 0, overdueInvoices: 0, grossMargin: 0,
  };

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Revenue this month vs last month
  const [currentRevenue] = await db.select({ total: sum(orders.totalAmount) }).from(orders)
    .where(and(gte(orders.orderDate, currentMonthStart), ...(params?.companyId ? [eq(orders.companyId, params.companyId)] : [])));
  const [previousRevenue] = await db.select({ total: sum(orders.totalAmount) }).from(orders)
    .where(and(gte(orders.orderDate, previousMonthStart), lte(orders.orderDate, previousMonthEnd), ...(params?.companyId ? [eq(orders.companyId, params.companyId)] : [])));

  const currentRev = parseFloat(currentRevenue?.total || "0");
  const previousRev = parseFloat(previousRevenue?.total || "0");

  // Expenses this month (from payments made)
  const [currentExpenses] = await db.select({ total: sum(payments.amount) }).from(payments)
    .where(and(eq(payments.type, "made"), eq(payments.status, "completed"), gte(payments.paymentDate, currentMonthStart)));
  const [previousExpenses] = await db.select({ total: sum(payments.amount) }).from(payments)
    .where(and(eq(payments.type, "made"), eq(payments.status, "completed"), gte(payments.paymentDate, previousMonthStart), lte(payments.paymentDate, previousMonthEnd)));

  const currentExp = parseFloat(currentExpenses?.total || "0");
  const previousExp = parseFloat(previousExpenses?.total || "0");

  // Account balances by type
  const accountBalances = await db.select({
    type: accounts.type,
    code: accounts.code,
    balance: accounts.balance,
  }).from(accounts);

  let cashBalance = 0;
  let arBalance = 0;
  let apBalance = 0;

  for (const acct of accountBalances) {
    const bal = parseFloat(acct.balance || "0");
    if (acct.code === "1000" || acct.code?.startsWith("10")) cashBalance += bal;
    if (acct.code === "1200" || acct.code?.startsWith("12")) arBalance += bal;
    if (acct.code === "2000" || acct.code?.startsWith("20")) apBalance += bal;
  }

  // Open POs
  const [openPOCount] = await db.select({ count: count() }).from(purchaseOrders)
    .where(or(eq(purchaseOrders.status, "sent"), eq(purchaseOrders.status, "confirmed")));

  // Overdue invoices
  const [overdueCount] = await db.select({ count: count() }).from(invoices)
    .where(eq(invoices.status, "overdue"));

  const grossMargin = currentRev > 0 ? ((currentRev - currentExp) / currentRev) * 100 : 0;

  return {
    revenue: { current: currentRev, previous: previousRev, change: previousRev > 0 ? ((currentRev - previousRev) / previousRev) * 100 : 0 },
    expenses: { current: currentExp, previous: previousExp, change: previousExp > 0 ? ((currentExp - previousExp) / previousExp) * 100 : 0 },
    cashBalance,
    arBalance,
    apBalance,
    openPOs: openPOCount?.count || 0,
    overdueInvoices: overdueCount?.count || 0,
    grossMargin,
  };
}

// ============================================
// SAVED REPORTS MANAGEMENT
// ============================================

export async function getSavedReports(companyId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (companyId) {
    return db.select().from(savedReports).where(eq(savedReports.companyId, companyId)).orderBy(desc(savedReports.updatedAt));
  }
  return db.select().from(savedReports).orderBy(desc(savedReports.updatedAt));
}

export async function createSavedReport(data: {
  companyId?: number;
  name: string;
  reportType: string;
  parameters?: string;
  schedule?: string;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(savedReports).values(data as any).$returningId();
  return { id: result.id };
}

export async function deleteSavedReport(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(savedReports).where(eq(savedReports.id, id));
}
