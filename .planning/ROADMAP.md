# Roadmap: systemdctl

## Overview

Five phases that build from a security-correct foundation through a complete service management panel. Phase 1 establishes the project scaffold and all safe-execution infrastructure that every subsequent feature depends on. Phase 2 delivers the core usable product: a live dashboard of all systemd services with full start/stop/restart/enable/disable control. Phase 3 adds search, filtering, and watched services so the admin can navigate 5-15 services efficiently. Phase 4 adds the log viewer so the admin can read journalctl output from the browser. Phase 5 completes the v1 feature set with the unit file editor, enabling full service management without SSH.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Project scaffold, safe-execution wrapper, and infrastructure baseline
- [ ] **Phase 2: Service Dashboard and Actions** - Live service list with health metrics and full service control
- [ ] **Phase 3: Search, Filtering, and Favorites** - Service discovery and personal organization
- [ ] **Phase 4: Log Viewer** - Per-service journalctl output with time filtering and log level coloring
- [ ] **Phase 5: Unit File Editor** - View and edit systemd unit files with syntax highlighting

## Phase Details

### Phase 1: Foundation
**Goal**: The project builds, serves a page, and all systemd interactions are routed through a secure execution wrapper that prevents command injection
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04
**Success Criteria** (what must be TRUE):
  1. Running `npm install && npm run build && node server/index.js` starts the server and serves the React app at http://127.0.0.1
  2. Server binds only to 127.0.0.1 — a connection attempt to 0.0.0.0 from outside is refused
  3. All systemctl invocations pass through a single exec wrapper that uses execFile with an explicit action whitelist — no shell string is ever constructed
  4. Service name inputs are validated against `/^[\w@\-.]+$/` before reaching any child process call
  5. The dark terminal aesthetic (black background, green accent, JetBrains Mono font) is visible in the browser with no content yet
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold, Express server, SQLite database, and execFile security wrapper
- [ ] 01-02-PLAN.md — Frontend shell with dark terminal aesthetic, layout, and placeholder page

### Phase 2: Service Dashboard and Actions
**Goal**: The admin can see every systemd service on the system and start, stop, restart, enable, or disable any of them from the browser
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-07, ACTN-01, ACTN-02, ACTN-03, ACTN-04, ACTN-05, INFR-05
**Success Criteria** (what must be TRUE):
  1. The dashboard lists all systemd services visible to `systemctl list-units --all` with their active state (active/inactive/failed), load state, sub-state, and enabled/disabled status
  2. Each service row shows inline health metrics: PID, memory usage, CPU usage, and uptime
  3. The dashboard header shows the system hostname and system uptime
  4. Clicking start, stop, restart, enable, or disable on a service sends the correct systemctl command and the row updates to reflect the new state
  5. The service list auto-refreshes every 10 seconds without requiring a page reload
**Plans**: TBD

### Phase 3: Search, Filtering, and Favorites
**Goal**: The admin can narrow the service list by name or status and mark key services as watched for quick access
**Depends on**: Phase 2
**Requirements**: DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Typing in a search box filters the service list in real time to show only services whose names contain the typed text
  2. Selecting a status filter (running, stopped, failed) shows only services matching that state
  3. An admin can mark a service as watched/favorite and it persists across page reloads — watched services appear in a dedicated section or are visually distinguished
**Plans**: TBD

### Phase 4: Log Viewer
**Goal**: The admin can read journalctl output for any service from the browser, filtered by time range, with error and warning lines visually distinguished
**Depends on**: Phase 2
**Requirements**: LOGS-01, LOGS-02, LOGS-03
**Success Criteria** (what must be TRUE):
  1. Opening the log view for a service displays the last N lines of `journalctl -u <service>` output
  2. Selecting a time range preset (last 5m, 15m, 1h, 6h, 1d) re-fetches logs scoped to that window
  3. Log lines containing error-level entries are styled red and warning-level entries are styled amber, making severity scannable at a glance
**Plans**: TBD

### Phase 5: Unit File Editor
**Goal**: The admin can read and edit a service's unit file from the browser, with the change applied and reloaded on the server without SSH
**Depends on**: Phase 4
**Requirements**: UNIT-01, UNIT-02, UNIT-03
**Success Criteria** (what must be TRUE):
  1. Navigating to a service's unit file tab displays the full content of its `.service` file from `/etc/systemd/system/` (or the loaded path) in a read-only view
  2. Clicking edit opens the unit file in a code editor with INI/systemd syntax highlighting ([Section] headers and key=value pairs are visually distinct)
  3. Saving a modified unit file writes the change to disk atomically and triggers `systemctl daemon-reload` automatically — the admin does not need to run any command manually

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Planning complete | - |
| 2. Service Dashboard and Actions | 0/? | Not started | - |
| 3. Search, Filtering, and Favorites | 0/? | Not started | - |
| 4. Log Viewer | 0/? | Not started | - |
| 5. Unit File Editor | 0/? | Not started | - |
