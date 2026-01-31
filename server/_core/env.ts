export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // SendGrid email configuration
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL ?? "",
  // IMAP email inbox configuration
  imapHost: process.env.IMAP_HOST ?? "",
  imapPort: process.env.IMAP_PORT ?? "993",
  imapUser: process.env.IMAP_USER ?? "",
  imapPassword: process.env.IMAP_PASSWORD ?? "",
  // Google OAuth configuration
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  // QuickBooks OAuth configuration
  quickbooksClientId: process.env.QUICKBOOKS_CLIENT_ID ?? "",
  quickbooksClientSecret: process.env.QUICKBOOKS_CLIENT_SECRET ?? "",
  quickbooksRedirectUri: process.env.QUICKBOOKS_REDIRECT_URI ?? "",
  quickbooksEnvironment: process.env.QUICKBOOKS_ENVIRONMENT ?? "sandbox", // sandbox or production
};
