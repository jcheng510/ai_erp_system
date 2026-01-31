const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const walletService = require('../services/walletService');
const { validateTransaction } = require('../middleware/validation');

/**
 * Get user's wallet balance
 * GET /api/v1/wallet/balance
 */
router.get('/balance', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const balance = await walletService.getBalance(userId);

    res.json({
      balance: balance.currentBalance,
      lifetimeEarnings: balance.lifetimeEarnings,
      lifetimeRedeemed: balance.lifetimeRedeemed,
      pendingRedemptions: balance.pendingRedemptions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get transaction history
 * GET /api/v1/wallet/transactions
 */
router.get('/transactions', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;

    const transactions = await walletService.getTransactions(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      type
    });

    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

/**
 * Record a coin collection transaction
 * POST /api/v1/wallet/transaction
 */
router.post('/transaction', authenticate, validateTransaction, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, type, timestamp, location } = req.body;

    // Validate the transaction
    const validationResult = await walletService.validateTransaction({
      userId,
      amount,
      type,
      timestamp,
      location
    });

    if (!validationResult.valid) {
      return res.status(400).json({ error: validationResult.reason });
    }

    // Process the transaction
    const result = await walletService.processTransaction({
      userId,
      amount,
      type,
      timestamp,
      location
    });

    res.json({
      success: true,
      newBalance: result.newBalance,
      transactionId: result.transactionId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Batch sync multiple transactions
 * POST /api/v1/wallet/sync
 */
router.post('/sync', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions provided' });
    }

    if (transactions.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 transactions per sync' });
    }

    const results = await walletService.batchProcessTransactions(userId, transactions);

    res.json({
      success: true,
      processed: results.processed,
      failed: results.failed,
      newBalance: results.newBalance
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Redeem coins for rewards
 * POST /api/v1/wallet/redeem
 */
router.post('/redeem', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { optionId, coinAmount } = req.body;

    if (!optionId || !coinAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await walletService.redeemCoins(userId, optionId, coinAmount);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      newBalance: result.newBalance,
      message: result.message,
      rewardDetails: result.rewardDetails,
      redemptionId: result.redemptionId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get daily earnings statistics
 * GET /api/v1/wallet/stats/daily
 */
router.get('/stats/daily', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    const stats = await walletService.getDailyStats(userId, date);

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * Get weekly/monthly earnings summary
 * GET /api/v1/wallet/stats/summary
 */
router.get('/stats/summary', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { period = 'week' } = req.query;

    const summary = await walletService.getEarningsSummary(userId, period);

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
