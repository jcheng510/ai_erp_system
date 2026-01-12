CREATE TABLE `aiAgentLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`taskId` int,
	`ruleId` int,
	`action` varchar(100) NOT NULL,
	`status` enum('info','success','warning','error') NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`details` text,
	`durationMs` int,
	`tokensUsed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiAgentLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiAgentRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ruleType` enum('inventory_reorder','po_auto_generate','rfq_auto_send','vendor_followup','payment_reminder','shipment_tracking','price_alert','quality_check') NOT NULL,
	`triggerCondition` text NOT NULL,
	`actionConfig` text NOT NULL,
	`requiresApproval` boolean NOT NULL DEFAULT true,
	`autoApproveThreshold` decimal(12,2),
	`notifyUsers` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastTriggeredAt` timestamp,
	`triggerCount` int DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiAgentRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiAgentTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`taskType` enum('generate_po','send_rfq','send_quote_request','send_email','update_inventory','create_shipment','generate_invoice','reconcile_payment','reorder_materials','vendor_followup') NOT NULL,
	`status` enum('pending_approval','approved','rejected','in_progress','completed','failed','cancelled') NOT NULL DEFAULT 'pending_approval',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`taskData` text NOT NULL,
	`aiReasoning` text,
	`aiConfidence` decimal(5,2),
	`relatedEntityType` varchar(50),
	`relatedEntityId` int,
	`requiresApproval` boolean NOT NULL DEFAULT true,
	`approvalThreshold` decimal(12,2),
	`approvedBy` int,
	`approvedAt` timestamp,
	`rejectedBy` int,
	`rejectedAt` timestamp,
	`rejectionReason` text,
	`executedAt` timestamp,
	`executionResult` text,
	`errorMessage` text,
	`retryCount` int DEFAULT 0,
	`maxRetries` int DEFAULT 3,
	`scheduledFor` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiAgentTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(255) NOT NULL,
	`templateType` enum('po_to_vendor','rfq_request','quote_request','shipment_confirmation','payment_reminder','vendor_followup','quality_issue','general') NOT NULL,
	`subject` varchar(500) NOT NULL,
	`bodyTemplate` text NOT NULL,
	`isDefault` boolean DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailTemplates_id` PRIMARY KEY(`id`)
);
