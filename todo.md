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

## Integrated Production Workflow
- [x] Work orders schema (link to BOM, production quantity, status)
- [x] Link POs to raw materials (PO line items reference raw material IDs)
- [x] PO receiving workflow (mark items received, update raw material inventory)
- [x] Shipment tracking linked to PO receiving
- [x] Raw material inventory ledger (track quantities by location)
- [x] Work order creation from BOM (auto-calculate material requirements)
- [x] Material consumption on work order completion
- [ ] Inventory reservation for pending work orders
- [x] Production dashboard showing active work orders (Work Orders page)
- [ ] Material shortage alerts when inventory < requirements
- [x] Work Orders UI page with list and detail views
- [x] PO Receiving UI page with receiving workflow
- [x] Unit tests for production workflow (21 tests passing)

## AI Production Forecasting & Auto-PO Generation
- [x] Database schema for demand forecasts and forecast history
- [x] AI forecasting engine using LLM to analyze sales trends and predict demand
- [x] Production requirements calculation based on forecasts and BOMs
- [x] Raw material requirements aggregation from production forecasts
- [x] Inventory gap analysis (required vs available raw materials)
- [x] Auto-generate draft purchase orders for material shortages
- [x] One-click approval for generated POs
- [x] Forecasting dashboard with demand predictions and charts
- [x] Suggested PO list with approve/reject actions
- [x] Forecast accuracy tracking over time (schema ready)
- [x] Unit tests for forecasting functionality (23 tests passing)

## Vendor Lead Times for PO Generation
- [x] Add lead time fields to vendor schema (default lead time in days)
- [x] Add lead time field to raw materials (material-specific lead time)
- [x] Update material requirements to calculate required order date based on lead times
- [x] Update suggested PO generation to use lead times for order date recommendations
- [x] Display lead time and estimated delivery date in suggested PO UI
- [x] Add urgency indicators when lead time exceeds available time
- [x] Unit tests for lead time calculations (13 new tests, 148 total passing)

## Foodservice Wholesale Pricelist Import
- [x] Access Google Sheet with foodservice pricelist
- [x] Extract product data (SKU, name, price, etc.)
- [x] Match existing products by SKU
- [x] Update existing products with new data (override)
- [x] Create new products for new SKUs (8 products created)
- [x] Verify import results

## Freight Quotes Workflow Fix
- [x] Fix freight quotes button navigation/action (WORKS - opens carrier selection dialog)
- [x] Send RFQ emails to freight vendors when requested (AI generates personalized emails)
- [x] Monitor and collect quote responses from vendors (Add Quote from Email dialog with AI parsing)
- [x] Display quote comparison with all received quotes (quotes table with AI scoring)
- [x] Enable selection of best quote option (accept/reject buttons on each quote)
- [x] Create booking when quote is accepted (accept procedure creates booking)
- [x] Connect to actual SMTP/email service for real email delivery (SendGrid integrated)
- [ ] Add automatic email inbox monitoring for response collection

## SendGrid Email Integration
- [x] Request SendGrid API key from user (user will add later via Settings → Secrets)
- [x] Create SendGrid email service helper (server/_core/email.ts)
- [x] Update freight RFQ sendToCarriers to use SendGrid
- [x] Update email status from 'draft' to 'sent' after successful delivery
- [x] Add error handling for failed email delivery
- [x] Configure sender email address (from address via SENDGRID_FROM_EMAIL)
- [x] Write unit tests for email sending (12 tests, 160 total passing)

## Specification Gap Completion

### Lot/Batch Tracking System
- [x] Create InventoryLot table (lot_code, product_id, expiry, attributes JSON)
- [x] Create InventoryBalance table (lot_id, location_id, status, qty)
- [x] Add inventory status enum (available, hold, reserved)
- [x] Create InventoryTransaction ledger for all movements
- [x] Add transaction types: receive, consume, adjust, transfer, reserve, release, ship
- [x] Update inventory functions to use lot-level tracking
- [x] Add lot selection UI for inventory operations (via Core Operations)

### Work Order Output Completion
- [x] Add WorkOrderOutput table (wo_id, lot_id, qty, yield%)
- [x] Create finished goods lot on work order completion
- [x] Track yield percentage vs target
- [x] Update finished goods inventory on completion
- [x] Add output lot UI to work order detail page (via Core Operations)
### Alert System
- [x] Create Alert table (type, entity_ref, severity, status, assigned_to)
- [x] Alert types: low_stock, shortage, late_shipment, yield_variance, expiring_lot
- [x] Automatic alert generation for low stock conditions
- [x] Automatic alert generation for late shipments
- [x] Automatic alert generation for yield variance
- [x] Create Recommendation table with approval workflow
- [x] Alert dashboard with filtering and assignment (Core Operations right pane)
- [x] Alert notifications in header

### Shopify Integration Foundation
- [x] Create ShopifyStore table (domain, token, enabled)
- [x] Create WebhookEvent table (topic, payload, idempotency_key, status)
- [x] Create ShopifySkuMapping table (shopify_sku, product_id)
- [x] Create ShopifyLocationMapping table (shopify_location_id, warehouse_id)
- [x] Implement orders/create webhook endpoint
- [x] Implement orders/cancelled webhook endpoint
- [x] Implement orders/fulfilled webhook endpoint
- [x] Implement inventory_levels/update webhook endpoint
- [ ] Add Shopify settings page for store configuration (UI pending)

### Reservation System
- [x] Create SalesOrder table with lines
- [x] Create Reservation table (sales_order_id, lot_id, qty)
- [x] Implement reserve transaction (available → reserved)
- [x] Implement release transaction (reserved → available)
- [x] Implement ship transaction (reserved → 0, on_hand decreases)
- [x] Track available vs on_hand quantities separately

### Inventory Allocation by Channel
- [x] Create InventoryAllocation table (channel, product_id, allocated_qty, remaining_qty)
- [x] Create SalesEvent table for Shopify fulfillment tracking
- [x] Implement allocation workflow (ERP → Shopify)
- [x] Track allocation remaining vs Shopify inventory

### Inventory Reconciliation
- [x] Create ReconciliationRun table (scheduled/manual, status)
- [x] Create ReconciliationLine table (sku, erp_qty, shopify_qty, delta, variance%)
- [x] Implement reconciliation job
- [x] Add manual reconciliation trigger
- [x] Variance thresholds: pass ≤1 unit or ≤0.5%, warning, critical >3%
- [ ] Reconciliation report UI (pending)

### 3-Pane Core Operations Workspace
- [x] Create CoreOperations page with 3-pane layout
- [x] Left pane: Object tree (Sales Orders, POs, Work Orders, Inventory Lots)
- [x] Center pane: Selected object details + actions
- [x] Right pane: Alerts and recommendations
- [x] Tree navigation for drilling into objects
- [x] Context-aware action buttons
- [x] Real-time alert updates

### RBAC Refinement
- [x] All roles exist (admin, finance, ops, legal, exec, copacker, vendor, contractor)
- [x] Role-based procedure guards implemented
- [ ] Add Plant User role (Work Orders/Receiving/Inventory/Transfers only)
- [ ] Split Finance/Procurement permissions
