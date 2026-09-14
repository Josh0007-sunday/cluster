import { useEffect, useState } from 'react';
import { CHAINS, CHAIN_LIST } from '../config/chains';
import type { ChainId } from '../types';
import { getActiveEvmChain, readEvmUsdc, readSolanaUsdc } from './useUsdcBalance';
import type { ConnectedWallet } from './useWallet';

export interface ChainBalance {
  balance: string | null;
  live: boolean;
  loading: boolean;
}

export type ChainBalanceMap = Record<ChainId, ChainBalance>;

const EMPTY: ChainBalance = { balance: null, live: false, loading: false };

function emptyMap(): ChainBalanceMap {
  return Object.fromEntries(CHAIN_LIST.map((c) => [c.id, { ...EMPTY }])) as ChainBalanceMap;
}

type EthCaller = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * USDC balance for every supported chain. Only the wallet's active network
 * is read live (eth_call runs there — other chains would return wrong data,
 * so they stay "—" until the user switches networks in their wallet).
 */
export function useAllUsdcBalances(wallet: ConnectedWallet | null): ChainBalanceMap {
  const [map, setMap] = useState<ChainBalanceMap>(emptyMap);

  useEffect(() => {
    if (!wallet || wallet.demo || !wallet.provider) {
      setMap(emptyMap());
      return;
    }
    let cancelled = false;
    setMap(
      Object.fromEntries(
        CHAIN_LIST.map((c) => [
          c.id,
          { ...EMPTY, loading: CHAINS[c.id].kind === wallet.chain },
        ]),
      ) as ChainBalanceMap,
    );
    (async () => {
      try {
        const promises = [];
        
        // Solana balances
        if (wallet.chain === 'solana' || wallet.solanaAddress) {
          const address = wallet.solanaAddress || wallet.address;
          promises.push(
            readSolanaUsdc(address).then((value) => {
              if (!cancelled) {
                setMap((m) => ({ ...m, solana: { balance: value, live: true, loading: false } }));
              }
            })
          );
        } else if (!cancelled) {
          setMap((m) => ({ ...m, solana: { ...EMPTY } }));
        }

        // EVM balances
        if (wallet.chain === 'evm' || wallet.evmAddress) {
          const address = wallet.evmAddress || wallet.address;
          const provider = wallet.provider as EthCaller;
          
          if (provider) {
            promises.push(
              getActiveEvmChain(provider).then(async (active) => {
                if (!cancelled) {
                  setMap((m) => {
                    const next = { ...m };
                    for (const c of CHAIN_LIST) {
                      if (c.kind === 'evm' && c.id !== active) next[c.id] = { ...EMPTY };
                    }
                    return next;
                  });
                }
                if (active) {
                  const value = await readEvmUsdc(provider, CHAINS[active].usdcMintOrAddress, address);
                  if (!cancelled) {
                    setMap((m) => ({ ...m, [active]: { balance: value, live: true, loading: false } }));
                  }
                }
              })
            );
          } else {
            // For Privy or wallets without direct provider injection, we could fetch from public RPC.
            // For now, clear EVM balances if no provider is passed (since readEvmUsdc needs one).
            if (!cancelled) {
              setMap((m) => {
                const next = { ...m };
                for (const c of CHAIN_LIST) {
                  if (c.kind === 'evm') next[c.id] = { ...EMPTY };
                }
                return next;
              });
            }
          }
        }

        await Promise.allSettled(promises);
      } catch {
        if (!cancelled) setMap(emptyMap());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  return map;
}
