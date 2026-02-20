# Stack Research

**Domain:** Self-hosted systemd service management web panel
**Researched:** 2026-02-20
**Confidence:** HIGH (versions verified via npm registry; library choices verified via Context7/official docs/multi-source agreement)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS | Backend runtime | LTS with native fetch, improved ESM `require()` support (^22.12.0+), and tested `child_process` primitives needed for systemctl execution |
| Express | 5.2.1 | HTTP server / REST API | Minimal surface area, synchronous error handling (no need for express-async-errors shim in v5), massive ecosystem, zero overhead for a single-admin tool |
| React | 19.2.4 | Frontend UI framework | Server Actions are not needed here; React 19 stabilizes concurrent features and `use()` hook, keeping component model familiar without paradigm shift |
| Vite | 7.3.1 | Frontend build tool + dev server | HMR fastest in class, native ESM, first-class React plugin; pairs perfectly with Tailwind v4 plugin |
| Tailwind CSS | 4.2.0 | Utility-first CSS | v4 uses CSS-native `@import` config (no tailwind.config.js needed), significantly smaller output, dark mode via `.dark` class trivial — suits terminal aesthetic |
| SQLite (via better-sqlite3) | 12.6.2 | Persistent storage | Single-file DB appropriate for 1-admin, 5-15 services; no network overhead; synchronous API removes async complexity; audit log and sessions fit perfectly |

### Supporting Libraries

#### Backend

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `better-sqlite3` | 12.6.2 | SQLite driver | Always — synchronous API, fastest Node.js SQLite driver, production-ready; `node:sqlite` is still experimental/unstable (stability 1.1 as of Node 22) |
| `drizzle-orm` | 0.45.1 | Schema definitions + query builder | Use with better-sqlite3 for type-safe queries, migration generation via drizzle-kit; avoid raw SQL for schema management |
| `drizzle-kit` | 0.31.9 | Migration CLI | `drizzle-kit push` for dev, `drizzle-kit generate` + `migrate()` for prod; keeps schema in code |
| `ws` | 8.19.0 | WebSocket server | Use `ws` not `socket.io` — no fallback needed (modern browsers all support WebSockets), lower overhead, perfect for unidirectional log streaming from `journalctl -f` via `child_process.spawn` |
| `jose` | 6.1.3 | JWT signing/verification | Use `jose` not `jsonwebtoken` — ESM-native, no dependencies, supports EdDSA and modern algorithms, works on Node ≥22.12.0 via `require(esm)`, actively maintained |
| `bcrypt` | 6.0.0 | Password hashing | For storing the single admin password; bcrypt is the right tool (slow by design), bcryptjs is pure-JS fallback if native build fails |
| `helmet` | 8.1.0 | HTTP security headers | Always — sets CSP, X-Frame-Options, etc. with sensible defaults; ~0 performance cost |
| `cors` | 2.8.6 | CORS middleware | Restrict to `localhost` origin only in production (or omit if frontend is served by the same Express process) |
| `express-rate-limit` | 8.2.1 | Rate limiting on auth endpoints | Apply to `/api/auth/login` only; prevents brute force against the single admin account |
| `pino` | 10.3.1 | Structured logging | Fast JSON logging; `pino-http` middleware for request logging; pretty-print in dev via `pino-pretty` |
| `pino-http` | 11.0.0 | HTTP request logging middleware | Pair with pino; auto-logs req/res with latency |

#### Frontend

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@uiw/react-codemirror` | 4.25.4 | Code editor component (unit file editor) | CodeMirror 6-based React wrapper; ~300KB vs Monaco's 5-10MB; modular language extensions; sufficient for INI-style unit files |
| `@codemirror/legacy-modes` | 6.5.2 | INI language mode for systemd unit files | systemd unit files are INI-format; use `StreamLanguage.define(legacyModes.ini)` — no pre-built systemd mode exists, INI covers sections + key=value pairs adequately |
| `@tanstack/react-query` | 5.90.21 | Server state management / data fetching | Handles polling (service status), cache invalidation after mutations (restart/stop), stale-while-revalidate — replaces manual `useState + useEffect + fetch` boilerplate |
| `react-router-dom` | 7.13.0 | Client-side routing | Single-page navigation between dashboard, service detail, audit log, settings views |
| `zustand` | 5.0.11 | Client UI state | Lightweight; manages auth token, active service selection, UI state; no Redux overhead needed for a solo-user tool |
| `shadcn/ui` (components) | latest | Accessible UI components | Copy-into-project model gives full ownership; built on Radix UI + Tailwind; dark mode via CSS variables swaps automatically; terminal aesthetic achievable by overriding color tokens to green/gray palette |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript | Type safety across backend and frontend | Use strict mode; Drizzle and Jose have first-class TypeScript support |
| ESLint + eslint-plugin-security | Static analysis including security rules | `detect-child-process` rule catches dangerous `exec()` uses at lint time |
| `tsx` or `ts-node` | Run TypeScript in dev without build step | `tsx` is faster (esbuild-backed); use for backend dev server |
| `@types/better-sqlite3`, `@types/ws` | TypeScript definitions | Install alongside respective packages |
| pino-pretty | Pretty-print pino logs in dev | `dev: node --require pino-pretty server.js` |
| `drizzle-kit studio` | Visual DB browser for local dev | Zero-config, works directly with SQLite file |

---

## Installation

```bash
# Backend core
npm install express better-sqlite3 drizzle-orm ws jose bcrypt helmet cors express-rate-limit pino pino-http

