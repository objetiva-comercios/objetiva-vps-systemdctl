---
phase: 02-service-dashboard-and-actions
plan: 02
subsystem: ui
tags: [react, typescript, tailwind, systemd, polling, dashboard]

# Dependency graph
requires:
  - phase: 02-service-dashboard-and-actions/02-01
    provides: GET /api/services, POST /api/services/:name/action, GET /api/system backend endpoints

provides:
  - Interactive service dashboard with auto-polling every 10 seconds
  - SystemHeader component showing real hostname and system uptime
  - ServiceTable and ServiceRow components with color-coded status, health metrics, and action buttons
  - useServicePolling hook with isFetching guard for concurrent fetch protection
  - TypeScript types ServiceEntry and SystemInfo
  - Formatting utilities for bytes, CPU time, and uptime display

affects: [03-service-detail, 04-log-streaming, 05-editor-and-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optimistic UI update via setServices callback after action POSTs
    - isFetching ref guard prevents overlapping interval fetches
    - Contextual action buttons (start vs stop/restart based on service state)

key-files:
  created:
    - src/types/service.ts
    - src/hooks/useServicePolling.ts
    - src/components/SystemHeader.tsx
    - src/components/ServiceTable.tsx
    - src/components/ServiceRow.tsx
  modified:
    - src/pages/Home.tsx
    - src/components/Layout.tsx

key-decisions:
  - "useServicePolling exposes setServices for optimistic row updates after actions — avoids waiting for next poll cycle"
  - "isFetching useRef guard (not state) prevents overlapping fetch calls without causing re-renders"
  - "API response is { ok, services } wrapper — hook extracts the services array before setting state"

patterns-established:
  - "Polling hook pattern: useRef guard + setInterval in useEffect + immediate call on mount"
  - "Optimistic update pattern: parent exposes setServices, child POSTs action and calls onServiceUpdate with returned service"
  - "Contextual action rendering: show start if inactive/failed, show stop+restart if active/running"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-07, ACTN-01, ACTN-02, ACTN-03, ACTN-04, ACTN-05, INFR-05]

# Metrics
duration: ~25min
completed: 2026-02-20
---

# Phase 2 Plan 02: Service Dashboard UI Summary

**React dashboard with 10-second auto-polling, color-coded service status, PID/memory/CPU/uptime metrics per row, and contextual start/stop/restart/enable/disable action buttons**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-20T13:05:00Z
- **Completed:** 2026-02-20T18:51:00Z (including checkpoint verification)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 7

## Accomplishments

- Full service dashboard rendering 173 systemd services with per-row health metrics
- Auto-polling every 10 seconds with isFetching ref guard preventing concurrent requests
- Action buttons with spinner loading state and optimistic row updates after start/stop/restart/enable/disable
- SystemHeader bar with real hostname and system uptime; Layout header also shows real hostname via /api/system fetch
- Dark terminal aesthetic maintained (no white backgrounds, green accents, JetBrains Mono)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create types, polling hook, and formatting utilities** - `688cbac` (feat)
2. **Task 2: Create SystemHeader, ServiceTable, ServiceRow components and wire dashboard** - `7265109` (feat)
3. **(fix) Fix API response parsing and scroll overflow** - `07349f0` (fix)
4. **Task 3: Verify service dashboard in browser** - checkpoint approved by user

## Files Created/Modified

- `src/types/service.ts` - ServiceEntry and SystemInfo interfaces; formatBytes, formatCpuTime, formatUptime, formatSystemUptime helpers
- `src/hooks/useServicePolling.ts` - Polling hook with 10s interval, isFetching ref guard, setServices for optimistic updates
- `src/components/SystemHeader.tsx` - Header bar with hostname and system uptime, green status dot
- `src/components/ServiceTable.tsx` - Table with column headers, maps services to ServiceRow
- `src/components/ServiceRow.tsx` - Single row: color-coded status icons, enabled badge, metrics, contextual action buttons with spinners
- `src/pages/Home.tsx` - Dashboard page composing polling hook + SystemHeader + ServiceTable; status bar with service count and last-updated timestamp
- `src/components/Layout.tsx` - Header now fetches /api/system to display real hostname instead of hardcoded "localhost"

## Decisions Made

- `useServicePolling` exposes `setServices` so child action handlers can update a single row instantly after a POST, without waiting for the 10-second poll cycle (optimistic UI).
- `isFetching` is a `useRef` (not `useState`) to avoid triggering re-renders when toggled — guards against overlapping fetch calls when a slow request spans multiple intervals.
- The API response format is `{ ok: true, services: [...] }` — the hook extracts `data.services` before setting state (this was auto-fixed when the initial parse was incorrect).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed API response parsing returning undefined services**
- **Found during:** Task 2 verification / post-checkpoint debugging
- **Issue:** `useServicePolling` was calling `setServices(data)` on the raw response object `{ ok, services }` instead of `data.services`, causing services to be undefined
- **Fix:** Changed parse to extract `data.services` array from response wrapper
- **Files modified:** `src/hooks/useServicePolling.ts`
- **Verification:** Dashboard rendered 173 services after fix
- **Committed in:** `07349f0`

**2. [Rule 1 - Bug] Fixed table scroll overflow preventing full list visibility**
- **Found during:** Task 2 verification / post-checkpoint debugging
- **Issue:** Table container lacked `min-h-0` and `overflow-auto`, causing the table to overflow the viewport without a scrollbar
- **Fix:** Added `min-h-0 overflow-auto` to table wrapper in Home.tsx
- **Files modified:** `src/pages/Home.tsx`
- **Verification:** Full service list scrollable in browser
- **Committed in:** `07349f0`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in response parsing and layout overflow)
**Impact on plan:** Both fixes required for core functionality to work. No scope creep.

## Issues Encountered

The Vite dev server was already running when verification began, so the dashboard was accessible immediately at the Tailscale URL. The two bugs above were caught during browser verification and fixed in a single commit before checkpoint approval.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Service dashboard is fully functional: all 173 services listed, action buttons working, auto-refresh confirmed
- Phase 2 Plan 02 complete — entire Phase 2 (backend API + frontend dashboard) is now done
- Phase 3 (Service Detail view) can proceed: the `ServiceEntry` type, polling hook, and action pattern are established reference points for the detail page

---
*Phase: 02-service-dashboard-and-actions*
*Completed: 2026-02-20*
