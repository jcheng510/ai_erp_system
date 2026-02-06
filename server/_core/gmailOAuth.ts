import { ENV } from "./env";

// Gmail OAuth2 configuration
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Scopes required for Gmail IMAP access
const GMAIL_SCOPES = [
  "https://mail.google.com/", // Full Gmail IMAP/SMTP access
  "https://www.googleapis.com/auth/userinfo.email", // Get user's email address
];

export interface GmailOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}

/**
 * Generate the Google OAuth2 authorization URL
 */
export function getGmailAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: ENV.googleRedirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline", // Required to get refresh token
    prompt: "consent", // Force consent screen to always get refresh token
  });

  if (state) {
    params.set("state", state);
  }

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GmailOAuthTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: ENV.googleRedirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("No access token received from Google");
  }

  // Get user's email address
  const email = await getEmailFromToken(data.access_token);

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000); // Subtract 60s buffer

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    email,
  };
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("No access token received from Google");
  }

  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Get user's email address from an access token
 */
async function getEmailFromToken(accessToken: string): Promise<string> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get user info from Google");
  }

  const data = await response.json();
  return data.email;
}

/**
 * Generate XOAUTH2 token string for IMAP authentication
 * Format: base64("user=" + email + "\x01auth=Bearer " + accessToken + "\x01\x01")
 */
export function generateXOAuth2Token(email: string, accessToken: string): string {
  const authString = `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
  return Buffer.from(authString).toString("base64");
}

/**
 * Check if Google OAuth is configured
 */
export function isGmailOAuthConfigured(): boolean {
  return !!(ENV.googleClientId && ENV.googleClientSecret && ENV.googleRedirectUri);
}
