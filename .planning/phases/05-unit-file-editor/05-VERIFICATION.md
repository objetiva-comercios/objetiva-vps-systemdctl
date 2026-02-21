---
phase: 05-unit-file-editor
verified: 2026-02-21T16:00:00Z
status: passed
score: 17/17 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 13/13
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  notes: >
    Previous verification only covered plans 05-01 and 05-02. Plans 05-03 and
    05-04 (gap-closure plans added after UAT) were not covered. This
    re-verification covers all four plans and corrects inaccurate claims in the
    prior report (read-only view is now CodeMirror, not a <pre> block; write
    uses sudo cp, not same-dir temp+rename).
---

# Phase 5: Unit File Editor Verification Report

**Phase Goal:** The admin can read and edit a service's unit file from the
browser, with the change applied and reloaded on the server without SSH
**Verified:** 2026-02-21T16:00:00Z
**Status:** PASSED
**Re-verification:** Yes — previous report covered only plans 01-02; plans
03-04 were gap-closure plans added after UAT and are now included.

---

## Goal Achievement

### Observable Truths

The phase spans four plans. Truths are grouped by plan. All 17 truths verified
against actual code at the paths and line numbers cited.

#### Plan 01 Truths — Backend API (server/routes/unit.js + server/utils/exec.js + server/index.js)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/unit/:service returns unit file content, path, and writable flag | VERIFIED | `server/routes/unit.js` line 72: `return res.json({ ok: true, service, path: fragmentPath, content, writable })` — all five fields present |
| 2 | PUT /api/unit/:service writes content and triggers daemon-reload | VERIFIED | Lines 117-124: writes to /tmp, `sudo cp` to dest, `sudo chmod`, then `runSystemctl('daemon-reload', null)` — write and reload both present |
| 3 | Read requests work for files in all four systemd paths | VERIFIED | `READ_PREFIXES` array at lines 13-18 covers `/etc/systemd/system/`, `/usr/lib/systemd/system/`, `/lib/systemd/system/`, `/run/systemd/system/` |
| 4 | Write requests rejected with 403 for files outside /etc/systemd/system/ | VERIFIED | Lines 108-112: `destPath.startsWith(WRITE_PREFIX)` check returns 403 with `'Only files in /etc/systemd/system/ can be edited'` |
| 5 | Invalid service names rejected with 400 before any systemctl call | VERIFIED | GET line 56 and PUT line 89: `SERVICE_NAME_RE.test(service)` checked first; 400 returned before `getFragmentPath` is called |
| 6 | daemon-reload passes through exec.js allowlist without error | VERIFIED | `server/utils/exec.js` line 18: `'daemon-reload'` present in frozen `ALLOWED_ACTIONS` array with comment `// Phase 5: needed by unit file writer after save` |

#### Plan 02 Truths — Frontend (src/pages/UnitFile.tsx + src/App.tsx + src/components/ServiceRow.tsx)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Navigating to /unit/:service displays unit file content in a read-only view | VERIFIED | `UnitFile.tsx` lines 190-206: CodeMirror with `editable={false}` and `readOnly={true}` renders `value={unitInfo.content}` |
| 8 | Unit file path shown in header | VERIFIED | `UnitFile.tsx` line 108: `<span className="text-text-muted text-xs font-mono">{unitInfo.path}</span>` |
| 9 | Clicking Edit opens CodeMirror editor with INI/systemd syntax highlighting | VERIFIED | Module-level `systemdLang = StreamLanguage.define(properties)` at line 18; edit-mode CodeMirror at lines 209-224 with `extensions={[systemdLang]}`; `properties` mode is INI/systemd tokenizer |
| 10 | Saving a modified unit file sends PUT request and returns to read-only view on success | VERIFIED | `handleSave()` lines 52-76: PUT fetch at line 57; on success `setUnitInfo({ ...unitInfo, content: editContent })` at line 66 and `setEditing(false)` at line 67 |
| 11 | Edit button disabled with tooltip when file not in /etc/systemd/system/ | VERIFIED | Lines 132-144: `disabled={!unitInfo.writable}`; `title="Package-managed file — editing not allowed"` when `!unitInfo.writable`; `opacity-40 cursor-not-allowed` styling applied |
| 12 | Each service row has FileCode icon link to /unit/:service | VERIFIED | `ServiceRow.tsx` line 16: `FileCode` in lucide-react import; lines 179-185: `<Link to={/unit/${encodeURIComponent(service.unit)}}><FileCode /></Link>` |
| 13 | Save button disabled when content has not changed | VERIFIED | Line 150: `disabled={saving \|\| editContent === unitInfo?.content}` |

