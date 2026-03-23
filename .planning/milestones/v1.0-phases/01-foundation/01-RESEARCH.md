# Phase 1: Foundation - Research

**Researched:** 2026-02-20
**Domain:** Node.js + Express + Vite + React + Tailwind CSS v4 + execFile security wrapper
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (Pre-Project Specifics)

- Dark-only terminal aesthetic: `#0a0e14` background, `#22c55e` green accent, JetBrains Mono font — this is product identity, not a setting
- All systemd commands through single `execFile` wrapper with explicit action whitelist — no `exec()`, no shell strings
- Service name validation: `/^[\w@\-.]+$/` before any child process call
- SQLite with WAL mode for persistence
- Server binds to `127.0.0.1` only — no external exposure
- No auth in v1

### Claude's Discretion

- **Web UI shell** — Overall page layout structure (header, sidebar, navigation frame) that later phases will populate. Should feel like a server admin panel with the terminal aesthetic applied.
- **Server configuration** — How the admin sets port, bind address, and other options. Choose the simplest reasonable approach for a single-server admin tool.
- **Landing/placeholder page** — What appears in the browser when Phase 1 is complete (before Phase 2 adds the dashboard). Minimal is fine — just enough to confirm the aesthetic and that the server is running.
- **Error feedback pattern** — How systemd command failures surface in the web UI. Establish a pattern that later phases will reuse.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | Dark terminal aesthetic (dark background, green accent, JetBrains Mono) | Tailwind CSS v4 @theme for custom colors + @fontsource/jetbrains-mono package; see Code Examples section |
| INFR-02 | Server binds to 127.0.0.1 only | Express `app.listen(port, '127.0.0.1', callback)` — second argument restricts bind interface |
| INFR-03 | All systemctl commands use execFile with whitelist (never exec/shell) | Node.js built-in `child_process.execFile` — does not spawn shell; promisify pattern; explicit ALLOWED_ACTIONS array |
| INFR-04 | Service name input validated against `/^[\w@\-.]+$/` | Synchronous regex validation in exec wrapper before any child process call; throw error on mismatch |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire project skeleton: a Vite-built React SPA served by an Express server, a secure `execFile` wrapper for all systemd interaction, and the visual identity applied to a placeholder shell. All four requirements (INFR-01 through INFR-04) are straightforward to satisfy with the documented standard stack — no exotic libraries or workarounds needed.

The most consequential decision in this phase is the `execFile` wrapper design (INFR-03/INFR-04). Getting it right once here means all future phases that invoke systemctl inherit the security guarantee for free. The wrapper must use an allowlist of actions, validate service names before touching any child process API, and never accept `shell: true`. Everything else in this phase is scaffolding and CSS.

For discretionary areas: `.env` file with `dotenv` is the simplest server config approach (Node.js 20+ native `--env-file` flag is viable but adds startup flag complexity); the UI shell should follow the PRD's header + left sidebar layout, rendered as a static frame that future phases fill with real data; the placeholder page should show server status text in the terminal aesthetic to visually confirm INFR-01; error feedback from the exec wrapper should be structured `{ ok: false, code, stderr }` objects that Express route handlers turn into consistent JSON error responses.

