import rateLimit from "express-rate-limit";

/**
 * Rate limiter for OAuth callback endpoints.
 * Limits each IP to 10 requests per 15-minute window to prevent
 * brute-force and callback abuse attacks.
 */
export const oauthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authorization attempts, please try again later" },
});
