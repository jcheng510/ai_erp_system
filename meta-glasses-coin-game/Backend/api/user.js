const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Mock user storage (use database in production)
const users = new Map();

/**
 * Get current user profile
 * GET /api/v1/user/profile
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      level: user.level,
      experiencePoints: user.experiencePoints,
      achievements: user.achievements,
      stats: user.stats,
      preferences: user.preferences,
      createdAt: user.createdAt
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user profile
 * PATCH /api/v1/user/profile
 */
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { displayName, avatar } = req.body;

    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (displayName) {
      if (displayName.length < 2 || displayName.length > 50) {
        return res.status(400).json({ error: 'Display name must be 2-50 characters' });
      }
      user.displayName = displayName;
    }

    if (avatar) {
      user.avatar = avatar;
    }

    user.updatedAt = new Date().toISOString();

    res.json({
      message: 'Profile updated',
      user: {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user statistics
 * GET /api/v1/user/stats
 */
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const stats = await getUserStats(userId);

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * Get user achievements
 * GET /api/v1/user/achievements
 */
router.get('/achievements', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const achievements = await getUserAchievements(userId);

    res.json({ achievements });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user preferences
 * PUT /api/v1/user/preferences
 */
router.put('/preferences', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.preferences = {
      ...user.preferences,
      ...preferences
    };

    res.json({
      message: 'Preferences updated',
      preferences: user.preferences
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's daily challenges
 * GET /api/v1/user/challenges
 */
router.get('/challenges', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const challenges = getDailyChallenges(userId);

    res.json({ challenges });
  } catch (error) {
    next(error);
  }
});

/**
 * Link Meta account
 * POST /api/v1/user/link-meta
 */
router.post('/link-meta', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { metaAccessToken, metaUserId } = req.body;

    if (!metaAccessToken || !metaUserId) {
      return res.status(400).json({ error: 'Meta credentials required' });
    }

    // Verify Meta token (mock implementation)
    const isValid = await verifyMetaToken(metaAccessToken, metaUserId);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid Meta credentials' });
    }

    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.metaAccountId = metaUserId;
    user.metaLinkedAt = new Date().toISOString();

    res.json({
      message: 'Meta account linked successfully',
      metaAccountId: metaUserId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete user account
 * DELETE /api/v1/user/account
 */
router.delete('/account', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        error: 'Please confirm deletion by sending { confirmation: "DELETE" }'
      });
    }

    // In production, soft delete and schedule data removal
    users.delete(userId);

    res.json({
      message: 'Account scheduled for deletion',
      note: 'Your data will be permanently deleted within 30 days'
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function getUserById(userId) {
  for (const user of users.values()) {
    if (user.id === userId) {
      return user;
    }
  }

  // Return mock user for demo
  return {
    id: userId,
    email: 'demo@coinquestar.com',
    displayName: 'Demo Player',
    avatar: null,
    level: 1,
    experiencePoints: 0,
    achievements: [],
    stats: {
      totalCoinsCollected: 0,
      totalDistanceWalked: 0,
      totalStepsTaken: 0,
      daysPlayed: 1
    },
    preferences: {
      notifications: true,
      soundEffects: true,
      hapticFeedback: true,
      safetyAlerts: true
    },
    createdAt: new Date().toISOString()
  };
}

async function getUserStats(userId) {
  return {
    totalCoinsCollected: 0,
    totalCoinsRedeemed: 0,
    currentBalance: 0,
    totalDistanceWalked: 0,
    totalStepsTaken: 0,
    averageDailyCoins: 0,
    averageDailyDistance: 0,
    daysPlayed: 1,
    currentStreak: 0,
    longestStreak: 0,
    bestDailyCoins: 0,
    rank: {
      daily: null,
      weekly: null,
      allTime: null
    }
  };
}

async function getUserAchievements(userId) {
  return [
    {
      id: 'first_coin',
      name: 'First Coin',
      description: 'Collect your first gold coin',
      icon: 'coin_bronze',
      unlocked: false,
      progress: 0,
      target: 1
    },
    {
      id: 'collector_100',
      name: 'Coin Collector',
      description: 'Collect 100 coins',
      icon: 'coin_silver',
      unlocked: false,
      progress: 0,
      target: 100
    },
    {
      id: 'collector_1000',
      name: 'Treasure Hunter',
      description: 'Collect 1,000 coins',
      icon: 'coin_gold',
      unlocked: false,
      progress: 0,
      target: 1000
    },
    {
      id: 'walker_1km',
      name: 'First Steps',
      description: 'Walk 1 kilometer while playing',
      icon: 'footsteps',
      unlocked: false,
      progress: 0,
      target: 1000
    },
    {
      id: 'walker_10km',
      name: 'Explorer',
      description: 'Walk 10 kilometers while playing',
      icon: 'map',
      unlocked: false,
      progress: 0,
      target: 10000
    },
    {
      id: 'streak_7',
      name: 'Week Warrior',
      description: 'Play 7 days in a row',
      icon: 'calendar',
      unlocked: false,
      progress: 0,
      target: 7
    },
    {
      id: 'first_redemption',
      name: 'Cashing In',
      description: 'Redeem coins for the first time',
      icon: 'gift',
      unlocked: false,
      progress: 0,
      target: 1
    }
  ];
}

function getDailyChallenges(userId) {
  return [
    {
      id: 'daily_walk',
      name: 'Daily Walker',
      description: 'Walk 2,000 steps',
      reward: 50,
      progress: 0,
      target: 2000,
      expiresAt: getEndOfDay()
    },
    {
      id: 'daily_collect',
      name: 'Coin Rush',
      description: 'Collect 20 coins',
      reward: 25,
      progress: 0,
      target: 20,
      expiresAt: getEndOfDay()
    },
    {
      id: 'daily_combo',
      name: 'Combo Master',
      description: 'Achieve a 5x combo',
      reward: 100,
      progress: 0,
      target: 5,
      expiresAt: getEndOfDay()
    }
  ];
}

function getEndOfDay() {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.toISOString();
}

async function verifyMetaToken(token, userId) {
  // Mock implementation
  return true;
}

module.exports = router;
