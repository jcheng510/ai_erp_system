# SendGrid Transactional Email Setup Guide

This guide explains how to set up and use the transactional email system powered by SendGrid.

## Overview

The transactional email system provides:
- Queue-based email sending with retry logic
- SendGrid dynamic template integration
- Webhook event tracking (delivered, bounced, dropped)
- Admin UI for template management and email logs
- Entity-specific email helpers (Quote, PO, Shipment, Alert, RFQ)

## Environment Variables

Add the following environment variables to your secrets:

```bash
# Required
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Optional
SENDGRID_REPLY_TO=support@yourdomain.com
SENDGRID_WEBHOOK_SECRET=your-webhook-signing-secret
PUBLIC_APP_URL=https://your-app-domain.com
```

### Variable Descriptions

| Variable | Required | Description |
|----------|----------|-------------|
| `SENDGRID_API_KEY` | Yes | Your SendGrid API key (starts with `SG.`) |
| `SENDGRID_FROM_EMAIL` | Yes | Default sender email address |
| `SENDGRID_REPLY_TO` | No | Reply-to address for emails |
| `SENDGRID_WEBHOOK_SECRET` | No | Public key for webhook signature verification |
| `PUBLIC_APP_URL` | Yes (prod) | Base URL for email links |

## SendGrid Account Setup

### 1. Create SendGrid Account

1. Sign up at https://sendgrid.com
2. Complete domain authentication (Settings > Sender Authentication)
3. Create an API key with "Mail Send" permissions

### 2. Create Dynamic Templates

1. Go to **Email API > Dynamic Templates**
2. Create templates for each email type:
   - QUOTE
   - PO (Purchase Order)
   - SHIPMENT
   - ALERT
   - RFQ (Request for Quote)
   - INVOICE
   - PAYMENT_REMINDER
   - WELCOME
   - GENERAL

### 3. Template Variables

Each template type receives specific variables. Here are the common ones:

#### Quote Template (`QUOTE`)
```json
{
  "quote_number": "Q-123",
  "vendor_name": "Acme Corp",
  "material_name": "Steel Plate",
  "quantity": "1000",
  "unit": "kg",
  "unit_price": "25.00",
  "total_price": "25000.00",
  "currency": "USD",
  "valid_until": "2024-02-15",
  "view_quote_url": "https://app.example.com/quotes/123",
  "app_url": "https://app.example.com",
  "current_year": 2024
}
```

#### Purchase Order Template (`PO`)
```json
{
  "po_number": "PO-2024-001",
  "vendor_name": "Acme Corp",
  "order_date": "01/15/2024",
  "expected_date": "02/01/2024",
  "shipping_address": "123 Main St, City, State 12345",
  "subtotal": "1000.00",
  "tax_amount": "80.00",
  "shipping_amount": "50.00",
  "total_amount": "1130.00",
  "currency": "USD",
  "notes": "Special handling required",
  "line_items": [
    {
      "line_number": 1,
      "description": "Widget A",
      "quantity": "100",
      "unit_price": "10.00",
      "total": "1000.00"
    }
  ],
  "view_po_url": "https://app.example.com/purchase-orders/123",
  "pdf_url": "https://app.example.com/api/po/123/pdf"
}
```

#### Shipment Template (`SHIPMENT`)
```json
{
  "shipment_number": "SHP-2024-001",
  "shipment_type": "outbound",
  "carrier": "FedEx",
  "tracking_number": "1234567890",
  "status": "in_transit",
  "ship_date": "01/15/2024",
  "delivery_date": "01/20/2024",
  "from_address": "Warehouse A, 123 Main St",
  "to_address": "Customer B, 456 Oak Ave",
  "tracking_url": "https://fedex.com/track?id=1234567890",
  "view_shipment_url": "https://app.example.com/shipments/123"
}
```

#### Alert Template (`ALERT`)
```json
{
  "alert_number": "ALT-2024-001",
  "alert_type": "low_stock",
  "severity": "warning",
  "title": "Low Stock Alert: Widget A",
  "description": "Current stock is below reorder point",
  "entity_type": "product",
  "entity_id": 123,
  "threshold_value": "100",
  "actual_value": "25",
  "created_at": "01/15/2024 10:30 AM",
  "view_alert_url": "https://app.example.com/alerts/123"
}
```

### 4. Configure Webhooks (Optional)

To receive delivery status updates:

