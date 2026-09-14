import { useState } from 'react';
import type { PendingBridge } from '../../lib/cctpScanner';
import { completePendingBridge, type MintEvent } from '../../lib/cctpScanner';
import { clearBurnTx } from '../../hooks/usePendingBridges';
import type { ConnectedWallet } from '../../hooks/useWallet';

const CHAIN_LABELS: Record<string, string> = {
  solana: 'Solana',
  base: 'Base',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  polygon: 'Polygon',
};

const CHAIN_COLORS: Record<string, string> = {
  solana: '#9945FF',
  base: '#0052FF',
  ethereum: '#627EEA',
  arbitrum: '#28A0F0',
  polygon: '#8247E5',
};

function ChainBadge({ chain }: { chain: string }) {
  const color = CHAIN_COLORS[chain] ?? '#888';
  const label = CHAIN_LABELS[chain] ?? chain;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold"
      style={{ background: `${color}22`, color }}
    >
      {label}
    </span>
  );
}

export default function PendingBridgeCard({
  pending,
  wallet,
  onCompleted,
}: {
  pending: PendingBridge;
  wallet: ConnectedWallet | null;
  onCompleted: (txHash: string) => void;
}) {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleComplete = async () => {
    if (!wallet) return;
    setBusy(true);
    setError('');
    setLog([]);

    const pushLog = (e: MintEvent) =>
      setLog(prev => [...prev.slice(-4), e.message]);

    try {
      const solanaProvider =
        wallet.chain === 'solana' ? wallet.provider : undefined;
      await completePendingBridge(pending, pushLog, solanaProvider);
      setDone(true);
      clearBurnTx(pending.burnTxHash);
      setTimeout(() => onCompleted(pending.burnTxHash), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shortHash = `${pending.burnTxHash.slice(0, 6)}…${pending.burnTxHash.slice(-6)}`;
  const isReady = pending.status === 'ready_to_mint';

  return (
    <div
      className="mt-4 rounded-xl border p-4 transition-all"
      style={{
        borderColor: done
          ? '#4ade8044'
          : isReady
          ? '#714fba44'
          : '#ffffff18',
        background: done
          ? 'rgba(74,222,128,0.05)'
          : isReady
          ? 'rgba(113,79,186,0.08)'
          : 'rgba(255,255,255,0.02)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dot */}
          <span
            className="h-2 w-2 rounded-full mt-0.5 shrink-0"
            style={{
              background: done ? '#4ade80' : isReady ? '#714fba' : '#facc15',
              boxShadow: `0 0 6px ${done ? '#4ade80' : isReady ? '#714fba' : '#facc15'}`,
            }}
          />
          <span className="text-[13px] font-semibold text-white">
            {done ? 'Minted!' : isReady ? 'Ready to claim' : 'Awaiting attestation'}
          </span>
        </div>

        {/* Dismiss when done or waiting */}
        {(done || !isReady) && (
          <button
            onClick={() => onCompleted(pending.burnTxHash)}
            className="text-white/20 hover:text-white/50 text-xs transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Route + amount */}
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <ChainBadge chain={pending.sourceChain} />
        <span className="text-white/30 text-sm">→</span>
        <ChainBadge chain={pending.destChain} />
        <span className="ml-auto text-white font-bold text-sm">
          {pending.amountUsdc} <span className="text-white/40 font-medium">USDC</span>
        </span>
      </div>

      {/* Tx hash */}
      <p className="mt-1.5 text-[11px] text-white/25 font-mono">
        Burn tx: {shortHash}
      </p>

      {/* Status description */}
      {!done && (
        <p className="mt-2 text-[12px] text-white/40">
          {isReady
            ? 'Circle has signed the attestation. Complete the mint to receive your USDC.'
            : 'Waiting for Circle to sign the attestation. This usually takes 1–3 minutes.'}
        </p>
      )}

      {/* Log lines */}
      {log.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {log.map((l, i) => (
            <li key={i} className="text-[11px] text-white/50">{l}</li>
          ))}
        </ul>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
          {error}
        </p>
      )}

      {/* Action button */}
      {isReady && !done && (
        <button
          onClick={handleComplete}
          disabled={busy || !wallet}
          className="mt-3 w-full rounded-lg py-2.5 text-[13px] font-semibold transition active:scale-[0.98] disabled:opacity-40"
          style={{
            background: busy ? 'rgba(113,79,186,0.3)' : '#714fba',
            color: '#fff',
          }}
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Completing…
            </span>
          ) : (
            `Claim ${pending.amountUsdc} USDC on ${CHAIN_LABELS[pending.destChain] ?? pending.destChain}`
          )}
        </button>
      )}

      {!isReady && !done && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/30">
          <svg className="h-3 w-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Checking for attestation…
        </div>
      )}
    </div>
  );
}
