/**
 * cctpScanner.ts
 * Finds pending (burned-but-not-minted) CCTP transfers for a wallet and
 * completes the mint step using @circle-fin/provider-cctp-v2 directly.
 */

import { Solana, Base, Ethereum, Arbitrum, Polygon } from '@circle-fin/bridge-kit';

// ── Constants ──────────────────────────────────────────────────────────────────

/** CCTP Token Messenger program on Solana */
const SOLANA_TOKEN_MESSENGER_PROGRAM = 'CCTPiPYhUNkSMPaps4SEQ3M4QT6TTSQWuoT4yH6aAzpa';

/** Map CCTP domain IDs → our chain IDs */
export const DOMAIN_TO_CHAIN: Record<number, string> = {
  0: 'ethereum',
  3: 'arbitrum',
  5: 'solana',
  6: 'base',
  7: 'polygon',
};

export const CHAIN_TO_DOMAIN: Record<string, number> = {
  ethereum: 0,
  arbitrum: 3,
  solana: 5,
  base: 6,
  polygon: 7,
};

const CHAIN_TO_BRIDGE_KIT: Record<string, unknown> = {
  solana: Solana,
  ethereum: Ethereum,
  base: Base,
  arbitrum: Arbitrum,
  polygon: Polygon,
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PendingBridge {
  burnTxHash: string;
  sourceChain: string;
  destChain: string;
  destDomain: number;
  amountUsdc: string;   // human-readable, e.g. "10.50"
  status: 'waiting_attestation' | 'ready_to_mint';
}

// ── Helius Solana scan ─────────────────────────────────────────────────────────

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};
const HELIUS_RPC = env.VITE_SOLANA_RPC_URL && env.VITE_HELIUS_API_KEY
  ? `${env.VITE_SOLANA_RPC_URL}?api-key=${env.VITE_HELIUS_API_KEY}`
  : (env.VITE_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com');

async function solanaRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

/** Returns recent transaction signatures for a Solana address */
async function getRecentSolanaSignatures(address: string, limit = 20): Promise<string[]> {
  try {
    const result = await solanaRpc('getSignaturesForAddress', [
      address,
      { limit, commitment: 'confirmed' },
    ]) as Array<{ signature: string; err: unknown }>;
    return result.filter(r => r.err === null).map(r => r.signature);
  } catch {
    return [];
  }
}

/** Checks if a transaction involves the CCTP TokenMessenger program */
async function isCctpBurnTx(signature: string): Promise<boolean> {
  try {
    const tx = await solanaRpc('getTransaction', [
      signature,
      { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
    ]) as { transaction?: { message?: { accountKeys?: string[] } } } | null;
    const accounts = tx?.transaction?.message?.accountKeys ?? [];
    return accounts.includes(SOLANA_TOKEN_MESSENGER_PROGRAM);
  } catch {
    return false;
  }
}

// ── Iris API ───────────────────────────────────────────────────────────────────

interface IrisMsg {
  message: string;
  attestation: string;
  eventNonce: number;
  sourceDomain: number;
  destinationDomain: number;
  amount: string;      // raw, 6 decimals
  status: 'pending_confirmation' | 'confirmed' | 'complete';
}

async function queryIris(sourceDomain: number, txHash: string): Promise<IrisMsg | null> {
  try {
    const res = await fetch(
      `https://iris-api.circle.com/v2/messages/${sourceDomain}?transactionHash=${txHash}`,
    );
    if (!res.ok) return null;
    const data = await res.json() as { messages?: IrisMsg[] };
    return data.messages?.[0] ?? null;
  } catch {
    return null;
  }
}

function formatUsdc(raw: string): string {
  try {
    const n = Number(raw) / 1_000_000;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  } catch {
    return raw;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Scan a Solana wallet for pending CCTP burns that have not yet been minted.
 * Checks the 20 most recent transactions.
 */
export async function scanSolanaPendingBridges(address: string): Promise<PendingBridge[]> {
  const signatures = await getRecentSolanaSignatures(address, 20);
  const pending: PendingBridge[] = [];

  await Promise.allSettled(
    signatures.map(async (sig) => {
      const isCctp = await isCctpBurnTx(sig);
      if (!isCctp) return;

      const msg = await queryIris(5 /* Solana domain */, sig);
      if (!msg) return;
      if (msg.status === 'complete') return;

      const destChain = DOMAIN_TO_CHAIN[msg.destinationDomain];
      if (!destChain) return;

      pending.push({
        burnTxHash: sig,
        sourceChain: 'solana',
        destChain,
        destDomain: msg.destinationDomain,
        amountUsdc: formatUsdc(msg.amount),
        status: msg.status === 'confirmed' ? 'ready_to_mint' : 'waiting_attestation',
      });
    }),
  );

  return pending;
}

/**
 * Look up a specific burn tx hash (Solana) directly on the Iris API.
 * Useful when the user provides a tx hash manually.
 */
export async function lookupSolanaBurnTx(txHash: string): Promise<PendingBridge | null> {
  const msg = await queryIris(5, txHash);
  if (!msg) return null;
  if (msg.status === 'complete') return null;

  const destChain = DOMAIN_TO_CHAIN[msg.destinationDomain];
  if (!destChain) return null;

  return {
    burnTxHash: txHash,
    sourceChain: 'solana',
    destChain,
    destDomain: msg.destinationDomain,
    amountUsdc: formatUsdc(msg.amount),
    status: msg.status === 'confirmed' ? 'ready_to_mint' : 'waiting_attestation',
  };
}

// ── Mint execution ─────────────────────────────────────────────────────────────

async function buildSolanaAdapter(walletProvider?: unknown) {
  const { createSolanaKitAdapterFromProvider } = await import(
    /* @vite-ignore */ '@circle-fin/adapter-solana-kit/next'
  );
  const rawProvider = walletProvider ?? (window as unknown as { solana?: unknown }).solana;
  if (!rawProvider) throw new Error('Phantom wallet not found. Please install Phantom.');

  const p = rawProvider as {
    publicKey?: { toString(): string };
    connect(): Promise<{ publicKey: { toString(): string } }>;
    disconnect?(): Promise<void>;
    signTransaction?(tx: unknown): Promise<unknown>;
    signAllTransactions?(txs: unknown[]): Promise<unknown[]>;
    isConnected?: boolean;
  };

  if (!p.publicKey) await p.connect();
  if (!p.publicKey) throw new Error('Phantom did not provide a public key. Please unlock your wallet.');

  const address = p.publicKey.toString();

  const wrappedProvider = {
    ...p,
    publicKey: p.publicKey,
    address,
    isConnected: true,
    connect: async () => ({ address, publicKey: p.publicKey }),
    disconnect: p.disconnect?.bind(p) ?? (async () => { }),
    signTransaction: p.signTransaction?.bind(p),
    signAllTransactions: p.signAllTransactions?.bind(p),
  };

  return createSolanaKitAdapterFromProvider({ provider: wrappedProvider as any });
}

async function buildEvmAdapter() {
  const { createViemAdapterFromProvider } = await import(
    /* @vite-ignore */ '@circle-fin/adapter-viem-v2'
  );
  const provider = (window as unknown as { phantom?: { ethereum?: unknown }; ethereum?: unknown }).phantom?.ethereum
    ?? (window as unknown as { ethereum?: unknown }).ethereum;
  if (!provider) throw new Error('No EVM wallet (MetaMask/Phantom) found.');
  await (provider as { request(a: unknown): Promise<unknown> }).request({ method: 'eth_requestAccounts' }).catch(() => { });
  // Cast to any — the raw window.ethereum object satisfies EIP-1193 at runtime
  // but TypeScript cannot verify the full interface shape from `unknown`.
  return createViemAdapterFromProvider({ provider: provider as any });
}

export type MintEvent = { status: 'fetching_attestation' | 'minting' | 'success' | 'error'; message: string };

/**
 * Complete an already-burned CCTP transfer by fetching the attestation
 * and calling receiveMessage on the destination chain.
 */
export async function completePendingBridge(
  pending: PendingBridge,
  onEvent: (e: MintEvent) => void,
  solanaProvider?: unknown,
): Promise<void> {
  // Patch Solana RPC
  (Solana as unknown as { rpcEndpoints: string[] }).rpcEndpoints = [HELIUS_RPC];
  (Base as unknown as { rpcEndpoints: string[] }).rpcEndpoints = ['https://base.llamarpc.com'];

  onEvent({ status: 'fetching_attestation', message: 'Fetching attestation from Circle…' });

  const { CCTPV2BridgingProvider } = await import(
    /* @vite-ignore */ '@circle-fin/provider-cctp-v2'
  ) as { CCTPV2BridgingProvider: new () => { fetchAttestation(src: unknown, hash: string): Promise<unknown>; mint(src: unknown, dst: unknown, att: unknown): Promise<unknown> } };

  const provider = new CCTPV2BridgingProvider();

  // Build adapters
  const [fromAdapter, toAdapter] = await Promise.all([
    buildSolanaAdapter(solanaProvider),
    buildEvmAdapter(),
  ]);

  const sourceChainObj = CHAIN_TO_BRIDGE_KIT[pending.sourceChain];
  const destChainObj = CHAIN_TO_BRIDGE_KIT[pending.destChain];

  if (!sourceChainObj || !destChainObj) {
    throw new Error(`Chain not supported: ${pending.sourceChain} → ${pending.destChain}`);
  }

  const sourceContext = { adapter: fromAdapter, chain: sourceChainObj };
  const destContext = { adapter: toAdapter, chain: destChainObj };

  // Use kit.retry with a partial BridgeResult reconstructed from the burn tx
  onEvent({ status: 'fetching_attestation', message: 'Fetching Circle attestation for burn…' });
  const attestation = await provider.fetchAttestation(sourceContext, pending.burnTxHash);

  onEvent({ status: 'minting', message: `Minting ${pending.amountUsdc} USDC on ${pending.destChain}…` });
  const mintReq = await provider.mint(sourceContext, destContext, attestation) as { type?: string; execute?(): Promise<string> };

  if (mintReq.type !== 'noop' && mintReq.execute) {
    await mintReq.execute();
  }

  onEvent({ status: 'success', message: `✓ ${pending.amountUsdc} USDC minted on ${pending.destChain}!` });
}
