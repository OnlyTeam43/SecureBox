// server.js - Lightweight zero-dependency static server with SPA fallback
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
// Prefer dist/ if compiled from React + TypeScript, otherwise fallback to root
const ROOT = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
  ? path.join(__dirname, 'dist')
  : __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=UTF-8',
};

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0].split('#')[0];
  if (cleanUrl.endsWith('/')) cleanUrl += 'index.html';

  let filePath = path.join(ROOT, cleanUrl);

  // SPA fallback to index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Server Error');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 SecureBox (React + TypeScript) is LIVE!`);
  console.log(`  Serving from: ${ROOT}`);
  console.log(`======================================================`);
  console.log(`  Local URL:   http://localhost:${PORT}`);

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  Network URL: http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log(`======================================================\n`);
});
