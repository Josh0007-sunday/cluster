import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let pathname: string;
  let search: string;

  if (req.url && req.url.startsWith('http')) {
    const url = new URL(req.url);
    pathname = url.pathname;
    search = url.search;
  } else {
    const fullUrl = `${req.url || ''}`;
    const parts = fullUrl.split('?');
    pathname = parts[0];
    search = parts.length > 1 ? `?${parts.slice(1).join('?')}` : '';
  }

  const prefix = '/api/xstocks';
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length).replace(/^\//, '') : '';
  const target = `https://api.xstocks.fi/api/v2/public/${path}${search || ''}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(target, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);
    const data = await resp.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.status(resp.status).send(data);
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(502).json({ error: 'Proxy failed' });
  }
}
