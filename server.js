// Mission Control v1.0 🦞 Real Shell Terminal + Pro Toolbar
const http = require('http');
const { exec, execSync } = require('child_process');
const fs_module = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');

const serverStartTime = new Date().toISOString();
const DEFAULT_PORT = 3270;
const PORT = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);

function getVersionInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: __dirname }).toString().trim();
    const logRaw = execSync(
      'git log -30 --format="%H|||%h|||%s|||%an|||%ai"',
      { cwd: __dirname }
    ).toString().trim();
    const commits = logRaw.split('\n').filter(Boolean).map(line => {
      const [hash, short, subject, author, date] = line.split('|||');
      return { hash, short, subject, author, date };
    });
    const packageVersion = require('./package.json').version;
    return { commits, branch, packageVersion };
  } catch (e) {
    return { commits: [], branch: 'unknown', packageVersion: 'unknown', error: e.message };
  }
}

function formatExecOutput(error, stdout, stderr, fallback) {
  const out = stdout || '';
  const err = stderr || '';
  let combined = out + err;
  if (!combined && error && error.message) combined = error.message;
  if (!combined) combined = fallback;

  return {
    output: combined,
    stdout: out,
    stderr: err,
    hadStderr: Boolean(err)
  };
}

function runCommandInPty(command, options) {
  return new Promise(function(resolve) {
    const timeoutMs = (options && options.timeoutMs) || 30000;
    const shell = process.env.SHELL || '/bin/zsh';
    const ptyEnv = Object.assign({}, process.env, {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
      CLICOLOR_FORCE: '1'
    }, (options && options.env) || {});
    delete ptyEnv.NO_COLOR;
    const ptyProcess = pty.spawn(shell, ['-lc', command], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: (options && options.cwd) || process.cwd(),
      env: ptyEnv
    });

    let output = '';
    let done = false;
    let timedOut = false;
    const timer = setTimeout(function() {
      timedOut = true;
      try { ptyProcess.kill(); } catch (e) {}
    }, timeoutMs);

    ptyProcess.onData(function(data) {
      output += data;
    });

    ptyProcess.onExit(function(ev) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({
        output: output || (timedOut ? 'Command timed out.' : 'Done.'),
        stdout: output,
        stderr: '',
        hadStderr: null,
        exitCode: ev && typeof ev.exitCode === 'number' ? ev.exitCode : null,
        timedOut: timedOut
      });
    });
  });
}

