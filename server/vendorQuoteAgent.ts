import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { sendEmail, formatEmailHtml } from "./_core/email";
import {
  vendors,
  vendorRfqs,
  vendorQuotes,
  vendorRfqInvitations,
  vendorRfqEmails,
  aiAgentTasks,
  aiAgentLogs,
} from "../drizzle/schema";
import { eq, and, desc, sql, isNull, inArray } from "drizzle-orm";

// ============================================
// VENDOR QUOTE AGENT SERVICE
// Autonomous agent for managing vendor quote requests
// ============================================

export interface VendorQuoteAgentContext {
  userId: number;
  userName: string;
  rfqId?: number;
  materialName?: string;
  quantity?: string;
  unit?: string;
}

export interface QuoteComparisonResult {
  bestQuote: any;
  allQuotes: any[];
  comparisonMetrics: {
    lowestPrice: number;
    fastestDelivery: number;
    bestOverall: number;
  };
  reasoning: string;
}

// ============================================
// EMAIL VENDOR FOR QUOTES
// ============================================

export async function emailVendorsForQuotes(
  rfqId: number,
  vendorIds: number[],
  userId: number
): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  const db = await getDb();
  if (!db) return { success: false, sent: 0, failed: 0, errors: ["Database not available"] };

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  try {
    // Get RFQ details
    const [rfq] = await db.select().from(vendorRfqs).where(eq(vendorRfqs.id, rfqId));
    if (!rfq) {
      return { success: false, sent: 0, failed: 0, errors: ["RFQ not found"] };
    }

    // Get vendor details
    const vendorList = await db.select().from(vendors).where(inArray(vendors.id, vendorIds));

    for (const vendor of vendorList) {
      if (!vendor.email) {
        failed++;
        errors.push(`Vendor ${vendor.name} has no email address`);
        continue;
      }

      try {
        // Create invitation record
        await db.insert(vendorRfqInvitations).values({
          rfqId,
          vendorId: vendor.id,
          status: "pending",
          invitedAt: new Date(),
        });

        // Generate AI email content
        const emailPrompt = `Generate a professional Request for Quote (RFQ) email to a vendor for the following material:

RFQ Number: ${rfq.rfqNumber}
Material: ${rfq.materialName}
Description: ${rfq.materialDescription || 'N/A'}
Quantity Required: ${rfq.quantity} ${rfq.unit}
Specifications: ${rfq.specifications || 'Standard specifications'}
Required Delivery Date: ${rfq.requiredDeliveryDate ? new Date(rfq.requiredDeliveryDate).toLocaleDateString() : 'Flexible'}
Delivery Location: ${rfq.deliveryLocation || 'To be confirmed'}
Incoterms: ${rfq.incoterms || 'FOB'}
Priority: ${rfq.priority || 'Normal'}

Please request:
1. Unit price and total price
2. Lead time / delivery schedule
3. Minimum order quantity
4. Payment terms
5. Quote validity period

Request a response by ${rfq.quoteDueDate ? new Date(rfq.quoteDueDate).toLocaleDateString() : '5 business days'}.

Format the email professionally and keep it concise.`;

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: 'You are a procurement specialist drafting RFQ emails to vendors. Be professional, clear, and include all relevant material details.' },
            { role: 'user', content: emailPrompt },
          ],
        });

        const rawEmailBody = response.choices[0]?.message?.content;
        const emailBody = typeof rawEmailBody === 'string' ? rawEmailBody : 'Unable to generate email content.';

        const emailSubject = `Request for Quote: ${rfq.rfqNumber} - ${rfq.materialName}`;

        // Send email
        const sendResult = await sendEmail({
          to: vendor.email,
          subject: emailSubject,
          text: emailBody,
          html: formatEmailHtml(emailBody),
        });

        // Save email record
        await db.insert(vendorRfqEmails).values({
          rfqId,
          vendorId: vendor.id,
          direction: 'outbound',
          emailType: 'rfq_request',
          fromEmail: process.env.SENDGRID_FROM_EMAIL || 'procurement@company.com',
          toEmail: vendor.email,
          subject: emailSubject,
          body: emailBody,
          aiGenerated: true,
          sendStatus: sendResult.success ? 'sent' : 'failed',
          sentAt: sendResult.success ? new Date() : null,
        });

        if (sendResult.success) {
          sent++;
          // Update invitation status
          await db
            .update(vendorRfqInvitations)
            .set({ status: 'sent', emailSentAt: new Date() })
            .where(and(eq(vendorRfqInvitations.rfqId, rfqId), eq(vendorRfqInvitations.vendorId, vendor.id)));
        } else {
          failed++;
          errors.push(`Failed to send email to ${vendor.name}: ${sendResult.error}`);
        }
      } catch (err: any) {
        failed++;
        errors.push(`Error sending email to ${vendor.name}: ${err.message}`);
      }
    }

    // Update RFQ status
    if (sent > 0) {
      await db.update(vendorRfqs).set({ status: 'sent' }).where(eq(vendorRfqs.id, rfqId));
    }

    return { success: sent > 0, sent, failed, errors };
  } catch (err: any) {
    return { success: false, sent: 0, failed: 0, errors: [err.message] };
  }
}

