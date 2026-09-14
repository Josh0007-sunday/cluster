"use client";

import { useEffect, useState } from "react";

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${price.toFixed(2)}`;
}

function usePrices(refreshInterval = 30000) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const ids = ["solana", "bitcoin", "ethereum"];
        const resp = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
        );
        const data = await resp.json();
        const mapping: Record<string, PriceData> = {
          solana: { symbol: "SOL", price: data.solana?.usd ?? 0, change24h: data.solana?.usd_24h_change ?? 0 },
          bitcoin: { symbol: "BTC", price: data.bitcoin?.usd ?? 0, change24h: data.bitcoin?.usd_24h_change ?? 0 },
          ethereum: { symbol: "ETH", price: data.ethereum?.usd ?? 0, change24h: data.ethereum?.usd_24h_change ?? 0 },
        };
        setPrices(Object.values(mapping));
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { prices, loading };
}

function TickerItem({ symbol, price, change24h }: { symbol: string; price: number; change24h: number }) {
  const positive = change24h >= 0;
  return (
    <div className="flex items-center gap-2 px-4 shrink-0">
      <span className="text-xs font-bold text-white">{symbol}</span>
      <span className="text-xs font-mono text-text-muted">{formatPrice(price)}</span>
      <span className={`text-xs font-mono ${positive ? "text-green-400" : "text-red-400"}`}>
        {positive ? "+" : ""}{change24h.toFixed(2)}%
      </span>
    </div>
  );
}

function TickerContent({ prices }: { prices: PriceData[] }) {
  const items = [...prices, ...prices, ...prices, ...prices];
  return (
    <div
      className="flex items-center whitespace-nowrap"
      style={{
        animation: "marquee 20s linear infinite",
      }}
    >
      {items.map((p, i) => (
        <TickerItem key={`${p.symbol}-${i}`} {...p} />
      ))}
    </div>
  );
}

export default function PriceTicker() {
  const { prices, loading } = usePrices();

  return (
    <div className="border-b border-border overflow-hidden h-8 flex items-center bg-bg/50">
      {loading || prices.length === 0 ? (
        <div className="mx-auto text-xs text-text-dim animate-pulse">Loading prices…</div>
      ) : (
        <TickerContent prices={prices} />
      )}
    </div>
  );
}