**Primary recommendation:** Scaffold with `npm create vite@latest . -- --template react-ts`, add Tailwind CSS v4 via `@tailwindcss/vite` plugin, wire Express to serve `dist/` in production with an SPA catch-all, and implement the exec wrapper as the very first server-side module.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 7.x (latest) | Frontend build tool, dev server | Fastest React build toolchain; `npm create vite@latest` is the canonical scaffold |
| @vitejs/plugin-react | 4.x | Babel-based React HMR for Vite | Default React plugin from Vite scaffold |
| react | 19.x | UI framework | Project requirement |
| react-dom | 19.x | React DOM renderer | Paired with react |
| express | 5.2.x | HTTP server | Stable since 2025; native async/await; project requirement |
| tailwindcss | 4.x | Utility CSS | v4 is current; @tailwindcss/vite eliminates PostCSS config |
| @tailwindcss/vite | 4.x | Vite plugin for Tailwind CSS v4 | Required for v4 Vite integration; replaces postcss approach |
| @fontsource-variable/jetbrains-mono | latest | Self-hosted JetBrains Mono font | No CDN dependency; variable font support; tree-shakeable |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-router | 7.x | Client-side routing | Phase 1 sets up the router shell; routes populated in later phases |
| lucide-react | 0.575.x | Icon components | PRD specifies lucide-react; ES module tree-shakeable |
| better-sqlite3 | 12.6.x | SQLite driver | Phase 1 needs DB init and WAL pragma; project-wide decision |
| dotenv | 16.x | .env file loading | Simplest server config; widely understood; works on all Node 18+ |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dotenv` | Node.js `--env-file` flag (native, Node 20+) | `--env-file` requires changing the start command (`node --env-file=.env server/index.js`) — dotenv loaded in code is simpler for `npm start` scripts and works on Node 18 too |
| `@vitejs/plugin-react` | `@vitejs/plugin-react-swc` | SWC is faster but adds a Rust dependency; for a small admin panel, Babel speed is fine |
| `react-router` v7 | v6 | v7 is current; v6 still works; this project uses declarative mode only, either works — prefer v7 for longevity |
| `@fontsource-variable/jetbrains-mono` | Google Fonts CDN `<link>` | CDN avoids npm package but adds network dependency and privacy concern; self-hosted via fontsource is more reliable |

**Installation:**
```bash
# Scaffold (run in empty project root)
npm create vite@latest . -- --template react-ts

# Server dependencies
npm install express dotenv better-sqlite3

# Frontend dependencies
npm install react-router lucide-react @fontsource-variable/jetbrains-mono

# Tailwind CSS v4
npm install -D tailwindcss @tailwindcss/vite

# TypeScript types (dev)
npm install -D @types/express @types/better-sqlite3 @types/node
```

---

## Architecture Patterns

### Recommended Project Structure

```
systemdctl/
├── package.json                 # scripts: dev, build, start
├── vite.config.ts               # Vite + Tailwind plugin + proxy for /api dev
├── tsconfig.json                # TypeScript root config
├── tsconfig.node.json           # Node config for server files
├── .env.example                 # PORT, HOST, DB_PATH documented
├── .env                         # gitignored runtime config
│
├── server/
│   ├── index.js                 # Express setup, listen(port, host)
│   ├── config.js                # Read process.env with defaults
│   ├── db.js                    # better-sqlite3 init + WAL pragma + schema
│   └── utils/
│       └── exec.js              # THE execFile wrapper (INFR-03, INFR-04)
│
├── src/                         # React frontend (Vite root)
│   ├── main.tsx                 # ReactDOM.createRoot, BrowserRouter
│   ├── App.tsx                  # Routes skeleton
│   ├── index.css                # @import "tailwindcss" + @theme brand tokens
│   └── components/
│       └── Layout.tsx           # Header + sidebar shell (placeholder)
│
└── dist/                        # Vite build output (gitignored)
```

### Pattern 1: Vite + Express Dev/Prod Split

**What:** In development, Vite dev server runs on port 5173 and proxies `/api` to Express on port 7700. In production, Express serves the `dist/` folder as static files with a catch-all for SPA routing.

**When to use:** Every full-stack Vite + Express project.

**Development — vite.config.ts:**
```typescript
// Source: https://vite.dev/config/server-options
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:7700',
    },
  },
})
```

**Production — server/index.js (serve static + SPA fallback):**
```javascript
// Source: https://expressjs.com/en/starter/static-files.html
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')

// Serve static assets; index: false so the catch-all handles /
app.use(express.static(DIST, { index: false }))

