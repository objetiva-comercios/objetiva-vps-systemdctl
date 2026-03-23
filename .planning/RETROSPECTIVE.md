# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-23
**Phases:** 6 | **Plans:** 12

### What Was Built
- Secure systemd execution wrapper with execFile whitelist and input validation
- Live dashboard with health metrics, auto-polling, and full service control
- Search, status filtering, and watched/favorite services with SQLite persistence
- Per-service log viewer with time range filtering and color-coded severity
- Unit file editor with CodeMirror syntax highlighting and atomic save + daemon-reload
- Dark terminal aesthetic (#0a0e14 / #22c55e / JetBrains Mono) as product identity

### What Worked
- Security-first foundation (Phase 1) prevented all injection concerns in later phases
- Optimistic updates pattern (Phase 2) gave instant UI feedback across all action types
- Small focused plans (avg 1.5 min execution for Phase 5) enabled rapid iteration
- Gap closure phases (05-03, 05-04, 06-01) fixed integration issues quickly without full replans

### What Was Inefficient
- Double /api/system fetch (Layout.tsx + Home.tsx) — could share via React context
- Phase 5 needed 4 plans including 2 gap closures — initial plan missed EACCES and read-only view
- CodeMirror bundle at 884kB — acceptable but large for admin tool

### Patterns Established
- `runSystemctl()` as single execution gateway — all systemd commands route through one wrapper
- `SHOW_PROPS` constant pattern for systemctl show field selection
- Optimistic update via `setServices` + revert on failure
- Atomic write via temp file + sudo cp for non-root file writes
- `ALLOWED_DASHBOARD_ACTIONS` separate from `ALLOWED_ACTIONS` for defense in depth

### Key Lessons
1. Include all response fields from the start — the Phase 6 badge flicker bug was caused by omitting fragmentPath/writable from the action response, a 4-line fix that needed a whole phase
2. Plan for file permission issues early — non-root process writing to /etc/systemd/system/ required a gap closure phase
3. Express 5 path-to-regexp v8 breaking change (/{*splat} not bare *) caught early in Phase 1 — reading docs before coding prevents downstream breakage

### Cost Observations
- Model mix: opus for planning, sonnet for execution/research/verification
- Total execution time: ~52 min across 12 plans (avg 4.3 min/plan)
- Phases 3-6 executed significantly faster than Phases 1-2 (established patterns)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 12 | Established security-first foundation, gap closure pattern |

### Top Lessons (Verified Across Milestones)

1. Include all fields in API responses from the start — incomplete responses cause UI flicker bugs
2. Plan for file permission issues when writing to system directories
