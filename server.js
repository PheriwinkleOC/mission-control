// Mission Control v0.5 🦞 Outline-Style Sidebar Polish
// Single-widget chevron ►/▼, sidebar ←/→ toggle, Word-like indent

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
    #sidebar.collapsed { width: 64px; }
    .menu-toggle {
      width: 100%;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
    }
    .global-controls {
      padding: 0.5rem;
      display: flex;
      gap: 0.25rem;
      justify-content: center;
    }
    .global-btn {
      width: 32px;
      height: 32px;
      border: 1px solid currentColor;
      background: none;
      color: inherit;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0.7;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }
    .global-btn:hover { opacity: 1; }
    #menu-items {
      list-style: none;
    }
    .menu-item {
      padding: 0.75rem 1rem 0.75rem 3rem; /* indent base */
      cursor: pointer;
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .menu-item:hover { background: var(--bg-hover-dark); }
    body.light .menu-item:hover { background: var(--bg-hover-light); }
    .menu-item.active { background: rgba(59,130,246,0.3); }
    body.light .menu-item.active { background: rgba(29,78,216,0.3); }
    .icon { min-width: 24px; font-size: 1.1rem; flex-shrink: 0; }
    .label {
      flex: 1;
      white-space: nowrap;
      opacity: 1;
      transition: opacity 0.2s;
    }
    #sidebar.collapsed .label { opacity: 0; }
    .parent .chevron {
      position: absolute;
      left: 1rem;
      font-size: 0.8rem;
      transition: transform 0.2s ease;
      width: 20px;
      text-align: center;
    }
    .parent.open .chevron { transform: rotate(90deg); }
    .children .menu-item { padding-left: 4.5rem; } /* deeper indent for children */
    .children {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    .children.open { max-height: 1000px; }
    #main {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
    .panel { display: none; }
    .panel.active { display: block; }
    .theme-toggle {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 1000;
      width: 48px;
      height: 48px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      background: rgba(59,130,246,0.2);
      color: var(--text-dark);
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    }
    body.light .theme-toggle { background: rgba(29,78,216,0.2); color: var(--text-light); }
  </style>
</head>
<body>
  <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
  <nav id="sidebar">
    <button class="menu-toggle" onclick="toggleSidebar()">←</button>
    <div class="global-controls">
      <button class="global-btn" onclick="expandAll()" title="Expand All">📂</button>
      <button class="global-btn" onclick="collapseAll()" title="Collapse All">📁</button>
    </div>
    <ul id="menu-items">
      <li class="menu-item active" data-panel="dashboard" data-icon="🚀">
        <span class="chevron"></span>
        <span class="icon">🚀</span>
        <span class="label">Dashboard</span>
      </li>
      <li class="parent" data-icon="⚙️">
        <div class="menu-item" data-panel="openclaw" onclick="selectItem(this.parentElement); toggleParent(this)">
          <span class="chevron">►</span>
          <span class="icon">⚙️</span>
          <span class="label">OpenClaw</span>
        </div>
        <ul class="children">
          <li class="menu-item" data-panel="gateway" data-icon="🔌" onclick="selectItem(this)">
            <span class="icon">🔌</span>
            <span class="label">Gateway</span>
          </li>
          <li class="menu-item" data-panel="sessions" data-icon="📱" onclick="selectItem(this)">
            <span class="icon">📱</span>
            <span class="label">Sessions</span>
          </li>
          <li class="menu-item" data-panel="skills" data-icon="🛠️" onclick="selectItem(this)">
            <span class="icon">🛠️</span>
            <span class="label">Skills</span>
          </li>
        </ul>
      </li>
      <li class="menu-item" data-panel="nodes" data-icon="🖥️" onclick="selectItem(this)">
        <span class="icon">🖥️</span>
        <span class="label">Nodes</span>
      </li>
      <li class="parent" data-icon="📁">
        <div class="menu-item" data-panel="projects" onclick="selectItem(this.parentElement); toggleParent(this)">
          <span class="chevron">►</span>
          <span class="icon">📁</span>
          <span class="label">Projects</span>
        </div>
        <ul class="children">
          <li class="menu-item" data-panel="mc-docs" data-icon="📚" onclick="selectItem(this)">
            <span class="icon">📚</span>
            <span class="label">Docs</span>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
  <main id="main">
    <!-- panels same as before -->
    <section id="dashboard" class="panel active">
      <h1>🚀 Mission Control v0.5</h1>
      <p>Word-style outline sidebar: ►/▼ single-click expand, deeper indent, ←/→ sweep.</p>
    </section>
    <section id="openclaw" class="panel">
      <h1>⚙️ OpenClaw Overview</h1>
      <p>Parent panel example.</p>
    </section>
    <section id="gateway" class="panel">
      <h1>🔌 Gateway</h1>
      <p>Status coming live.</p>
    </section>
    <!-- etc, same -->
    <section id="sessions" class="panel"><h1>📱 Sessions</h1><p>List/spawn.</p></section>
    <section id="skills" class="panel"><h1>🛠️ Skills</h1><p>Browser.</p></section>
    <section id="nodes" class="panel"><h1>🖥️ Nodes</h1><p>Control.</p></section>
    <section id="projects" class="panel"><h1>📁 Projects</h1><p>Overview.</p></section>
    <section id="mc-docs" class="panel"><h1>📚 Docs</h1><p>Coming.</p></section>
  </main>
  <script>
    function toggleTheme() {
      document.body.classList.toggle('light');
      localStorage.theme = document.body.classList.contains('light') ? 'light' : 'dark';
      document.querySelector('.theme-toggle').textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
    }
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.sidebarCollapsed = isCollapsed;
      document.querySelector('.menu-toggle').textContent = isCollapsed ? '→' : '←';
    }
    function toggleParent(target) {
      target.closest('.parent').classList.toggle('open');
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
      document.getElementById(panelId)?.classList.add('active');
    }
    // Listeners
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.menu-item');
      if (item) selectItem(item);
      const parentChevron = e.target.closest('.parent .chevron');
      if (parentChevron) toggleParent(parentChevron);
    });
    // Load state
    if (localStorage.theme === 'light') toggleTheme();
    if (localStorage.sidebarCollapsed === 'true') toggleSidebar();
  </script>
</body>
</html>
  `);
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Mission Control v0.5 live: Word-outline polish - ►/▼ single, ←/→ toggle, indent!');
});
