/**
 * Shopify API Integration
 * Handles OAuth authentication and API interactions with Shopify stores
 */

import { ENV } from "./env";
import crypto from "crypto";

// OAuth state management (in-memory for now, could be moved to Redis/DB)
const oauthStates = new Map<string, { userId: number; timestamp: number }>();

// Clean up expired states (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;
  for (const [state, data] of oauthStates.entries()) {
    if (data.timestamp < tenMinutesAgo) {
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * Get Shopify OAuth authorization URL
 */
export function getShopifyAuthUrl(userId: number, shopDomain: string): { url?: string; error?: string } {
  const clientId = ENV.shopifyClientId;
  const redirectUri = ENV.shopifyRedirectUri || `${ENV.appUrl}/api/oauth/shopify/callback`;
  
  if (!clientId) {
    return {
      error: "Shopify integration is not configured. Add SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Settings → Secrets."
    };
  }
  
  // Validate shop domain
  if (!shopDomain.endsWith('.myshopify.com')) {
    return { error: "Invalid shop domain. Must end with .myshopify.com" };
  }
  
  // Generate state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString("hex");
  oauthStates.set(state, { userId, timestamp: Date.now() });
  
  // Shopify OAuth scopes
  const scopes = [
    'read_products',
    'write_products',
    'read_orders',
    'write_orders',
    'read_inventory',
    'write_inventory',
    'read_customers',
    'read_locations',
  ].join(',');
  
  const url = `https://${shopDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  
  return { url };
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(shop: string, code: string): Promise<{
  access_token?: string;
  scope?: string;
  error?: string;
}> {
  const clientId = ENV.shopifyClientId;
  const clientSecret = ENV.shopifyClientSecret;
  
  if (!clientId || !clientSecret) {
    return { error: "Shopify credentials not configured" };
  }
  
  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Shopify token exchange failed:", error);
      return { error: "Failed to exchange authorization code for token" };
    }
    
    const data = await response.json();
    
    return {
      access_token: data.access_token,
      scope: data.scope,
    };
  } catch (error: any) {
    console.error("Shopify token exchange error:", error);
    return { error: error.message || "Token exchange failed" };
  }
}

/**
 * Verify Shopify webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  hmacHeader: string,
  secret: string
): boolean {
  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');
    
    return hash === hmacHeader;
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return false;
  }
}

/**
 * Make an authenticated API request to Shopify
 */
export async function makeShopifyRequest(
  shop: string,
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: any; error?: string }> {
  const url = `https://${shop}/admin/api/2024-01/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Shopify API request failed:", error);
      return { error: `API request failed: ${response.statusText}` };
    }
    
    const data = await response.json();
    return { data };
  } catch (error: any) {
    console.error("Shopify API request error:", error);
    return { error: error.message || "API request failed" };
  }
}

/**
 * Get Shopify shop info (useful for testing connection)
 */
export async function getShopInfo(shop: string, accessToken: string) {
  return makeShopifyRequest(shop, accessToken, "shop.json");
}

/**
 * Process Shopify webhook with common validation and idempotency handling
 * Returns true if webhook should be processed, false if already processed
 */
export async function processShopifyWebhook(
  rawBody: string,
  headers: {
    hmac?: string;
    shopDomain?: string;
    topic?: string;
  }
): Promise<{ 
  shouldProcess: boolean; 
  error?: string;
  payload?: any;
  topic?: string;
  shopDomain?: string;
  idempotencyKey?: string;
}> {
  const { hmac, shopDomain, topic } = headers;

  if (!hmac || !shopDomain || !topic) {
    return { shouldProcess: false, error: 'Missing required headers' };
  }

  // Get store from database to retrieve webhook secret
  // This import is done here to avoid circular dependencies
  const { getShopifyStoreByDomain } = await import('../db');
  const store = await getShopifyStoreByDomain(shopDomain);
  
  if (!store || !store.webhookSecret) {
    return { shouldProcess: false, error: 'Unknown store or missing webhook secret' };
  }

  // Verify webhook signature
  const isValid = verifyWebhookSignature(rawBody, hmac, store.webhookSecret);
  
  if (!isValid) {
    return { shouldProcess: false, error: 'Invalid signature' };
  }

  // Parse the payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return { shouldProcess: false, error: 'Invalid JSON payload' };
  }
  
  // Create idempotency key from Shopify event ID
  const idempotencyKey = `shopify-${topic}-${payload.id || Date.now()}`;

  // Check idempotency
  const { getWebhookEventByIdempotencyKey, createWebhookEvent } = await import('../db');
  const existing = await getWebhookEventByIdempotencyKey(idempotencyKey);
  
  if (existing) {
    return { 
      shouldProcess: false, 
      error: 'Already processed',
      idempotencyKey 
    };
  }

  // Create webhook event
  await createWebhookEvent({
    source: 'shopify',
    topic,
    payload: rawBody,
    idempotencyKey,
    status: 'received',
  });

  return { 
    shouldProcess: true, 
    payload,
    topic,
    shopDomain,
    idempotencyKey 
  };
}
