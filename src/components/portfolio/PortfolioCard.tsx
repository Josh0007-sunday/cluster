import { useWallet, truncate } from '../../hooks/useWallet';
import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { fetchSolanaStocks } from '../../lib/stocks';
import type { SolanaStock } from '../../types';

// ── types ─────────────────────────────────────────────────────────────────────

interface TokenPosition {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  balance: number;
  type: 'sol' | 'usdc' | 'xstock' | 'spl';
  usdPrice: number | null;
}

interface KaminoVaultPosition {
  name: string;
  apy: number | null;
  usdValue: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_LOGO = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
const USDC_LOGO = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png';

function getRpcUrl() {
  return import.meta.env.VITE_HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`
    : import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

function symbolHue(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 360;
}

// ── sub-components ────────────────────────────────────────────────────────────

function TokenAvatar({ logo, symbol }: { logo: string | null; symbol: string }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={symbol}
        referrerPolicy="no-referrer"
        onError={() => setErr(true)}
        className="h-10 w-10 rounded-full object-contain shrink-0"
        style={{ background: '#fff', padding: 2 }}
      />
    );
  }
  const h = symbolHue(symbol);
  return (
    <div
      className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
      style={{ background: `hsl(${h},50%,22%)`, border: `1px solid hsl(${h},50%,35%)` }}
    >
      {symbol.replace(/x$/, '').slice(0, 2).toUpperCase()}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl bg-card border border-border px-5 py-4">
      <p className="text-xs font-medium text-text-muted mb-2">{label}</p>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function CopyIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-text-dim shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

// ── wallet brand logos ────────────────────────────────────────────────────────

function getWalletLogo(label: string): string | null {
  const l = label.toLowerCase();
  if (l.includes('phantom')) return 'https://phantom.app/img/phantom-logo.png';
  if (l.includes('metamask')) return 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg';
  if (l.includes('solflare')) return 'https://solflare.com/images/logo.png';
  return null;
}

// ── main component ────────────────────────────────────────────────────────────

export default function PortfolioCard() {
  const wallet = useWallet();

  const [loading, setLoading] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenPosition[]>([]);
  const [kaminoPositions, setKaminoPositions] = useState<KaminoVaultPosition[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!wallet || wallet.chain !== 'solana' || wallet.demo) return;
    setLoading(true);

    const conn = new Connection(getRpcUrl());
    const pubkey = new PublicKey(wallet.address);

    Promise.all([
      // SOL price
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
        .then(r => r.json()).then(d => (d?.solana?.usd as number) ?? null).catch(() => null),
      // SOL balance
      conn.getBalance(pubkey).then(b => b / 1e9).catch(() => null),
      // SPL tokens
      conn.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      }).catch(() => null),
      // xStocks list for mint resolution
      fetchSolanaStocks().catch(() => [] as SolanaStock[]),
      // Kamino positions
      fetch(`https://api.kamino.finance/v2/user-positions/${wallet.address}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([solPx, sol, tokenAccts, xstocks, kaminoData]) => {
      setSolPrice(solPx);
      setSolBalance(sol);

      if (tokenAccts) {
        const mintMap = new Map<string, SolanaStock>();
        for (const s of xstocks) mintMap.set(s.solanaMint, s);

        const positions: TokenPosition[] = [];
        for (const acct of tokenAccts.value) {
          const info = acct.account.data.parsed?.info;
          if (!info) continue;
          const balance: number = info.tokenAmount.uiAmount ?? 0;
          if (balance === 0) continue;
          const mint: string = info.mint;

          if (mint === USDC_MINT) {
            positions.push({ mint, symbol: 'USDC', name: 'USD Coin', logo: USDC_LOGO, balance, type: 'usdc', usdPrice: 1 });
          } else if (mintMap.has(mint)) {
            const s = mintMap.get(mint)!;
            positions.push({ mint, symbol: s.symbol, name: s.name, logo: s.logo, balance, type: 'xstock', usdPrice: null });
          } else {
            positions.push({ mint, symbol: mint.slice(0, 5) + '…', name: 'Unknown Token', logo: null, balance, type: 'spl', usdPrice: null });
          }
        }
        setTokens(positions);
      }

      if (Array.isArray(kaminoData)) {
        setKaminoPositions(kaminoData
          .filter((p: any) => p.balanceUsd > 0)
          .map((p: any) => ({ name: p.vaultName ?? 'Kamino Vault', apy: p.apy ?? null, usdValue: p.balanceUsd ?? 0 }))
        );
      }

      setLoading(false);
    });
  }, [wallet?.address]);

  // ── no wallet ─────────────────────────────────────────────────────────────

  if (!wallet) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
          <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V9" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-bold text-white">No wallet connected</p>
          <p className="mt-1 text-sm text-text-muted">Connect a wallet to view your portfolio</p>
        </div>
      </div>
    );
  }

  // ── computed ──────────────────────────────────────────────────────────────

  const solUsd = (solBalance ?? 0) * (solPrice ?? 0);
  const usdcTotal = tokens.filter(t => t.type === 'usdc').reduce((a, t) => a + t.balance, 0);
  const kaminoTotal = kaminoPositions.reduce((a, v) => a + v.usdValue, 0);
  const totalValue = solUsd + usdcTotal + kaminoTotal;

  const allRows = [
    ...(solBalance !== null && solBalance > 0 ? [{
      key: 'sol', symbol: 'SOL', name: 'Solana', logo: SOL_LOGO,
      typeLabel: 'Native Coin', balanceStr: `${solBalance.toFixed(4)} SOL`, usd: solUsd,
    }] : []),
    ...tokens.map(t => ({
      key: t.mint, symbol: t.symbol, name: t.name, logo: t.logo,
      typeLabel: t.type === 'usdc' ? 'Stablecoin' : t.type === 'xstock' ? 'Tokenized Equity' : 'SPL Token',
      balanceStr: `${t.balance.toLocaleString(undefined, { maximumFractionDigits: t.type === 'usdc' ? 2 : 6 })} ${t.symbol}`,
      usd: t.usdPrice !== null ? t.balance * t.usdPrice : null,
    })),
    ...kaminoPositions.map((v, i) => ({
      key: `kamino-${i}`, symbol: 'kUSDC', name: v.name, logo: null,
      typeLabel: `Lending Vault${v.apy ? ` · ${(v.apy * 100).toFixed(2)}% APY` : ''}`,
      balanceStr: '—', usd: v.usdValue,
    })),
  ];

  const walletLogoUrl = getWalletLogo(wallet.label);

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-12">

      {/* ── Identity row ── */}
      <div className="flex flex-col sm:flex-row items-start justify-between pt-4 gap-4">
        {/* Left: wallet info */}
        <div className="flex items-center gap-4">
          {/* logo */}
          <div className="h-12 w-12 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-card border border-border">
            {walletLogoUrl ? (
              <img src={walletLogoUrl} alt={wallet.label} className="h-full w-full object-contain p-1.5" />
            ) : (
              <svg className="h-6 w-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9" />
              </svg>
            )}
          </div>

          {/* name + address */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-0.5">
              {wallet.label}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-accent transition-colors"
              >
                {truncate(wallet.address)}
                <CopyIcon done={copied} />
              </button>
              <span
                className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-text-muted"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Mainnet
              </span>
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex gap-2.5 shrink-0">
        <button className="rounded-xl bg-accent px-4 sm:px-10 py-2.5 text-sm font-bold text-bg transition hover:opacity-90 active:scale-95">
            Deposit
          </button>
          <button className="rounded-xl border border-border bg-card px-4 sm:px-10 py-2.5 text-sm font-bold text-white transition hover:bg-card-hover active:scale-95">
            Withdraw
          </button>
        </div>
      </div>

      {/* ── Balance ── */}
      <div>
        <p className="text-sm font-medium text-text-muted mb-2">Total Portfolio Value</p>
        {loading ? (
          <div className="h-14 w-52 animate-pulse rounded-xl bg-card" />
        ) : (
          <p className="text-3xl sm:text-6xl font-extrabold tracking-tighter text-white tabular-nums leading-none">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>

      {/* ── Stats ── */}
      {!loading && (
        <div className="flex flex-col sm:flex-row gap-4">
          <StatCard
            label="Liquid (SOL + USDC)"
            value={`$${(solUsd + usdcTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <StatCard
            label="In Kamino Vaults"
            value={`$${kaminoTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <StatCard
            label="Token Positions"
            value={`${allRows.length}`}
          />
        </div>
      )}

      {/* ── Positions table ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-bold text-white">Positions & Balances</p>
          {!loading && <p className="text-sm text-text-muted">{allRows.length} assets</p>}
        </div>

        <div className="rounded-2xl overflow-x-auto overflow-hidden border border-border bg-card">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-sm text-text-muted">
              <svg className="h-4 w-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Fetching on-chain positions…
            </div>
          ) : allRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-muted">
              <svg className="h-8 w-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm">No positions found on this wallet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border" style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Asset</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Balance</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Value</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, i) => (
                  <tr
                    key={row.key}
                    className="border-b border-border last:border-0 transition-colors"
                    style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)')}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <TokenAvatar logo={row.logo} symbol={row.symbol} />
                        <div>
                          <p className="font-semibold text-white leading-tight">{row.name}</p>
                          <p className="text-xs text-text-dim mt-0.5">{row.symbol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-muted text-xs">{row.typeLabel}</td>
                    <td className="px-6 py-4 text-right font-mono text-text-muted tabular-nums">{row.balanceStr}</td>
                    <td className="px-6 py-4 text-right">
                      {row.usd !== null ? (
                        <span className="font-semibold text-white tabular-nums">
                          ${row.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
