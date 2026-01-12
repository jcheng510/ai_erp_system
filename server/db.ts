import { eq, desc, and, sql, gte, lte, lt, like, or, count, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, companies, customers, vendors, products,
  accounts, invoices, invoiceItems, payments, transactions, transactionLines,
  orders, orderItems, inventory, warehouses, productionBatches,
  purchaseOrders, purchaseOrderItems, shipments,
  departments, employees, compensationHistory, employeePayments,
  contracts, contractKeyDates, disputes, documents,
  projects, projectMilestones, projectTasks,
  auditLogs, notifications, integrationConfigs, aiConversations, aiMessages,
  googleOAuthTokens, InsertGoogleOAuthToken,
  freightCarriers, freightRfqs, freightQuotes, freightEmails,
  customsClearances, customsDocuments, freightBookings,
  inventoryTransfers, inventoryTransferItems,
  teamInvitations, userPermissions,
  billOfMaterials, bomComponents, rawMaterials, bomVersionHistory,
  workOrders, workOrderMaterials, rawMaterialInventory, rawMaterialTransactions,
  purchaseOrderRawMaterials, poReceivingRecords, poReceivingItems,
  demandForecasts, productionPlans, materialRequirements, suggestedPurchaseOrders, suggestedPoItems, forecastAccuracy,
  // New lot/batch tracking tables
  inventoryLots, inventoryBalances, inventoryTransactions, workOrderOutputs,
  // Alert system
  alerts, recommendations,
  // Shopify integration
  shopifyStores, webhookEvents, shopifySkuMappings, shopifyLocationMappings,
  // Sales orders and reservations
  salesOrders, salesOrderLines, inventoryReservations,
  // Inventory allocation
  inventoryAllocations, salesEvents,
  // Sync logs
  syncLogs,
  // Notification preferences
  notificationPreferences,
  // Reconciliation
  reconciliationRuns, reconciliationLines,
  // Email scanning
  inboundEmails, emailAttachments, parsedDocuments, parsedDocumentLineItems,
  InsertCompany, InsertCustomer, InsertVendor, InsertProduct,
  InsertAccount, InsertInvoice, InsertPayment, InsertTransaction,
  InsertOrder, InsertInventory, InsertPurchaseOrder, InsertWarehouse,
  InsertEmployee, InsertContract, InsertDispute, InsertDocument,
  InsertProject, InsertAuditLog,
  InsertFreightCarrier, InsertFreightRfq, InsertFreightQuote, InsertFreightEmail,
  InsertCustomsClearance, InsertCustomsDocument, InsertFreightBooking,
  InsertInventoryTransfer, InsertInventoryTransferItem,
  InsertTeamInvitation, InsertUserPermission,
  InsertBillOfMaterials, InsertBomComponent, InsertRawMaterial, InsertBomVersionHistory,
  InsertWorkOrder, InsertWorkOrderMaterial, InsertRawMaterialInventory, InsertRawMaterialTransaction,
  InsertPurchaseOrderRawMaterial, InsertPoReceivingRecord, InsertPoReceivingItem,
  InsertDemandForecast, InsertProductionPlan, InsertMaterialRequirement, InsertSuggestedPurchaseOrder, InsertSuggestedPoItem, InsertForecastAccuracy,
  // New type imports
  InsertInventoryLot, InsertInventoryBalance, InsertInventoryTransaction, InsertWorkOrderOutput,
  InsertAlert, InsertRecommendation,
  InsertShopifyStore, InsertWebhookEvent, InsertShopifySkuMapping, InsertShopifyLocationMapping,
  InsertSalesOrder, InsertSalesOrderLine, InsertInventoryReservation,
  InsertInventoryAllocation, InsertSalesEvent,
  InsertReconciliationRun, InsertReconciliationLine,
  InsertInboundEmail, InsertEmailAttachment, InsertParsedDocument, InsertParsedDocumentLineItem
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// USER MANAGEMENT
// ============================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: InsertUser['role']) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ============================================
// COMPANY MANAGEMENT
// ============================================

export async function getCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).orderBy(desc(companies.createdAt));
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function createCompany(data: InsertCompany) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(companies).values(data);
  return { id: result[0].insertId };
}

export async function updateCompany(id: number, data: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set(data).where(eq(companies.id, id));
}

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

export async function getCustomers(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (companyId) {
    return db.select().from(customers).where(eq(customers.companyId, companyId)).orderBy(desc(customers.createdAt));
  }
  return db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function getCustomerByShopifyId(shopifyId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.shopifyCustomerId, shopifyId)).limit(1);
  return result[0];
}

export async function getCustomerByHubspotId(hubspotId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.hubspotContactId, hubspotId)).limit(1);
  return result[0];
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customers).values(data);
  return { id: result[0].insertId };
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) return;
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customers).where(eq(customers.id, id));
}

// ============================================
// VENDOR MANAGEMENT
// ============================================

export async function getVendors(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (companyId) {
    return db.select().from(vendors).where(eq(vendors.companyId, companyId)).orderBy(desc(vendors.createdAt));
  }
  return db.select().from(vendors).orderBy(desc(vendors.createdAt));
}

export async function getVendorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return result[0];
}

export async function createVendor(data: InsertVendor) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vendors).values(data);
  return { id: result[0].insertId };
}

export async function updateVendor(id: number, data: Partial<InsertVendor>) {
  const db = await getDb();
  if (!db) return;
  await db.update(vendors).set(data).where(eq(vendors.id, id));
}

export async function deleteVendor(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(vendors).where(eq(vendors.id, id));
}

// ============================================
// PRODUCT MANAGEMENT
// ============================================

export async function getProducts(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (companyId) {
    return db.select().from(products).where(eq(products.companyId, companyId)).orderBy(desc(products.createdAt));
  }
  return db.select().from(products).orderBy(desc(products.createdAt));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return { id: result[0].insertId };
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(products).where(eq(products.id, id));
}

// ============================================
// FINANCE - ACCOUNTS
// ============================================

export async function getAccounts(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (companyId) {
    return db.select().from(accounts).where(eq(accounts.companyId, companyId)).orderBy(accounts.code);
  }
  return db.select().from(accounts).orderBy(accounts.code);
}

export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return result[0];
}

export async function createAccount(data: InsertAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(accounts).values(data);
  return { id: result[0].insertId };
}

export async function updateAccount(id: number, data: Partial<InsertAccount>) {
  const db = await getDb();
  if (!db) return;
  await db.update(accounts).set(data).where(eq(accounts.id, id));
}

// ============================================
// FINANCE - INVOICES
// ============================================

export async function getInvoices(filters?: { companyId?: number; status?: string; customerId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(invoices);
  const conditions = [];
  
  if (filters?.companyId) conditions.push(eq(invoices.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(invoices.status, filters.status as any));
  if (filters?.customerId) conditions.push(eq(invoices.customerId, filters.customerId));
  
  if (conditions.length > 0) {
    return db.select().from(invoices).where(and(...conditions)).orderBy(desc(invoices.createdAt));
  }
  return db.select().from(invoices).orderBy(desc(invoices.createdAt));
}

export async function getInvoiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result[0];
}

export async function getInvoiceWithItems(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const invoice = await getInvoiceById(id);
  if (!invoice) return undefined;
  
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  return { ...invoice, items };
}

export async function createInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoices).values(data);
  return { id: result[0].insertId };
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) return;
  await db.update(invoices).set(data).where(eq(invoices.id, id));
}

export async function createInvoiceItem(data: typeof invoiceItems.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoiceItems).values(data);
  return { id: result[0].insertId };
}

// ============================================
// FINANCE - PAYMENTS
// ============================================

export async function getPayments(filters?: { companyId?: number; type?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(payments.companyId, filters.companyId));
  if (filters?.type) conditions.push(eq(payments.type, filters.type as any));
  if (filters?.status) conditions.push(eq(payments.status, filters.status as any));
  
  if (conditions.length > 0) {
    return db.select().from(payments).where(and(...conditions)).orderBy(desc(payments.createdAt));
  }
  return db.select().from(payments).orderBy(desc(payments.createdAt));
}

export async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return result[0];
}

export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(payments).values(data);
  return { id: result[0].insertId };
}

export async function updatePayment(id: number, data: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) return;
  await db.update(payments).set(data).where(eq(payments.id, id));
}

// ============================================
// FINANCE - TRANSACTIONS
// ============================================

export async function getTransactions(filters?: { companyId?: number; type?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(transactions.companyId, filters.companyId));
  if (filters?.type) conditions.push(eq(transactions.type, filters.type as any));
  if (filters?.status) conditions.push(eq(transactions.status, filters.status as any));
  
  if (conditions.length > 0) {
    return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.date));
  }
  return db.select().from(transactions).orderBy(desc(transactions.date));
}

export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(data);
  return { id: result[0].insertId };
}

// ============================================
// SALES - ORDERS
// ============================================

export async function getOrders(filters?: { companyId?: number; status?: string; customerId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(orders.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(orders.status, filters.status as any));
  if (filters?.customerId) conditions.push(eq(orders.customerId, filters.customerId));
  
  if (conditions.length > 0) {
    return db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
  }
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function getOrderWithItems(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const order = await getOrderById(id);
  if (!order) return undefined;
  
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...order, items };
}

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(data);
  return { id: result[0].insertId };
}

export async function updateOrder(id: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set(data).where(eq(orders.id, id));
}

export async function createOrderItem(data: typeof orderItems.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderItems).values(data);
  return { id: result[0].insertId };
}

// ============================================
// OPERATIONS - INVENTORY
// ============================================

export async function getInventory(filters?: { companyId?: number; warehouseId?: number; productId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(inventory.companyId, filters.companyId));
  if (filters?.warehouseId) conditions.push(eq(inventory.warehouseId, filters.warehouseId));
  if (filters?.productId) conditions.push(eq(inventory.productId, filters.productId));
  
  if (conditions.length > 0) {
    return db.select().from(inventory).where(and(...conditions)).orderBy(desc(inventory.updatedAt));
  }
  return db.select().from(inventory).orderBy(desc(inventory.updatedAt));
}

export async function createInventory(data: InsertInventory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(inventory).values(data);
  return { id: result[0].insertId };
}

export async function updateInventory(id: number, data: Partial<InsertInventory>) {
  const db = await getDb();
  if (!db) return;
  await db.update(inventory).set(data).where(eq(inventory.id, id));
}

// ============================================
// OPERATIONS - WAREHOUSES / LOCATIONS
// ============================================

export async function getWarehouses(filters?: { companyId?: number; type?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(warehouses);
  const conditions = [];
  
  if (filters?.companyId) {
    conditions.push(eq(warehouses.companyId, filters.companyId));
  }
  if (filters?.type) {
    conditions.push(eq(warehouses.type, filters.type as any));
  }
  if (filters?.status) {
    conditions.push(eq(warehouses.status, filters.status as any));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(warehouses.name);
}

export async function getWarehouseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);
  return result[0] || null;
}

export async function createWarehouse(data: InsertWarehouse) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(warehouses).values(data);
  return { id: result[0].insertId };
}

export async function updateWarehouse(id: number, data: Partial<InsertWarehouse>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(warehouses).set(data).where(eq(warehouses.id, id));
  return { success: true };
}

export async function deleteWarehouse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(warehouses).where(eq(warehouses.id, id));
  return { success: true };
}

// ============================================
// OPERATIONS - PRODUCTION BATCHES
// ============================================

export async function getProductionBatches(filters?: { companyId?: number; status?: string; productId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(productionBatches.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(productionBatches.status, filters.status as any));
  if (filters?.productId) conditions.push(eq(productionBatches.productId, filters.productId));
  
  if (conditions.length > 0) {
    return db.select().from(productionBatches).where(and(...conditions)).orderBy(desc(productionBatches.createdAt));
  }
  return db.select().from(productionBatches).orderBy(desc(productionBatches.createdAt));
}

export async function createProductionBatch(data: typeof productionBatches.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productionBatches).values(data);
  return { id: result[0].insertId };
}

export async function updateProductionBatch(id: number, data: Partial<typeof productionBatches.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(productionBatches).set(data).where(eq(productionBatches.id, id));
}

// ============================================
// OPERATIONS - PURCHASE ORDERS
// ============================================

export async function getPurchaseOrders(filters?: { companyId?: number; status?: string; vendorId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(purchaseOrders.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(purchaseOrders.status, filters.status as any));
  if (filters?.vendorId) conditions.push(eq(purchaseOrders.vendorId, filters.vendorId));
  
  if (conditions.length > 0) {
    return db.select().from(purchaseOrders).where(and(...conditions)).orderBy(desc(purchaseOrders.createdAt));
  }
  return db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
}

export async function getPurchaseOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return result[0];
}

export async function getPurchaseOrderWithItems(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const po = await getPurchaseOrderById(id);
  if (!po) return undefined;
  
  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
  return { ...po, items };
}

export async function createPurchaseOrder(data: InsertPurchaseOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(purchaseOrders).values(data);
  return { id: result[0].insertId };
}

export async function updatePurchaseOrder(id: number, data: Partial<InsertPurchaseOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id));
}

export async function createPurchaseOrderItem(data: typeof purchaseOrderItems.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(purchaseOrderItems).values(data);
  return { id: result[0].insertId };
}

// ============================================
// OPERATIONS - SHIPMENTS
// ============================================

