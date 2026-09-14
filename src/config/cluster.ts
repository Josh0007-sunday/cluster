import type { ChainId } from '../types';

export const THEME = {
  background: '#0f171a',
  card: '#1c2427',
  connectButton: '#ffffff',
  textPrimary: '#ffffff',
  textMuted: '#7a8a8f',
} as const;

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};

export const CLUSTER_CONFIG = {
  appName: env.VITE_APP_NAME ?? 'Cluster',
  appEnv: env.VITE_APP_ENV ?? 'development',
  reownProjectId: env.VITE_REOWN_PROJECT_ID ?? '',
  solanaRpcUrl: env.VITE_SOLANA_RPC_URL && env.VITE_HELIUS_API_KEY
    ? `${env.VITE_SOLANA_RPC_URL}?api-key=${env.VITE_HELIUS_API_KEY}`
    : (env.VITE_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'),
  circleApiKey: env.VITE_CIRCLE_API_KEY ?? '',
  stablefxBaseUrl:
    env.VITE_CIRCLE_STABLEFX_BASE_URL ?? 'https://api.circle.com/v1/exchange/stablefx',
  circleKitKey: env.VITE_CIRCLE_KIT_KEY ?? '',
  kaminoApiBase: env.VITE_KAMINO_API_BASE ?? 'https://api.kamino.finance',
  kaminoUsdcVault: env.VITE_KAMINO_USDC_VAULT ?? '',
  enabledChains: ((env.VITE_ENABLED_CHAINS ?? 'solana,ethereum,base,arbitrum,polygon,sei,sonic,unichain,worldchain').split(',') as ChainId[]),
} as const;

// Circle Paymaster (pay gas in USDC) is ETH / Arbitrum / Base only today.
// Solana is announced as future expansion → fall back to SOL gas for now.
export const PAYMASTER_ELIGIBLE: ChainId[] = ['ethereum', 'arbitrum', 'base'];

export const isPaymasterEligible = (chain: ChainId) => PAYMASTER_ELIGIBLE.includes(chain);
export const gasNoteFor = (chain: ChainId) =>
  isPaymasterEligible(chain)
    ? 'Paymaster eligible — can pay gas in USDC'
    : 'SOL-denominated gas (Paymaster not live on Solana yet)';
