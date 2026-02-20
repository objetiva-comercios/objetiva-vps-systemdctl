---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [vite, react, express, sqlite, tailwindcss, better-sqlite3, dotenv, react-router, lucide-react, execFile, systemctl]

# Dependency graph
requires: []
provides:
  - Vite 7 + React 19 + TypeScript SPA scaffold with npm run build working
  - Express 5 server bound to 127.0.0.1:7700 serving built SPA with SPA catch-all
  - SQLite database initialized at ./data/systemdctl.db with WAL mode and foreign_keys
  - execFile security wrapper (server/utils/exec.js) enforcing action whitelist + service name regex
  - Brand design tokens: #0a0e14 background, #22c55e accent, JetBrains Mono font via Tailwind v4 @theme
  - Layout shell with header + sidebar for future phase content
  - /api/health endpoint returning {ok:true, timestamp}
  - dotenv config with PORT/HOST/DB_PATH/NODE_ENV environment variables
affects: [02-dashboard, 03-logs, 04-log-streaming, 05-unit-files]

# Tech tracking
tech-stack:
  added:
    - vite@7.3.1 (build tool)
    - react@19.2.0 + react-dom@19.2.0 (UI framework)
    - react-router@7.13.0 (client-side routing)
    - express@5.2.1 (HTTP server, native async/await)
    - better-sqlite3@12.6.2 (SQLite driver)
    - dotenv@17.3.1 (.env loading)
    - tailwindcss@4.x + @tailwindcss/vite (CSS framework, v4 Vite plugin)
    - @fontsource-variable/jetbrains-mono (self-hosted variable font)
    - lucide-react@0.575.0 (icon components)
    - concurrently (dev: run server + client simultaneously)
    - typescript@5.9.3 (type checking)
  patterns:
    - Vite dev proxy to Express on localhost:7700 for /api routes
    - Express 5 SPA fallback with express.static({index:false}) + named wildcard route
    - execFile security wrapper: ALLOWED_ACTIONS frozen array + SERVICE_NAME_RE regex validation
    - Tailwind v4 @theme CSS directive for brand tokens (no tailwind.config.js)
    - SQLite WAL mode + foreign_keys pragma on first open
    - ESM throughout: "type":"module" in package.json, import/export everywhere
    - Server-side __dirname via path.dirname(fileURLToPath(import.meta.url))

key-files:
  created:
    - server/index.js (Express app entry point)
    - server/config.js (env config with dotenv)
    - server/db.js (SQLite init with WAL)
    - server/utils/exec.js (THE execFile security wrapper)
    - src/index.css (Tailwind v4 @theme brand tokens)
    - src/components/Layout.tsx (header + sidebar shell)
    - src/App.tsx (React Router routes)
    - src/main.tsx (BrowserRouter entry)
    - .env.example (documented config)
    - vite.config.ts (React + Tailwind plugins + /api proxy)
  modified:
    - package.json (name, engines, scripts, all dependencies)
    - .gitignore (added .env, data/, node_modules/, dist/)

key-decisions:
  - "Express 5 wildcard route uses /{*splat} not * (path-to-regexp v8 breaking change)"
  - "Tailwind v4 via @tailwindcss/vite plugin — no tailwind.config.js or postcss.config.js"
  - "Server files use plain JS (not TypeScript) for simple npm run build && node server/index.js flow"
  - "execFile wrapper exports ALLOWED_ACTIONS and SERVICE_NAME_RE for future test use"
  - "SPA catch-all registered after API routes with express.static({index:false}) to avoid consuming /"

patterns-established:
  - "Pattern: execFile wrapper — all systemctl calls go through runSystemctl(), never exec() or shell strings"
  - "Pattern: Config module — all env vars read once via server/config.js with defaults; other modules import from there"
  - "Pattern: Express error middleware — {ok:false, error:string, details?:string} JSON shape for all API errors"
  - "Pattern: Tailwind tokens — bg-bg-base, text-text-primary, text-accent, border-border are the canonical class names"

requirements-completed: [INFR-02, INFR-03, INFR-04]

