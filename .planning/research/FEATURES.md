# Feature Research

**Domain:** Self-hosted systemd service management web panel (Linux VPS administration)
**Researched:** 2026-02-20
**Confidence:** MEDIUM — Cockpit/sysdweb official docs verified, community patterns from WebSearch cross-referenced, no Context7 equivalents for domain-specific tools

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Service status dashboard | Any panel shows what's running and what isn't — first thing a sysadmin checks | LOW | Shows unit name, loaded state, active state, sub-state (running/exited/failed), enabled/disabled status. Cockpit and every competitor lead with this. |
| Start / Stop / Restart actions | Fundamental service control; reason the panel exists | LOW | Must be per-service. Cockpit provides this via systemd D-Bus. Action must be immediate with visible feedback. |
| Enable / Disable at boot | Service persistence is a distinct concern from running state; users set this once and expect it respected | LOW | Maps to `systemctl enable/disable`. Clearly separate from active state in UI. |
| Service log viewer (journal) | When a service fails, you look at logs. Every competitor has this. | MEDIUM | Shows `journalctl -u <service>` output. Per-service filter is mandatory. Time-based filter (last 100 lines, last hour, etc.) is expected. |
| Live log streaming | Sysadmins tail logs during restarts and debugging — static log view is insufficient for active diagnosis | MEDIUM | `journalctl -f -u <service>` behavior. SSE (server-sent events) is the right primitive: unidirectional, text-based, auto-reconnects. WebSocket is overkill. |
| Distinct service states visible | Users need to see at a glance which services are failed, running, stopped | LOW | Color-coded status: failed (red), active (green), inactive (grey). Cockpit, sysdweb, and all competitors show this. A monochrome list with no state differentiation is unusable. |
| Authentication | A panel exposing `systemctl` commands with no auth is a critical security hole. Users expect login. | LOW | sysdweb has NO auth and explicitly documents this as a limitation — users consider it incomplete/unsafe. JWT or session-based. Login screen is table stakes. |
| Filter / search services | On a VPS with 15+ services, finding one by scrolling is frustrating | LOW | Text filter across service name and description. Cockpit and systemd-service-manager-web-ui both implement this. |
| Reload systemd daemon | After unit file edits, `systemctl daemon-reload` is required. Users who edit unit files will need this. | LOW | Single button. Required companion to the unit file editor. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unit file editor with syntax highlighting | Cockpit does NOT allow editing unit files through its UI at all. Systemd-service-manager-web-UI supports it but requires manual sudoers setup and has no syntax highlighting. A clean in-browser editor with INI-style syntax highlighting (systemd units are INI-derived) fills a real gap. | MEDIUM | Use CodeMirror or Monaco editor with a systemd unit file mode. `systemd-analyze verify` can be called server-side to validate before saving. |
| Audit log of panel actions | Cockpit explicitly does NOT implement this — maintainers closed the issue saying it's "too easy to bypass." For a focused solo-admin tool where one person manages 5–15 services, an in-app audit log of "who pressed restart and when" is genuinely useful and not bypassed by the same person. Key differentiator for accountability. | MEDIUM | Append-only log table: timestamp, user, action, service name, result (success/failure). SQLite or append to flat file. NOT a security guarantee — a convenience record. |
| Dark terminal aesthetic | All competitors (Cockpit, Webmin, Ajenti) use light enterprise UI. The target user is a developer/sysadmin who lives in a terminal. A dark-first, monospace-leaning UI matches their mental model and is immediately recognizable as "for me." | LOW | CSS/theme choice, not a feature in itself, but creates strong product identity. Enforce it: no light/dark toggle needed — pick dark and own it. |
| Per-service action confirmation modal | Restarting the wrong service on production is a high-cost mistake. A confirmation step ("You are about to restart nginx on prod") with the service name prominent reduces fat-finger errors. Competitors do not implement this. | LOW | Simple modal with service name displayed, optional "I understand" checkbox for destructive actions (stop on an enabled service). |
| Service grouping / tagging | A VPS with 15 services mixing web, database, monitoring, and custom services becomes noisy. Grouping them (e.g., "web stack", "databases") lets the admin scan faster. No competitor implements this for systemd specifically. | MEDIUM | Tags stored in app database (not in unit files). Purely cosmetic organization layer. |
| Inline service health context | Show memory usage, PID, uptime (from `systemctl status` output) alongside start/stop buttons so the admin doesn't need to open a separate view to know if a service is misbehaving | MEDIUM | Parsed from `systemctl status` D-Bus properties. Cockpit shows this in a separate detail view — surfacing the most important signals inline is faster. |
| Log timestamp + level filtering | `journalctl` supports filtering by priority level (err, warning, info, debug). No lightweight web panel surfaces this cleanly. Useful for narrowing down errors without scrolling through noise. | MEDIUM | Priority filter dropdown (error, warning, info, all). Cockpit does support grep/field filtering but the UX is complex. Make it dead simple. |
| Keyboard shortcuts | Power users (the target audience) prefer keyboard navigation. No systemd panel implements this. `r` for restart, `s` for start/stop, `j` for jump to logs — standard vim-like bindings. | LOW | Pure frontend JS. High value for users who manage many services rapidly. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full server dashboard (CPU, RAM, disk, network graphs) | "While I'm here, show me server health" feels natural | Scope creep. This is Cockpit/Netdata territory. Building it well requires significant infrastructure (metrics collection, time-series storage, graphing). Building it badly produces an inferior version of existing free tools. Detracts from systemd focus. | Link to an external monitoring tool. Show one-line summary (current CPU %, RAM %) from /proc at most — static, no graphs, no history. |
| Multi-server management | "Manage all my VPSes from one panel" is appealing | Architecturally transforms the project: now needs a central control plane, SSH/agent connections, fleet state management, credential storage. This is a different product (Ansible, Portainer, etc.). | Design the API cleanly so it could be federated later. Single-server is the correct scope for v1. |
| User management / team access | "Share access with teammates" | For a solo-admin tool, full RBAC with user creation is heavy. Password management, user lifecycle, email/reset flows — significant surface area for bugs and security issues. | JWT with a single shared secret or a small static user list is sufficient. Keep role definitions simple (admin = full access, viewer = read-only). |
| Notification system (email, Slack, PagerDuty) | "Alert me when a service fails" | Stateful: requires persistent monitoring loop, delivery reliability, credentials management, retry logic. The project context explicitly says notifications are out of scope. | Document the recommended pattern: use a dedicated monitoring tool (Uptime Kuma, healthchecks.io) that watches services externally. |
| Full unit file creation wizard | "Help me create a service from scratch" | Systemd unit files have hundreds of valid directives. A wizard that covers 10% of them gives a false sense of completeness and produces subtly wrong configs for edge cases. Cockpit maintainers explicitly noted this problem. | Provide a template (Type=simple starter) that opens in the unit file editor. Let the user write the rest with the editor and official docs linked. |
| Log aggregation / search across services | "Search all logs" | Requires indexing infrastructure (Elasticsearch/Loki level tooling) to be useful at scale. A naive grep across all journals is too slow for real use. | Surface per-service log views well. For cross-service search, link to journalctl command examples in the UI. |
| File manager / shell access | "While I'm here, let me browse files / open a terminal" | This turns a focused panel into a general server management tool with massive security implications. The value proposition of "systemd-focused" is destroyed. | Out of scope. Hard boundary. If users want this, they should use Cockpit or SSH. |

