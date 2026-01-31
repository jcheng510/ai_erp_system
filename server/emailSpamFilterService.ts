/**
 * Email Spam & Solicitation Filter Service
 * Detects and filters spam, solicitations, and marketing emails
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";

// Classification types
export type EmailClassificationType = "legitimate" | "spam" | "solicitation" | "newsletter" | "automated" | "unknown";

export interface SpamFilterResult {
  classification: EmailClassificationType;
  confidence: number;
  spamScore: number;
  solicitationScore: number;
  reasons: string[];
  detectedPatterns: string[];
  senderReputation: "trusted" | "neutral" | "suspicious" | "blocked";
  isKnownVendor: boolean;
  matchedVendorId?: number;
  shouldProcess: boolean; // Whether to process attachments from this email
}

// Common spam/solicitation patterns
const SPAM_PATTERNS = [
  /unsubscribe/i,
  /click here/i,
  /act now/i,
  /limited time/i,
  /exclusive offer/i,
  /free gift/i,
  /winner/i,
  /congratulations.*won/i,
  /claim your/i,
  /verify your account/i,
  /update your payment/i,
  /urgent action required/i,
  /your account will be/i,
  /suspicious activity/i,
];

const SOLICITATION_PATTERNS = [
  /reaching out/i,
  /wanted to connect/i,
  /schedule a call/i,
  /book a demo/i,
  /free trial/i,
  /increase your/i,
  /boost your/i,
  /grow your business/i,
  /10x your/i,
  /roi guaranteed/i,
  /we help companies/i,
  /would you be open to/i,
  /quick question/i,
  /following up on my/i,
  /checking in to see/i,
  /thought you might be interested/i,
  /can i get 15 minutes/i,
  /schedule a quick chat/i,
  /partnership opportunity/i,
  /collaboration opportunity/i,
];

const NEWSLETTER_PATTERNS = [
  /newsletter/i,
  /weekly digest/i,
  /monthly update/i,
  /issue #/i,
  /this week in/i,
  /curated for you/i,
  /top stories/i,
  /don't miss/i,
  /view in browser/i,
  /email preferences/i,
  /manage subscriptions/i,
];

const LEGITIMATE_BUSINESS_PATTERNS = [
  /invoice #/i,
  /purchase order/i,
  /order confirmation/i,
  /shipment notification/i,
  /tracking number/i,
  /delivery confirmation/i,
  /bill of lading/i,
  /packing slip/i,
  /commercial invoice/i,
  /customs declaration/i,
  /payment received/i,
  /wire transfer/i,
  /freight quote/i,
  /shipping quote/i,
  /rate confirmation/i,
];

// Known marketing/solicitation domains
const MARKETING_DOMAINS = [
  "mailchimp.com",
  "constantcontact.com",
  "hubspot.com",
  "marketo.com",
  "salesforce.com",
  "outreach.io",
  "apollo.io",
  "zoominfo.com",
  "lusha.com",
  "hunter.io",
  "lemlist.com",
  "mailshake.com",
  "woodpecker.co",
  "reply.io",
  "yesware.com",
  "mixmax.com",
  "streak.com",
  "pipedrive.com",
  "sendinblue.com",
  "klaviyo.com",
  "drip.com",
  "activecampaign.com",
  "convertkit.com",
  "mailerlite.com",
];

// Known transactional email domains (legitimate)
const TRANSACTIONAL_DOMAINS = [
  "ups.com",
  "fedex.com",
  "dhl.com",
  "usps.com",
  "maersk.com",
  "cosco.com",
  "msc.com",
  "evergreen-line.com",
  "flexport.com",
  "freightos.com",
  "shipbob.com",
  "quickbooks.com",
  "xero.com",
  "stripe.com",
  "paypal.com",
  "square.com",
  "brex.com",
  "chase.com",
  "bankofamerica.com",
  "wellsfargo.com",
];

/**
 * Extract domain from email address
 */
