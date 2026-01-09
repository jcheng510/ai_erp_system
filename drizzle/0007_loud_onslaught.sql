CREATE TABLE `billOfMaterials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` varchar(32) NOT NULL DEFAULT '1.0',
	`status` enum('draft','active','obsolete') NOT NULL DEFAULT 'draft',
	`effectiveDate` timestamp,
	`obsoleteDate` timestamp,
	`batchSize` decimal(15,4) DEFAULT '1',
	`batchUnit` varchar(32) DEFAULT 'EA',
	`laborCost` decimal(15,2) DEFAULT '0',
	`overheadCost` decimal(15,2) DEFAULT '0',
	`totalMaterialCost` decimal(15,2),
	`totalCost` decimal(15,2),
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billOfMaterials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bomComponents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bomId` int NOT NULL,
	`componentType` enum('product','raw_material','packaging','labor') NOT NULL DEFAULT 'raw_material',
	`productId` int,
	`rawMaterialId` int,
	`name` varchar(255) NOT NULL,
	`sku` varchar(64),
	`quantity` decimal(15,4) NOT NULL,
	`unit` varchar(32) NOT NULL DEFAULT 'EA',
	`wastagePercent` decimal(5,2) DEFAULT '0',
	`unitCost` decimal(15,4),
	`totalCost` decimal(15,2),
	`leadTimeDays` int DEFAULT 0,
	`isOptional` boolean DEFAULT false,
	`notes` text,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bomComponents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bomVersionHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bomId` int NOT NULL,
	`version` varchar(32) NOT NULL,
	`changeType` enum('created','updated','activated','obsoleted') NOT NULL,
	`changeDescription` text,
	`changedBy` int,
	`snapshotData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bomVersionHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rawMaterials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`sku` varchar(64),
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(128),
	`unit` varchar(32) NOT NULL DEFAULT 'EA',
	`unitCost` decimal(15,4),
	`currency` varchar(3) DEFAULT 'USD',
	`minOrderQty` decimal(15,4),
	`leadTimeDays` int DEFAULT 0,
	`preferredVendorId` int,
	`status` enum('active','inactive','discontinued') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rawMaterials_id` PRIMARY KEY(`id`)
);