---

## Feature Dependencies

```
[JWT Authentication]
    └──required by──> [All other features] (nothing works without auth)

[Service List / Dashboard]
    └──required by──> [Start/Stop/Restart/Enable/Disable actions]
    └──required by──> [Log Viewer]
    └──required by──> [Unit File Editor]
    └──required by──> [Inline Health Context]

[Log Viewer (static)]
    └──enables──> [Live Log Streaming] (streaming is an enhancement of static viewing)

[Unit File Editor]
    └──requires──> [Reload Daemon action] (edits require daemon-reload to take effect)
    └──enhances──> [Unit File Validation] (validate before saving)

[Audit Log]
    └──enhances──> [Start/Stop/Restart/Enable/Disable actions] (records each action)
    └──enhances──> [Unit File Editor] (records file saves)

[Service Grouping/Tags]
    └──enhances──> [Service List / Dashboard] (organization layer on top of the list)

[Log Level Filtering]
    └──enhances──> [Log Viewer] (adds filtering capability to existing log view)
```

### Dependency Notes

- **Authentication requires everything else:** Building any feature before auth is in place creates tech debt — every route needs to be retroactively protected. Auth must be phase 1.
- **Service list is the root view:** Dashboard + service table is the foundation all other features build on. No feature can be built without it.
- **Live log streaming enhances, not replaces, static logs:** Static log view (paginated/recent entries) should work first. SSE streaming is added on top. This allows the feature to degrade gracefully if the SSE connection drops.
- **Unit file editor and daemon reload are a pair:** Editing without reload = change does not take effect. These must ship together or the editor is misleading.
- **Audit log has no hard dependencies:** It can be added after any action-producing feature. Each action emits an audit event. Best added in the same phase as actions so they're captured from day one.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the concept, provides real utility for the target user (solo admin, 5–15 services).

