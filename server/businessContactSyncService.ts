/**
 * Business Contact Sync Service
 *
 * Syncs contacts and messages from WhatsApp, SMS, and Email channels.
 * Uses NLP (via LLM) to determine if messages are business-related.
 * Auto-creates CRM contacts when:
 *   - A contact is tagged "biz"
 *   - A message mentions "superhumn"
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";

// ============================================
// NLP BUSINESS RELEVANCE CLASSIFIER
// ============================================

export interface BusinessClassification {
  isBusinessRelated: boolean;
  relevanceScore: number; // 0-100
  mentionsSuperhumn: boolean;
  reasoning: string;
  detectedTopics: string[];
}

/**
 * Uses LLM to classify whether a message is business-related.
 * Falls back to keyword matching if LLM is unavailable.
 */
export async function classifyBusinessRelevance(
  messageContent: string,
  contactName?: string,
  contextHint?: string
): Promise<BusinessClassification> {
  // Quick check: does the message mention "superhumn" (case-insensitive)?
  const mentionsSuperhumn = /superhumn/i.test(messageContent);

  // Try LLM classification first
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a business message classifier. Analyze the given message and determine:
1. Whether it is related to business (B2B communication, sales, partnerships, invoices, orders, product inquiries, business introductions, professional networking, etc.)
2. A relevance score from 0-100 (0 = purely personal, 100 = clearly business)
3. Whether the message mentions "superhumn" (a company/brand name)
4. Key business topics detected

Respond ONLY with valid JSON in this format:
{"isBusinessRelated": boolean, "relevanceScore": number, "mentionsSuperhumn": boolean, "reasoning": "brief explanation", "detectedTopics": ["topic1", "topic2"]}`,
        },
        {
          role: "user",
          content: `Classify this message${contactName ? ` from "${contactName}"` : ""}${contextHint ? ` (context: ${contextHint})` : ""}:\n\n"${messageContent}"`,
        },
      ],
      maxTokens: 300,
    });

    const responseText =
      typeof result.choices[0]?.message?.content === "string"
        ? result.choices[0].message.content
        : "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isBusinessRelated: parsed.isBusinessRelated ?? false,
        relevanceScore: Math.min(100, Math.max(0, parsed.relevanceScore ?? 0)),
        mentionsSuperhumn: mentionsSuperhumn || (parsed.mentionsSuperhumn ?? false),
        reasoning: parsed.reasoning ?? "",
        detectedTopics: parsed.detectedTopics ?? [],
      };
    }
  } catch (err) {
    console.warn("[BusinessSync] LLM classification failed, using keyword fallback:", err);
  }

  // Fallback: keyword-based classification
  return classifyByKeywords(messageContent, mentionsSuperhumn);
}

/**
 * Keyword-based fallback classifier when LLM is unavailable.
 */
function classifyByKeywords(
  content: string,
  mentionsSuperhumn: boolean
): BusinessClassification {
  const lower = content.toLowerCase();

  const businessKeywords = [
    "invoice", "purchase", "order", "quote", "proposal", "contract",
    "payment", "delivery", "shipment", "meeting", "partnership",
    "collaboration", "pricing", "wholesale", "retail", "inventory",
    "supply", "vendor", "client", "customer", "deadline", "project",
    "budget", "revenue", "profit", "margin", "roi", "kpi",
    "agreement", "terms", "negotiate", "deal", "pitch", "deck",
    "investor", "funding", "raise", "valuation", "equity",
    "sample", "production", "manufacture", "warehouse", "logistics",
    "superhumn", "biz", "business",
  ];

  const matchedKeywords = businessKeywords.filter((kw) => lower.includes(kw));
  const score = Math.min(100, matchedKeywords.length * 15);
  const isBusinessRelated = score >= 30 || mentionsSuperhumn;

  return {
    isBusinessRelated,
    relevanceScore: mentionsSuperhumn ? Math.max(score, 80) : score,
    mentionsSuperhumn,
    reasoning: matchedKeywords.length > 0
      ? `Matched keywords: ${matchedKeywords.join(", ")}`
      : "No business keywords detected",
    detectedTopics: matchedKeywords,
  };
}

// ============================================
// CONTACT AUTO-CREATE / UPDATE LOGIC
// ============================================

interface SyncedMessage {
  channel: "whatsapp" | "sms" | "email";
  identifier: string; // phone number or email
  contactName?: string;
  content: string;
  direction: "inbound" | "outbound";
  externalMessageId?: string;
  timestamp?: Date;
  tags?: string[]; // tags on the contact in the source system
}

interface SyncResult {
  messagesScanned: number;
  messagesMatched: number;
  contactsCreated: number;
  contactsUpdated: number;
  contactsTagged: number;
  errors: string[];
  details: Array<{
    identifier: string;
    channel: string;
    action: "created" | "updated" | "tagged" | "skipped";
    contactId?: number;
    reason: string;
  }>;
}

/**
 * Process a batch of messages from any channel. For each message:
 * 1. Classify via NLP if business-related
 * 2. Auto-create contact if tagged "biz" or mentions "superhumn"
 * 3. Tag existing contacts appropriately
 * 4. Log interactions in CRM
 */
export async function processBusinessMessages(
  messages: SyncedMessage[],
  userId?: number
): Promise<SyncResult> {
  const result: SyncResult = {
    messagesScanned: messages.length,
    messagesMatched: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    contactsTagged: 0,
    errors: [],
    details: [],
  };

  for (const msg of messages) {
    try {
      // Step 1: Classify business relevance
      const classification = await classifyBusinessRelevance(
        msg.content,
        msg.contactName,
        msg.channel
      );

      // Step 2: Check if contact has "biz" tag from source
      const hasBizTag = msg.tags?.some(
        (t) => t.toLowerCase() === "biz"
      ) ?? false;

      // Step 3: Determine if we should process this contact
      const shouldProcess =
        classification.isBusinessRelated ||
        classification.mentionsSuperhumn ||
        hasBizTag;

      if (!shouldProcess) {
        result.details.push({
          identifier: msg.identifier,
          channel: msg.channel,
          action: "skipped",
          reason: `Not business-related (score: ${classification.relevanceScore})`,
        });
        continue;
      }

      result.messagesMatched++;

      // Step 4: Find or create CRM contact
      let contact = await lookupContact(msg.channel, msg.identifier);
      let action: "created" | "updated" | "tagged" = "updated";

      if (!contact) {
        // Auto-create contact
        const nameParts = parseContactName(msg.contactName);
        const contactData: Parameters<typeof db.createCrmContact>[0] = {
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          fullName: nameParts.fullName,
          contactType: "lead" as const,
          source: channelToSource(msg.channel),
          status: "active" as const,
          notes: `Auto-created from ${msg.channel} sync. ${classification.reasoning}`,
          capturedBy: userId,
        };

        // Set channel-specific identifier
        if (msg.channel === "email") {
          contactData.email = msg.identifier;
          contactData.preferredChannel = "email";
        } else if (msg.channel === "whatsapp") {
          contactData.whatsappNumber = msg.identifier;
          contactData.phone = msg.identifier;
          contactData.preferredChannel = "whatsapp";
        } else if (msg.channel === "sms") {
          contactData.phone = msg.identifier;
          contactData.preferredChannel = "sms";
        }

        const contactId = await db.createCrmContact(contactData);
        contact = await db.getCrmContactById(contactId);
        action = "created";
        result.contactsCreated++;
      } else {
        // Update last contacted timestamp
        await db.updateCrmContact(contact.id, {
          lastContactedAt: new Date(),
        });
        result.contactsUpdated++;
      }

      if (!contact) {
        result.errors.push(`Failed to create/find contact for ${msg.identifier}`);
        continue;
      }

      // Step 5: Tag with "biz" if tagged in source or mentions superhumn
      if (hasBizTag || classification.mentionsSuperhumn) {
        try {
          const bizTagId = await db.findOrCreateBizTag();
          const existingTags = await db.getContactTags(contact.id);
          const alreadyTagged = existingTags.some((t) => t.name === "biz");
          if (!alreadyTagged) {
            await db.addTagToContact(contact.id, bizTagId);
            result.contactsTagged++;
            action = action === "created" ? "created" : "tagged";
          }
        } catch (tagErr) {
          result.errors.push(`Failed to tag contact ${contact.id}: ${tagErr}`);
        }
      }

      // Step 6: Log the message in the appropriate table & create CRM interaction
      await logChannelMessage(msg, contact.id, classification, userId);

      await db.createCrmInteraction({
        contactId: contact.id,
        channel: msg.channel,
        interactionType: msg.direction === "inbound" ? "received" : "sent",
        content: msg.content,
        summary: classification.reasoning,
        sentiment: classification.relevanceScore >= 60 ? "positive" : "neutral",
        performedBy: userId,
      });

      result.details.push({
        identifier: msg.identifier,
        channel: msg.channel,
        action,
        contactId: contact.id,
        reason: classification.mentionsSuperhumn
          ? "Mentions superhumn"
          : hasBizTag
          ? 'Tagged "biz"'
          : `Business relevance: ${classification.relevanceScore}%`,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Error processing ${msg.channel}/${msg.identifier}: ${errMsg}`);
    }
  }

  return result;
}

