# AI-Native ERP System - TODO

## Core Infrastructure
- [x] Complete database schema with all entities
- [x] Role-based access control (admin, finance, ops, legal, exec)
- [x] Audit trail system for financial and legal records
- [x] Dashboard layout with sidebar navigation

## Finance Module
- [x] Accounts management (chart of accounts)
- [x] Invoice creation and tracking
- [x] Payment tracking and reconciliation
- [x] Cash flow monitoring
- [ ] QuickBooks Online sync integration
- [x] Financial reports and analytics

## Sales & Revenue Module
- [x] Customer management
- [x] Order tracking
- [x] Revenue analytics and reporting
- [ ] Shopify sync integration
- [x] Sales pipeline visualization

## Operations Module
- [x] Inventory management
- [x] Production batch tracking
- [x] Supplier management
- [x] Purchase order workflow
- [x] Logistics and shipping tracking

## HR & Contractors Module
- [x] People records management
- [x] Role and department tracking
- [x] Compensation management
- [x] Contractor agreements
- [x] Payment management

## Legal & Compliance Module
- [x] Contract lifecycle management
- [x] Dispute tracking
- [x] Key dates and reminders
- [x] Document storage (S3 integration)
- [x] Compliance tracking

## Projects Module
- [x] Initiative tracking
- [x] Owner assignment
- [x] Timeline management
- [x] Budget tracking
- [x] Status updates and reporting

## Executive Dashboard
- [x] Real-time KPI widgets
- [x] Cross-module metrics aggregation
- [x] Customizable dashboard layout
- [x] Trend visualization
- [x] Alert notifications

## AI Capabilities
- [x] Natural language query interface
- [x] Context-aware data responses
- [x] Data visualization from queries
- [x] AI summaries of financials and ops
- [ ] Anomaly detection alerts

## Integrations
- [ ] QuickBooks Online API setup
- [ ] Shopify API setup
- [ ] Webhook handlers for external systems

## Unit Tests
- [x] Dashboard metrics tests
- [x] Finance module tests
- [x] Sales module tests
- [x] Operations module tests
- [x] HR module tests
- [x] Projects module tests
- [x] Authentication tests

## Google Sheets Import Feature
- [x] Google Sheets API backend integration
- [x] Import UI page with sheet URL input
- [x] Sheet preview and column mapping interface
- [x] Data import logic for Customers module
- [x] Data import logic for Vendors module
- [x] Data import logic for Products module
- [x] Data import logic for Invoices module
- [x] Data import logic for Employees module
- [x] Data import logic for Contracts module
- [x] Data import logic for Projects module
- [x] Unit tests for import functionality (8 tests passing)

## Google Drive OAuth Integration
- [x] Google OAuth 2.0 authentication flow
- [x] Store and refresh Google access tokens
- [x] List Google Drive spreadsheets
- [x] Access private sheets via Drive API
- [x] Update import UI for OAuth flow

## AI Freight Quote Management System
- [x] Database schema for freight RFQs, quotes, and carriers
- [x] Database schema for customs clearance and documentation
- [x] AI email system for requesting quotes from freight forwarders
- [x] Quote compilation and comparison interface
- [x] Shipment document management (BOL, commercial invoice, packing list)
- [x] Customs clearance workflow and tracking
- [x] AI-powered quote analysis and recommendations
- [x] Carrier/forwarder database management
- [x] Integration with existing shipments module
- [x] Email templates for freight communications
- [x] Freight dashboard with active RFQs and clearances
- [x] Unit tests for freight management (28 tests passing)

## RFQ Workflow Fixes
- [x] Fix RFQ detail page navigation from RFQ list
- [x] Add manual quote entry form with full cost breakdown
- [x] Enable sending RFQ to carriers (AI-generated emails)
- [x] Quote comparison view with accept/reject actions
- [x] Create booking when quote is accepted
- [x] Update RFQ status through workflow stages
- [x] Add email parsing for incoming quote responses
- [x] AI quote analysis and scoring

## Navigation Consolidation
- [x] Remove separate Carriers menu item from Freight
- [x] Add carrier/forwarder tab to Vendors page
- [x] Simplify Freight menu to just RFQs and Customs
- [x] Freight carriers now managed in Vendors & Carriers page

## Navigation Styling Fixes
- [x] Fix overlapping text in navigation menu
- [x] Reduce excessive spacing between menu items

## Multi-Location Inventory Management
- [x] Add locations/facilities table to database (copacker, warehouse, 3PL types)
- [x] Update inventory to track stock by location
- [x] Add inventory transfers between locations
- [x] Location management UI (add/edit facilities)
- [x] Inventory view with location filter
- [x] Transfer request workflow (draft → pending → in_transit → received)
- [x] Consolidated inventory dashboard across all locations

## Shopify & HubSpot Customer Sync
- [x] Add Shopify and HubSpot ID fields to customers table
- [x] Add sync status and last synced timestamp fields
- [x] Build Shopify API integration for customer import
- [x] Build HubSpot API integration for customer import
- [x] Create sync UI with tabbed dialog for Shopify/HubSpot
- [x] Add manual sync trigger button on Customers page
- [x] Display Shopify/HubSpot source badges on customer records
- [x] Handle duplicate detection and merging
- [x] Sync status cards showing customer sources
- [x] Source filter on customers list

## Team Member Access Control
- [x] Extend user roles to include copacker, vendor, contractor, and team member types
- [x] Add team invitations table for granular access control
- [x] Create team member invitation system with invite codes
- [x] Build team management UI page with role assignment
- [x] Implement permission-based route guards (copackerProcedure, vendorProcedure)
- [x] Create copacker-restricted inventory update view (Copacker Portal)
- [x] Create copacker-restricted shipment document upload view
- [x] Add vendor portal with limited PO and shipment access
- [x] Link users to specific warehouses or vendors

## Bill of Materials (BOM) Module

- [x] BOM database schema (parent product, components, quantities)
- [x] BOM versions and revision tracking
- [x] Component cost rollup calculations
- [x] BOM list and detail UI pages
- [x] Add/edit BOM components interface
- [x] Import existing BOM data from Google Sheets (13 raw materials created)
- [x] BOM cost analysis view
- [x] Raw materials management page
- [x] Production requirements calculation
