const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST = path.join(__dirname, 'dist');
const PORT = 5173;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function proxyReq(req, res) {
  const targetPath = req.url.replace(/^\/proxy\/backed/, '') || '/';
  try {
    const output = execSync(`curl -s -m 15 "https://api.backed.fi/api/v2/public${targetPath}"`, { timeout: 20000 });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(output);
  } catch (e) {
    if (!res.writableEnded) { res.writeHead(502); res.end(JSON.stringify({ error: e.message })); }
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/proxy')) { proxyReq(req, res); return; }
  const fp = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (fs.existsSync(fp)) {
    const ext = path.extname(fp);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(fp).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => console.log('Cluster server on port ' + PORT));
