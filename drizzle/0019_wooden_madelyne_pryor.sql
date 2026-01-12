ALTER TABLE `data_room_invitations` ADD `allowedFolderIds` json;--> statement-breakpoint
ALTER TABLE `data_room_invitations` ADD `allowedDocumentIds` json;--> statement-breakpoint
ALTER TABLE `data_room_visitors` ADD `ndaSignatureId` int;--> statement-breakpoint
ALTER TABLE `data_room_visitors` ADD `accessStatus` enum('active','blocked','revoked','expired') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `data_room_visitors` ADD `blockedAt` timestamp;--> statement-breakpoint
ALTER TABLE `data_room_visitors` ADD `blockedReason` text;--> statement-breakpoint
ALTER TABLE `data_room_visitors` ADD `revokedAt` timestamp;--> statement-breakpoint
ALTER TABLE `data_room_visitors` ADD `revokedReason` text;--> statement-breakpoint
ALTER TABLE `data_rooms` ADD `invitationOnly` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `data_rooms` ADD `requireEmailVerification` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `data_rooms` ADD `watermarkText` varchar(255);