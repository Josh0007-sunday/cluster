import { useState } from 'react';
import { executeStableFxTrade, requestStableFxQuote } from '../../lib/stablefx';
import type { StableFxQuote } from '../../types';
import SelectModal from '../select/SelectModal';
import { RowIcon } from '../select/TokenIcon';
import type { ModalRow } from '../select/TokenIcon';
import toast from 'react-hot-toast';

const STABLES = [
  { symbol: 'USDC' },
  { symbol: 'EURC' },
  { symbol: 'USDT' },
];

function TokenButton({ symbol, onClick }: { symbol: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-left transition hover:border-text-dim"
    >
      <RowIcon row={{ id: symbol, title: symbol, subtitle: 'Stablecoin' }} />
      <span className="text-base font-semibold text-white">{symbol}</span>
    </button>
  );
}

export default function SwapCard() {
  const [pay, setPay] = useState('USDC');
  const [recv, setRecv] = useState('EURC');
  const [modalFor, setModalFor] = useState<'pay' | 'recv' | null>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<StableFxQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const amt = Number(amount);

  const pick = (symbol: string) => {
    if (modalFor === 'pay') {
      setPay(symbol);
      if (symbol === recv) setRecv(pay);
    } else {
      setRecv(symbol);
      if (symbol === pay) setPay(recv);
    }
    setQuote(null);
  };

  const flip = () => {
    setPay(recv);
    setRecv(pay);
    setQuote(null);
  };

  const getQuote = async () => {
    if (!(amt > 0) || busy) return;
    setBusy(true);
    try {
      setQuote(await requestStableFxQuote({ from: pay, to: recv, amount }));
    } catch (e) {
      toast.error(`Quote failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (!quote || busy) return;
    setBusy(true);
    try {
      const t = await executeStableFxTrade(quote.quoteId);
      toast.success(`Trade ${t.tradeId} \u2192 ${t.status}`);
      setQuote(null);
    } catch (e) {
      toast.error(`Trade failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const rows: ModalRow[] = STABLES.map((s) => ({
    id: s.symbol,
    title: s.symbol,
    subtitle: 'Stablecoin',
  }));

  return (
    <section className="max-w-lg mx-auto rounded-xl border border-border bg-card">
      <div className="p-5 pb-0">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-base font-semibold text-white">Swap</span>
          <span className="rounded-lg bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">StableFX</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="rounded-xl bg-bg p-5">
          <span className="mb-3 block text-sm font-medium text-text-muted">You pay</span>
          <div className="flex items-center gap-3">
            <TokenButton symbol={pay} onClick={() => setModalFor('pay')} />
            <input
              value={amount}
              onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); setQuote(null); }}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-transparent text-right text-3xl font-bold text-white outline-none placeholder:text-text-dim"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 py-3">
          <span className="h-px flex-1 bg-border" />
          <button onClick={flip} className="grid h-9 w-9 place-items-center rounded-lg bg-card-hover text-base font-bold text-text-muted transition hover:text-white">
            ↓↑
          </button>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="rounded-xl bg-bg p-5">
          <span className="mb-3 block text-sm font-medium text-text-muted">You receive (est.)</span>
          <div className="flex items-center gap-3">
            <TokenButton symbol={recv} onClick={() => setModalFor('recv')} />
            <p className="w-full truncate text-right text-3xl font-bold text-white">
              {quote ? quote.toAmount : amt > 0 ? '\u2014' : '0.00'}
            </p>
          </div>
          {quote ? (
            <div className="mt-3 flex justify-between text-sm font-medium text-text-muted">
              <span>Rate {quote.rate} · Fee {quote.fee} {quote.toCurrency}</span>
              <span>Expires {new Date(quote.expiresAt).toLocaleTimeString()}</span>
            </div>
          ) : (
            <p className="mt-2 text-right text-sm font-medium text-text-dim">Request a quote for an exact rate</p>
          )}
        </div>

        {!quote ? (
          <button
            onClick={getQuote}
            disabled={!(amt > 0) || busy}
            className="mt-5 w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-bg transition hover:bg-white/90 disabled:opacity-30"
          >
            {busy ? 'Quoting...' : `Get ${pay} \u2192 ${recv} quote`}
          </button>
        ) : (
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setQuote(null)}
              className="rounded-xl border border-border bg-bg px-5 py-3.5 text-sm font-medium text-text-muted hover:text-white"
            >
              ↻
            </button>
            <button
              onClick={execute}
              disabled={busy}
              className="flex-1 rounded-xl bg-white py-3.5 text-sm font-semibold text-bg transition hover:bg-white/90 disabled:opacity-30"
            >
              {busy ? 'Swapping...' : `Swap for ${quote.toAmount} ${quote.toCurrency}`}
            </button>
          </div>
        )}

      </div>

      <SelectModal
        open={modalFor !== null}
        onClose={() => setModalFor(null)}
        title={modalFor === 'pay' ? 'You pay' : 'You receive'}
        rows={rows}
        selectedId={modalFor === 'pay' ? pay : recv}
        onSelect={pick}
        showBalances={false}
      />
    </section>
  );
}
