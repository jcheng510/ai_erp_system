ALTER TABLE `materialRequirements` ADD `requiredByDate` timestamp;--> statement-breakpoint
ALTER TABLE `materialRequirements` ADD `latestOrderDate` timestamp;--> statement-breakpoint
ALTER TABLE `materialRequirements` ADD `estimatedDeliveryDate` timestamp;--> statement-breakpoint
ALTER TABLE `materialRequirements` ADD `isUrgent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `suggestedPurchaseOrders` ADD `estimatedDeliveryDate` timestamp;--> statement-breakpoint
ALTER TABLE `suggestedPurchaseOrders` ADD `vendorLeadTimeDays` int;--> statement-breakpoint
ALTER TABLE `suggestedPurchaseOrders` ADD `daysUntilRequired` int;--> statement-breakpoint
ALTER TABLE `suggestedPurchaseOrders` ADD `isUrgent` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `vendors` ADD `defaultLeadTimeDays` int DEFAULT 14;--> statement-breakpoint
ALTER TABLE `vendors` ADD `minOrderAmount` decimal(12,2);--> statement-breakpoint
ALTER TABLE `vendors` ADD `shippingMethod` varchar(64);