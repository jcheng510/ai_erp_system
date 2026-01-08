CREATE TABLE `googleOAuthTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`tokenType` varchar(32) DEFAULT 'Bearer',
	`expiresAt` timestamp,
	`scope` text,
	`googleEmail` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `googleOAuthTokens_id` PRIMARY KEY(`id`)
);
