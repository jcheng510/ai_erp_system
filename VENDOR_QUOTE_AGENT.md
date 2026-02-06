# Vendor Quote Agent

## Overview

The Vendor Quote Agent is an autonomous AI-powered system that streamlines the vendor quote request and comparison process. It can automatically:

1. **Email vendors** for quotes with professionally generated RFQ emails
2. **Gather responses** from multiple vendors
3. **Compare quotes** using AI analysis considering price, delivery time, and other factors
4. **Highlight the best option** for approval

## How It Works

### 1. Create an RFQ (Request for Quote)

In the Procurement Hub, navigate to the **Vendor Quotes** tab and click **Create RFQ**.

Fill in the details:
- **Material**: Select from existing materials or enter a custom name
- **Quantity**: Amount needed
- **Unit**: Measurement unit (kg, lbs, units, etc.)
- **Specifications**: Quality requirements, certifications, etc.
- **Quote Due Date**: When you need quotes by
- **Required Delivery Date**: When you need the material delivered

### 2. Select Vendors and Send RFQ

After creating the RFQ:
1. Select which vendors to invite using checkboxes
2. Click **Send to Vendors**
3. The AI agent will automatically:
   - Generate professional RFQ emails for each vendor
   - Include all material specifications and requirements
   - Send emails requesting specific information (price, lead time, payment terms, etc.)
   - Track invitation status

### 3. Track Vendor Responses

The system tracks:
- Which vendors have been invited
- Email delivery status
- Quote submission status
- Number of reminders sent

You can send reminder emails to vendors who haven't responded.

### 4. Compare Quotes with AI

Once multiple quotes are received, click **AI Compare Quotes**. The AI agent will:
- Analyze all received quotes
- Calculate total costs including shipping
- Compare delivery times
- Evaluate payment terms
- Consider vendor reliability
- Rank quotes by overall value
- Highlight the best option with reasoning

### 5. Accept Best Quote

After AI comparison:
1. Review the highlighted best quote (shown with green background and "Best" badge)
2. Read the AI's reasoning for the recommendation
3. Click the checkmark to accept the quote
4. Optionally create a Purchase Order directly from the quote

## Features

### AI-Generated Emails

The agent uses GPT to generate professional, context-aware emails that:
- Include all relevant RFQ details
- Request specific information needed for comparison
- Maintain professional tone
- Are customized for each vendor

### Intelligent Quote Comparison

The AI considers multiple factors:
- **Price**: Unit price, total price, shipping costs, handling fees
- **Delivery Time**: Lead time in days, urgency matching
- **Payment Terms**: Net 30, Net 60, etc.
- **Overall Value**: Balance of all factors

### Automatic Ranking

Quotes are automatically ranked with:
- Rank #1 highlighted as "Best"
- Visual indicators (green background for best quote)
- Detailed comparison table
- AI reasoning for selection

## API Access

The vendor quote agent is also available through the AI Assistant chat interface. You can:

```
"Request quotes for 500kg of organic mushrooms from vendors 1, 2, and 3"
```

```
"Compare the quotes for RFQ-20260206-ABC1 and recommend the best option"
```

The AI assistant will use the vendor quote agent tools to execute these requests.

## Technical Details

### Agent Workflow

1. **RFQ Creation**: Creates database record with unique RFQ number (format: RFQ-YYYYMMDD-XXXX)
2. **Email Generation**: Uses LLM to generate professional email content
3. **Email Sending**: Sends via SendGrid (if configured) or creates drafts
4. **Response Tracking**: Monitors vendor replies and quote submissions
5. **AI Analysis**: Uses LLM to analyze quotes and provide recommendation
6. **Ranking Update**: Updates database with quote rankings

### Database Tables

- `vendorRfqs`: RFQ records
- `vendorQuotes`: Quote records from vendors
- `vendorRfqInvitations`: Tracking of vendor invitations
- `vendorRfqEmails`: Email history (sent and received)
- `aiAgentTasks`: Agent task tracking
- `aiAgentLogs`: Agent action logs

### API Endpoints

#### Request Quotes
```typescript
vendorQuotes.agent.requestQuotes({
  materialName: string,
  quantity: string,
  unit: string,
  vendorIds: number[],
  specifications?: string,
  requiredDeliveryDate?: Date
})
```

#### Compare Quotes
```typescript
vendorQuotes.agent.compareQuotes({
  rfqId: number
})
```

#### Send Reminder
```typescript
vendorQuotes.agent.sendReminder({
  rfqId: number,
  vendorId: number
})
```

## Best Practices

1. **Select Multiple Vendors**: Send to at least 3 vendors for good comparison
2. **Clear Specifications**: Provide detailed specifications for accurate quotes
3. **Reasonable Deadlines**: Give vendors enough time to respond (5-7 business days)
4. **Follow Up**: Use reminder feature if vendors don't respond within expected timeframe
5. **Review AI Reasoning**: Always review the AI's explanation before accepting a quote
6. **Consider Context**: AI recommendation is data-driven, but consider relationship factors

## Limitations

- Requires SendGrid configuration for actual email sending (otherwise creates drafts)
- AI comparison is based on quantifiable factors; relationship value and vendor history may need manual consideration
- Email parsing of vendor responses is not automated (quotes must be manually entered)
- Works best with structured quote data

## Future Enhancements

- Automated email parsing to extract quote information from vendor replies
- Machine learning for vendor reliability scoring
- Integration with vendor portals for automatic quote submission
- Historical price analysis and trend detection
- Automated PO generation and approval workflow
- Integration with inventory forecasting