const server = http.createServer((req, res) => {
  // --- Version History Endpoint ---
  if (req.url === '/api/version') {
    const info = getVersionInfo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...info, serverStartTime }));
    return;
  }

  // --- LiteLLM API Endpoints ---
  if (req.url.startsWith('/api/litellm/')) {
    const action = req.url.split('/')[3];
    const liteLlmDir = '/Users/openclaw/litellm';

    if (action === 'logs') {
      const logPath = path.join(liteLlmDir, 'litellm.log');
      exec('tail -n 100 "' + logPath + '"', (error, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatExecOutput(error, stdout, stderr, 'No logs found.')));
      });
      return;
    }

    const commands = {
      'start':      './launchd_start_LiteLLM.command',
      'kill':       './kill_LiteLLM.command',
      'health':     './health_LiteLLM.command',
      'ps':         './ps_LiteLLM.command',
      'test':       './testModel_LiteLLM.command',
      'open-log':   'open ./open_LiteLLM_Log.command',
      'model-info': 'curl -s "http://localhost:4000/v1/model/info"'
    };

    if (commands[action]) {
      exec(commands[action], { cwd: liteLlmDir }, (error, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatExecOutput(error, stdout, stderr, 'Executed successfully.')));
      });
      return;
    }
  }

  // --- OpenClaw API Endpoints ---
  if (req.url.startsWith('/api/openclaw/')) {
    const action = req.url.split('/')[3];
    const ocCmds = {
      'gateway-status':        'openclaw gateway status',
      'status':                'openclaw status',
      'skills-list':           'openclaw skills list',
      'channels-list':         'openclaw channels list',
      'channels-capabilities': 'openclaw channels capabilities',
      'cron-list':             'openclaw cron list',
      'gateway-restart':       'openclaw gateway restart',
      'gateway-stop':          'openclaw gateway stop',
      'gateway-start':         'openclaw gateway start',
      'gateway-install':       'openclaw gateway install',
      'gateway-uninstall':     'openclaw gateway uninstall',
    };
    if (ocCmds[action]) {
      runCommandInPty(ocCmds[action], { timeoutMs: 30000 }).then(function(payload) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      });
      return;
    }
    res.writeHead(404); res.end('Unknown command'); return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>📡 Mission Control</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-webgl@0.16.0/lib/xterm-addon-webgl.js"></script>
  <style>
    :root {
      --bg-dark: #000;
      --bg-light: white;
      --text-dark: #3b82f6;
      --text-light: #1d4ed8;
      --bg-hover-dark: rgba(59,130,246,0.22);
      --bg-hover-light: rgba(29,78,216,0.16);
      --menu-hover-dark: rgba(59,130,246,0.18);
      --menu-active-dark: rgba(59,130,246,0.42);
      --icon-hover-dark: rgba(59,130,246,0.30);
      --menu-hover-dark-shadow: inset 0 1px 0 rgba(147,197,253,0.12), inset 0 -1px 0 rgba(147,197,253,0.12);
      --menu-active-dark-shadow: inset 3px 0 0 rgba(147,197,253,0.95), inset 0 1px 0 rgba(147,197,253,0.14), inset 0 -1px 0 rgba(147,197,253,0.14);
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
      padding: 0 0.75rem;
      gap: 0.5rem;
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

    .icon-btn {
      background: none; border: none; color: inherit; cursor: pointer;
      width: 36px; height: 36px; display: flex; align-items: center;
      justify-content: center; border-radius: 6px; font-size: 1.2rem;
      transition: background 0.2s;
      -webkit-appearance: none; appearance: none;
      outline: none; box-shadow: none;
      -webkit-tap-highlight-color: transparent;
    }
    .icon-btn:hover, .icon-btn.mc-hover {
      background: var(--icon-hover-dark);
    }
    body.light .icon-btn:hover, body.light .icon-btn.mc-hover {
      background: var(--bg-hover-light);
    }
    .icon-btn:focus-visible,
    .icon-btn:active {
      background: none;
      outline: none;
      box-shadow: none;
    }

    /* ── Menu ────────────────────────────────────────── */
    #menu-container { flex: 1; overflow-y: auto; padding-top: 0.5rem; }
    #menu-items { list-style: none; }
    .menu-item {
      padding: 0.75rem 1rem;
      cursor: pointer; position: relative;
      display: flex; align-items: center; gap: 0.75rem; user-select: none;
    }
    .menu-item:hover, .menu-item.mc-hover {
      background: var(--menu-hover-dark);
      box-shadow: var(--menu-hover-dark-shadow);
    }
    body.light .menu-item:hover, body.light .menu-item.mc-hover {
      background: var(--bg-hover-light);
      box-shadow: none;
    }
    .menu-item.active { background: var(--menu-active-dark); }
    .menu-item.active {
      box-shadow: var(--menu-active-dark-shadow);
    }
    body.light .menu-item.active { background: rgba(29,78,216,0.3); }
    body.light .menu-item.active { box-shadow: none; }
    .icon {&#10;      position: absolute;&#10;      left: 1rem;&#10;      top: 50%;&#10;      transform: translateY(-50%);&#10;      width: 24px;&#10;      height: 24px;&#10;      font-size: 1.2rem;&#10;      flex-shrink: 0;&#10;      text-align: center;&#10;      line-height: 1;&#10;    }
    .label { flex: 1; margin-left: 3rem; white-space: nowrap; opacity: 1; transition: opacity 0.2s; }
    #sidebar.collapsed .label { opacity: 0; }

    /* ── Main Content ────────────────────────────────── */
    #main { flex: 1; padding: 2rem; overflow-y: auto; }
    #main.terminal-active { padding: 8px; overflow: hidden; }

    .panel { display: none; }
    .panel.active { display: flex; flex-direction: column; height: 100%; }

    /* ── LiteLLM Panel ───────────────────────────────── */
    .dashboard-grid {
      display: flex; flex-direction: column;
      gap: 1rem; height: 100%; padding-bottom: 2rem;
    }
    .dashboard-grid .console-window { flex: 1; min-height: 0; }
    .action-bar {
      display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
      background: rgba(0,0,0,0.2); padding: 0.6rem 1rem;
      border-radius: 8px; border: 1px solid rgba(59,130,246,0.2);
    }
    body.light .action-bar { background: rgba(0,0,0,0.05); border-color: rgba(29,78,216,0.2); }
    .tab-nav {
      display: flex; gap: 2px; background: rgba(0,0,0,0.3);
      padding: 3px; border-radius: 6px; flex-shrink: 0;
    }
    body.light .tab-nav { background: rgba(0,0,0,0.1); }
    .tab-btn {
      background: none; border: none; border-radius: 4px;
      color: #94a3b8; padding: 0.2rem 0.7rem; cursor: pointer;
      font-weight: 600; font-size: 0.8rem; transition: all 0.2s;
    }
    .tab-btn:hover { color: #38bdf8; }
    .tab-btn.active { background: rgba(59,130,246,0.25); color: #38bdf8; }
    body.light .tab-btn { color: #94a3b8; }
    body.light .tab-btn:hover { color: #1d4ed8; }
    body.light .tab-btn.active { background: rgba(29,78,216,0.15); color: #1d4ed8; }
    .tab-divider { width: 1px; background: rgba(59,130,246,0.3); align-self: stretch; margin: 0 0.1rem; flex-shrink: 0; }
    .tab-pane { display: none; }
    .tab-pane.active { display: contents; }

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
      padding: 0.85rem 0.75rem;
      display: flex; justify-content: flex-start; align-items: center;
    }
    body.light .sidebar-footer { border-top-color: rgba(29,78,216,0.3); }
    .theme-toggle-btn {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; border-radius: 6px; color: inherit;
      cursor: pointer; user-select: none;
      -webkit-appearance: none; appearance: none;
      transition: background 0.2s;
      outline: none; box-shadow: none;
      -webkit-tap-highlight-color: transparent;
    }
    .theme-toggle-btn:hover, .theme-toggle-btn.mc-hover {
      background: var(--icon-hover-dark);
    }
    body.light .theme-toggle-btn:hover, body.light .theme-toggle-btn.mc-hover {
      background: var(--bg-hover-light);
    }
    .theme-toggle-btn:focus-visible,
    .theme-toggle-btn:active {
      background: none;
      outline: none;
      box-shadow: none;
    }
    .theme-toggle-btn .icon { position: static; font-size: 1.3rem; line-height: 1; transform: none; top: auto; left: auto; }
    .theme-toggle-btn .label { display: none; }

    /* ── OpenClaw Panel ──────────────────────────────── */
    .oc-toolbar {
      flex-shrink: 0; display: flex; flex-direction: column; gap: 0.5rem;
      background: rgba(0,0,0,0.2); padding: 0.75rem 1rem;
      border-radius: 8px; border: 1px solid rgba(59,130,246,0.2);
    }
    body.light .oc-toolbar { background: rgba(0,0,0,0.05); }
    .oc-group { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .oc-group-label {
      font-size: 0.7rem; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.07em; flex-shrink: 0; min-width: 6rem;
    }
    .oc-divider { height: 1px; background: rgba(59,130,246,0.2); }
    .oc-confirm-bar {
      display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
      padding: 0.5rem 0.75rem;
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.35); border-radius: 6px;
    }
    .oc-confirm-text { color: #fca5a5; font-weight: 600; flex: 1; font-size: 0.9rem; }
    .btn.warning { border-color: rgba(245,158,11,0.5); color: #f59e0b; }
    .btn.warning:hover { background: rgba(245,158,11,0.2); }
    #oc-output { font-family: 'SF Mono','Menlo','Monaco','Consolas',monospace; word-break: normal; color: #e2e8f0; }

    /* ── Terminal Panel ──────────────────────────────── */
    .term-panel.panel.active {
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
    .xterm-container {
      position: absolute; top: 6px; right: 8px; bottom: 6px; left: 8px;
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
      <button id="toggle-sidebar-btn" class="icon-btn" onclick="toggleSidebar()" title="Toggle Sidebar">☰</button>
      <span class="logo-text">📡 Mission Control</span>
    </div>
    <div id="menu-container">
      <ul id="menu-items">
        <li class="menu-item active" data-panel="dashboard"><span class="icon">🚀</span><span class="label">Dashboard</span></li>
        <li class="menu-item" data-panel="openclaw"><span class="icon">🦞</span><span class="label">OpenClaw</span></li>
        <li class="menu-item" data-panel="gateway"><span class="icon">🔌</span><span class="label">Gateway</span></li>
        <li class="menu-item" data-panel="sessions"><span class="icon">📱</span><span class="label">Sessions</span></li>
        <li class="menu-item" data-panel="skills"><span class="icon">🛠️</span><span class="label">Skills</span></li>
        <li class="menu-item" data-panel="nodes"><span class="icon">🖥️</span><span class="label">Nodes</span></li>
        <li class="menu-item" data-panel="litellm"><span class="icon">🔄</span><span class="label">LiteLLM Proxy</span></li>
        <li class="menu-item" data-panel="projects"><span class="icon">📁</span><span class="label">Projects</span></li>
        <li class="menu-item" data-panel="mc-docs"><span class="icon">📚</span><span class="label">Docs</span></li>
        <li class="menu-item" data-panel="xterm1"><span class="icon" style="font-family:monospace;font-weight:700;">&gt;_<span style="position:absolute;top:-3px;left:20px;font-size:0.52em;font-weight:700;line-height:1;">1</span></span><span class="label">Terminal 1</span></li>
        <li class="menu-item" data-panel="xterm2"><span class="icon" style="font-family:monospace;font-weight:700;">&gt;_<span style="position:absolute;top:-3px;left:20px;font-size:0.52em;font-weight:700;line-height:1;">2</span></span><span class="label">Terminal 2</span></li>
        <li class="menu-item" data-panel="xterm3"><span class="icon" style="font-family:monospace;font-weight:700;">&gt;_<span style="position:absolute;top:-3px;left:20px;font-size:0.52em;font-weight:700;line-height:1;">3</span></span><span class="label">Terminal 3</span></li>
        <li class="menu-item" data-panel="xterm4"><span class="icon" style="font-family:monospace;font-weight:700;">&gt;_<span style="position:absolute;top:-3px;left:20px;font-size:0.52em;font-weight:700;line-height:1;">4</span></span><span class="label">Terminal 4</span></li>
        <li class="menu-item" data-panel="xterm5"><span class="icon" style="font-family:monospace;font-weight:700;">&gt;_<span style="position:absolute;top:-3px;left:20px;font-size:0.52em;font-weight:700;line-height:1;">5</span></span><span class="label">Terminal 5</span></li>
        <li class="menu-item" data-panel="version-history"><span class="icon">🏷️</span><span class="label">Version History</span></li>
      </ul>
    </div>
    <div class="sidebar-footer">
      <button class="theme-toggle-btn" id="themeToggleBtn" onclick="toggleTheme()">
        <span class="icon">🌙</span>
        <span class="label">Switch to Light</span>
      </button>
    </div>
  </nav>

  <main id="main">
    <section id="dashboard" class="panel active">
      <h1>🚀 Mission Control v1.0</h1>
      <p>Real shell terminal with professional controls.</p>
    </section>
    <section id="openclaw" class="panel">
      <div class="dashboard-grid">
        <div class="oc-toolbar">
          <div class="oc-group">
            <span class="oc-group-label">Status &amp; Info</span>
            <button class="btn" onclick="runOC('gateway-status')">Gateway Status</button>
            <button class="btn" onclick="runOC('status')">Status</button>
            <button class="btn" onclick="runOC('skills-list')">Skills</button>
            <button class="btn" onclick="runOC('channels-list')">Channels</button>
            <button class="btn" onclick="runOC('channels-capabilities')">Capabilities</button>
            <button class="btn" onclick="runOC('cron-list')">Cron</button>
          </div>
        </div>
        <div class="console-window" style="flex:1;min-height:0">
          <div class="console-header">
            <span>OUTPUT</span>
            <button class="icon-btn" style="width:24px;height:24px;font-size:0.85rem;" onclick="clearOCOutput()" title="Clear output">✕</button>
          </div>
          <div class="console-body" id="oc-output" data-pristine="1"><span style="color:#94a3b8">Ready — click a command above.</span></div>
        </div>
      </div>
    </section>
    <section id="gateway" class="panel">
      <div class="dashboard-grid">
        <div class="oc-toolbar">
          <div class="oc-group">
            <span class="oc-group-label">Gateway Control</span>
            <button class="btn warning" onclick="confirmGW('gateway-restart','gateway restart')">Restart</button>
            <button class="btn danger"  onclick="confirmGW('gateway-stop','gateway stop')">Stop</button>
            <button class="btn success" onclick="confirmGW('gateway-start','gateway start')">Start</button>
            <button class="btn danger"  onclick="confirmGW('gateway-uninstall','gateway uninstall')">Uninstall</button>
            <button class="btn"         onclick="confirmGW('gateway-install','gateway install')">Install</button>
          </div>
          <div id="gw-confirm-bar" class="oc-confirm-bar" style="display:none">
            <span class="oc-confirm-text" id="gw-confirm-text">Confirm?</span>
            <button class="btn danger" onclick="executeConfirmedGW()">✓ Run It</button>
            <button class="btn" onclick="cancelGWConfirm()">✗ Cancel</button>
          </div>
        </div>
        <div class="console-window" style="flex:1;min-height:0">
          <div class="console-header">
            <span>OUTPUT</span>
            <button class="icon-btn" style="width:24px;height:24px;font-size:0.85rem;" onclick="clearGWOutput()" title="Clear output">✕</button>
          </div>
          <div class="console-body" id="gw-output" data-pristine="1"><span style="color:#94a3b8">Ready — click a command above.</span></div>
        </div>
      </div>
    </section>
    <section id="sessions" class="panel"><h1>📱 Sessions</h1><p>List/spawn.</p></section>
    <section id="skills" class="panel"><h1>🛠️ Skills</h1><p>Browser.</p></section>
    <section id="nodes" class="panel"><h1>🖥️ Nodes</h1><p>Control.</p></section>

    <!-- LiteLLM Panel -->
    <section id="litellm" class="panel">
      <div class="dashboard-grid">
        <div class="action-bar">
          <div class="tab-nav">
            <button class="tab-btn active" onclick="switchLlmTab(event,'llm-controls')">Controls</button>
            <button class="tab-btn" onclick="switchLlmTab(event,'llm-diagnostics')">Diagnostics</button>
            <button class="tab-btn" onclick="switchLlmTab(event,'llm-models')">Models</button>
            <button class="tab-btn" onclick="switchLlmTab(event,'llm-log')">Log</button>
          </div>
          <div class="tab-divider"></div>
          <div id="llm-controls" class="tab-pane active">
            <button class="btn success" onclick="runLiteLLM('start')">▶ Start (launchd)</button>
            <button class="btn danger"  onclick="runLiteLLM('kill')">⏹ Kill Server</button>
            <button class="btn" onclick="runLiteLLM('ps')">📊 Process Status</button>
          </div>
          <div id="llm-diagnostics" class="tab-pane">
            <button class="btn" onclick="runLiteLLM('health')">🏥 Check Health</button>
            <button class="btn" onclick="runLiteLLM('test')">🧪 Test Model</button>
          </div>
          <div id="llm-models" class="tab-pane">
            <button class="btn" onclick="runLiteLLM('model-info')">↺ Refresh</button>
          </div>
          <div id="llm-log" class="tab-pane">
            <button class="btn" onclick="runLiteLLM('open-log')">🪟 Open Log App</button>
          </div>
        </div>
        <div id="litellm-cmd-window" class="console-window">
          <div class="console-header">
            <span>OUTPUT</span>
            <span id="litellm-status">Idle</span>
          </div>
          <div class="console-body" id="litellm-output">Waiting for command...</div>
        </div>
        <div id="litellm-log-window" class="console-window" style="display:none">
          <div class="console-header">
            <span>OUTPUT</span>
            <button class="icon-btn" style="width:24px;height:24px;font-size:0.8rem;" onclick="fetchLiteLLMLogs()" title="Refresh">🔄</button>
          </div>
          <div class="console-body log" id="litellm-logs">Loading logs...</div>
        </div>
      </div>
    </section>

    <section id="projects" class="panel"><h1>📁 Projects</h1><p>Overview.</p></section>
    <section id="mc-docs"   class="panel"><h1>📚 Docs</h1><p>Coming.</p></section>

    <section id="version-history" class="panel">
      <div class="dashboard-grid">
        <div class="oc-toolbar">
          <span style="font-size:1.1rem;font-weight:700;">🏷️ Version History</span>
          <span id="vh-branch-badge" style="margin-left:12px;background:#1e3a5f;color:#60a5fa;padding:2px 10px;border-radius:999px;font-size:0.8rem;font-family:monospace;"></span>
          <div style="margin-left:auto;">
            <button class="btn" onclick="refreshVersionHistory()">🔄 Refresh</button>
          </div>
        </div>
        <div id="vh-current-card" style="background:#052e16;border:1px solid #16a34a;border-radius:8px;padding:16px;margin:0 0 12px 0;display:none;">
          <div style="color:#4ade80;font-size:0.75rem;font-weight:700;letter-spacing:0.08em;margin-bottom:8px;">CURRENT DEPLOYED VERSION</div>
          <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
            <div>
              <div style="color:#86efac;font-size:0.7rem;margin-bottom:2px;">COMMIT</div>
              <div id="vh-head-hash" style="font-family:monospace;color:#4ade80;font-size:1rem;font-weight:700;"></div>
            </div>
            <div style="flex:1;min-width:200px;">
              <div style="color:#86efac;font-size:0.7rem;margin-bottom:2px;">MESSAGE</div>
              <div id="vh-head-msg" style="color:#d1fae5;font-weight:600;"></div>
            </div>
            <div>
              <div style="color:#86efac;font-size:0.7rem;margin-bottom:2px;">AUTHOR</div>
              <div id="vh-head-author" style="color:#d1fae5;font-family:monospace;font-size:0.85rem;"></div>
            </div>
            <div>
              <div style="color:#86efac;font-size:0.7rem;margin-bottom:2px;">DATE</div>
              <div id="vh-head-date" style="color:#d1fae5;font-family:monospace;font-size:0.85rem;"></div>
            </div>
            <div>
              <div style="color:#86efac;font-size:0.7rem;margin-bottom:2px;">SERVER STARTED</div>
              <div id="vh-server-start" style="color:#d1fae5;font-family:monospace;font-size:0.85rem;"></div>
            </div>
          </div>
        </div>
        <div class="console-window" style="flex:1;min-height:0;">
          <div class="console-header"><span>COMMIT HISTORY</span></div>
          <div class="console-body" id="vh-table-body" style="overflow:auto;font-family:monospace;font-size:0.82rem;">
            <span style="color:#94a3b8">Loading...</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Terminal Panels 1-5 -->
    <section id="xterm1" class="panel term-panel">
      <div class="term-toolbar">
        <div class="term-actions">
          <button class="term-act-btn danger" onclick="killTerminal(1)">Disconnect</button>
          <button class="term-act-btn"        onclick="reconnectTerminal(1)">Reconnect</button>
          <button class="term-act-btn"        onclick="clearTerminal(1)">Clear</button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Profile</span>
          <select class="profile-sel" id="termProfile-1" onchange="applyProfile(1,this.value)">
            <option value="basic" selected>Basic</option>
            <option value="dracula">Dracula</option>
            <option value="matrix">Matrix</option>
            <option value="monokai">Monokai</option>
            <option value="ocean">Ocean</option>
            <option value="solarized">Solarized</option>
            <option value="" style="color:#555">&#8212; Custom &#8212;</option>
          </select>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Text</span>
          <button class="swatch-btn" id="fgSwatchBtn-1" onclick="openPicker(1,'fg',event)" title="Text Color"></button>
        </div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">BG</span>
          <button class="swatch-btn" id="bgSwatchBtn-1" onclick="openPicker(1,'bg',event)" title="Background Color"></button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Size</span>
          <div class="fs-ctrl">
            <button class="fs-btn" onclick="adjustFontSize(1,-1)">&#8722;</button>
            <span class="fs-val" id="fsDisplay-1">14</span>
            <button class="fs-btn" onclick="adjustFontSize(1,1)">+</button>
          </div>
        </div>
      </div>
      <div class="term-body">
        <div id="xtermTerm-1" class="xterm-container"></div>
      </div>
      <div class="term-statusbar">
        <div class="status-dot off" id="termStatusDot-1"></div>
        <span id="termStatusText-1">Disconnected</span>
        <span style="margin-left:auto;font-size:0.68rem;">zsh &#x2022; terminal 1</span>
      </div>
    </section>

    <section id="xterm2" class="panel term-panel">
      <div class="term-toolbar">
        <div class="term-actions">
          <button class="term-act-btn danger" onclick="killTerminal(2)">Disconnect</button>
          <button class="term-act-btn"        onclick="reconnectTerminal(2)">Reconnect</button>
          <button class="term-act-btn"        onclick="clearTerminal(2)">Clear</button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Profile</span>
          <select class="profile-sel" id="termProfile-2" onchange="applyProfile(2,this.value)">
            <option value="basic" selected>Basic</option>
            <option value="dracula">Dracula</option>
            <option value="matrix">Matrix</option>
            <option value="monokai">Monokai</option>
            <option value="ocean">Ocean</option>
            <option value="solarized">Solarized</option>
            <option value="" style="color:#555">&#8212; Custom &#8212;</option>
          </select>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Text</span>
          <button class="swatch-btn" id="fgSwatchBtn-2" onclick="openPicker(2,'fg',event)" title="Text Color"></button>
        </div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">BG</span>
          <button class="swatch-btn" id="bgSwatchBtn-2" onclick="openPicker(2,'bg',event)" title="Background Color"></button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Size</span>
          <div class="fs-ctrl">
            <button class="fs-btn" onclick="adjustFontSize(2,-1)">&#8722;</button>
            <span class="fs-val" id="fsDisplay-2">14</span>
            <button class="fs-btn" onclick="adjustFontSize(2,1)">+</button>
          </div>
        </div>
      </div>
      <div class="term-body">
        <div id="xtermTerm-2" class="xterm-container"></div>
      </div>
      <div class="term-statusbar">
        <div class="status-dot off" id="termStatusDot-2"></div>
        <span id="termStatusText-2">Disconnected</span>
        <span style="margin-left:auto;font-size:0.68rem;">zsh &#x2022; terminal 2</span>
      </div>
    </section>

    <section id="xterm3" class="panel term-panel">
      <div class="term-toolbar">
        <div class="term-actions">
          <button class="term-act-btn danger" onclick="killTerminal(3)">Disconnect</button>
          <button class="term-act-btn"        onclick="reconnectTerminal(3)">Reconnect</button>
          <button class="term-act-btn"        onclick="clearTerminal(3)">Clear</button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Profile</span>
          <select class="profile-sel" id="termProfile-3" onchange="applyProfile(3,this.value)">
            <option value="basic" selected>Basic</option>
            <option value="dracula">Dracula</option>
            <option value="matrix">Matrix</option>
            <option value="monokai">Monokai</option>
            <option value="ocean">Ocean</option>
            <option value="solarized">Solarized</option>
            <option value="" style="color:#555">&#8212; Custom &#8212;</option>
          </select>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Text</span>
          <button class="swatch-btn" id="fgSwatchBtn-3" onclick="openPicker(3,'fg',event)" title="Text Color"></button>
        </div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">BG</span>
          <button class="swatch-btn" id="bgSwatchBtn-3" onclick="openPicker(3,'bg',event)" title="Background Color"></button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Size</span>
          <div class="fs-ctrl">
            <button class="fs-btn" onclick="adjustFontSize(3,-1)">&#8722;</button>
            <span class="fs-val" id="fsDisplay-3">14</span>
            <button class="fs-btn" onclick="adjustFontSize(3,1)">+</button>
          </div>
        </div>
      </div>
      <div class="term-body">
        <div id="xtermTerm-3" class="xterm-container"></div>
      </div>
      <div class="term-statusbar">
        <div class="status-dot off" id="termStatusDot-3"></div>
        <span id="termStatusText-3">Disconnected</span>
        <span style="margin-left:auto;font-size:0.68rem;">zsh &#x2022; terminal 3</span>
      </div>
    </section>

    <section id="xterm4" class="panel term-panel">
      <div class="term-toolbar">
        <div class="term-actions">
          <button class="term-act-btn danger" onclick="killTerminal(4)">Disconnect</button>
          <button class="term-act-btn"        onclick="reconnectTerminal(4)">Reconnect</button>
          <button class="term-act-btn"        onclick="clearTerminal(4)">Clear</button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Profile</span>
          <select class="profile-sel" id="termProfile-4" onchange="applyProfile(4,this.value)">
            <option value="basic" selected>Basic</option>
            <option value="dracula">Dracula</option>
            <option value="matrix">Matrix</option>
            <option value="monokai">Monokai</option>
            <option value="ocean">Ocean</option>
            <option value="solarized">Solarized</option>
            <option value="" style="color:#555">&#8212; Custom &#8212;</option>
          </select>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Text</span>
          <button class="swatch-btn" id="fgSwatchBtn-4" onclick="openPicker(4,'fg',event)" title="Text Color"></button>
        </div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">BG</span>
          <button class="swatch-btn" id="bgSwatchBtn-4" onclick="openPicker(4,'bg',event)" title="Background Color"></button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Size</span>
          <div class="fs-ctrl">
            <button class="fs-btn" onclick="adjustFontSize(4,-1)">&#8722;</button>
            <span class="fs-val" id="fsDisplay-4">14</span>
            <button class="fs-btn" onclick="adjustFontSize(4,1)">+</button>
          </div>
        </div>
      </div>
      <div class="term-body">
        <div id="xtermTerm-4" class="xterm-container"></div>
      </div>
      <div class="term-statusbar">
        <div class="status-dot off" id="termStatusDot-4"></div>
        <span id="termStatusText-4">Disconnected</span>
        <span style="margin-left:auto;font-size:0.68rem;">zsh &#x2022; terminal 4</span>
      </div>
    </section>

    <section id="xterm5" class="panel term-panel">
      <div class="term-toolbar">
        <div class="term-actions">
          <button class="term-act-btn danger" onclick="killTerminal(5)">Disconnect</button>
          <button class="term-act-btn"        onclick="reconnectTerminal(5)">Reconnect</button>
          <button class="term-act-btn"        onclick="clearTerminal(5)">Clear</button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Profile</span>
          <select class="profile-sel" id="termProfile-5" onchange="applyProfile(5,this.value)">
            <option value="basic" selected>Basic</option>
            <option value="dracula">Dracula</option>
            <option value="matrix">Matrix</option>
            <option value="monokai">Monokai</option>
            <option value="ocean">Ocean</option>
            <option value="solarized">Solarized</option>
            <option value="" style="color:#555">&#8212; Custom &#8212;</option>
          </select>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Text</span>
          <button class="swatch-btn" id="fgSwatchBtn-5" onclick="openPicker(5,'fg',event)" title="Text Color"></button>
        </div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">BG</span>
          <button class="swatch-btn" id="bgSwatchBtn-5" onclick="openPicker(5,'bg',event)" title="Background Color"></button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-grp">
          <span class="toolbar-lbl">Size</span>
          <div class="fs-ctrl">
            <button class="fs-btn" onclick="adjustFontSize(5,-1)">&#8722;</button>
            <span class="fs-val" id="fsDisplay-5">14</span>
            <button class="fs-btn" onclick="adjustFontSize(5,1)">+</button>
          </div>
        </div>
      </div>
      <div class="term-body">
        <div id="xtermTerm-5" class="xterm-container"></div>
      </div>
      <div class="term-statusbar">
        <div class="status-dot off" id="termStatusDot-5"></div>
        <span id="termStatusText-5">Disconnected</span>
        <span style="margin-left:auto;font-size:0.68rem;">zsh &#x2022; terminal 5</span>
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
    var terms          = {};   /* keyed by terminal id 1-5 */
    var activeTermId   = null; /* id of the currently visible terminal */
    var termPickerTarget = null; /* id of terminal targeted by open swatch picker */

    /* ANSI 16-color palette — matches OpenClaw ansiToHtml colors (One Dark-ish, macOS-compatible) */
    var MAC_ANSI = {
      black:         '#555555',
      red:           '#e06c75',
      green:         '#98c379',
      yellow:        '#e5c07b',
      blue:          '#61afef',
      magenta:       '#c678dd',
      cyan:          '#56b6c2',
      white:         '#abb2bf',
      brightBlack:   '#888888',
      brightRed:     '#ff7b7b',
      brightGreen:   '#b5e890',
      brightYellow:  '#ffd080',
      brightBlue:    '#8abff0',
      brightMagenta: '#d9a0ff',
      brightCyan:    '#80d9e3',
      brightWhite:   '#ffffff'
    };

    var PROFILES = {
      ocean:     Object.assign({ background:'#0f172a', foreground:'#38bdf8', cursor:'#38bdf8', cursorAccent:'#0f172a', selection:'rgba(56,189,248,0.25)' },   MAC_ANSI),
      matrix:    Object.assign({ background:'#001100', foreground:'#00ff41', cursor:'#00ff41', cursorAccent:'#001100', selection:'rgba(0,255,65,0.22)' },     MAC_ANSI),
      solarized: Object.assign({ background:'#002b36', foreground:'#839496', cursor:'#839496', cursorAccent:'#073642', selection:'rgba(131,148,150,0.25)' }, MAC_ANSI),
      monokai:   Object.assign({ background:'#272822', foreground:'#f8f8f2', cursor:'#f8f8f0', cursorAccent:'#272822', selection:'rgba(248,248,242,0.2)' },  MAC_ANSI),
      dracula:   Object.assign({ background:'#282a36', foreground:'#f8f8f2', cursor:'#f8f8f0', cursorAccent:'#282a36', selection:'rgba(248,248,242,0.2)' },  MAC_ANSI),
      basic:     Object.assign({ background:'#1d1f21', foreground:'#c5c8c6', cursor:'#c5c8c6', cursorAccent:'#1d1f21', selection:'rgba(197,200,198,0.25)' }, MAC_ANSI)
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
      btn.querySelector('.label').textContent = isLight ? 'Switch to Dark' : 'Switch to Light';
    }

    function toggleSidebar() {
      var sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      localStorage.sidebarCollapsed = sidebar.classList.contains('collapsed');
    }

    /* ── OpenClaw ──────────────────────────────────── */
    var ocCmdLabels = {
      'gateway-status':        'openclaw gateway status',
      'status':                'openclaw status',
      'skills-list':           'openclaw skills list',
      'channels-list':         'openclaw channels list',
      'channels-capabilities': 'openclaw channels capabilities',
      'cron-list':             'openclaw cron list',
      'gateway-restart':       'openclaw gateway restart',
      'gateway-stop':          'openclaw gateway stop',
      'gateway-start':         'openclaw gateway start',
      'gateway-install':       'openclaw gateway install',
      'gateway-uninstall':     'openclaw gateway uninstall',
    };
    var ocPending = null;

    function ansi256ToHex(n) {
      if (n < 16) {
        var std = ['#555555','#e06c75','#98c379','#e5c07b','#61afef','#c678dd','#56b6c2','#abb2bf',
                   '#888888','#ff7b7b','#b5e890','#ffd080','#8abff0','#d9a0ff','#80d9e3','#ffffff'];
        return std[n] || '#ffffff';
      }
      if (n > 231) {
        var g = (8 + (n - 232) * 10).toString(16);
        if (g.length < 2) g = '0' + g;
        return '#' + g + g + g;
      }
      var idx = n - 16;
      var b = idx % 6; idx = Math.floor(idx / 6);
      var gr = idx % 6; var r = Math.floor(idx / 6);
      function ch(v) { var x = (v === 0 ? 0 : 55 + 40 * v).toString(16); return x.length < 2 ? '0'+x : x; }
      return '#' + ch(r) + ch(gr) + ch(b);
    }

    function ansiRgbToHex(r, g, b) {
      function ch(v) {
        var n = Math.max(0, Math.min(255, parseInt(v, 10) || 0)).toString(16);
        return n.length < 2 ? '0' + n : n;
      }
      return '#' + ch(r) + ch(g) + ch(b);
    }

    function ansiToHtml(raw) {
      var fg16 = {
        '30':'#555','31':'#e06c75','32':'#98c379','33':'#e5c07b',
        '34':'#61afef','35':'#c678dd','36':'#56b6c2','37':'#abb2bf',
        '90':'#888','91':'#ff7b7b','92':'#b5e890','93':'#ffd080',
        '94':'#8abff0','95':'#d9a0ff','96':'#80d9e3','97':'#ffffff'
      };
      var ESC = '\\x1b';
      var out = '', openSpan = false, fg = null, bg = null, bold = false, i = 0;
      function closeSpan() { if (openSpan) { out += '</span>'; openSpan = false; } }
      function applyStyle() {
        var css = '';
        if (fg) css += 'color:' + fg + ';';
        if (bg) css += 'background:' + bg + ';';
        if (bold) css += 'font-weight:700;';
        if (css) { out += '<span style="' + css + '">'; openSpan = true; }
      }
      while (i < raw.length) {
        var c = raw[i];
        if (c === ESC && raw[i+1] === '[') {
          var j = i + 2;
          while (j < raw.length && !(raw.charCodeAt(j) >= 64 && raw.charCodeAt(j) <= 126)) j++;
          if (raw[j] === 'm') {
            var codes = raw.slice(i+2, j).split(';');
            closeSpan();
            for (var ci = 0; ci < codes.length; ci++) {
              var n = parseInt(codes[ci], 10) || 0;
              if (n === 0) { fg = null; bg = null; bold = false; }
              else if (n === 1) { bold = true; }
              else if (n === 22) { bold = false; }
              else if (n === 39) { fg = null; }
              else if (n === 49) { bg = null; }
              else if ((n === 38 || n === 48) && codes[ci+1] === '5' && codes[ci+2] !== undefined) {
                if (n === 38) fg = ansi256ToHex(parseInt(codes[ci+2], 10));
                else bg = ansi256ToHex(parseInt(codes[ci+2], 10));
                ci += 2;
              } else if ((n === 38 || n === 48) && codes[ci+1] === '2' && codes[ci+2] !== undefined && codes[ci+3] !== undefined && codes[ci+4] !== undefined) {
                if (n === 38) fg = ansiRgbToHex(codes[ci+2], codes[ci+3], codes[ci+4]);
                else bg = ansiRgbToHex(codes[ci+2], codes[ci+3], codes[ci+4]);
                ci += 4;
              } else if (fg16[String(n)]) { fg = fg16[String(n)]; }
            }
            applyStyle();
          }
          i = j + 1;
        } else if (c === ESC) {
          i += 2;
        } else if (c.charCodeAt(0) === 13) {
          i++;
        } else {
          if (c === '&') out += '&amp;';
          else if (c === '<') out += '&lt;';
          else if (c === '>') out += '&gt;';
          else out += c;
          i++;
        }
      }
      closeSpan();
      return out;
    }

    async function runOC(action) {
      var out = document.getElementById('oc-output');
      if (out.dataset.pristine) { out.innerHTML = ''; delete out.dataset.pristine; }
      else {
        var sep = document.createElement('div');
        sep.style.cssText = 'height:3px;background:rgba(59,130,246,0.55);border-radius:2px;margin:1.25rem 0 0.6rem;';
        out.appendChild(sep);
      }
      var now = new Date().toLocaleTimeString('en-US', { timeStyle: 'short' });
      var hdr = document.createElement('div');
      hdr.innerHTML = '<span style="color:#38bdf8;font-weight:700">$ ' + escH(ocCmdLabels[action] || action) + '</span>  <span style="color:#94a3b8">' + now + '</span>';
      out.appendChild(hdr);
      var result = document.createElement('div');
      result.style.cssText = 'color:#94a3b8;padding-left:0.5rem;';
      result.textContent = 'Running\u2026';
      out.appendChild(result);
      out.scrollTop = out.scrollHeight;
      try {
        var resp = await fetch('/api/openclaw/' + action);
        var data = await resp.json();
        result.style.color = '';
        result.innerHTML = ansiToHtml(data.output || '(no output)');
      } catch(e) {
        result.style.color = '#f87171';
        result.textContent = 'Error: ' + e.message;
      }
      out.scrollTop = out.scrollHeight;
    }

    function confirmOC(action, label) {
      ocPending = action;
      document.getElementById('oc-confirm-text').textContent = 'Run: openclaw ' + label + ' — are you sure?';
      document.getElementById('oc-confirm-bar').style.display = 'flex';
    }

    function executeConfirmedOC() {
      if (ocPending) { var a = ocPending; cancelOCConfirm(); runOC(a); }
    }

    function cancelOCConfirm() {
      ocPending = null;
      document.getElementById('oc-confirm-bar').style.display = 'none';
    }

    function clearOCOutput() {
      var out = document.getElementById('oc-output');
      out.innerHTML = '<span style="color:#94a3b8">Cleared — click a command above.</span>';
      out.dataset.pristine = '1';
    }

    /* ── Gateway Panel ─────────────────────────────── */
    var gwPending = null;

    async function runGW(action) {
      var out = document.getElementById('gw-output');
      if (out.dataset.pristine) { out.innerHTML = ''; delete out.dataset.pristine; }
      else {
        var sep = document.createElement('div');
        sep.style.cssText = 'height:3px;background:rgba(59,130,246,0.55);border-radius:2px;margin:1.25rem 0 0.6rem;';
        out.appendChild(sep);
      }
      var now = new Date().toLocaleTimeString('en-US', { timeStyle: 'short' });
      var hdr = document.createElement('div');
      hdr.innerHTML = '<span style="color:#38bdf8;font-weight:700">$ ' + escH(ocCmdLabels[action] || action) + '</span>  <span style="color:#94a3b8">' + now + '</span>';
      out.appendChild(hdr);
      var result = document.createElement('div');
      result.style.cssText = 'color:#94a3b8;padding-left:0.5rem;';
      result.textContent = 'Running\u2026';
      out.appendChild(result);
      out.scrollTop = out.scrollHeight;
      try {
        var resp = await fetch('/api/openclaw/' + action);
        var data = await resp.json();
        result.style.color = '';
        result.innerHTML = ansiToHtml(data.output || '(no output)');
      } catch(e) {
        result.style.color = '#f87171';
        result.textContent = 'Error: ' + e.message;
      }
      out.scrollTop = out.scrollHeight;
    }

    function confirmGW(action, label) {
      gwPending = action;
      document.getElementById('gw-confirm-text').textContent = 'Run: openclaw ' + label + ' — are you sure?';
      document.getElementById('gw-confirm-bar').style.display = 'flex';
    }

    function executeConfirmedGW() {
      if (gwPending) { var a = gwPending; cancelGWConfirm(); runGW(a); }
    }

    function cancelGWConfirm() {
      gwPending = null;
      document.getElementById('gw-confirm-bar').style.display = 'none';
    }

    function clearGWOutput() {
      var out = document.getElementById('gw-output');
      out.innerHTML = '<span style="color:#94a3b8">Cleared — click a command above.</span>';
      out.dataset.pristine = '1';
    }

    /* ── LiteLLM ───────────────────────────────────── */
    function switchLlmTab(e, paneId) {
      var bar = e.target.closest('.action-bar');
      bar.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      bar.querySelectorAll('.tab-pane').forEach(function(p) { p.classList.remove('active'); });
      e.target.classList.add('active');
      document.getElementById(paneId).classList.add('active');
      var isLog = paneId === 'llm-log';
      document.getElementById('litellm-cmd-window').style.display = isLog ? 'none' : '';
      document.getElementById('litellm-log-window').style.display = isLog ? '' : 'none';
      if (isLog) fetchLiteLLMLogs();
      if (paneId === 'llm-models') runLiteLLM('model-info');
    }

    function renderHealthReport(div, raw) {
      var data;
      try { data = JSON.parse(raw); } catch(e) { return false; }
      if (!data || (!data.healthy_endpoints && !data.unhealthy_endpoints)) return false;
      var healthy   = data.healthy_endpoints   || [];
      var unhealthy = data.unhealthy_endpoints || [];
      function tally(arr) {
        var counts = {}, rpms = {};
        arr.forEach(function(ep) {
          var m = ep.model || '?';
          counts[m] = (counts[m] || 0) + 1;
          if (ep.rpm && !rpms[m]) rpms[m] = ep.rpm;
        });
        return { counts: counts, rpms: rpms };
      }
      var hd = tally(healthy), ud = tally(unhealthy);
      var errMap = {};
      unhealthy.forEach(function(ep) {
        var m = ep.model || '?';
        if (!errMap[m]) errMap[m] = parseLlmErr(ep.error || '');
      });
      var hKeys = Object.keys(hd.counts).sort();
      var uKeys = Object.keys(ud.counts).sort();
      var now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      var h = '<span style="color:#94a3b8">HEALTH CHECK  ·  ' + escH(now) + '</span>\\n\\n';
      h += '<span style="color:#e2e8f0;font-weight:600">Summary</span>  ';
      h += '<span style="color:#22c55e">' + healthy.length + ' healthy</span>';
      h += '<span style="color:#94a3b8">  /  </span>';
      h += '<span style="color:#ef4444">' + unhealthy.length + ' unhealthy</span>';
      h += '<span style="color:#94a3b8">   (' + hKeys.length + ' unique healthy · ' + uKeys.length + ' with errors)</span>\\n\\n';
      if (hKeys.length) {
        h += '<span style="color:#22c55e;font-weight:700">✓ HEALTHY</span>';
        h += '<span style="color:#94a3b8">  ' + hKeys.length + ' model' + (hKeys.length !== 1 ? 's' : '') + '  ·  ' + healthy.length + ' instance' + (healthy.length !== 1 ? 's' : '') + '</span>\\n';
        hKeys.forEach(function(m) {
          h += '  <span style="color:#38bdf8">' + escH(m) + '</span>';
          h += '<span style="color:#94a3b8">  ×' + hd.counts[m];
          if (hd.rpms[m]) h += '  rpm:' + hd.rpms[m];
          h += '</span>\\n';
        });
        h += '\\n';
      }
      if (uKeys.length) {
        h += '<span style="color:#ef4444;font-weight:700">✗ UNHEALTHY</span>';
        h += '<span style="color:#94a3b8">  ' + uKeys.length + ' model' + (uKeys.length !== 1 ? 's' : '') + '  ·  ' + unhealthy.length + ' instance' + (unhealthy.length !== 1 ? 's' : '') + '</span>\\n';
        uKeys.forEach(function(m) {
          var e = errMap[m] || { type: 'Error', msg: '' };
          h += '  <span style="color:#fca5a5">' + escH(m) + '</span>';
          h += '<span style="color:#94a3b8">  ×' + ud.counts[m] + '</span>';
          h += '  <span style="color:#f87171;font-weight:700">[' + escH(e.type) + ']</span>\\n';
          if (e.msg) h += '  <span style="color:#94a3b8">  └ ' + escH(e.msg) + '</span>\\n';
        });
      }
      div.innerHTML = h;
      return true;
    }

    function parseLlmErr(err) {
      if (!err) return { type: 'Unknown', msg: '' };
      var tm = err.match(/litellm\\.([A-Za-z]+):/);
      var type = tm ? tm[1] : (err.split(':')[0].split('.').pop() || 'Error');
      var clean = err.split('\\nstack trace:')[0];
      var di = clean.indexOf(' - ');
      var msg = '';
      if (di >= 0) {
        var js = clean.slice(di + 3).trim();
        try {
          var pe = JSON.parse(js);
          var ev = pe.error || {};
          var raw = (ev.metadata && ev.metadata.raw) || '';
          msg = (raw || ev.message || js).slice(0, 200);
          if (ev.code && !msg.includes(String(ev.code))) msg = '(' + ev.code + ')  ' + msg;
        } catch(ex) { msg = js.slice(0, 200); }
      } else {
        msg = clean.slice(0, 200);
      }
      return { type: type, msg: msg };
    }

    function escH(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderModelsReport(div, raw) {
      var data;
      try { data = JSON.parse(raw); } catch(e) { return false; }
      if (!data || !Array.isArray(data.data)) return false;
      var items = data.data;

      // Group by underlying model; also track per-alias underlying models for mixed-routing detection
      var byUnderlying = {};
      var aliasRoutes = {};
      items.forEach(function(item) {
        var alias      = item.model_name || '?';
        var underlying = (item.litellm_params && item.litellm_params.model) || '?';
        var rpm        = (item.litellm_params && item.litellm_params.rpm)   || null;
        var mi         = item.model_info || {};
        if (!byUnderlying[underlying]) byUnderlying[underlying] = { aliases: {}, mi: mi };
        var grp = byUnderlying[underlying].aliases;
        if (!grp[alias]) grp[alias] = { count: 0, rpm: rpm };
        grp[alias].count++;
        if (!aliasRoutes[alias]) aliasRoutes[alias] = {};
        aliasRoutes[alias][underlying] = true;
      });

      var mixedAliases = {};
      Object.keys(aliasRoutes).forEach(function(alias) {
        var us = Object.keys(aliasRoutes[alias]);
        if (us.length > 1) mixedAliases[alias] = us;
      });

      var uKeys     = Object.keys(byUnderlying).sort();
      var aliasCount = Object.keys(aliasRoutes).length;
      var now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

      var h = '<span style="color:#94a3b8">MODELS  ·  ' + escH(now) + '</span>\\n';
      h += '<span style="color:#94a3b8">' + aliasCount + ' aliases  ·  ' + uKeys.length + ' underlying models  ·  ' + items.length + ' instances total</span>\\n\\n';

      if (Object.keys(mixedAliases).length) {
        h += '<span style="color:#f59e0b;font-weight:700">⚠ MIXED ROUTING</span><span style="color:#94a3b8"> — aliases routing to multiple underlying models:</span>\\n';
        Object.keys(mixedAliases).forEach(function(alias) {
          h += '  <span style="color:#fbbf24">' + escH(alias) + '</span><span style="color:#94a3b8"> → ' + mixedAliases[alias].map(escH).join(', ') + '</span>\\n';
        });
        h += '\\n';
      }

      uKeys.forEach(function(underlying) {
        var grp      = byUnderlying[underlying];
        var mi       = grp.mi;
        var provider = mi.litellm_provider || underlying.split('/')[0] || '?';
        var ctx      = llmFmtCtx(mi.max_tokens);
        var cost     = llmFmtCost(mi.input_cost_per_token, mi.output_cost_per_token);
        var caps     = llmFmtCaps(mi);
        h += '<span style="color:#e2e8f0;font-weight:700">' + escH(underlying) + '</span>\\n';
        h += '  <span style="color:#94a3b8">provider:' + escH(provider) + '  ctx:' + escH(ctx) + '  ' + escH(cost) + (caps ? '  ' + escH(caps) : '') + '</span>\\n';
        Object.keys(grp.aliases).sort().forEach(function(alias) {
          var info  = grp.aliases[alias];
          var mixed = mixedAliases[alias] ? ' <span style="color:#f59e0b"> ⚠ mixed</span>' : '';
          h += '  <span style="color:#38bdf8">' + escH(alias) + '</span>';
          h += '<span style="color:#94a3b8">  ×' + info.count;
          if (info.rpm) h += '  rpm:' + info.rpm;
          h += '</span>' + mixed + '\\n';
        });
        h += '\\n';
      });

      div.innerHTML = h;
      return true;
    }

    function llmFmtCtx(n) {
      if (!n) return '?';
      var m = n / 1000000;
      if (m >= 1) return (m === Math.floor(m) ? m : m.toFixed(1)) + 'M';
      return Math.round(n / 1000) + 'K';
    }

    function llmFmtCost(inp, out) {
      if (!inp && !out) return 'free';
      var i = inp ? '$' + (inp * 1000000).toFixed(2) : '$0.00';
      var o = out ? '$' + (out * 1000000).toFixed(2) : '$0.00';
      return i + ' / ' + o + ' per 1M tokens';
    }

    function llmFmtCaps(mi) {
      var c = [];
      if (mi.supports_reasoning)        c.push('reasoning');
      if (mi.supports_vision)           c.push('vision');
      if (mi.supports_function_calling) c.push('tools');
      if (mi.supports_response_schema)  c.push('schema');
      if (mi.supports_web_search)       c.push('search');
      return c.join('  ');
    }

    async function runLiteLLM(action) {
      var outputDiv  = document.getElementById('litellm-output');
      var statusSpan = document.getElementById('litellm-status');
      outputDiv.textContent  = 'Executing ' + action + '...';
      statusSpan.textContent = 'Running...';
      try {
        var response = await fetch('/api/litellm/' + action);
        var data = await response.json();
        var parseInput = data.stdout || data.output || '';
        if (action === 'health' && renderHealthReport(outputDiv, parseInput)) {
          statusSpan.textContent = 'Completed';
        } else if (action === 'model-info' && renderModelsReport(outputDiv, parseInput)) {
          statusSpan.textContent = 'Completed';
        } else {
          outputDiv.textContent  = data.output || 'No output.';
          statusSpan.textContent = 'Completed';
        }
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

    /* ── Terminal — instance helpers ──────────────────── */
    function getTermState(id) {
      if (!terms[id]) {
        terms[id] = {
          term:     null,
          fitAddon: null,
          ws:       null,
          fontSize: 14,
          theme:    Object.assign({}, PROFILES.basic)
        };
      }
      return terms[id];
    }

    /* ── Terminal — init ───────────────────────────── */
    function initXterm(id) {
      var s = getTermState(id);
      activeTermId = id;
      if (s.term) {
        updateSwatchBtns(id);
        setTimeout(function() { if (s.fitAddon) s.fitAddon.fit(); s.term.focus(); }, 50);
        return;
      }

      s.term = new Terminal({
        fontSize:    s.fontSize,
        fontFamily:  "'Menlo', 'Monaco', 'Courier New', monospace",
        theme:       s.theme,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback:  5000
      });

      s.fitAddon = new FitAddon.FitAddon();
      s.term.loadAddon(s.fitAddon);
      s.term.open(document.getElementById('xtermTerm-' + id));

      try {
        var wgl = new WebglAddon.WebglAddon();
        wgl.onContextLoss(function() { wgl.dispose(); });
        s.term.loadAddon(wgl);
      } catch(e) { /* fall back to canvas renderer */ }

      s.term.onData(function(data) {
        if (s.ws && s.ws.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ type: 'data', data: data }));
        }
      });

      s.term.onResize(function(size) {
        if (s.ws && s.ws.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
        }
      });

      updateSwatchBtns(id);

      setTimeout(function() {
        s.fitAddon.fit();
        connectTermWS(id);
        s.term.focus();
      }, 60);
    }

    /* ── Terminal — WebSocket ──────────────────────── */
    function connectTermWS(id) {
      var s = getTermState(id);
      if (s.ws) { try { s.ws.close(); } catch(e) {} }
      var wsUrl = 'ws://' + location.hostname + ':' + location.port + '/terminal';
      s.ws = new WebSocket(wsUrl);

      s.ws.onopen = function() {
        setTermStatus(id, true, 'Connected');
        if (s.term) {
          s.ws.send(JSON.stringify({ type: 'resize', cols: s.term.cols, rows: s.term.rows }));
        }
      };

      s.ws.onmessage = function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type === 'data') s.term.write(msg.data);
          if (msg.type === 'exit') {
            s.term.write('\\r\\n\\x1b[33m[Process exited]\\x1b[0m\\r\\n');
            setTermStatus(id, false, 'Exited');
          }
        } catch(ex) {}
      };

      s.ws.onclose = function() { setTermStatus(id, false, 'Disconnected'); };
      s.ws.onerror = function() {
        setTermStatus(id, false, 'Connection error');
        s.term.write('\\r\\n\\x1b[31m[WebSocket error]\\x1b[0m\\r\\n');
      };
    }

    function reconnectTerminal(id) {
      var s = getTermState(id);
      if (!s.term) { initXterm(id); return; }
      s.term.write('\\r\\n\\x1b[33m[Reconnecting...]\\x1b[0m\\r\\n');
      connectTermWS(id);
      setTimeout(function() { if (s.term) s.term.focus(); }, 80);
    }

    function killTerminal(id) {
      var s = getTermState(id);
      if (s.ws) { try { s.ws.close(); } catch(e) {} s.ws = null; }
      if (s.term) { s.term.write('\\r\\n\\x1b[31m[Session closed]\\x1b[0m\\r\\n'); s.term.focus(); }
      setTermStatus(id, false, 'Disconnected');
    }

    function clearTerminal(id) { var s = getTermState(id); if (s.term) { s.term.clear(); s.term.focus(); } }

    function setTermStatus(id, connected, text) {
      var dot   = document.getElementById('termStatusDot-' + id);
      var label = document.getElementById('termStatusText-' + id);
      if (dot)   { dot.classList.toggle('on',  connected); dot.classList.toggle('off', !connected); }
      if (label) label.textContent = text;
    }

    /* ── Terminal — font size ──────────────────────── */
    function adjustFontSize(id, delta) {
      var s = getTermState(id);
      s.fontSize = Math.max(8, Math.min(32, s.fontSize + delta));
      document.getElementById('fsDisplay-' + id).textContent = s.fontSize;
      if (s.term) {
        s.term.options.fontSize = s.fontSize;
        if (s.fitAddon) setTimeout(function() { s.fitAddon.fit(); s.term.focus(); }, 20);
      }
    }

    /* ── Terminal — profiles ───────────────────────── */
    function applyProfile(id, name) {
      if (!PROFILES[name]) return;
      var s = getTermState(id);
      s.theme = Object.assign({}, PROFILES[name]);
      applyCurrentTheme(id);
      updateSwatchBtns(id);
      if (s.term) s.term.focus();
    }

    function applyCurrentTheme(id) {
      var s = getTermState(id);
      if (!s.term) return;
      s.term.options.theme = s.theme;
      var body = document.querySelector('#xterm' + id + ' .term-body');
      if (body) body.style.background = s.theme.background;
    }

    /* ── Terminal — color swatches ─────────────────── */
    function buildSwatchGrids() {
      ['fg','bg'].forEach(function(which) {
        var grid = document.getElementById(which + 'SwatchGrid');
        grid.innerHTML = '';
        SWATCHES.forEach(function(color) {
          var sw = document.createElement('button');
          sw.className        = 'sw';
          sw.style.background = color;
          sw.title            = color;
          sw.setAttribute('data-color', color);
          sw.onclick = function() { applyColor(which, color); };
          grid.appendChild(sw);
        });
      });
    }

    function updateSwatchBtns(id) {
      var s  = getTermState(id);
      var fg = document.getElementById('fgSwatchBtn-' + id);
      var bg = document.getElementById('bgSwatchBtn-' + id);
      if (fg) fg.style.background = s.theme.foreground;
      if (bg) bg.style.background = s.theme.background;
    }

    function markActiveSwatches(id, which) {
      var s      = getTermState(id);
      var active = which === 'fg' ? s.theme.foreground : s.theme.background;
      var grid   = document.getElementById(which + 'SwatchGrid');
      grid.querySelectorAll('.sw').forEach(function(sw) {
        sw.classList.toggle('active', sw.getAttribute('data-color') === active);
      });
    }

    var activePicker = null;

    function openPicker(id, which, event) {
      event.stopPropagation();
      var fgP    = document.getElementById('fgPicker');
      var bgP    = document.getElementById('bgPicker');
      var picker = which === 'fg' ? fgP : bgP;

      if (picker.classList.contains('open') && termPickerTarget === id) {
        picker.classList.remove('open');
        activePicker     = null;
        termPickerTarget = null;
        return;
      }
      fgP.classList.remove('open');
      bgP.classList.remove('open');
      termPickerTarget = id;

      var btn  = event.currentTarget;
      var rect = btn.getBoundingClientRect();
      picker.style.top  = (rect.bottom + 7) + 'px';
      picker.style.left = Math.min(rect.left, window.innerWidth - 230) + 'px';
      picker.classList.add('open');
      activePicker = which;
      markActiveSwatches(id, which);
    }

    function applyColor(which, color) {
      var id = termPickerTarget;
      if (!id) return;
      var s = getTermState(id);
      if (which === 'fg') {
        s.theme = Object.assign({}, s.theme, { foreground: color, cursor: color });
      } else {
        s.theme = Object.assign({}, s.theme, { background: color, cursorAccent: color });
      }
      applyCurrentTheme(id);
      updateSwatchBtns(id);
      document.getElementById(which + 'Picker').classList.remove('open');
      activePicker     = null;
      termPickerTarget = null;
      document.getElementById('termProfile-' + id).value = '';
      if (s.term) s.term.focus();
    }

    /* ── Menu navigation ───────────────────────────── */
    document.addEventListener('click', function(e) {
      /* Close swatch pickers on outside click */
      if (!e.target.closest('.swatch-popup') && !e.target.closest('.swatch-btn')) {
        document.getElementById('fgPicker').classList.remove('open');
        document.getElementById('bgPicker').classList.remove('open');
        activePicker     = null;
        termPickerTarget = null;
      }

      if (e.target.closest('.header-actions') || e.target.closest('.theme-toggle-btn') || e.target.closest('.sidebar-footer')) return;

      var item = e.target.closest('.menu-item');
      if (!item) return;

      /* Remove terminal-active when leaving any terminal panel */
      var prevPanel = document.querySelector('.panel.active');
      if (prevPanel && prevPanel.classList.contains('term-panel')) {
        document.getElementById('main').classList.remove('terminal-active');
      }

      document.querySelectorAll('.menu-item.active').forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');

      var panelId = item.dataset.panel;
      if (panelId) {
        document.querySelectorAll('.panel.active').forEach(function(p) { p.classList.remove('active'); });
        var TERM_PANELS = { xterm1:1, xterm2:2, xterm3:3, xterm4:4, xterm5:5 };
        var termNum = TERM_PANELS[panelId];
        if (termNum) {
          document.getElementById('main').classList.add('terminal-active');
          activeTermId = termNum;
          updateSwatchBtns(termNum);
          /* Show panel first so container has dimensions, then init */
          var panel = document.getElementById(panelId);
          if (panel) panel.classList.add('active');
          initXterm(termNum);
          return;
        }
        var panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');
      }
    });


    /* ── Sidebar hover (mouseenter/mouseleave per element) ── */
    (function() {
      function attachHover(el) {
        el.addEventListener('mouseenter', function() { el.classList.add('mc-hover'); });
        el.addEventListener('mouseleave', function() { el.classList.remove('mc-hover'); });
      }
      document.querySelectorAll('.menu-item').forEach(attachHover);
      attachHover(document.getElementById('toggle-sidebar-btn'));
      attachHover(document.getElementById('themeToggleBtn'));
      window.addEventListener('blur', function() {
        document.querySelectorAll('.mc-hover').forEach(function(el) { el.classList.remove('mc-hover'); });
      });
    })();

    /* ── Terminal — global resize handler ─────────── */
    window.addEventListener('resize', function() {
      if (activeTermId && terms[activeTermId] && terms[activeTermId].fitAddon) {
        terms[activeTermId].fitAddon.fit();
      }
    });

    /* Build shared swatch grids once on load */
    buildSwatchGrids();

    /* ── Version History ────────────────────────────── */
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatVHDate(iso) {
      try {
        var d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch(e) { return iso; }
    }

    function refreshVersionHistory() {
      var tableBody = document.getElementById('vh-table-body');
      var currentCard = document.getElementById('vh-current-card');
      if (tableBody) tableBody.innerHTML = '<span style="color:#94a3b8">Loading...</span>';
      fetch('/api/version')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          // Update branch badge
          var badge = document.getElementById('vh-branch-badge');
          if (badge) badge.textContent = data.branch || '';

          // Update current version card
          var commits = data.commits || [];
          if (commits.length > 0) {
            var head = commits[0];
            document.getElementById('vh-head-hash').textContent = head.short || head.hash.slice(0, 7);
            document.getElementById('vh-head-msg').textContent = head.subject || '';
            document.getElementById('vh-head-author').textContent = head.author || '';
            document.getElementById('vh-head-date').textContent = formatVHDate(head.date);
            document.getElementById('vh-server-start').textContent = formatVHDate(data.serverStartTime);
            if (currentCard) currentCard.style.display = '';
          }

          // Build table
          if (!tableBody) return;
          if (commits.length === 0) {
            tableBody.innerHTML = '<span style="color:#94a3b8">No commits found.</span>';
            return;
          }
          var rows = commits.map(function(c, i) {
            var isHead = i === 0;
            var rowStyle = isHead
              ? 'background:#052e16;border-left:3px solid #16a34a;'
              : 'border-left:3px solid transparent;';
            return '<div style="display:grid;grid-template-columns:7ch 1fr 18ch 14ch;gap:0 12px;padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.05);' + rowStyle + '">'
              + '<span style="color:' + (isHead ? '#4ade80' : '#60a5fa') + ';font-family:monospace;">' + escapeHtml(c.short || c.hash.slice(0,7)) + '</span>'
              + '<span style="color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(c.subject) + '</span>'
              + '<span style="color:#94a3b8;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(c.author) + '</span>'
              + '<span style="color:#64748b;font-size:0.78rem;">' + escapeHtml(formatVHDate(c.date)) + '</span>'
              + '</div>';
          }).join('');
          var header = '<div style="display:grid;grid-template-columns:7ch 1fr 18ch 14ch;gap:0 12px;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.15);color:#64748b;font-size:0.72rem;letter-spacing:0.07em;">'
            + '<span>HASH</span><span>MESSAGE</span><span>AUTHOR</span><span>DATE</span>'
            + '</div>';
          tableBody.innerHTML = header + rows;
        })
        .catch(function(e) {
          if (tableBody) tableBody.innerHTML = '<span style="color:#f87171">Error: ' + escapeHtml(e.message) + '</span>';
        });
    }

    // Auto-load when panel becomes visible
    (function() {
      var panel = document.getElementById('version-history');
      if (!panel) return;
      var loaded = false;
      var observer = new MutationObserver(function() {
        if (panel.classList.contains('active') && !loaded) {
          loaded = true;
          refreshVersionHistory();
        }
      });
      observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    })();

    /* ── Restore persisted state ───────────────────── */
    if (localStorage.theme === 'light') {
      document.body.classList.add('light');
      var btn = document.getElementById('themeToggleBtn');
      btn.querySelector('.icon').textContent  = '☀️';
      btn.querySelector('.label').textContent = 'Switch to Dark';
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
  const ptyEnv = Object.assign({}, process.env, {
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '1',
    CLICOLOR_FORCE: '1'
  });
  delete ptyEnv.NO_COLOR;
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd:  os.homedir(),
    env:  ptyEnv
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

server.listen(PORT, '0.0.0.0', function() {
  const vInfo = getVersionInfo();
  const headHash = (vInfo.commits && vInfo.commits[0]) ? vInfo.commits[0].short : 'unknown';
  console.log('Mission Control v1.0 live on :' + PORT + ' — commit ' + headHash + ' — real zsh shell ready');
});
