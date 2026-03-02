# mission-control
Mission Control dashboard and CLI hub for OpenClaw operations

## Recommended local workflow

Use two separate checkouts on the same Mac:

- Development checkout: this directory, `/Users/openclaw/CodeProjects/mission-control`
- Production checkout: `~/ProductionCode/mission-control`

Development should run on port `3001`, and production should run on port `3270`.

## Development

Install dependencies and run the app in development:

```bash
cd /Users/openclaw/CodeProjects/mission-control
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:3001
```

## Production setup on this Mac

Run this once from the development checkout:

```bash
cd /Users/openclaw/CodeProjects/mission-control
npm run setup:prod
```

This will:

- create or update `~/ProductionCode/mission-control`
- run `npm ci` in the production checkout
- make the production shell scripts executable

Then open:

```text
http://127.0.0.1:3270
```

## Deploying to production

The right term here is "deploy to production" or just "deploy".

Recommended workflow:

```bash
cd /Users/openclaw/CodeProjects/mission-control
npm test
git add .
git commit -m "Your change"
git push origin main
npm run deploy:prod
```

The deploy script expects your current checkout `HEAD` to match `origin/main`, so you do not accidentally deploy unpushed local work.

## Useful production commands

Install or refresh the production LaunchAgent:

```bash
zsh scripts/install-launch-agent.sh
```

Start production:

```bash
npm run prod:start
```

If the canonical LaunchAgent is installed, this starts Mission Control under `launchd`.
If not, it falls back to the legacy background helper.

Stop production:

```bash
npm run prod:stop
```

Restart production:

```bash
npm run prod:restart
```

Tail recent logs:

```bash
npm run prod:logs
```

Mission Control writes logs to `~/ProductionCode/mission-control/logs/`.
If production is launchd-managed, `npm run prod:start` and `npm run prod:restart` now reuse that service instead of trying to start a duplicate process.

## launchd note

The supported production startup path is a single LaunchAgent:

```bash
~/Library/LaunchAgents/ai.openclaw.mission-control.plist
```

That agent points at `~/ProductionCode/mission-control/scripts/start-production.sh`, which keeps Node in the foreground and is the correct pattern for `launchd`.

If you want to start the production copy manually without `launchd`, use:

```bash
~/ProductionCode/mission-control/scripts/start-production-bg.sh
```

## Port overrides

The app itself still supports a manual `PORT` override:

```bash
PORT=4010 node server.js
```

## Smoke test

Run the local smoke test with:

```bash
npm test
```

This starts Mission Control on a temporary localhost port, checks `/`, `/api/version`, and the `/terminal` WebSocket, then shuts the test server down.