// ============================================
// CHANNEL-SPECIFIC SYNC FUNCTIONS
// ============================================

/**
 * Sync WhatsApp messages - scans recent WhatsApp messages,
 * classifies them, and creates/updates CRM contacts.
 */
export async function syncWhatsappBusinessContacts(userId?: number): Promise<SyncResult> {
  const syncLogId = await db.createBusinessSyncLog({
    syncSource: "whatsapp",
    syncType: "manual",
    syncStatus: "running",
    triggeredBy: userId,
  });

  try {
    // Fetch recent unprocessed WhatsApp messages
    const recentMessages = await db.getWhatsappMessages({ limit: 200 });
    const unprocessed = recentMessages.filter((m) => !m.aiProcessed);

    const syncMessages: SyncedMessage[] = unprocessed.map((m) => ({
      channel: "whatsapp" as const,
      identifier: m.whatsappNumber,
      contactName: m.contactName ?? undefined,
      content: m.content || "",
      direction: m.direction as "inbound" | "outbound",
      externalMessageId: m.messageId ?? undefined,
      timestamp: m.createdAt ? new Date(m.createdAt) : undefined,
    }));

    const result = await processBusinessMessages(syncMessages, userId);

    // Mark messages as AI processed
    for (const msg of unprocessed) {
      await db.updateWhatsappMessageStatus(msg.id, msg.status || "delivered");
    }

    await db.updateBusinessSyncLog(syncLogId, {
      syncStatus: "completed",
      messagesScanned: result.messagesScanned,
      messagesMatched: result.messagesMatched,
      contactsCreated: result.contactsCreated,
      contactsUpdated: result.contactsUpdated,
      contactsTagged: result.contactsTagged,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      completedAt: new Date(),
    });

    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db.updateBusinessSyncLog(syncLogId, {
      syncStatus: "failed",
      errors: JSON.stringify([errMsg]),
      completedAt: new Date(),
    });
    throw err;
  }
}