function extractDomain(email: string): string {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Quick pattern-based scoring (no AI call)
 */
function quickPatternScore(subject: string, bodyText: string, fromEmail: string): {
  spamScore: number;
  solicitationScore: number;
  newsletterScore: number;
  legitimateScore: number;
  patterns: string[];
} {
  const content = `${subject} ${bodyText}`.toLowerCase();
  const domain = extractDomain(fromEmail);
  const patterns: string[] = [];

  let spamScore = 0;
  let solicitationScore = 0;
  let newsletterScore = 0;
  let legitimateScore = 0;

  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      spamScore += 0.1;
      patterns.push(`spam:${pattern.source}`);
    }
  }

  // Check solicitation patterns
  for (const pattern of SOLICITATION_PATTERNS) {
    if (pattern.test(content)) {
      solicitationScore += 0.08;
      patterns.push(`solicitation:${pattern.source}`);
    }
  }

  // Check newsletter patterns
  for (const pattern of NEWSLETTER_PATTERNS) {
    if (pattern.test(content)) {
      newsletterScore += 0.12;
      patterns.push(`newsletter:${pattern.source}`);
    }
  }

  // Check legitimate business patterns
  for (const pattern of LEGITIMATE_BUSINESS_PATTERNS) {
    if (pattern.test(content)) {
      legitimateScore += 0.15;
      patterns.push(`legitimate:${pattern.source}`);
    }
  }

  // Domain-based scoring
  if (MARKETING_DOMAINS.some(d => domain.includes(d) || fromEmail.includes(d))) {
    solicitationScore += 0.3;
    patterns.push("domain:marketing_platform");
  }

  if (TRANSACTIONAL_DOMAINS.some(d => domain.includes(d))) {
    legitimateScore += 0.4;
    patterns.push("domain:transactional");
  }

  // Normalize scores to 0-1 range
  return {
    spamScore: Math.min(1, spamScore),
    solicitationScore: Math.min(1, solicitationScore),
    newsletterScore: Math.min(1, newsletterScore),
    legitimateScore: Math.min(1, legitimateScore),
    patterns,
  };
}

/**
 * Use AI to classify email for spam/solicitation
 */
