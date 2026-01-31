const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const redemptionService = require('../services/redemptionService');

/**
 * Get available redemption options
 * GET /api/v1/redemption/options
 */
router.get('/options', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { category, minCoins, maxCoins } = req.query;

    const options = await redemptionService.getAvailableOptions({
      userId,
      category,
      minCoins: minCoins ? parseInt(minCoins) : undefined,
      maxCoins: maxCoins ? parseInt(maxCoins) : undefined
    });

    res.json({ options });
  } catch (error) {
    next(error);
  }
});

/**
 * Get specific redemption option details
 * GET /api/v1/redemption/options/:id
 */
router.get('/options/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const option = await redemptionService.getOptionDetails(id);

    if (!option) {
      return res.status(404).json({ error: 'Redemption option not found' });
    }

    res.json(option);
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's redemption history
 * GET /api/v1/redemption/history
 */
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const history = await redemptionService.getRedemptionHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });

    res.json(history);
  } catch (error) {
    next(error);
  }
});

/**
 * Get redemption status
 * GET /api/v1/redemption/:id/status
 */
router.get('/:id/status', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const status = await redemptionService.getRedemptionStatus(userId, id);

    if (!status) {
      return res.status(404).json({ error: 'Redemption not found' });
    }

    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * Request cash withdrawal
 * POST /api/v1/redemption/cash
 */
router.post('/cash', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, paymentMethod, paymentDetails } = req.body;

    if (!amount || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Minimum withdrawal amount
    const minWithdrawal = 1000; // coins = $1
    if (amount < minWithdrawal) {
      return res.status(400).json({
        error: `Minimum withdrawal is ${minWithdrawal} coins ($${minWithdrawal * 0.001})`
      });
    }

    const result = await redemptionService.processCashWithdrawal(userId, {
      amount,
      paymentMethod,
      paymentDetails
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      redemptionId: result.redemptionId,
      amountUSD: result.amountUSD,
      estimatedArrival: result.estimatedArrival,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Redeem for gift card
 * POST /api/v1/redemption/giftcard
 */
router.post('/giftcard', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { optionId, email } = req.body;

    if (!optionId) {
      return res.status(400).json({ error: 'Missing option ID' });
    }

    const result = await redemptionService.processGiftCardRedemption(userId, {
      optionId,
      deliveryEmail: email || req.user.email
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      redemptionId: result.redemptionId,
      giftCardDetails: result.giftCardDetails,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available payment methods
 * GET /api/v1/redemption/payment-methods
 */
router.get('/payment-methods', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const paymentMethods = await redemptionService.getPaymentMethods(userId);

    res.json({ paymentMethods });
  } catch (error) {
    next(error);
  }
});

/**
 * Add/update payment method
 * POST /api/v1/redemption/payment-methods
 */
router.post('/payment-methods', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, details } = req.body;

    if (!type || !details) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await redemptionService.addPaymentMethod(userId, type, details);

    res.json({
      success: true,
      paymentMethodId: result.id
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
