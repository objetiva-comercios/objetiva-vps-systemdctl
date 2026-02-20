# Requirements: systemdctl

**Defined:** 2026-02-20
**Core Value:** An admin can fully manage all their systemd services from a web browser without touching SSH

## v1 Requirements

### Dashboard

- [ ] **DASH-01**: User can see all systemd services with their current status (active/inactive/failed)
- [ ] **DASH-02**: Each service shows load state, active state, sub-state, and enabled/disabled
- [ ] **DASH-03**: Each service shows inline health metrics (PID, memory, CPU, uptime)
- [ ] **DASH-04**: User can search services by name
- [ ] **DASH-05**: User can filter services by status (running, stopped, failed)
- [ ] **DASH-06**: User can mark services as watched/favorite for quick access
- [ ] **DASH-07**: Dashboard shows system hostname and uptime

### Service Actions

- [ ] **ACTN-01**: User can start a stopped service
- [ ] **ACTN-02**: User can stop a running service
- [ ] **ACTN-03**: User can restart a service
- [ ] **ACTN-04**: User can enable a service to start at boot
- [ ] **ACTN-05**: User can disable a service from starting at boot

### Log Viewer

- [ ] **LOGS-01**: User can view last N lines of logs for a specific service
- [ ] **LOGS-02**: User can filter logs by time range (last 5m, 15m, 1h, 6h, 1d)
- [ ] **LOGS-03**: Log lines are color-coded by level (errors red, warnings amber)

### Unit File Editor

- [ ] **UNIT-01**: User can view the content of a service's unit file
- [ ] **UNIT-02**: User can edit unit files with INI/systemd syntax highlighting
- [ ] **UNIT-03**: Saving a unit file triggers automatic daemon-reload

### Infrastructure

- [ ] **INFR-01**: Dark terminal aesthetic (dark background, green accent, JetBrains Mono)
- [ ] **INFR-02**: Server binds to 127.0.0.1 only
- [ ] **INFR-03**: All systemctl commands use execFile with whitelist (never exec/shell)
- [ ] **INFR-04**: Service name input validated against `/^[\w@\-.]+$/`
- [ ] **INFR-05**: Auto-polling of service status every 10 seconds

## v2 Requirements

### Authentication

- **AUTH-01**: User can log in with username and password (JWT + refresh token)
- **AUTH-02**: Rate limiting on login (5 failed attempts → 15min block per IP)
- **AUTH-03**: First-run admin setup with auto-generated password
- **AUTH-04**: Force password change on first login

### Live Log Streaming

- **LIVE-01**: Real-time log streaming via WebSocket
- **LIVE-02**: Pause/resume log stream
- **LIVE-03**: Download logs as .txt

### Unit File Creation

- **UCRT-01**: Create new unit files from templates (Node.js, Python, Docker Compose, Generic)
- **UCRT-02**: Delete unit files with daemon-reload

### Audit Log

- **AUDT-01**: Record every action with who/when/what/service/result
- **AUDT-02**: Paginated audit log viewer with filters
- **AUDT-03**: Export audit log as CSV

### Multi-User

- **USER-01**: Role-based access control (admin, operator, viewer)
- **USER-02**: User CRUD from the UI (admin only)

### UX Polish

- **UXPL-01**: Keyboard shortcuts (/ for search, r for refresh, Esc to close)
- **UXPL-02**: Responsive layout (tablet, sidebar collapse)
- **UXPL-03**: Confirmation dialogs for destructive actions (stop, disable)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Notifications / alerts | Handled by separate monitoring/messaging system |
| Dark/light theme toggle | Dark-only terminal aesthetic |
| Mobile-native app | Web-only, responsive for tablet in v2 |
| OAuth / social login | Email/password sufficient |
| Multi-server management | Single VPS only |
| Full server dashboard (CPU/RAM/disk graphs) | Not systemd-focused; use dedicated monitoring tools |
| Log aggregation / cross-service search | Requires indexing infrastructure (Elasticsearch/Loki) |
| File manager / shell access | Out of scope; use SSH or Cockpit |
| Timer management | Complex, niche; defer to v3+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| DASH-05 | — | Pending |
| DASH-06 | — | Pending |
| DASH-07 | — | Pending |
| ACTN-01 | — | Pending |
| ACTN-02 | — | Pending |
| ACTN-03 | — | Pending |
| ACTN-04 | — | Pending |
| ACTN-05 | — | Pending |
| LOGS-01 | — | Pending |
| LOGS-02 | — | Pending |
| LOGS-03 | — | Pending |
| UNIT-01 | — | Pending |
| UNIT-02 | — | Pending |
| UNIT-03 | — | Pending |
| INFR-01 | — | Pending |
| INFR-02 | — | Pending |
| INFR-03 | — | Pending |
| INFR-04 | — | Pending |
| INFR-05 | — | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 (pending roadmap)

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after initial definition*
