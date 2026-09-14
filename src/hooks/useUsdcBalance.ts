import { useEffect, useState } from 'react';
import { CHAINS } from '../config/chains';
import { CLUSTER_CONFIG } from '../config/cluster';
import type { ChainId } from '../types';
import type { ConnectedWallet } from './useWallet';

const USDC_MINT_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const EVM_CHAIN_IDS: Record<string, ChainId> = {
  '0x1': 'ethereum',
  '0x2105': 'base',
  '0xa4b1': 'arbitrum',
  '0x89': 'polygon',
  '0x531': 'sei',
  '0x92': 'sonic',
  '0x82': 'unichain',
  '0x1e0': 'worldchain',
};

/** Which of our chains the EVM wallet is actually sitting on (eth_call runs there). */
export async function getActiveEvmChain(provider: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}): Promise<ChainId | null> {
  try {
    const hex = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
    return EVM_CHAIN_IDS[hex] ?? null;
  } catch {
    return null;
  }
}

function formatUnits(raw: bigint, decimals = 6) {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0').slice(0, 2);
  return `${whole.toLocaleString('en-US')}.${frac}`;
}

/** Real USDC `balanceOf` via the connected EIP-1193 provider — no library needed. */
export async function readEvmUsdc(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  usdc: string,
  owner: string,
): Promise<string> {
  const data = `0x70a08231${owner.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
  const res = (await provider.request({
    method: 'eth_call',
    params: [{ to: usdc, data }, 'latest'],
  })) as string;
  return formatUnits(BigInt(res));
}

/** Real USDC balance on Solana via plain JSON-RPC — no library needed. */
export async function readSolanaUsdc(owner: string): Promise<string> {
  const res = await fetch(CLUSTER_CONFIG.solanaRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [owner, { mint: USDC_MINT_SOLANA }, { encoding: 'jsonParsed' }],
    }),
  });
  if (!res.ok) throw new Error(`solana rpc ${res.status}`);
  const json = (await res.json()) as {
    result?: { value?: { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } } } }[] };
  };
  const accounts = json.result?.value ?? [];
  const total = accounts.reduce(
    (sum, a) => sum + (a.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0),
    0,
  );
  return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface BalanceState {
  /** Formatted balance, or null when unknown (disconnected / wrong chain kind). */
  balance: string | null;
  /** True when read live from chain; false for demo/unknown. */
  live: boolean;
  loading: boolean;
}

/**
 * Honest balances: null until a real wallet of the matching chain kind is
 * connected (then read live on-chain). Demo wallets show 0.00 tagged demo.
 * Never invents holdings.
 */
export function useUsdcBalance(chain: ChainId, wallet: ConnectedWallet | null): BalanceState {
  const [balance, setBalance] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setBalance(null);
      setLive(false);
      setLoading(false);
      return;
    }
    if (wallet.demo) {
      setBalance('0.00');
      setLive(false);
      setLoading(false);
      return;
    }
    const kind = CHAINS[chain].kind;
    if (wallet.chain !== kind || !wallet.provider) {
      // E.g. EVM wallet connected but viewing Solana — can't read, show unknown.
      setBalance(null);
      setLive(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const provider = wallet.provider as {
          request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
        // eth_call executes on the wallet's active network — only that
        // chain's reading is trustworthy; anything else would be wrong data.
        if (kind === 'evm' && (await getActiveEvmChain(provider)) !== chain) {
          if (!cancelled) setLoading(false);
          return;
        }
        const value =
          kind === 'solana'
            ? await readSolanaUsdc(wallet.address)
            : await readEvmUsdc(provider, CHAINS[chain].usdcMintOrAddress, wallet.address);
        if (!cancelled) {
          setBalance(value);
          setLive(true);
        }
      } catch {
        if (!cancelled) {
          setBalance(null);
          setLive(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, wallet]);

  return { balance, live, loading };
}
