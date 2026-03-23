# Milestones

## v1.0 MVP (Shipped: 2026-03-23)

**Phases completed:** 6 phases, 12 plans
**Timeline:** 32 days (2026-02-20 → 2026-03-23)
**Lines of code:** 1,935 (JS/TS)
**Git range:** feat(01-01) → feat(06-01)

**Key accomplishments:**
- Secure systemd execution wrapper with execFile whitelist and input validation
- Live service dashboard with health metrics (PID, memory, CPU, uptime) and 10s auto-polling
- Full service control (start/stop/restart/enable/disable) with optimistic updates
- Search, status filtering, and watched/favorite services with SQLite persistence
- Per-service log viewer with time range filtering and color-coded severity
- Unit file editor with CodeMirror syntax highlighting and atomic save + daemon-reload

**Delivered:** A fully functional web panel for managing systemd services on a Linux VPS — dashboard, actions, logs, search, favorites, and unit file editing without SSH.

**Known Tech Debt:**
- Double /api/system fetch (Layout.tsx + Home.tsx both fetch independently)
- CodeMirror bundle ~884kB minified (~272kB gzip) — acceptable for admin tool

---

