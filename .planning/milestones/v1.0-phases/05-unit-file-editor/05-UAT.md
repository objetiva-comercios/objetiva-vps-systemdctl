---
status: resolved
phase: 05-unit-file-editor
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md
started: 2026-02-21T14:20:00Z
updated: 2026-02-21T18:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. FileCode link in service list
expected: Each service row in the dashboard shows a file icon (FileCode) link next to the existing logs (ScrollText) icon. The icon links to /unit/:service.
result: pass

### 2. Navigate to unit file page
expected: Clicking the file icon on a service row navigates to /unit/:service. The page loads showing the service name, the resolved file path, and the unit file content.
result: pass

### 3. Syntax highlighting in viewer
expected: The unit file content displays with visual distinction — [Section] headers and Key=Value pairs are syntax-highlighted (different colors/styles), not plain monochrome text.
result: issue
reported: "not seeing syntax-highlighted (different colors/styles)"
severity: minor

### 4. Edit button gating (writable file)
expected: For a service whose unit file lives in /etc/systemd/system/, the Edit button is enabled and clickable.
result: pass

### 5. Edit button gating (read-only file)
expected: For a package-managed service (unit file in /usr/lib/systemd/system/ or similar), the Edit button is disabled with a tooltip explaining the file is not editable.
result: pass

### 6. Edit mode with CodeMirror
expected: Clicking Edit on a writable file switches the view to a CodeMirror editor with the file content loaded, syntax-highlighted, and editable.
result: pass

### 7. Save changes
expected: After editing content in the editor, clicking Save sends the changes. A success message appears and the Save button disables (content matches saved state). The daemon-reload is triggered automatically.
result: issue
reported: "EACCES: permission denied, open '/etc/systemd/system/.tmp-docusaurus.service.fbd484ce'"
severity: blocker

## Summary

total: 7
passed: 5
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Unit file content displays with syntax highlighting — different colors for [Section] headers and Key=Value pairs"
  status: resolved
  reason: "User reported: not seeing syntax-highlighted (different colors/styles)"
  severity: minor
  test: 3
  root_cause: "Read-only view uses plain <pre> tag. CodeMirror only mounts in edit mode. No tokenizer runs on read-only content."
  artifacts:
    - path: "src/pages/UnitFile.tsx"
      issue: "Lines 191-193: plain <pre>{unitInfo.content}</pre> with no syntax highlighting"
  missing:
    - "Replace <pre> block with read-only CodeMirror instance using existing systemdLang extension (editable={false} readOnly={true})"
  debug_session: ".planning/debug/readonly-no-syntax-highlight.md"
- truth: "Save writes content atomically and triggers daemon-reload"
  status: resolved
  reason: "User reported: EACCES: permission denied, open '/etc/systemd/system/.tmp-docusaurus.service.fbd484ce'"
  severity: blocker
  test: 7
  root_cause: "Server runs as unprivileged user 'sanchez'. fs.writeFile() to /etc/systemd/system/ (root:root 0755) fails. systemctl commands work via D-Bus/polkit, but file writes are raw filesystem I/O with no privilege escalation."
  artifacts:
    - path: "server/routes/unit.js"
      issue: "Lines 112-116: direct fs.writeFile + fs.rename to root-owned directory"
  missing:
    - "Write temp file to /tmp, then sudo cp to destination, then sudo chmod 0644, matching the child-process pattern used by runSystemctl()"
  debug_session: ".planning/debug/unit-save-eacces.md"
- truth: "Service list should visually distinguish editable (/etc/systemd/system/) from system-managed services"
  status: resolved
  reason: "User reported: no way to differentiate user-created services from system-managed ones in the service list"
  severity: minor
  test: 4
  root_cause: "API does not include FragmentPath in bulk service list. ServiceRow has no writable indicator. SHOW_PROPS in systemctl.js omits FragmentPath."
  artifacts:
    - path: "server/utils/systemctl.js"
      issue: "SHOW_PROPS missing FragmentPath"
    - path: "src/types/service.ts"
      issue: "ServiceEntry missing fragmentPath and writable fields"
    - path: "src/components/ServiceRow.tsx"
      issue: "No visual indicator for editable vs system-managed"
  missing:
    - "Add FragmentPath to SHOW_PROPS, derive writable boolean, add to API response"
    - "Add fragmentPath and writable to ServiceEntry type"
    - "Add 'user' badge in ServiceRow for writable services"
  debug_session: ".planning/debug/api-unit-returns-html.md"
