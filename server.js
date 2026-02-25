// Mission Control v0.8 🦞 UI Polish: Standard Header, Single Toggle
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
    
    /* Sidebar Base */
    #sidebar {
      width: 280px;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(20px);
      transition: width 0.3s ease;
      display: flex;
      flex-direction: column;
      border-right: 1px solid rgba(59,130,246,0.3);
      z-index: 100;
    }
    body.light #sidebar { background: rgba(255,255,255,0.9); border-right-color: rgba(29,78,216,0.3); }
    #sidebar.collapsed { width: 64px; }
    
    /* Sidebar Header */
    .sidebar-header {
      height: 60px;
      display: flex;
      align-items: center;
      padding: 0 1rem;
      justify-content: space-between;
      border-bottom: 1px solid rgba(59,130,246,0.3);
      flex-shrink: 0;
    }
    body.light .sidebar-header { border-bottom-color: rgba(29,78,216,0.3); }
    
    .sidebar-header .logo-text {
      font-weight: 600;
      font-size: 1.1rem;
      white-space: nowrap;
      opacity: 1;
      transition: opacity 0.2s ease;
      overflow: hidden;
    }
    #sidebar.collapsed .sidebar-header .logo-text {
      opacity: 0;
      width: 0;
    }
    
    .header-actions {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }
    #sidebar.collapsed .header-actions {
      width: 100%;
      justify-content: center;
    }
    
    .icon-btn {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-size: 1.2rem;
      transition: background 0.2s;
    }
    .icon-btn:hover { background: var(--bg-hover-dark); }
    body.light .icon-btn:hover { background: var(--bg-hover-light); }
    
    #sidebar.collapsed #toggle-all-btn {
      display: none;
    }
    
    /* Menu Items */
    #menu-container {
      flex: 1;
      overflow-y: auto;
      padding-top: 0.5rem;
    }
    #menu-items {
      list-style: none;
    }
    .menu-item {
      padding: 0.75rem 1rem 0.75rem 3.5rem;
      cursor: pointer;
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      user-select: none;
    }
    .menu-item:hover { background: var(--bg-hover-dark); }
    body.light .menu-item:hover { background: var(--bg-hover-light); }
    .menu-item.active { background: rgba(59,130,246,0.3); }
    body.light .menu-item.active { background: rgba(29,78,216,0.3); }
    
    .icon { min-width: 24px; font-size: 1.2rem; flex-shrink: 0; text-align: center; }
    .label {
      flex: 1;
      white-space: nowrap;
      opacity: 1;
      transition: opacity 0.2s;
    }
    #sidebar.collapsed .label { opacity: 0; }
    
    /* Chevron logic */
    .parent .chevron {
      position: absolute;
      left: 1.1rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.75rem;
      transition: transform 0.2s ease;
      display: inline-block;
      pointer-events: none;
    }
    .parent.open > .menu-item .chevron {
      transform: translateY(-50%) rotate(90deg);
    }
    
    .children {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    .parent.open > .children { max-height: 1000px; }
    .children .menu-item { padding-left: 5rem; }
    
    /* Main Content */
    #main {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
    .panel { display: none; }
    .panel.active { display: block; }
    
    /* Theme Toggle */
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
  <button class="theme-toggle" onclick="toggleTheme()" title="Toggle Theme">🌙</button>
  
  <nav id="sidebar">
    <div class="sidebar-header">
      <span class="logo-text">Mission Control 🦞</span>
      <div class="header-actions">
        <button id="toggle-all-btn" class="icon-btn" onclick="toggleAllParents()" title="Expand All">📂</button>
        <button id="toggle-sidebar-btn" class="icon-btn" onclick="toggleSidebar()" title="Toggle Sidebar">☰</button>
      </div>
    </div>
    
    <div id="menu-container">
      <ul id="menu-items">
        <li class="menu-item active" data-panel="dashboard">
          <span class="icon">🚀</span>
          <span class="label">Dashboard</span>
        </li>
        <li class="parent" data-panel="openclaw">
          <div class="menu-item">
            <span class="chevron">►</span>
            <span class="icon">⚙️</span>
            <span class="label">OpenClaw</span>
          </div>
          <ul class="children">
            <li class="menu-item" data-panel="gateway">
              <span class="icon">🔌</span>
              <span class="label">Gateway</span>
            </li>
            <li class="menu-item" data-panel="sessions">
              <span class="icon">📱</span>
              <span class="label">Sessions</span>
            </li>
            <li class="menu-item" data-panel="skills">
              <span class="icon">🛠️</span>
              <span class="label">Skills</span>
            </li>
          </ul>
        </li>
        <li class="menu-item" data-panel="nodes">
          <span class="icon">🖥️</span>
          <span class="label">Nodes</span>
        </li>
        <li class="parent" data-panel="projects">
          <div class="menu-item">
            <span class="chevron">►</span>
            <span class="icon">📁</span>
            <span class="label">Projects</span>
          </div>
          <ul class="children">
            <li class="menu-item" data-panel="mc-docs">
              <span class="icon">📚</span>
              <span class="label">Docs</span>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </nav>
  
  <main id="main">
    <section id="dashboard" class="panel active">
      <h1>🚀 Mission Control v0.8</h1>
      <p>Industry-standard layout: Header with Hamburger (☰) and single Expand/Collapse toggle (📂/📁) tightly grouped.</p>
    </section>
    <section id="openclaw" class="panel">
      <h1>⚙️ OpenClaw Overview</h1>
      <p>Select a child item for details.</p>
    </section>
    <section id="gateway" class="panel">
      <h1>🔌 Gateway</h1>
      <p>Status coming live.</p>
    </section>
    <section id="sessions" class="panel"><h1>📱 Sessions</h1><p>List/spawn.</p></section>
    <section id="skills" class="panel"><h1>🛠️ Skills</h1><p>Browser.</p></section>
    <section id="nodes" class="panel"><h1>🖥️ Nodes</h1><p>Control.</p></section>
    <section id="projects" class="panel"><h1>📁 Projects</h1><p>Overview.</p></section>
    <section id="mc-docs" class="panel"><h1>📚 Docs</h1><p>Coming.</p></section>
  </main>
  
  <script>
    function toggleTheme() {
      document.body.classList.toggle('light');
      const isLight = document.body.classList.contains('light');
      localStorage.theme = isLight ? 'light' : 'dark';
      document.querySelector('.theme-toggle').textContent = isLight ? '☀️' : '🌙';
    }
    
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      localStorage.sidebarCollapsed = sidebar.classList.contains('collapsed');
    }
    
    function toggleAllParents() {
      const parents = document.querySelectorAll('.parent');
      const anyClosed = Array.from(parents).some(p => !p.classList.contains('open'));
      
      if (anyClosed) {
        parents.forEach(p => p.classList.add('open'));
      } else {
        parents.forEach(p => p.classList.remove('open'));
      }
      updateToggleAllButton();
    }
    
    function updateToggleAllButton() {
      const parents = document.querySelectorAll('.parent');
      const anyClosed = Array.from(parents).some(p => !p.classList.contains('open'));
      const btn = document.getElementById('toggle-all-btn');
      
      if (anyClosed) {
        btn.textContent = '📂';
        btn.title = 'Expand All';
      } else {
        btn.textContent = '📁';
        btn.title = 'Collapse All';
      }
    }

    // Event delegation for clicks
    document.addEventListener('click', (e) => {
      // Don't interfere with the header buttons
      if (e.target.closest('.header-actions') || e.target.closest('.theme-toggle')) return;
      
      const item = e.target.closest('.menu-item');
      if (!item) return;

      // Handle selection and panel switching
      document.querySelectorAll('.menu-item.active').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const parent = item.closest('.parent');
      
      // If we clicked the parent's top-level menu-item, toggle the children
      if (parent && parent.firstElementChild === item) {
        parent.classList.toggle('open');
        updateToggleAllButton();
      }

      // Show panel
      const panelId = item.dataset.panel || (parent && parent.dataset.panel);
      if (panelId) {
        document.querySelectorAll('.panel.active').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');
      }
    });

    // Initial Load state
    if (localStorage.theme === 'light') {
      document.body.classList.add('light');
      document.querySelector('.theme-toggle').textContent = '☀️';
    }
    if (localStorage.sidebarCollapsed === 'true') {
      document.getElementById('sidebar').classList.add('collapsed');
    }
    updateToggleAllButton();
  </script>
</body>
</html>
  