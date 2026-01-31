/**
 * Application configuration
 */

const config = {
  // Server settings
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*']
  },

  // Database settings
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/coinquest',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10
  },

  // Redis settings (for caching and real-time features)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    prefix: 'coinquest:'
  },

  // Authentication settings
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '1h',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d',
    bcryptRounds: 12
  },

  // Meta integration settings
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    graphApiVersion: 'v18.0'
  },

  // Game settings
  game: {
    // Coin values
    coinValues: {
      bronze: 5,
      silver: 10,
      gold: 25,
      special: 100
    },

    // Spawn rates (percentage)
    coinSpawnRates: {
      bronze: 55,
      silver: 30,
      gold: 10,
      special: 5
    },

    // Conversion rate (coins to dollars)
    coinToDollarRate: 0.001, // 1000 coins = $1

    // Minimum withdrawal
    minWithdrawalCoins: 1000, // $1 minimum

    // Fraud detection thresholds
    fraud: {
      maxCoinsPerMinute: 500,
      maxTransactionsPerMinute: 20,
      maxSpeedMps: 15, // meters per second
      minCollectionDistance: 1 // meters
    },

    // Combo settings
    combo: {
      timeWindow: 5000, // ms between collections to maintain combo
      maxMultiplier: 3.0
    }
  },

  // Payment providers
  payments: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      mode: process.env.PAYPAL_MODE || 'sandbox'
    }
  },

  // Rate limiting
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    // Specific limits for sensitive endpoints
    auth: {
      windowMs: 900000, // 15 minutes
      maxRequests: 10
    },
    redemption: {
      windowMs: 3600000, // 1 hour
      maxRequests: 10
    }
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'dev'
  },

  // Feature flags
  features: {
    cashRedemption: process.env.FEATURE_CASH_REDEMPTION === 'true',
    giftCards: process.env.FEATURE_GIFT_CARDS === 'true',
    leaderboards: true,
    dailyChallenges: true,
    friendsSystem: process.env.FEATURE_FRIENDS === 'true'
  }
};

// Validate required settings in production
if (config.server.env === 'production') {
  const required = [
    'JWT_SECRET',
    'DATABASE_URL',
    'STRIPE_SECRET_KEY'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }
}

module.exports = config;
