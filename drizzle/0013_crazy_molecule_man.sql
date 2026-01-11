CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`notificationType` varchar(50) NOT NULL,
	`inApp` boolean DEFAULT true,
	`email` boolean DEFAULT false,
	`push` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD `notification_type` enum('shipping_update','inventory_low','inventory_received','inventory_adjustment','po_approved','po_shipped','po_received','po_fulfilled','work_order_started','work_order_completed','work_order_shortage','sales_order_new','sales_order_shipped','sales_order_delivered','alert','system','info','warning','error','success','reminder') DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `entityType` varchar(50);--> statement-breakpoint
ALTER TABLE `notifications` ADD `entityId` int;--> statement-breakpoint
ALTER TABLE `notifications` ADD `severity` enum('info','warning','critical') DEFAULT 'info';--> statement-breakpoint
ALTER TABLE `notifications` ADD `readAt` timestamp;--> statement-breakpoint
ALTER TABLE `notifications` ADD `metadata` json;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `type`;