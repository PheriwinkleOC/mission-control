const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close((closeErr) => {
        if (closeErr) return reject(closeErr);
        if (!port) return reject(new Error('Failed to allocate a free port.'));
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpRequest(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET'
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function waitForServer(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await httpRequest(port, '/api/version');
      if (response.statusCode === 200) return response;
    } catch (error) {
      if (error.code !== 'ECONNREFUSED') throw error;
    }
    await wait(150);
  }
  throw new Error('Timed out waiting for Mission Control to start.');
}

function runWebSocketCheck(port) {
  return new Promise((resolve, reject) => {
    const marker = '__MC_SMOKE__';
    const ws = new WebSocket(`ws://127.0.0.1:${port}/terminal`);
    let settled = false;
    let output = '';

    const timer = setTimeout(() => {
      fail(new Error('Timed out waiting for terminal output.'));
    }, 8000);

    function cleanup() {
      clearTimeout(timer);
      try { ws.close(); } catch (error) {}
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    function pass() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'resize', cols: 100, rows: 30 }));
      ws.send(JSON.stringify({ type: 'data', data: `printf '${marker}\\r'` }));
    });

    ws.on('message', (raw) => {
      let payload;
      try {
        payload = JSON.parse(String(raw));
      } catch (error) {
        fail(new Error(`Received invalid terminal payload: ${error.message}`));
        return;
      }

      if (payload.type === 'data') {
        output += payload.data;
        if (output.includes(marker)) pass();
      } else if (payload.type === 'exit') {
        fail(new Error('Terminal exited before returning smoke marker.'));
      }
    });

    ws.on('error', fail);
    ws.on('close', () => {
      if (!settled && !output.includes(marker)) {
        fail(new Error('Terminal socket closed before smoke marker was received.'));
      }
    });
  });
}

async function main() {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  let exited = false;

  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('exit', () => { exited = true; });

  try {
    const versionResponse = await waitForServer(port, 10000);
    const rootResponse = await httpRequest(port, '/');

    if (rootResponse.statusCode !== 200) {
      throw new Error(`Expected GET / to return 200, got ${rootResponse.statusCode}.`);
    }
    if (!rootResponse.body.includes('Mission Control')) {
      throw new Error('Root HTML does not contain the Mission Control app shell.');
    }

    let versionPayload;
    try {
      versionPayload = JSON.parse(versionResponse.body);
    } catch (error) {
      throw new Error(`Version endpoint returned invalid JSON: ${error.message}`);
    }

    if (!versionPayload.packageVersion) {
      throw new Error('Version endpoint did not include packageVersion.');
    }
    if (!Array.isArray(versionPayload.commits)) {
      throw new Error('Version endpoint did not include a commits array.');
    }

    await runWebSocketCheck(port);

    console.log(`Smoke test passed on port ${port}.`);
    console.log(`Version: ${versionPayload.packageVersion}`);
    console.log(`Commits reported: ${versionPayload.commits.length}`);
  } catch (error) {
    const details = [];
    if (stdout.trim()) details.push(`stdout:\n${stdout.trim()}`);
    if (stderr.trim()) details.push(`stderr:\n${stderr.trim()}`);
    if (exited) details.push('server exited during smoke test');
    const suffix = details.length ? `\n\n${details.join('\n\n')}` : '';
    throw new Error(`${error.message}${suffix}`);
  } finally {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
