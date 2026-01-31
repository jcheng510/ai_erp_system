const { v4: uuidv4 } = require('uuid');

// Mock redemption options (use database in production)
const redemptionOptions = [
  {
    id: 'cash-paypal-5',
    name: '$5 PayPal Cash',
    description: 'Receive $5 via PayPal',
    coinCost: 5000,
    minCoins: 5000,
    type: 'cash',
    dollarValue: 5.00,
    imageUrl: '/images/redemption/paypal.png',
    isActive: true,
    category: 'cash'
  },
  {
    id: 'cash-paypal-10',
    name: '$10 PayPal Cash',
    description: 'Receive $10 via PayPal',
    coinCost: 10000,
    minCoins: 10000,
    type: 'cash',
    dollarValue: 10.00,
    imageUrl: '/images/redemption/paypal.png',
    isActive: true,
    category: 'cash'
  },
  {
    id: 'giftcard-amazon-5',
    name: '$5 Amazon Gift Card',
    description: 'Digital Amazon gift card',
    coinCost: 5500,
    minCoins: 5500,
    type: 'giftcard',
    dollarValue: 5.00,
    imageUrl: '/images/redemption/amazon.png',
    isActive: true,
    category: 'giftcard'
  },
  {
    id: 'giftcard-amazon-10',
    name: '$10 Amazon Gift Card',
    description: 'Digital Amazon gift card',
    coinCost: 11000,
    minCoins: 11000,
    type: 'giftcard',
    dollarValue: 10.00,
    imageUrl: '/images/redemption/amazon.png',
    isActive: true,
    category: 'giftcard'
  },
  {
    id: 'giftcard-starbucks-5',
    name: '$5 Starbucks Gift Card',
    description: 'Digital Starbucks gift card',
    coinCost: 5500,
    minCoins: 5500,
    type: 'giftcard',
    dollarValue: 5.00,
    imageUrl: '/images/redemption/starbucks.png',
    isActive: true,
    category: 'giftcard'
  },
  {
    id: 'donation-charity',
    name: 'Donate to Charity',
    description: 'Donate your earnings to charity',
    coinCost: 1000,
    minCoins: 1000,
    type: 'donation',
    dollarValue: 1.00,
    imageUrl: '/images/redemption/charity.png',
    isActive: true,
    category: 'donation'
  },
  {
    id: 'ingame-golden-trail',
    name: 'Golden Trail Effect',
    description: 'Leave a golden trail as you walk',
    coinCost: 500,
    minCoins: 500,
    type: 'ingame',
    dollarValue: 0,
    imageUrl: '/images/redemption/golden-trail.png',
    isActive: true,
    category: 'cosmetic'
  },
  {
    id: 'ingame-coin-magnet',
    name: 'Coin Magnet (24h)',
    description: 'Attract coins from further away for 24 hours',
    coinCost: 1000,
    minCoins: 1000,
    type: 'ingame',
    dollarValue: 0,
    imageUrl: '/images/redemption/magnet.png',
    isActive: true,
    category: 'powerup'
  }
];

// Mock redemption history storage
const redemptions = new Map();

class RedemptionService {
  /**
   * Get available redemption options
   */
  async getAvailableOptions({ userId, category, minCoins, maxCoins }) {
    let options = redemptionOptions.filter(opt => opt.isActive);

    if (category) {
      options = options.filter(opt => opt.category === category);
    }

    if (minCoins !== undefined) {
      options = options.filter(opt => opt.coinCost >= minCoins);
    }

    if (maxCoins !== undefined) {
      options = options.filter(opt => opt.coinCost <= maxCoins);
    }

    return options.map(opt => ({
      id: opt.id,
      name: opt.name,
      description: opt.description,
      coinCost: opt.coinCost,
      type: opt.type,
      dollarValue: opt.dollarValue,
      imageUrl: opt.imageUrl,
      isAvailable: opt.isActive
    }));
  }

  /**
   * Get specific option details
   */
  async getOptionDetails(optionId) {
    return redemptionOptions.find(opt => opt.id === optionId);
  }

