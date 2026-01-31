require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./api/auth');
const walletRoutes = require('./api/wallet');
const redemptionRoutes = require('./api/redemption');
const leaderboardRoutes = require('./api/leaderboard');
const userRoutes = require('./api/user');

const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/redemption', redemptionRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/user', userRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 CoinQuest AR API server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