export async function getShipments(filters?: { companyId?: number; status?: string; type?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(shipments.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(shipments.status, filters.status as any));
  if (filters?.type) conditions.push(eq(shipments.type, filters.type as any));
  
  if (conditions.length > 0) {
    return db.select().from(shipments).where(and(...conditions)).orderBy(desc(shipments.createdAt));
  }
  return db.select().from(shipments).orderBy(desc(shipments.createdAt));
}

export async function createShipment(data: typeof shipments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(shipments).values(data);
  return { id: result[0].insertId };
}

export async function updateShipment(id: number, data: Partial<typeof shipments.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(shipments).set(data).where(eq(shipments.id, id));
}

// ============================================
// HR - DEPARTMENTS
// ============================================

export async function getDepartments(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (companyId) {
    return db.select().from(departments).where(eq(departments.companyId, companyId)).orderBy(departments.name);
  }
  return db.select().from(departments).orderBy(departments.name);
}

export async function createDepartment(data: typeof departments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(departments).values(data);
  return { id: result[0].insertId };
}

// ============================================
// HR - EMPLOYEES
// ============================================

export async function getEmployees(filters?: { companyId?: number; status?: string; departmentId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(employees.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(employees.status, filters.status as any));
  if (filters?.departmentId) conditions.push(eq(employees.departmentId, filters.departmentId));
  
  if (conditions.length > 0) {
    return db.select().from(employees).where(and(...conditions)).orderBy(employees.lastName);
  }
  return db.select().from(employees).orderBy(employees.lastName);
}

export async function getEmployeeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  return result[0];
}

export async function createEmployee(data: InsertEmployee) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(employees).values(data);
  return { id: result[0].insertId };
}

export async function updateEmployee(id: number, data: Partial<InsertEmployee>) {
  const db = await getDb();
  if (!db) return;
  await db.update(employees).set(data).where(eq(employees.id, id));
}

export async function deleteEmployee(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(employees).where(eq(employees.id, id));
}

// ============================================
// HR - COMPENSATION
// ============================================

export async function getCompensationHistory(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(compensationHistory).where(eq(compensationHistory.employeeId, employeeId)).orderBy(desc(compensationHistory.effectiveDate));
}

export async function createCompensationRecord(data: typeof compensationHistory.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(compensationHistory).values(data);
  return { id: result[0].insertId };
}

// ============================================
// HR - EMPLOYEE PAYMENTS
// ============================================

export async function getEmployeePayments(filters?: { companyId?: number; employeeId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(employeePayments.companyId, filters.companyId));
  if (filters?.employeeId) conditions.push(eq(employeePayments.employeeId, filters.employeeId));
  if (filters?.status) conditions.push(eq(employeePayments.status, filters.status as any));
  
  if (conditions.length > 0) {
    return db.select().from(employeePayments).where(and(...conditions)).orderBy(desc(employeePayments.paymentDate));
  }
  return db.select().from(employeePayments).orderBy(desc(employeePayments.paymentDate));
}

export async function createEmployeePayment(data: typeof employeePayments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(employeePayments).values(data);
  return { id: result[0].insertId };
}

// ============================================
// LEGAL - CONTRACTS
// ============================================

export async function getContracts(filters?: { companyId?: number; status?: string; type?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(contracts.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(contracts.status, filters.status as any));
  if (filters?.type) conditions.push(eq(contracts.type, filters.type as any));
  
  if (conditions.length > 0) {
    return db.select().from(contracts).where(and(...conditions)).orderBy(desc(contracts.createdAt));
  }
  return db.select().from(contracts).orderBy(desc(contracts.createdAt));
}

export async function getContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
  return result[0];
}

export async function getContractWithKeyDates(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const contract = await getContractById(id);
  if (!contract) return undefined;
  
  const keyDates = await db.select().from(contractKeyDates).where(eq(contractKeyDates.contractId, id)).orderBy(contractKeyDates.date);
  return { ...contract, keyDates };
}

export async function createContract(data: InsertContract) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contracts).values(data);
  return { id: result[0].insertId };
}

export async function updateContract(id: number, data: Partial<InsertContract>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contracts).set(data).where(eq(contracts.id, id));
}

export async function createContractKeyDate(data: typeof contractKeyDates.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contractKeyDates).values(data);
  return { id: result[0].insertId };
}

// ============================================
// LEGAL - DISPUTES
// ============================================

export async function getDisputes(filters?: { companyId?: number; status?: string; priority?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(disputes.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(disputes.status, filters.status as any));
  if (filters?.priority) conditions.push(eq(disputes.priority, filters.priority as any));
  
  if (conditions.length > 0) {
    return db.select().from(disputes).where(and(...conditions)).orderBy(desc(disputes.createdAt));
  }
  return db.select().from(disputes).orderBy(desc(disputes.createdAt));
}

export async function getDisputeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
  return result[0];
}

export async function createDispute(data: InsertDispute) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(disputes).values(data);
  return { id: result[0].insertId };
}

export async function updateDispute(id: number, data: Partial<InsertDispute>) {
  const db = await getDb();
  if (!db) return;
  await db.update(disputes).set(data).where(eq(disputes.id, id));
}

// ============================================
// LEGAL - DOCUMENTS
// ============================================

export async function getDocuments(filters?: { companyId?: number; type?: string; referenceType?: string; referenceId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(documents.companyId, filters.companyId));
  if (filters?.type) conditions.push(eq(documents.type, filters.type as any));
  if (filters?.referenceType) conditions.push(eq(documents.referenceType, filters.referenceType));
  if (filters?.referenceId) conditions.push(eq(documents.referenceId, filters.referenceId));
  
  if (conditions.length > 0) {
    return db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt));
  }
  return db.select().from(documents).orderBy(desc(documents.createdAt));
}

export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(data);
  return { id: result[0].insertId };
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documents).where(eq(documents.id, id));
}

// ============================================
// PROJECTS
// ============================================

export async function getProjects(filters?: { companyId?: number; status?: string; ownerId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(projects.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(projects.status, filters.status as any));
  if (filters?.ownerId) conditions.push(eq(projects.ownerId, filters.ownerId));
  
  if (conditions.length > 0) {
    return db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.createdAt));
  }
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function getProjectWithDetails(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const project = await getProjectById(id);
  if (!project) return undefined;
  
  const milestones = await db.select().from(projectMilestones).where(eq(projectMilestones.projectId, id)).orderBy(projectMilestones.dueDate);
  const tasks = await db.select().from(projectTasks).where(eq(projectTasks.projectId, id)).orderBy(desc(projectTasks.createdAt));
  
  return { ...project, milestones, tasks };
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(data);
  return { id: result[0].insertId };
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function createProjectMilestone(data: typeof projectMilestones.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projectMilestones).values(data);
  return { id: result[0].insertId };
}

export async function updateProjectMilestone(id: number, data: Partial<typeof projectMilestones.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectMilestones).set(data).where(eq(projectMilestones.id, id));
}

export async function createProjectTask(data: typeof projectTasks.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projectTasks).values(data);
  return { id: result[0].insertId };
}

export async function updateProjectTask(id: number, data: Partial<typeof projectTasks.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectTasks).set(data).where(eq(projectTasks.id, id));
}

export async function getProjectTasks(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectTasks).where(eq(projectTasks.projectId, projectId)).orderBy(desc(projectTasks.createdAt));
}

// ============================================
// AUDIT LOGS
// ============================================

export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(filters?: { companyId?: number; entityType?: string; entityId?: number; userId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(auditLogs.companyId, filters.companyId));
  if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  
  if (conditions.length > 0) {
    return db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(100);
  }
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
}

// Old notification functions removed - see enhanced versions at end of file

// ============================================
// INTEGRATIONS
// ============================================

export async function getIntegrationConfigs(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (companyId) {
    return db.select().from(integrationConfigs).where(eq(integrationConfigs.companyId, companyId));
  }
  return db.select().from(integrationConfigs);
}

export async function createIntegrationConfig(data: typeof integrationConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(integrationConfigs).values(data);
  return { id: result[0].insertId };
}

export async function updateIntegrationConfig(id: number, data: Partial<typeof integrationConfigs.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(integrationConfigs).set(data).where(eq(integrationConfigs.id, id));
}

// ============================================
// AI CONVERSATIONS
// ============================================

export async function getAiConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiConversations).where(eq(aiConversations.userId, userId)).orderBy(desc(aiConversations.updatedAt));
}

export async function getAiConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiConversations).where(eq(aiConversations.id, id)).limit(1);
  return result[0];
}

export async function createAiConversation(data: typeof aiConversations.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiConversations).values(data);
  return { id: result[0].insertId };
}

export async function getAiMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(aiMessages.createdAt);
}

export async function createAiMessage(data: typeof aiMessages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiMessages).values(data);
  return { id: result[0].insertId };
}

export async function updateAiConversation(id: number, data: Partial<typeof aiConversations.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiConversations).set(data).where(eq(aiConversations.id, id));
}

// ============================================
// DASHBOARD METRICS
// ============================================

export async function getDashboardMetrics() {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Get counts
  const [customerCount] = await db.select({ count: count() }).from(customers);
  const [vendorCount] = await db.select({ count: count() }).from(vendors);
  const [productCount] = await db.select({ count: count() }).from(products);
  const [employeeCount] = await db.select({ count: count() }).from(employees).where(eq(employees.status, 'active'));
  const [projectCount] = await db.select({ count: count() }).from(projects).where(eq(projects.status, 'active'));
  const [contractCount] = await db.select({ count: count() }).from(contracts).where(eq(contracts.status, 'active'));
  
  // Get financial summaries
  const [invoiceTotal] = await db.select({ 
    total: sum(invoices.totalAmount),
    paid: sum(invoices.paidAmount)
  }).from(invoices).where(eq(invoices.status, 'paid'));
  
  const [orderTotal] = await db.select({ 
    total: sum(orders.totalAmount)
  }).from(orders).where(gte(orders.orderDate, thirtyDaysAgo));
  
  // Get pending items
  const [pendingInvoices] = await db.select({ count: count() }).from(invoices).where(or(eq(invoices.status, 'sent'), eq(invoices.status, 'overdue')));
  const [pendingPOs] = await db.select({ count: count() }).from(purchaseOrders).where(or(eq(purchaseOrders.status, 'sent'), eq(purchaseOrders.status, 'confirmed')));
  const [openDisputes] = await db.select({ count: count() }).from(disputes).where(eq(disputes.status, 'open'));
  
  return {
    customers: customerCount?.count || 0,
    vendors: vendorCount?.count || 0,
    products: productCount?.count || 0,
    activeEmployees: employeeCount?.count || 0,
    activeProjects: projectCount?.count || 0,
    activeContracts: contractCount?.count || 0,
    revenueThisMonth: orderTotal?.total || 0,
    invoicesPaid: invoiceTotal?.paid || 0,
    pendingInvoices: pendingInvoices?.count || 0,
    pendingPurchaseOrders: pendingPOs?.count || 0,
    openDisputes: openDisputes?.count || 0,
  };
}

// ============================================
// SEARCH
// ============================================

export async function globalSearch(query: string) {
  const db = await getDb();
  if (!db) return { customers: [], vendors: [], products: [], employees: [], contracts: [], projects: [] };
  
  const searchPattern = `%${query}%`;
  
  const [customerResults, vendorResults, productResults, employeeResults, contractResults, projectResults] = await Promise.all([
    db.select().from(customers).where(or(like(customers.name, searchPattern), like(customers.email, searchPattern))).limit(5),
    db.select().from(vendors).where(or(like(vendors.name, searchPattern), like(vendors.contactName, searchPattern))).limit(5),
    db.select().from(products).where(or(like(products.name, searchPattern), like(products.sku, searchPattern))).limit(5),
    db.select().from(employees).where(or(like(employees.firstName, searchPattern), like(employees.lastName, searchPattern), like(employees.email, searchPattern))).limit(5),
    db.select().from(contracts).where(or(like(contracts.title, searchPattern), like(contracts.contractNumber, searchPattern))).limit(5),
    db.select().from(projects).where(or(like(projects.name, searchPattern), like(projects.projectNumber, searchPattern))).limit(5),
  ]);
  
  return {
    customers: customerResults,
    vendors: vendorResults,
    products: productResults,
    employees: employeeResults,
    contracts: contractResults,
    projects: projectResults,
  };
}

// ============================================
// GOOGLE OAUTH TOKENS
// ============================================

export async function getGoogleOAuthToken(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId)).limit(1);
  return result[0];
}

export async function upsertGoogleOAuthToken(data: InsertGoogleOAuthToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if token exists for this user
  const existing = await getGoogleOAuthToken(data.userId);
  
  if (existing) {
    // Update existing token
    await db.update(googleOAuthTokens)
      .set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || existing.refreshToken,
        expiresAt: data.expiresAt,
        scope: data.scope,
        googleEmail: data.googleEmail,
      })
      .where(eq(googleOAuthTokens.userId, data.userId));
    return { id: existing.id };
  } else {
    // Insert new token
    const result = await db.insert(googleOAuthTokens).values(data);
    return { id: result[0].insertId };
  }
}

export async function deleteGoogleOAuthToken(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId));
}

// ============================================
// FREIGHT CARRIERS
// ============================================

