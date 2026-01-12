CREATE TABLE `supplierDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portalSessionId` int NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`vendorId` int NOT NULL,
	`documentType` enum('commercial_invoice','packing_list','dimensions_weight','hs_codes','certificate_of_origin','msds_sds','bill_of_lading','customs_declaration','other') NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`notes` text,
	`extractedData` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplierDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplierFreightInfo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portalSessionId` int NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`vendorId` int NOT NULL,
	`totalPackages` int,
	`totalGrossWeight` decimal(10,2),
	`totalNetWeight` decimal(10,2),
	`weightUnit` varchar(10) DEFAULT 'kg',
	`totalVolume` decimal(10,3),
	`volumeUnit` varchar(10) DEFAULT 'cbm',
	`packageDimensions` text,
	`hsCodes` text,
	`preferredShipDate` timestamp,
	`preferredCarrier` varchar(100),
	`incoterms` varchar(20),
	`specialInstructions` text,
	`hasDangerousGoods` boolean DEFAULT false,
	`dangerousGoodsClass` varchar(50),
	`unNumber` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplierFreightInfo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplierPortalSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`vendorId` int NOT NULL,
	`vendorEmail` varchar(320),
	`status` enum('active','completed','expired') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplierPortalSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplierPortalSessions_token_unique` UNIQUE(`token`)
);
