import { BridgeKit, Solana, Ethereum, Base, Arbitrum, Polygon, Sei, Sonic, Unichain, WorldChain } from '@circle-fin/bridge-kit';
import type { BridgeParams, BridgeStatus } from '../types';
import type { ConnectedWallet } from '../hooks/useWallet';
import { CHAINS } from '../config/chains';
import { gasNoteFor } from '../config/cluster';

export type BridgeEvent = { status: BridgeStatus; message: string };


function patchRpcEndpoints() {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};
  const rpcUrl = env.VITE_SOLANA_RPC_URL && env.VITE_HELIUS_API_KEY
    ? `${env.VITE_SOLANA_RPC_URL}?api-key=${env.VITE_HELIUS_API_KEY}`
    : (env.VITE_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com');
  (Solana as any).rpcEndpoints = [rpcUrl];
  (Base as any).rpcEndpoints = ['https://base.llamarpc.com'];
}

const CHAIN_ID: Record<string, unknown> = {
  solana: Solana,
  ethereum: Ethereum,
  base: Base,
  arbitrum: Arbitrum,
  polygon: Polygon,
  sei: Sei,
  sonic: Sonic,
  unichain: Unichain,
  worldchain: WorldChain,
};

export function describeRoute(p: BridgeParams) {
  const from = CHAINS[p.from];
  const to = CHAINS[p.to];
  return {
    label: `${from.label} → ${to.label}`,
    gasFrom: gasNoteFor(p.from),
    gasTo: gasNoteFor(p.to),
  };
}

async function buildSolanaAdapter(walletProvider?: any) {
  const { createSolanaKitAdapterFromProvider } = await import(
    /* @vite-ignore */ '@circle-fin/adapter-solana-kit/next'
  );

  // Use the provider that the user already connected through the app.
  // Fall back to window.solana if not passed in.
  const rawProvider = walletProvider ?? (window as any).solana;
  if (!rawProvider) throw new Error('Phantom wallet not found. Please install Phantom.');

  // Ensure wallet is connected and publicKey is available before Circle adapter tries to init.
  // If already connected, connect() is a no-op on Phantom.
  if (!rawProvider.publicKey) {
    await rawProvider.connect();
  }

  if (!rawProvider.publicKey) {
    throw new Error('Phantom wallet did not provide a public key after connecting. Please unlock your wallet.');
  }

  const address = rawProvider.publicKey.toString();

  // Wrap the provider so the Circle adapter can rely on a stable .publicKey
  // and signTransaction interface, matching the Wallet Standard.
  const wrappedProvider = {
    ...rawProvider,
    publicKey: rawProvider.publicKey,
    address,
    isConnected: true,
    connect: async () => ({ address, publicKey: rawProvider.publicKey }),
    signTransaction: rawProvider.signTransaction?.bind(rawProvider),
    signAllTransactions: rawProvider.signAllTransactions?.bind(rawProvider),
  };

  return createSolanaKitAdapterFromProvider({
    provider: wrappedProvider,
  });
}

async function buildEvmAdapter() {
  const { createViemAdapterFromProvider } = await import(
    /* @vite-ignore */ '@circle-fin/adapter-viem-v2'
  );
  // Prioritize Phantom's built-in EVM wallet, fall back to standard MetaMask
  const provider = (window as any).phantom?.ethereum ?? (window as any).ethereum;
  if (!provider) throw new Error('No EVM wallet found. Please install Phantom or MetaMask.');
  // Request accounts to ensure the provider is active
  await provider.request({ method: 'eth_requestAccounts' }).catch(() => { });
  return createViemAdapterFromProvider({ provider });
}