// ============================================
// GATHER AND COMPARE QUOTES
// ============================================

export async function gatherAndCompareQuotes(rfqId: number): Promise<QuoteComparisonResult | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get all quotes for this RFQ
    const quotes = await db
      .select()
      .from(vendorQuotes)
      .where(and(eq(vendorQuotes.rfqId, rfqId), eq(vendorQuotes.status, "received")))
      .orderBy(vendorQuotes.createdAt);

    if (quotes.length === 0) {
      return null;
    }

    // Get vendor info for each quote
    const vendorIds = Array.from(new Set(quotes.map(q => q.vendorId)));
    const vendorList = await db.select().from(vendors).where(inArray(vendors.id, vendorIds));
    const vendorMap = new Map(vendorList.map(v => [v.id, v]));

    // Attach vendor info to quotes
    const quotesWithVendors = quotes.map(q => ({
      ...q,
      vendor: vendorMap.get(q.vendorId),
    }));

    // Calculate comparison metrics
    const prices = quotes.map(q => parseFloat(q.totalPrice || "0"));
    const deliveryTimes = quotes.filter(q => q.leadTimeDays).map(q => q.leadTimeDays!);

    const lowestPrice = Math.min(...prices);
    const fastestDelivery = deliveryTimes.length > 0 ? Math.min(...deliveryTimes) : 0;

    // Use AI to determine the best quote
    const quoteSummaries = quotesWithVendors.map((q, idx) => ({
      index: idx,
      vendor: q.vendor?.name || 'Unknown',
      unitPrice: q.unitPrice,
      totalPrice: q.totalPrice,
      leadTimeDays: q.leadTimeDays,
      paymentTerms: q.paymentTerms,
      shippingCost: q.shippingCost,
      notes: q.notes,
    }));

    const aiPrompt = `You are a procurement analyst. Analyze these vendor quotes and determine the best option.

Quotes:
${JSON.stringify(quoteSummaries, null, 2)}

Consider:
1. Total cost (including shipping)
2. Delivery time
3. Payment terms
4. Vendor reliability (if known)
5. Overall value

Respond with a JSON object in this format:
{
  "bestQuoteIndex": <index of best quote>,
  "reasoning": "<brief explanation of why this is the best choice>",
  "concerns": "<any concerns or notes about the recommendation>"
}`;

    const aiResponse = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a procurement analyst specializing in vendor quote comparison. Provide data-driven recommendations.' },
        { role: 'user', content: aiPrompt },
      ],
    });

    const rawAiResult = aiResponse.choices[0]?.message?.content;
    let bestQuoteIndex = 0;
    let reasoning = "Selected based on lowest total price";

    // Try to parse AI response
    if (typeof rawAiResult === 'string') {
      try {
        // Extract JSON from the response (it might be wrapped in markdown)
        const jsonMatch = rawAiResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiResult = JSON.parse(jsonMatch[0]);
          bestQuoteIndex = aiResult.bestQuoteIndex || 0;
          reasoning = aiResult.reasoning || reasoning;
        }
      } catch (e) {
        // Fall back to simple lowest price logic
        bestQuoteIndex = prices.indexOf(lowestPrice);
      }
    } else {
      // Fall back to simple lowest price logic
      bestQuoteIndex = prices.indexOf(lowestPrice);
    }

    const bestQuote = quotesWithVendors[bestQuoteIndex];

    // Update quote rankings
    for (let i = 0; i < quotes.length; i++) {
      await db
        .update(vendorQuotes)
        .set({ overallRank: i === bestQuoteIndex ? 1 : i + 2 })
        .where(eq(vendorQuotes.id, quotes[i].id));
    }

    return {
      bestQuote,
      allQuotes: quotesWithVendors,
      comparisonMetrics: {
        lowestPrice,
        fastestDelivery,
        bestOverall: bestQuoteIndex,
      },
      reasoning,
    };
  } catch (err: any) {
    console.error("Error comparing quotes:", err);
    return null;
  }
}

// ============================================
// AUTONOMOUS WORKFLOW: REQUEST VENDOR QUOTES
// ============================================

