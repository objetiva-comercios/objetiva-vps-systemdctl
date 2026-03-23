---
phase: 03-search-filtering-and-favorites
plan: 02
subsystem: frontend, ui
tags: [react, typescript, usememo, lucide-react, optimistic-ui]

requires:
  - phase: 03-search-filtering-and-favorites
    plan: 01
    provides: isWatched boolean on all GET /api/services entries; POST/DELETE /api/watched/:name toggle endpoints

provides:
  - SearchFilterBar component with real-time search input, status filter buttons with counts, and result count display
  - Star/StarOff toggle button in ServiceRow actions cell (optimistic update + server persistence)
  - onToggleWatch prop threaded through ServiceTable to ServiceRow
  - Watched section in Home above the main table, derived from unfiltered services list
  - filteredServices via useMemo (search by name + status filter)
  - statusCounts via useMemo reduce for accurate filter button badge counts
  - Running filter uses s.sub === 'running' to exclude exited one-shot services

affects:
  - Any future phase touching Home.tsx or ServiceTable (onToggleWatch prop now required)

tech-stack:
  added: []
  patterns:
    - useMemo for derived state — filteredServices, watchedServices, statusCounts all memoized
    - Optimistic UI toggle with server sync and revert-on-failure pattern
    - Running filter uses sub field not active field to exclude exited one-shot services
    - Watched section derives from unfiltered services so starred items always visible regardless of search/filter

key-files:
  created:
    - src/components/SearchFilterBar.tsx
  modified:
    - src/components/ServiceRow.tsx
    - src/components/ServiceTable.tsx
    - src/pages/Home.tsx

key-decisions:
  - "Running filter uses s.sub === 'running' not s.active === 'active' — excludes exited one-shot services that are active but not running (per research Pitfall 1)"
  - "watchedServices derived from unfiltered services list — watched section always visible regardless of active search/filter (per research Pitfall 2)"
  - "statusCounts computed via single reduce() over unfiltered services for accurate badge counts"
  - "handleToggleWatch uses optimistic update: UI toggles instantly, fetch fires async, reverts on failure"
  - "StatusFilter type exported from SearchFilterBar.tsx and imported into Home.tsx to share type"

requirements-completed:
  - DASH-04
  - DASH-05
  - DASH-06

duration: 2min
completed: 2026-02-21
---

# Phase 3 Plan 02: Frontend Search, Filter, and Favorites Summary

**Real-time name search + status filter buttons + star toggle with optimistic persistence + watched section above main table**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T01:32:08Z
- **Completed:** 2026-02-21T01:34:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created SearchFilterBar.tsx with search input (Search/X icons), status filter buttons with counts in parentheses, and result count display when filters are active
- Added Star/StarOff toggle button to ServiceRow actions cell — filled star for watched, outline for unwatched
- Added onToggleWatch and isWatchedSection props to ServiceTable, passed onToggleWatch to all ServiceRows
- Updated Home.tsx with searchQuery/statusFilter state, three useMemo derivations (filteredServices, watchedServices, statusCounts), handleToggleWatch with optimistic update and revert-on-failure
- Watched section renders above main table with border-accent/20 border, unaffected by search/filter state
- Status bar shows "X of Y services" when filters are active, "X services" when not
- npm run build and tsc --noEmit both pass cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: SearchFilterBar component and ServiceRow star toggle** - `9f8832f` (feat)
2. **Task 2: Home page filter state, useMemo derivation, watched section, and optimistic toggle** - `104a2d3` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/components/SearchFilterBar.tsx` - New file: search input with clear button, status filter button group with counts, result count badge
- `src/components/ServiceRow.tsx` - Added Star/StarOff imports; onToggleWatch prop; star toggle button before other action buttons
- `src/components/ServiceTable.tsx` - Added onToggleWatch (required) and isWatchedSection (optional) props; passes onToggleWatch to ServiceRow; updated empty state message
- `src/pages/Home.tsx` - Added searchQuery/statusFilter state; SearchFilterBar rendering; three useMemo derivations; handleToggleWatch with optimistic update; watched section above main table; status bar updated

## Decisions Made

- Running filter uses `s.sub === 'running'` not `s.active === 'active'` — excludes exited one-shot services that show as active/exited, giving accurate "running" counts
- watchedServices always derived from the full, unfiltered services array — ensures watched section is always visible regardless of what search or filter the user has applied
- StatusFilter type exported from SearchFilterBar.tsx and imported in Home.tsx — single source of truth, no duplication
- Optimistic toggle: UI updates instantly, fetch fires in background, reverts on any fetch failure — provides snappy UX while preserving consistency

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All files verified present. Both task commits verified in git log.

- src/components/SearchFilterBar.tsx: FOUND
- src/components/ServiceRow.tsx: FOUND
- src/components/ServiceTable.tsx: FOUND
- src/pages/Home.tsx: FOUND
- Commit 9f8832f (Task 1): FOUND
- Commit 104a2d3 (Task 2): FOUND

---
*Phase: 03-search-filtering-and-favorites*
*Completed: 2026-02-21*
