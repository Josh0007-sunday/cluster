export type ChainId =
  | 'solana'
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'polygon'
  | 'sei'
  | 'sonic'
  | 'unichain'
  | 'worldchain';

export interface ChainMeta {
  id: ChainId;
  label: string;
  kind: 'solana' | 'evm';
  nativeGas: string;
  paymasterEligible: boolean;
  usdcMintOrAddress: string;
  /** Small badge color + letter shown over the USDC logo. */
  badgeColor: string;
  badgeLetter: string;
}

export interface BridgeParams {
  from: ChainId;
  to: ChainId;
  amount: string; // human-readable USDC, e.g. "25.00"
}

export type BridgeStatus =
  | 'idle'
  | 'approve'
  | 'burn'
  | 'attestation'
  | 'mint'
  | 'success'
  | 'error';

export interface StableFxQuote {
  quoteId: string;
  rate: number;
  fee: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  expiresAt: string;
}

export interface KaminoVault {
  address: string;
  name: string;
  tokenMint: string;
  apy: number | null;
  tvl: number | null;
  tokenAvailable?: number;
}

// ── xStocks / stockserver ─────────────────────────────────────────────────────
export interface SolanaStock {
  symbol: string;          // e.g. "AAPLx"
  underlyingSymbol: string; // e.g. "AAPL"
  name: string;            // e.g. "Apple xStock"
  logo: string | null;     // URL from backed.fi
  solanaMint: string;
  isTradingHalted: boolean;
  openNow: boolean;
}

export interface StockPrice {
  quote: number;
}

export interface XStockAsset {
  id: string;
  name: string;
  symbol: string;
  isin: string;
  underlyingSymbol: string;
  underlyingIsin: string;
  underlying: {
    symbol: string;
    isin: string;
    type: string | null;
    listingCountry: string | null;
  };
  description: string;
  logo: string;
  isTradingHalted: boolean;
  trading: {
    currency: string;
    tradingHoursMode: string;
    isTradingHalted: boolean;
    currentPeriod: string;
    openNow: boolean;
    nextChangeAt: string | null;
    exchange: {
      mic: string;
      abbreviation: string;
      name: string;
      timezone: string;
    } | null;
    limitsPerPeriod: Record<string, { minOrderFiatValue: number; maxOrderFiatValue: number }>;
  };
  deployments: {
    address: string;
    network: string;
    supportsAtomicSwaps: boolean;
    wrapperAddressV2?: string;
    stablecoins: {
      symbol: string;
      currency: string;
      network: string;
      address: string;
      decimals: number;
    }[];
  }[];
}

export interface ProofOfReserve {
  symbol: string;
  timestamp: string;
  sharesHeld: string;
  circulatingSupply: string;
  holdings: {
    provider: string;
    quantity: string;
    symbol: string;
  }[];
}
