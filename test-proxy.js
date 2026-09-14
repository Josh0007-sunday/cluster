import http from 'http';
import httpProxy from 'http-proxy';
const proxy = httpProxy.createProxyServer({});
proxy.on('proxyReq', (proxyReq) => {
  proxyReq.removeHeader('Origin');
  proxyReq.removeHeader('Referer');
});
http.createServer((req, res) => {
  proxy.web(req, res, { target: 'https://mainnet.helius-rpc.com/?api-key=3200c64d-9d5b-4975-9c12-d1ac26112a7b', changeOrigin: true });
}).listen(5174);
