---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [tailwindcss, react, react-router, lucide-react, jetbrains-mono, vite, layout]

# Dependency graph
requires:
  - phase: 01-01
    provides: Vite + Express scaffold, Tailwind v4 @theme brand tokens, Layout shell skeleton
provides:
  - Dark terminal aesthetic confirmed in browser: #0a0e14 background, #22c55e accent, JetBrains Mono font
  - React Router BrowserRouter wiring with SPA navigation (URL changes without page reload)
  - Layout component with header (systemdctl brand + hostname), sidebar (Services/Logs/Settings nav), Outlet content area
  - Home page placeholder with "Server Running" status message
  - Complete Phase 1 frontend shell ready for Phase 2 dashboard content injection
affects: [02-dashboard, 03-logs, 04-log-streaming, 05-unit-files]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - React Router v7 layout route pattern (Route with element=Layout wrapping child Routes via Outlet)
    - Tailwind v4 utility classes referencing @theme tokens (bg-bg-base, text-accent, border-border)
    - Lucide-react icons in nav items and header branding (Terminal, Server, ScrollText, Settings, CircleDot)

key-files:
  created:
    - src/pages/Home.tsx (placeholder landing with "Server Running" status card)
  modified:
    - src/index.css (Tailwind v4 @theme brand tokens + JetBrains Mono import — finalized)
    - src/main.tsx (BrowserRouter wrapping App)
    - src/App.tsx (React Router Routes + Layout wrapper)
    - src/components/Layout.tsx (header + sidebar + Outlet content area)
    - index.html (title="systemdctl", theme-color meta tag)

key-decisions:
  - "HOST binding must use Tailscale IP (100.87.113.34) not 0.0.0.0 — VPS accessed only via Tailscale VPN"
  - "React Router v7 imports from react-router (not react-router-dom) — packages merged in v7"
  - "Outlet pattern for layout route — child routes render inside Layout without re-mounting shell"

patterns-established:
  - "Pattern: Layout route — App.tsx wraps all routes in a single Layout Route element, pages render via Outlet"
  - "Pattern: Tailwind token classes — bg-bg-base, text-text-primary, text-accent, border-border are canonical names for all components"
  - "Pattern: Nav item active state — text-accent bg-bg-elevated for active/current route, text-text-muted hover:text-accent for inactive"

requirements-completed: [INFR-01]

# Metrics
duration: ~30min
completed: 2026-02-20
---

# Phase 1 Plan 02: Frontend Shell Summary

**Tailwind v4 dark terminal aesthetic (JetBrains Mono, #0a0e14 background, #22c55e accent) with React Router layout shell — header, sidebar nav, and placeholder Home page — visually approved in browser**

## Performance

- **Duration:** ~30 min (includes human verification checkpoint)
- **Started:** 2026-02-20T11:22:00Z
- **Completed:** 2026-02-20T11:57:48Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 6

## Accomplishments
- Replaced Vite scaffold boilerplate with project-specific CSS, components, and pages
- Established Tailwind v4 @theme token system: background (#0a0e14), accent (#22c55e), muted, surface, border, danger, warning, info colors all available as utility classes
- Layout component renders full-viewport header + fixed-width sidebar + scrollable content area with no white flash or unstyled content
- React Router BrowserRouter wiring confirmed: URL changes work as SPA navigation without full page reload
- Human visual verification confirmed: "todo se ve bien" — dark terminal aesthetic matches product identity

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up Tailwind v4 theme, React Router, and the Layout + Home page components** - `ef700df` (feat)
2. **Task 2: Verify dark terminal aesthetic in browser** - N/A (checkpoint — human visual verification, no code changes)

**Plan metadata:** _(see final commit below)_

## Files Created/Modified
- `src/index.css` - Tailwind v4 @import + @theme brand tokens + JetBrains Mono variable font import
- `src/main.tsx` - React entry point with StrictMode + BrowserRouter wrapping App
- `src/App.tsx` - React Router Routes: Layout as parent route, Home as index child route
- `src/components/Layout.tsx` - App shell: header (Terminal icon + "systemdctl" in green + hostname), sidebar (Services/Logs/Settings nav with lucide icons, Services highlighted active), Outlet content area
- `src/pages/Home.tsx` - Placeholder landing: "System Status" card with CircleDot icon + "Server Running" message
- `index.html` - Title set to "systemdctl", theme-color meta tag added (#0a0e14)

## Decisions Made
- **HOST binding = Tailscale IP (100.87.113.34), never 0.0.0.0.** The VPS is accessed exclusively via Tailscale VPN. Binding to 0.0.0.0 would expose the panel on all interfaces. The .env HOST variable must be set to 100.87.113.34 for production deployments.
- React Router v7 uses `react-router` package (not `react-router-dom`) — the packages were merged in v7.
- Layout route uses the `Outlet` pattern: App.tsx places `<Layout />` as the parent Route element, child routes render inside it without re-mounting the shell on navigation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

**Deployment note (from user decision):** When running in production on the VPS, ensure `.env` contains:
```
HOST=100.87.113.34
PORT=7700
```
This binds the server to the Tailscale interface only. Do not use `HOST=0.0.0.0`.

## Next Phase Readiness
- Frontend shell complete: Phase 2 can populate the Layout's Outlet with the service dashboard
- All Tailwind token classes established and tested visually — Phase 2 components use the same classes
- React Router routing works — Phase 2 adds `/services` route and wires the "Services" sidebar nav item to it
- execFile wrapper and SQLite DB (from Plan 01-01) ready for Phase 2 API endpoints
- One blocker for deployment: HOST must be set to 100.87.113.34 (Tailscale IP) in .env — server/config.js already reads HOST from env

---
*Phase: 01-foundation*
*Completed: 2026-02-20*

## Self-Check: PASSED

- FOUND: .planning/phases/01-foundation/01-02-SUMMARY.md
- FOUND: src/pages/Home.tsx
- FOUND: src/components/Layout.tsx
- FOUND: commit ef700df (feat(01-02): implement dark terminal aesthetic UI shell)
