# Nexus Launchpad - Solana Token Deployment System

A complete token deployment and management system for Solana blockchain. Deploy SPL tokens, manage encrypted wallets, trade on Jupiter, and track token history—all in one intuitive interface.

## Features

✅ **Token Deployment**
- Create SPL tokens with custom metadata
- Upload token images to IPFS via Pinata
- Mint tokens and set initial supply
- One-click token creation with full validation

✅ **Wallet Management**
- Generate new Solana wallets
- Import existing wallets (Base58 or JSON)
- AES-GCM encrypted storage with password protection
- View balances across devnet and mainnet
- Export and backup wallet keys

✅ **Trading Bot**
- Automated buy/sell execution via Jupiter
- Configurable trade intervals and ratios
- Real-time market quotes and slippage control
- Mainnet support (Jupiter doesn't support Devnet)

✅ **System Console**
- Real-time transaction logs
- Debug information for troubleshooting
- Token deployment history tracking

## Tech Stack

**Frontend:**
- React 18 + React Scripts
- @solana/web3.js for blockchain interaction
- @metaplex-foundation/js for token metadata
- localforage for encrypted browser storage

**Backend:**
- Express.js for API proxying
- Helius RPC (mainnet + devnet support)
- Pinata for IPFS image hosting
- Jupiter API for DEX swaps

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone and install:**
   ```bash
   git clone https://github.com/bargo1101/bikimi.git
   cd bikimi
   npm install:all
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your API keys:
   - Get Helius RPC URLs from [helius.dev](https://www.helius.dev/)
   - Get Pinata credentials from [pinata.cloud](https://www.pinata.cloud/)

3. **Run locally:**
   ```bash
   npm run dev
   ```
   This starts both the Express backend (port 3001) and React frontend (port 3000).

### Production Deployment

**Frontend (Vercel):**
```bash
npm run build
```
Deploy the `client/build` directory to Vercel using the included `vercel.json`.

**Backend (Node.js hosting):**
```bash
cd server
node server.js
```
Set environment variables on your hosting platform.

## Project Structure

```
bikimi/
├── client/                    React frontend
│   ├── src/
│   │   ├── components/        DeployPage, TradingPage, WalletsPage, etc.
│   │   ├── context/           AppContext (global state + wallet encryption)
│   │   ├── utils/
│   │   │   ├── solana.js      Token deployment logic
│   │   │   ├── jupiter.js     Jupiter swap execution
│   │   │   ├── crypto.js      AES-GCM wallet encryption
│   │   │   └── metaplex.js    Token metadata instructions
│   │   └── App.js
│   ├── package.json
│   └── public/
│
├── server/                    Express backend
│   ├── server.js              RPC proxy + file upload handling
│   └── package.json
│
├── vercel.json               Vercel deployment config
├── package.json              Root workspace config
└── .env.example              Environment template
```

## Available Scripts

### Root (`npm run ...`)
- `dev` - Run client + server concurrently
- `client` - Start React dev server (port 3000)
- `server` - Start Express backend (port 3001)
- `build` - Build React app for production
- `install:all` - Install deps for root, client, and server

### Client (`cd client && npm run ...`)
- `start` - Start dev server
- `build` - Build for production
- `test` - Run tests
- `eject` - Eject from Create React App (irreversible)

### Server (`cd server && npm start`)
- `start` - Run Express server

## API Endpoints

All backend endpoints are proxies for security (API keys never reach frontend):

### RPC Proxy
- `POST /rpc/mainnet-beta` - Helius mainnet RPC calls
- `POST /rpc/devnet` - Helius devnet RPC calls

### File Upload
- `POST /upload-image` - Upload token image to IPFS
- `POST /upload-metadata` - Upload token metadata to IPFS

### Jupiter DEX
- `GET /jupiter/quote` - Get swap quote
- `POST /jupiter/swap` - Execute swap

## Security & Best Practices

🔒 **Wallet Encryption**
- Passwords never sent to server
- AES-GCM encryption with PBKDF2 key derivation
- 100k iterations + random salt/IV
- Encrypted storage via localforage

🔐 **API Keys**
- Never exposed to frontend
- Stored in `.env` on backend only
- Use environment variables in production

⚠️ **Mainnet Safety**
- Trading bot requires explicit mainnet confirmation
- Jupiter support only on mainnet (no devnet)
- Always test on devnet first

## Troubleshooting

### "expired" error on token deployment
- **Fixed in v1.0.1**: Fresh blockhash now obtained for confirmTransaction
- Old blockhash expires after ~150 blocks (~60 seconds)

### Jupiter trading bot not working
- Ensure you're on **Mainnet** (Jupiter doesn't support Devnet)
- Check wallet has SOL balance (0.01 SOL minimum per trade)
- Verify backend is running on port 3001

### Wallet unlock fails
- Password is case-sensitive
- Ensure caps lock is off
- Check that you're using the correct password (no recovery available)

### IPFS image upload fails
- Verify Pinata API keys are correct in `.env`
- Check file size (max 5MB)
- Allowed formats: JPEG, PNG, GIF, WEBP

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `HELIUS_MAINNET_URL` | Helius mainnet RPC endpoint | `https://mainnet.helius-rpc.com/?api-key=...` |
| `HELIUS_DEVNET_URL` | Helius devnet RPC endpoint | `https://devnet.helius-rpc.com/?api-key=...` |
| `PINATA_API_KEY` | Pinata API key | (32-char string) |
| `PINATA_SECRET_API_KEY` | Pinata secret API key | (32-char string) |
| `PORT` | Express server port | `3001` |
| `NODE_ENV` | Environment | `development` or `production` |

## Recent Fixes (v1.0.2)

- ✅ Fixed token deployment "expired" error - use fresh blockhash for confirmation
- ✅ Fixed Jupiter trading bot - proper VersionedTransaction signing
- ✅ Added `vercel.json` for Vercel deployment
- ✅ Separated frontend/backend dependencies
- ✅ Added environment configuration files
- ✅ Comprehensive README with setup instructions

## License

MIT

## Support

For issues, questions, or feature requests, please open a GitHub issue.

---

**Live App:** https://bikimi-us3m.vercel.app
