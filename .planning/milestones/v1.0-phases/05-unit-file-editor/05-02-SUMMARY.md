---
phase: 05-unit-file-editor
plan: 02
subsystem: ui
tags: [react, codemirror, typescript, systemd, unit-files, vite]

# Dependency graph
requires:
  - phase: 05-unit-file-editor/05-01
    provides: GET /api/unit/:service and PUT /api/unit/:service backend endpoints, writable flag
  - phase: 04-log-viewer
    provides: Logs.tsx page pattern, useParams/useCallback/useEffect pattern, ArrowLeft header layout
  - phase: 02-service-dashboard-and-actions
    provides: ServiceRow.tsx component, Link pattern for action icons
provides:
  - src/types/unit.ts — UnitFileInfo TypeScript interface (service, path, content, writable)
  - src/pages/UnitFile.tsx — Unit file viewer/editor page with CodeMirror INI/systemd syntax highlighting
  - /unit and /unit/:service routes wired in App.tsx
  - FileCode icon link to /unit/:service in each ServiceRow
affects: []

# Tech tracking
tech-stack:
  added:
    - "@uiw/react-codemirror"
    - "@codemirror/legacy-modes"
    - "@codemirror/language"
  patterns:
    - codemirror-module-level: StreamLanguage.define(properties) defined at module level (not inside component) to avoid per-render recreation
    - read-write-mode: editing state boolean toggles between pre-block read view and CodeMirror edit view in same component
    - optimistic-update: on save success, unitInfo.content updated in state so Save button re-disables without refetch

key-files:
  created:
    - src/types/unit.ts
    - src/pages/UnitFile.tsx
  modified:
    - src/App.tsx
    - src/components/ServiceRow.tsx

key-decisions:
  - "StreamLanguage.define(properties) at module level avoids per-render recreation of CodeMirror language extension"
  - "properties mode from @codemirror/legacy-modes used for INI/systemd syntax highlighting (key=value + [Section] headers)"
  - "Save button disabled when editContent === unitInfo.content — no-change guard prevents unnecessary PUT requests"
  - "Edit button disabled with title tooltip for non-writable files — UI enforces write policy matching backend /etc/systemd/system/ restriction"
  - "unitInfo.content updated in-place on save success — avoids refetch while keeping Save button disabled after save"

patterns-established:
  - "Pattern: page component guards with useParams, child viewer component takes service as string prop — same as Logs.tsx split"
  - "Pattern: CodeMirror dark theme with properties mode for systemd unit file syntax"

requirements-completed: [UNIT-01, UNIT-02, UNIT-03]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 5 Plan 02: Unit File Editor Frontend Summary

**CodeMirror-powered unit file viewer/editor in React with INI/systemd syntax highlighting, writable-flag gating, and FileCode deep links from every service row**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T13:59:29Z
- **Completed:** 2026-02-21T14:02:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created src/types/unit.ts with UnitFileInfo interface and src/pages/UnitFile.tsx with full viewer/editor implementing read-only pre-block view, CodeMirror edit mode with properties/INI syntax highlighting, save flow with atomic PUT, and success/error feedback
- Wired /unit and /unit/:service routes in App.tsx following the same pattern as logs routes
- Added FileCode icon link to /unit/:service in ServiceRow.tsx after the ScrollText logs link, giving every service a direct unit file page link

## Task Commits

Each task was committed atomically:

1. **Task 1: Install CodeMirror, create UnitFileInfo type, build UnitFile page** - `82974f0` (feat)
2. **Task 2: Wire UnitFile routes in App.tsx and add FileCode link in ServiceRow** - `271e18f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/types/unit.ts` - UnitFileInfo interface: service, path, content, writable
- `src/pages/UnitFile.tsx` - Viewer/editor page: no-service guard, UnitFileViewer child with fetch, read-only pre block, CodeMirror edit mode, save handler, writable-gated Edit button
- `src/App.tsx` - Added UnitFile import and /unit + /unit/:service routes before catch-all
- `src/components/ServiceRow.tsx` - Added FileCode import and icon Link to /unit/:service after logs link

## Decisions Made
- Used `properties` mode from `@codemirror/legacy-modes` for INI/systemd syntax highlighting — keys/values and [Section] headers get visual distinction
- `StreamLanguage.define(properties)` at module level to prevent recreating the extension on every render
- Save button is disabled when `editContent === unitInfo.content` — prevents unnecessary PUT on unchanged content
- Edit button disabled with `title` tooltip for non-writable files, matching backend's write restriction to `/etc/systemd/system/`
- On save success, `unitInfo.content` is updated in React state in-place (not refetched) — efficient and keeps Save button accurately disabled

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Build chunk size warning appeared (CodeMirror is ~880kB minified) — this is expected for a dev admin tool and not an issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All v1 feature requirements complete: UNIT-01, UNIT-02, UNIT-03 fulfilled
- Admin can now view and edit systemd unit files in /etc/systemd/system/ directly from browser
- Phase 5 fully complete — unit file editor frontend and backend shipped

## Self-Check: PASSED

- FOUND: src/types/unit.ts
- FOUND: src/pages/UnitFile.tsx
- FOUND: 05-02-SUMMARY.md
- FOUND: commit 82974f0 (Task 1)
- FOUND: commit 271e18f (Task 2)

---
*Phase: 05-unit-file-editor*
*Completed: 2026-02-21*
