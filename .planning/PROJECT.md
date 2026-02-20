# systemdctl

## What This Is

A self-hosted web panel for administering systemd services on a Linux VPS. Provides a dashboard to visualize, control, and edit services from a browser — eliminating SSH for routine service management. Built for a single admin managing 5-15 services on their own server.

## Core Value

An admin can fully manage all their systemd services from a web browser without touching SSH — see status, start/stop/restart, read logs, and edit unit files.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Dashboard showing all systemd services with real-time status (active state, sub-state, enabled/disabled, PID, memory, CPU, uptime)
- [ ] Service actions: start, stop, restart, enable, disable from the UI
- [ ] Log viewer: read journalctl output per service with temporal filtering
- [ ] Real-time log streaming via WebSocket
- [ ] Unit file viewer and editor with syntax highlighting
- [ ] Create new unit files from predefined templates (Node.js, Python, Docker Compose, Generic)
- [ ] Delete unit files with daemon-reload
- [ ] Audit log recording every action (who, when, what, result)
- [ ] JWT authentication with login/refresh flow
- [ ] Role-based access control (admin, operator, viewer) — lightweight, solo-admin priority
- [ ] User management CRUD (admin only)
- [ ] Service search and filtering (by status, name, favorites)
- [ ] Watched/favorite services per user
- [ ] Confirmation dialogs for destructive actions (stop, disable, delete)
- [ ] Keyboard shortcuts (/ for search, r for refresh, Esc to close detail)
- [ ] Responsive layout (functional on tablet)
- [ ] Input sanitization and command execution safety (whitelist actions, execFile, timeouts)
- [ ] Rate limiting on login (5 attempts → 15min block per IP)
- [ ] Server listens on 127.0.0.1 only, external access via reverse proxy

### Out of Scope

- Notifications / alerts — handled by a separate monitoring/messaging system
- Dark/light theme toggle — dark-only (terminal aesthetic)
- Mobile-native app — web-only, responsive for tablet
- OAuth / social login — email/password is sufficient
- Real-time chat or messaging — not relevant
- Multi-server management — single VPS only
- Video/media in logs — text only

## Context

- Target OS: Ubuntu 22.04+ / Debian 12+
- Server runs as root for direct systemctl access (no sudo wrapper needed)
- Solo admin use case — multi-user roles exist but are secondary priority
- The admin has a separate push notification/monitoring system that will watch systemd independently
- The PRD defines a detailed API design (REST + WebSocket), database schema (SQLite with users, audit_log, config, watched_services tables), and project structure that should inform implementation
- Visual direction: dark terminal aesthetic (#0a0e14 background, #22c55e green accent), JetBrains Mono font, lucide-react icons
- Deployment: behind nginx reverse proxy with SSL, installable via git clone + npm install + npm run build

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
| No notifications in this project | Separate monitoring system handles alerts | — Pending |
| Root execution | Solo admin on own VPS, simplifies systemctl access | — Pending |
| Dark-only theme | Terminal/control center aesthetic, matches target audience | — Pending |
| SQLite over Postgres | Single-server, low-overhead, file-based DB is sufficient | — Pending |
| Flexible library choices | Core stack (Node/React/SQLite) is fixed, specific libs are open | — Pending |

---
*Last updated: 2026-02-20 after initialization*
