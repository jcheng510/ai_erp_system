CREATE TABLE `teamInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('user','admin','finance','ops','legal','exec','copacker','vendor','contractor') NOT NULL DEFAULT 'user',
	`inviteCode` varchar(64) NOT NULL,
	`invitedBy` int NOT NULL,
	`linkedVendorId` int,
	`linkedWarehouseId` int,
	`customPermissions` text,
	`status` enum('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`acceptedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teamInvitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `teamInvitations_inviteCode_unique` UNIQUE(`inviteCode`)
);
--> statement-breakpoint
CREATE TABLE `userPermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`permission` varchar(64) NOT NULL,
	`grantedBy` int NOT NULL,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userPermissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','finance','ops','legal','exec','copacker','vendor','contractor') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `linkedVendorId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `linkedWarehouseId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `invitedBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `invitedAt` timestamp;