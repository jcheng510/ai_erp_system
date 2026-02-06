/**
 * QuickBooks Sync Service
 *
 * Handles bidirectional synchronization of data between the ERP system
 * and QuickBooks Online. Syncs customers, vendors, products/items,
 * chart of accounts, invoices, and payments.
 */

import * as db from "./db";
import { makeQuickBooksRequest, refreshQuickBooksToken } from "./_core/quickbooks";

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Get a valid access token for a user, refreshing if expired.
 */
export async function getValidToken(userId: number): Promise<{
  accessToken: string;
  realmId: string;
} | null> {
  const token = await db.getQuickBooksOAuthToken(userId);
  if (!token || !token.realmId) return null;

  const isExpired = token.expiresAt && new Date(token.expiresAt) < new Date();
  let accessToken = token.accessToken;

  if (isExpired && token.refreshToken) {
    const refreshResult = await refreshQuickBooksToken(token.refreshToken);
    if (refreshResult.error) {
      console.error("[QBSync] Token refresh failed:", refreshResult.error);
      return null;
    }

    await db.upsertQuickBooksOAuthToken({
      userId,
      accessToken: refreshResult.access_token!,
      refreshToken: refreshResult.refresh_token!,
      expiresAt: new Date(Date.now() + (refreshResult.expires_in! * 1000)),
      realmId: token.realmId,
    });

    accessToken = refreshResult.access_token!;
  }

  return { accessToken, realmId: token.realmId };
}

// ============================================
// QUICKBOOKS API HELPERS
// ============================================

async function qbQuery(accessToken: string, realmId: string, query: string) {
  const encoded = encodeURIComponent(query);
  return makeQuickBooksRequest(accessToken, realmId, `query?query=${encoded}`);
}

