// app.config.js — Cluster central config (v2, narrowed scope)
// Wallet connect + Bridge + Swap + Kamino staking ONLY. Zero Spend is OUT of scope.
// Loaded by Vite via `vite.config.ts` + mirrored in `src/config/cluster.ts` (typed).
// Env source: .env (see .env.example). All client keys must use VITE_ prefix.

export default {
  app: {
    name: import.meta?.env?.VITE_APP_NAME ?? process.env.VITE_APP_NAME ?? 'Cluster',
    env: import.meta?.env?.VITE_APP_ENV ?? process.env.VITE_APP_ENV ?? 'development',
  },

  // ── Theme (DeFi bold) ──────────────────────────────────────────
  theme: {
    background: '#0f0f11',
    card: '#191a1c',
    connectButton: '#714fba',
    textPrimary: '#f4f2ff',
    textMuted: '#a1a1aa',
    accent: '#714fba',
    success: '#22c55e',
    warning: '#f59e0b',
  },

  // ── Wallet Connect (Reown AppKit, Solana + EVM) ────────────────
  // Modal surfaces: injected / WalletConnect / MetaMask / Coinbase / Rabby / Bitget (EVM)
  // + Phantom / Solflare / Backpack (Solana). Single entry point.
  wallet: {
    reownProjectId:
      import.meta?.env?.VITE_REOWN_PROJECT_ID ?? process.env.VITE_REOWN_PROJECT_ID ?? '',
    // Chains in use this phase (bridge spans both):
    chains: ['solana', 'ethereum', 'base', 'arbitrum'],
  },

  // ── Bridge (Circle Bridge Kit → CCTP, single kit.bridge call) ──
  // Gas: Paymaster (USDC gas) is ETH/Arbitrum/Base only — NOT Solana yet.
  // → Solana legs fall back to standard SOL-denominated gas for now.
  bridge: {
    kit: '@circle-fin/bridge-kit',
    evmAdapter: '@circle-fin/adapter-viem-v2',
    solanaAdapter: '@circle-fin/adapter-solana-kit',
    gas: {
      evmPaymasterEligible: ['ethereum', 'arbitrum', 'base'],
      solanaFallsBackToSOL: true,
    },
  },

  // ── Swap (Circle StableFX: USDC ↔ EURC etc.) ────────────────────
  // Flow: POST /quotes (rate, fee, quoteId, short expiry) → POST /trades { quoteId }
  swap: {
    baseUrl:
      import.meta?.env?.VITE_CIRCLE_STABLEFX_BASE_URL ??
      process.env.VITE_CIRCLE_STABLEFX_BASE_URL ??
      'https://api.circle.com/v1/exchange/stablefx',
    quotesPath: '/quotes',
    tradesPath: '/trades',
    defaultPair: { from: 'USDC', to: 'EURC' },
  },

  // ── Earn / Staking (Kamino Finance, REST-first, skip SDK) ───────
  // Deposit idle USDC → vault receipt (kUSDC-style), balance grows via yield.
  earn: {
    apiBase:
      import.meta?.env?.VITE_KAMINO_API_BASE ??
      process.env.VITE_KAMINO_API_BASE ??
      'https://api.kamino.finance',
    vaultsPath: '/kvaults/vaults',
    usdcVault:
      import.meta?.env?.VITE_KAMINO_USDC_VAULT ?? process.env.VITE_KAMINO_USDC_VAULT ?? '',
  },

  // ── Explicitly out of scope this phase ─────────────────────────
  outOfScope: ['zero-spend', 'ngn-rail', 'naira-offramp'],
};
