---
phase: 02-service-dashboard-and-actions
plan: 01
subsystem: api
tags: [express, systemctl, nodejs, rest-api]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: exec.js security wrapper with whitelisted systemctl actions and service name validation

provides:
  - GET /api/services - returns all 173 systemd services with merged list-units + show metrics
  - POST /api/services/:name/action - executes start/stop/restart/enable/disable via exec.js wrapper
  - GET /api/system - returns hostname and uptimeSeconds via node:os
  - server/utils/systemctl.js parsing helpers (parseListUnits, parseShowOutput, getAllServices)

affects: [02-02-frontend, future phases using service state]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-call parallel merge pattern: Promise.all([list-units, show]) merged by service unit name
    - Null-guard pattern for systemd [not set] values and empty timestamps
    - Express router modularization: separate route files mounted in index.js

key-files:
  created:
    - server/utils/systemctl.js
    - server/routes/services.js
    - server/routes/system.js
  modified:
    - server/index.js

key-decisions:
  - "list-units --all is source of truth for full service list (173 services); show data fills metrics for loaded subset"
  - "MemoryCurrent and CPUUsageNSec guard [not set] -> null; MainPID guard 0 -> null; empty ActiveEnterTimestamp -> null"
  - "Action endpoint validates against ALLOWED_DASHBOARD_ACTIONS before forwarding to exec.js; exec.js handles name validation"

patterns-established:
  - "Null-guard pattern: value && value !== '[not set]' ? parseInt(value, 10) : null"
  - "Parallel Promise.all([list-units, show]) reduces response time vs sequential calls"
  - "Express router files mounted in index.js after health route, before error middleware"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-07, ACTN-01, ACTN-02, ACTN-03, ACTN-04, ACTN-05]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 2 Plan 01: Backend API for Service Dashboard Summary

**systemctl output parser + three REST endpoints (services list with health metrics, service actions, system info) built on exec.js security wrapper**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T12:58:39Z
- **Completed:** 2026-02-20T13:01:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- GET /api/services returns all 173 systemd services merging list-units and show in parallel, with null guards for inactive metrics
- POST /api/services/:name/action validates action name (400 for invalid), executes via exec.js wrapper, returns refreshed service state
- GET /api/system returns node:os hostname and uptimeSeconds
- Express middleware order corrected: routes before error handler, error handler before static serving

## Task Commits

Each task was committed atomically:

1. **Task 1: Create systemctl parsing utility and service/system API routes** - `c1beaad` (feat)
2. **Task 2: Mount service and system routers in Express server** - `507ea83` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `server/utils/systemctl.js` - parseListUnits, parseShowOutput, getAllServices with Promise.all parallel fetch
- `server/routes/services.js` - GET /api/services and POST /:name/action with 400 validation
- `server/routes/system.js` - GET /api/system via node:os module
- `server/index.js` - Added router imports and mounts; corrected middleware order

## Decisions Made
- list-units --all is source of truth for the full service list (173 services including not-found units); show data fills metrics only for loaded services (~60)
- [not set] guard returns null (not NaN or string) so JSON responses are always typed correctly
- Action endpoint has its own ALLOWED_DASHBOARD_ACTIONS constant (separate from exec.js ALLOWED_ACTIONS) since exec.js also allows status/is-active/show/list-units which should not be exposed as user actions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all three API endpoints responded correctly on first run. 173 services returned, null guards work, 400 status confirmed for invalid actions.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three API endpoints operational and verified
- Backend is ready for Phase 2 Plan 02 frontend: ServiceDashboard page, polling hook, ServiceTable/ServiceRow components
- Service data shape is defined: unit, load, active, sub, description, unitFileState, pid, memoryBytes, cpuNsec, activeEnterTimestamp

---
*Phase: 02-service-dashboard-and-actions*
*Completed: 2026-02-20*