// SPA fallback: all non-API routes return index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'))
})
```

**package.json scripts:**
```json
{
  "scripts": {
    "dev:client": "vite",
    "dev:server": "node --watch server/index.js",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "build": "vite build",
    "start": "node server/index.js"
  }
}
```

### Pattern 2: The execFile Security Wrapper (INFR-03 + INFR-04)

**What:** A single module that owns all child_process execution. Takes a validated action and service name, calls `execFile` with hardcoded binary path, returns structured result. No other file in the codebase may call `exec`, `execSync`, `spawn` for systemctl.

**When to use:** Every systemctl invocation in the entire project.

**server/utils/exec.js:**
```javascript
// Source: https://nodejs.org/api/child_process.html
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Locked whitelist — never expand from user input
const ALLOWED_ACTIONS = Object.freeze([
  'start', 'stop', 'restart', 'enable', 'disable',
  'status', 'is-active', 'is-enabled', 'show', 'list-units',
])

// Matches service names: letters, digits, @, -, _, .
// e.g.: nginx.service, my-app@1.service, app_v2.service
const SERVICE_NAME_RE = /^[\w@\-.]+$/

/**
 * Run a single systemctl command safely.
 * @param {string} action - Must be in ALLOWED_ACTIONS
 * @param {string|null} serviceName - Validated before use; null for list-units
 * @param {string[]} extraArgs - Hardcoded extra flags only, never user-supplied
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string, code: number|null }>}
 */
export async function runSystemctl(action, serviceName = null, extraArgs = []) {
  // INFR-03: action must be whitelisted
  if (!ALLOWED_ACTIONS.includes(action)) {
    throw new Error(`Blocked systemctl action: "${action}"`)
  }

  // INFR-04: service name validation — reject before any child process
  if (serviceName !== null && !SERVICE_NAME_RE.test(serviceName)) {
    throw new Error(`Invalid service name: "${serviceName}"`)
  }

  // Build args array — never a shell string
  const args = ['--no-pager', action]
  if (serviceName) args.push(serviceName)
  args.push(...extraArgs)

  try {
    const { stdout, stderr } = await execFileAsync(
      '/usr/bin/systemctl',
      args,
      {
        timeout: 30_000,       // 30 second max
        maxBuffer: 5 * 1024 * 1024,  // 5MB stdout limit
        // shell MUST remain false (default) — never set shell: true
      }
    )
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim(), code: 0 }
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout?.trim() ?? '',
      stderr: err.stderr?.trim() ?? err.message,
      code: err.code ?? null,
    }
  }
}
```

### Pattern 3: Express Bind to 127.0.0.1 (INFR-02)

**What:** Pass the host as the second argument to `app.listen`. Without this, Express defaults to `0.0.0.0` (all interfaces).

**When to use:** Server startup.

```javascript
// Source: https://expressjs.com/en/api.html#app.listen
import { PORT, HOST } from './config.js'

app.listen(PORT, HOST, () => {
  console.log(`systemdctl listening on http://${HOST}:${PORT}`)
})
```

**server/config.js:**
```javascript
import 'dotenv/config'

export const PORT = parseInt(process.env.PORT ?? '7700', 10)
export const HOST = process.env.HOST ?? '127.0.0.1'
export const DB_PATH = process.env.DB_PATH ?? './data/systemdctl.db'
export const NODE_ENV = process.env.NODE_ENV ?? 'development'
```

### Pattern 4: Tailwind CSS v4 Brand Theme (INFR-01)

**What:** Define the project's exact color palette and font as CSS theme variables. Tailwind v4 uses `@theme` in CSS instead of `tailwind.config.js`.

**src/index.css:**
```css
/* Source: https://tailwindcss.com/docs/theme */
/* Source: https://fontsource.org/fonts/jetbrains-mono/install */

/* 1. Load font before tailwindcss import */
@import '@fontsource-variable/jetbrains-mono';

/* 2. Tailwind base */
@import 'tailwindcss';