export async function runVendorQuoteWorkflow(
  materialName: string,
  quantity: string,
  unit: string,
  vendorIds: number[],
  userId: number,
  specifications?: string,
  requiredDeliveryDate?: Date
): Promise<{ success: boolean; rfqId?: number; taskId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Step 1: Create RFQ
    const rfqNumber = await generateRfqNumber();
    const rfqResult = await db.insert(vendorRfqs).values({
      rfqNumber,
      materialName,
      quantity,
      unit,
      specifications,
      requiredDeliveryDate,
      quoteDueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      status: 'draft',
      createdById: userId,
    });

    const rfqId = rfqResult[0].insertId;

    // Step 2: Create AI Agent Task for tracking
    const taskResult = await db.insert(aiAgentTasks).values({
      taskType: 'send_rfq',
      priority: 'medium',
      status: 'in_progress',
      taskData: JSON.stringify({
        rfqId,
        materialName,
        quantity,
        unit,
        vendorIds,
      }),
      aiReasoning: 'Autonomous vendor quote request workflow initiated',
      aiConfidence: '95.00',
    });

    const taskId = taskResult[0].insertId;

    // Step 3: Send emails to vendors
    const emailResult = await emailVendorsForQuotes(rfqId, vendorIds, userId);

    // Step 4: Log the action
    await db.insert(aiAgentLogs).values({
      taskId,
      action: 'rfq_emails_sent',
      status: emailResult.success ? 'success' : 'warning',
      message: `Sent RFQ emails to ${emailResult.sent} vendors, ${emailResult.failed} failed`,
      details: JSON.stringify({ rfqId, sent: emailResult.sent, failed: emailResult.failed, errors: emailResult.errors }),
    });

    // Step 5: Update task status
    await db
      .update(aiAgentTasks)
      .set({
        status: emailResult.success ? 'pending_approval' : 'failed',
        completedAt: new Date(),
      })
      .where(eq(aiAgentTasks.id, taskId));

    return { success: true, rfqId, taskId };
  } catch (err: any) {
    console.error("Error in vendor quote workflow:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// HELPER: GENERATE RFQ NUMBER
// ============================================

async function generateRfqNumber(): Promise<string> {
  const db = await getDb();
  if (!db) return `RFQ-${Date.now()}`;

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RFQ-${dateStr}-${randomStr}`;
}

// ============================================
// SEND REMINDER TO VENDOR
// ============================================

export async function sendQuoteReminder(
  rfqId: number,
  vendorId: number,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Get RFQ and vendor details
    const [rfq] = await db.select().from(vendorRfqs).where(eq(vendorRfqs.id, rfqId));
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));

    if (!rfq || !vendor || !vendor.email) {
      return { success: false, error: "RFQ or vendor not found" };
    }

    // Generate reminder email
    const emailPrompt = `Generate a polite follow-up email for an RFQ that hasn't received a response:

RFQ Number: ${rfq.rfqNumber}
Material: ${rfq.materialName}
Quantity: ${rfq.quantity} ${rfq.unit}
Original Due Date: ${rfq.quoteDueDate ? new Date(rfq.quoteDueDate).toLocaleDateString() : 'N/A'}

Ask if they received the original request and if they can provide a quote. Be polite and professional.`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a procurement specialist following up on RFQ requests.' },
        { role: 'user', content: emailPrompt },
      ],
    });

    const rawEmailBody = response.choices[0]?.message?.content;
    const emailBody = typeof rawEmailBody === 'string' ? rawEmailBody : 'Unable to generate email content.';

    const emailSubject = `Follow-up: RFQ ${rfq.rfqNumber} - ${rfq.materialName}`;

    // Send email
    const sendResult = await sendEmail({
      to: vendor.email,
      subject: emailSubject,
      text: emailBody,
      html: formatEmailHtml(emailBody),
    });

    // Save email record
    await db.insert(vendorRfqEmails).values({
      rfqId,
      vendorId,
      direction: 'outbound',
      emailType: 'reminder',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'procurement@company.com',
      toEmail: vendor.email,
      subject: emailSubject,
      body: emailBody,
      aiGenerated: true,
      sendStatus: sendResult.success ? 'sent' : 'failed',
      sentAt: sendResult.success ? new Date() : null,
    });

    // Update invitation reminder count
    await db
      .update(vendorRfqInvitations)
      .set({
        reminderCount: sql`${vendorRfqInvitations.reminderCount} + 1`,
        lastReminderAt: new Date(),
      })
      .where(and(eq(vendorRfqInvitations.rfqId, rfqId), eq(vendorRfqInvitations.vendorId, vendorId)));

    return { success: sendResult.success, error: sendResult.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