- [ ] **JWT authentication** — without this, nothing can be safely exposed; single-user (admin) credential is sufficient
- [ ] **Service list dashboard** — all services with status indicators (failed/active/inactive), name, description, enabled state; filter by name
- [ ] **Service actions: start, stop, restart, enable, disable** — with confirmation modal for destructive actions (stop, restart)
- [ ] **Per-service log viewer** — last N lines of `journalctl -u <service>`, filterable by log level
- [ ] **Live log streaming** — `journalctl -f` via SSE per service; essential for active debugging
- [ ] **Audit log** — records timestamp, user, action, service, result; append-only; viewable in UI; captures all actions from launch so history builds immediately

### Add After Validation (v1.x)

Features to add once core is working and daily-use proves value.

- [ ] **Unit file editor** — in-browser editor with INI syntax highlighting, server-side `systemd-analyze verify` validation before save, daemon-reload on success; add when users confirm they'd use the editor in practice
- [ ] **Inline service health context** — memory, PID, uptime inline in service table row; add when users report needing to click into detail view too often
- [ ] **Service grouping / tags** — user-defined labels for services; add when the service count grows or users report the flat list is hard to scan
- [ ] **Log level / priority filtering** — error/warning/info/debug dropdown on log viewer; add when users report log noise is the bottleneck during debugging

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Keyboard shortcuts** — high value for power users but zero-blocking for v1; add when UX is otherwise stable
- [ ] **Read-only viewer role** — second JWT role with no write permissions; defer until multi-user scenario is confirmed needed
- [ ] **Systemd timer management** — create/edit/view timer units; complex, niche; defer until users explicitly request it
- [ ] **Dependency visualization** — visual graph of service dependencies via `systemd-analyze dot`; interesting but low priority relative to core management features

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| JWT authentication | HIGH | LOW | P1 |
| Service status dashboard | HIGH | LOW | P1 |
| Start / stop / restart / enable / disable | HIGH | LOW | P1 |
| Per-service log viewer | HIGH | LOW | P1 |
| Live log streaming (SSE) | HIGH | MEDIUM | P1 |
| Audit log | HIGH | LOW | P1 |
| Unit file editor | HIGH | MEDIUM | P2 |
| Daemon-reload action | MEDIUM | LOW | P2 (ships with editor) |
| Inline service health context | MEDIUM | MEDIUM | P2 |
| Confirmation modal for destructive actions | HIGH | LOW | P1 (fold into actions) |
| Service grouping / tags | MEDIUM | MEDIUM | P2 |
| Log level filtering | MEDIUM | LOW | P2 |
| Keyboard shortcuts | MEDIUM | LOW | P3 |
| Viewer role (RBAC) | LOW | MEDIUM | P3 |
| Timer management | LOW | HIGH | P3 |
| Dependency graph visualization | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Cockpit | sysdweb | Systemd-Service-Manager-Web-UI | systemdctl (our approach) |
|---------|---------|---------|-------------------------------|--------------------------|
| Service status dashboard | Yes — full unit type tabs (services, sockets, timers, paths, targets) | Yes — minimal list | Yes — sortable table with filter bar | Yes — focused on service units, clean status indicators |
| Start/Stop/Restart | Yes | Yes (REST API + basic UI) | Yes | Yes — with confirmation modal |
| Enable/Disable | Yes | No | Yes | Yes |
| Log viewer | Yes — journald integration with grep/field/time filters | Minimal — 100-line tail | Yes — fetched on demand | Yes — per-service, level filter |
| Live log streaming | No native streaming in services view | No | No | YES — SSE-based; key differentiator |
| Unit file editor | NO | No | Yes (requires sudoers setup, no syntax highlighting) | Yes — with syntax highlighting + validation |
| Audit log | NO (issue closed, will not implement) | No | No | YES — append-only action history; key differentiator |
| Authentication | Yes — uses system PAM users | No — explicitly none | No — network isolation only | Yes — JWT, single admin credential |
| Dark/terminal aesthetic | No — enterprise light UI | No | No — Tailwind light with frosted glass | YES — dark terminal UI; brand differentiator |
| Multi-user / RBAC | Yes — PAM roles + PolicyKit | No | No | Minimal — admin + optional viewer role |
| Timer management | Yes | No | No | v2+ |
| Dependency graph | No (systemd-analyze dot exists CLI-only) | No | No | v2+ |
| Service grouping / tags | No | No | No | v1.x |
| Keyboard shortcuts | No | No | No | v2+ |

