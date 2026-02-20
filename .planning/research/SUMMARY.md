# Project Research Summary

**Project:** systemdctl
**Domain:** Self-hosted systemd service management web panel (Linux VPS administration)
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

systemdctl is a focused, self-hosted admin panel that lets a solo Linux VPS administrator manage systemd services through a browser — starting, stopping, restarting, viewing logs, and editing unit files — without requiring SSH. The established pattern for this class of tool is a Node.js + Express backend running as root (required to invoke systemctl without sudo), a React SPA served from the same process, SQLite for persistence, and WebSocket for real-time log streaming. All existing competitors (Cockpit, sysdweb, Systemd-Service-Manager-Web-UI) have documented weaknesses: Cockpit is a heavyweight general server panel, sysdweb has no authentication, and neither competitor offers a unit file editor with syntax highlighting or an audit log. These gaps define the differentiation strategy.

The recommended architecture is a monorepo with a clear service layer that wraps all child process calls (systemctl via execFile, journalctl via spawn) behind a single safe execution wrapper. Authentication must be the first thing built — JWT stored in memory on the frontend (never localStorage), refresh tokens in httpOnly cookies, and rate-limiting correctly wired through Express trust proxy. The panel should be dark-themed with a terminal aesthetic from day one; this is not cosmetic but a deliberate product identity decision that sets it apart from every competitor in the space.

The primary risks are all security-related: the panel runs as root, so command injection via exec() instead of execFile() would be a full system compromise, WebSocket cross-site hijacking must be blocked at the upgrade handshake, and unit file writes must be atomic with symlink protection. These are not theoretical risks — they are concrete failure modes documented in Node.js issues and security research. Every phase that touches child processes or file I/O must address them explicitly. The good news is that all risks have well-understood mitigations that can be baked in from the start.

## Key Findings

### Recommended Stack

The backend is Node.js 22 LTS + Express 5 + better-sqlite3 (synchronous SQLite — correct for this use case) + ws (not socket.io — no fallback needed, 15KB vs 80KB) + jose for JWTs (ESM-native, actively maintained, no stalled jsonwebtoken). The frontend is React 19 + Vite 7 + Tailwind CSS v4 (CSS-native config, no tailwind.config.js) + shadcn/ui components (copy-into-project ownership, Radix primitives, CSS variable dark mode) + TanStack Query for server state + Zustand for UI state. The code editor for unit files is @uiw/react-codemirror with @codemirror/legacy-modes INI mode — ~300KB vs Monaco's 5-10MB, sufficient for INI-format unit files. All versions are current as of 2026-02-20 and verified on npm registry.

Critical version constraints: jose@6 requires Node >= 22.12.0 for CJS require() of ESM; drizzle-orm and drizzle-kit must stay in lockstep (0.45.1 / 0.31.9); Tailwind v4 is a breaking change from v3 (no tailwind.config.js, @theme blocks in CSS). The panel must never use node-systemctl (unmaintained), node:sqlite (stability 1.1 / experimental), socket.io (overkill), jsonwebtoken (stalled), or child_process.exec() (shell injection vector).

**Core technologies:**
- Node.js 22 LTS: Backend runtime — native ESM require() support, tested child_process primitives for systemctl execution
- Express 5.2.1: HTTP server / REST API — synchronous error handling in v5, minimal surface area
- React 19.2.4: Frontend UI — concurrent features stable, familiar component model
- Vite 7.3.1: Frontend build + dev server — HMR, native ESM, first-class Tailwind v4 plugin
- Tailwind CSS 4.2.0: CSS — CSS-native config, dark mode via .dark class, smaller output than v3
- better-sqlite3 12.6.2: SQLite driver — synchronous API, fastest Node driver, correct for single-writer admin panel
- ws 8.19.0: WebSocket — unidirectional log streaming, 15KB vs socket.io's 80KB
- jose 6.1.3: JWT — ESM-native, no dependencies, actively maintained

### Expected Features

