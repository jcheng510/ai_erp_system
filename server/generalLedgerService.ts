import { eq, and, sql, gte, lte, desc, sum, count, or, between } from "drizzle-orm";
import { getDb } from "./db";
import {
  accounts, transactions, transactionLines, invoices, payments,
  fiscalPeriods, purchaseOrders,
} from "../drizzle/schema";

// ============================================
// GENERAL LEDGER ENGINE
// ============================================

/**
 * Post a journal entry: create a transaction with balanced debit/credit lines.
 * Returns the transaction ID.
 */
export async function postJournalEntry(params: {
  companyId?: number;
  date: Date;
  description: string;
  referenceType?: string;
  referenceId?: number;
  lines: Array<{ accountId: number; debit?: string; credit?: string; description?: string }>;
  createdBy?: number;
}): Promise<{ id: number; transactionNumber: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validate debits = credits
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of params.lines) {
    totalDebit += parseFloat(line.debit || "0");
    totalCredit += parseFloat(line.credit || "0");
  }
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry not balanced: debits (${totalDebit.toFixed(2)}) != credits (${totalCredit.toFixed(2)})`);
  }

  const txnNumber = `JE-${Date.now().toString(36).toUpperCase()}`;

  const [txn] = await db.insert(transactions).values({
    companyId: params.companyId,
    transactionNumber: txnNumber,
    type: "journal",
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    date: params.date,
    description: params.description,
    totalAmount: totalDebit.toFixed(2),
    status: "posted",
    createdBy: params.createdBy,
    postedBy: params.createdBy,
    postedAt: new Date(),
  }).$returningId();

  for (const line of params.lines) {
    await db.insert(transactionLines).values({
      transactionId: txn.id,
      accountId: line.accountId,
      debit: line.debit || "0",
      credit: line.credit || "0",
      description: line.description,
    });
  }

  // Update account balances
  for (const line of params.lines) {
    const debitAmt = parseFloat(line.debit || "0");
    const creditAmt = parseFloat(line.credit || "0");
    const netChange = debitAmt - creditAmt;

    // For asset/expense accounts: debit increases, credit decreases
    // For liability/equity/revenue: credit increases, debit decreases
    // We store as net debit balance, so adjustment depends on type
    const [acct] = await db.select().from(accounts).where(eq(accounts.id, line.accountId)).limit(1);
    if (acct) {
      const currentBalance = parseFloat(acct.balance || "0");
      let newBalance: number;
      if (acct.type === "asset" || acct.type === "expense") {
        newBalance = currentBalance + netChange;
      } else {
        newBalance = currentBalance - netChange;
      }
      await db.update(accounts).set({ balance: newBalance.toFixed(2) }).where(eq(accounts.id, line.accountId));
    }
  }

  return { id: txn.id, transactionNumber: txnNumber };
}

/**
 * Auto-post GL entry when an invoice is created (AR recognition)
 */
export async function postInvoiceToGL(invoiceId: number, createdBy?: number): Promise<{ transactionId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) return null;

  // Find AR and Revenue accounts (by code convention)
  const [arAccount] = await db.select().from(accounts).where(eq(accounts.code, "1200")).limit(1);
  const [revenueAccount] = await db.select().from(accounts).where(eq(accounts.code, "4000")).limit(1);

  if (!arAccount || !revenueAccount) return null;

  const result = await postJournalEntry({
    companyId: inv.companyId ?? undefined,
    date: inv.issueDate,
    description: `Invoice ${inv.invoiceNumber} - ${inv.totalAmount}`,
    referenceType: "invoice",
    referenceId: inv.id,
    lines: [
      { accountId: arAccount.id, debit: inv.totalAmount, description: `AR - Invoice ${inv.invoiceNumber}` },
      { accountId: revenueAccount.id, credit: inv.totalAmount, description: `Revenue - Invoice ${inv.invoiceNumber}` },
    ],
    createdBy,
  });

  return { transactionId: result.id };
}

/**
 * Auto-post GL entry when a payment is received
 */
export async function postPaymentToGL(paymentId: number, createdBy?: number): Promise<{ transactionId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const [pmt] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!pmt) return null;

  // Cash/Bank and AR accounts
  const [cashAccount] = await db.select().from(accounts).where(eq(accounts.code, "1000")).limit(1);
  const [arAccount] = await db.select().from(accounts).where(eq(accounts.code, "1200")).limit(1);
  const [apAccount] = await db.select().from(accounts).where(eq(accounts.code, "2000")).limit(1);

  if (!cashAccount) return null;

  const lines: Array<{ accountId: number; debit?: string; credit?: string; description?: string }> = [];

  if (pmt.type === "received" && arAccount) {
    // Cash received: Debit Cash, Credit AR
    lines.push({ accountId: cashAccount.id, debit: pmt.amount, description: `Cash received - ${pmt.paymentNumber}` });
    lines.push({ accountId: arAccount.id, credit: pmt.amount, description: `AR cleared - ${pmt.paymentNumber}` });
  } else if (pmt.type === "made" && apAccount) {
    // Payment made: Debit AP, Credit Cash
    lines.push({ accountId: apAccount.id, debit: pmt.amount, description: `AP cleared - ${pmt.paymentNumber}` });
    lines.push({ accountId: cashAccount.id, credit: pmt.amount, description: `Cash paid - ${pmt.paymentNumber}` });
  } else {
    return null;
  }

  const result = await postJournalEntry({
    companyId: pmt.companyId ?? undefined,
    date: pmt.paymentDate,
    description: `Payment ${pmt.paymentNumber}`,
    referenceType: "payment",
    referenceId: pmt.id,
    lines,
    createdBy,
  });

  return { transactionId: result.id };
}

// ============================================
// TRIAL BALANCE
// ============================================

export async function getTrialBalance(params?: { companyId?: number; asOfDate?: Date }) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (params?.companyId) conditions.push(eq(accounts.companyId, params.companyId));
  if (conditions.length > 0) {
    return db.select().from(accounts).where(and(...conditions)).orderBy(accounts.code);
  }
  return db.select().from(accounts).orderBy(accounts.code);
}

// ============================================
// FINANCIAL STATEMENTS
// ============================================

interface FinancialLine {
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: number;
}

export async function getProfitAndLoss(params: { companyId?: number; startDate: Date; endDate: Date }): Promise<{
  revenue: FinancialLine[];
  expenses: FinancialLine[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  period: { start: string; end: string };
}> {
  const db = await getDb();
  if (!db) return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netIncome: 0, period: { start: "", end: "" } };

  // Get all transactions in the period, grouped by account
  const rows = await db
    .select({
      accountId: transactionLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      accountType: accounts.type,
      accountSubtype: accounts.subtype,
      totalDebit: sum(transactionLines.debit),
      totalCredit: sum(transactionLines.credit),
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(transactions.status, "posted"),
        gte(transactions.date, params.startDate),
        lte(transactions.date, params.endDate),
        ...(params.companyId ? [eq(transactions.companyId, params.companyId)] : []),
      )
    )
    .groupBy(transactionLines.accountId, accounts.code, accounts.name, accounts.type, accounts.subtype);

  const revenue: FinancialLine[] = [];
  const expenses: FinancialLine[] = [];

  for (const row of rows) {
    const debit = parseFloat(row.totalDebit || "0");
    const credit = parseFloat(row.totalCredit || "0");

    if (row.accountType === "revenue") {
      // Revenue = credits - debits
      revenue.push({
        code: row.accountCode,
        name: row.accountName,
        type: row.accountType,
        subtype: row.accountSubtype,
        balance: credit - debit,
      });
    } else if (row.accountType === "expense") {
      // Expense = debits - credits
      expenses.push({
        code: row.accountCode,
        name: row.accountName,
        type: row.accountType,
        subtype: row.accountSubtype,
        balance: debit - credit,
      });
    }
  }

  const totalRevenue = revenue.reduce((s, r) => s + r.balance, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.balance, 0);

  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    period: { start: params.startDate.toISOString(), end: params.endDate.toISOString() },
  };
}

export async function getBalanceSheet(params?: { companyId?: number; asOfDate?: Date }): Promise<{
  assets: FinancialLine[];
  liabilities: FinancialLine[];
  equity: FinancialLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}> {
  const db = await getDb();
  if (!db) return { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 };

  const conditions = [];
  if (params?.companyId) conditions.push(eq(accounts.companyId, params.companyId));

  const allAccounts = conditions.length > 0
    ? await db.select().from(accounts).where(and(...conditions)).orderBy(accounts.code)
    : await db.select().from(accounts).orderBy(accounts.code);

  const assets: FinancialLine[] = [];
  const liabilities: FinancialLine[] = [];
  const equity: FinancialLine[] = [];

  for (const acct of allAccounts) {
    const balance = parseFloat(acct.balance || "0");
    if (balance === 0 && !acct.isActive) continue;

    const line: FinancialLine = {
      code: acct.code,
      name: acct.name,
      type: acct.type,
      subtype: acct.subtype,
      balance,
    };

    if (acct.type === "asset") assets.push(line);
    else if (acct.type === "liability") liabilities.push(line);
    else if (acct.type === "equity") equity.push(line);
  }

  return {
    assets,
    liabilities,
    equity,
    totalAssets: assets.reduce((s, a) => s + a.balance, 0),
    totalLiabilities: liabilities.reduce((s, l) => s + l.balance, 0),
    totalEquity: equity.reduce((s, e) => s + e.balance, 0),
  };
}

export async function getCashFlowStatement(params: { companyId?: number; startDate: Date; endDate: Date }): Promise<{
  operating: Array<{ description: string; amount: number }>;
  investing: Array<{ description: string; amount: number }>;
  financing: Array<{ description: string; amount: number }>;
  totalOperating: number;
  totalInvesting: number;
  totalFinancing: number;
  netCashChange: number;
  period: { start: string; end: string };
}> {
  const db = await getDb();
  if (!db) return {
    operating: [], investing: [], financing: [],
    totalOperating: 0, totalInvesting: 0, totalFinancing: 0, netCashChange: 0,
    period: { start: "", end: "" },
  };

  // Cash flow from operations: payments received - payments made in period
  const paymentsInPeriod = await db.select().from(payments)
    .where(
      and(
        gte(payments.paymentDate, params.startDate),
        lte(payments.paymentDate, params.endDate),
        eq(payments.status, "completed"),
        ...(params.companyId ? [eq(payments.companyId, params.companyId)] : []),
      )
    );

  const operating: Array<{ description: string; amount: number }> = [];
  let cashFromCustomers = 0;
  let cashToVendors = 0;

  for (const pmt of paymentsInPeriod) {
    const amount = parseFloat(pmt.amount || "0");
    if (pmt.type === "received") {
      cashFromCustomers += amount;
    } else {
      cashToVendors += amount;
    }
  }

  if (cashFromCustomers > 0) operating.push({ description: "Cash received from customers", amount: cashFromCustomers });
  if (cashToVendors > 0) operating.push({ description: "Cash paid to vendors", amount: -cashToVendors });

  // Get transactions categorized by subtype for investing/financing
  const rows = await db
    .select({
      accountType: accounts.type,
      accountSubtype: accounts.subtype,
      totalDebit: sum(transactionLines.debit),
      totalCredit: sum(transactionLines.credit),
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(transactions.status, "posted"),
        gte(transactions.date, params.startDate),
        lte(transactions.date, params.endDate),
        ...(params.companyId ? [eq(transactions.companyId, params.companyId)] : []),
      )
    )
    .groupBy(accounts.type, accounts.subtype);

  const investing: Array<{ description: string; amount: number }> = [];
  const financing: Array<{ description: string; amount: number }> = [];

  for (const row of rows) {
    const net = parseFloat(row.totalCredit || "0") - parseFloat(row.totalDebit || "0");
    if (net === 0) continue;

    if (row.accountSubtype === "fixed_asset" || row.accountSubtype === "investment") {
      investing.push({ description: `${row.accountSubtype} changes`, amount: net });
    } else if (row.accountSubtype === "long_term_debt" || row.accountSubtype === "equity_contribution") {
      financing.push({ description: `${row.accountSubtype} changes`, amount: net });
    }
  }

  const totalOperating = operating.reduce((s, o) => s + o.amount, 0);
  const totalInvesting = investing.reduce((s, i) => s + i.amount, 0);
  const totalFinancing = financing.reduce((s, f) => s + f.amount, 0);

  return {
    operating, investing, financing,
    totalOperating, totalInvesting, totalFinancing,
    netCashChange: totalOperating + totalInvesting + totalFinancing,
    period: { start: params.startDate.toISOString(), end: params.endDate.toISOString() },
  };
}

// ============================================
// AGED RECEIVABLES / PAYABLES
// ============================================

export async function getAgedReceivables(companyId?: number): Promise<{
  current: Array<{ invoiceNumber: string; customerName: string; amount: number; dueDate: string }>;
  thirtyDays: Array<{ invoiceNumber: string; customerName: string; amount: number; dueDate: string }>;
  sixtyDays: Array<{ invoiceNumber: string; customerName: string; amount: number; dueDate: string }>;
  ninetyPlus: Array<{ invoiceNumber: string; customerName: string; amount: number; dueDate: string }>;
  totalCurrent: number;
  totalThirty: number;
  totalSixty: number;
  totalNinetyPlus: number;
}> {
  const db = await getDb();
  if (!db) return { current: [], thirtyDays: [], sixtyDays: [], ninetyPlus: [], totalCurrent: 0, totalThirty: 0, totalSixty: 0, totalNinetyPlus: 0 };

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyAgo = new Date(now.getTime() - 60 * 86400000);
  const ninetyAgo = new Date(now.getTime() - 90 * 86400000);

  const openInvoices = await db.select().from(invoices)
    .where(
      and(
        or(eq(invoices.status, "sent"), eq(invoices.status, "overdue"), eq(invoices.status, "partial")),
        ...(companyId ? [eq(invoices.companyId, companyId)] : []),
      )
    );

  const current: Array<{ invoiceNumber: string; customerName: string; amount: number; dueDate: string }> = [];
  const thirtyDays: Array<{ invoiceNumber: string; customerName: string; amount: number; dueDate: string }> = [];
  const sixtyDays: Array<{ invoiceNumber: string; customerName: string; amount: number; dueDate: string }> = [];
  const ninetyPlus: Array<{ invoiceNumber: string; customerName: string; amount: number; dueDate: string }> = [];

  for (const inv of openInvoices) {
    const outstanding = parseFloat(inv.totalAmount) - parseFloat(inv.paidAmount || "0");
    if (outstanding <= 0) continue;

    const item = {
      invoiceNumber: inv.invoiceNumber,
      customerName: `Customer #${inv.customerId || "N/A"}`,
      amount: outstanding,
      dueDate: inv.dueDate?.toISOString() || "",
    };

    const dueDate = inv.dueDate || inv.issueDate;
    if (dueDate >= now) {
      current.push(item);
    } else if (dueDate >= thirtyAgo) {
      thirtyDays.push(item);
    } else if (dueDate >= sixtyAgo) {
      sixtyDays.push(item);
    } else {
      ninetyPlus.push(item);
    }
  }

  return {
    current, thirtyDays, sixtyDays, ninetyPlus,
    totalCurrent: current.reduce((s, c) => s + c.amount, 0),
    totalThirty: thirtyDays.reduce((s, c) => s + c.amount, 0),
    totalSixty: sixtyDays.reduce((s, c) => s + c.amount, 0),
    totalNinetyPlus: ninetyPlus.reduce((s, c) => s + c.amount, 0),
  };
}