# Metrics
duration: 6min
completed: 2026-02-20
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**Vite 7 + Express 5 + SQLite project scaffolded with execFile security wrapper enforcing systemctl action whitelist and service name regex validation, server bound to 127.0.0.1:7700**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-20T11:16:21Z
- **Completed:** 2026-02-20T11:22:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Full project scaffold: Vite 7 + React 19 + TypeScript with all Phase 1 dependencies installed
- Express 5 server binding to 127.0.0.1:7700, serving built SPA with /api/health endpoint
- SQLite database at ./data/systemdctl.db with WAL mode and foreign_keys enabled
- execFile security wrapper (INFR-03/INFR-04): ALLOWED_ACTIONS frozen whitelist + SERVICE_NAME_RE regex validation before any child process call
- Tailwind v4 brand theme: #0a0e14 background, #22c55e accent, JetBrains Mono variable font via @theme
- Layout shell with header + sidebar ready for Phase 2 dashboard content

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold project with Vite and install all Phase 1 dependencies** - `7a46726` (chore)
2. **Task 2: Express server, config, SQLite database, execFile security wrapper** - `1ae7d12` (feat)

**Plan metadata:** _(see final commit below)_

## Files Created/Modified
- `server/index.js` - Express app: 127.0.0.1 bind, /api/health, static serving, SPA fallback
- `server/config.js` - dotenv/config import; exports PORT, HOST, DB_PATH, NODE_ENV
- `server/db.js` - better-sqlite3 init with mkdirSync, WAL mode, foreign_keys
- `server/utils/exec.js` - execFile security wrapper with ALLOWED_ACTIONS + SERVICE_NAME_RE
- `src/index.css` - Tailwind v4 @theme brand design tokens + JetBrains Mono import
- `src/components/Layout.tsx` - Header + sidebar layout shell with lucide-react icons
- `src/App.tsx` - React Router routes with Layout wrapper
- `src/main.tsx` - BrowserRouter entry point
- `package.json` - name=systemdctl, engines>=20, all dependencies, correct scripts
- `vite.config.ts` - @vitejs/plugin-react + @tailwindcss/vite + /api proxy
- `.env.example` - PORT/HOST/DB_PATH/NODE_ENV documented
- `.env` - runtime config (gitignored)
- `.gitignore` - exclude .env, data/, node_modules/, dist/

## Decisions Made
- Express 5 uses path-to-regexp v8 which requires named wildcards: `/{*splat}` instead of bare `*` for the SPA catch-all
- Tailwind v4 uses the Vite plugin approach — no `tailwind.config.js` or `postcss.config.js`
- Server files remain plain JavaScript (not TypeScript) for simple single-command deployment
- execFile wrapper exports `ALLOWED_ACTIONS` and `SERVICE_NAME_RE` as named exports for future testing phases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Express 5 SPA catch-all wildcard syntax**
- **Found during:** Task 2 (server/index.js)
- **Issue:** `app.get('*', ...)` throws `PathError: Missing parameter name at index 1` in Express 5 because path-to-regexp v8 no longer supports bare `*` wildcards
- **Fix:** Changed to `app.get('/{*splat}', ...)` using Express 5's named wildcard syntax
- **Files modified:** server/index.js
- **Verification:** Server starts without error, `curl http://127.0.0.1:7700/` returns HTML
- **Committed in:** `1ae7d12` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Fix required for correct operation. Express 5 is a breaking change from v4 wildcard syntax. No scope creep.

## Issues Encountered
- Vite scaffold (`npm create vite@latest . --template react-ts`) cancelled when project directory was non-empty due to .git/.planning files. Resolved by scaffolding into /tmp then copying files to project root.

## User Setup Required
None - no external service configuration required. Run `npm install && npm run build && node server/index.js` to start.

## Next Phase Readiness
- Build pipeline ready: `npm run build` produces dist/ with React SPA
- Server runs: `node server/index.js` starts on 127.0.0.1:7700
- execFile wrapper ready for all Phase 2+ systemctl invocations
- SQLite database initialized, ready for schema creation in Plan 02
- Brand tokens established: all Phase 2+ components use bg-bg-base, text-accent, etc.
- Layout shell ready for Phase 2 dashboard content injection

---
*Phase: 01-foundation*
*Completed: 2026-02-20*
