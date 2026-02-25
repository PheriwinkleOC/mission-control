// Mission Control Hello World 🦞
// Node HTTP server on port 3001

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Mission Control 🦞</title>
  <style>body { font-family: system-ui; text-align: center; padding: 5rem; background: #000; color: #ff6b35; }</style>
</head>
<body>
  <h1>🚀 Mission Control Active</h1>
  <p>Port 3001 | Local: <a href="http://localhost:3001" style="color: #ff6b35;">localhost:3001</a></p>
  <p>Tailscale ready—access via your TS IP:3001</p>
  <hr>
  <small>OpenClaw Dashboard v0.1</small>
</body>
</html>
  `);
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Mission Control live on http://0.0.0.0:3001');
});
