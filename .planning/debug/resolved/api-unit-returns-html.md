---
status: resolved
trigger: "GET /api/unit/:service returns HTML instead of JSON"
created: 2026-02-21T14:38:00Z
updated: 2026-02-21T14:42:00Z
---

## Current Focus

hypothesis: Stale server process running old code without unit router
test: Compared running process start time vs commit timestamps
expecting: Process predates the unit router addition
next_action: Restart the server process

## Symptoms

expected: GET /api/unit/apparmor.service returns JSON { ok, service, path, content, writable }
actual: Returns HTML (index.html) - "Unexpected token '<', '<!doctype'... is not valid JSON"
errors: JSON parse error in UnitFile.tsx line 35 (res.json() on HTML response)
reproduction: Navigate to /unit/apparmor.service, React fetches /api/unit/apparmor.service, gets HTML
started: After phase 5 code was committed (unit routes added)

## Eliminated

- hypothesis: Express middleware ordering bug (SPA catch-all before API routes)
  evidence: server/index.js has API routes (line 24-32) before error handler (36), static (46), SPA catch-all (50). Reproduced with fresh server on port 17700 - API route matched correctly.
  timestamp: 2026-02-21T14:39:00Z

- hypothesis: Express 5 path-to-regexp can't match dots in :service param
  evidence: Tested path-to-regexp v8.3.0 match('/:service') against 'apparmor.service' - matches fine. Express 5 reproduction also works.
  timestamp: 2026-02-21T14:39:30Z

- hypothesis: SERVICE_NAME_RE regex rejects apparmor.service
  evidence: /^[\w@\-.]+$/ tested against apparmor.service - returns true
  timestamp: 2026-02-21T14:39:45Z

- hypothesis: Vite proxy misconfiguration
  evidence: Vite config has '/api': 'http://localhost:7700' which is standard shorthand. However, HOST=100.87.113.34 means Express isn't on localhost. But proxy error would yield 500 not HTML.
  timestamp: 2026-02-21T14:40:00Z

- hypothesis: Express error handler not catching async errors
  evidence: Express 5.2.1 handles async errors natively. Tested with throw in async handler - error handler caught it correctly.
  timestamp: 2026-02-21T14:40:15Z

## Evidence

- timestamp: 2026-02-21T14:40:30Z
  checked: Process listening on port 7700
  found: PID 546831, started at 02:58, running 'node server/index.js'
  implication: This process has been running for ~12 hours

- timestamp: 2026-02-21T14:40:45Z
  checked: Git commit timestamps for unit route addition
  found: Commit 54e10cf (mount unit router) at 13:56:20, commit bcfde06 (create unit.js) at 13:56:09
  implication: Unit route was added ~11 hours AFTER the running server started

- timestamp: 2026-02-21T14:41:00Z
  checked: server/index.js at commit 54e10cf^ (before unit route)
  found: No 'import unitRouter' and no 'app.use("/api/unit", unitRouter)' lines
  implication: Running server has no /api/unit route - requests fall through to SPA catch-all

- timestamp: 2026-02-21T14:41:10Z
  checked: curl http://100.87.113.34:7700/api/health
  found: Returns JSON correctly (health route exists in old code)
  implication: Server is functional, just missing the unit route

- timestamp: 2026-02-21T14:41:15Z
  checked: curl http://100.87.113.34:7700/api/unit/apparmor.service (verbose)
  found: Returns 200 with Content-Type: text/html, Content-Length: 445 (matches dist/index.html size)
  implication: SPA catch-all is serving index.html for the unmatched /api/unit/* path

- timestamp: 2026-02-21T14:41:20Z
  checked: Fresh server on PORT=17700 HOST=127.0.0.1 with current code
  found: /api/unit/apparmor.service returns correct JSON with unit file content
  implication: Current code is correct, the problem is the stale process

## Resolution

root_cause: The running Express server process (PID 546831, started at 02:58) is executing code from BEFORE the unit router was added (commit 54e10cf at 13:56). The process was never restarted after the new routes were committed. Without the /api/unit route, requests to /api/unit/:service fall through all API middleware and are caught by the SPA catch-all (line 50: app.get('/{*splat}', ...)), which serves dist/index.html. The React frontend receives HTML instead of JSON, causing the JSON parse error.

Secondary issue: .env sets HOST=100.87.113.34 (Tailscale IP) while vite.config.ts proxy targets http://localhost:7700. In dev mode, the Vite proxy cannot reach Express because they are on different network interfaces. This is a separate issue that would affect dev mode (npm run dev) but not production mode (npm start).

fix: |
  1. IMMEDIATE: Kill the stale server process and restart
     kill 546831 && node server/index.js

  2. SECONDARY: Fix Vite proxy to match the actual HOST, or change .env HOST to 127.0.0.1,
     or make the Vite proxy target dynamic. Options:

     Option A - Fix .env (simplest):
       HOST=127.0.0.1

     Option B - Fix vite.config.ts proxy to use the .env HOST:
       '/api': 'http://100.87.113.34:7700'

     Option C - Use 0.0.0.0 to listen on all interfaces (contradicts INFR-02 comment)

verification: |
  After restart: curl http://100.87.113.34:7700/api/unit/apparmor.service should return JSON.
  After HOST fix: In dev mode, Vite proxy should forward /api requests to Express successfully.

files_changed: []
