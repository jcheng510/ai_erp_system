-- Sales Order to Invoice Conversion
-- Adds salesOrderId column to invoices table to link invoices to their source sales orders

ALTER TABLE `invoices` ADD COLUMN `salesOrderId` int NULL;
CREATE INDEX `invoices_salesOrderId_idx` ON `invoices` (`salesOrderId`);
