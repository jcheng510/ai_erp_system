ALTER TABLE `inbound_emails` ADD `email_category` enum('receipt','purchase_order','invoice','shipping_confirmation','freight_quote','delivery_notification','order_confirmation','payment_confirmation','general') DEFAULT 'general';--> statement-breakpoint
ALTER TABLE `inbound_emails` ADD `categoryConfidence` decimal(5,2);--> statement-breakpoint
ALTER TABLE `inbound_emails` ADD `categoryKeywords` json;--> statement-breakpoint
ALTER TABLE `inbound_emails` ADD `suggestedAction` varchar(255);--> statement-breakpoint
ALTER TABLE `inbound_emails` ADD `email_priority` enum('high','medium','low') DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE `inbound_emails` ADD `subcategory` varchar(100);