// Reown AppKit — single wallet-connect entry point (Solana + EVM).
// Supports: injected / WalletConnect / MetaMask / Coinbase / Rabby / Bitget (EVM)
// + Phantom / Solflare / Backpack (Solana).
//
// NOTE: real SDKs are declared in package.json. This module loads them via
// safeImport (runtime-only, invisible to Vite/tsc), so `npm run dev` and
// `npm run build` work even before `npm install` finishes. Once installed,
// the real modal is used. Until then, WalletButton runs in demo mode.

import { CLUSTER_CONFIG } from './cluster';
import { safeImport } from '../lib/safeImport';

let modalInit: Promise<unknown> | null = null;
let useAppKitHook: (() => { open: () => void }) | null = null;
let useAccountHook: (() => { address?: string; isConnected: boolean }) | null = null;

async function loadAppKit() {
  if (modalInit) return modalInit;
  modalInit = (async () => {
    const [reactKit, solanaKit, wagmiKit, networksMod] = await Promise.all([
      safeImport<{ createAppKit: (...args: never[]) => void; useAppKit: typeof useAppKitHook }>(
        '@reown/appkit/react',
      ),
      safeImport<{ SolanaAdapter: new () => unknown }>('@reown/appkit-adapter-solana/react'),
      safeImport<{ WagmiAdapter: new (opts: Record<string, unknown>) => { wagmiConfig: unknown } }>(
        '@reown/appkit-adapter-wagmi',
      ),
      safeImport<Record<string, unknown>>('@reown/appkit/networks'),
    ]);

    if (!reactKit || !solanaKit || !wagmiKit || !networksMod) {
      console.warn('[cluster] Reown AppKit not installed yet — run `npm install`. Demo mode.');
      return;
    }

    try {
      const { solana, mainnet, base, arbitrum } = networksMod as {
        solana: unknown;
        mainnet: unknown;
        base: unknown;
        arbitrum: unknown;
      };

      const solanaAdapter = new solanaKit.SolanaAdapter();
      const wagmiAdapter = new wagmiKit.WagmiAdapter({
        ssr: false,
        projectId: CLUSTER_CONFIG.reownProjectId,
        networks: [mainnet, base, arbitrum],
      });

      reactKit.createAppKit({
        adapters: [solanaAdapter, wagmiAdapter],
        networks: [solana, mainnet, base, arbitrum],
        projectId: CLUSTER_CONFIG.reownProjectId,
        metadata: {
          name: CLUSTER_CONFIG.appName,
          description: 'Cluster — stablecoin wallet: bridge, swap, earn',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://cluster.finance',
          icons: [],
        },
        features: { analytics: false },
      } as never);

      useAppKitHook = reactKit.useAppKit as typeof useAppKitHook;
      const wagmi = await safeImport<{ useAccount: typeof useAccountHook }>('wagmi');
      useAccountHook = wagmi?.useAccount ?? null;
    } catch (err) {
      console.warn('[cluster] AppKit init failed, staying in demo mode.', err);
    }
  })();
  return modalInit;
}

// Fire-and-forget pre-init on module load (browser only).
if (typeof window !== 'undefined') void loadAppKit();

export async function openConnectModal() {
  await loadAppKit();
  // Real modal (when live) and demo fallback both listen for this event.
  window.dispatchEvent(new CustomEvent('cluster:open-appkit'));
}

export function getAppKitHooks() {
  return { useAppKitHook, useAccountHook, ready: modalInit };
}

export { loadAppKit };
