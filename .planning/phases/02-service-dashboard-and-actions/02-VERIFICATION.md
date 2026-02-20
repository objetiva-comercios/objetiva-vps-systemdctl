---
phase: 02-service-dashboard-and-actions
verified: 2026-02-20T19:30:00Z
status: human_needed
score: 13/13 must-haves verified
human_verification:
  - test: "Open dashboard in browser and verify service list renders all systemd services"
    expected: "Table shows all services with Service, Status, Enabled, PID, Memory, CPU, Uptime, Actions columns. Active services show green indicators, failed services show red, inactive services show muted."
    why_human: "Visual rendering and color-coding cannot be verified programmatically"
  - test: "Verify SystemHeader shows real hostname (not 'localhost') and formatted system uptime"
    expected: "Header bar shows actual machine hostname and uptime in d/h/m format with green dot indicator"
    why_human: "Hostname value requires runtime fetch — cannot verify statically"
  - test: "Verify Layout header (top bar) shows real hostname fetched from /api/system"
    expected: "Top header shows actual hostname next to green dot, not hardcoded 'localhost'"
    why_human: "Runtime fetch value, visual confirmation needed"
  - test: "Click Stop on a running non-critical service and observe behavior"
    expected: "Button shows LoaderCircle spinner while pending, all buttons in row disable, row updates to inactive/dead state after action completes"
    why_human: "Interactive state transitions require browser testing"
  - test: "Click Start on the stopped service to bring it back"
    expected: "Row updates to active/running state. Start button disappears, Stop and Restart appear."
    why_human: "Contextual button rendering depends on live service state"
  - test: "Wait 10 seconds and verify the 'updated HH:MM:SS' timestamp changes without page reload"
    expected: "The status bar timestamp updates automatically every 10 seconds"
    why_human: "Timed behavior requires real browser observation"
  - test: "Verify dark terminal aesthetic: no white backgrounds, green accents, JetBrains Mono font"
    expected: "All backgrounds use dark tokens (bg-bg-base, bg-bg-surface, bg-bg-elevated), accents are green, font is monospace"
    why_human: "Visual style cannot be confirmed from source alone"
---

# Phase 2: Service Dashboard and Actions Verification Report

**Phase Goal:** The admin can see every systemd service on the system and start, stop, restart, enable, or disable any of them from the browser
**Verified:** 2026-02-20T19:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 01 (Backend API)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | GET /api/services returns JSON array of all systemd services with unit, load, active, sub, description, unitFileState, pid, memoryBytes, cpuNsec, activeEnterTimestamp | VERIFIED | `getAllServices()` in `server/utils/systemctl.js:70-100` returns all fields; route at `server/routes/services.js:16-23` returns `{ ok: true, services }` |
| 2 | GET /api/system returns hostname and uptimeSeconds | VERIFIED | `server/routes/system.js:10-15` returns `{ ok: true, hostname: os.hostname(), uptimeSeconds: Math.floor(os.uptime()) }` |
| 3 | POST /api/services/:name/action with {action:'start'\|'stop'\|'restart'\|'enable'\|'disable'} executes the systemctl command and returns updated service state | VERIFIED | `server/routes/services.js:33-75` validates action, calls `runSystemctl(action, name)`, re-fetches via `runSystemctl('show', name, ...)`, returns full updated service object |
| 4 | Invalid action names return 400 error | VERIFIED | `server/routes/services.js:38-40`: `if (!ALLOWED_DASHBOARD_ACTIONS.includes(action)) return res.status(400).json(...)` |
| 5 | Invalid service names are rejected by the existing exec.js wrapper | VERIFIED | `server/utils/exec.js:38-40`: SERVICE_NAME_RE `/^[\w@\-.]+$/` checked before any execFile call; throws Error on mismatch which propagates to Express error handler |

