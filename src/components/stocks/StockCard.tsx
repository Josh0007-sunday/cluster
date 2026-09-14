import { useEffect, useState } from 'react';
import { VersionedTransaction } from '@solana/web3.js';
import { fetchSolanaStocks, fetchStockPrice } from '../../lib/stocks';
import { getSiwsMessage, authenticateWithSiws, getOrCreateVault, craftDeposit, createDcaOrder, getJupiterQuote, getJupiterSwapTx } from '../../lib/jupiter';
import toast from 'react-hot-toast';
import type { SolanaStock } from '../../types';
import { useWallet, requestConnect } from '../../hooks/useWallet';
import TokenPanel from './TokenPanel';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const b64ToUint8 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const uint8ToB64 = (arr: Uint8Array) => btoa(String.fromCharCode(...arr));

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ── stock logo ────────────────────────────────────────────────────────────────

function StockLogo({ logo, ticker }: { logo: string | null; ticker: string }) {
  const [err, setErr] = useState(false);
  const hue = (ticker.charCodeAt(0) * 37 + ticker.charCodeAt(1 % ticker.length) * 13) % 360;

  if (!logo || err) {
    return (
      <div
        className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
        style={{ background: `hsl(${hue}, 55%, 38%)` }}
      >
        {ticker.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
      <img
        src={logo}
        alt={ticker}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
        onError={() => setErr(true)}
      />
    </div>
  );
}

// ── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-card-hover animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 w-20 rounded bg-card-hover animate-pulse" />
            <div className="h-2.5 w-28 rounded bg-card-hover animate-pulse opacity-60" />
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5"><div className="h-3 w-20 rounded bg-card-hover animate-pulse" /></td>
      <td className="px-5 py-3.5"><div className="h-3 w-14 rounded bg-card-hover animate-pulse" /></td>
      <td className="px-5 py-3.5"><div className="h-5 w-16 rounded-full bg-card-hover animate-pulse" /></td>
      <td className="px-5 py-3.5"><div className="h-3 w-12 rounded bg-card-hover animate-pulse" /></td>
    </tr>
  );
}


// ── price cell ────────────────────────────────────────────────────────────────

function PriceCell({ symbol }: { symbol: string }) {
  const [price, setPrice] = useState<number | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let active = true;
    fetchStockPrice(symbol)
      .then((p) => { if (active) setPrice(p.quote); })
      .catch(() => { if (active) setErr(true); });
    return () => { active = false; };
  }, [symbol]);

  if (err || price === undefined) return <span className="text-text-dim">—</span>;
  if (price === null) return <span className="text-text-dim text-xs animate-pulse">…</span>;
  return <span className="font-mono font-semibold text-white">{fmt(price)}</span>;
}

// ── basket panel ──────────────────────────────────────────────────────────────

