# Requirements: systemdctl

**Defined:** 2026-02-20
**Core Value:** An admin can fully manage all their systemd services from a web browser without touching SSH

## v1 Requirements

### Dashboard

- [x] **DASH-01**: User can see all systemd services with their current status (active/inactive/failed)
- [x] **DASH-02**: Each service shows load state, active state, sub-state, and enabled/disabled
- [x] **DASH-03**: Each service shows inline health metrics (PID, memory, CPU, uptime)
- [x] **DASH-04**: User can search services by name
- [x] **DASH-05**: User can filter services by status (running, stopped, failed)
- [x] **DASH-06**: User can mark services as watched/favorite for quick access
- [x] **DASH-07**: Dashboard shows system hostname and uptime

### Service Actions

- [x] **ACTN-01**: User can start a stopped service
- [x] **ACTN-02**: User can stop a running service
- [x] **ACTN-03**: User can restart a service
- [x] **ACTN-04**: User can enable a service to start at boot
- [x] **ACTN-05**: User can disable a service from starting at boot

### Log Viewer

- [x] **LOGS-01**: User can view last N lines of logs for a specific service
- [x] **LOGS-02**: User can filter logs by time range (last 5m, 15m, 1h, 6h, 1d)
- [x] **LOGS-03**: Log lines are color-coded by level (errors red, warnings amber)

### Unit File Editor

- [x] **UNIT-01**: User can view the content of a service's unit file
- [x] **UNIT-02**: User can edit unit files with INI/systemd syntax highlighting
- [x] **UNIT-03**: Saving a unit file triggers automatic daemon-reload

### Infrastructure

- [x] **INFR-01**: Dark terminal aesthetic (dark background, green accent, JetBrains Mono)
- [x] **INFR-02**: Server binds to 127.0.0.1 only
- [x] **INFR-03**: All systemctl commands use execFile with whitelist (never exec/shell)
- [x] **INFR-04**: Service name input validated against `/^[\w@\-.]+$/`
- [x] **INFR-05**: Auto-polling of service status every 10 seconds

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
| DASH-01 | Phase 2 | Complete |
| DASH-02 | Phase 2 | Complete |
| DASH-03 | Phase 2 | Complete |
| DASH-04 | Phase 3 | Complete |
| DASH-05 | Phase 3 | Complete |
| DASH-06 | Phase 3 | Complete |
| DASH-07 | Phase 2 | Complete |
| ACTN-01 | Phase 2 | Complete |
| ACTN-02 | Phase 2 | Complete |
| ACTN-03 | Phase 2 | Complete |
| ACTN-04 | Phase 2 | Complete |
| ACTN-05 | Phase 2 | Complete |
| LOGS-01 | Phase 4 | Complete |
| LOGS-02 | Phase 4 | Complete |
| LOGS-03 | Phase 4 | Complete |
| UNIT-01 | Phase 5 | Complete |
| UNIT-02 | Phase 5 | Complete |
| UNIT-03 | Phase 5 | Complete |
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete (01-01) |
| INFR-03 | Phase 1 | Complete (01-01) |
| INFR-04 | Phase 1 | Complete (01-01) |
| INFR-05 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-21 after 05-02 completion — UNIT-02 marked complete; all v1 requirements complete*