# Backend dev
npm install -D drizzle-kit tsx typescript @types/node @types/better-sqlite3 @types/ws @types/bcrypt @types/cors @types/express eslint eslint-plugin-security pino-pretty

# Frontend core
npm install react react-dom react-router-dom @tanstack/react-query zustand @uiw/react-codemirror @codemirror/legacy-modes @codemirror/language

# Frontend dev
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite typescript @types/react @types/react-dom
```

After frontend scaffolding, install shadcn/ui components via CLI:
```bash
npx shadcn@latest init
npx shadcn@latest add button badge card table dialog toast
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `ws` | `socket.io` | If you need automatic reconnection with session resumption, rooms/namespaces, or must support clients that don't support native WebSockets (never for a 2025 VPS panel) |
| `jose` | `jsonwebtoken` | If you have an existing codebase already using jsonwebtoken and no budget to migrate; for greenfield, `jose` is the correct choice |
| `better-sqlite3` | `node:sqlite` (built-in) | When Node 23+ is stable in your target environment AND the built-in module exits experimental (Stability: 1.1 as of early 2026 — not yet) |
| `better-sqlite3` | Postgres | If you plan to scale to multi-user, multi-node, or need concurrent write access from separate processes; for a single-admin, single-machine panel SQLite is correct |
| `drizzle-orm` | `knex` or raw SQL | Knex lacks TypeScript-first schema definitions; Drizzle's schema-as-code approach means migrations are tracked in version control |
| `@uiw/react-codemirror` | Monaco Editor | If you need a full VS Code-like experience with IntelliSense and LSP support; Monaco is 5-10MB uncompressed and overkill for editing unit files |
| `shadcn/ui` | Radix UI (unstyled) | If your designer needs a completely custom design system built from scratch; shadcn/ui lets you own the components while getting production-ready defaults |
| `shadcn/ui` | Material UI / Ant Design | These carry heavy visual opinions (Material Design, Ant design language) that fight a terminal-aesthetic; shadcn/ui's CSS variables are overridable to any color scheme |
| `@tanstack/react-query` | SWR | Both are valid; TanStack Query has better mutation handling (`useMutation` + invalidation), more granular cache control, and DevTools — worth the slightly heavier bundle for an admin panel |
| `zustand` | Redux Toolkit | RTK is designed for large team codebases with complex state; a single-admin tool with minimal client state doesn't warrant Redux's boilerplate overhead |
| Express 5 | Fastify | Fastify is faster and has schema-based validation built in; choose it if you expect high throughput; for a panel serving 1 user, Express 5's error handling simplifications and familiarity win |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `child_process.exec()` for systemctl | Spawns a shell; any unsanitized argument is an RCE vector; never pass service names without validation through exec | `child_process.execFile('/bin/systemctl', ['restart', validatedServiceName])` — no shell, args are array |
| `node:sqlite` (built-in) | Stability 1.1 / "active development" — API will change; no async query support; not production-safe | `better-sqlite3` |
| `jsonwebtoken` for new projects | Development has stalled; CJS-only; no EdDSA; the library recommends `jose` for new projects | `jose` |
| Shell string interpolation with user input | `execFile('sh', ['-c', \`systemctl ${req.body.service}\`])` is equivalent to exec and equally dangerous | Always validate service name against an allowlist of known services, then pass as array argument |
| PM2 for the panel itself | PM2 adds a process manager layer you don't need when running as a systemd service; circular dependency (systemd manages the thing managing systemd) | Register `systemdctl.service` directly as a systemd unit |
| Socket.IO for log streaming | 80KB gzipped client library for a feature that `ws` handles in 15KB; adds unnecessary protocol negotiation | `ws` with native browser `WebSocket` |
| React state (useState/useEffect) for service data | Manual polling, no cache invalidation, race conditions on mutations | `@tanstack/react-query` with `refetchInterval` for polling and `invalidateQueries` after mutations |
| `sqlite3` (callback-based async driver) | Async sqlite3 is slower than better-sqlite3 despite the async API because it threads I/O through libuv with no benefit for SQLite's single-writer model | `better-sqlite3` |

