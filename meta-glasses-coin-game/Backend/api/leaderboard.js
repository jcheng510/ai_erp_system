const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');

// Mock leaderboard data (use Redis/database in production)
const leaderboards = {
  daily: [],
  weekly: [],
  allTime: [],
  friends: new Map()
};

/**
 * Get global leaderboard
 * GET /api/v1/leaderboard
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { period = 'daily', page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;

    const leaderboard = leaderboards[period] || leaderboards.daily;

    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = leaderboard.slice(startIndex, endIndex);

    // Find user's rank if authenticated
    let userRank = null;
    if (userId) {
      const userIndex = leaderboard.findIndex(entry => entry.userId === userId);
      if (userIndex !== -1) {
        userRank = {
          rank: userIndex + 1,
          ...leaderboard[userIndex]
        };
      }
    }

    res.json({
      period,
      entries: paginatedResults,
      userRank,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: leaderboard.length,
        totalPages: Math.ceil(leaderboard.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get friends leaderboard
 * GET /api/v1/leaderboard/friends
 */
router.get('/friends', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { period = 'weekly' } = req.query;

    // Get user's friends (mock implementation)
    const friendIds = await getFriendIds(userId);
    friendIds.push(userId); // Include self

    // Filter leaderboard to friends
    const leaderboard = leaderboards[period] || leaderboards.weekly;
    const friendsLeaderboard = leaderboard
      .filter(entry => friendIds.includes(entry.userId))
      .slice(0, 100);

    res.json({
      period,
      entries: friendsLeaderboard,
      totalFriends: friendIds.length - 1
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get nearby leaderboard (location-based)
 * GET /api/v1/leaderboard/nearby
 */
router.get('/nearby', authenticate, async (req, res, next) => {
  try {
    const { lat, lng, radius = 5000 } = req.query; // radius in meters

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Location required' });
    }

    // In production, query users within radius
    const nearbyLeaderboard = leaderboards.daily
      .filter(entry => {
        // Mock distance check
        return entry.location &&
               calculateDistance(parseFloat(lat), parseFloat(lng),
                                entry.location.lat, entry.location.lng) <= radius;
      })
      .slice(0, 50);

    res.json({
      entries: nearbyLeaderboard,
      radius,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's stats and rankings
 * GET /api/v1/leaderboard/me
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const rankings = {
      daily: findUserRank(leaderboards.daily, userId),
      weekly: findUserRank(leaderboards.weekly, userId),
      allTime: findUserRank(leaderboards.allTime, userId)
    };

    // Get user's achievements related to leaderboards
    const achievements = await getLeaderboardAchievements(userId);

    res.json({
      rankings,
      achievements,
      bestRank: Math.min(
        rankings.daily?.rank || Infinity,
        rankings.weekly?.rank || Infinity,
        rankings.allTime?.rank || Infinity
      )
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get leaderboard around user's position
 * GET /api/v1/leaderboard/around-me
 */
router.get('/around-me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { period = 'daily', range = 5 } = req.query;

    const leaderboard = leaderboards[period] || leaderboards.daily;
    const userIndex = leaderboard.findIndex(entry => entry.userId === userId);

    if (userIndex === -1) {
      return res.json({
        entries: [],
        userRank: null,
        message: 'User not ranked yet'
      });
    }

    // Get entries around user
    const startIndex = Math.max(0, userIndex - range);
    const endIndex = Math.min(leaderboard.length, userIndex + range + 1);
    const entries = leaderboard.slice(startIndex, endIndex).map((entry, idx) => ({
      ...entry,
      rank: startIndex + idx + 1,
      isCurrentUser: entry.userId === userId
    }));

    res.json({
      entries,
      userRank: userIndex + 1,
      totalPlayers: leaderboard.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Submit score update (internal use)
 * POST /api/v1/leaderboard/update
 */
router.post('/update', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { coins, distance, steps } = req.body;

    // Update user's score in leaderboards
    await updateLeaderboardEntry(userId, {
      coins,
      distance,
      steps,
      displayName: req.user.displayName
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function findUserRank(leaderboard, userId) {
  const index = leaderboard.findIndex(entry => entry.userId === userId);
  if (index === -1) return null;

  return {
    rank: index + 1,
    coins: leaderboard[index].coins,
    percentile: Math.round((1 - index / leaderboard.length) * 100)
  };
}

async function updateLeaderboardEntry(userId, data) {
  const entry = {
    userId,
    displayName: data.displayName,
    coins: data.coins,
    distance: data.distance,
    steps: data.steps,
    updatedAt: new Date().toISOString()
  };

  // Update daily leaderboard
  const dailyIndex = leaderboards.daily.findIndex(e => e.userId === userId);
  if (dailyIndex !== -1) {
    leaderboards.daily[dailyIndex] = entry;
  } else {
    leaderboards.daily.push(entry);
  }

  // Sort by coins
  leaderboards.daily.sort((a, b) => b.coins - a.coins);
}

async function getFriendIds(userId) {
  // Mock implementation - return empty array
  return [];
}

async function getLeaderboardAchievements(userId) {
  return [
    { id: 'top_100', name: 'Top 100', unlocked: false },
    { id: 'top_10', name: 'Top 10', unlocked: false },
    { id: 'number_one', name: '#1 Champion', unlocked: false }
  ];
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;
