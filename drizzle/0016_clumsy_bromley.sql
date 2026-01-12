ALTER TABLE `rawMaterials` ADD `receivingStatus` enum('none','ordered','in_transit','received','inspected') DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `rawMaterials` ADD `lastPoId` int;--> statement-breakpoint
ALTER TABLE `rawMaterials` ADD `quantityOnOrder` decimal(15,4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `rawMaterials` ADD `quantityInTransit` decimal(15,4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `rawMaterials` ADD `quantityReceived` decimal(15,4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `rawMaterials` ADD `expectedDeliveryDate` timestamp;--> statement-breakpoint
ALTER TABLE `rawMaterials` ADD `lastReceivedDate` timestamp;--> statement-breakpoint
ALTER TABLE `rawMaterials` ADD `lastReceivedQty` decimal(15,4);