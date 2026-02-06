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
 * Validate OAuth state parameter
 */
export function validateOAuthState(state: string): { userId?: number; error?: string } {
  const stateData = oauthStates.get(state);
  
  if (!stateData) {
    return { error: "Invalid or expired OAuth state" };
  }
  
  // Check if state is too old (10 minutes)
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;
  if (stateData.timestamp < tenMinutesAgo) {
    oauthStates.delete(state);
    return { error: "OAuth state expired" };
  }
  
  // Clean up the state after validation
  oauthStates.delete(state);
  
  return { userId: stateData.userId };
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
