const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// In production, use a proper database
const users = new Map();
const refreshTokens = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName, metaAccountId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    if (users.has(email)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userId = uuidv4();
    const user = {
      id: userId,
      email,
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
      metaAccountId,
      createdAt: new Date().toISOString(),
      isVerified: false
    };

    users.set(email, user);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: sanitizeUser(user),
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Login user
 * POST /api/v1/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      message: 'Login successful',
      user: sanitizeUser(user),
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Login with Meta account
 * POST /api/v1/auth/meta
 */
router.post('/meta', async (req, res, next) => {
  try {
    const { metaAccessToken, metaUserId } = req.body;

    if (!metaAccessToken || !metaUserId) {
      return res.status(400).json({ error: 'Meta credentials required' });
    }

    // Verify Meta token (in production, call Meta's API)
    const isValidMetaToken = await verifyMetaToken(metaAccessToken, metaUserId);
    if (!isValidMetaToken) {
      return res.status(401).json({ error: 'Invalid Meta credentials' });
    }

    // Find or create user
    let user = findUserByMetaId(metaUserId);

    if (!user) {
      // Create new user from Meta account
      const userId = uuidv4();
      user = {
        id: userId,
        email: `meta_${metaUserId}@coinquestar.local`,
        metaAccountId: metaUserId,
        displayName: `Player_${metaUserId.slice(-6)}`,
        createdAt: new Date().toISOString(),
        isVerified: true,
        authProvider: 'meta'
      };
      users.set(user.email, user);
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      message: 'Meta login successful',
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
      isNewUser: !user.lastLoginAt
    });

    // Update last login
    user.lastLoginAt = new Date().toISOString();
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const tokenData = refreshTokens.get(refreshToken);
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check expiry
    if (new Date(tokenData.expiresAt) < new Date()) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Find user
    const user = findUserById(tokenData.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Invalidate old refresh token
    refreshTokens.delete(refreshToken);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = users.get(email);
    if (user) {
      // In production, send email with reset link
      const resetToken = uuidv4();
      user.resetToken = resetToken;
      user.resetTokenExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    next(error);
  }
});

/**
 * Reset password
 * POST /api/v1/auth/reset-password
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    // Find user with reset token
    let targetUser = null;
    for (const user of users.values()) {
      if (user.resetToken === token) {
        targetUser = user;
        break;
      }
    }

    if (!targetUser) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check token expiry
    if (new Date(targetUser.resetTokenExpiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token expired' });
    }

    // Update password
    const salt = await bcrypt.genSalt(12);
    targetUser.password = await bcrypt.hash(newPassword, salt);
    targetUser.resetToken = null;
    targetUser.resetTokenExpiry = null;

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  refreshTokens.set(refreshToken, {
    userId: user.id,
    expiresAt: expiresAt.toISOString()
  });

  return { accessToken, refreshToken };
}

function sanitizeUser(user) {
  const { password, resetToken, resetTokenExpiry, ...safe } = user;
  return safe;
}

function findUserById(userId) {
  for (const user of users.values()) {
    if (user.id === userId) {
      return user;
    }
  }
  return null;
}

function findUserByMetaId(metaId) {
  for (const user of users.values()) {
    if (user.metaAccountId === metaId) {
      return user;
    }
  }
  return null;
}

async function verifyMetaToken(token, userId) {
  // In production, verify with Meta's API
  // https://developers.facebook.com/docs/facebook-login/guides/access-tokens
  return true; // Mock verification
}

module.exports = router;