Research identifies a clear 3-tier feature hierarchy. Authentication and the service dashboard are the irreducible foundation — every competitor that lacks auth (sysdweb, Systemd-Service-Manager-Web-UI) is explicitly called out as incomplete or unsafe by its own users. Live log streaming via SSE/WebSocket is table stakes for active debugging and the one feature no current lightweight competitor implements. The audit log and unit file editor are the primary differentiators: Cockpit explicitly refused to implement audit logging (issue #9066 closed as will-not-fix), and no lightweight competitor offers a syntax-highlighted unit file editor with validation.

**Must have (table stakes):**
- JWT authentication — without this, nothing can be safely exposed; sysdweb's lack of auth is its defining limitation
- Service list dashboard — all services with status indicators (failed/active/inactive), name, description, enabled state, text filter
- Start / stop / restart / enable / disable — with confirmation modal for destructive actions (stop, restart on a running service)
- Per-service log viewer — last N lines of journalctl -u with log level filter
- Live log streaming — journalctl -f behavior via WebSocket; key differentiator vs all current lightweight panels
- Audit log — append-only timestamp/user/action/service/result; captures all actions from day one; Cockpit explicitly does not have this

**Should have (competitive differentiators):**
- Unit file editor with INI syntax highlighting + systemd-analyze verify validation before save + daemon-reload on success — no lightweight competitor does this
- Inline service health context (memory, PID, uptime) in service list row
- Service grouping / tags — user-defined labels; purely cosmetic, stored in app DB not unit files
- Log level / priority filtering — error/warning/info/debug dropdown

**Defer (v2+):**
- Keyboard shortcuts — high value but zero-blocking
- Read-only viewer role — defer until multi-user scenario is confirmed needed
- Systemd timer management — complex, niche; wait for user demand
- Dependency graph visualization — interesting, low priority vs core management

**Hard boundaries (never build):**
- Full server dashboard (CPU/RAM/disk graphs) — this is Cockpit/Netdata territory; scope creep
- Multi-server management — different product entirely
- Full unit file creation wizard — hundreds of directives, any wizard covers 10% and misleads users
- Shell / terminal access — destroys the focused value proposition

### Architecture Approach

The architecture is a single Node.js process running as root that serves both the REST API and the React SPA static files (Vite build output), with a WebSocket server sharing the HTTP server via noServer mode. All systemd interactions are isolated in a service layer (server/services/) that routes through a single exec.js wrapper enforcing execFile (no shell), action whitelisting, and a service name regex. SQLite (better-sqlite3, WAL mode) handles persistence for users, audit_log, config, and watched_services. A MonitorService polls service state on a configurable interval and broadcasts changes to connected WebSocket clients via EventEmitter. In development, Vite dev server proxies /api and /ws to the Express process on a different port.

**Major components:**
1. server/utils/exec.js — Safe execFile wrapper; single choke point for all child process spawning; enforces array args (no shell), timeout, action and name whitelists
2. server/services/systemd.service.js — Wraps systemctl commands; the only layer that knows about systemd semantics
3. server/services/log.service.js — Spawns journalctl --follow --output=json; pipes JSON lines to WebSocket clients; kills child on WS close with SIGTERM + SIGKILL fallback
4. server/services/unitfile.service.js — Reads/writes /etc/systemd/system/; atomic writes via temp file + rename; symlink check before write; systemd-analyze verify before daemon-reload
5. server/services/audit.service.js — INSERT to audit_log via better-sqlite3 prepared statements; called by audit.js middleware on every mutating action
6. server/middleware/auth.js — JWT verification for HTTP routes and WS upgrade events
7. src/hooks/useServices.js — Visibility-aware polling (pauses when tab is hidden)
8. src/hooks/useWebSocket.js — WS lifecycle management with reconnect and JWT in URL query param

### Critical Pitfalls

1. **journalctl zombie processes on WebSocket disconnect** — On WS close, send SIGTERM then SIGKILL after 2s; explicitly destroy child.stdout and child.stderr streams; keep a Map<serviceId, ChildProcess> to prevent duplicate processes per service; listen to 'close' event not 'exit' (close fires only after stdio streams are fully closed). Phase 3 risk.

2. **Command injection via shell option or type confusion on action whitelist** — Never use { shell: true } on any execFile call; explicitly set shell: false even though it's the default to prevent accidental future override; use a Set not an Array for whitelist; typeof-check the action string before lookup; write unit tests for the exec wrapper that pass array/object/null as action. Phase 1 foundation — must be correct from day one.

3. **Unit file path traversal and symlink attacks** — Always resolve and validate: path.resolve('/etc/systemd/system', name + '.service').startsWith('/etc/systemd/system/'); check fs.lstatSync().isSymbolicLink() before every write and reject if true; use write-file-atomic for atomic writes (temp file + rename prevents partial writes on crash); run systemd-analyze verify before daemon-reload. Phase 2 risk.

4. **WebSocket cross-site hijacking** — Validate Origin header before accepting WebSocket upgrade; require JWT as URL query parameter (/ws/logs?token=); authenticate in the HTTP upgrade event handler before calling wss.handleUpgrade(); never accept the upgrade before auth is confirmed. The browser WebSocket API cannot send Authorization headers — this is a browser limitation, not a design choice. Phase 3 risk.

5. **JWT secret not persisted across restarts + token stored in localStorage** — Persist auto-generated JWT secret to SQLite config table on first run; read from there on restart; store access token in Zustand memory state (NOT localStorage — XSS-accessible); refresh token in httpOnly cookie with SameSite=Strict; never render log output via dangerouslySetInnerHTML. Phase 1 foundation.

## Implications for Roadmap

Based on the combined research, 4 phases emerge from the component dependency graph and feature priority analysis. The architecture file explicitly maps build order steps 1-18 to phases 1-4 — the phase structure below is aligned with that dependency ordering.

### Phase 1: Foundation — Security, Auth, Service Dashboard

**Rationale:** Authentication is a hard prerequisite for every other feature. The exec wrapper is a hard prerequisite for every systemd interaction. The service dashboard is the root view all other features build on. These must come first and must be correct — security mistakes in Phase 1 (shell injection, JWT storage, rate limiter trust proxy) are the hardest to fix retroactively because they touch every subsequent feature.

**Delivers:** A working, authenticated web panel that lists all systemd services with status indicators and lets the admin start/stop/restart/enable/disable with confirmation modals. This is a usable product on its own.

**Addresses:** JWT authentication, service status dashboard, service actions with confirmation modals, filter/search, text filter across service list.

**Avoids:** Command injection (exec wrapper built first), JWT localStorage antipattern (httpOnly cookies from day one), rate limiter trust proxy misconfiguration (set trust proxy: 1 during auth setup), SQLite without WAL mode (set WAL pragma at DB init), JWT secret not persisted (persist to config table on first run).

### Phase 2: Log Streaming and Unit File Editor

**Rationale:** Live log streaming is the highest-impact differentiator (no lightweight competitor has it) and the next most-requested debugging tool after service control. The unit file editor is the second major differentiator but has complex security requirements (atomic writes, symlink protection, systemd-analyze verify) that are safer to address as a discrete phase. These two features are bundled because they both involve systemd I/O beyond simple execFile calls — spawn for logs, fs for unit files.

**Delivers:** Per-service log viewer with live streaming (journalctl --follow piped to WebSocket), log level filtering, unit file editor with INI syntax highlighting, server-side validation before save, daemon-reload on success.

**Uses:** ws (WebSocket), @uiw/react-codemirror + @codemirror/legacy-modes (INI mode), write-file-atomic, systemd-analyze verify via execFile.

**Implements:** log.service.js (spawn + pipe pattern), unitfile.service.js (atomic write + symlink check), useWebSocket.js hook, UnitEditor component, LogViewer component.

**Avoids:** journalctl zombie processes (SIGTERM + SIGKILL cleanup, Map deduplication), WebSocket cross-site hijacking (Origin header validation + JWT in upgrade), unit file path traversal/symlink attacks (resolved path prefix check + lstat check + atomic write), unbounded log buffer (--lines cap + UI line cap at 1000).

### Phase 3: Audit Log and Real-Time State Monitoring

**Rationale:** The audit log has no hard dependencies and can be added after action-producing features exist — but capturing audit events from day one of Phase 1 is better than retrofitting. Phase 3 formalizes the audit UI and adds the MonitorService that detects unexpected state changes (a service crashing) and broadcasts them to connected clients. This phase completes the "observability" story: you can watch logs live (Phase 2), see who did what (Phase 3), and get alerted when state changes unexpectedly (Phase 3).

**Delivers:** Full audit log UI (paginated, searchable by service/user/action), MonitorService background polling with WebSocket broadcast on state change, toast notifications in the UI when a watched service changes state.

**Implements:** audit.service.js, audit.js middleware, monitor.service.js (EventEmitter), AuditLog page, audit.routes.js.

**Avoids:** Per-client service polling multiplied by N users (MonitorService is one server-side polling loop broadcasting to N clients via WebSocket — far more efficient than N independent polls), WebSocket heartbeat missing (implement 30s ping/pong in this phase to catch dead connections and clean up journalctl processes).

### Phase 4: Polish, Security Hardening, and v1.x Features

**Rationale:** Phase 4 brings the product to a production-hardened state and adds the P2 features (inline health context, service grouping/tags) that improve day-to-day usability without being blocking for initial launch. This is also the phase for the security checklist items that span multiple earlier phases: nginx WebSocket timeout configuration, WAL checkpoint strategy, token blacklist for logout, Content-Security-Policy audit.

**Delivers:** Inline service health context (memory, PID, uptime in service table row), service grouping/tags (stored in app DB), Settings page, nginx configuration guide, security hardening pass (CSP audit, symlink test, zombie process test, trust proxy verification).

**Implements:** monitor.service.js state diff refinements, watched_services table population, settings.routes.js, Settings page, nginx config documentation.

**Avoids:** bcrypt called synchronously in hot path (verify async usage), WAL checkpoint starvation (implement periodic checkpoint call), nginx proxy_read_timeout too short (document 90s timeout for WS with 30s heartbeat), auto-refresh resetting user's filter state (keep filter in URL query params).

### Phase Ordering Rationale

- Auth and the exec wrapper must come first because they are the security foundation every other feature depends on. Building the service dashboard before auth creates tech debt that requires retrofitting every route.
- Log streaming and unit file editing are grouped in Phase 2 because both involve non-trivial I/O patterns (spawn streams, atomic file writes) that are architecturally similar and have overlapping security requirements.
- Audit log and monitoring come after the features they observe — you cannot audit what doesn't exist yet. Phase 3 is the right place to formalize the observability layer.
- Phase 4 polish and hardening comes last because security hardening is meaningless without a working product to harden, and the v1.x feature additions (inline health, tags) are genuinely lower priority than getting the core working correctly.

### Research Flags

Phases with well-documented patterns where additional research before planning is not needed:
- **Phase 1:** JWT + Express + SQLite auth patterns are thoroughly documented. The exec wrapper pattern is standard Node.js. Stack choices are verified to current versions.
- **Phase 4:** Security hardening patterns are all documented in PITFALLS.md with specific remediation steps.

Phases where implementation research may be useful during planning:
- **Phase 2 (log streaming):** The journalctl cleanup pattern (SIGTERM + SIGKILL fallback + stream destroy) has OS-version-specific behavior. The exact behavior on the target Ubuntu/Debian version should be validated during implementation. The LogBroadcaster optimization (one journalctl per service, fan-out to N WS clients) is not needed for MVP but the design should account for it.
- **Phase 2 (unit file editor):** systemd-analyze verify behavior on different unit file types (service vs timer vs socket) should be validated. The INI-mode CodeMirror highlighting covers [Section] headers and key=value pairs but does not highlight ExecStart command syntax inline — this is an acceptable limitation but should be documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified on npm registry; library choices confirmed via official docs and multi-source agreement; no speculative recommendations |
| Features | MEDIUM | Cockpit and sysdweb behavior confirmed from official docs and repos; competitor analysis is solid; user demand for specific features is inferred from sysadmin community patterns, not direct user research |
| Architecture | HIGH | Patterns (execFile wrapper, noServer WS, WAL SQLite, visibility-aware polling) are all from official Node.js and library documentation; code examples are concrete and correct |
| Pitfalls | HIGH | Most pitfalls are linked to specific Node.js issues, systemd issues, and security research papers; not theoretical — verified against real bugs |

**Overall confidence:** HIGH

### Gaps to Address

- **No pre-built systemd unit file language mode for CodeMirror 6:** INI mode covers sections and key=value pairs adequately. ExecStart command content will not be syntax-highlighted. This is an acceptable limitation for v1. If users request better highlighting, the legacy-modes package includes a shell StreamLanguage port that could be applied to ExecStart values (advanced, defer post-launch).

- **Target OS version not specified:** The journalctl zombie process behavior has a documented fix in systemd issue #9374. The mitigation (SIGTERM + SIGKILL + stream.destroy()) works regardless of systemd version, but the exact behavior should be verified on the target Ubuntu/Debian version during Phase 2 implementation.

- **Feature demand is inferred, not validated:** The unit file editor and audit log are differentiated based on competitor gap analysis (Cockpit explicitly refuses audit log; no competitor has syntax-highlighted unit file editing). Whether the solo-admin target user will actually use these features in practice is a hypothesis. Plan to validate by using the tool in production as soon as Phase 1 is complete before investing Phase 2 effort.

- **Multi-user / viewer role:** Research recommends deferring RBAC to v2+. The DB schema includes a role column (admin/operator/viewer) as a forward-compatibility measure, but the application logic for role enforcement beyond a single admin should not be built until there is confirmed demand.

## Sources

### Primary (HIGH confidence)
- Node.js child_process official documentation — execFile vs exec, spawn streaming, close vs exit events
- ws library GitHub (websockets/ws) — noServer pattern, HTTP upgrade handling, WebSocket auth before accept
- better-sqlite3 GitHub (WiseLibs/better-sqlite3) — WAL mode, synchronous API, performance docs
- journalctl man page (freedesktop.org) — --output=json, --follow, --lines flags
- Cockpit official documentation (cockpit-project.org) — confirmed feature set and explicit non-features
- Cockpit GitHub issue #9066 — confirmed audit log is will-not-fix
- Oracle Linux Cockpit services documentation — feature confirmation
- systemd-analyze official documentation — verify command behavior
- express-rate-limit GitHub wiki — trust proxy troubleshooting
- drizzle.team official docs — ORM and migration patterns
- shadcn/ui official docs (ui.shadcn.com) — Vite installation guide
- Tailwind CSS v4 official docs — CSS-native config, @theme blocks
- 42crunch.com — JWT security pitfalls (alg:none, token storage)
- PortSwigger — Cross-site WebSocket hijacking
- Auth0 blog — Preventing command injection in Node.js

### Secondary (MEDIUM confidence)
- sysdweb GitHub (ogarcia/sysdweb) — confirmed no auth, minimal feature set
- Systemd-Service-Manager-Web-UI GitHub — confirmed no auth, no syntax highlighting
- VideoSDK: WebSocket Authentication 2025 — JWT in URL query param pattern for WS (browser limitation is well-established fact, article is secondary confirmation)
- developerway.com: React State Management 2025 — Zustand for UI state, polling patterns
- betterstack.com: Express WebSockets Guide — Express + ws integration

### Tertiary (LOW confidence)
- Linuxiac: Grafito systemd journal log viewer — single source, used only for competitive landscape context
- @codemirror/legacy-modes INI mode for systemd unit files — no pre-built systemd mode exists; INI is the best available option confirmed via CodeMirror 6 discuss forum; adequate but not purpose-built

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
