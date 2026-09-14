import { useEffect, useState } from 'react';
import type { SolanaStock } from '../../types';

interface JupToken {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  usdPrice?: number;
  mcap?: number;
  fdv?: number;
  circSupply?: number;
  totalSupply?: number;
  holderCount?: number;
  liquidity?: number;
  organicScore?: number;
  isVerified?: boolean;
  tags?: string[];
  stats24h?: {
    priceChange?: number;
    buyVolume?: number;
    sellVolume?: number;
  };
  firstPool?: { createdAt: string };
}

function fmt$(n?: number) {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-bg p-3 border border-border/50">
      <p className="text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-white leading-tight">{value}</p>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

export default function TokenPanel({
  stock,
  onClose,
}: {
  stock: SolanaStock;
  onClose: () => void;
}) {
  const [token, setToken] = useState<JupToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setToken(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    fetch(`https://api.jup.ag/tokens/v2/search?query=${stock.solanaMint}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((json: JupToken[]) => {
        if (!active) return;
        setToken(json.length > 0 ? json[0] : null);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [stock.solanaMint]);

  const priceChange = token?.stats24h?.priceChange ?? 0;
  const isPositive = priceChange >= 0;
  const vol24h = (token?.stats24h?.buyVolume ?? 0) + (token?.stats24h?.sellVolume ?? 0);
  const hasPool = (token?.liquidity ?? 0) > 0;

  // Price display — prefer Jupiter usdPrice, fallback to showing — cleanly
  const priceStr = token?.usdPrice
    ? `$${token.usdPrice < 0.01 ? token.usdPrice.toExponential(3) : token.usdPrice.toFixed(2)}`
    : '—';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
            {(token?.icon ?? stock.logo) ? (
              <img
                src={token?.icon ?? stock.logo ?? ''}
                alt={stock.symbol}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="text-[11px] font-bold text-white">{stock.underlyingSymbol.slice(0, 2)}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{stock.underlyingSymbol}</h3>
            <p className="text-[10px] text-text-muted truncate">{token?.name ?? stock.name}</p>
          </div>
          {token?.isVerified && (
            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">✓ Verified</span>
          )}
        </div>
        <button onClick={onClose} className="shrink-0 ml-2 text-text-muted hover:text-white transition p-1 text-lg leading-none">✕</button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl bg-bg p-3 border border-border/50 h-[62px] animate-pulse" />
            ))}
            <div className="col-span-2 rounded-xl bg-bg border border-border/50 h-52 animate-pulse" />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted text-sm text-center p-4">
            <svg className="w-8 h-8 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-white">Failed to load</p>
            <p className="text-xs mt-1">Jupiter API timed out. Try again shortly.</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="Price (USD)"
                value={priceStr}
                sub={
                  token?.stats24h?.priceChange !== undefined ? (
                    <span className={`text-[10px] font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{(priceChange * 100).toFixed(2)}% 24h
                    </span>
                  ) : null
                }
              />
              <StatCard label="Market Cap" value={fmt$(token?.mcap)} />
              <StatCard label="FDV" value={fmt$(token?.fdv)} />
              <StatCard label="24h Volume" value={vol24h > 0 ? fmt$(vol24h) : '—'} />
            </div>

            {/* Extra info */}
            {(token?.holderCount || token?.liquidity) ? (
              <div className="grid grid-cols-2 gap-2">
                {token.holderCount ? (
                  <StatCard label="Holders" value={token.holderCount.toLocaleString()} />
                ) : null}
                {token.liquidity ? (
                  <StatCard label="Liquidity" value={fmt$(token.liquidity)} />
                ) : null}
              </div>
            ) : null}

            {/* Tags */}
            {token?.tags && token.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {token.tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="rounded-full bg-card-hover border border-border px-2 py-0.5 text-[10px] text-text-muted capitalize">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Chart */}
            {hasPool ? (
              <div className="rounded-xl border border-border overflow-hidden bg-bg" style={{ height: 220 }}>
                <iframe
                  src={`https://birdeye.so/tv-widget/${stock.solanaMint}?chain=solana&viewMode=pro&chartInterval=1D&chartType=CANDLE&theme=dark`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none', display: 'block' }}
                  title="Birdeye Chart"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-bg flex flex-col items-center justify-center text-center p-5 text-text-muted" style={{ height: 140 }}>
                <svg className="w-7 h-7 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p className="text-xs font-semibold text-white">No On-Chain Liquidity Yet</p>
                <p className="text-[10px] mt-1">Chart available once this xStock has active DEX pools.</p>
              </div>
            )}

            {/* Mint address */}
            <button
              onClick={() => navigator.clipboard.writeText(stock.solanaMint)}
              className="w-full flex items-center justify-between rounded-xl bg-bg border border-border/50 px-3 py-2 text-[10px] font-mono text-text-muted hover:text-white transition group"
            >
              <span className="truncate">{stock.solanaMint}</span>
              <svg className="w-3.5 h-3.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
