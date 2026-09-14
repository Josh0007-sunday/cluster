import { useEffect, useState } from 'react';
import { fetchKaminoVaults } from '../../lib/kamino';
import type { KaminoVault } from '../../types';

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-card-hover animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 rounded bg-card-hover animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-card-hover animate-pulse opacity-60" />
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="h-3 w-16 rounded bg-card-hover animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="h-3 w-12 rounded bg-card-hover animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="flex gap-2">
          <div className="h-8 w-16 rounded-lg bg-card-hover animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-card-hover animate-pulse opacity-60" />
        </div>
      </td>
    </tr>
  );
}

export default function EarnCard() {
  const [vaults, setVaults] = useState<KaminoVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    fetchKaminoVaults()
      .then((v) => setVaults(v))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg">
        <span className="text-sm font-semibold text-white">Vaults</span>
        <span className="rounded-lg bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Kamino</span>
      </div>


      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Vault</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Deposits</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">APY</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Action</th>
          </tr>
        </thead>
        <tbody>
            {loading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}
            {!loading && vaults.map((v, i) => (
            <tr
              key={v.address}
              onClick={() => setSelected(i)}
              className={`cursor-pointer border-b border-border last:border-0 transition hover:bg-card-hover ${
                i === selected ? 'bg-accent/5' : ''
              }`}
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-base font-bold text-accent">$</div>
                  <div>
                    <p className="font-medium text-white">{v.name}</p>
                    <p className="font-mono text-xs text-text-dim">{v.address.slice(0, 16)}...</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="text-sm font-medium text-text-muted">
                  ${v.tvl != null ? v.tvl.toLocaleString() : '\u2014'}
                </span>
              </td>
              <td className="px-5 py-4 font-semibold text-green-400">
                {v.apy != null ? `${v.apy.toFixed(2)}%` : '\u2014'}
              </td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-bg transition hover:bg-white/90">
                    Deposit
                  </button>
                  <button className="rounded-lg bg-card-hover px-4 py-2 text-sm font-medium text-text-muted transition hover:text-white">
                    Withdraw
                  </button>
                </div>
              </td>
            </tr>
          ))}
            {!loading && vaults.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-text-muted">
                  No vaults found
                </td>
              </tr>
            )}
        </tbody>
      </table>
      </div>
    </section>
  );
}