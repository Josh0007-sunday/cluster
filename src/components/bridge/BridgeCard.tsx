import { useEffect, useState } from 'react';
import { CHAINS, CHAIN_LIST } from '../../config/chains';
import { isPaymasterEligible } from '../../config/cluster';
import { useAllUsdcBalances } from '../../hooks/useAllUsdcBalances';
import { requestConnect, useWallet } from '../../hooks/useWallet';
import { usePendingBridges } from '../../hooks/usePendingBridges';
import { describeRoute, executeBridge, resumeBridge } from '../../lib/bridge';
import type { BridgeStatus, ChainId } from '../../types';
import SelectModal from '../select/SelectModal';
import { RowIcon } from '../select/TokenIcon';
import type { ModalRow } from '../select/TokenIcon';
import PendingBridgeCard from './PendingBridgeCard';

function ChainButton({ chain, onClick }: { chain: ChainId; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-left transition hover:border-text-dim"
    >
      <RowIcon row={{ id: chain, title: 'USDC', subtitle: CHAINS[chain].label, chainId: chain }} />
    </button>
  );
}

const STEPS: BridgeStatus[] = ['approve', 'burn', 'attestation', 'mint', 'success'];

export default function BridgeCard() {
  const wallet = useWallet();
  const balances = useAllUsdcBalances(wallet);
  const [from, setFrom] = useState<ChainId>('base');
  const [to, setTo] = useState<ChainId>('solana');
  const [modalFor, setModalFor] = useState<'from' | 'to' | null>(null);
  const [amount, setAmount] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<BridgeStatus>('idle');
  const [hasPendingBridge, setHasPendingBridge] = useState(false);
  const [dismissedTxs, setDismissedTxs] = useState<Set<string>>(new Set());

  // Scan for pending CCTP bridges on wallet connect
  const { pending: pendingBridges, loading: scanLoading, refresh: rescan } = usePendingBridges(wallet);

  // Check for incomplete bridge on mount
  useEffect(() => {
    setHasPendingBridge(!!localStorage.getItem('cluster_pending_bridge'));
  }, []);

  const route = describeRoute({ from, to, amount: amount || '0' });
  const amt = Number(amount);

  const action = !wallet
    ? { label: 'Connect wallet', disabled: false, run: () => requestConnect() }
    : from === to
      ? { label: 'Select different chains', disabled: true, run: () => {} }
      : !(amt > 0)
        ? { label: 'Enter an amount', disabled: true, run: () => {} }
        : busy
          ? { label: `Bridging... ${status}`, disabled: true, run: () => {} }
          : { label: `Bridge ${amount} USDC`, disabled: false, run: () => void bridge() };

  const bridge = async () => {
    setBusy(true);
    setLog([]);
    setStatus('approve');
    try {
      await executeBridge({ from, to, amount }, (e) => {
        setStatus(e.status);
        setLog((l) => [...l.slice(-3), e.message]);
      }, wallet);
    } catch (err) {
      setStatus('error');
      setLog((l) => [...l.slice(-3), `Failed: ${(err as Error).message}`]);
    } finally {
      setBusy(false);
      setHasPendingBridge(!!localStorage.getItem('cluster_pending_bridge'));
    }
  };

  const resume = async () => {
    setBusy(true);
    setLog([]);
    setStatus('approve');
    try {
      await resumeBridge((e) => {
        setStatus(e.status);
        setLog((l) => [...l.slice(-3), e.message]);
      }, wallet);
    } catch (err) {
      setStatus('error');
      setLog((l) => [...l.slice(-3), `Failed: ${(err as Error).message}`]);
    } finally {
      setBusy(false);
      setHasPendingBridge(!!localStorage.getItem('cluster_pending_bridge'));
    }
  };

  const fromBal = balances[from].balance;
  const max = () => {
    if (fromBal) setAmount(fromBal.replace(/,/g, ''));
  };

  const rows: ModalRow[] = CHAIN_LIST.map((c) => ({
    id: c.id,
    title: 'USDC',
    subtitle: c.label,
    chainId: c.id,
    balance: wallet && !wallet.demo ? balances[c.id].balance : wallet?.demo ? '0.00' : null,
    live: balances[c.id].live,
    loading: balances[c.id].loading,
  }));

  const pick = (id: string) => {
    const c = id as ChainId;
    if (modalFor === 'from') setFrom(c);
    else setTo(c);
  };

  return (
    <section className="max-w-lg mx-auto rounded-xl border border-border bg-card">
      <div className="p-5 pb-0">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-base font-semibold text-white">Bridge</span>
          <span className="rounded-lg bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">CCTP</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="rounded-xl bg-bg p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-text-muted">From</span>
            <span className="text-sm font-medium text-text-muted">
              {fromBal != null ? `${fromBal} USDC` : '\u2014'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ChainButton chain={from} onClick={() => setModalFor('from')} />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-transparent text-right text-3xl font-bold text-white outline-none placeholder:text-text-dim"
            />
          </div>
          <div className="mt-2 flex justify-end">
            <button onClick={max} className="text-sm font-semibold text-accent hover:text-white">
              Max
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 py-3">
          <span className="h-px flex-1 bg-border" />
          <button
            onClick={() => { setFrom(to); setTo(from); }}
            className="grid h-9 w-9 place-items-center rounded-lg bg-card-hover text-base font-bold text-text-muted transition hover:text-white"
          >
            ↓↑
          </button>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="rounded-xl bg-bg p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-text-muted">To</span>
            <span className="text-sm font-medium text-text-muted">
              {balances[to].balance != null ? `${balances[to].balance} USDC` : '\u2014'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ChainButton chain={to} onClick={() => setModalFor('to')} />
            <p className="w-full truncate text-right text-3xl font-bold text-text-muted">
              {amt > 0 ? `\u2248 ${amount}` : '0.00'}
            </p>
          </div>
          <p className="mt-2 text-right text-sm font-medium text-text-dim">1:1 via CCTP, gas on destination</p>
        </div>

        <dl className="mt-5 space-y-2.5 text-sm font-medium text-text-muted">
          <div className="flex justify-between">
            <dt>Route</dt>
            <dd className="text-white">{route.label}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Gas</dt>
            <dd className="text-white">
              {CHAINS[from].nativeGas}
              {isPaymasterEligible(from) && isPaymasterEligible(to) ? ' · Paymaster' : ''}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Time</dt>
            <dd className="text-white">~15 min</dd>
          </div>
        </dl>

        <button
          onClick={action.run}
          disabled={action.disabled}
          className="mt-5 w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-bg transition hover:bg-white/90 active:scale-[0.99] disabled:opacity-30 disabled:active:scale-100"
        >
          {action.label}
        </button>

        {(busy || status === 'success' || status === 'error') && (
          <div className="mt-5 rounded-xl bg-bg p-4">
            <div className="mb-3 flex gap-1.5">
              {STEPS.map((s) => (
                <span
                  key={s}
                  className={`h-1.5 flex-1 rounded-full ${
                    STEPS.indexOf(status) >= STEPS.indexOf(s) ? 'bg-accent' : 'bg-border'
                  }`}
                />
              ))}
            </div>
            <ul className="space-y-1 text-sm font-medium text-text-muted">
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <SelectModal
        open={modalFor !== null}
        onClose={() => setModalFor(null)}
        title={modalFor === 'from' ? 'Bridge from' : 'Bridge to'}
        rows={rows}
        selectedId={modalFor === 'from' ? from : to}
        onSelect={pick}
      />

      {/* ── Pending CCTP bridges ────────────────────────────────────── */}
      {wallet && pendingBridges.filter(p => !dismissedTxs.has(p.burnTxHash)).map(p => (
        <PendingBridgeCard
          key={p.burnTxHash}
          pending={p}
          wallet={wallet}
          onCompleted={(txHash) => {
            setDismissedTxs(prev => new Set([...prev, txHash]));
            rescan();
          }}
        />
      ))}

      {wallet && scanLoading && pendingBridges.length === 0 && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-white/25">
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Scanning for pending bridges…
        </div>
      )}

      {hasPendingBridge && (
        <div className="mt-4 rounded-xl border border-accent bg-accent/10 p-5">
          <div className="flex items-center gap-2 text-accent">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            <span className="font-semibold">Uncompleted Bridge Detected</span>
          </div>
          <p className="mt-2 text-sm text-white">
            You have a pending USDC transfer that was burned but not minted on the destination chain.
          </p>
          <button
            onClick={resume}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
          >
            {busy ? 'Resuming...' : 'Complete Order'}
          </button>
        </div>
      )}
    </section>
  );
}