  /**
   * Get user's redemption history
   */
  async getRedemptionHistory(userId, { page, limit, status }) {
    const userRedemptions = Array.from(redemptions.values())
      .filter(r => r.userId === userId)
      .filter(r => !status || r.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const startIndex = (page - 1) * limit;
    const paginatedResults = userRedemptions.slice(startIndex, startIndex + limit);

    return {
      redemptions: paginatedResults,
      pagination: {
        page,
        limit,
        total: userRedemptions.length,
        totalPages: Math.ceil(userRedemptions.length / limit)
      }
    };
  }

  /**
   * Get redemption status
   */
  async getRedemptionStatus(userId, redemptionId) {
    const redemption = redemptions.get(redemptionId);

    if (!redemption || redemption.userId !== userId) {
      return null;
    }

    return {
      id: redemption.id,
      status: redemption.status,
      type: redemption.type,
      coinAmount: redemption.coinAmount,
      dollarValue: redemption.dollarValue,
      createdAt: redemption.createdAt,
      completedAt: redemption.completedAt,
      details: redemption.details
    };
  }

  /**
   * Process cash withdrawal
   */
  async processCashWithdrawal(userId, { amount, paymentMethod, paymentDetails }) {
    const redemptionId = uuidv4();
    const dollarValue = amount * 0.001;

    // Validate payment method
    const validMethods = ['paypal', 'venmo', 'bank'];
    if (!validMethods.includes(paymentMethod)) {
      return { success: false, error: 'Invalid payment method' };
    }

    // Create redemption record
    const redemption = {
      id: redemptionId,
      userId,
      type: 'cash',
      coinAmount: amount,
      dollarValue,
      paymentMethod,
      paymentDetails: this.sanitizePaymentDetails(paymentDetails),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      estimatedCompletion: this.getEstimatedCompletion(paymentMethod)
    };

    redemptions.set(redemptionId, redemption);

    // In production, queue for processing
    // await this.queueCashTransfer(redemption);

    return {
      success: true,
      redemptionId,
      amountUSD: dollarValue,
      estimatedArrival: redemption.estimatedCompletion,
      message: `$${dollarValue.toFixed(2)} will be sent to your ${paymentMethod} account`
    };
  }

  /**
   * Process gift card redemption
   */
  async processGiftCardRedemption(userId, { optionId, deliveryEmail }) {
    const option = redemptionOptions.find(opt => opt.id === optionId);

    if (!option || option.type !== 'giftcard') {
      return { success: false, error: 'Invalid gift card option' };
    }

    const redemptionId = uuidv4();

    const redemption = {
      id: redemptionId,
      userId,
      optionId,
      type: 'giftcard',
      coinAmount: option.coinCost,
      dollarValue: option.dollarValue,
      deliveryEmail,
      status: 'PROCESSING',
      createdAt: new Date().toISOString()
    };

    redemptions.set(redemptionId, redemption);

    // In production, integrate with gift card provider API
    // const giftCard = await this.purchaseGiftCard(option, deliveryEmail);

    // Mock gift card details
    const giftCardDetails = {
      brand: option.name.split(' ')[1], // Extract brand from name
      amount: option.dollarValue,
      code: `XXXX-XXXX-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };

    redemption.status = 'COMPLETED';
    redemption.completedAt = new Date().toISOString();
    redemption.details = giftCardDetails;

    return {
      success: true,
      redemptionId,
      giftCardDetails: {
        ...giftCardDetails,
        message: `Gift card code sent to ${deliveryEmail}`
      },
      message: `Your ${option.name} has been delivered!`
    };
  }

  /**
   * Get user's saved payment methods
   */
  async getPaymentMethods(userId) {
    // In production, fetch from database
    return [
      {
        id: 'pm_1',
        type: 'paypal',
        email: 'user@example.com',
        isDefault: true
      }
    ];
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(userId, type, details) {
    // In production, save to database
    return {
      id: uuidv4(),
      type,
      ...this.sanitizePaymentDetails(details)
    };
  }

  // Helper methods
  sanitizePaymentDetails(details) {
    // Remove sensitive info from stored details
    if (details.accountNumber) {
      return {
        ...details,
        accountNumber: `****${details.accountNumber.slice(-4)}`
      };
    }
    return details;
  }

  getEstimatedCompletion(paymentMethod) {
    const now = new Date();
    switch (paymentMethod) {
      case 'paypal':
        // 1-3 business days
        now.setDate(now.getDate() + 3);
        break;
      case 'venmo':
        // 1-2 business days
        now.setDate(now.getDate() + 2);
        break;
      case 'bank':
        // 3-5 business days
        now.setDate(now.getDate() + 5);
        break;
      default:
        now.setDate(now.getDate() + 7);
    }
    return now.toISOString();
  }
}

module.exports = new RedemptionService();
