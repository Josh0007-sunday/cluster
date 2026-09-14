# Cluster

A unified cross-chain financial hub built on Solana. Bridge USDC across chains, swap stablecoins, invest in tokenized stocks, and manage your portfolio, all in one place.

## Problem

Solana users are forced to juggle multiple dApps and chains to manage their finances. Bridging assets requires navigating CCTP. Stablecoin swaps depend on separate aggregators. Tokenized equities live on entirely different ecosystems. Portfolio tracking requires manual aggregation across wallets. There is no single platform that brings all of these together with a native Solana experience.

## Solution

Cluster is a web3 financial superapp that unifies bridging, swapping, DCA investing, tokenized stock trading, and portfolio management behind one wallet connection. Built on Solana with CCTP for cross-chain USDC bridging, Jupiter for swaps and DCA, backed.fi for xStocks, and Kamino for vault-based yield.

## Key Features

- Cross-chain USDC bridging via CCTP with real-time status tracking
- Stablecoin swaps powered by StableFX with competitive pricing
- DCA baskets for tokenized stock investing via Jupiter Trigger
- Real-time xStock portfolio tracking with on-chain data
- Multi-wallet support through Reown AppKit (Phantom, MetaMask, Solflare, Coinbase, Rabby, Bitget, Trust, WalletConnect)
- Unified portfolio view across SOL, USDC, xStocks, and Kamino vaults

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui patterns
- **Blockchain**: Solana (SVM), Web3.js, Jupiter API, CCTP
- **Data**: Helius RPC, Stockserver API, CoinGecko (price feeds)
- **Wallet**: Reown AppKit, Solana Wallet Adapter
- **Backend**: Stockserver (tokenized stock data), Kamino Finance API

## Architecture

The project is organized as a monorepo-style Vite application:

- `src/components/bridge` - CCTP cross-chain bridging
- `src/components/swap` - StableFX stablecoin swapping
- `src/components/earn` - Kamino vault DCA investing
- `src/components/stocks` - xStock trading interface
- `src/components/portfolio` - Portfolio dashboard
- `src/components/landing` - Marketing and onboarding pages
- `src/components/wallet` - Wallet connection and modal
- `src/lib` - Core utilities and API integrations
- `src/hooks` - Custom React hooks for wallet and blockchain state

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your API keys
3. Install dependencies: `npm install`
4. Start the dev server: `npm run dev`

## Environment Variables

- `VITE_HELIUS_API_KEY` - Helius RPC API key
- `VITE_REOWN_PROJECT_ID` - Reown AppKit project ID
- `VITE_CIRCLE_API_KEY` - Circle StableFX API key
- `VITE_SOLANA_RPC_URL` - Custom Solana RPC URL
- `VITE_JUPITER_API_KEY` - Jupiter API key
- `VITE_KAMINO_API_BASE` - Kamino Finance API base URL

## Demo

Live demo coming soon. The application supports all major Solana wallets and provides a production-grade experience for managing cross-chain finances.

## License

MIT
