// Mission Control v0.9 🦞 UI Polish: Flat Sidebar Menu
// Node HTTP server on port 3001

const http = require('http');


const { exec } = require('child_process');
const fs_module = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  // --- LiteLLM API Endpoints ---
  if (req.url.startsWith('/api/litellm/')) {
    const action = req.url.split('/')[3];
    const liteLlmDir = '/Users/openclaw/litellm';
    
    if (action === 'logs') {
      const logPath = path.join(liteLlmDir, 'litellm.log');
      exec(`tail -n 100 "${logPath}"`, (error, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ output: stdout || stderr || (error ? error.message : 'No logs found.') }));
      });
      return;
    }
    
    const commands = {
      'start': './launchd_start_LiteLLM.command',
      'kill': './kill_LiteLLM.command',
      'health': './health_LiteLLM.command',
      'ps': './ps_LiteLLM.command',
      'test': './testModel_LiteLLM.command',
      'open-log': 'open ./open_LiteLLM_Log.command'
    };
    
    if (commands[action]) {
      exec(commands[action], { cwd: liteLlmDir }, (error, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ output: stdout || stderr || (error ? error.message : 'Executed successfully.') }));
      });
      return;
    }
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Mission Control 🦞</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css" />
  <script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
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

    #sidebar.collapsed .menu-item {
      padding: 0.75rem 1rem;
    }
    
    /* Main Content */
    #main {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }

    .panel { display: none; }
    .panel.active { display: block; height: 100%; display: flex; flex-direction: column; }
    
    /* Dual Console Layout */
    .dashboard-grid {
      display: grid;
      grid-template-rows: auto 1fr 1fr;
      gap: 1rem;
      height: 100%;
      padding-bottom: 2rem;
    }
    
    .action-bar {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      background: rgba(0,0,0,0.2);
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(59,130,246,0.2);
    }
    body.light .action-bar {
      background: rgba(0,0,0,0.05);
      border-color: rgba(29,78,216,0.2);
    }
    
    .btn {
      background: rgba(59,130,246,0.2);
      color: var(--text-dark);
      border: 1px solid rgba(59,130,246,0.5);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn:hover { background: rgba(59,130,246,0.4); }
    body.light .btn {
      color: var(--text-light);
      background: rgba(29,78,216,0.1);
      border-color: rgba(29,78,216,0.4);
    }
    body.light .btn:hover { background: rgba(29,78,216,0.2); }
    
    .btn.danger { border-color: rgba(239,68,68,0.5); color: #ef4444; }
    .btn.danger:hover { background: rgba(239,68,68,0.2); }
    
    .btn.success { border-color: rgba(34,197,94,0.5); color: #22c55e; }
    .btn.success:hover { background: rgba(34,197,94,0.2); }
    
    .console-window {
      background: #0f172a;
      border: 1px solid rgba(59,130,246,0.3);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 150px;
    }
    body.light .console-window {
      background: #1e293b;
      color: #e2e8f0;
    }
    
    .console-header {
      background: rgba(0,0,0,0.5);
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #94a3b8;
      border-bottom: 1px solid rgba(59,130,246,0.2);
      display: flex;
      justify-content: space-between;
    }
    
    .console-body {
      padding: 1rem;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 0.85rem;
      color: #38bdf8;
      overflow-y: auto;
      flex: 1;
      white-space: pre-wrap;
      word-break: break-all;
    }
    
    .console-body.error { color: #f87171; }
    .console-body.log { color: #cbd5e1; }

    
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
        
        <button id="toggle-sidebar-btn" class="icon-btn" onclick="toggleSidebar()" title="Toggle Sidebar">☰</button>
      </div>
    </div>
    
    <div id="menu-container">
      <ul id="menu-items">
        <li class="menu-item active" data-panel="dashboard">
          <span class="icon">🚀</span>
          <span class="label">Dashboard</span>
        </li>
        <li class="menu-item" data-panel="openclaw">
          <span class="icon">⚙️</span>
          <span class="label">OpenClaw</span>
        </li>
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

        <li class="menu-item" data-panel="nodes">
          <span class="icon">🖥️</span>
          <span class="label">Nodes</span>
        </li>
        <li class="menu-item" data-panel="litellm">
          <span class="icon">🧠</span>
          <span class="label">LiteLLM</span>
        </li>

        <li class="menu-item" data-panel="projects">
          <span class="icon">📁</span>
          <span class="label">Projects</span>
        </li>
        <li class="menu-item" data-panel="mc-docs">
          <span class="icon">📚</span>
          <span class="label">Docs</span>
        </li>
        <li class="menu-item" data-panel="xterm">
          <span class="icon">🖥️</span>
          <span class="label">Xterm</span>
        </li>
      </ul>
    </div>
  </nav>
  
  <main id="main">
    <section id="dashboard" class="panel active">
      <h1>🚀 Mission Control v0.9</h1>
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
    
    <!-- LiteLLM Panel -->
    <section id="litellm" class="panel">
      <div class="dashboard-grid">
        <div class="action-bar">
          <button class="btn success" onclick="runLiteLLM('start')">▶ Start (launchd)</button>
          <button class="btn danger" onclick="runLiteLLM('kill')">⏹ Kill Server</button>
          <button class="btn" onclick="runLiteLLM('health')">🏥 Check Health</button>
          <button class="btn" onclick="runLiteLLM('ps')">📊 Process Status</button>
          <button class="btn" onclick="runLiteLLM('test')">🧪 Test Model</button>
          <button class="btn" onclick="runLiteLLM('open-log')">🪟 Open Log App</button>
        </div>
        
        <div class="console-window">
          <div class="console-header">
            <span>COMMAND OUTPUT</span>
            <span id="litellm-status">Idle</span>
          </div>
          <div class="console-body" id="litellm-output">Waiting for command...</div>
        </div>
        
        <div class="console-window">
          <div class="console-header">
            <span>litellm.log (Tailing)</span>
            <button class="icon-btn" style="width:24px;height:24px;font-size:0.8rem;" onclick="fetchLiteLLMLogs()" title="Refresh">🔄</button>
          </div>
          <div class="console-body log" id="litellm-logs">Loading logs...</div>
        </div>
      </div>
    </section>

    <section id="projects" class="panel"><h1>📁 Projects</h1><p>Overview.</p></section>
    <section id="mc-docs" class="panel"><h1>📚 Docs</h1><p>Coming.</p></section>
    <section id="xterm" class="panel">
      <div class="prefs-bar">
        <label>Font Size: <input type="range" id="fontSize" min="10" max="32" value="14" /></label>
        <label>Bg: <input type="color" id="bgColor" value="#0f172a" /></label>
        <label>Fg: <input type="color" id="fgColor" value="#38bdf8" /></label>
      </div>
      <div class="console-window" id="xtermContainer">
        <div id="xtermTerm"></div>
      </div>
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
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      localStorage.sidebarCollapsed = sidebar.classList.contains('collapsed');
    }
    

    



    // LiteLLM API Functions
    async function runLiteLLM(action) {
      const outputDiv = document.getElementById('litellm-output');
      const statusSpan = document.getElementById('litellm-status');
      
      outputDiv.textContent = 'Executing ./ ' + action + '_LiteLLM.command...';
      statusSpan.textContent = 'Running...';
      
      try {
        const response = await fetch('/api/litellm/' + action);
        const data = await response.json();
        outputDiv.textContent = data.output || 'No output.';
        statusSpan.textContent = 'Completed';
        setTimeout(fetchLiteLLMLogs, 1000);
      } catch (err) {
        outputDiv.textContent = 'Error: ' + err.message;
        statusSpan.textContent = 'Failed';
      }
    }
    
    async function fetchLiteLLMLogs() {
      const logsDiv = document.getElementById('litellm-logs');
      try {
        const response = await fetch('/api/litellm/logs');
        const data = await response.json();
        logsDiv.textContent = data.output;
        logsDiv.scrollTop = logsDiv.scrollHeight;
      } catch (err) {
        logsDiv.textContent = 'Failed to load logs: ' + err.message;
      }
    }
    
    setInterval(() => {
      const litellmPanel = document.getElementById('litellm');
      if (litellmPanel && litellmPanel.classList.contains('active')) {
        fetchLiteLLMLogs();
      }
    }, 5000);

    fetchLiteLLMLogs();

    let xtermTerm = null;

    function initXterm() {
      xtermTerm = new Terminal({
        fontSize: 14,
        theme: {
          background: '#0f172a',
          foreground: '#38bdf8'
        }
      });
      xtermTerm.open(document.getElementById('xtermTerm'));
      xtermTerm.onData((data) => {
        xtermTerm.write(data);
      });
      // Prefs listeners
      document.getElementById('fontSize').addEventListener('input', (e) => {
        xtermTerm.setOptions({ fontSize: parseInt(e.target.value) });
      });
      document.getElementById('bgColor').addEventListener('input', (e) => {
        const theme = xtermTerm.getOption('theme');
        xtermTerm.setOptions({ theme: { ...theme, background: e.target.value } });
      });
      document.getElementById('fgColor').addEventListener('input', (e) => {
        const theme = xtermTerm.getOption('theme');
        xtermTerm.setOptions({ theme: { ...theme, foreground: e.target.value } });
      });
    }

    // Event delegation for clicks

    document.addEventListener('click', (e) => {
      if (e.target.closest('.header-actions') || e.target.closest('.theme-toggle')) return;
      
      const item = e.target.closest('.menu-item');
      if (!item) return;

      document.querySelectorAll('.menu-item.active').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const panelId = item.dataset.panel;
      if (panelId) {
        document.querySelectorAll('.panel.active').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(panelId);
        if (panelId === 'xterm') initXterm();
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
      </script>
</body>
</html>
    `);
});

server.listen(3001, "0.0.0.0", () => {
  console.log("Mission Control v0.9 live: Flat Sidebar Menu!");
});