#### Plan 03 Truths — Privilege Escalation + FragmentPath in Service List

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 14 | PUT /api/unit/:service saves content even when server runs as non-root | VERIFIED | `server/routes/unit.js` lines 117-121: writes temp to `/tmp` (world-writable), then `execFileAsync('/usr/bin/sudo', ['cp', tmpPath, destPath])` and `execFileAsync('/usr/bin/sudo', ['chmod', '0644', destPath])` — privilege escalation present |
| 15 | GET /api/services returns fragmentPath and writable boolean for each service | VERIFIED | `server/utils/systemctl.js` line 6: `FragmentPath` in `SHOW_PROPS`; lines 106-107: `fragmentPath: detail.FragmentPath \|\| null` and `writable: detail.FragmentPath ? resolve(detail.FragmentPath).startsWith('/etc/systemd/system/') : false` |

#### Plan 04 Truths — Read-only Syntax Highlighting + Writable Badge

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 16 | Read-only view uses CodeMirror with INI/systemd syntax highlighting, not a plain pre block | VERIFIED | `UnitFile.tsx` lines 190-206: CodeMirror component with `editable={false}`, `readOnly={true}`, and `extensions={[systemdLang]}` — same `properties` tokenizer as edit mode |
| 17 | Service list visually distinguishes user-created services with a "user" badge | VERIFIED | `ServiceRow.tsx` lines 96-103: `{service.writable && (<span>user</span>)}` with accent-color border and tooltip |

**Score: 17/17 truths verified**

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/routes/unit.js` | Unit file read/write API endpoints | VERIFIED | 133 lines. Substantive: GET handler at lines 52-79, PUT handler at lines 84-130. Exports default router. Wired: imported in `server/index.js` and mounted at `/api/unit` |
| `server/utils/exec.js` | daemon-reload in ALLOWED_ACTIONS | VERIFIED | `'daemon-reload'` at line 18 of frozen array. Wired: called via `runSystemctl('daemon-reload', null)` at `unit.js` line 124 |
| `server/index.js` | Unit router mounted at /api/unit | VERIFIED | Line 9: `import unitRouter from './routes/unit.js'`; line 32: `app.use('/api/unit', unitRouter)` before error middleware |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/unit.ts` | UnitFileInfo TypeScript interface | VERIFIED | 6 lines. Exports `UnitFileInfo` with all four fields: `service`, `path`, `content`, `writable`. Wired: imported in `UnitFile.tsx` line 15 |
| `src/pages/UnitFile.tsx` | Unit file viewer/editor page with CodeMirror | VERIFIED | 244 lines (well above 80-line minimum). Full implementation: state management, fetch, read-only CodeMirror, edit-mode CodeMirror, save handler, mode toggles. Wired: mounted in `App.tsx` at `/unit` and `/unit/:service` |
| `src/App.tsx` | Routes for /unit and /unit/:service | VERIFIED | Lines 15-16: `<Route path="unit" element={<UnitFile />} />` and `<Route path="unit/:service" element={<UnitFile />} />`. Wired: `UnitFile` imported at line 5 |
| `src/components/ServiceRow.tsx` | FileCode icon link to unit file page | VERIFIED | `FileCode` imported at line 16; used in `<Link to={/unit/...}>` at lines 179-185. Wired: rendered inside every service row's action cell |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/routes/unit.js` | Privilege-escalated file write via sudo cp | VERIFIED | Lines 117-121: `execFileAsync('/usr/bin/sudo', ['cp', tmpPath, destPath])` and `execFileAsync('/usr/bin/sudo', ['chmod', '0644', destPath])`. `execFile` imported at line 3, `promisify` at line 4, local `execFileAsync` at line 10 |
| `server/utils/systemctl.js` | FragmentPath in SHOW_PROPS and writable derivation | VERIFIED | Line 6: `FragmentPath` appended to `SHOW_PROPS` string; lines 106-107: `fragmentPath` and `writable` returned for every service. `resolve` imported from `node:path` at line 3. Wired: consumed by `server/routes/services.js` via `getAllServices()` |
| `src/types/service.ts` | fragmentPath and writable fields on ServiceEntry | VERIFIED | Lines 13-14: `fragmentPath: string \| null` and `writable: boolean` present in `ServiceEntry` interface. Wired: `service.writable` consumed in `ServiceRow.tsx` line 96 |