/**
 * Sync SMS messages - scans recent SMS messages,
 * classifies them, and creates/updates CRM contacts.
 */
export async function syncSmsBusinessContacts(userId?: number): Promise<SyncResult> {
  const syncLogId = await db.createBusinessSyncLog({
    syncSource: "sms",
    syncType: "manual",
    syncStatus: "running",
    triggeredBy: userId,
  });

  try {
    const recentMessages = await db.getSmsMessages({ limit: 200 });
    const unprocessed = recentMessages.filter((m) => !m.aiProcessed);

    const syncMessages: SyncedMessage[] = unprocessed.map((m) => ({
      channel: "sms" as const,
      identifier: m.phoneNumber,
      contactName: m.contactName ?? undefined,
      content: m.content || "",
      direction: m.direction as "inbound" | "outbound",
      externalMessageId: m.messageId ?? undefined,
      timestamp: m.createdAt ? new Date(m.createdAt) : undefined,
    }));

    const result = await processBusinessMessages(syncMessages, userId);

    // Mark SMS messages as processed
    for (const msg of unprocessed) {
      const classification = await classifyBusinessRelevance(msg.content || "");
      await db.updateSmsMessage(msg.id, {
        aiProcessed: true,
        isBusinessRelated: classification.isBusinessRelated,
        businessRelevanceScore: classification.relevanceScore,
      });
    }

    await db.updateBusinessSyncLog(syncLogId, {
      syncStatus: "completed",
      messagesScanned: result.messagesScanned,
      messagesMatched: result.messagesMatched,
      contactsCreated: result.contactsCreated,
      contactsUpdated: result.contactsUpdated,
      contactsTagged: result.contactsTagged,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      completedAt: new Date(),
    });

    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db.updateBusinessSyncLog(syncLogId, {
      syncStatus: "failed",
      errors: JSON.stringify([errMsg]),
      completedAt: new Date(),
    });
    throw err;
  }
}

