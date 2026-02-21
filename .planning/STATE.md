# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** An admin can fully manage all their systemd services from a web browser without touching SSH
**Current focus:** Phase 4 — Log Viewer

## Current Position

Phase: 4 of 5 (Log Viewer)
Plan: 1 of 1 in current phase (plan 01 complete — phase complete)
Status: Phase 4 complete — per-service log viewer with journalctl backend, time presets, color-coded log lines, and ServiceRow deep links
Last activity: 2026-02-21 — Plan 04-01 complete: journalctl-backed log viewer (GET /api/logs/:service endpoint, Logs.tsx page, ServiceRow ScrollText link)

Progress: [████████░░] 73%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 7.8min
- Total execution time: 47min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 36min | 18min |
| 02-service-dashboard-and-actions | 2 | 28min | 14min |
| 03-search-filtering-and-favorites | 2 | 5min | 2.5min |
| 04-log-viewer | 1 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 02-02 (25min), 03-01 (3min), 03-02 (2min), 04-01 (3min)
- Trend: Fast execution on focused feature plans

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
- [03-02]: Running filter uses s.sub === 'running' not s.active === 'active' — excludes exited one-shot services giving accurate running counts
- [03-02]: watchedServices derived from unfiltered services list so watched section is always visible regardless of active search/filter
- [03-02]: StatusFilter type exported from SearchFilterBar.tsx (single source of truth) and imported into Home.tsx
- [04-01]: journalctl called with --no-pager -q --output json to get structured JSON per line (machine-parseable)
- [04-01]: VALID_SINCE whitelist map prevents time filter injection; unknown since values silently treated as 'all' (no --since arg)
- [04-01]: Empty stdout guarded before split to avoid spurious empty-string entries in log list
- [04-01]: Array.isArray(MESSAGE) guard handles binary log messages (journald encodes non-UTF8 bytes as number arrays in JSON)
- [04-01]: Log viewer split into LogViewer component (when service present) and Logs page guard (routing) — clean separation

### Pending Todos

None yet.

### Blockers/Concerns

- [Research flag]: systemd-analyze verify behavior on different unit file types should be validated during Phase 5 implementation
- [04-01 note]: journalctl zombie process concern from research is moot — using execFileAsync (not streaming), so process lifecycle is managed by Node.js child_process timeout naturally

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 04-log-viewer/04-01-PLAN.md — per-service log viewer: GET /api/logs/:service endpoint, Logs.tsx with time presets and color-coded log lines, ServiceRow ScrollText link
Resume file: None