### Plan 04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pages/UnitFile.tsx` | Read-only CodeMirror with editable={false} and readOnly={true} | VERIFIED | Lines 190-206: CodeMirror with `editable={false}`, `readOnly={true}`, `extensions={[systemdLang]}`, `highlightActiveLine: false`. Not a `<pre>` block — full syntax highlighting active in read-only mode |
| `src/components/ServiceRow.tsx` | Visual badge for writable/user services | VERIFIED | Lines 96-103: `{service.writable && (<span ...>user</span>)}` — conditional on `service.writable` from `ServiceEntry` type |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/routes/unit.js` | `server/utils/exec.js` | `runSystemctl('show', ...)` and `runSystemctl('daemon-reload', null)` | WIRED | Line 42: `runSystemctl('show', service, ['-p', 'FragmentPath'])` inside `getFragmentPath()`; line 124: `runSystemctl('daemon-reload', null)` after successful write. Both calls present and results used. |
| `server/index.js` | `server/routes/unit.js` | `import unitRouter + app.use('/api/unit', unitRouter)` | WIRED | Line 9: import; line 32: mount — before error middleware. |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/UnitFile.tsx` | `/api/unit/:service` | fetch GET on mount, fetch PUT on save | WIRED | Line 34: `fetch('/api/unit/' + encodeURIComponent(service))` in `fetchUnitFile`; line 57: same URL with `method: 'PUT'` in `handleSave`. Both responses parsed and state updated. |
| `src/components/ServiceRow.tsx` | `src/pages/UnitFile.tsx` | `Link to=/unit/:service` | WIRED | Line 180: `to={/unit/${encodeURIComponent(service.unit)}}` — navigates to the unit file route on click. |
| `src/App.tsx` | `src/pages/UnitFile.tsx` | `Route element={<UnitFile />}` | WIRED | Lines 15-16: `<UnitFile />` mounted at `/unit` and `/unit/:service`. |

### Plan 03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/routes/unit.js` | `/usr/bin/sudo` | `execFileAsync('/usr/bin/sudo', ['cp', ...])` | WIRED | Line 119: `execFileAsync('/usr/bin/sudo', ['cp', tmpPath, destPath])` and line 120: `execFileAsync('/usr/bin/sudo', ['chmod', '0644', destPath])`. `shell: true` is NOT used — INFR-03 posture maintained. |
| `server/utils/systemctl.js` | `server/routes/services.js` | `FragmentPath` in `SHOW_PROPS` consumed by `getAllServices()` | WIRED | `FragmentPath` at line 6 of `SHOW_PROPS`; returned as `fragmentPath`/`writable` fields at lines 106-107; `getAllServices()` is called by `server/routes/services.js`. |