export async function getFreightCarriers(filters?: { type?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(freightCarriers);
  const conditions = [];
  
  if (filters?.type) {
    conditions.push(eq(freightCarriers.type, filters.type as any));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(freightCarriers.isActive, filters.isActive));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(freightCarriers.isPreferred), freightCarriers.name);
}

export async function getFreightCarrierById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(freightCarriers).where(eq(freightCarriers.id, id)).limit(1);
  return result[0];
}

export async function createFreightCarrier(data: InsertFreightCarrier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(freightCarriers).values(data);
  return { id: result[0].insertId };
}

export async function updateFreightCarrier(id: number, data: Partial<InsertFreightCarrier>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(freightCarriers).set(data).where(eq(freightCarriers.id, id));
  return { success: true };
}

// ============================================
// FREIGHT RFQs
// ============================================

export async function getFreightRfqs(filters?: { status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(freightRfqs);
  
  if (filters?.status) {
    query = query.where(eq(freightRfqs.status, filters.status as any)) as any;
  }
  
  return query.orderBy(desc(freightRfqs.createdAt));
}

export async function getFreightRfqById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(freightRfqs).where(eq(freightRfqs.id, id)).limit(1);
  return result[0];
}

export async function createFreightRfq(data: Omit<InsertFreightRfq, 'rfqNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate RFQ number
  const countResult = await db.select({ count: count() }).from(freightRfqs);
  const rfqCount = countResult[0]?.count || 0;
  const rfqNumber = `RFQ-${new Date().getFullYear()}-${String(rfqCount + 1).padStart(5, '0')}`;
  
  const result = await db.insert(freightRfqs).values({ ...data, rfqNumber } as InsertFreightRfq);
  return { id: result[0].insertId, rfqNumber };
}

export async function updateFreightRfq(id: number, data: Partial<InsertFreightRfq>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(freightRfqs).set(data).where(eq(freightRfqs.id, id));
  return { success: true };
}

// ============================================
// FREIGHT QUOTES
// ============================================

export async function getFreightQuotes(rfqId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(freightQuotes);
  
  if (rfqId) {
    query = query.where(eq(freightQuotes.rfqId, rfqId)) as any;
  }
  
  return query.orderBy(freightQuotes.totalCost);
}

export async function getFreightQuoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(freightQuotes).where(eq(freightQuotes.id, id)).limit(1);
  return result[0];
}

export async function createFreightQuote(data: InsertFreightQuote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(freightQuotes).values(data);
  return { id: result[0].insertId };
}

export async function updateFreightQuote(id: number, data: Partial<InsertFreightQuote>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(freightQuotes).set(data).where(eq(freightQuotes.id, id));
  return { success: true };
}

// ============================================
// FREIGHT EMAILS
// ============================================

export async function getFreightEmails(filters?: { rfqId?: number; carrierId?: number; direction?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(freightEmails);
  const conditions = [];
  
  if (filters?.rfqId) {
    conditions.push(eq(freightEmails.rfqId, filters.rfqId));
  }
  if (filters?.carrierId) {
    conditions.push(eq(freightEmails.carrierId, filters.carrierId));
  }
  if (filters?.direction) {
    conditions.push(eq(freightEmails.direction, filters.direction as any));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(freightEmails.createdAt));
}

export async function createFreightEmail(data: InsertFreightEmail) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(freightEmails).values(data);
  return { id: result[0].insertId };
}

export async function updateFreightEmail(id: number, data: Partial<InsertFreightEmail>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(freightEmails).set(data).where(eq(freightEmails.id, id));
  return { success: true };
}

// ============================================
// CUSTOMS CLEARANCES
// ============================================

export async function getCustomsClearances(filters?: { status?: string; type?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(customsClearances);
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(customsClearances.status, filters.status as any));
  }
  if (filters?.type) {
    conditions.push(eq(customsClearances.type, filters.type as any));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(customsClearances.createdAt));
}

export async function getCustomsClearanceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customsClearances).where(eq(customsClearances.id, id)).limit(1);
  return result[0];
}

export async function createCustomsClearance(data: Omit<InsertCustomsClearance, 'clearanceNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate clearance number
  const countResult = await db.select({ count: count() }).from(customsClearances);
  const clearanceCount = countResult[0]?.count || 0;
  const clearanceNumber = `CC-${new Date().getFullYear()}-${String(clearanceCount + 1).padStart(5, '0')}`;
  
  const result = await db.insert(customsClearances).values({ ...data, clearanceNumber } as InsertCustomsClearance);
  return { id: result[0].insertId, clearanceNumber };
}

export async function updateCustomsClearance(id: number, data: Partial<InsertCustomsClearance>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customsClearances).set(data).where(eq(customsClearances.id, id));
  return { success: true };
}

// ============================================
// CUSTOMS DOCUMENTS
// ============================================

export async function getCustomsDocuments(clearanceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customsDocuments).where(eq(customsDocuments.clearanceId, clearanceId)).orderBy(customsDocuments.documentType);
}

export async function createCustomsDocument(data: InsertCustomsDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customsDocuments).values(data);
  return { id: result[0].insertId };
}

export async function updateCustomsDocument(id: number, data: Partial<InsertCustomsDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customsDocuments).set(data).where(eq(customsDocuments.id, id));
  return { success: true };
}

// ============================================
// FREIGHT BOOKINGS
// ============================================

export async function getFreightBookings(filters?: { status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(freightBookings);
  
  if (filters?.status) {
    query = query.where(eq(freightBookings.status, filters.status as any)) as any;
  }
  
  return query.orderBy(desc(freightBookings.createdAt));
}

export async function getFreightBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(freightBookings).where(eq(freightBookings.id, id)).limit(1);
  return result[0];
}

export async function createFreightBooking(data: Omit<InsertFreightBooking, 'bookingNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate booking number
  const countResult = await db.select({ count: count() }).from(freightBookings);
  const bookingCount = countResult[0]?.count || 0;
  const bookingNumber = `BK-${new Date().getFullYear()}-${String(bookingCount + 1).padStart(5, '0')}`;
  
  const result = await db.insert(freightBookings).values({ ...data, bookingNumber } as InsertFreightBooking);
  return { id: result[0].insertId, bookingNumber };
}

export async function updateFreightBooking(id: number, data: Partial<InsertFreightBooking>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(freightBookings).set(data).where(eq(freightBookings.id, id));
  return { success: true };
}

// ============================================
// FREIGHT ANALYTICS
// ============================================

export async function getFreightDashboardStats() {
  const db = await getDb();
  if (!db) return {
    activeRfqs: 0,
    pendingQuotes: 0,
    activeBookings: 0,
    pendingClearances: 0,
    totalCarriers: 0,
  };
  
  const [rfqCount] = await db.select({ count: count() }).from(freightRfqs).where(
    or(eq(freightRfqs.status, 'sent'), eq(freightRfqs.status, 'awaiting_quotes'))
  );
  
  const [quoteCount] = await db.select({ count: count() }).from(freightQuotes).where(
    eq(freightQuotes.status, 'pending')
  );
  
  const [bookingCount] = await db.select({ count: count() }).from(freightBookings).where(
    or(eq(freightBookings.status, 'pending'), eq(freightBookings.status, 'confirmed'), eq(freightBookings.status, 'in_transit'))
  );
  
  const [clearanceCount] = await db.select({ count: count() }).from(customsClearances).where(
    or(
      eq(customsClearances.status, 'pending_documents'),
      eq(customsClearances.status, 'documents_submitted'),
      eq(customsClearances.status, 'under_review')
    )
  );
  
  const [carrierCount] = await db.select({ count: count() }).from(freightCarriers).where(
    eq(freightCarriers.isActive, true)
  );
  
  return {
    activeRfqs: rfqCount?.count || 0,
    pendingQuotes: quoteCount?.count || 0,
    activeBookings: bookingCount?.count || 0,
    pendingClearances: clearanceCount?.count || 0,
    totalCarriers: carrierCount?.count || 0,
  };
}


// ============================================
// INVENTORY BY LOCATION
// ============================================

export async function getInventoryByLocation(warehouseId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (warehouseId) {
    return db.select().from(inventory).where(eq(inventory.warehouseId, warehouseId)).orderBy(desc(inventory.updatedAt));
  }
  return db.select().from(inventory).orderBy(desc(inventory.updatedAt));
}

export async function getConsolidatedInventory() {
  const db = await getDb();
  if (!db) return [];
  
  // Get inventory grouped by product with location breakdown
  const result = await db.select({
    productId: inventory.productId,
    warehouseId: inventory.warehouseId,
    quantity: inventory.quantity,
    reservedQuantity: inventory.reservedQuantity,
  }).from(inventory);
  
  return result;
}

export async function getInventoryByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(inventory).where(eq(inventory.productId, productId));
}

export async function updateInventoryQuantity(productId: number, warehouseId: number, quantityChange: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if inventory record exists
  const existing = await db.select().from(inventory)
    .where(and(eq(inventory.productId, productId), eq(inventory.warehouseId, warehouseId)))
    .limit(1);
  
  if (existing.length > 0) {
    const currentQty = parseFloat(existing[0].quantity as string) || 0;
    const newQty = currentQty + quantityChange;
    await db.update(inventory)
      .set({ quantity: newQty.toString() })
      .where(and(eq(inventory.productId, productId), eq(inventory.warehouseId, warehouseId)));
  } else {
    await db.insert(inventory).values({
      productId,
      warehouseId,
      quantity: quantityChange.toString(),
    });
  }
  
  return { success: true };
}

// ============================================
// INVENTORY TRANSFERS
// ============================================

export async function getInventoryTransfers(filters?: { status?: string; fromWarehouseId?: number; toWarehouseId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(inventoryTransfers);
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(inventoryTransfers.status, filters.status as any));
  }
  if (filters?.fromWarehouseId) {
    conditions.push(eq(inventoryTransfers.fromWarehouseId, filters.fromWarehouseId));
  }
  if (filters?.toWarehouseId) {
    conditions.push(eq(inventoryTransfers.toWarehouseId, filters.toWarehouseId));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(inventoryTransfers.createdAt));
}

export async function getTransferById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(inventoryTransfers).where(eq(inventoryTransfers.id, id)).limit(1);
  return result[0] || null;
}

export async function getTransferItems(transferId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryTransferItems).where(eq(inventoryTransferItems.transferId, transferId));
}

export async function createTransfer(data: Omit<InsertInventoryTransfer, 'transferNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate transfer number
  const transferNumber = `TRF-${Date.now().toString(36).toUpperCase()}`;
  
  const result = await db.insert(inventoryTransfers).values({
    ...data,
    transferNumber,
  });
  
  return { id: result[0].insertId, transferNumber };
}

export async function addTransferItem(data: InsertInventoryTransferItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(inventoryTransferItems).values(data);
  return { id: result[0].insertId };
}

export async function updateTransfer(id: number, data: Partial<InsertInventoryTransfer>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inventoryTransfers).set(data).where(eq(inventoryTransfers.id, id));
  return { success: true };
}

export async function updateTransferItem(id: number, data: Partial<InsertInventoryTransferItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inventoryTransferItems).set(data).where(eq(inventoryTransferItems.id, id));
  return { success: true };
}

export async function processTransferShipment(transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get transfer and items
  const transfer = await getTransferById(transferId);
  if (!transfer) throw new Error("Transfer not found");
  
  const items = await getTransferItems(transferId);
  
  // Deduct from source warehouse
  for (const item of items) {
    const qty = parseFloat(item.requestedQuantity as string) || 0;
    await updateInventoryQuantity(item.productId, transfer.fromWarehouseId, -qty);
  }
  
  // Update transfer status
  await updateTransfer(transferId, {
    status: 'in_transit',
    shippedDate: new Date(),
  });
  
  // Update items with shipped quantity
  for (const item of items) {
    await updateTransferItem(item.id, {
      shippedQuantity: item.requestedQuantity,
    });
  }
  
  return { success: true };
}

export async function processTransferReceipt(transferId: number, receivedItems: { itemId: number; receivedQuantity: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get transfer
  const transfer = await getTransferById(transferId);
  if (!transfer) throw new Error("Transfer not found");
  
  // Add to destination warehouse
  for (const received of receivedItems) {
    const item = await db.select().from(inventoryTransferItems).where(eq(inventoryTransferItems.id, received.itemId)).limit(1);
    if (item[0]) {
      await updateInventoryQuantity(item[0].productId, transfer.toWarehouseId, received.receivedQuantity);
      await updateTransferItem(received.itemId, {
        receivedQuantity: received.receivedQuantity.toString(),
      });
    }
  }
  
  // Update transfer status
  await updateTransfer(transferId, {
    status: 'received',
    receivedDate: new Date(),
  });
  
  return { success: true };
}

export async function getLocationInventorySummary() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all warehouses with their inventory counts
  const warehouseList = await db.select().from(warehouses).where(eq(warehouses.status, 'active'));
  
  const summaries = [];
  for (const wh of warehouseList) {
    const invItems = await db.select({
      totalProducts: count(),
      totalQuantity: sum(inventory.quantity),
    }).from(inventory).where(eq(inventory.warehouseId, wh.id));
    
    summaries.push({
      warehouse: wh,
      totalProducts: invItems[0]?.totalProducts || 0,
      totalQuantity: parseFloat(invItems[0]?.totalQuantity as string || '0'),
    });
  }
  
  return summaries;
}


