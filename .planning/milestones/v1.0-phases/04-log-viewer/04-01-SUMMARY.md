---
phase: 04-log-viewer
plan: 01
subsystem: ui
tags: [react, express, journalctl, log-viewer, react-router]

# Dependency graph
requires:
  - phase: 03-search-filtering-and-favorites
    provides: ServiceRow component with watch toggle and actions

provides:
  - GET /api/logs/:service endpoint returning parsed journalctl JSON entries
  - LogEntry TypeScript interface (ts, priority, level, identifier, message)
  - Logs page with time preset buttons (5m/15m/1h/6h/1d/All) and color-coded log lines
  - /logs and /logs/:service routes in App.tsx
  - ScrollText icon link in ServiceRow navigating to /logs/:service

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - journalctl called via execFileAsync with --output json for structured log parsing
    - VALID_SINCE whitelist map for time filter input validation
    - useCallback + useEffect for re-fetch on state change (since param)
    - Auto-scroll to bottom via ref.scrollTop = ref.scrollHeight after entries update

key-files:
  created:
    - server/routes/logs.js
    - src/types/log.ts
    - src/pages/Logs.tsx
  modified:
    - server/index.js
    - src/App.tsx
    - src/components/ServiceRow.tsx

key-decisions:
  - "journalctl called with --no-pager -q --output json to get structured JSON per line"
  - "VALID_SINCE whitelist map prevents time filter injection; unknown values silently treated as 'all'"
  - "Empty stdout guarded before split to avoid spurious empty-string entries"
  - "Array.isArray check on MESSAGE field handles binary log messages (journald can store byte arrays)"
  - "Log viewer component split into LogViewer (has service) and Logs (routing guard); no-service state shows prompt"

patterns-established:
  - "Express route: validate params at top of handler, return 400 early before any execFile call"
  - "useCallback for fetchLogs makes it the useEffect dependency, triggering re-fetch when since changes"

requirements-completed: [LOGS-01, LOGS-02, LOGS-03]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 4 Plan 01: Log Viewer Summary

**journalctl-backed per-service log viewer with time range presets, priority color-coding (error=red/warning=amber), and ServiceRow deep links**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T02:56:28Z
- **Completed:** 2026-02-21T02:59:30Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- Backend GET /api/logs/:service endpoint parsing journalctl --output json with service name, lines, and since param validation
- Frontend Logs page with 6 time presets (Last 5m / 15m / 1h / 6h / 1d / All), auto-scroll, loading/error/empty states, and color-coded log lines
- ServiceRow now has a ScrollText icon link to /logs/:service for direct log access from the dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend log endpoint and frontend log viewer page** - `048474f` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `server/routes/logs.js` - Express router: GET /:service with journalctl JSON parsing, input validation
- `server/index.js` - Added logsRouter mount at /api/logs
- `src/types/log.ts` - LogEntry interface: ts, priority, level, identifier, message
- `src/pages/Logs.tsx` - Log viewer page with time presets, color-coded lines, auto-scroll
- `src/App.tsx` - Added /logs and /logs/:service routes
- `src/components/ServiceRow.tsx` - Added ScrollText icon link to /logs/:service in actions column

## Decisions Made

- journalctl called with `--no-pager -q --output json` to get one JSON object per line (structured, machine-parseable)
- VALID_SINCE whitelist map (`{ '5m': '-5m', '15m': '-15m', ... }`) — unknown since values silently treated as 'all' (no --since arg), no injection possible
- Empty stdout checked before split (`stdout.trim() === ''`) to avoid a spurious filter(Boolean) on empty strings
- `Array.isArray(MESSAGE)` guard handles binary log messages (journald encodes non-UTF8 bytes as number arrays in JSON)
- Log viewer split into inner `LogViewer` component (when service present) and outer `Logs` (routing guard) — clean separation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — build passed on first attempt, all validation endpoints returned correct status codes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All log viewer functionality is complete and verified via build
- Phase 5 (systemd-analyze verify) can proceed immediately
- Note: journalctl requires systemd-journal group membership or root access to read system logs; non-privileged users see only their own session logs (returns empty entries array — correct behavior)

---
*Phase: 04-log-viewer*
*Completed: 2026-02-21*
