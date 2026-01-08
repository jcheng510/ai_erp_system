ALTER TABLE `customers` ADD `hubspotContactId` varchar(64);--> statement-breakpoint
ALTER TABLE `customers` ADD `syncSource` enum('manual','shopify','hubspot','quickbooks') DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `customers` ADD `lastSyncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `customers` ADD `shopifyData` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `hubspotData` text;