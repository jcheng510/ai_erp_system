CREATE TABLE `recurringInvoiceHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recurringInvoiceId` int NOT NULL,
	`generatedInvoiceId` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`scheduledFor` timestamp NOT NULL,
	`status` enum('generated','sent','failed') NOT NULL DEFAULT 'generated',
	`errorMessage` text,
	CONSTRAINT `recurringInvoiceHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurringInvoiceItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recurringInvoiceId` int NOT NULL,
	`productId` int,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unitPrice` decimal(12,2) NOT NULL DEFAULT '0',
	`taxRate` decimal(5,2),
	`taxAmount` decimal(12,2),
	`discountPercent` decimal(5,2),
	`totalAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurringInvoiceItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurringInvoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`customerId` int NOT NULL,
	`templateName` varchar(255) NOT NULL,
	`description` text,
	`recurringInvoiceFrequency` enum('weekly','biweekly','monthly','quarterly','annually') NOT NULL,
	`dayOfWeek` int,
	`dayOfMonth` int,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`nextGenerationDate` timestamp NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0',
	`taxRate` decimal(5,2),
	`taxAmount` decimal(12,2) DEFAULT '0',
	`discountPercent` decimal(5,2),
	`discountAmount` decimal(12,2) DEFAULT '0',
	`totalAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`autoSend` boolean NOT NULL DEFAULT false,
	`daysUntilDue` int NOT NULL DEFAULT 30,
	`notes` text,
	`terms` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastGeneratedAt` timestamp,
	`generationCount` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurringInvoices_id` PRIMARY KEY(`id`)
);