### Observable Truths — Plan 02 (Frontend Dashboard)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 6 | Dashboard lists all systemd services with active state color-coded (green=active, red=failed, muted=inactive) | VERIFIED | `src/components/ServiceRow.tsx:95-102`: active→text-accent, failed→text-danger, else→text-muted; StatusIcon renders CircleCheck/CircleAlert/CircleDot accordingly |
| 7 | Each service row shows load state, active state, sub-state, and enabled/disabled badge | VERIFIED | ServiceRow renders sub-state text next to StatusIcon; EnabledBadge renders unitFileState with green outline for 'enabled', muted for 'disabled', plain text for static/masked |
| 8 | Each service row shows PID, memory, CPU time, and uptime (or dash for inactive services) | VERIFIED | `src/components/ServiceRow.tsx:111-128`: pid??'--', formatBytes(memoryBytes), formatCpuTime(cpuNsec), formatUptime(activeEnterTimestamp); all formatters return '--' for null |
| 9 | Dashboard header displays system hostname and formatted uptime | VERIFIED | `src/components/SystemHeader.tsx:8-33`: renders systemInfo.hostname and formatSystemUptime(systemInfo.uptimeSeconds); shows skeleton when null |
| 10 | Admin can click start, stop, restart, enable, or disable on any service and the row updates | VERIFIED | `src/components/ServiceRow.tsx:54-75`: handleAction POSTs to `/api/services/${encodeURIComponent(service.unit)}/action`, calls `onServiceUpdate(data.service)` on success; parent Home.tsx:19-21 updates services array via setServices |
| 11 | Action buttons show loading state and are disabled while an action is pending | VERIFIED | `src/components/ServiceRow.tsx:80,140-148`: `isDisabled = actionPending !== null`; each button shows `<LoaderCircle className="animate-spin">` when its action matches actionPending, all buttons have `disabled={isDisabled}` |
| 12 | Service list auto-refreshes every 10 seconds without page reload | VERIFIED | `src/hooks/useServicePolling.ts:38-42`: `setInterval(fetchServices, 10_000)` inside useEffect; interval cleared on cleanup |
| 13 | Concurrent fetch calls are guarded (no overlapping poll requests) | VERIFIED | `src/hooks/useServicePolling.ts:18,21-22`: `isFetching = useRef<boolean>(false)`; `if (isFetching.current) return` guards entry; set true before fetch, reset in finally block |