/* 3. Brand design tokens */
@theme {
  /* Colors */
  --color-bg-base:      #0a0e14;
  --color-bg-surface:   #0f1319;
  --color-bg-elevated:  #151b23;
  --color-border:       #1e293b;
  --color-text-primary: #e2e8f0;
  --color-text-muted:   #64748b;
  --color-accent:       #22c55e;
  --color-warning:      #f59e0b;
  --color-danger:       #ef4444;
  --color-info:         #3b82f6;

  /* Font */
  --font-mono: 'JetBrains Mono Variable', monospace;
  --default-font-family: var(--font-mono);
  --default-mono-font-family: var(--font-mono);
}

/* 4. Global defaults */
@layer base {
  html, body, #root {
    @apply bg-bg-base text-text-primary font-mono;
    min-height: 100vh;
  }
}
```

### Pattern 5: SQLite WAL Mode Init

**What:** Open the database, enable WAL mode and foreign keys before anything else.

**server/db.js:**
```javascript
// Source: https://github.com/WiseLibs/better-sqlite3
import Database from 'better-sqlite3'
import { DB_PATH } from './config.js'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export default db
```

### Pattern 6: Layout Shell for the UI

**What:** A fixed layout frame with header and left sidebar that all later pages slot content into. Phase 1 renders it with placeholder text only.

**Recommended layout (matches PRD section 8.2):**
```
┌──────────────────────────────────────────────────┐
│  HEADER: logo · hostname placeholder · ---        │
├──────────┬───────────────────────────────────────┤
│  SIDEBAR │  CONTENT AREA                         │
│          │                                       │
│  Services│  [Phase 1: "Server running" message]  │
│  Audit   │                                       │
│  Settings│                                       │
└──────────┴───────────────────────────────────────┘
```

Use `h-screen flex flex-col` on the root, `flex flex-1 overflow-hidden` for the body row, `w-56 flex-shrink-0` for the sidebar, `flex-1 overflow-auto p-6` for the content area. All Tailwind classes reference custom `bg-*` and `text-*` tokens defined in `@theme`.

### Pattern 7: Error Feedback Structure

**What:** A standard error shape from the exec wrapper and a standard Express JSON error response shape. Later phases reuse both.

**API error response shape:**
```json
{
  "ok": false,
  "error": "Human-readable message",
  "details": "systemctl stderr output if available"
}
```

**Express error middleware (registered last):**
```javascript
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status ?? 500
  res.status(status).json({
    ok: false,
    error: err.message ?? 'Internal server error',
    details: err.details ?? undefined,
  })
})
```

### Anti-Patterns to Avoid

- **`exec()` for systemctl:** Shell injection vector. The wrapper uses `execFile` only — no exceptions.
- **`shell: true` in execFile options:** Defeats the entire security model. Never pass `shell: true`.
- **Concatenating service name into args:** Even with `execFile`, pass service name as a discrete array element, never via string interpolation.
- **Skipping service name validation:** The regex check must happen before the args array is built, not after.
- **Express listening without host argument:** `app.listen(port)` binds to `0.0.0.0`. Always pass `'127.0.0.1'` explicitly.
- **Serving `dist/` with `index: true`:** Express static middleware's default `index: true` means `GET /` returns `index.html` but `GET /services` 404s. Set `{ index: false }` and use the catch-all route.
- **API routes after the SPA catch-all:** The catch-all `app.get('*', ...)` must be registered after all `/api/*` routes or it intercepts API calls.
- **Tailwind v3 PostCSS setup with v4:** Tailwind v4 does not use `tailwind.config.js` or PostCSS — use `@tailwindcss/vite` plugin only.
- **Importing font after `@import "tailwindcss"`:** CSS `@import` must come before all other rules; put font import first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS reset + normalization | Custom reset stylesheet | Tailwind v4 built-in `@layer base` preflight | Tailwind preflight handles box-sizing, margin resets, and cross-browser normalization |
| Font loading | Custom @font-face declarations | `@fontsource-variable/jetbrains-mono` npm package | Handles woff2 subsetting, variable font descriptors, font-display; one import line |
| .env parsing | `fs.readFileSync('.env')` string parsing | `dotenv` package | Edge cases: quotes, multiline, comments, unicode; dotenv handles them all |
| SQLite connection management | Manual `sqlite3` C bindings | `better-sqlite3` | Synchronous API is correct for server-side Node; handles WAL checkpointing automatically |
| Dev CORS bypass | Custom CORS headers in Express for dev | Vite `server.proxy` | Proxy avoids CORS entirely during development; same API paths work in production without change |

**Key insight:** The exec wrapper itself is intentionally hand-rolled because it encapsulates a security policy, not a generic problem. Every other utility-level concern has a battle-tested library.

---

## Common Pitfalls

### Pitfall 1: Shell Injection via execFile + Shell Option

**What goes wrong:** Developer sets `{ shell: true }` in execFile options for convenience, negating all injection protection. Service name `nginx.service; rm -rf /` would execute.
**Why it happens:** Someone tries to use shell features (pipes, redirection) that are unavailable without a shell, and "just enables it temporarily."
**How to avoid:** The exec wrapper module never accepts a `shell` option parameter. Hard-code `shell: false` implicitly (default). Code review gate: any occurrence of `shell: true` in the codebase should fail review.
**Warning signs:** `shell` key appearing anywhere in the execFile options object.

### Pitfall 2: Express Binding to 0.0.0.0

**What goes wrong:** Omitting the host argument causes Express to listen on all interfaces, exposing the panel to the network without the nginx reverse proxy.
**Why it happens:** `app.listen(port, callback)` is the simplest form — the host defaults to `0.0.0.0`.
**How to avoid:** Always pass three arguments: `app.listen(PORT, HOST, callback)`. Read HOST from config (default `'127.0.0.1'`).
**Warning signs:** Running `ss -tlnp | grep 7700` shows `0.0.0.0:7700` instead of `127.0.0.1:7700`.

### Pitfall 3: SPA Routes Return 404 in Production

**What goes wrong:** Navigating directly to `http://127.0.0.1:7700/services` returns a 404 because Express has no route for `/services` — only the React router does.
**Why it happens:** `express.static()` serves files that exist in `dist/`; there is no `dist/services` file.
**How to avoid:** Add the catch-all after all API routes: `app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')))`. Set `{ index: false }` on `express.static()` so the static middleware does not consume `/`.
**Warning signs:** Browser shows "Cannot GET /services" when refreshing any non-root route.

### Pitfall 4: Tailwind v4 Classes Not Working

**What goes wrong:** Custom `bg-accent`, `text-text-primary` classes produce no CSS output.
**Why it happens:** (a) Using v3 setup (postcss, content globs) instead of v4 plugin; (b) font `@import` placed after `@import "tailwindcss"` causing parse failure; (c) custom colors defined with wrong namespace (not `--color-*`).
**How to avoid:** Follow the exact v4 setup: `@tailwindcss/vite` plugin in `vite.config.ts`, `@import "tailwindcss"` in CSS, custom tokens under `--color-*` in `@theme`. Verify no `tailwind.config.js` or `postcss.config.js` conflicts.
**Warning signs:** Browser DevTools shows unstyled black-on-white page; no CSS variables starting with `--color-` in `:root`.

### Pitfall 5: SQLite DB Directory Missing

**What goes wrong:** `new Database('./data/systemdctl.db')` throws `SQLITE_CANTOPEN: unable to open database file` because `./data/` does not exist.
**Why it happens:** `better-sqlite3` does not create parent directories automatically.
**How to avoid:** `mkdirSync(dirname(DB_PATH), { recursive: true })` before the `new Database(...)` call in `db.js`.
**Warning signs:** Server crash on startup with `SQLITE_CANTOPEN`.

### Pitfall 6: Vite Build Output Path Mismatch

**What goes wrong:** Express serves from `path.join(__dirname, 'dist')` but Vite outputs to a different path, causing 404 for all static assets.
**Why it happens:** Default Vite output is `<project_root>/dist`. If `server/index.js` uses `__dirname` (which is `<project_root>/server`), the relative path needs `'..', 'dist'`, not `'dist'`.
**How to avoid:** Use `path.join(__dirname, '..', 'dist')` in server code, or configure `build.outDir` in vite.config.ts to be explicit.
**Warning signs:** All asset loads (JS, CSS) return 404; only the HTML from catch-all loads.

### Pitfall 7: ESM vs CommonJS Mismatch

**What goes wrong:** Server files use `import`/`export` (ESM) but `package.json` lacks `"type": "module"`, or vice versa. Mixing `require()` and `import` in the same project causes runtime errors.
**Why it happens:** Express examples commonly use CommonJS; Vite scaffold generates ESM frontend.
**How to avoid:** Set `"type": "module"` in `package.json`. Use `import`/`export` throughout the server. Replace `__dirname` with `path.dirname(fileURLToPath(import.meta.url))`. Use `createRequire` only if a library is CommonJS-only.
**Warning signs:** `SyntaxError: Cannot use import statement in a module` or `ReferenceError: require is not defined`.

---

## Code Examples

Verified patterns from official sources:

### execFile Promisified (Node.js Official Pattern)
```javascript
// Source: https://nodejs.org/api/child_process.html
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Usage
const { stdout, stderr } = await execFileAsync(
  '/usr/bin/systemctl',
  ['--no-pager', 'status', 'nginx.service'],
  { timeout: 30_000 }
)
```

### Tailwind v4 Vite Plugin Setup
```typescript
// Source: https://tailwindcss.com/docs/guides/vite
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### Tailwind v4 @theme Custom Colors
```css
/* Source: https://tailwindcss.com/docs/theme */
@import 'tailwindcss';