export async function getAgedPayables(companyId?: number): Promise<{
  current: Array<{ poNumber: string; vendorName: string; amount: number; dueDate: string }>;
  thirtyDays: Array<{ poNumber: string; vendorName: string; amount: number; dueDate: string }>;
  sixtyDays: Array<{ poNumber: string; vendorName: string; amount: number; dueDate: string }>;
  ninetyPlus: Array<{ poNumber: string; vendorName: string; amount: number; dueDate: string }>;
  totalCurrent: number;
  totalThirty: number;
  totalSixty: number;
  totalNinetyPlus: number;
}> {
  const db = await getDb();
  if (!db) return { current: [], thirtyDays: [], sixtyDays: [], ninetyPlus: [], totalCurrent: 0, totalThirty: 0, totalSixty: 0, totalNinetyPlus: 0 };

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyAgo = new Date(now.getTime() - 60 * 86400000);
  const ninetyAgo = new Date(now.getTime() - 90 * 86400000);

  // POs that are received but not fully paid
  const openPOs = await db.select().from(purchaseOrders)
    .where(
      and(
        or(eq(purchaseOrders.status, "received"), eq(purchaseOrders.status, "confirmed"), eq(purchaseOrders.status, "partial")),
        ...(companyId ? [eq(purchaseOrders.companyId, companyId)] : []),
      )
    );

  const current: Array<{ poNumber: string; vendorName: string; amount: number; dueDate: string }> = [];
  const thirtyDays: Array<{ poNumber: string; vendorName: string; amount: number; dueDate: string }> = [];
  const sixtyDays: Array<{ poNumber: string; vendorName: string; amount: number; dueDate: string }> = [];
  const ninetyPlus: Array<{ poNumber: string; vendorName: string; amount: number; dueDate: string }> = [];

  for (const po of openPOs) {
    const amount = parseFloat(po.totalAmount || "0");
    if (amount <= 0) continue;

    const item = {
      poNumber: po.poNumber,
      vendorName: `Vendor #${po.vendorId}`,
      amount,
      dueDate: po.expectedDate?.toISOString() || po.orderDate.toISOString(),
    };

    const refDate = po.receivedDate || po.orderDate;
    if (refDate >= thirtyAgo) {
      current.push(item);
    } else if (refDate >= sixtyAgo) {
      thirtyDays.push(item);
    } else if (refDate >= ninetyAgo) {
      sixtyDays.push(item);
    } else {
      ninetyPlus.push(item);
    }
  }

  return {
    current, thirtyDays, sixtyDays, ninetyPlus,
    totalCurrent: current.reduce((s, c) => s + c.amount, 0),
    totalThirty: thirtyDays.reduce((s, c) => s + c.amount, 0),
    totalSixty: sixtyDays.reduce((s, c) => s + c.amount, 0),
    totalNinetyPlus: ninetyPlus.reduce((s, c) => s + c.amount, 0),
  };
}

