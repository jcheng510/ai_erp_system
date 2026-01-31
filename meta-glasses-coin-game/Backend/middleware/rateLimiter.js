/**
 * Simple in-memory rate limiter
 * In production, use Redis-based rate limiting
 */

const requestCounts = new Map();
const WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS = 100; // requests per window

/**
 * Rate limiting middleware
 */
function rateLimiter(req, res, next) {
  const key = getClientKey(req);
  const now = Date.now();

  // Get or create client record
  let clientData = requestCounts.get(key);

  if (!clientData || now - clientData.windowStart > WINDOW_MS) {
    // Start new window
    clientData = {
      windowStart: now,
      count: 0
    };
  }

  clientData.count++;
  requestCounts.set(key, clientData);

  // Check if limit exceeded
  if (clientData.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((clientData.windowStart + WINDOW_MS - now) / 1000);

    res.set('Retry-After', retryAfter);
    res.set('X-RateLimit-Limit', MAX_REQUESTS);
    res.set('X-RateLimit-Remaining', 0);
    res.set('X-RateLimit-Reset', Math.ceil((clientData.windowStart + WINDOW_MS) / 1000));

    return res.status(429).json({
      error: 'Too many requests',
      retryAfter
    });
  }

  // Set rate limit headers
  res.set('X-RateLimit-Limit', MAX_REQUESTS);
  res.set('X-RateLimit-Remaining', MAX_REQUESTS - clientData.count);
  res.set('X-RateLimit-Reset', Math.ceil((clientData.windowStart + WINDOW_MS) / 1000));

  next();
}

/**
 * Get unique client identifier
 */
function getClientKey(req) {
  // Use user ID if authenticated, otherwise IP
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
  return `ip:${ip}`;
}

/**
 * Create custom rate limiter with specific limits
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || WINDOW_MS;
  const maxRequests = options.maxRequests || MAX_REQUESTS;
  const keyGenerator = options.keyGenerator || getClientKey;
  const storage = new Map();

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let clientData = storage.get(key);

    if (!clientData || now - clientData.windowStart > windowMs) {
      clientData = {
        windowStart: now,
        count: 0
      };
    }

    clientData.count++;
    storage.set(key, clientData);

    if (clientData.count > maxRequests) {
      const retryAfter = Math.ceil((clientData.windowStart + windowMs - now) / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter
      });
    }

    next();
  };
}

/**
 * Cleanup old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > WINDOW_MS * 2) {
      requestCounts.delete(key);
    }
  }
}, WINDOW_MS);

module.exports = {
  rateLimiter,
  createRateLimiter
};
