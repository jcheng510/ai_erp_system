import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ============================================
// USER & ACCESS CONTROL
// ============================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "finance", "ops", "legal", "exec"]).default("user").notNull(),
  departmentId: int("departmentId"),
  avatarUrl: text("avatarUrl"),
  phone: varchar("phone", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Google OAuth tokens for Drive/Sheets access
export const googleOAuthTokens = mysqlTable("googleOAuthTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenType: varchar("tokenType", { length: 32 }).default("Bearer"),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  googleEmail: varchar("googleEmail", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleOAuthToken = typeof googleOAuthTokens.$inferSelect;
export type InsertGoogleOAuthToken = typeof googleOAuthTokens.$inferInsert;

// ============================================
// CORE ENTITIES
// ============================================

export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  legalName: varchar("legalName", { length: 255 }),
  taxId: varchar("taxId", { length: 64 }),
  type: mysqlEnum("type", ["parent", "subsidiary", "branch"]).default("parent").notNull(),
  parentCompanyId: int("parentCompanyId"),
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  country: varchar("country", { length: 64 }),
  postalCode: varchar("postalCode", { length: 20 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 512 }),
  industry: varchar("industry", { length: 128 }),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  country: varchar("country", { length: 64 }),
  postalCode: varchar("postalCode", { length: 20 }),
  type: mysqlEnum("type", ["individual", "business"]).default("business").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "prospect"]).default("active").notNull(),
  creditLimit: decimal("creditLimit", { precision: 15, scale: 2 }),
  paymentTerms: int("paymentTerms").default(30),
  notes: text("notes"),
  shopifyCustomerId: varchar("shopifyCustomerId", { length: 64 }),
  quickbooksCustomerId: varchar("quickbooksCustomerId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const vendors = mysqlTable("vendors", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  country: varchar("country", { length: 64 }),
  postalCode: varchar("postalCode", { length: 20 }),
  type: mysqlEnum("type", ["supplier", "contractor", "service"]).default("supplier").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active").notNull(),
  paymentTerms: int("paymentTerms").default(30),
  taxId: varchar("taxId", { length: 64 }),
  bankAccount: varchar("bankAccount", { length: 128 }),
  bankRouting: varchar("bankRouting", { length: 64 }),
  notes: text("notes"),
  quickbooksVendorId: varchar("quickbooksVendorId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  sku: varchar("sku", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }),
  type: mysqlEnum("type", ["physical", "digital", "service"]).default("physical").notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  costPrice: decimal("costPrice", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  taxable: boolean("taxable").default(true),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }),
  status: mysqlEnum("status", ["active", "inactive", "discontinued"]).default("active").notNull(),
  shopifyProductId: varchar("shopifyProductId", { length: 64 }),
  quickbooksItemId: varchar("quickbooksItemId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================
// FINANCE MODULE
// ============================================

export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
  subtype: varchar("subtype", { length: 64 }),
  description: text("description"),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  isActive: boolean("isActive").default(true),
  parentAccountId: int("parentAccountId"),
  quickbooksAccountId: varchar("quickbooksAccountId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull(),
  customerId: int("customerId"),
  type: mysqlEnum("type", ["invoice", "credit_note", "quote"]).default("invoice").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "paid", "partial", "overdue", "cancelled"]).default("draft").notNull(),
  issueDate: timestamp("issueDate").notNull(),
  dueDate: timestamp("dueDate"),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }).default("0"),
  discountAmount: decimal("discountAmount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  notes: text("notes"),
  terms: text("terms"),
  quickbooksInvoiceId: varchar("quickbooksInvoiceId", { length: 64 }),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const invoiceItems = mysqlTable("invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  productId: int("productId"),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }).default("0"),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  paymentNumber: varchar("paymentNumber", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["received", "made"]).notNull(),
  invoiceId: int("invoiceId"),
  vendorId: int("vendorId"),
  customerId: int("customerId"),
  accountId: int("accountId"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "check", "bank_transfer", "credit_card", "ach", "wire", "other"]).default("bank_transfer"),
  paymentDate: timestamp("paymentDate").notNull(),
  referenceNumber: varchar("referenceNumber", { length: 128 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("pending").notNull(),
  notes: text("notes"),
  quickbooksPaymentId: varchar("quickbooksPaymentId", { length: 64 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  transactionNumber: varchar("transactionNumber", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["journal", "invoice", "payment", "expense", "transfer", "adjustment"]).notNull(),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: int("referenceId"),
  date: timestamp("date").notNull(),
  description: text("description"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  status: mysqlEnum("status", ["draft", "posted", "void"]).default("draft").notNull(),
  createdBy: int("createdBy"),
  postedBy: int("postedBy"),
  postedAt: timestamp("postedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const transactionLines = mysqlTable("transaction_lines", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  accountId: int("accountId").notNull(),
  debit: decimal("debit", { precision: 15, scale: 2 }).default("0"),
  credit: decimal("credit", { precision: 15, scale: 2 }).default("0"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// SALES MODULE
// ============================================

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  orderNumber: varchar("orderNumber", { length: 64 }).notNull(),
  customerId: int("customerId"),
  type: mysqlEnum("type", ["sales", "return"]).default("sales").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]).default("pending").notNull(),
  orderDate: timestamp("orderDate").notNull(),
  shippingAddress: text("shippingAddress"),
  billingAddress: text("billingAddress"),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }).default("0"),
  shippingAmount: decimal("shippingAmount", { precision: 15, scale: 2 }).default("0"),
  discountAmount: decimal("discountAmount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  notes: text("notes"),
  shopifyOrderId: varchar("shopifyOrderId", { length: 64 }),
  invoiceId: int("invoiceId"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  sku: varchar("sku", { length: 64 }),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }).default("0"),
  discountAmount: decimal("discountAmount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// OPERATIONS MODULE
// ============================================

export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  productId: int("productId").notNull(),
  warehouseId: int("warehouseId"),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  reservedQuantity: decimal("reservedQuantity", { precision: 15, scale: 4 }).default("0"),
  reorderLevel: decimal("reorderLevel", { precision: 15, scale: 4 }),
  reorderQuantity: decimal("reorderQuantity", { precision: 15, scale: 4 }),
  lastCountDate: timestamp("lastCountDate"),
  lastCountQuantity: decimal("lastCountQuantity", { precision: 15, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 32 }),
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  country: varchar("country", { length: 64 }),
  postalCode: varchar("postalCode", { length: 20 }),
  type: mysqlEnum("type", ["warehouse", "store", "distribution"]).default("warehouse").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productionBatches = mysqlTable("production_batches", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  batchNumber: varchar("batchNumber", { length: 64 }).notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  status: mysqlEnum("status", ["planned", "in_progress", "completed", "cancelled"]).default("planned").notNull(),
  startDate: timestamp("startDate"),
  completionDate: timestamp("completionDate"),
  warehouseId: int("warehouseId"),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  poNumber: varchar("poNumber", { length: 64 }).notNull(),
  vendorId: int("vendorId").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "confirmed", "partial", "received", "cancelled"]).default("draft").notNull(),
  orderDate: timestamp("orderDate").notNull(),
  expectedDate: timestamp("expectedDate"),
  receivedDate: timestamp("receivedDate"),
  shippingAddress: text("shippingAddress"),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }).default("0"),
  shippingAmount: decimal("shippingAmount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  notes: text("notes"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId"),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  receivedQuantity: decimal("receivedQuantity", { precision: 15, scale: 4 }).default("0"),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const shipments = mysqlTable("shipments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  shipmentNumber: varchar("shipmentNumber", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["inbound", "outbound"]).notNull(),
  orderId: int("orderId"),
  purchaseOrderId: int("purchaseOrderId"),
  carrier: varchar("carrier", { length: 128 }),
  trackingNumber: varchar("trackingNumber", { length: 128 }),
  status: mysqlEnum("status", ["pending", "in_transit", "delivered", "returned", "cancelled"]).default("pending").notNull(),
  shipDate: timestamp("shipDate"),
  deliveryDate: timestamp("deliveryDate"),
  fromAddress: text("fromAddress"),
  toAddress: text("toAddress"),
  weight: decimal("weight", { precision: 10, scale: 2 }),
  cost: decimal("cost", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================
// HR MODULE
// ============================================

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 32 }),
  parentDepartmentId: int("parentDepartmentId"),
  managerId: int("managerId"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  userId: int("userId"),
  employeeNumber: varchar("employeeNumber", { length: 32 }),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  personalEmail: varchar("personalEmail", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  country: varchar("country", { length: 64 }),
  postalCode: varchar("postalCode", { length: 20 }),
  dateOfBirth: timestamp("dateOfBirth"),
  hireDate: timestamp("hireDate"),
  terminationDate: timestamp("terminationDate"),
  departmentId: int("departmentId"),
  managerId: int("managerId"),
  jobTitle: varchar("jobTitle", { length: 255 }),
  employmentType: mysqlEnum("employmentType", ["full_time", "part_time", "contractor", "intern"]).default("full_time").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "on_leave", "terminated"]).default("active").notNull(),
  salary: decimal("salary", { precision: 15, scale: 2 }),
  salaryFrequency: mysqlEnum("salaryFrequency", ["hourly", "weekly", "biweekly", "monthly", "annual"]).default("annual"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  bankAccount: varchar("bankAccount", { length: 128 }),
  bankRouting: varchar("bankRouting", { length: 64 }),
  taxId: varchar("taxId", { length: 64 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const compensationHistory = mysqlTable("compensation_history", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  effectiveDate: timestamp("effectiveDate").notNull(),
  salary: decimal("salary", { precision: 15, scale: 2 }).notNull(),
  salaryFrequency: mysqlEnum("salaryFrequency", ["hourly", "weekly", "biweekly", "monthly", "annual"]).default("annual"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  reason: varchar("reason", { length: 255 }),
  approvedBy: int("approvedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const employeePayments = mysqlTable("employee_payments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  employeeId: int("employeeId").notNull(),
  paymentNumber: varchar("paymentNumber", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["salary", "bonus", "commission", "reimbursement", "other"]).default("salary").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  paymentDate: timestamp("paymentDate").notNull(),
  payPeriodStart: timestamp("payPeriodStart"),
  payPeriodEnd: timestamp("payPeriodEnd"),
  paymentMethod: mysqlEnum("paymentMethod", ["check", "direct_deposit", "wire", "other"]).default("direct_deposit"),
  status: mysqlEnum("status", ["pending", "processed", "cancelled"]).default("pending").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================
// LEGAL MODULE
// ============================================

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  contractNumber: varchar("contractNumber", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["customer", "vendor", "employment", "nda", "partnership", "lease", "service", "other"]).notNull(),
  status: mysqlEnum("status", ["draft", "pending_review", "pending_signature", "active", "expired", "terminated", "renewed"]).default("draft").notNull(),
  partyType: mysqlEnum("partyType", ["customer", "vendor", "employee", "other"]),
  partyId: int("partyId"),
  partyName: varchar("partyName", { length: 255 }),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  renewalDate: timestamp("renewalDate"),
  autoRenewal: boolean("autoRenewal").default(false),
  value: decimal("value", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  description: text("description"),
  terms: text("terms"),
  documentUrl: text("documentUrl"),
  signedDocumentUrl: text("signedDocumentUrl"),
  createdBy: int("createdBy"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contractKeyDates = mysqlTable("contract_key_dates", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  dateType: varchar("dateType", { length: 64 }).notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),
  reminderDays: int("reminderDays").default(30),
  reminderSent: boolean("reminderSent").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const disputes = mysqlTable("disputes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  disputeNumber: varchar("disputeNumber", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["customer", "vendor", "employee", "legal", "regulatory", "other"]).notNull(),
  status: mysqlEnum("status", ["open", "investigating", "negotiating", "resolved", "escalated", "closed"]).default("open").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  partyType: mysqlEnum("partyType", ["customer", "vendor", "employee", "other"]),
  partyId: int("partyId"),
  partyName: varchar("partyName", { length: 255 }),
  contractId: int("contractId"),
  description: text("description"),
  resolution: text("resolution"),
  estimatedValue: decimal("estimatedValue", { precision: 15, scale: 2 }),
  actualValue: decimal("actualValue", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  filedDate: timestamp("filedDate"),
  resolvedDate: timestamp("resolvedDate"),
  assignedTo: int("assignedTo"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["contract", "invoice", "receipt", "report", "legal", "hr", "other"]).notNull(),
  category: varchar("category", { length: 128 }),
  referenceType: varchar("referenceType", { length: 64 }),
  referenceId: int("referenceId"),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 128 }),
  description: text("description"),
  tags: json("tags"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================
// PROJECTS MODULE
// ============================================

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  projectNumber: varchar("projectNumber", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["internal", "client", "product", "research", "other"]).default("internal").notNull(),
  status: mysqlEnum("status", ["planning", "active", "on_hold", "completed", "cancelled"]).default("planning").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  ownerId: int("ownerId"),
  departmentId: int("departmentId"),
  startDate: timestamp("startDate"),
  targetEndDate: timestamp("targetEndDate"),
  actualEndDate: timestamp("actualEndDate"),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  progress: int("progress").default(0),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectMilestones = mysqlTable("project_milestones", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate"),
  completedDate: timestamp("completedDate"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "overdue"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectTasks = mysqlTable("project_tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  milestoneId: int("milestoneId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  assigneeId: int("assigneeId"),
  status: mysqlEnum("status", ["todo", "in_progress", "review", "completed", "cancelled"]).default("todo").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  dueDate: timestamp("dueDate"),
  completedDate: timestamp("completedDate"),
  estimatedHours: decimal("estimatedHours", { precision: 10, scale: 2 }),
  actualHours: decimal("actualHours", { precision: 10, scale: 2 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================
// AUDIT & SYSTEM
// ============================================

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  userId: int("userId"),
  action: mysqlEnum("action", ["create", "update", "delete", "view", "export", "approve", "reject"]).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  entityName: varchar("entityName", { length: 255 }),
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["info", "warning", "error", "success", "reminder"]).default("info").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  link: varchar("link", { length: 512 }),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const integrationConfigs = mysqlTable("integration_configs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  type: mysqlEnum("type", ["quickbooks", "shopify", "stripe", "slack", "email", "webhook"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  config: json("config"),
  credentials: json("credentials"),
  isActive: boolean("isActive").default(true),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const aiMessages = mysqlTable("ai_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = typeof disputes.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ============================================
// FREIGHT & LOGISTICS MANAGEMENT
// ============================================

// Freight carriers and forwarders database
export const freightCarriers = mysqlTable("freightCarriers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["ocean", "air", "ground", "rail", "multimodal"]).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  country: varchar("country", { length: 100 }),
  website: varchar("website", { length: 500 }),
  notes: text("notes"),
  rating: int("rating"), // 1-5 star rating
  isPreferred: boolean("isPreferred").default(false),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Freight Request for Quotes (RFQ)
export const freightRfqs = mysqlTable("freightRfqs", {
  id: int("id").autoincrement().primaryKey(),
  rfqNumber: varchar("rfqNumber", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "sent", "awaiting_quotes", "quotes_received", "awarded", "cancelled"]).default("draft").notNull(),
  
  // Shipment details
  originCountry: varchar("originCountry", { length: 100 }),
  originCity: varchar("originCity", { length: 255 }),
  originAddress: text("originAddress"),
  destinationCountry: varchar("destinationCountry", { length: 100 }),
  destinationCity: varchar("destinationCity", { length: 255 }),
  destinationAddress: text("destinationAddress"),
  
  // Cargo details
  cargoDescription: text("cargoDescription"),
  cargoType: mysqlEnum("cargoType", ["general", "hazardous", "refrigerated", "oversized", "fragile", "liquid", "bulk"]).default("general"),
  totalWeight: decimal("totalWeight", { precision: 12, scale: 2 }), // in kg
  totalVolume: decimal("totalVolume", { precision: 12, scale: 2 }), // in cbm
  numberOfPackages: int("numberOfPackages"),
  dimensions: text("dimensions"), // JSON string for package dimensions
  hsCode: varchar("hsCode", { length: 20 }),
  declaredValue: decimal("declaredValue", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Shipping preferences
  preferredMode: mysqlEnum("preferredMode", ["ocean_fcl", "ocean_lcl", "air", "express", "ground", "rail", "any"]).default("any"),
  incoterms: varchar("incoterms", { length: 10 }), // EXW, FOB, CIF, DDP, etc.
  requiredPickupDate: timestamp("requiredPickupDate"),
  requiredDeliveryDate: timestamp("requiredDeliveryDate"),
  insuranceRequired: boolean("insuranceRequired").default(false),
  customsClearanceRequired: boolean("customsClearanceRequired").default(true),
  
  // Related records
  purchaseOrderId: int("purchaseOrderId"),
  vendorId: int("vendorId"),
  
  // Metadata
  notes: text("notes"),
  createdById: int("createdById"),
  quoteDueDate: timestamp("quoteDueDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Freight quotes received from carriers
export const freightQuotes = mysqlTable("freightQuotes", {
  id: int("id").autoincrement().primaryKey(),
  rfqId: int("rfqId").notNull(),
  carrierId: int("carrierId").notNull(),
  quoteNumber: varchar("quoteNumber", { length: 50 }),
  status: mysqlEnum("status", ["pending", "received", "under_review", "accepted", "rejected", "expired"]).default("pending").notNull(),
  
  // Pricing
  freightCost: decimal("freightCost", { precision: 15, scale: 2 }),
  fuelSurcharge: decimal("fuelSurcharge", { precision: 15, scale: 2 }),
  originCharges: decimal("originCharges", { precision: 15, scale: 2 }),
  destinationCharges: decimal("destinationCharges", { precision: 15, scale: 2 }),
  customsFees: decimal("customsFees", { precision: 15, scale: 2 }),
  insuranceCost: decimal("insuranceCost", { precision: 15, scale: 2 }),
  otherCharges: decimal("otherCharges", { precision: 15, scale: 2 }),
  totalCost: decimal("totalCost", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Transit details
  transitDays: int("transitDays"),
  shippingMode: varchar("shippingMode", { length: 50 }),
  routeDescription: text("routeDescription"),
  validUntil: timestamp("validUntil"),
  
  // AI analysis
  aiScore: int("aiScore"), // AI-generated score 1-100
  aiAnalysis: text("aiAnalysis"), // AI-generated analysis
  aiRecommendation: text("aiRecommendation"),
  
  // Communication
  receivedVia: mysqlEnum("receivedVia", ["email", "portal", "phone", "manual"]).default("email"),
  emailThreadId: varchar("emailThreadId", { length: 255 }),
  rawEmailContent: text("rawEmailContent"),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// AI Email communications for freight
export const freightEmails = mysqlTable("freightEmails", {
  id: int("id").autoincrement().primaryKey(),
  rfqId: int("rfqId"),
  carrierId: int("carrierId"),
  direction: mysqlEnum("direction", ["outbound", "inbound"]).notNull(),
  emailType: mysqlEnum("emailType", ["rfq_request", "quote_response", "follow_up", "clarification", "booking_confirmation", "document_request", "customs_update", "other"]).notNull(),
  
  // Email details
  fromEmail: varchar("fromEmail", { length: 320 }),
  toEmail: varchar("toEmail", { length: 320 }),
  ccEmails: text("ccEmails"),
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  htmlBody: text("htmlBody"),
  
  // AI processing
  aiGenerated: boolean("aiGenerated").default(false),
  aiParsed: boolean("aiParsed").default(false),
  aiExtractedData: text("aiExtractedData"), // JSON of extracted quote data
  
  // Status
  status: mysqlEnum("status", ["draft", "sent", "delivered", "read", "replied", "failed"]).default("draft"),
  sentAt: timestamp("sentAt"),
  readAt: timestamp("readAt"),
  
  // Attachments stored in S3
  attachments: text("attachments"), // JSON array of {name, url, type}
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Customs clearance tracking
export const customsClearances = mysqlTable("customsClearances", {
  id: int("id").autoincrement().primaryKey(),
  clearanceNumber: varchar("clearanceNumber", { length: 50 }).notNull().unique(),
  shipmentId: int("shipmentId"),
  rfqId: int("rfqId"),
  
  // Clearance details
  type: mysqlEnum("type", ["import", "export"]).notNull(),
  status: mysqlEnum("status", ["pending_documents", "documents_submitted", "under_review", "additional_info_required", "cleared", "held", "rejected"]).default("pending_documents").notNull(),
  
  // Port/customs office
  customsOffice: varchar("customsOffice", { length: 255 }),
  portOfEntry: varchar("portOfEntry", { length: 255 }),
  country: varchar("country", { length: 100 }),
  
  // Broker info
  customsBrokerId: int("customsBrokerId"),
  brokerReference: varchar("brokerReference", { length: 100 }),
  
  // Key dates
  submissionDate: timestamp("submissionDate"),
  expectedClearanceDate: timestamp("expectedClearanceDate"),
  actualClearanceDate: timestamp("actualClearanceDate"),
  
  // Duties and taxes
  dutyAmount: decimal("dutyAmount", { precision: 15, scale: 2 }),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }),
  otherFees: decimal("otherFees", { precision: 15, scale: 2 }),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Compliance
  hsCode: varchar("hsCode", { length: 20 }),
  countryOfOrigin: varchar("countryOfOrigin", { length: 100 }),
  certificateOfOrigin: boolean("certificateOfOrigin").default(false),
  
  notes: text("notes"),
  aiSummary: text("aiSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Customs documents
export const customsDocuments = mysqlTable("customsDocuments", {
  id: int("id").autoincrement().primaryKey(),
  clearanceId: int("clearanceId").notNull(),
  documentType: mysqlEnum("documentType", [
    "commercial_invoice",
    "packing_list",
    "bill_of_lading",
    "airway_bill",
    "certificate_of_origin",
    "customs_declaration",
    "import_license",
    "export_license",
    "insurance_certificate",
    "inspection_certificate",
    "phytosanitary_certificate",
    "fumigation_certificate",
    "dangerous_goods_declaration",
    "other"
  ]).notNull(),
  
  name: varchar("name", { length: 255 }).notNull(),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  
  status: mysqlEnum("status", ["pending", "uploaded", "verified", "rejected", "expired"]).default("pending"),
  expiryDate: timestamp("expiryDate"),
  verifiedAt: timestamp("verifiedAt"),
  verifiedById: int("verifiedById"),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Freight bookings (when a quote is accepted)
export const freightBookings = mysqlTable("freightBookings", {
  id: int("id").autoincrement().primaryKey(),
  bookingNumber: varchar("bookingNumber", { length: 50 }).notNull().unique(),
  quoteId: int("quoteId").notNull(),
  rfqId: int("rfqId").notNull(),
  carrierId: int("carrierId").notNull(),
  
  status: mysqlEnum("status", ["pending", "confirmed", "in_transit", "arrived", "delivered", "cancelled"]).default("pending").notNull(),
  
  // Tracking
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  containerNumber: varchar("containerNumber", { length: 50 }),
  vesselName: varchar("vesselName", { length: 255 }),
  voyageNumber: varchar("voyageNumber", { length: 50 }),
  
  // Key dates
  bookingDate: timestamp("bookingDate"),
  pickupDate: timestamp("pickupDate"),
  departureDate: timestamp("departureDate"),
  arrivalDate: timestamp("arrivalDate"),
  deliveryDate: timestamp("deliveryDate"),
  
  // Costs
  agreedCost: decimal("agreedCost", { precision: 15, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Type exports for freight tables
export type FreightCarrier = typeof freightCarriers.$inferSelect;
export type InsertFreightCarrier = typeof freightCarriers.$inferInsert;

export type FreightRfq = typeof freightRfqs.$inferSelect;
export type InsertFreightRfq = typeof freightRfqs.$inferInsert;

export type FreightQuote = typeof freightQuotes.$inferSelect;
export type InsertFreightQuote = typeof freightQuotes.$inferInsert;

export type FreightEmail = typeof freightEmails.$inferSelect;
export type InsertFreightEmail = typeof freightEmails.$inferInsert;

export type CustomsClearance = typeof customsClearances.$inferSelect;
export type InsertCustomsClearance = typeof customsClearances.$inferInsert;

export type CustomsDocument = typeof customsDocuments.$inferSelect;
export type InsertCustomsDocument = typeof customsDocuments.$inferInsert;

export type FreightBooking = typeof freightBookings.$inferSelect;
export type InsertFreightBooking = typeof freightBookings.$inferInsert;
