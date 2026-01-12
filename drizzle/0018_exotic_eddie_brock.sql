CREATE TABLE `nda_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataRoomId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` varchar(32) NOT NULL DEFAULT '1.0',
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`mimeType` varchar(128) NOT NULL DEFAULT 'application/pdf',
	`fileSize` bigint,
	`pageCount` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`requiresSignature` boolean NOT NULL DEFAULT true,
	`allowTypedSignature` boolean NOT NULL DEFAULT true,
	`allowDrawnSignature` boolean NOT NULL DEFAULT true,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nda_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nda_signature_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`signatureId` int NOT NULL,
	`action` enum('viewed_nda','started_signing','completed_signature','downloaded_signed_copy','signature_revoked','access_granted','access_denied') NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nda_signature_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nda_signatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ndaDocumentId` int NOT NULL,
	`dataRoomId` int NOT NULL,
	`visitorId` int,
	`linkId` int,
	`signerName` varchar(255) NOT NULL,
	`signerEmail` varchar(320) NOT NULL,
	`signerTitle` varchar(255),
	`signerCompany` varchar(255),
	`signatureType` enum('typed','drawn') NOT NULL,
	`signatureData` text NOT NULL,
	`signatureImageUrl` varchar(1024),
	`signedDocumentKey` varchar(512),
	`signedDocumentUrl` varchar(1024),
	`signedAt` timestamp NOT NULL DEFAULT (now()),
	`ipAddress` varchar(45) NOT NULL,
	`userAgent` text,
	`agreementText` text,
	`consentCheckbox` boolean NOT NULL DEFAULT true,
	`status` enum('pending','signed','revoked','expired') NOT NULL DEFAULT 'signed',
	`revokedAt` timestamp,
	`revokedReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nda_signatures_id` PRIMARY KEY(`id`)
);