### Plan 04 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/UnitFile.tsx` | `@uiw/react-codemirror` | `CodeMirror` with `editable={false}` and `readOnly={true}` | WIRED | `CodeMirror` imported at line 12; used for read-only view at lines 191-205 and edit-mode at lines 210-223. `systemdLang` extension applied in both instances. |
| `src/components/ServiceRow.tsx` | `src/types/service.ts` | `service.writable` boolean from `ServiceEntry` | WIRED | `ServiceEntry.writable` defined at line 14 of `service.ts`; `service.writable` read at line 96 of `ServiceRow.tsx` to conditionally render the badge. |

---

## Requirements Coverage

All three requirement IDs declared across plans are accounted for. No orphaned requirements.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UNIT-01 | 05-01, 05-02, 05-04 | User can view the content of a service's unit file | SATISFIED | GET /api/unit/:service returns content; UnitFile.tsx renders it in a read-only CodeMirror instance with the file path shown in the header. Plan 05-04 upgraded from plain `<pre>` to syntax-highlighted CodeMirror. |
| UNIT-02 | 05-02, 05-04 | User can edit unit files with INI/systemd syntax highlighting | SATISFIED | `StreamLanguage.define(properties)` from `@codemirror/legacy-modes` provides INI/systemd tokenization; applied to both read-only and edit-mode CodeMirror instances. Edit button is gated by the `writable` flag from the API. |
| UNIT-03 | 05-01, 05-02, 05-03 | Saving a unit file triggers automatic daemon-reload | SATISFIED | PUT handler calls `runSystemctl('daemon-reload', null)` at line 124 after successful write; `daemon-reload` is in the `ALLOWED_ACTIONS` allowlist; privilege-escalation (sudo cp) ensures the write succeeds for non-root server processes before reload is attempted. |

Traceability in `REQUIREMENTS.md` maps UNIT-01, UNIT-02, and UNIT-03 exclusively to Phase 5 with status "Complete". Consistent with plan claims. No additional Phase 5 requirement IDs appear in REQUIREMENTS.md beyond these three.

---

## Correction to Previous Verification Report

The previous VERIFICATION.md (status: passed, score 13/13) contained two inaccurate claims that are corrected here:

1. **Read-only view was described as a `<pre>` block.** At the time of plan 05-02 completion this was true, but plan 05-04 replaced it with a read-only CodeMirror instance (`editable={false}`, `readOnly={true}`). The current code correctly uses CodeMirror in both modes, providing syntax highlighting in read-only view — which was a UAT gap that plan 05-04 was created to fix. Truth 7 is still VERIFIED under the new implementation.

2. **Write implementation was described as "temp+rename in same directory."** That was the plan 05-01 design. Plan 05-03 replaced it with `/tmp` + `sudo cp` + `sudo chmod` to resolve an EACCES error when the server runs as a non-root user. The current code correctly uses the sudo-based approach. Truth 2 is still VERIFIED under the new implementation.

The previous report also did not cover plans 05-03 and 05-04. This report adds their truths (14-17) and artifacts.

---

## Anti-Patterns Found

No anti-patterns detected.

Files scanned:
- `server/routes/unit.js` — no TODO/FIXME/placeholder; no empty return bodies; the `try { await unlink(tmpPath) } catch {}` is an intentional cleanup no-op, not a stub; all state used.
- `server/utils/exec.js` — no phase-5-introduced issues; frozen allowlist structurally unchanged.
- `server/utils/systemctl.js` — no TODO/FIXME; `FragmentPath` integration is complete.
- `server/index.js` — clean import and mount.
- `src/types/unit.ts` — complete interface definition.
- `src/types/service.ts` — `fragmentPath` and `writable` fields fully defined.
- `src/pages/UnitFile.tsx` — no TODO/FIXME; all state variables used in render; fetch responses parsed and applied to state; CodeMirror instances substantive.
- `src/App.tsx` — clean route additions.
- `src/components/ServiceRow.tsx` — FileCode import used in JSX; `service.writable` badge conditional correct.

---

## Build Verification

