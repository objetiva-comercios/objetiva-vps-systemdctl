---
phase: 03-search-filtering-and-favorites
plan: 01
subsystem: database, api
tags: [sqlite, better-sqlite3, express, rest, typescript]

requires:
  - phase: 02-service-dashboard-and-actions
    provides: GET /api/services endpoint and ServiceEntry TypeScript type that this plan extends

provides:
  - watched_services SQLite table (unit TEXT PRIMARY KEY, added_at INTEGER)
  - POST /api/watched/:name — toggle watch on (returns isWatched: true)
  - DELETE /api/watched/:name — toggle watch off (returns isWatched: false)
  - isWatched: boolean merged into every GET /api/services response entry
  - isWatched: boolean added to POST /api/services/:name/action service response
  - ServiceEntry TypeScript type updated with isWatched: boolean field

affects:
  - 03-02 (frontend favorites UI will read isWatched from service objects)
  - any future phase reading service lists (isWatched is always present)

tech-stack:
  added: []
  patterns:
    - Prepare SQLite statements at module level (not inside handlers) for efficiency
    - Synchronous SQLite reads inside async route handlers (negligible overhead for small tables)
    - INSERT OR IGNORE pattern for idempotent watch toggle
    - watchedSet built once per getAllServices() call — O(1) per-service lookup via Set.has()

key-files:
  created:
    - server/routes/watched.js
  modified:
    - server/db.js
    - server/utils/systemctl.js
    - server/routes/services.js
    - src/types/service.ts

key-decisions:
  - "UNIT_NAME_RE in watched.js is wider than exec.js SERVICE_NAME_RE — allows backslash for unit names like systemd-fsck@dev-disk-by\\x2dlabel-BOOT.service; safe because watched route never calls systemctl"
  - "watchedSet fetched synchronously before parallel systemctl calls in getAllServices() — single SQLite read, negligible overhead for <100 watched services"
  - "watched_services uses unit TEXT PRIMARY KEY so INSERT OR IGNORE is naturally idempotent — no need for separate exists check"

patterns-established:
  - "Module-level prepared statements: db.prepare() called once at import time, reused across requests"
  - "isWatched always present on ServiceEntry: frontend never needs a separate watched-state API call"

requirements-completed:
  - DASH-06

duration: 3min
completed: 2026-02-21
---

# Phase 3 Plan 01: Watched Services Backend Summary

**SQLite watched_services table with POST/DELETE toggle REST API and isWatched boolean merged into every service response via watchedSet lookup**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T01:26:23Z
- **Completed:** 2026-02-21T01:29:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created watched_services SQLite table (idempotent on restart via CREATE TABLE IF NOT EXISTS)
- Built server/routes/watched.js with POST/DELETE endpoints, UNIT_NAME_RE validation, and module-level prepared statements
- Merged isWatched: boolean into all GET /api/services entries using a pre-built watchedSet
- Added isWatched to POST /api/services/:name/action response via inline db.prepare().get()
- Updated ServiceEntry TypeScript type with isWatched: boolean; tsc --noEmit and npm run build both pass

## Task Commits

Each task was committed atomically:

1. **Task 1: SQLite watched_services table and REST toggle routes** - `321e786` (feat)
2. **Task 2: Merge isWatched into service API responses and update TypeScript type** - `e6b8ac5` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `server/db.js` - Added CREATE TABLE IF NOT EXISTS watched_services with unit TEXT PRIMARY KEY and unixepoch() default
- `server/routes/watched.js` - New file: POST/:name and DELETE/:name toggle endpoints with UNIT_NAME_RE validation and module-level prepared statements
- `server/index.js` - Added import and app.use('/api/watched', watchedRouter)
- `server/utils/systemctl.js` - Added db import; watchedSet built before parallel systemctl calls; isWatched added to return object
- `server/routes/services.js` - Added db import; isWatched queried and added to action endpoint response
- `src/types/service.ts` - Added isWatched: boolean to ServiceEntry interface

## Decisions Made

- UNIT_NAME_RE in watched.js is wider than exec.js SERVICE_NAME_RE (allows backslash) because the watched route never shells out to systemctl — no injection risk
- watchedSet fetched synchronously before the parallel systemctl Promise.all() — SQLite sync read is negligible for <100 rows and avoids async complexity
- INSERT OR IGNORE used for watch toggle — unit column is PRIMARY KEY so idempotency is guaranteed by SQLite schema

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Minor: A previous server process was running when Task 1 was verified; killed with lsof/kill before re-verification. No code changes required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend watched-state infrastructure is fully complete and tested
- GET /api/services always returns isWatched — frontend Plan 02 can render watched badges and filter by watched without any additional API calls
- POST /api/watched/:name and DELETE /api/watched/:name are ready for the favorites toggle button

## Self-Check: PASSED

All files verified present. Both task commits verified in git log.

- server/db.js: FOUND
- server/routes/watched.js: FOUND
- server/index.js: FOUND
- server/utils/systemctl.js: FOUND
- server/routes/services.js: FOUND
- src/types/service.ts: FOUND
- 03-01-SUMMARY.md: FOUND
- Commit 321e786 (Task 1): FOUND
- Commit e6b8ac5 (Task 2): FOUND

---
*Phase: 03-search-filtering-and-favorites*
*Completed: 2026-02-21*