@theme {
  --color-bg-base: #0a0e14;
  --color-accent:  #22c55e;
  --font-mono: 'JetBrains Mono Variable', monospace;
}
```

### better-sqlite3 WAL Mode
```javascript
// Source: https://github.com/WiseLibs/better-sqlite3
import Database from 'better-sqlite3'

const db = new Database('./data/systemdctl.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
```

### Express Bind to Specific Host
```javascript
// Source: https://expressjs.com/en/api.html#app.listen
app.listen(7700, '127.0.0.1', () => {
  console.log('Listening on http://127.0.0.1:7700')
})
```

### React Router v7 Declarative SPA Setup
```tsx
// Source: https://reactrouter.com/start/modes (declarative mode)
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

### Express SPA Static Serve Pattern
```javascript
// IMPORTANT: API routes MUST be registered before this block
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')

// index: false so the catch-all below handles /
app.use(express.static(DIST, { index: false }))

// SPA fallback — must come AFTER all /api/* routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'))
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` + PostCSS | `@theme` CSS directive + `@tailwindcss/vite` plugin | Tailwind v4 (Jan 2025) | No postcss.config.js needed; theme in CSS not JS |
| `react-router-dom` package | `react-router` (merged) | React Router v7 (Nov 2024) | Single import from `react-router`; no `-dom` suffix |
| Create React App | `npm create vite@latest` | 2023, CRA deprecated | Vite is 10-100x faster; CRA is unmaintained |
| Express 4.x | Express 5.x (5.2.1 is npm latest) | Oct 2024, stable | Native async/await in middleware; better error handling |
| `util.promisify(execFile)` | Same — still correct | — | No change; this is still the canonical async execFile pattern |
| `better-sqlite3` v9-10 | v12.6.x | 2025 | API unchanged; version bump for SQLite engine updates |

**Deprecated/outdated:**
- `tailwind.config.js` with `content: ['./src/**/*.{html,jsx,tsx}']`: v3 approach; do not use with v4
- `postcss.config.js` for Tailwind: v3 approach; v4 uses the Vite plugin directly
- `create-react-app`: unmaintained since 2023; use Vite
- `react-router-dom`: replaced by `react-router` in v7; installing both causes version conflicts

---

## Open Questions

1. **TypeScript on the server side**
   - What we know: The PRD uses `.js` for server files; the Vite scaffold creates TypeScript frontend files
   - What's unclear: Whether to run the server with TypeScript (`tsx` or `ts-node`) or plain JavaScript
   - Recommendation: Use plain JavaScript (`.js`) for the server in Phase 1 as the PRD specifies. Add `"type": "module"` to `package.json`. This avoids a TypeScript compilation step for the server and keeps the `npm run build && node server/index.js` flow simple. TypeScript can be added to the server in a future phase if desired.

2. **`concurrently` for dev mode**
   - What we know: Running dev client + dev server simultaneously requires either `concurrently`, `npm-run-all`, or two terminals
   - What's unclear: Whether to add `concurrently` as a devDependency or document two-terminal workflow
   - Recommendation: Add `concurrently` as a devDependency for the `dev` script. It's a one-line install and makes the DX significantly better for a project with a separate client/server.

3. **Node.js version requirement**
   - What we know: `react-router` v7 requires Node 20+; Express 5 requires Node 18+; better-sqlite3 v12 has issues on Node 25
   - What's unclear: Whether to add an `.nvmrc` or `engines` field
   - Recommendation: Add `"engines": { "node": ">=20.0.0" }` to `package.json` and document Node 20 LTS as the target. This matches React Router v7's minimum and is a stable LTS version.

---

## Sources

### Primary (HIGH confidence)
- Node.js official docs (https://nodejs.org/api/child_process.html) — `execFile` API, signature, timeout options, security properties vs `exec`
- Tailwind CSS official docs (https://tailwindcss.com/docs/guides/vite) — v4 Vite installation, `@theme` syntax
- Tailwind CSS official docs (https://tailwindcss.com/docs/theme) — `@theme` custom colors, CSS variable generation
- Tailwind CSS official docs (https://tailwindcss.com/docs/font-family) — `--font-mono` variable, `@theme` font override
- Fontsource official docs (https://fontsource.org/fonts/jetbrains-mono/install) — `@fontsource-variable/jetbrains-mono` package, import syntax
- Vite official docs (https://vite.dev/guide/) — project scaffold, dev server proxy, backend integration
- Express.js official docs (https://expressjs.com/en/starter/static-files.html) — `express.static()`, `{ index: false }` option
- React Router official docs (https://reactrouter.com/start/modes) — declarative mode, `BrowserRouter` setup

### Secondary (MEDIUM confidence)
- WebSearch: Vite 7.x is the current version (verified via Vite official releases page reference in search results)
- WebSearch: Express 5.2.1 is stable and the npm `latest` tag (verified via expressjs.com release announcement)
- WebSearch: better-sqlite3 v12.6.2 is current (verified via multiple npm/GitHub references)
- WebSearch: React Router v7.x is current (verified via npm reference)
- WebSearch: lucide-react v0.575.x is current

### Tertiary (LOW confidence)
- Node.js `--env-file` flag as dotenv alternative: viable per Node 20.6+ docs, but dotenv is recommended for simplicity here

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via official documentation and official npm/GitHub release references
- Architecture: HIGH — patterns are from official docs; Vite+Express split is the canonical approach documented officially
- Pitfalls: HIGH (Pitfalls 1-5) / MEDIUM (Pitfalls 6-7) — core security pitfalls verified against official docs; ESM/CommonJS pitfall is well-documented community pattern
- execFile security wrapper: HIGH — API from Node.js official docs; security properties explicitly documented there

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (30 days — stack is stable; Tailwind v4 is settled post-January 2025 release)
