---
phase: 05-unit-file-editor
plan: 01
subsystem: api
tags: [express, nodejs, systemd, unit-files, atomic-write, daemon-reload]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Express server setup, exec.js runSystemctl wrapper, SERVICE_NAME_RE
  - phase: 02-service-dashboard-and-actions
    provides: exec.js ALLOWED_ACTIONS pattern, route module structure
provides:
  - GET /api/unit/:service — resolves FragmentPath via systemctl show, validates path allowlist, returns content + writable flag
  - PUT /api/unit/:service — validates content, enforces /etc/systemd/system/ write policy, writes atomically, triggers daemon-reload
  - daemon-reload in exec.js ALLOWED_ACTIONS
affects:
  - 05-02-unit-file-editor-frontend (UnitFile.tsx will call GET and PUT)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - atomic-write: temp file in same directory as destination then fs.rename (same filesystem, POSIX atomic)
    - path-validation: resolve() to canonicalize then startsWith() prefix check (collapses ../ traversal)
    - fragment-path-resolution: systemctl show -p FragmentPath as authoritative source (never construct path from service name)

key-files:
  created:
    - server/routes/unit.js
  modified:
    - server/utils/exec.js
    - server/index.js

key-decisions:
  - "daemon-reload added to ALLOWED_ACTIONS with null service name — runSystemctl('daemon-reload', null) skips appending service arg"
  - "READ_PREFIXES allows 4 systemd paths; WRITE_PREFIX restricts to /etc/systemd/system/ only — package-managed files are read-only"
  - "Atomic write uses temp file in same directory as destination (not /tmp) — same filesystem guarantees rename(2) is atomic"
  - "validatePath uses resolve() (not join()) to canonicalize path before prefix check — prevents ../ traversal attacks"

patterns-established:
  - "Pattern: getFragmentPath() calls runSystemctl('show', service, ['-p', 'FragmentPath']) and parses FragmentPath= line from stdout"
  - "Pattern: validatePath(filePath, prefixes) resolves to canonical path before checking any prefix — all path security goes through resolve()"

requirements-completed: [UNIT-01, UNIT-03]

# Metrics
duration: 1min
completed: 2026-02-21
---

# Phase 5 Plan 01: Unit File Editor Backend Summary

**Secure GET/PUT /api/unit/:service endpoints using systemctl FragmentPath resolution, path prefix allowlists, atomic temp+rename writes, and daemon-reload after save**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-21T13:55:33Z
- **Completed:** 2026-02-21T13:56:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created server/routes/unit.js with GET and PUT endpoints — FragmentPath resolution, READ_PREFIXES allowlist, WRITE_PREFIX enforcement, atomic write, daemon-reload trigger
- Added daemon-reload to exec.js ALLOWED_ACTIONS — enables runSystemctl('daemon-reload', null) without throwing
- Mounted unitRouter at /api/unit in server/index.js — backend API for unit file editor fully wired up

## Task Commits

Each task was committed atomically:

1. **Task 1: Add daemon-reload to exec.js and create unit route** - `bcfde06` (feat)
2. **Task 2: Mount unit router in server/index.js** - `54e10cf` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `server/routes/unit.js` - GET /api/unit/:service (read + writable flag) and PUT /api/unit/:service (atomic write + daemon-reload)
- `server/utils/exec.js` - daemon-reload added to ALLOWED_ACTIONS frozen array
- `server/index.js` - unitRouter imported and mounted at /api/unit before error middleware

## Decisions Made
- daemon-reload added as last entry in ALLOWED_ACTIONS with comment "Phase 5: needed by unit file writer after save"
- validatePath uses node:path resolve() (not join()) to canonicalize paths before prefix check — prevents ../traversal
- Atomic write temp file lives in same directory as destination (dirname(destPath)) not /tmp — same filesystem guarantees POSIX atomic rename
- GET endpoint returns writable flag computed as resolve(fragmentPath).startsWith(WRITE_PREFIX) — UI can use this to show/hide edit button
- PUT 403 error message is explicit: "Only files in /etc/systemd/system/ can be edited" — clear admin feedback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend API complete: GET /api/unit/:service and PUT /api/unit/:service are live and wired to server
- Phase 05-02 can now implement UnitFile.tsx page and ServiceRow deep link using these endpoints
- Research flag resolved: systemd-analyze verify deferred (no UNIT-01/UNIT-03 requirement, noted in research open questions)

---
*Phase: 05-unit-file-editor*
*Completed: 2026-02-21*