// ============================================
// TEAM & PERMISSION MANAGEMENT
// ============================================

// Default permissions by role
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'], // All permissions
  finance: [
    'accounts.*', 'invoices.*', 'payments.*', 'transactions.*',
    'customers.read', 'vendors.read', 'reports.finance'
  ],
  ops: [
    'products.*', 'inventory.*', 'orders.*', 'purchase_orders.*',
    'shipments.*', 'warehouses.*', 'vendors.*', 'transfers.*'
  ],
  legal: [
    'contracts.*', 'disputes.*', 'documents.*',
    'customers.read', 'vendors.read', 'employees.read'
  ],
  exec: [
    'dashboard.*', 'reports.*', 'ai.*',
    'customers.read', 'vendors.read', 'employees.read',
    'invoices.read', 'orders.read', 'projects.read'
  ],
  copacker: [
    'inventory.read', 'inventory.update',
    'shipments.read', 'shipments.upload_documents',
    'warehouses.read_own'
  ],
  vendor: [
    'purchase_orders.read_own', 'purchase_orders.update_status',
    'shipments.read_own', 'shipments.upload_documents',
    'invoices.read_own'
  ],
  contractor: [
    'projects.read_assigned', 'projects.update_assigned',
    'documents.read_own', 'documents.upload'
  ],
  user: [
    'dashboard.read', 'ai.query'
  ]
};

export async function getTeamMembers() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getTeamMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateTeamMember(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(users.id, id));
}

export async function deactivateTeamMember(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users).set({
    isActive: false,
    updatedAt: new Date(),
  }).where(eq(users.id, id));
}

export async function reactivateTeamMember(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users).set({
    isActive: true,
    updatedAt: new Date(),
  }).where(eq(users.id, id));
}

// Team Invitations
export async function createTeamInvitation(data: Omit<InsertTeamInvitation, 'inviteCode'>) {
  const db = await getDb();
  if (!db) return null;
  
  const inviteCode = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  const result = await db.insert(teamInvitations).values({
    ...data,
    inviteCode,
  });
  
  return { id: result[0].insertId, inviteCode };
}

export async function getTeamInvitations() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(teamInvitations).orderBy(desc(teamInvitations.createdAt));
}

export async function getTeamInvitationByCode(inviteCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(teamInvitations)
    .where(eq(teamInvitations.inviteCode, inviteCode))
    .limit(1);
  return result[0];
}

export async function acceptTeamInvitation(inviteCode: string, userId: number) {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  const invitation = await getTeamInvitationByCode(inviteCode);
  if (!invitation) {
    return { success: false, error: 'Invalid invitation code' };
  }
  
  if (invitation.status !== 'pending') {
    return { success: false, error: 'Invitation is no longer valid' };
  }
  
  if (new Date(invitation.expiresAt) < new Date()) {
    await db.update(teamInvitations).set({ status: 'expired' })
      .where(eq(teamInvitations.id, invitation.id));
    return { success: false, error: 'Invitation has expired' };
  }
  
  // Update invitation
  await db.update(teamInvitations).set({
    status: 'accepted',
    acceptedAt: new Date(),
    acceptedByUserId: userId,
  }).where(eq(teamInvitations.id, invitation.id));
  
  // Update user with role and linked entities
  await db.update(users).set({
    role: invitation.role,
    linkedVendorId: invitation.linkedVendorId,
    linkedWarehouseId: invitation.linkedWarehouseId,
    invitedBy: invitation.invitedBy,
    invitedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
  
  // Add custom permissions if specified
  if (invitation.customPermissions) {
    const permissions = JSON.parse(invitation.customPermissions) as string[];
    for (const permission of permissions) {
      await db.insert(userPermissions).values({
        userId,
        permission,
        grantedBy: invitation.invitedBy,
      });
    }
  }
  
  return { success: true, role: invitation.role };
}

export async function revokeTeamInvitation(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(teamInvitations).set({ status: 'revoked' })
    .where(eq(teamInvitations.id, id));
}

// User Permissions
export async function getUserPermissions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(userPermissions).where(eq(userPermissions.userId, userId));
}

export async function addUserPermission(userId: number, permission: string, grantedBy: number) {
  const db = await getDb();
  if (!db) return;
  
  // Check if permission already exists
  const existing = await db.select().from(userPermissions)
    .where(and(
      eq(userPermissions.userId, userId),
      eq(userPermissions.permission, permission)
    )).limit(1);
  
  if (existing.length === 0) {
    await db.insert(userPermissions).values({
      userId,
      permission,
      grantedBy,
    });
  }
}

export async function removeUserPermission(userId: number, permission: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(userPermissions).where(and(
    eq(userPermissions.userId, userId),
    eq(userPermissions.permission, permission)
  ));
}

export async function setUserPermissions(userId: number, permissions: string[], grantedBy: number) {
  const db = await getDb();
  if (!db) return;
  
  // Remove all existing permissions
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  
  // Add new permissions
  for (const permission of permissions) {
    await db.insert(userPermissions).values({
      userId,
      permission,
      grantedBy,
    });
  }
}

// Check if user has a specific permission
export async function userHasPermission(userId: number, requiredPermission: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Get user role
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return false;
  
  const role = user[0].role;
  
  // Admin has all permissions
  if (role === 'admin') return true;
  
  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  
  // Check for wildcard match
  for (const perm of rolePermissions) {
    if (perm === '*') return true;
    if (perm === requiredPermission) return true;
    
    // Check module wildcard (e.g., 'inventory.*' matches 'inventory.update')
    if (perm.endsWith('.*')) {
      const module = perm.slice(0, -2);
      if (requiredPermission.startsWith(module + '.')) return true;
    }
  }
  
  // Check custom permissions
  const customPerms = await getUserPermissions(userId);
  for (const perm of customPerms) {
    if (perm.permission === requiredPermission) return true;
    if (perm.permission === '*') return true;
    if (perm.permission.endsWith('.*')) {
      const module = perm.permission.slice(0, -2);
      if (requiredPermission.startsWith(module + '.')) return true;
    }
  }
  
  return false;
}

// Get all effective permissions for a user
export async function getUserEffectivePermissions(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return [];
  
  const role = user[0].role;
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  const customPerms = await getUserPermissions(userId);
  
  const allPerms = new Set<string>([
    ...rolePerms,
    ...customPerms.map(p => p.permission)
  ]);
  
  return Array.from(allPerms);
}

// Get inventory for a specific warehouse (for copackers)
export async function getInventoryByWarehouse(warehouseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    inventory: inventory,
    product: products,
  })
    .from(inventory)
    .leftJoin(products, eq(inventory.productId, products.id))
    .where(eq(inventory.warehouseId, warehouseId));
}

// Update inventory quantity by ID (for copackers)
export async function updateInventoryQuantityById(
  inventoryId: number,
  quantity: number,
  userId: number,
  notes?: string
) {
  const db = await getDb();
  if (!db) return;
  
  const existing = await db.select().from(inventory).where(eq(inventory.id, inventoryId)).limit(1);
  if (!existing[0]) return;
  
  const oldQuantity = existing[0].quantity;
  
  await db.update(inventory).set({
    quantity: quantity.toString(),
    updatedAt: new Date(),
  }).where(eq(inventory.id, inventoryId));
  
  // Create audit log
  await createAuditLog({
    entityType: 'inventory',
    entityId: inventoryId,
    action: 'update',
    userId,
    oldValues: { quantity: oldQuantity },
    newValues: { quantity, notes },
  });
}


// ============================================
// BILL OF MATERIALS (BOM) FUNCTIONS
// ============================================

export async function getBillOfMaterials(filters?: { productId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(billOfMaterials).orderBy(desc(billOfMaterials.updatedAt));
  
  if (filters?.productId) {
    query = query.where(eq(billOfMaterials.productId, filters.productId)) as typeof query;
  }
  if (filters?.status) {
    query = query.where(eq(billOfMaterials.status, filters.status as any)) as typeof query;
  }
  
  return query;
}

export async function getBomById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(billOfMaterials).where(eq(billOfMaterials.id, id)).limit(1);
  return result[0];
}

export async function createBom(data: Omit<InsertBillOfMaterials, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(billOfMaterials).values(data);
  return { id: result[0].insertId };
}

export async function updateBom(id: number, data: Partial<InsertBillOfMaterials>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(billOfMaterials).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(billOfMaterials.id, id));
}

export async function deleteBom(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete components first
  await db.delete(bomComponents).where(eq(bomComponents.bomId, id));
  // Delete version history
  await db.delete(bomVersionHistory).where(eq(bomVersionHistory.bomId, id));
  // Delete BOM
  await db.delete(billOfMaterials).where(eq(billOfMaterials.id, id));
}

// BOM Components
export async function getBomComponents(bomId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(bomComponents)
    .where(eq(bomComponents.bomId, bomId))
    .orderBy(bomComponents.sortOrder);
}

export async function createBomComponent(data: Omit<InsertBomComponent, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(bomComponents).values(data);
  return { id: result[0].insertId };
}

export async function updateBomComponent(id: number, data: Partial<InsertBomComponent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(bomComponents).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(bomComponents.id, id));
}

export async function deleteBomComponent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(bomComponents).where(eq(bomComponents.id, id));
}

// Raw Materials
export async function getRawMaterials(filters?: { status?: string; category?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(rawMaterials).orderBy(rawMaterials.name);
  
  if (filters?.status) {
    query = query.where(eq(rawMaterials.status, filters.status as any)) as typeof query;
  }
  if (filters?.category) {
    query = query.where(eq(rawMaterials.category, filters.category)) as typeof query;
  }
  
  return query;
}

export async function getRawMaterialById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).limit(1);
  return result[0];
}

export async function createRawMaterial(data: Omit<InsertRawMaterial, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(rawMaterials).values(data);
  return { id: result[0].insertId };
}

export async function updateRawMaterial(id: number, data: Partial<InsertRawMaterial>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(rawMaterials).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(rawMaterials.id, id));
}

export async function deleteRawMaterial(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(rawMaterials).where(eq(rawMaterials.id, id));
}

// BOM Version History
export async function getBomVersionHistory(bomId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(bomVersionHistory)
    .where(eq(bomVersionHistory.bomId, bomId))
    .orderBy(desc(bomVersionHistory.createdAt));
}

export async function createBomVersionHistory(data: Omit<InsertBomVersionHistory, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(bomVersionHistory).values(data);
  return { id: result[0].insertId };
}

// Calculate BOM costs
export async function calculateBomCosts(bomId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const components = await getBomComponents(bomId);
  const bom = await getBomById(bomId);
  if (!bom) return null;
  
  let totalMaterialCost = 0;
  for (const comp of components) {
    const qty = parseFloat(comp.quantity?.toString() || '0');
    const unitCost = parseFloat(comp.unitCost?.toString() || '0');
    const wastage = parseFloat(comp.wastagePercent?.toString() || '0') / 100;
    const compCost = qty * unitCost * (1 + wastage);
    totalMaterialCost += compCost;
    
    // Update component total cost
    await updateBomComponent(comp.id, { totalCost: compCost.toFixed(2) });
  }
  
  const laborCost = parseFloat(bom.laborCost?.toString() || '0');
  const overheadCost = parseFloat(bom.overheadCost?.toString() || '0');
  const totalCost = totalMaterialCost + laborCost + overheadCost;
  
  await updateBom(bomId, {
    totalMaterialCost: totalMaterialCost.toFixed(2),
    totalCost: totalCost.toFixed(2),
  });
  
  return { totalMaterialCost, laborCost, overheadCost, totalCost };
}


// ============================================
// WORK ORDERS
// ============================================

export async function getWorkOrders(filters?: { status?: string; warehouseId?: number }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(workOrders).orderBy(desc(workOrders.createdAt));
  return query;
}

export async function getWorkOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
  return result[0];
}

export async function createWorkOrder(data: Omit<InsertWorkOrder, 'workOrderNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const workOrderNumber = `WO-${Date.now().toString(36).toUpperCase()}`;
  const result = await db.insert(workOrders).values({ ...data, workOrderNumber });
  return { id: result[0].insertId, workOrderNumber };
}

export async function updateWorkOrder(id: number, data: Partial<InsertWorkOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workOrders).set(data).where(eq(workOrders.id, id));
}

// ============================================
// WORK ORDER MATERIALS
// ============================================

export async function getWorkOrderMaterials(workOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workOrderMaterials).where(eq(workOrderMaterials.workOrderId, workOrderId));
}

export async function createWorkOrderMaterial(data: InsertWorkOrderMaterial) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workOrderMaterials).values(data);
  return { id: result[0].insertId };
}

export async function updateWorkOrderMaterial(id: number, data: Partial<InsertWorkOrderMaterial>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workOrderMaterials).set(data).where(eq(workOrderMaterials.id, id));
}

// Generate materials from BOM for a work order
export async function generateWorkOrderMaterialsFromBom(workOrderId: number, bomId: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const components = await getBomComponents(bomId);
  const bom = await getBomById(bomId);
  if (!bom) throw new Error("BOM not found");
  
  const batchSize = parseFloat(bom.batchSize?.toString() || '1');
  const multiplier = quantity / batchSize;
  
  for (const comp of components) {
    const compQty = parseFloat(comp.quantity?.toString() || '0');
    const wastage = parseFloat(comp.wastagePercent?.toString() || '0') / 100;
    const requiredQty = compQty * multiplier * (1 + wastage);
    
    await createWorkOrderMaterial({
      workOrderId,
      rawMaterialId: comp.rawMaterialId,
      productId: comp.productId,
      name: comp.name,
      requiredQuantity: requiredQty.toFixed(4),
      unit: comp.unit,
      status: 'pending',
    });
  }
}