/**
 * Sync Email messages - scans recent inbound emails,
 * classifies them, and creates/updates CRM contacts.
 */
export async function syncEmailBusinessContacts(userId?: number): Promise<SyncResult> {
  const syncLogId = await db.createBusinessSyncLog({
    syncSource: "email",
    syncType: "manual",
    syncStatus: "running",
    triggeredBy: userId,
  });

  try {
    // Fetch recent inbound emails that haven't been CRM-processed
    const dbConn = await db.getDb();
    if (!dbConn) throw new Error("Database not available");

    const { inboundEmails } = await import("../drizzle/schema");
    const { desc: descOrder } = await import("drizzle-orm");

    const recentEmails = await dbConn
      .select()
      .from(inboundEmails)
      .orderBy(descOrder(inboundEmails.receivedAt))
      .limit(200);

    const syncMessages: SyncedMessage[] = recentEmails.map((e) => ({
      channel: "email" as const,
      identifier: e.fromEmail,
      contactName: e.fromName ?? undefined,
      content: `${e.subject || ""}\n\n${e.bodyText || ""}`.trim(),
      direction: "inbound" as const,
      externalMessageId: e.messageId ?? undefined,
      timestamp: e.receivedAt ? new Date(e.receivedAt) : undefined,
    }));

    const result = await processBusinessMessages(syncMessages, userId);

    await db.updateBusinessSyncLog(syncLogId, {
      syncStatus: "completed",
      messagesScanned: result.messagesScanned,
      messagesMatched: result.messagesMatched,
      contactsCreated: result.contactsCreated,
      contactsUpdated: result.contactsUpdated,
      contactsTagged: result.contactsTagged,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      completedAt: new Date(),
    });

    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db.updateBusinessSyncLog(syncLogId, {
      syncStatus: "failed",
      errors: JSON.stringify([errMsg]),
      completedAt: new Date(),
    });
    throw err;
  }
}

/**
 * Sync all channels at once.
 */
export async function syncAllBusinessContacts(userId?: number) {
  const results = {
    whatsapp: null as SyncResult | null,
    sms: null as SyncResult | null,
    email: null as SyncResult | null,
    errors: [] as string[],
  };

  try {
    results.whatsapp = await syncWhatsappBusinessContacts(userId);
  } catch (err) {
    results.errors.push(`WhatsApp sync failed: ${err instanceof Error ? err.message : err}`);
  }

  try {
    results.sms = await syncSmsBusinessContacts(userId);
  } catch (err) {
    results.errors.push(`SMS sync failed: ${err instanceof Error ? err.message : err}`);
  }

  try {
    results.email = await syncEmailBusinessContacts(userId);
  } catch (err) {
    results.errors.push(`Email sync failed: ${err instanceof Error ? err.message : err}`);
  }

  return {
    ...results,
    totals: {
      messagesScanned:
        (results.whatsapp?.messagesScanned ?? 0) +
        (results.sms?.messagesScanned ?? 0) +
        (results.email?.messagesScanned ?? 0),
      messagesMatched:
        (results.whatsapp?.messagesMatched ?? 0) +
        (results.sms?.messagesMatched ?? 0) +
        (results.email?.messagesMatched ?? 0),
      contactsCreated:
        (results.whatsapp?.contactsCreated ?? 0) +
        (results.sms?.contactsCreated ?? 0) +
        (results.email?.contactsCreated ?? 0),
      contactsUpdated:
        (results.whatsapp?.contactsUpdated ?? 0) +
        (results.sms?.contactsUpdated ?? 0) +
        (results.email?.contactsUpdated ?? 0),
      contactsTagged:
        (results.whatsapp?.contactsTagged ?? 0) +
        (results.sms?.contactsTagged ?? 0) +
        (results.email?.contactsTagged ?? 0),
    },
  };
}

