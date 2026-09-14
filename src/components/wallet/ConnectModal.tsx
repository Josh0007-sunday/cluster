import { useState, useEffect } from 'react';
import { setConnectedWallet } from '../../hooks/useWallet';
import { usePrivy, useWallets } from '@privy-io/react-auth';

type Chain = 'evm' | 'solana';

interface EthProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBitget?: boolean;
}

interface SolanaProvider {
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  signTransaction?: (transaction: any) => Promise<any>;
  isPhantom?: boolean;
}

interface WalletDef {
  id: string;
  label: string;
  chain: Chain;
  check: () => boolean;
  site: string;
  logo: string;
}

const eth = () => (window as unknown as { ethereum?: EthProvider }).ethereum;
const sol = () => (window as unknown as { solana?: SolanaProvider }).solana;
interface WindowExtras { phantom?: { solana?: SolanaProvider }; solflare?: SolanaProvider; backpack?: SolanaProvider; }
const anyWin = () => window as unknown as WindowExtras;

// ── Logos ─────────────────────────────────────────────────────────────────────
// Local files for verified-downloadable ones; inline SVG data URIs for the rest.
const L = {
  metamask: '/wallets/metamask.svg',
  walletconnect: '/wallets/walletconnect.png',
  coinbase: '/wallets/coinbase.png',
  backpack: '/wallets/backpack.png',

  // Phantom — purple ghost (brand colour #AB9FF2)
  phantom:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="26" fill="#AB9FF2"/>
      <path d="M110.4 64.2C110.4 36.4 87.6 14 59.8 14h-4.3C30 14 10 34 10 59.6c0 14 5.8 25.3 15.2 32.8
               5.2 4 10.5 2.8 13.5-1.5 2-2.9 2-6.6 2-9.3v-4.7c0-8.4 6.8-15.2 15.2-15.2s15.2 6.8 15.2 15.2v4.7
               c0 2.7 0 6.4 2 9.3 3 4.3 8.3 5.5 13.5 1.5 9.4-7.5 23.8-17.2 23.8-28.2z"
            fill="white"/>
      <ellipse cx="49" cy="56" rx="5" ry="6.5" fill="#AB9FF2"/>
      <ellipse cx="79" cy="56" rx="5" ry="6.5" fill="#AB9FF2"/>
    </svg>`),

  // Solflare — orange flame
  solflare:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="26" fill="#FC822B"/>
      <path d="M64 18 C64 18 88 44 88 62 C88 76 77 87 64 87 C51 87 40 76 40 62 C40 44 64 18 64 18Z" fill="white" opacity="0.9"/>
      <path d="M64 50 C64 50 76 62 76 70 C76 77 71 82 64 82 C57 82 52 77 52 70 C52 62 64 50 64 50Z" fill="#FC822B"/>
      <path d="M64 74 L72 104 L64 98 L56 104 Z" fill="white" opacity="0.8"/>
    </svg>`),

  // Rabby — blue rabbit
  rabby:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="26" fill="#7084FF"/>
      <ellipse cx="64" cy="74" rx="28" ry="24" fill="white"/>
      <ellipse cx="47" cy="44" rx="8" ry="18" fill="white"/>
      <ellipse cx="81" cy="44" rx="8" ry="18" fill="white"/>
      <ellipse cx="47" cy="40" rx="4" ry="12" fill="#C4B5FD"/>
      <ellipse cx="81" cy="40" rx="4" ry="12" fill="#C4B5FD"/>
      <circle cx="57" cy="72" r="3.5" fill="#7084FF"/>
      <circle cx="71" cy="72" r="3.5" fill="#7084FF"/>
      <ellipse cx="64" cy="80" rx="5" ry="3" fill="#FDA4AF"/>
    </svg>`),

  // Bitget — dark teal B
  bitget:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="26" fill="#00D6A3"/>
      <text x="64" y="88" font-family="Arial,sans-serif" font-weight="900" font-size="72"
            fill="white" text-anchor="middle">B</text>
    </svg>`),

  // Browser wallet generic
  browser:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="26" fill="#2D2D32"/>
      <circle cx="64" cy="64" r="32" stroke="#a1a1aa" stroke-width="5" fill="none"/>
      <line x1="64" y1="32" x2="64" y2="96" stroke="#a1a1aa" stroke-width="4"/>
      <line x1="32" y1="64" x2="96" y2="64" stroke="#a1a1aa" stroke-width="4"/>
      <ellipse cx="64" cy="64" rx="16" ry="32" stroke="#a1a1aa" stroke-width="4" fill="none"/>
    </svg>`),
};

const EVM_WALLETS: WalletDef[] = [
  { id: 'metamask', label: 'MetaMask', chain: 'evm', check: () => !!eth()?.isMetaMask, site: 'https://metamask.io', logo: L.metamask },
];

const SOLANA_WALLETS: WalletDef[] = [
  { id: 'phantom', label: 'Phantom', chain: 'solana', check: () => !!sol()?.isPhantom || !!anyWin().phantom?.solana, site: 'https://phantom.app', logo: L.phantom },
];

async function connectEvm(): Promise<{ address: string; provider: EthProvider }> {
  const provider = eth();
  if (!provider) throw new Error('No EVM wallet detected in this browser.');
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.[0]) throw new Error('Wallet returned no accounts.');
  return { address: accounts[0], provider };
}

function pickSolanaProvider(id: string): SolanaProvider | undefined {
  if (id === 'solflare') return anyWin().solflare;
  if (id === 'backpack') return anyWin().backpack;
  return sol() ?? anyWin().phantom?.solana;
}

async function connectSolana(id: string): Promise<{ address: string; provider: SolanaProvider }> {
  const provider = pickSolanaProvider(id);
  if (!provider) throw new Error('Solana wallet not detected. Install it first.');
  const res = await provider.connect();
  return { address: res.publicKey.toString(), provider };
}

// ── Wallet tile ───────────────────────────────────────────────────────────────
function WalletTile({
  def,
  busy,
  connecting,
  onPick,
}: {
  def: WalletDef;
  busy: boolean;
  connecting: string | null;
  onPick: (d: WalletDef) => void;
}) {
  const detected = def.check();
  const isWC = def.id.startsWith('walletconnect');
  const isSpinning = connecting === def.id;

  const handleClick = () => {
    if (isWC) { onPick(def); return; }
    if (!detected && def.site) { window.open(def.site, '_blank', 'noopener'); return; }
    onPick(def);
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={def.label}
      className={`
        group relative flex flex-col items-center justify-center gap-2
        rounded-2xl border p-4 pt-5 pb-4
        transition-all duration-200 select-none
        disabled:opacity-40 disabled:pointer-events-none
        ${detected || isWC
          ? 'border-white/10 bg-white/[0.04] hover:border-accent/40 hover:bg-accent/5 hover:shadow-lg hover:shadow-accent/10 cursor-pointer'
          : 'border-white/[0.06] bg-white/[0.02] cursor-pointer hover:opacity-100 hover:border-white/10'}
      `}
      style={{ opacity: !detected && !isWC && def.id !== 'injected' ? 0.65 : 1 }}
    >
      {/* detected dot */}
      {detected && (
        <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-green-400"
              style={{ boxShadow: '0 0 5px #4ade80' }} />
      )}

      {/* logo / spinner */}
      <span className="flex h-11 w-11 items-center justify-center">
        {isSpinning ? (
          <svg className="h-7 w-7 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <img
            src={def.logo}
            alt={def.label}
            className="h-10 w-10 rounded-xl object-contain"
            draggable={false}
          />
        )}
      </span>

      {/* label */}
      <span className="text-center text-[11px] font-semibold leading-tight text-white/70 group-hover:text-white transition-colors max-w-[68px] truncate">
        {def.label}
      </span>

      {/* sub-badge */}
      {isWC ? (
        <span className="text-[9px] font-bold uppercase tracking-wider text-accent/60">QR</span>
      ) : !detected && def.site ? (
        <span className="text-[9px] font-medium text-white/25">Install ↗</span>
      ) : null}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export default function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { login, authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  // Sync Privy auth state with app state
  useEffect(() => {
    if (authenticated && user && wallets.length > 0) {
      const privyEmailWallets = wallets.filter(w => w.walletClientType === 'privy');
      const solanaWallet = privyEmailWallets.find(w => (w as { chainType?: string }).chainType === 'solana');
      const evmWallet = privyEmailWallets.find(w => (w as { chainType?: string }).chainType === 'ethereum') || wallets[0];

      const primaryWallet = solanaWallet || evmWallet;
      if (!primaryWallet) return;

      const isSolana = (primaryWallet as { chainType?: string }).chainType === 'solana';

      setConnectedWallet({
        id: 'privy-email',
        label: 'Email Wallet',
        address: primaryWallet.address,
        chain: isSolana || solanaWallet ? 'solana' : 'evm', // Default to Solana for stocks
        provider: undefined, // EIP1193 or Solana provider needs explicit async init in Privy
        evmAddress: evmWallet?.address,
        solanaAddress: solanaWallet?.address,
      });
      onClose();
    }
  }, [authenticated, user, wallets, onClose]);

  if (!open) return null;

  const pick = async (def: WalletDef) => {
    setError('');
    if (def.id.startsWith('walletconnect')) {
      setError('WalletConnect requires the Reown AppKit SDK. Add VITE_REOWN_PROJECT_ID and rebuild.');
      return;
    }
    setConnecting(def.id);
    try {
      if (def.chain === 'evm') {
        const { address, provider } = await connectEvm();
        setConnectedWallet({ id: def.id, label: def.label, address, chain: 'evm', provider });
      } else {
        const { address, provider } = await connectSolana(def.id);
        setConnectedWallet({ id: def.id, label: def.label, address, chain: 'solana', provider });
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[360px] rounded-3xl border border-white/10 bg-[#111113] shadow-2xl"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 40px 100px rgba(0,0,0,0.8)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <div>
            <h3 className="text-[16px] font-semibold tracking-tight text-white leading-tight">
              Connect a wallet
            </h3>
            <p className="text-[12px] text-white/35 mt-0.5">Choose your preferred wallet</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/80 transition"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-4 pb-5 space-y-3">
          {/* Email option via Privy */}
          <button
            onClick={() => { setError(''); login(); }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] py-3.5 text-[13px] font-semibold text-white/90 hover:bg-white/[0.07] hover:text-white transition border border-white/[0.05]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Continue with Email
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 px-1 pt-1 pb-0.5">
            <div className="h-px flex-1 bg-white/[0.05]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Or use a wallet</span>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>

          {/* EVM label */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 px-1 pb-0.5">EVM Networks</p>

          {/* EVM grid */}
          <div className="grid grid-cols-1 gap-2">
            {EVM_WALLETS.map((d) => (
              <WalletTile key={d.id} def={d} busy={connecting !== null} connecting={connecting} onPick={pick} />
            ))}
          </div>

          {/* Solana divider */}
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="h-px flex-1 bg-white/[0.05]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Solana</span>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>

          {/* Solana grid */}
          <div className="grid grid-cols-1 gap-2">
            {SOLANA_WALLETS.map((d) => (
              <WalletTile key={d.id} def={d} busy={connecting !== null} connecting={connecting} onPick={pick} />
            ))}
          </div>

          {/* error */}
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[12px] font-medium text-red-300 leading-snug">
              {error}
            </p>
          )}

          {/* waiting */}
          {connecting && !error && (
            <p className="text-center text-[12px] text-white/35 py-1">Waiting for wallet approval…</p>
          )}
        </div>
      </div>
    </div>
  );
}