// ============================================
// RAW MATERIAL INVENTORY
// ============================================

export async function getRawMaterialInventory(filters?: { rawMaterialId?: number; warehouseId?: number }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(rawMaterialInventory);
  if (filters?.rawMaterialId) {
    query = query.where(eq(rawMaterialInventory.rawMaterialId, filters.rawMaterialId)) as typeof query;
  }
  if (filters?.warehouseId) {
    query = query.where(eq(rawMaterialInventory.warehouseId, filters.warehouseId)) as typeof query;
  }
  return query;
}

export async function getRawMaterialInventoryByLocation(rawMaterialId: number, warehouseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(rawMaterialInventory)
    .where(and(
      eq(rawMaterialInventory.rawMaterialId, rawMaterialId),
      eq(rawMaterialInventory.warehouseId, warehouseId)
    ))
    .limit(1);
  return result[0];
}

export async function upsertRawMaterialInventory(rawMaterialId: number, warehouseId: number, data: Partial<InsertRawMaterialInventory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getRawMaterialInventoryByLocation(rawMaterialId, warehouseId);
  if (existing) {
    await db.update(rawMaterialInventory).set(data).where(eq(rawMaterialInventory.id, existing.id));
    return { id: existing.id };
  } else {
    const result = await db.insert(rawMaterialInventory).values({
      rawMaterialId,
      warehouseId,
      unit: data.unit || 'EA',
      ...data,
    });
    return { id: result[0].insertId };
  }
}

// ============================================
// RAW MATERIAL TRANSACTIONS
// ============================================

export async function createRawMaterialTransaction(data: InsertRawMaterialTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(rawMaterialTransactions).values(data);
  return { id: result[0].insertId };
}

export async function getRawMaterialTransactions(rawMaterialId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rawMaterialTransactions)
    .where(eq(rawMaterialTransactions.rawMaterialId, rawMaterialId))
    .orderBy(desc(rawMaterialTransactions.createdAt))
    .limit(limit);
}

// ============================================
// PO RECEIVING
// ============================================

export async function createPoReceivingRecord(data: InsertPoReceivingRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(poReceivingRecords).values(data);
  return { id: result[0].insertId };
}

export async function getPoReceivingRecords(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(poReceivingRecords)
    .where(eq(poReceivingRecords.purchaseOrderId, purchaseOrderId))
    .orderBy(desc(poReceivingRecords.receivedDate));
}

export async function createPoReceivingItem(data: InsertPoReceivingItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(poReceivingItems).values(data);
  return { id: result[0].insertId };
}

export async function getPoReceivingItems(receivingRecordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(poReceivingItems)
    .where(eq(poReceivingItems.receivingRecordId, receivingRecordId));
}

// Receive PO items and update raw material inventory
export async function receivePurchaseOrderItems(
  purchaseOrderId: number,
  warehouseId: number,
  items: Array<{ purchaseOrderItemId: number; rawMaterialId?: number; productId?: number; quantity: number; unit: string; lotNumber?: string; expirationDate?: Date }>,
  receivedBy?: number,
  shipmentId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Create receiving record
  const receiving = await createPoReceivingRecord({
    purchaseOrderId,
    shipmentId,
    receivedDate: new Date(),
    receivedBy,
    warehouseId,
  });
  
  for (const item of items) {
    // Create receiving item record
    await createPoReceivingItem({
      receivingRecordId: receiving.id,
      purchaseOrderItemId: item.purchaseOrderItemId,
      rawMaterialId: item.rawMaterialId,
      productId: item.productId,
      receivedQuantity: item.quantity.toString(),
      unit: item.unit,
      lotNumber: item.lotNumber,
      expirationDate: item.expirationDate,
      condition: 'good',
    });
    
    // Update raw material inventory if it's a raw material
    if (item.rawMaterialId) {
      const currentInv = await getRawMaterialInventoryByLocation(item.rawMaterialId, warehouseId);
      const currentQty = parseFloat(currentInv?.quantity?.toString() || '0');
      const newQty = currentQty + item.quantity;
      
      await upsertRawMaterialInventory(item.rawMaterialId, warehouseId, {
        quantity: newQty.toFixed(4),
        availableQuantity: newQty.toFixed(4),
        unit: item.unit,
        lastReceivedDate: new Date(),
        lotNumber: item.lotNumber,
        expirationDate: item.expirationDate,
      });
      
      // Create transaction record
      await createRawMaterialTransaction({
        rawMaterialId: item.rawMaterialId,
        warehouseId,
        transactionType: 'receive',
        quantity: item.quantity.toFixed(4),
        previousQuantity: currentQty.toFixed(4),
        newQuantity: newQty.toFixed(4),
        unit: item.unit,
        referenceType: 'purchase_order',
        referenceId: purchaseOrderId,
        lotNumber: item.lotNumber,
        performedBy: receivedBy,
      });
    }
    
    // Update PO item received quantity
    const poItem = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId)).limit(1);
    if (poItem[0]) {
      const prevReceived = parseFloat(poItem[0].receivedQuantity?.toString() || '0');
      await db.update(purchaseOrderItems)
        .set({ receivedQuantity: (prevReceived + item.quantity).toFixed(4) })
        .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));
    }
  }
  
  // Check if PO is fully received and update status
  const poItems = await db.select().from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  
  let allReceived = true;
  let anyReceived = false;
  for (const poi of poItems) {
    const ordered = parseFloat(poi.quantity?.toString() || '0');
    const received = parseFloat(poi.receivedQuantity?.toString() || '0');
    if (received >= ordered) {
      anyReceived = true;
    } else if (received > 0) {
      anyReceived = true;
      allReceived = false;
    } else {
      allReceived = false;
    }
  }
  
  if (allReceived) {
    await db.update(purchaseOrders).set({ status: 'received', receivedDate: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrderId));
  } else if (anyReceived) {
    await db.update(purchaseOrders).set({ status: 'partial' })
      .where(eq(purchaseOrders.id, purchaseOrderId));
  }
  
  return receiving;
}

// Consume materials for a work order
export async function consumeWorkOrderMaterials(workOrderId: number, performedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder) throw new Error("Work order not found");
  
  const materials = await getWorkOrderMaterials(workOrderId);
  
  for (const mat of materials) {
    if (!mat.rawMaterialId) continue;
    
    const requiredQty = parseFloat(mat.requiredQuantity?.toString() || '0');
    const inv = await getRawMaterialInventoryByLocation(mat.rawMaterialId, workOrder.warehouseId || 0);
    
    if (!inv) {
      await updateWorkOrderMaterial(mat.id, { status: 'shortage' });
      continue;
    }
    
    const currentQty = parseFloat(inv.quantity?.toString() || '0');
    const consumeQty = Math.min(requiredQty, currentQty);
    const newQty = currentQty - consumeQty;
    
    // Update inventory
    await upsertRawMaterialInventory(mat.rawMaterialId, workOrder.warehouseId || 0, {
      quantity: newQty.toFixed(4),
      availableQuantity: newQty.toFixed(4),
    });
    
    // Create transaction
    await createRawMaterialTransaction({
      rawMaterialId: mat.rawMaterialId,
      warehouseId: workOrder.warehouseId || 0,
      transactionType: 'consume',
      quantity: (-consumeQty).toFixed(4),
      previousQuantity: currentQty.toFixed(4),
      newQuantity: newQty.toFixed(4),
      unit: mat.unit,
      referenceType: 'work_order',
      referenceId: workOrderId,
      performedBy,
    });
    
    // Update material status
    await updateWorkOrderMaterial(mat.id, {
      consumedQuantity: consumeQty.toFixed(4),
      status: consumeQty >= requiredQty ? 'consumed' : 'partial',
    });
  }
  
  // Update work order status
  await updateWorkOrder(workOrderId, { status: 'completed', actualEndDate: new Date() });
}


// Get purchase order items
export async function getPurchaseOrderItems(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}


// ============================================
// AI PRODUCTION FORECASTING
// ============================================

// Generate forecast number
function generateForecastNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FC-${dateStr}-${random}`;
}

// Generate production plan number
function generatePlanNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PP-${dateStr}-${random}`;
}

// Generate suggested PO number
function generateSuggestedPoNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SPO-${dateStr}-${random}`;
}

// Demand Forecasts
export async function getDemandForecasts(filters?: { status?: string; productId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(demandForecasts.status, filters.status as any));
  if (filters?.productId) conditions.push(eq(demandForecasts.productId, filters.productId));
  
  return db.select().from(demandForecasts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(demandForecasts.createdAt));
}

export async function getDemandForecastById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(demandForecasts).where(eq(demandForecasts.id, id)).limit(1);
  return result[0];
}

export async function createDemandForecast(data: Omit<InsertDemandForecast, 'forecastNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const forecastNumber = generateForecastNumber();
  const result = await db.insert(demandForecasts).values({ ...data, forecastNumber }).$returningId();
  return { id: result[0].id, forecastNumber };
}

export async function updateDemandForecast(id: number, data: Partial<InsertDemandForecast>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(demandForecasts).set(data).where(eq(demandForecasts.id, id));
}

// Production Plans
export async function getProductionPlans(filters?: { status?: string; productId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(productionPlans.status, filters.status as any));
  if (filters?.productId) conditions.push(eq(productionPlans.productId, filters.productId));
  
  return db.select().from(productionPlans)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(productionPlans.createdAt));
}

export async function getProductionPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(productionPlans).where(eq(productionPlans.id, id)).limit(1);
  return result[0];
}

export async function createProductionPlan(data: Omit<InsertProductionPlan, 'planNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const planNumber = generatePlanNumber();
  const result = await db.insert(productionPlans).values({ ...data, planNumber }).$returningId();
  return { id: result[0].id, planNumber };
}

export async function updateProductionPlan(id: number, data: Partial<InsertProductionPlan>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productionPlans).set(data).where(eq(productionPlans.id, id));
}

// Material Requirements
export async function getMaterialRequirements(productionPlanId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialRequirements)
    .where(eq(materialRequirements.productionPlanId, productionPlanId));
}

export async function createMaterialRequirement(data: InsertMaterialRequirement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(materialRequirements).values(data).$returningId();
  return { id: result[0].id };
}

export async function updateMaterialRequirement(id: number, data: Partial<InsertMaterialRequirement>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(materialRequirements).set(data).where(eq(materialRequirements.id, id));
}

// Suggested Purchase Orders
export async function getSuggestedPurchaseOrders(filters?: { status?: string; vendorId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(suggestedPurchaseOrders.status, filters.status as any));
  if (filters?.vendorId) conditions.push(eq(suggestedPurchaseOrders.vendorId, filters.vendorId));
  
  return db.select().from(suggestedPurchaseOrders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(suggestedPurchaseOrders.priorityScore), desc(suggestedPurchaseOrders.createdAt));
}

export async function getSuggestedPurchaseOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suggestedPurchaseOrders).where(eq(suggestedPurchaseOrders.id, id)).limit(1);
  return result[0];
}

export async function createSuggestedPurchaseOrder(data: Omit<InsertSuggestedPurchaseOrder, 'suggestedPoNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const suggestedPoNumber = generateSuggestedPoNumber();
  const result = await db.insert(suggestedPurchaseOrders).values({ ...data, suggestedPoNumber }).$returningId();
  return { id: result[0].id, suggestedPoNumber };
}

export async function updateSuggestedPurchaseOrder(id: number, data: Partial<InsertSuggestedPurchaseOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suggestedPurchaseOrders).set(data).where(eq(suggestedPurchaseOrders.id, id));
}

// Suggested PO Items
export async function getSuggestedPoItems(suggestedPoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suggestedPoItems).where(eq(suggestedPoItems.suggestedPoId, suggestedPoId));
}

export async function createSuggestedPoItem(data: InsertSuggestedPoItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suggestedPoItems).values(data).$returningId();
  return { id: result[0].id };
}

// Forecast Accuracy
export async function getForecastAccuracyHistory(productId?: number, limit?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const query = db.select().from(forecastAccuracy)
    .orderBy(desc(forecastAccuracy.calculatedAt));
  
  if (productId) {
    return query.where(eq(forecastAccuracy.productId, productId)).limit(limit || 50);
  }
  return query.limit(limit || 50);
}

export async function createForecastAccuracyRecord(data: InsertForecastAccuracy) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(forecastAccuracy).values(data).$returningId();
  return { id: result[0].id };
}

// Get historical sales data for forecasting
export async function getHistoricalSalesData(productId?: number, months?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const monthsBack = months || 12;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  
  const conditions = [gte(orders.orderDate, startDate)];
  if (productId) {
    conditions.push(eq(orderItems.productId, productId));
  }
  
  // Get order items with dates
  const result = await db.select({
    productId: orderItems.productId,
    quantity: orderItems.quantity,
    orderDate: orders.orderDate,
    totalAmount: orderItems.totalAmount,
  })
  .from(orderItems)
  .innerJoin(orders, eq(orderItems.orderId, orders.id))
  .where(and(...conditions))
  .orderBy(orders.orderDate);
  
  return result;
}

// Get pending POs for a raw material (on order but not received)
export async function getPendingOrdersForMaterial(rawMaterialId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get PO items that reference products linked to this raw material
  const pendingPOs = await db.select({
    poId: purchaseOrders.id,
    poNumber: purchaseOrders.poNumber,
    quantity: purchaseOrderItems.quantity,
    receivedQuantity: purchaseOrderItems.receivedQuantity,
    expectedDate: purchaseOrders.expectedDate,
  })
  .from(purchaseOrderItems)
  .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
  .where(and(
    or(
      eq(purchaseOrders.status, 'sent'),
      eq(purchaseOrders.status, 'confirmed'),
      eq(purchaseOrders.status, 'partial')
    )
  ));
  
  return pendingPOs;
}

// Convert suggested PO to actual PO
export async function convertSuggestedPoToActualPo(suggestedPoId: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const suggestedPo = await getSuggestedPurchaseOrderById(suggestedPoId);
  if (!suggestedPo) throw new Error("Suggested PO not found");
  
  const items = await getSuggestedPoItems(suggestedPoId);
  
  // Calculate totals
  let subtotal = 0;
  for (const item of items) {
    subtotal += parseFloat(item.totalAmount?.toString() || '0');
  }
  
  // Create actual PO
  const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const poResult = await db.insert(purchaseOrders).values({
    poNumber,
    vendorId: suggestedPo.vendorId,
    orderDate: new Date(),
    expectedDate: suggestedPo.requiredByDate || undefined,
    subtotal: subtotal.toFixed(2),
    totalAmount: subtotal.toFixed(2),
    currency: suggestedPo.currency || 'USD',
    status: 'draft',
    createdBy: approvedBy,
    approvedBy,
    approvedAt: new Date(),
  }).$returningId();
  
  const poId = poResult[0].id;
  
  // Create PO items
  for (const item of items) {
    await db.insert(purchaseOrderItems).values({
      purchaseOrderId: poId,
      productId: item.productId || undefined,
      description: item.description || '',
      quantity: item.quantity?.toString() || '0',
      unitPrice: item.unitPrice?.toString() || '0',
      totalAmount: item.totalAmount?.toString() || '0',
    });
  }
  
  // Update suggested PO status
  await updateSuggestedPurchaseOrder(suggestedPoId, {
    status: 'converted',
    convertedPoId: poId,
    approvedBy,
    approvedAt: new Date(),
  });
  
  // Update material requirements
  for (const item of items) {
    if (item.materialRequirementId) {
      await updateMaterialRequirement(item.materialRequirementId, {
        status: 'po_generated',
        generatedPoId: poId,
      });
    }
  }
  
  return { poId, poNumber };
}

// Get all products with their BOMs for forecasting
export async function getProductsWithBoms() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    product: products,
    bom: billOfMaterials,
  })
  .from(products)
  .leftJoin(billOfMaterials, eq(billOfMaterials.productId, products.id));
  
  return result;
}

// Get vendor for a raw material (preferred or first available)
export async function getPreferredVendorForMaterial(rawMaterialId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Get the raw material
  const rm = await db.select().from(rawMaterials).where(eq(rawMaterials.id, rawMaterialId)).limit(1);
  if (!rm[0]) return undefined;
  
  // Get vendor from description field (may contain supplier info) or find one that has supplied this before
  if (rm[0].description) {
    const vendor = await db.select().from(vendors)
      .where(like(vendors.name, `%${rm[0].description.split(' ')[0]}%`))
      .limit(1);
    if (vendor[0]) return vendor[0];
  }
  
  // Return first active vendor as fallback
  const anyVendor = await db.select().from(vendors)
    .where(eq(vendors.status, 'active'))
    .limit(1);
  return anyVendor[0];
}


// ============================================
// LOT/BATCH TRACKING
// ============================================

export async function createInventoryLot(data: Omit<InsertInventoryLot, 'lotCode'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const lotCode = `LOT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const result = await db.insert(inventoryLots).values({ ...data, lotCode });
  return { id: result[0].insertId, lotCode };
}

