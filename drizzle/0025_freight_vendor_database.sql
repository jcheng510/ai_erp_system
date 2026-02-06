-- Freight Vendor Database: master vendor list, route lanes, and search log

CREATE TABLE IF NOT EXISTS `freightVendors` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `type` enum('ocean','air','ground','rail','multimodal','freight_forwarder','customs_broker','3pl') NOT NULL,
  `contactName` varchar(255),
  `email` varchar(320),
  `phone` varchar(32),
  `address` text,
  `city` varchar(128),
  `country` varchar(100),
  `website` varchar(500),

  -- Capabilities
  `handlesHazmat` boolean DEFAULT false,
  `handlesRefrigerated` boolean DEFAULT false,
  `handlesOversized` boolean DEFAULT false,
  `offersDoorToDoor` boolean DEFAULT false,
  `offersCustomsClearance` boolean DEFAULT false,
  `offersInsurance` boolean DEFAULT false,
  `offersWarehouse` boolean DEFAULT false,

  -- Business terms
  `paymentTermsDays` int DEFAULT 30,
  `currency` varchar(3) DEFAULT 'USD',
  `minimumShipmentValue` decimal(12,2),
  `incotermsSupported` text,

  -- Performance
  `rating` int,
  `onTimeDeliveryPct` decimal(5,2),
  `avgTransitDays` int,
  `totalShipments` int DEFAULT 0,
  `totalRfqsReceived` int DEFAULT 0,
  `totalQuotesWon` int DEFAULT 0,

  -- Status
  `isActive` boolean NOT NULL DEFAULT true,
  `isPreferred` boolean DEFAULT false,
  `verifiedAt` timestamp NULL,
  `notes` text,

  `freightCarrierId` int,
  `source` enum('manual','rfq_response','ai_search','import','referral') DEFAULT 'manual',
  `lastContactedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `freightVendorRoutes` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `freightVendorId` int NOT NULL,

  -- Origin
  `originCountry` varchar(100) NOT NULL,
  `originCity` varchar(255),
  `originPort` varchar(255),
  `originRegion` varchar(128),

  -- Destination
  `destinationCountry` varchar(100) NOT NULL,
  `destinationCity` varchar(255),
  `destinationPort` varchar(255),
  `destinationRegion` varchar(128),

  -- Route details
  `mode` enum('ocean_fcl','ocean_lcl','air','express','ground','rail','multimodal') NOT NULL,
  `transitDaysMin` int,
  `transitDaysMax` int,
  `frequency` varchar(100),

  -- Indicative pricing
  `estimatedCostMin` decimal(12,2),
  `estimatedCostMax` decimal(12,2),
  `costCurrency` varchar(3) DEFAULT 'USD',
  `costUnit` varchar(50),
  `costValidUntil` timestamp NULL,

  `isActive` boolean NOT NULL DEFAULT true,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_fvr_vendor` (`freightVendorId`),
  INDEX `idx_fvr_origin` (`originCountry`, `originCity`),
  INDEX `idx_fvr_dest` (`destinationCountry`, `destinationCity`),
  INDEX `idx_fvr_mode` (`mode`)
);

CREATE TABLE IF NOT EXISTS `freightVendorSearches` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `searchedBy` int,
  `originCountry` varchar(100),
  `originCity` varchar(255),
  `destinationCountry` varchar(100),
  `destinationCity` varchar(255),
  `mode` varchar(50),
  `cargoType` varchar(50),
  `resultCount` int DEFAULT 0,
  `aiSuggested` boolean DEFAULT false,
  `aiSuggestions` text,
  `linkedRfqId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
