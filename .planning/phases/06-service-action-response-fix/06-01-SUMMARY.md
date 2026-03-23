---
phase: 06-service-action-response-fix
plan: 01
subsystem: api
tags: [systemd, express, node, services]

# Dependency graph
requires:
  - phase: 05-unit-file-editor
    provides: fragmentPath/writable derivation logic in systemctl.js and ServiceEntry type definition
provides:
  - POST /api/services/:name/action response with complete ServiceEntry shape (fragmentPath + writable fields)
affects:
  - frontend handleServiceUpdate optimistic update
  - user badge visibility after service actions

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Action endpoint response mirrors getAllServices() shape — same fields, same derivation logic"
    - "SHOW_PROPS constant drives both the show query fields and the response object shape"

key-files:
  created: []
  modified:
    - server/routes/services.js

key-decisions:
  - "FragmentPath added to SHOW_PROPS so the single show query fetches it — no extra systemctl call needed"
  - "writable derivation uses same resolve().startsWith('/etc/systemd/system/') pattern as getAllServices() — single source of truth"

patterns-established:
  - "Action endpoint service response object must match getAllServices() shape to avoid partial overwrites in handleServiceUpdate"

requirements-completed: [DASH-02]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 6 Plan 01: Service Action Response Fix Summary

**POST /api/services/:name/action now returns complete ServiceEntry shape including fragmentPath and writable, fixing user badge disappearance after service actions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T19:52:25Z
- **Completed:** 2026-03-23T19:54:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `import { resolve } from 'node:path'` to services.js
- Added `FragmentPath` to `SHOW_PROPS` constant so it is fetched in the show query after each action
- Added `fragmentPath` and `writable` fields to the POST `/:name/action` response service object using the same derivation logic as `getAllServices()`
- Closes INT-01 and FLOW-01: `handleServiceUpdate` no longer overwrites fragmentPath/writable with undefined after optimistic update

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FragmentPath to SHOW_PROPS and include fragmentPath+writable in action response** - `dfb9d4f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `server/routes/services.js` - Added resolve import, FragmentPath to SHOW_PROPS, fragmentPath and writable to action response service object

## Decisions Made
- FragmentPath added to SHOW_PROPS (single show query, no extra systemctl call) — same pattern used by getAllServices()
- writable derivation reuses identical logic from systemctl.js lines 106-107 — consistent behavior across GET and POST endpoints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 6 plan 01 complete — action endpoint now returns full ServiceEntry shape
- No additional backend changes needed; frontend handleServiceUpdate already handles the complete shape
- Build passes without errors

---
*Phase: 06-service-action-response-fix*
*Completed: 2026-03-23*
