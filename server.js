// Mission Control v0.3 🦞 Blue Theme
// Node HTTP server on port 3001

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Mission Control 🦞</title>
  <style>
    body {
      font-family: system-ui;
      text-align: center;
      padding: 5rem;
      background: #000;
      color: #3b82f6;
      transition: all 0.3s ease;
    }
    body.light {
      background: white;
      color: #1d4ed8;
    }
    button {
      position: fixed;
      top: 1rem;
      right: 1rem;
      padding: 0.5rem 1rem;
      font-size: 1.2rem;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      background: rgba(59,130,246,0.2);
      color: #3b82f6;
      backdrop-filter: blur(10px);
    }
    body.light button {
      background: rgba(29,78,216,0.2);
      color: #1d4ed8;
    }
    a { color: inherit; }
  </style>
</head>
<body>
  <button id="theme-toggle" onclick="toggleTheme()">🌙</button>
  <h1>🚀 Mission Control Active</h1>
  <p>Port 3001 | Local: <a href="http://localhost:3001">localhost:3001</a></p>
  <p>Tailscale ready—access via your TS IP:3001</p>
  <hr>
  <small>OpenClaw Dashboard v0.3 | Blue Theme ✓</small>
  <script>
    function toggleTheme() {
      document.body.classList.toggle('light');
      const isLight = document.body.classList.contains('light');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      document.getElementById('theme-toggle').textContent = isLight ? '☀️' : '🌙';
    }
    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light');
      document.getElementById('theme-toggle').textContent = '☀️';
    }
  </script>
</body>
</html>
  `);
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Mission Control v0.3 live on http://0.0.0.0:3001 (Blue theme)');
});
