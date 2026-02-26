// Mission Control v1.0 🦞 Real Shell Terminal + Pro Toolbar
const http = require('http');
const { exec } = require('child_process');
const fs_module = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');

const server = http.createServer((req, res) => {
  // --- LiteLLM API Endpoints ---
  if (req.url.startsWith('/api/litellm/')) {
    const action = req.url.split('/')[3];
    const liteLlmDir = '/Users/openclaw/litellm';

    if (action === 'logs') {
      const logPath = path.join(liteLlmDir, 'litellm.log');
      exec('tail -n 100 "' + logPath + '"', (error, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ output: stdout || stderr || (error ? error.message : 'No logs found.') }));
      });
      return;
    }

    const commands = {
      'start':    './launchd_start_LiteLLM.command',
      'kill':     './kill_LiteLLM.command',
      'health':   './health_LiteLLM.command',
      'ps':       './ps_LiteLLM.command',
      'test':     './testModel_LiteLLM.command',
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
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
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
    body.light { background: var(--bg-light); color: var(--text-light); }

    /* ── Sidebar ─────────────────────────────────────── */
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
    #sidebar.collapsed .sidebar-header .logo-text { opacity: 0; width: 0; }

    .header-actions { display: flex; gap: 0.25rem; align-items: center; }
    #sidebar.collapsed .header-actions { width: 100%; justify-content: center; }

    .icon-btn {
      background: none; border: none; color: inherit; cursor: pointer;
      width: 36px; height: 36px; display: flex; align-items: center;
      justify-content: center; border-radius: 6px; font-size: 1.2rem;
      transition: background 0.2s;
    }
    .icon-btn:hover { background: var(--bg-hover-dark); }
    body.light .icon-btn:hover { background: var(--bg-hover-light); }

    /* ── Menu ────────────────────────────────────────── */
    #menu-container { flex: 1; overflow-y: auto; padding-top: 0.5rem; }
    #menu-items { list-style: none; }
    .menu-item {
      padding: 0.75rem 1rem 0.75rem 3.5rem;
      cursor: pointer; position: relative;
      display: flex; align-items: center; gap: 0.75rem; user-select: none;
    }
    .menu-item:hover { background: var(--bg-hover-dark); }
    body.light .menu-item:hover { background: var(--bg-hover-light); }
    .menu-item.active { background: rgba(59,130,246,0.3); }
    body.light .menu-item.active { background: rgba(29,78,216,0.3); }
    .icon { min-width: 24px; font-size: 1.2rem; flex-shrink: 0; text-align: center; }
    .label { flex: 1; white-space: nowrap; opacity: 1; transition: opacity 0.2s; }
    #sidebar.collapsed .label { opacity: 0; }
    #sidebar.collapsed .menu-item { padding: 0.75rem 1rem; }

    /* ── Main Content ────────────────────────────────── */
    #main { flex: 1; padding: 2rem; overflow-y: auto; }
    #main.terminal-active { padding: 8px; overflow: hidden; }

    .panel { display: none; }
    .panel.active { display: flex; flex-direction: column; height: 100%; }

    /* ── LiteLLM Panel ───────────────────────────────── */
    .dashboard-grid {
      display: grid; grid-template-rows: auto 1fr 1fr;
      gap: 1rem; height: 100%; padding-bottom: 2rem;
    }
    .action-bar {
      display: flex; gap: 0.5rem; flex-wrap: wrap;
      background: rgba(0,0,0,0.2); padding: 1rem;
      border-radius: 8px; border: 1px solid rgba(59,130,246,0.2);
    }
    body.light .action-bar { background: rgba(0,0,0,0.05); border-color: rgba(29,78,216,0.2); }

    .btn {
      background: rgba(59,130,246,0.2); color: var(--text-dark);
      border: 1px solid rgba(59,130,246,0.5); padding: 0.5rem 1rem;
      border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s;
    }
    .btn:hover { background: rgba(59,130,246,0.4); }
    body.light .btn { color: var(--text-light); background: rgba(29,78,216,0.1); border-color: rgba(29,78,216,0.4); }
    body.light .btn:hover { background: rgba(29,78,216,0.2); }
    .btn.danger { border-color: rgba(239,68,68,0.5); color: #ef4444; }
    .btn.danger:hover { background: rgba(239,68,68,0.2); }
    .btn.success { border-color: rgba(34,197,94,0.5); color: #22c55e; }
    .btn.success:hover { background: rgba(34,197,94,0.2); }

    .console-window {
      background: #0f172a; border: 1px solid rgba(59,130,246,0.3);
      border-radius: 8px; display: flex; flex-direction: column;
      overflow: hidden; min-height: 150px;
    }
    body.light .console-window { background: #1e293b; color: #e2e8f0; }
    .console-header {
      background: rgba(0,0,0,0.5); padding: 0.5rem 1rem;
      font-size: 0.85rem; font-weight: 600; color: #94a3b8;
      border-bottom: 1px solid rgba(59,130,246,0.2);
      display: flex; justify-content: space-between;
    }
    .console-body {
      padding: 1rem; font-family: 'Menlo','Monaco','Courier New',monospace;
      font-size: 0.85rem; color: #38bdf8; overflow-y: auto;
      flex: 1; white-space: pre-wrap; word-break: break-all;
    }
    .console-body.error { color: #f87171; }
    .console-body.log   { color: #cbd5e1; }

    /* ── Sidebar Footer (theme toggle) ──────────────────── */
    .sidebar-footer {
      flex-shrink: 0;
      border-top: 1px solid rgba(59,130,246,0.3);
      padding: 0.5rem 0;
    }
    body.light .sidebar-footer { border-top-color: rgba(29,78,216,0.3); }
    .theme-toggle-btn {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 1rem;
      display: flex; align-items: center; gap: 0.75rem;
      background: none; border: none; color: inherit;
      cursor: pointer; text-align: left; user-select: none;
      -webkit-appearance: none; appearance: none;
      transition: background 0.2s;
    }
    .theme-toggle-btn:hover { background: var(--bg-hover-dark); }
    body.light .theme-toggle-btn:hover { background: var(--bg-hover-light); }
    .theme-toggle-btn .icon {
      min-width: 24px; font-size: 1.2rem;
      flex-shrink: 0; text-align: center; display: block;
    }
    #sidebar.collapsed .theme-toggle-btn { justify-content: center; }
    #sidebar.collapsed .theme-toggle-btn .label { opacity: 0; width: 0; overflow: hidden; }

    /* ── Terminal Panel ──────────────────────────────── */
    #xterm.panel.active {
      background: #1c1c1e;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 6px 40px rgba(0,0,0,0.7);
    }

    /* Toolbar */
    .term-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      background: linear-gradient(180deg, #3d3d3f 0%, #2c2c2e 100%);
      border-bottom: 1px solid #111;
      flex-shrink: 0;
      min-height: 46px;
      user-select: none;
    }

    /* Terminal action buttons */
    .term-actions { display: flex; gap: 4px; align-items: center; }
    .term-act-btn {
      background: rgba(255,255,255,0.07); color: #ccc;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 5px;
      padding: 3px 9px; font-size: 0.75rem; cursor: pointer;
      transition: background 0.12s, color 0.12s; white-space: nowrap;
    }
    .term-act-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
    .term-act-btn.danger:hover { background: rgba(239,68,68,0.25); color: #fca5a5; border-color: rgba(239,68,68,0.4); }

    .toolbar-sep {
      width: 1px; height: 22px;
      background: rgba(255,255,255,0.12); flex-shrink: 0;
    }

    .toolbar-lbl {
      font-size: 0.67rem; color: #888;
      text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap;
    }

    .toolbar-grp { display: flex; align-items: center; gap: 5px; }

    /* Profile dropdown */
    .profile-sel {
      background: rgba(255,255,255,0.07); color: #ddd;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 5px;
      padding: 3px 22px 3px 7px; font-size: 0.78rem; cursor: pointer;
      outline: none; -webkit-appearance: none; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 6px center;
      background-size: 8px 5px;
    }
    .profile-sel:hover { background-color: rgba(255,255,255,0.12); }
    .profile-sel option { background: #2c2c2e; color: #ddd; }

    /* Color swatch button */
    .swatch-btn {
      width: 30px; height: 22px; border-radius: 5px;
      border: 1.5px solid rgba(255,255,255,0.28); cursor: pointer; padding: 0;
      transition: border-color 0.12s, transform 0.1s; outline: none;
    }
    .swatch-btn:hover { border-color: rgba(255,255,255,0.7); transform: scale(1.08); }

    /* Font size control */
    .fs-ctrl {
      display: flex; align-items: center;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.13);
      border-radius: 5px; overflow: hidden;
    }
    .fs-btn {
      background: none; border: none; color: #ccc;
      cursor: pointer; font-size: 1rem; width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.1s; line-height: 1;
    }
    .fs-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .fs-val {
      font-size: 0.78rem; color: #ddd; min-width: 28px; text-align: center;
      border-left: 1px solid rgba(255,255,255,0.1);
      border-right: 1px solid rgba(255,255,255,0.1);
      padding: 0 2px; height: 24px;
      display: flex; align-items: center; justify-content: center;
    }

    /* Clear button */
    .toolbar-clear {
      margin-left: auto;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.13);
      color: #999; border-radius: 5px; padding: 3px 10px;
      font-size: 0.75rem; cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .toolbar-clear:hover { background: rgba(255,255,255,0.13); color: #eee; }

    /* ── Swatch Picker Popup ─────────────────────────── */
    .swatch-popup {
      position: fixed;
      background: #2a2a2c;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 10px;
      padding: 10px;
      z-index: 9999;
      box-shadow: 0 12px 48px rgba(0,0,0,0.75);
      display: none;
    }
    .swatch-popup.open { display: block; }
    .swatch-popup-lbl {
      font-size: 0.66rem; color: #777;
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;
    }
    .swatch-grid {
      display: grid; grid-template-columns: repeat(8, 22px); gap: 3px;
    }
    .sw {
      width: 22px; height: 22px; border-radius: 4px; cursor: pointer;
      border: 1.5px solid transparent;
      transition: transform 0.1s, border-color 0.1s;
    }
    .sw:hover { transform: scale(1.2); border-color: rgba(255,255,255,0.75); z-index: 1; position: relative; }
    .sw.active { border-color: #fff; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.45); }

    /* ── Terminal Body ───────────────────────────────── */
    .term-body {
      flex: 1; min-height: 0; overflow: hidden;
      position: relative; background: #0f172a;
    }
    #xtermTerm {
      position: absolute; top: 0; right: 0; bottom: 0; left: 0;
    }
    .xterm { height: 100% !important; }

    /* ── Status Bar ──────────────────────────────────── */
    .term-statusbar {
      display: flex; align-items: center; gap: 8px;
      padding: 3px 14px; background: #1a1a1c;
      border-top: 1px solid rgba(255,255,255,0.07);
      font-size: 0.7rem; color: #555; flex-shrink: 0;
      font-family: 'Menlo','Monaco',monospace;
    }
    .status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #555; flex-shrink: 0;
    }
    .status-dot.on  { background: #28c840; box-shadow: 0 0 4px #28c840; }
    .status-dot.off { background: #ff5f57; }
  </style>
</head>
<body>
  <nav id="sidebar">
    <div class="sidebar-header">
      <span class="logo-text">Mission Control 🦞</span>
      <div class="header-actions">
        <button id="toggle-sidebar-btn" class="icon-btn" onclick="toggleSidebar()" title="Toggle Sidebar">☰</button>
      </div>
    </div>
    <div id="menu-container">
      <ul id="menu-items">
        <li class="menu-item active" data-panel="dashboard"><span class="icon">🚀</span><span class="label">Dashboard</span></li>
        <li class="menu-item" data-panel="openclaw"><span class="icon">⚙️</span><span class="label">OpenClaw</span></li>
        <li class="menu-item" data-panel="gateway"><span class="icon">🔌</span><span class="label">Gateway</span></li>
        <li class="menu-item" data-panel="sessions"><span class="icon">📱</span><span class="label">Sessions</span></li>
        <li class="menu-item" data-panel="skills"><span class="icon">🛠️</span><span class="label">Skills</span></li>
        <li class="menu-item" data-panel="nodes"><span class="icon">🖥️</span><span class="label">Nodes</span></li>
        <li class="menu-item" data-panel="litellm"><span class="icon">🧠</span><span class="label">LiteLLM</span></li>
        <li class="menu-item" data-panel="projects"><span class="icon">📁</span><span class="label">Projects</span></li>
        <li class="menu-item" data-panel="mc-docs"><span class="icon">📚</span><span class="label">Docs</span></li>
        <li class="menu-item" data-panel="xterm"><span class="icon" style="font-family:monospace;font-weight:700;">&gt;_</span><span class="label">Terminal</span></li>
      </ul>
    </div>
    <div class="sidebar-footer">
      <button class="theme-toggle-btn" id="themeToggleBtn" onclick="toggleTheme()">
        <span class="icon">🌙</span>
        <span class="label">Dark Mode</span>
      </button>
    </div>
  </nav>

  <main id="main">
    <section id="dashboard" class="panel active">
      <h1>🚀 Mission Control v1.0</h1>
      <p>Real shell terminal with professional controls.</p>
    </section>
    <section id="openclaw" class="panel"><h1>⚙️ OpenClaw Overview</h1><p>Select a child item for details.</p></section>
    <section id="gateway" class="panel"><h1>🔌 Gateway</h1><p>Status coming live.</p></section>
    <section id="sessions" class="panel"><h1>📱 Sessions</h1><p>List/spawn.</p></section>
    <section id="skills" class="panel"><h1>🛠️ Skills</h1><p>Browser.</p></section>
    <section id="nodes" class="panel"><h1>🖥️ Nodes</h1><p>Control.</p></section>

    <!-- LiteLLM Panel -->
    <section id="litellm" class="panel">
      <div class="dashboard-grid">
        <div class="action-bar">
          <button class="btn success" onclick="runLiteLLM('start')">▶ Start (launchd)</button>
          <button class="btn danger"  onclick="runLiteLLM('kill')">⏹ Kill Server</button>
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
    <section id="mc-docs"   class="panel"><h1>📚 Docs</h1><p>Coming.</p></section>

    <!-- Terminal Panel -->
    <section id="xterm" class="panel">
      <!-- Toolbar -->
      <div class="term-toolbar">
        <!-- Terminal actions -->
        <div class="term-actions">
          <button class="term-act-btn danger" onclick="killTerminal()">Disconnect</button>
          <button class="term-act-btn"        onclick="clearTerminal()">Clear</button>
          <button class="term-act-btn"        onclick="reconnectTerminal()">Reconnect</button>
        </div>

        <div class="toolbar-sep"></div>

        <!-- Profile -->
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Profile</span>
          <select class="profile-sel" id="termProfile" onchange="applyProfile(this.value)">
            <option value="" style="color:#555">&#8212; Custom &#8212;</option>
            <option value="ocean">Ocean</option>
            <option value="matrix">Matrix</option>
            <option value="solarized">Solarized</option>
            <option value="monokai">Monokai</option>
            <option value="dracula">Dracula</option>
            <option value="basic" selected>Basic</option>
          </select>
        </div>

        <div class="toolbar-sep"></div>

        <!-- Text color -->
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Text</span>
          <button class="swatch-btn" id="fgSwatchBtn" onclick="openPicker('fg', event)" title="Text Color"></button>
        </div>

        <!-- BG color -->
        <div class="toolbar-grp">
          <span class="toolbar-lbl">BG</span>
          <button class="swatch-btn" id="bgSwatchBtn" onclick="openPicker('bg', event)" title="Background Color"></button>
        </div>

        <div class="toolbar-sep"></div>

        <!-- Font size -->
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Size</span>
          <div class="fs-ctrl">
            <button class="fs-btn" onclick="adjustFontSize(-1)">&#8722;</button>
            <span class="fs-val" id="fsDisplay">14</span>
            <button class="fs-btn" onclick="adjustFontSize(1)">+</button>
          </div>
        </div>

        <button class="toolbar-clear" onclick="clearTerminal()">Clear</button>
      </div>

      <!-- Terminal body -->
      <div class="term-body">
        <div id="xtermTerm"></div>
      </div>

      <!-- Status bar -->
      <div class="term-statusbar">
        <div class="status-dot off" id="termStatusDot"></div>
        <span id="termStatusText">Disconnected</span>
        <span style="margin-left:auto;font-size:0.68rem;">zsh &#x2022; mission-control</span>
      </div>
    </section>
  </main>

  <!-- Color swatch popups (fixed overlay) -->
  <div class="swatch-popup" id="fgPicker">
    <div class="swatch-popup-lbl">Text Color</div>
    <div class="swatch-grid" id="fgSwatchGrid"></div>
  </div>
  <div class="swatch-popup" id="bgPicker">
    <div class="swatch-popup-lbl">Background Color</div>
    <div class="swatch-grid" id="bgSwatchGrid"></div>
  </div>

  <script>
    /* ── Global state ──────────────────────────────── */
    var xtermTerm    = null;
    var fitAddon     = null;
    var termWS       = null;
    var currentFontSize = 14;
    var currentTheme = {
      background:   '#1d1f21',
      foreground:   '#c5c8c6',
      cursor:       '#c5c8c6',
      cursorAccent: '#1d1f21',
      selection:    'rgba(197,200,198,0.25)'
    };

    var PROFILES = {
      ocean:     { background:'#0f172a', foreground:'#38bdf8', cursor:'#38bdf8', cursorAccent:'#0f172a', selection:'rgba(56,189,248,0.25)' },
      matrix:    { background:'#001100', foreground:'#00ff41', cursor:'#00ff41', cursorAccent:'#001100', selection:'rgba(0,255,65,0.22)' },
      solarized: { background:'#002b36', foreground:'#839496', cursor:'#839496', cursorAccent:'#073642', selection:'rgba(131,148,150,0.25)' },
      monokai:   { background:'#272822', foreground:'#f8f8f2', cursor:'#f8f8f0', cursorAccent:'#272822', selection:'rgba(248,248,242,0.2)' },
      dracula:   { background:'#282a36', foreground:'#f8f8f2', cursor:'#f8f8f0', cursorAccent:'#282a36', selection:'rgba(248,248,242,0.2)' },
      basic:     { background:'#1d1f21', foreground:'#c5c8c6', cursor:'#c5c8c6', cursorAccent:'#1d1f21', selection:'rgba(197,200,198,0.25)' }
    };

    /* 48 curated colors  — 8 cols × 6 rows */
    var SWATCHES = [
      /* grays */
      '#000000','#111827','#1e1e1e','#2d2d2d','#525252','#737373','#a3a3a3','#ffffff',
      /* blues */
      '#0a0e1a','#0f172a','#1e293b','#1e3a5f','#1d4ed8','#3b82f6','#93c5fd','#dbeafe',
      /* teals */
      '#042f2e','#0f3d40','#155e75','#0e7490','#06b6d4','#22d3ee','#67e8f9','#cffafe',
      /* greens */
      '#052e16','#14532d','#15803d','#16a34a','#22c55e','#4ade80','#86efac','#dcfce7',
      /* purples */
      '#1e1b4b','#3730a3','#6d28d9','#7c3aed','#a78bfa','#c4b5fd','#e9d5ff','#f5f3ff',
      /* warm */
      '#450a0a','#7f1d1d','#b91c1c','#dc2626','#f87171','#fb923c','#fbbf24','#fef9c3'
    ];

    /* ── Theme / sidebar toggle ────────────────────── */
    function toggleTheme() {
      document.body.classList.toggle('light');
      var isLight = document.body.classList.contains('light');
      localStorage.theme = isLight ? 'light' : 'dark';
      var btn = document.getElementById('themeToggleBtn');
      btn.querySelector('.icon').textContent  = isLight ? '☀️' : '🌙';
      btn.querySelector('.label').textContent = isLight ? 'Light Mode' : 'Dark Mode';
    }

    function toggleSidebar() {
      var sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      localStorage.sidebarCollapsed = sidebar.classList.contains('collapsed');
    }

    /* ── LiteLLM ───────────────────────────────────── */
    async function runLiteLLM(action) {
      var outputDiv  = document.getElementById('litellm-output');
      var statusSpan = document.getElementById('litellm-status');
      outputDiv.textContent  = 'Executing ' + action + '...';
      statusSpan.textContent = 'Running...';
      try {
        var response = await fetch('/api/litellm/' + action);
        var data = await response.json();
        outputDiv.textContent  = data.output || 'No output.';
        statusSpan.textContent = 'Completed';
        setTimeout(fetchLiteLLMLogs, 1000);
      } catch(err) {
        outputDiv.textContent  = 'Error: ' + err.message;
        statusSpan.textContent = 'Failed';
      }
    }

    async function fetchLiteLLMLogs() {
      var logsDiv = document.getElementById('litellm-logs');
      try {
        var response = await fetch('/api/litellm/logs');
        var data = await response.json();
        logsDiv.textContent = data.output;
        logsDiv.scrollTop   = logsDiv.scrollHeight;
      } catch(err) {
        logsDiv.textContent = 'Failed to load logs: ' + err.message;
      }
    }

    setInterval(function() {
      var p = document.getElementById('litellm');
      if (p && p.classList.contains('active')) fetchLiteLLMLogs();
    }, 5000);
    fetchLiteLLMLogs();

    /* ── Terminal — init ───────────────────────────── */
    function initXterm() {
      if (xtermTerm) {
        setTimeout(function() { if (fitAddon) fitAddon.fit(); }, 50);
        return;
      }

      xtermTerm = new Terminal({
        fontSize:    currentFontSize,
        fontFamily:  "'Menlo', 'Monaco', 'Courier New', monospace",
        theme:       currentTheme,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback:  5000
      });

      fitAddon = new FitAddon.FitAddon();
      xtermTerm.loadAddon(fitAddon);
      xtermTerm.open(document.getElementById('xtermTerm'));

      /* onData registered once — always routes to current WS */
      xtermTerm.onData(function(data) {
        if (termWS && termWS.readyState === WebSocket.OPEN) {
          termWS.send(JSON.stringify({ type: 'data', data: data }));
        }
      });

      /* Send resize events to PTY */
      xtermTerm.onResize(function(size) {
        if (termWS && termWS.readyState === WebSocket.OPEN) {
          termWS.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
        }
      });

      window.addEventListener('resize', function() {
        if (fitAddon) fitAddon.fit();
      });

      buildSwatchGrids();
      updateSwatchBtns();

      setTimeout(function() {
        fitAddon.fit();
        connectTermWS();
      }, 60);
    }

    /* ── Terminal — WebSocket ──────────────────────── */
    function connectTermWS() {
      if (termWS) {
        try { termWS.close(); } catch(e) {}
      }
      var wsUrl = 'ws://' + location.hostname + ':3001/terminal';
      termWS = new WebSocket(wsUrl);

      termWS.onopen = function() {
        setTermStatus(true, 'Connected');
        if (xtermTerm) {
          termWS.send(JSON.stringify({ type: 'resize', cols: xtermTerm.cols, rows: xtermTerm.rows }));
        }
      };

      termWS.onmessage = function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type === 'data') xtermTerm.write(msg.data);
          if (msg.type === 'exit') {
            xtermTerm.write('\\r\\n\\x1b[33m[Process exited]\\x1b[0m\\r\\n');
            setTermStatus(false, 'Exited');
          }
        } catch(ex) {}
      };

      termWS.onclose = function() { setTermStatus(false, 'Disconnected'); };
      termWS.onerror = function() {
        setTermStatus(false, 'Connection error');
        xtermTerm.write('\\r\\n\\x1b[31m[WebSocket error]\\x1b[0m\\r\\n');
      };
    }

    function reconnectTerminal() {
      if (xtermTerm) {
        xtermTerm.write('\\r\\n\\x1b[33m[Reconnecting...]\\x1b[0m\\r\\n');
      }
      connectTermWS();
    }

    function killTerminal() {
      if (termWS) { try { termWS.close(); } catch(e) {} termWS = null; }
      if (xtermTerm) xtermTerm.write('\\r\\n\\x1b[31m[Session closed]\\x1b[0m\\r\\n');
      setTermStatus(false, 'Disconnected');
    }

    function clearTerminal() { if (xtermTerm) xtermTerm.clear(); }

    function setTermStatus(connected, text) {
      var dot   = document.getElementById('termStatusDot');
      var label = document.getElementById('termStatusText');
      if (dot)   { dot.classList.toggle('on',  connected); dot.classList.toggle('off', !connected); }
      if (label) label.textContent = text;
    }

    /* ── Terminal — font size ──────────────────────── */
    function adjustFontSize(delta) {
      currentFontSize = Math.max(8, Math.min(32, currentFontSize + delta));
      document.getElementById('fsDisplay').textContent = currentFontSize;
      if (xtermTerm) {
        xtermTerm.options.fontSize = currentFontSize;
        if (fitAddon) setTimeout(function() { fitAddon.fit(); }, 20);
      }
    }

    /* ── Terminal — profiles ───────────────────────── */
    function applyProfile(name) {
      if (!PROFILES[name]) return;
      currentTheme = Object.assign({}, PROFILES[name]);
      applyCurrentTheme();
      updateSwatchBtns();
    }

    function applyCurrentTheme() {
      if (!xtermTerm) return;
      xtermTerm.options.theme = currentTheme;
      var body = document.querySelector('.term-body');
      if (body) body.style.background = currentTheme.background;
    }

    /* ── Terminal — color swatches ─────────────────── */
    function buildSwatchGrids() {
      ['fg','bg'].forEach(function(which) {
        var grid = document.getElementById(which + 'SwatchGrid');
        grid.innerHTML = '';
        SWATCHES.forEach(function(color) {
          var sw = document.createElement('button');
          sw.className   = 'sw';
          sw.style.background = color;
          sw.title       = color;
          sw.setAttribute('data-color', color);
          sw.onclick = function() { applyColor(which, color); };
          grid.appendChild(sw);
        });
      });
    }

    function updateSwatchBtns() {
      document.getElementById('fgSwatchBtn').style.background = currentTheme.foreground;
      document.getElementById('bgSwatchBtn').style.background = currentTheme.background;
    }

    function markActiveSwatches(which) {
      var active = which === 'fg' ? currentTheme.foreground : currentTheme.background;
      var grid   = document.getElementById(which + 'SwatchGrid');
      grid.querySelectorAll('.sw').forEach(function(sw) {
        sw.classList.toggle('active', sw.getAttribute('data-color') === active);
      });
    }

    var activePicker = null;

    function openPicker(which, event) {
      event.stopPropagation();
      var fgP = document.getElementById('fgPicker');
      var bgP = document.getElementById('bgPicker');
      var picker = which === 'fg' ? fgP : bgP;

      if (picker.classList.contains('open')) {
        picker.classList.remove('open');
        activePicker = null;
        return;
      }
      fgP.classList.remove('open');
      bgP.classList.remove('open');

      var btn  = event.currentTarget;
      var rect = btn.getBoundingClientRect();
      /* Position below button, clamp to viewport right edge */
      picker.style.top  = (rect.bottom + 7) + 'px';
      picker.style.left = Math.min(rect.left, window.innerWidth - 230) + 'px';
      picker.classList.add('open');
      activePicker = which;
      markActiveSwatches(which);
    }

    function applyColor(which, color) {
      if (which === 'fg') {
        currentTheme = Object.assign({}, currentTheme, { foreground: color, cursor: color });
      } else {
        currentTheme = Object.assign({}, currentTheme, { background: color, cursorAccent: color });
      }
      applyCurrentTheme();
      updateSwatchBtns();
      document.getElementById(which + 'Picker').classList.remove('open');
      activePicker = null;
      /* Mark profile as custom */
      document.getElementById('termProfile').value = '';
    }

    /* ── Menu navigation ───────────────────────────── */
    document.addEventListener('click', function(e) {
      /* Close swatch pickers on outside click */
      if (!e.target.closest('.swatch-popup') && !e.target.closest('.swatch-btn')) {
        document.getElementById('fgPicker').classList.remove('open');
        document.getElementById('bgPicker').classList.remove('open');
        activePicker = null;
      }

      if (e.target.closest('.header-actions') || e.target.closest('.theme-toggle-btn') || e.target.closest('.sidebar-footer')) return;

      var item = e.target.closest('.menu-item');
      if (!item) return;

      /* Remove terminal-active when leaving xterm panel */
      var prevPanel = document.querySelector('.panel.active');
      if (prevPanel && prevPanel.id === 'xterm') {
        document.getElementById('main').classList.remove('terminal-active');
      }

      document.querySelectorAll('.menu-item.active').forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');

      var panelId = item.dataset.panel;
      if (panelId) {
        document.querySelectorAll('.panel.active').forEach(function(p) { p.classList.remove('active'); });
        if (panelId === 'xterm') {
          document.getElementById('main').classList.add('terminal-active');
          /* Show panel first so container has dimensions, then init */
          var panel = document.getElementById('xterm');
          if (panel) panel.classList.add('active');
          initXterm();
          return;
        }
        var panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');
      }
    });

    /* ── Restore persisted state ───────────────────── */
    if (localStorage.theme === 'light') {
      document.body.classList.add('light');
      var btn = document.getElementById('themeToggleBtn');
      btn.querySelector('.icon').textContent  = '☀️';
      btn.querySelector('.label').textContent = 'Light Mode';
    }
    if (localStorage.sidebarCollapsed === 'true') {
      document.getElementById('sidebar').classList.add('collapsed');
    }
  </script>
</body>
</html>
  `);
});

/* ── WebSocket + PTY server ──────────────────────────── */
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', function(request, socket, head) {
  if (request.url === '/terminal') {
    wss.handleUpgrade(request, socket, head, function(ws) {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', function(ws) {
  const shell = process.env.SHELL || '/bin/zsh';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd:  os.homedir(),
    env:  process.env
  });

  ptyProcess.onData(function(data) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data: data }));
    }
  });

  ptyProcess.onExit(function() {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit' }));
      ws.close();
    }
  });

  ws.on('message', function(msg) {
    try {
      var parsed = JSON.parse(msg.toString());
      if (parsed.type === 'data') {
        ptyProcess.write(parsed.data);
      } else if (parsed.type === 'resize') {
        var cols = Math.max(2, parseInt(parsed.cols) || 80);
        var rows = Math.max(2, parseInt(parsed.rows) || 24);
        ptyProcess.resize(cols, rows);
      }
    } catch(e) {}
  });

  ws.on('close', function() {
    try { ptyProcess.kill(); } catch(e) {}
  });
});

server.listen(3001, '0.0.0.0', function() {
  console.log('Mission Control v1.0 live on :3001 — real zsh shell ready');
});