---

## Stack Patterns by Variant

**If unit file editor needs shell syntax (bash ExecStart scripts):**
- Add `@codemirror/lang-javascript` or check for `@codemirror/legacy-modes/mode/shell` — the legacy-modes package includes a shell StreamLanguage port
- INI mode handles the unit file wrapper; shell mode can highlight the ExecStart value inline (advanced, skip for MVP)

**If running behind Nginx reverse proxy (recommended for production):**
- Set Express `app.set('trust proxy', 1)` for correct IP in rate limiter
- WebSocket connections pass through Nginx with `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`

**If TypeScript strict mode causes issues with better-sqlite3:**
- The `@types/better-sqlite3` package is maintained separately; ensure it matches the runtime version (both currently 12.x compatible)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `better-sqlite3@12.6.2` | Node.js 18, 20, 22 | Native module; requires node-gyp for build; prebuilt binaries available for common platforms |
| `jose@6.1.3` | Node.js ≥20.19.0 or ≥22.12.0 | CJS `require()` of ESM works on these Node versions; otherwise use dynamic `import()` |
| `drizzle-orm@0.45.1` + `drizzle-kit@0.31.9` | Must keep in sync | drizzle-orm and drizzle-kit version constraints are coupled; update both together |
| `@uiw/react-codemirror@4.25.4` | React 18+, React 19 | v4+ requires CodeMirror 6 internally; compatible with React 19 |
| `tailwindcss@4.2.0` | Vite 7 via `@tailwindcss/vite` | Tailwind v4 drops `tailwind.config.js`; configuration moves to CSS `@theme` blocks; breaking change from v3 |
| `ws@8.19.0` | Node.js 18+ | Works with Express 5 HTTP server; attach to `server.on('upgrade', ...)` for WebSocket upgrade handling |

---

## Security Architecture Note

The panel runs as root on the VPS. This is a deliberate design choice to invoke `systemctl` without `sudo`. Given this, the attack surface of the web process must be minimized:

1. **Bind to localhost only** — put Nginx in front for TLS; never expose Express directly to the internet
2. **Allowlist service names** — before any `execFile('systemctl', ...)` call, validate the service name against a known-good list stored in SQLite; reject anything not in the list
3. **Single-admin JWT** — one account; short JWT expiry (1 hour); refresh token in httpOnly cookie
4. **Helmet CSP** — prevents XSS from injecting rogue commands into WebSocket connections
5. **Rate limit auth** — 5 attempts per 15 minutes on the login endpoint

---

## Sources

- `better-sqlite3`: npm registry (v12.6.2 confirmed), GitHub WiseLibs/better-sqlite3 discussions on `node:sqlite` comparison — HIGH confidence
- `ws`: npm registry (v8.19.0 confirmed), GitHub websockets/ws — HIGH confidence
- `jose`: npm registry (v6.1.3 confirmed), panva/jose README and CHANGELOG — HIGH confidence; CJS require notes from jose docs
- `@uiw/react-codemirror`: npm registry (v4.25.4 confirmed), GitHub uiwjs/react-codemirror — HIGH confidence
- `@codemirror/legacy-modes`: npm registry (v6.5.2), CodeMirror 6 discuss forum for INI/custom language approach — MEDIUM confidence (no pre-built systemd mode found)
- `drizzle-orm` + `drizzle-kit`: npm registry versions, drizzle.team official docs — HIGH confidence
- `shadcn/ui`: ui.shadcn.com official docs, Vite installation guide — HIGH confidence
- `tailwindcss@4`: official Tailwind v4 docs confirmed CSS-native config approach — HIGH confidence
- Express 5: npm registry (v5.2.1), expressjs.com — HIGH confidence
- Security (execFile vs exec): auth0 blog, Node.js docs, securecodingpractices.com — MEDIUM confidence (well-established pattern)
- `node:sqlite` experimental status: Node.js v22 docs (stability 1.1), LogRocket blog — HIGH confidence (do not use in production)

---
*Stack research for: systemdctl — self-hosted systemd service management web panel*
*Researched: 2026-02-20*