export async function getInventoryLots(filters?: { productId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.productId) conditions.push(eq(inventoryLots.productId, filters.productId));
  if (filters?.status) conditions.push(eq(inventoryLots.status, filters.status as any));
  return db.select().from(inventoryLots)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryLots.createdAt));
}

export async function getInventoryLotById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inventoryLots).where(eq(inventoryLots.id, id)).limit(1);
  return result[0];
}

export async function updateInventoryLot(id: number, data: Partial<InsertInventoryLot>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inventoryLots).set(data).where(eq(inventoryLots.id, id));
}

// Inventory Balances (lot-level)
export async function getInventoryBalances(filters?: { lotId?: number; productId?: number; warehouseId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.lotId) conditions.push(eq(inventoryBalances.lotId, filters.lotId));
  if (filters?.productId) conditions.push(eq(inventoryBalances.productId, filters.productId));
  if (filters?.warehouseId) conditions.push(eq(inventoryBalances.warehouseId, filters.warehouseId));
  if (filters?.status) conditions.push(eq(inventoryBalances.status, filters.status as any));
  return db.select().from(inventoryBalances)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryBalances.updatedAt));
}

export async function upsertInventoryBalance(lotId: number, productId: number, warehouseId: number, status: string, quantity: number, unit: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(inventoryBalances)
    .where(and(
      eq(inventoryBalances.lotId, lotId),
      eq(inventoryBalances.warehouseId, warehouseId),
      eq(inventoryBalances.status, status as any)
    ))
    .limit(1);
  
  if (existing[0]) {
    await db.update(inventoryBalances)
      .set({ quantity: quantity.toString(), updatedAt: new Date() })
      .where(eq(inventoryBalances.id, existing[0].id));
    return { id: existing[0].id };
  } else {
    const result = await db.insert(inventoryBalances).values({
      lotId,
      productId,
      warehouseId,
      status: status as any,
      quantity: quantity.toString(),
      unit
    });
    return { id: result[0].insertId };
  }
}

export async function updateInventoryBalanceQuantity(id: number, quantityChange: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const balance = await db.select().from(inventoryBalances).where(eq(inventoryBalances.id, id)).limit(1);
  if (!balance[0]) throw new Error("Balance not found");
  
  const newQty = parseFloat(balance[0].quantity) + quantityChange;
  await db.update(inventoryBalances)
    .set({ quantity: newQty.toString(), updatedAt: new Date() })
    .where(eq(inventoryBalances.id, id));
  return { newQuantity: newQty };
}

// Inventory Transactions (ledger)
export async function createInventoryTransaction(data: Omit<InsertInventoryTransaction, 'transactionNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const transactionNumber = `TXN-${Date.now().toString(36).toUpperCase()}`;
  const result = await db.insert(inventoryTransactions).values({ ...data, transactionNumber });
  return { id: result[0].insertId, transactionNumber };
}

export async function getInventoryTransactionHistory(filters?: { productId?: number; lotId?: number; warehouseId?: number; type?: string }, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.productId) conditions.push(eq(inventoryTransactions.productId, filters.productId));
  if (filters?.lotId) conditions.push(eq(inventoryTransactions.lotId, filters.lotId));
  if (filters?.warehouseId) conditions.push(or(
    eq(inventoryTransactions.fromWarehouseId, filters.warehouseId),
    eq(inventoryTransactions.toWarehouseId, filters.warehouseId)
  ));
  if (filters?.type) conditions.push(eq(inventoryTransactions.transactionType, filters.type as any));
  
  return db.select().from(inventoryTransactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryTransactions.performedAt))
    .limit(limit);
}

// Reserve inventory (available -> reserved)
export async function reserveInventory(lotId: number, productId: number, warehouseId: number, quantity: number, referenceType: string, referenceId: number, performedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get available balance
  const available = await db.select().from(inventoryBalances)
    .where(and(
      eq(inventoryBalances.lotId, lotId),
      eq(inventoryBalances.warehouseId, warehouseId),
      eq(inventoryBalances.status, 'available')
    ))
    .limit(1);
  
  if (!available[0] || parseFloat(available[0].quantity) < quantity) {
    throw new Error("Insufficient available inventory");
  }
  
  const previousBalance = parseFloat(available[0].quantity);
  const newAvailable = previousBalance - quantity;
  
  // Decrease available
  await db.update(inventoryBalances)
    .set({ quantity: newAvailable.toString(), updatedAt: new Date() })
    .where(eq(inventoryBalances.id, available[0].id));
  
  // Increase reserved
  await upsertInventoryBalance(lotId, productId, warehouseId, 'reserved', quantity, available[0].unit);
  
  // Create transaction
  await createInventoryTransaction({
    transactionType: 'reserve',
    lotId,
    productId,
    fromWarehouseId: warehouseId,
    toWarehouseId: warehouseId,
    fromStatus: 'available',
    toStatus: 'reserved',
    quantity: quantity.toString(),
    unit: available[0].unit,
    previousBalance: previousBalance.toString(),
    newBalance: newAvailable.toString(),
    referenceType,
    referenceId,
    performedBy
  });
  
  return { success: true };
}

// Release reservation (reserved -> available)
export async function releaseReservation(lotId: number, productId: number, warehouseId: number, quantity: number, referenceType: string, referenceId: number, performedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get reserved balance
  const reserved = await db.select().from(inventoryBalances)
    .where(and(
      eq(inventoryBalances.lotId, lotId),
      eq(inventoryBalances.warehouseId, warehouseId),
      eq(inventoryBalances.status, 'reserved')
    ))
    .limit(1);
  
  if (!reserved[0] || parseFloat(reserved[0].quantity) < quantity) {
    throw new Error("Insufficient reserved inventory");
  }
  
  const previousReserved = parseFloat(reserved[0].quantity);
  const newReserved = previousReserved - quantity;
  
  // Decrease reserved
  await db.update(inventoryBalances)
    .set({ quantity: newReserved.toString(), updatedAt: new Date() })
    .where(eq(inventoryBalances.id, reserved[0].id));
  
  // Get or create available balance
  const available = await db.select().from(inventoryBalances)
    .where(and(
      eq(inventoryBalances.lotId, lotId),
      eq(inventoryBalances.warehouseId, warehouseId),
      eq(inventoryBalances.status, 'available')
    ))
    .limit(1);
  
  const previousAvailable = available[0] ? parseFloat(available[0].quantity) : 0;
  const newAvailable = previousAvailable + quantity;
  
  await upsertInventoryBalance(lotId, productId, warehouseId, 'available', newAvailable, reserved[0].unit);
  
  // Create transaction
  await createInventoryTransaction({
    transactionType: 'release',
    lotId,
    productId,
    fromWarehouseId: warehouseId,
    toWarehouseId: warehouseId,
    fromStatus: 'reserved',
    toStatus: 'available',
    quantity: quantity.toString(),
    unit: reserved[0].unit,
    previousBalance: previousReserved.toString(),
    newBalance: newReserved.toString(),
    referenceType,
    referenceId,
    performedBy
  });
  
  return { success: true };
}

// Ship inventory (reserved -> 0, decreases on_hand)
export async function shipInventory(lotId: number, productId: number, warehouseId: number, quantity: number, referenceType: string, referenceId: number, performedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get reserved balance
  const reserved = await db.select().from(inventoryBalances)
    .where(and(
      eq(inventoryBalances.lotId, lotId),
      eq(inventoryBalances.warehouseId, warehouseId),
      eq(inventoryBalances.status, 'reserved')
    ))
    .limit(1);
  
  if (!reserved[0] || parseFloat(reserved[0].quantity) < quantity) {
    throw new Error("Insufficient reserved inventory to ship");
  }
  
  const previousReserved = parseFloat(reserved[0].quantity);
  const newReserved = previousReserved - quantity;
  
  // Decrease reserved
  await db.update(inventoryBalances)
    .set({ quantity: newReserved.toString(), updatedAt: new Date() })
    .where(eq(inventoryBalances.id, reserved[0].id));
  
  // Create transaction
  await createInventoryTransaction({
    transactionType: 'ship',
    lotId,
    productId,
    fromWarehouseId: warehouseId,
    fromStatus: 'reserved',
    quantity: quantity.toString(),
    unit: reserved[0].unit,
    previousBalance: previousReserved.toString(),
    newBalance: newReserved.toString(),
    referenceType,
    referenceId,
    performedBy
  });
  
  return { success: true };
}

// ============================================
// WORK ORDER OUTPUTS
// ============================================

export async function createWorkOrderOutput(workOrderId: number, productId: number, quantity: number, warehouseId: number, yieldPercent?: number, performedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Create a new lot for the output
  const { id: lotId, lotCode } = await createInventoryLot({
    productId,
    productType: 'finished',
    sourceType: 'production',
    sourceReferenceId: workOrderId,
    status: 'active',
    manufactureDate: new Date()
  });
  
  // Create the work order output record
  const result = await db.insert(workOrderOutputs).values({
    workOrderId,
    lotId,
    productId,
    quantity: quantity.toString(),
    yieldPercent: yieldPercent?.toString(),
    warehouseId,
    producedBy: performedBy
  });
  
  // Create inventory balance for the new lot
  await upsertInventoryBalance(lotId, productId, warehouseId, 'available', quantity, 'EA');
  
  // Create inventory transaction
  await createInventoryTransaction({
    transactionType: 'receive',
    lotId,
    productId,
    toWarehouseId: warehouseId,
    toStatus: 'available',
    quantity: quantity.toString(),
    unit: 'EA',
    newBalance: quantity.toString(),
    referenceType: 'work_order',
    referenceId: workOrderId,
    performedBy,
    reason: 'Production output'
  });
  
  return { id: result[0].insertId, lotId, lotCode };
}

