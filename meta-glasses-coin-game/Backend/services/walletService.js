const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const geolib = require('geolib');

const prisma = new PrismaClient();

// Fraud detection thresholds
const FRAUD_THRESHOLDS = {
  MAX_COINS_PER_MINUTE: 500,
  MAX_TRANSACTIONS_PER_MINUTE: 20,
  MAX_SPEED_MPS: 15, // 15 m/s = ~54 km/h, faster than running
  MIN_DISTANCE_BETWEEN_COLLECTIONS: 1, // meters
};

class WalletService {
  /**
   * Get user's current wallet balance
   */
  async getBalance(userId) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        pendingRedemptions: {
          where: { status: 'PENDING' }
        }
      }
    });

    if (!wallet) {
      // Create wallet for new user
      return this.createWallet(userId);
    }

    const pendingAmount = wallet.pendingRedemptions.reduce(
      (sum, r) => sum + r.coinAmount, 0
    );

    return {
      currentBalance: wallet.balance,
      lifetimeEarnings: wallet.lifetimeEarnings,
      lifetimeRedeemed: wallet.lifetimeRedeemed,
      pendingRedemptions: pendingAmount
    };
  }

  /**
   * Create wallet for new user
   */
  async createWallet(userId) {
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        balance: 0,
        lifetimeEarnings: 0,
        lifetimeRedeemed: 0
      }
    });

    return {
      currentBalance: 0,
      lifetimeEarnings: 0,
      lifetimeRedeemed: 0,
      pendingRedemptions: 0
    };
  }

  /**
   * Validate a transaction for fraud
   */
  async validateTransaction({ userId, amount, type, timestamp, location }) {
    // Parse location
    const [lat, lng] = location.split(',').map(parseFloat);
    const transactionTime = new Date(timestamp);

    // Get recent transactions for fraud detection
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(transactionTime.getTime() - 60000) // Last minute
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Check transaction rate
    if (recentTransactions.length >= FRAUD_THRESHOLDS.MAX_TRANSACTIONS_PER_MINUTE) {
      return { valid: false, reason: 'Transaction rate exceeded' };
    }

    // Check coin rate
    const recentCoins = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
    if (recentCoins + amount > FRAUD_THRESHOLDS.MAX_COINS_PER_MINUTE) {
      return { valid: false, reason: 'Coin collection rate exceeded' };
    }

    // Check for impossible speed (teleportation detection)
    if (recentTransactions.length > 0) {
      const lastTransaction = recentTransactions[0];
      const [lastLat, lastLng] = lastTransaction.location.split(',').map(parseFloat);

      const distance = geolib.getDistance(
        { latitude: lastLat, longitude: lastLng },
        { latitude: lat, longitude: lng }
      );

      const timeDiff = (transactionTime - new Date(lastTransaction.createdAt)) / 1000;

      if (timeDiff > 0) {
        const speed = distance / timeDiff;
        if (speed > FRAUD_THRESHOLDS.MAX_SPEED_MPS) {
          return { valid: false, reason: 'Invalid movement detected' };
        }
      }

      // Check for duplicate location (standing still farming)
      if (distance < FRAUD_THRESHOLDS.MIN_DISTANCE_BETWEEN_COLLECTIONS &&
          recentTransactions.length > 5) {
        return { valid: false, reason: 'Movement required for collection' };
      }
    }

    // Validate amount is reasonable
    if (amount <= 0 || amount > 100) {
      return { valid: false, reason: 'Invalid coin amount' };
    }

    return { valid: true };
  }

  /**
   * Process a coin collection transaction
   */
  async processTransaction({ userId, amount, type, timestamp, location }) {
    const transactionId = uuidv4();

    // Use a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update wallet
      const wallet = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { increment: amount },
          lifetimeEarnings: { increment: amount }
        }
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          id: transactionId,
          userId,
          amount,
          type,
          location,
          createdAt: new Date(timestamp)
        }
      });

      // Update daily stats
      const today = new Date().toISOString().split('T')[0];
      await tx.dailyStats.upsert({
        where: {
          userId_date: { userId, date: today }
        },
        update: {
          coinsCollected: { increment: amount },
          transactionCount: { increment: 1 }
        },
        create: {
          userId,
          date: today,
          coinsCollected: amount,
          transactionCount: 1,
          distanceWalked: 0
        }
      });

      return { newBalance: wallet.balance, transactionId };
    });

    return result;
  }

  /**
   * Batch process multiple transactions
   */
  async batchProcessTransactions(userId, transactions) {
    const results = {
      processed: 0,
      failed: 0,
      newBalance: 0
    };

    for (const transaction of transactions) {
      try {
        const validation = await this.validateTransaction({
          userId,
          ...transaction
        });

        if (validation.valid) {
          const result = await this.processTransaction({
            userId,
            ...transaction
          });
          results.processed++;
          results.newBalance = result.newBalance;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Redeem coins for rewards
   */
  async redeemCoins(userId, optionId, coinAmount) {
    // Get redemption option
    const option = await prisma.redemptionOption.findUnique({
      where: { id: optionId }
    });

    if (!option) {
      return { success: false, error: 'Invalid redemption option' };
    }

    if (!option.isActive) {
      return { success: false, error: 'Redemption option not available' };
    }

    if (coinAmount < option.minCoins) {
      return { success: false, error: `Minimum ${option.minCoins} coins required` };
    }

    // Check user balance
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet || wallet.balance < coinAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Process redemption
    const redemptionId = uuidv4();

    const result = await prisma.$transaction(async (tx) => {
      // Deduct coins
      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: coinAmount },
          lifetimeRedeemed: { increment: coinAmount }
        }
      });

      // Create redemption record
      await tx.redemption.create({
        data: {
          id: redemptionId,
          userId,
          optionId,
          coinAmount,
          status: 'PENDING',
          dollarValue: coinAmount * 0.001
        }
      });

      return { newBalance: updatedWallet.balance };
    });

    return {
      success: true,
      newBalance: result.newBalance,
      redemptionId,
      message: `Successfully redeemed ${coinAmount} coins for ${option.name}`,
      rewardDetails: `Your ${option.name} will be processed within 24 hours`
    };
  }

  /**
   * Get transaction history
   */
  async getTransactions(userId, { page, limit, type }) {
    const where = { userId };
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.transaction.count({ where })
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get daily statistics
   */
  async getDailyStats(userId, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const stats = await prisma.dailyStats.findUnique({
      where: {
        userId_date: { userId, date: targetDate }
      }
    });

    return stats || {
      date: targetDate,
      coinsCollected: 0,
      transactionCount: 0,
      distanceWalked: 0
    };
  }

  /**
   * Get earnings summary for period
   */
  async getEarningsSummary(userId, period) {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const stats = await prisma.dailyStats.findMany({
      where: {
        userId,
        date: { gte: startDate.toISOString().split('T')[0] }
      },
      orderBy: { date: 'asc' }
    });

    const totals = stats.reduce(
      (acc, day) => ({
        totalCoins: acc.totalCoins + day.coinsCollected,
        totalTransactions: acc.totalTransactions + day.transactionCount,
        totalDistance: acc.totalDistance + day.distanceWalked
      }),
      { totalCoins: 0, totalTransactions: 0, totalDistance: 0 }
    );

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      ...totals,
      dollarValue: totals.totalCoins * 0.001,
      dailyBreakdown: stats
    };
  }
}

module.exports = new WalletService();
