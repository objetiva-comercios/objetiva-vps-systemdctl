# systemdctl

## What This Is

A self-hosted web panel for administering systemd services on a Linux VPS. Provides a dashboard to visualize, control, and edit services from a browser — eliminating SSH for routine service management. Built for a single admin managing 5-15 services on their own server.

## Core Value

An admin can fully manage all their systemd services from a web browser without touching SSH — see status, start/stop/restart, read logs, and edit unit files.

## Current State

**v1.0 MVP shipped** (2026-03-23) — 6 phases, 12 plans, 1,935 LOC (JS/TS)

Tech stack: Node.js + Express 5, React 19 (Vite 7), Tailwind CSS v4, SQLite (better-sqlite3), CodeMirror 6.

Features delivered:
- Service dashboard with health metrics and 10s auto-polling
- Full service control (start/stop/restart/enable/disable)
- Search, status filtering, watched/favorite services
- Per-service log viewer with time range filtering and color-coded severity
- Unit file editor with CodeMirror syntax highlighting and atomic save + daemon-reload
- Dark terminal aesthetic (#0a0e14 / #22c55e / JetBrains Mono)

## Requirements

### Validated

- ✓ Dashboard showing all systemd services with real-time status — v1.0
- ✓ Service actions: start, stop, restart, enable, disable from the UI — v1.0
- ✓ Log viewer: read journalctl output per service with temporal filtering — v1.0
- ✓ Unit file viewer and editor with syntax highlighting — v1.0
- ✓ Service search and filtering (by status, name, favorites) — v1.0
- ✓ Watched/favorite services per user — v1.0
- ✓ Input sanitization and command execution safety — v1.0
- ✓ Server listens on 127.0.0.1 only — v1.0

### Active

- [ ] Real-time log streaming via WebSocket
- [ ] JWT authentication with login/refresh flow
- [ ] Role-based access control (admin, operator, viewer)
- [ ] User management CRUD (admin only)
- [ ] Create new unit files from predefined templates
- [ ] Delete unit files with daemon-reload
- [ ] Audit log recording every action (who, when, what, result)
- [ ] Confirmation dialogs for destructive actions (stop, disable, delete)
- [ ] Keyboard shortcuts (/ for search, r for refresh, Esc to close)
- [ ] Responsive layout (functional on tablet)
- [ ] Rate limiting on login (5 attempts → 15min block per IP)

### Out of Scope

- Notifications / alerts — handled by a separate monitoring/messaging system
- Dark/light theme toggle — dark-only (terminal aesthetic is product identity)
- Mobile-native app — web-only, responsive for tablet in v2
- OAuth / social login — email/password is sufficient
- Multi-server management — single VPS only
- Full server dashboard (CPU/RAM/disk graphs) — not systemd-focused
- Log aggregation / cross-service search — requires indexing infrastructure
- Timer management — complex, niche; defer to v3+

## Context

- Target OS: Ubuntu 22.04+ / Debian 12+
- Server runs as root for direct systemctl access (no sudo wrapper needed)
- Solo admin use case — multi-user roles exist but are secondary priority
- Visual direction: dark terminal aesthetic (#0a0e14 background, #22c55e green accent), JetBrains Mono font, lucide-react icons
- Deployment: behind nginx reverse proxy with SSL, installable via git clone + npm install + npm run build
- Accessed exclusively via Tailscale VPN (100.87.113.34)

## Constraints

- **Stack**: Node.js + Express backend, React (Vite) frontend, Tailwind CSS, SQLite — library choices within this stack are flexible
- **OS**: Must run on Ubuntu 22.04+ / Debian 12+ with systemd
- **Permissions**: Runs as root for unrestricted systemctl/journalctl access
- **Network**: Default bind to 127.0.0.1, external access only through reverse proxy
- **Security**: No string concatenation for shell commands, whitelist-only actions, execFile over exec, all inputs sanitized
- **Deployment**: Single command install: `npm install && npm run build && node server/index.js`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No notifications in this project | Separate monitoring system handles alerts | ✓ Good — keeps scope focused |
| Root execution | Solo admin on own VPS, simplifies systemctl access | ✓ Good — no sudo complexity |
| Dark-only theme | Terminal/control center aesthetic, matches target audience | ✓ Good — strong identity |
| SQLite over Postgres | Single-server, low-overhead, file-based DB is sufficient | ✓ Good — zero config |
| No auth in v1 | Solo admin behind Tailscale VPN, auth adds friction | ✓ Good — shipped faster |
| Express 5 with path-to-regexp v8 | New /{*splat} syntax for SPA catch-all | ✓ Good — future-proof |
| Tailwind v4 via @tailwindcss/vite | No config files needed | ✓ Good — clean DX |
| Server files as plain JS | Simple single-command deployment, no TS compile step | ✓ Good — operational simplicity |
| CodeMirror 6 for editor | Full-featured, extensible, good INI/systemd support | ⚠️ Revisit — 884kB bundle |
| Atomic write via sudo cp from /tmp | Resolves EACCES for non-root server process | ✓ Good — secure and reliable |

---
*Last updated: 2026-03-23 after v1.0 milestone*
