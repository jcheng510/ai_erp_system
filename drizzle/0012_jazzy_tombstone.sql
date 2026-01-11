CREATE TABLE `syncLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integration` varchar(64) NOT NULL,
	`action` varchar(128) NOT NULL,
	`status` enum('success','error','warning','pending') NOT NULL DEFAULT 'pending',
	`details` text,
	`recordsProcessed` int,
	`recordsFailed` int,
	`errorMessage` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `syncLogs_id` PRIMARY KEY(`id`)
);
