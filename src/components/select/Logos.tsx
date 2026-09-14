import { useState } from 'react';

// TrustWallet GitHub raw — no CORS, always available, used by most DeFi UIs
const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master';

const COIN_LOGOS: Record<string, string> = {
  // Ethereum token addresses
  USDC: `${TW}/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`,
  EURC: `${TW}/blockchains/ethereum/assets/0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c/logo.png`,
  USDT: `${TW}/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png`,
};

// Chain logos from TrustWallet blockchains/<name>/info/logo.png
const CHAIN_LOGOS: Record<string, string> = {
  solana:     `${TW}/blockchains/solana/info/logo.png`,
  ethereum:   `${TW}/blockchains/ethereum/info/logo.png`,
  base:       `${TW}/blockchains/base/info/logo.png`,
  arbitrum:   `${TW}/blockchains/arbitrum/info/logo.png`,
  polygon:    `${TW}/blockchains/polygon/info/logo.png`,
  sei:        `${TW}/blockchains/sei/info/logo.png`,
  sonic:      `${TW}/blockchains/sonic/info/logo.png`,
  unichain:   `${TW}/blockchains/unichain/info/logo.png`,
  worldchain: `${TW}/blockchains/worldchain/info/logo.png`,
};

// Brand colours used in fallback badges
const CHAIN_COLORS: Record<string, string> = {
  solana:     '#9945FF',
  ethereum:   '#627EEA',
  base:       '#0052FF',
  arbitrum:   '#28A0F0',
  polygon:    '#8247E5',
  sei:        '#B23A48',
  sonic:      '#444',
  unichain:   '#FF007A',
  worldchain: '#1A1A1A',
};

function CoinFallback({ size, label }: { size: number; label: string }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-bold text-accent shrink-0"
    >
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ChainFallback({ size, chainId }: { size: number; chainId: string }) {
  const bg = CHAIN_COLORS[chainId] ?? '#4FD1E8';
  const letter = chainId.slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.55,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  );
}

export function CoinGeckoLogo({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <CoinFallback size={size} label={symbol} />;

  const url = COIN_LOGOS[symbol] ?? COIN_LOGOS['USDC'];
  return (
    <img
      src={url}
      alt={symbol}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', flexShrink: 0 }}
      className="rounded-full block"
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
    />
  );
}

export function ChainGeckoLogo({ chainId, size = 16 }: { chainId: string; size?: number }) {
  const [err, setErr] = useState(false);
  const url = CHAIN_LOGOS[chainId];

  if (!url || err) return <ChainFallback size={size} chainId={chainId} />;

  return (
    <img
      src={url}
      alt={chainId}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', flexShrink: 0 }}
      className="rounded-sm block"
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
    />
  );
}

export function RowIcon({ row }: { row: { id: string; title: string; subtitle: string; chainId?: string } }) {
  if (row.chainId) {
    return (
      <span className="relative inline-flex shrink-0" style={{ width: 28, height: 28 }}>
        <CoinGeckoLogo symbol={row.title} size={28} />
        <span className="absolute -bottom-0.5 -right-0.5">
          <ChainGeckoLogo chainId={row.chainId} size={14} />
        </span>
      </span>
    );
  }
  return <CoinGeckoLogo symbol={row.title} size={28} />;
}

export function TokenLogo({ symbol, size = 28 }: { symbol: string; size?: number }) {
  return <CoinGeckoLogo symbol={symbol} size={size} />;
}
