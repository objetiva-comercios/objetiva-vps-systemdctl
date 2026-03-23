# Phase 1: Foundation - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffold, secure systemd execution wrapper, and visual shell baseline. The project builds, serves a React app from a Node.js server bound to 127.0.0.1, and all systemd interactions route through a single execFile wrapper with input validation. The dark terminal aesthetic is visible in the browser with no functional content yet.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User deferred all foundation decisions to Claude. The following areas are open for Claude to decide during research and planning:

- **Web UI shell** — Overall page layout structure (header, sidebar, navigation frame) that later phases will populate. Should feel like a server admin panel with the terminal aesthetic applied.
- **Server configuration** — How the admin sets port, bind address, and other options. Choose the simplest reasonable approach for a single-server admin tool.
- **Landing/placeholder page** — What appears in the browser when Phase 1 is complete (before Phase 2 adds the dashboard). Minimal is fine — just enough to confirm the aesthetic and that the server is running.
- **Error feedback pattern** — How systemd command failures surface in the web UI. Establish a pattern that later phases will reuse.

</decisions>

<specifics>
## Specific Ideas

Pre-project decisions that are locked (from PROJECT.md / project setup):
- Dark-only terminal aesthetic: `#0a0e14` background, `#22c55e` green accent, JetBrains Mono font — this is product identity, not a setting
- All systemd commands through single `execFile` wrapper with explicit action whitelist — no `exec()`, no shell strings
- Service name validation: `/^[\w@\-.]+$/` before any child process call
- SQLite with WAL mode for persistence
- Server binds to `127.0.0.1` only — no external exposure
- No auth in v1

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-20*
