import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Google OAuth callback for Drive/Sheets integration
  app.get('/api/google/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.redirect('/import?error=missing_params');
    }
    
    // Validate state parameter (user ID)
    const userId = parseInt(state as string, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.redirect('/import?error=invalid_state');
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
        userId,
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
  
  // Google OAuth callback for Gmail/Workspace integration (full access)
  app.get('/api/oauth/google/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.redirect('/settings/integrations?error=missing_params');
    }
    
    // Validate state parameter (user ID)
    const userId = parseInt(state as string, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.redirect('/settings/integrations?error=invalid_state');
    }
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return res.redirect('/settings/integrations?error=not_configured');
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
          redirect_uri: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/oauth/google/callback`,
        }),
      });
      
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', await tokenResponse.text());
        return res.redirect('/settings/integrations?error=token_exchange_failed');
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
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        googleEmail,
      });
      
      res.redirect('/settings/integrations?success=connected');
    } catch (error) {
      console.error('Google OAuth error:', error);
      res.redirect('/settings/integrations?error=oauth_failed');
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
  });
}

startServer().catch(console.error);
