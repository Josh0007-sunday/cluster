// Swap — Circle StableFX (stablecoin ↔ stablecoin, e.g. USDC ↔ EURC).
// Flow per spec:
//   POST /v1/exchange/stablefx/quotes  → { rate, fee, quoteId, short expiry }
//   POST /v1/exchange/stablefx/trades  → { quoteId } executes
// Base URL: https://api.circle.com/v1/exchange/stablefx (Bearer: CIRCLE_API_KEY)

import { CLUSTER_CONFIG } from '../config/cluster';
import type { StableFxQuote } from '../types';

interface QuoteRequest {
  from: string;
  to: string;
  amount: string;
}

async function authedFetch(path: string, body: unknown) {
  const rawKey = CLUSTER_CONFIG.circleApiKey;
  // Circle key format is full string: "LIVE_API_KEY:keyId:secret"
  const res = await fetch(`${CLUSTER_CONFIG.stablefxBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(rawKey ? { Authorization: `Bearer ${rawKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`StableFX ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

const MOCK_RATES: Record<string, number> = {
  'USDC-EURC': 0.917,
  'EURC-USDC': 1.0905,
  'USDC-USDT': 0.999,
  'USDT-USDC': 1.001,
};

/** Request a live quote; falls back to deterministic demo quote without API key. */
export async function requestStableFxQuote(req: QuoteRequest): Promise<StableFxQuote> {
  if (CLUSTER_CONFIG.circleApiKey) {
    const q = await authedFetch('/quotes', {
      baseCurrency: req.from,        // e.g. "USDC"
      quoteCurrency: req.to,          // e.g. "EURC"
      baseAmount: req.amount,         // e.g. "10"
    });
    return {
      quoteId: q.quoteId ?? q.id ?? crypto.randomUUID(),
      rate: Number(q.exchangeRate ?? q.rate ?? 1),
      fee: String(q.feeAmount ?? q.fee ?? '0'),
      fromCurrency: req.from,
      toCurrency: req.to,
      fromAmount: req.amount,
      toAmount: String(q.quoteAmount ?? q.toAmount ?? req.amount),
      expiresAt: q.expiresAt ?? new Date(Date.now() + 30_000).toISOString(),
    };
  }
  // Demo quote (short expiry to mirror real RFQ behaviour)
  const key = `${req.from}-${req.to}`;
  const rate = MOCK_RATES[key] ?? 1;
  const toAmount = (Number(req.amount || '0') * rate).toFixed(4);
  return {
    quoteId: `demo-${crypto.randomUUID().slice(0, 8)}`,
    rate,
    fee: (Number(req.amount || '0') * 0.0008).toFixed(4),
    fromCurrency: req.from,
    toCurrency: req.to,
    fromAmount: req.amount,
    toAmount,
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  };
}

/** Execute a trade against a live quoteId. */
export async function executeStableFxTrade(quoteId: string): Promise<{ tradeId: string; status: string }> {
  if (CLUSTER_CONFIG.circleApiKey) {
    const t = await authedFetch('/trades', { quoteId });
    return { tradeId: t.tradeId ?? t.id ?? quoteId, status: t.status ?? 'pending' };
  }
  await new Promise((r) => setTimeout(r, 900));
  return { tradeId: quoteId, status: 'complete (demo — add CIRCLE_API_KEY for live)' };
}
