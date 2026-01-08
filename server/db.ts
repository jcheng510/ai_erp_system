import { eq, desc, and, sql, gte, lte, like, or, count, sum } from "drizzle-orm";
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
  InsertCompany, InsertCustomer, InsertVendor, InsertProduct,
  InsertAccount, InsertInvoice, InsertPayment, InsertTransaction,
  InsertOrder, InsertInventory, InsertPurchaseOrder, InsertWarehouse,
  InsertEmployee, InsertContract, InsertDispute, InsertDocument,
  InsertProject, InsertAuditLog,
  InsertFreightCarrier, InsertFreightRfq, InsertFreightQuote, InsertFreightEmail,
  InsertCustomsClearance, InsertCustomsDocument, InsertFreightBooking,
  InsertInventoryTransfer, InsertInventoryTransferItem
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

// ============================================
// NOTIFICATIONS
// ============================================

export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

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
