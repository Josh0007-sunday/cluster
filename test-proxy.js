import http from 'http';
import httpProxy from 'http-proxy';
const proxy = httpProxy.createProxyServer({});
proxy.on('proxyReq', (proxyReq) => {
  proxyReq.removeHeader('Origin');
  proxyReq.removeHeader('Referer');
});
const apiKey = process.env.HELUS_API_KEY || '';
http.createServer((req, res) => {
  const targetUrl = apiKey
    ? `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
    : 'https://mainnet.helius-rpc.com/';
  proxy.web(req, res, { target: targetUrl, changeOrigin: true });
}).listen(5174);
