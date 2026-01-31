/**
 * Email Inbox Scanner Service
 * Monitors email inboxes for new emails and auto-processes attachments
 */

import * as db from "./db";
import { storagePut } from "./storage";
import { listGmailMessages, getGmailMessage } from "./_core/gmail";
import { classifyAndSaveEmailClassification, SpamFilterResult } from "./emailSpamFilterService";
import { processEmailAttachments, FilingResult } from "./emailAttachmentFilingService";
import { categorizeEmail, parseEmailContent } from "./_core/emailParser";

export interface EmailScanResult {
  emailsScanned: number;
  emailsProcessed: number;
  emailsSkipped: number;
  attachmentsProcessed: number;
  attachmentsFiled: number;
  errors: string[];
  duration: number;
}

export interface ScanOptions {
  maxEmails?: number;
  processAttachments?: boolean;
  filterSpam?: boolean;
  filterSolicitations?: boolean;
  filterNewsletters?: boolean;
  useAI?: boolean;
  googleAccessToken?: string;
  userId?: number;
  configId?: number;
}

/**
 * Extract email headers
 */
function extractHeaders(headers: Array<{ name: string; value: string }> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  for (const header of headers) {
    result[header.name.toLowerCase()] = header.value;
  }
  return result;
}

/**
 * Decode base64url encoded content
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Extract body text from Gmail message parts
 */
function extractBody(payload: any): { text: string; html: string } {
  let text = '';
  let html = '';

  if (payload.body?.data) {
    const content = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/plain') {
      text = content;
    } else if (payload.mimeType === 'text/html') {
      html = content;
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = decodeBase64Url(part.body.data);
      } else if (part.mimeType?.startsWith('multipart/')) {
        const nested = extractBody(part);
        text = text || nested.text;
        html = html || nested.html;
      }
    }
  }

  return { text, html };
}

/**
 * Extract attachments from Gmail message parts
 */
function extractAttachmentInfo(payload: any, messageId: string): Array<{
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  partId: string;
}> {
  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
    partId: string;
  }> = [];

  function processPartForAttachments(part: any) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
        partId: part.partId || '',
      });
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        processPartForAttachments(subPart);
      }
    }
  }

  processPartForAttachments(payload);
  return attachments;
}

/**
 * Download attachment from Gmail
 */
async function downloadGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer | null> {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[EmailScanner] Failed to download attachment: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.data) {
      const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(base64, 'base64');
    }
    return null;
  } catch (error) {
    console.error('[EmailScanner] Error downloading attachment:', error);
    return null;
  }
}

/**
 * Process a single email message
 */
