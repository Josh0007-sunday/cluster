import type { SolanaStock, StockPrice, XStockAsset, ProofOfReserve } from '../types';

const BASE = 'https://api.xstocks.fi/api/v2/public';

const memCache = new Map<string, { data: unknown; expiry: number }>();

function getCache<T>(key: string): T | null {
  const item = memCache.get(key);
  if (item && item.expiry > Date.now()) return item.data as T;
  return null;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  memCache.set(key, { data, expiry: Date.now() + ttlMs });
}

const queue: (() => void)[] = [];
let activeRequests = 0;
const MAX_CONCURRENT = 5;

async function fetchJson<T>(url: string): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  activeRequests++;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`xStocks API error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  } finally {
    activeRequests--;
    if (queue.length > 0) {
      const next = queue.shift();
      if (next) next();
    }
  }
}

export async function getAllAssets(): Promise<XStockAsset[]> {
  const cacheKey = 'xstocks:assets:all';
  const cached = getCache<XStockAsset[]>(cacheKey);
  if (cached) return cached;

  const allAssets: XStockAsset[] = [];
  let page = 0;
  let hasNext = true;

  while (hasNext) {
    const data = await fetchJson<{ nodes: XStockAsset[]; page: { hasNextPage: boolean } }>(
      `${BASE}/assets?page=${page}&pageSize=100`
    );
    allAssets.push(...data.nodes);
    hasNext = data.page.hasNextPage;
    page++;
  }

  setCache(cacheKey, allAssets, 45000); // 45s TTL
  return allAssets;
}

/** All xStocks with a Solana deployment */
export async function fetchSolanaStocks(): Promise<SolanaStock[]> {
  const cacheKey = 'xstocks:solana';
  const cached = getCache<SolanaStock[]>(cacheKey);
  if (cached) return cached;

  const assets = await getAllAssets();
  const solanaStocks: SolanaStock[] = [];

  for (const asset of assets) {
    const solanaDeployment = asset.deployments.find((d) => d.network === 'Solana');
    if (!solanaDeployment) continue;

    solanaStocks.push({
      symbol: asset.symbol,
      underlyingSymbol: asset.underlyingSymbol,
      name: asset.name,
      logo: asset.logo ?? null,
      solanaMint: solanaDeployment.address,
      isTradingHalted: asset.isTradingHalted,
      openNow: asset.trading?.openNow ?? false,
    });
  }

  setCache(cacheKey, solanaStocks, 45000);
  return solanaStocks;
}

/** Latest price quote for a given xStock symbol */
export async function fetchStockPrice(symbol: string): Promise<StockPrice> {
  const cacheKey = `xstocks:price:${symbol}`;
  const cached = getCache<StockPrice>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<StockPrice>(`${BASE}/assets/${symbol}/price-data`);
  // Handle case where API returns `{ quote: null }` for closed markets
  if (data && data.quote === null) {
    data.quote = undefined as any; // Forces PriceCell to treat it as missing rather than loading
  }
  setCache(cacheKey, data, 30000); // 30s TTL
  return data;
}

export async function getProofOfReserves(symbol: string): Promise<ProofOfReserve | null> {
  const cacheKey = `xstocks:reserves:${symbol}`;
  const cached = getCache<ProofOfReserve>(cacheKey);
  if (cached !== null) return cached;

  const data = await fetchJson<{ nodes: ProofOfReserve[] }>(`${BASE}/proof-of-reserves`);
  const match = data.nodes.find((n) => n.symbol === symbol) ?? null;
  setCache(cacheKey, match, 60000); // 60s TTL
  return match;
}
