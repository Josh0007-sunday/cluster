import { useEffect, useState, useCallback } from 'react';
import type { ConnectedWallet } from './useWallet';
import {
  scanSolanaPendingBridges,
  lookupSolanaBurnTx,
  type PendingBridge,
} from '../lib/cctpScanner';

// Stored burn tx hashes that were initiated from this app
const STORAGE_KEY = 'cluster_burn_txs';

function getStoredBurnTxs(): { txHash: string; chain: string }[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function storeBurnTx(txHash: string, chain: string) {
  const existing = getStoredBurnTxs();
  const updated = [{ txHash, chain }, ...existing.filter(t => t.txHash !== txHash)].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearBurnTx(txHash: string) {
  const existing = getStoredBurnTxs();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(t => t.txHash !== txHash)));
}

export interface UsePendingBridgesResult {
  pending: PendingBridge[];
  loading: boolean;
  refresh: () => void;
}

export function usePendingBridges(wallet: ConnectedWallet | null): UsePendingBridgesResult {
  const [pending, setPending] = useState<PendingBridge[]>([]);
  const [loading, setLoading] = useState(false);

  const scan = useCallback(async () => {
    if (!wallet) {
      setPending([]);
      return;
    }
    setLoading(true);
    try {
      const found: PendingBridge[] = [];

      if (wallet.chain === 'solana' || wallet.solanaAddress) {
        const address = wallet.solanaAddress ?? wallet.address;

        // 1. Scan on-chain recent txs for CCTP burns
        const onChain = await scanSolanaPendingBridges(address);
        found.push(...onChain);

        // 2. Also check any tx hashes stored from previous app sessions
        const stored = getStoredBurnTxs().filter(t => t.chain === 'solana');
        await Promise.allSettled(
          stored.map(async ({ txHash }) => {
            // Skip if already found on-chain
            if (found.some(f => f.burnTxHash === txHash)) return;
            const result = await lookupSolanaBurnTx(txHash);
            if (result) found.push(result);
          }),
        );
      }

      // Deduplicate by burnTxHash
      const unique = Array.from(new Map(found.map(p => [p.burnTxHash, p])).values());
      setPending(unique);
    } catch {
      // Silently fail - this is a background scan
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    scan();
  }, [scan]);

  return { pending, loading, refresh: scan };
}