async function processEmailMessage(
  messageId: string,
  accessToken: string,
  options: ScanOptions
): Promise<{
  success: boolean;
  emailId?: number;
  attachmentsProcessed: number;
  attachmentsFiled: number;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}> {
  try {
    // Get full message details
    const { success, message, error } = await getGmailMessage(accessToken, messageId);
    if (!success || !message) {
      return { success: false, attachmentsProcessed: 0, attachmentsFiled: 0, error: error || 'Failed to get message' };
    }

    // Check if already processed
    const existingEmail = await db.findInboundEmailByMessageId(message.id);
    if (existingEmail) {
      return { success: true, emailId: existingEmail.id, attachmentsProcessed: 0, attachmentsFiled: 0, skipped: true, skipReason: 'Already processed' };
    }

    // Extract headers
    const headers = extractHeaders(message.payload?.headers);
    const fromEmail = parseEmailAddress(headers.from || '');
    const fromName = parseEmailName(headers.from || '');
    const toEmail = parseEmailAddress(headers.to || '');
    const subject = headers.subject || '';
    const receivedDate = message.internalDate
      ? new Date(parseInt(message.internalDate))
      : new Date();

    // Extract body
    const { text: bodyText, html: bodyHtml } = extractBody(message.payload);

    // Check spam/solicitation filtering
    if (options.filterSpam || options.filterSolicitations) {
      const classification = await classifyAndSaveEmailClassification(
        0, // Will create email first
        subject,
        bodyText,
        fromEmail,
        fromName
      );

      if (!classification.shouldProcess) {
        return {
          success: true,
          attachmentsProcessed: 0,
          attachmentsFiled: 0,
          skipped: true,
          skipReason: `Filtered: ${classification.classification}`,
        };
      }
    }

    // Categorize email
    const categorization = await categorizeEmail(subject, bodyText, fromEmail, fromName);

    // Create inbound email record
    const emailResult = await db.createInboundEmail({
      messageId: message.id,
      fromEmail,
      fromName,
      toEmail,
      subject,
      bodyText,
      bodyHtml,
      receivedAt: receivedDate,
      parsingStatus: 'pending',
      category: categorization.category as any,
      categoryConfidence: categorization.confidence.toFixed(2),
      categoryKeywords: categorization.keywords,
      suggestedAction: categorization.suggestedAction,
      priority: categorization.priority as any,
      rawHeaders: headers,
    });

    const emailId = emailResult.id;

    // Update classification with email ID if we created one earlier
    if (options.filterSpam || options.filterSolicitations) {
      await classifyAndSaveEmailClassification(
        emailId,
        subject,
        bodyText,
        fromEmail,
        fromName
      );
    }

    // Process attachments if enabled
    let attachmentsProcessed = 0;
    let attachmentsFiled = 0;

    if (options.processAttachments !== false) {
      const attachmentInfos = extractAttachmentInfo(message.payload, message.id);

      for (const attachmentInfo of attachmentInfos) {
        attachmentsProcessed++;

        // Download attachment
        const content = await downloadGmailAttachment(
          accessToken,
          message.id,
          attachmentInfo.attachmentId
        );

        if (!content) {
          console.error(`[EmailScanner] Failed to download attachment: ${attachmentInfo.filename}`);
          continue;
        }

        // Upload to storage
        const storageKey = `email-attachments/${emailId}/${Date.now()}-${attachmentInfo.filename}`;
        const storageResult = await storagePut(storageKey, content, attachmentInfo.mimeType);

        // Create attachment record
        const attachmentResult = await db.createEmailAttachment({
          emailId,
          filename: attachmentInfo.filename,
          mimeType: attachmentInfo.mimeType,
          size: attachmentInfo.size,
          storageUrl: storageResult.url,
          storageKey,
          isProcessed: false,
        });

        // TODO: Extract text from PDF/images for better classification
        // This would require OCR integration
      }

      // Now process attachments for filing
      if (attachmentsProcessed > 0) {
        const filingResults = await processEmailAttachments(emailId, {
          useAI: options.useAI,
          autoFile: true,
          userId: options.userId,
          googleAccessToken: accessToken,
          filterSpam: options.filterSpam,
          filterSolicitations: options.filterSolicitations,
        });

        attachmentsFiled = filingResults.filed;
      }
    }

    // Update email status
    await db.updateInboundEmailStatus(emailId, 'parsed');

    return {
      success: true,
      emailId,
      attachmentsProcessed,
      attachmentsFiled,
    };
  } catch (error) {
    console.error('[EmailScanner] Error processing email:', error);
    return {
      success: false,
      attachmentsProcessed: 0,
      attachmentsFiled: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse email address from header value
 */
function parseEmailAddress(header: string): string {
  const match = header.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();

  // Check if it's just an email
  if (header.includes('@') && !header.includes('<')) {
    return header.trim().toLowerCase();
  }

  return header.toLowerCase();
}

/**
 * Parse display name from email header
 */
function parseEmailName(header: string): string {
  const match = header.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/"/g, '');
  return '';
}

/**
 * Scan Gmail inbox for new emails
 */
export async function scanGmailInbox(
  accessToken: string,
  options: ScanOptions = {}
): Promise<EmailScanResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let emailsScanned = 0;
  let emailsProcessed = 0;
  let emailsSkipped = 0;
  let attachmentsProcessed = 0;
  let attachmentsFiled = 0;

  try {
    // Get configuration if specified
    let config: any = null;
    if (options.configId) {
      config = await db.getEmailFilingConfigById(options.configId);
      if (config) {
        options.filterSpam = config.filterSpam;
        options.filterSolicitations = config.filterSolicitations;
        options.filterNewsletters = config.filterNewsletters;
      }
    }

    // Build search query
    let query = 'has:attachment';

    // Only get unread or recent emails
    query += ' newer_than:7d';

    // List messages
    const { success, result, error } = await listGmailMessages(accessToken, {
      maxResults: options.maxEmails || 50,
      q: query,
    });

    if (!success || !result) {
      errors.push(error || 'Failed to list messages');
      return {
        emailsScanned,
        emailsProcessed,
        emailsSkipped,
        attachmentsProcessed,
        attachmentsFiled,
        errors,
        duration: Date.now() - startTime,
      };
    }

    // Process each message
    for (const msg of result.messages) {
      emailsScanned++;

      const processResult = await processEmailMessage(msg.id, accessToken, options);

      if (processResult.skipped) {
        emailsSkipped++;
      } else if (processResult.success) {
        emailsProcessed++;
        attachmentsProcessed += processResult.attachmentsProcessed;
        attachmentsFiled += processResult.attachmentsFiled;
      } else {
        errors.push(`Email ${msg.id}: ${processResult.error}`);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      emailsScanned,
      emailsProcessed,
      emailsSkipped,
      attachmentsProcessed,
      attachmentsFiled,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[EmailScanner] Scan error:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return {
      emailsScanned,
      emailsProcessed,
      emailsSkipped,
      attachmentsProcessed,
      attachmentsFiled,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Process unprocessed emails that are already in the database
 */
export async function processUnprocessedEmails(
  options: ScanOptions = {}
): Promise<EmailScanResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let emailsScanned = 0;
  let emailsProcessed = 0;
  let emailsSkipped = 0;
  let attachmentsProcessed = 0;
  let attachmentsFiled = 0;

  try {
    // Get emails that are pending or need reprocessing
    const emails = await db.getInboundEmails({
      status: 'pending',
      limit: options.maxEmails || 100,
    });

    for (const email of emails) {
      emailsScanned++;

      try {
        // Check if should process based on spam filtering
        if (options.filterSpam || options.filterSolicitations) {
          const classification = await classifyAndSaveEmailClassification(
            email.id,
            email.subject || '',
            email.bodyText || '',
            email.fromEmail,
            email.fromName || undefined
          );

          if (!classification.shouldProcess) {
            emailsSkipped++;
            await db.updateInboundEmailStatus(email.id, 'archived');
            continue;
          }
        }

        // Process attachments
        const filingResults = await processEmailAttachments(email.id, {
          useAI: options.useAI,
          autoFile: true,
          userId: options.userId,
          googleAccessToken: options.googleAccessToken,
          filterSpam: options.filterSpam,
          filterSolicitations: options.filterSolicitations,
        });

        attachmentsProcessed += filingResults.processed;
        attachmentsFiled += filingResults.filed;

        if (filingResults.spamFiltered) {
          emailsSkipped++;
          await db.updateInboundEmailStatus(email.id, 'archived');
        } else {
          emailsProcessed++;
          await db.updateInboundEmailStatus(email.id, 'parsed');
        }
      } catch (error) {
        errors.push(`Email ${email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        await db.updateInboundEmailStatus(email.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    return {
      emailsScanned,
      emailsProcessed,
      emailsSkipped,
      attachmentsProcessed,
      attachmentsFiled,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[EmailScanner] Process unprocessed error:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return {
      emailsScanned,
      emailsProcessed,
      emailsSkipped,
      attachmentsProcessed,
      attachmentsFiled,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run scheduled email scan based on filing configurations
 */
export async function runScheduledEmailScan(): Promise<{
  configsProcessed: number;
  results: Array<{ configId: number; configName: string; result: EmailScanResult }>;
}> {
  const results: Array<{ configId: number; configName: string; result: EmailScanResult }> = [];

  try {
    // Get all active filing configurations
    const configs = await db.getActiveEmailFilingConfigs();

    for (const config of configs) {
      if (!config.isEnabled) continue;

      // Get Google OAuth token for the email account
      // This would require linking email accounts to users
      // For now, we'll skip configs without proper auth setup

      console.log(`[EmailScanner] Processing config: ${config.name}`);

      // Process unprocessed emails with this config's settings
      const result = await processUnprocessedEmails({
        configId: config.id,
        filterSpam: config.filterSpam,
        filterSolicitations: config.filterSolicitations,
        filterNewsletters: config.filterNewsletters,
        useAI: true,
      });

      results.push({
        configId: config.id,
        configName: config.name,
        result,
      });
    }

    return {
      configsProcessed: results.length,
      results,
    };
  } catch (error) {
    console.error('[EmailScanner] Scheduled scan error:', error);
    return {
      configsProcessed: 0,
      results,
    };
  }
}

/**
 * Get filing statistics
 */
export async function getFilingStatistics(options?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalEmails: number;
  processedEmails: number;
  filteredEmails: number;
  totalAttachments: number;
  filedAttachments: number;
  pendingFilings: number;
  failedFilings: number;
  byCategory: Record<string, number>;
  byVendor: Array<{ vendorId: number; vendorName: string; count: number }>;
}> {
  try {
    // Get email counts
    const emails = await db.getInboundEmails({ limit: 10000 });
    const totalEmails = emails.length;
    const processedEmails = emails.filter(e => e.parsingStatus === 'parsed').length;
    const filteredEmails = emails.filter(e => e.parsingStatus === 'archived').length;

    // Get filing counts
    const filings = await db.getEmailAttachmentFilings({ limit: 10000 });
    const totalAttachments = filings.length;
    const filedAttachments = filings.filter(f => f.filingStatus === 'filed').length;
    const pendingFilings = filings.filter(f => f.filingStatus === 'pending').length;
    const failedFilings = filings.filter(f => f.filingStatus === 'failed').length;

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const filing of filings) {
      const cat = filing.documentCategory || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // Group by vendor
    const vendorCounts = new Map<number, { name: string; count: number }>();
    for (const filing of filings) {
      if (filing.vendorId) {
        const existing = vendorCounts.get(filing.vendorId);
        if (existing) {
          existing.count++;
        } else {
          vendorCounts.set(filing.vendorId, { name: filing.vendorName || 'Unknown', count: 1 });
        }
      }
    }

    const byVendor = Array.from(vendorCounts.entries())
      .map(([vendorId, data]) => ({ vendorId, vendorName: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      totalEmails,
      processedEmails,
      filteredEmails,
      totalAttachments,
      filedAttachments,
      pendingFilings,
      failedFilings,
      byCategory,
      byVendor,
    };
  } catch (error) {
    console.error('[EmailScanner] Error getting statistics:', error);
    return {
      totalEmails: 0,
      processedEmails: 0,
      filteredEmails: 0,
      totalAttachments: 0,
      filedAttachments: 0,
      pendingFilings: 0,
      failedFilings: 0,
      byCategory: {},
      byVendor: [],
    };
  }
}
