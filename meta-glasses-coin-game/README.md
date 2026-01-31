# CoinQuest AR - Meta Glasses Gold Coin Collection Game

An augmented reality game for Meta Quest glasses that allows users to collect virtual gold coins while walking in the real world and redeem them for real money or prizes.

## Overview

CoinQuest AR transforms your daily walks into treasure hunts. Using Meta glasses' AR capabilities and GPS tracking, virtual gold coins appear in your surroundings as you explore. Collect coins, build your treasure, and redeem them for real rewards!

## Features

### Core Gameplay
- **AR Coin Spawning**: Gold coins appear in augmented reality as you walk
- **GPS-Based Locations**: Coins spawn at real-world locations within walking distance
- **Collection Mechanics**: Look at and tap to collect coins
- **Combo System**: Collect multiple coins quickly for bonus multipliers
- **Daily Challenges**: Special coin trails and objectives

### Reward System
- **Coin Wallet**: Track your collected coins in real-time
- **Redemption Store**: Exchange coins for:
  - Cash rewards (PayPal, Venmo, bank transfer)
  - Gift cards (Amazon, Starbucks, etc.)
  - Physical prizes
  - In-game cosmetics and power-ups
- **Leaderboards**: Compete with friends and global players

### Health & Fitness Integration
- **Step Tracking**: Bonus coins for hitting step goals
- **Distance Rewards**: Earn multipliers based on distance walked
- **Weekly Challenges**: Community fitness goals

## Technical Architecture

```
meta-glasses-coin-game/
├── Assets/                    # Unity AR Project
│   ├── Scripts/
│   │   ├── Core/             # Game managers, state management
│   │   ├── Gameplay/         # Coin spawning, collection logic
│   │   ├── UI/               # HUD, menus, notifications
│   │   ├── Network/          # API communication, sync
│   │   ├── Rewards/          # Redemption, wallet management
│   │   └── Location/         # GPS, geofencing, mapping
│   ├── Prefabs/              # Reusable game objects
│   ├── Scenes/               # Unity scenes
│   ├── Materials/            # Shaders and materials
│   ├── Audio/                # Sound effects and music
│   └── Textures/             # Images and sprites
├── Backend/                   # Node.js API Server
│   ├── api/                  # REST endpoints
│   ├── models/               # Database schemas
│   ├── services/             # Business logic
│   ├── config/               # Configuration
│   └── middleware/           # Auth, validation
├── Docs/                      # Documentation
└── Tests/                     # Unit and integration tests
```

## Requirements

### Development
- Unity 2022.3 LTS or newer
- Meta XR SDK
- Node.js 18+
- PostgreSQL 14+
- Redis (for real-time features)

### Meta Glasses
- Meta Quest 3 or newer
- Meta Quest Pro
- Ray-Ban Meta Smart Glasses (limited features)

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/meta-glasses-coin-game.git
cd meta-glasses-coin-game
```

### 2. Backend Setup
```bash
cd Backend
npm install
cp .env.example .env
# Configure your environment variables
npm run dev
```

### 3. Unity Project
1. Open the project in Unity Hub
2. Import Meta XR SDK package
3. Configure Meta Quest build settings
4. Build and deploy to your Meta glasses

## API Documentation

See [API Documentation](./Docs/API.md) for detailed endpoint specifications.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./Docs/CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.

## Safety & Privacy

- Location data is processed locally when possible
- Users control data sharing preferences
- Coins only spawn in safe, pedestrian-friendly areas
- Built-in safety alerts for traffic and obstacles