1. Go to **Settings > Mail Settings > Event Webhooks**
2. Add a new webhook:
   - **URL**: `https://your-app-domain.com/webhooks/sendgrid/events`
   - **Events**: Select at minimum: `Delivered`, `Bounced`, `Dropped`, `Deferred`
   - Enable **Signed Event Webhook Requests** (recommended)
3. Copy the **Verification Key** and set it as `SENDGRID_WEBHOOK_SECRET`

## Using the Admin UI

### Access the Email Settings

Navigate to **Settings > Emails** (`/settings/emails`)

### Template Configuration

1. Click **Add Template**
2. Select the template type (QUOTE, PO, etc.)
3. Enter the SendGrid template ID (format: `d-xxxxxxxxxxxxxxxxxxxx`)
4. Add optional description and default subject
5. Save

### Viewing Email Logs

The **Email Logs** tab shows all sent emails with:
- Status (queued, sent, delivered, bounced, failed)
- Recipient and subject
- Template used
- Timestamp
- Ability to retry failed emails

### Webhook Events

The **Webhook Events** tab shows raw events from SendGrid for debugging.

## API Usage

### Queue an Email (tRPC)

```typescript
// Queue a generic email
const result = await trpc.transactionalEmail.queueEmail.mutate({
  templateName: "GENERAL",
  toEmail: "recipient@example.com",
  toName: "John Doe",
  subject: "Your Order Confirmation",
  payload: {
    order_id: "12345",
    customer_name: "John Doe",
    // ... other template variables
  },
  idempotencyKey: "order-confirmation-12345", // Optional: prevent duplicates
  relatedEntityType: "order",
  relatedEntityId: 12345,
});
```

### Send Entity-Specific Emails

```typescript
// Send a Quote email
await trpc.transactionalEmail.sendQuoteEmail.mutate({
  quoteId: 123,
});

// Send a PO email
await trpc.transactionalEmail.sendPOEmail.mutate({
  poId: 456,
  pdfUrl: "https://app.example.com/api/po/456/pdf",
});

// Send a Shipment notification
await trpc.transactionalEmail.sendShipmentEmail.mutate({
  shipmentId: 789,
});

// Send an Alert email
await trpc.transactionalEmail.sendAlertEmail.mutate({
  alertId: 101,
  recipientEmail: "manager@example.com",
});

// Send an RFQ email
await trpc.transactionalEmail.sendRFQEmail.mutate({
  rfqId: 202,
  vendorId: 5,
});
```

### Process Queue Manually

```typescript
// Trigger processing of queued emails (admin only)
const result = await trpc.transactionalEmail.processQueue.mutate({ limit: 10 });
// Returns: { processed: 5, successful: 4, failed: 1, results: [...] }
```

### Retry Failed Email

```typescript
await trpc.transactionalEmail.messages.retry.mutate({ id: 123 });
```

## Background Worker

The email queue worker runs automatically and:
- Checks for queued emails every 30 seconds
- Processes up to 10 emails per batch
- Sends up to 5 emails concurrently
- Implements exponential backoff for retries
- Marks emails as failed after 3 retry attempts

## Email Status Flow

```
queued → sending → sent → delivered (via webhook)
                      ↓
                   bounced/dropped (via webhook)

queued → sending → failed (after max retries)
```

## Security Considerations

1. **API Key Storage**: Never store API keys in code or database. Use environment variables only.

2. **Webhook Verification**: Enable and configure `SENDGRID_WEBHOOK_SECRET` to verify webhook signatures.

3. **Audit Logging**: All email sends are logged in the audit log with the triggering user and entity reference.

4. **Idempotency Keys**: Use idempotency keys to prevent duplicate email sends.

## Troubleshooting

### Emails Not Sending

1. Check that `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` are set
2. Verify the template ID exists in SendGrid
3. Check the email logs for error messages
4. Ensure the template is marked as "Active"

### Webhook Events Not Received

1. Verify the webhook URL is accessible from the internet
2. Check that the correct events are enabled in SendGrid
3. Verify the webhook secret matches if signature verification is enabled
4. Check server logs for webhook processing errors

### Emails Bouncing

1. Check the bounce reason in the email events
2. Verify sender domain authentication in SendGrid
3. Review email content for spam triggers

## Database Schema

The system uses three tables:

- `transactional_email_templates`: Maps template names to SendGrid template IDs
- `email_messages`: Tracks all email sends with status, payload, and errors
- `email_events`: Stores raw webhook events from SendGrid

## Running Tests

```bash
npm test -- server/transactionalEmail.test.ts
```