`npm run build` passes with no TypeScript errors and no Vite build errors. Only
a chunk size warning for the main bundle (~884 kB minified, ~272 kB gzip) due
to CodeMirror. Expected for a dev admin tool; noted in plan summaries as a
known non-issue.

---

## Human Verification Required

The following behaviors require a running environment to confirm.

### 1. INI/systemd Syntax Highlighting Visual Quality (Read-Only Mode)

**Test:** Navigate to `/unit/` for any service with a file in `/etc/systemd/system/` (e.g., `docusaurus.service`). Without clicking Edit, observe the content panel.
**Expected:** `[Section]` headers are colored differently from `Key=Value` lines. Both differ from plain comment lines (`#`). Not all rendered in a single monochrome color.
**Why human:** Visual rendering of the `properties` StreamLanguage mode against the dark CodeMirror theme cannot be verified programmatically.

### 2. INI/systemd Syntax Highlighting Visual Quality (Edit Mode)

**Test:** Click Edit on a writable unit file. Observe the editor.
**Expected:** Same distinct coloring as read-only mode — `[Section]` headers, `Key=Value` pairs, and comments are visually distinct.
**Why human:** Same as above.

### 3. End-to-End Write + daemon-reload Flow

**Test:** Edit a writable unit file (in `/etc/systemd/system/`). Add a comment line, click Save.
**Expected:** Save succeeds (green "Saved" flash appears for ~2 seconds), the UI returns to read-only view showing the updated content including the new comment, and `systemctl daemon-reload` runs without error on the server (verify with `journalctl -u systemd --since "1 min ago"` or check server logs).
**Why human:** Requires a real systemd environment with `sudo cp` sudoers permission configured for the server process user.

### 4. Writable Flag Enforcement in UI

**Test:** Navigate to `/unit/` for a package-managed service (e.g., `systemd-journald.service` in `/usr/lib/systemd/system/`).
**Expected:** Edit button is visually grayed out (opacity-40) and shows tooltip "Package-managed file — editing not allowed" on hover. Clicking the button has no effect.
**Why human:** Requires a real service with a non-writable FragmentPath to exercise the disabled state end-to-end.

### 5. Save Button Disabled State Behavior

**Test:** Open a writable unit file in edit mode. Do not change any content.
**Expected:** Save button is visibly disabled. Make a change — Save becomes enabled. Revert the change (restore original text) — Save becomes disabled again.
**Why human:** The `editContent === unitInfo?.content` string comparison works correctly in JavaScript but its correctness for large files and whitespace-only changes requires interactive verification in the browser.

### 6. "user" Badge in Service List

**Test:** View the service dashboard. Look for services known to have files in `/etc/systemd/system/`.
**Expected:** Those services show a small green "user" badge next to their name. Services in `/usr/lib/systemd/system/` show no badge.
**Why human:** Requires a live server returning real `fragmentPath` + `writable` values from `GET /api/services`.

---

## Gaps Summary

No gaps. All 17 observable truths verified, all 11 artifacts exist and are substantive, all 9 key links are wired. The phase goal is fully achieved:

- An admin navigates from any service row in the dashboard via the FileCode icon to the unit file page.
- The page fetches and displays the service's unit file content in a syntax-highlighted, read-only CodeMirror instance, with the file path shown in the header.
- For writable files (in `/etc/systemd/system/`), the admin clicks Edit to open the same content in an editable CodeMirror instance with INI/systemd tokenization.
- Saving sends a PUT request; the server writes a temp file to `/tmp`, uses `sudo cp` to place it in the destination, sets `0644` permissions, then calls `systemctl daemon-reload` — the admin does not touch SSH or a terminal.
- For package-managed files (not in `/etc/systemd/system/`), the Edit button is disabled with a tooltip.
- The service list shows a "user" badge on services whose unit files are in `/etc/systemd/system/`, distinguishing user-managed from system-managed services.

---

_Verified: 2026-02-21T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
