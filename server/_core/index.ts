import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV, validateEmailConfig } from "./env";
import * as sendgridProvider from "./sendgridProvider";
import * as emailService from "./emailService";
import * as db from "../db";
import { startEmailQueueWorker } from "../emailQueueWorker";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Validate email configuration at startup
  const emailConfigValidation = validateEmailConfig();
  if (!emailConfigValidation.valid) {
    if (ENV.isProduction) {
      console.error("[Email Config] FATAL: Missing required email configuration in production:");
      emailConfigValidation.errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    } else {
      console.warn("[Email Config] Warning: Some email configuration is missing:");
      emailConfigValidation.errors.forEach(err => console.warn(`  - ${err}`));
    }
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ============================================
  // SENDGRID WEBHOOK ENDPOINT
  // ============================================
  app.post('/webhooks/sendgrid/events', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      // Get the raw body for signature verification
      const rawBody = req.body.toString();

      // Verify webhook signature if configured
      if (ENV.sendgridWebhookSecret) {
        const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
        const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;

        if (!signature || !timestamp) {
          console.warn('[SendGrid Webhook] Missing signature or timestamp headers');
          return res.status(401).json({ error: 'Missing signature headers' });
        }

        const isValid = sendgridProvider.verifyWebhookSignature(
          ENV.sendgridWebhookSecret,
          rawBody,
          signature,
          timestamp
        );

        if (!isValid) {
          console.warn('[SendGrid Webhook] Invalid signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Parse the events
      let events: any[];
      try {
        events = JSON.parse(rawBody);
      } catch (e) {
        console.error('[SendGrid Webhook] Failed to parse body:', e);
        return res.status(400).json({ error: 'Invalid JSON' });
      }

      if (!Array.isArray(events)) {
        events = [events];
      }

      console.log(`[SendGrid Webhook] Received ${events.length} event(s)`);

      // Process each event
      for (const event of events) {
        try {
          const providerEventType = event.event;
          const providerMessageId = event.sg_message_id?.split('.')[0]; // Remove the .filter_id suffix
          const email = event.email;
          const timestamp = event.timestamp ? new Date(event.timestamp * 1000) : new Date();

          // Store the raw event
          const emailEvent = await db.createEmailEvent({
            providerEventType,
            providerMessageId,
            providerTimestamp: timestamp,
            rawEventJson: event,
            email,
            reason: event.reason || event.response || null,
            bounceType: event.type || null,
            processedAt: new Date(),
          });

          // Find and update the corresponding email message
          if (providerMessageId) {
            const message = await db.getEmailMessageByProviderMessageId(providerMessageId);
            if (message) {
              // Update the event with the message ID
              await db.createEmailEvent({
                ...emailEvent,
                emailMessageId: message.id,
              });

              // Map the event to a status
              const newStatus = sendgridProvider.mapEventToStatus(providerEventType);
              if (newStatus) {
                await db.updateEmailMessageStatus(message.id, newStatus);
                console.log(`[SendGrid Webhook] Updated message ${message.id} status to ${newStatus}`);
              }
            }
          }
        } catch (eventError) {
          console.error('[SendGrid Webhook] Error processing event:', eventError);
          // Continue processing other events
        }
      }

      res.status(200).json({ received: events.length });
    } catch (error) {
      console.error('[SendGrid Webhook] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Google OAuth callback for Drive/Sheets integration
  app.get('/api/google/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.redirect('/import?error=missing_params');
    }
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return res.redirect('/import?error=not_configured');
    }
    
    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code as string,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/google/callback`,
        }),
      });
      
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', await tokenResponse.text());
        return res.redirect('/import?error=token_exchange_failed');
      }
      
      const tokens = await tokenResponse.json();
      
      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      
      let googleEmail = null;
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        googleEmail = userInfo.email;
      }
      
      // Import db functions dynamically to avoid circular deps
      const { upsertGoogleOAuthToken } = await import('../db');
      
      // Save tokens to database
      await upsertGoogleOAuthToken({
        userId: parseInt(state as string),
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        googleEmail,
      });
      
      res.redirect('/import?success=connected');
    } catch (error) {
      console.error('Google OAuth error:', error);
      res.redirect('/import?error=oauth_failed');
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start the email queue worker
    startEmailQueueWorker();
  });
}

startServer().catch(console.error);
