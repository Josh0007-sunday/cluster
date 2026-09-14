// Earn — Kamino Finance USDC yield (lending-pool vaults).
// REST-first integration (skip full SDK this phase).
// Docs: https://api.kamino.finance  ·  vaults: GET /kvaults/vaults
// Deposit model: user parks idle USDC → vault receipt (kUSDC-style) → balance grows via yield.

import { CLUSTER_CONFIG } from '../config/cluster';
import type { KaminoVault } from '../types';

const DEMO_VAULTS: KaminoVault[] = [
  { address: 'demo-steakhouse-usdc', name: 'Steakhouse USDC', tokenMint: 'USDC', apy: 7.44, tvl: 25_000_000 },
  { address: 'demo-gauntlet-usdc', name: 'Gauntlet USDC Frontier', tokenMint: 'USDC', apy: 6.12, tvl: 18_400_000 },
  { address: 'demo-sentora-pyusd', name: 'Sentora PYUSD', tokenMint: 'PYUSD', apy: 5.31, tvl: 9_800_000 },
];

export async function fetchKaminoVaults(): Promise<KaminoVault[]> {
  try {
    const res = await fetch(`${CLUSTER_CONFIG.kaminoApiBase}/kvaults/vaults`);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.vaults ?? data.data ?? [];
    if (!Array.isArray(list) || list.length === 0) return DEMO_VAULTS;
    return list.slice(0, 12).map((v: Record<string, unknown>, i: number) => {
      const state = (v.state ?? v) as Record<string, unknown>;
      return {
        address: String(v.address ?? state.address ?? `vault-${i}`),
        name: String(state.name ?? v.name ?? `Vault ${i + 1}`),
        tokenMint: String(state.tokenMint ?? 'USDC'),
        apy: typeof v.apy === 'number' ? v.apy : null,
        tvl: typeof v.tvl === 'number' ? v.tvl : null,
      } satisfies KaminoVault;
    });
  } catch {
    return DEMO_VAULTS; // offline / CORS → demo data keeps UI usable
  }
}

export async function fetchVaultMetrics(address: string): Promise<{ apy: number | null; tvl: number | null }> {
  try {
    const res = await fetch(`${CLUSTER_CONFIG.kaminoApiBase}/kvaults/vaults/${address}/metrics`);
    if (!res.ok) throw new Error(String(res.status));
    const m = await res.json();
    return { apy: Number(m.apy ?? m.supplyApy ?? null) || null, tvl: Number(m.tvl ?? null) || null };
  } catch {
    return { apy: null, tvl: null };
  }
}
