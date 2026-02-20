# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** An admin can fully manage all their systemd services from a web browser without touching SSH
**Current focus:** Phase 2 — Service Dashboard and Actions

## Current Position

Phase: 2 of 5 (Service Dashboard and Actions)
Plan: 0 of ? in current phase
Status: Phase 1 complete — ready for Phase 2
Last activity: 2026-02-20 — Plan 01-02 complete: dark terminal aesthetic confirmed in browser, Phase 1 done

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 18min
- Total execution time: 36min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 36min | 18min |

**Recent Trend:**
- Last 5 plans: 01-01 (6min), 01-02 (30min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- [Research flag]: journalctl zombie process cleanup behavior (SIGTERM + SIGKILL + stream.destroy()) should be validated on target Ubuntu/Debian version during Phase 4 implementation
- [Research flag]: systemd-analyze verify behavior on different unit file types should be validated during Phase 5 implementation

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 01-foundation/01-02-PLAN.md — dark terminal aesthetic confirmed in browser, Phase 1 complete, ready for Phase 2
Resume file: None