**Score:** 13/13 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/utils/systemctl.js` | parseListUnits, parseShowOutput, getAllServices functions | VERIFIED | All three functions exported (lines 14, 39, 70). parseListUnits splits on \s+, slices description. parseShowOutput splits on \n\n blocks, first-= split. getAllServices runs Promise.all, merges by unit name, applies all null guards |
| `server/routes/services.js` | GET /api/services and POST /api/services/:name/action endpoints | VERIFIED | Both routes present and substantive. Imports getAllServices and parseShowOutput from systemctl.js, runSystemctl from exec.js. Default export is Express router |
| `server/routes/system.js` | GET /api/system endpoint returning hostname and uptime | VERIFIED | 18-line file; single route returning os.hostname() and Math.floor(os.uptime()). Default export is Express router |
| `server/index.js` | Router mounting for /api/services and /api/system | VERIFIED | Lines 5-6 import both routers; lines 25-26 mount at correct paths; middleware order correct (routes → error handler → static → SPA catch-all) |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/service.ts` | ServiceEntry and SystemInfo TypeScript types | VERIFIED | Both interfaces exported with all required fields. Also exports formatBytes, formatCpuTime, formatUptime, formatSystemUptime helpers — all return '--' for null inputs |
| `src/hooks/useServicePolling.ts` | useServicePolling hook with 10s interval, loading, error, refresh | VERIFIED | Named export. Returns { services, setServices, loading, error, lastUpdated, refresh }. isFetching useRef guard present. fetchServices wrapped in useCallback |
| `src/components/SystemHeader.tsx` | Header bar with hostname and system uptime | VERIFIED | Accepts SystemInfo\|null prop. Renders loading skeleton when null. Shows green dot, hostname, and formatSystemUptime(uptimeSeconds). Default export |
| `src/components/ServiceTable.tsx` | Table rendering all services with column headers | VERIFIED | 8-column thead (Service, Status, Enabled, PID, Memory, CPU, Uptime, Actions). Maps services to ServiceRow keyed by service.unit. Passes onServiceUpdate. Default export |
| `src/components/ServiceRow.tsx` | Single service row with state badges, metrics, and action buttons | VERIFIED | Full implementation: 215 lines. StatusIcon, EnabledBadge sub-components. handleAction POSTs to API. All 5 action buttons with spinner state. actionError auto-clears after 3s. Default export |
| `src/pages/Home.tsx` | Dashboard page composing SystemHeader + ServiceTable with polling | VERIFIED | Not a placeholder. Uses useServicePolling hook, fetches /api/system, renders SystemHeader + status bar + ServiceTable. handleServiceUpdate passed down. Default export |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/routes/services.js` | `server/utils/systemctl.js` | import getAllServices, parseShowOutput | WIRED | Line 3: `import { getAllServices, parseShowOutput } from '../utils/systemctl.js'`; both called in route handlers |
| `server/routes/services.js` | `server/utils/exec.js` | import runSystemctl for action endpoint | WIRED | Line 2: `import { runSystemctl } from '../utils/exec.js'`; called at line 43 and 46 |
| `server/index.js` | `server/routes/services.js` | app.use('/api/services', servicesRouter) | WIRED | Lines 5+25: import and mount confirmed |
| `server/index.js` | `server/routes/system.js` | app.use('/api/system', systemRouter) | WIRED | Lines 6+26: import and mount confirmed |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/Home.tsx` | `/api/services` | useServicePolling hook fetches every 10s | WIRED | Line 3 imports hook; line 9 destructures result; hook at useServicePolling.ts:24 fetches `/api/services` |
| `src/pages/Home.tsx` | `/api/system` | fetch in useEffect for SystemHeader data | WIRED | Lines 12-17: useEffect fetches `/api/system`, sets systemInfo state, passed to SystemHeader |
| `src/components/ServiceRow.tsx` | `/api/services/:name/action` | POST fetch on button click | WIRED | Lines 58-62: `fetch('/api/services/${encodeURIComponent(service.unit)}/action', { method: 'POST', ... })` |
| `src/components/ServiceRow.tsx` | `src/pages/Home.tsx` | onServiceUpdate callback to update row in parent state | WIRED | Line 67: `onServiceUpdate(data.service)` called on success; Home.tsx:19-21 maps updated service into state array |
| `src/components/Layout.tsx` | `/api/system` | fetch hostname for header display | WIRED | Layout.tsx:10-12: useEffect fetches `/api/system`, sets hostname state displayed in header |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DASH-01 | 02-01, 02-02 | User can see all systemd services with their current status (active/inactive/failed) | SATISFIED | getAllServices() fetches all services via list-units --all; ServiceTable maps them to ServiceRow with color-coded StatusIcon |
| DASH-02 | 02-01, 02-02 | Each service shows load state, active state, sub-state, and enabled/disabled | SATISFIED | Service object includes load/active/sub/unitFileState; ServiceRow renders sub-state text and EnabledBadge |
| DASH-03 | 02-01, 02-02 | Each service shows inline health metrics (PID, memory, CPU, uptime) | SATISFIED | Service object includes pid/memoryBytes/cpuNsec/activeEnterTimestamp; ServiceRow renders all four columns with format helpers |
| DASH-07 | 02-01, 02-02 | Dashboard shows system hostname and uptime | SATISFIED | GET /api/system returns hostname+uptimeSeconds; SystemHeader renders both; Layout header also shows hostname |
| ACTN-01 | 02-01, 02-02 | User can start a stopped service | SATISFIED | 'start' in ALLOWED_DASHBOARD_ACTIONS; Start button renders when !isActive or !isRunning; POST triggers runSystemctl |
| ACTN-02 | 02-01, 02-02 | User can stop a running service | SATISFIED | 'stop' in ALLOWED_DASHBOARD_ACTIONS; Stop button renders when isActive && isRunning |
| ACTN-03 | 02-01, 02-02 | User can restart a service | SATISFIED | 'restart' in ALLOWED_DASHBOARD_ACTIONS; Restart button renders when isActive && isRunning |
| ACTN-04 | 02-01, 02-02 | User can enable a service to start at boot | SATISFIED | 'enable' in ALLOWED_DASHBOARD_ACTIONS; Enable button renders when !isEnabled and not static/masked |
| ACTN-05 | 02-01, 02-02 | User can disable a service from starting at boot | SATISFIED | 'disable' in ALLOWED_DASHBOARD_ACTIONS; Disable button renders when isEnabled |
| INFR-05 | 02-02 | Auto-polling of service status every 10 seconds | SATISFIED | useServicePolling sets setInterval(fetchServices, 10_000) with isFetching ref guard; cleanup returns clearInterval |

