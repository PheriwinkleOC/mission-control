# mission-control
Mission Control dashboard and CLI hub for OpenClaw operations

## Running the server

By default, Mission Control listens on port `3270`.

Start it with the default port:

```bash
cd /Users/openclaw/CodeProjects/mission-control
npm install
node server.js
```

Then open:

```text
http://127.0.0.1:3270
```

## Changing the port

To run Mission Control on a port other than the default `3270`, set the `PORT` environment variable before starting the server:

```bash
cd /Users/openclaw/CodeProjects/mission-control
PORT=4010 node server.js
```

Then open:

```text
http://127.0.0.1:4010
```

The same override works with `npm start`:

```bash
PORT=4010 npm start
```

For `launchd` on macOS, set `PORT` in the job environment or wrapper script if you want a port other than the default `3270`.

## Smoke test

Run the local smoke test with:

```bash
npm test
```

This starts Mission Control on a temporary localhost port, checks `/`, `/api/version`, and the `/terminal` WebSocket, then shuts the test server down.
