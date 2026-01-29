# AI ERP System

A modern AI-powered ERP system built with React, Express, and tRPC.

## Prerequisites

- Node.js 18+ (recommended: use latest LTS)
- pnpm 10.4.1+ (package manager)
- MySQL database

## Local Development Setup

### 1. Install Dependencies

The project uses pnpm as its package manager. Install it globally if you haven't already:

```bash
npm install -g pnpm
```

Then install project dependencies:

```bash
pnpm install
```

### 2. Environment Configuration

Copy the example environment file and configure it with your values:

```bash
cp .env.example .env
```

Edit `.env` and set the required environment variables:

- `DATABASE_URL`: Your MySQL connection string
- `JWT_SECRET`: A secure secret key (minimum 32 characters)
- Configure other optional services as needed (Google OAuth, SendGrid, IMAP, etc.)

### 3. Database Setup

Run database migrations:

```bash
pnpm run db:push
```

### 4. Start Development Server

```bash
pnpm run dev
```

The application will start on http://localhost:3000

## Production Build & Deployment

### Build the Application

```bash
pnpm run build
```

This will:
1. Build the frontend using Vite (outputs to `dist/public`)
2. Bundle the backend using esbuild (outputs to `dist/index.js`)

### Start Production Server

```bash
pnpm run start
```

Or with a custom port:

```bash
PORT=8080 pnpm run start
```

## Available Scripts

- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run check` - Type check with TypeScript
- `pnpm run format` - Format code with Prettier
- `pnpm run test` - Run tests
- `pnpm run db:push` - Generate and run database migrations

## Railway Deployment

This application is configured for easy deployment on Railway:

1. **Build Command**: `pnpm run build` (Railway automatically runs `pnpm install` first)
2. **Start Command**: `pnpm run start`
3. **Environment Variables**: Set all required variables from `.env.example` in Railway dashboard

Railway will auto-detect the configuration from `package.json`.

## Project Structure

```
├── client/          # React frontend application
├── server/          # Express backend with tRPC
├── shared/          # Shared types and utilities
├── dist/            # Build output (generated)
│   ├── index.js     # Bundled server
│   └── public/      # Static frontend assets
├── drizzle/         # Database migrations
└── scripts/         # Utility scripts
```

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, Wouter (routing), Radix UI
- **Backend**: Express, tRPC, Drizzle ORM
- **Database**: MySQL
- **Build Tools**: Vite, esbuild, TypeScript
- **Testing**: Vitest

## License

MIT
