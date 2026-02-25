// Mission Control Hello World v0.2 🦞 Dark/Light Toggle
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
      color: #ff6b35;
      transition: all 0.3s ease;
    }
    body.light {
      background: white;
      color: #333;
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
      background: rgba(255,107,53,0.2);
      color: #ff6b35;
      backdrop-filter: blur(10px);
    }
    body.light button {
      background: rgba(51,51,51,0.2);
      color: #333;
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
  <small>OpenClaw Dashboard v0.2 | Light/Dark Toggle ✓</small>
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
  console.log('Mission Control v0.2 live on http://0.0.0.0:3001 (Dark/Light toggle)');
});