/** Execute a live bridge transfer using Circle Bridge Kit (CCTPv2). */
export async function executeBridge(
  params: BridgeParams,
  onEvent: (e: BridgeEvent) => void,
  wallet?: ConnectedWallet | null,
): Promise<void> {
  const { label } = describeRoute(params);

  // Patch chain RPCs to use our proxy/reliable nodes before any SDK clients are created.
  patchRpcEndpoints();

  onEvent({ status: 'approve', message: `Preparing bridge: ${params.amount} USDC · ${label}` });

  const fromChain = CHAIN_ID[params.from];
  const toChain = CHAIN_ID[params.to];

  if (!fromChain || !toChain) {
    throw new Error(`Unsupported chain pair: ${params.from} → ${params.to}`);
  }

  onEvent({ status: 'approve', message: 'Building wallet adapters…' });

  // Use the already-connected wallet provider from our app state for the Solana side
  const solanaProvider = wallet?.chain === 'solana' ? wallet.provider : undefined;

  let fromAdapter: any;
  let toAdapter: any;

  try {
    const buildFrom = params.from === 'solana'
      ? buildSolanaAdapter(solanaProvider)
      : buildEvmAdapter();
    const buildTo = params.to === 'solana'
      ? buildSolanaAdapter(solanaProvider)
      : buildEvmAdapter();

    [fromAdapter, toAdapter] = await Promise.all([buildFrom, buildTo]);
  } catch (err) {
    throw new Error(`Wallet setup failed: ${(err as Error).message}`);
  }

  onEvent({ status: 'burn', message: `Sending USDC from ${CHAINS[params.from].label}…` });

  const kit = new BridgeKit();

  const result = await kit.bridge({
    from: { adapter: fromAdapter, chain: fromChain as any },
    to: { adapter: toAdapter, chain: toChain as any },
    amount: params.amount,
  });

  if (result.state === 'error') {
    if (result.steps?.[0]?.state === 'success') {
      localStorage.setItem('cluster_pending_bridge', JSON.stringify(result));
    }
    const failedStep = result.steps?.find((s: any) => s.state === 'error');
    throw new Error((failedStep?.error as any)?.message || 'Bridge operation failed or was cancelled');
  }


  localStorage.removeItem('cluster_pending_bridge');

  onEvent({
    status: 'success',
    message: `Bridged ${params.amount} USDC · ${label}`,
  });
}


export async function resumeBridge(
  onEvent: (e: BridgeEvent) => void,
  wallet?: ConnectedWallet | null
): Promise<void> {
  const pendingData = localStorage.getItem('cluster_pending_bridge');
  if (!pendingData) throw new Error('No pending bridge found');

  const result = JSON.parse(pendingData);

  onEvent({ status: 'approve', message: 'Resuming incomplete transfer…' });

  // Re-patch RPCs just in case
  patchRpcEndpoints();

  const solanaProvider = wallet?.chain === 'solana' ? wallet.provider : undefined;

  let fromAdapter: any;
  let toAdapter: any;

  // We need to rebuild the adapters based on the original chains
  try {
    const buildFrom = result.source.chain.type === 'solana'
      ? buildSolanaAdapter(solanaProvider)
      : buildEvmAdapter();
    const buildTo = result.destination.chain.type === 'solana'
      ? buildSolanaAdapter(solanaProvider)
      : buildEvmAdapter();

    [fromAdapter, toAdapter] = await Promise.all([buildFrom, buildTo]);
  } catch (err) {
    throw new Error(`Wallet setup failed: ${(err as Error).message}`);
  }

  onEvent({ status: 'burn', message: 'Polling for attestation and minting…' });

  const kit = new BridgeKit();

  const retryResult = await kit.retry(result, {
    from: fromAdapter,
    to: toAdapter
  });

  if (retryResult.state === 'error') {
    // Keep it in localStorage if it fails again
    const failedStep = retryResult.steps?.find((s: any) => s.state === 'error');
    throw new Error((failedStep?.error as any)?.message || 'Resume failed');
  }

  localStorage.removeItem('cluster_pending_bridge');

  onEvent({
    status: 'success',
    message: 'Bridge transfer completed successfully!',
  });
}
