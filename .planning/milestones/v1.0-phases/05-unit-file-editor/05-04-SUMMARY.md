---
phase: 05-unit-file-editor
plan: 04
subsystem: ui
tags: [codemirror, react, syntax-highlighting, tailwind, typescript]

requires:
  - phase: 05-unit-file-editor
    provides: UnitFile.tsx with CodeMirror edit mode and systemdLang extension; ServiceEntry type with writable boolean

provides:
  - Read-only unit file view with INI/systemd syntax highlighting via CodeMirror (editable=false, readOnly=true)
  - "user" badge on ServiceRow for services whose unit files are in /etc/systemd/system/

affects: [05-unit-file-editor, frontend-service-list, unit-file-editor]

tech-stack:
  added: []
  patterns:
    - "Read-only CodeMirror: reuse same extension and theme as edit mode but with editable={false} readOnly={true} highlightActiveLine={false}"
    - "Conditional badge pattern: service.writable boolean gates a shrink-0 accent-colored span with tooltip"

key-files:
  created: []
  modified:
    - src/pages/UnitFile.tsx
    - src/components/ServiceRow.tsx

key-decisions:
  - "Read-only CodeMirror uses editable={false} AND readOnly={true} — both props for complete non-editable enforcement"
  - "highlightActiveLine: false in read-only mode — no active line gutter since there is no cursor"
  - "User badge uses border-accent/50 (not full accent) — subtle visual indicator without dominating the service name"

patterns-established:
  - "Reuse CodeMirror extension across read and edit modes: same systemdLang, same theme, same font for visual consistency"

requirements-completed: [UNIT-01, UNIT-02]

duration: 1min
completed: 2026-02-21
---

# Phase 5 Plan 04: Syntax Highlighting Read-Only View and User Badge Summary

**Read-only CodeMirror with INI/systemd syntax highlighting replaces monochrome pre block; writable services get a "user" badge in the service list**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-21T19:19:48Z
- **Completed:** 2026-02-21T19:20:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced the plain-text `<pre>` block with a read-only CodeMirror instance that reuses the existing `systemdLang` (properties mode) extension — `[Section]` headers and `Key=Value` pairs now render with distinct syntax colors
- Added a small "user" badge next to service names in the service list for services with `writable: true` (unit file in /etc/systemd/system/), distinguishing user-created services from system-managed ones
- Both changes use existing infrastructure — no new imports or dependencies required

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace pre block with read-only CodeMirror instance** - `d71bf00` (feat)
2. **Task 2: Add writable badge to ServiceRow for user-created services** - `84ce10f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/pages/UnitFile.tsx` - Read-only `<pre>` replaced with `<CodeMirror editable={false} readOnly={true} extensions={[systemdLang]}>` using same dark theme and font as edit mode
- `src/components/ServiceRow.tsx` - Service name cell wrapped in flex container; conditional `user` badge rendered when `service.writable` is true

## Decisions Made

- Used both `editable={false}` and `readOnly={true}` on the read-only CodeMirror — `editable` controls cursor/interaction, `readOnly` adds an additional layer preventing programmatic edits
- Set `highlightActiveLine: false` in read-only mode — no active line gutter since there is no cursor in non-editable mode
- Badge uses `border-accent/50` (semi-transparent accent border) rather than full accent — subtle indicator matching the project's terminal aesthetic without overwhelming the service name

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both tasks completed cleanly. Build passed on first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All UNIT-01 and UNIT-02 UAT requirements now satisfied
- Syntax highlighting in read-only mode closes the gap from the UAT failure report (readonly-no-syntax-highlight.md)
- "user" badge in service list closes the gap for visual distinction between user-created and system-managed services
- Phase 5 is fully complete — all gap closure plans (05-01 through 05-04) executed successfully

---
*Phase: 05-unit-file-editor*
*Completed: 2026-02-21*