async function aiClassifyEmail(
  subject: string,
  bodyText: string,
  fromEmail: string,
  fromName?: string
): Promise<{
  classification: EmailClassificationType;
  confidence: number;
  reasons: string[];
}> {
  try {
    const prompt = `You are an expert email classifier for a business ERP system. Your job is to determine if an email is legitimate business communication or spam/solicitation.

SENDER: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}
SUBJECT: ${subject}

BODY (first 2000 chars):
${bodyText?.substring(0, 2000) || "(empty)"}

CLASSIFICATIONS:
- legitimate: Real business emails (invoices, orders, shipments, quotes, vendor communication, customer inquiries)
- spam: Obvious spam (phishing, malware, scams, fake offers)
- solicitation: Cold outreach, sales emails, partnership requests, service pitches from unknown companies
- newsletter: Marketing newsletters, digests, promotional content from subscribed services
- automated: System notifications, alerts, auto-replies (not spam but not primary business)
- unknown: Cannot determine

IMPORTANT DISTINCTIONS:
1. Emails from known shipping carriers (UPS, FedEx, DHL, etc.) with tracking info = legitimate
2. Invoices and purchase orders from suppliers = legitimate
3. Cold emails from salespeople offering services = solicitation
4. Product pitches and partnership requests = solicitation
5. Emails with "unsubscribe" at bottom may still be legitimate if they contain business content
6. Look for genuine business transaction indicators vs marketing language

Analyze the email and respond with JSON:
{
  "classification": "legitimate|spam|solicitation|newsletter|automated|unknown",
  "confidence": 0.85,
  "reasons": ["reason 1", "reason 2", "reason 3"]
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an email classification AI. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_spam_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              classification: { type: "string" },
              confidence: { type: "number" },
              reasons: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["classification", "confidence", "reasons"],
            additionalProperties: false
          }
        }
      }
    });

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      return { classification: "unknown", confidence: 0.5, reasons: ["No AI response"] };
    }

    const content = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
    const parsed = JSON.parse(content);

    const validClassifications: EmailClassificationType[] = ["legitimate", "spam", "solicitation", "newsletter", "automated", "unknown"];
    const classification = validClassifications.includes(parsed.classification) ? parsed.classification : "unknown";

    return {
      classification,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reasons: parsed.reasons || [],
    };
  } catch (error) {
    console.error("[SpamFilter] AI classification error:", error);
    return { classification: "unknown", confidence: 0.5, reasons: ["Classification error"] };
  }
}

/**
 * Main function to classify an email for spam/solicitation
 */
export async function classifyEmailForSpam(
  emailId: number,
  subject: string,
  bodyText: string,
  fromEmail: string,
  fromName?: string,
  options?: {
    useAI?: boolean;
    checkVendors?: boolean;
  }
): Promise<SpamFilterResult> {
  const useAI = options?.useAI ?? true;
  const checkVendors = options?.checkVendors ?? true;

  // Step 1: Check if sender is blocked
  const isBlocked = await db.isEmailBlocked(fromEmail);
  if (isBlocked) {
    return {
      classification: "spam",
      confidence: 1.0,
      spamScore: 1.0,
      solicitationScore: 0,
      reasons: ["Sender is on blocked list"],
      detectedPatterns: ["blocked_sender"],
      senderReputation: "blocked",
      isKnownVendor: false,
      shouldProcess: false,
    };
  }

  // Step 2: Check if sender is trusted (vendor/customer)
  const trustedMatch = await db.getTrustedSenderMatch(fromEmail);
  let isKnownVendor = false;
  let matchedVendorId: number | undefined;

  if (trustedMatch.trusted) {
    isKnownVendor = !!trustedMatch.vendorId;
    matchedVendorId = trustedMatch.vendorId;

    return {
      classification: "legitimate",
      confidence: 0.95,
      spamScore: 0,
      solicitationScore: 0,
      reasons: ["Sender is on trusted list", trustedMatch.vendorId ? "Known vendor" : "Known customer"],
      detectedPatterns: ["trusted_sender"],
      senderReputation: "trusted",
      isKnownVendor,
      matchedVendorId,
      shouldProcess: true,
    };
  }

  // Step 3: Check if sender matches any vendor by email domain
  if (checkVendors) {
    const vendorMatch = await db.getVendorByEmailDomain(fromEmail);
    if (vendorMatch) {
      isKnownVendor = true;
      matchedVendorId = vendorMatch.id;
    }
  }

  // Step 4: Quick pattern-based scoring
  const patternScores = quickPatternScore(subject, bodyText, fromEmail);

  // Step 5: If patterns strongly indicate legitimate or spam, skip AI
  if (patternScores.legitimateScore > 0.5 && patternScores.spamScore < 0.2 && patternScores.solicitationScore < 0.2) {
    return {
      classification: "legitimate",
      confidence: 0.8 + (patternScores.legitimateScore * 0.2),
      spamScore: patternScores.spamScore,
      solicitationScore: patternScores.solicitationScore,
      reasons: ["Strong legitimate business patterns detected"],
      detectedPatterns: patternScores.patterns,
      senderReputation: isKnownVendor ? "trusted" : "neutral",
      isKnownVendor,
      matchedVendorId,
      shouldProcess: true,
    };
  }

  if (patternScores.spamScore > 0.5) {
    return {
      classification: "spam",
      confidence: 0.7 + (patternScores.spamScore * 0.3),
      spamScore: patternScores.spamScore,
      solicitationScore: patternScores.solicitationScore,
      reasons: ["Spam patterns detected"],
      detectedPatterns: patternScores.patterns,
      senderReputation: "suspicious",
      isKnownVendor,
      matchedVendorId,
      shouldProcess: false,
    };
  }

  // Step 6: Use AI for uncertain cases
  let aiResult: { classification: EmailClassificationType; confidence: number; reasons: string[] } | null = null;

  if (useAI) {
    aiResult = await aiClassifyEmail(subject, bodyText, fromEmail, fromName);
  }

  // Step 7: Combine pattern scores and AI result
  const classification = aiResult?.classification || (
    patternScores.newsletterScore > 0.3 ? "newsletter" :
    patternScores.solicitationScore > 0.3 ? "solicitation" :
    patternScores.spamScore > 0.2 ? "spam" :
    patternScores.legitimateScore > 0.2 ? "legitimate" : "unknown"
  );

  const confidence = aiResult?.confidence || 0.6;
  const reasons = aiResult?.reasons || [];

  // Add pattern-based reasons
  if (patternScores.spamScore > 0.2) {
    reasons.push(`Spam score: ${(patternScores.spamScore * 100).toFixed(0)}%`);
  }
  if (patternScores.solicitationScore > 0.2) {
    reasons.push(`Solicitation score: ${(patternScores.solicitationScore * 100).toFixed(0)}%`);
  }
  if (isKnownVendor) {
    reasons.push("Email domain matches known vendor");
  }

  // Determine if we should process attachments
  const shouldProcess = classification === "legitimate" ||
    (classification === "unknown" && confidence < 0.6) ||
    (classification === "newsletter" && patternScores.legitimateScore > 0.3);

  // Determine sender reputation
  let senderReputation: "trusted" | "neutral" | "suspicious" | "blocked" = "neutral";
  if (isKnownVendor) {
    senderReputation = "trusted";
  } else if (classification === "spam" || classification === "solicitation") {
    senderReputation = "suspicious";
  }

  return {
    classification,
    confidence,
    spamScore: patternScores.spamScore,
    solicitationScore: patternScores.solicitationScore,
    reasons,
    detectedPatterns: patternScores.patterns,
    senderReputation,
    isKnownVendor,
    matchedVendorId,
    shouldProcess,
  };
}

/**
 * Classify an email and save the classification to the database
 */
export async function classifyAndSaveEmailClassification(
  emailId: number,
  subject: string,
  bodyText: string,
  fromEmail: string,
  fromName?: string
): Promise<SpamFilterResult> {
  const result = await classifyEmailForSpam(emailId, subject, bodyText, fromEmail, fromName);

  // Save classification to database
  try {
    await db.createEmailClassification({
      emailId,
      classification: result.classification as any,
      confidence: result.confidence.toFixed(2),
      spamScore: result.spamScore.toFixed(2),
      solicitationScore: result.solicitationScore.toFixed(2),
      classificationReasons: result.reasons,
      detectedPatterns: result.detectedPatterns,
      senderDomain: extractDomain(fromEmail),
      senderReputation: result.senderReputation as any,
      isKnownVendor: result.isKnownVendor,
      matchedVendorId: result.matchedVendorId,
    });
  } catch (error) {
    console.error("[SpamFilter] Failed to save classification:", error);
  }

  return result;
}

/**
 * Check if an email should be processed based on spam filtering settings
 */
export async function shouldProcessEmail(
  emailId: number,
  subject: string,
  bodyText: string,
  fromEmail: string,
  fromName?: string,
  config?: {
    filterSpam?: boolean;
    filterSolicitations?: boolean;
    filterNewsletters?: boolean;
    minConfidenceThreshold?: number;
  }
): Promise<{ shouldProcess: boolean; reason: string; classification?: SpamFilterResult }> {
  const filterSpam = config?.filterSpam ?? true;
  const filterSolicitations = config?.filterSolicitations ?? true;
  const filterNewsletters = config?.filterNewsletters ?? false;
  const minConfidenceThreshold = config?.minConfidenceThreshold ?? 0.7;

  const classification = await classifyEmailForSpam(emailId, subject, bodyText, fromEmail, fromName);

  // If confidence is below threshold, process anyway to be safe
  if (classification.confidence < minConfidenceThreshold) {
    return {
      shouldProcess: true,
      reason: `Confidence (${(classification.confidence * 100).toFixed(0)}%) below threshold`,
      classification,
    };
  }

  // Check filtering rules
  if (filterSpam && classification.classification === "spam") {
    return {
      shouldProcess: false,
      reason: "Filtered as spam",
      classification,
    };
  }

  if (filterSolicitations && classification.classification === "solicitation") {
    return {
      shouldProcess: false,
      reason: "Filtered as solicitation",
      classification,
    };
  }

  if (filterNewsletters && classification.classification === "newsletter") {
    return {
      shouldProcess: false,
      reason: "Filtered as newsletter",
      classification,
    };
  }

  return {
    shouldProcess: true,
    reason: classification.classification === "legitimate"
      ? "Legitimate business email"
      : `Classified as ${classification.classification}`,
    classification,
  };
}

/**
 * Auto-block a sender based on classification
 */
export async function autoBlockSender(
  email: string,
  reason: "spam" | "solicitation" | "phishing" | "manual",
  emailId?: number,
  userId?: number
): Promise<void> {
  const domain = extractDomain(email);

  // Block by domain for spam/phishing, by exact email for solicitation
  const patternType = (reason === "solicitation") ? "exact" : "domain";
  const pattern = patternType === "domain" ? domain : email.toLowerCase();

  try {
    await db.createBlockedEmailSender({
      pattern,
      patternType: patternType as any,
      reason: reason as any,
      autoDetected: !userId,
      detectedFromEmailId: emailId,
      blockedBy: userId,
    });
  } catch (error) {
    console.error("[SpamFilter] Failed to block sender:", error);
  }
}

/**
 * Add a trusted sender (from vendor or customer)
 */
export async function addTrustedSender(
  pattern: string,
  patternType: "exact" | "domain" | "regex",
  vendorId?: number,
  customerId?: number,
  userId?: number,
  notes?: string
): Promise<void> {
  try {
    await db.createTrustedEmailSender({
      pattern: pattern.toLowerCase(),
      patternType: patternType as any,
      vendorId,
      customerId,
      notes,
      addedBy: userId,
    });
  } catch (error) {
    console.error("[SpamFilter] Failed to add trusted sender:", error);
  }
}