/**
 * Process a single incoming webhook message from any channel.
 * Useful for real-time processing as messages arrive.
 */
export async function processIncomingMessage(
  channel: "whatsapp" | "sms" | "email",
  identifier: string,
  content: string,
  contactName?: string,
  tags?: string[],
  userId?: number
): Promise<{
  isBusinessRelated: boolean;
  contactId?: number;
  contactCreated: boolean;
  classification: BusinessClassification;
}> {
  const classification = await classifyBusinessRelevance(content, contactName, channel);

  const hasBizTag = tags?.some((t) => t.toLowerCase() === "biz") ?? false;
  const shouldProcess =
    classification.isBusinessRelated ||
    classification.mentionsSuperhumn ||
    hasBizTag;

  if (!shouldProcess) {
    return {
      isBusinessRelated: false,
      contactCreated: false,
      classification,
    };
  }

  // Process as a batch of one
  const result = await processBusinessMessages(
    [
      {
        channel,
        identifier,
        contactName,
        content,
        direction: "inbound",
        tags,
      },
    ],
    userId
  );

  const detail = result.details[0];
  return {
    isBusinessRelated: true,
    contactId: detail?.contactId,
    contactCreated: detail?.action === "created",
    classification,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function lookupContact(
  channel: "whatsapp" | "sms" | "email",
  identifier: string
) {
  if (channel === "email") {
    return db.getCrmContactByEmail(identifier);
  } else if (channel === "whatsapp") {
    return db.getCrmContactByWhatsappNumber(identifier);
  } else {
    return db.getCrmContactByPhone(identifier);
  }
}

function parseContactName(name?: string): {
  firstName: string;
  lastName?: string;
  fullName: string;
} {
  if (!name) {
    return { firstName: "Unknown", fullName: "Unknown Contact" };
  }
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
    fullName: name.trim(),
  };
}

function channelToSource(channel: "whatsapp" | "sms" | "email") {
  switch (channel) {
    case "whatsapp":
      return "whatsapp" as const;
    case "sms":
      return "cold_outreach" as const; // SMS maps to cold_outreach in the existing enum
    case "email":
      return "cold_outreach" as const;
  }
}

async function logChannelMessage(
  msg: SyncedMessage,
  contactId: number,
  classification: BusinessClassification,
  userId?: number
) {
  if (msg.channel === "whatsapp") {
    await db.createWhatsappMessage({
      contactId,
      whatsappNumber: msg.identifier,
      contactName: msg.contactName,
      direction: msg.direction,
      content: msg.content,
      messageId: msg.externalMessageId,
      status: "delivered",
      aiProcessed: true,
      sentiment: classification.relevanceScore >= 60 ? "positive" : "neutral",
      aiSummary: classification.reasoning,
      sentBy: userId,
    });
  } else if (msg.channel === "sms") {
    await db.createSmsMessage({
      contactId,
      phoneNumber: msg.identifier,
      contactName: msg.contactName,
      direction: msg.direction,
      content: msg.content,
      messageId: msg.externalMessageId,
      status: "delivered",
      aiProcessed: true,
      isBusinessRelated: classification.isBusinessRelated,
      businessRelevanceScore: classification.relevanceScore,
      sentiment: classification.relevanceScore >= 60 ? "positive" : "neutral",
      aiSummary: classification.reasoning,
      sentBy: userId,
    });
  }
  // Email messages are already stored in inboundEmails table; no need to duplicate
}
