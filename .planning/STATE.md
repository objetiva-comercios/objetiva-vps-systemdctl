# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** An admin can fully manage all their systemd services from a web browser without touching SSH
**Current focus:** Phase 3 — Search, Filtering, and Favorites

## Current Position

Phase: 3 of 5 (Search, Filtering, and Favorites)
Plan: 1 of 3 in current phase (plan 01 complete)
Status: Phase 3 in progress — watched-services backend complete; frontend favorites UI pending
Last activity: 2026-02-21 — Plan 03-01 complete: SQLite watched_services table, POST/DELETE toggle API, isWatched merged into service responses

Progress: [█████░░░░░] 47%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 11min
- Total execution time: 42min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 36min | 18min |
| 02-service-dashboard-and-actions | 2 | 28min | 14min |
| 03-search-filtering-and-favorites | 1 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 01-02 (30min), 02-01 (3min), 02-02 (25min), 03-01 (3min)
- Trend: Fast execution on focused backend plans

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-phase]: No auth in v1 — AUTH is deferred to v2; panel ships without login gate
- [Pre-phase]: All systemd commands route through a single execFile wrapper — no exec(), no shell strings
- [Pre-phase]: SQLite with WAL mode; JWT secret persisted to config table on first run (not regenerated on restart)
- [Pre-phase]: Dark-only terminal aesthetic (#0a0e14 / #22c55e / JetBrains Mono) — not a setting, a product identity choice
- [01-01]: Express 5 SPA catch-all uses /{*splat} not bare * (path-to-regexp v8 breaking change)
- [01-01]: Tailwind v4 via @tailwindcss/vite plugin — no tailwind.config.js or postcss.config.js
- [01-01]: Server files remain plain JS for simple single-command deployment flow
- [Phase 01-foundation]: HOST binding must use Tailscale IP (100.87.113.34) not 0.0.0.0 — VPS accessed only via Tailscale VPN
- [Phase 01-foundation]: React Router v7 imports from react-router (not react-router-dom) — packages merged in v7
- [Phase 01-foundation]: Layout route uses Outlet pattern — App.tsx places Layout as parent Route element, child routes render inside without re-mounting shell
- [02-01]: list-units --all is source of truth for full service list; show data fills metrics for loaded subset only
- [02-01]: [not set] guard returns null (not NaN) — value && value !== '[not set]' ? parseInt(value, 10) : null
- [02-01]: Action endpoint has own ALLOWED_DASHBOARD_ACTIONS separate from exec.js ALLOWED_ACTIONS to avoid exposing status/show as user actions
- [02-02]: useServicePolling exposes setServices for optimistic row updates after actions — avoids waiting for next poll cycle
- [02-02]: isFetching useRef guard (not state) prevents overlapping fetch calls without causing re-renders
- [02-02]: API response is { ok, services } wrapper — hook extracts the services array before setting state
- [03-01]: UNIT_NAME_RE in watched.js wider than exec.js SERVICE_NAME_RE (allows backslash) — safe because watched route never shells out to systemctl
- [03-01]: watchedSet built synchronously before parallel systemctl calls in getAllServices() — single SQLite read, negligible overhead for <100 rows
- [03-01]: INSERT OR IGNORE for watch toggle — unit is PRIMARY KEY so idempotency guaranteed by schema; no separate exists check needed

### Pending Todos

None yet.

### Blockers/Concerns

- [Research flag]: journalctl zombie process cleanup behavior (SIGTERM + SIGKILL + stream.destroy()) should be validated on target Ubuntu/Debian version during Phase 4 implementation
- [Research flag]: systemd-analyze verify behavior on different unit file types should be validated during Phase 5 implementation

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 03-search-filtering-and-favorites/03-01-PLAN.md — watched-services backend: SQLite table, REST toggle endpoints (POST/DELETE /api/watched/:name), isWatched on all service responses
Resume file: None