**All 10 requirements for Phase 2 satisfied with direct code evidence.**

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `server/index.js:50` | `console.log(...)` startup message | Info | Acceptable — server startup notification, not a stub |

No blockers or warnings found. No TODO/FIXME/HACK comments, no empty implementations, no placeholder returns in any phase 2 file.

---

## Human Verification Required

The following items cannot be confirmed programmatically and require browser testing:

### 1. Service Table Visual Rendering

**Test:** Open the dashboard URL in a browser
**Expected:** Table renders all systemd services (approximately 173) with eight columns visible: Service, Status, Enabled, PID, Memory, CPU, Uptime, Actions. Active services show green indicators, failed services show red, inactive services show muted/gray.
**Why human:** Color rendering, font application, and table layout require visual confirmation

### 2. SystemHeader Real Hostname and Uptime

**Test:** Observe the header bar below the top navigation
**Expected:** Shows actual machine hostname (not "localhost"), formatted uptime in d/h/m format, and a green dot with "online" text
**Why human:** Hostname value comes from a runtime API call — static analysis cannot confirm the displayed value matches the real hostname

### 3. Layout Header Hostname

**Test:** Observe the top navigation bar (systemdctl logo area)
**Expected:** Shows actual machine hostname next to the green dot indicator — not the hardcoded string "localhost"
**Why human:** Runtime fetch value requires browser confirmation

### 4. Action Button Behavior — Stop

**Test:** Find a running non-critical service, click its Stop button
**Expected:** (a) Button immediately shows a spinning LoaderCircle; (b) all other action buttons in that row become disabled/dimmed; (c) after action completes, the row updates to show inactive state and Stop/Restart buttons disappear, replaced by Start button
**Why human:** Interactive state transitions and timing require real browser interaction

### 5. Action Button Behavior — Start

**Test:** Click Start on the service stopped in the previous test
**Expected:** Row updates to active/running state; Start button disappears; Stop and Restart buttons appear
**Why human:** Contextual button rendering based on live service state

### 6. Auto-Refresh Confirmation

**Test:** Note the "updated HH:MM:SS" timestamp shown in the status bar, then wait 10-15 seconds without interacting
**Expected:** The timestamp updates automatically, confirming a background fetch completed
**Why human:** Timed interval behavior requires real-time observation

### 7. Dark Terminal Aesthetic

**Test:** Visual inspection of the entire dashboard
**Expected:** No white backgrounds anywhere — all surfaces use dark colors. Green (#00ff00 or similar) used for accents. Monospace font (JetBrains Mono) used throughout table and header content.
**Why human:** Visual design quality cannot be confirmed from Tailwind class names alone

---

## Summary

All 13 observable truths verified against actual code. All 10 required artifacts pass all three levels (exists, substantive, wired). All 9 key links across both plans confirmed present and functional. All 10 requirement IDs satisfied with direct code evidence.

The backend API (Plan 01) is fully implemented with real systemctl parsing, a two-call parallel merge pattern, null guards for inactive metrics, action validation (400 on invalid action), and correct Express middleware ordering.

The frontend dashboard (Plan 02) is fully implemented: the `useServicePolling` hook uses a `useRef` isFetching guard and 10-second interval, ServiceRow posts actions to the API and updates parent state via the `onServiceUpdate` callback, ServiceTable passes the callback to each row, and Home.tsx composes everything with a separate /api/system fetch for the SystemHeader.

No stubs, placeholders, or anti-patterns were found in any of the 11 files created or modified during this phase. TypeScript compilation passes with no errors.

The only items requiring human confirmation are visual appearance, runtime hostname values, and interactive/timed behaviors that are correct in code but must be exercised in a browser.

---

_Verified: 2026-02-20T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
