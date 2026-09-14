const BASE = 'https://api.jup.ag/trigger/v2';
const API_KEY = import.meta.env.VITE_JUPITER_API_KEY;

function apiHeaders(jwt?: string) {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };
  if (jwt) h['Authorization'] = `Bearer ${jwt}`;
  return h;
}

// ── SIWS auth ─────────────────────────────────────────────────────────────────

/** Step 1: Get challenge string from Jupiter */
export async function getSiwsMessage(walletAddress: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ walletPubkey: walletAddress, type: 'message' }),
  });
  if (!res.ok) throw new Error(`Auth challenge error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { challenge: string };
  return data.challenge;
}

/** Step 2: Submit signed challenge, receive 24h JWT */
export async function authenticateWithSiws(opts: {
  walletAddress: string;
  challenge: string;
  signedMessage: Uint8Array | { signature: Uint8Array };
}): Promise<string> {
  // Phantom wraps the result in { signature } — unwrap it
  const raw = 'signature' in opts.signedMessage
    ? (opts.signedMessage as { signature: Uint8Array }).signature
    : opts.signedMessage as Uint8Array;

  // Robust bs58 encoder (no BigInt)
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function toB58(bytes: Uint8Array): string {
    const digits: number[] = [0];
    for (const byte of bytes) {
      let carry = byte;
      for (let i = 0; i < digits.length; i++) {
        carry += digits[i] << 8;
        digits[i] = carry % 58;
        carry = Math.floor(carry / 58);
      }
      while (carry > 0) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
    }
    let result = '';
    for (let i = digits.length - 1; i >= 0; i--) result += B58[digits[i]];
    for (const byte of bytes) { if (byte !== 0) break; result = '1' + result; }
    return result;
  }

  const res = await fetch(`${BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      type: 'message',
      walletPubkey: opts.walletAddress,
      signature: toB58(raw),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Auth verify error: ${res.status} ${err}`);
  }
  const data = await res.json() as { token: string };
  return data.token;
}

export async function getOrCreateVault(jwt: string): Promise<string> {
  // Try to fetch existing vault first
  let res = await fetch(`${BASE}/vault`, { headers: apiHeaders(jwt) });
  if (!res.ok) {
    // Vault doesn't exist yet — register one
    res = await fetch(`${BASE}/vault/register`, {
      method: 'GET',
      headers: apiHeaders(jwt),
    });
  }
  if (!res.ok) throw new Error(`Vault error: ${res.status}`);
  const data = (await res.json()) as { vaultPubkey: string };
  return data.vaultPubkey;
}

export async function craftDeposit(opts: {
  jwt: string;
  inputMint: string;
  outputMint: string;
  userAddress: string;
  amount: string;
}): Promise<{ transaction: string; requestId: string }> {
  const res = await fetch(`${BASE}/deposit/craft`, {
    method: 'POST',
    headers: apiHeaders(opts.jwt),
    body: JSON.stringify({
      inputMint: opts.inputMint,
      outputMint: opts.outputMint,
      userAddress: opts.userAddress,
      amount: opts.amount,
      orderType: 'dca',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Deposit craft error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { transaction: string; requestId: string };
  return data;
}

export async function createDcaOrder(opts: {
  jwt: string;
  depositRequestId: string;
  depositSignedTx: string;
  userPubkey: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  orderCount: number;
  intervalSeconds: number;
}): Promise<{ id: string; txSignature: string }> {
  const res = await fetch(`${BASE}/orders/dca`, {
    method: 'POST',
    headers: apiHeaders(opts.jwt),
    body: JSON.stringify({
      depositRequestId: opts.depositRequestId,
      depositSignedTx: opts.depositSignedTx,
      userPubkey: opts.userPubkey,
      inputMint: opts.inputMint,
      outputMint: opts.outputMint,
      inputAmount: opts.inputAmount,
      orderCount: opts.orderCount,
      intervalSeconds: opts.intervalSeconds,
      orderType: 'time_based',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DCA order error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { id: string; txSignature: string };
  return data;
}

// ── Instant Swap (Jupiter v6) ─────────────────────────────────────────────────

export async function getJupiterQuote(inputMint: string, outputMint: string, amountMicro: string) {
  const res = await fetch(`https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountMicro}`);
  if (!res.ok) throw new Error(`Quote error: ${res.status}`);
  return res.json();
}

export async function getJupiterSwapTx(quoteResponse: any, userPubkey: string) {
  const res = await fetch('https://api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: userPubkey,
      wrapAndUnwrapSol: true,
    }),
  });
  if (!res.ok) throw new Error(`Swap craft error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { swapTransaction: string };
  return data.swapTransaction;
}
