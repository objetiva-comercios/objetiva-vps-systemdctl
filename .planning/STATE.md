# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** An admin can fully manage all their systemd services from a web browser without touching SSH
**Current focus:** Phase 2 — Service Dashboard and Actions

## Current Position

Phase: 2 of 5 (Service Dashboard and Actions)
Plan: 2 of 2 in current phase (phase complete)
Status: Phase 2 complete — dashboard UI and backend API both done; ready for Phase 3
Last activity: 2026-02-20 — Plan 02-02 complete: React service dashboard with auto-polling, color-coded status, health metrics, and action buttons

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 13min
- Total execution time: 39min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 36min | 18min |
| 02-service-dashboard-and-actions | 2 | 28min | 14min |

**Recent Trend:**
- Last 5 plans: 01-01 (6min), 01-02 (30min), 02-01 (3min), 02-02 (25min)
- Trend: —

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Research flag]: journalctl zombie process cleanup behavior (SIGTERM + SIGKILL + stream.destroy()) should be validated on target Ubuntu/Debian version during Phase 4 implementation
- [Research flag]: systemd-analyze verify behavior on different unit file types should be validated during Phase 5 implementation

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 02-service-dashboard-and-actions/02-02-PLAN.md — service dashboard UI complete (auto-polling, color-coded status, health metrics, action buttons); Phase 2 fully done
Resume file: None
