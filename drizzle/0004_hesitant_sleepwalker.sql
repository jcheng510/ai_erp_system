CREATE TABLE `inventory_transfer_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferId` int NOT NULL,
	`productId` int NOT NULL,
	`requestedQuantity` decimal(15,4) NOT NULL,
	`shippedQuantity` decimal(15,4),
	`receivedQuantity` decimal(15,4),
	`lotNumber` varchar(64),
	`expirationDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_transfer_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferNumber` varchar(64) NOT NULL,
	`fromWarehouseId` int NOT NULL,
	`toWarehouseId` int NOT NULL,
	`status` enum('draft','pending','in_transit','received','cancelled') NOT NULL DEFAULT 'draft',
	`requestedDate` timestamp NOT NULL,
	`shippedDate` timestamp,
	`receivedDate` timestamp,
	`expectedArrival` timestamp,
	`trackingNumber` varchar(128),
	`carrier` varchar(128),
	`notes` text,
	`requestedBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `warehouses` MODIFY COLUMN `type` enum('warehouse','store','distribution','copacker','3pl') NOT NULL DEFAULT 'warehouse';--> statement-breakpoint
ALTER TABLE `warehouses` ADD `contactName` varchar(255);--> statement-breakpoint
ALTER TABLE `warehouses` ADD `contactEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `warehouses` ADD `contactPhone` varchar(32);--> statement-breakpoint
ALTER TABLE `warehouses` ADD `isPrimary` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `warehouses` ADD `notes` text;