---

## Sources

- [Cockpit systemd feature documentation](https://cockpit-project.org/guide/latest/feature-systemd) — MEDIUM confidence, official docs
- [Oracle Linux Cockpit services documentation](https://docs.oracle.com/en/operating-systems/oracle-linux/cockpit/cockpit-services.html) — HIGH confidence, official docs
- [Cockpit project homepage](https://cockpit-project.org/) — HIGH confidence, official
- [GitHub: Cockpit audit logging issue #9066](https://github.com/cockpit-project/cockpit/issues/9066) — HIGH confidence, first-party source; confirms Cockpit will NOT implement audit logs
- [GitHub: Cockpit service creator discussion #16894](https://github.com/cockpit-project/cockpit/discussions/16894) — HIGH confidence, first-party source; confirms UI complexity of unit creation
- [GitHub: sysdweb — systemd REST API service manager](https://github.com/ogarcia/sysdweb) — MEDIUM confidence, official repo
- [GitHub: Systemd-Service-Manager-Web-UI](https://github.com/1999AZZAR/Systemd-Service-Manager-Web-UI) — MEDIUM confidence, official repo; confirms no auth is a known limitation
- [Linuxiac: Grafito systemd journal log viewer](https://linuxiac.com/grafito-systemd-journal-log-viewer-with-a-beautiful-web-ui/) — LOW confidence, single source
- [Pinggy: journalctl real-time monitoring](https://pinggy.io/blog/journalctl_real_time_monitoring/) — MEDIUM confidence, technical reference
- [systemd-analyze official documentation](https://www.freedesktop.org/software/systemd/man/latest/systemd-analyze.html) — HIGH confidence, official docs; confirms dependency visualization tooling exists at CLI level only

---

*Feature research for: systemd service management web panel (systemdctl)*
*Researched: 2026-02-20*