export async function getWorkOrderOutputs(workOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workOrderOutputs)
    .where(eq(workOrderOutputs.workOrderId, workOrderId))
    .orderBy(desc(workOrderOutputs.producedAt));
}

// ============================================
// ALERT SYSTEM
// ============================================

export async function createAlert(data: Omit<InsertAlert, 'alertNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const alertNumber = `ALT-${Date.now().toString(36).toUpperCase()}`;
  const result = await db.insert(alerts).values({ ...data, alertNumber });
  return { id: result[0].insertId, alertNumber };
}

export async function getAlerts(filters?: { type?: string; status?: string; severity?: string; assignedTo?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.type) conditions.push(eq(alerts.type, filters.type as any));
  if (filters?.status) conditions.push(eq(alerts.status, filters.status as any));
  if (filters?.severity) conditions.push(eq(alerts.severity, filters.severity as any));
  if (filters?.assignedTo) conditions.push(eq(alerts.assignedTo, filters.assignedTo));
  
  return db.select().from(alerts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alerts.createdAt));
}

export async function getAlertById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
  return result[0];
}

export async function updateAlert(id: number, data: Partial<InsertAlert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(alerts).set(data).where(eq(alerts.id, id));
}

export async function acknowledgeAlert(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(alerts).set({
    status: 'acknowledged',
    acknowledgedBy: userId,
    acknowledgedAt: new Date()
  }).where(eq(alerts.id, id));
}

export async function resolveAlert(id: number, userId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(alerts).set({
    status: 'resolved',
    resolvedBy: userId,
    resolvedAt: new Date(),
    resolutionNotes: notes
  }).where(eq(alerts.id, id));
}

// Generate low stock alerts
export async function generateLowStockAlerts() {
  const db = await getDb();
  if (!db) return [];
  
  // Check raw materials below reorder point
  const lowStockMaterials = await db.select().from(rawMaterialInventory)
    .where(sql`${rawMaterialInventory.quantity} <= ${rawMaterialInventory.reorderPoint}`);
  
  const createdAlerts: number[] = [];
  
  for (const material of lowStockMaterials) {
    // Check if alert already exists
    const existing = await db.select().from(alerts)
      .where(and(
        eq(alerts.type, 'low_stock'),
        eq(alerts.entityType, 'raw_material'),
        eq(alerts.entityId, material.rawMaterialId),
        eq(alerts.status, 'open')
      ))
      .limit(1);
    
    if (!existing[0]) {
      const rawMat = await getRawMaterialById(material.rawMaterialId);
      const { id } = await createAlert({
        type: 'low_stock',
        severity: parseFloat(material.quantity) === 0 ? 'critical' : 'warning',
        title: `Low stock: ${rawMat?.name || 'Unknown material'}`,
        description: `Current quantity (${material.quantity}) is at or below reorder point (${material.reorderPoint})`,
        entityType: 'raw_material',
        entityId: material.rawMaterialId,
        thresholdValue: material.reorderPoint || '0',
        actualValue: material.quantity,
        autoGenerated: true
      });
      createdAlerts.push(id);
    }
  }
  
  return createdAlerts;
}

// Recommendations
export async function createRecommendation(data: InsertRecommendation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recommendations).values(data);
  return { id: result[0].insertId };
}

export async function getRecommendations(filters?: { status?: string; type?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(recommendations.status, filters.status as any));
  if (filters?.type) conditions.push(eq(recommendations.type, filters.type as any));
  
  return db.select().from(recommendations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(recommendations.createdAt));
}

export async function approveRecommendation(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recommendations).set({
    status: 'approved',
    approvedBy: userId,
    approvedAt: new Date()
  }).where(eq(recommendations.id, id));
}

export async function rejectRecommendation(id: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recommendations).set({
    status: 'rejected',
    rejectedBy: userId,
    rejectedAt: new Date(),
    rejectionReason: reason
  }).where(eq(recommendations.id, id));
}

// ============================================
// SHOPIFY INTEGRATION
// ============================================

export async function getShopifyStores() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shopifyStores).orderBy(shopifyStores.storeName);
}

export async function getShopifyStoreById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shopifyStores).where(eq(shopifyStores.id, id)).limit(1);
  return result[0];
}

export async function getShopifyStoreByDomain(domain: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shopifyStores).where(eq(shopifyStores.storeDomain, domain)).limit(1);
  return result[0];
}

export async function createShopifyStore(data: InsertShopifyStore) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(shopifyStores).values(data);
  return { id: result[0].insertId };
}

export async function updateShopifyStore(id: number, data: Partial<InsertShopifyStore>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(shopifyStores).set(data).where(eq(shopifyStores.id, id));
}

// Webhook Events
export async function createWebhookEvent(data: InsertWebhookEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(webhookEvents).values(data);
  return { id: result[0].insertId };
}

export async function getWebhookEventByIdempotencyKey(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(webhookEvents).where(eq(webhookEvents.idempotencyKey, key)).limit(1);
  return result[0];
}

export async function updateWebhookEvent(id: number, data: Partial<InsertWebhookEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(webhookEvents).set(data).where(eq(webhookEvents.id, id));
}

// SKU Mappings
export async function getShopifySkuMappings(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shopifySkuMappings).where(eq(shopifySkuMappings.storeId, storeId));
}

export async function createShopifySkuMapping(data: InsertShopifySkuMapping) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(shopifySkuMappings).values(data);
  return { id: result[0].insertId };
}

export async function getProductByShopifySku(storeId: number, shopifyVariantId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const mapping = await db.select().from(shopifySkuMappings)
    .where(and(
      eq(shopifySkuMappings.storeId, storeId),
      eq(shopifySkuMappings.shopifyVariantId, shopifyVariantId),
      eq(shopifySkuMappings.isActive, true)
    ))
    .limit(1);
  
  if (!mapping[0]) return undefined;
  return getProductById(mapping[0].productId);
}

// Location Mappings
export async function getShopifyLocationMappings(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shopifyLocationMappings).where(eq(shopifyLocationMappings.storeId, storeId));
}

export async function createShopifyLocationMapping(data: InsertShopifyLocationMapping) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(shopifyLocationMappings).values(data);
  return { id: result[0].insertId };
}

export async function getWarehouseByShopifyLocation(storeId: number, shopifyLocationId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const mapping = await db.select().from(shopifyLocationMappings)
    .where(and(
      eq(shopifyLocationMappings.storeId, storeId),
      eq(shopifyLocationMappings.shopifyLocationId, shopifyLocationId),
      eq(shopifyLocationMappings.isActive, true)
    ))
    .limit(1);
  
  if (!mapping[0]) return undefined;
  return getWarehouseById(mapping[0].warehouseId);
}

// ============================================
// SALES ORDERS & RESERVATIONS
// ============================================

export async function createSalesOrder(data: Omit<InsertSalesOrder, 'orderNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const orderNumber = `SO-${Date.now().toString(36).toUpperCase()}`;
  const result = await db.insert(salesOrders).values({ ...data, orderNumber });
  return { id: result[0].insertId, orderNumber };
}

export async function getSalesOrders(filters?: { status?: string; source?: string; customerId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(salesOrders.status, filters.status as any));
  if (filters?.source) conditions.push(eq(salesOrders.source, filters.source as any));
  if (filters?.customerId) conditions.push(eq(salesOrders.customerId, filters.customerId));
  
  return db.select().from(salesOrders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(salesOrders.orderDate));
}

export async function getSalesOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
  return result[0];
}

export async function getSalesOrderByShopifyId(shopifyOrderId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(salesOrders).where(eq(salesOrders.shopifyOrderId, shopifyOrderId)).limit(1);
  return result[0];
}

export async function updateSalesOrder(id: number, data: Partial<InsertSalesOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(salesOrders).set(data).where(eq(salesOrders.id, id));
}

export async function createSalesOrderLine(data: InsertSalesOrderLine) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(salesOrderLines).values(data);
  return { id: result[0].insertId };
}

export async function getSalesOrderLines(salesOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(salesOrderLines).where(eq(salesOrderLines.salesOrderId, salesOrderId));
}

// Inventory Reservations
export async function createInventoryReservation(data: InsertInventoryReservation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(inventoryReservations).values(data);
  return { id: result[0].insertId };
}

export async function getInventoryReservations(salesOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryReservations).where(eq(inventoryReservations.salesOrderId, salesOrderId));
}

export async function updateInventoryReservation(id: number, data: Partial<InsertInventoryReservation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inventoryReservations).set(data).where(eq(inventoryReservations.id, id));
}

// ============================================
// INVENTORY ALLOCATION
// ============================================

export async function createInventoryAllocation(data: InsertInventoryAllocation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(inventoryAllocations).values(data);
  return { id: result[0].insertId };
}

export async function getInventoryAllocations(filters?: { channel?: string; productId?: number; storeId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.channel) conditions.push(eq(inventoryAllocations.channel, filters.channel as any));
  if (filters?.productId) conditions.push(eq(inventoryAllocations.productId, filters.productId));
  if (filters?.storeId) conditions.push(eq(inventoryAllocations.storeId, filters.storeId));
  
  return db.select().from(inventoryAllocations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryAllocations.updatedAt));
}

export async function updateInventoryAllocation(id: number, data: Partial<InsertInventoryAllocation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inventoryAllocations).set(data).where(eq(inventoryAllocations.id, id));
}

// Sales Events
export async function createSalesEvent(data: InsertSalesEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(salesEvents).values(data);
  return { id: result[0].insertId };
}

export async function getSalesEvents(filters?: { source?: string; salesOrderId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.source) conditions.push(eq(salesEvents.source, filters.source as any));
  if (filters?.salesOrderId) conditions.push(eq(salesEvents.salesOrderId, filters.salesOrderId));
  
  return db.select().from(salesEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(salesEvents.processedAt));
}

// ============================================
// INVENTORY RECONCILIATION
// ============================================

export async function createReconciliationRun(data: Omit<InsertReconciliationRun, 'runNumber'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const runNumber = `REC-${Date.now().toString(36).toUpperCase()}`;
  const result = await db.insert(reconciliationRuns).values({ ...data, runNumber });
  return { id: result[0].insertId, runNumber };
}

export async function getReconciliationRuns(filters?: { status?: string; channel?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(reconciliationRuns.status, filters.status as any));
  if (filters?.channel) conditions.push(eq(reconciliationRuns.channel, filters.channel as any));
  
  return db.select().from(reconciliationRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reconciliationRuns.startedAt));
}

export async function getReconciliationRunById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reconciliationRuns).where(eq(reconciliationRuns.id, id)).limit(1);
  return result[0];
}

export async function updateReconciliationRun(id: number, data: Partial<InsertReconciliationRun>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reconciliationRuns).set(data).where(eq(reconciliationRuns.id, id));
}

export async function createReconciliationLine(data: InsertReconciliationLine) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reconciliationLines).values(data);
  return { id: result[0].insertId };
}

export async function getReconciliationLines(runId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reconciliationLines)
    .where(eq(reconciliationLines.runId, runId))
    .orderBy(reconciliationLines.status);
}