async function qbCreate(accessToken: string, realmId: string, entity: string, data: Record<string, unknown>) {
  return makeQuickBooksRequest(accessToken, realmId, entity, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function qbUpdate(accessToken: string, realmId: string, entity: string, data: Record<string, unknown>) {
  return makeQuickBooksRequest(accessToken, realmId, entity, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============================================
// CUSTOMER SYNC
// ============================================

interface SyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  details: string[];
}

function emptySyncResult(): SyncResult {
  return { imported: 0, updated: 0, skipped: 0, errors: 0, details: [] };
}

/**
 * Sync customers from QuickBooks into the ERP.
 */
export async function syncCustomersFromQB(
  accessToken: string,
  realmId: string,
): Promise<SyncResult> {
  const result = emptySyncResult();

  const response = await qbQuery(accessToken, realmId, "SELECT * FROM Customer MAXRESULTS 1000");
  if (response.error) {
    result.errors++;
    result.details.push(`Failed to fetch customers: ${response.error}`);
    return result;
  }

  const qbCustomers = response.data?.QueryResponse?.Customer || [];

  for (const qbCust of qbCustomers) {
    try {
      const qbId = qbCust.Id?.toString();
      if (!qbId) continue;

      const existing = await db.getCustomerByQuickBooksId(qbId);

      const customerData = {
        name: qbCust.DisplayName || qbCust.CompanyName || "Unknown",
        email: qbCust.PrimaryEmailAddr?.Address || undefined,
        phone: qbCust.PrimaryPhone?.FreeFormNumber || undefined,
        address: qbCust.BillAddr?.Line1 || undefined,
        city: qbCust.BillAddr?.City || undefined,
        state: qbCust.BillAddr?.CountrySubDivisionCode || undefined,
        country: qbCust.BillAddr?.Country || undefined,
        postalCode: qbCust.BillAddr?.PostalCode || undefined,
        type: (qbCust.CompanyName ? "business" : "individual") as "business" | "individual",
        status: qbCust.Active !== false ? "active" as const : "inactive" as const,
        quickbooksCustomerId: qbId,
        syncSource: "quickbooks" as const,
        lastSyncedAt: new Date(),
      };

      if (existing) {
        await db.updateCustomer(existing.id, customerData);
        result.updated++;
      } else {
        await db.createCustomer(customerData);
        result.imported++;
      }
    } catch (err: any) {
      result.errors++;
      result.details.push(`Customer ${qbCust.DisplayName}: ${err.message}`);
    }
  }

  return result;
}

/**
 * Push a customer from the ERP to QuickBooks.
 */
export async function pushCustomerToQB(
  accessToken: string,
  realmId: string,
  customerId: number,
): Promise<{ qbId?: string; error?: string }> {
  const customer = await db.getCustomerById(customerId);
  if (!customer) return { error: "Customer not found" };

  const qbData: Record<string, unknown> = {
    DisplayName: customer.name,
    PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
    PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
    BillAddr: customer.address ? {
      Line1: customer.address,
      City: customer.city || undefined,
      CountrySubDivisionCode: customer.state || undefined,
      Country: customer.country || undefined,
      PostalCode: customer.postalCode || undefined,
    } : undefined,
    CompanyName: customer.type === "business" ? customer.name : undefined,
  };

  // If already linked, do an update
  if (customer.quickbooksCustomerId) {
    // Fetch SyncToken for update
    const existing = await qbQuery(accessToken, realmId,
      `SELECT * FROM Customer WHERE Id = '${customer.quickbooksCustomerId}'`);
    const syncToken = existing.data?.QueryResponse?.Customer?.[0]?.SyncToken;
    if (syncToken !== undefined) {
      qbData.Id = customer.quickbooksCustomerId;
      qbData.SyncToken = syncToken;
      qbData.sparse = true;
    }
  }

  const response = await qbCreate(accessToken, realmId, "customer", qbData);
  if (response.error) return { error: response.error };

  const qbId = response.data?.Customer?.Id?.toString();
  if (qbId && qbId !== customer.quickbooksCustomerId) {
    await db.updateCustomer(customerId, {
      quickbooksCustomerId: qbId,
      syncSource: "quickbooks" as const,
      lastSyncedAt: new Date(),
    });
  }

  return { qbId };
}

// ============================================
// VENDOR SYNC
// ============================================

/**
 * Sync vendors from QuickBooks into the ERP.
 */
export async function syncVendorsFromQB(
  accessToken: string,
  realmId: string,
): Promise<SyncResult> {
  const result = emptySyncResult();

  const response = await qbQuery(accessToken, realmId, "SELECT * FROM Vendor MAXRESULTS 1000");
  if (response.error) {
    result.errors++;
    result.details.push(`Failed to fetch vendors: ${response.error}`);
    return result;
  }

  const qbVendors = response.data?.QueryResponse?.Vendor || [];

  for (const qbVendor of qbVendors) {
    try {
      const qbId = qbVendor.Id?.toString();
      if (!qbId) continue;

      const existing = await db.getVendorByQuickBooksId(qbId);

      const vendorData = {
        name: qbVendor.DisplayName || qbVendor.CompanyName || "Unknown",
        contactName: qbVendor.GivenName
          ? `${qbVendor.GivenName} ${qbVendor.FamilyName || ""}`.trim()
          : undefined,
        email: qbVendor.PrimaryEmailAddr?.Address || undefined,
        phone: qbVendor.PrimaryPhone?.FreeFormNumber || undefined,
        address: qbVendor.BillAddr?.Line1 || undefined,
        city: qbVendor.BillAddr?.City || undefined,
        state: qbVendor.BillAddr?.CountrySubDivisionCode || undefined,
        country: qbVendor.BillAddr?.Country || undefined,
        postalCode: qbVendor.BillAddr?.PostalCode || undefined,
        taxId: qbVendor.TaxIdentifier || undefined,
        status: qbVendor.Active !== false ? "active" as const : "inactive" as const,
        quickbooksVendorId: qbId,
      };

      if (existing) {
        await db.updateVendor(existing.id, vendorData);
        result.updated++;
      } else {
        await db.createVendor(vendorData);
        result.imported++;
      }
    } catch (err: any) {
      result.errors++;
      result.details.push(`Vendor ${qbVendor.DisplayName}: ${err.message}`);
    }
  }

  return result;
}

// ============================================
// PRODUCT / ITEM SYNC
// ============================================

/**
 * Sync items/products from QuickBooks into the ERP.
 */
export async function syncProductsFromQB(
  accessToken: string,
  realmId: string,
): Promise<SyncResult> {
  const result = emptySyncResult();

  const response = await qbQuery(accessToken, realmId,
    "SELECT * FROM Item WHERE Type IN ('Inventory', 'NonInventory', 'Service') MAXRESULTS 1000");
  if (response.error) {
    result.errors++;
    result.details.push(`Failed to fetch items: ${response.error}`);
    return result;
  }

  const qbItems = response.data?.QueryResponse?.Item || [];

  for (const qbItem of qbItems) {
    try {
      const qbId = qbItem.Id?.toString();
      if (!qbId) continue;

      const existing = await db.getProductByQuickBooksId(qbId);

      const typeMap: Record<string, "physical" | "digital" | "service"> = {
        Inventory: "physical",
        NonInventory: "physical",
        Service: "service",
      };

      const productData = {
        sku: qbItem.Sku || qbItem.Name?.replace(/\s+/g, "-").toUpperCase().substring(0, 60) || `QB-${qbId}`,
        name: qbItem.Name || "Unknown Item",
        description: qbItem.Description || undefined,
        type: typeMap[qbItem.Type] || ("physical" as const),
        unitPrice: qbItem.UnitPrice?.toString() || "0",
        costPrice: qbItem.PurchaseCost?.toString() || undefined,
        taxable: qbItem.Taxable !== false,
        status: qbItem.Active !== false ? "active" as const : "inactive" as const,
        quickbooksItemId: qbId,
      };

      if (existing) {
        // Don't overwrite SKU on update
        const { sku, ...updateData } = productData;
        await db.updateProduct(existing.id, updateData);
        result.updated++;
      } else {
        // Check for SKU collision
        const skuExisting = await db.getProductBySku(productData.sku);
        if (skuExisting) {
          productData.sku = `QB-${qbId}`;
        }
        await db.createProduct(productData);
        result.imported++;
      }
    } catch (err: any) {
      result.errors++;
      result.details.push(`Item ${qbItem.Name}: ${err.message}`);
    }
  }

  return result;
}

// ============================================
// CHART OF ACCOUNTS SYNC
// ============================================

/**
 * Sync chart of accounts from QuickBooks into the ERP.
 */
export async function syncAccountsFromQB(
  accessToken: string,
  realmId: string,
): Promise<SyncResult> {
  const result = emptySyncResult();

  const response = await qbQuery(accessToken, realmId, "SELECT * FROM Account MAXRESULTS 1000");
  if (response.error) {
    result.errors++;
    result.details.push(`Failed to fetch accounts: ${response.error}`);
    return result;
  }

  const qbAccounts = response.data?.QueryResponse?.Account || [];

  // Map QB account types to ERP types
  const typeMap: Record<string, "asset" | "liability" | "equity" | "revenue" | "expense"> = {
    Bank: "asset",
    "Accounts Receivable": "asset",
    "Other Current Asset": "asset",
    "Fixed Asset": "asset",
    "Other Asset": "asset",
    "Accounts Payable": "liability",
    "Credit Card": "liability",
    "Other Current Liability": "liability",
    "Long Term Liability": "liability",
    Equity: "equity",
    Income: "revenue",
    "Other Income": "revenue",
    Expense: "expense",
    "Other Expense": "expense",
    "Cost of Goods Sold": "expense",
  };

  for (const qbAcct of qbAccounts) {
    try {
      const qbId = qbAcct.Id?.toString();
      if (!qbId) continue;

      const existing = await db.getAccountByQuickBooksId(qbId);

      const accountData = {
        code: qbAcct.AcctNum || `QB${qbId}`,
        name: qbAcct.Name || "Unknown Account",
        type: typeMap[qbAcct.AccountType] || ("expense" as const),
        subtype: qbAcct.AccountSubType || qbAcct.AccountType || undefined,
        description: qbAcct.Description || undefined,
        balance: qbAcct.CurrentBalance?.toString() || "0",
        currency: qbAcct.CurrencyRef?.value || "USD",
        isActive: qbAcct.Active !== false,
        quickbooksAccountId: qbId,
      };

      if (existing) {
        await db.updateAccount(existing.id, accountData);
        result.updated++;
      } else {
        // Check code collision
        const codeExisting = await db.getAccountByCode(accountData.code);
        if (codeExisting) {
          accountData.code = `QB${qbId}`;
        }
        await db.createAccount(accountData);
        result.imported++;
      }
    } catch (err: any) {
      result.errors++;
      result.details.push(`Account ${qbAcct.Name}: ${err.message}`);
    }
  }

  return result;
}

// ============================================
// INVOICE SYNC
// ============================================

/**
 * Sync invoices from QuickBooks into the ERP.
 */
export async function syncInvoicesFromQB(
  accessToken: string,
  realmId: string,
): Promise<SyncResult> {
  const result = emptySyncResult();

  const response = await qbQuery(accessToken, realmId, "SELECT * FROM Invoice MAXRESULTS 500");
  if (response.error) {
    result.errors++;
    result.details.push(`Failed to fetch invoices: ${response.error}`);
    return result;
  }

  const qbInvoices = response.data?.QueryResponse?.Invoice || [];

  for (const qbInv of qbInvoices) {
    try {
      const qbId = qbInv.Id?.toString();
      if (!qbId) continue;

      const existing = await db.getInvoiceByQuickBooksId(qbId);

      // Try to find the linked customer
      let customerId: number | undefined;
      if (qbInv.CustomerRef?.value) {
        const customer = await db.getCustomerByQuickBooksId(qbInv.CustomerRef.value.toString());
        customerId = customer?.id;
      }

      // Map QB balance to status
      const balance = parseFloat(qbInv.Balance || "0");
      const total = parseFloat(qbInv.TotalAmt || "0");
      let status: "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled" = "sent";
      if (balance === 0 && total > 0) {
        status = "paid";
      } else if (balance > 0 && balance < total) {
        status = "partial";
      } else if (qbInv.DueDate) {
        const dueDate = new Date(qbInv.DueDate);
        if (dueDate < new Date() && balance > 0) {
          status = "overdue";
        }
      }

      const invoiceData = {
        invoiceNumber: qbInv.DocNumber || `QB-${qbId}`,
        customerId,
        type: "invoice" as const,
        status,
        issueDate: new Date(qbInv.TxnDate || Date.now()),
        dueDate: qbInv.DueDate ? new Date(qbInv.DueDate) : undefined,
        subtotal: (parseFloat(qbInv.TotalAmt || "0") - parseFloat(qbInv.TxnTaxDetail?.TotalTax || "0")).toString(),
        taxAmount: (qbInv.TxnTaxDetail?.TotalTax || 0).toString(),
        totalAmount: (qbInv.TotalAmt || 0).toString(),
        paidAmount: (total - balance).toString(),
        currency: qbInv.CurrencyRef?.value || "USD",
        notes: qbInv.CustomerMemo?.value || undefined,
        quickbooksInvoiceId: qbId,
      };

      if (existing) {
        await db.updateInvoice(existing.id, invoiceData);
        result.updated++;
      } else {
        await db.createInvoice(invoiceData);
        result.imported++;
      }
    } catch (err: any) {
      result.errors++;
      result.details.push(`Invoice ${qbInv.DocNumber}: ${err.message}`);
    }
  }

  return result;
}

/**
 * Push an invoice from the ERP to QuickBooks.
 */
export async function pushInvoiceToQB(
  accessToken: string,
  realmId: string,
  invoiceId: number,
): Promise<{ qbId?: string; error?: string }> {
  const invoice = await db.getInvoiceById(invoiceId);
  if (!invoice) return { error: "Invoice not found" };

  // Resolve customer QB reference
  let customerRef: Record<string, unknown> | undefined;
  if (invoice.customerId) {
    const customer = await db.getCustomerById(invoice.customerId);
    if (customer?.quickbooksCustomerId) {
      customerRef = { value: customer.quickbooksCustomerId };
    }
  }

  // Get invoice line items
  const items = await db.getInvoiceItems(invoiceId);

  const lines = await Promise.all(items.map(async (item) => {
    let itemRef: Record<string, unknown> | undefined;
    if (item.productId) {
      const product = await db.getProductById(item.productId);
      if (product?.quickbooksItemId) {
        itemRef = { value: product.quickbooksItemId };
      }
    }

    return {
      DetailType: "SalesItemLineDetail",
      Amount: parseFloat(item.totalAmount?.toString() || "0"),
      Description: item.description || undefined,
      SalesItemLineDetail: {
        ItemRef: itemRef,
        Qty: parseFloat(item.quantity?.toString() || "1"),
        UnitPrice: parseFloat(item.unitPrice?.toString() || "0"),
      },
    };
  }));

  const qbData: Record<string, unknown> = {
    CustomerRef: customerRef,
    DocNumber: invoice.invoiceNumber,
    TxnDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split("T")[0] : undefined,
    DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : undefined,
    Line: lines,
    CustomerMemo: invoice.notes ? { value: invoice.notes } : undefined,
  };

  // If already linked, include Id/SyncToken for update
  if (invoice.quickbooksInvoiceId) {
    const existing = await qbQuery(accessToken, realmId,
      `SELECT * FROM Invoice WHERE Id = '${invoice.quickbooksInvoiceId}'`);
    const syncToken = existing.data?.QueryResponse?.Invoice?.[0]?.SyncToken;
    if (syncToken !== undefined) {
      qbData.Id = invoice.quickbooksInvoiceId;
      qbData.SyncToken = syncToken;
      qbData.sparse = true;
    }
  }

  const response = await qbCreate(accessToken, realmId, "invoice", qbData);
  if (response.error) return { error: response.error };

  const qbId = response.data?.Invoice?.Id?.toString();
  if (qbId && qbId !== invoice.quickbooksInvoiceId) {
    await db.updateInvoice(invoiceId, { quickbooksInvoiceId: qbId });
  }

  return { qbId };
}

// ============================================
// PAYMENT SYNC
// ============================================

/**
 * Sync payments from QuickBooks into the ERP.
 */
export async function syncPaymentsFromQB(
  accessToken: string,
  realmId: string,
): Promise<SyncResult> {
  const result = emptySyncResult();

  const response = await qbQuery(accessToken, realmId, "SELECT * FROM Payment MAXRESULTS 500");
  if (response.error) {
    result.errors++;
    result.details.push(`Failed to fetch payments: ${response.error}`);
    return result;
  }

  const qbPayments = response.data?.QueryResponse?.Payment || [];

  for (const qbPmt of qbPayments) {
    try {
      const qbId = qbPmt.Id?.toString();
      if (!qbId) continue;

      const existing = await db.getPaymentByQuickBooksId(qbId);

      // Try to find linked customer
      let customerId: number | undefined;
      if (qbPmt.CustomerRef?.value) {
        const customer = await db.getCustomerByQuickBooksId(qbPmt.CustomerRef.value.toString());
        customerId = customer?.id;
      }

      // Try to find linked invoice
      let invoiceId: number | undefined;
      const linkedInvoice = qbPmt.Line?.find((l: any) =>
        l.LinkedTxn?.some((t: any) => t.TxnType === "Invoice")
      );
      if (linkedInvoice) {
        const qbInvId = linkedInvoice.LinkedTxn?.find((t: any) => t.TxnType === "Invoice")?.TxnId;
        if (qbInvId) {
          const inv = await db.getInvoiceByQuickBooksId(qbInvId.toString());
          invoiceId = inv?.id;
        }
      }

      // Map payment method
      const methodMap: Record<string, "cash" | "check" | "bank_transfer" | "credit_card" | "ach" | "wire" | "other"> = {
        Cash: "cash",
        Check: "check",
        CreditCard: "credit_card",
        "Credit Card": "credit_card",
      };

      const paymentData = {
        paymentNumber: qbPmt.PaymentRefNum || `QB-PMT-${qbId}`,
        type: "received" as const,
        invoiceId,
        customerId,
        amount: (qbPmt.TotalAmt || 0).toString(),
        currency: qbPmt.CurrencyRef?.value || "USD",
        paymentMethod: methodMap[qbPmt.PaymentMethodRef?.name || ""] || ("other" as const),
        paymentDate: new Date(qbPmt.TxnDate || Date.now()),
        referenceNumber: qbPmt.PaymentRefNum || undefined,
        status: "completed" as const,
        quickbooksPaymentId: qbId,
      };

      if (existing) {
        await db.updatePayment(existing.id, paymentData);
        result.updated++;
      } else {
        await db.createPayment(paymentData);
        result.imported++;
      }
    } catch (err: any) {
      result.errors++;
      result.details.push(`Payment ${qbPmt.PaymentRefNum}: ${err.message}`);
    }
  }

  return result;
}

// ============================================
// FULL SYNC ORCHESTRATOR
// ============================================

export interface FullSyncResult {
  customers: SyncResult;
  vendors: SyncResult;
  products: SyncResult;
  accounts: SyncResult;
  invoices: SyncResult;
  payments: SyncResult;
  totalProcessed: number;
  totalErrors: number;
  duration: number;
}

/**
 * Run a full sync of all entity types from QuickBooks.
 */
export async function runFullSync(userId: number): Promise<FullSyncResult | { error: string }> {
  const auth = await getValidToken(userId);
  if (!auth) {
    return { error: "QuickBooks not connected or token expired" };
  }

  const start = Date.now();
  const { accessToken, realmId } = auth;

  // Sync in dependency order: accounts first, then customers/vendors, then products, then invoices, then payments
  const accountsResult = await syncAccountsFromQB(accessToken, realmId);
  const [customersResult, vendorsResult] = await Promise.all([
    syncCustomersFromQB(accessToken, realmId),
    syncVendorsFromQB(accessToken, realmId),
  ]);
  const productsResult = await syncProductsFromQB(accessToken, realmId);
  const invoicesResult = await syncInvoicesFromQB(accessToken, realmId);
  const paymentsResult = await syncPaymentsFromQB(accessToken, realmId);

  const duration = Date.now() - start;

  const totalProcessed =
    accountsResult.imported + accountsResult.updated +
    customersResult.imported + customersResult.updated +
    vendorsResult.imported + vendorsResult.updated +
    productsResult.imported + productsResult.updated +
    invoicesResult.imported + invoicesResult.updated +
    paymentsResult.imported + paymentsResult.updated;

  const totalErrors =
    accountsResult.errors + customersResult.errors + vendorsResult.errors +
    productsResult.errors + invoicesResult.errors + paymentsResult.errors;

  // Log the sync
  await db.createSyncLog({
    integration: "quickbooks",
    action: "full_sync",
    status: totalErrors > 0 ? "warning" : "success",
    details: `Full sync completed in ${duration}ms. Processed ${totalProcessed} records with ${totalErrors} errors.`,
    recordsProcessed: totalProcessed,
    recordsFailed: totalErrors,
    metadata: {
      customers: { imported: customersResult.imported, updated: customersResult.updated },
      vendors: { imported: vendorsResult.imported, updated: vendorsResult.updated },
      products: { imported: productsResult.imported, updated: productsResult.updated },
      accounts: { imported: accountsResult.imported, updated: accountsResult.updated },
      invoices: { imported: invoicesResult.imported, updated: invoicesResult.updated },
      payments: { imported: paymentsResult.imported, updated: paymentsResult.updated },
    },
  });

  return {
    customers: customersResult,
    vendors: vendorsResult,
    products: productsResult,
    accounts: accountsResult,
    invoices: invoicesResult,
    payments: paymentsResult,
    totalProcessed,
    totalErrors,
    duration,
  };
}

/**
 * Sync a single entity type from QuickBooks.
 */
export async function syncEntityFromQB(
  userId: number,
  entityType: "customers" | "vendors" | "products" | "accounts" | "invoices" | "payments",
): Promise<SyncResult | { error: string }> {
  const auth = await getValidToken(userId);
  if (!auth) {
    return { error: "QuickBooks not connected or token expired" };
  }

  const { accessToken, realmId } = auth;

  const syncFn: Record<string, (at: string, ri: string) => Promise<SyncResult>> = {
    customers: syncCustomersFromQB,
    vendors: syncVendorsFromQB,
    products: syncProductsFromQB,
    accounts: syncAccountsFromQB,
    invoices: syncInvoicesFromQB,
    payments: syncPaymentsFromQB,
  };

  const fn = syncFn[entityType];
  if (!fn) return { error: `Unknown entity type: ${entityType}` };

  const result = await fn(accessToken, realmId);

  await db.createSyncLog({
    integration: "quickbooks",
    action: `sync_${entityType}`,
    status: result.errors > 0 ? "warning" : "success",
    details: `Synced ${entityType}: ${result.imported} imported, ${result.updated} updated, ${result.errors} errors`,
    recordsProcessed: result.imported + result.updated,
    recordsFailed: result.errors,
  });

  return result;
}
