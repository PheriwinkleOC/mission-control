// Mission Control v0.4 🦞 Hierarchical Sidebar Menu
// Node HTTP server on port 3001 - Vanilla JS/CSS

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Mission Control 🦞</title>
  <style>
    :root {
      --bg-dark: #000;
      --bg-light: white;
      --text-dark: #3b82f6;
      --text-light: #1d4ed8;
      --bg-hover-dark: rgba(59,130,246,0.1);
      --bg-hover-light: rgba(29,78,216,0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      height: 100vh;
      display: flex;
      background: var(--bg-dark);
      color: var(--text-dark);
      transition: all 0.3s ease;
      overflow: hidden;
    }
    body.light {
      background: var(--bg-light);
      color: var(--text-light);
    }
    #sidebar {
      width: 280px;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(20px);
      transition: width 0.3s ease;
      overflow-y: auto;
      border-right: 1px solid rgba(59,130,246,0.3);
    }
    body.light #sidebar { background: rgba(255,255,255,0.9); border-right-color: rgba(29,78,216,0.3); }
    #sidebar.collapsed {
      width: 64px;
    }
    .menu-toggle {
      width: 100%;
      padding: 1rem;
      text-align: center;
      font-size: 1.5rem;
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
    }
    .global-controls {
      padding: 0.5rem 1rem;
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      font-size: 0.8rem;
    }
    .global-btn {
      padding: 0.25rem 0.5rem;
      border: 1px solid currentColor;
      background: none;
      color: inherit;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0.7;
    }
    .global-btn:hover { opacity: 1; }
    #menu-items {
      list-style: none;
    }
    .menu-item {
      padding: 0.75rem 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      position: relative;
    }
    .menu-item:hover {
      background: var(--bg-hover-dark);
    }
    body.light .menu-item:hover { background: var(--bg-hover-light); }
    .menu-item.active { background: rgba(59,130,246,0.3); }
    body.light .menu-item.active { background: rgba(29,78,216,0.3); }
    .icon { min-width: 24px; font-size: 1.2rem; }
    .label {
      white-space: nowrap;
      opacity: 1;
      transition: opacity 0.2s;
    }
    #sidebar.collapsed .label { opacity: 0; }
    .parent > .menu-item::after {
      content: '▽';
      position: absolute;
      right: 1rem;
      font-size: 0.8rem;
      transition: transform 0.2s;
    }
    .parent.open > .menu-item::after { transform: rotate(90deg); }
    .children {
      list-style: none;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    .children.open { max-height: 500px; /* adjust as needed */ }
    .children .menu-item { padding-left: 2.5rem; }
    #main {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
    .panel {
      display: none;
    }
    .panel.active { display: block; }
    .theme-toggle {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 1000;
      padding: 0.5rem;
      font-size: 1.5rem;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      background: rgba(59,130,246,0.2);
      backdrop-filter: blur(10px);
    }
    body.light .theme-toggle { background: rgba(29,78,216,0.2); }
  </style>
</head>
<body>
  <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
  <nav id="sidebar">
    <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
    <div class="global-controls">
      <button class="global-btn" onclick="expandAll()">📂</button>
      <button class="global-btn" onclick="collapseAll()">📁</button>
    </div>
    <ul id="menu-items">
      <li class="menu-item active" data-panel="dashboard" data-icon="🚀">
        <span class="icon">🚀</span>
        <span class="label">Dashboard</span>
      </li>
      <li class="parent menu-item" data-icon="⚙️">
        <span class="icon">⚙️</span>
        <span class="label">OpenClaw</span>
        <ul class="children">
          <li class="menu-item" data-panel="gateway" data-icon="🔌"><span class="icon">🔌</span><span class="label">Gateway</span></li>
          <li class="menu-item" data-panel="sessions" data-icon="📱"><span class="icon">📱</span><span class="label">Sessions</span></li>
          <li class="menu-item" data-panel="skills" data-icon="🛠️"><span class="icon">🛠️</span><span class="label">Skills</span></li>
        </ul>
      </li>
      <li class="menu-item" data-panel="nodes" data-icon="🖥️">
        <span class="icon">🖥️</span>
        <span class="label">Nodes</span>
      </li>
      <li class="parent menu-item" data-icon="📁">
        <span class="icon">📁</span>
        <span class="label">Projects</span>
        <ul class="children">
          <li class="menu-item" data-panel="mc-docs" data-icon="📚"><span class="icon">📚</span><span class="label">Docs</span></li>
        </ul>
      </li>
    </ul>
  </nav>
  <main id="main">
    <section id="dashboard" class="panel active">
      <h1>🚀 Mission Control</h1>
      <p>Welcome. Sidebar hierarchy loaded—test expands, global toggle, sweep collapse (icons persist).</p>
    </section>
    <section id="gateway" class="panel">
      <h1>🔌 Gateway Status</h1>
      <p>Live openclaw gateway status here (dynamic next).</p>
    </section>
    <section id="sessions" class="panel">
      <h1>📱 Sessions</h1>
      <p>Session list/spawn.</p>
    </section>
    <section id="skills" class="panel">
      <h1>🛠️ Skills</h1>
      <p>Skill browser/install.</p>
    </section>
    <section id="nodes" class="panel">
      <h1>🖥️ Nodes</h1>
      <p>Node control.</p>
    </section>
    <section id="mc-docs" class="panel">
      <h1>📚 Project Docs</h1>
      <p>Mission Control docs.</p>
    </section>
  </main>
  <script>
    function toggleTheme() {
      document.body.classList.toggle('light');
      const isLight = document.body.classList.contains('light');
      localStorage.theme = isLight ? 'light' : 'dark';
      document.querySelector('.theme-toggle').textContent = isLight ? '☀️' : '🌙';
    }
    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('collapsed');
      localStorage.sidebarCollapsed = document.getElementById('sidebar').classList.contains('collapsed');
    }
    function toggleParent(el) {
      el.parentElement.classList.toggle('open');
    }
    function expandAll() {
      document.querySelectorAll('.children').forEach(c => c.classList.add('open'));
    }
    function collapseAll() {
      document.querySelectorAll('.children').forEach(c => c.classList.remove('open'));
    }
    function selectItem(item) {
      document.querySelectorAll('.menu-item.active').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const panelId = item.dataset.panel;
      document.querySelectorAll('.panel.active').forEach(p => p.classList.remove('active'));
      document.getElementById(panelId).classList.add('active');
    }
    // Event listeners
    document.querySelectorAll('.menu-item:not(.parent) .menu-item, .parent .menu-item').forEach(item => {
      item.addEventListener('click', () => selectItem(item));
    });
    document.querySelectorAll('.parent > .menu-item').forEach(parent => {
      parent.querySelector('span').addEventListener('click', (e) => {
        e.stopPropagation();
        parent.parentElement.classList.toggle('open');
      });
    });
    // Load state
    if (localStorage.theme === 'light') toggleTheme();
    if (localStorage.sidebarCollapsed === 'true') {
      document.getElementById('sidebar').classList.add('collapsed');
    }
    // Persist parent states (simple: all closed on load, toggle saves per? Skip for v0.4)
  </script>
</body>
</html>
  `);
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Mission Control v0.4 live: Hierarchical sidebar w/ collapse/expand/sweep!');
});
