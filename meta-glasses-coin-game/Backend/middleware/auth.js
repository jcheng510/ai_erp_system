const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

/**
 * Authentication middleware - requires valid JWT token
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.id,
        email: decoded.email
      };
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - populates user if token present, but doesn't require it
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.id,
        email: decoded.email
      };
    } catch (jwtError) {
      // Ignore invalid tokens for optional auth
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Admin authentication middleware
 */
function authenticateAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is admin (in production, check database)
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
    if (!adminEmails.includes(req.user.email)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  });
}

module.exports = {
  authenticate,
  optionalAuth,
  authenticateAdmin
};
