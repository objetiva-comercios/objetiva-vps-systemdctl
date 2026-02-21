---
phase: 05-unit-file-editor
plan: 03
subsystem: api
tags: [systemd, sudo, privilege-escalation, express, typescript]

requires:
  - phase: 05-unit-file-editor
    provides: Unit file GET/PUT endpoints, UnitFile.tsx frontend editor

provides:
  - PUT /api/unit/:service writes via sudo cp from /tmp (EACCES resolved for non-root server)
  - GET /api/services includes fragmentPath and writable fields per service entry

affects: [05-unit-file-editor, frontend-service-list, unit-file-editor]

tech-stack:
  added: []
  patterns:
    - "sudo cp from /tmp pattern: write temp to /tmp (world-writable), then sudo cp to privileged destination"
    - "SHOW_PROPS extension: append new systemctl show properties to existing comma-delimited string"

key-files:
  created: []
  modified:
    - server/routes/unit.js
    - server/utils/systemctl.js
    - src/types/service.ts

key-decisions:
  - "Temp file goes to /tmp (not same dir) — EACCES on /etc/systemd/system/ for non-root; /tmp is world-writable"
  - "sudo cp + sudo chmod (not sudo tee) — execFile with explicit arg array maintains no-shell security posture"
  - "writable derived from resolve(FragmentPath).startsWith('/etc/systemd/system/') — same logic as unit.js WRITE_PREFIX check, single source of truth"

patterns-established:
  - "Privilege escalation pattern: writeFile to /tmp, execFileAsync sudo cp, execFileAsync sudo chmod, unlink tmp"

requirements-completed: [UNIT-03]

duration: 1min
completed: 2026-02-21
---

# Phase 5 Plan 03: Fix EACCES Unit Save + FragmentPath in Service List Summary

**sudo cp-based unit file write via /tmp resolves EACCES for non-root server, plus fragmentPath and writable added to bulk service list API**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-21T19:15:37Z
- **Completed:** 2026-02-21T19:16:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced direct fs.writeFile (EACCES) with sudo cp pattern: write to /tmp then privilege-escalate to /etc/systemd/system/
- Added FragmentPath to SHOW_PROPS so bulk systemctl show fetches it alongside other service properties
- Exposed fragmentPath (string | null) and writable (boolean) on every entry in GET /api/services response
- Extended ServiceEntry TypeScript interface with fragmentPath and writable fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix EACCES — replace direct fs.writeFile with sudo cp privilege escalation** - `5abf4a8` (fix)
2. **Task 2: Add FragmentPath and writable to bulk service list API** - `211a230` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `server/routes/unit.js` - PUT handler rewired: temp file to /tmp, sudo cp + sudo chmod to destination, unlink cleanup
- `server/utils/systemctl.js` - FragmentPath added to SHOW_PROPS; fragmentPath and writable mapped in getAllServices()
- `src/types/service.ts` - ServiceEntry interface extended with fragmentPath: string | null and writable: boolean

## Decisions Made

- Temp file written to /tmp not same directory: /etc/systemd/system/ is not writable by non-root, /tmp is world-writable
- Used execFileAsync('/usr/bin/sudo', ['cp', ...]) and execFileAsync('/usr/bin/sudo', ['chmod', '0644', ...]) — array form maintains no-shell security posture matching exec.js
- writable field derived via resolve(detail.FragmentPath).startsWith('/etc/systemd/system/') — mirrors the WRITE_PREFIX check already in unit.js for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both tasks completed cleanly. Build passed on first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

**Note:** sudo must be configured to allow the server process user to run `cp` and `chmod` on /etc/systemd/system/ files without a password prompt (NOPASSWD in sudoers). This is a deployment prerequisite, not a code change.

## Next Phase Readiness

- EACCES blocker resolved: unit file save now works from non-root server process
- fragmentPath and writable fields available in service list — frontend can use writable to conditionally enable/disable the edit button per service (currently done at individual unit GET level; bulk list now consistent)
- All UNIT-03 requirements satisfied
- Phase 5 gap closure complete

---
*Phase: 05-unit-file-editor*
*Completed: 2026-02-21*
