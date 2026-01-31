# CoinQuest AR - API Documentation

## Base URL

```
Production: https://api.coinquestar.com/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Obtain Access Token

**POST** `/auth/login`

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "displayName": "Player123"
  }
}
```

---

## Endpoints

### Authentication

#### Register
**POST** `/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "displayName": "Player123"
}
```

#### Login with Meta
**POST** `/auth/meta`

Authenticate using Meta account.

**Request Body:**
```json
{
  "metaAccessToken": "meta-oauth-token",
  "metaUserId": "meta-user-id"
}
```

#### Refresh Token
**POST** `/auth/refresh`

Get a new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

---

### Wallet

#### Get Balance
**GET** `/wallet/balance`

Returns the user's current coin balance and statistics.

**Response:**
```json
{
  "balance": 5420,
  "lifetimeEarnings": 15000,
  "lifetimeRedeemed": 9580,
  "pendingRedemptions": 0
}
```

#### Record Transaction
**POST** `/wallet/transaction`

Record a coin collection transaction.

**Request Body:**
```json
{
  "amount": 25,
  "type": "Collect",
  "timestamp": "2024-01-15T10:30:00Z",
  "location": "37.7749,-122.4194"
}
```

**Response:**
```json
{
  "success": true,
  "newBalance": 5445,
  "transactionId": "txn-uuid"
}
```

#### Batch Sync
**POST** `/wallet/sync`

Sync multiple offline transactions.

**Request Body:**
```json
{
  "transactions": [
    {
      "amount": 25,
      "type": "Collect",
      "timestamp": "2024-01-15T10:30:00Z",
      "location": "37.7749,-122.4194"
    }
  ]
}
```

#### Get Transaction History
**GET** `/wallet/transactions`

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `type` (optional): Filter by transaction type

#### Get Daily Stats
**GET** `/wallet/stats/daily`

**Query Parameters:**
- `date` (optional): Date in YYYY-MM-DD format

---

### Redemption

#### Get Redemption Options
**GET** `/redemption/options`

**Query Parameters:**
- `category` (optional): cash, giftcard, donation, cosmetic, powerup
- `minCoins` (optional): Minimum coin cost filter
- `maxCoins` (optional): Maximum coin cost filter

**Response:**
```json
{
  "options": [
    {
      "id": "cash-paypal-5",
      "name": "$5 PayPal Cash",
      "description": "Receive $5 via PayPal",
      "coinCost": 5000,
      "type": "cash",
      "dollarValue": 5.00,
      "imageUrl": "/images/paypal.png",
      "isAvailable": true
    }
  ]
}
```

#### Request Cash Withdrawal
**POST** `/redemption/cash`

**Request Body:**
```json
{
  "amount": 5000,
  "paymentMethod": "paypal",
  "paymentDetails": {
    "email": "user@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "redemptionId": "red-uuid",
  "amountUSD": 5.00,
  "estimatedArrival": "2024-01-18T00:00:00Z",
  "message": "$5.00 will be sent to your PayPal account"
}
```

#### Redeem Gift Card
**POST** `/redemption/giftcard`

**Request Body:**
```json
{
  "optionId": "giftcard-amazon-5",
  "email": "user@example.com"
}
```

#### Get Redemption History
**GET** `/redemption/history`

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `status` (optional): PENDING, PROCESSING, COMPLETED, FAILED

---

### Leaderboard

#### Get Global Leaderboard
**GET** `/leaderboard`

**Query Parameters:**
- `period`: daily, weekly, allTime
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "period": "daily",
  "entries": [
    {
      "rank": 1,
      "userId": "user-uuid",
      "displayName": "TopPlayer",
      "coins": 1500,
      "distance": 5000
    }
  ],
  "userRank": {
    "rank": 42,
    "coins": 500
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000
  }
}
```

#### Get Friends Leaderboard
**GET** `/leaderboard/friends`

#### Get Nearby Leaderboard
**GET** `/leaderboard/nearby`

**Query Parameters:**
- `lat`: Latitude
- `lng`: Longitude
- `radius` (default: 5000): Radius in meters

---

### User

#### Get Profile
**GET** `/user/profile`

#### Update Profile
**PATCH** `/user/profile`

**Request Body:**
```json
{
  "displayName": "NewName",
  "avatar": "avatar-url"
}
```

#### Get Achievements
**GET** `/user/achievements`

#### Get Daily Challenges
**GET** `/user/challenges`

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "details": ["Additional details if available"]
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Rate Limits

- Default: 100 requests per minute
- Authentication endpoints: 10 requests per 15 minutes
- Redemption endpoints: 10 requests per hour

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312800
```

---

## Webhooks

For real-time updates, you can configure webhooks in your account settings.

### Events

- `redemption.completed` - Redemption was processed successfully
- `redemption.failed` - Redemption processing failed
- `achievement.unlocked` - User unlocked an achievement
- `leaderboard.rank_change` - User's rank changed significantly

### Payload Format

```json
{
  "event": "redemption.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "redemptionId": "red-uuid",
    "userId": "user-uuid",
    "amount": 5000,
    "type": "cash"
  }
}
```
