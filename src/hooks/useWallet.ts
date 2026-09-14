import { useSyncExternalStore } from 'react';

export interface ConnectedWallet {
  id: string;
  label: string;
  address: string;
  chain: 'evm' | 'solana';
  /** Raw provider (EIP-1193 / Solana wallet adapter) for reads + future signing. */
  provider?: any;
  /** Privy dual-chain support */
  evmAddress?: string;
  evmProvider?: any;
  solanaAddress?: string;
  solanaProvider?: any;
  /** Explicit demo connection — balances are illustrative, not on-chain. */
  demo?: boolean;
}

let current: ConnectedWallet | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setConnectedWallet(w: ConnectedWallet | null) {
  current = w;
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot() {
  return current;
}

export function useWallet() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Request the connect modal from anywhere (e.g. card action buttons). */
export function requestConnect() {
  window.dispatchEvent(new CustomEvent('cluster:connect-request'));
}

export function truncate(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}