// Run reconciliation for a channel
export async function runInventoryReconciliation(channel: 'shopify' | 'amazon' | 'all', storeId?: number, initiatedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Create reconciliation run
  const { id: runId, runNumber } = await createReconciliationRun({
    type: 'manual',
    channel,
    storeId,
    status: 'running',
    initiatedBy
  });
  
  try {
    // Get all allocations for this channel
    const allocations = await getInventoryAllocations({ 
      channel: channel === 'all' ? undefined : channel,
      storeId 
    });
    
    let totalSkus = 0;
    let passedSkus = 0;
    let warningSkus = 0;
    let criticalSkus = 0;
    
    for (const allocation of allocations) {
      totalSkus++;
      
      const erpQty = parseFloat(allocation.remainingQuantity);
      const channelQty = allocation.channelReportedQuantity ? parseFloat(allocation.channelReportedQuantity) : 0;
      const delta = erpQty - channelQty;
      const variancePercent = erpQty > 0 ? Math.abs(delta / erpQty * 100) : (channelQty > 0 ? 100 : 0);
      
      // Determine status based on thresholds
      let status: 'pass' | 'warning' | 'critical' = 'pass';
      if (Math.abs(delta) <= 1 || variancePercent <= 0.5) {
        status = 'pass';
        passedSkus++;
      } else if (variancePercent > 3) {
        status = 'critical';
        criticalSkus++;
      } else {
        status = 'warning';
        warningSkus++;
      }
      
      // Get product SKU
      const product = await getProductById(allocation.productId);
      
      await createReconciliationLine({
        runId,
        productId: allocation.productId,
        sku: product?.sku,
        warehouseId: allocation.warehouseId,
        erpQuantity: erpQty.toString(),
        channelQuantity: channelQty.toString(),
        deltaQuantity: delta.toString(),
        variancePercent: variancePercent.toString(),
        status
      });
    }
    
    // Update run with results
    await updateReconciliationRun(runId, {
      status: 'completed',
      completedAt: new Date(),
      totalSkus,
      passedSkus,
      warningSkus,
      criticalSkus
    });
    
    // Create alerts for critical variances
    if (criticalSkus > 0) {
      await createAlert({
        type: 'reconciliation_variance',
        severity: 'critical',
        title: `Inventory reconciliation found ${criticalSkus} critical variances`,
        description: `Reconciliation run ${runNumber} completed with ${criticalSkus} SKUs having variance > 3%`,
        entityType: 'reconciliation_run',
        entityId: runId,
        autoGenerated: true
      });
    }
    
    return { runId, runNumber, totalSkus, passedSkus, warningSkus, criticalSkus };
  } catch (error) {
    await updateReconciliationRun(runId, {
      status: 'failed',
      completedAt: new Date(),
      notes: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

// Get available inventory (not reserved) for a product
export async function getAvailableInventoryByProduct(productId: number) {
  const db = await getDb();
  if (!db) return { available: 0, reserved: 0, total: 0 };
  
  const balances = await db.select({
    status: inventoryBalances.status,
    totalQty: sum(inventoryBalances.quantity)
  })
    .from(inventoryBalances)
    .where(eq(inventoryBalances.productId, productId))
    .groupBy(inventoryBalances.status);
  
  let available = 0;
  let reserved = 0;
  
  for (const b of balances) {
    if (b.status === 'available') available = parseFloat(b.totalQty || '0');
    if (b.status === 'reserved') reserved = parseFloat(b.totalQty || '0');
  }
  
  return { available, reserved, total: available + reserved };
}


// ============================================
// SYNC LOGS
// ============================================

export async function createSyncLog(data: {
  integration: string;
  action: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  details?: string;
  recordsProcessed?: number;
  recordsFailed?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(syncLogs).values({
    integration: data.integration,
    action: data.action,
    status: data.status,
    details: data.details || null,
    recordsProcessed: data.recordsProcessed || null,
    recordsFailed: data.recordsFailed || null,
    errorMessage: data.errorMessage || null,
    metadata: data.metadata || null,
  });
  return { id: result.insertId };
}

export async function getSyncHistory(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(syncLogs)
    .orderBy(desc(syncLogs.createdAt))
    .limit(limit);
}

export async function clearSyncHistory() {
  const db = await getDb();
  if (!db) return;
  await db.delete(syncLogs);
}


// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

export type NotificationType = 
  | "shipping_update" | "inventory_low" | "inventory_received" | "inventory_adjustment"
  | "po_approved" | "po_shipped" | "po_received" | "po_fulfilled"
  | "work_order_started" | "work_order_completed" | "work_order_shortage"
  | "sales_order_new" | "sales_order_shipped" | "sales_order_delivered"
  | "alert" | "system" | "info" | "warning" | "error" | "success" | "reminder";

export interface CreateNotificationInput {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  severity?: "info" | "warning" | "critical";
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput) {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    entityType: input.entityType,
    entityId: input.entityId,
    severity: input.severity || "info",
    link: input.link,
    metadata: input.metadata,
    isRead: false,
  });
  
  return result.insertId;
}

export async function createNotificationsForAllUsers(
  input: Omit<CreateNotificationInput, "userId">,
  userIds: number[]
) {
  const db = await getDb();
  if (!db || userIds.length === 0) return [];
  
  const notificationValues = userIds.map(userId => ({
    userId,
    type: input.type,
    title: input.title,
    message: input.message,
    entityType: input.entityType,
    entityId: input.entityId,
    severity: input.severity || "info" as const,
    link: input.link,
    metadata: input.metadata,
    isRead: false,
  }));
  
  await db.insert(notifications).values(notificationValues);
  return notificationValues.length;
}

export async function getUserNotifications(userId: number, options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(notifications.userId, userId)];
  if (options?.unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }
  
  return db.select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
  
  return result?.count || 0;
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));
  
  return true;
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
  
  return true;
}

export async function deleteNotification(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(notifications)
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));
  
  return true;
}

export async function deleteOldNotifications(daysOld: number = 30) {
  const db = await getDb();
  if (!db) return 0;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const [result] = await db.delete(notifications)
    .where(lt(notifications.createdAt, cutoffDate));
  
  return result.affectedRows || 0;
}

// Notification preferences
export async function getUserNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
}

export async function updateNotificationPreference(
  userId: number,
  notificationType: string,
  settings: { inApp?: boolean; email?: boolean; push?: boolean }
) {
  const db = await getDb();
  if (!db) return false;
  
  // Check if preference exists
  const existing = await db.select()
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.notificationType, notificationType)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(notificationPreferences)
      .set(settings)
      .where(and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, notificationType)
      ));
  } else {
    await db.insert(notificationPreferences).values({
      userId,
      notificationType,
      inApp: settings.inApp ?? true,
      email: settings.email ?? false,
      push: settings.push ?? false,
    });
  }
  
  return true;
}

// Helper to check if user should receive notification
export async function shouldNotifyUser(userId: number, notificationType: string, channel: "inApp" | "email" | "push") {
  const db = await getDb();
  if (!db) return channel === "inApp"; // Default to in-app only
  
  const [pref] = await db.select()
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.notificationType, notificationType)
    ))
    .limit(1);
  
  if (!pref) return channel === "inApp"; // Default to in-app only
  
  return pref[channel] ?? false;
}

// Bulk notification creation for events
export async function notifyUsersOfEvent(
  event: {
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: number;
    severity?: "info" | "warning" | "critical";
    link?: string;
    metadata?: Record<string, unknown>;
  },
  userIds: number[]
) {
  const db = await getDb();
  if (!db || userIds.length === 0) return { inApp: 0, email: 0 };
  
  let inAppCount = 0;
  let emailCount = 0;
  
  for (const userId of userIds) {
    const shouldInApp = await shouldNotifyUser(userId, event.type, "inApp");
    const shouldEmail = await shouldNotifyUser(userId, event.type, "email");
    
    if (shouldInApp) {
      await createNotification({ ...event, userId });
      inAppCount++;
    }
    
    // Email notifications would be handled here with SendGrid
    if (shouldEmail) {
      emailCount++;
      // TODO: Send email notification via SendGrid
    }
  }
  
  return { inApp: inAppCount, email: emailCount };
}


// ============================================
// EMAIL SCANNING & DOCUMENT PARSING
// ============================================

export async function createInboundEmail(input: InsertInboundEmail) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(inboundEmails).values(input);
  return { id: result[0].insertId };
}

export async function getInboundEmails(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  if (options?.status) {
    return db.select().from(inboundEmails)
      .where(eq(inboundEmails.parsingStatus, options.status as any))
      .orderBy(desc(inboundEmails.receivedAt))
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);
  }
  
  return db.select().from(inboundEmails)
    .orderBy(desc(inboundEmails.receivedAt))
    .limit(options?.limit || 100)
    .offset(options?.offset || 0);
}

export async function getInboundEmailById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(inboundEmails).where(eq(inboundEmails.id, id));
  return result[0] || null;
}

export async function updateInboundEmailStatus(
  id: number,
  status: "pending" | "processing" | "parsed" | "failed" | "reviewed" | "archived",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updates: any = { parsingStatus: status };
  if (status === "parsed") {
    updates.parsedAt = new Date();
  }
  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }
  
  await db.update(inboundEmails).set(updates).where(eq(inboundEmails.id, id));
}

export async function createEmailAttachment(input: InsertEmailAttachment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emailAttachments).values(input);
  return { id: result[0].insertId };
}

export async function getEmailAttachments(emailId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(emailAttachments).where(eq(emailAttachments.emailId, emailId));
}

export async function updateAttachmentProcessed(id: number, extractedText?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(emailAttachments).set({
    isProcessed: true,
    extractedText: extractedText || null
  }).where(eq(emailAttachments.id, id));
}

export async function createParsedDocument(input: InsertParsedDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(parsedDocuments).values(input);
  return { id: result[0].insertId };
}

export async function getParsedDocuments(options?: {
  emailId?: number;
  documentType?: string;
  isReviewed?: boolean;
  isApproved?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options?.emailId) {
    conditions.push(eq(parsedDocuments.emailId, options.emailId));
  }
  
  if (options?.documentType) {
    conditions.push(eq(parsedDocuments.documentType, options.documentType as any));
  }
  
  if (options?.isReviewed !== undefined) {
    conditions.push(eq(parsedDocuments.isReviewed, options.isReviewed));
  }
  
  if (options?.isApproved !== undefined) {
    conditions.push(eq(parsedDocuments.isApproved, options.isApproved));
  }
  
  let query = db.select().from(parsedDocuments);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(parsedDocuments.createdAt))
    .limit(options?.limit || 100)
    .offset(options?.offset || 0);
}

export async function getParsedDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(parsedDocuments).where(eq(parsedDocuments.id, id));
  return result[0] || null;
}

export async function updateParsedDocument(id: number, updates: Partial<InsertParsedDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(parsedDocuments).set(updates).where(eq(parsedDocuments.id, id));
}

export async function approveParsedDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(parsedDocuments).set({
    isReviewed: true,
    isApproved: true,
    reviewedBy: userId,
    reviewedAt: new Date()
  }).where(eq(parsedDocuments.id, id));
}

export async function rejectParsedDocument(id: number, userId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(parsedDocuments).set({
    isReviewed: true,
    isApproved: false,
    reviewedBy: userId,
    reviewedAt: new Date(),
    notes: notes || null
  }).where(eq(parsedDocuments.id, id));
}

export async function createParsedDocumentLineItem(input: InsertParsedDocumentLineItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(parsedDocumentLineItems).values(input);
  return { id: result[0].insertId };
}

export async function getParsedDocumentLineItems(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(parsedDocumentLineItems)
    .where(eq(parsedDocumentLineItems.documentId, documentId))
    .orderBy(parsedDocumentLineItems.lineNumber);
}

export async function linkParsedDocumentToVendor(documentId: number, vendorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(parsedDocuments).set({ vendorId }).where(eq(parsedDocuments.id, documentId));
}

export async function linkParsedDocumentToPO(documentId: number, purchaseOrderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(parsedDocuments).set({ purchaseOrderId }).where(eq(parsedDocuments.id, documentId));
}

export async function linkParsedDocumentToShipment(documentId: number, shipmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(parsedDocuments).set({ shipmentId }).where(eq(parsedDocuments.id, documentId));
}

export async function setCreatedTransaction(documentId: number, transactionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(parsedDocuments).set({ createdTransactionId: transactionId }).where(eq(parsedDocuments.id, documentId));
}

export async function setCreatedVendor(documentId: number, vendorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(parsedDocuments).set({ createdVendorId: vendorId, vendorId }).where(eq(parsedDocuments.id, documentId));
}

// Find vendor by email domain or name match
export async function findVendorByEmailOrName(email?: string, name?: string) {
  const db = await getDb();
  if (!db) return null;
  
  if (email) {
    // Try to match by email
    const byEmail = await db.select().from(vendors).where(eq(vendors.email, email));
    if (byEmail.length > 0) return byEmail[0];
    
    // Try to match by email domain
    const domain = email.split("@")[1];
    if (domain) {
      const byDomain = await db.select().from(vendors).where(
        sql`${vendors.email} LIKE ${`%@${domain}`}`
      );
      if (byDomain.length > 0) return byDomain[0];
    }
  }
  
  if (name) {
    // Try exact match first
    const byName = await db.select().from(vendors).where(eq(vendors.name, name));
    if (byName.length > 0) return byName[0];
    
    // Try partial match
    const byPartialName = await db.select().from(vendors).where(
      sql`LOWER(${vendors.name}) LIKE ${`%${name.toLowerCase()}%`}`
    );
    if (byPartialName.length > 0) return byPartialName[0];
  }
  
  return null;
}

// Find PO by number
export async function findPurchaseOrderByNumber(poNumber: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(purchaseOrders).where(
    sql`${purchaseOrders.poNumber} = ${poNumber} OR ${purchaseOrders.poNumber} LIKE ${`%${poNumber}%`}`
  );
  return result[0] || null;
}

// Find shipment by tracking number
export async function findShipmentByTracking(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(shipments).where(
    eq(shipments.trackingNumber, trackingNumber)
  );
  return result[0] || null;
}

// Get email scanning statistics
export async function getEmailScanningStats() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, parsed: 0, failed: 0, documents: 0 };
  
  const emails = await db.select({
    status: inboundEmails.parsingStatus,
    count: sql<number>`COUNT(*)`
  }).from(inboundEmails).groupBy(inboundEmails.parsingStatus);
  
  const docCount = await db.select({
    count: sql<number>`COUNT(*)`
  }).from(parsedDocuments);
  
  const stats = {
    total: 0,
    pending: 0,
    processing: 0,
    parsed: 0,
    failed: 0,
    reviewed: 0,
    documents: Number(docCount[0]?.count) || 0
  };
  
  for (const row of emails) {
    stats.total += Number(row.count);
    if (row.status === "pending") stats.pending = Number(row.count);
    if (row.status === "processing") stats.processing = Number(row.count);
    if (row.status === "parsed") stats.parsed = Number(row.count);
    if (row.status === "failed") stats.failed = Number(row.count);
    if (row.status === "reviewed") stats.reviewed = Number(row.count);
  }
  
  return stats;
}