// ============================================
// PERIOD CLOSE
// ============================================

export async function getFiscalPeriods(companyId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (companyId) {
    return db.select().from(fiscalPeriods).where(eq(fiscalPeriods.companyId, companyId)).orderBy(desc(fiscalPeriods.startDate));
  }
  return db.select().from(fiscalPeriods).orderBy(desc(fiscalPeriods.startDate));
}

export async function createFiscalPeriod(data: {
  companyId?: number;
  name: string;
  periodType: "month" | "quarter" | "year";
  startDate: Date;
  endDate: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(fiscalPeriods).values(data).$returningId();
  return { id: result.id };
}

export async function closeFiscalPeriod(periodId: number, closedBy: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [period] = await db.select().from(fiscalPeriods).where(eq(fiscalPeriods.id, periodId)).limit(1);
  if (!period) return { success: false, error: "Period not found" };
  if (period.status !== "open") return { success: false, error: "Period is not open" };

  // Check for unposted transactions in this period
  const [unposted] = await db.select({ count: count() }).from(transactions)
    .where(
      and(
        eq(transactions.status, "draft"),
        gte(transactions.date, period.startDate),
        lte(transactions.date, period.endDate),
      )
    );

  if ((unposted?.count || 0) > 0) {
    return { success: false, error: `Cannot close period: ${unposted.count} unposted transaction(s) exist` };
  }

  await db.update(fiscalPeriods).set({
    status: "closed",
    closedBy,
    closedAt: new Date(),
  }).where(eq(fiscalPeriods.id, periodId));

  return { success: true };
}

export async function reopenFiscalPeriod(periodId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [period] = await db.select().from(fiscalPeriods).where(eq(fiscalPeriods.id, periodId)).limit(1);
  if (!period) return { success: false, error: "Period not found" };
  if (period.status === "locked") return { success: false, error: "Period is locked and cannot be reopened" };

  await db.update(fiscalPeriods).set({ status: "open", closedBy: null, closedAt: null }).where(eq(fiscalPeriods.id, periodId));
  return { success: true };
}
