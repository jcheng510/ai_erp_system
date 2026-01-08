CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`subtype` varchar(64),
	`description` text,
	`balance` decimal(15,2) DEFAULT '0',
	`currency` varchar(3) DEFAULT 'USD',
	`isActive` boolean DEFAULT true,
	`parentAccountId` int,
	`quickbooksAccountId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`userId` int,
	`action` enum('create','update','delete','view','export','approve','reject') NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`entityName` varchar(255),
	`oldValues` json,
	`newValues` json,
	`ipAddress` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`legalName` varchar(255),
	`taxId` varchar(64),
	`type` enum('parent','subsidiary','branch') NOT NULL DEFAULT 'parent',
	`parentCompanyId` int,
	`address` text,
	`city` varchar(128),
	`state` varchar(64),
	`country` varchar(64),
	`postalCode` varchar(20),
	`phone` varchar(32),
	`email` varchar(320),
	`website` varchar(512),
	`industry` varchar(128),
	`status` enum('active','inactive','pending') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compensation_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`effectiveDate` timestamp NOT NULL,
	`salary` decimal(15,2) NOT NULL,
	`salaryFrequency` enum('hourly','weekly','biweekly','monthly','annual') DEFAULT 'annual',
	`currency` varchar(3) DEFAULT 'USD',
	`reason` varchar(255),
	`approvedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compensation_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contract_key_dates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`dateType` varchar(64) NOT NULL,
	`date` timestamp NOT NULL,
	`description` text,
	`reminderDays` int DEFAULT 30,
	`reminderSent` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contract_key_dates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`contractNumber` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`type` enum('customer','vendor','employment','nda','partnership','lease','service','other') NOT NULL,
	`status` enum('draft','pending_review','pending_signature','active','expired','terminated','renewed') NOT NULL DEFAULT 'draft',
	`partyType` enum('customer','vendor','employee','other'),
	`partyId` int,
	`partyName` varchar(255),
	`startDate` timestamp,
	`endDate` timestamp,
	`renewalDate` timestamp,
	`autoRenewal` boolean DEFAULT false,
	`value` decimal(15,2),
	`currency` varchar(3) DEFAULT 'USD',
	`description` text,
	`terms` text,
	`documentUrl` text,
	`signedDocumentUrl` text,
	`createdBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`address` text,
	`city` varchar(128),
	`state` varchar(64),
	`country` varchar(64),
	`postalCode` varchar(20),
	`type` enum('individual','business') NOT NULL DEFAULT 'business',
	`status` enum('active','inactive','prospect') NOT NULL DEFAULT 'active',
	`creditLimit` decimal(15,2),
	`paymentTerms` int DEFAULT 30,
	`notes` text,
	`shopifyCustomerId` varchar(64),
	`quickbooksCustomerId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(255) NOT NULL,
	`code` varchar(32),
	`parentDepartmentId` int,
	`managerId` int,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `disputes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`disputeNumber` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`type` enum('customer','vendor','employee','legal','regulatory','other') NOT NULL,
	`status` enum('open','investigating','negotiating','resolved','escalated','closed') NOT NULL DEFAULT 'open',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`partyType` enum('customer','vendor','employee','other'),
	`partyId` int,
	`partyName` varchar(255),
	`contractId` int,
	`description` text,
	`resolution` text,
	`estimatedValue` decimal(15,2),
	`actualValue` decimal(15,2),
	`currency` varchar(3) DEFAULT 'USD',
	`filedDate` timestamp,
	`resolvedDate` timestamp,
	`assignedTo` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `disputes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(255) NOT NULL,
	`type` enum('contract','invoice','receipt','report','legal','hr','other') NOT NULL,
	`category` varchar(128),
	`referenceType` varchar(64),
	`referenceId` int,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(128),
	`description` text,
	`tags` json,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`employeeId` int NOT NULL,
	`paymentNumber` varchar(64) NOT NULL,
	`type` enum('salary','bonus','commission','reimbursement','other') NOT NULL DEFAULT 'salary',
	`amount` decimal(15,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`paymentDate` timestamp NOT NULL,
	`payPeriodStart` timestamp,
	`payPeriodEnd` timestamp,
	`paymentMethod` enum('check','direct_deposit','wire','other') DEFAULT 'direct_deposit',
	`status` enum('pending','processed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employee_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`userId` int,
	`employeeNumber` varchar(32),
	`firstName` varchar(128) NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`personalEmail` varchar(320),
	`address` text,
	`city` varchar(128),
	`state` varchar(64),
	`country` varchar(64),
	`postalCode` varchar(20),
	`dateOfBirth` timestamp,
	`hireDate` timestamp,
	`terminationDate` timestamp,
	`departmentId` int,
	`managerId` int,
	`jobTitle` varchar(255),
	`employmentType` enum('full_time','part_time','contractor','intern') NOT NULL DEFAULT 'full_time',
	`status` enum('active','inactive','on_leave','terminated') NOT NULL DEFAULT 'active',
	`salary` decimal(15,2),
	`salaryFrequency` enum('hourly','weekly','biweekly','monthly','annual') DEFAULT 'annual',
	`currency` varchar(3) DEFAULT 'USD',
	`bankAccount` varchar(128),
	`bankRouting` varchar(64),
	`taxId` varchar(64),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`type` enum('quickbooks','shopify','stripe','slack','email','webhook') NOT NULL,
	`name` varchar(255) NOT NULL,
	`config` json,
	`credentials` json,
	`isActive` boolean DEFAULT true,
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`productId` int NOT NULL,
	`warehouseId` int,
	`quantity` decimal(15,4) NOT NULL,
	`reservedQuantity` decimal(15,4) DEFAULT '0',
	`reorderLevel` decimal(15,4),
	`reorderQuantity` decimal(15,4),
	`lastCountDate` timestamp,
	`lastCountQuantity` decimal(15,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`productId` int,
	`description` text NOT NULL,
	`quantity` decimal(15,4) NOT NULL,
	`unitPrice` decimal(15,2) NOT NULL,
	`taxRate` decimal(5,2) DEFAULT '0',
	`taxAmount` decimal(15,2) DEFAULT '0',
	`discountPercent` decimal(5,2) DEFAULT '0',
	`totalAmount` decimal(15,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`invoiceNumber` varchar(64) NOT NULL,
	`customerId` int,
	`type` enum('invoice','credit_note','quote') NOT NULL DEFAULT 'invoice',
	`status` enum('draft','sent','paid','partial','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`issueDate` timestamp NOT NULL,
	`dueDate` timestamp,
	`subtotal` decimal(15,2) NOT NULL,
	`taxAmount` decimal(15,2) DEFAULT '0',
	`discountAmount` decimal(15,2) DEFAULT '0',
	`totalAmount` decimal(15,2) NOT NULL,
	`paidAmount` decimal(15,2) DEFAULT '0',
	`currency` varchar(3) DEFAULT 'USD',
	`notes` text,
	`terms` text,
	`quickbooksInvoiceId` varchar(64),
	`createdBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('info','warning','error','success','reminder') NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`message` text,
	`link` varchar(512),
	`isRead` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`sku` varchar(64),
	`name` varchar(255) NOT NULL,
	`quantity` decimal(15,4) NOT NULL,
	`unitPrice` decimal(15,2) NOT NULL,
	`taxAmount` decimal(15,2) DEFAULT '0',
	`discountAmount` decimal(15,2) DEFAULT '0',
	`totalAmount` decimal(15,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`orderNumber` varchar(64) NOT NULL,
	`customerId` int,
	`type` enum('sales','return') NOT NULL DEFAULT 'sales',
	`status` enum('pending','confirmed','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`orderDate` timestamp NOT NULL,
	`shippingAddress` text,
	`billingAddress` text,
	`subtotal` decimal(15,2) NOT NULL,
	`taxAmount` decimal(15,2) DEFAULT '0',
	`shippingAmount` decimal(15,2) DEFAULT '0',
	`discountAmount` decimal(15,2) DEFAULT '0',
	`totalAmount` decimal(15,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`notes` text,
	`shopifyOrderId` varchar(64),
	`invoiceId` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`paymentNumber` varchar(64) NOT NULL,
	`type` enum('received','made') NOT NULL,
	`invoiceId` int,
	`vendorId` int,
	`customerId` int,
	`accountId` int,
	`amount` decimal(15,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`paymentMethod` enum('cash','check','bank_transfer','credit_card','ach','wire','other') DEFAULT 'bank_transfer',
	`paymentDate` timestamp NOT NULL,
	`referenceNumber` varchar(128),
	`status` enum('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`quickbooksPaymentId` varchar(64),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`batchNumber` varchar(64) NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(15,4) NOT NULL,
	`status` enum('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned',
	`startDate` timestamp,
	`completionDate` timestamp,
	`warehouseId` int,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`sku` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(128),
	`type` enum('physical','digital','service') NOT NULL DEFAULT 'physical',
	`unitPrice` decimal(15,2) NOT NULL,
	`costPrice` decimal(15,2),
	`currency` varchar(3) DEFAULT 'USD',
	`taxable` boolean DEFAULT true,
	`taxRate` decimal(5,2),
	`status` enum('active','inactive','discontinued') NOT NULL DEFAULT 'active',
	`shopifyProductId` varchar(64),
	`quickbooksItemId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`dueDate` timestamp,
	`completedDate` timestamp,
	`status` enum('pending','in_progress','completed','overdue') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`milestoneId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`assigneeId` int,
	`status` enum('todo','in_progress','review','completed','cancelled') NOT NULL DEFAULT 'todo',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`dueDate` timestamp,
	`completedDate` timestamp,
	`estimatedHours` decimal(10,2),
	`actualHours` decimal(10,2),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`projectNumber` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`type` enum('internal','client','product','research','other') NOT NULL DEFAULT 'internal',
	`status` enum('planning','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`ownerId` int,
	`departmentId` int,
	`startDate` timestamp,
	`targetEndDate` timestamp,
	`actualEndDate` timestamp,
	`budget` decimal(15,2),
	`actualCost` decimal(15,2),
	`currency` varchar(3) DEFAULT 'USD',
	`progress` int DEFAULT 0,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int,
	`description` text NOT NULL,
	`quantity` decimal(15,4) NOT NULL,
	`receivedQuantity` decimal(15,4) DEFAULT '0',
	`unitPrice` decimal(15,2) NOT NULL,
	`totalAmount` decimal(15,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`poNumber` varchar(64) NOT NULL,
	`vendorId` int NOT NULL,
	`status` enum('draft','sent','confirmed','partial','received','cancelled') NOT NULL DEFAULT 'draft',
	`orderDate` timestamp NOT NULL,
	`expectedDate` timestamp,
	`receivedDate` timestamp,
	`shippingAddress` text,
	`subtotal` decimal(15,2) NOT NULL,
	`taxAmount` decimal(15,2) DEFAULT '0',
	`shippingAmount` decimal(15,2) DEFAULT '0',
	`totalAmount` decimal(15,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`notes` text,
	`createdBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`shipmentNumber` varchar(64) NOT NULL,
	`type` enum('inbound','outbound') NOT NULL,
	`orderId` int,
	`purchaseOrderId` int,
	`carrier` varchar(128),
	`trackingNumber` varchar(128),
	`status` enum('pending','in_transit','delivered','returned','cancelled') NOT NULL DEFAULT 'pending',
	`shipDate` timestamp,
	`deliveryDate` timestamp,
	`fromAddress` text,
	`toAddress` text,
	`weight` decimal(10,2),
	`cost` decimal(15,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transaction_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`accountId` int NOT NULL,
	`debit` decimal(15,2) DEFAULT '0',
	`credit` decimal(15,2) DEFAULT '0',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transaction_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`transactionNumber` varchar(64) NOT NULL,
	`type` enum('journal','invoice','payment','expense','transfer','adjustment') NOT NULL,
	`referenceType` varchar(64),
	`referenceId` int,
	`date` timestamp NOT NULL,
	`description` text,
	`totalAmount` decimal(15,2) NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`status` enum('draft','posted','void') NOT NULL DEFAULT 'draft',
	`createdBy` int,
	`postedBy` int,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(255) NOT NULL,
	`contactName` varchar(255),
	`email` varchar(320),
	`phone` varchar(32),
	`address` text,
	`city` varchar(128),
	`state` varchar(64),
	`country` varchar(64),
	`postalCode` varchar(20),
	`type` enum('supplier','contractor','service') NOT NULL DEFAULT 'supplier',
	`status` enum('active','inactive','pending') NOT NULL DEFAULT 'active',
	`paymentTerms` int DEFAULT 30,
	`taxId` varchar(64),
	`bankAccount` varchar(128),
	`bankRouting` varchar(64),
	`notes` text,
	`quickbooksVendorId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(255) NOT NULL,
	`code` varchar(32),
	`address` text,
	`city` varchar(128),
	`state` varchar(64),
	`country` varchar(64),
	`postalCode` varchar(20),
	`type` enum('warehouse','store','distribution') NOT NULL DEFAULT 'warehouse',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','finance','ops','legal','exec') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `departmentId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);