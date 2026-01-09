CREATE TABLE `poReceivingItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivingRecordId` int NOT NULL,
	`purchaseOrderItemId` int,
	`rawMaterialId` int,
	`productId` int,
	`receivedQuantity` decimal(15,4) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`lotNumber` varchar(64),
	`expirationDate` timestamp,
	`condition` enum('good','damaged','rejected') NOT NULL DEFAULT 'good',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `poReceivingItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `poReceivingRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`shipmentId` int,
	`receivedDate` timestamp NOT NULL,
	`receivedBy` int,
	`warehouseId` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `poReceivingRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderRawMaterials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderItemId` int NOT NULL,
	`rawMaterialId` int NOT NULL,
	`orderedQuantity` decimal(15,4) NOT NULL,
	`receivedQuantity` decimal(15,4) DEFAULT '0',
	`unit` varchar(32) NOT NULL,
	`unitCost` decimal(15,4),
	`status` enum('ordered','partial','received','cancelled') NOT NULL DEFAULT 'ordered',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrderRawMaterials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rawMaterialInventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rawMaterialId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`quantity` decimal(15,4) NOT NULL DEFAULT '0',
	`reservedQuantity` decimal(15,4) DEFAULT '0',
	`availableQuantity` decimal(15,4) DEFAULT '0',
	`unit` varchar(32) NOT NULL,
	`lotNumber` varchar(64),
	`expirationDate` timestamp,
	`lastReceivedDate` timestamp,
	`lastCountDate` timestamp,
	`reorderPoint` decimal(15,4),
	`reorderQuantity` decimal(15,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rawMaterialInventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rawMaterialTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rawMaterialId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`transactionType` enum('receive','consume','adjust','transfer_in','transfer_out','return') NOT NULL,
	`quantity` decimal(15,4) NOT NULL,
	`previousQuantity` decimal(15,4) NOT NULL,
	`newQuantity` decimal(15,4) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`referenceType` varchar(64),
	`referenceId` int,
	`lotNumber` varchar(64),
	`notes` text,
	`performedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rawMaterialTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workOrderMaterials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workOrderId` int NOT NULL,
	`rawMaterialId` int,
	`productId` int,
	`name` varchar(255) NOT NULL,
	`requiredQuantity` decimal(15,4) NOT NULL,
	`reservedQuantity` decimal(15,4) DEFAULT '0',
	`consumedQuantity` decimal(15,4) DEFAULT '0',
	`unit` varchar(32) NOT NULL,
	`status` enum('pending','reserved','partial','consumed','shortage') NOT NULL DEFAULT 'pending',
	`warehouseId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workOrderMaterials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`workOrderNumber` varchar(64) NOT NULL,
	`bomId` int NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int,
	`quantity` decimal(15,4) NOT NULL,
	`completedQuantity` decimal(15,4) DEFAULT '0',
	`unit` varchar(32) NOT NULL DEFAULT 'EA',
	`status` enum('draft','scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'draft',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`scheduledStartDate` timestamp,
	`scheduledEndDate` timestamp,
	`actualStartDate` timestamp,
	`actualEndDate` timestamp,
	`notes` text,
	`createdBy` int,
	`assignedTo` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workOrders_id` PRIMARY KEY(`id`)
);