function BasketPanel({
  basket,
  onRemove,
  onClear,
}: {
  basket: SolanaStock[];
  onRemove: (s: string) => void;
  onClear: () => void;
}) {
  const [amount, setAmount] = useState('100');
  const [mode, setMode] = useState<'dca' | 'swap'>('dca');
  const [freq, setFreq] = useState<'daily' | 'weekly'>('weekly');
  const [duration, setDuration] = useState(4);

  const totalAmount = Number(amount) || 0;
  const perStockTotal = basket.length > 0 ? totalAmount / basket.length : 0;
  const orderCount = duration;
  const perOrderPerStock = perStockTotal / (orderCount || 1);

  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCreate = async () => {
    if (!wallet) {
      requestConnect();
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      if (wallet.demo) throw new Error('Demo mode cannot sign transactions.');
      if (!wallet.provider) throw new Error('Connected wallet does not support signing.');

      const perStockAmountMicro = Math.floor((totalAmount / basket.length) * 1_000_000).toString();

      if (mode === 'swap') {
        // ── Instant Swap (Jupiter) ──
        for (const stock of basket) {
          const quote = await getJupiterQuote(USDC_MINT, stock.solanaMint, perStockAmountMicro);
          const b64Tx = await getJupiterSwapTx(quote, wallet.address);
          const txBytes = b64ToUint8(b64Tx);
          const vTx = VersionedTransaction.deserialize(txBytes);

          if (!wallet.provider.signTransaction) throw new Error('Wallet does not support transaction signing.');
          const signedTx = await wallet.provider.signTransaction(vTx);
          
          // Send transaction directly via RPC
          const conn = new (await import('@solana/web3.js')).Connection('https://mainnet.helius-rpc.com/?api-key=' + (import.meta.env.VITE_HELIUS_API_KEY || ''));
          const txid = await conn.sendRawTransaction(signedTx.serialize());
          await conn.confirmTransaction(txid, 'confirmed');
        }
        toast.success('Swap completed successfully!');
      } else {
        // ── DCA (Jupiter Trigger) ──
        const challenge = await getSiwsMessage(wallet.address);
        const challengeBytes = new TextEncoder().encode(challenge);

        if (!wallet.provider.signMessage) throw new Error('Wallet does not support message signing.');
        const signedBytes: Uint8Array = await wallet.provider.signMessage(challengeBytes);

        const jwt = await authenticateWithSiws({
          walletAddress: wallet.address,
          challenge,
          signedMessage: signedBytes,
        });

        await getOrCreateVault(jwt);

        const intervalSeconds = freq === 'daily' ? 86400 : 604800;

        for (const stock of basket) {
          const deposit = await craftDeposit({
            jwt,
            inputMint: USDC_MINT,
            outputMint: stock.solanaMint,
            userAddress: wallet.address,
            amount: perStockAmountMicro,
          });

          const txBytes = b64ToUint8(deposit.transaction);
          const vTx = VersionedTransaction.deserialize(txBytes);

          if (!wallet.provider.signTransaction) throw new Error('Wallet does not support transaction signing.');
          const signedTx = await wallet.provider.signTransaction(vTx);
          const signedBase64 = uint8ToB64(signedTx.serialize());

          await createDcaOrder({
            jwt,
            depositRequestId: deposit.requestId,
            depositSignedTx: signedBase64,
            userPubkey: wallet.address,
            inputMint: USDC_MINT,
            outputMint: stock.solanaMint,
            inputAmount: perStockAmountMicro,
            orderCount,
            intervalSeconds,
          });
        }
        toast.success('DCA Basket successfully created!');
      }
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        onClear();
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error(err);
      const e = err as Error;
      if (e.message?.toLowerCase().includes('reject') || e.message?.toLowerCase().includes('cancel')) {
        toast.error('Transaction cancelled.');
      } else {
        const msg = e.message || 'Failed to create DCA order';
        // Parse ugly Jupiter API errors if they're JSON stringified inside the message
        let cleanMsg = msg;
        try {
          if (msg.includes('{')) {
            const jsonPart = msg.substring(msg.indexOf('{'));
            const parsed = JSON.parse(jsonPart);
            if (parsed.error) cleanMsg = parsed.error;
          }
        } catch {
        }
        toast.error(cleanMsg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-all">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg">
        <span className="text-sm font-semibold text-white">
          Basket
          {basket.length > 0 && (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg">
              {basket.length}
            </span>
          )}
        </span>
        {basket.length > 0 && !loading && !success && (
          <button onClick={onClear} className="text-xs text-text-muted hover:text-white transition">
            Clear all
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {basket.length === 0 ? (
          <p className="text-sm text-text-dim text-center py-4">
            Click stocks in the table to add them to your DCA basket.
          </p>
        ) : success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 animate-in fade-in zoom-in duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{mode === 'dca' ? 'Basket Created!' : 'Swap Successful!'}</p>
              <p className="text-xs text-text-muted mt-1">{mode === 'dca' ? 'Your DCA orders are active.' : 'Tokens have been deposited to your wallet.'}</p>
            </div>
          </div>
        ) : (
          <>
            {/* stock chips */}
            <div className="flex flex-wrap gap-2">
              {basket.map((s) => (
                <span
                  key={s.symbol}
                  className="flex items-center gap-1.5 rounded-lg bg-card-hover px-2.5 py-1 text-xs font-medium text-white"
                >
                  <span className="font-bold text-accent">{s.underlyingSymbol}</span>
                  <button
                    onClick={() => onRemove(s.symbol)}
                    className="text-text-muted hover:text-white leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* config */}
            <div className="space-y-3">
              <div className="flex gap-1.5 bg-bg p-1 rounded-xl border border-border/50">
                {(['dca', 'swap'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    disabled={loading}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition capitalize disabled:opacity-50 ${
                      mode === m
                        ? 'bg-accent/20 text-accent'
                        : 'text-text-muted hover:text-white'
                    }`}
                  >
                    {m === 'dca' ? 'DCA (Recurring)' : 'Swap Now'}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Total USDC to invest
                </label>
                <div className="flex items-center gap-2 rounded-xl bg-bg px-4 py-2.5">
                  <span className="text-text-muted text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={loading}
                    className="flex-1 bg-transparent text-right text-xl font-bold text-white outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {mode === 'dca' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">Frequency</label>
                    <div className="flex gap-1.5">
                      {(['daily', 'weekly'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setFreq(f);
                            setDuration(f === 'daily' ? 30 : 4);
                          }}
                          disabled={loading}
                          className={`flex-1 rounded-lg py-2 text-xs font-medium transition capitalize disabled:opacity-50 ${
                            freq === f
                              ? 'bg-accent/20 text-accent border border-accent/40'
                              : 'bg-card-hover text-text-muted hover:text-white border border-transparent'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-muted">
                      Duration (Orders)
                    </label>
                    <div className="flex items-center gap-2 rounded-xl bg-bg px-3 py-1.5 border border-transparent focus-within:border-accent/40 transition-colors">
                      <input
                        type="number"
                        min="1"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                        disabled={loading}
                        className="flex-1 w-full bg-transparent text-right text-base font-bold text-white outline-none disabled:opacity-50"
                      />
                      <span className="text-text-muted text-xs shrink-0">{freq === 'daily' ? 'days' : 'weeks'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* summary */}
              <div className="rounded-xl bg-bg p-3 space-y-2 text-xs font-medium text-text-muted border border-border/50">
                <div className="flex justify-between">
                  <span>Stocks selected</span>
                  <span className="text-white">{basket.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total per stock</span>
                  <span className="text-white">${perStockTotal.toFixed(2)}</span>
                </div>
                {mode === 'dca' && (
                  <div className="flex justify-between">
                    <span>Buy per period</span>
                    <span className="text-white font-bold text-accent">${perOrderPerStock.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-border pt-2 mt-1">
                  <span>Total Investment</span>
                  <span className="text-white font-bold">${totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full flex items-center justify-center rounded-xl bg-accent py-3.5 text-sm font-bold text-bg transition hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-accent/20"
              >
                {loading ? (
                  <svg className="h-5 w-5 animate-spin text-bg" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  wallet ? mode === 'dca' ? 'Create DCA Basket' : 'Swap Now' : 'Connect Wallet'
                )}
              </button>
              <p className="text-center text-[11px] text-text-dim">
                Powered by Jupiter Trigger · Solana
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function StockCard() {
  const [stocks, setStocks] = useState<SolanaStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [basket, setBasket] = useState<SolanaStock[]>([]);
  const [activeStock, setActiveStock] = useState<SolanaStock | null>(null);

  useEffect(() => {
    fetchSolanaStocks()
      .then(setStocks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = stocks.filter(
    (s) =>
      s.underlyingSymbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.symbol.toLowerCase().includes(query.toLowerCase()),
  );

  const toggleBasket = (stock: SolanaStock) => {
    setBasket((prev) =>
      prev.find((s) => s.symbol === stock.symbol)
        ? prev.filter((s) => s.symbol !== stock.symbol)
        : [...prev, stock],
    );
  };

  const inBasket = (symbol: string) => basket.some((s) => s.symbol === symbol);

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* ── table column ── */}
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-card overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border bg-bg">
          <span className="text-sm font-semibold text-white shrink-0">xStocks · Solana</span>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 max-w-xs w-full">
            <svg className="h-3.5 w-3.5 shrink-0 text-text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stocks…"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-text-dim"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-text-muted hover:text-white text-xs">
                ✕
              </button>
            )}
          </div>
          <span className="text-xs text-text-muted shrink-0">
            {loading ? '…' : `${filtered.length} stocks`}
          </span>
        </div>

        {/* error state */}
        {error && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-red-400 mb-1">Could not reach stockserver</p>
            <p className="text-xs text-text-dim">{error}</p>
          </div>
        )}

        {/* table */}
        {!error && (
          <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-card">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Stock</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Mint</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Price (USDC)</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Basket</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <>
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
                  </>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-text-muted">
                      {query ? `No stocks matching "${query}"` : 'No stocks available'}
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((s) => {
                    const added = inBasket(s.symbol);
                    return (
                      <tr
                        key={s.symbol}
                        onClick={() => setActiveStock(s)}
                        className={`border-b border-border last:border-0 transition hover:bg-card-hover cursor-pointer ${
                          activeStock?.symbol === s.symbol ? 'bg-card-hover/80' : added ? 'bg-accent/5' : ''
                        }`}
                      >
                        {/* stock name */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <StockLogo logo={s.logo} ticker={s.underlyingSymbol} />
                            <div>
                              <p className="font-semibold text-white text-sm">{s.underlyingSymbol}</p>
                              <p className="text-text-muted text-[11px] truncate max-w-[160px]">{s.name}</p>
                            </div>
                          </div>
                        </td>

                        {/* mint address */}
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => navigator.clipboard.writeText(s.solanaMint)}
                            className="group flex items-center gap-1.5 rounded bg-bg px-2 py-1 text-[11px] font-mono text-text-muted hover:text-white transition"
                            title="Copy mint address"
                          >
                            {s.solanaMint.slice(0, 4)}…{s.solanaMint.slice(-4)}
                            <svg className="h-3 w-3 opacity-0 transition group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          </button>
                        </td>

                        {/* price */}
                        <td className="px-5 py-3.5 text-sm">
                          <PriceCell symbol={s.symbol} />
                        </td>

                        {/* status */}
                        <td className="px-5 py-3.5">
                          {s.isTradingHalted ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              Halted
                            </span>
                          ) : s.openNow ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-semibold text-green-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Closed
                            </span>
                          )}
                        </td>

                        {/* basket toggle */}
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleBasket(s)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              added
                                ? 'bg-accent/20 text-accent border border-accent/40 hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/40'
                                : 'bg-card-hover text-text-muted hover:text-white border border-border'
                            }`}
                          >
                            {added ? '✓ Added' : '+ Add'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── side panel (Basket or Token) ── */}
      <div className="w-full lg:w-80 shrink-0">
        {activeStock ? (
          <TokenPanel stock={activeStock} onClose={() => setActiveStock(null)} />
        ) : (
          <BasketPanel
            basket={basket}
            onRemove={(sym) => setBasket((p) => p.filter((s) => s.symbol !== sym))}
            onClear={() => setBasket([])}
          />
        )}
      </div>
    </div>
  );
}
